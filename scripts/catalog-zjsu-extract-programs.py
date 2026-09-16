#!/usr/bin/env python3
"""Extract ZJSU 2026 degree-program rows from the six reviewed official PDFs."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import pdfplumber


ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT / "work" / "catalog-official" / "zjsu-program-pdfs-batch-01"
MANIFEST = RUN / "manifest.json"
OUTPUT = ROOT / "work" / "catalog-official" / "zjsu-complete-batch-01" / "programs.extracted.json"

SOURCE_CONFIG = {
    "zjsu-undergraduate-programs-english-pdf-2026": ("Undergraduate", "English", 8, True),
    "zjsu-undergraduate-programs-chinese-pdf-2026": ("Undergraduate", "Chinese", 22, True),
    "zjsu-master-programs-english-pdf-2026": ("Master", "English", 7, False),
    "zjsu-master-programs-chinese-pdf-2026": ("Master", "Chinese", 25, False),
    "zjsu-doctoral-programs-english-pdf-2026": ("Doctoral", "English", 11, False),
    "zjsu-doctoral-programs-chinese-pdf-2026": ("Doctoral", "Chinese", 9, False),
}

TEXT_FIXES = {
    "Computer Scienceand Technology": "Computer Science and Technology",
    "ComputerScienceand Technology": "Computer Science and Technology",
    "ComputerScienceandTechnology": "Computer Science and Technology",
    "Visual Communicatio nDesign": "Visual Communication Design",
    "BrandDesign": "Brand Design",
    "Interactionand Experience Design": "Interaction and Experience Design",
    "Architectureand InteriorDesign": "Architecture and Interior Design",
    "DigitalMedia Arts": "Digital Media Arts",
    "Videoand Photography Creationin Communication andExperience": "Video and Photography Creation in Communication and Experience",
    "Chinese Languageand Literature": "Chinese Language and Literature",
    "SocialWork": "Social Work",
    "CFAChartered Financial Analyst": "CFA (Chartered Financial Analyst)",
    "TourismManagement": "Tourism Management",
    "LinguisticsandApplied LinguisticsinForeign languages": "Linguistics and Applied Linguistics in Foreign Languages",
    "Linguisticsand Applied Linguisticsin Foreignlanguages": "Linguistics and Applied Linguistics in Foreign Languages",
    "Englishlanguageand literature": "English Language and Literature",
    "Englishlanguage andliterature": "English Language and Literature",
    "FinancialStatistics RiskManagementand InsuranceActuarial": "Financial Statistics, Risk Management and Insurance Actuarial",
    "InternationalTrade": "International Trade",
    "DigitalTrade": "Digital Trade",
    "Environmental Scienceand Engineering": "Environmental Science and Engineering",
    "Resourcesand Environment": "Resources and Environment",
    "ArtDesign": "Art Design",
    "DesignManagementand TheoreticalResearch": "Design Management and Theoretical Research",
    "ProductDesignandDigitalMedia TheoryResearch": "Product Design and Digital Media Theory Research",
    "CommunicationDesignand TheoreticalResearch": "Communication Design and Theoretical Research",
    "EnvironmentalArtDesignand TheoreticalResearch": "Environmental Art Design and Theoretical Research",
    "Management Scienceand Engineering": "Management Science and Engineering",
    "Logistics Engineeringand Management": "Logistics Engineering and Management",
    "StudyofChinese ClassicalText": "Study of Chinese Classical Text",
    "Theoryof LiteratureandArt": "Theory of Literature and Art",
    "AncientChinese Literature": "Ancient Chinese Literature",
    "Modernand Contemporary ChineseLiterature": "Modern and Contemporary Chinese Literature",
    "Comparative Literatureand WorldLiterature": "Comparative Literature and World Literature",
    "ChinesePhilology": "Chinese Philology",
    "International ChineseLanguage Education": "International Chinese Language Education",
    "LandResource Management": "Land Resource Management",
    "SocialSecurity": "Social Security",
    "JapaneseLanguage andLiterature": "Japanese Language and Literature",
    "01 JapaneseLanguage 02 JapaneseLanguageandLiterature 03 JapaneseCulture": "Japanese Language / Japanese Language and Literature / Japanese Culture",
    "JapaneseTranslation": "Japanese Translation",
    "Countryand RegionalStudies": "Country and Regional Studies",
    "01 EastAsianHistoryandCultures 02 EastAsianBusinessStudies / 03 ComprehensiveResearchonthe KoreanPeninsula": "East Asian History and Cultures / East Asian Business Studies / Comprehensive Research on the Korean Peninsula",
    "BusinessAdministration": "Business Administration",
    "Foreignlanguage and literature": "Foreign Language and Literature",
    "Foreign languageand literature": "Foreign Language and Literature",
    "LinguisticsandApplied LinguisitcsinForeign Languages": "Linguistics and Applied Linguistics in Foreign Languages",
    "Western Literature and ComparativeLiterature": "Western Literature and Comparative Literature",
    "WesternLiteratureand ComparativeLiterature": "Western Literature and Comparative Literature",
    "Financial StatisticsRisk Managementand InsuranceActuarial": "Financial Statistics, Risk Management and Insurance Actuarial",
    "Food Scienceand Engineering": "Food Science and Engineering",
    "(FoodNutrition(Food ScienceandNutrition)": "Food Nutrition (Food Science and Nutrition)",
    "FoodNutrition(Food ScienceandNutrition)": "Food Nutrition (Food Science and Nutrition)",
    "FoodSafety (Food Quality and Safety)": "Food Safety (Food Quality and Safety)",
    "FoodSafety(FoodQuality andSafety)": "Food Safety (Food Quality and Safety)",
    "ProcessingandPreservation ofAgricultural Products": "Processing and Preservation of Agricultural Products",
    "ProcessingandPreservation ofAgriculturalProducts": "Processing and Preservation of Agricultural Products",
    "ProcessingandPreservation ofAquaticProducts": "Processing and Preservation of Aquatic Products",
    "FoodBiotechnology": "Food Biotechnology",
}

SCHOOL_RANGES = {
    "zjsu-undergraduate-programs-english-pdf-2026": [
        (1, 1, "School of Business Administration (MBA)"), (2, 2, "School of Oriental Language and Philosophy"),
        (3, 3, "School of Law"), (4, 4, "School of Accounting"), (5, 5, "School of Tourism and Urban-Rural Planning"),
        (6, 7, "School of Management and E-Business (School of Cross-border E-commerce)"), (8, 8, "School of Finance (School of Zheshang Asset Management)"),
    ],
    "zjsu-undergraduate-programs-chinese-pdf-2026": [
        (2, 4, "School of Accounting"), (5, 7, "School of Computer Science and Technology"),
        (8, 8, "School of Finance (School of Zheshang Asset Management)"), (9, 15, "Art Design College"),
        (16, 17, "School of Management and E-Business (School of Cross-border E-commerce)"), (18, 18, "School of Humanities"),
        (19, 21, "School of Public Administration"), (22, 22, "School of Future Communication"),
    ],
    "zjsu-master-programs-english-pdf-2026": [
        (1, 1, "School of Business Administration (MBA)"), (2, 2, "School of Computer Science and Technology"),
        (3, 3, "School of Tourism and Urban-Rural Planning"), (4, 5, "School of Foreign Languages"),
        (6, 6, "School of Statistics and Data Science"), (7, 7, "School of Economics"),
    ],
    "zjsu-master-programs-chinese-pdf-2026": [
        (1, 2, "School of Environmental Science and Engineering"), (3, 4, "School of Foreign Languages"),
        (5, 8, "Art Design College"), (9, 10, "School of Management and E-Business (School of Cross-border E-commerce)"),
        (11, 18, "School of Humanities"), (19, 21, "School of Public Administration"),
        (22, 25, "School of Oriental Language and Philosophy"),
    ],
    "zjsu-doctoral-programs-english-pdf-2026": [
        (1, 1, "School of Business Administration (MBA)"), (2, 2, "School of Accounting"),
        (3, 4, "School of Foreign Languages"), (5, 5, "School of Statistics and Data Science"),
        (6, 10, "School of Food Science and Biotechnology"), (11, 11, "School of Computer Science and Technology"),
    ],
    "zjsu-doctoral-programs-chinese-pdf-2026": [
        (1, 2, "School of Foreign Languages"), (3, 7, "School of Food Science and Biotechnology"),
        (8, 9, "School of Public Administration"),
    ],
}


def ascii_text(value: str | None) -> str:
    if not value:
        return ""
    value = value.encode("ascii", "ignore").decode("ascii")
    value = value.replace("\u00ad", "")
    return re.sub(r"\s+", " ", value).strip()


def clean_school(value: str) -> str:
    value = re.sub(r"^\(?SCHOOL\)?\s*", "", value, flags=re.I)
    value = re.sub(r"\s+\)", ")", value)
    value = re.sub(r"\(\s+", "(", value)
    return value.strip(" /,")


def clean_name(value: str) -> str:
    value = re.sub(r"^\(?MAJOR\)?\s*", "", value, flags=re.I)
    value = re.sub(r"\s+([,)])", r"\1", value)
    value = re.sub(r"([(])\s+", r"\1", value)
    value = value.strip(" /,")
    return TEXT_FIXES.get(value, value)


def official_school(source_id: str, row_number: int, fallback: str) -> str:
    for start, end, school in SCHOOL_RANGES[source_id]:
        if start <= row_number <= end:
            return school
    return fallback


def official_major(source_id: str, row_number: int, fallback: str) -> str:
    if source_id == "zjsu-doctoral-programs-chinese-pdf-2026" and 3 <= row_number <= 7:
        return "Food Science and Engineering"
    return fallback


def normalize_language(value: str, fallback: str) -> str:
    languages = [name for name in ("Chinese", "English", "Japanese", "Arabic") if re.search(name, value, re.I)]
    if not languages:
        return fallback
    return "/".join(languages)


def route_key(row: dict) -> str:
    compact = lambda value: re.sub(r"[^a-z0-9]+", "", (value or "").lower())
    return "|".join(
        [row["degreeLevel"], compact(row["teachingLanguage"]), compact(row["majorEn"]), compact(row.get("fieldEn"))]
    )


manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
metadata = {source["id"]: source for source in manifest["sources"]}
if set(metadata) != set(SOURCE_CONFIG):
    raise RuntimeError("ZJSU program PDF manifest source set changed")

all_rows: list[dict] = []
source_counts: dict[str, int] = {}

for source_id, (degree, fallback_language, expected_count, has_csca) in SOURCE_CONFIG.items():
    source = metadata[source_id]
    artifact = RUN / source["artifactPath"]
    if hashlib.sha256(artifact.read_bytes()).hexdigest() != source["sha256"]:
        raise RuntimeError(f"ZJSU source artifact hash changed: {source_id}")

    source_rows: list[dict] = []
    carried_school = ""
    carried_major = ""
    with pdfplumber.open(artifact) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            table = page.extract_table()
            if not table:
                raise RuntimeError(f"No table found in {source_id} page {page_number}")
            for raw in table:
                cells = [ascii_text(cell) for cell in raw]
                # The final Chinese-master page begins with the third continuation
                # field for row 24, then omits the two vertically merged NO./SCHOOL
                # cells from row 25. Reconstruct only those visually verified cells.
                if source_id == "zjsu-master-programs-chinese-pdf-2026" and page_number == 5 and len(cells) == 8:
                    if not cells[0] and cells[1].startswith("03"):
                        if not source_rows or source_rows[-1]["sourceRowNumber"] != 24:
                            raise RuntimeError("ZJSU Chinese-master row 24 continuation lost its parent")
                        continuation = clean_name(cells[1])
                        source_rows[-1]["fieldEn"] = clean_name(f"{source_rows[-1]['fieldEn']} / {continuation}")
                        source_rows[-1]["nameEn"] = f"{source_rows[-1]['majorEn']} - {source_rows[-1]['fieldEn']}"
                        continue
                    cells = ["25", carried_school, *cells]
                if not cells or not re.fullmatch(r"\d+", cells[0] or ""):
                    continue
                expected_columns = 11 if has_csca else 10
                if len(cells) != expected_columns:
                    raise RuntimeError(f"Unexpected {source_id} row width {len(cells)} on page {page_number}: {cells}")

                row_number = int(cells[0])
                school = official_school(source_id, row_number, clean_school(cells[1]) or carried_school)
                major = official_major(source_id, row_number, clean_name(cells[2]) or carried_major)
                if not school or not major:
                    raise RuntimeError(f"Unresolved merged school/major in {source_id} page {page_number}: {cells}")
                carried_school, carried_major = school, major

                field = clean_name(cells[3])
                if field in ("", "/"):
                    field = ""
                language = normalize_language(cells[5], fallback_language)
                tuition_index = 8 if has_csca else 7
                duration_index = 9 if has_csca else 8
                awarded_index = 10 if has_csca else 9
                tuition_values = [int(value) for value in re.findall(r"\b\d{4,6}\b", cells[tuition_index])]
                if not tuition_values:
                    raise RuntimeError(f"Missing tuition in {source_id} page {page_number} row {cells[0]}")
                duration_match = re.search(r"\d+(?:\.\d+)?", cells[duration_index])
                if not duration_match:
                    raise RuntimeError(f"Missing duration in {source_id} page {page_number} row {cells[0]}")
                name = major if not field else f"{major} - {field}"

                source_rows.append(
                    {
                        "sourceId": source_id,
                        "sourceSha256": source["sha256"],
                        "sourceLocator": f"{source_id} PDF page {page_number}, row {cells[0]}",
                        "sourceRowNumber": row_number,
                        "schoolEn": school,
                        "majorEn": major,
                        "fieldEn": field or None,
                        "nameEn": name,
                        "degreeLevel": degree,
                        "teachingLanguage": language,
                        "cscaRequirement": cells[6] if has_csca else None,
                        "note": cells[7] if has_csca else cells[6],
                        "tuitionAmount": tuition_values[0],
                        "tuitionText": cells[tuition_index],
                        "durationYears": float(duration_match.group(0)),
                        "awardedDegree": cells[awarded_index],
                    }
                )

    if len(source_rows) != expected_count:
        raise RuntimeError(
            f"Expected {expected_count} rows from {source_id}, found {len(source_rows)}; "
            f"row numbers={[row['sourceRowNumber'] for row in source_rows]}"
        )
    source_counts[source_id] = len(source_rows)
    all_rows.extend(source_rows)

by_key: dict[str, dict] = {}
duplicate_routes: list[dict] = []
for row in all_rows:
    key = route_key(row)
    if key in by_key:
        duplicate_routes.append({"routeKey": key, "kept": by_key[key]["sourceLocator"], "excluded": row["sourceLocator"]})
        continue
    by_key[key] = row

programs = list(by_key.values())
counts = {
    "rawTotal": len(all_rows),
    "total": len(programs),
    "Undergraduate": sum(row["degreeLevel"] == "Undergraduate" for row in programs),
    "Master": sum(row["degreeLevel"] == "Master" for row in programs),
    "Doctoral": sum(row["degreeLevel"] == "Doctoral" for row in programs),
    "ChineseSource": sum(SOURCE_CONFIG[row["sourceId"]][1] == "Chinese" for row in programs),
    "EnglishSource": sum(SOURCE_CONFIG[row["sourceId"]][1] == "English" for row in programs),
}
if counts != {"rawTotal": 82, "total": 81, "Undergraduate": 29, "Master": 32, "Doctoral": 20, "ChineseSource": 55, "EnglishSource": 26}:
    raise RuntimeError(f"Unexpected ZJSU extraction counts: {counts}")
if len(duplicate_routes) != 1 or "philosophy" not in duplicate_routes[0]["routeKey"]:
    raise RuntimeError(f"Unexpected ZJSU duplicate routes: {duplicate_routes}")

payload = {
    "version": 1,
    "generatedFromManifest": str(MANIFEST.relative_to(ROOT)).replace("\\", "/"),
    "sourceCounts": source_counts,
    "counts": counts,
    "duplicateRoutes": duplicate_routes,
    "programs": programs,
}
OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"ok": True, "output": str(OUTPUT), "counts": counts, "duplicateRoutes": duplicate_routes}, ensure_ascii=False, indent=2))
