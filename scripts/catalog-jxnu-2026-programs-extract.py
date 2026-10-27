"""Extract the locked JXNU current international major catalog deterministically."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import pdfplumber


ROOT = Path.cwd()
RUN = ROOT / "work/catalog-official/2026-10-26T10-36-36-884Z"
SOURCE_ID = "jxnu-international-major-catalog-pdf-current"
EXPECTED_SHA256 = "f2834b39363eab6b58e700eb2be16d3eacd60bcac9c17a69706dc1bae2876c23"
OUTPUT = ROOT / "catalog-sources/jxnu-2026-programs.extracted.json"


def compact(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def ascii_text(value: str | None) -> str:
    return compact(re.sub(r"[^\x20-\x7e\n]", "", value or ""))


def program_name(value: str | None) -> str:
    raw = re.split(r"\n\s*0?1(?:\s|$)", value or "", maxsplit=1)[0]
    cleaned = ascii_text(raw)
    cleaned = cleaned.replace("()", "").replace("(taught in English", "")
    cleaned = cleaned.replace("taught in English", "")
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" /")
    return cleaned


def faculty_name(value: str | None) -> str:
    lines = [ascii_text(line) for line in (value or "").splitlines()]
    lines = [line for line in lines if line and "Website" not in line and not line.startswith("http") and "professional" not in line and "degree programs" not in line and line != "Faculty"]
    return compact(" ".join(lines))


manifest = json.loads((RUN / "manifest.json").read_text(encoding="utf-8"))
matches = [row for row in manifest["sources"] if row["id"] == SOURCE_ID]
if len(matches) != 1 or matches[0]["status"] != 200 or matches[0]["contentType"] != "application/pdf":
    raise RuntimeError("Missing locked JXNU program PDF evidence")
source = matches[0]
artifact = RUN / source["artifactPath"]
actual_sha256 = hashlib.sha256(artifact.read_bytes()).hexdigest()
if actual_sha256 != EXPECTED_SHA256 or source["sha256"] != EXPECTED_SHA256:
    raise RuntimeError("JXNU program PDF changed after collection")

routes: list[dict] = []
page_rows: list[dict] = []
current_faculty = ""
with pdfplumber.open(artifact) as pdf:
    if len(pdf.pages) != 10:
        raise RuntimeError(f"Expected 10 JXNU catalog pages, found {len(pdf.pages)}")
    for page_number, page in enumerate(pdf.pages, start=1):
        tables = page.extract_tables()
        if len(tables) != 1:
            raise RuntimeError(f"Expected one table on page {page_number}, found {len(tables)}")
        accepted = 0
        for row_number, raw_row in enumerate(tables[0]):
            row = list(raw_row) + [None] * (4 - len(raw_row))
            level_raw = ascii_text(row[2])
            duration_raw = ascii_text(row[3])
            if level_raw == "Level" or not any(token in level_raw for token in ("Undergraduate", "Master", "Ph.D.", "General Scholar")):
                continue
            name = program_name(row[1])
            if not name or not duration_raw:
                continue
            parsed_faculty = faculty_name(row[0])
            if parsed_faculty:
                current_faculty = parsed_faculty
            if page_number == 4 and row_number == 14:
                current_faculty = "Music"
            if page_number == 6 and row_number == 9:
                current_faculty = "Foreign Languages"
            if not current_faculty:
                raise RuntimeError(f"Missing faculty on page {page_number}, row {row_number}")
            degree = "Bachelor" if "Undergraduate" in level_raw else "Doctoral" if "Ph.D." in level_raw else "Non-degree" if "General Scholar" in level_raw else "Master"
            duration_years = 0.5 if duration_raw == "0.5/1" else float(duration_raw)
            teaching_language = "English" if degree == "Bachelor" and name in {
                "Business Administration",
                "International Economics and Trade",
                "Computer Science and Technology",
            } else "Chinese"
            routes.append({
                "page": page_number,
                "row": row_number,
                "nameEn": name,
                "degreeLevel": degree,
                "durationYears": int(duration_years) if duration_years.is_integer() else duration_years,
                "durationText": "0.5/1 year" if duration_raw == "0.5/1" else f"{duration_raw} years",
                "schoolOrFaculty": current_faculty,
                "teachingLanguage": teaching_language,
            })
            accepted += 1
        page_rows.append({"page": page_number, "routes": accepted})

deduplicated: list[dict] = []
seen: set[str] = set()
duplicate_rows: list[dict] = []
for route in routes:
    identity = f'{route["schoolOrFaculty"]}|{route["nameEn"]}|{route["degreeLevel"]}|{route["durationText"]}'
    if route["page"] == 10 and route["schoolOrFaculty"] == "Mathematics and Statistics" and identity in seen:
        duplicate_rows.append({"page": route["page"], "row": route["row"], "identity": identity})
        continue
    if identity not in seen:
        seen.add(identity)
    deduplicated.append(route)

if len(duplicate_rows) != 6 or {row["page"] for row in duplicate_rows} != {10}:
    raise RuntimeError(f"Expected exactly six repeated page-10 mathematics rows, found {duplicate_rows}")
if any(not route["nameEn"] or not route["schoolOrFaculty"] for route in deduplicated):
    raise RuntimeError("Empty JXNU route identity found")

result = {
    "version": 1,
    "schoolSlug": "jiangxi-normal-university",
    "academicYear": "current catalog captured in 2026; not relabeled as 2027",
    "method": "pdfplumber ruled-table extraction; all 10 rendered pages visually reviewed; cross-page Music and Foreign Languages faculty cells restored from the rendered layout; six repeated page-10 Mathematics and Statistics rows removed",
    "source": {
        "id": SOURCE_ID,
        "url": source.get("finalUrl") or source["url"],
        "sha256": source["sha256"],
        "fetchedAt": source["fetchedAt"],
        "pages": 10,
    },
    "counts": {
        "raw": len(routes),
        "duplicatesRemoved": len(duplicate_rows),
        "total": len(deduplicated),
        "bachelor": sum(row["degreeLevel"] == "Bachelor" for row in deduplicated),
        "master": sum(row["degreeLevel"] == "Master" for row in deduplicated),
        "doctoral": sum(row["degreeLevel"] == "Doctoral" for row in deduplicated),
        "nonDegree": sum(row["degreeLevel"] == "Non-degree" for row in deduplicated),
        "chinese": sum(row["teachingLanguage"] == "Chinese" for row in deduplicated),
        "english": sum(row["teachingLanguage"] == "English" for row in deduplicated),
    },
    "pageRows": page_rows,
    "duplicateRows": duplicate_rows,
    "routes": deduplicated,
}
OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"ok": True, "output": str(OUTPUT), **result["counts"], "pageRows": page_rows}, ensure_ascii=False, indent=2))
