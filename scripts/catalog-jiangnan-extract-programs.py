"""Extract Jiangnan University's locked 2026 international program tables."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import pandas as pd


ROOT = Path.cwd()
SPECS = [
    ("2026-10-26T06-09-30-666Z", "jiangnan-international-bachelor-en-2026", "Bachelor", [(1, "Chinese"), (2, "English")]),
    ("2026-10-26T06-09-31-330Z", "jiangnan-international-master-en-2026", "Master", [(0, "English"), (1, "Chinese")]),
    ("2026-10-26T06-09-33-388Z", "jiangnan-international-phd-en-2026", "Doctoral", [(0, "English"), (1, "Chinese")]),
]
OUTPUT = ROOT / "catalog-sources/jiangnan-2026-programs.extracted.json"


def compact(value) -> str:
    return re.sub(r"\s+", " ", "" if pd.isna(value) else str(value)).strip()


def clean_school(value) -> str:
    value = compact(value)
    value = re.sub(r"https?://.*$", "", value).strip()
    return value.replace("School of artificial intelligence and computer science", "School of Artificial Intelligence and Computer Science")


def clean_major(value) -> str:
    value = compact(value)
    replacements = {
        "Food Science &Engineering": "Food Science & Engineering",
        "Chemistry Technology & Engineering": "Chemical Engineering & Technology",
        "Environment Science & Engineering": "Environmental Science & Engineering",
        "Te xtile Science and Engineering": "Textile Science & Engineering",
        "Intelligence Science and Technology": "Intelligent Science & Technology",
    }
    return replacements.get(value, value)


routes = []
sources = []
for run, source_id, degree, table_specs in SPECS:
    run_root = ROOT / "work/catalog-official" / run
    manifest = json.loads((run_root / "manifest.json").read_text(encoding="utf-8"))
    matches = [row for row in manifest["sources"] if row["id"] == source_id]
    if len(matches) != 1 or matches[0]["status"] != 200 or matches[0]["contentType"] != "text/html":
        raise RuntimeError(f"Missing locked source {source_id}")
    source = matches[0]
    artifact = run_root / source["artifactPath"]
    if hashlib.sha256(artifact.read_bytes()).hexdigest() != source["sha256"]:
        raise RuntimeError(f"Evidence hash mismatch: {source_id}")
    tables = pd.read_html(artifact)
    source_count = 0
    for table_index, language in table_specs:
        table = tables[table_index]
        for row_index, row in table.iloc[1:].iterrows():
            school = clean_school(row.iloc[0])
            major = clean_major(row.iloc[1])
            duration = compact(row.iloc[2])
            if not school or not major or duration not in {"3", "4"}:
                raise RuntimeError(f"Malformed {source_id} table {table_index}, row {row_index}: {list(row)}")
            item = {
                "degreeLevel": degree,
                "teachingLanguage": language,
                "schoolOrFaculty": school,
                "nameEn": major,
                "durationYears": int(duration),
                "sourceId": source_id,
                "table": table_index,
                "sourceRow": int(row_index) + 1,
            }
            if degree == "Bachelor":
                item["cscaSubjects"] = [part.strip() for part in compact(row.iloc[3]).replace(" and ", ", ").split(",") if part.strip()]
                item["campus"] = compact(row.iloc[4]).replace("Xiake Wan", "Xiakewan")
                item["tuitionBand"] = "CNY 14,800/year for Liberal Arts or CNY 16,400/year for Design, Science & Engineering; the source does not map every major to a fee category."
            else:
                item["tuitionAmount"] = int(compact(row.iloc[3]))
            routes.append(item)
            source_count += 1
    sources.append({"id": source_id, "sha256": source["sha256"], "url": source.get("finalUrl") or source["url"], "fetchedAt": source["fetchedAt"], "routes": source_count})

identities = [f'{row["degreeLevel"]}|{row["teachingLanguage"]}|{row["schoolOrFaculty"]}|{row["nameEn"]}' for row in routes]
duplicates = sorted({identity for identity in identities if identities.count(identity) > 1})
if duplicates:
    raise RuntimeError(f"Duplicate route identities: {duplicates}")
expected = {"Bachelor": 52, "Master": 50, "Doctoral": 27}
actual = {degree: sum(row["degreeLevel"] == degree for row in routes) for degree in expected}
if actual != expected:
    raise RuntimeError(f"Unexpected route counts: {actual}")

result = {
    "version": 1,
    "schoolSlug": "jiangnan-university",
    "academicYear": "2026",
    "method": "pandas/lxml extraction from official English HTML tables with locked source hashes and exact expected row counts",
    "sources": sources,
    "counts": {"total": len(routes), **actual, "Chinese": sum(row["teachingLanguage"] == "Chinese" for row in routes), "English": sum(row["teachingLanguage"] == "English" for row in routes)},
    "duplicateIdentities": duplicates,
    "routes": routes,
}
OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"ok": True, "output": str(OUTPUT), **result["counts"], "sources": sources}, ensure_ascii=False, indent=2))
