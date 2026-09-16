import json
from pathlib import Path

import pdfplumber


ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT / "work" / "catalog-official" / "ahu-programs-batch-01"
MANIFEST = json.loads((RUN / "manifest.json").read_text(encoding="utf-8"))
OUTPUT = RUN / "parsed-programs.json"


def clean(value):
    return " ".join((value or "").replace("\n", " ").split())


def parse_source(source):
    degree = "Undergraduate" if "undergraduate" in source["id"] else "Master"
    pdf_path = RUN / source["artifactPath"]
    programs = []
    current_school = None
    with pdfplumber.open(pdf_path) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            tables = page.extract_tables()
            if len(tables) != 1:
                raise RuntimeError(f"Expected one table on {source['id']} page {page_number}, found {len(tables)}")
            for row_number, row in enumerate(tables[0][1:], start=2):
                if len(row) != 6:
                    raise RuntimeError(f"Unexpected table width on {source['id']} page {page_number} row {row_number}")
                school = clean(row[2])
                if school:
                    current_school = school
                major = clean(row[5])
                sequence = clean(row[3])
                if not current_school or not major or not sequence.isdigit():
                    raise RuntimeError(f"Incomplete row on {source['id']} page {page_number} row {row_number}: {row}")
                programs.append({
                    "degreeLevel": degree,
                    "school": current_school,
                    "major": major,
                    "sequence": int(sequence),
                    "sourceId": source["id"],
                    "sourceUrl": source["finalUrl"],
                    "sourceLabel": source["label"],
                    "sourceSha256": source["sha256"],
                    "capturedAt": source["fetchedAt"],
                    "sourcePage": page_number,
                    "sourceTableRow": row_number,
                })
    expected = 80 if degree == "Undergraduate" else 89
    sequences = [row["sequence"] for row in programs]
    if len(programs) != expected or sequences != list(range(1, expected + 1)):
        raise RuntimeError(f"{source['id']} sequence/count mismatch: {len(programs)} rows")
    return programs


all_programs = []
for source in MANIFEST["sources"]:
    all_programs.extend(parse_source(source))

identities = {(row["degreeLevel"], row["school"], row["major"]) for row in all_programs}
if len(identities) != len(all_programs):
    raise RuntimeError("Duplicate AHU degree/school/major identity detected")

payload = {
    "version": 1,
    "generatedAt": MANIFEST["generatedAt"],
    "sourceCount": len(MANIFEST["sources"]),
    "programCount": len(all_programs),
    "degreeCounts": {
        "Undergraduate": sum(row["degreeLevel"] == "Undergraduate" for row in all_programs),
        "Master": sum(row["degreeLevel"] == "Master" for row in all_programs),
    },
    "programs": all_programs,
}
OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"ok": True, "outputPath": str(OUTPUT), "programCount": len(all_programs), "degreeCounts": payload["degreeCounts"]}, ensure_ascii=False, indent=2))
