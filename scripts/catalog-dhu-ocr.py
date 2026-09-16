from __future__ import annotations

import argparse
import json
import os
import sys
import types
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LOCAL_DEPS = ROOT / "work" / "python-deps" / "dhu-ocr"
sys.path.insert(0, str(LOCAL_DEPS))

# PaddleX imports ModelScope eagerly even when Hugging Face is the selected
# model host.  The installed ModelScope pulls in a broken optional Torch DLL,
# so keep that unused provider out of this OCR-only process.
modelscope = types.ModuleType("modelscope")


def _disabled_modelscope(*_args: object, **_kwargs: object) -> None:
    raise RuntimeError("ModelScope is disabled; PaddleX must use Hugging Face")


modelscope.snapshot_download = _disabled_modelscope  # type: ignore[attr-defined]
sys.modules["modelscope"] = modelscope
os.environ.setdefault("PADDLE_PDX_MODEL_SOURCE", "huggingface")
os.environ.setdefault(
    "PADDLE_PDX_CACHE_HOME",
    str(ROOT / "work" / "python-deps" / "dhu-ocr-models"),
)

from paddleocr import PaddleOCR  # noqa: E402


def serialise_result(result: object) -> dict[str, object]:
    payload = getattr(result, "json", None)
    if callable(payload):
        payload = payload()
    if isinstance(payload, str):
        parsed = json.loads(payload)
        if isinstance(parsed, dict):
            return parsed
    if isinstance(payload, dict):
        return payload

    data = getattr(result, "res", None)
    if isinstance(data, dict):
        return data
    raise TypeError(f"Unsupported PaddleOCR result type: {type(result)!r}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("image", type=Path, nargs="?")
    parser.add_argument("output", type=Path, nargs="?")
    parser.add_argument("--batch-dir", type=Path)
    parser.add_argument("--output-dir", type=Path)
    args = parser.parse_args()

    if args.batch_dir:
        if args.image or args.output or not args.output_dir:
            parser.error("--batch-dir requires --output-dir and no positional paths")
        batch_dir = args.batch_dir.resolve()
        images = sorted(batch_dir.glob("*.png"))
        if not images:
            raise FileNotFoundError(f"No PNG files in {batch_dir}")
        output_dir = args.output_dir.resolve()
        targets = [(image, output_dir / f"{image.stem}.json") for image in images]
    else:
        if not args.image or not args.output or args.output_dir:
            parser.error("provide IMAGE OUTPUT, or --batch-dir with --output-dir")
        targets = [(args.image.resolve(), args.output.resolve())]

    for image, output in targets:
        if not image.is_file():
            raise FileNotFoundError(image)
        output.parent.mkdir(parents=True, exist_ok=True)

    ocr = PaddleOCR(
        lang="en",
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
    )
    completed = []
    for image, output in targets:
        rows = [serialise_result(result) for result in ocr.predict(str(image))]
        output.write_text(
            json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        completed.append({"image": str(image), "output": str(output), "results": len(rows)})
    print(json.dumps({"ok": True, "completed": completed}))


if __name__ == "__main__":
    main()
