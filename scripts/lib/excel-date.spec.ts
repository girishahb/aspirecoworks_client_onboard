import {
  excelSerialToYmd,
  parseExcelDate,
  ymdToIso,
  compareIsoDates,
  isDateLikeHeader,
} from './excel-date';

describe('excelSerialToYmd', () => {
  it('converts known serial 45694 to 2025-02-06', () => {
    const ymd = excelSerialToYmd(45694);
    expect(ymd).not.toBeNull();
    expect(ymd!.y).toBe(2025);
    expect(ymd!.m).toBe(2);
    expect(ymd!.d).toBe(6);
  });

  it('rejects invalid serials', () => {
    expect(excelSerialToYmd(0)).toBeNull();
    expect(excelSerialToYmd(-1)).toBeNull();
    expect(excelSerialToYmd(NaN)).toBeNull();
  });
});

describe('parseExcelDate', () => {
  it('parses Date objects as UTC Y-M-D', () => {
    const d = new Date(Date.UTC(2024, 5, 15));
    const r = parseExcelDate(d);
    expect(r.isoDate).toBe('2024-06-15');
    expect(r.flag).toBe('DATE_OK');
  });

  it('coerces Excel serial numbers', () => {
    const r = parseExcelDate(45694);
    expect(r.isoDate).toBe('2025-02-06');
    expect(r.flag).toBe('DATE_COERCED_SERIAL');
  });

  it('coerces serial-looking strings', () => {
    const r = parseExcelDate('45694');
    expect(r.isoDate).toBe('2025-02-06');
    expect(r.flag).toBe('DATE_COERCED_SERIAL');
  });

  it('parses DD/MM/YYYY (India preference)', () => {
    const r = parseExcelDate('15/03/2024');
    expect(r.isoDate).toBe('2024-03-15');
    expect(r.flag).toBe('DATE_COERCED_TEXT');
  });

  it('parses YYYY-MM-DD', () => {
    const r = parseExcelDate('2024-03-15');
    expect(r.isoDate).toBe('2024-03-15');
  });

  it('treats N/A as sentinel', () => {
    expect(parseExcelDate('N/A').flag).toBe('DATE_SENTINEL');
    expect(parseExcelDate('-').flag).toBe('DATE_SENTINEL');
    expect(parseExcelDate('').flag).toBe('DATE_EMPTY');
    expect(parseExcelDate(null).flag).toBe('DATE_EMPTY');
  });

  it('flags unparseable garbage', () => {
    const r = parseExcelDate('not-a-date');
    expect(r.isoDate).toBeNull();
    expect(r.flag).toBe('DATE_PARSE_FAIL');
  });

  it('flags outliers before 2018', () => {
    const r = parseExcelDate('01/01/2010');
    expect(r.isoDate).toBe('2010-01-01');
    expect(r.flag).toBe('DATE_OUTLIER');
  });
});

describe('helpers', () => {
  it('ymdToIso pads', () => {
    expect(ymdToIso(2024, 3, 5)).toBe('2024-03-05');
  });

  it('compareIsoDates detects inverted range', () => {
    expect(compareIsoDates('2024-06-01', '2024-01-01')).toBe('DATE_RANGE_INVALID');
    expect(compareIsoDates('2024-01-01', '2024-06-01')).toBeNull();
  });

  it('isDateLikeHeader matches agreement/contact columns', () => {
    expect(isDateLikeHeader('Agreement Start Date')).toBe(true);
    expect(isDateLikeHeader('Last Contacted')).toBe(true);
    expect(isDateLikeHeader('Company Name')).toBe(false);
  });
});
