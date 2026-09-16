from __future__ import annotations

import glob
import json
from pathlib import Path

import fitz


ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "work/catalog-official/hust-complete-batch-01/raw"
OUT = ROOT / "work/catalog-official/hust-complete-batch-01/parsed-routes.json"


def pdf_for(prefix: str) -> Path:
    matches = glob.glob(str(RAW / f"{prefix}.*.pdf"))
    if len(matches) != 1:
        raise RuntimeError(f"Expected one PDF for {prefix}, found {len(matches)}")
    return Path(matches[0])


def tables(prefix: str):
    with fitz.open(pdf_for(prefix)) as document:
        return [[table.extract() for table in page.find_tables().tables] for page in document]


def clean(value):
    return " ".join(str(value or "").replace("\n", " ").split())


def marker_kind(value: str):
    value = clean(value)
    if "◎" in value:
        return "Professional degree"
    if "○" in value:
        return "Academic degree"
    return None


routes = []


def add(*, degree, school, name_en, name_zh=None, language="Chinese", award_type=None,
        duration_years=None, supervisor_letter=False, interview=False, source_id, note=None):
    routes.append({
        "degree": degree,
        "school": clean(school).lstrip("*"),
        "nameEn": clean(name_en),
        **({"nameZh": clean(name_zh)} if clean(name_zh) else {}),
        "language": language,
        **({"awardType": award_type} if award_type else {}),
        **({"durationYears": duration_years} if duration_years else {}),
        "supervisorLetterRequired": bool(supervisor_letter),
        "interviewRequired": bool(interview),
        "sourceId": source_id,
        **({"note": note} if note else {}),
    })


# Undergraduate tables use one table per school. A row is emitted once for every
# published teaching-language marker.
for page_tables in tables("hust-undergraduate-programs-2026"):
    for table in page_tables:
        header = table[0]
        school_zh, school_en = clean(header[0]), clean(header[1])
        interview = school_en.startswith("*")
        languages = [clean(value) for value in header[2:]]
        for row in table[1:]:
            name_zh, name_en = clean(row[0]), clean(row[1])
            for index, language_code in enumerate(languages, start=2):
                marker = clean(row[index] if index < len(row) else "")
                if "○" not in marker and "◎" not in marker:
                    continue
                duration = 6 if "6 yrs" in marker else 5 if "5 yrs" in marker else 4
                add(
                    degree="Undergraduate", school=school_en, name_en=name_en, name_zh=name_zh,
                    language="Chinese" if language_code == "C" else "English",
                    duration_years=duration, interview=interview,
                    source_id="hust-undergraduate-programs-2026",
                )


# Master's tables continue schools across blank cells and expose language,
# academic/professional degree type, and supervisor-letter requirement.
current_school = ""
for page_tables in tables("hust-master-programs-2026"):
    for table in page_tables:
        rows = table[1:] if clean(table[0][0]) == "Schools" else table
        for row in rows:
            if clean(row[0]):
                current_school = clean(row[0])
            name = clean(row[1])
            if not current_school or not name:
                continue
            for column, language in ((2, "Chinese"), (3, "English")):
                kind = marker_kind(row[column] if column < len(row) else "")
                if kind:
                    add(
                        degree="Master", school=current_school, name_en=name, language=language,
                        award_type=kind, duration_years=2, supervisor_letter="▷" in clean(row[4] if len(row) > 4 else ""),
                        source_id="hust-master-programs-2026",
                    )


# The official doctoral table is image-based. These rows are a direct visual
# transcription of its two rendered pages; language and marker columns are kept
# explicitly so the review artifact can be checked against the page images.
doctoral_rows = [
    ("School of Physics", "Physics", "C", True, None),
    ("School of Chemistry and Chemical Engineering", "Chemistry", "CE", True, None),
    ("School of Mechanical Science and Engineering", "Mechanical Engineering", "E", True, None),
    ("School of Materials Science and Engineering", "Material Science and Engineering", "CE", True, None),
    ("School of Energy and Power Engineering", "Power Engineering and Engineering Thermophysics", "CE", True, None),
    ("School of Electrical and Electronic Engineering", "Electrical Engineering", "CE", True, None),
    ("School of Naval Architecture and Ocean Engineering", "Naval Architecture and Ocean Engineering", "E", True, None),
    ("College of Life Science and Technology", "Botany", "CE", True, None),
    ("College of Life Science and Technology", "Microbiology", "CE", True, None),
    ("College of Life Science and Technology", "Genetics", "CE", True, None),
    ("College of Life Science and Technology", "Biochemistry and Molecular Biology", "CE", True, None),
    ("College of Life Science and Technology", "Biophysics", "CE", True, None),
    ("College of Life Science and Technology", "Hydrobiology", "CE", True, None),
    ("College of Life Science and Technology", "Biomedical Engineering", "CE", True, None),
    ("College of Life Science and Technology", "Biopharmaceuticals", "CE", True, None),
    ("College of Life Science and Technology", "Bioinformatics", "CE", True, None),
    ("College of Life Science and Technology", "Biomaterials and Tissue Engineering", "CE", True, None),
    ("School of Electronic Information and Communication", "Information and Communication Engineering", "E", True, None),
    ("School of Optical and Electronic Information", "Optical Engineering", "CE", True, None),
    ("School of Optical and Electronic Information", "Electronic Science and Technology", "CE", True, None),
    ("School of Artificial Intelligence and Automation", "Intelligent Science and Technology", "E", True, None),
    ("School of Artificial Intelligence and Automation", "Control Science and Engineering", "E", True, None),
    ("School of Integrated Circuits", "Electronic Science and Technology", "C", True, None),
    ("School of Integrated Circuits", "New-Generation Electronic Information Technology", "C", True, None),
    ("School of Computer Science and Technology", "Computer Science and Technology", "CE", True, None),
    ("School of Architecture and Urban Planning", "Architecture", "C", True, None),
    ("School of Architecture and Urban Planning", "Urban Planning", "C", True, None),
    ("School of Architecture and Urban Planning", "Landscape Architecture", "C", True, "Professional degree"),
    ("School of Design", "Design", "C", False, None),
    ("School of Civil and Hydraulic Engineering", "Civil Engineering", "CE", False, None),
    ("School of Civil and Hydraulic Engineering", "Hydraulic Engineering", "C", False, None),
    ("School of Environmental Science and Engineering", "Environmental Science and Engineering", "CE", False, None),
    ("School of Management", "Management Science and Engineering", "E", True, None),
    ("School of Management", "Science of Business Administration", "E", True, None),
    ("School of Economics", "Regional Economics", "CE", True, None),
    ("School of Economics", "Finance", "CE", True, None),
    ("School of Economics", "Industrial Economics", "CE", True, None),
    ("School of Economics", "International Trade", "CE", True, None),
    ("School of Economics", "Quantitative Economics", "CE", True, None),
    ("College of Public Administration", "Public Administration", "E", False, None),
    ("College of Public Administration", "Land Resource Management", "E", False, None),
    ("College of Public Administration", "Electronic Government", "E", False, None),
    ("School of Humanities", "Applied Linguistics", "C", True, None),
    ("School of Humanities", "Chinese Philology", "C", True, None),
    ("School of Humanities", "Literary Theory", "C", True, None),
    ("School of Humanities", "Chinese Ancient Literature", "C", True, None),
    ("School of Humanities", "Modern and Contemporary Chinese Literature", "C", True, None),
    ("School of Humanities", "Comparative Literature and World Literature", "C", True, None),
    ("School of Humanities", "International Chinese Language Education", "C", True, "Professional degree"),
    ("School of Law", "Law", "CE", False, None),
    ("School of Sociology", "Sociology", "E", False, None),
    ("School of Foreign Languages", "Foreign Languages and Literature", "C", True, None),
    ("School of Education", "Education", "E", True, None),
    ("School of Journalism and Information Communication", "Journalism and Communication", "C", True, None),
]
for school, name, languages, supervisor, award_type in doctoral_rows:
    for code, language in (("C", "Chinese"), ("E", "English")):
        if code in languages:
            add(
                degree="Doctoral", school=school, name_en=name, language=language,
                award_type=award_type or "Academic degree", duration_years=4,
                supervisor_letter=supervisor, source_id="hust-doctoral-programs-2026",
                note="Education includes six published divisions." if school == "School of Education" else None,
            )


# Medical postgraduate table: the first two Tongji Hospital tables use four
# degree columns. The remaining tables publish their own degree headings.
medical = tables("hust-medical-postgraduate-programs-2026")
tongji_tables = [medical[0][0], medical[1][0]]
tongji_columns = [
    (2, "Master", "Academic degree"), (3, "Master", "Professional degree"),
    (4, "Doctoral", "Academic degree"), (5, "Doctoral", "Professional degree"),
]
for table_index, table in enumerate(tongji_tables):
    rows = table[2:] if table_index == 0 else table
    for row in rows:
        for column, degree, award_type in tongji_columns:
            if column < len(row) and marker_kind(row[column]):
                add(
                    degree=degree, school="Tongji Hospital", name_en=row[1], name_zh=row[0],
                    language="Chinese", award_type=award_type,
                    duration_years=3 if degree == "Master" else 4,
                    supervisor_letter=True,
                    source_id="hust-medical-postgraduate-programs-2026",
                )

for table in medical[1][1:] + medical[2]:
    header = table[0]
    school = clean(header[1])
    degree_headers = [clean(value) for value in header[2:]]
    for row in table[2:]:
        english_name = clean(row[1]) or {
            "药学（临床药学）": "Clinical Pharmacy",
        }.get(clean(row[0]), clean(row[0]))
        for offset, heading in enumerate(degree_headers, start=2):
            marker = clean(row[offset] if offset < len(row) else "")
            if "○" not in marker and "◎" not in marker:
                continue
            degree = "Doctoral" if "Doctor" in heading else "Master"
            kinds = []
            if "○" in marker:
                kinds.append("Academic degree")
            if "◎" in marker:
                kinds.append("Professional degree")
            for award_type in kinds:
                add(
                    degree=degree, school=school, name_en=english_name, name_zh=row[0],
                    language="Chinese", award_type=award_type,
                    duration_years=3 if degree == "Master" else 4,
                    supervisor_letter=True,
                    source_id="hust-medical-postgraduate-programs-2026",
                )


for route in routes:
    if not route["nameEn"]:
        raise RuntimeError(f"Missing English program name: {route}")

seen = set()
for route in routes:
    key = (route["degree"], route["school"], route["nameEn"], route["language"], route.get("awardType"))
    if key in seen:
        raise RuntimeError(f"Duplicate route: {key}")
    seen.add(key)

counts = {
    "undergraduate": sum(route["degree"] == "Undergraduate" for route in routes),
    "master": sum(route["degree"] == "Master" for route in routes),
    "doctoral": sum(route["degree"] == "Doctoral" for route in routes),
}
payload = {"version": 1, "counts": counts, "routes": routes}
OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"ok": True, "output": str(OUT), "counts": counts, "total": len(routes)}, ensure_ascii=False, indent=2))
