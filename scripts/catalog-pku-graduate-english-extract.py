"""Extract PKU 2026 English-taught graduate majors from reviewed official PDFs.

The official tables group multiple research fields under a single major. This
extractor preserves that shape: one catalog program per major, with research
fields retained as supporting detail rather than expanded into fake programs.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import pdfplumber


ROOT = Path.cwd()
SOURCE_ROOT = ROOT / "work/catalog-official/pku-graduate-english-departments-20260914"
OUTPUT = SOURCE_ROOT / "parsed-major-routes.json"


def compact(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def english_text(value: str) -> str:
    """Prefer parenthesized ASCII text because the PDF's Chinese font map is broken."""
    ascii_only = re.sub(r"[^\x20-\x7E]", " ", value)
    ascii_only = re.sub(
        r"\(\s*([0-9A-Z]{6})\s*\)",
        lambda match: " " if re.search(r"\d", match.group(1)) else match.group(0),
        ascii_only,
        flags=re.I,
    )
    result = compact(ascii_only)
    if result.startswith("(") and result.endswith(")"):
        result = result[1:-1].strip()
    result = result.replace("Populatio n", "Population").replace("Mediu m", "Medium")
    if "Number theory: Arithmetic Geometry and P-adic Cohomology" in result:
        result = "Number Theory: Arithmetic Geometry and P-adic Cohomology"
    if "Noncommutative Geometry, Operator Algebras, K-theory, Index Theory" in result:
        result = "Noncommutative Geometry, Operator Algebras, K-theory, and Index Theory"
    return result


def extract_code(value: str) -> str:
    matches = re.findall(r"(?<![0-9A-Z])([0-9A-Z]{6})(?![0-9A-Z])", value, flags=re.I)
    codes = [match.upper() for match in matches if re.search(r"\d", match)]
    return codes[-1] if codes else ""


def source_from_manifest(directory: Path) -> tuple[dict, Path]:
    manifest_text = (directory / "manifest.json").read_text(encoding="utf-8")
    manifest = json.loads(manifest_text)
    matches = [row for row in manifest.get("sources", []) if row.get("status") == 200]
    if len(matches) != 1 or matches[0].get("contentType") != "application/pdf":
        raise RuntimeError(f"Expected one locked PDF source in {directory.name}")
    source = matches[0]
    artifact = directory / source["artifactPath"]
    if hashlib.sha256(artifact.read_bytes()).hexdigest() != source["sha256"]:
        raise RuntimeError(f"PDF bytes changed after collection: {source['id']}")
    source["manifestSha256"] = hashlib.sha256(manifest_text.encode()).hexdigest()
    return source, artifact


routes: list[dict] = []
source_summary: list[dict] = []
for directory in sorted(path for path in SOURCE_ROOT.iterdir() if path.is_dir()):
    manifest_path = directory / "manifest.json"
    if not manifest_path.exists():
        continue
    source, pdf_path = source_from_manifest(directory)
    degree = "Master" if source["id"].startswith("pku-master-") else "PhD"
    department = re.sub(r"^PKU 2026 English-taught .*? catalog - ", "", source["label"], flags=re.I)
    source_route_count = 0
    with pdfplumber.open(pdf_path) as pdf:
        current: dict | None = None
        for page_number, page in enumerate(pdf.pages, start=1):
            tables = page.extract_tables()
            if not tables:
                raise RuntimeError(f"No table found in {source['id']}, page {page_number}")
            for table_number, table in enumerate(tables, start=1):
                for row_number, raw in enumerate(table, start=1):
                    row = list(raw or []) + [None] * 4
                    major_cell, field_cell, mode_cell, language_cell = [compact(value) for value in row[:4]]
                    if major_cell and extract_code(major_cell):
                        if current:
                            routes.append(current)
                            source_route_count += 1
                        current = {
                            "code": extract_code(major_cell),
                            "degree": degree,
                            "schoolOrDepartment": department,
                            "nameEn": english_text(major_cell),
                            "teachingLanguage": language_cell or "English",
                            "modes": [],
                            "researchFields": [],
                            "sourceId": source["id"],
                            "sourceUrl": source["finalUrl"],
                            "sourceLabel": source["label"],
                            "sourceSha256": source["sha256"],
                            "capturedAt": source["fetchedAt"],
                            "sourcePage": page_number,
                            "sourceTable": table_number,
                            "sourceRow": row_number,
                        }
                    if current:
                        if mode_cell and mode_cell not in current["modes"]:
                            current["modes"].append(mode_cell)
                        if language_cell and current["teachingLanguage"] != language_cell:
                            raise RuntimeError(f"Mixed teaching languages inside one major: {source['id']} {current['code']}")
                        if field_cell:
                            field_name = english_text(re.sub(r"^\d+\.\s*", "", field_cell))
                            if field_name and field_name not in current["researchFields"]:
                                current["researchFields"].append(field_name)
        if current:
            routes.append(current)
            source_route_count += 1
    source_summary.append({
        "sourceId": source["id"],
        "sourceUrl": source["finalUrl"],
        "sourceLabel": source["label"],
        "sha256": source["sha256"],
        "manifestSha256": source["manifestSha256"],
        "capturedAt": source["fetchedAt"],
        "pages": len(pdf.pages),
        "routes": source_route_count,
    })

merged: dict[str, dict] = {}
for row in routes:
    identity = f'{row["degree"]}|{row["code"]}|{row["schoolOrDepartment"]}'
    prior = merged.get(identity)
    if not prior:
        merged[identity] = row
        continue
    same_name = re.sub(r"[^a-z0-9]", "", prior["nameEn"].lower()) == re.sub(r"[^a-z0-9]", "", row["nameEn"].lower())
    if not same_name or prior["teachingLanguage"] != row["teachingLanguage"]:
        raise RuntimeError(f"Conflicting continued major across PDF pages: {identity}: {prior['nameEn']!r} vs {row['nameEn']!r}")
    for key in ("modes", "researchFields"):
        prior[key].extend(value for value in row[key] if value not in prior[key])
routes = list(merged.values())
bad = [row for row in routes if not row["nameEn"] or not row["researchFields"] or row["teachingLanguage"] != "English"]
if bad:
    raise RuntimeError(f"Extraction needs review: bad={json.dumps(bad, ensure_ascii=False)}")

result = {
    "version": 1,
    "schoolSlug": "peking-university",
    "academicYear": "2026",
    "method": "pdfplumber ruled-table extraction, grouped by major code; all rendered pages visually reviewed",
    "sources": source_summary,
    "counts": {
        "sources": len(source_summary),
        "pages": sum(row["pages"] for row in source_summary),
        "routes": len(routes),
        "master": sum(row["degree"] == "Master" for row in routes),
        "doctoral": sum(row["degree"] == "PhD" for row in routes),
    },
    "routes": routes,
}
OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"ok": True, "output": str(OUTPUT), **result["counts"]}, ensure_ascii=False, indent=2))
