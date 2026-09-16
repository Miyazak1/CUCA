from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import pdfplumber


ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT / "work/catalog-official/bsu-complete-batch-01"
RAW = RUN / "raw"
OUTPUT = RUN / "parsed-programs.json"
SOURCE_ID = "bsu-international-program-catalog-2026"


def source_path() -> Path:
    matches = sorted(RAW.glob(f"{SOURCE_ID}.*"))
    if len(matches) != 1:
        raise RuntimeError(f"Expected one {SOURCE_ID} artifact, found {len(matches)}")
    return matches[0]


def ascii_text(value: str | None) -> str:
    if not value:
        return ""
    return " ".join(re.findall(r"[ -~]+", value)).strip()


def normalize(value: str) -> str:
    value = re.sub(r"\s+", " ", value).strip()
    value = value.replace("Sports T raining", "Sports Training")
    value = re.sub(r"^/\s+", "", value)
    value = re.sub(r"^-\s+", "", value)
    value = re.sub(r"Research-\s+", "Research-", value)
    return value


def money(value: str) -> int | None:
    match = re.search(r"(?:25|28|30|34|40|45),?000", value)
    return int(match.group(0).replace(",", "")) if match else None


def row_values(row: list[str | None]) -> list[str]:
    return [normalize(ascii_text(cell)) for cell in row]


def undergraduate(pages: list) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    school = ""
    pending: dict[str, object] | None = None
    for page_number in range(1, 6):
        table = (pages[page_number - 1].extract_tables() or [[]])[0]
        for table_row, raw in enumerate(table, start=1):
            cells = row_values(raw)
            if table_row == 1 and page_number == 1:
                continue
            if len(cells) == 7:
                school_cell, major, tuition_cell, courses = cells[0], cells[1], cells[4], cells[5]
            else:
                school_cell, major = cells[0], cells[1] if len(cells) > 1 else ""
                tuition_cell = cells[2] if len(cells) > 2 else ""
                courses = cells[3] if len(cells) > 3 else ""
            if school_cell:
                school = school_cell
            tuition = money(tuition_cell)
            if major:
                if pending and not pending.get("nameEn"):
                    pending["nameEn"] = major
                    if courses:
                        pending["mainCourses"] = courses
                    records.append(pending)
                    pending = None
                    continue
                record = {
                    "nameEn": major,
                    "schoolEn": school,
                    "degreeLevel": "Undergraduate",
                    "durationYears": 4,
                    "teachingLanguage": "Chinese",
                    "tuitionCnyPerYear": tuition,
                    "mainCourses": courses,
                    "sourceId": SOURCE_ID,
                    "sourceLocator": f"PDF page {page_number}, table row {table_row}",
                }
                records.append(record)
            elif tuition and school:
                pending = {
                    "nameEn": "",
                    "schoolEn": school,
                    "degreeLevel": "Undergraduate",
                    "durationYears": 4,
                    "teachingLanguage": "Chinese",
                    "tuitionCnyPerYear": tuition,
                    "mainCourses": courses,
                    "sourceId": SOURCE_ID,
                    "sourceLocator": f"PDF page {page_number}, table rows {table_row}-{table_row + 2}",
                }
            elif courses and records:
                records[-1]["mainCourses"] = normalize(f"{records[-1].get('mainCourses', '')} {courses}")
    if pending:
        raise RuntimeError("Unresolved undergraduate split row")
    return records


def graduate(pages: list, start: int, end: int, degree: str, tuition_default: int) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    school = ""
    subject = ""
    subject_parts: list[str] = []
    current_tuition = tuition_default
    for page_number in range(start, end + 1):
        table = (pages[page_number - 1].extract_tables() or [[]])[0]
        for table_row, raw in enumerate(table, start=1):
            cells = row_values(raw)
            if page_number in (6, 10) and table_row == 1:
                continue
            if degree == "Master":
                school_cell, subject_cell, direction, tuition_cell = (cells + ["", "", "", ""])[:4]
            else:
                _, school_cell, subject_cell, direction, tuition_cell = (cells + ["", "", "", "", ""])[:5]
            if school_cell:
                school = school_cell
            if subject_cell:
                # Some cells are physically split over several PDF rows. Hold short fragments
                # until the next route-bearing row instead of publishing them as records.
                if not direction and not money(tuition_cell):
                    subject_parts.append(subject_cell)
                else:
                    subject = subject_cell
                    subject_parts.clear()
            if direction:
                if subject_parts:
                    subject = normalize(" ".join(subject_parts))
                    subject_parts.clear()
                current_tuition = money(tuition_cell) or current_tuition
                # A direction split exactly at a page boundary has no new school/subject/tuition.
                if direction in {"Research-Aerobics", "Training"} and not school_cell and not subject_cell and not money(tuition_cell) and records and table_row == 1:
                    records[-1]["nameEn"] = normalize(f"{records[-1]['nameEn']} {direction}")
                    records[-1]["sourceLocator"] = f"{records[-1]['sourceLocator']}; continued PDF page {page_number}, table row {table_row}"
                    continue
                records.append(
                    {
                        "nameEn": direction,
                        "subjectEn": subject,
                        "schoolEn": school,
                        "degreeLevel": degree,
                        "durationYears": 2 if degree == "Master" and subject == "Teaching Chinese to Speakers of Other Languages" else (3 if degree == "Master" else 4),
                        "teachingLanguage": "Chinese",
                        "tuitionCnyPerYear": current_tuition,
                        "sourceId": SOURCE_ID,
                        "sourceLocator": f"PDF page {page_number}, table row {table_row}",
                    }
                )
    return records


with pdfplumber.open(source_path()) as pdf:
    pages = list(pdf.pages)
    programs = undergraduate(pages)
    programs += graduate(pages, 6, 9, "Master", 30000)
    programs += graduate(pages, 10, 12, "Doctoral", 40000)

training_schools = {
    "China Basketball College",
    "China Football College",
    "China Volleyball College",
    "School of Strength and Conditioning",
    "Sports Coaching College",
    "School of Art",
}
for row in programs:
    if row["degreeLevel"] == "Doctoral" and row["schoolEn"] in training_schools:
        row["subjectEn"] = "Physical Education and Sports Coaching"

counts = {level: sum(row["degreeLevel"] == level for row in programs) for level in ("Undergraduate", "Master", "Doctoral")}
expected = {"Undergraduate": 20, "Master": 50, "Doctoral": 36}
if counts != expected:
    raise RuntimeError(f"BSU route count mismatch: expected {expected}, got {counts}")
if any(not row.get("nameEn") or not row.get("schoolEn") or not row.get("tuitionCnyPerYear") for row in programs):
    raise RuntimeError("BSU parsed output contains missing required fields")
keys = [(row["degreeLevel"], row["schoolEn"], row["nameEn"]) for row in programs]
duplicates = len(keys) - len(set(keys))
if duplicates:
    raise RuntimeError(f"BSU parsed output contains {duplicates} duplicate route keys")

payload = {
    "version": 1,
    "sourceId": SOURCE_ID,
    "programCount": len(programs),
    "counts": counts,
    "duplicateRouteKeys": duplicates,
    "languageCounts": {"Chinese": len(programs)},
    "programs": programs,
}
body = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
OUTPUT.write_text(body, encoding="utf-8", newline="\n")
print(json.dumps({"ok": True, "output": str(OUTPUT), "sha256": hashlib.sha256(body.encode()).hexdigest(), **{k: v for k, v in payload.items() if k != "programs"}}, ensure_ascii=False, indent=2))
