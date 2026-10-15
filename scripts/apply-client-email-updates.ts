/**
 * Apply Correct Email values from the team fill template onto ClientProfile.
 *
 * Usage:
 *   npx ts-node scripts/apply-client-email-updates.ts --dry-run
 *   npx ts-node scripts/apply-client-email-updates.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import * as ExcelJS from 'exceljs';

const prisma = new PrismaClient();

const XLSX = path.join(
  __dirname,
  'archived-excel',
  'client-email-agreement-template-MISSING-2026-10-14.xlsx',
);

const EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;

function cellText(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'string') return raw.trim();
  if (typeof raw === 'number') return String(raw);
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === 'object' && raw !== null) {
    const o = raw as Record<string, unknown>;
    if ('text' in o) return cellText(o.text);
    if ('result' in o) return cellText(o.result);
    if (Array.isArray(o.richText)) {
      return (o.richText as { text?: string }[]).map((r) => r.text ?? '').join('').trim();
    }
  }
  return String(raw).trim();
}

function normalizeEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase();
  if (!e || e === '#n/a' || e === 'n/a' || e === 'na' || e === '-' || e === '.') return null;
  if (!EMAIL_RE.test(e)) return null;
  if (e.startsWith('unknown+') || e.endsWith('@aspire.import')) return null;
  return e;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (!fs.existsSync(XLSX)) throw new Error(`Missing file: ${XLSX}`);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX);
  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error('No worksheet found');

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = cellText(cell.value);
  });

  const idx = (candidates: string[]) => {
    const map = headers.map((h) => h.trim().toLowerCase());
    for (const c of candidates) {
      const i = map.indexOf(c.toLowerCase());
      if (i >= 0) return i;
    }
    for (const c of candidates) {
      const i = map.findIndex((h) => h.includes(c.toLowerCase()));
      if (i >= 0) return i;
    }
    return -1;
  };

  const colId = idx(['client id (do not change)', 'client id']);
  const colCompany = idx(['company name']);
  const colCorrect = idx(['correct email (fill this)', 'correct email']);
  if (colId < 0 || colCorrect < 0) {
    throw new Error(`Required columns missing. headers=${JSON.stringify(headers)}`);
  }

  type Update = { id: string; companyName: string; email: string; previous?: string };
  const planned: Update[] = [];
  const skipped: { reason: string; company?: string; raw?: string }[] = [];

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const id = cellText(row.getCell(colId + 1).value);
    const company = colCompany >= 0 ? cellText(row.getCell(colCompany + 1).value) : '';
    const rawEmail = cellText(row.getCell(colCorrect + 1).value);
    if (!id && !rawEmail) continue;
    if (!id) {
      skipped.push({ reason: 'MISSING_ID', company, raw: rawEmail });
      continue;
    }
    if (!rawEmail) {
      skipped.push({ reason: 'EMPTY_EMAIL', company });
      continue;
    }
    const email = normalizeEmail(rawEmail);
    if (!email) {
      skipped.push({ reason: 'INVALID_OR_NA_EMAIL', company, raw: rawEmail });
      continue;
    }
    planned.push({ id, companyName: company, email });
  }

  console.log(`Planned updates: ${planned.length}`);
  console.log(`Skipped: ${skipped.length}`);
  const skipCounts = skipped.reduce<Record<string, number>>((a, s) => {
    a[s.reason] = (a[s.reason] || 0) + 1;
    return a;
  }, {});
  console.log('Skip reasons:', skipCounts);

  let updated = 0;
  let missing = 0;
  let unchanged = 0;
  const errors: string[] = [];

  for (const item of planned) {
    const existing = await prisma.clientProfile.findUnique({
      where: { id: item.id },
      select: { id: true, companyName: true, contactEmail: true },
    });
    if (!existing) {
      missing++;
      errors.push(`NOT_FOUND ${item.id} ${item.companyName}`);
      continue;
    }
    if ((existing.contactEmail || '').trim().toLowerCase() === item.email) {
      unchanged++;
      continue;
    }
    if (dryRun) {
      if (updated < 5) {
        console.log(
          `[dry-run] ${existing.companyName}: ${existing.contactEmail} -> ${item.email}`,
        );
      }
      updated++;
      continue;
    }
    await prisma.clientProfile.update({
      where: { id: item.id },
      data: { contactEmail: item.email },
    });
    updated++;
    if (updated % 100 === 0) console.log(`… updated ${updated}/${planned.length}`);
  }

  const outDir = path.join(__dirname, 'migration-output');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(
    path.join(outDir, `email-update-${dryRun ? 'dryrun-' : ''}${stamp}.json`),
    JSON.stringify({ dryRun, planned: planned.length, updated, unchanged, missing, skipCounts, errors: errors.slice(0, 50) }, null, 2),
  );

  console.log(`\nMode: ${dryRun ? 'dry-run' : 'apply'}`);
  console.log(`Updated: ${updated}`);
  console.log(`Unchanged (already same): ${unchanged}`);
  console.log(`Client ID not found: ${missing}`);
  if (errors.length) console.log(`Sample errors:\n${errors.slice(0, 10).join('\n')}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
