from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OCR_DIR = ROOT / "work" / "catalog-official" / "dhu-complete-batch-01" / "ocr"
OUTPUT = ROOT / "work" / "catalog-official" / "dhu-complete-batch-01" / "program-rows.json"


UNDERGRADUATE_PAGE_1 = [
    "Fashion Design & Engineering",
    "Fashion & Apparel Design",
    "Product Design",
    "Environmental Design",
    "Visual Communication Design",
    "Digital Media Art",
    "Art & Technology",
    "Fashion & Accessory Design (Fashion Innovation)",
    "Environmental Design (Fashion Interior Design)",
    "International Economy & Trade",
    "Business Administration",
    "Finance",
    "Marketing",
    "Accounting",
    "Financial Management",
    "Information Management & Information System",
    "Electronic Commerce",
    "Supply Chain Management",
    "Administrative Management",
    "Public Relations",
    "Communication",
    "Law",
    "English",
    "Japanese",
]

UNDERGRADUATE_PAGE_2 = [
    "Textile Engineering",
    "Non-woven Materials & Engineering",
    "Functional Materials",
    "Mechanical Engineering",
    "Industrial Design",
    "Intelligent Manufacturing Engineering",
    "Electronic Information Engineering",
    "Communication Engineering",
    "Electrical Engineering & Automation",
    "Automation",
    "Artificial Intelligence",
    "Computer Science & Technology",
    "Software Engineering",
    "Information Security",
    "Data Science & Big Data Technology",
    "Intelligence Science & Technology",
    "Composite Materials & Engineering",
    "Polymer Materials & Engineering",
    "Inorganic Non-metallic Materials Engineering",
    "Bioengineering (Biopharmaceuticals)",
    "Biomedical Engineering",
    "Applied Chemistry",
    "Light Chemical Engineering",
    "Environmental Science",
    "Environmental Engineering",
    "Building Environment & Energy Application Engineering",
    "Energy & Environmental Systems Engineering",
    "Civil Engineering (Green Construction)",
    "Mathematics & Applied Mathematics",
    "Statistics (Financial Statistics and Risk Management)",
    "Applied Physics (Integrated Circuits and New Energy)",
    "Optoelectronic Information Science & Engineering",
]

MASTER_PAGE_1 = [
    "Fashion Design & Engineering",
    "Art Studies",
    "Design Studies",
    "Applied Economics",
    "Business Administration",
    "Management Science & Engineering",
    "History of Science & Technology",
    "Public Administration",
    "Non-woven Materials & Engineering",
    "Non-woven Materials & Engineering",
    "Textile Materials & Textiles Design",
    "Textile Materials & Textiles Design",
    "Textile Engineering",
    "Textile Engineering",
    "Biological & Biomimetic Materials",
    "Chemistry",
    "Functional & Intelligent Materials",
    "Nano Fibers & Hybrid Materials",
    "Nanoscience and Engineering",
    "Material Physics & Chemistry",
    "Materials Processing Engineering",
    "Materials Processing Engineering",
    "Materials Science",
    "Mechanical Engineering",
    "Materials Processing Engineering",
    "Marxism Theory",
]

MASTER_PAGE_2 = [
    "Solid Mechanics",
    "Mathematics",
    "Physics",
    "Biomedical Engineering",
    "Biomedical Engineering",
    "Biology",
    "Chemistry",
    "Chemical Engineering & Technology",
    "Textile Chemistry, Dyeing & Finishing Engineering",
    "Computer Science & Technology",
    "Computer Science & Technology",
    "Software Engineering",
    "Control Science & Engineering",
    "Electrical Engineering",
    "Electrical Engineering",
    "Information & Communication Engineering",
    "Information & Communication Engineering",
    "Civil Engineering",
    "Civil Engineering (Heating, Ventilation and Air-Conditioning Engineering)",
    "Environmental Engineering",
    "Environmental Engineering",
    "Environmental Science",
]

DOCTORAL_PAGE_1 = [
    (261, "Design Studies"),
    (341, "Fashion Design & Engineering"),
    (434, "Business Administration"),
    (512, "Management Science & Engineering"),
    (608, "History of Science & Technology"),
    (722, "Textile Engineering"),
    (820, "Textile Materials & Textiles Design"),
    (915, "Non-woven Materials & Engineering"),
    (1005, "Mechanical Engineering"),
    (1093, "New Energy Materials & Devices"),
    (1191, "Mathematics"),
    (1283, "Textile Industry & Scientific Socialism"),
]

DOCTORAL_PAGE_2 = [
    (233, "Chemistry"),
    (318, "Materials Science and Engineering"),
    (405, "Nanoscience and Engineering"),
    (492, "Materials and Chemical Engineering (Professional Degree)"),
    (578, "Energy and Power (Professional Degree)"),
    (664, "Biological Materials Science"),
    (734, "Chemistry"),
    (788, "Textile Chemistry, Dyeing & Finishing Engineering"),
    (885, "Civil Engineering"),
    (966, "Environmental Science & Engineering"),
    (1038, "Software Engineering"),
    (1090, "Low-altitude Technology and Engineering"),
    (1158, "Control Science & Engineering"),
    (1243, "Information & Communication Intelligent System"),
    (1325, "Artificial Intelligence"),
]


CONFIGS = {
    "undergraduate-1": {
        "file": "dhu-undergraduate-programs-pdf-2026-1.json",
        "degree": "Undergraduate",
        "names": UNDERGRADUATE_PAGE_1,
        "anchors": None,
        "columns": {"language": (540, 650), "campus": (650, 800), "award": (800, 900), "tuition": (1530, 1660), "language_req": (1660, 1800), "other": (1800, 1980), "csca": (1980, 2148)},
    },
    "undergraduate-2": {
        "file": "dhu-undergraduate-programs-pdf-2026-2.json",
        "degree": "Undergraduate",
        "names": UNDERGRADUATE_PAGE_2,
        "anchors": None,
        "columns": {"language": (750, 850), "campus": (850, 980), "award": (980, 1080), "tuition": (1700, 1820), "language_req": (1820, 1980), "other": (1980, 2010), "csca": (2010, 2148)},
    },
    "master-1": {
        "file": "dhu-master-programs-pdf-2026-1.json",
        "degree": "Master",
        "names": MASTER_PAGE_1,
        "anchors": None,
        "columns": {"language": (650, 750), "campus": (750, 880), "award": (880, 990), "tuition": (1620, 1730), "language_req": (1730, 1890), "other": (1890, 1980), "csca": (1980, 2148)},
    },
    "master-2": {
        "file": "dhu-master-programs-pdf-2026-2.json",
        "degree": "Master",
        "names": MASTER_PAGE_2,
        "anchors": None,
        "columns": {"language": (740, 840), "campus": (840, 970), "award": (970, 1080), "tuition": (1720, 1830), "language_req": (1830, 1985), "other": (1985, 2040), "csca": (2040, 2148)},
    },
    "doctoral-1": {
        "file": "dhu-doctoral-programs-pdf-2026-1.json",
        "degree": "Doctoral",
        "names": [name for _, name in DOCTORAL_PAGE_1],
        "anchors": [y for y, _ in DOCTORAL_PAGE_1],
        "columns": {"language": (515, 610), "campus": (610, 735), "award": (735, 850), "tuition": (1500, 1660), "language_req": (1660, 1850), "other": (1850, 1995), "csca": (1995, 2148)},
    },
    "doctoral-2": {
        "file": "dhu-doctoral-programs-pdf-2026-2.json",
        "degree": "Doctoral",
        "names": [name for _, name in DOCTORAL_PAGE_2],
        "anchors": [y for y, _ in DOCTORAL_PAGE_2],
        "columns": {"language": (580, 690), "campus": (690, 820), "award": (820, 930), "tuition": (1640, 1775), "language_req": (1775, 1970), "other": (1970, 2030), "csca": (2030, 2148)},
    },
}


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip(" /\t")


def unique(values: list[str]) -> list[str]:
    result: list[str] = []
    for value in values:
        if value and value not in result:
            result.append(value)
    return result


def field_category(name: str) -> str:
    if any(word in name for word in ("Fashion", "Design", "Art")):
        return "Fashion and Design"
    if any(word in name for word in ("Business", "Economics", "Management", "Accounting", "Finance", "Marketing", "Commerce", "Administrative", "Public Relations")):
        return "Business and Management"
    if any(word in name for word in ("Textile", "Non-woven")):
        return "Textile Science and Engineering"
    if any(word in name for word in ("Material", "Polymer", "Composite", "Nano")):
        return "Materials Science and Engineering"
    if any(word in name for word in ("Computer", "Software", "Information", "Artificial", "Intelligence", "Communication", "Electrical", "Automation", "Control")):
        return "Information and Computer Engineering"
    if any(word in name for word in ("Environmental", "Civil", "Building", "Energy")):
        return "Environment, Energy and Civil Engineering"
    if any(word in name for word in ("Chemistry", "Chemical", "Biology", "Bio", "Biomedical")):
        return "Chemistry and Biotechnology"
    if any(word in name for word in ("Mechanical", "Manufacturing", "Mechanics")):
        return "Mechanical Engineering"
    if any(word in name for word in ("Mathematics", "Statistics", "Physics")):
        return "Science"
    return "Humanities and Social Sciences"


def read_tokens(path: Path) -> list[dict[str, object]]:
    result = json.loads(path.read_text(encoding="utf-8"))[0]["res"]
    return [
        {"text": clean_text(text), "score": float(score), "x": int(box[0]), "y": int(box[1])}
        for text, score, box in zip(result["rec_texts"], result["rec_scores"], result["rec_boxes"], strict=True)
        if clean_text(text)
    ]


def collect(tokens: list[dict[str, object]], bounds: tuple[float, float], x_range: tuple[int, int]) -> list[str]:
    y1, y2 = bounds
    x1, x2 = x_range
    matches = [
        row for row in tokens
        if y1 <= int(row["y"]) < y2 and x1 <= int(row["x"]) < x2 and float(row["score"]) >= 0.55
    ]
    matches.sort(key=lambda row: (int(row["y"]), int(row["x"])))
    return unique([str(row["text"]) for row in matches])


def extract_page(key: str, config: dict[str, object]) -> list[dict[str, object]]:
    tokens = read_tokens(OCR_DIR / str(config["file"]))
    names = list(config["names"])
    anchors = config["anchors"]
    if anchors is None:
        language_x1, language_x2 = config["columns"]["language"]  # type: ignore[index]
        anchors = [
            int(row["y"]) for row in tokens
            if language_x1 <= int(row["x"]) < language_x2
            and re.fullmatch(r"(?:Chinese|English)", str(row["text"]))
        ]
    anchors = list(anchors)
    if len(names) != len(anchors):
        raise ValueError(f"{key}: {len(names)} names but {len(anchors)} row anchors")

    boundaries = [max(175, anchors[0] - 35)]
    boundaries.extend((left + right) / 2 for left, right in zip(anchors, anchors[1:]))
    boundaries.append(min(1380, anchors[-1] + 45))
    rows = []
    for index, (name, anchor) in enumerate(zip(names, anchors, strict=True)):
        bounds = (boundaries[index], boundaries[index + 1])
        values = {
            label: collect(tokens, bounds, x_range)
            for label, x_range in config["columns"].items()  # type: ignore[union-attr]
        }
        language = ", ".join(value for value in values["language"] if value in {"Chinese", "English", "Chinese/", "Chinese /"})
        language = language.replace("Chinese/", "Chinese, English").replace("Chinese /", "Chinese, English")
        language = language or ", ".join(values["language"])
        raw_tuition = " / ".join(value for value in values["tuition"] if "CNY" in value)
        amounts = unique([
            str(int(re.sub(r"\D", "", value)))
            for value in re.findall(r"CNY\s*([0-9][0-9,. ]*)", raw_tuition)
            if int(re.sub(r"\D", "", value)) >= 1000
        ])
        numeric_amounts = [int(value) for value in amounts]
        tuition_items = [f"CNY {value:,}" for value in numeric_amounts]
        rows.append({
            "page": key,
            "row": index + 1,
            "anchorY": anchor,
            "nameEn": name,
            "degreeLevel": config["degree"],
            "durationYears": 4 if config["degree"] in {"Undergraduate", "Doctoral"} else None,
            "durationText": "2.5-3 years" if config["degree"] == "Master" else "4 years",
            "fieldCategory": field_category(name),
            "teachingLanguage": language,
            "campus": ", ".join(values["campus"]),
            "scholarshipAvailable": any(value == "Yes" for value in values["award"]),
            "tuitionAmount": numeric_amounts[0] if len(numeric_amounts) == 1 else None,
            "tuitionText": " / ".join(tuition_items),
            "languageRequirement": " ".join(values["language_req"]),
            "otherRequirement": " ".join(values["other"]),
            "cscaRequirement": " ".join(values["csca"]),
        })
    return rows


rows = [row for key, config in CONFIGS.items() for row in extract_page(key, config)]
if len(rows) != 131:
    raise ValueError(f"Expected 131 program routes, found {len(rows)}")
OUTPUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"ok": True, "rows": len(rows), "output": str(OUTPUT)}, ensure_ascii=False))
