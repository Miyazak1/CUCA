import json
import logging
import pathlib
import re
import sys

import pdfplumber

logging.getLogger("pdfminer").setLevel(logging.ERROR)


def clean(value):
    return re.sub(r"\s+", " ", str(value or "").replace("\xa0", " ")).strip()


def bilingual(value):
    value = clean(value)
    if "/" not in value:
        return value, value
    zh, en = value.split("/", 1)
    return clean(zh), clean(en)


def level(value):
    raw = clean(value)
    if "Bachelor" in raw:
        return "Bachelor"
    if "Master" in raw:
        return "Master"
    if "Doctor" in raw:
        return "Doctoral"
    return "Language Program"


def language(value):
    raw = clean(value)
    if "Chinese" in raw and ("English" in raw or "Japanese" in raw):
        return "Chinese, English and Japanese"
    if "English" in raw:
        return "English"
    return "Chinese"


def extract(pdf_path):
    programs = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            for table in page.extract_tables():
                for row in table:
                    if len(row) != 10 or not clean(row[0]).isdigit():
                        continue
                    name_zh, name_en = bilingual(row[2])
                    college_zh, college_en = bilingual(row[8])
                    duration = clean(row[5])
                    intake = clean(row[6])
                    requirement = clean(row[7])
                    detail = clean(row[9])
                    programs.append({
                        "sourceRow": int(clean(row[0])),
                        "sourcePage": page_number,
                        "degreeLevel": level(row[1]),
                        "nameZh": name_zh,
                        "nameEn": name_en,
                        "teachingLanguage": language(row[3]),
                        "tuitionAmount": int(float(clean(row[4]))),
                        "durationText": duration,
                        "intakeText": intake,
                        "languageRequirement": requirement,
                        "collegeZh": college_zh,
                        "collegeEn": college_en,
                        "cscaOrResearchText": detail,
                    })
    if len(programs) != 99 or [item["sourceRow"] for item in programs] != list(range(1, 100)):
        raise RuntimeError(f"Expected official rows 1-99, found {len(programs)} with non-contiguous numbering")
    return programs


if __name__ == "__main__":
    if len(sys.argv) not in {2, 3}:
        raise SystemExit("Usage: catalog-zjnu-2027-programs-extract.py <official-pdf> [output-json]")
    output = f"{json.dumps({'version': 1, 'schoolSlug': 'zhejiang-normal-university', 'year': 2027, 'programs': extract(sys.argv[1])}, ensure_ascii=False, indent=2)}\n"
    if len(sys.argv) == 3:
        pathlib.Path(sys.argv[2]).write_text(output, encoding="utf8")
    else:
        print(output, end="")
