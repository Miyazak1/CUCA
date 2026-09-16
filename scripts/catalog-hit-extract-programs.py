import glob
import json
import os
import re
import sys

sys.path.insert(0, os.path.join("work", "catalog-official", "python-deps"))
import pandas as pd


RUN_DIR = os.path.join("work", "catalog-official", "hit-complete-batch-01")
RAW_DIR = os.path.join(RUN_DIR, "raw")
OUTPUT = os.path.join(RUN_DIR, "parsed-routes.json")


def only(pattern):
    matches = glob.glob(os.path.join(RAW_DIR, pattern))
    if len(matches) != 1:
        raise RuntimeError(f"Expected one file for {pattern}, found {len(matches)}")
    return matches[0]


def bilingual(value):
    parts = [re.sub(r"\s+", " ", part).strip() for part in str(value).splitlines() if part.strip()]
    if not parts:
        return {"zh": "", "en": ""}
    english = next((part for part in reversed(parts) if re.search(r"[A-Za-z]", part)), parts[-1])
    chinese = next((part for part in parts if re.search(r"[\u4e00-\u9fff]", part)), "")
    return {"zh": chinese, "en": english}


def clean_number(value):
    number = float(value)
    return int(number) if number.is_integer() else number


def parse_table(path, degree, source_id, start_row, language_override=None):
    frame = pd.read_excel(path, sheet_name=0, header=None)
    rows = []
    school = {"zh": "", "en": ""}
    csca = {"zh": "", "en": ""}
    for row_index in range(start_row, len(frame)):
        row = frame.iloc[row_index]
        if pd.notna(row.iloc[1]):
            school = bilingual(row.iloc[1])
        if degree == "Undergraduate" and pd.notna(row.iloc[5]):
            csca = bilingual(row.iloc[5])
        if pd.isna(row.iloc[2]) or pd.isna(row.iloc[4]):
            continue
        major = bilingual(row.iloc[2])
        language = language_override or bilingual(row.iloc[3])["en"]
        if not major["en"] or language not in {"Chinese", "English", "English & Chinese"}:
            continue
        rows.append({
            "degree": degree,
            "routeNo": len(rows) + 1,
            "schoolZh": school["zh"],
            "schoolEn": school["en"],
            "majorZh": major["zh"],
            "majorEn": major["en"],
            "language": language,
            "durationYears": clean_number(row.iloc[4]),
            "cscaRequirementZh": csca["zh"] if degree == "Undergraduate" else "",
            "cscaRequirementEn": csca["en"] if degree == "Undergraduate" else "",
            "sourceId": source_id,
            "sourceRow": row_index + 1,
        })
    return rows


undergraduate = parse_table(
    only("hit-bachelor-programs-2026.*.xls"),
    "Undergraduate",
    "hit-bachelor-programs-2026",
    3,
)
master_chinese = parse_table(
    only("hit-master-programs-chinese-2026.*.xlsx"),
    "Master",
    "hit-master-programs-chinese-2026",
    2,
    "Chinese",
)
master_english = parse_table(
    only("hit-master-programs-english-2026.*.xlsx"),
    "Master",
    "hit-master-programs-english-2026",
    2,
    "English",
)
doctoral = parse_table(
    only("hit-doctoral-programs-2026.*.xlsx"),
    "Doctoral",
    "hit-doctoral-programs-2026",
    2,
)

counts = {
    "undergraduate": len(undergraduate),
    "masterChinese": len(master_chinese),
    "masterEnglish": len(master_english),
    "master": len(master_chinese) + len(master_english),
    "doctoral": len(doctoral),
    "total": len(undergraduate) + len(master_chinese) + len(master_english) + len(doctoral),
}
expected = {"undergraduate": 97, "masterChinese": 36, "masterEnglish": 16, "master": 52, "doctoral": 33, "total": 182}
if counts != expected:
    raise RuntimeError(f"Unexpected HIT route counts: {counts}")

payload = {"version": 1, "counts": counts, "routes": undergraduate + master_chinese + master_english + doctoral}
with open(OUTPUT, "x", encoding="utf-8") as handle:
    json.dump(payload, handle, ensure_ascii=False, indent=2)
    handle.write("\n")
print(json.dumps({"ok": True, "output": OUTPUT, "counts": counts}, ensure_ascii=False, indent=2))
