import glob
import json
import os
import re
import sys

import pdfplumber


ZH_DIR = os.path.join("work", "catalog-official", "seu-program-catalog-supplement-01", "raw")
EN_DIR = os.path.join("work", "catalog-official", "seu-program-catalog-en-supplement-01", "raw")
OUTPUT = os.path.join("work", "catalog-official", "seu-complete-batch-01", "parsed-routes.json")


def only(directory, pattern):
    matches = glob.glob(os.path.join(directory, pattern))
    if len(matches) != 1:
        raise RuntimeError(f"Expected one file for {pattern}, found {len(matches)}")
    return matches[0]


def clean(value):
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    replacements = {
        "Schoolof": "School of ",
        "School Of": "School of ",
        "ofTransportation": "of Transportation",
        "ofHumanities": "of Humanities",
        "ofArchitecture": "of Architecture",
        "ofEnergy": "of Energy",
        "ofCivil": "of Civil",
        "ofInformation": "of Information",
        "ofComputer": "of Computer",
        "Scienceand": "Science and ",
        "Informationand": "Information and ",
        "Engineeringand": "Engineering and ",
        "Managementand": "Management and ",
        "Languageand": "Language and ",
        "andInformation": "and Information",
        "andApplied": "and Applied",
        "Supplyand": "Supply and ",
        "Technologyand": "Technology and ",
    }
    for before, after in replacements.items():
        text = text.replace(before, after)
    text = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", text)
    text = re.sub(r"\s*&\s*", " & ", text)
    text = re.sub(r"\s+", " ", text).strip()
    polish = {
        "Mathematics and Applied mathematics": "Mathematics and Applied Mathematics",
        "Urban underground space Engineering": "Urban Underground Space Engineering",
        "Intelligent perception Engineering": "Intelligent Perception Engineering",
        "School of Life science and Technology": "School of Life Science and Technology",
        "School of Integrated circuit": "School of Integrated Circuit",
    }
    text = polish.get(text, text)
    return text


def parse(path, degree, source_id, expected_count):
    routes = []
    school = ""
    with pdfplumber.open(path) as pdf:
        for page_number, page in enumerate(pdf.pages, 1):
            table = page.extract_table() or []
            for raw in table:
                row = [clean(cell) for cell in (raw or [])]
                if not row:
                    continue
                duration = row[-1] if row else ""
                if degree == "Undergraduate" and routes and duration not in {"4", "5", "6"}:
                    if len(row) >= 4 and not row[0] and not row[1] and row[2]:
                        routes[-1]["cscaRequirementEn"] = clean(f"{routes[-1]['cscaRequirementEn']} {row[2]}")
                    continue
                if duration not in {"2", "3", "4", "5", "6"} or len(row) < 3:
                    continue
                if row[0]:
                    school = row[0]
                major = row[1]
                if not school or not major:
                    raise RuntimeError(f"Missing school or major in {source_id} page {page_number}: {row}")
                english_taught = bool(re.search(r"english\s*-?\s*taught", major, re.I))
                display_major = re.sub(r"\s*[（(]\s*English\s*-?\s*taught\s*[)）]\s*", "", major, flags=re.I).strip()
                route = {
                    "degree": degree,
                    "routeNo": len(routes) + 1,
                    "schoolEn": school,
                    "majorEn": display_major,
                    "teachingLanguage": "English" if english_taught else "Chinese",
                    "durationYears": int(duration),
                    "sourceId": source_id,
                    "sourcePage": page_number,
                }
                if degree == "Undergraduate":
                    route["cscaRequirementEn"] = row[2]
                routes.append(route)
    if len(routes) != expected_count:
        raise RuntimeError(f"Unexpected {source_id} route count: {len(routes)} != {expected_count}")
    return routes


undergraduate = parse(
    only(EN_DIR, "seu-undergraduate-programs-en-pdf-2026.*.pdf"),
    "Undergraduate",
    "seu-undergraduate-programs-en-pdf-2026",
    70,
)
master = parse(
    only(EN_DIR, "seu-master-programs-en-pdf-2026.*.pdf"),
    "Master",
    "seu-master-programs-en-pdf-2026",
    92,
)
doctoral = parse(
    only(EN_DIR, "seu-doctoral-programs-en-pdf-2026.*.pdf"),
    "Doctoral",
    "seu-doctoral-programs-en-pdf-2026",
    68,
)

# The Chinese tables are independently counted so the review records the current
# bilingual-source difference instead of silently assuming both editions are identical.
def count_numeric_rows(path):
    count = 0
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for row in page.extract_table() or []:
                if row and clean(row[-1]) in {"2", "3", "4", "5", "6"}:
                    count += 1
    return count


chinese_counts = {
    "undergraduate": count_numeric_rows(only(ZH_DIR, "seu-undergraduate-programs-pdf-2026.*.pdf")),
    "master": count_numeric_rows(only(ZH_DIR, "seu-master-programs-pdf-2026.*.pdf")),
    "doctoral": count_numeric_rows(only(ZH_DIR, "seu-doctoral-programs-pdf-2026.*.pdf")),
}
counts = {
    "undergraduate": len(undergraduate),
    "master": len(master),
    "doctoral": len(doctoral),
    "total": len(undergraduate) + len(master) + len(doctoral),
}
expected = {"undergraduate": 70, "master": 92, "doctoral": 68, "total": 230}
if counts != expected:
    raise RuntimeError(f"Unexpected SEU route counts: {counts}")

payload = {
    "version": 1,
    "counts": counts,
    "chineseCatalogCounts": chinese_counts,
    "bilingualCatalogDifference": {
        "undergraduate": counts["undergraduate"] - chinese_counts["undergraduate"],
        "master": counts["master"] - chinese_counts["master"],
        "doctoral": counts["doctoral"] - chinese_counts["doctoral"],
    },
    "routes": undergraduate + master + doctoral,
}
with open(OUTPUT, "w", encoding="utf-8") as handle:
    json.dump(payload, handle, ensure_ascii=False, indent=2)
    handle.write("\n")
print(json.dumps({
    "ok": True,
    "output": OUTPUT,
    "counts": counts,
    "chineseCatalogCounts": chinese_counts,
    "bilingualCatalogDifference": payload["bilingualCatalogDifference"],
}, ensure_ascii=False, indent=2))
