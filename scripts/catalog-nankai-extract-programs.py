import glob
import hashlib
import json
import re
from pathlib import Path

import pdfplumber

ROOT = Path.cwd()
OUTPUT = ROOT / "work/catalog-official/nankai-complete-batch-01/parsed-programs.json"


def clean(value):
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value).replace("�", " ")).strip()


def number(value):
    text = clean(value).replace(",", "")
    match = re.search(r"\d+(?:\.\d+)?", text)
    return float(match.group()) if match else None


def locate(pattern):
    matches = glob.glob(str(ROOT / pattern))
    if len(matches) != 1:
        raise RuntimeError(f"Expected one file for {pattern}, found {len(matches)}")
    return Path(matches[0])


CONFIGS = [
    {
        "degree": "Undergraduate",
        "path": locate("work/catalog-official/nankai-complete-batch-01/raw/nankai-undergraduate-program-catalog-pdf-2026.*.pdf"),
        "sourceId": "nankai-undergraduate-program-catalog-pdf-2026",
        "expected": 41,
        "school": 0,
        "program": 2,
        "language": 5,
        "tuition": 4,
        "duration": 3,
        "campus": 1,
        "requirements": 6,
        "csca": 7,
    },
    {
        "degree": "Master",
        "path": locate("work/catalog-official/nankai-complete-batch-01-master/raw/nankai-master-program-catalog-pdf-2026.*.pdf"),
        "sourceId": "nankai-master-program-catalog-pdf-2026",
        "expected": 171,
        "school": 1,
        "program": 3,
        "language": 5,
        "tuition": 7,
        "duration": 9,
    },
    {
        "degree": "Doctoral",
        "path": locate("work/catalog-official/nankai-complete-batch-01/raw/nankai-doctoral-program-catalog-pdf-2026.*.pdf"),
        "sourceId": "nankai-doctoral-program-catalog-pdf-2026",
        "expected": 127,
        "school": 1,
        "program": 3,
        "language": 9,
        "tuition": 5,
        "duration": 7,
    },
]


def parse(config):
    rows = []
    current_school = ""
    with pdfplumber.open(config["path"]) as pdf:
        for page_number, page in enumerate(pdf.pages, 1):
            tables = page.extract_tables()
            if len(tables) != 1:
                raise RuntimeError(f"{config['degree']} page {page_number} has {len(tables)} tables")
            for row_number, row in enumerate(tables[0], 1):
                values = list(row) + [None] * 10
                school = clean(values[config["school"]])
                if config["degree"] == "Doctoral" and page_number == 6 and row_number == 15:
                    school = "School of Economics"
                program = clean(values[config["program"]])
                language = clean(values[config["language"]])
                tuition = number(values[config["tuition"]])
                duration = number(values[config["duration"]])
                if school and school.lower() != "school":
                    current_school = school
                if not program or program.lower() in {"major", "program"} or not language or language.lower() == "language" or tuition is None or duration is None:
                    continue
                if not current_school:
                    raise RuntimeError(f"Missing school context at {config['degree']} page {page_number} row {row_number}")
                normalized_language = {"chineses": "Chinese", "chinses": "Chinese"}.get(language.lower(), language)
                normalized_program = {"Corporate Governanc": "Corporate Governance", "Janpanese": "Japanese"}.get(program, program)
                record = {
                    "degreeLevel": config["degree"],
                    "school": current_school,
                    "name": normalized_program,
                    "teachingLanguage": normalized_language.replace("/", " and "),
                    "tuitionCnyPerYear": int(tuition) if tuition.is_integer() else tuition,
                    "durationYears": int(duration) if duration.is_integer() else duration,
                    "sourceId": config["sourceId"],
                    "sourceSha256": hashlib.sha256(config["path"].read_bytes()).hexdigest(),
                    "sourceLocator": f"page {page_number}, table 1, row {row_number}",
                }
                if config["degree"] == "Undergraduate":
                    record["campus"] = clean(values[config["campus"]])
                    record["requirements"] = clean(values[config["requirements"]])
                    record["cscaSubjects"] = [item.strip() for item in clean(values[config["csca"]]).split(",") if item.strip()]
                rows.append(record)
    deduplicated = []
    seen = set()
    for row in rows:
        identity = (row["school"], row["name"], row["teachingLanguage"], row["tuitionCnyPerYear"], row["durationYears"])
        if identity in seen:
            continue
        seen.add(identity)
        deduplicated.append(row)
    rows = deduplicated
    if len(rows) != config["expected"]:
        raise RuntimeError(f"{config['degree']} expected {config['expected']} routes, parsed {len(rows)}")
    return rows


all_rows = [row for config in CONFIGS for row in parse(config)]
payload = {
    "version": 1,
    "schoolSlug": "nankai-university",
    "programCount": len(all_rows),
    "counts": {degree: len([row for row in all_rows if row["degreeLevel"] == degree]) for degree in ["Undergraduate", "Master", "Doctoral"]},
    "programs": all_rows,
}
OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"ok": True, "output": str(OUTPUT), "sha256": hashlib.sha256(OUTPUT.read_bytes()).hexdigest(), **payload["counts"], "total": len(all_rows)}, ensure_ascii=False, indent=2))
