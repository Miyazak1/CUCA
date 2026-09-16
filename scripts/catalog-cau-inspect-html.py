import html
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

class TextParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
    def handle_data(self, data):
        value = html.unescape(data).strip()
        if value:
            self.parts.append(value)

root = Path("work/catalog-official/cau-complete-batch-01/raw")
patterns = re.compile(r"deadline|application time|application period|tuition|coverage|scholarship|stipend|allowance|May|June|July|February|March|April", re.I)
for path in sorted(root.glob("*.html")):
    parser = TextParser()
    parser.feed(path.read_text(encoding="utf-8", errors="replace"))
    text = "\n".join(parser.parts)
    lines = [line for line in text.splitlines() if patterns.search(line)]
    print(json.dumps({"file": path.name, "matches": lines[:80]}, ensure_ascii=False, indent=2))
