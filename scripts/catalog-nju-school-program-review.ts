import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const guideManifestPath = resolve(root, "work/catalog-official/2026-09-11T06-39-38-064Z/manifest.json");
const catalogManifestPath = resolve(root, "work/catalog-official/2026-09-11T06-41-28-452Z/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.nju-school-program-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.nju-school-program-batch-01.validation.json");
const reviewPath = resolve(root, "seeds/catalog.nju-school-program-batch-01.review.json");

const GUIDE_ID = "nanjing-university-undergraduate-2026";
const GUIDE_SHA = "aef8f2b6536b3e3f2daf916d725328f6b858a49c0ea1472a537b8ede69638625";
const GUIDE_URL = "https://hwxy.nju.edu.cn/English/StudyatNJU/Admissions/BachelorsPrograms/index.html";
const CATALOG_ID = "nanjing-university-undergraduate-catalog-pdf-2026";
const CATALOG_SHA = "3336a7d1b66a62ff602b4fc6eb8a13832ce27cc19b97abdbe97baa80c9243bbe";
const CATALOG_URL = "https://hwxy.nju.edu.cn/DFS//file/2026/01/23/202601231052547337tbsgs.pdf";
const APPLICATION_URL = GUIDE_URL;

const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const guideEvidence = (await parse(guideManifestPath)).sources?.[0];
const catalogEvidence = (await parse(catalogManifestPath)).sources?.[0];
for (const [evidence, id, sha] of [
  [guideEvidence, GUIDE_ID, GUIDE_SHA],
  [catalogEvidence, CATALOG_ID, CATALOG_SHA],
] as const) {
  if (evidence?.id !== id || evidence?.sha256 !== sha || evidence?.status !== 200) {
    throw new Error(`The refreshed official source does not match the reviewed snapshot: ${id}`);
  }
}

type ProgramName = { nameEn: string; nameZh: string; slug?: string; note?: string; hsk?: string };
type ProgramGroup = {
  school: string;
  subjects: string[];
  tuition: number;
  category: string;
  programs: ProgramName[];
};

const H = "Chinese (Humanities)";
const S = "Chinese (STEM)";
const M = "Mathematics";
const P = "Physics";
const C = "Chemistry";
const p = (nameEn: string, nameZh: string, extra: Omit<ProgramName, "nameEn" | "nameZh"> = {}): ProgramName => ({ nameEn, nameZh, ...extra });

const groups: ProgramGroup[] = [
  { school: "Institute for International Students", category: "Languages", subjects: [H, M], tuition: 21000, programs: [
    p("Chinese Language", "汉语言", { hsk: "HSK Level 4, score 180 or above", note: "Applicants with HSK Level 4 score 180 or above may be exempt from the Humanities Chinese CSCA subject." }),
    p("Teaching Chinese to Speakers of Other Languages", "汉语国际教育"),
  ] },
  { school: "School of Foreign Studies", category: "Languages", subjects: [H, M], tuition: 21000, programs: [
    p("English", "英语", { note: "English majors must also submit IELTS 5.5 or above or TOEFL 70 or above." }), p("Korean", "朝鲜语"),
  ] },
  { school: "School of Journalism and Communication", category: "Journalism and Communication", subjects: [H, M], tuition: 21000, programs: [
    p("Journalism", "新闻学"), p("Advertising", "广告学"), p("Radio & Television Science", "广播电视学"),
  ] },
  { school: "School of Information Management", category: "Information Management", subjects: [H, M], tuition: 21000, programs: [
    p("Information Management & Information System", "信息管理与信息系统"), p("Editing & Publishing Science", "编辑出版学"), p("Library Science", "图书馆学"), p("Archive Science", "档案学"),
  ] },
  { school: "School of Liberal Arts", category: "Literature", subjects: [H, M], tuition: 21000, programs: [
    p("Chinese Language and Literature", "汉语言文学"), p("Literature of Theatre, Film & Television", "戏剧影视文学"),
  ] },
  { school: "School of History", category: "History", subjects: [H, M], tuition: 21000, programs: [p("History", "历史学"), p("Archaeology", "考古学")] },
  { school: "School of Philosophy", category: "Philosophy", subjects: [H, M], tuition: 21000, programs: [p("Philosophy", "哲学")] },
  { school: "Law School", category: "Law", subjects: [H, M], tuition: 21000, programs: [p("Law", "法学")] },
  { school: "School of International Relations", category: "International Relations", subjects: [H, M], tuition: 21000, programs: [p("International Politics", "国际政治")] },
  { school: "School of Government", category: "Public Administration", subjects: [H, M], tuition: 21000, programs: [
    p("General Administration", "行政管理"), p("Labor & Social Security", "劳动与社会保障"), p("Political Science and Public Administration", "政治学与行政学"),
  ] },
  { school: "Business School", category: "Business and Economics", subjects: [H, M], tuition: 24000, programs: [
    p("Human Resource Management", "人力资源管理"), p("Marketing", "市场营销"), p("Accounting", "会计学"), p("Financial Management", "财务管理"), p("Electronic Commerce", "电子商务"), p("Economics", "经济学"), p("International Economics and Trade", "国际经济与贸易"), p("Finance and Banking", "金融学"), p("Financial Engineering", "金融工程"), p("Insurance", "保险学"),
  ] },
  { school: "School of Social and Behavioral Sciences", category: "Social Sciences", subjects: [H, M], tuition: 21000, programs: [p("Sociology", "社会学"), p("Social Work", "社会工作")] },
  { school: "School of Social and Behavioral Sciences", category: "Psychology", subjects: [S, M], tuition: 24000, programs: [p("Applied Psychology", "应用心理学")] },
  { school: "School of Management & Engineering", category: "Management Engineering", subjects: [S, M], tuition: 24000, programs: [
    p("Financial Engineering", "金融工程", { slug: "nanjing-university-financial-engineering-management-engineering" }), p("Industrial Engineering", "工业工程"),
  ] },
  { school: "School of Electronic Science and Engineering", category: "Electronic Engineering", subjects: [S, M, P], tuition: 24000, programs: [
    p("Electronic Information Science & Technology", "电子信息科学与技术"), p("Telecommunications Engineering", "通信工程"), p("Microelectronics Science and Engineering", "微电子科学与工程"), p("Integrated Circuit Design and Integrated System", "集成电路设计与集成系统"),
  ] },
  { school: "School of Computer Science", category: "Computer Science", subjects: [S, M, P], tuition: 24000, programs: [p("Computer Science & Technology", "计算机科学与技术")] },
  { school: "School of Mathematics", category: "Mathematics and Statistics", subjects: [S, M, P], tuition: 24000, programs: [
    p("Mathematics & Applied Mathematics", "数学与应用数学"), p("Information and Computing Science", "信息与计算科学"), p("Statistics", "统计学"),
  ] },
  { school: "School of Architecture and Urban Planning", category: "Architecture and Urban Planning", subjects: [S, M, P], tuition: 24000, programs: [
    p("Urban Planning", "城乡规划"), p("Architecture", "建筑学", { note: "Applicants must submit materials demonstrating professional skills or knowledge, or architectural works." }),
  ] },
  { school: "School of the Environment", category: "Environmental Science and Engineering", subjects: [S, M, C], tuition: 24000, programs: [p("Environmental Engineering", "环境工程"), p("Environmental Science", "环境科学")] },
  { school: "School of Earth Sciences and Engineering", category: "Earth Sciences", subjects: [S, M, P, C], tuition: 24000, programs: [p("Geology", "地质学")] },
  { school: "School of Chemistry", category: "Chemistry", subjects: [S, M, P, C], tuition: 24000, programs: [p("Chemistry", "化学"), p("Applied Chemistry", "应用化学")] },
  { school: "School of Life Sciences", category: "Life Sciences", subjects: [S, M, P, C], tuition: 24000, programs: [p("Biological Science", "生物科学"), p("Biotechnology", "生物技术"), p("Ecology", "生态学")] },
  { school: "School of Engineering and Applied Sciences", category: "Materials and Applied Sciences", subjects: [S, M, P], tuition: 24000, programs: [
    p("Material Physics", "材料物理"), p("Optical Information Science and Engineering", "光电信息科学与工程"),
  ] },
  { school: "School of Engineering and Applied Sciences", category: "Materials and Applied Sciences", subjects: [S, M, C], tuition: 24000, programs: [
    p("Material Chemistry", "材料化学"), p("Biomedical Engineering", "生物医学工程"),
  ] },
  { school: "School of Engineering and Applied Sciences", category: "Energy Engineering", subjects: [S, M, P, C], tuition: 24000, programs: [p("New Energy Science and Engineering", "新能源科学与工程")] },
];

const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const programs: CatalogSeedProgram[] = groups.flatMap(group => group.programs.map(program => ({
  slug: program.slug ?? `nanjing-university-${slugify(program.nameEn)}`,
  schoolSlug: "nanjing-university",
  citySlug: "nanjing",
  nameEn: program.nameEn,
  nameZh: program.nameZh,
  degreeLevel: "Undergraduate",
  durationYears: 4,
  fieldCategory: group.category,
  subjectArea: group.school,
  teachingLanguage: "Chinese",
  cscaSubjects: group.subjects,
  cscaRequirement: `CSCA in Chinese: ${group.subjects.join(", ")}`,
  hskRequirement: program.hsk ?? "HSK Level 5, score 180 or above",
  tuitionAmount: group.tuition,
  tuitionCurrency: "RMB",
  tuitionPeriod: "year",
  tuitionText: `RMB ${group.tuition.toLocaleString("en-US")}/year`,
  applicationUrl: APPLICATION_URL,
  ...(program.note ? { applicationNote: program.note } : {}),
  status: "draft",
  sourceUrl: CATALOG_URL,
  sourceLabel: "Nanjing University Catalog of Undergraduate Programs 2026",
  sourceSha256: CATALOG_SHA,
  capturedAt: catalogEvidence.fetchedAt,
  sourceFieldLineage: {
    nameEn: "Major column",
    nameZh: "专业 column",
    durationYears: "Length of Schooling column",
    cscaSubjects: "CSCA Test Subjects column",
    teachingLanguage: "catalog note 1",
    hskRequirement: program.hsk ? "catalog note 2" : "registered Bachelor’s Programs page: application materials item 5",
    tuitionAmount: `registered Bachelor’s Programs page: ${group.tuition === 21000 ? "liberal arts" : "science and business"} tuition band`,
    applicationUrl: "registered HTTPS Bachelor’s Programs page, which links to the NJU iStudy application system",
    ...(program.note ? { applicationNote: program.nameEn === "English" ? "registered Bachelor’s Programs page: English-major additional material" : program.nameEn === "Architecture" ? "registered Bachelor’s Programs page: Architecture additional material" : "catalog note 2" } : {}),
  },
})));

if (programs.length !== 59) throw new Error(`Unexpected NJU program count: ${programs.length}.`);
if (new Set(programs.map(program => program.slug)).size !== programs.length) throw new Error("Generated NJU program slugs are not unique.");

const allSubjects = [...new Set(programs.flatMap(program => program.cscaSubjects ?? []))];
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: guideEvidence.fetchedAt,
  cities: [{
    slug: "nanjing", nameEn: "Nanjing", nameZh: "南京", region: "East China", province: "Jiangsu", status: "draft",
    sourceUrl: GUIDE_URL, sourceLabel: "Nanjing University Bachelor’s Programs", sourceSha256: GUIDE_SHA, capturedAt: guideEvidence.fetchedAt,
    sourceFieldLineage: { nameEn: "institution name and contact address", province: "institution name and contact address" },
  }],
  schools: [{
    slug: "nanjing-university", nameEn: "Nanjing University", nameZh: "南京大学", citySlug: "nanjing", schoolType: "public", region: "East China",
    applicationLevel: "Undergraduate", languageOfInstruction: "Chinese",
    languageRequirement: "All undergraduate majors are taught in Chinese. The standard requirement is HSK Level 5 with a score of at least 180; the Chinese Language major has the catalog-specific HSK Level 4 exception.",
    hskRequirement: "HSK Level 5, score 180 or above; Chinese Language applicants may use HSK Level 4, score 180 or above under the 2026 catalog note.",
    englishRequirement: "English-major applicants must also submit IELTS 5.5 or above or TOEFL 70 or above.",
    deadlineSummary: "Online application and selection are scheduled from March to May 2026; exact dates remain subject to the official website. CSCA scores must reach NJU by May 15, 2026.",
    tuitionSummary: "RMB 21,000/year for liberal arts programs and RMB 24,000/year for science and business programs in this 2026 published catalog.",
    applicationFee: "RMB 500", admissionsUrl: GUIDE_URL, cscaRequired: true,
    cscaRequirement: "All international undergraduate applicants from 2026/2027 must take CSCA and submit the report. Program-specific Chinese, mathematics, physics and chemistry combinations are listed in the official catalog.",
    cscaSubjects: allSubjects, subjectTags: [...new Set(groups.map(group => group.category))], languageTags: ["Chinese-taught"],
    campusHighlights: ["59 official 2026 undergraduate routes", "Program-specific CSCA subject combinations", "Online application through NJU iStudy"],
    status: "draft", sourceUrl: GUIDE_URL, sourceLabel: "Nanjing University Bachelor’s Programs", sourceSha256: GUIDE_SHA, capturedAt: guideEvidence.fetchedAt,
    sourceFieldLineage: { nameEn: "page title and institution name", citySlug: "contact address", applicationLevel: "page title", languageOfInstruction: "Application Requirement", languageRequirement: "Application Requirement and materials item 5", deadlineSummary: "Application duration schedule and CSCA score deadline", tuitionSummary: "Costs", applicationFee: "Costs", admissionsUrl: "registered source URL", cscaRequirement: "Application Requirement and materials item 6" },
  }],
  programs,
  programIntakes: programs.map(program => ({
    programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026,
    deadlineLabel: "March-May 2026 application period; exact date subject to the official website",
    applicationRound: "2026 undergraduate admission", status: "closed" as const,
    sourceUrl: GUIDE_URL, sourceLabel: "Nanjing University Bachelor’s Programs", sourceSha256: GUIDE_SHA, capturedAt: guideEvidence.fetchedAt,
    sourceFieldLineage: { deadlineLabel: "Application duration schedule" },
  })),
  scholarships: [],
};

const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`NJU candidate is invalid: ${validation.errors.join(" ")}`);
const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : value && typeof value === "object"
  ? `{${Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`
  : JSON.stringify(value);
const prohibitedPatterns = [/passport(?:Number)?/i, /personalEmail/i, /personalPhone/i, /cardNumber/i, /cvv/i, /passwordHash/i, /sessionToken/i];
if (prohibitedPatterns.some(pattern => pattern.test(canonical(candidate)))) throw new Error("The NJU candidate contains a prohibited-data marker.");

const legacyAliasesToArchive = ["nanjing-university-applied-physics", "nanjing-university-business-administration"];
const stableMatchingSlugs = ["nanjing-university-accounting", "nanjing-university-applied-chemistry", "nanjing-university-applied-psychology", "nanjing-university-architecture", "nanjing-university-chemistry", "nanjing-university-economics", "nanjing-university-financial-management", "nanjing-university-insurance"];
const review = {
  version: 1, status: "awaiting_user_approval", generatedAt: guideEvidence.fetchedAt,
  scope: { schoolSlug: "nanjing-university", schoolCount: 1, chineseProgramCount: 59, englishProgramCount: 0, programCount: 59, intakeCount: 59 },
  officialEvidence: {
    guide: { sha256: GUIDE_SHA, fetchedAt: guideEvidence.fetchedAt, contentType: guideEvidence.contentType },
    programCatalog: { sha256: CATALOG_SHA, fetchedAt: catalogEvidence.fetchedAt, contentType: catalogEvidence.contentType, pageCount: 3 },
  },
  reconciliation: { actionAfterApproval: "upsert_official_2026_catalog_and_archive_legacy_aliases", legacyAliasesToArchive, destructiveDeletion: false, stableMatchingSlugs },
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle only", note: "No applicant, account, payment, private-file or personal-contact fields are present. Raw official snapshots remain ignored and are not imported." },
  candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256,
};

for (const [path, value] of [[candidatePath, candidate], [validationPath, validation], [reviewPath, review]] as const) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8" });
}
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, reviewPath, candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256, reviewSha256: createHash("sha256").update(JSON.stringify(review)).digest("hex"), summary: validation.summary, legacyAliasesToArchive: legacyAliasesToArchive.length, stableMatchingSlugs: stableMatchingSlugs.length }, null, 2));
