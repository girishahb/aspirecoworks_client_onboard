/**
 * Import Rate card sheet → vendor_rate_cards (GST exclusive).
 *
 * Usage:
 *   npx ts-node scripts/import-vendor-rate-cards.ts
 *   npx ts-node scripts/import-vendor-rate-cards.ts --dry-run
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import * as ExcelJS from 'exceljs';

const prisma = new PrismaClient();
const XLSX = path.join(__dirname, 'archived-excel', 'all-clients-export_v1.xlsx');
const OUT_DIR = path.join(__dirname, 'migration-output');

/** Explicit Rate-card company name → vendor code (strong matches only) */
const NAME_TO_CODE: Record<string, string> = {
  'instaspaces realtech private limited': 'virtual_insta',
  'nss it': 'virtual_address_in',
  echospace: 'virtual_echospaces',
  'stirring minds services private limited': 'virtual_teamcoworks',
  'virtualxcel solutions private limited': 'virtual_virtualxcel',
  'vo spaces': 'virtual_vospaces',
  quickoffice24: 'virtual_quickoffice24',
  iofficespace: 'virtual_ioffice',
  'quicku technology solutions private limited': 'virtual_q_office',
  rayafeel: 'virtual_rayafeel',
  'juststart technologies private limited': 'virtual_juststart',
  'myhq anarock pvt. ltd': 'virtual_myhq',
  'myhq anarock pvt ltd': 'virtual_myhq',
  'tax source': 'tax_source',
  'ofin legal pvt.ltd': 'ofin_legal',
  'ofin legal pvt ltd': 'ofin_legal',
  'namaste office': 'namaste_office',
  getaspace: 'getaspace',
  'work e-commerce': 'work_e_commerce',
};

/** Names that must not auto-map — leave for manual review */
const FORCE_QUARANTINE = new Set([
  'mxn realspaces private limited',
  'xporate',
  'gmt group',
  'transource business solutions private limited',
]);

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(s: string): Set<string> {
  return new Set(
    norm(s)
      .split(' ')
      .filter((t) => t.length > 2 && !['pvt', 'ltd', 'private', 'limited', 'the'].includes(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / new Set([...a, ...b]).size;
}

type VendorRef = { code: string; name: string };

function resolveVendor(
  companyName: string,
  vendorsByCode: Map<string, VendorRef>,
): { code: string | null; method: string; score: number } {
  const key = norm(companyName);
  if (FORCE_QUARANTINE.has(key)) {
    return { code: null, method: 'manual-review', score: 0 };
  }

  const explicit = NAME_TO_CODE[key];
  if (explicit && vendorsByCode.has(explicit)) {
    return { code: explicit, method: 'alias', score: 1 };
  }

  let best: { code: string; score: number } | null = null;
  const companyTokens = tokenSet(companyName);
  for (const [code, ref] of vendorsByCode) {
    const nameScore = jaccard(companyTokens, tokenSet(ref.name));
    const codeScore = jaccard(companyTokens, tokenSet(code.replace(/_/g, ' ')));
    const contains =
      norm(ref.name).includes(key) ||
      key.includes(norm(ref.name)) ||
      key.replace(/ /g, '').includes(code.replace(/_/g, ''));
    let score = Math.max(nameScore, codeScore);
    if (contains) score = Math.max(score, 0.75);
    if (!best || score > best.score) best = { code, score };
  }

  if (best && best.score >= 0.55) {
    return { code: best.code, method: 'fuzzy', score: best.score };
  }
  return { code: null, method: 'unmatched', score: best?.score ?? 0 };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (!fs.existsSync(XLSX)) {
    throw new Error(`Missing workbook: ${XLSX}`);
  }

  const vendors = await prisma.vendor.findMany({
    where: { isActive: true },
    select: { code: true, name: true },
  });
  const vendorsByCode = new Map<string, VendorRef>();
  for (const v of vendors) {
    if (!vendorsByCode.has(v.code)) vendorsByCode.set(v.code, v);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX);
  const sheet = wb.getWorksheet('Rate card');
  if (!sheet) throw new Error('Sheet "Rate card" not found');

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = String(cell.value ?? '').trim();
  });

  const colCompany = headers.findIndex((h) => /company/i.test(h));
  const membershipCols: { idx: number; type: string }[] = [];
  headers.forEach((h, idx) => {
    if (!h || /company|gst/i.test(h)) return;
    membershipCols.push({ idx, type: h });
  });

  console.log('Membership columns:', membershipCols.map((c) => c.type).join(', '));

  type RowOut = {
    companyName: string;
    vendorCode: string | null;
    method: string;
    score: number;
    membershipType: string;
    rateExclusive: number;
  };
  const parsed: RowOut[] = [];
  const quarantine: { companyName: string; reason: string; score: number }[] = [];

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const companyName = String(row.getCell(colCompany + 1).value ?? '').trim();
    if (!companyName) continue;

    const resolved = resolveVendor(companyName, vendorsByCode);
    if (!resolved.code) {
      quarantine.push({
        companyName,
        reason: resolved.method,
        score: resolved.score,
      });
    }

    for (const mc of membershipCols) {
      const raw = row.getCell(mc.idx + 1).value;
      if (raw === null || raw === undefined || raw === '') continue;
      const rate =
        typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, '').trim());
      if (!Number.isFinite(rate)) continue;
      parsed.push({
        companyName,
        vendorCode: resolved.code,
        method: resolved.method,
        score: resolved.score,
        membershipType: mc.type,
        rateExclusive: rate,
      });
    }
  }

  const toImport = parsed.filter((p) => p.vendorCode);
  const skipped = parsed.filter((p) => !p.vendorCode);

  console.log(`\nParsed rate cells: ${parsed.length}`);
  console.log(`Matched for import: ${toImport.length}`);
  console.log(`Unmatched rate cells: ${skipped.length}`);
  console.log(`Unmatched companies: ${quarantine.length}`);
  quarantine.forEach((q) => console.log(`  QUARANTINE: ${q.companyName} (${q.reason}, score=${q.score.toFixed(2)})`));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(
    path.join(OUT_DIR, `rate-card-quarantine-${stamp}.csv`),
    ['companyName,reason,score', ...quarantine.map((q) => `"${q.companyName}",${q.reason},${q.score}`)].join(
      '\n',
    ) + '\n',
  );
  fs.writeFileSync(
    path.join(OUT_DIR, `rate-card-matched-${stamp}.csv`),
    [
      'companyName,vendorCode,method,score,membershipType,rateExclusive',
      ...toImport.map(
        (p) =>
          `"${p.companyName}",${p.vendorCode},${p.method},${p.score},${p.membershipType},${p.rateExclusive}`,
      ),
    ].join('\n') + '\n',
  );

  if (dryRun) {
    console.log('\nDry run — no DB writes.');
    return;
  }

  let upserts = 0;
  for (const row of toImport) {
    await prisma.vendorRateCard.upsert({
      where: {
        vendorCode_membershipType: {
          vendorCode: row.vendorCode!,
          membershipType: row.membershipType,
        },
      },
      create: {
        vendorCode: row.vendorCode!,
        sourceCompanyName: row.companyName,
        membershipType: row.membershipType,
        rateExclusive: row.rateExclusive,
        currency: 'INR',
        isActive: true,
      },
      update: {
        sourceCompanyName: row.companyName,
        rateExclusive: row.rateExclusive,
        isActive: true,
      },
    });
    upserts++;
  }

  const total = await prisma.vendorRateCard.count();
  console.log(`\nUpserted ${upserts} rows. vendor_rate_cards total: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
