"""Extract SWJTU's locked official international graduate program PDFs."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import pdfplumber


ROOT = Path.cwd()
RUN = ROOT / "work/catalog-official/2026-10-27T06-19-53-740Z"
OUTPUT = ROOT / "catalog-sources/swjtu-current-graduate-programs.extracted.json"
SOURCES = {
    "Master": {
        "id": "swjtu-master-program-catalog-current",
        "sha256": "658a9fd108713bb2918d0787428eaee6365207e5de4da880080525e1d1fedfc9",
        "pages": 2,
    },
    "Doctoral": {
        "id": "swjtu-doctoral-program-catalog-current",
        "sha256": "08143ae358c40d9e812afd4b9ad8f55ee084b18671896ec6d81da58ce0027f56",
        "pages": 1,
    },
}


def compact(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def strip_number(value: str) -> str:
    return re.sub(r"^\s*\d+[.．、]?\s*", "", value).strip()


manifest = json.loads((RUN / "manifest.json").read_text(encoding="utf-8"))
manifest_sources = {row["id"]: row for row in manifest["sources"]}
routes: list[dict] = []
source_summaries: list[dict] = []

for degree_level, config in SOURCES.items():
    source = manifest_sources.get(config["id"])
    if not source or source["status"] != 200 or source["contentType"] != "application/pdf":
        raise RuntimeError(f"Missing locked SWJTU {degree_level} PDF evidence")
    artifact = RUN / source["artifactPath"]
    actual_sha256 = hashlib.sha256(artifact.read_bytes()).hexdigest()
    if actual_sha256 != config["sha256"] or actual_sha256 != source["sha256"]:
        raise RuntimeError(f"SWJTU {degree_level} PDF hash mismatch")

    accepted = 0
    current_faculty_zh = ""
    current_faculty_en = ""
    with pdfplumber.open(artifact) as pdf:
        if len(pdf.pages) != config["pages"]:
            raise RuntimeError(f"Expected {config['pages']} {degree_level} pages, found {len(pdf.pages)}")
        for page_number, page in enumerate(pdf.pages, start=1):
            tables = page.extract_tables()
            if len(tables) != 1:
                raise RuntimeError(f"Expected one table on {degree_level} page {page_number}, found {len(tables)}")
            for raw_row in tables[0]:
                row = list(raw_row) + [None] * (5 - len(raw_row))
                name_zh = strip_number(compact(row[2]))
                name_en = strip_number(compact(row[3]))
                language_raw = compact(row[4])
                if not name_en or "Major Name in English" in name_en or "Program Major Information" in compact(row[0]):
                    continue
                if row[1]:
                    faculty_lines = [compact(part) for part in row[1].split("\n") if compact(part)]
                    english_start = next((index for index, part in enumerate(faculty_lines) if re.search(r"[A-Za-z]", part)), len(faculty_lines))
                    current_faculty_zh = compact(" ".join(faculty_lines[:english_start]))
                    current_faculty_en = compact(" ".join(faculty_lines[english_start:]))
                if not current_faculty_en and not current_faculty_zh:
                    raise RuntimeError(f"Missing faculty for {degree_level} route {name_en!r}")
                if "Chinese and English" in language_raw:
                    teaching_language = "Chinese and English"
                elif language_raw.endswith("/English"):
                    teaching_language = "English"
                elif language_raw.endswith("/Chinese"):
                    teaching_language = "Chinese"
                else:
                    raise RuntimeError(f"Unsupported language for {degree_level} route {name_en!r}: {language_raw!r}")
                routes.append({
                    "degreeLevel": degree_level,
                    "page": page_number,
                    "nameZh": name_zh,
                    "nameEn": name_en,
                    "facultyZh": current_faculty_zh,
                    "facultyEn": current_faculty_en,
                    "teachingLanguage": teaching_language,
                })
                accepted += 1

    source_summaries.append({
        "id": source["id"],
        "url": source.get("finalUrl") or source["url"],
        "sha256": source["sha256"],
        "fetchedAt": source["fetchedAt"],
        "pages": config["pages"],
        "routes": accepted,
    })

identities = [f'{row["degreeLevel"]}|{row["facultyEn"] or row["facultyZh"]}|{row["nameZh"]}|{row["nameEn"]}|{row["teachingLanguage"]}' for row in routes]
if len(identities) != len(set(identities)):
    raise RuntimeError("Duplicate SWJTU graduate route identity found")
if not routes or any(not row["nameEn"] or not (row["facultyEn"] or row["facultyZh"]) for row in routes):
    raise RuntimeError("Incomplete SWJTU graduate extraction")

result = {
    "version": 1,
    "schoolSlug": "southwest-jiaotong-university",
    "sourceCatalogYear": 2025,
    "currentGuideAcademicYear": "2026-2027",
    "method": "pdfplumber ruled-table extraction from the exact official PDFs linked by the current 2026-2027 guides; source catalog year remains 2025 and is not relabeled",
    "sources": source_summaries,
    "counts": {
        "total": len(routes),
        "master": sum(row["degreeLevel"] == "Master" for row in routes),
        "doctoral": sum(row["degreeLevel"] == "Doctoral" for row in routes),
    },
    "routes": routes,
}
OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"ok": True, "output": str(OUTPUT), **result["counts"]}, ensure_ascii=False, indent=2))
