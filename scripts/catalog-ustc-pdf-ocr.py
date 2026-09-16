from __future__ import annotations

import json
import re
from pathlib import Path

from rapidocr_onnxruntime import RapidOCR


ROOT = Path(__file__).resolve().parents[1]
IMAGE_DIR = ROOT / "tmp" / "pdfs" / "ustc"
OUTPUT = ROOT / "work" / "catalog-official" / "ustc-complete-batch-01" / "ocr-lines.json"


def page_number(path: Path) -> int:
    match = re.search(r"-(\d+)\.png$", path.name)
    if not match:
        raise ValueError(f"Page number missing from {path.name}")
    return int(match.group(1))


ocr = RapidOCR()
pages = []
for path in sorted(IMAGE_DIR.glob("ustc-*-programs-*-2026.*-*.png")):
    result, elapsed = ocr(str(path))
    lines = []
    for box, text, score in result or []:
        xs = [point[0] for point in box]
        ys = [point[1] for point in box]
        lines.append(
            {
                "text": text.strip(),
                "score": round(float(score), 6),
                "x0": round(min(xs), 2),
                "x1": round(max(xs), 2),
                "y0": round(min(ys), 2),
                "y1": round(max(ys), 2),
            }
        )
    pages.append(
        {
            "image": path.name,
            "page": page_number(path),
            "elapsed": elapsed,
            "lines": sorted(lines, key=lambda item: (item["y0"], item["x0"])),
        }
    )

OUTPUT.write_text(json.dumps({"version": 1, "pages": pages}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"ok": True, "pages": len(pages), "output": str(OUTPUT)}, ensure_ascii=False))
