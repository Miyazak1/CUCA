import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
} from "../src/server/catalog/seed-contract.ts";

type FeeBand = "liberal-arts" | "science-engineering" | "medicine-stomatology";

const root = process.cwd();
const inputPath = resolve(root, "seeds/catalog.whu-programs-batch-01.approved.local.json");
const manifestPath = resolve(root, "work/catalog-official/whu-fees-page-batch-01/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.whu-tuition-enrichment-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.whu-tuition-enrichment-batch-01.validation.json");
const [inputText, manifestText] = await Promise.all([readFile(inputPath, "utf8"), readFile(manifestPath, "utf8")]);
const input = JSON.parse(inputText) as CatalogSeedBundle;
const manifest = JSON.parse(manifestText) as {
  sources: { id: string; status: number; sha256: string; fetchedAt: string }[];
};
const sourceId = "whu-international-student-fees-current";
const expectedDigest = "44f3363bfdf11003a6101c395af2208878c74b71fddeb29e9e51bd9b29b3a338";
const feeSource = manifest.sources.find((row) => row.id === sourceId);
if (!feeSource || feeSource.status !== 200 || feeSource.sha256 !== expectedDigest) {
  throw new Error("WHU fee-page evidence is missing or changed.");
}

const liberalArtsUnits = new Set([
  "Academy for Multidisciplinary Studies",
  "Academy of Advanced Interdisciplinary Studies",
  "Economics and Management School",
  "Liberal Arts",
  "National Institute of Cultural Development",
  "School of Arts",
  "School of Chinese Language and Literature",
  "School of Foreign Languages and Literature",
  "School of History",
  "School of Information Management",
  "School of International Education",
  "School of Journalism and Communication",
  "School of Law",
  "School of Marxism",
  "School of Philosophy",
  "School of Political Science and Public Administration",
]);
const scienceEngineeringUnits = new Set([
  "School of Chemistry and Molecular Sciences",
  "School of Civil Engineering",
  "School of Computer Science",
  "School of Cyber Science and Engineering",
  "School of Earth and Space Science and Technology",
  "School of Electrical Engineering and Automation",
  "School of Electronic Information",
  "School of Geodesy and Geomatics",
  "School of Integrated Circuits",
  "School of Life Sciences",
  "School of Mathematics and Statistics",
  "School of Physics and Technology",
  "School of Power and Mechanical Engineering",
  "School of Remote Sensing and Information Engineering",
  "School of Resources and Environmental Science",
  "School of Robotics",
  "School of Urban Design",
  "School of Water Resources and Hydropower Engineering",
  "Science and Engineering",
  "State Key Laboratory of Information Engineering In Surveying, Mapping And Remote Sensing",
]);
const medicineUnits = new Set([
  "College of Medicine (School of Basic Medical Science, The First Affiliated Hospital, The Second Affiliated Hospital)",
  "School of Basic Medical Science",
  "School of Nursing",
  "School of Pharmaceutical Sciences",
  "School of Public Health",
  "School of Stomatology",
  "The First Affiliated Hospital",
  "The Second Affiliated Hospital",
]);
const englishProgramBands: Record<string, FeeBand> = {
  "Business Administration": "liberal-arts",
  "Human Resource Management": "liberal-arts",
  "Marketing": "liberal-arts",
  "Accounting": "liberal-arts",
  "Financial Management": "liberal-arts",
  "Finance": "liberal-arts",
  "Insurance": "liberal-arts",
  "International Economics and Trade": "liberal-arts",
  "Bachelor of Software Engineering": "science-engineering",
  "Electronic Commerce": "liberal-arts",
  "Bachelor of Medicine, Bachelor of Surgery (MBBS)": "medicine-stomatology",
  "Geographical Science": "science-engineering",
  "Geographic Information Science": "science-engineering",
  "Environmental Science": "science-engineering",
  "Master of International Business": "liberal-arts",
  "Master of International Law": "liberal-arts",
  "Master of Media and Communication Study": "liberal-arts",
  "Master of Software Engineering": "science-engineering",
  "Master of Clinical Medicine": "medicine-stomatology",
  "Photogrammetry and Remote Sensing": "science-engineering",
  "Cartography and Geographic Information Engineering": "science-engineering",
  "Geodesy and Surveying Engineering": "science-engineering",
  "Master of Ethics": "liberal-arts",
  "Master of Hydraulic Engineering": "science-engineering",
  "Master of Electrical Engineering": "science-engineering",
  "Master of Nursing": "medicine-stomatology",
  "Public Health": "medicine-stomatology",
  "Master of E-Commerce": "liberal-arts",
  "Doctor of Software Engineering": "science-engineering",
  "Doctor of E-Commerce": "liberal-arts",
  "Doctor of Solid Mechanics": "science-engineering",
  "Doctor of Engineering Mechanics": "science-engineering",
  "Doctor of Geotechnical Engineering": "science-engineering",
  "Doctor of Structural Engineering": "science-engineering",
  "Disaster Prevention and Reduction Engineering and Protective Engineering": "science-engineering",
  "Doctor of Science of Environment and Natural Resources Preotection Law": "liberal-arts",
  "Doctor of International Law": "liberal-arts",
  "Doctor of Chemistry": "science-engineering",
  "Doctor of Material Science and Engineering": "science-engineering",
  "Doctor of Electrical Engineering": "science-engineering",
  "Physical Geography": "science-engineering",
  "Human Geography": "science-engineering",
  "Resources and Environmental Monitoring and Planning": "science-engineering",
  "Cartography and Geography Information System": "science-engineering",
  "Environmental Engineering": "science-engineering",
};
const annualFees: Record<string, number> = {
  "Undergraduate|Chinese|liberal-arts": 20000,
  "Undergraduate|Chinese|science-engineering": 24000,
  "Undergraduate|Chinese|medicine-stomatology": 30000,
  "Undergraduate|English|liberal-arts": 23000,
  "Undergraduate|English|science-engineering": 28000,
  "Undergraduate|English|medicine-stomatology": 40000,
  "Master|Chinese|liberal-arts": 23000,
  "Master|Chinese|science-engineering": 28000,
  "Master|Chinese|medicine-stomatology": 38000,
  "Master|English|liberal-arts": 33000,
  "Master|English|science-engineering": 38000,
  "Master|English|medicine-stomatology": 50000,
  "Doctoral|Chinese|liberal-arts": 30000,
  "Doctoral|Chinese|science-engineering": 40000,
  "Doctoral|Chinese|medicine-stomatology": 45000,
  "Doctoral|English|liberal-arts": 36000,
  "Doctoral|English|science-engineering": 46000,
  "Doctoral|English|medicine-stomatology": 55000,
};

const programsNeedingTuition = input.programs.filter((program) => !program.tuitionText);
if (input.programs.length !== 599 || programsNeedingTuition.length !== 599) {
  throw new Error(`Expected 599 WHU programs needing tuition, received ${input.programs.length}/${programsNeedingTuition.length}.`);
}
const feeBandFor = (program: CatalogSeedProgram): FeeBand => {
  if (program.teachingLanguage === "English") {
    const band = englishProgramBands[program.nameEn];
    if (!band) throw new Error(`No reviewed English-program fee band for ${program.slug}: ${program.nameEn}`);
    return band;
  }
  if (liberalArtsUnits.has(program.fieldCategory)) return "liberal-arts";
  if (scienceEngineeringUnits.has(program.fieldCategory)) return "science-engineering";
  if (medicineUnits.has(program.fieldCategory)) return "medicine-stomatology";
  throw new Error(`No reviewed Chinese-program fee band for ${program.slug}: ${program.fieldCategory}`);
};
const programs: CatalogSeedProgram[] = programsNeedingTuition.map((program) => {
  const feeBand = feeBandFor(program);
  const key = `${program.degreeLevel}|${program.teachingLanguage}|${feeBand}`;
  const tuitionAmount = annualFees[key];
  if (!tuitionAmount) throw new Error(`No official WHU tuition amount for ${key}: ${program.slug}`);
  return {
    ...program,
    tuitionAmount,
    tuitionCurrency: "CNY",
    tuitionPeriod: "year",
    tuitionText: `CNY ${tuitionAmount.toLocaleString("en-US")} per year`,
    displayTuition: `CNY ${tuitionAmount.toLocaleString("en-US")}/year`,
    status: "draft",
    sourceFieldLineage: {
      ...program.sourceFieldLineage,
      tuitionAmount: `${sourceId} ${expectedDigest}: ${program.degreeLevel}, ${program.teachingLanguage}, ${feeBand} annual fee band`,
      tuitionText: `${sourceId} ${expectedDigest}: ${program.degreeLevel}, ${program.teachingLanguage}, ${feeBand} annual fee band`,
    },
  };
});

const school = input.schools.find((row) => row.slug === "wuhan-university");
if (!school) throw new Error("WHU school dependency is missing.");
const city = input.cities.find((row) => row.slug === school.citySlug);
if (!city) throw new Error("WHU city dependency is missing.");
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: feeSource.fetchedAt,
  cities: [city],
  schools: [school],
  programs,
  programIntakes: [],
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 599) {
  throw new Error(`WHU tuition enrichment invalid:\n${validation.errors.join("\n")}`);
}
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha(candidateText),
  inputBundleSha256: sha(inputText),
  sourceManifestSha256: sha(manifestText),
  sourceReview: {
    status: "unreviewed_draft",
    notes: [
      "The official WHU fees page publishes annual tuition by degree level, teaching medium and three academic fee bands.",
      "Chinese-taught records use an explicit reviewed academic-unit allowlist; English-taught records use an explicit reviewed program-name allowlist.",
      "Unknown academic units, English program names or fee combinations fail closed instead of receiving an inferred amount.",
      "No intake, deadline, identity, teaching language, application URL or scholarship state is changed.",
      "This draft does not authorize publication or database writes.",
    ],
  },
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
};
await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({
  ok: true,
  candidatePath,
  validationPath,
  summary: validation.summary,
  candidateSha256: validationArtifact.candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
}, null, 2));
