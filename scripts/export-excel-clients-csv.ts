/**
 * Export all archived Excel client workbooks into a single CSV.
 *
 * Usage:
 *   npx ts-node scripts/export-excel-clients-csv.ts
 *   npx ts-node scripts/export-excel-clients-csv.ts --file="Aspire_Client Data - Indiranagar.xlsx"
 */
import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';

const EXCEL_DIR = path.join(__dirname, 'archived-excel');
const OUT_PATH = path.join(__dirname, 'archived-excel', 'all-clients-export.csv');

const WORKBOOKS = [
  'Aspire_Client Data - Indiranagar.xlsx',
  'Aspire_Client Data -Platinum.xlsx',
  'Aspire_Client Data - Kormangala branch.xlsx',
];

const SKIP_SHEETS = new Set(['sheet1']);

const CSV_HEADERS = [
  'Workbook',
  'Sheet Name',
  'Aggregator Name',
  'Category',
  'Title',
  'First Name',
  'Company Name',
  'Address',
  'Phone Number',
  'PAN No',
  'Client City',
  'Agreement Start Date',
  'Agreement End Date',
  'No of Months',
  'Membership Type',
  'GST Number',
  'BookingID',
  'Notes',
  'Contact Name',
  'Position/Title',
  'Contact #',
] as const;

function cellText(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  let s = '';
  if (typeof raw === 'string') s = raw;
  else if (typeof raw === 'number') s = String(raw);
  else if (raw instanceof Date) s = raw.toISOString();
  else if (typeof raw === 'object' && raw !== null) {
    const o = raw as Record<string, unknown>;
    if ('text' in o) return cellText(o.text);
    if ('result' in o) return cellText(o.result);
    if (Array.isArray(o.richText)) {
      s = (o.richText as { text?: string }[]).map((r) => r.text ?? '').join('');
    } else {
      s = String(raw);
    }
  } else {
    s = String(raw);
  }
  // Flatten whitespace so CSV stays one physical line per row
  return s.replace(/\s+/g, ' ').trim();
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
  for (const c of candidates) {
    const idx = map.findIndex((h) => h.includes(c.toLowerCase()));
    if (idx >= 0) return idx;
  }
  return -1;
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function ymdToIso(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function isPlausible(y: number, m: number, d: number): boolean {
  if (y < 1990 || y > 2100) return false;
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function excelSerialToYmd(serial: number): { y: number; m: number; d: number } | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2958465) return null;
  const excelEpochUtc = Date.UTC(1899, 11, 30);
  const dt = new Date(excelEpochUtc + Math.floor(serial) * 86400000);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

/**
 * Date rules (text cells):
 * - hyphen / dot  e.g. 20-02-2026 → DD-MM-YYYY
 * - slash         e.g. 11/21/2025 → MM-DD-YYYY
 *   (if impossible under that rule, fall back to the other order)
 */
function parseDateCell(raw: unknown): string {
  if (raw === null || raw === undefined) return '';

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return ymdToIso(raw.getUTCFullYear(), raw.getUTCMonth() + 1, raw.getUTCDate());
  }

  if (typeof raw === 'number') {
    const ymd = excelSerialToYmd(raw);
    return ymd && isPlausible(ymd.y, ymd.m, ymd.d) ? ymdToIso(ymd.y, ymd.m, ymd.d) : '';
  }

  if (typeof raw === 'object' && raw !== null) {
    const o = raw as Record<string, unknown>;
    if ('result' in o) return parseDateCell(o.result);
    if ('text' in o) return parseDateCell(o.text);
  }

  if (typeof raw !== 'string') return '';

  const t = raw.trim();
  if (!t || /^(n\/a|na|n\.a\.|tbd|nil|null|none|pending|-|\.|--|—)$/i.test(t)) return '';

  let m = t.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
  if (m) {
    const y = +m[1];
    const mo = +m[2];
    const d = +m[3];
    return isPlausible(y, mo, d) ? ymdToIso(y, mo, d) : '';
  }

  if (/^\d+(\.\d+)?$/.test(t)) {
    const n = Number(t);
    if (n >= 30000 && n <= 60000) {
      const ymd = excelSerialToYmd(n);
      if (ymd && isPlausible(ymd.y, ymd.m, ymd.d)) return ymdToIso(ymd.y, ymd.m, ymd.d);
    }
  }

  // Slash → MM/DD/YYYY (fallback DMY)
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    const y = +m[3];
    if (isPlausible(y, a, b)) return ymdToIso(y, a, b);
    if (isPlausible(y, b, a)) return ymdToIso(y, b, a);
    return '';
  }

  // Hyphen or dot → DD-MM-YYYY (fallback MDY)
  m = t.match(/^(\d{1,2})[-.](\d{1,2})[-.](\d{4})$/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    const y = +m[3];
    if (isPlausible(y, b, a)) return ymdToIso(y, b, a);
    if (isPlausible(y, a, b)) return ymdToIso(y, a, b);
    return '';
  }

  m = t.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if (m) {
    const months: Record<string, number> = {
      jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
      apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
      aug: 8, august: 8, sep: 9, sept: 9, september: 9,
      oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
    };
    const mo = months[m[2].toLowerCase()];
    const d = +m[1];
    const y = +m[3];
    if (mo && isPlausible(y, mo, d)) return ymdToIso(y, mo, d);
  }

  return '';
}

function aggregatorFromSheet(sheetName: string): { aggregatorName: string; category: string } {
  const s = sheetName.trim();
  if (/^virtual/i.test(s)) {
    const name = s.replace(/^Virtual[_ ]?/i, '').replace(/\s+/g, ' ').trim() || s;
    return { aggregatorName: name, category: 'Virtual Office' };
  }
  return { aggregatorName: s.replace(/\s+/g, ' ').trim(), category: 'Aggregator' };
}

function splitBookingAndNotes(
  notesRaw: string,
  bookingColRaw: string,
): { bookingId: string; notes: string } {
  let bookingId = bookingColRaw.trim();
  let notes = notesRaw.trim();

  const takeId = (id: string) => {
    const cleaned = id.replace(/[.,;]+$/, '').trim();
    if (cleaned && !bookingId) bookingId = cleaned;
  };

  const patterns: RegExp[] = [
    /previous\s+year\s+booking\s*id\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\-]*)/i,
    /previous\s+booking\s*id\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\-]*)/i,
    /new\s+booking\s*:\s*id\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\-]*)/i,
    /booking\s*:\s*id\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\-]*)/i,
    /booking\s*(?:id|reference\s*number)?\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\-]*)/i,
    /sales\s*-\s*([A-Za-z0-9][A-Za-z0-9\-]*)/i,
  ];

  for (const re of patterns) {
    const match = notes.match(re);
    if (match) {
      takeId(match[1]);
      notes = notes
        .replace(/previous\s+year\s+booking\s*id\s*[:\-]?\s*/i, '')
        .replace(/previous\s+booking\s*id\s*[:\-]?\s*/i, '')
        .replace(/booking\s*id\s*booking\s*id\s*[:\-]?\s*/i, '')
        .replace(/new\s+booking\s*:\s*id\s*[:\-]?\s*/i, '')
        .replace(/booking\s*:\s*id\s*[:\-]?\s*/i, '')
        .replace(/booking\s*(?:id|reference\s*number)?\s*[:\-]?\s*/i, '')
        .replace(/sales\s*-\s*/i, '')
        .replace(new RegExp(match[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '')
        .replace(/^[\s,:;\-()]+|[\s,:;\-()]+$/g, '')
        .replace(/\(\s*\)/g, '')
        .trim();
      break;
    }
  }

  if (!bookingId) {
    const bare = notes.match(/^([A-Za-z]{2,}[A-Za-z0-9\-]{4,})(?:\s*[\(\-–,].*)?$/);
    if (
      bare &&
      !/\s/.test(bare[1]) &&
      !/@/.test(notes) &&
      !/agreement|renewal|email|done|confirmation/i.test(bare[1])
    ) {
      takeId(bare[1]);
      notes = notes.slice(bare[1].length).replace(/^[\s\(\-–,]+|[\s\)]+$/g, '').trim();
    }
  }

  if (bookingId) {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!notes || norm(notes) === norm(bookingId) || /^booking\s*id$/i.test(notes)) {
      notes = '';
    }
  }

  return { bookingId, notes };
}

async function exportWorkbook(
  file: string,
  out: fs.WriteStream,
): Promise<{ rows: number; sheets: number; skipped: number; booking: number; notes: number }> {
  const filePath = path.join(EXCEL_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.warn(`Missing workbook: ${file}`);
    return { rows: 0, sheets: 0, skipped: 0, booking: 0, notes: 0 };
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  console.log(`\nWorkbook: ${file} (${workbook.worksheets.length} sheets)`);

  let rows = 0;
  let sheets = 0;
  let skipped = 0;
  let booking = 0;
  let notesCount = 0;

  for (const sheet of workbook.worksheets) {
    const sheetName = sheet.name?.trim() || 'Sheet';
    if (SKIP_SHEETS.has(sheetName.toLowerCase())) continue;

    let headerRowNum = 1;
    let headers: string[] = [];
    for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
      const vals: string[] = [];
      sheet.getRow(r).eachCell({ includeEmpty: true }, (cell, col) => {
        vals[col - 1] = cellText(cell.value);
      });
      if (vals.filter(Boolean).length >= 3) {
        const joined = vals.join(' ').toLowerCase();
        if (
          joined.includes('company') ||
          joined.includes('first name') ||
          joined.includes('agreement') ||
          joined.includes('phone')
        ) {
          headerRowNum = r;
          headers = vals.map((v) => v || '');
          break;
        }
        if (!headers.length) {
          headerRowNum = r;
          headers = vals.map((v) => v || '');
        }
      }
    }

    if (headers.filter(Boolean).length < 2) {
      console.log(`  skip (no headers): ${sheetName}`);
      continue;
    }

    const joinedHeaders = headers.join(' ').toLowerCase();
    if (!joinedHeaders.includes('company') && !joinedHeaders.includes('first name')) {
      console.log(`  skip (non-client sheet): ${sheetName}`);
      continue;
    }

    const { aggregatorName, category } = aggregatorFromSheet(sheetName);
    sheets++;

    const colTitle = findCol(headers, ['title']);
    const colFirstName = (() => {
      const map = headers.map((h) => headerKey(h));
      const exact = map.indexOf('first name');
      if (exact >= 0) return exact;
      return findCol(headers, ['first name']);
    })();
    const colCompany = findCol(headers, ['company name', 'company']);
    const colAddress = findCol(headers, ['address']);
    const colPhone = findCol(headers, ['phone number', 'phone', 'customer contact no']);
    const colPan = findCol(headers, ['pan no', 'pan number', 'pan']);
    const colCity = findCol(headers, ['client city', 'city']);
    const colStart = findCol(headers, ['agreement start date', 'start date', 'agreement start']);
    const colEnd = findCol(headers, ['agreement end date', 'end date', 'agreement end']);
    const colMonths = findCol(headers, ['no of months', 'months']);
    const colMembership = findCol(headers, ['membership type', 'membership']);
    const colGst = findCol(headers, ['gst number', 'gst #', 'gst#', 'gst']);
    const colNotes = findCol(headers, ['notes', 'remarks']);
    const colBooking = findCol(headers, ['booking id', 'notes / booking id', 'booking']);
    const colContactName = headers.map((h) => headerKey(h)).findIndex((h) => h === 'name');
    const colPosition = findCol(headers, ['position/title', 'position']);
    const colContactPhone = findCol(headers, ['contact #', 'contact#']);

    let sheetRows = 0;
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

      const get = (idx: number) => (idx >= 0 ? cellText(values[idx]) : '');
      const companyName = get(colCompany);
      if (!companyName) {
        skipped++;
        continue;
      }

      let title = '';
      if (colTitle >= 0 && headerKey(headers[colTitle]) === 'title') {
        title = get(colTitle);
      }

      const bookingFromCol =
        colBooking >= 0 &&
        colBooking !== colNotes &&
        /booking/i.test(headers[colBooking] || '')
          ? get(colBooking)
          : '';

      const { bookingId, notes } = splitBookingAndNotes(
        colNotes >= 0 ? get(colNotes) : '',
        bookingFromCol,
      );

      const rowOut: Record<(typeof CSV_HEADERS)[number], string> = {
        Workbook: file,
        'Sheet Name': sheetName,
        'Aggregator Name': aggregatorName,
        Category: category,
        Title: title,
        'First Name': get(colFirstName),
        'Company Name': companyName,
        Address: get(colAddress),
        'Phone Number': get(colPhone) || get(colContactPhone),
        'PAN No': get(colPan).replace(/\s+/g, '').toUpperCase(),
        'Client City': get(colCity),
        'Agreement Start Date': colStart >= 0 ? parseDateCell(values[colStart]) : '',
        'Agreement End Date': colEnd >= 0 ? parseDateCell(values[colEnd]) : '',
        'No of Months': get(colMonths),
        'Membership Type': get(colMembership),
        'GST Number': get(colGst),
        BookingID: bookingId,
        Notes: notes,
        'Contact Name': colContactName >= 0 ? get(colContactName) : '',
        'Position/Title': get(colPosition),
        'Contact #': get(colContactPhone),
      };
      out.write(CSV_HEADERS.map((h) => csvEscape(rowOut[h])).join(',') + '\n');
      rows++;
      sheetRows++;
      if (bookingId) booking++;
      if (notes) notesCount++;
    }

    console.log(`  ${sheetName}: ${sheetRows} rows (${category} / ${aggregatorName})`);
  }

  for (const s of [...workbook.worksheets]) {
    workbook.removeWorksheet(s.id);
  }

  return { rows, sheets, skipped, booking, notes: notesCount };
}

async function main() {
  const args = process.argv.slice(2);
  const fileArg = args.find((a) => a.startsWith('--file='))?.slice('--file='.length);
  const files = fileArg ? [fileArg] : WORKBOOKS;
  const append = args.includes('--append');

  if (!append) {
    fs.writeFileSync(OUT_PATH, CSV_HEADERS.join(',') + '\n', 'utf8');
  } else if (!fs.existsSync(OUT_PATH)) {
    fs.writeFileSync(OUT_PATH, CSV_HEADERS.join(',') + '\n', 'utf8');
  }

  const out = fs.createWriteStream(OUT_PATH, { flags: 'a', encoding: 'utf8' });

  let totalRows = 0;
  let totalSheets = 0;
  let totalSkipped = 0;
  let totalBooking = 0;
  let totalNotes = 0;

  for (const file of files) {
    const stats = await exportWorkbook(file, out);
    totalRows += stats.rows;
    totalSheets += stats.sheets;
    totalSkipped += stats.skipped;
    totalBooking += stats.booking;
    totalNotes += stats.notes;
    if (global.gc) global.gc();
  }

  await new Promise<void>((resolve, reject) => {
    out.end(() => resolve());
    out.on('error', reject);
  });

  console.log(`\nWrote ${totalRows} rows → ${OUT_PATH}`);
  console.log(`Sheets: ${totalSheets}, Skipped (no company): ${totalSkipped}`);
  console.log(`With BookingID: ${totalBooking}, With Notes: ${totalNotes}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
