from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("ocr_dir", type=Path)
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()

    ocr_dir = args.ocr_dir.resolve()
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    summaries = []
    for source in sorted(ocr_dir.glob("dhu-*.json")):
        result = json.loads(source.read_text(encoding="utf-8"))[0]["res"]
        texts = result["rec_texts"]
        scores = result["rec_scores"]
        boxes = result["rec_boxes"]
        if not (len(texts) == len(scores) == len(boxes)):
            raise ValueError(f"OCR arrays differ in {source}")

        rows = []
        for text, score, box in zip(texts, scores, boxes, strict=True):
            x1, y1, x2, y2 = map(int, box)
            rows.append(
                {
                    "y": y1,
                    "x": x1,
                    "x2": x2,
                    "y2": y2,
                    "score": float(score),
                    "text": text.replace("\t", " ").replace("\n", " "),
                }
            )
        rows.sort(key=lambda row: (row["y"], row["x"]))

        target = output_dir / f"{source.stem}.tsv"
        with target.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(
                handle,
                fieldnames=["y", "x", "x2", "y2", "score", "text"],
                dialect="excel-tab",
            )
            writer.writeheader()
            writer.writerows(rows)

        low = [row for row in rows if row["score"] < 0.75]
        summaries.append(
            {
                "page": source.stem,
                "tokens": len(rows),
                "lowConfidence": len(low),
                "minimumScore": min(row["score"] for row in rows),
                "output": str(target),
            }
        )

    print(json.dumps({"pages": summaries}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
