"""
Extract company name + email from all sheets in Aspire_Client Data*.xlsx workbooks.
Emails may be in dedicated columns or any cell (e.g. Notes).

Usage:
  python scripts/extract-client-emails-from-excel.py
"""
from __future__ import annotations

import csv
import re
from pathlib import Path

from openpyxl import load_workbook

EXCEL_DIR = Path(__file__).resolve().parent / "archived-excel"
OUT_CSV = EXCEL_DIR / "client-emails-from-excel.csv"
OUT_UNIQUE = EXCEL_DIR / "client-emails-from-excel-unique.csv"

WORKBOOKS = [
    "Aspire_Client Data - Indiranagar.xlsx",
    "Aspire_Client Data -Platinum.xlsx",
    "Aspire_Client Data - Kormangala branch.xlsx",
]

SKIP_SHEETS = {"sheet1"}

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")

# Ignore known non-client / template addresses
IGNORE_EMAILS = {
    "accounts@aaddress.in",
    "accounts@aaddress.in",  # typo variants handled via lower
}


def cell_text(raw) -> str:
    if raw is None:
        return ""
    if isinstance(raw, bool):
        return str(raw)
    if isinstance(raw, (int, float)):
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


def find_email_cols(headers: list[str]) -> list[int]:
    cols: list[int] = []
    for i, h in enumerate(headers):
        hk = header_key(h)
        if not hk:
            continue
        if any(
            k in hk
            for k in (
                "email",
                "gmail",
                "g mail",
                "e-mail",
                "mail id",
                "customer email",
            )
        ):
            # avoid invoice / accounts@ header noise unless it looks like a real field
            if hk.startswith("accounts@"):
                continue
            cols.append(i)
    return cols


def extract_emails(text: str) -> list[str]:
    if not text or "@" not in text:
        return []
    found = []
    for m in EMAIL_RE.findall(text):
        e = m.strip(".,;:()[]<>\"' ").lower()
        if e.count("@") != 1:
            continue
        local, domain = e.split("@", 1)
        if not local or not domain or "." not in domain:
            continue
        if e in IGNORE_EMAILS:
            continue
        # skip spreadsheet header-like / placeholder
        if e.endswith("@aspire.import") or e.startswith("unknown+"):
            continue
        if e not in found:
            found.append(e)
    return found


def main() -> None:
    rows_out: list[dict] = []
    unique_map: dict[tuple[str, str], dict] = {}

    for wb_name in WORKBOOKS:
        path = EXCEL_DIR / wb_name
        if not path.exists():
            print(f"Missing: {path}")
            continue

        wb = load_workbook(path, read_only=True, data_only=True)
        print(f"\nWorkbook: {wb_name} ({len(wb.sheetnames)} sheets)")

        for sheet_name in wb.sheetnames:
            if sheet_name.strip().lower() in SKIP_SHEETS:
                continue

            ws = wb[sheet_name]
            header_idx = -1
            headers: list[str] = []
            col_company = -1
            email_cols: list[int] = []
            sheet_hits = 0

            for i, row_tuple in enumerate(ws.iter_rows(values_only=True)):
                row = list(row_tuple)
                texts = [cell_text(c) for c in row]

                if header_idx < 0:
                    non_empty = sum(1 for t in texts if t)
                    if non_empty < 3:
                        continue
                    joined = " ".join(texts).lower()
                    if any(k in joined for k in ("company", "first name", "agreement", "phone", "email", "gmail")):
                        headers = texts
                        header_idx = i
                        col_company = find_col(headers, ["company name", "company"])
                        email_cols = find_email_cols(headers)
                        continue
                    if i >= 9:
                        break
                    continue

                if col_company < 0 or col_company >= len(texts):
                    company = ""
                else:
                    company = texts[col_company]
                if not company:
                    # still scan row for emails if present
                    company = ""

                # Prefer dedicated email columns first
                emails: list[tuple[str, str]] = []  # email, source
                for ec in email_cols:
                    if ec < len(row):
                        for e in extract_emails(cell_text(row[ec])):
                            src = headers[ec] if ec < len(headers) and headers[ec] else f"col{ec+1}"
                            emails.append((e, src))

                # Scan ALL cells for emails not already found
                seen = {e for e, _ in emails}
                for c_idx, raw in enumerate(row):
                    t = cell_text(raw)
                    if "@" not in t:
                        continue
                    for e in extract_emails(t):
                        if e in seen:
                            continue
                        src = (
                            headers[c_idx]
                            if c_idx < len(headers) and headers[c_idx]
                            else f"col{c_idx+1}"
                        )
                        emails.append((e, f"{src} (scanned)"))
                        seen.add(e)

                if not emails:
                    continue
                if not company:
                    # skip orphan emails without company (often header noise)
                    continue

                for e, src in emails:
                    rec = {
                        "Workbook": wb_name,
                        "Sheet": sheet_name,
                        "Company Name": company,
                        "Email": e,
                        "Email Source Column": src,
                        "Row": i + 1,
                    }
                    rows_out.append(rec)
                    sheet_hits += 1
                    key = (company.strip().lower(), e)
                    # prefer dedicated column over scanned
                    prev = unique_map.get(key)
                    if not prev or ("scanned" in prev["Email Source Column"] and "scanned" not in src):
                        unique_map[key] = {
                            "Company Name": company,
                            "Email": e,
                            "Email Source Column": src,
                            "Workbook": wb_name,
                            "Sheet": sheet_name,
                            "Row": i + 1,
                        }

            print(f"  {sheet_name}: {sheet_hits} email hits")

        wb.close()

    headers_out = ["Workbook", "Sheet", "Company Name", "Email", "Email Source Column", "Row"]
    with OUT_CSV.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=headers_out)
        w.writeheader()
        w.writerows(rows_out)

    unique_headers = ["Company Name", "Email", "Email Source Column", "Workbook", "Sheet", "Row"]
    unique_rows = sorted(unique_map.values(), key=lambda r: (r["Company Name"].lower(), r["Email"]))
    with OUT_UNIQUE.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=unique_headers)
        w.writeheader()
        w.writerows(unique_rows)

    with_email = len(unique_rows)
    companies = len({r["Company Name"].strip().lower() for r in unique_rows})
    print(f"\nWrote {len(rows_out)} row-level hits -> {OUT_CSV}")
    print(f"Wrote {with_email} unique company+email pairs ({companies} companies) -> {OUT_UNIQUE}")


if __name__ == "__main__":
    main()
