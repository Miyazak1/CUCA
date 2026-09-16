from __future__ import annotations

import json
import math
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RUN_DIR = ROOT / "work" / "catalog-official" / "ustc-complete-batch-01"
OCR_PATH = RUN_DIR / "ocr-lines.json"
OUTPUT = RUN_DIR / "parsed-routes.json"

CORRECTIONS = {
    "AstrometryandCelestialMechanics": "Astrometry and Celestial Mechanics",
    "AtmospherePhysicsandEnvironment": "Atmosphere Physics and Environment",
    "BiochemistryandMoleculeBiology": "Biochemistry and Molecule Biology",
    "Computer&ApplicationTechnology": "Computer & Application Technology",
    "ComputerSoftwareandTheory": "Computer Software and Theory",
    "ElectronicInformation": "Electronic Information",
    "ElectronicScience and Technology": "Electronic Science and Technology",
    "CyberspaceSecurity": "Cyberspace Security",
    "Electromagnetism Field &Microwave Technology": "Electromagnetism Field & Microwave Technology",
    "ElectromagnetismField &MicrowaveTechnology": "Electromagnetic Field and Microwave Technology",
    "InformationCaptureandControl": "Information Capture and Control",
    "InformationSafety": "Information Safety",
    "InternetCommunicationSystemandControl": "Internet Communication System and Control",
    "MacromoleculeChemistryandPhysics": "Macromolecule Chemistry and Physics",
    "MacromoleculeChemistry andPhysics": "Macromolecule Chemistry and Physics",
    "ManagementScience and Engineering": "Management Science and Engineering",
    "MaterialsScience": "Materials Science",
    "MaterialsScienceandEngineering": "Materials Science and Engineering",
    "MasterofBusinessAdministration": "Master of Business Administration",
    "MasterofBusiness Administration": "Master of Business Administration",
    "Measuring and TestingTechnologies and Instruments": "Measuring and Testing Technologies and Instruments",
    "Microelectronics andSolidState Electronics": "Microelectronics and Solid State Electronics",
    "MicroelectronicsandSolidStateElectronics": "Microelectronics and Solid State Electronics",
    "Mineralogy,Petrology,Mineral DepositGeology": "Mineralogy, Petrology, Mineral Deposit Geology",
    "Mineralogy,Petrology,Mineral Deposit Geology": "Mineralogy, Petrology, Mineral Deposit Geology",
    "ModuleIdentification andIntelligenceSystem": "Model Identification and Intelligent Systems",
    "ModuleIdentificationandIntelligenceSystem": "Model Identification and Intelligent Systems",
    "Communicationand InformationSystem": "Communication and Information System",
    "CorrosionScience andProtection": "Corrosion Science and Protection",
    "CorrosionScienceandProtection": "Corrosion Science and Protection",
    "MaterialsProcessing Engineering": "Materials Processing Engineering",
    "NuclearFuel Cycleand Materials": "Nuclear Fuel Cycle and Materials",
    "Operational Research andCybernetics": "Operational Research and Cybernetics",
    "PublicAdministration": "Public Administration",
    "StratigraphicPaleontology": "Stratigraphic Paleontology",
    "Energy andPower": "Energy and Power",
    "Atom and MoleculePhysics": "Atom and Molecule Physics",
    "Condensed MatterPhysics": "Condensed Matter Physics",
    "ParticlePhysicsandNuclearPhysics": "Particle Physics and Nuclear Physics",
    "PlanetaryScience and ExplorationTechnology": "Planetary Science and Exploration Technology",
    "PlanetaryScienceandExplorationTechnology": "Planetary Science and Exploration Technology",
    "PrecisionInstrumentandMachinery": "Precision Instrument and Machinery",
    "RadiationProofandEnvironmentProtection": "Radiation Proof and Environment Protection",
    "RefrigerationandMicrothermEngineering": "Refrigeration and Microtherm Engineering",
    "Signal and Information Process": "Signal and Information Processing",
    "Synchrotron Radiation andApplication": "Synchrotron Radiation and Application",
}


def normalize(text: str) -> str:
    text = text.replace("*", "").strip()
    text = re.sub(r"\s+", " ", text)
    return CORRECTIONS.get(text, text)


def center(line: dict) -> float:
    return (line["y0"] + line["y1"]) / 2


def english_text(text: str) -> bool:
    letters = re.findall(r"[A-Za-z]", text)
    return len(letters) >= 3 and len(letters) / max(len(text), 1) > 0.55


def combine_wrapped_majors(lines: list[dict]) -> list[dict]:
    output = []
    index = 0
    while index < len(lines):
        current = dict(lines[index])
        text = normalize(current["text"])
        if text in {"Information and", "Power Engineering and"} and index + 1 < len(lines):
            following = lines[index + 1]
            expected = "Communication Engineering" if text == "Information and" else "Engineering Thermophysics"
            if normalize(following["text"]) == expected and abs(center(following) - center(current)) < 45:
                current["text"] = f"{text} {expected}"
                current["y0"] = min(current["y0"], following["y0"])
                current["y1"] = max(current["y1"], following["y1"])
                index += 1
            else:
                current["text"] = text
        else:
            current["text"] = text
        output.append(current)
        index += 1
    return output


def partition_fields(majors: list[dict], fields: list[dict]) -> list[list[dict]]:
    major_centers = [center(line) for line in majors]
    field_centers = [center(line) for line in fields]
    major_count, field_count = len(majors), len(fields)
    inf = float("inf")
    dp = [[inf] * (field_count + 1) for _ in range(major_count + 1)]
    parent = [[None] * (field_count + 1) for _ in range(major_count + 1)]
    dp[0][0] = 0.0
    prefix = [0.0]
    for value in field_centers:
        prefix.append(prefix[-1] + value)
    for major_index in range(1, major_count + 1):
        min_fields = major_index
        max_fields = field_count - (major_count - major_index)
        for used in range(min_fields, max_fields + 1):
            for previous in range(major_index - 1, used):
                if not math.isfinite(dp[major_index - 1][previous]):
                    continue
                mean = (prefix[used] - prefix[previous]) / (used - previous)
                cost = dp[major_index - 1][previous] + (mean - major_centers[major_index - 1]) ** 2
                if cost < dp[major_index][used]:
                    dp[major_index][used] = cost
                    parent[major_index][used] = previous
    if not math.isfinite(dp[major_count][field_count]):
        raise ValueError(f"Cannot partition {field_count} fields across {major_count} majors")
    groups = []
    used = field_count
    for major_index in range(major_count, 0, -1):
        previous = parent[major_index][used]
        groups.append(fields[previous:used])
        used = previous
    return list(reversed(groups))


data = json.loads(OCR_PATH.read_text(encoding="utf-8"))
routes = []
page_reviews = []
for page in data["pages"]:
    image = page["image"]
    match = re.match(r"ustc-(doctoral|master)-programs-(chinese|english)-2026\.", image)
    if not match:
        continue
    degree, language = match.groups()
    header = next(line for line in page["lines"] if "Research Field" in line["text"])
    table_top = header["y1"]
    fields = [
        {**line, "text": normalize(line["text"])}
        for line in page["lines"]
        if line["x0"] >= 620
        and line["x0"] < 1100
        and line["y0"] > table_top
        and english_text(line["text"])
        and not re.search(r"Please note|applicants|HSK|requirement|Bachelor", line["text"], re.I)
    ]
    fields.sort(key=center)
    major_lines = [
        line
        for line in page["lines"]
        if line["x0"] < 440
        and line["y0"] > table_top
        and english_text(line["text"])
        and not re.search(r"Please note|applicants|HSK|requirement|Bachelor|having studied", line["text"], re.I)
    ]
    major_lines.sort(key=center)
    majors = combine_wrapped_majors(major_lines)
    groups = partition_fields(majors, fields)
    source_id = f"ustc-{degree}-programs-{language}-2026"
    for major, group in zip(majors, groups):
        for field in group:
            routes.append(
                {
                    "degree": "Doctoral" if degree == "doctoral" else "Master",
                    "language": "Chinese" if language == "chinese" else "English",
                    "major": normalize(major["text"]),
                    "researchField": normalize(field["text"]),
                    "sourceId": source_id,
                    "page": page["page"],
                }
            )
    page_reviews.append(
        {
            "image": image,
            "majorCount": len(majors),
            "fieldCount": len(fields),
            "groups": [
                {"major": normalize(major["text"]), "fields": [normalize(field["text"]) for field in group]}
                for major, group in zip(majors, groups)
            ],
        }
    )

summary = {}
for degree in ("Master", "Doctoral"):
    summary[degree] = {}
    for language in ("Chinese", "English"):
        summary[degree][language] = sum(
            1 for route in routes if route["degree"] == degree and route["language"] == language
        )

payload = {"version": 1, "summary": summary, "routes": routes, "pageReviews": page_reviews}
OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"ok": True, "summary": summary, "routeCount": len(routes), "output": str(OUTPUT)}, ensure_ascii=False))
