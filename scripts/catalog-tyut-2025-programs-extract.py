from __future__ import annotations

import hashlib
import html
import json
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT / "work" / "catalog-official" / "2026-10-27T08-35-49-485Z"
OUTPUT = ROOT / "catalog-sources" / "tyut-2025-programs.extracted.json"
SOURCE_ID = "tyut-international-program-catalog-page-2025"
SOURCE_SHA256 = "1126b3bfc9bdb623029f5925a56a7981c6ad12cae418de645d6e8e08d4b8dfc3"


class TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.tables: list[list[list[str]]] = []
        self.table: list[list[str]] | None = None
        self.row: list[str] | None = None
        self.cell: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "table":
            self.table = []
        elif tag == "tr" and self.table is not None:
            self.row = []
        elif tag in {"td", "th"} and self.row is not None:
            self.cell = []

    def handle_data(self, data: str) -> None:
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag in {"td", "th"} and self.cell is not None and self.row is not None:
            self.row.append(" ".join(html.unescape("".join(self.cell)).split()))
            self.cell = None
        elif tag == "tr" and self.row is not None and self.table is not None:
            if any(self.row):
                self.table.append(self.row)
            self.row = None
        elif tag == "table" and self.table is not None:
            if self.table:
                self.tables.append(self.table)
            self.table = None


manifest = json.loads((RUN / "manifest.json").read_text(encoding="utf-8"))
source = next((row for row in manifest["sources"] if row["id"] == SOURCE_ID), None)
if source is None or source["status"] != 200 or source["sha256"] != SOURCE_SHA256:
    raise RuntimeError("Locked TYUT program source is missing from manifest")
artifact = RUN / source["artifactPath"]
payload = artifact.read_bytes()
if hashlib.sha256(payload).hexdigest() != SOURCE_SHA256:
    raise RuntimeError("TYUT evidence hash mismatch")

parser = TableParser()
parser.feed(payload.decode("utf-8", errors="replace"))
program_tables = [table for table in parser.tables if any("duration of study" in " ".join(row).lower() for row in table[:2])]
if len(program_tables) != 3:
    raise RuntimeError(f"Expected three TYUT program tables, found {len(program_tables)}")

levels = (("Doctoral", 4), ("Master", 3), ("Bachelor", 4))
programs: list[dict[str, object]] = []
table_counts: dict[str, int] = {}
for (level, duration), table in zip(levels, program_tables):
    count = 0
    for source_row, cells in enumerate(table[1:], start=2):
        if len(cells) < 2:
            continue
        name_en = cells[0].strip().rstrip(".")
        name_zh = cells[1].strip()
        if not name_en or not name_zh:
            continue
        language = "Not stated"
        if level == "Bachelor" and len(cells) >= 3:
            marker = cells[2].lower()
            language = "English" if "english" in marker else "Chinese" if "chinese" in marker else "Not stated"
        programs.append({
            "sourceRow": source_row,
            "degreeLevel": level,
            "nameEn": name_en,
            "nameZh": name_zh,
            "durationYears": duration,
            "teachingLanguage": language,
            "catalogYear": 2025,
        })
        count += 1
    table_counts[level] = count

expected = {"Doctoral": 17, "Master": 31, "Bachelor": 19}
if table_counts != expected:
    raise RuntimeError(f"Unexpected TYUT program counts: {table_counts}")
result = {
    "version": 1,
    "status": "deterministic_official_extraction",
    "publicationAuthorized": False,
    "databaseWriteAuthorized": False,
    "run": RUN.name,
    "source": {key: source[key] for key in ("id", "label", "url", "finalUrl", "fetchedAt", "sha256")},
    "counts": {**table_counts, "total": len(programs)},
    "programs": programs,
}
OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"ok": True, "output": str(OUTPUT), "counts": result["counts"]}, ensure_ascii=False, indent=2))
