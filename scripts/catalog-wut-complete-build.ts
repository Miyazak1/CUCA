import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram, type CatalogSeedScholarship } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const manifestPath = resolve(root, "work/catalog-official/wut-complete-20261016/manifest.json");
const cityPath = resolve(root, "seeds/catalog.wuhan-city-rich-batch-01.draft.json");
const candidatePath = resolve(root, "seeds/catalog.wut-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.wut-complete-batch-01.validation.json");
const [manifestText, cityText] = await Promise.all([readFile(manifestPath, "utf8"), readFile(cityPath, "utf8")]);
const manifest = JSON.parse(manifestText) as { generatedAt: string; sources: Array<{ id: string; status: number; finalUrl: string; label: string; sha256: string; fetchedAt: string }> };
const cityBundle = JSON.parse(cityText) as CatalogSeedBundle;
const source = manifest.sources.find((row) => row.id === "wut-international-undergraduate-admissions-2026");
const expectedSha256 = "d1b74100cd3a0231d5c50353c4e2208dbf90bde4216276fae9e9e759df338f47";
if (!source || source.status !== 200 || source.sha256 !== expectedSha256) throw new Error("WUT official evidence mismatch.");

const schoolSlug = "wuchang-university-of-technology";
const citySlug = "wuhan";
const evidence = { sourceUrl: source.finalUrl, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const specs = [
  ["Computer Science and Technology", "计算机科学与技术", "School of Artificial Intelligence", "Computer Science"],
  ["Intelligent Science and Technology", "智能科学与技术", "School of Artificial Intelligence", "Artificial Intelligence"],
  ["Data Science and Big Data Technology", "数据科学与大数据技术", "School of Artificial Intelligence", "Data Science"],
  ["International Economics and Trade", "国际经济与贸易", "School of Business", "Economics"],
  ["Business Administration", "工商管理", "School of Business", "Business"],
  ["Intelligent Construction", "智能建造", "School of Intelligent Construction", "Engineering"],
] as const;
const programs: CatalogSeedProgram[] = specs.map(([nameEn, nameZh, school, category]) => ({
  slug: `${schoolSlug}-undergraduate-${slugify(nameEn)}`,
  schoolSlug,
  citySlug,
  nameEn,
  nameZh,
  degreeLevel: "Undergraduate",
  durationYears: 4,
  fieldCategory: category,
  subjectArea: nameEn,
  teachingLanguage: "English",
  tuitionAmount: 15000,
  tuitionCurrency: "CNY",
  tuitionPeriod: "year",
  tuitionText: "CNY 15,000/year",
  scholarshipText: "First-class tuition deduction: CNY 7,000/year; second-class tuition deduction: CNY 3,000/year.",
  applicationUrl: "https://wut.at0086.cn/StuApplication/Login.aspx",
  applicationNote: "Official 2026 full-time English-taught undergraduate route; language evidence is requested but no minimum score is stated.",
  hasScholarship: true,
  displayGroup: slugify(school),
  displayGroupLabel: school,
  status: "draft",
  ...evidence,
  sourceFieldLineage: { nameEn: "undergraduate program table", nameZh: "undergraduate program table", degreeLevel: "guide heading", durationYears: "program notes", teachingLanguage: "program notes", tuitionAmount: "fee structure", applicationUrl: "application procedure" },
}));
const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2026,
  deadlineLabel: "Not stated in the reviewed 2026 guide",
  applicationRound: "2026 international undergraduate admission",
  status: "closed" as const,
  ...evidence,
  sourceFieldLineage: { intakeYear: "guide title", deadlineLabel: "not published in reviewed guide" },
}));
const scholarships: CatalogSeedScholarship[] = [{
  slug: "official-2026-wut-international-student-scholarship",
  title: "WUT 2026 International Student Scholarship",
  nameZh: "武昌理工学院2026年来华留学生奖学金",
  schoolSlug,
  type: "university",
  typeLabel: "University tuition scholarship",
  providerName: "武昌理工学院",
  providerNameEn: "Wuchang University of Technology",
  providerLocation: "Wuhan, Hubei, China",
  fundingLevel: "Partial",
  coverage: "Tuition deduction",
  applicableDegree: "Undergraduate",
  applicableProgram: "The six reviewed 2026 English-taught undergraduate programs",
  amountText: "First class: CNY 7,000/year; second class: CNY 3,000/year",
  deadlineLabel: "Not stated in the reviewed 2026 guide",
  applicationRound: "2026 international undergraduate admission",
  targetCountries: [],
  targetRegions: [],
  benefitItems: [{ label: "First-class tuition deduction", included: true, note: "CNY 7,000/year" }, { label: "Second-class tuition deduction", included: true, note: "CNY 3,000/year" }],
  eligibilityItems: [{ label: "Selection", value: "Competitive review based primarily on GPA, with certificates and the submitted video as additional merit evidence." }, { label: "First-class interview", value: "Applicants for the first-class scholarship must pass an interview." }],
  applicationMaterials: [{ label: "Academic transcript" }, { label: "Relevant certificates, if available" }, { label: "One-to-three-minute English self-introduction and study-plan video" }],
  applicationSteps: [{ label: "Step 1", value: "Submit the university application and supporting materials online." }, { label: "Step 2", value: "First-class candidates attend an interview." }, { label: "Step 3", value: "The university selects recipients competitively." }],
  actionLinks: [{ label: source.label, url: source.finalUrl, kind: "official-source" }],
  summary: "Partial 2026 tuition scholarship for reviewed international undergraduate routes.",
  status: "draft",
  ...evidence,
  sourceFieldLineage: { title: "scholarship section", fundingLevel: "scholarship section", coverage: "scholarship section", amountText: "scholarship section", eligibilityItems: "scholarship selection paragraph", deadlineLabel: "not published" },
}];

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: manifest.generatedAt,
  cities: cityBundle.cities?.slice(0, 1),
  schools: [{
    slug: schoolSlug,
    nameEn: "Wuchang University of Technology",
    nameZh: "武昌理工学院",
    citySlug,
    schoolType: "Private",
    region: "Wuhan, Hubei, Central China",
    applicationLevel: "Undergraduate",
    languageOfInstruction: "English for all six reviewed 2026 programs",
    languageRequirement: "A language certificate such as TOEFL, IELTS or HSK is requested; the reviewed guide does not publish a minimum score.",
    deadlineSummary: "The reviewed guide does not state an application deadline; no date is inferred.",
    tuitionSummary: "CNY 15,000/year for the six reviewed 2026 undergraduate programs.",
    applicationFee: "CNY 500",
    websiteUrl: "https://en.wut.edu.cn/",
    admissionsUrl: source.finalUrl,
    subjectTags: ["Computer Science", "Artificial Intelligence", "Data Science", "Business", "Economics", "Intelligent Construction"],
    languageTags: ["English"],
    campusHighlights: ["Wuhan Optics Valley location", "English-taught undergraduate programs", "University tuition scholarships"],
    status: "draft",
    ...evidence,
    sourceFieldLineage: { nameEn: "guide title", nameZh: "guide title", citySlug: "official address", schoolType: "official description", applicationLevel: "undergraduate program list", languageRequirement: "application materials list", deadlineSummary: "not published", tuitionSummary: "fee structure", applicationFee: "fee structure", admissionsUrl: "registered official guide" },
  }],
  programs,
  programIntakes,
  scholarships,
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = { ...validation, candidateSha256: sha256(candidateText), manifestSha256: sha256(manifestText), sourceReview: { status: "unreviewed_draft", notes: ["All six official 2026 program rows, fees and scholarship amounts were transcribed from the acquired university page.", "No minimum language score, deadline or CSCA requirement is inferred.", "Personal contacts, bank details and applicant data are excluded."] }, publicationAuthorized: false, databaseWriteAuthorized: false };
await Promise.all([writeFile(candidatePath, candidateText, "utf8"), writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
