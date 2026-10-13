/**
 * Load clients from an archived Excel export (FieldMapping sheet rules).
 *
 * Usage:
 *   npx ts-node scripts/migrate-export-v1.ts --qa-only
 *   npx ts-node scripts/migrate-export-v1.ts --dry-run
 *   npx ts-node scripts/migrate-export-v1.ts
 *   npx ts-node scripts/migrate-export-v1.ts --file=all-clients-export_physical.xlsx
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, OnboardingStage, OperationalStatus, ClientChannel } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { compareIsoDates, parseExcelDate, isoToDateOnly } from './lib/excel-date';
import { leadSourceToClientChannel } from '../src/common/constants/client-ops-options';
import { normalizeVendor } from './lib/vendor-normalize';

const prisma = new PrismaClient();
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_SOURCE = path.join(ROOT, 'scripts', 'archived-excel', 'all-clients-export_v1.xlsx');

function resolveSource(args: string[]): string {
  const fileArg = args.find((a) => a.startsWith('--file='));
  if (!fileArg) return DEFAULT_SOURCE;
  const raw = fileArg.slice('--file='.length).replace(/^["']|["']$/g, '');
  if (path.isAbsolute(raw)) return raw;
  const inArchived = path.join(ROOT, 'scripts', 'archived-excel', raw);
  if (fs.existsSync(inArchived)) return inArchived;
  return path.join(ROOT, raw);
}

function pickEmail(raw: string): string | null {
  if (!raw?.trim()) return null;
  // Cells may contain multiple emails separated by newline / comma / semicolon
  const parts = raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const p of parts) {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p)) return p.toLowerCase();
  }
  return null;
}

const WORKBOOK_LOCATIONS: Record<
  string,
  { locationCode: string; area: string; name: string; address: string }
> = {
  'Aspire_Client Data - Indiranagar.xlsx': {
    locationCode: 'Indiranagar_1',
    area: 'Indiranagar',
    name: 'Indiranagar – Aspire Coworks',
    address: '17, 7th Main Rd, Indira Nagar II Stage, Bengaluru',
  },
  'Aspire_Client Data -Platinum.xlsx': {
    locationCode: 'Platinum',
    area: 'Indiranagar',
    name: 'Indiranagar – Aspire Coworks Platinum',
    address: '39/7-1, 7th Main Rd, Indiranagar, Bengaluru',
  },
  'Aspire_Client Data - Kormangala branch.xlsx': {
    locationCode: 'Kormangala_1',
    area: 'Kormangala',
    name: 'Koramangala – Aspire Coworks',
    address: 'Balaji Arcade, 20th L Cross Rd, Koramangala',
  },
};

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

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

function headerKey(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\u200b/g, '');
}

function findCol(headers: string[], candidates: string[]): number {
  const map = headers.map(headerKey);
  for (const c of candidates) {
    const idx = map.indexOf(c.toLowerCase());
    if (idx >= 0) return idx;
  }
  for (const c of candidates) {
    const idx = map.findIndex((h) => h.includes(c.toLowerCase()));
    if (idx >= 0) return idx;
  }
  return -1;
}

function normalizePan(raw: string): { pan: string | null; invalid: boolean } {
  const cleaned = raw.replace(/\s+/g, '').toUpperCase();
  if (!cleaned) return { pan: null, invalid: false };
  if (PAN_RE.test(cleaned)) return { pan: cleaned, invalid: false };
  return { pan: null, invalid: true };
}

function parseMonths(raw: string): number | null {
  const t = raw.replace(/[^\d.]/g, '');
  if (!t) return null;
  const n = Math.round(Number(t));
  return Number.isFinite(n) && n > 0 && n < 600 ? n : null;
}

function slugEmail(company: string, locationCode: string, row: number): string {
  const slug = company
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `unknown+${locationCode.toLowerCase()}-${slug || 'row'}-${row}@aspire.import`;
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function ensureLocation(
  meta: (typeof WORKBOOK_LOCATIONS)[string],
): Promise<string> {
  let existing = await prisma.location.findFirst({ where: { code: meta.locationCode } });
  if (!existing) {
    const nameHint =
      meta.locationCode === 'Platinum'
        ? 'Platinum'
        : meta.locationCode === 'Kormangala_1'
          ? 'Koramangala'
          : 'Indiranagar – Aspire Coworks';
    const candidates = await prisma.location.findMany({
      where: { name: { contains: nameHint } },
    });
    existing =
      meta.locationCode === 'Indiranagar_1'
        ? candidates.find((l) => !/platinum/i.test(l.name)) ?? null
        : candidates[0] ?? null;
  }
  if (existing) {
    return (
      await prisma.location.update({
        where: { id: existing.id },
        data: {
          name: meta.name,
          address: meta.address,
          area: meta.area,
          isActive: true,
          code: meta.locationCode,
        },
      })
    ).id;
  }
  return (
    await prisma.location.create({
      data: {
        name: meta.name,
        address: meta.address,
        code: meta.locationCode,
        area: meta.area,
        isActive: true,
      },
    })
  ).id;
}

async function main() {
  const args = process.argv.slice(2);
  const qaOnly = args.includes('--qa-only');
  const dryRun = args.includes('--dry-run') || qaOnly;
  const apply = !dryRun;
  const SOURCE = resolveSource(args);

  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Missing source file: ${SOURCE}`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(ROOT, 'scripts', 'migration-output', stamp);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'scripts', 'migration-output', 'LATEST'), stamp, 'utf8');

  console.log(`Mode: ${qaOnly ? 'qa-only' : dryRun ? 'dry-run' : 'apply'}`);
  console.log(`Source: ${SOURCE}`);
  console.log(`Output: ${outDir}`);

  const quarPath = path.join(outDir, 'quarantine_index.csv');
  const panQuarPath = path.join(outDir, 'pan_quarantine.csv');
  const fieldQaPath = path.join(outDir, 'field_qa.csv');
  const QUAR_HEADERS = ['row', 'workbook', 'sheet', 'reason', 'companyName', 'rawPan'];
  const FIELD_HEADERS = ['row', 'workbook', 'sheet', 'companyName', 'missing'];
  fs.writeFileSync(quarPath, QUAR_HEADERS.join(',') + '\n');
  fs.writeFileSync(panQuarPath, QUAR_HEADERS.join(',') + '\n');
  fs.writeFileSync(fieldQaPath, FIELD_HEADERS.join(',') + '\n');

  const writeCsv = (file: string, headers: string[], row: Record<string, unknown>) => {
    fs.appendFileSync(file, headers.map((h) => csvEscape(row[h])).join(',') + '\n');
  };

  let createdById: string | null = null;
  if (apply) {
    const admin =
      (await prisma.user.findFirst({ where: { role: 'ADMIN' } })) ||
      (await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } }));
    if (!admin) throw new Error('No ADMIN/SUPER_ADMIN user found for createdById');
    createdById = admin.id;
  }

  const locationCache = new Map<string, string>();
  const vendorCache = new Map<string, string>();

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(SOURCE);
  const sheet = workbook.getWorksheet('all-clients-export') || workbook.worksheets[0];
  if (!sheet) throw new Error('No data sheet found');

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = cellText(cell.value);
  });

  const col = {
    workbook: findCol(headers, ['workbook']),
    sheet: findCol(headers, ['sheet name']),
    aggregator: findCol(headers, ['aggregator name']),
    officeType: findCol(headers, ['office_type', 'office type']),
    leadSource: findCol(headers, ['lead_source', 'lead source']),
    title: findCol(headers, ['title']),
    firstName: findCol(headers, ['first name']),
    company: findCol(headers, ['company name']),
    address: findCol(headers, ['address']),
    phone: findCol(headers, ['phone number']),
    email: findCol(headers, ['email id', 'email', 'gmail id']),
    pan: findCol(headers, ['pan no', 'pan']),
    city: findCol(headers, ['client city', 'city']),
    start: findCol(headers, ['agreement start date']),
    end: findCol(headers, ['agreement end date']),
    months: findCol(headers, ['no of months']),
    membership: findCol(headers, ['membership type']),
    gst: findCol(headers, ['gst number']),
    booking: findCol(headers, ['bookingid', 'booking id']),
    notes: findCol(headers, ['notes']),
  };

  let rowsRead = 0;
  let imported = 0;
  let updated = 0;
  let quarantined = 0;
  let panBlanked = 0;
  const flagCounts: Record<string, number> = {};
  const panSeen = new Map<string, string>();

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const values: unknown[] = [];
    let any = false;
    for (let c = 1; c <= Math.max(headers.length, row.cellCount); c++) {
      const v = row.getCell(c).value;
      values[c - 1] = v;
      if (cellText(v)) any = true;
    }
    if (!any) continue;
    rowsRead++;

    const get = (idx: number) => (idx >= 0 ? cellText(values[idx]) : '');
    const companyName = get(col.company);
    const workbookName = get(col.workbook);
    const sheetName = get(col.sheet);
    const locMeta = WORKBOOK_LOCATIONS[workbookName];

    if (!companyName) {
      quarantined++;
      writeCsv(quarPath, QUAR_HEADERS, {
        row: r,
        workbook: workbookName,
        sheet: sheetName,
        reason: 'MISSING_COMPANY_NAME',
        companyName: '',
        rawPan: get(col.pan),
      });
      continue;
    }
    if (!locMeta) {
      quarantined++;
      writeCsv(quarPath, QUAR_HEADERS, {
        row: r,
        workbook: workbookName,
        sheet: sheetName,
        reason: 'UNKNOWN_WORKBOOK_LOCATION',
        companyName,
        rawPan: get(col.pan),
      });
      continue;
    }

    const rawPan = get(col.pan);
    const { pan, invalid: panInvalid } = normalizePan(rawPan);
    if (panInvalid) {
      panBlanked++;
      writeCsv(panQuarPath, QUAR_HEADERS, {
        row: r,
        workbook: workbookName,
        sheet: sheetName,
        reason: 'INVALID_PAN_SHAPE',
        companyName,
        rawPan,
      });
    }

    const startParsed = col.start >= 0 ? parseExcelDate(values[col.start]) : parseExcelDate(null);
    const endParsed = col.end >= 0 ? parseExcelDate(values[col.end]) : parseExcelDate(null);
    flagCounts[startParsed.flag] = (flagCounts[startParsed.flag] || 0) + 1;
    flagCounts[endParsed.flag] = (flagCounts[endParsed.flag] || 0) + 1;
    const rangeFlag = compareIsoDates(startParsed.isoDate, endParsed.isoDate);
    if (rangeFlag) flagCounts[rangeFlag] = (flagCounts[rangeFlag] || 0) + 1;

    const officeType = get(col.officeType) || null;
    const leadSource = get(col.leadSource) || null;
    const clientChannel =
      leadSourceToClientChannel(leadSource) === 'AGGREGATOR'
        ? ClientChannel.AGGREGATOR
        : ClientChannel.DIRECT;
    const aggregatorName = get(col.aggregator) || null;
    const membership = get(col.membership) || null;
    const contractMonths = parseMonths(get(col.months));
    const phone = get(col.phone) || null;
    const bookingId = get(col.booking) || null;
    const notes = get(col.notes) || null;
    const firstName = get(col.firstName) || null;
    const title = get(col.title) || null;
    const address = get(col.address) || null;
    const city = get(col.city) || null;
    const gst = get(col.gst) || null;

    if (pan) {
      const prev = panSeen.get(pan);
      if (prev) {
        writeCsv(fieldQaPath, FIELD_HEADERS, {
          row: r,
          workbook: workbookName,
          sheet: sheetName,
          companyName,
          missing: `DUP_PAN:${prev}`,
        });
      } else {
        panSeen.set(pan, `${workbookName}/${sheetName}/${r}`);
      }
    }

    if (!apply) {
      imported++;
      continue;
    }

    let locationId = locationCache.get(locMeta.locationCode);
    if (!locationId) {
      locationId = await ensureLocation(locMeta);
      locationCache.set(locMeta.locationCode, locationId);
    }

    const vendorMeta = normalizeVendor(sheetName || aggregatorName || 'unknown');
    const vendorKey = `${locationId}::${vendorMeta.code}`;
    let vendorId = vendorCache.get(vendorKey);
    if (!vendorId) {
      const v = await prisma.vendor.upsert({
        where: { locationId_code: { locationId, code: vendorMeta.code } },
        update: { name: vendorMeta.name, sourceSheet: sheetName, isActive: true },
        create: {
          name: vendorMeta.name,
          code: vendorMeta.code,
          sourceSheet: sheetName,
          locationId,
          isActive: true,
        },
      });
      vendorId = v.id;
      vendorCache.set(vendorKey, vendorId);
    }

    const emailFromSheet = pickEmail(get(col.email));
    const contactEmail =
      emailFromSheet || slugEmail(companyName, locMeta.locationCode, r);
    const startIso = startParsed.isoDate;
    const endIso = endParsed.isoDate;
    const operationalStatus = OperationalStatus.UNKNOWN;
    const onboardingStage = OnboardingStage.ADMIN_CREATED;

    const data = {
      companyName,
      contactEmail,
      contactPhone: phone,
      taxId: pan,
      address,
      city,
      gstNumber: gst,
      contractStartDate: startIso ? isoToDateOnly(startIso) : null,
      contractEndDate: endIso ? isoToDateOnly(endIso) : null,
      renewalDate: endIso ? isoToDateOnly(endIso) : null,
      membershipType: membership,
      officeType,
      leadSource,
      contractMonths,
      operationalStatus,
      onboardingStage,
      contactPersonName: firstName,
      contactPersonTitle: title,
      contactPersonPhone: phone,
      externalBookingId: bookingId,
      locationId,
      vendorId,
      clientChannel,
      aggregatorName: aggregatorName || vendorMeta.name,
      notes,
      createdById: createdById!,
    };

    // Prefer matching within same office type so Physical does not overwrite Virtual
    let existing = pan
      ? await prisma.clientProfile.findFirst({
          where: { taxId: pan, ...(officeType ? { officeType } : {}) },
        })
      : null;
    if (!existing && bookingId) {
      existing = await prisma.clientProfile.findFirst({
        where: {
          externalBookingId: bookingId,
          locationId,
          ...(officeType ? { officeType } : {}),
        },
      });
    }
    if (!existing) {
      existing = await prisma.clientProfile.findFirst({
        where: {
          companyName,
          locationId,
          ...(officeType ? { officeType } : {}),
          ...(phone ? { contactPhone: phone } : {}),
        },
      });
    }
    if (!existing && officeType) {
      existing = await prisma.clientProfile.findFirst({
        where: { companyName, locationId, officeType },
      });
    }

    try {
      if (existing) {
        const keepEmail =
          emailFromSheet ||
          (existing.contactEmail?.endsWith('@aspire.import')
            ? contactEmail
            : existing.contactEmail);
        await prisma.clientProfile.update({
          where: { id: existing.id },
          data: {
            ...data,
            taxId: pan ?? existing.taxId,
            contactEmail: keepEmail || contactEmail,
          },
        });
        updated++;
      } else {
        await prisma.clientProfile.create({ data });
        imported++;
      }
    } catch (err) {
      writeCsv(fieldQaPath, FIELD_HEADERS, {
        row: r,
        workbook: workbookName,
        sheet: sheetName,
        companyName,
        missing: `DB_ERROR:${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  const summary = {
    mode: qaOnly ? 'qa-only' : apply ? 'apply' : 'dry-run',
    timestamp: stamp,
    source: path.basename(SOURCE),
    rowsRead,
    imported,
    updated,
    quarantined,
    panBlanked,
    flagCounts,
  };
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log('\n=== Summary ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`QA artifacts: ${outDir}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
