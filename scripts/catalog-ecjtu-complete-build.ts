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
const manifestPath = resolve(root, "work/catalog-official/ecjtu-complete-20261016/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.ecjtu-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.ecjtu-complete-batch-01.validation.json");
const manifestText = await readFile(manifestPath, "utf8");
const manifest = JSON.parse(manifestText) as {
  generatedAt: string;
  sources: Array<{ id: string; status: number; url: string; finalUrl: string; label: string; sha256: string; fetchedAt: string }>;
};
const source = manifest.sources.find((row) => row.id === "ecjtu-international-english-program-admissions-2026");
const expectedSha256 = "49c8d0b3b44971931760a4a84140e49aa3363e3824c5a163355fbd930cf21cd1";
if (!source || source.status !== 200 || source.sha256 !== expectedSha256) throw new Error("ECJTU official evidence mismatch.");

const schoolSlug = "east-china-jiaotong-university";
const citySlug = "nanchang";
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
type ProgramSpec = readonly [degree: "Undergraduate" | "Master" | "Doctoral", nameEn: string, nameZh: string, durationYears: number, category: string, hskRequired?: boolean];
const specs: ProgramSpec[] = [
  ["Doctoral", "Civil Engineering", "土木工程", 5, "Engineering"],
  ["Doctoral", "Control Science and Engineering", "控制科学与工程", 5, "Engineering"],
  ["Doctoral", "Transportation Engineering (Logistics System Optimization)", "交通运输工程（物流系统优化方向）", 5, "Transportation"],
  ["Doctoral", "Mechanical Engineering", "机械工程", 5, "Engineering"],
  ["Doctoral", "Electronic Information", "电子信息", 5, "Information Technology"],
  ["Master", "Business Administration", "工商管理", 3, "Business"],
  ["Master", "International Chinese Language Education", "国际中文教育", 3, "Education", true],
  ["Undergraduate", "Civil Engineering", "土木工程", 4, "Engineering"],
  ["Undergraduate", "Electrical Engineering and Automation", "电气工程及其自动化", 4, "Engineering"],
  ["Undergraduate", "Transportation Engineering", "交通运输", 4, "Transportation"],
  ["Undergraduate", "International Economics and Trade", "国际经济与贸易", 4, "Economics"],
  ["Undergraduate", "Chinese Language and Literature", "汉语言文学", 4, "Languages and Literature", true],
];

const evidence = {
  sourceUrl: source.finalUrl,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
};
const programs: CatalogSeedProgram[] = specs.map(([degreeLevel, nameEn, nameZh, durationYears, fieldCategory, hskRequired]) => ({
  slug: `${schoolSlug}-${degreeLevel.toLowerCase()}-${slugify(nameEn)}`,
  schoolSlug,
  citySlug,
  nameEn,
  nameZh,
  degreeLevel,
  durationYears,
  fieldCategory,
  subjectArea: nameEn,
  teachingLanguage: "English",
  englishRequirement: "TOEFL 80, IELTS 5.5, prior education delivered entirely in English, or English as an official language.",
  ...(hskRequired ? { hskRequirement: "HSK Level 4 is additionally required for this program." } : {}),
  ...(degreeLevel === "Doctoral"
    ? { tuitionText: "Full tuition waiver under the reviewed 2026 brochure." }
    : { tuitionAmount: 16000, tuitionCurrency: "CNY", tuitionPeriod: "year", tuitionText: "CNY 16,000/year" }),
  scholarshipText: "The university may nominate outstanding students for a provincial scholarship subject to the annual provincial rules and quota.",
  applicationUrl: "https://ecjtu.at0086.cn/student",
  applicationNote: "Official 2026 English-taught international program; all applicants must attend an online interview.",
  hasScholarship: true,
  status: "draft",
  ...evidence,
  sourceFieldLineage: {
    nameEn: "English-taught majors table",
    nameZh: "English-taught majors table",
    degreeLevel: "English-taught majors table",
    durationYears: "English-taught majors table",
    teachingLanguage: "brochure title and English-taught majors section",
    tuitionText: "fee structure table",
    applicationUrl: "application procedure section",
  },
}));

const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2026,
  deadlineLabel: "June 2026",
  applicationRound: "2026 international English-taught programs",
  status: "closed" as const,
  ...evidence,
  sourceFieldLineage: { intakeYear: "brochure title", deadlineLabel: "English-taught majors table" },
}));

const scholarships: CatalogSeedScholarship[] = [{
  slug: "official-2026-ecjtu-provincial-international-student-scholarship",
  title: "ECJTU 2026 Provincial International Student Scholarship Nomination",
  nameZh: "华东交通大学2026年省级来华留学奖学金推荐",
  schoolSlug,
  type: "government",
  typeLabel: "Provincial scholarship",
  providerName: "省级主管部门 / 华东交通大学",
  providerNameEn: "Provincial authority / East China Jiaotong University",
  providerLocation: "Jiangxi, China",
  fundingLevel: "Not stated",
  coverage: "The reviewed brochure does not state the benefit amount or coverage.",
  applicableDegree: "International students",
  applicableProgram: "Subject to the annual provincial selection rules and quota",
  amountText: "Not stated in the reviewed 2026 brochure",
  deadlineLabel: "Not stated in the reviewed 2026 brochure",
  applicationRound: "2026 provincial nomination",
  targetCountries: [],
  targetRegions: [],
  eligibilityItems: [{ label: "Selection", value: "The university competitively nominates students with strong academic performance and conduct." }],
  applicationSteps: [{ label: "Nomination", value: "Follow the annual provincial rules and university nomination notice when published." }],
  actionLinks: [{ label: source.label, url: source.finalUrl, kind: "official-source" }],
  summary: "A provincial scholarship nomination route is confirmed, while unsupported benefit and deadline fields remain blank or explicitly unstated.",
  status: "draft",
  ...evidence,
  sourceFieldLineage: { title: "scholarship section", fundingLevel: "not published", coverage: "scholarship section", applicableDegree: "scholarship section", deadlineLabel: "not published" },
}];

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: manifest.generatedAt,
  cities: [{
    slug: citySlug,
    nameEn: "Nanchang",
    nameZh: "南昌",
    province: "Jiangxi",
    region: "East China",
    status: "draft",
    verificationStatus: "unverified",
    ...evidence,
    sourceFieldLineage: { nameEn: "official admissions address", nameZh: "official admissions address", province: "official admissions address", region: "CUAC geographic taxonomy" },
  }],
  schools: [{
    slug: schoolSlug,
    nameEn: "East China Jiaotong University",
    nameZh: "华东交通大学",
    citySlug,
    schoolType: "Public",
    region: "Nanchang, Jiangxi, East China",
    applicationLevel: "Undergraduate, Master, Doctoral",
    languageOfInstruction: "English for the reviewed 2026 international program list",
    languageRequirement: "TOEFL 80, IELTS 5.5, previous education delivered entirely in English, or English as an official language; two named Chinese-language programs additionally require HSK 4.",
    hskRequirement: "HSK Level 4 for International Chinese Language Education and Chinese Language and Literature.",
    englishRequirement: "TOEFL 80, IELTS 5.5, prior English-medium education, or English as an official language.",
    deadlineSummary: "The reviewed 2026 brochure states June 2026; that cycle is closed and no 2027 deadline is inferred.",
    tuitionSummary: "Doctoral routes: full tuition waiver. Reviewed master and undergraduate routes: CNY 16,000/year.",
    websiteUrl: "https://www.ecjtu.edu.cn/",
    admissionsUrl: source.finalUrl,
    subjectTags: ["Engineering", "Transportation", "Business", "Economics", "Chinese Language"],
    languageTags: ["English", "HSK 4 for two named routes"],
    campusHighlights: ["Nanchang location", "Transportation and engineering programs", "2026 English-taught international routes"],
    status: "draft",
    ...evidence,
    sourceFieldLineage: { nameEn: "brochure title", nameZh: "brochure title", citySlug: "official admissions address", applicationLevel: "English-taught majors table", languageRequirement: "language proficiency section", deadlineSummary: "English-taught majors table", tuitionSummary: "fee structure table", admissionsUrl: "registered official page" },
  }],
  programs,
  programIntakes,
  scholarships,
};

const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha256(candidateText),
  manifestSha256: sha256(manifestText),
  sourceReview: {
    status: "unreviewed_draft",
    notes: [
      "All 12 program routes are transcribed from the official 2026 HTML table.",
      "The brochure labels the list as English-taught; HSK 4 is retained only for the two routes that explicitly state it.",
      "No CSCA requirement, application fee, exact scholarship amount or scholarship deadline is inferred.",
      "Personal contact details and bank/payment data are excluded.",
    ],
  },
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
};
await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
