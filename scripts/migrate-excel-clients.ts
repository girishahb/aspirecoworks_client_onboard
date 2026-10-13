/**
 * One-time Excel client clean-load migrator.
 *
 * Usage:
 *   npx ts-node scripts/migrate-excel-clients.ts --qa-only
 *   npx ts-node scripts/migrate-excel-clients.ts --dry-run
 *   npx ts-node scripts/migrate-excel-clients.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, OnboardingStage, OperationalStatus, ClientChannel } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import {
  compareIsoDates,
  isDateLikeHeader,
  parseExcelDate,
  isoToDateOnly,
} from './lib/excel-date';
import { normalizeVendor } from './lib/vendor-normalize';

const prisma = new PrismaClient();

const ROOT = path.resolve(__dirname, '..');
const WORKBOOKS: { file: string; locationCode: string; area: string; name: string; address: string }[] = [
  {
    file: 'Aspire_Client Data - Indiranagar.xlsx',
    locationCode: 'Indiranagar_1',
    area: 'Indiranagar',
    name: 'Indiranagar – Aspire Coworks',
    address: '17, 7th Main Rd, Indira Nagar II Stage, Bengaluru',
  },
  {
    file: 'Aspire_Client Data -Platinum.xlsx',
    locationCode: 'Platinum',
    area: 'Indiranagar',
    name: 'Indiranagar – Aspire Coworks Platinum',
    address: '39/7-1, 7th Main Rd, Indiranagar, Bengaluru',
  },
  {
    file: 'Aspire_Client Data - Kormangala branch.xlsx',
    locationCode: 'Kormangala_1',
    area: 'Kormangala',
    name: 'Koramangala – Aspire Coworks',
    address: 'Balaji Arcade, 20th L Cross Rd, Koramangala',
  },
];

const SKIP_SHEETS = new Set(['sheet1']);

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
  return h.trim().toLowerCase().replace(/\s+/g, ' ');
}

function findCol(headers: string[], candidates: string[]): number {
  const map = headers.map((h) => headerKey(h));
  for (const c of candidates) {
    const idx = map.indexOf(c.toLowerCase());
    if (idx >= 0) return idx;
  }
  // fuzzy contains
  for (const c of candidates) {
    const idx = map.findIndex((h) => h.includes(c.toLowerCase()));
    if (idx >= 0) return idx;
  }
  return -1;
}

function mapOperationalStatus(raw: string): OperationalStatus {
  const s = raw.trim().toLowerCase();
  if (!s) return OperationalStatus.UNKNOWN;
  if (/active|live|current/.test(s) && !/inactive|in active|not active/.test(s)) {
    return OperationalStatus.ACTIVE;
  }
  if (/inactive|expired|closed|terminated|cancelled|canceled/.test(s)) {
    return OperationalStatus.INACTIVE;
  }
  if (/pending|process|hold/.test(s)) return OperationalStatus.PENDING;
  return OperationalStatus.UNKNOWN;
}

function mapOnboardingStage(status: OperationalStatus): OnboardingStage {
  if (status === OperationalStatus.ACTIVE) return OnboardingStage.ACTIVE;
  if (status === OperationalStatus.INACTIVE) return OnboardingStage.COMPLETED;
  return OnboardingStage.ADMIN_CREATED;
}

function slugEmail(company: string, locationCode: string, row: number): string {
  const slug = company
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `unknown+${locationCode.toLowerCase()}-${slug || 'row'}-${row}@aspire.import`;
}

function parseCharges(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const t = cellText(raw).replace(/[,₹rs\s]/gi, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  const args = process.argv.slice(2);
  const qaOnly = args.includes('--qa-only');
  const dryRun = args.includes('--dry-run') || qaOnly;
  const apply = !dryRun;

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(ROOT, 'scripts', 'migration-output', stamp);
  const quarantineDir = path.join(outDir, 'quarantine');
  fs.mkdirSync(quarantineDir, { recursive: true });

  // Pointer to latest for admin UI
  const latestPtr = path.join(ROOT, 'scripts', 'migration-output', 'LATEST');
  fs.mkdirSync(path.dirname(latestPtr), { recursive: true });
  fs.writeFileSync(latestPtr, stamp, 'utf8');

  console.log(`Mode: ${qaOnly ? 'qa-only' : dryRun ? 'dry-run' : 'apply'}`);
  console.log(`Output: ${outDir}`);

  const dateQaPath = path.join(outDir, 'date_qa.csv');
  const fieldQaPath = path.join(outDir, 'field_qa.csv');
  const dupPath = path.join(outDir, 'duplicates.csv');
  const quarPath = path.join(outDir, 'quarantine_index.csv');
  const DATE_QA_HEADERS = [
    'workbook',
    'sheet',
    'row',
    'column',
    'rawValue',
    'rawType',
    'cleaned',
    'flag',
    'locationCode',
    'companyName',
  ];
  const FIELD_QA_HEADERS = ['workbook', 'sheet', 'row', 'companyName', 'missing', 'locationCode'];
  const DUP_HEADERS = ['type', 'pan', 'first', 'second', 'companyName'];
  const QUAR_HEADERS = ['workbook', 'sheet', 'row', 'reason', 'locationCode'];
  fs.writeFileSync(dateQaPath, DATE_QA_HEADERS.join(',') + '\n');
  fs.writeFileSync(fieldQaPath, FIELD_QA_HEADERS.join(',') + '\n');
  fs.writeFileSync(dupPath, DUP_HEADERS.join(',') + '\n');
  fs.writeFileSync(quarPath, QUAR_HEADERS.join(',') + '\n');
  const dateQaFd = fs.openSync(dateQaPath, 'a');
  const fieldQaFd = fs.openSync(fieldQaPath, 'a');
  const dupFd = fs.openSync(dupPath, 'a');
  const quarFd = fs.openSync(quarPath, 'a');
  const writeRow = (fd: number, headers: string[], row: Record<string, unknown>) => {
    fs.writeSync(fd, headers.map((h) => csvEscape(row[h])).join(',') + '\n');
  };

  let createdById: string | null = null;
  if (apply) {
    const admin =
      (await prisma.user.findFirst({ where: { role: 'ADMIN' } })) ||
      (await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } }));
    if (!admin) {
      throw new Error('No ADMIN/SUPER_ADMIN user found for createdById');
    }
    createdById = admin.id;
  }

  const distributions: {
    byLocationVendor: Record<string, { rows: number; dateNull: number; dateFail: number; imported: number }>;
    agreementStartYear: Record<string, number>;
  } = { byLocationVendor: {}, agreementStartYear: {} };

  let rowsRead = 0;
  let imported = 0;
  let updated = 0;
  let quarantined = 0;
  let skippedNonClientSheet = 0;
  const flagCounts: Record<string, number> = {};

  const panSeen = new Map<string, string>(); // pan -> first location/sheet/row

  try {
  for (const wb of WORKBOOKS) {
    const filePathCandidates = [
      path.join(ROOT, wb.file),
      path.join(ROOT, 'scripts', 'archived-excel', wb.file),
    ];
    const filePath = filePathCandidates.find((p) => fs.existsSync(p));
    if (!filePath) {
      console.warn(`Missing workbook: ${wb.file}`);
      continue;
    }

    let locationId: string | null = null;
    if (apply) {
      let existing = await prisma.location.findFirst({ where: { code: wb.locationCode } });
      if (!existing) {
        // Match pre-seeded booking locations by name fragment
        const nameHint =
          wb.locationCode === 'Platinum'
            ? 'Platinum'
            : wb.locationCode === 'Kormangala_1'
              ? 'Koramangala'
              : 'Indiranagar – Aspire Coworks';
        const candidates = await prisma.location.findMany({
          where: { name: { contains: nameHint } },
        });
        existing =
          wb.locationCode === 'Indiranagar_1'
            ? candidates.find((l) => !/platinum/i.test(l.name)) ?? null
            : candidates[0] ?? null;
      }
      if (existing) {
        locationId = (
          await prisma.location.update({
            where: { id: existing.id },
            data: { name: wb.name, address: wb.address, area: wb.area, isActive: true, code: wb.locationCode },
          })
        ).id;
      } else {
        locationId = (
          await prisma.location.create({
            data: {
              name: wb.name,
              address: wb.address,
              code: wb.locationCode,
              area: wb.area,
              isActive: true,
            },
          })
        ).id;
      }
    } else {
      locationId = `qa-${wb.locationCode}`;
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    console.log(`\nWorkbook: ${wb.file} (${workbook.worksheets.length} sheets)`);

    for (const sheet of workbook.worksheets) {
      const sheetName = sheet.name?.trim() || 'Sheet';
      if (SKIP_SHEETS.has(sheetName.toLowerCase())) {
        skippedNonClientSheet++;
        continue;
      }

      const vendorMeta = normalizeVendor(sheetName);
      const isRedoc = /redoc|signage/i.test(sheetName);
      // Still QA dates on redoc sheets; skip client entity create for redoc in v1
      const importAsClient = !isRedoc;

      let vendorId: string | null = null;
      if (apply && locationId && importAsClient) {
        const v = await prisma.vendor.upsert({
          where: {
            locationId_code: { locationId: locationId as string, code: vendorMeta.code },
          },
          update: { name: vendorMeta.name, sourceSheet: sheetName, isActive: true },
          create: {
            name: vendorMeta.name,
            code: vendorMeta.code,
            sourceSheet: sheetName,
            locationId: locationId as string,
            isActive: true,
          },
        });
        vendorId = v.id;
      }

      const distKey = `${wb.locationCode}::${vendorMeta.code}`;
      if (!distributions.byLocationVendor[distKey]) {
        distributions.byLocationVendor[distKey] = { rows: 0, dateNull: 0, dateFail: 0, imported: 0 };
      }

      // Header row = first non-empty row
      let headerRowNum = 1;
      let headers: string[] = [];
      for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
        const row = sheet.getRow(r);
        const vals: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell, col) => {
          vals[col - 1] = cellText(cell.value);
        });
        const nonEmpty = vals.filter(Boolean).length;
        if (nonEmpty >= 3) {
          headerRowNum = r;
          headers = vals.map((v) => v || '');
          break;
        }
      }
      if (headers.filter(Boolean).length < 2) continue;

      const colCompany = findCol(headers, ['company name', 'companyname', 'company']);
      const colPhone = findCol(headers, ['phone number', 'phone', 'contact #', 'contact#']);
      const colEmail = findCol(headers, ['gmail id', 'email', 'g mail id']);
      const colPan = findCol(headers, ['pan no', 'pan', 'pan number']);
      const colAddress = findCol(headers, ['address', ' address']);
      const colCity = findCol(headers, ['client city', 'city']);
      const colGst = findCol(headers, ['gst number', 'gst #', 'gst#', 'gst']);
      const colStart = findCol(headers, ['agreement start date', 'start date', 'agreement start']);
      const colEnd = findCol(headers, ['agreement end date', 'end date', 'agreement end']);
      const colMembership = findCol(headers, ['membership type', 'membership']);
      const colStatus = findCol(headers, ['status']);
      const colPayment = findCol(headers, ['paymentstatus', 'payment status', 'paymentstatus']);
      const colNotes = findCol(headers, ['notes', 'remarks']);
      const colBooking = findCol(headers, ['booking id', 'notes / booking id', 'booking']);
      const colFirstName = findCol(headers, ['first name', 'name']);
      const colTitle = findCol(headers, ['title', 'position/title', 'position']);
      const colContactPhone = findCol(headers, ['contact #', 'contact#']);
      const colAggregator = findCol(headers, ['agregator name', 'aggregator name', 'agreegator name']);
      const colCharges = findCol(headers, ['charges']);
      const colLastContacted = findCol(headers, ['last contacted']);

      const dateCols: { idx: number; name: string }[] = [];
      headers.forEach((h, idx) => {
        if (h && isDateLikeHeader(h)) dateCols.push({ idx, name: h });
      });

      const quarantineRows: string[][] = [['__row', ...headers]];

      for (let r = headerRowNum + 1; r <= sheet.rowCount; r++) {
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
        distributions.byLocationVendor[distKey].rows++;

        const companyName = colCompany >= 0 ? cellText(values[colCompany]) : '';
        const get = (idx: number) => (idx >= 0 ? cellText(values[idx]) : '');

        // Parse all date columns
        const dateResults: Record<string, ReturnType<typeof parseExcelDate>> = {};
        for (const dc of dateCols) {
          const parsed = parseExcelDate(values[dc.idx]);
          dateResults[dc.name] = parsed;
          flagCounts[parsed.flag] = (flagCounts[parsed.flag] || 0) + 1;
          if (!parsed.isoDate) {
            if (parsed.flag === 'DATE_PARSE_FAIL') distributions.byLocationVendor[distKey].dateFail++;
            else distributions.byLocationVendor[distKey].dateNull++;
          }
          writeRow(dateQaFd, DATE_QA_HEADERS, {
            workbook: wb.file,
            sheet: sheetName,
            row: r,
            column: dc.name,
            rawValue: parsed.rawDisplay || cellText(values[dc.idx]),
            rawType: parsed.rawType,
            cleaned: parsed.isoDate || '',
            flag: parsed.flag,
            locationCode: wb.locationCode,
            companyName,
          });
        }

        const startParsed =
          colStart >= 0
            ? parseExcelDate(values[colStart])
            : dateResults[Object.keys(dateResults).find((k) => /start/i.test(k)) || ''] || null;
        const endParsed =
          colEnd >= 0
            ? parseExcelDate(values[colEnd])
            : dateResults[Object.keys(dateResults).find((k) => /end/i.test(k) && !/start/i.test(k)) || ''] ||
              null;

        const startIso = startParsed?.isoDate ?? null;
        const endIso = endParsed?.isoDate ?? null;
        const rangeFlag = compareIsoDates(startIso, endIso);
        if (rangeFlag) {
          flagCounts[rangeFlag] = (flagCounts[rangeFlag] || 0) + 1;
          writeRow(dateQaFd, DATE_QA_HEADERS, {
            workbook: wb.file,
            sheet: sheetName,
            row: r,
            column: 'Agreement Start/End',
            rawValue: `${startIso || ''} → ${endIso || ''}`,
            rawType: 'range',
            cleaned: '',
            flag: rangeFlag,
            locationCode: wb.locationCode,
            companyName,
          });
        }

        if (startIso) {
          const year = startIso.slice(0, 4);
          distributions.agreementStartYear[year] = (distributions.agreementStartYear[year] || 0) + 1;
        }

        if (!companyName) {
          quarantined++;
          quarantineRows.push([String(r), ...headers.map((_, i) => cellText(values[i]))]);
          writeRow(quarFd, QUAR_HEADERS, {
            workbook: wb.file,
            sheet: sheetName,
            row: r,
            reason: 'MISSING_COMPANY_NAME',
            locationCode: wb.locationCode,
          });
          continue;
        }

        const phone = get(colPhone) || get(colContactPhone);
        const emailRaw = get(colEmail);
        const pan = get(colPan).replace(/\s+/g, '').toUpperCase() || null;
        const address = get(colAddress);
        const city = get(colCity);
        const gst = get(colGst);
        const membership = get(colMembership);
        const statusRaw = get(colStatus);
        const paymentStatus = get(colPayment);
        const notes = get(colNotes);
        const bookingId = get(colBooking);
        const firstName = get(colFirstName);
        const title = get(colTitle);
        const aggName = get(colAggregator);
        const charges = colCharges >= 0 ? parseCharges(values[colCharges]) : null;
        const lastContacted =
          colLastContacted >= 0 ? parseExcelDate(values[colLastContacted]).date : null;

        const operationalStatus = mapOperationalStatus(statusRaw);
        const onboardingStage = mapOnboardingStage(operationalStatus);

        const missing: string[] = [];
        if (!phone) missing.push('phone');
        if (!emailRaw) missing.push('email');
        if (!pan) missing.push('pan');
        if (!statusRaw) missing.push('status');
        if (missing.length) {
          writeRow(fieldQaFd, FIELD_QA_HEADERS, {
            workbook: wb.file,
            sheet: sheetName,
            row: r,
            companyName,
            missing: missing.join('|'),
            locationCode: wb.locationCode,
          });
        }

        if (pan) {
          const prev = panSeen.get(pan);
          const key = `${wb.locationCode}/${sheetName}/${r}`;
          if (prev) {
            writeRow(dupFd, DUP_HEADERS, {
              type: 'DUP_PAN',
              pan,
              first: prev,
              second: key,
              companyName,
            });
            flagCounts['DUP_PAN'] = (flagCounts['DUP_PAN'] || 0) + 1;
          } else {
            panSeen.set(pan, key);
          }
        }

        if (!importAsClient) {
          continue;
        }

        // qa-only / dry-run: count as would-import, no DB write
        if (!apply) {
          imported++;
          distributions.byLocationVendor[distKey].imported++;
          continue;
        }

        if (!createdById || !locationId || !vendorId) {
          writeRow(fieldQaFd, FIELD_QA_HEADERS, {
            workbook: wb.file,
            sheet: sheetName,
            row: r,
            companyName,
            missing: 'MISSING_CREATED_BY_OR_LOCATION_VENDOR',
            locationCode: wb.locationCode,
          });
          continue;
        }
        const contactEmail = emailRaw || slugEmail(companyName, wb.locationCode, r);
        const data = {
          companyName,
          contactEmail,
          contactPhone: phone || null,
          taxId: pan,
          address: address || null,
          city: city || null,
          gstNumber: gst || null,
          contractStartDate: startIso ? isoToDateOnly(startIso) : null,
          contractEndDate: endIso ? isoToDateOnly(endIso) : null,
          renewalDate: endIso ? isoToDateOnly(endIso) : null,
          renewalStatus:
            operationalStatus === OperationalStatus.ACTIVE
              ? ('ACTIVE' as const)
              : operationalStatus === OperationalStatus.INACTIVE
                ? ('EXPIRED' as const)
                : null,
          membershipType: membership || null,
          operationalStatus,
          onboardingStage,
          contactPersonName: firstName || null,
          contactPersonTitle: title || null,
          contactPersonPhone: get(colContactPhone) || null,
          externalBookingId: bookingId || null,
          legacyPaymentStatus: paymentStatus || null,
          legacyCharges: charges,
          lastContactedAt: lastContacted,
          locationId: locationId as string,
          vendorId,
          clientChannel: ClientChannel.AGGREGATOR,
          aggregatorName: aggName || vendorMeta.name,
          notes: notes || null,
          createdById,
        };

        // Find existing: PAN → bookingId → company+phone+location
        let existing = pan
          ? await prisma.clientProfile.findFirst({ where: { taxId: pan } })
          : null;
        if (!existing && bookingId) {
          existing = await prisma.clientProfile.findFirst({
            where: { externalBookingId: bookingId, locationId: locationId as string },
          });
        }
        if (!existing) {
          existing = await prisma.clientProfile.findFirst({
            where: {
              companyName,
              contactPhone: phone || undefined,
              locationId: locationId as string,
            },
          });
        }

        try {
          if (existing) {
            // Don't overwrite taxId with null if existing has one; avoid unique conflicts on email if needed
            await prisma.clientProfile.update({
              where: { id: existing.id },
              data: {
                ...data,
                taxId: pan ?? existing.taxId,
                contactEmail: emailRaw || existing.contactEmail,
              },
            });
            updated++;
          } else {
            await prisma.clientProfile.create({ data });
            imported++;
          }
          distributions.byLocationVendor[distKey].imported++;
        } catch (err) {
          writeRow(fieldQaFd, FIELD_QA_HEADERS, {
            workbook: wb.file,
            sheet: sheetName,
            row: r,
            companyName,
            missing: `DB_ERROR:${err instanceof Error ? err.message : String(err)}`,
            locationCode: wb.locationCode,
          });
        }
      }

      if (quarantineRows.length > 1) {
        const qPath = path.join(
          quarantineDir,
          `${wb.locationCode}__${vendorMeta.code}.csv`.replace(/[^a-zA-Z0-9._-]/g, '_'),
        );
        const lines = quarantineRows.map((cols) => cols.map(csvEscape).join(','));
        fs.writeFileSync(qPath, lines.join('\n'), 'utf8');
      }
    }
    // Free workbook memory before next file
    workbook.eachSheet((s) => {
      // no-op iterate
      void s;
    });
    console.log(`  finished ${wb.file} (rows so far: ${rowsRead})`);
  }
  } finally {
    fs.closeSync(dateQaFd);
    fs.closeSync(fieldQaFd);
    fs.closeSync(dupFd);
    fs.closeSync(quarFd);
  }

  const summary = {
    mode: qaOnly ? 'qa-only' : apply ? 'apply' : 'dry-run',
    timestamp: stamp,
    rowsRead,
    imported,
    updated,
    quarantined,
    skippedNonClientSheet,
    flagCounts,
    workbooks: WORKBOOKS.map((w) => w.file),
  };

  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(outDir, 'distributions.json'), JSON.stringify(distributions, null, 2));

  console.log('\n=== Summary ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`QA artifacts written to ${outDir}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
