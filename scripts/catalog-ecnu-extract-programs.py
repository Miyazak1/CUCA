import argparse
import json
import re
from pathlib import Path

from lxml import html


CATALOGS = {
    "ecnu-undergraduate-program-catalog-2026": "Bachelor",
    "ecnu-master-program-catalog-2026": "Master",
    "ecnu-doctoral-program-catalog-2026": "Doctoral",
}

CIRCLED = {"④": 4, "⑤": 5, "⑥": 6}


def clean(value):
    return re.sub(r"\s+", " ", value or "").strip()


def cell_text(cell):
    return clean(" ".join(cell.xpath(".//text()[not(ancestor::script) and not(ancestor::style)]")))


def program_name(raw):
    value = clean(raw).replace("Enligh Taught", "English Taught")
    value = re.sub(r"\.pdf\s*$", "", value, flags=re.I)
    value = re.sub(r"[④⑤⑥]\s*\d{0,3}", "", value)
    value = re.sub(r"\s*\*\s*$", "", value)
    return clean(value)


def extract_catalog(path, source_id, degree):
    root = html.fromstring(path.read_bytes())
    rows = []
    school_nodes = root.xpath("//div[contains(concat(' ', normalize-space(@class), ' '), ' text_name_off ')]")
    for school_index, node in enumerate(school_nodes, start=1):
        school = clean(" ".join(node.xpath(".//text()")))
        tables = node.xpath("following::table[1]")
        if not school or not tables:
            continue
        table = tables[0]
        for row_index, tr in enumerate(table.xpath(".//tr[position()>1]"), start=2):
            cells = tr.xpath("./th|./td")
            if len(cells) < 4:
                continue
            values = [cell_text(cell) for cell in cells]
            raw_name = values[0]
            name = program_name(raw_name)
            if not name or name.lower() == "name":
                continue
            is_english = "*" in raw_name or bool(re.search(r"english[ -]?taught", raw_name, re.I))
            hsk_level = next((level for mark, level in CIRCLED.items() if mark in raw_name), None)
            score_match = re.search(r"[④⑤⑥]\s*(\d{3})", raw_name)
            duration_match = re.search(r"(\d+(?:\.\d+)?)", values[3])
            tuition_match = re.search(r"([\d,]+)", values[1])
            csca = values[4] if degree == "Bachelor" and len(values) >= 5 else None
            rows.append({
                "sourceId": source_id,
                "degreeLevel": degree,
                "school": school,
                "nameEn": name,
                "teachingLanguage": "English" if is_english else "Chinese",
                "hskLevel": hsk_level,
                "hskMinimumScore": int(score_match.group(1)) if score_match else None,
                "tuitionText": values[1],
                "tuitionCnyPerYear": int(tuition_match.group(1).replace(",", "")) if tuition_match else None,
                "campus": values[2],
                "durationYears": float(duration_match.group(1)) if duration_match else None,
                "cscaSubjects": csca,
                "locator": f"school section {school_index} ({school}), table row {row_index}",
            })
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    run = Path(args.run)
    manifest = json.loads((run / "manifest.json").read_text(encoding="utf-8"))
    by_id = {source["id"]: source for source in manifest["sources"]}
    rows = []
    for source_id, degree in CATALOGS.items():
        source = by_id[source_id]
        path = run / source["artifactPath"]
        rows.extend(extract_catalog(path, source_id, degree))
    identities = [(r["degreeLevel"], r["nameEn"].casefold(), r["school"].casefold(), r["teachingLanguage"], r["durationYears"], r["tuitionCnyPerYear"]) for r in rows]
    duplicates = sorted({identity for identity in identities if identities.count(identity) > 1})
    result = {
        "version": 1,
        "generatedAt": manifest["generatedAt"],
        "manifestPath": str((run / "manifest.json").as_posix()),
        "counts": {
            "total": len(rows),
            "Bachelor": sum(r["degreeLevel"] == "Bachelor" for r in rows),
            "Master": sum(r["degreeLevel"] == "Master" for r in rows),
            "Doctoral": sum(r["degreeLevel"] == "Doctoral" for r in rows),
            "English": sum(r["teachingLanguage"] == "English" for r in rows),
            "Chinese": sum(r["teachingLanguage"] == "Chinese" for r in rows),
        },
        "duplicateIdentities": duplicates,
        "programs": rows,
    }
    if not rows or duplicates:
        raise SystemExit(f"Program extraction failed: rows={len(rows)} duplicates={json.dumps(duplicates, ensure_ascii=False)}")
    Path(args.output).write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result["counts"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
