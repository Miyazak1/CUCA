from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "work" / "catalog-official" / "tju-complete-batch-01" / "raw"
OUTPUT = ROOT / "work" / "catalog-official" / "tju-complete-batch-01" / "parsed-programs.json"

SOURCES = {
    "Undergraduate": "tju-undergraduate-program-catalog-2026",
    "Master": "tju-master-program-catalog-2026",
    "Doctoral": "tju-doctoral-program-catalog-2026",
}


def find_source(source_id: str) -> Path:
    matches = sorted(RAW.glob(f"{source_id}.*"))
    if len(matches) != 1:
        raise RuntimeError(f"Expected one artifact for {source_id}, found {len(matches)}")
    return matches[0]


def clean(value: object) -> str:
    if pd.isna(value):
        return ""
    return " ".join(str(value).replace("\u00a0", " ").split())


def number(value: object) -> int:
    text = clean(value).replace(",", "")
    digits = "".join(ch for ch in text if ch.isdigit())
    if not digits:
        raise ValueError(f"No numeric value in {value!r}")
    return int(digits)


def duration(value: object) -> int:
    text = clean(value).upper().replace("Y", "")
    return int(float(text))


def rows_for(degree: str) -> list[dict[str, object]]:
    source_id = SOURCES[degree]
    path = find_source(source_id)
    engine = "xlrd" if path.suffix.lower() == ".xls" else "openpyxl"
    frame = pd.read_excel(path, header=0, engine=engine)
    rows: list[dict[str, object]] = []
    for offset, row in frame.iterrows():
        if degree == "Undergraduate":
            catalog_id = clean(row.iloc[0])
            name = clean(row.iloc[2])
            school = clean(row.iloc[5])
            duration_years = duration(row.iloc[6])
            language = clean(row.iloc[10])
            tuition = number(row.iloc[11])
            application_fee = number(row.iloc[12])
        else:
            catalog_id = clean(row.iloc[0])
            name = clean(row.iloc[2])
            school = clean(row.iloc[4])
            duration_years = duration(row.iloc[5])
            language = clean(row.iloc[9])
            tuition = number(row.iloc[10])
            application_fee = number(row.iloc[11])
        if not all((catalog_id, name, school, language)):
            raise ValueError(f"Missing required field at {degree} worksheet row {offset + 2}")
        rows.append(
            {
                "catalogId": catalog_id,
                "name": name,
                "school": school,
                "degreeLevel": degree,
                "durationYears": duration_years,
                "teachingLanguage": language,
                "tuitionCnyPerYear": tuition,
                "applicationFeeCny": application_fee,
                "sourceId": source_id,
                "sourceLocator": f"worksheet row {offset + 2}, catalog ID {catalog_id}",
            }
        )
    return rows


programs = rows_for("Undergraduate") + rows_for("Master") + rows_for("Doctoral")
counts = {
    degree: sum(1 for row in programs if row["degreeLevel"] == degree)
    for degree in ("Undergraduate", "Master", "Doctoral")
}
languages = {
    degree: {
        language: sum(
            1
            for row in programs
            if row["degreeLevel"] == degree and row["teachingLanguage"] == language
        )
        for language in sorted(
            {str(row["teachingLanguage"]) for row in programs if row["degreeLevel"] == degree}
        )
    }
    for degree in counts
}
expected = {"Undergraduate": 67, "Master": 104, "Doctoral": 125}
if counts != expected or len(programs) != 296:
    raise RuntimeError(f"TJU catalog counts mismatch: {counts}, total={len(programs)}")
if any(not row["name"] or not row["school"] for row in programs):
    raise RuntimeError("TJU catalog contains an empty English program or school name")

payload = {
    "version": 1,
    "sourceDirectory": os.fspath(RAW.relative_to(ROOT)).replace("\\", "/"),
    "programCount": len(programs),
    "counts": counts,
    "languageCounts": languages,
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
            "counts": counts,
            "languageCounts": languages,
        },
        ensure_ascii=False,
        indent=2,
    )
)
