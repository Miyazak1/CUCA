import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedScholarship,
} from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const admissionManifestPath = resolve(root, "work/catalog-official/2026-09-22T12-02-58-995Z/manifest.json");
const scholarshipManifestPath = resolve(root, "work/catalog-official/2026-09-22T12-08-25-472Z/manifest.json");
const cityPath = resolve(root, "seeds/catalog.shanghai-city-rich-batch-01.draft.json");
const candidatePath = resolve(root, "seeds/catalog.shisu-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.shisu-complete-batch-01.validation.json");
const [admissionManifestText, scholarshipManifestText, cityText] = await Promise.all([
  readFile(admissionManifestPath, "utf8"),
  readFile(scholarshipManifestPath, "utf8"),
  readFile(cityPath, "utf8"),
]);
const admissionManifest = JSON.parse(admissionManifestText);
const scholarshipManifest = JSON.parse(scholarshipManifestText);
const cityBundle = JSON.parse(cityText);
type SourceRecord = { id: string; status: number; url: string; label: string; sha256: string; fetchedAt: string };
const sources = new Map<string, SourceRecord>(
  [...(admissionManifest.sources as SourceRecord[]), ...(scholarshipManifest.sources as SourceRecord[])]
    .map((row) => [row.id, row]),
);
const expected = {
  "shisu-international-undergraduate-admissions-2026": "e1467035e6e1569fc92d6299e2b3c999e0e8b58a6d1eb76b9e99e3e5925579b2",
  "shisu-international-master-admissions-2026": "7a368574ab1e5934f54ac00ad248ebedbed1b113eb708c0801e71e20851dbe3b",
  "shisu-shanghai-government-scholarship-2026": "d5376245519cc272f64a034e19d6dbc666978221c7f805647c1c3bcb4a0ee602",
} as const;
for (const [id, digest] of Object.entries(expected)) {
  const source = sources.get(id);
  if (!source || source.status !== 200 || source.sha256 !== digest) {
    throw new Error(`SHISU evidence mismatch: ${id}`);
  }
}

const undergraduate = sources.get("shisu-international-undergraduate-admissions-2026")!;
const master = sources.get("shisu-international-master-admissions-2026")!;
const scholarshipSource = sources.get("shisu-shanghai-government-scholarship-2026")!;
const schoolSlug = "shanghai-international-studies-university";
const citySlug = "shanghai";

type UndergraduateSpec = {
  slug: string;
  nameEn: string;
  nameZh: string;
  category: string;
  campus: "Hongkou" | "Songjiang";
};
const undergraduateSpecs: UndergraduateSpec[] = [
  { slug: `${schoolSlug}-accounting`, nameEn: "Accounting", nameZh: "会计学", category: "Accounting", campus: "Songjiang" },
  { slug: `${schoolSlug}-business-administration-business-administration-marketing-management-financial-management-and-public-relations`, nameEn: "Business Administration (Business Administration, Marketing Management, Financial Management and Public Relations)", nameZh: "工商管理类（工商管理、市场营销、财务管理、公共关系学）", category: "Business and Management", campus: "Songjiang" },
  { slug: `${schoolSlug}-finance-370`, nameEn: "Finance", nameZh: "金融学", category: "Finance", campus: "Songjiang" },
  { slug: `${schoolSlug}-international-economics-and-trade`, nameEn: "International Economics and Trade", nameZh: "国际经济与贸易（松江校区）", category: "International Trade", campus: "Songjiang" },
  { slug: `${schoolSlug}-international-economics-and-trade-hongkou-campus`, nameEn: "International Economics and Trade (Hongkou Campus)", nameZh: "国际经济与贸易（汉语，虹口校区）", category: "International Trade", campus: "Hongkou" },
  { slug: `${schoolSlug}-international-economics-and-trade-japanese`, nameEn: "International Economics and Trade (Japanese)", nameZh: "国际经济与贸易（日语）", category: "International Trade", campus: "Songjiang" },
  { slug: `${schoolSlug}-international-politics-songjiang-campus`, nameEn: "International Politics (Songjiang Campus)", nameZh: "国际政治（松江校区）", category: "Political Science", campus: "Songjiang" },
  { slug: `${schoolSlug}-law`, nameEn: "Law", nameZh: "法学", category: "Law", campus: "Songjiang" },
  { slug: `${schoolSlug}-political-science-and-administration`, nameEn: "Political Science and Administration", nameZh: "政治学与行政学", category: "Political Science", campus: "Songjiang" },
];
const undergraduatePrograms: CatalogSeedProgram[] = undergraduateSpecs.map((spec) => {
  const hongkou = spec.campus === "Hongkou";
  return {
    slug: spec.slug,
    schoolSlug,
    citySlug,
    nameEn: spec.nameEn,
    nameZh: spec.nameZh,
    degreeLevel: "Undergraduate",
    durationYears: 4,
    fieldCategory: spec.category,
    subjectArea: spec.category,
    teachingLanguage: "Chinese",
    cscaSubjects: ["Chinese for Humanities", "Mathematics"],
    cscaRequirement: hongkou
      ? "Applicants submit CSCA Chinese for Humanities and Mathematics."
      : "All Songjiang-campus applicants submit CSCA Chinese for Humanities and Mathematics; only the separately named technology, actuarial and data-science routes add Physics or Chemistry.",
    hskRequirement: hongkou
      ? "HSK Level 4 score 180 or above for first-year entry. Higher thresholds apply to transfer entry."
      : "HSK Level 5 or equivalent Chinese proficiency.",
    tuitionAmount: 24800,
    tuitionCurrency: "CNY",
    tuitionPeriod: "year",
    tuitionText: "CNY 24,800/year",
    applicationUrl: undergraduate.url,
    applicationNote: `Fall 2026 ${spec.campus} campus international undergraduate route. The published application window is closed.`,
    hasScholarship: true,
    scholarshipText: "The separately reviewed 2026 Shanghai Government Scholarship may apply subject to its degree, program and eligibility exclusions.",
    status: "draft",
    sourceUrl: undergraduate.url,
    sourceLabel: undergraduate.label,
    sourceSha256: undergraduate.sha256,
    capturedAt: undergraduate.fetchedAt,
    sourceFieldLineage: {
      nameEn: "editorial English rendering of the exact official Chinese program row; requires review",
      nameZh: `2026 international undergraduate ${spec.campus} campus program list`,
      degreeLevel: "2026 international undergraduate guide",
      durationYears: "2026 international undergraduate guide: four-year duration",
      teachingLanguage: hongkou ? "official program label: Chinese" : "Songjiang admission and language-requirement section",
      cscaSubjects: "2026 undergraduate guide CSCA section",
      hskRequirement: hongkou ? "Hongkou entry requirements" : "Songjiang entry requirements",
      tuitionAmount: `2026 ${spec.campus} fee section`,
      applicationUrl: "registered official 2026 undergraduate admissions page",
    },
  };
});

const englishMaster = (slug: string, nameEn: string, nameZh: string, category: string): CatalogSeedProgram => ({
  slug,
  schoolSlug,
  citySlug,
  nameEn,
  nameZh,
  degreeLevel: "Master",
  durationYears: 2,
  fieldCategory: category,
  subjectArea: category,
  teachingLanguage: "English",
  englishRequirement: "IELTS 6.0 or equivalent English proficiency.",
  tuitionAmount: 26000,
  tuitionCurrency: "CNY",
  tuitionPeriod: "year",
  tuitionText: "CNY 26,000/year for an English-taught academic master's degree",
  applicationUrl: master.url,
  applicationNote: "Fall 2026 full-time English-taught academic master's route. The self-funded application window closed April 30, 2026.",
  hasScholarship: true,
  scholarshipText: "This academic master's route is within the degree scope of the separately reviewed 2026 Shanghai Government Scholarship, subject to its eligibility rules.",
  status: "draft",
  sourceUrl: master.url,
  sourceLabel: master.label,
  sourceSha256: master.sha256,
  capturedAt: master.fetchedAt,
  sourceFieldLineage: {
    nameEn: "editorial English rendering of the exact official English-taught academic master's row; requires review",
    nameZh: "2026 full-English academic master's program list",
    degreeLevel: "2026 master's guide",
    durationYears: "2026 master's guide: full-English master's duration",
    teachingLanguage: "2026 full-English academic master's program list",
    englishRequirement: "2026 master's eligibility section",
    tuitionAmount: "2026 fee table: English-taught academic master's degree",
    applicationUrl: "registered official 2026 master's admissions page",
  },
});
const masterPrograms = [
  englishMaster(`${schoolSlug}-finance`, "Finance", "金融学（全英语授课）", "Finance"),
  englishMaster(`${schoolSlug}-global-communication`, "Global Communication", "全球传播（全英语授课）", "Communication"),
];
const programs = [...undergraduatePrograms, ...masterPrograms];

const programIntakes = programs.map((program) => {
  const isMaster = program.degreeLevel === "Master";
  const isHongkou = program.slug.endsWith("hongkou-campus");
  const deadlineDate = isMaster
    ? "2026-04-30T15:59:59.000Z"
    : isHongkou
      ? "2026-07-20T15:59:59.000Z"
      : "2026-04-15T15:59:59.000Z";
  const deadlineLabel = isMaster ? "April 30, 2026 (self-funded)" : isHongkou ? "July 20, 2026" : "April 15, 2026";
  const source = isMaster ? master : undergraduate;
  return {
    programSlug: program.slug,
    intakeTerm: "Fall",
    intakeYear: 2026,
    deadlineDate,
    deadlineLabel,
    applicationRound: `2026 ${isMaster ? "international master's" : "international undergraduate"} admission`,
    status: "closed" as const,
    sourceUrl: source.url,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    sourceFieldLineage: {
      deadlineDate: isMaster ? "official self-funded master's deadline" : isHongkou ? "official Hongkou application deadline" : "official Songjiang application deadline",
      intakeYear: "official 2026 admissions cycle",
    },
  };
});

const scholarship: CatalogSeedScholarship = {
  slug: "shisu-shanghai-government-scholarship-2026",
  schoolSlug,
  title: "2026 Shanghai Government Scholarship at SHISU",
  nameZh: "2026年上海市外国留学生政府奖学金（上海外国语大学）",
  type: "government",
  typeLabel: "Shanghai Government Scholarship",
  providerName: "上海市政府 / 上海外国语大学",
  providerNameEn: "Shanghai Municipal Government / Shanghai International Studies University",
  providerLocation: "Shanghai, China",
  fundingLevel: "Full or partial",
  coverage: "Category A covers tuition, accommodation, comprehensive medical insurance and a monthly stipend; Category B covers tuition and comprehensive medical insurance.",
  applicableDegree: "Category A: Master and Doctoral; Category B: Undergraduate, Master and Doctoral",
  applicableProgram: "Eligible Fall 2026 degree programs. Hongkou Chinese International Education, all professional master's programs, and the doctoral International Chinese Education program are excluded.",
  amountText: "Category A monthly stipend: CNY 3,000 for master's students and CNY 3,500 for doctoral students, plus tuition, accommodation and insurance. Category B covers tuition and insurance.",
  requirementText: "Non-Chinese citizen in good health; age 25 or below for undergraduate, 35 or below for master's, and 40 or below for doctoral; strong academic performance and attendance; no other scholarship in the same year; all SHISU admission requirements also apply.",
  deadlineDate: "2026-03-31",
  deadlineLabel: "March 31, 2026",
  applicationRound: "January 1-March 31, 2026",
  targetCountries: [],
  targetRegions: [],
  benefitItems: [
    { label: "Tuition", included: true },
    { label: "Accommodation", included: true, note: "Category A only" },
    { label: "Monthly stipend", included: true, note: "Category A: CNY 3,000 master's; CNY 3,500 doctoral" },
    { label: "Comprehensive medical insurance", included: true },
  ],
  eligibilityItems: [
    { label: "Citizenship and health", value: "Non-Chinese citizen in good health" },
    { label: "Age", value: "Undergraduate ≤25; Master ≤35; Doctoral ≤40" },
    { label: "Academic standing", value: "Strong academic performance and attendance" },
    { label: "Other funding", value: "No other scholarship in the same year" },
  ],
  applicationMaterials: [
    { label: "Shanghai Government Scholarship application form" },
    { label: "Degree application materials", value: "Follow the applicable 2026 SHISU degree guide" },
  ],
  applicationSteps: [
    { label: "Step 1", value: "Complete the SHISU international-student online application and upload PDF materials." },
    { label: "Step 2", value: "Upload the Shanghai Government Scholarship application form." },
    { label: "Step 3", value: "Pay the applicable non-refundable application fee and confirm submission." },
  ],
  actionLinks: [{ label: scholarshipSource.label, url: scholarshipSource.url, kind: "official-source" }],
  summary: "Closed 2026 Shanghai Government Scholarship round for new SHISU degree students, with published A and B funding categories and explicit program exclusions.",
  status: "draft",
  sourceUrl: scholarshipSource.url,
  sourceLabel: scholarshipSource.label,
  sourceSha256: scholarshipSource.sha256,
  capturedAt: scholarshipSource.fetchedAt,
  sourceFieldLineage: {
    title: "official 2026 scholarship guide heading",
    fundingLevel: "official scholarship-content section",
    coverage: "official Category A and B coverage",
    applicableDegree: "official Category A and B scope",
    applicableProgram: "official funded-program section and exclusions",
    deadlineDate: "official application period",
    eligibilityItems: "official eligibility section",
  },
};

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: scholarshipManifest.generatedAt,
  cities: [cityBundle.cities[0]],
  schools: [{
    slug: schoolSlug,
    nameEn: "Shanghai International Studies University",
    nameZh: "上海外国语大学",
    citySlug,
    schoolType: "Public",
    region: "Shanghai, East China",
    applicationLevel: "Undergraduate, Master and Doctoral",
    languageOfInstruction: "Chinese and English depending on route",
    languageRequirement: "Chinese-taught undergraduate routes use the published HSK thresholds; English-taught master's routes require IELTS 6.0 or equivalent.",
    hskRequirement: "Hongkou International Economics and Trade requires HSK Level 4 score 180 for first-year entry; Songjiang undergraduate routes require HSK Level 5 or equivalent.",
    englishRequirement: "English-taught master's routes require IELTS 6.0 or equivalent English proficiency.",
    deadlineSummary: "Reviewed Fall 2026 routes are closed: Songjiang undergraduate April 15, master's self-funded April 30, and Hongkou undergraduate July 20. No 2027 dates are inferred.",
    tuitionSummary: "Reviewed undergraduate routes cost CNY 24,800/year; English-taught academic master's routes cost CNY 26,000/year.",
    applicationFee: "Hongkou undergraduate CNY 500; Songjiang undergraduate CNY 750; master's CNY 800",
    websiteUrl: "https://www.shisu.edu.cn/",
    admissionsUrl: undergraduate.url,
    cscaRequired: true,
    cscaRequirement: "International undergraduate applicants submit CSCA Chinese for Humanities and Mathematics; only separately named technical routes add Physics or Chemistry.",
    cscaSubjects: ["Chinese for Humanities", "Mathematics"],
    subjectTags: ["Languages", "International Trade", "Finance", "Business", "Law", "Political Science", "Communication"],
    languageTags: ["Chinese", "English"],
    campusHighlights: ["Foreign-language and international-studies focus", "Hongkou and Songjiang international undergraduate routes", "English-taught academic master's routes"],
    status: "draft",
    sourceUrl: undergraduate.url,
    sourceLabel: undergraduate.label,
    sourceSha256: undergraduate.sha256,
    capturedAt: undergraduate.fetchedAt,
    sourceFieldLineage: {
      nameEn: "official university identity",
      nameZh: "official admissions site identity",
      citySlug: "official contact address",
      applicationLevel: `undergraduate guide and master guide ${master.sha256}`,
      languageOfInstruction: `undergraduate guide and master guide ${master.sha256}`,
      languageRequirement: `undergraduate guide and master guide ${master.sha256}`,
      deadlineSummary: `undergraduate guide and master guide ${master.sha256}`,
      tuitionSummary: `undergraduate guide and master guide ${master.sha256}`,
      applicationFee: `undergraduate guide and scholarship guide ${scholarshipSource.sha256}`,
      admissionsUrl: "registered official 2026 undergraduate admissions page",
      cscaRequirement: "official 2026 undergraduate CSCA section",
    },
  }],
  programs,
  programIntakes,
  scholarships: [scholarship],
};

const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 11 || validation.summary.programIntakes !== 11 || validation.summary.scholarships !== 1) {
  throw new Error(`SHISU candidate invalid:\n${validation.errors.join("\n")}`);
}
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha(candidateText),
  admissionManifestSha256: sha(admissionManifestText),
  scholarshipManifestSha256: sha(scholarshipManifestText),
  sourceReview: {
    status: "unreviewed_draft",
    notes: [
      "All eleven prohibited-source legacy program identities have exact current official replacements: nine undergraduate and two English-taught academic master's routes.",
      "The generic International Economics and Trade legacy identity is assigned to the Songjiang route; the separately named Hongkou route remains distinct.",
      "Every Fall 2026 intake and the 2026 Shanghai Government Scholarship round are closed; no 2027 dates are inferred.",
      "The new Shanghai Government Scholarship draft is distinct from the prohibited-source legacy university-scholarship identity, which remains unresolved and quarantined.",
      "English program titles are editorial renderings of exact official Chinese rows and remain review-required.",
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
