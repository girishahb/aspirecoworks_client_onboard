"""Ensure Rate card is one row per company with membership types as columns."""
from __future__ import annotations

from pathlib import Path

from openpyxl import load_workbook
from openpyxl.styles import Font
from openpyxl.utils import get_column_letter

PATH = Path(__file__).resolve().parent / "archived-excel" / "all-clients-export_v1.xlsx"

COLS = ["BR", "GR", "Mailing Address Plan", "Flipkart Bookings (GR)"]


def main() -> None:
    wb = load_workbook(PATH)
    if "Rate card" not in wb.sheetnames:
        raise SystemExit("Rate card sheet not found")

    ws = wb["Rate card"]
    # Unmerge leftover ranges from older layouts
    for merged in list(ws.merged_cells.ranges):
        ws.unmerge_cells(str(merged))

    headers = [ws.cell(1, c).value for c in range(1, 8)]
    print("Current headers:", headers)
    print(f"Companies: {ws.max_row - 1}")
    for r in range(2, min(ws.max_row + 1, 6)):
        print([ws.cell(r, c).value for c in range(1, 7)])


if __name__ == "__main__":
    main()
