import hashlib
import json
import re
from pathlib import Path

import pdfplumber

ROOT = Path.cwd()
WORK = ROOT / "work" / "catalog-official"
OUTPUT = WORK / "sdu-complete-batch-01" / "parsed-routes.json"

SOURCES = {
    "sdu-international-undergraduate-programs-en-2026": {
        "sha256": "62746aa06b4f6eaaefbfcf80a84aee000c12ccf1fde9afc8491adfe2581380da",
        "degree": "Undergraduate",
        "english_start_page": 1,
    },
    "sdu-international-master-programs-en-2026": {
        "sha256": "98aa9be40d42464b256eaec363bb47b5c273ddb6c4d21a5d2b72e5cf2970b961",
        "degree": "Master",
        "english_start_page": 2,
    },
    "sdu-international-doctoral-programs-en-2026": {
        "sha256": "3ff18e063946515c27556ad8e3c7d477d0da707ab130ebf6d97bab2414e115d1",
        "degree": "Doctoral",
        "english_start_page": 2,
    },
}


def clean(value):
    return re.sub(r"\s+", " ", value or "").strip()


def locate(source_id, expected_sha):
    matches = []
    for manifest_path in WORK.glob("*/manifest.json"):
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        for source in manifest.get("sources", []):
            if source.get("id") == source_id and source.get("status") == 200:
                if source.get("sha256") != expected_sha:
                    raise RuntimeError(f"Hash mismatch for {source_id}: {source.get('sha256')}")
                path = manifest_path.parent / source["artifactPath"]
                if hashlib.sha256(path.read_bytes()).hexdigest() != expected_sha:
                    raise RuntimeError(f"Artifact changed for {source_id}")
                matches.append((source, path))
    if not matches:
        raise RuntimeError(f"Missing source {source_id}")
    return matches[-1]


def extract(source_id, config):
    source, path = locate(source_id, config["sha256"])
    routes = []
    school = ""
    campus = ""
    with pdfplumber.open(path) as pdf:
        for page_index, page in enumerate(pdf.pages):
            tables = page.extract_tables()
            if len(tables) != 1:
                raise RuntimeError(f"Expected one table on {source_id} page {page_index + 1}")
            rows = tables[0]
            if not rows or clean(rows[0][0]) != "School/College":
                raise RuntimeError(f"Unexpected header on {source_id} page {page_index + 1}")
            language = "English" if page_index >= config["english_start_page"] else "Chinese"
            for row_index, row in enumerate(rows[1:], start=2):
                if len(row) != 5:
                    raise RuntimeError(f"Unexpected column count on {source_id} page {page_index + 1} row {row_index}")
                row_school, row_campus, name, length, tuition = map(clean, row)
                if not length and not tuition and routes and (row_school or row_campus or name):
                    routes[-1]["fieldCategory"] = clean(f'{routes[-1]["fieldCategory"]} {row_school}')
                    routes[-1]["campus"] = clean(f'{routes[-1]["campus"]} {row_campus}')
                    routes[-1]["nameEn"] = clean(f'{routes[-1]["nameEn"]} {name}')
                    school = routes[-1]["fieldCategory"]
                    campus = routes[-1]["campus"]
                    continue
                school = row_school or school
                campus = row_campus or campus
                if not name and not length and not tuition:
                    continue
                years = re.fullmatch(r"(\d+) years?", length)
                amount = re.fullmatch(r"([\d,，]+)", tuition)
                if not school or not campus or not name or not years or not amount:
                    raise RuntimeError(f"Incomplete route on {source_id} page {page_index + 1} row {row_index}: {row}")
                routes.append({
                    "degree": config["degree"],
                    "nameEn": name,
                    "fieldCategory": school,
                    "campus": campus,
                    "teachingLanguage": language,
                    "durationYears": int(years.group(1)),
                    "tuitionAmount": int(amount.group(1).replace(",", "").replace("，", "")),
                    "sourceId": source_id,
                    "sourcePage": page_index + 1,
                    "sourceRow": row_index,
                })
    return source, routes


all_routes = []
locks = []
for source_id, config in SOURCES.items():
    source, routes = extract(source_id, config)
    all_routes.extend(routes)
    locks.append({
        "id": source_id,
        "sha256": source["sha256"],
        "fetchedAt": source["fetchedAt"],
        "url": source["url"],
    })

counts = {
    "undergraduate": sum(route["degree"] == "Undergraduate" for route in all_routes),
    "master": sum(route["degree"] == "Master" for route in all_routes),
    "doctoral": sum(route["degree"] == "Doctoral" for route in all_routes),
    "chinese": sum(route["teachingLanguage"] == "Chinese" for route in all_routes),
    "english": sum(route["teachingLanguage"] == "English" for route in all_routes),
    "total": len(all_routes),
}
expected_counts = {"undergraduate": 20, "master": 58, "doctoral": 65, "chinese": 68, "english": 75, "total": 143}
if counts != expected_counts:
    raise RuntimeError(f"Unexpected counts: {counts}")

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
payload = {"version": 1, "sourceLocks": locks, "counts": counts, "routes": all_routes}
OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"ok": True, "output": str(OUTPUT), "counts": counts}, ensure_ascii=False, indent=2))
