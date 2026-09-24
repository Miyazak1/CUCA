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
const manifestPath = resolve(root, "work/catalog-official/2026-09-22T13-10-14-978Z/manifest.json");
const cityPath = resolve(root, "seeds/catalog.tianjin-city-rich-batch-01.draft.json");
const candidatePath = resolve(root, "seeds/catalog.tjufe-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.tjufe-complete-batch-01.validation.json");
const [manifestText, cityText] = await Promise.all([readFile(manifestPath, "utf8"), readFile(cityPath, "utf8")]);
const manifest = JSON.parse(manifestText);
const cityBundle = JSON.parse(cityText);
type SourceRecord = { id: string; status: number; url: string; label: string; sha256: string; fetchedAt: string };
const sources = new Map<string, SourceRecord>((manifest.sources as SourceRecord[]).map((row) => [row.id, row]));
const expected = {
  "tjufe-international-undergraduate-admissions-zh-2026": "ab8a8fecfa41070755aa2698957ca6b79edf19dbd0ae524cf4bb642394be70e8",
  "tjufe-international-undergraduate-admissions-en-2026": "2ab3df69480eac0076018e82027a6b82b6269f8911245542ebb79e5deba1a3b2",
  "tjufe-cgs-bilateral-type-a-2026": "15ac6d3598fe2005a9dd45868531fbe00c01e544eab1fcad6c197e8126917a6b",
  "tjufe-cgs-high-level-graduate-zh-2026": "afb7f786d5c7335f8b84f0e42e0495c237dc873326c7d5a380974100aa86c68c",
} as const;
for (const [id, digest] of Object.entries(expected)) {
  const source = sources.get(id);
  if (!source || source.status !== 200 || source.sha256 !== digest) throw new Error(`TUFE evidence mismatch: ${id}`);
}
const pageZh = sources.get("tjufe-international-undergraduate-admissions-zh-2026")!;
const pageEn = sources.get("tjufe-international-undergraduate-admissions-en-2026")!;
const bilateral = sources.get("tjufe-cgs-bilateral-type-a-2026")!;
const highLevel = sources.get("tjufe-cgs-high-level-graduate-zh-2026")!;
const schoolSlug = "tianjin-university-of-finance-and-economics";
const citySlug = "tianjin";

type ProgramSpec = { suffix: string; nameEn: string; nameZh: string; category: string; art?: boolean };
const specs: ProgramSpec[] = [
  { suffix: "chinese-language-and-literature-international-business", nameEn: "Chinese Language and Literature (International Business)", nameZh: "汉语言文学（国际商务）", category: "Chinese Language" },
  { suffix: "international-economy-and-trade-china-economy-and-business", nameEn: "International Economy and Trade (China Economy and Business)", nameZh: "国际经济与贸易（中国经济通商）", category: "International Trade" },
  { suffix: "business-administration", nameEn: "Business Administration", nameZh: "工商管理", category: "Business Administration" },
  { suffix: "human-resource-management", nameEn: "Human Resource Management", nameZh: "人力资源管理", category: "Business Administration" },
  { suffix: "marketing", nameEn: "Marketing", nameZh: "市场营销", category: "Business Administration" },
  { suffix: "tourism-management", nameEn: "Tourism Management", nameZh: "旅游管理", category: "Tourism Management" },
  { suffix: "convention-exhibition-economy-and-administration", nameEn: "Convention-Exhibition Economy and Administration", nameZh: "会展经济与管理", category: "Tourism Management" },
  { suffix: "logistics-management", nameEn: "Logistics Management", nameZh: "物流管理", category: "Logistics Management" },
  { suffix: "advertising", nameEn: "Advertising", nameZh: "广告学", category: "Advertising" },
  { suffix: "international-economics-and-trade", nameEn: "International Economics and Trade", nameZh: "国际经济与贸易", category: "International Trade" },
  { suffix: "international-business", nameEn: "International Business", nameZh: "国际商务", category: "Business Administration" },
  { suffix: "economics", nameEn: "Economics", nameZh: "经济学", category: "Economics" },
  { suffix: "finance", nameEn: "Finance", nameZh: "金融学", category: "Finance" },
  { suffix: "financial-engineering", nameEn: "Financial Engineering", nameZh: "金融工程", category: "Finance" },
  { suffix: "insurance", nameEn: "Insurance", nameZh: "保险学", category: "Finance" },
  { suffix: "credit-management", nameEn: "Credit Management", nameZh: "信用管理", category: "Finance" },
  { suffix: "investment", nameEn: "Investment Science", nameZh: "投资学", category: "Finance" },
  { suffix: "digital-economy", nameEn: "Digital Economy", nameZh: "数字经济", category: "Economics" },
  { suffix: "big-data-management-and-application", nameEn: "Big Data Management and Application", nameZh: "大数据管理与应用", category: "Management Science" },
  { suffix: "accounting", nameEn: "Accounting", nameZh: "会计学", category: "Accounting" },
  { suffix: "auditing", nameEn: "Auditing", nameZh: "审计学", category: "Accounting" },
  { suffix: "financial-management", nameEn: "Financial Management", nameZh: "财务管理", category: "Accounting" },
  { suffix: "public-finance", nameEn: "Public Finance", nameZh: "财政学", category: "Public Finance" },
  { suffix: "taxation", nameEn: "Taxation", nameZh: "税收学", category: "Public Finance" },
  { suffix: "public-administration", nameEn: "Public Administration", nameZh: "行政管理", category: "Public Administration" },
  { suffix: "labor-and-social-security", nameEn: "Labor and Social Security", nameZh: "劳动与社会保障", category: "Public Administration" },
  { suffix: "economic-statistics", nameEn: "Economic Statistics", nameZh: "经济统计学", category: "Statistics" },
  { suffix: "applied-statistics", nameEn: "Applied Statistics", nameZh: "应用统计学", category: "Statistics" },
  { suffix: "data-science-and-big-data-technology", nameEn: "Data Science and Big Data Technology", nameZh: "数据科学与大数据技术", category: "Data Science" },
  { suffix: "computer-science-and-technology", nameEn: "Computer Science and Technology", nameZh: "计算机科学与技术", category: "Computer Science" },
  { suffix: "software-engineering", nameEn: "Software Engineering", nameZh: "软件工程", category: "Computer Science" },
  { suffix: "information-engineering", nameEn: "Information Engineering", nameZh: "信息工程", category: "Information Engineering" },
  { suffix: "information-and-computing-science", nameEn: "Information and Computing Science", nameZh: "信息与计算科学", category: "Mathematics" },
  { suffix: "mathematics-and-applied-mathematics", nameEn: "Mathematics and Applied Mathematics", nameZh: "数学与应用数学", category: "Mathematics" },
  { suffix: "law", nameEn: "Law", nameZh: "法学", category: "Law" },
  { suffix: "management-science", nameEn: "Management Science", nameZh: "管理科学", category: "Management Science" },
  { suffix: "information-management-and-information-system", nameEn: "Information Management and Information System", nameZh: "信息管理与信息系统", category: "Management Science" },
  { suffix: "engineering-management", nameEn: "Engineering Management", nameZh: "工程管理", category: "Management Science" },
  { suffix: "information-resource-management", nameEn: "Information Resource Management", nameZh: "信息资源管理", category: "Management Science" },
  { suffix: "e-commerce", nameEn: "E-Commerce", nameZh: "电子商务", category: "E-Commerce" },
  { suffix: "financial-mathematics", nameEn: "Financial Mathematics", nameZh: "金融数学", category: "Mathematics" },
  { suffix: "english", nameEn: "English", nameZh: "英语", category: "Foreign Languages" },
  { suffix: "business-english", nameEn: "Business English", nameZh: "商务英语", category: "Foreign Languages" },
  { suffix: "japanese", nameEn: "Japanese", nameZh: "日语", category: "Foreign Languages" },
  { suffix: "radio-and-television", nameEn: "Radio and Television", nameZh: "广播电视学", category: "Media and Communication" },
  { suffix: "visual-communication-design", nameEn: "Visual Communication Design", nameZh: "视觉传达设计", category: "Art and Design", art: true },
  { suffix: "environmental-design", nameEn: "Environmental Design", nameZh: "环境设计", category: "Art and Design", art: true },
  { suffix: "product-design", nameEn: "Product Design", nameZh: "产品设计", category: "Art and Design", art: true },
  { suffix: "fine-arts", nameEn: "Fine Arts", nameZh: "美术学", category: "Fine Arts", art: true },
];

const programs: CatalogSeedProgram[] = specs.map((spec) => ({
  slug: `${schoolSlug}-${spec.suffix}`,
  schoolSlug,
  citySlug,
  nameEn: spec.nameEn,
  nameZh: spec.nameZh,
  degreeLevel: "Undergraduate",
  durationYears: 4,
  fieldCategory: spec.category,
  subjectArea: spec.category,
  teachingLanguage: "Chinese",
  cscaSubjects: ["Chinese", "Mathematics"],
  cscaRequirement: "Submit valid CSCA Chinese and Mathematics results.",
  hskRequirement: "Provide Level IV or above under the Chinese Language Proficiency Scales for Speakers of Other Languages.",
  tuitionAmount: spec.art ? 20000 : 16600,
  tuitionCurrency: "CNY",
  tuitionPeriod: "year",
  tuitionText: spec.art ? "CNY 20,000/academic year, including insurance" : "CNY 16,600/academic year, including insurance",
  applicationUrl: pageZh.url,
  applicationNote: "Fall 2026 international undergraduate route. The official application portal closed June 15, 2026.",
  hasScholarship: true,
  scholarshipText: "Applicants may use an eligible Chinese Government Scholarship route; route-specific terms and deadlines apply.",
  status: "draft",
  sourceUrl: pageEn.url,
  sourceLabel: pageEn.label,
  sourceSha256: pageEn.sha256,
  capturedAt: pageEn.fetchedAt,
  sourceFieldLineage: {
    nameEn: "official English 2026 undergraduate program table",
    nameZh: "official Chinese 2026 undergraduate program table",
    degreeLevel: "official guide title and program section",
    durationYears: "official undergraduate program-table heading",
    teachingLanguage: "official application-language requirements and CSCA subject requirement",
    cscaSubjects: "official 2026 application-materials section",
    cscaRequirement: "official 2026 application-materials section",
    hskRequirement: "official 2026 application-materials section",
    tuitionAmount: "official 2026 costs section",
    applicationUrl: "registered official Chinese 2026 admission guide",
  },
}));

const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2026,
  deadlineDate: "2026-06-15T15:59:59.000Z",
  deadlineLabel: "June 15, 2026",
  applicationRound: "2026 international undergraduate admission",
  status: "closed" as const,
  sourceUrl: pageZh.url,
  sourceLabel: pageZh.label,
  sourceSha256: pageZh.sha256,
  capturedAt: pageZh.fetchedAt,
  sourceFieldLineage: {
    deadlineDate: "official 2026 application-process section",
    intakeYear: "official attached-guide label and page context",
  },
}));

const scholarships: CatalogSeedScholarship[] = [
  {
    slug: "tjufe-chinese-government-scholarship-bilateral-type-a-2026",
    schoolSlug,
    title: "Chinese Government Scholarship Bilateral Type A at TUFE 2026",
    nameZh: "天津财经大学中国政府奖学金国别双边项目（A类）2026",
    type: "government",
    typeLabel: "Chinese Government Scholarship Bilateral Type A",
    providerName: "中国政府 / 天津财经大学",
    providerNameEn: "Chinese Government / Tianjin University of Finance and Economics",
    providerLocation: "Tianjin, China",
    fundingLevel: "Full or partial",
    coverage: "A full award covers tuition, accommodation, comprehensive medical insurance and living expenses. A partial award covers one or more full-award items.",
    applicableDegree: "Undergraduate, Master, Doctoral, General Scholar and Senior Scholar",
    applicableProgram: "The degree and non-degree scope published for the bilateral Type A route; exact availability is controlled by the applicant's dispatching authority.",
    amountText: "Coverage level is determined under the bilateral award; consult the dispatching authority for the exact route.",
    requirementText: "Apply through the home-country dispatching authority and meet TUFE's degree, age, language and academic requirements. Applicants may not hold another scholarship concurrently.",
    applicationRound: "2026 bilateral Type A route; home-country deadline varies",
    targetCountries: [],
    targetRegions: [],
    benefitItems: [
      { label: "Tuition", included: true, note: "Full award" },
      { label: "Accommodation", included: true, note: "Full award" },
      { label: "Living expenses", included: true, note: "Full award" },
      { label: "Comprehensive medical insurance", included: true, note: "Full award" },
    ],
    eligibilityItems: [
      { label: "Nationality", value: "Non-Chinese citizen holding a valid ordinary passport" },
      { label: "Application channel", value: "Home-country dispatching authority, normally an embassy, consulate or designated authority" },
      { label: "Concurrent funding", value: "Must not hold another scholarship at the same time" },
    ],
    applicationMaterials: [
      { label: "Core documents", value: "Passport, notarized diploma, transcripts, language evidence, study plan, physical examination and no-criminal-record certificate; degree-specific items also apply" },
    ],
    applicationSteps: [{ label: "Step 1", value: "Confirm the exact deadline and submit through the home-country dispatching authority." }],
    actionLinks: [{ label: bilateral.label, url: bilateral.url, kind: "official-source" }],
    summary: "2026 bilateral Chinese Government Scholarship route administered through each applicant's home-country dispatching authority.",
    status: "draft",
    sourceUrl: bilateral.url,
    sourceLabel: bilateral.label,
    sourceSha256: bilateral.sha256,
    capturedAt: bilateral.fetchedAt,
    sourceFieldLineage: {
      title: "official 2026 guide title",
      fundingLevel: "official introduction and funding-standard sections",
      coverage: "official funding-standard section",
      applicableDegree: "official categories section",
      requirementText: "official application-channel and eligibility sections",
      applicationRound: "official application-time section; exact country deadline is intentionally unresolved",
    },
  },
  {
    slug: "tjufe-chinese-government-scholarship-high-level-graduate-2026",
    schoolSlug,
    title: "Chinese Government Scholarship High-Level Graduate Program at TUFE 2026",
    nameZh: "天津财经大学中国政府奖学金高水平研究生项目 2026",
    type: "government",
    typeLabel: "Chinese Government Scholarship High-Level Graduate Program",
    providerName: "中国政府 / 天津财经大学",
    providerNameEn: "Chinese Government / Tianjin University of Finance and Economics",
    providerLocation: "Tianjin, China",
    fundingLevel: "Full scholarship",
    coverage: "Tuition, on-campus accommodation, comprehensive medical insurance and monthly living allowance: CNY 3,000 for master's students or CNY 3,500 for doctoral students.",
    applicableDegree: "Master and Doctoral",
    applicableProgram: "Eligible Chinese-taught three-year TUFE master's and doctoral routes listed in the program attachment.",
    amountText: "CNY 3,000/month for master's students or CNY 3,500/month for doctoral students, plus tuition, on-campus accommodation and medical insurance.",
    requirementText: "Master's applicants must hold a bachelor's degree and be under 35; doctoral applicants must hold a master's degree and be under 40. HSK Level 4 or above and the university assessment are required; HSK Level 5 score 180 is required to enter the major without a preparatory year.",
    deadlineDate: "2026-02-20",
    deadlineLabel: "February 20, 2026",
    applicationRound: "November 1, 2025-February 20, 2026",
    targetCountries: [],
    targetRegions: [],
    benefitItems: [
      { label: "Tuition", included: true },
      { label: "On-campus accommodation", included: true },
      { label: "Living allowance", included: true, note: "CNY 3,000/month master; CNY 3,500/month doctoral" },
      { label: "Comprehensive medical insurance", included: true },
    ],
    eligibilityItems: [
      { label: "Master", value: "Bachelor's degree holder under age 35" },
      { label: "Doctoral", value: "Master's degree holder under age 40" },
      { label: "Language", value: "HSK Level 4 or above; HSK Level 5 score 180 to enter the major without preparatory Chinese" },
      { label: "Other funding", value: "May not simultaneously receive another Chinese government or admitting-institution scholarship" },
    ],
    applicationMaterials: [
      { label: "Core documents", value: "CSC form, passport, notarized diploma, transcripts, language certificate, study plan, two academic recommendations, physical examination, no-criminal-record certificate and supervisor provisional-acceptance form" },
    ],
    applicationSteps: [
      { label: "Step 1", value: "Complete the CSC system application using TUFE agency number 10070 and Program Type B." },
      { label: "Step 2", value: "Email the complete application ZIP to the official TUFE admissions address by the published deadline." },
    ],
    actionLinks: [{ label: highLevel.label, url: highLevel.url, kind: "official-source" }],
    summary: "Closed 2026 full Chinese Government Scholarship for eligible Chinese-taught master's and doctoral study at TUFE.",
    status: "draft",
    sourceUrl: highLevel.url,
    sourceLabel: highLevel.label,
    sourceSha256: highLevel.sha256,
    capturedAt: highLevel.fetchedAt,
    sourceFieldLineage: {
      title: "official 2026 Chinese guide title",
      fundingLevel: "official coverage section",
      coverage: "official coverage section",
      applicableDegree: "official categories section",
      amountText: "official living-expense standard",
      requirementText: "official eligibility and preparatory-program sections",
      deadlineDate: "official Chinese application-time section",
      applicationSteps: "official application-process and materials sections",
    },
  },
];

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: manifest.generatedAt,
  cities: [cityBundle.cities[0]],
  schools: [{
    slug: schoolSlug,
    nameEn: "Tianjin University of Finance and Economics",
    nameZh: "天津财经大学",
    citySlug,
    schoolType: "Public",
    region: "Tianjin, North China",
    applicationLevel: "Undergraduate, Master, Doctoral and Non-degree",
    languageOfInstruction: "Chinese for the reviewed 2026 undergraduate routes",
    languageRequirement: "Reviewed undergraduate routes require Level IV or above under the Chinese Language Proficiency Scales for Speakers of Other Languages.",
    hskRequirement: "The undergraduate self-funded guide requires Level IV or above under the Chinese Language Proficiency Scales; scholarship routes publish separate HSK conditions.",
    deadlineSummary: "The Fall 2026 undergraduate application portal closed June 15, 2026. The 2026 high-level graduate scholarship closed February 20, 2026. Bilateral Type A deadlines vary by dispatching authority. No 2027 dates are inferred.",
    tuitionSummary: "CNY 16,600/year including insurance for non-art undergraduate majors; CNY 20,000/year including insurance for art majors.",
    websiteUrl: "https://www.tjufe.edu.cn/",
    admissionsUrl: pageZh.url,
    cscaRequired: true,
    cscaRequirement: "All reviewed international undergraduate applicants submit CSCA Chinese and Mathematics results.",
    cscaSubjects: ["Chinese", "Mathematics"],
    subjectTags: [...new Set(specs.map((spec) => spec.category))],
    languageTags: ["Chinese"],
    campusHighlights: ["Economics and management focus", "49 reviewed international undergraduate routes", "Hexi District campus"],
    contactNotes: "International Education College admissions: +86-22-88186169 / 88186167; tjufe300222@126.com; 25 Zhujiang Road, Hexi District, Tianjin.",
    status: "draft",
    sourceUrl: pageZh.url,
    sourceLabel: pageZh.label,
    sourceSha256: pageZh.sha256,
    capturedAt: pageZh.fetchedAt,
    sourceFieldLineage: {
      nameEn: "official English guide identity",
      nameZh: "official Chinese guide identity",
      citySlug: "official contact address",
      applicationLevel: "official institution profile and scholarship categories",
      languageOfInstruction: "official undergraduate eligibility and application-materials sections",
      languageRequirement: "official undergraduate application-materials section",
      deadlineSummary: "official undergraduate and scholarship application-time sections",
      tuitionSummary: "official undergraduate costs section",
      admissionsUrl: "registered official Chinese 2026 guide",
      cscaRequirement: "official undergraduate application-materials section",
    },
  }],
  programs,
  programIntakes,
  scholarships,
};

const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 49 || validation.summary.programIntakes !== 49 || validation.summary.scholarships !== 2) {
  throw new Error(`TUFE candidate invalid:\n${validation.errors.join("\n")}`);
}
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha(candidateText),
  manifestSha256: sha(manifestText),
  sourceReview: {
    status: "unreviewed_draft",
    notes: [
      "The official Chinese and English guides list exactly 49 four-year undergraduate routes.",
      "All reviewed undergraduate routes are treated as Chinese-taught because the guide requires Chinese proficiency and CSCA Chinese plus Mathematics; no English-taught route is inferred.",
      "The 2026 undergraduate application deadline is closed. No 2027 date is inferred.",
      "All six prohibited-source legacy program identities have exact current program rows in this draft.",
      "The bilateral Type A scholarship retains the dispatching-authority deadline as unresolved rather than inventing one date.",
      "The Chinese high-level graduate guide publishes February 20, 2026; that authoritative Chinese date is used instead of the English page's conflicting February 15 date.",
      "The CAPTCHA-protected attached PDF was not used because the complete program table and route terms are present on the acquired official HTML pages.",
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
