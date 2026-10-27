import json
import re
import sys

import pdfplumber


def english_fragment(line: str) -> str:
    match = re.search(r"[A-Z]", line)
    return line[match.start():].strip() if match else ""


def is_heading(value: str) -> bool:
    return bool(
        re.search(r"Degree Programs|Undergraduate Programs|academic years", value, re.I)
        or re.match(r"^(College|School|Business School|Law School|Foreign Studies College|Liberal Arts College|Music College|Fine Arts Academy|Health Science Center|Journalism and Communication College|First Affiliated Hospital|International College|Research Institute)", value)
        or value.startswith("Note:")
    )


def clean(value: str) -> str:
    value = re.sub(r"�+", "'", value).replace("’", "'")
    return re.sub(r"\s+", " ", value).strip()


def extract(pdf_path: str) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            if page_number <= 3:
                level, duration = "Bachelor", "4-5 academic years"
            elif page_number <= 9:
                level, duration = "Master", "2-3 academic years"
            else:
                level, duration = "Doctoral", "4 academic years"
            lines = (page.extract_text(x_tolerance=1, y_tolerance=3) or "").splitlines()
            pending = ""
            for raw in lines:
                value = clean(english_fragment(raw))
                if not value or value.isdigit() or value == "2027":
                    continue
                if pending:
                    value = clean(f"{pending} {value}")
                    pending = ""
                if value.count("(") > value.count(")"):
                    pending = value
                    continue
                if is_heading(value):
                    continue
                if level == "Master" and value.startswith("The duration of study"):
                    break
                if level == "Doctoral" and value.startswith("All HNNU doctoral"):
                    break
                if value in {"Engineering", "Culture", "Cultures", "Provincial People's Hospital)"}:
                    continue
                if value.startswith("Professional Master's Degree)") and rows:
                    rows[-1]["nameEn"] = clean(f"{rows[-1]['nameEn']} ({value}")
                    continue
                if value == "Degree)" and rows:
                    rows[-1]["nameEn"] = clean(f"{rows[-1]['nameEn']} {value}")
                    continue
                if level == "Doctoral" and value == "Law" and rows and rows[-1]["nameEn"].endswith("Protection"):
                    rows[-1]["nameEn"] = f"{rows[-1]['nameEn']} Law"
                    continue
                rows.append({"degreeLevel": level, "nameEn": value, "durationText": duration, "sourcePage": page_number})
    return rows


if __name__ == "__main__":
    if len(sys.argv) not in {2, 3}:
        raise SystemExit("Usage: catalog-hunnu-2027-programs-extract.py <official-pdf> [output-json]")
    output = f"{json.dumps({'version': 1, 'programs': extract(sys.argv[1])}, ensure_ascii=False, indent=2)}\n"
    if len(sys.argv) == 3:
        with open(sys.argv[2], "w", encoding="utf-8") as target:
            target.write(output)
    else:
        print(output, end="")
