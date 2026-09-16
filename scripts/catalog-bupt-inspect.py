from __future__ import annotations

import json
import sys
from pathlib import Path

import pdfplumber


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: catalog-bupt-inspect.py <brochure.pdf>")

    pdf_path = Path(sys.argv[1]).resolve()
    pages: list[dict[str, object]] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            pages.append(
                {
                    "page": page_number,
                    "text": page.extract_text(x_tolerance=2, y_tolerance=2) or "",
                    "tables": page.extract_tables(),
                }
            )

    print(json.dumps({"pdf": str(pdf_path), "pageCount": len(pages), "pages": pages}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
