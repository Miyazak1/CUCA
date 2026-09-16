"""Deterministically structure ZJUT's reviewed 2026 degree-program PDF tables."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import pdfplumber


ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT / "work/catalog-official/zjut-complete-batch-01"
OUTPUT = RUN / "parsed-programs.json"
SOURCES = {
    "undergraduate": "zjut-undergraduate-guide-pdf-2026",
    "graduate": "zjut-graduate-guide-pdf-2026",
}


def normalized(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def source(source_id: str) -> tuple[dict, Path]:
    manifest = json.loads((RUN / "manifest.json").read_text(encoding="utf-8"))
    rows = [row for row in manifest["sources"] if row["id"] == source_id]
    if len(rows) != 1 or rows[0]["status"] != 200 or rows[0]["contentType"] != "application/pdf":
        raise RuntimeError(f"Missing locked ZJUT PDF evidence: {source_id}")
    row = rows[0]
    path = RUN / row["artifactPath"]
    if hashlib.sha256(path.read_bytes()).hexdigest() != row["sha256"]:
        raise RuntimeError(f"ZJUT PDF bytes changed: {source_id}")
    return row, path


def route(college: str, language: str, name: str, page: int, **extra: object) -> dict:
    return {
        "collegeEn": college,
        "teachingLanguage": language,
        "nameEn": name,
        "sourcePage": page,
        **extra,
    }


UG: list[dict] = []


def undergraduate_group(college: str, language: str, names: list[str], page: int, csca: list[str], hsk5: set[str] | None = None) -> None:
    for name in names:
        UG.append(route(college, language, name, page, degreeLevel="Undergraduate", durationYears=4, tuitionAmount=18800 if language == "English" else 16200, cscaSubjects=csca, hskLevel=5 if name in (hsk5 or set()) else (4 if language == "Chinese" else None)))


undergraduate_group("College of Chemical Engineering", "English", ["Chemical Engineering and Technology", "Applied Chemistry"], 1, ["Mathematics", "Chemistry"])
undergraduate_group("College of Chemical Engineering", "Chinese", ["Chemical Engineering and Technology"], 1, ["STEM-Chinese", "Mathematics", "Chemistry"])
undergraduate_group("College of Pharmaceutical Science", "English", ["Pharmaceutical Science"], 1, ["Mathematics", "Chemistry"])
undergraduate_group("Collaborative Innovation Center of Yangtze River Delta Region Green Pharmaceuticals", "Chinese", ["Pharmaceutical Engineering"], 2, ["STEM-Chinese", "Mathematics", "Chemistry"])
undergraduate_group("College of Environment", "English", ["Environmental Engineering"], 2, ["Mathematics", "Chemistry"])
undergraduate_group("College of Environment", "Chinese", ["Environmental Science"], 2, ["STEM-Chinese", "Mathematics", "Chemistry"])
undergraduate_group("College of Material Science & Engineering", "Chinese", ["Materials Science and Engineering", "Polymer Materials and Engineering"], 2, ["STEM-Chinese", "Mathematics", "Chemistry"])
undergraduate_group("College of Food Science and Technology", "Chinese", ["Food Science and Engineering", "Food Quality and Safety"], 2, ["STEM-Chinese", "Mathematics", "Chemistry"], {"Food Science and Engineering", "Food Quality and Safety"})
undergraduate_group("College of Mechanical Engineering", "English", ["Mechanical Engineering"], 2, ["Mathematics", "Physics"])
undergraduate_group("College of Mechanical Engineering", "Chinese", ["Mechanical Engineering", "Industrial Engineering", "Process Equipment and Control Engineering", "Robotics Engineering", "Vehicle Engineering", "Logistics Engineering"], 2, ["STEM-Chinese", "Mathematics", "Physics"])
undergraduate_group("College of Information Engineering", "English", ["Electrical Engineering and Automation"], 2, ["Mathematics", "Physics"])
undergraduate_group("College of Computer Science & Technology (College of Software)", "English", ["Software Engineering", "Computer Science and Technology"], 2, ["Mathematics", "Physics"])
undergraduate_group("College of Computer Science & Technology (College of Software)", "Chinese", ["Computer Science and Technology", "Software Engineering"], 2, ["STEM-Chinese", "Mathematics", "Physics"], {"Computer Science and Technology", "Software Engineering"})
undergraduate_group("College of Civil Engineering", "English", ["Civil Engineering"], 2, ["Mathematics", "Physics"])
undergraduate_group("College of Civil Engineering", "Chinese", ["Civil Engineering"], 2, ["STEM-Chinese", "Mathematics", "Physics"])
undergraduate_group("School of Design and Architecture", "Chinese", ["Visual Communication Design", "Urban and Rural Planning", "Digital Media Art", "Environmental Design"], 3, ["Humanities-Chinese", "Mathematics"])
undergraduate_group("College of Geoinformatics", "Chinese", ["Spatial Information and Digital Technology (2+2 Program)"], 3, ["STEM-Chinese", "Mathematics", "Physics"])
undergraduate_group("School of Management", "English", ["Business Administration"], 3, ["Mathematics"])
undergraduate_group("School of Management", "Chinese", ["Business Administration", "Financial Management", "Engineering Management", "Information Management and Information System"], 3, ["Humanities-Chinese", "Mathematics"])
undergraduate_group("School of Economics", "English", ["International Economics and Trade", "Finance"], 3, ["Mathematics"])
undergraduate_group("School of Economics", "Chinese", ["International Economics and Trade", "Finance"], 3, ["Humanities-Chinese", "Mathematics"])
undergraduate_group("School of Humanities", "Chinese", ["Advertising", "Broadcasting and TV Journalism", "Chinese Language and Literature"], 3, ["Humanities-Chinese", "Mathematics"])
undergraduate_group("International College", "English", ["International Economics and Trade (Specialized in Chinese Business)"], 3, ["Mathematics"])


GRADUATE: list[dict] = []


def graduate_group(college: str, degree: str, language: str, names: list[str], page: int) -> None:
    for name in names:
        duration = 4 if degree == "Doctoral" else (2.5 if name in {"Journalism and Communication (Professional Degree)", "International Chinese Education (Professional Degree)", "International Business (Professional Degree)"} else 3)
        tuition = {("Master", "Chinese"): 22600, ("Master", "English"): 24800, ("Doctoral", "Chinese"): 25000, ("Doctoral", "English"): 27800}[(degree, language)]
        GRADUATE.append(route(college, language, name, page, degreeLevel=degree, durationYears=duration, tuitionAmount=tuition))


graduate_group("College of Chemical Engineering", "Master", "English", ["Chemical Engineering and Technology", "Chemistry", "Material and Chemical Industry (Professional Degree)"], 1)
graduate_group("College of Chemical Engineering", "Master", "Chinese", ["Chemical Engineering and Technology", "Chemistry", "Material and Chemical Industry (Professional Degree)"], 1)
graduate_group("College of Chemical Engineering", "Doctoral", "English", ["Chemical Engineering and Technology", "Material and Chemical Industry (Professional Degree)"], 1)
graduate_group("College of Chemical Engineering", "Doctoral", "Chinese", ["Chemical Engineering and Technology", "Material and Chemical Industry (Professional Degree)"], 1)
graduate_group("College of Biotechnology and Bioengineering", "Master", "Chinese", ["Bioengineering"], 2)
graduate_group("College of Biotechnology and Bioengineering", "Doctoral", "Chinese", ["Bioengineering"], 2)
graduate_group("College of Pharmaceutical Science", "Master", "English", ["Pharmaceutical Science"], 2)
graduate_group("College of Pharmaceutical Science", "Master", "Chinese", ["Pharmaceutical Science"], 2)
graduate_group("College of Pharmaceutical Science", "Doctoral", "English", ["Pharmaceutical Science"], 2)
graduate_group("College of Pharmaceutical Science", "Doctoral", "Chinese", ["Pharmaceutical Science"], 2)
graduate_group("College of Environment", "Master", "Chinese", ["Resources & Environment (Professional Degree)", "Environmental Science & Engineering"], 2)
graduate_group("College of Environment", "Doctoral", "Chinese", ["Environmental Science & Engineering"], 2)
graduate_group("College of Material Science & Engineering", "Master", "Chinese", ["Material and Chemical Industry (Professional Degree)", "Chemical Engineering and Technology"], 2)
graduate_group("College of Material Science & Engineering", "Doctoral", "Chinese", ["Material and Chemical Industry (Professional Degree)", "Chemical Engineering and Technology"], 2)
graduate_group("College of Food Science and Technology", "Master", "Chinese", ["Food Science and Engineering", "Food and Nutrition (Professional Degree)"], 2)
graduate_group("College of Food Science and Technology", "Doctoral", "Chinese", ["Biological and Pharmaceutical Engineering (Professional Degree)"], 2)
graduate_group("College of Mechanical Engineering", "Master", "Chinese", ["Mechanical Engineering", "Mechanics (Professional Degree)", "Power Engineering and Engineering Thermophysics", "Energy and Power (Professional Degree)"], 2)
graduate_group("College of Mechanical Engineering", "Doctoral", "Chinese", ["Mechanical Engineering", "Mechanics (Professional Degree)", "Power Engineering and Engineering Thermophysics", "Energy and Power (Professional Degree)"], 2)
graduate_group("College of Information Engineering", "Master", "Chinese", ["Information and Communication Engineering"], 2)
graduate_group("College of Information Engineering", "Doctoral", "Chinese", ["Control Science and Engineering"], 2)
graduate_group("College of Computer Science & Technology (College of Software)", "Doctoral", "English", ["Computer Science and Technology"], 2)
graduate_group("College of Computer Science & Technology (College of Software)", "Doctoral", "Chinese", ["Computer Science and Technology"], 2)
graduate_group("College of Civil Engineering", "Master", "English", ["Civil and Hydraulic Engineering (Professional Degree)"], 2)
graduate_group("College of Civil Engineering", "Master", "Chinese", ["Civil and Hydraulic Engineering (Professional Degree)"], 2)
graduate_group("College of Civil Engineering", "Doctoral", "English", ["Civil Engineering"], 2)
graduate_group("College of Civil Engineering", "Doctoral", "Chinese", ["Civil Engineering"], 2)
graduate_group("School of Design and Architecture", "Master", "Chinese", ["Urban and Rural Planning", "Design (Professional Degree)", "Design Studies"], 2)
graduate_group("College of Geoinformatics", "Master", "Chinese", ["Environmental Science and Engineering"], 2)
graduate_group("College of Geoinformatics", "Doctoral", "English", ["Computer Science and Technology", "Environmental Science and Engineering"], 2)
graduate_group("College of Geoinformatics", "Doctoral", "Chinese", ["Environmental Science and Engineering"], 2)
graduate_group("Science and Education Integration College of Energy and Carbon Neutralization", "Doctoral", "Chinese", ["Energy and Power (Professional Degree)"], 2)
graduate_group("School of Management", "Master", "English", ["Business Administration"], 3)
graduate_group("School of Economics", "Master", "English", ["Applied Economics", "International Business (Professional Degree)"], 3)
graduate_group("School of Economics", "Doctoral", "Chinese", ["Applied Economics"], 3)
graduate_group("College of Education (College of Vocational and Technical Education)", "Master", "Chinese", ["Pedagogy", "Education Technology", "Applied Psychology (Professional Degree)"], 3)
graduate_group("School of Humanities", "Master", "Chinese", ["Journalism and Communication (Professional Degree)", "International Chinese Education (Professional Degree)"], 3)
graduate_group("Law School", "Master", "Chinese", ["Chinese Law (Juris Master) (Professional Degree)"], 3)


undergraduate_source, undergraduate_pdf = source(SOURCES["undergraduate"])
graduate_source, graduate_pdf = source(SOURCES["graduate"])
def table_text(path: Path) -> str:
    cells: list[str] = []
    page_text: list[str] = []
    with pdfplumber.open(path) as document:
        for page in document.pages[:3]:
            page_text.append(normalized(page.extract_text() or ""))
            for table in page.extract_tables():
                for row in table:
                    cells.extend(str(cell) for cell in row if cell)
    return "|".join([*(normalized(cell) for cell in cells), *page_text])


undergraduate_text = table_text(undergraduate_pdf)
graduate_text = table_text(graduate_pdf)

for item in UG:
    if normalized(item["nameEn"].replace("Polymer Materials", "Polymer materials")) not in undergraduate_text:
        raise RuntimeError(f"Undergraduate route not found in reviewed PDF: {item['nameEn']}")
    item.update({"sourceId": undergraduate_source["id"], "sourceUrl": undergraduate_source["url"], "sourceSha256": undergraduate_source["sha256"], "capturedAt": undergraduate_source["fetchedAt"], "sourceLocator": f"PDF page {item['sourcePage']}, Catalogue of Specialty table"})
for item in GRADUATE:
    compact_name = normalized(item["nameEn"].replace("Chinese Law (Juris Master) (Professional Degree)", "Chinese Law (Juris Master)(Professional Degree)"))
    if compact_name not in graduate_text:
        raise RuntimeError(f"Graduate route not found in reviewed PDF: {item['nameEn']}")
    item.update({"sourceId": graduate_source["id"], "sourceUrl": graduate_source["url"], "sourceSha256": graduate_source["sha256"], "capturedAt": graduate_source["fetchedAt"], "sourceLocator": f"PDF page {item['sourcePage']}, Catalogue of Specialty table"})

programs = UG + GRADUATE
keys = [(row["degreeLevel"], row["collegeEn"], row["nameEn"], row["teachingLanguage"]) for row in programs]
counts = {
    "total": len(programs),
    "Undergraduate": len(UG),
    "Master": sum(row["degreeLevel"] == "Master" for row in GRADUATE),
    "Doctoral": sum(row["degreeLevel"] == "Doctoral" for row in GRADUATE),
    "Chinese": sum(row["teachingLanguage"] == "Chinese" for row in programs),
    "English": sum(row["teachingLanguage"] == "English" for row in programs),
}
expected = {"total": 103, "Undergraduate": 43, "Master": 35, "Doctoral": 25, "Chinese": 75, "English": 28}
if counts != expected or len(keys) != len(set(keys)):
    raise RuntimeError(f"ZJUT extraction invariant failed: counts={counts}, duplicates={len(keys)-len(set(keys))}")

payload = {
    "version": 1,
    "schoolSlug": "zhejiang-university-of-technology",
    "academicYear": "2026",
    "method": "locked route matrix transcribed from pdfplumber tables and visually checked against every rendered PDF page",
    "sources": [
        {"sourceId": undergraduate_source["id"], "pages": 12, "routes": len(UG), "sha256": undergraduate_source["sha256"]},
        {"sourceId": graduate_source["id"], "pages": 12, "routes": len(GRADUATE), "sha256": graduate_source["sha256"]},
    ],
    "counts": counts,
    "duplicateRouteKeys": len(keys) - len(set(keys)),
    "programs": programs,
}
body = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
OUTPUT.write_text(body, encoding="utf-8", newline="\n")
print(json.dumps({"ok": True, "output": str(OUTPUT), "sha256": hashlib.sha256(body.encode()).hexdigest(), "counts": counts}, ensure_ascii=False, indent=2))
