from __future__ import annotations

import json
import sys
from html import unescape
from html.parser import HTMLParser
from pathlib import Path


class TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.article_depth = 0
        self.table_depth = 0
        self.cell_depth = 0
        self.cell: list[str] = []
        self.row: list[str] = []
        self.tables: list[list[list[str]]] = []
        self.table: list[list[str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "div" and "wp_articlecontent" in (values.get("class") or ""):
            self.article_depth += 1
        elif self.article_depth and tag == "div":
            self.article_depth += 1
        if not self.article_depth:
            return
        if tag == "table":
            if self.table_depth == 0:
                self.table = []
            self.table_depth += 1
        elif tag == "tr" and self.table_depth:
            self.row = []
        elif tag in ("td", "th") and self.table_depth:
            self.cell_depth += 1
            self.cell = []

    def handle_endtag(self, tag: str) -> None:
        if not self.article_depth:
            return
        if tag in ("td", "th") and self.cell_depth:
            self.row.append(" ".join(" ".join(self.cell).split()))
            self.cell_depth -= 1
        elif tag == "tr" and self.table_depth and any(self.row):
            self.table.append(self.row)
        elif tag == "table" and self.table_depth:
            self.table_depth -= 1
            if self.table_depth == 0 and self.table:
                self.tables.append(self.table)
        elif tag == "div":
            self.article_depth -= 1

    def handle_data(self, data: str) -> None:
        if self.article_depth and self.cell_depth:
            clean = " ".join(unescape(data).split())
            if clean:
                self.cell.append(clean)


def parse_tables(path: Path) -> list[list[list[str]]]:
    parser = TableParser()
    parser.feed(path.read_text(encoding="utf-8", errors="replace"))
    return parser.tables


def find_table(tables: list[list[list[str]]], expected: list[str]) -> list[list[str]]:
    for table in tables:
        if table and table[0][: len(expected)] == expected:
            return table
    raise ValueError(f"table not found: {expected}")


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: catalog-nuaa-extract-programs.py <capture-dir> <output.json>")
    root = Path(sys.argv[1])
    output = Path(sys.argv[2])
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    sources = {row["id"]: root / row["artifactPath"] for row in manifest["sources"]}
    undergrad = find_table(parse_tables(sources["nuaa-undergraduate-admissions-2026"]), ["Major", "Core Courses", "Degree"])
    postgraduate = find_table(parse_tables(sources["nuaa-postgraduate-admissions-2026"]), ["College", "Major", "Master", "Ph.D"])

    programs: list[dict[str, object]] = []
    for row_number, row in enumerate(undergrad[1:], start=2):
        if len(row) != 3 or not row[0]:
            raise ValueError(f"unexpected undergraduate row {row_number}: {row}")
        for language in ("Chinese", "English"):
            programs.append({"nameEn": row[0], "degreeLevel": "Undergraduate", "collegeEn": None, "teachingLanguage": language, "sourceId": "nuaa-undergraduate-admissions-2026", "sourceTable": "Major List and Core Courses", "sourceRow": row_number, "degreeAward": row[2], "coreCourses": row[1]})

    current_college = ""
    for row_number, row in enumerate(postgraduate[1:], start=2):
        if len(row) == 4:
            current_college, major, master, doctoral = row
        elif len(row) == 3 and current_college:
            major, master, doctoral = row
        else:
            raise ValueError(f"unexpected postgraduate row {row_number}: {row}")
        if master == "√":
            programs.append({"nameEn": major, "degreeLevel": "Master", "collegeEn": current_college, "teachingLanguage": "English", "sourceId": "nuaa-postgraduate-admissions-2026", "sourceTable": "2026 NUAA Postgraduate Program list", "sourceRow": row_number})
        if doctoral == "√":
            programs.append({"nameEn": major, "degreeLevel": "Doctoral", "collegeEn": current_college, "teachingLanguage": "English", "sourceId": "nuaa-postgraduate-admissions-2026", "sourceTable": "2026 NUAA Postgraduate Program list", "sourceRow": row_number})

    identities = [(row["nameEn"], row["degreeLevel"], row["collegeEn"], row["teachingLanguage"]) for row in programs]
    duplicates = sorted({identity for identity in identities if identities.count(identity) > 1})
    counts = {
        f"{degree}:{language}": sum(1 for row in programs if row["degreeLevel"] == degree and row["teachingLanguage"] == language)
        for degree in ("Undergraduate", "Master", "Doctoral")
        for language in ("Chinese", "English")
    }
    result = {"programCount": len(programs), "counts": counts, "duplicateIdentities": duplicates, "programs": programs}
    if len(programs) != 77 or duplicates or counts != {"Undergraduate:Chinese": 6, "Undergraduate:English": 6, "Master:Chinese": 0, "Master:English": 35, "Doctoral:Chinese": 0, "Doctoral:English": 30}:
        raise ValueError(f"NUAA extraction mismatch: {counts}, duplicates={duplicates}")
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "output": str(output), "programCount": len(programs), "counts": counts}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
