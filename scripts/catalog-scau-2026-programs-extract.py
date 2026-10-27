"""Deterministically extract SCAU's official 2026 international program PDFs.

The PDFs expose reliable English program names and ordinal numbers. Their embedded
Chinese font maps do not decode correctly, so Chinese labels are intentionally not
invented or retained as mojibake. This extractor is evidence-locked and produces a
review candidate only; it does not write to the catalog database.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import pdfplumber


ROOT = Path(__file__).resolve().parents[1]
RUN = "2026-10-27T08-46-18-229Z"
RUN_ROOT = ROOT / "work" / "catalog-official" / RUN
OUTPUT = ROOT / "catalog-sources" / "scau-2026-programs.extracted.json"

LOCKS = {
    "scau-international-undergraduate-program-catalog-pdf-2026": {
        "sha256": "57a59f23f64d546980fee8c1cefd03639ef39044393a0da19a855e3995827b58",
        "degreeLevel": "Undergraduate",
        "expected": 95,
        "majorColumn": 4,
    },
    "scau-international-master-program-catalog-pdf-2026": {
        "sha256": "480452f16b878f8d4cb1f8a1a8fb977862d90cbe5e803011b2c73dac5b1c766c",
        "degreeLevel": "Master",
        "expected": 80,
        "majorColumn": 3,
    },
    "scau-international-doctoral-program-catalog-pdf-2026": {
        "sha256": "3a2a636d303fad84e6b8a41e7a48252b1f5df98a4c0e3a5fbe85471af7a52f08",
        "degreeLevel": "Doctoral",
        "expected": 34,
        "majorColumn": 3,
    },
}

# The English program-type/study-length cells are visually merged across rows in
# the official tables. These ordinal sets are transcribed from those exact cells
# after rendering every page, while names continue to be extracted geometrically.
MASTER_PROFESSIONAL = {
    2, 4, 5, 8, 12, 13, 14, 17, 18, 19, 20, 21, 23, 26, 27, 28, 32, 34, 37,
    39, 41, 46, 49, 51, 53, 55, 56, 57, 61, 62, 63, 67, 70, 72, 73, 78, 80,
}
MASTER_TWO_YEAR = {61, 62, 63, 67, 70}
DOCTORAL_PROFESSIONAL = {2, 6, 9, 11, 18, 23, 33}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def clean(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def english(value: str | None) -> str:
    value = clean(value)
    return value if re.search(r"[A-Za-z]{2}", value) else ""


manifest = json.loads((RUN_ROOT / "manifest.json").read_text(encoding="utf-8"))
manifest_by_id = {row["id"]: row for row in manifest["sources"]}
programs: list[dict[str, object]] = []
source_summaries: list[dict[str, object]] = []
counts: dict[str, int] = {}

for source_id, lock in LOCKS.items():
    source = manifest_by_id.get(source_id)
    if not source or source.get("status") != 200 or source.get("sha256") != lock["sha256"]:
        raise RuntimeError(f"Missing locked SCAU source: {source_id}")
    path = RUN_ROOT / source["artifactPath"]
    if sha256(path) != lock["sha256"]:
        raise RuntimeError(f"SCAU evidence hash mismatch: {source_id}")

    extracted: list[dict[str, object]] = []
    with pdfplumber.open(path) as document:
        for page_number, page in enumerate(document.pages, start=1):
            for table in page.find_tables():
                if len(table.cells) < 20:
                    continue
                cells: list[dict[str, object]] = []
                for bbox in table.cells:
                    text = clean(page.crop(bbox).extract_text())
                    cells.append(
                        {
                            "bbox": bbox,
                            "text": text,
                            "x0": float(bbox[0]),
                            "x1": float(bbox[2]),
                            "centerY": (float(bbox[1]) + float(bbox[3])) / 2,
                        }
                    )

                numeric_columns: dict[float, list[dict[str, object]]] = {}
                for cell in cells:
                    if re.fullmatch(r"\d+", str(cell["text"])):
                        key = round(float(cell["x0"]), 2)
                        numeric_columns.setdefault(key, []).append(cell)
                if not numeric_columns:
                    continue
                column_x0 = sorted({round(float(cell["x0"]), 2) for cell in cells})
                ordinal_x0 = column_x0[2]
                ordinal_cells = numeric_columns.get(ordinal_x0, [])
                ordinal_cells = [
                    cell
                    for cell in ordinal_cells
                    if 1 <= int(str(cell["text"])) <= int(lock["expected"])
                ]
                ordinal_cells = list(
                    {
                        ordinal: min(
                            (cell for cell in ordinal_cells if int(str(cell["text"])) == ordinal),
                            key=lambda cell: float(cell["bbox"][3]) - float(cell["bbox"][1]),
                        )
                        for ordinal in {int(str(cell["text"])) for cell in ordinal_cells}
                    }.values()
                )
                ordinal_cells.sort(key=lambda cell: float(cell["centerY"]))
                if not ordinal_cells:
                    continue
                major_x0 = column_x0[int(lock["majorColumn"])]
                last_x0 = column_x0[-1]

                page_rows: list[dict[str, object]] = []
                for ordinal_cell in ordinal_cells:
                    page_rows.append(
                        {
                            "sourceOrdinal": int(str(ordinal_cell["text"])),
                            "sourcePage": page_number,
                            "degreeLevel": lock["degreeLevel"],
                            "centerY": float(ordinal_cell["centerY"]),
                            "nameFragments": [],
                            "durationFragments": [],
                            "programTypeFragments": [],
                            "catalogYear": 2026,
                            "sourceId": source_id,
                            "sourceSha256": source["sha256"],
                        }
                    )

                def nearest_row(cell: dict[str, object], max_distance: float = 42) -> dict[str, object] | None:
                    target = min(page_rows, key=lambda row: abs(float(row["centerY"]) - float(cell["centerY"])))
                    return target if abs(float(target["centerY"]) - float(cell["centerY"])) <= max_distance else None

                for cell in cells:
                    value = english(str(cell["text"]))
                    if not value:
                        continue
                    x0 = round(float(cell["x0"]), 2)
                    if abs(x0 - major_x0) <= 0.5 and value not in {"Major", "Majors"}:
                        target = nearest_row(cell)
                        if target:
                            target["nameFragments"].append((float(cell["centerY"]), value))
                    if abs(x0 - last_x0) <= 0.5:
                        top, bottom = float(cell["bbox"][1]), float(cell["bbox"][3])
                        targets = [row for row in page_rows if top <= float(row["centerY"]) <= bottom]
                        for target in targets:
                            distance = abs(float(target["centerY"]) - float(cell["centerY"]))
                            if re.fullmatch(r"[234] years?", value, flags=re.IGNORECASE):
                                target["durationFragments"].append((distance, value))
                            elif value in {"Academic", "Professional"}:
                                target["programTypeFragments"].append((distance, value))
                extracted.extend(page_rows)

    expected_ordinals = list(range(1, int(lock["expected"]) + 1))
    actual_ordinals = [int(row["sourceOrdinal"]) for row in extracted]
    if actual_ordinals != expected_ordinals:
        raise RuntimeError(f"Unexpected {lock['degreeLevel']} ordinals: {actual_ordinals}")

    for row in extracted:
        row.pop("centerY")
        name_en = clean(" ".join(value for _, value in sorted(row.pop("nameFragments"))))
        if not name_en:
            raise RuntimeError(f"Missing English name for {lock['degreeLevel']} #{row['sourceOrdinal']}")
        duration_candidates = sorted(row.pop("durationFragments"))
        program_type_candidates = sorted(row.pop("programTypeFragments"))
        durations = [duration_candidates[0][1]] if duration_candidates else []
        program_types = [program_type_candidates[0][1]] if program_type_candidates else []
        row["nameEn"] = name_en
        if durations:
            row["durationYears"] = int(durations[0].split()[0])
        if program_types:
            row["programType"] = program_types[0]
        ordinal = int(row["sourceOrdinal"])
        if lock["degreeLevel"] == "Master":
            row["durationYears"] = 2 if ordinal in MASTER_TWO_YEAR else 3
            row["programType"] = "Professional" if ordinal in MASTER_PROFESSIONAL else "Academic"
        elif lock["degreeLevel"] == "Doctoral":
            row["programType"] = "Professional" if ordinal in DOCTORAL_PROFESSIONAL else "Academic"
        programs.append(row)

    counts[str(lock["degreeLevel"])] = len(extracted)
    source_summaries.append(
        {
            "id": source["id"],
            "label": source["label"],
            "url": source.get("finalUrl") or source["url"],
            "fetchedAt": source["fetchedAt"],
            "sha256": source["sha256"],
        }
    )

payload = {
    "version": 1,
    "status": "deterministic_official_extraction",
    "publicationAuthorized": False,
    "databaseWriteAuthorized": False,
    "run": RUN,
    "sources": source_summaries,
    "counts": {**counts, "total": len(programs)},
    "limitations": [
        "The embedded Chinese font maps do not decode reliably; Chinese labels are omitted instead of storing mojibake.",
        "The catalogs are explicitly current for 2026 and do not establish a 2027 intake.",
        "Teaching language, admission requirements and application deadlines are not stated per program in these PDFs.",
    ],
    "programs": programs,
}
if payload["counts"] != {"Undergraduate": 95, "Master": 80, "Doctoral": 34, "total": 209}:
    raise RuntimeError(f"Unexpected SCAU counts: {payload['counts']}")

OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"ok": True, "output": str(OUTPUT), "counts": payload["counts"]}, indent=2))
