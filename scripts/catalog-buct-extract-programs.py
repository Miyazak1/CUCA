import html
import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "work" / "catalog-official" / "buct-complete-batch-01" / "raw"
OUTPUT = ROOT / "work" / "catalog-official" / "buct-complete-batch-01" / "parsed-programs.json"


class TableParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables, self.table, self.row, self.cell = [], None, None, None
        self.anchor_depth = 0

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag == "table": self.table = []
        elif tag == "tr" and self.table is not None: self.row = []
        elif tag in ("td", "th") and self.row is not None: self.cell = []
        elif tag == "a" and self.cell is not None: self.anchor_depth += 1
        elif tag in ("br", "p", "div", "li") and self.cell is not None: self.cell.append(" ")

    def handle_data(self, data):
        # The official tables render bare URLs as linked text inside school cells.
        # They are evidence/navigation, not part of a school or program name.
        if self.cell is not None and self.anchor_depth == 0: self.cell.append(data)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag == "a" and self.anchor_depth:
            self.anchor_depth -= 1
        elif tag in ("td", "th") and self.cell is not None:
            self.row.append(re.sub(r"\s+", " ", html.unescape("".join(self.cell))).strip())
            self.cell = None
        elif tag == "tr" and self.row is not None:
            if self.row: self.table.append(self.row)
            self.row = None
        elif tag == "table" and self.table is not None:
            self.tables.append(self.table)
            self.table = None


def source_file(prefix):
    matches = sorted(RAW.glob(f"{prefix}*.html"))
    if len(matches) != 1: raise RuntimeError(f"Expected one {prefix} source, found {len(matches)}")
    return matches[0]


def languages(value):
    normalized = re.sub(r"\band\b", "/", value.replace(" ", " "), flags=re.I)
    tokens = [token for token in re.split(r"[\s/,;]+", normalized.strip()) if token]
    allowed = {"chinese": "Chinese", "english": "English", "french": "French"}
    if not tokens or any(token.lower() not in allowed for token in tokens): return []
    return list(dict.fromkeys(allowed[token.lower()] for token in tokens))


def clean_school(value):
    value = re.sub(r"\s*Supervisor\s+List\s*:?\s*$", "", value, flags=re.I).strip()
    return {
        "College of information Science and Technology": "College of Information Science and Technology",
        "Beijing Advanced innovation Centerfor Soft Matter Science and Engineering": "Beijing Advanced Innovation Center for Soft Matter Science and Engineering",
    }.get(value, value)


def rows_for(path, degree_level):
    parser = TableParser(); parser.feed(path.read_text(encoding="utf-8"))
    candidates = []
    for table_index, table in enumerate(parser.tables, start=1):
        current_school, current_subjects, parsed = None, None, []
        for row_index, cells in enumerate(table, start=1):
            if not cells or any("Medium of" in cell for cell in cells): continue
            medium_index = next((index for index, cell in enumerate(cells) if languages(cell)), None)
            if medium_index is None or medium_index == 0: continue
            medium = cells[medium_index]
            major = cells[medium_index - 1]
            prefix = cells[:medium_index - 1]
            if prefix: current_school = clean_school(prefix[-1])
            if not current_school or not major or len(major) > 180: continue
            subjects = cells[medium_index + 1] if degree_level == "Undergraduate" and len(cells) > medium_index + 1 else None
            if subjects: current_subjects = subjects
            elif degree_level == "Undergraduate": subjects = current_subjects
            for language in languages(medium):
                parsed.append({"sourceTable": table_index, "sourceRow": row_index, "school": current_school, "nameEn": major.replace("※", "").strip(), "degreeLevel": degree_level, "teachingLanguage": language, "cscaSubjectsText": subjects})
        if parsed: candidates.append(parsed)
    if not candidates: raise RuntimeError(f"No program table found in {path.name}")
    return max(candidates, key=len)


specs = [
    ("buct-undergraduate-programs-2026", "Undergraduate"),
    ("buct-master-programs-2026", "Master"),
    ("buct-doctoral-programs-2026", "Doctoral"),
]
programs = []
for source_id, degree_level in specs:
    path = source_file(source_id)
    rows = rows_for(path, degree_level)
    for row in rows: programs.append({"sourceId": source_id, "sourceFile": path.name, **row})

identities = {}
for row in programs:
    key = "|".join((row["degreeLevel"], row["teachingLanguage"], row["school"], row["nameEn"]))
    identities[key] = identities.get(key, 0) + 1
duplicates = sorted(key for key, count in identities.items() if count > 1)
if duplicates: raise RuntimeError(f"Duplicate exact program identities: {duplicates}")
counts = {}
for row in programs:
    key = f'{row["degreeLevel"]}-{row["teachingLanguage"]}'
    counts[key] = counts.get(key, 0) + 1
payload = {"version": 1, "sourceDirectory": str(RAW.relative_to(ROOT)).replace("\\", "/"), "programCount": len(programs), "counts": counts, "duplicateIdentities": duplicates, "programs": programs}
OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"ok": True, "output": str(OUTPUT), "programCount": len(programs), "counts": counts}, indent=2))
