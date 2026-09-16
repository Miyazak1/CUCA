from __future__ import annotations

import json
import re
from pathlib import Path

import pdfplumber


ROOT = Path(__file__).resolve().parents[1]
RUN_DIR = ROOT / "work" / "catalog-official" / "sysu-complete-batch-01"
RAW_DIR = RUN_DIR / "raw"
OUTPUT_PATH = RUN_DIR / "parsed-routes.json"


def source_file(prefix: str) -> Path:
    matches = sorted(RAW_DIR.glob(f"{prefix}.*.pdf"))
    if len(matches) != 1:
        raise RuntimeError(f"Expected one PDF for {prefix}, found {len(matches)}")
    return matches[0]


def clean(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "").replace("\u00a0", " ")).strip()


def english(value: object) -> str:
    text = "".join(char if ord(char) < 128 else " " for char in str(value or ""))
    text = re.sub(r"https?://\S+", "", text)
    return clean(text).strip(" /-")


def table_rows(path: Path) -> list[tuple[int, list[str]]]:
    rows: list[tuple[int, list[str]]] = []
    with pdfplumber.open(path) as document:
        for page_number, page in enumerate(document.pages, start=1):
            tables = page.extract_tables()
            if len(tables) != 1:
                raise RuntimeError(f"Expected one table on {path.name} page {page_number}, found {len(tables)}")
            table = tables[0]
            for row in table[1:]:
                rows.append((page_number, [clean(cell) for cell in row]))
    return rows


def parse_undergraduate() -> list[dict[str, object]]:
    output: list[dict[str, object]] = []
    current_department = ""
    for page, row in table_rows(source_file("sysu-undergraduate-programs-2026")):
        if len(row) != 10:
            raise RuntimeError(f"Unexpected undergraduate row on page {page}: {row}")
        if not row[0].isdigit():
            continue
        current_department = english(row[1]) or current_department
        if not current_department:
            raise RuntimeError(f"Missing undergraduate department on page {page}: {row}")
        output.append(
            {
                "degree": "Undergraduate",
                "sourceId": "sysu-undergraduate-programs-2026",
                "page": page,
                "routeNo": int(row[0]),
                "department": current_department,
                "major": english(row[2]),
                "durationYears": int(english(row[3])),
                "language": english(row[4]),
                "tuitionAmount": int(english(row[5]).replace(",", "")),
                "hskRequirement": english(row[6]),
                "cscaRequirement": english(row[7]),
                "campus": english(row[8]),
                "note": english(row[9]) or None,
            }
        )
    route_numbers = [item["routeNo"] for item in output]
    if route_numbers != list(range(1, 68)):
        raise RuntimeError(f"Unexpected undergraduate numbering: {route_numbers}")
    return output


def parse_master() -> list[dict[str, object]]:
    output: list[dict[str, object]] = []
    for page, row in table_rows(source_file("sysu-master-guide-pdf-2026")):
        if len(row) != 11:
            raise RuntimeError(f"Unexpected master's row on page {page}: {row}")
        output.append(
            {
                "degree": "Master",
                "sourceId": "sysu-master-guide-pdf-2026",
                "page": page,
                "department": clean(row[1] or row[0]),
                "majorNo": clean(row[2]),
                "major": clean(row[3]),
                "fieldNo": clean(row[4]),
                "field": clean(row[5]),
                "disciplinaryCategory": clean(row[6]),
                "degreeType": clean(row[7]),
                "durationYears": int(clean(row[8])),
                "language": clean(row[9]),
                "campus": clean(row[10]),
            }
        )
    return output


def parse_doctoral() -> list[dict[str, object]]:
    output: list[dict[str, object]] = []
    for page, row in table_rows(source_file("sysu-doctoral-guide-pdf-2026")):
        if len(row) != 10:
            raise RuntimeError(f"Unexpected doctoral row on page {page}: {row}")
        output.append(
            {
                "degree": "Doctoral",
                "sourceId": "sysu-doctoral-guide-pdf-2026",
                "page": page,
                "department": clean(row[0]),
                "majorNo": clean(row[1]),
                "major": clean(row[2]),
                "fieldNo": clean(row[3]),
                "field": clean(row[4]),
                "degreeType": clean(row[5]),
                "durationYears": int(clean(row[6])),
                "language": clean(row[7]),
                "campus": clean(row[8]),
            }
        )
    return output


undergraduate = parse_undergraduate()
master = parse_master()
doctoral = parse_doctoral()
payload = {
    "version": 1,
    "counts": {
        "undergraduate": len(undergraduate),
        "master": len(master),
        "doctoral": len(doctoral),
        "total": len(undergraduate) + len(master) + len(doctoral),
    },
    "routes": undergraduate + master + doctoral,
}
OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(payload["counts"], ensure_ascii=False))
