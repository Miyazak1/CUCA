"""Extract the locked 2026 NENU international graduate catalog deterministically."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import pdfplumber


ROOT = Path.cwd()
RUN = ROOT / "work/catalog-official/2026-10-26T05-55-09-322Z"
SOURCE_ID = "nenu-international-graduate-program-catalog-pdf-2026"
OUTPUT = ROOT / "catalog-sources/nenu-2026-graduate-programs.extracted.json"


def compact(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


manifest = json.loads((RUN / "manifest.json").read_text(encoding="utf-8"))
matches = [row for row in manifest["sources"] if row["id"] == SOURCE_ID]
if len(matches) != 1 or matches[0]["status"] != 200 or matches[0]["contentType"] != "application/pdf":
    raise RuntimeError("Missing locked NENU program PDF evidence")
source = matches[0]
artifact = RUN / source["artifactPath"]
if hashlib.sha256(artifact.read_bytes()).hexdigest() != source["sha256"]:
    raise RuntimeError("NENU program PDF changed after collection")

routes: list[dict] = []
page_rows: list[dict] = []
with pdfplumber.open(artifact) as pdf:
    if len(pdf.pages) != 11:
        raise RuntimeError(f"Expected 11 NENU catalog pages, found {len(pdf.pages)}")
    for page_number, page in enumerate(pdf.pages, start=1):
        tables = page.extract_tables()
        if len(tables) != 1:
            raise RuntimeError(f"Expected one table on page {page_number}, found {len(tables)}")
        accepted = 0
        for raw_row in tables[0]:
            row = list(raw_row) + [None] * (17 - len(raw_row))
            number = compact(row[0])
            if not number.isdigit():
                continue
            major = compact(row[2])
            language_raw = compact(row[3])
            category_raw = compact(row[4])
            faculty = compact(row[6])
            duration = compact(row[7])
            degree_type = compact(row[9])
            tuition = compact(row[10])
            campus = compact(row[11])
            if not major or not (language_raw.endswith("/English") or language_raw.endswith("/Chinese")):
                raise RuntimeError(f"Malformed language or major on page {page_number}, row {number}: {language_raw!r}, {major!r}")
            if not (category_raw.endswith("/Master") or category_raw.endswith("/Ph.D.")) or duration not in {"2", "3", "4"}:
                raise RuntimeError(f"Malformed degree or duration on page {page_number}, row {number}: {category_raw!r}, {duration!r}")
            if not tuition.isdigit() or not faculty:
                raise RuntimeError(f"Malformed tuition or faculty on page {page_number}, row {number}")
            routes.append({
                "number": int(number),
                "page": page_number,
                "nameEn": major,
                "teachingLanguage": "English" if "English" in language_raw else "Chinese",
                "degreeLevel": "Doctoral" if "Ph.D." in category_raw else "Master",
                "durationYears": int(duration),
                "schoolOrFaculty": faculty,
                "degreeType": degree_type,
                "tuitionAmount": int(tuition),
                "campus": "Renmin St. Campus" if "Renmin" in campus else "Jingyue St. Campus" if "Jingyue" in campus else "",
                "scholarshipEligibility": {
                    "cscHighLevelGraduates": bool(compact(row[12])),
                    "cscBeltAndRoad": bool(compact(row[13])),
                    "cscTypeA": bool(compact(row[14])),
                    "internationalChineseLanguageTeachers": bool(compact(row[15])),
                    "nenuPresidential": bool(compact(row[16])),
                },
            })
            accepted += 1
        page_rows.append({"page": page_number, "routes": accepted})

numbers = [row["number"] for row in routes]
if numbers != list(range(1, 152)):
    raise RuntimeError(f"NENU route numbering is not exactly 1..151: {numbers[:5]} ... {numbers[-5:]}")
identities = [f'{row["number"]}|{row["nameEn"]}|{row["degreeLevel"]}|{row["teachingLanguage"]}' for row in routes]
if len(identities) != len(set(identities)):
    raise RuntimeError("Duplicate NENU route identity found")

result = {
    "version": 1,
    "schoolSlug": "northeast-normal-university",
    "academicYear": "2026",
    "method": "pdfplumber ruled-table extraction; all 11 rendered pages visually reviewed; numbering checked as a continuous 1-151 sequence",
    "source": {
        "id": SOURCE_ID,
        "url": source.get("finalUrl") or source["url"],
        "sha256": source["sha256"],
        "fetchedAt": source["fetchedAt"],
        "pages": 11,
    },
    "counts": {
        "total": len(routes),
        "master": sum(row["degreeLevel"] == "Master" for row in routes),
        "doctoral": sum(row["degreeLevel"] == "Doctoral" for row in routes),
        "chinese": sum(row["teachingLanguage"] == "Chinese" for row in routes),
        "english": sum(row["teachingLanguage"] == "English" for row in routes),
    },
    "pageRows": page_rows,
    "routes": routes,
}
OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"ok": True, "output": str(OUTPUT), **result["counts"], "pageRows": page_rows}, ensure_ascii=False, indent=2))
