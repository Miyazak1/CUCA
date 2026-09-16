from __future__ import annotations

import json
import sys
from html import unescape
from html.parser import HTMLParser
from pathlib import Path


class ArticleParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.article_depth = 0
        self.table_depth = 0
        self.cell_depth = 0
        self.cell: list[str] = []
        self.row: list[str] = []
        self.rows: list[list[str]] = []
        self.text: list[str] = []
        self.links: list[dict[str, str]] = []
        self.pending_link: str | None = None
        self.link_text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "div" and "wp_articlecontent" in (values.get("class") or ""):
            self.article_depth += 1
        elif self.article_depth and tag == "div":
            self.article_depth += 1
        if not self.article_depth:
            return
        if tag == "table":
            self.table_depth += 1
        elif tag == "tr" and self.table_depth:
            self.row = []
        elif tag in ("td", "th") and self.table_depth:
            self.cell_depth += 1
            self.cell = []
        elif tag == "a" and values.get("href"):
            self.pending_link = values["href"]
            self.link_text = []

    def handle_endtag(self, tag: str) -> None:
        if not self.article_depth:
            return
        if tag in ("td", "th") and self.cell_depth:
            self.row.append(" ".join(" ".join(self.cell).split()))
            self.cell_depth -= 1
        elif tag == "tr" and self.table_depth and any(self.row):
            self.rows.append(self.row)
        elif tag == "table" and self.table_depth:
            self.table_depth -= 1
        elif tag == "a" and self.pending_link:
            self.links.append({"href": self.pending_link, "text": " ".join(self.link_text)})
            self.pending_link = None
            self.link_text = []
        elif tag == "div":
            self.article_depth -= 1

    def handle_data(self, data: str) -> None:
        if not self.article_depth:
            return
        clean = " ".join(unescape(data).split())
        if not clean:
            return
        self.text.append(clean)
        if self.cell_depth:
            self.cell.append(clean)
        if self.pending_link:
            self.link_text.append(clean)


def main() -> None:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "work/catalog-official/nuaa-complete-batch-01")
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    result = []
    for source in manifest["sources"]:
        parser = ArticleParser()
        parser.feed((root / source["artifactPath"]).read_text(encoding="utf-8", errors="replace"))
        result.append({"id": source["id"], "article": " | ".join(parser.text), "tables": parser.rows, "links": parser.links})
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
