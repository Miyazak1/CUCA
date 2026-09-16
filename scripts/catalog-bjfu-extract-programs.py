import html
import json
import re
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "work" / "catalog-official" / "bjfu-program-pages-01" / "raw"
OUTPUT = ROOT / "work" / "catalog-official" / "bjfu-program-pages-01" / "parsed-programs.json"


class TableParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables = []
        self.table = None
        self.row = None
        self.cell = None

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag == "table":
            self.table = []
        elif tag == "tr" and self.table is not None:
            self.row = []
        elif tag in ("td", "th") and self.row is not None:
            self.cell = []
        elif tag == "br" and self.cell is not None:
            self.cell.append(" ")

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in ("td", "th") and self.cell is not None:
            value = re.sub(r"\s+", " ", html.unescape("".join(self.cell))).strip()
            self.row.append(value)
            self.cell = None
        elif tag == "tr" and self.row is not None:
            if self.row:
                self.table.append(self.row)
            self.row = None
        elif tag == "table" and self.table is not None:
            self.tables.append(self.table)
            self.table = None


def source_file(prefix):
    matches = sorted(RAW.glob(f"{prefix}*.html"))
    if len(matches) != 1:
        raise RuntimeError(f"Expected one {prefix} source, found {len(matches)}")
    return matches[0]


def program_rows(path, default_language):
    parser = TableParser()
    parser.feed(path.read_text(encoding="utf-8"))
    selected = []
    for table_index, table in enumerate(parser.tables, start=1):
        rows = []
        language = default_language
        for row_index, row in enumerate(table, start=1):
            joined = " ".join(row).upper()
            if "CHINESE-TAUGHT PROGRAMS" in joined:
                language = "Chinese"
            elif "ENGLISH-TAUGHT PROGRAMS" in joined:
                language = "English"
            if len(row) == 4 and re.fullmatch(r"[2-5](?:-[2-5])?", row[3].strip()):
                rows.append((row_index, language, row))
        if rows:
            selected.extend((table_index, *row) for row in rows)
    return selected


specs = [
    ("bjfu-undergraduate-program-index-current", "Undergraduate", "Chinese"),
    ("bjfu-master-program-index-current", "Master", "English"),
    ("bjfu-doctoral-program-index-current", "Doctoral", "English"),
]
programs = []
table_counts = {}
for source_id, degree_level, default_language in specs:
    path = source_file(source_id)
    rows = program_rows(path, default_language)
    if not rows:
        raise RuntimeError(f"{source_id}: no program rows found")
    for table_index, source_row, language, row in rows:
        key = f"{degree_level}-{language}"
        table_counts[key] = table_counts.get(key, 0) + 1
        school, name, award, duration = row
        programs.append({
            "sourceId": source_id,
            "sourceFile": path.name,
            "sourceTable": table_index,
            "sourceRow": source_row,
            "school": school,
            "nameEn": name,
            "degreeAward": award,
            "durationText": duration,
            "degreeLevel": degree_level,
            "teachingLanguage": language,
        })

identities = {}
for row in programs:
    key = "|".join((row["degreeLevel"], row["teachingLanguage"], row["school"], row["nameEn"]))
    identities.setdefault(key, 0)
    identities[key] += 1
duplicates = sorted(key for key, count in identities.items() if count > 1)
if duplicates:
    raise RuntimeError(f"Duplicate exact program identities: {duplicates}")

payload = {
    "version": 1,
    "sourceDirectory": str(RAW.relative_to(ROOT)).replace("\\", "/"),
    "programCount": len(programs),
    "counts": table_counts,
    "duplicateIdentities": duplicates,
    "programs": programs,
}
OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"ok": True, "output": str(OUTPUT), "programCount": len(programs), "counts": table_counts}, indent=2))
