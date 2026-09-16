"""Deterministically extract ZJU 2026 graduate program routes from reviewed official PDFs."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import pdfplumber


ROOT = Path.cwd()
PRIMARY = ROOT / "work/catalog-official/zju-complete-batch-01"
ENGLISH = ROOT / "work/catalog-official/zju-complete-batch-01-english"
OUTPUT = PRIMARY / "parsed-graduate-routes.json"

SPECS = [
    (ENGLISH, "zju-master-chinese-program-catalog-en-pdf-2026", "Master", "Chinese"),
    (ENGLISH, "zju-master-english-program-catalog-en-pdf-2026", "Master", "English"),
    (PRIMARY, "zju-doctoral-chinese-program-catalog-pdf-2026", "Doctoral", "Chinese"),
    (PRIMARY, "zju-doctoral-english-program-catalog-pdf-2026", "Doctoral", "English"),
]


def compact(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def institute_name(value: str) -> str:
    lines = [compact(line) for line in value.splitlines() if compact(line)]
    cutoff = next((index for index, line in enumerate(lines) if "http://" in line or "https://" in line), len(lines))
    return compact(" ".join(lines[:cutoff]))


def duration_value(value: str) -> float | None:
    normalized = compact(value)
    if "/" in normalized:
        return None
    match = re.search(r"\d+(?:\.\d+)?", normalized)
    return float(match.group(0)) if match else None


def tuition_value(value: str) -> tuple[int | None, str | None]:
    normalized = compact(value).replace(",", "")
    match = re.search(r"(?:RMB)?\s*(\d{4,6})", normalized, re.I)
    amount = int(match.group(1)) if match else None
    period = "program" if "whole program" in normalized.lower() else ("year" if "/year" in normalized.lower() else None)
    return amount, period


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
for directory, source_id, degree, language in SPECS:
    source = manifest_source(directory, source_id)
    pdf_path = directory / source["artifactPath"]
    current_institute = ""
    last_tuition = ""
    last_note = ""
    source_count = 0
    with pdfplumber.open(pdf_path) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            table = page.extract_table()
            if not table:
                raise RuntimeError(f"No table found in {source_id}, page {page_number}")
            for row_number, raw_row in enumerate(table, start=1):
                row = list(raw_row) + [None] * (5 - len(raw_row))
                raw_school, raw_program, raw_duration, raw_tuition, raw_note = row[:5]
                program = compact(raw_program)
                duration_text = compact(raw_duration)
                if not program or not re.search(r"\d", duration_text):
                    continue
                if compact(raw_school):
                    parsed_institute = institute_name(str(raw_school))
                    if parsed_institute:
                        current_institute = parsed_institute
                    last_tuition = ""
                    last_note = ""
                tuition_text = compact(raw_tuition) or last_tuition
                note = compact(raw_note) or last_note
                if compact(raw_tuition):
                    last_tuition = compact(raw_tuition)
                if compact(raw_note):
                    last_note = compact(raw_note)
                if not current_institute:
                    raise RuntimeError(f"Program has no institute in {source_id}, page {page_number}, row {row_number}: {program}")
                tuition_amount, tuition_period = tuition_value(tuition_text)
                deadline = "2026-05-31" if re.search(r"May\s+31", note, re.I) else "2026-02-28"
                routes.append({
                    "degree": degree,
                    "teachingLanguage": language,
                    "schoolOrDepartment": current_institute,
                    "nameEn": program,
                    "durationText": duration_text,
                    "durationYears": duration_value(duration_text),
                    "tuitionText": tuition_text,
                    "tuitionAmount": tuition_amount,
                    "tuitionPeriod": tuition_period,
                    "applicationDeadline": deadline,
                    "requirementsAndTips": note,
                    "sourceId": source_id,
                    "sourceUrl": source["url"],
                    "sourceSha256": source["sha256"],
                    "capturedAt": source["fetchedAt"],
                    "sourcePage": page_number,
                    "sourceRow": row_number,
                })
                source_count += 1
    source_summary.append({"sourceId": source_id, "pages": len(pdf.pages), "routes": source_count, "sha256": source["sha256"]})

identities = [f'{row["degree"]}|{row["teachingLanguage"]}|{row["schoolOrDepartment"]}|{row["nameEn"]}' for row in routes]
duplicates = sorted({identity for identity in identities if identities.count(identity) > 1})
suspicious = [
    {"index": index, "reason": "missing required extracted field", "route": row}
    for index, row in enumerate(routes)
    if not row["nameEn"] or not row["schoolOrDepartment"] or not row["durationText"] or not row["tuitionText"]
]
if duplicates or suspicious:
    raise RuntimeError(f"Extraction requires review: duplicates={len(duplicates)}, suspicious={len(suspicious)}")

result = {
    "version": 1,
    "schoolSlug": "zhejiang-university",
    "academicYear": "2026",
    "method": "pdfplumber ruled-table extraction plus visual review of all rendered pages",
    "sources": source_summary,
    "counts": {
        "total": len(routes),
        "master": sum(row["degree"] == "Master" for row in routes),
        "doctoral": sum(row["degree"] == "Doctoral" for row in routes),
        "chinese": sum(row["teachingLanguage"] == "Chinese" for row in routes),
        "english": sum(row["teachingLanguage"] == "English" for row in routes),
        "specialDeadline": sum(row["applicationDeadline"] == "2026-05-31" for row in routes),
    },
    "duplicateIdentities": duplicates,
    "suspiciousRows": suspicious,
    "routes": routes,
}
OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"ok": True, "output": str(OUTPUT), **result["counts"], "sources": source_summary}, ensure_ascii=False, indent=2))
