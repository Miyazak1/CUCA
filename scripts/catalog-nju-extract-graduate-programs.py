"""Deterministically extract NJU 2026 graduate routes from reviewed official PDFs."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import pdfplumber


ROOT = Path.cwd()
PRIMARY = ROOT / "work/catalog-official/nju-complete-batch-02"
ENGLISH = ROOT / "work/catalog-official/nju-complete-batch-02-en"
OUTPUT = PRIMARY / "parsed-graduate-routes.json"
SPECS = [
    (ENGLISH, "nanjing-university-master-catalog-en-pdf-2026", "Master"),
    (PRIMARY, "nanjing-university-doctoral-catalog-pdf-2026", "Doctoral"),
]


def compact(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def manifest_source(directory: Path, source_id: str) -> dict:
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    matches = [row for row in manifest["sources"] if row["id"] == source_id]
    if len(matches) != 1 or matches[0]["status"] != 200 or matches[0]["contentType"] != "application/pdf":
        raise RuntimeError(f"Missing locked PDF evidence for {source_id}")
    source = matches[0]
    artifact = directory / source["artifactPath"]
    if hashlib.sha256(artifact.read_bytes()).hexdigest() != source["sha256"]:
        raise RuntimeError(f"PDF bytes changed after collection: {source_id}")
    return source


routes: list[dict] = []
source_summary: list[dict] = []
for directory, source_id, degree in SPECS:
    source = manifest_source(directory, source_id)
    pdf_path = directory / source["artifactPath"]
    source_count = 0
    with pdfplumber.open(pdf_path) as pdf:
        page_count = len(pdf.pages)
        for page_number, page in enumerate(pdf.pages, start=1):
            table = page.extract_table()
            if not table:
                raise RuntimeError(f"No table found in {source_id}, page {page_number}")
            for row_number, raw_row in enumerate(table, start=1):
                row = list(raw_row) + [None] * (6 - len(raw_row))
                code, school, major, language, duration, notes = [compact(value) for value in row[:6]]
                if not re.fullmatch(r"[0-9A-Z]{6}", code, re.I):
                    continue
                if not school or not major or language not in {"Chinese", "English"} or not re.fullmatch(r"\d+(?:\.\d+)?", duration):
                    raise RuntimeError(f"Malformed route in {source_id}, page {page_number}, row {row_number}: {row[:6]}")
                duration_number = float(duration)
                routes.append({
                    "code": code,
                    "degree": degree,
                    "schoolOrDepartment": school,
                    "nameEn": major,
                    "teachingLanguage": language,
                    "durationText": duration,
                    "durationYears": int(duration_number) if duration_number.is_integer() else duration_number,
                    "requirementsAndTips": notes,
                    "applicationDeadline": "2026-05-20",
                    "sourceId": source_id,
                    "sourceUrl": source["url"],
                    "sourceSha256": source["sha256"],
                    "capturedAt": source["fetchedAt"],
                    "sourcePage": page_number,
                    "sourceRow": row_number,
                })
                source_count += 1
    source_summary.append({"sourceId": source_id, "pages": page_count, "routes": source_count, "sha256": source["sha256"]})

identities = [f'{row["degree"]}|{row["code"]}|{row["teachingLanguage"]}|{row["schoolOrDepartment"]}|{row["nameEn"]}' for row in routes]
duplicates = sorted({identity for identity in identities if identities.count(identity) > 1})
suspicious = [
    {"index": index, "reason": "missing required extracted field", "route": row}
    for index, row in enumerate(routes)
    if not row["code"] or not row["nameEn"] or not row["schoolOrDepartment"] or not row["durationText"]
]
if duplicates or suspicious:
    raise RuntimeError(f"Extraction requires review: duplicates={len(duplicates)}, suspicious={len(suspicious)}")

result = {
    "version": 1,
    "schoolSlug": "nanjing-university",
    "academicYear": "2026",
    "method": "pdfplumber ruled-table extraction plus visual review of all 20 rendered pages",
    "sources": source_summary,
    "counts": {
        "total": len(routes),
        "master": sum(row["degree"] == "Master" for row in routes),
        "doctoral": sum(row["degree"] == "Doctoral" for row in routes),
        "chinese": sum(row["teachingLanguage"] == "Chinese" for row in routes),
        "english": sum(row["teachingLanguage"] == "English" for row in routes),
    },
    "duplicateIdentities": duplicates,
    "suspiciousRows": suspicious,
    "routes": routes,
}
OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"ok": True, "output": str(OUTPUT), **result["counts"], "sources": source_summary}, ensure_ascii=False, indent=2))
