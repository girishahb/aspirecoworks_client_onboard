"""
Export all archived Excel client workbooks into a single CSV.

Date rules:
  - hyphen/dot text dates (20-02-2026) → DD-MM-YYYY
  - slash text dates (11/21/2025) → MM-DD-YYYY (fallback DMY if invalid)
  - Excel serial / datetime → calendar YYYY-MM-DD

Usage:
  python scripts/export-excel-clients-csv.py
"""
from __future__ import annotations

import csv
import re
from datetime import date, datetime, timedelta
from pathlib import Path

from openpyxl import load_workbook

EXCEL_DIR = Path(__file__).resolve().parent / "archived-excel"
OUT_PATH = EXCEL_DIR / "all-clients-export.csv"

WORKBOOKS = [
    "Aspire_Client Data - Indiranagar.xlsx",
    "Aspire_Client Data -Platinum.xlsx",
    "Aspire_Client Data - Kormangala branch.xlsx",
]

SKIP_SHEETS = {"sheet1"}

HEADERS = [
    "Workbook",
    "Sheet Name",
    "Aggregator Name",
    "Category",
    "Title",
    "First Name",
    "Company Name",
    "Address",
    "Phone Number",
    "PAN No",
    "Client City",
    "Agreement Start Date",
    "Agreement End Date",
    "No of Months",
    "Membership Type",
    "GST Number",
    "BookingID",
    "Notes",
    "Contact Name",
    "Position/Title",
    "Contact #",
]

SENTINELS = {"", "-", "n/a", "na", "n.a.", "tbd", "nil", "null", "none", "pending", ".", "--", "—"}


def cell_text(raw) -> str:
    if raw is None:
        return ""
    if isinstance(raw, datetime):
        return raw.isoformat()
    if isinstance(raw, date):
        return raw.isoformat()
    if isinstance(raw, bool):
        return str(raw)
    if isinstance(raw, (int, float)):
        # Keep integers clean
        if isinstance(raw, float) and raw.is_integer():
            return str(int(raw))
        return str(raw)
    return re.sub(r"\s+", " ", str(raw)).strip()


def header_key(h: str) -> str:
    return re.sub(r"\s+", " ", (h or "").strip().lower())


def find_col(headers: list[str], candidates: list[str]) -> int:
    mapped = [header_key(h) for h in headers]
    for c in candidates:
        c = c.lower()
        if c in mapped:
            return mapped.index(c)
    for c in candidates:
        c = c.lower()
        for i, h in enumerate(mapped):
            if c in h:
                return i
    return -1


def plausible(y: int, m: int, d: int) -> bool:
    if y < 1990 or y > 2100 or m < 1 or m > 12 or d < 1 or d > 31:
        return False
    try:
        date(y, m, d)
        return True
    except ValueError:
        return False


def ymd(y: int, m: int, d: int) -> str:
    return f"{y:04d}-{m:02d}-{d:02d}"


def excel_serial_to_ymd(serial: float) -> str | None:
    # Excel 1900 date system (with leap-year bug accounted via 1899-12-30 epoch)
    try:
        n = int(serial)
        if n < 1 or n > 2958465:
            return None
        dt = datetime(1899, 12, 30) + timedelta(days=n)
        if plausible(dt.year, dt.month, dt.day):
            return ymd(dt.year, dt.month, dt.day)
    except Exception:
        return None
    return None


def parse_date_cell(raw) -> str:
    if raw is None:
        return ""

    if isinstance(raw, datetime):
        return ymd(raw.year, raw.month, raw.day)
    if isinstance(raw, date):
        return ymd(raw.year, raw.month, raw.day)

    if isinstance(raw, (int, float)) and not isinstance(raw, bool):
        # Excel serials for modern dates are typically ~40000-60000
        if 30000 <= float(raw) <= 60000:
            return excel_serial_to_ymd(float(raw)) or ""
        return ""

    t = cell_text(raw)
    if not t or t.lower() in SENTINELS:
        return ""

    m = re.match(r"^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$", t)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return ymd(y, mo, d) if plausible(y, mo, d) else ""

    if re.match(r"^\d+(\.\d+)?$", t):
        n = float(t)
        if 30000 <= n <= 60000:
            return excel_serial_to_ymd(n) or ""

    # Slash → MM/DD/YYYY (fallback DMY)
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", t)
    if m:
        a, b, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if plausible(y, a, b):
            return ymd(y, a, b)
        if plausible(y, b, a):
            return ymd(y, b, a)
        return ""

    # Hyphen/dot → DD-MM-YYYY (fallback MDY)
    m = re.match(r"^(\d{1,2})[-.](\d{1,2})[-.](\d{4})$", t)
    if m:
        a, b, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if plausible(y, b, a):
            return ymd(y, b, a)
        if plausible(y, a, b):
            return ymd(y, a, b)
        return ""

    months = {
        "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
        "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
        "aug": 8, "august": 8, "sep": 9, "sept": 9, "september": 9,
        "oct": 10, "october": 10, "nov": 11, "november": 11, "dec": 12, "december": 12,
    }
    m = re.match(r"^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$", t)
    if m:
        mo = months.get(m.group(2).lower())
        d, y = int(m.group(1)), int(m.group(3))
        if mo and plausible(y, mo, d):
            return ymd(y, mo, d)

    return ""


def aggregator_from_sheet(sheet_name: str) -> tuple[str, str]:
    s = sheet_name.strip()
    # Virtl_* is a common abbreviation for Virtual_* in these workbooks
    if re.match(r"^(virtual|virtl)", s, re.I):
        name = re.sub(r"^(Virtual|Virtl)[_ ]?", "", s, flags=re.I)
        name = re.sub(r"\s+", " ", name).strip() or s
        return name, "Virtual Office"
    return re.sub(r"\s+", " ", s).strip(), "Aggregator"


def split_booking_and_notes(notes_raw: str, booking_col_raw: str) -> tuple[str, str]:
    booking_id = ""
    notes = notes_raw.strip()

    def lookalike_id(val: str) -> bool:
        return bool(re.match(r"^[A-Za-z0-9][A-Za-z0-9\-]{3,}$", val)) and bool(re.search(r"\d", val))

    def take_id(val: str) -> None:
        nonlocal booking_id
        cleaned = re.sub(r"[.,;]+$", "", val).strip()
        if cleaned and lookalike_id(cleaned) and not booking_id:
            booking_id = cleaned

    col_id = re.sub(r"[.,;]+$", "", booking_col_raw.strip())
    if lookalike_id(col_id):
        booking_id = col_id

    # Normalize repeated "Booking ID" prefixes first
    notes = re.sub(r"(?:booking\s*id\s*[:\-]?\s*){2,}", "Booking ID: ", notes, flags=re.I)

    patterns = [
        r"previous\s+year\s+booking\s*id\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\-]*)",
        r"previous\s+booking\s*id\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\-]*)",
        r"new\s+booking\s*:\s*id\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\-]*)",
        r"booking\s*:\s*id\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\-]*)",
        r"booking\s*(?:id|reference\s*number)?\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\-]*)",
        r"sales\s*-\s*([A-Za-z0-9][A-Za-z0-9\-]*)",
    ]

    for pat in patterns:
        m = re.search(pat, notes, flags=re.I)
        if m and lookalike_id(m.group(1)):
            take_id(m.group(1))
            notes = re.sub(r"previous\s+year\s+booking\s*id\s*[:\-]?\s*", "", notes, flags=re.I)
            notes = re.sub(r"previous\s+booking\s*id\s*[:\-]?\s*", "", notes, flags=re.I)
            notes = re.sub(r"new\s+booking\s*:\s*id\s*[:\-]?\s*", "", notes, flags=re.I)
            notes = re.sub(r"booking\s*:\s*id\s*[:\-]?\s*", "", notes, flags=re.I)
            notes = re.sub(r"booking\s*(?:id|reference\s*number)?\s*[:\-]?\s*", "", notes, flags=re.I)
            notes = re.sub(r"sales\s*-\s*", "", notes, flags=re.I)
            notes = re.sub(re.escape(m.group(1)), "", notes, flags=re.I)
            notes = re.sub(r"^[\s,:;\-()]+|[\s,:;\-()]+$", "", notes).strip()
            notes = re.sub(r"\(\s*\)", "", notes).strip()
            break

    if not booking_id:
        bare = re.match(r"^([A-Za-z]{2,}[A-Za-z0-9\-]{4,})(?:\s*[\(\-–,].*)?$", notes)
        if (
            bare
            and lookalike_id(bare.group(1))
            and " " not in bare.group(1)
            and "@" not in notes
            and not re.search(r"agreement|renewal|email|done|confirmation", bare.group(1), re.I)
        ):
            take_id(bare.group(1))
            notes = notes[len(bare.group(1)) :]
            notes = re.sub(r"^[\s\(\-–,]+|[\s\)]+$", "", notes).strip()

    if booking_id:
        norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())
        if not notes or norm(notes) == norm(booking_id) or re.match(r"^booking\s*id$", notes, re.I):
            notes = ""

    return booking_id, notes


def find_header_row(rows: list[list]) -> tuple[int, list[str]]:
    headers: list[str] = []
    header_idx = 0
    for i, row in enumerate(rows[:10]):
        vals = [cell_text(c) for c in row]
        if sum(1 for v in vals if v) < 3:
            continue
        joined = " ".join(vals).lower()
        if any(k in joined for k in ("company", "first name", "agreement", "phone")):
            return i, vals
        if not headers:
            headers = vals
            header_idx = i
    return header_idx, headers


def export_workbook(path: Path, writer: csv.DictWriter) -> dict:
    wb = load_workbook(path, read_only=True, data_only=True)
    stats = {"rows": 0, "sheets": 0, "skipped": 0, "booking": 0, "notes": 0}
    print(f"\nWorkbook: {path.name} ({len(wb.sheetnames)} sheets)")

    for sheet_name in wb.sheetnames:
        if sheet_name.strip().lower() in SKIP_SHEETS:
            continue

        ws = wb[sheet_name]
        header_idx = -1
        headers: list[str] = []
        fallback_headers: list[str] = []
        fallback_idx = 0
        sheet_rows = 0
        pending_pre_header: list[list] = []

        aggregator_name, category = aggregator_from_sheet(sheet_name)

        # Column indexes filled after header is found
        cols: dict[str, int] = {}
        mapped: list[str] = []

        def setup_cols(hdrs: list[str]) -> bool:
            nonlocal mapped, cols
            mapped = [header_key(h) for h in hdrs]
            joined = " ".join(hdrs).lower()
            if "company" not in joined and "first name" not in joined:
                return False
            cols = {
                "title": find_col(hdrs, ["title"]),
                "first": mapped.index("first name") if "first name" in mapped else find_col(hdrs, ["first name"]),
                "company": find_col(hdrs, ["company name", "company"]),
                "address": find_col(hdrs, ["address"]),
                "phone": find_col(hdrs, ["phone number", "phone", "customer contact no"]),
                "pan": find_col(hdrs, ["pan no", "pan number", "pan"]),
                "city": find_col(hdrs, ["client city", "city"]),
                "start": find_col(hdrs, ["agreement start date", "start date", "agreement start"]),
                "end": find_col(hdrs, ["agreement end date", "end date", "agreement end"]),
                "months": find_col(hdrs, ["no of months", "months"]),
                "membership": find_col(hdrs, ["membership type", "membership"]),
                "gst": find_col(hdrs, ["gst number", "gst #", "gst#", "gst"]),
                "notes": find_col(hdrs, ["notes", "remarks"]),
                "booking": find_col(hdrs, ["booking id", "notes / booking id", "booking"]),
                "contact_name": mapped.index("name") if "name" in mapped else -1,
                "position": find_col(hdrs, ["position/title", "position"]),
                "contact_phone": find_col(hdrs, ["contact #", "contact#"]),
            }
            return True

        def emit_row(row: list) -> None:
            nonlocal sheet_rows
            if not any(cell_text(c) for c in row):
                return

            def get(idx: int) -> str:
                if idx < 0 or idx >= len(row):
                    return ""
                return cell_text(row[idx])

            def get_raw(idx: int):
                if idx < 0 or idx >= len(row):
                    return None
                return row[idx]

            company = get(cols["company"])
            if not company:
                stats["skipped"] += 1
                return

            title = ""
            if cols["title"] >= 0 and header_key(headers[cols["title"]]) == "title":
                title = get(cols["title"])

            booking_from_col = ""
            bidx = cols["booking"]
            nidx = cols["notes"]
            if bidx >= 0 and bidx != nidx and re.search(r"booking", headers[bidx] or "", re.I):
                booking_from_col = get(bidx)

            booking_id, notes = split_booking_and_notes(
                get(nidx) if nidx >= 0 else "",
                booking_from_col,
            )

            writer.writerow(
                {
                    "Workbook": path.name,
                    "Sheet Name": sheet_name,
                    "Aggregator Name": aggregator_name,
                    "Category": category,
                    "Title": title,
                    "First Name": get(cols["first"]),
                    "Company Name": company,
                    "Address": get(cols["address"]),
                    "Phone Number": get(cols["phone"]) or get(cols["contact_phone"]),
                    "PAN No": re.sub(r"\s+", "", get(cols["pan"])).upper(),
                    "Client City": get(cols["city"]),
                    "Agreement Start Date": parse_date_cell(get_raw(cols["start"])) if cols["start"] >= 0 else "",
                    "Agreement End Date": parse_date_cell(get_raw(cols["end"])) if cols["end"] >= 0 else "",
                    "No of Months": get(cols["months"]),
                    "Membership Type": get(cols["membership"]),
                    "GST Number": get(cols["gst"]),
                    "BookingID": booking_id,
                    "Notes": notes,
                    "Contact Name": get(cols["contact_name"]) if cols["contact_name"] >= 0 else "",
                    "Position/Title": get(cols["position"]),
                    "Contact #": get(cols["contact_phone"]),
                }
            )
            stats["rows"] += 1
            sheet_rows += 1
            if booking_id:
                stats["booking"] += 1
            if notes:
                stats["notes"] += 1

        for i, row_tuple in enumerate(ws.iter_rows(values_only=True)):
            row = list(row_tuple)

            if header_idx < 0:
                vals = [cell_text(c) for c in row]
                if sum(1 for v in vals if v) >= 3:
                    joined = " ".join(vals).lower()
                    if any(k in joined for k in ("company", "first name", "agreement", "phone")):
                        header_idx = i
                        headers = vals
                        if not setup_cols(headers):
                            print(f"  skip (non-client sheet): {sheet_name}")
                            break
                        stats["sheets"] += 1
                        continue
                    if not fallback_headers:
                        fallback_headers = vals
                        fallback_idx = i
                if i < 10:
                    continue
                # No good header in first 10 rows
                if fallback_headers:
                    header_idx = fallback_idx
                    headers = fallback_headers
                    if not setup_cols(headers):
                        print(f"  skip (non-client sheet): {sheet_name}")
                        break
                    stats["sheets"] += 1
                    # Reprocess rows after fallback header — we only kept none; skip
                    continue
                print(f"  skip (no headers): {sheet_name}")
                break

            emit_row(row)

        if header_idx >= 0 and cols:
            print(f"  {sheet_name}: {sheet_rows} rows ({category} / {aggregator_name})")
        elif header_idx < 0 and i >= 0:
            # empty sheet already logged
            pass

    wb.close()
    return stats


def main() -> None:
    totals = {"rows": 0, "sheets": 0, "skipped": 0, "booking": 0, "notes": 0}
    with OUT_PATH.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=HEADERS, quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        for name in WORKBOOKS:
            path = EXCEL_DIR / name
            if not path.exists():
                print(f"Missing workbook: {name}")
                continue
            stats = export_workbook(path, writer)
            for k in totals:
                totals[k] += stats[k]

    print(f"\nWrote {totals['rows']} rows -> {OUT_PATH}")
    print(f"Sheets: {totals['sheets']}, Skipped (no company): {totals['skipped']}")
    print(f"With BookingID: {totals['booking']}, With Notes: {totals['notes']}")


if __name__ == "__main__":
    main()
