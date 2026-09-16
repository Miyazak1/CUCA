from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_DIR = ROOT / "work" / "catalog-official" / "sdu-complete-batch-01" / "image-evidence"
OUTPUT_DIR = ROOT / "work" / "catalog-official" / "sdu-complete-batch-01" / "scholarship-review-slices"
TARGET_WIDTH = 1778
SLICE_HEIGHT = 1800


def main() -> None:
    manifest = json.loads((EVIDENCE_DIR / "manifest.json").read_text(encoding="utf-8"))
    sources = [source for source in manifest["sources"] if source["sourceRole"] == "scholarship"]
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    index: list[dict[str, object]] = []
    Image.MAX_IMAGE_PIXELS = None
    for source in sources:
        image_path = EVIDENCE_DIR / source["artifactPath"]
        with Image.open(image_path) as opened:
            image = opened.convert("RGB")
            if image.width != TARGET_WIDTH:
                scaled_height = round(image.height * TARGET_WIDTH / image.width)
                image = image.resize((TARGET_WIDTH, scaled_height), Image.Resampling.LANCZOS)
            slice_count = (image.height + SLICE_HEIGHT - 1) // SLICE_HEIGHT
            slices: list[str] = []
            for slice_index in range(slice_count):
                top = slice_index * SLICE_HEIGHT
                bottom = min(image.height, top + SLICE_HEIGHT)
                output_path = OUTPUT_DIR / f"{source['id']}.part-{slice_index + 1:02d}.jpg"
                image.crop((0, top, image.width, bottom)).save(output_path, quality=92, optimize=True)
                slices.append(output_path.relative_to(ROOT).as_posix())
            index.append({
                "sourceId": source["id"],
                "sourceSha256": source["sha256"],
                "normalizedSize": [image.width, image.height],
                "slices": slices,
            })

    (OUTPUT_DIR / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "sourceCount": len(index), "sliceCount": sum(len(item["slices"]) for item in index)}, indent=2))


if __name__ == "__main__":
    main()
