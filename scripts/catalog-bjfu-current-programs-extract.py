from __future__ import annotations

import hashlib
import html
import json
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT / "work" / "catalog-official" / "2026-10-27T08-21-03-935Z"
OUTPUT = ROOT / "catalog-sources" / "bjfu-current-programs.extracted.json"
LOCKS = {
    "bjfu-undergraduate-program-index-current": "d338b308807d6f7b8da971f06b7e8e85072b890d4552add1ef0acca7fb167244",
    "bjfu-master-program-index-current": "c605d65c727a896b2e7dc9bc86e72b0367002a75cc5685e6134dc6e19faa4f3d",
    "bjfu-doctoral-program-index-current": "3dedd4523196202cf54bd7d7bc7c584b0c11beb99239f95cb5101f872695cb18",
}


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
            self.row.append(" ".join("".join(self.cell).split()))
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
sources = {source["id"]: source for source in manifest["sources"] if source["id"] in LOCKS}
if set(sources) != set(LOCKS):
    raise RuntimeError("Locked BJFU source is missing from manifest")

level_by_source = {
    "bjfu-undergraduate-program-index-current": "Bachelor",
    "bjfu-master-program-index-current": "Master",
    "bjfu-doctoral-program-index-current": "Doctoral",
}
rows: list[dict[str, object]] = []
table_counts: dict[str, list[int]] = {}
for source_id, expected_sha in LOCKS.items():
    source = sources[source_id]
    artifact = RUN / source["artifactPath"]
    payload = artifact.read_bytes()
    if hashlib.sha256(payload).hexdigest() != expected_sha or source["sha256"] != expected_sha:
        raise RuntimeError(f"Evidence hash mismatch: {source_id}")
    parser = TableParser()
    parser.feed(payload.decode("utf-8", errors="replace"))
    program_tables = [
        table for table in parser.tables
        if table and len(table[0]) >= 4 and "AREAS OF STUDY" in table[0]
    ]
    if not program_tables:
        raise RuntimeError(f"No program table found: {source_id}")
    table_counts[source_id] = []
    for table_index, table in enumerate(program_tables):
        language = "Chinese" if level_by_source[source_id] == "Bachelor" or table_index > 0 else "English"
        count = 0
        for row_index, cells in enumerate(table[1:], start=2):
            marker = " ".join(cells).upper()
            if "CHINESE-TAUGHT PROGRAMS" in marker:
                language = "Chinese"
                continue
            if "ENGLISH-TAUGHT PROGRAMS" in marker:
                language = "English"
                continue
            if len(cells) < 4 or cells[0] == "SCHOOL":
                continue
            school_name, name, degree, duration = (html.unescape(value).strip() for value in cells[:4])
            if not school_name or not name or not duration.isdigit():
                continue
            rows.append({
                "degreeLevel": level_by_source[source_id],
                "teachingLanguage": language,
                "schoolName": school_name,
                "nameEn": name,
                "publishedDegree": degree or None,
                "durationYears": int(duration),
                "sourceId": source_id,
                "sourceTable": table_index + 1,
                "sourceRow": row_index,
            })
            count += 1
        table_counts[source_id].append(count)

expected = {"Bachelor": 37, "Master": 71, "Doctoral": 41}
actual = {level: sum(1 for row in rows if row["degreeLevel"] == level) for level in expected}
if actual != expected:
    raise RuntimeError(f"Unexpected BJFU program counts: {actual}")
expected_languages = {
    "Bachelor:Chinese": 37,
    "Master:English": 9,
    "Master:Chinese": 62,
    "Doctoral:English": 10,
    "Doctoral:Chinese": 31,
}
actual_languages = {
    key: sum(1 for row in rows if f'{row["degreeLevel"]}:{row["teachingLanguage"]}' == key)
    for key in expected_languages
}
if actual_languages != expected_languages:
    raise RuntimeError(f"Unexpected BJFU language counts: {actual_languages}")
result = {
    "version": 1,
    "status": "deterministic_official_extraction",
    "publicationAuthorized": False,
    "databaseWriteAuthorized": False,
    "run": RUN.name,
    "sources": [
        {key: sources[source_id][key] for key in ("id", "label", "url", "finalUrl", "fetchedAt", "sha256")}
        for source_id in LOCKS
    ],
    "tableCounts": table_counts,
    "counts": {**actual, "total": len(rows), "byLanguage": actual_languages},
    "programs": rows,
}
OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"ok": True, "output": str(OUTPUT), "counts": result["counts"]}, ensure_ascii=False, indent=2))
