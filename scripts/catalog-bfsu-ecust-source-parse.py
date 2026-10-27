"""Parse the locked 2026 BFSU and ECUST official program tables.

This parser only writes normalized program rows into the ignored work directory.
It deliberately excludes supervisor names, email addresses, telephone numbers,
bank details, and other contact/payment data that are not catalog fields.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pandas as pd
import pdfplumber


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "work" / "catalog-official" / "bfsu-ecust-complete-2026"

BFSU_PDFS = {
    "undergraduate": ROOT / "work/catalog-official/2026-10-16T05-38-06-547Z/raw/bfsu-international-undergraduate-program-catalog-en-2026.8468397309cbc8615abde48cfd4dde37949be55bf46d3bac48c5452fa533861b.pdf",
    "master": ROOT / "work/catalog-official/2026-10-16T05-38-19-793Z/raw/bfsu-international-master-program-catalog-en-2026.2615a263880c8dccf89522a8fea6401a52cbe02e5df4abbdec5fca78ff62591e.pdf",
    "doctoral": ROOT / "work/catalog-official/2026-10-16T05-38-21-502Z/raw/bfsu-international-doctoral-program-catalog-en-2026.e2ee28d2840d89b1ce2d670f9228b2ee7ec203532acd590d8f4e10d426e1aa44.pdf",
}

ECUST_HTML = {
    "undergraduate": ROOT / "work/catalog-official/2026-10-16T05-38-08-580Z/raw/ecust-international-undergraduate-program-catalog-2026.bad3b7d0b2778675a4f326338ba67ded3defaa97fdaf29b6e28453ea853588e8.html",
    "master": ROOT / "work/catalog-official/2026-10-16T05-38-34-542Z/raw/ecust-international-master-program-catalog-en-2026.1eb8a37d52848f15f1f361cb446a9a2e6794a0a52a060ad197e870bbacd43a34.html",
    "doctoral": ROOT / "work/catalog-official/2026-10-16T05-38-21-669Z/raw/ecust-international-doctoral-program-catalog-en-2026.bbcd47325775797560b9993a6abea4ae51175bcf1573201442a0ee25e86c97ba.html",
}


ECUST_UG_TRANSLATIONS = {
    "化学工程与工艺": "Chemical Engineering and Technology",
    "生物工程（生物医药方向）": "Bioengineering (Biomedicine)",
    "智能制造工程": "Intelligent Manufacturing Engineering",
    "人工智能": "Artificial Intelligence",
    "国际经济与贸易": "International Economics and Trade",
    "视觉传达设计（数字设计方向）": "Visual Communication Design (Digital Design)",
    "计算机科学与技术": "Computer Science and Technology",
    "工商管理（商务分析）": "Business Administration (Business Analytics)",
    "资源循环科学与工程": "Resource Recycling Science and Engineering",
    "轻化工程": "Light Chemical Engineering",
    "油气储运工程": "Oil and Gas Storage and Transportation Engineering",
    "应用化学": "Applied Chemistry",
    "化学": "Chemistry",
    "材料化学（绿色与能源催化方向）": "Materials Chemistry (Green and Energy Catalysis)",
    "精细化工（光电信息材料方向）": "Fine Chemicals (Optoelectronic Information Materials)",
    "生物工程": "Bioengineering",
    "生物技术": "Biotechnology",
    "生物科学": "Biological Sciences",
    "食品科学与工程": "Food Science and Engineering",
    "食品质量与安全": "Food Quality and Safety",
    "药学": "Pharmacy",
    "高分子材料与工程": "Polymer Materials and Engineering",
    "无机非金属材料工程": "Inorganic Non-metallic Materials Engineering",
    "复合材料与工程": "Composite Materials and Engineering",
    "新能源材料与器件": "New Energy Materials and Devices",
    "电子信息材料": "Electronic Information Materials",
    "环境工程": "Environmental Engineering",
    "能源与动力工程": "Energy and Power Engineering",
    "储能科学与工程": "Energy Storage Science and Engineering",
    "机器人工程": "Robotics Engineering",
    "自动化": "Automation",
    "电气工程及其自动化": "Electrical Engineering and Automation",
    "信息工程": "Information Engineering",
    "软件工程": "Software Engineering",
    "过程装备与控制工程": "Process Equipment and Control Engineering",
    "机械设计制造及其自动化": "Mechanical Design, Manufacturing and Automation",
    "数学与应用数学": "Mathematics and Applied Mathematics",
    "信息与计算科学": "Information and Computing Science",
    "应用物理学": "Applied Physics",
    "光电信息科学与工程": "Optoelectronic Information Science and Engineering",
    "经济学": "Economics",
    "金融学": "Finance",
    "信息管理与信息系统（数据智能与智慧管理）": "Information Management and Information Systems (Data Intelligence and Smart Management)",
    "物流管理（供应链方向）": "Logistics Management (Supply Chain)",
    "会计学（大数据会计）": "Accounting (Big Data Accounting)",
    "财务管理（智能财务）": "Financial Management (Intelligent Finance)",
    "市场营销（大数据营销）": "Marketing (Big Data Marketing)",
    "行政管理": "Public Administration",
    "社会工作": "Social Work",
    "公共事业管理": "Public Service Administration",
    "社会学": "Sociology",
    "工业设计": "Industrial Design",
    "风景园林（未来人居环境方向）": "Landscape Architecture (Future Human Settlements)",
    "视觉传达设计": "Visual Communication Design",
    "环境设计": "Environmental Design",
    "数字媒体艺术": "Digital Media Art",
    "英语": "English",
    "日语": "Japanese",
    "德语": "German",
    "法学": "Law",
    "运动训练": "Sports Training",
}

ECUST_SCHOOL_TRANSLATIONS = {
    "化工学院": "School of Chemical Engineering",
    "化学与分子工程学院": "School of Chemistry and Molecular Engineering",
    "生物工程学院": "School of Bioengineering",
    "药学院": "School of Pharmacy",
    "材料科学与工程学院": "School of Materials Science and Engineering",
    "资源与环境工程学院": "School of Resources and Environmental Engineering",
    "信息科学与工程学院": "School of Information Science and Engineering",
    "机械与动力工程学院": "School of Mechanical and Power Engineering",
    "数学学院": "School of Mathematics",
    "物理学院": "School of Physics",
    "商学院": "School of Business",
    "社会与公共管理学院": "School of Social and Public Administration",
    "艺术设计与传媒学院": "School of Art Design and Media",
    "外国语学院": "School of Foreign Languages",
    "法学院": "School of Law",
    "体育科学与工程学院": "School of Sports Science and Engineering",
}


def clean(value: object) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    text = str(value).replace("\u00a0", " ").replace("\n", " ")
    text = text.replace("��", "").replace("（", "(").replace("）", ")")
    text = re.sub(r"(?<=[a-z])and(?=[A-Z])", " and ", text)
    text = re.sub(r"(?<=[a-z])and(?=\s)", " and", text)
    return re.sub(r"\s+", " ", text).strip()


def fill(value: object, state: dict[str, str], key: str) -> str:
    current = clean(value)
    if current:
        state[key] = current
    return state.get(key, "")


def split_code(value: str) -> tuple[str, str]:
    match = re.match(r"^([0-9]{4,6}[A-Z0-9]*)\s*(.*)$", value)
    if not match:
        return "", value
    return match.group(1), clean(match.group(2))


def number(value: str) -> float | None:
    match = re.search(r"\d+(?:\.\d+)?", value)
    return float(match.group()) if match else None


def parse_bfsu_undergraduate() -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    state: dict[str, str] = {}
    with pdfplumber.open(BFSU_PDFS["undergraduate"]) as pdf:
        for page_index, page in enumerate(pdf.pages, start=1):
            tables = page.extract_tables()
            if len(tables) != 1:
                raise RuntimeError(f"Unexpected BFSU undergraduate tables on page {page_index}: {len(tables)}")
            teaching_language = "English" if page_index == 3 else "Chinese"
            for row_index, raw in enumerate(tables[0][1:] if page_index in (1, 3) else tables[0], start=1):
                if len(raw) != 7:
                    raise RuntimeError(f"Unexpected BFSU undergraduate row width: {len(raw)}")
                discipline = fill(raw[0], state, "discipline")
                first_level = fill(raw[1], state, "first_level")
                major_raw = clean(raw[2])
                if not major_raw:
                    continue
                code, name = split_code(major_raw)
                csca = fill(raw[3], state, "csca")
                intake = fill(raw[4], state, "intake")
                tuition = fill(raw[5], state, "tuition")
                school = fill(raw[6], state, "school")
                rows.append({
                    "degreeLevel": "Undergraduate", "nameEn": name, "programCode": code,
                    "discipline": discipline, "fieldCategory": first_level, "teachingLanguage": teaching_language,
                    "cscaText": csca, "intakeText": intake, "tuitionAmount": int(float(tuition)),
                    "durationYears": 4, "school": school, "sourcePage": page_index, "sourceRow": row_index,
                })
    return rows


def parse_bfsu_master() -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    states = {6: {}, 7: {}}
    with pdfplumber.open(BFSU_PDFS["master"]) as pdf:
        for page_index, page in enumerate(pdf.pages, start=1):
            for table_index, table in enumerate(page.extract_tables(), start=1):
                width = len(table[0])
                if width not in (6, 7):
                    raise RuntimeError(f"Unexpected BFSU master table width on page {page_index}: {width}")
                header = " ".join(clean(x) for x in table[0]).lower()
                body = table[1:] if "major" in header or "discipline" in header else table
                state = states[width]
                for row_index, raw in enumerate(body, start=1):
                    discipline = fill(raw[0], state, "discipline")
                    major_raw = fill(raw[1], state, "major")
                    if not major_raw:
                        continue
                    code, name = split_code(major_raw)
                    direction = clean(raw[2])
                    if width == 6:
                        language = "English"
                        tuition = fill(raw[3], state, "tuition")
                        duration = fill(raw[4], state, "duration")
                        school = fill(raw[5], state, "school")
                    else:
                        language = fill(raw[3], state, "language")
                        tuition = fill(raw[4], state, "tuition")
                        duration = fill(raw[5], state, "duration")
                        school = fill(raw[6], state, "school")
                    rows.append({
                        "degreeLevel": "Master", "nameEn": name, "programCode": code,
                        "discipline": discipline, "researchDirection": "" if direction == "*" else direction,
                        "teachingLanguage": language, "tuitionAmount": int(number(tuition) or 0),
                        "durationYears": number(duration), "school": school,
                        "sourcePage": page_index, "sourceTable": table_index, "sourceRow": row_index,
                    })
    return rows


def parse_bfsu_doctoral() -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    state: dict[str, str] = {}
    with pdfplumber.open(BFSU_PDFS["doctoral"]) as pdf:
        for page_index, page in enumerate(pdf.pages, start=1):
            for table_index, table in enumerate(page.extract_tables(), start=1):
                if not table or len(table[0]) != 6:
                    continue
                header = " ".join(clean(x) for x in table[0]).lower()
                body = table[1:] if "major" in header or "discipline" in header else table
                for row_index, raw in enumerate(body, start=1):
                    discipline = fill(raw[0], state, "discipline")
                    major_raw = fill(raw[1], state, "major")
                    direction = clean(raw[2])
                    language = fill(raw[4], state, "language")
                    school = fill(raw[5], state, "school")
                    if not major_raw or not direction or direction in ("--", "——"):
                        continue
                    code, name = split_code(major_raw)
                    rows.append({
                        "degreeLevel": "Doctoral", "nameEn": name, "programCode": code,
                        "discipline": discipline, "researchDirection": direction,
                        "teachingLanguage": language, "durationYears": 4, "school": school,
                        "sourcePage": page_index, "sourceTable": table_index, "sourceRow": row_index,
                    })
    return rows


def csca_subjects(text: str) -> list[str]:
    result = []
    if "文科中文" in text:
        result.append("Chinese (Arts)")
    if "理科中文" in text:
        result.append("Chinese (Science)")
    for zh, en in (("数学", "Mathematics"), ("物理", "Physics"), ("化学", "Chemistry")):
        if zh in text:
            result.append(en)
    return result


def parse_ecust_undergraduate() -> list[dict[str, object]]:
    tables = pd.read_html(ECUST_HTML["undergraduate"])
    if [len(table) for table in tables] != [7, 3, 57]:
        raise RuntimeError(f"Unexpected ECUST undergraduate table sizes: {[len(table) for table in tables]}")
    rows: list[dict[str, object]] = []
    modes = [
        ("English", 3, "International Joint Multi-Degree Program"),
        ("Chinese", 3, "International Joint Multi-Degree Program"),
        ("Chinese", 4, "Single-Degree Program"),
    ]
    for table_index, (table, mode) in enumerate(zip(tables, modes, strict=True)):
        language, duration, route = mode
        for row_index, raw in table.iterrows():
            values = [clean(x) for x in raw.tolist()]
            if table_index == 0:
                name_zh, csca_text = values
                school_zh = ""
            else:
                school_zh, name_zh, csca_text = values
            if name_zh == "专业名称":
                continue
            name_en = next((english for chinese, english in ECUST_UG_TRANSLATIONS.items() if clean(chinese) == name_zh), None)
            if not name_en:
                raise RuntimeError(f"Missing ECUST undergraduate translation: {name_zh}")
            school_en = ECUST_SCHOOL_TRANSLATIONS.get(school_zh, route)
            rows.append({
                "degreeLevel": "Undergraduate", "nameEn": name_en, "nameZh": name_zh,
                "fieldCategory": school_en, "teachingLanguage": language,
                "cscaText": csca_text, "cscaSubjects": csca_subjects(csca_text),
                "durationYears": duration, "school": school_en, "route": route,
                "sourceTable": table_index + 1, "sourceRow": row_index + 1,
            })
    return rows


def parse_ecust_postgraduate(level: str) -> list[dict[str, object]]:
    path = ECUST_HTML[level]
    tables = pd.read_html(path)
    if len(tables) != 1 or tables[0].shape[1] != 5:
        raise RuntimeError(f"Unexpected ECUST {level} tables: {[table.shape for table in tables]}")
    rows = []
    seen: set[tuple[str, str, str, float | None, str]] = set()
    degree = "Master" if level == "master" else "Doctoral"
    for row_index, raw in tables[0].iterrows():
        school, name, language, duration, acceptance = [clean(x) for x in raw.tolist()]
        if name.lower().endswith("programs") or "teaching language" in language.lower():
            continue
        identity = (school, name, language, number(duration), acceptance)
        if identity in seen:
            continue
        seen.add(identity)
        rows.append({
            "degreeLevel": degree, "nameEn": name, "fieldCategory": school,
            "teachingLanguage": language, "durationYears": number(duration), "school": school,
            "acceptanceLetterText": acceptance, "sourceTable": 1, "sourceRow": row_index + 1,
        })
    return rows


def assert_no_sensitive_text(value: object) -> None:
    text = json.dumps(value, ensure_ascii=False).lower()
    forbidden = ("@bfsu.edu.cn", "@163.com", "@126.com", "@qq.com", "account no.", "swift")
    matches = [item for item in forbidden if item in text]
    if matches:
        raise RuntimeError(f"Sensitive or payment contact data leaked into parsed output: {matches}")


def main() -> None:
    if len(sys.argv) == 3 and sys.argv[1] == "--ecust-run":
        run = Path(sys.argv[2]).resolve()
        raw = run / "raw"
        ids = {
            "undergraduate": "ecust-international-undergraduate-program-catalog-2026",
            "master": "ecust-international-master-program-catalog-en-2026",
            "doctoral": "ecust-international-doctoral-program-catalog-en-2026",
        }
        for level, source_id in ids.items():
            matches = list(raw.glob(f"{source_id}.*.html"))
            if len(matches) != 1:
                raise RuntimeError(f"Expected one captured ECUST artifact for {source_id}, found {len(matches)}")
            ECUST_HTML[level] = matches[0]
        ecust = {
            "schoolSlug": "east-china-university-of-science-and-technology",
            "programs": parse_ecust_undergraduate() + parse_ecust_postgraduate("master") + parse_ecust_postgraduate("doctoral"),
        }
        assert_no_sensitive_text(ecust)
        degrees: dict[str, int] = {}
        for row in ecust["programs"]:
            degrees[row["degreeLevel"]] = degrees.get(row["degreeLevel"], 0) + 1
        ecust["summary"] = {"programCount": len(ecust["programs"]), "degreeCounts": degrees}
        output = run / "ecust-programs.extracted.json"
        output.write_text(json.dumps(ecust, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({"ok": True, "output": str(output), "ecust": ecust["summary"]}, indent=2))
        return
    if len(sys.argv) != 1:
        raise SystemExit("Usage: catalog-bfsu-ecust-source-parse.py [--ecust-run <captured-run-directory>]")
    bfsu = {
        "schoolSlug": "beijing-foreign-studies-university",
        "programs": parse_bfsu_undergraduate() + parse_bfsu_master() + parse_bfsu_doctoral(),
    }
    ecust = {
        "schoolSlug": "east-china-university-of-science-and-technology",
        "programs": parse_ecust_undergraduate() + parse_ecust_postgraduate("master") + parse_ecust_postgraduate("doctoral"),
    }
    assert_no_sensitive_text(bfsu)
    assert_no_sensitive_text(ecust)
    OUT.mkdir(parents=True, exist_ok=True)
    for name, payload in (("bfsu", bfsu), ("ecust", ecust)):
        degrees: dict[str, int] = {}
        for row in payload["programs"]:
            degrees[row["degreeLevel"]] = degrees.get(row["degreeLevel"], 0) + 1
        payload["summary"] = {"programCount": len(payload["programs"]), "degreeCounts": degrees}
        (OUT / f"{name}-programs.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "output": str(OUT), "bfsu": bfsu["summary"], "ecust": ecust["summary"]}, indent=2))


if __name__ == "__main__":
    main()
