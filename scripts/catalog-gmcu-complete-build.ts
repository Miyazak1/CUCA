import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const identityPath = resolve(root, "seeds/catalog.school-identity-replacements-batch-01.draft.json");
const manifestPath = resolve(root, "work/catalog-official/gmcu-complete-batch-01-pdf/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.gmcu-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.gmcu-complete-batch-01.validation.json");
const [identityText, manifestText] = await Promise.all([readFile(identityPath, "utf8"), readFile(manifestPath, "utf8")]);
const identity = JSON.parse(identityText) as CatalogSeedBundle;
const manifest = JSON.parse(manifestText) as { generatedAt: string; sources: { id: string; label: string; url: string; sha256: string; status: number }[] };
const city = identity.cities.find((row) => row.slug === "guiyang");
const school = identity.schools.find((row) => row.slug === "guizhou-medical-university");
if (!city || !school) throw new Error("Missing Guiyang/Guizhou Medical University identity dependencies");
const source = manifest.sources.find((row) => row.id === "guiyang-gmcu-undergraduate-admission-pdf-2026" && row.status === 200);
if (!source) throw new Error("Missing successful Guizhou Medical University brochure evidence");
const sourceBase = { status: "draft", sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: manifest.generatedAt };
const programs = [
  {
    slug: "guizhou-medical-university-clinical-medicine",
    schoolSlug: school.slug,
    citySlug: city.slug,
    nameEn: "Clinical Medicine",
    degreeLevel: "Undergraduate",
    durationYears: 6,
    fieldCategory: "Medicine",
    subjectArea: "Clinical Medicine",
    teachingLanguage: "English with first-year Chinese and medical-foundation preparation",
    englishRequirement: "For applicants whose first or official language is not English: IELTS 6.5, TOEFL 80, or a recognized equivalent; English-medium applicants provide prior-study English results of at least 75%.",
    tuitionText: "CNY 15,000 for the first preparatory year; CNY 25,000 per year for years two through six",
    displayTuition: "CNY 15,000 first year; CNY 25,000/year thereafter",
    applicationUrl: "https://soe.gmc.edu.cn/",
    applicationNote: "The official guide describes one preparatory year followed by five clinical-medicine years. Fall 2026 applications close September 30, 2026.",
    displaySubjects: ["Biology", "Chemistry", "Mathematics"],
    displayGroup: "2026-international-undergraduate",
    displayGroupLabel: "2026 international undergraduate programs",
    ...sourceBase,
    sourceFieldLineage: {
      nameEn: "brochure page 3 program heading",
      degreeLevel: "brochure title and program section",
      durationYears: "brochure page 3 study duration: 1+5 years",
      fieldCategory: "brochure page 3 program identity",
      subjectArea: "brochure page 3 program identity",
      teachingLanguage: "derived from brochure page 3 preparatory description and page 5 English-language requirements; requires later editorial review",
      englishRequirement: "brochure page 5 language requirements",
      tuitionText: "brochure page 6 fee table",
      applicationUrl: "brochure contact and application-procedure sections",
      applicationNote: "brochure pages 3 and 5-6",
      displaySubjects: "brochure page 5 academic requirements",
    },
  },
  {
    slug: "official-2026-gmcu-bachelor-dental-surgery-bds",
    schoolSlug: school.slug,
    citySlug: city.slug,
    nameEn: "Bachelor of Dental Surgery (BDS)",
    degreeLevel: "Undergraduate",
    durationYears: 5,
    fieldCategory: "Medicine",
    subjectArea: "Stomatology",
    teachingLanguage: "English",
    englishRequirement: "For applicants whose first or official language is not English: IELTS 6.5, TOEFL 80, or a recognized equivalent; English-medium applicants provide prior-study English results of at least 75%.",
    tuitionAmount: 20000,
    tuitionCurrency: "CNY",
    tuitionPeriod: "academic_year",
    tuitionText: "CNY 20,000 per year for five years",
    displayTuition: "CNY 20,000/year",
    applicationUrl: "https://soe.gmc.edu.cn/",
    applicationNote: "The official guide publishes a five-year Bachelor of Dental Surgery route. Fall 2026 applications close September 30, 2026.",
    displaySubjects: ["Biology", "Chemistry", "Mathematics"],
    displayGroup: "2026-international-undergraduate",
    displayGroupLabel: "2026 international undergraduate programs",
    ...sourceBase,
    sourceFieldLineage: {
      nameEn: "brochure page 4 program heading",
      degreeLevel: "brochure title and program section",
      durationYears: "brochure page 4 study duration",
      fieldCategory: "brochure page 4 program identity",
      subjectArea: "brochure page 4 School of Stomatology description",
      teachingLanguage: "derived from brochure page 5 English-language requirements; requires later editorial review",
      englishRequirement: "brochure page 5 language requirements",
      tuitionAmount: "brochure page 6 fee table",
      tuitionCurrency: "brochure page 6 fee table",
      tuitionPeriod: "brochure page 6 fee table",
      tuitionText: "brochure page 6 fee table",
      applicationUrl: "brochure contact and application-procedure sections",
      applicationNote: "brochure pages 4-6",
      displaySubjects: "brochure page 5 academic requirements",
    },
  },
];
const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2026,
  deadlineDate: "2026-09-30T00:00:00.000Z",
  deadlineLabel: "September 30, 2026",
  applicationRound: "Guizhou Medical University 2026 international undergraduate admission",
  status: "open",
  sourceUrl: source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: manifest.generatedAt,
  sourceFieldLineage: { intakeTerm: "explicit: Fall semester", intakeYear: "explicit: 2026 brochure", deadlineDate: "brochure page 5 application time", deadlineLabel: "brochure page 5 application time", applicationRound: "explicit brochure context", status: "derived: deadline remains in the future at evidence capture" },
}));
const scholarshipBase = { schoolSlug: school.slug, ...sourceBase, providerLocation: "China", targetCountries: [], targetRegions: [], actionLinks: [{ label: source.label, url: source.url, kind: "official-source" }] };
const scholarshipLineage = { title: "brochure page 6 scholarship list", fundingLevel: "brochure identifies the award but does not publish a fixed level", coverage: "unpublished in the reviewed brochure", applicableDegree: "brochure undergraduate context", applicableProgram: "brochure undergraduate context", eligibilityItems: "brochure describes awards for outstanding students", applicationSteps: "no separate application procedure published in the reviewed brochure" };
const scholarships = [
  {
    ...scholarshipBase,
    slug: "official-2026-gmcu-guizhou-government-excellent-international-students",
    title: "Guizhou Provincial Government Scholarship for Excellent International Students at GMU",
    nameZh: "贵州医科大学贵州省政府优秀来华留学生奖学金",
    type: "government",
    typeLabel: "Guizhou Provincial Government Scholarship",
    providerName: "贵州省人民政府",
    providerNameEn: "People's Government of Guizhou Province",
    fundingLevel: "Merit award",
    coverage: "The reviewed brochure lists the scholarship but does not publish benefit amounts or coverage items",
    applicableDegree: "Undergraduate",
    applicableProgram: "Eligible Guizhou Medical University international undergraduate students",
    amountText: "Not published in the reviewed brochure.",
    deadlineLabel: "Not published in the reviewed brochure",
    applicationRound: "2026 undergraduate scholarship context",
    benefitItems: [{ label: "Provincial merit scholarship; amount not published", included: true }],
    eligibilityItems: [{ label: "Merit", value: "Outstanding international student under the university's current rules" }],
    applicationMaterials: [{ label: "Not stated in the reviewed brochure" }],
    applicationSteps: [{ label: "Step 1", value: "Confirm current scholarship instructions with the university" }],
    sourceFieldLineage: scholarshipLineage,
    summary: "A current Guizhou provincial merit scholarship listed by GMU; detailed terms require a separate official notice.",
    sortOrder: 10,
  },
  {
    ...scholarshipBase,
    slug: "official-2026-gmcu-president-scholarship",
    title: "President Scholarship of Guizhou Medical University",
    nameZh: "贵州医科大学校长奖学金",
    type: "university",
    typeLabel: "GMU President Scholarship",
    providerName: "贵州医科大学",
    providerNameEn: "Guizhou Medical University",
    fundingLevel: "University award",
    coverage: "The reviewed brochure lists the scholarship but does not publish benefit amounts or coverage items",
    applicableDegree: "Undergraduate",
    applicableProgram: "Eligible Guizhou Medical University international undergraduate students",
    amountText: "Not published in the reviewed brochure.",
    deadlineLabel: "Not published in the reviewed brochure",
    applicationRound: "2026 undergraduate scholarship context",
    benefitItems: [{ label: "University scholarship; amount not published", included: true }],
    eligibilityItems: [{ label: "Merit", value: "Outstanding student under the university's current rules" }],
    applicationMaterials: [{ label: "Not stated in the reviewed brochure" }],
    applicationSteps: [{ label: "Step 1", value: "Confirm current scholarship instructions with the university" }],
    sourceFieldLineage: scholarshipLineage,
    summary: "A current university scholarship listed by GMU; detailed terms require a separate official notice.",
    sortOrder: 20,
  },
];

const candidate: CatalogSeedBundle = { version: 1, generatedAt: manifest.generatedAt, cities: [city], schools: [school], programs, programIntakes, scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 2 || validation.summary.programIntakes !== 2 || validation.summary.scholarships !== 2) throw new Error(`GMU bundle invalid:\n${validation.errors.join("\n")}`);
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha(candidateText),
  sourceManifestSha256: sha(manifestText),
  sourceReview: {
    status: "unreviewed_draft",
    notes: [
      "The image-only official brochure was rendered and visually checked across all six pages.",
      "Only Clinical Medicine and Bachelor of Dental Surgery are published as 2026 international undergraduate programs; legacy Nursing, Pharmacy and Pharmacy Administration remain quarantined.",
      "Both Fall 2026 routes remain open at the September 22 evidence date and close September 30, 2026.",
      "Scholarship records retain only the two top-level awards named in the brochure; unpublished amounts, deadlines and application steps are not invented.",
      "Teaching-language values are evidence-backed editorial derivations and explicitly flagged for later review.",
      "This draft does not authorize publication or database writes.",
    ],
  },
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
};
await Promise.all([writeFile(candidatePath, candidateText, "utf8"), writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary, candidateSha256: validationArtifact.candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
