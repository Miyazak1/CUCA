from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

from lxml import html


ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT / "work" / "catalog-official" / "scu-complete-batch-01"
MANIFEST = RUN / "manifest.json"
OUTPUT = RUN / "extracted-programs.json"


def clean(value: str) -> str:
    return " ".join(value.replace("\xa0", " ").split())


def expanded_rows(table) -> list[list[str]]:
    rows: list[list[str]] = []
    spans: dict[int, list[object]] = {}
    for tr in table.xpath(".//tr"):
        row: list[str] = []
        col = 0

        def inherit() -> None:
            nonlocal col
            while col in spans:
                remaining, value = spans[col]
                while len(row) <= col:
                    row.append("")
                row[col] = str(value)
                remaining = int(remaining) - 1
                if remaining:
                    spans[col][0] = remaining
                else:
                    del spans[col]
                col += 1

        for cell in tr.xpath("./th|./td"):
            inherit()
            value = clean(cell.text_content())
            rowspan = int(cell.get("rowspan", "1") or "1")
            colspan = int(cell.get("colspan", "1") or "1")
            for offset in range(colspan):
                index = col + offset
                while len(row) <= index:
                    row.append("")
                row[index] = value
                if rowspan > 1:
                    spans[index] = [rowspan - 1, value]
            col += colspan
        inherit()
        rows.append(row)
    return rows


def split_bilingual(value: str) -> tuple[str, str]:
    match = re.search(r"[A-Za-z]", value)
    if not match:
        return value, value
    return value[: match.start()].strip(), value[match.start() :].strip()


def parse_catalog(path: Path, degree: str, source_id: str) -> list[dict[str, object]]:
    document = html.fromstring(path.read_bytes())
    tables = document.xpath("//table")
    if len(tables) != 1:
        raise RuntimeError(f"Expected one program table in {path.name}, found {len(tables)}")
    rows = expanded_rows(tables[0])
    width = 5 if degree == "Bachelor" else 6
    language_col = 3 if degree == "Bachelor" else 4
    college_col = 1 if degree == "Bachelor" else 2
    major_col = 2 if degree == "Bachelor" else 3
    duration_col = 4 if degree == "Bachelor" else 5
    records: list[dict[str, object]] = []
    for index, row in enumerate(rows[2:], start=3):
        row += [""] * (width - len(row))
        language = clean(row[language_col])
        if language not in {"汉语", "英语"}:
            continue
        next_row = rows[index] if index < len(rows) else []
        next_row += [""] * (width - len(next_row))
        english_language = clean(next_row[language_col])
        if english_language not in {"Chinese", "English"}:
            raise RuntimeError(f"Missing English companion row after table row {index} in {path.name}: {row}")
        college_zh, college_en = split_bilingual(clean(row[college_col]))
        name_zh = clean(row[major_col])
        name_en = clean(next_row[major_col])
        duration_text = clean(row[duration_col])
        duration_match = re.search(r"\d+(?:\.\d+)?", duration_text)
        if not name_zh or not name_en or not duration_match:
            raise RuntimeError(f"Incomplete program row {index} in {path.name}: {row}")
        records.append(
            {
                "degreeLevel": degree,
                "collegeZh": college_zh,
                "collegeEn": college_en,
                "nameZh": name_zh,
                "nameEn": name_en,
                "teachingLanguage": english_language,
                "durationYears": float(duration_match.group()),
                "sourceId": source_id,
                "locator": f"program table rows {index}-{index + 1}",
            }
        )
    return records


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    by_id = {item["id"]: item for item in manifest["sources"]}
    specs = [
        ("scu-undergraduate-program-catalog-2026", "Bachelor"),
        ("scu-master-program-catalog-2026", "Master"),
        ("scu-doctoral-program-catalog-2026", "Doctoral"),
    ]
    programs: list[dict[str, object]] = []
    source_evidence: dict[str, dict[str, str]] = {}
    for source_id, degree in specs:
        source = by_id[source_id]
        path = RUN / source["artifactPath"]
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != source["sha256"]:
            raise RuntimeError(f"Snapshot hash mismatch: {source_id}")
        programs.extend(parse_catalog(path, degree, source_id))
        source_evidence[source_id] = {
            "url": source["finalUrl"],
            "sha256": source["sha256"],
            "capturedAt": source["fetchedAt"],
            "label": source["label"],
        }

    identities: set[tuple[str, str, str, str, str, float]] = set()
    duplicates: list[tuple[str, str, str, str, str, float]] = []
    for program in programs:
        identity = (
            str(program["degreeLevel"]),
            str(program["collegeEn"]).casefold(),
            str(program["nameZh"]),
            str(program["nameEn"]).casefold(),
            str(program["teachingLanguage"]),
            float(program["durationYears"]),
        )
        if identity in identities:
            duplicates.append(identity)
        identities.add(identity)
    if duplicates:
        raise RuntimeError(f"Duplicate degree/college/Chinese-name/English-name/language identities: {duplicates[:10]}")

    payload = {
        "version": 1,
        "generatedAt": manifest["generatedAt"],
        "schoolSlug": "sichuan-university",
        "counts": {
            "programs": len(programs),
            "bachelor": sum(p["degreeLevel"] == "Bachelor" for p in programs),
            "master": sum(p["degreeLevel"] == "Master" for p in programs),
            "doctoral": sum(p["degreeLevel"] == "Doctoral" for p in programs),
            "english": sum(p["teachingLanguage"] == "English" for p in programs),
            "chinese": sum(p["teachingLanguage"] == "Chinese" for p in programs),
        },
        "sources": source_evidence,
        "programs": programs,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "output": str(OUTPUT), "counts": payload["counts"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
