/**
 * Excel date cleaner — coerce messy Excel date cells to IST calendar dates (YYYY-MM-DD).
 * No wall-clock UTC shift that flips the calendar day.
 */

export type DateQaFlag =
  | 'DATE_OK'
  | 'DATE_COERCED_SERIAL'
  | 'DATE_COERCED_TEXT'
  | 'DATE_EMPTY'
  | 'DATE_SENTINEL'
  | 'DATE_PARSE_FAIL'
  | 'DATE_OUTLIER'
  | 'DATE_RANGE_INVALID';

export interface ParsedExcelDate {
  /** Calendar date in Asia/Kolkata as YYYY-MM-DD, or null */
  isoDate: string | null;
  /** UTC Date at 00:00:00.000Z representing that calendar day (date-only semantics) */
  date: Date | null;
  flag: DateQaFlag;
  rawType: string;
  rawDisplay: string;
}

const SENTINELS = new Set(
  ['', '-', 'n/a', 'na', 'n.a.', 'tbd', 'nil', 'null', 'none', 'pending', '.', '--', '—'].map((s) =>
    s.toLowerCase(),
  ),
);

/** Excel 1900 date system serial → UTC calendar components (accounts for Excel leap-year bug). */
export function excelSerialToYmd(serial: number): { y: number; m: number; d: number } | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2958465) return null;
  // Excel incorrectly treats 1900 as leap year; serials >= 60 are offset by +1 day vs real Julian
  const excelEpochUtc = Date.UTC(1899, 11, 30); // 1899-12-30
  const whole = Math.floor(serial);
  const ms = excelEpochUtc + whole * 86400000;
  const dt = new Date(ms);
  return {
    y: dt.getUTCFullYear(),
    m: dt.getUTCMonth() + 1,
    d: dt.getUTCDate(),
  };
}

export function ymdToIso(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Store as UTC midnight for the calendar day (date-only; no IST offset stored). */
export function isoToDateOnly(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function isPlausible(y: number, m: number, d: number): boolean {
  if (y < 1990 || y > 2100) return false;
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function withOutlierCheck(iso: string, flag: DateQaFlag): ParsedExcelDate {
  const [y, m, d] = iso.split('-').map(Number);
  const outlier = y < 2018 || y > new Date().getFullYear() + 3;
  return {
    isoDate: iso,
    date: isoToDateOnly(iso),
    flag: outlier ? 'DATE_OUTLIER' : flag,
    rawType: '',
    rawDisplay: '',
  };
}

function parseTextDate(text: string): { iso: string; flag: DateQaFlag } | null {
  const t = text.trim();

  // YYYY-MM-DD
  let m = t.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
  if (m) {
    const y = +m[1];
    const mo = +m[2];
    const d = +m[3];
    if (isPlausible(y, mo, d)) return { iso: ymdToIso(y, mo, d), flag: 'DATE_COERCED_TEXT' };
  }

  // DD/MM/YYYY or DD-MM-YYYY (prefer DMY for India)
  m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    const y = +m[3];
    // If first > 12 → must be DMY
    if (a > 12 && isPlausible(y, b, a)) {
      return { iso: ymdToIso(y, b, a), flag: 'DATE_COERCED_TEXT' };
    }
    // If second > 12 → must be MDY
    if (b > 12 && isPlausible(y, a, b)) {
      return { iso: ymdToIso(y, a, b), flag: 'DATE_COERCED_TEXT' };
    }
    // Ambiguous: prefer DMY (IST / India)
    if (isPlausible(y, b, a)) {
      return { iso: ymdToIso(y, b, a), flag: 'DATE_COERCED_TEXT' };
    }
  }

  // D MMM YYYY / DD MMM YYYY
  m = t.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if (m) {
    const months: Record<string, number> = {
      jan: 1,
      january: 1,
      feb: 2,
      february: 2,
      mar: 3,
      march: 3,
      apr: 4,
      april: 4,
      may: 5,
      jun: 6,
      june: 6,
      jul: 7,
      july: 7,
      aug: 8,
      august: 8,
      sep: 9,
      sept: 9,
      september: 9,
      oct: 10,
      october: 10,
      nov: 11,
      november: 11,
      dec: 12,
      december: 12,
    };
    const mo = months[m[2].toLowerCase()];
    const d = +m[1];
    const y = +m[3];
    if (mo && isPlausible(y, mo, d)) {
      return { iso: ymdToIso(y, mo, d), flag: 'DATE_COERCED_TEXT' };
    }
  }

  return null;
}

/**
 * Parse a raw Excel cell value into an IST calendar date.
 * Date objects from ExcelJS are treated as UTC Y-M-D components (Excel stores dates as midnights).
 */
export function parseExcelDate(raw: unknown): ParsedExcelDate {
  const empty = (flag: DateQaFlag, rawType: string, rawDisplay: string): ParsedExcelDate => ({
    isoDate: null,
    date: null,
    flag,
    rawType,
    rawDisplay,
  });

  if (raw === null || raw === undefined) {
    return empty('DATE_EMPTY', 'null', '');
  }

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const iso = ymdToIso(raw.getUTCFullYear(), raw.getUTCMonth() + 1, raw.getUTCDate());
    const result = withOutlierCheck(iso, 'DATE_OK');
    result.rawType = 'Date';
    result.rawDisplay = raw.toISOString();
    return result;
  }

  if (typeof raw === 'number') {
    const ymd = excelSerialToYmd(raw);
    if (!ymd) {
      return empty('DATE_PARSE_FAIL', 'number', String(raw));
    }
    const iso = ymdToIso(ymd.y, ymd.m, ymd.d);
    const result = withOutlierCheck(iso, 'DATE_COERCED_SERIAL');
    result.rawType = 'number';
    result.rawDisplay = String(raw);
    return result;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || SENTINELS.has(trimmed.toLowerCase())) {
      return empty(trimmed ? 'DATE_SENTINEL' : 'DATE_EMPTY', 'string', trimmed);
    }

    // Numeric string that looks like Excel serial
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const n = Number(trimmed);
      if (n >= 30000 && n <= 60000) {
        const ymd = excelSerialToYmd(n);
        if (ymd) {
          const iso = ymdToIso(ymd.y, ymd.m, ymd.d);
          const result = withOutlierCheck(iso, 'DATE_COERCED_SERIAL');
          result.rawType = 'string-serial';
          result.rawDisplay = trimmed;
          return result;
        }
      }
    }

    const parsed = parseTextDate(trimmed);
    if (parsed) {
      const result = withOutlierCheck(parsed.iso, parsed.flag);
      result.rawType = 'string';
      result.rawDisplay = trimmed;
      return result;
    }

    return empty('DATE_PARSE_FAIL', 'string', trimmed);
  }

  // ExcelJS sometimes returns rich text / formula results as objects
  if (typeof raw === 'object' && raw !== null && 'result' in (raw as object)) {
    return parseExcelDate((raw as { result: unknown }).result);
  }
  if (typeof raw === 'object' && raw !== null && 'text' in (raw as object)) {
    return parseExcelDate((raw as { text: unknown }).text);
  }

  return empty('DATE_PARSE_FAIL', typeof raw, String(raw));
}

export function isDateLikeHeader(header: string): boolean {
  const h = header.trim().toLowerCase();
  if (!h) return false;
  return /date|start|end|contacted/.test(h);
}

export function compareIsoDates(start: string | null, end: string | null): DateQaFlag | null {
  if (!start || !end) return null;
  if (start > end) return 'DATE_RANGE_INVALID';
  return null;
}
