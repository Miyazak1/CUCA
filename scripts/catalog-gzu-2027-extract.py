import json
import logging
import pathlib
import re

import pdfplumber

logging.getLogger("pdfminer").setLevel(logging.ERROR)

ROOT = pathlib.Path("work/catalog-official/2026-10-26T03-25-21-642Z")
MANIFEST = json.loads((ROOT / "manifest.json").read_text("utf8"))
SOURCE_IDS = {
    "undergraduate": "gzu-international-undergraduate-program-catalog-pdf-2027",
    "master": "gzu-international-master-program-catalog-pdf-2027",
    "doctoral": "gzu-international-doctoral-program-catalog-pdf-2027",
}
WATERMARKS = {"U", "Z", "G", "学", "大", "州", "贵"}


def clean(value):
    if value is None:
        return ""
    parts = [line.strip() for line in str(value).splitlines() if line.strip() not in WATERMARKS]
    return re.sub(r"\s+", " ", " ".join(parts)).strip()


def language(value):
    value = clean(value)
    if "English" in value and "Chinese" in value:
        return "Chinese and English"
    if "English" in value:
        return "English"
    return "Chinese"


def tuition(value):
    raw = clean(value)
    amounts = [int(number) for number in re.findall(r"(?<!\d)(1[0-9]{4}|2[0-9]{4}|3[0-9]{4}|6[0-9]{4})(?!\d)", raw)]
    return {"tuitionText": raw, "tuitionAmounts": list(dict.fromkeys(amounts))}


def csca(value):
    value = clean(value)
    return [label for label in ["Chinese (Arts)", "Chinese (Science)", "Mathematics", "Physics", "Chemistry"] if label in value]


def fix_name(value):
    value = clean(value).replace("Techno logy", "Technology").replace("Bachelo r", "Bachelor").replace("Interpretin", "Interpreting")
    if value.startswith("cooperative education Chemical Engineering"):
        value = value.replace("cooperative education ", "", 1)
    if value.startswith("Mechanical Design, Manufacturing and Automation") and "program" not in value:
        value = "Mechanical Design, Manufacturing and Automation (Chinese-foreign cooperative education program)"
    return value


output = {"version": 1, "schoolSlug": "guizhou-university", "year": 2027, "sources": {}, "undergraduate": [], "master": [], "doctoral": []}
for level, source_id in SOURCE_IDS.items():
    source = next(item for item in MANIFEST["sources"] if item["id"] == source_id)
    output["sources"][level] = {
        "id": source_id,
        "sha256": source["sha256"],
        "fetchedAt": source["fetchedAt"],
        "url": source.get("finalUrl") or source["url"],
    }
    state = {"collegeEn": "", "collegeZh": "", "majorEn": "", "majorZh": "", "code": "", "degreeEn": ""}
    with pdfplumber.open(ROOT / source["artifactPath"]) as pdf:
        for page_number, page in enumerate(pdf.pages, 1):
            for table in page.extract_tables():
                for row in table:
                    if level == "undergraduate":
                        if len(row) < 11 or not clean(row[3]) or not re.search(r"[0-9]Y", clean(row[5])):
                            continue
                        if clean(row[1]):
                            state["collegeEn"] = clean(row[1])
                        if clean(row[0]):
                            state["collegeZh"] = clean(row[0])
                        item = {
                            "page": page_number,
                            "collegeEn": state["collegeEn"],
                            "collegeZh": state["collegeZh"],
                            "nameEn": fix_name(row[3]),
                            "nameZh": clean(row[2]),
                            "code": clean(row[4]),
                            "durationYears": int(re.search(r"([0-9])Y", clean(row[5])).group(1)),
                            "teachingLanguage": language(row[6]),
                            "degreeName": fix_name(row[8]),
                            "cscaSubjects": csca(row[9]),
                            **tuition(row[10]),
                        }
                        notes = clean(row[11]) if len(row) > 11 else ""
                    else:
                        if len(row) < 14:
                            continue
                        for key, index in [("collegeZh", 0), ("collegeEn", 1), ("majorZh", 2), ("majorEn", 3), ("code", 4), ("degreeEn", 12)]:
                            if clean(row[index]):
                                state[key] = fix_name(row[index])
                        if not clean(row[6]) or not re.search(r"[0-9]Y", clean(row[7])):
                            continue
                        item = {
                            "page": page_number,
                            "collegeEn": state["collegeEn"],
                            "collegeZh": state["collegeZh"],
                            "majorEn": state["majorEn"],
                            "majorZh": state["majorZh"],
                            "code": state["code"],
                            "fieldEn": fix_name(row[6]),
                            "fieldZh": clean(row[5]),
                            "durationYears": int(re.search(r"([0-9])Y", clean(row[7])).group(1)),
                            "teachingLanguage": language(row[8]),
                            "degreeName": state["degreeEn"],
                            **tuition(row[13]),
                        }
                        notes = clean(row[14]) if len(row) > 14 else ""
                    if notes and notes != "/":
                        item["notes"] = notes
                    output[level].append(item)

print(json.dumps(output, ensure_ascii=False, indent=2))
