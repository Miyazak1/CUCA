from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "work" / "catalog-official" / "xmu-complete-batch-01" / "raw"
OUTPUT = ROOT / "work" / "catalog-official" / "xmu-complete-batch-01" / "parsed-programs.json"

SOURCES = [
    ("xmu-chinese-undergraduate-programs-2026", "Undergraduate", "Chinese"),
    ("xmu-english-undergraduate-programs-2026", "Undergraduate", "English"),
    ("xmu-chinese-master-programs-2026", "Master", "Chinese"),
    ("xmu-english-master-programs-2026", "Master", "English"),
    ("xmu-chinese-doctoral-programs-2026", "Doctoral", "Chinese"),
    ("xmu-english-doctoral-programs-2026", "Doctoral", "English"),
]


def clean(value: object) -> str:
    if pd.isna(value):
        return ""
    return " ".join(str(value).replace("\u00a0", " ").split())


def artifact(source_id: str) -> Path:
    matches = list(RAW.glob(f"{source_id}.*.html"))
    if len(matches) != 1:
        raise RuntimeError(f"Expected one HTML artifact for {source_id}, found {len(matches)}")
    return matches[0]


programs: list[dict[str, object]] = []
source_counts: dict[str, int] = {}
for source_id, degree, language in SOURCES:
    table = pd.read_html(artifact(source_id), header=None)[0]
    header = [clean(value) for value in table.iloc[0].tolist()]
    expected_columns = 8 if degree == "Undergraduate" else 9
    if len(header) != expected_columns or header[0] != "No." or "Programs/Majors" not in header:
        raise RuntimeError(f"Unexpected table header for {source_id}: {header}")
    rows = table.iloc[1:].reset_index(drop=True)
    sequence = [int(value) for value in rows.iloc[:, 0].tolist()]
    if sequence != list(range(1, len(rows) + 1)):
        raise RuntimeError(f"Non-contiguous official sequence for {source_id}")
    for index, row in rows.iterrows():
        if degree == "Undergraduate":
            location, school, department, name, duration_years, mode = [clean(row.iloc[i]) for i in range(1, 7)]
            code = ""
        else:
            location, school, department, code, name, duration_years, mode = [clean(row.iloc[i]) for i in range(1, 8)]
        if not all((location, school, department, name, duration_years, mode)):
            raise RuntimeError(f"Missing required field for {source_id} row {index + 2}")
        programs.append(
            {
                "catalogId": str(index + 1),
                "programCode": code,
                "name": name,
                "school": school,
                "department": department,
                "campus": location,
                "degreeLevel": degree,
                "durationYears": int(float(duration_years)),
                "teachingLanguage": language,
                "studyMode": mode,
                "sourceId": source_id,
                "sourceLocator": f"official HTML table row {index + 1}",
            }
        )
    source_counts[source_id] = len(rows)

expected = {
    "xmu-chinese-undergraduate-programs-2026": 84,
    "xmu-english-undergraduate-programs-2026": 4,
    "xmu-chinese-master-programs-2026": 195,
    "xmu-english-master-programs-2026": 20,
    "xmu-chinese-doctoral-programs-2026": 192,
    "xmu-english-doctoral-programs-2026": 40,
}
if source_counts != expected or len(programs) != 535:
    raise RuntimeError(f"XMU program counts mismatch: {source_counts}; total={len(programs)}")

counts = {
    degree: sum(row["degreeLevel"] == degree for row in programs)
    for degree in ("Undergraduate", "Master", "Doctoral")
}
language_counts = {
    degree: {
        language: sum(row["degreeLevel"] == degree and row["teachingLanguage"] == language for row in programs)
        for language in ("Chinese", "English")
    }
    for degree in counts
}
payload = {
    "version": 1,
    "sourceDirectory": os.fspath(RAW.relative_to(ROOT)).replace("\\", "/"),
    "programCount": len(programs),
    "sourceCounts": source_counts,
    "counts": counts,
    "languageCounts": language_counts,
    "programs": programs,
}
text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
OUTPUT.write_text(text, encoding="utf-8", newline="\n")
print(
    json.dumps(
        {
            "ok": True,
            "output": os.fspath(OUTPUT),
            "sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
            "programCount": len(programs),
            "sourceCounts": source_counts,
            "counts": counts,
            "languageCounts": language_counts,
        },
        indent=2,
    )
)
