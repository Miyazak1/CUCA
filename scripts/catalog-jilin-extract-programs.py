from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from pathlib import Path

import pdfplumber


ROOT = Path(__file__).resolve().parents[1]
RUN_DIR = ROOT / "work" / "catalog-official" / "jilin-graduate-catalog-batch-01"
MANIFEST_PATH = RUN_DIR / "manifest.json"
OUTPUT_PATH = RUN_DIR / "parsed-programs.json"
SOURCE_ID = "jilin-high-level-graduate-program-catalog-2026"


def clean(value: object) -> str:
    text = unicodedata.normalize("NFKC", str(value or ""))
    return re.sub(r"\s+", " ", text).strip()


def split_bilingual(value: object) -> tuple[str, str]:
    text = clean(value)
    match = re.search(r"[A-Za-z]", text)
    if not match:
        return text, ""
    chinese = text[: match.start()].strip(" -–—/()（）")
    english = text[match.start() :]
    english = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", english)
    english = re.sub(r"(?<=[A-Za-z])(of|and|in|for|to)(?=[A-Z])", r" \1 ", english)
    english = clean(english)
    return chinese, english


manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
source = next(row for row in manifest["sources"] if row["id"] == SOURCE_ID)
pdf_path = RUN_DIR / source["artifactPath"]
if hashlib.sha256(pdf_path.read_bytes()).hexdigest() != source["sha256"]:
    raise RuntimeError("Jilin graduate catalog PDF hash does not match its manifest.")

programs: list[dict[str, object]] = []
section = None
current_college = ("", "")
with pdfplumber.open(pdf_path) as pdf:
    if len(pdf.pages) != 8:
        raise RuntimeError(f"Expected 8 pages, found {len(pdf.pages)}.")
    for page_number, page in enumerate(pdf.pages, start=1):
        if page_number == 1:
            section = ("Master", "Chinese")
            current_college = ("", "")
        elif page_number == 4:
            section = ("Master", "English")
            current_college = ("", "")
        elif page_number == 6:
            section = ("Doctoral", "Chinese")
            current_college = ("", "")
        elif page_number == 8:
            section = ("Doctoral", "English")
            current_college = ("", "")

        for panel_number, bounds in enumerate(
            [(0, 0, page.width / 2, page.height), (page.width / 2, 0, page.width, page.height)],
            start=1,
        ):
            tables = page.crop(bounds).extract_tables()
            for table_number, table in enumerate(tables, start=1):
                for row_number, row in enumerate(table, start=1):
                    if len(row) < 3:
                        continue
                    duration_text = clean(row[-1])
                    if duration_text not in {"2", "3", "4"}:
                        continue
                    college_cell, major_cell = row[0], row[1]
                    if clean(college_cell):
                        current_college = split_bilingual(college_cell)
                    if page_number == 6 and panel_number == 2 and row_number == 1 and not clean(major_cell):
                        major_cell = "东北亚区域国别经济 Area Studies in Economics of Northeast Asia"
                    if not current_college[0] and not current_college[1]:
                        raise RuntimeError(f"Missing college lineage on page {page_number}, row {row_number}.")
                    major_zh, major_en = split_bilingual(major_cell)
                    if not major_en:
                        raise RuntimeError(f"Missing English major name on page {page_number}, row {row_number}: {major_cell!r}")
                    degree_level, teaching_language = section
                    programs.append(
                        {
                            "catalogId": len(programs) + 1,
                            "degreeLevel": degree_level,
                            "teachingLanguage": teaching_language,
                            "collegeZh": current_college[0],
                            "collegeEn": current_college[1],
                            "nameZh": major_zh,
                            "nameEn": major_en,
                            "durationYears": int(duration_text),
                            "studyMode": "Full-time",
                            "sourceId": SOURCE_ID,
                            "sourceLocator": f"PDF page {page_number}, panel {panel_number}, table {table_number}, row {row_number}",
                        }
                    )

counts: dict[str, int] = {}
for program in programs:
    key = f"{program['degreeLevel']}:{program['teachingLanguage']}"
    counts[key] = counts.get(key, 0) + 1

expected = {
    "Master:Chinese": 102,
    "Master:English": 41,
    "Doctoral:Chinese": 67,
    "Doctoral:English": 34,
}
if counts != expected or len(programs) != 244:
    raise RuntimeError(f"Unexpected Jilin program counts: {counts}, total={len(programs)}")

identities = [
    (p["degreeLevel"], p["teachingLanguage"], p["collegeEn"], p["nameZh"], p["nameEn"])
    for p in programs
]
if len(identities) != len(set(identities)):
    duplicates = sorted({identity for identity in identities if identities.count(identity) > 1})
    raise RuntimeError(f"Duplicate official program identities: {duplicates}")

payload = {
    "version": 1,
    "schoolSlug": "jilin-university",
    "sourceId": SOURCE_ID,
    "sourceSha256": source["sha256"],
    "capturedAt": source["fetchedAt"],
    "programCount": len(programs),
    "counts": counts,
    "coverageNote": "Exact routes in the official 2026/2027 Chinese Government Scholarship High-level Graduate program catalog; this is a verified subset of the broader self-funded catalog.",
    "programs": programs,
}
OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"ok": True, "output": str(OUTPUT_PATH), "programCount": len(programs), "counts": counts}, ensure_ascii=False, indent=2))
