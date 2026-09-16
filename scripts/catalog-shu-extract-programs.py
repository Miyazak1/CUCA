"""Extract Shanghai University 2026 degree routes from reviewed official PDFs.

The parser intentionally reads only the published program-table pages. It does not
extract bank accounts, contacts, applicant data, or other free-form PDF content.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pdfplumber


ROOT = Path(__file__).resolve().parents[1]
PRIMARY_DIR = ROOT / "work" / "catalog-official" / "shu-complete-batch-01"
ENGLISH_DIR = ROOT / "work" / "catalog-official" / "shu-en-program-guides-01"
OUTPUT = PRIMARY_DIR / "parsed-programs.json"


def load_manifest(directory: Path) -> tuple[dict, dict[str, Path]]:
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    paths = {
        row["id"]: directory / row["artifactPath"]
        for row in manifest["sources"]
        if row.get("status") == 200 and row.get("artifactPath")
    }
    return manifest, paths


def clean(value: str | None) -> str:
    value = re.sub(r"\s+", " ", value or "").strip()
    value = value.replace("��", "'").replace("（", "(").replace("）", ")")
    return value


def readable_name(value: str) -> str:
    value = clean(value)
    value = re.sub(r"(?<=[a-z])(?:and|of|in|to|for)(?=[A-Z])", lambda m: f" {m.group(0)} ", value)
    value = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", value)
    value = re.sub(r"(?<=[A-Z])(?=[A-Z][a-z])", " ", value)
    value = re.sub(r"\s*&\s*", " & ", value)
    value = re.sub(r"\s+", " ", value).strip()
    replacements = {
        "Biomedicalengineering": "Biomedical Engineering",
        "Foodscience": "Food Science",
        "Softwareengineering": "Software Engineering",
        "Theoretical Physics": "Theoretical Physics",
        "Condensed Matter Physics": "Condensed Matter Physics",
        "Applied Mathematics": "Applied Mathematics",
        "Intelligentscienceandtechnology": "Intelligent Science and Technology",
        "Inorganicnon-metallicmaterials engineering": "Inorganic Non-metallic Materials Engineering",
        "Newenergymaterialsanddevices": "New Energy Materials and Devices",
        "Traditional Chinesepainting": "Traditional Chinese Painting",
        "Artmanagement": "Art Management",
        "Industrialart": "Industrial Art",
        "Archive Science": "Archives Science",
        "Music Performing": "Music Performance",
        "The Scienceof Law": "The Science of Law",
        "Chemistry Engineering & Technique": "Chemical Engineering and Technology",
        "Subjectonhistoryand constructionofthe CPC": "History and Development of the Communist Party of China",
        "Polymermaterialandengineering": "Polymer Materials and Engineering",
        "Dramafilmandtelevision directing": "Drama, Film and Television Directing",
        "Business Administration(Digit al Marketing)": "Business Administration (Digital Marketing)",
        "Business Administration(Inno vation and Entrepreneurship)": "Business Administration (Innovation and Entrepreneurship)",
        "Chinese Language(for Internationalstudents)": "Chinese Language (for International Students)",
        "Teaching Chinese to Speakersof Other Languages": "Teaching Chinese to Speakers of Other Languages",
        "Finance(Corporateand Quantitative Finance)": "Finance (Corporate and Quantitative Finance)",
        "International Economics & Trade(Cross-Border E- commerce)": "International Economics & Trade (Cross-Border E-commerce)",
        "Finance(Corporate Finance)": "Finance (Corporate Finance)",
        "Measurement Technologyand Instruments": "Measurement Technology and Instruments",
        "Mechanical Manufactureand Automation": "Mechanical Manufacture and Automation",
        "Signal & Informationprocessing": "Signal & Information Processing",
        "Art(Direction of Art Studies)": "Art (Direction of Art Studies)",
        "Painting(Oil Painting)": "Painting (Oil Painting)",
        "Painting(Prints Painting)": "Painting (Printmaking)",
        "Master of Laws(Non Law)": "Master of Laws (Non-Law)",
        "Master of Laws(Law)": "Master of Laws (Law)",
        "Drama,Film and Television Art Design": "Drama, Film and Television Art Design",
        "International Relations(International Relations and Diplomacy)": "International Relations (International Relations and Diplomacy)",
        "International Relations(International Organizations and Governance)": "International Relations (International Organizations and Governance)",
        "International Relations(International Development)": "International Relations (International Development)",
    }
    return replacements.get(value, value)


def clean_college(value: str | None, previous: str | None) -> str:
    if not value:
        if not previous:
            raise ValueError("Program row has no college context")
        return previous
    value = re.sub(r"https?://.*", "", value, flags=re.DOTALL)
    value = clean(value).strip()
    value = readable_name(value)
    value = re.sub(r"(?<=[a-z])(of|and)(?=\s*[A-Z])", r" \1 ", value)
    value = value.replace("Engineering&Science", "Engineering & Science")
    value = re.sub(r"\s+", " ", value).strip(" ,")
    replacements = {
        "MBA Centre": "MBA Center",
        "SILC Business School, Shanghai University": "SILC Business School",
        "SILC Business School (Location:Jiading Campus)": "SILC Business School",
        "School of Life Science": "School of Life Sciences",
    }
    value = replacements.get(value, value)
    value = re.sub(r"\s+", " ", value).strip(" ,")
    return value


def table_rows(pdf_path: Path, page_indexes: list[int], language_by_page: dict[int, str], source_id: str, degree: str) -> list[dict]:
    rows: list[dict] = []
    previous_college: str | None = None
    previous_csca = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page_index in page_indexes:
            page = pdf.pages[page_index]
            tables = page.extract_tables()
            for table_index, table in enumerate(tables):
                if not table or len(table[0]) < 5:
                    continue
                header = " ".join(clean(cell) for cell in table[0])
                if "Program" not in header:
                    continue
                for row_index, cells in enumerate(table[1:], start=2):
                    if len(cells) < 5:
                        continue
                    college_raw, name_raw = cells[0], cells[1]
                    name = readable_name(name_raw or "")
                    if not name or name.lower() in {"program", "programs"}:
                        continue
                    previous_college = clean_college(college_raw, previous_college)
                    if degree == "Bachelor":
                        language = clean(cells[2]).replace("&English", "& English")
                        duration_raw, tuition_raw = cells[3], cells[4]
                        category = "Bachelor"
                        csca = clean(cells[5] if len(cells) > 5 else "")
                        if csca:
                            previous_csca = csca
                        else:
                            csca = previous_csca
                    else:
                        language = language_by_page[page_index]
                        category_raw = clean(cells[2])
                        if category_raw.startswith("Academic") or category_raw == "PArocfaedsesimonical":
                            category = "Academic"
                        elif category_raw.startswith("Professional") or not category_raw:
                            category = "Professional"
                        else:
                            raise ValueError(f"Unexpected degree category {category_raw!r} on page {page_index + 1}: {name}")
                        duration_raw, tuition_raw = cells[3], cells[4]
                        csca = ""
                    duration = float(clean(duration_raw))
                    tuition = int(clean(tuition_raw))
                    rows.append({
                        "degreeLevel": degree,
                        "degreeCategory": category,
                        "nameEn": name,
                        "college": previous_college,
                        "teachingLanguage": language,
                        "durationYears": int(duration) if duration.is_integer() else duration,
                        "tuitionAmount": tuition,
                        "cscaSubjects": csca,
                        "sourceId": source_id,
                        "sourceLocator": f"official program table, page {page_index + 1}, table {table_index + 1}, row {row_index}",
                    })
    return rows


primary_manifest, primary_paths = load_manifest(PRIMARY_DIR)
english_manifest, english_paths = load_manifest(ENGLISH_DIR)

programs = []
programs.extend(table_rows(
    primary_paths["shu-undergraduate-guide-2026"],
    [9, 10, 11],
    {},
    "shu-undergraduate-guide-2026",
    "Bachelor",
))
programs.extend(table_rows(
    english_paths["shu-master-guide-en-2026"],
    [9, 10, 11, 12],
    {9: "Chinese", 10: "Chinese", 11: "Chinese", 12: "English"},
    "shu-master-guide-en-2026",
    "Master",
))
programs.extend(table_rows(
    english_paths["shu-doctoral-guide-en-2026"],
    [8, 9, 10],
    {8: "Chinese", 9: "Chinese", 10: "English"},
    "shu-doctoral-guide-en-2026",
    "Doctoral",
))

for row in programs:
    row["routeKey"] = "|".join([
        row["degreeLevel"], row["teachingLanguage"], row["college"], row["nameEn"], row["degreeCategory"]
    ]).lower()

route_keys = [row["routeKey"] for row in programs]
if len(route_keys) != len(set(route_keys)):
    duplicates = sorted({key for key in route_keys if route_keys.count(key) > 1})
    raise ValueError(f"Duplicate official routes: {duplicates}")

counts = {
    "programCount": len(programs),
    "degreeCounts": {degree: sum(row["degreeLevel"] == degree for row in programs) for degree in ("Bachelor", "Master", "Doctoral")},
    "languageCounts": {
        language: sum(row["teachingLanguage"] == language for row in programs)
        for language in sorted({row["teachingLanguage"] for row in programs})
    },
}
result = {
    **counts,
    "sourceManifestSha256": {
        "primary": next(row["sha256"] for row in primary_manifest["sources"] if row["id"] == "shu-undergraduate-guide-2026"),
        "masterEnglish": next(row["sha256"] for row in english_manifest["sources"] if row["id"] == "shu-master-guide-en-2026"),
        "doctoralEnglish": next(row["sha256"] for row in english_manifest["sources"] if row["id"] == "shu-doctoral-guide-en-2026"),
    },
    "programs": programs,
}
OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({**counts, "output": str(OUTPUT)}, ensure_ascii=False, indent=2))
