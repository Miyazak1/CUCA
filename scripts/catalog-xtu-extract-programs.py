from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT / "work/catalog-official/xtu-complete-batch-01"
RAW = RUN / "raw"
OUTPUT = RUN / "parsed-programs.json"
SOURCES = {
    "Undergraduate": "xtu-undergraduate-programs-current",
    "Master": "xtu-master-programs-current",
    "Doctoral": "xtu-doctoral-programs-current",
}


def source_path(source_id: str) -> Path:
    matches = sorted(RAW.glob(f"{source_id}.*"))
    if len(matches) != 1:
        raise RuntimeError(f"Expected one artifact for {source_id}, found {len(matches)}")
    return matches[0]


def clean(value: object) -> str:
    if pd.isna(value):
        return ""
    return " ".join(str(value).replace("\xa0", " ").split())


def duration_years(value: object) -> int:
    match = re.search(r"\d+", clean(value))
    if not match:
        raise ValueError(f"Missing duration in {value!r}")
    return int(match.group())


def parse(level: str) -> list[dict[str, object]]:
    source_id = SOURCES[level]
    table = pd.read_html(source_path(source_id))[0]
    header = [clean(value).upper() for value in table.iloc[0].tolist()]
    records: list[dict[str, object]] = []
    for row_number, row in enumerate(table.iloc[1:].itertuples(index=False, name=None), start=2):
        values = [clean(value) for value in row]
        if level == "Undergraduate":
            college, major, language_text, duration = values[:4]
            direction, notes = major, ""
        else:
            college, major, direction, language_text, duration, notes = values[:6]
        if not all((college, major, direction, language_text, duration)):
            raise RuntimeError(f"Missing required field in {source_id} HTML table row {row_number}: {values}")
        languages = [part.strip() for part in language_text.split("/") if part.strip()]
        for language in languages:
            records.append(
                {
                    "nameEn": major if level == "Undergraduate" else direction,
                    "majorEn": major,
                    "researchDirectionEn": direction if level != "Undergraduate" else "",
                    "collegeEn": college,
                    "degreeLevel": level,
                    "durationYears": duration_years(duration),
                    "teachingLanguage": language,
                    "notes": notes,
                    "sourceId": source_id,
                    "sourceLocator": f"HTML table row {row_number}, columns {', '.join(header)}",
                }
            )
    return records


programs = parse("Undergraduate") + parse("Master") + parse("Doctoral")
counts = {level: sum(row["degreeLevel"] == level for row in programs) for level in SOURCES}
language_counts = {language: sum(row["teachingLanguage"] == language for row in programs) for language in ("Chinese", "English")}
expected = {"Undergraduate": 20, "Master": 47, "Doctoral": 29}
if counts != expected or len(programs) != 96:
    raise RuntimeError(f"XTU route count mismatch: {counts}, total={len(programs)}")
keys = [(row["degreeLevel"], row["collegeEn"], row["majorEn"], row["nameEn"], row["teachingLanguage"]) for row in programs]
duplicates = len(keys) - len(set(keys))
if duplicates:
    raise RuntimeError(f"XTU parsed output contains {duplicates} duplicate route keys")

payload = {"version": 1, "programCount": len(programs), "counts": counts, "languageCounts": language_counts, "duplicateRouteKeys": duplicates, "programs": programs}
body = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
OUTPUT.write_text(body, encoding="utf-8", newline="\n")
print(json.dumps({"ok": True, "output": str(OUTPUT), "sha256": hashlib.sha256(body.encode()).hexdigest(), **{k: v for k, v in payload.items() if k != "programs"}}, ensure_ascii=False, indent=2))
