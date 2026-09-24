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
const catalogManifestPath = resolve(root, "work/catalog-official/2026-09-22T13-24-39-087Z/manifest.json");
const scholarshipManifestPath = resolve(root, "work/catalog-official/2026-09-22T13-26-15-599Z/manifest.json");
const cityPath = resolve(root, "seeds/catalog.beijing-city-rich-batch-01.draft.json");
const candidatePath = resolve(root, "seeds/catalog.cufe-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.cufe-complete-batch-01.validation.json");
const [catalogManifestText, scholarshipManifestText, cityText] = await Promise.all([
  readFile(catalogManifestPath, "utf8"),
  readFile(scholarshipManifestPath, "utf8"),
  readFile(cityPath, "utf8"),
]);
const catalogManifest = JSON.parse(catalogManifestText);
const scholarshipManifest = JSON.parse(scholarshipManifestText);
const cityBundle = JSON.parse(cityText);
type SourceRecord = { id: string; status: number; url: string; label: string; sha256: string; fetchedAt: string };
const sources = new Map<string, SourceRecord>([
  ...(catalogManifest.sources as SourceRecord[]),
  ...(scholarshipManifest.sources as SourceRecord[]),
].map((row) => [row.id, row]));
const expected = {
  "cufe-international-undergraduate-admissions-zh-2026": "0b43ff69c030582883414b168253923f6910a05609bcb67774311abfba5b9a3f",
  "cufe-international-undergraduate-admissions-en-2026": "1c1c5daa32e2fda7b4abdda0e83a0f56de2893a6e68f703936b89ae104a6d54c",
  "cufe-international-undergraduate-program-catalog-zh-2026": "6c43f39eb0782234f33452c955086017b1baf87e431da5b9ce53ea3dc4870c6f",
  "cufe-international-undergraduate-program-catalog-en-2026": "ddaffca10ceedd7a827966fbb063b5c253560d41a02cb6424d76a3093b623459",
  "cufe-finance-english-undergraduate-2026": "a0b979811d1206e78aae2613e7aada3a277407cdb8092b46a933e8e7fe1ad7af",
  "cufe-cgs-silk-road-2026": "3b056d165b6688c6c12f500d6a32722bee32721d04ed6f0f604caaef1f35dd06",
  "cufe-cgs-high-level-graduate-en-2026": "974349e6d82d14eac743e598b89b4ad0c741573102134b841586e76689a74a67",
} as const;
for (const [id, digest] of Object.entries(expected)) {
  const source = sources.get(id);
  if (!source || source.status !== 200 || source.sha256 !== digest) throw new Error(`CUFE evidence mismatch: ${id}`);
}
const admissionsZh = sources.get("cufe-international-undergraduate-admissions-zh-2026")!;
const catalogEn = sources.get("cufe-international-undergraduate-program-catalog-en-2026")!;
const financeEnglish = sources.get("cufe-finance-english-undergraduate-2026")!;
const silkRoad = sources.get("cufe-cgs-silk-road-2026")!;
const highLevel = sources.get("cufe-cgs-high-level-graduate-en-2026")!;
const schoolSlug = "central-university-of-finance-and-economics";
const citySlug = "beijing";

type ProgramSpec = { suffix: string; nameEn: string; nameZh: string; category: string; english?: boolean; silkRoad?: boolean };
const specs: ProgramSpec[] = [
  { suffix: "finance-english", nameEn: "Finance", nameZh: "金融学", category: "Finance", english: true },
  { suffix: "public-finance", nameEn: "Public Finance", nameZh: "财政学", category: "Public Finance" },
  { suffix: "finance", nameEn: "Finance", nameZh: "金融学", category: "Finance", silkRoad: true },
  { suffix: "accounting", nameEn: "Accounting", nameZh: "会计学", category: "Accounting" },
  { suffix: "financial-management", nameEn: "Financial Management", nameZh: "财务管理", category: "Accounting" },
  { suffix: "insurance", nameEn: "Insurance", nameZh: "保险学", category: "Finance", silkRoad: true },
  { suffix: "actuarial-science", nameEn: "Actuarial Science", nameZh: "精算学", category: "Finance", silkRoad: true },
  { suffix: "applied-statistics", nameEn: "Applied Statistics", nameZh: "应用统计学", category: "Statistics" },
  { suffix: "mathematics-and-applied-mathematics", nameEn: "Mathematics and Applied Mathematics", nameZh: "数学与应用数学", category: "Mathematics" },
  { suffix: "international-trade-and-economics", nameEn: "International Trade and Economics", nameZh: "国际经济与贸易", category: "International Trade", silkRoad: true },
  { suffix: "business-administration", nameEn: "Business Administration", nameZh: "工商管理", category: "Business Administration" },
  { suffix: "human-resource-management", nameEn: "Human Resource Management", nameZh: "人力资源管理", category: "Business Administration" },
  { suffix: "public-administration", nameEn: "Public Administration", nameZh: "行政管理", category: "Public Administration" },
  { suffix: "public-service-administration", nameEn: "Public Service Administration", nameZh: "公共事业管理", category: "Public Administration" },
  { suffix: "urban-management", nameEn: "Urban Management", nameZh: "城市管理", category: "Public Administration" },
  { suffix: "sports-economics-and-management", nameEn: "Sports Economics and Management", nameZh: "体育经济与管理", category: "Business Administration" },
  { suffix: "sports-training", nameEn: "Sports Training", nameZh: "运动训练", category: "Sports" },
  { suffix: "law", nameEn: "Law", nameZh: "法学", category: "Law" },
  { suffix: "english", nameEn: "English", nameZh: "英语", category: "Foreign Languages" },
  { suffix: "translation", nameEn: "Translation", nameZh: "翻译", category: "Foreign Languages" },
  { suffix: "economics", nameEn: "Economics", nameZh: "经济学", category: "Economics" },
  { suffix: "national-economics-management", nameEn: "National Economics Management", nameZh: "国民经济管理", category: "Economics" },
  { suffix: "sociology", nameEn: "Sociology", nameZh: "社会学", category: "Sociology" },
  { suffix: "applied-psychology", nameEn: "Applied Psychology", nameZh: "应用心理学", category: "Psychology" },
  { suffix: "information-management-and-information-system", nameEn: "Information Management and Information System", nameZh: "信息管理与信息系统", category: "Information Systems" },
  { suffix: "e-commerce", nameEn: "E-Commerce", nameZh: "电子商务", category: "E-Commerce" },
  { suffix: "computer-science-and-technology", nameEn: "Computer Science and Technology", nameZh: "计算机科学与技术", category: "Computer Science" },
  { suffix: "information-security", nameEn: "Information Security", nameZh: "信息安全", category: "Computer Science" },
];

const programs: CatalogSeedProgram[] = specs.map((spec) => {
  const source = spec.english ? financeEnglish : catalogEn;
  return {
    slug: `${schoolSlug}-${spec.suffix}`,
    schoolSlug,
    citySlug,
    nameEn: spec.nameEn,
    nameZh: spec.nameZh,
    degreeLevel: "Undergraduate",
    durationYears: 4,
    fieldCategory: spec.category,
    subjectArea: spec.category,
    teachingLanguage: spec.english ? "English" : "Chinese",
    cscaSubjects: spec.english ? ["Mathematics"] : ["Humanities Chinese", "Mathematics"],
    cscaRequirement: spec.english
      ? "Submit a CSCA Mathematics result."
      : "Submit CSCA Humanities Chinese and Mathematics results.",
    hskRequirement: spec.english ? undefined : "HSK Level 5 with a score of 180 or above.",
    englishRequirement: spec.english ? "IELTS, TOEFL, Duolingo, another standardized result, or other proof of English proficiency." : undefined,
    tuitionAmount: spec.english ? 40000 : 25000,
    tuitionCurrency: "CNY",
    tuitionPeriod: "year",
    tuitionText: spec.english ? "CNY 40,000/academic year" : "CNY 25,000/academic year",
    applicationUrl: spec.english ? financeEnglish.url : admissionsZh.url,
    applicationNote: "Fall 2026 international undergraduate route. The published application window is closed.",
    hasScholarship: Boolean(spec.silkRoad),
    scholarshipText: spec.silkRoad ? "Listed in CUFE's closed 2026 Chinese Government Scholarship Silk Road route." : undefined,
    status: "draft",
    sourceUrl: source.url,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    sourceFieldLineage: {
      nameEn: "official 2026 English undergraduate program table",
      nameZh: "official 2026 Chinese undergraduate program table",
      degreeLevel: "official 2026 undergraduate catalog title",
      durationYears: "official 2026 program table",
      teachingLanguage: "official 2026 program-table language columns",
      cscaSubjects: spec.english ? "official English-taught Finance guide" : "official 2026 undergraduate guide",
      cscaRequirement: spec.english ? "official English-taught Finance guide" : "official 2026 undergraduate guide",
      ...(spec.english ? { englishRequirement: "official English-taught Finance guide" } : { hskRequirement: "official 2026 undergraduate guide" }),
      tuitionAmount: "official 2026 program table",
      applicationUrl: spec.english ? "registered official English-taught Finance guide" : "registered official Chinese undergraduate guide",
    },
  };
});

const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2026,
  openDate: "2025-10-31T16:00:00.000Z",
  deadlineDate: "2026-06-25T15:59:59.000Z",
  deadlineLabel: "June 25, 2026",
  applicationRound: program.teachingLanguage === "English" ? "2026 English-taught Finance undergraduate admission" : "2026 international undergraduate admission",
  status: "closed" as const,
  sourceUrl: program.teachingLanguage === "English" ? financeEnglish.url : admissionsZh.url,
  sourceLabel: program.teachingLanguage === "English" ? financeEnglish.label : admissionsZh.label,
  sourceSha256: program.teachingLanguage === "English" ? financeEnglish.sha256 : admissionsZh.sha256,
  capturedAt: program.teachingLanguage === "English" ? financeEnglish.fetchedAt : admissionsZh.fetchedAt,
  sourceFieldLineage: {
    openDate: "official application-period section",
    deadlineDate: "official application-period section",
    intakeYear: "official guide title and September 2026 registration section",
  },
}));

const scholarshipBase = {
  schoolSlug,
  type: "government",
  providerName: "中国政府 / 中央财经大学",
  providerNameEn: "Chinese Government / Central University of Finance and Economics",
  providerLocation: "Beijing, China",
  fundingLevel: "Full scholarship",
  coverage: "Full scholarship; the reviewed CUFE guide does not itemize the benefit amounts.",
  amountText: "Exact benefit amounts are not itemized on the reviewed CUFE guide.",
  targetCountries: [] as string[],
  targetRegions: [] as string[],
  benefitItems: [] as { label: string; included: boolean; note?: string }[],
  status: "draft" as const,
};
const scholarships: CatalogSeedScholarship[] = [
  {
    ...scholarshipBase,
    slug: "cufe-chinese-government-scholarship-silk-road-2026",
    title: "Chinese Government Scholarship Silk Road Program at CUFE 2026",
    nameZh: "中央财经大学中国政府奖学金丝绸之路项目 2026",
    typeLabel: "Chinese Government Scholarship Silk Road Program",
    applicableDegree: "Undergraduate and Master",
    applicableProgram: "Chinese-taught undergraduate Finance, International Trade and Economics, Insurance and Actuarial Science; Chinese-taught professional master's Digital Economy.",
    requirementText: "Non-Chinese citizens meeting the published degree and age rules. Undergraduate applicants require HSK Level 5 score 180 and CSCA Humanities Chinese and Mathematics; master's applicants require HSK Level 5 score 210.",
    deadlineDate: "2026-04-30",
    deadlineLabel: "April 30, 2026",
    applicationRound: "December 1, 2025-April 30, 2026",
    eligibilityItems: [
      { label: "Undergraduate", value: "High-school qualification, generally under age 25" },
      { label: "Master", value: "Bachelor's qualification, generally under age 35" },
      { label: "Language", value: "HSK 5 score 180 undergraduate; HSK 5 score 210 master" },
    ],
    applicationMaterials: [{ label: "Core documents", value: "CSC and CUFE forms, passport, diploma, transcripts, language and CSCA evidence where applicable, study plan, recommendations, medical examination and no-criminal-record certificate." }],
    applicationSteps: [
      { label: "Step 1", value: "Submit a CSC Type B application using CUFE agency number 10034." },
      { label: "Step 2", value: "Submit the CUFE online application and pay the published application fee." },
    ],
    actionLinks: [{ label: silkRoad.label, url: silkRoad.url, kind: "official-source" }],
    summary: "Closed 2026 full scholarship for four named Chinese-taught undergraduate routes and one professional master's route.",
    sourceUrl: silkRoad.url,
    sourceLabel: silkRoad.label,
    sourceSha256: silkRoad.sha256,
    capturedAt: silkRoad.fetchedAt,
    sourceFieldLineage: {
      title: "official 2026 guide title",
      fundingLevel: "official introduction",
      applicableDegree: "official 2026 program table",
      applicableProgram: "official 2026 program table",
      requirementText: "official eligibility and application-materials sections",
      deadlineDate: "official application-period section",
    },
  },
  {
    ...scholarshipBase,
    slug: "cufe-chinese-government-scholarship-high-level-graduate-2026",
    title: "Chinese Government Scholarship High Level Graduate Program at CUFE 2026",
    nameZh: "中央财经大学中国政府奖学金高水平研究生项目 2026",
    typeLabel: "Chinese Government Scholarship High Level Graduate Program",
    applicableDegree: "Master and Doctoral",
    applicableProgram: "The English- and Chinese-taught master's and doctoral routes listed in the official 2026 scholarship guide.",
    requirementText: "Master's applicants generally must hold a bachelor's degree and be under 35; doctoral applicants generally must hold a master's degree and be under 40. Chinese routes require HSK Level 5 score 210 or above; English routes require accepted English proficiency evidence.",
    deadlineDate: "2026-03-06",
    deadlineLabel: "March 6, 2026",
    applicationRound: "November 1, 2025-March 6, 2026",
    eligibilityItems: [
      { label: "Master", value: "Bachelor's qualification, generally under age 35" },
      { label: "Doctoral", value: "Master's qualification, generally under age 40" },
      { label: "Language", value: "HSK 5 score 210 for Chinese routes; accepted English proficiency evidence for English routes" },
    ],
    applicationMaterials: [{ label: "Core documents", value: "CSC and CUFE forms, passport, degree evidence, transcripts, language proof, study plan, recommendations, medical examination and no-criminal-record certificate." }],
    applicationSteps: [
      { label: "Step 1", value: "Submit a CSC Type B application using CUFE agency number 10034." },
      { label: "Step 2", value: "Submit the CUFE online application and complete the university assessment." },
    ],
    actionLinks: [{ label: highLevel.label, url: highLevel.url, kind: "official-source" }],
    summary: "Closed 2026 full Chinese Government Scholarship for the named CUFE master's and doctoral routes.",
    sourceUrl: highLevel.url,
    sourceLabel: highLevel.label,
    sourceSha256: highLevel.sha256,
    capturedAt: highLevel.fetchedAt,
    sourceFieldLineage: {
      title: "official 2026 guide title",
      fundingLevel: "official introduction",
      applicableDegree: "official 2026 program table",
      applicableProgram: "official 2026 program table",
      requirementText: "official eligibility and language sections",
      deadlineDate: "official application-period section",
    },
  },
];

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: catalogManifest.generatedAt,
  cities: [cityBundle.cities[0]],
  schools: [{
    slug: schoolSlug,
    nameEn: "Central University of Finance and Economics",
    nameZh: "中央财经大学",
    citySlug,
    schoolType: "Public",
    region: "Beijing, North China",
    applicationLevel: "Undergraduate, Master and Doctoral",
    languageOfInstruction: "Chinese for 27 reviewed undergraduate routes; English for the reviewed Finance route",
    languageRequirement: "Chinese routes require HSK Level 5 score 180 or above. The English Finance route requires accepted English proficiency evidence.",
    hskRequirement: "HSK Level 5 score 180 or above for the reviewed Chinese-taught undergraduate routes.",
    deadlineSummary: "The Fall 2026 undergraduate deadline was June 25, 2026. The reviewed 2026 scholarship deadlines have also passed. No 2027 dates are inferred.",
    tuitionSummary: "CNY 25,000/year for reviewed Chinese-taught undergraduate routes; CNY 40,000/year for the English-taught Finance route.",
    websiteUrl: "https://www.cufe.edu.cn/",
    admissionsUrl: admissionsZh.url,
    cscaRequired: true,
    cscaRequirement: "Chinese-taught undergraduate routes require Humanities Chinese and Mathematics; the English-taught Finance route requires Mathematics only.",
    cscaSubjects: ["Humanities Chinese", "Mathematics"],
    subjectTags: [...new Set(specs.map((spec) => spec.category))],
    languageTags: ["Chinese", "English"],
    campusHighlights: ["Finance and economics focus", "28 reviewed international undergraduate routes", "Haidian District campus"],
    contactNotes: "International admissions: +86-10-62288286; lxs@cufe.edu.cn; 39 South College Road, Haidian District, Beijing.",
    status: "draft",
    sourceUrl: admissionsZh.url,
    sourceLabel: admissionsZh.label,
    sourceSha256: admissionsZh.sha256,
    capturedAt: admissionsZh.fetchedAt,
    sourceFieldLineage: {
      nameEn: "official English admissions and catalog pages",
      nameZh: "official Chinese admissions page title",
      citySlug: "official contact address",
      applicationLevel: "official undergraduate and scholarship guides",
      languageOfInstruction: "official undergraduate program-table language columns",
      languageRequirement: "official 2026 application guides",
      deadlineSummary: "official 2026 application-period sections",
      tuitionSummary: "official 2026 undergraduate program table",
      admissionsUrl: "registered official Chinese 2026 guide",
      cscaRequirement: "official Chinese and English-taught application guides",
    },
  }],
  programs,
  programIntakes,
  scholarships,
};

const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 28 || validation.summary.programIntakes !== 28 || validation.summary.scholarships !== 2) {
  throw new Error(`CUFE candidate invalid:\n${validation.errors.join("\n")}`);
}
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha(candidateText),
  catalogManifestSha256: sha(catalogManifestText),
  scholarshipManifestSha256: sha(scholarshipManifestText),
  sourceReview: {
    status: "unreviewed_draft",
    notes: [
      "The official bilingual program tables contain exactly 28 four-year routes: 27 Chinese-taught and one English-taught Finance route.",
      "The Chinese- and English-taught Finance routes are kept as separate program identities because they belong to different schools, languages and tuition bands.",
      "All 28 Fall 2026 undergraduate intake rows are closed and no 2027 date is inferred.",
      "Four named Chinese-taught undergraduate routes are marked scholarship-linked only because the 2026 Silk Road guide lists them explicitly.",
      "The reviewed scholarship pages call the awards full scholarships but do not itemize benefit amounts; those amounts remain unresolved.",
      "The legacy generic CUFE scholarship is not copied because it has no exact official identity; the two specific current 2026 routes replace it only as separate draft records.",
      "Legacy Marketing (Big Data and Marketing) is absent from the official 2026 international catalog and remains quarantined rather than guessed into another route.",
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
