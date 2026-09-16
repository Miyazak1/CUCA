import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const guideManifestPath = resolve(root, "work/catalog-official/2026-09-11T08-33-37-131Z/manifest.json");
const catalogEnManifestPath = resolve(root, "work/catalog-official/2026-09-11T08-34-05-161Z/manifest.json");
const catalogZhManifestPath = resolve(root, "work/catalog-official/2026-09-11T08-34-20-907Z/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.bnu-school-program-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.bnu-school-program-batch-01.validation.json");
const reviewPath = resolve(root, "seeds/catalog.bnu-school-program-batch-01.review.json");

const GUIDE_ID = "bnu-undergraduate-admissions-en-2026";
const GUIDE_URL = "https://admission-is.bnu.edu.cn/english/admissionprogram/bachelordegreeprogram/admissionbrochure/index.html";
const GUIDE_SHA = "ac577f79869863eddb3fec145b7a5e59c542386bea1f61a2ca50906ee78c14e3";
const CATALOG_EN_ID = "bnu-undergraduate-major-catalog-en-2026";
const CATALOG_EN_URL = "https://admission-is.bnu.edu.cn/english/admissionprogram/bachelordegreeprogram/majorcatalog/index.html";
const CATALOG_EN_SHA = "b345b4b959d0ecd71329d690ad442959e4d9ef02f307b5b954f198fbcede797b";
const CATALOG_ZH_ID = "bnu-undergraduate-major-catalog-zh-2026";
const CATALOG_ZH_URL = "https://admission-is.bnu.edu.cn/zsxm/bkxm/zyml2/4a017efb86e04f968d71b50196d4aab0.html";
const CATALOG_ZH_SHA = "dcf9c4dfc414e15683ecb5245f433df5a7d113409a1dc2317fc0687288625f3e";
const APPLICATION_URL = "https://international.bnu.edu.cn/";

const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const guideEvidence = (await parse(guideManifestPath)).sources?.[0];
const catalogEnEvidence = (await parse(catalogEnManifestPath)).sources?.[0];
const catalogZhEvidence = (await parse(catalogZhManifestPath)).sources?.[0];
for (const [evidence, id, sha] of [
  [guideEvidence, GUIDE_ID, GUIDE_SHA],
  [catalogEnEvidence, CATALOG_EN_ID, CATALOG_EN_SHA],
  [catalogZhEvidence, CATALOG_ZH_ID, CATALOG_ZH_SHA],
] as const) {
  if (evidence?.id !== id || evidence?.sha256 !== sha || evidence?.status !== 200 || evidence?.contentType !== "text/html") {
    throw new Error(`The refreshed official source does not match the reviewed snapshot: ${id}`);
  }
}

type Row = {
  nameEn: string;
  nameZh: string;
  degree: string;
  department: string;
  subjects: string[];
  tuition: number;
  slug?: string;
  citySlug?: string;
  hsk?: string;
  note?: string;
};
const H = "Chinese (Liberal Arts)";
const S = "Chinese (STEM)";
const M = "Mathematics";
const hsk4 = "HSK Level 4, score 180 or above";
const hsk5 = "HSK Level 5, score 180 or above";
const humanities = [H, M];
const sciences = [S, M];
const row = (nameEn: string, nameZh: string, degree: string, department: string, subjects: string[], tuition: number, extra: Partial<Row> = {}): Row => ({ nameEn, nameZh, degree, department, subjects, tuition, ...extra });

const rows: Row[] = [
  row("Chinese as a Second Language", "汉语言", "Literature", "School of International Chinese Language Education", [M], 24000, { slug: "beijing-normal-university-chinese-language", hsk: hsk4 }),
  row("Teaching Chinese to Speakers of Other Languages", "汉语国际教育（珠海校区培养）", "Literature", "School of International Chinese Language Education", humanities, 24000, { slug: "beijing-normal-university-teaching-chinese-to-speakers-of-other-languages", citySlug: "zhuhai", hsk: hsk4, note: "This program is taught at Beijing Normal University Zhuhai Campus." }),
  row("Chinese Language and Literature", "汉语言文学", "Literature", "School of Chinese Language and Literature", [M], 24000, { slug: "beijing-normal-university-chinese-language-and-literature" }),
  row("Communication (Network and New Media)", "传播学（网络新媒体）", "Literature", "School of Journalism and Communication", humanities, 24000, { slug: "beijing-normal-university-communication" }),
  row("Philosophy", "哲学", "Philosophy", "College of Philosophy", humanities, 24000, { slug: "beijing-normal-university-philosophy" }),
  row("History", "历史学", "History", "School of History", humanities, 24000, { slug: "beijing-normal-university-history" }),
  row("Education (Education, Pre-school Education, Special Education and Educational Technology)", "教育学类（含教育学、学前教育、特殊教育、教育技术学专业）", "Education / Science", "Faculty of Education", humanities, 24000, { slug: "beijing-normal-university-education" }),
  row("English", "英语", "Literature", "School of Foreign Languages and Literature", humanities, 24000, { note: "Applicants whose native language is English are not accepted for this major." }),
  row("Japanese", "日语", "Literature", "School of Foreign Languages and Literature", humanities, 24000, { note: "Applicants whose native language is Japanese are not accepted for this major." }),
  row("Russian", "俄语", "Literature", "School of Foreign Languages and Literature", humanities, 24000, { note: "Applicants whose native language is Russian are not accepted for this major." }),
  row("Law", "法学", "Law", "Law School", humanities, 24000, { slug: "beijing-normal-university-law" }),
  row("Sociology", "社会学", "Law", "School of Sociology", humanities, 24000),
  row("International Economics and Trade", "国际经济与贸易", "Economics", "Business School", humanities, 24000),
  row("Business Administration", "工商管理", "Management", "Business School", humanities, 24000),
  row("Theatre, Film and Television Literature", "戏剧影视文学", "Arts", "School of Arts and Communication", humanities, 27700, { note: "Applicants must demonstrate relevant expertise and provide supporting materials." }),
  row("Digital Media Arts", "数字媒体艺术", "Arts", "School of Arts and Communication", humanities, 27700, { note: "Applicants must demonstrate relevant expertise and provide supporting materials." }),
  row("Calligraphy", "书法学", "Arts", "School of Arts and Communication", humanities, 27700, { note: "Applicants must demonstrate relevant expertise and provide supporting materials." }),
  row("Fine Arts", "美术学", "Arts", "School of Arts and Communication", humanities, 27700, { note: "Applicants must demonstrate relevant expertise and provide supporting materials." }),
  row("Design", "艺术设计学", "Arts", "School of Arts and Communication", humanities, 27700, { note: "Applicants must demonstrate relevant expertise and provide supporting materials." }),
  row("Musicology", "音乐学", "Arts", "School of Arts and Communication", humanities, 27700, { note: "Applicants must demonstrate relevant expertise and provide supporting materials." }),
  row("Dance", "舞蹈学", "Arts", "School of Arts and Communication", humanities, 27700, { note: "Applicants must demonstrate relevant expertise and provide supporting materials." }),
  row("Physical Education", "体育教育", "Education", "College of Physical Education and Sports", humanities, 24000),
  row("Psychology", "心理学", "Science", "Faculty of Psychology", sciences, 27700, { slug: "beijing-normal-university-psychology", note: "High-school Mathematics and Physics must each be explicitly shown on the transcript, with an average score of at least 80%." }),
  row("Computer Science and Technology", "计算机科学与技术", "Engineering", "School of Artificial Intelligence", sciences, 27700, { note: "High-school Mathematics and Physics must each be explicitly shown on the transcript, with an average score of at least 80%." }),
  row("Artificial Intelligence", "人工智能", "Engineering", "School of Artificial Intelligence", sciences, 27700, { note: "High-school Mathematics and Physics must each be explicitly shown on the transcript, with an average score of at least 80%." }),
  row("Mathematics and Applied Mathematics", "数学与应用数学", "Science", "School of Mathematical Sciences", sciences, 27700, { slug: "beijing-normal-university-mathematics-and-applied-mathematics" }),
  row("Statistics", "统计学", "Science", "School of Statistics", sciences, 27700),
  row("Physics", "物理学", "Science", "School of Physics and Astronomy", sciences, 27700),
  row("Astronomy", "天文学", "Science", "School of Physics and Astronomy", sciences, 27700),
  row("Geographical Science (Physical Geography and Resources and Environment, Human Geography and Urban-Rural Planning, Geographical Information Science, and Natural Resources and Environmental Science)", "地理科学类（含自然地理与资源环境、人文地理与城乡规划、地理信息科学、资源环境科学专业）", "Science", "Faculty of Geographical Science", sciences, 27700, { slug: "beijing-normal-university-geographical-science" }),
  row("Chemistry", "化学", "Science", "College of Chemistry", sciences, 27700),
  row("Environmental Science and Engineering (Environmental Science and Ecological Engineering)", "环境科学与工程类（含环境科学、环境生态工程专业）", "Science / Engineering", "School of Environment", sciences, 27700, { slug: "beijing-normal-university-environmental-science-and-engineering" }),
  row("Environmental Engineering (Statistics and Environmental Engineering Double Bachelor's Degree)", "环境工程（“统计学”和“环境工程”双学士学位项目）", "Engineering", "School of Environment", sciences, 27700, { slug: "beijing-normal-university-environmental-engineering-double-bachelors" }),
];
if (rows.length !== 33) throw new Error(`Unexpected BNU application-entry count: ${rows.length}.`);
const coveredMajorCount = 40;
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const programs: CatalogSeedProgram[] = rows.map((item, index) => ({
  slug: item.slug ?? `beijing-normal-university-${slugify(item.nameEn)}`,
  schoolSlug: "beijing-normal-university",
  citySlug: item.citySlug ?? "beijing",
  nameEn: item.nameEn,
  nameZh: item.nameZh,
  degreeLevel: "Undergraduate",
  durationYears: 4,
  fieldCategory: item.degree,
  subjectArea: item.department,
  teachingLanguage: "Chinese",
  cscaSubjects: item.subjects,
  cscaRequirement: `CSCA in Chinese: ${item.subjects.join(", ")}`,
  hskRequirement: item.hsk ?? hsk5,
  tuitionAmount: item.tuition,
  tuitionCurrency: "RMB",
  tuitionPeriod: "year",
  tuitionText: `RMB ${item.tuition.toLocaleString("en-US")}/year`,
  applicationUrl: APPLICATION_URL,
  scholarshipText: "BNU lists the New International Students Scholarship, Silk Road Muduo Scholarship, Beijing Government Scholarship, Chinese Government Scholarship, and International Chinese Language Teachers Scholarship; eligibility must be reviewed separately.",
  ...(item.note ? { applicationNote: item.note } : {}),
  status: "draft",
  sourceUrl: CATALOG_EN_URL,
  sourceLabel: "Beijing Normal University 2026 Major Catalog for Undergraduate International Students",
  sourceSha256: CATALOG_EN_SHA,
  capturedAt: catalogEnEvidence.fetchedAt,
  sourceFieldLineage: {
    nameEn: `English major catalog table row ${index + 1}`,
    nameZh: `Chinese major catalog table row ${index + 1}, cross-checked against snapshot ${CATALOG_ZH_SHA}`,
    fieldCategory: `Awarded Degree column row ${index + 1}`,
    subjectArea: `Department / Faculty / Institute column row ${index + 1}`,
    cscaSubjects: `CSCA Subjects required column row ${index + 1}`,
    hskRequirement: `Language Requirement and Other Requirements column row ${index + 1}`,
    tuitionAmount: `Fees column row ${index + 1}`,
    durationYears: "2026 admission brochure section VIII",
    applicationUrl: "2026 admission brochure section IV",
    scholarshipText: "2026 admission brochure section IX",
    ...(item.note ? { applicationNote: `Major catalog row ${index + 1} and notes` } : {}),
  },
}));
if (new Set(programs.map(program => program.slug)).size !== programs.length) throw new Error("Generated BNU program slugs are not unique.");

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: guideEvidence.fetchedAt,
  cities: [
    { slug: "beijing", nameEn: "Beijing", nameZh: "北京", region: "North China", province: "Beijing", status: "draft", sourceUrl: GUIDE_URL, sourceLabel: "BNU 2026 undergraduate admission brochure", sourceSha256: GUIDE_SHA, capturedAt: guideEvidence.fetchedAt, sourceFieldLineage: { nameEn: "institution and Beijing Campus address", province: "Beijing Campus address" } },
    { slug: "zhuhai", nameEn: "Zhuhai", nameZh: "珠海", region: "South China", province: "Guangdong", status: "draft", sourceUrl: CATALOG_ZH_URL, sourceLabel: "BNU 2026 undergraduate major catalog", sourceSha256: CATALOG_ZH_SHA, capturedAt: catalogZhEvidence.fetchedAt, sourceFieldLineage: { nameEn: "Zhuhai Campus program note", province: "Zhuhai Campus address note" } },
  ],
  schools: [{
    slug: "beijing-normal-university",
    nameEn: "Beijing Normal University",
    nameZh: "北京师范大学",
    citySlug: "beijing",
    schoolType: "public",
    region: "North China",
    applicationLevel: "Undergraduate",
    languageOfInstruction: "Chinese",
    languageRequirement: "All 2026 undergraduate programs are Chinese-taught. Chinese as a Second Language and Teaching Chinese to Speakers of Other Languages require HSK Level 4 score 180; other majors require HSK Level 5 score 180.",
    hskRequirement: "HSK Level 4 score 180 for two international Chinese education majors; HSK Level 5 score 180 for other majors.",
    deadlineSummary: "Online application: November 15, 2025 to March 15, 2026 (China Standard Time).",
    tuitionSummary: "RMB 24,000/year for humanities and social sciences; RMB 27,700/year for science, engineering and arts, with program-level values in the official catalog.",
    applicationFee: "RMB 500",
    admissionsUrl: GUIDE_URL,
    cscaRequired: true,
    cscaRequirement: "All applicants must take CSCA. Required subjects vary by major and are listed in the official 2026 catalog.",
    cscaSubjects: [H, S, M],
    subjectTags: [...new Set(rows.map(item => item.degree))],
    languageTags: ["Chinese-taught"],
    campusHighlights: ["33 official application entries covering 40 majors", "Beijing Campus and one Zhuhai Campus route", "Program-level CSCA, HSK and tuition rules"],
    status: "draft",
    sourceUrl: GUIDE_URL,
    sourceLabel: "Beijing Normal University 2026 international undergraduate admission brochure",
    sourceSha256: GUIDE_SHA,
    capturedAt: guideEvidence.fetchedAt,
    sourceFieldLineage: { nameEn: "page title and institution introduction", citySlug: "Beijing Campus address", applicationLevel: "page title", languageOfInstruction: "section VIII", languageRequirement: "section II and major catalog", deadlineSummary: "section III", tuitionSummary: "section VIII", applicationFee: "section IV", admissionsUrl: "registered source URL", cscaRequirement: "sections V-VI", campusHighlights: "section I and major catalog notes" },
  }],
  programs,
  programIntakes: programs.map(program => ({
    programSlug: program.slug,
    intakeTerm: "Fall",
    intakeYear: 2026,
    openDate: "2025-11-14T16:00:00.000Z",
    deadlineDate: "2026-03-15T15:59:59.000Z",
    deadlineLabel: "March 15, 2026 (China Standard Time)",
    applicationRound: "2026 international undergraduate admission",
    status: "closed" as const,
    sourceUrl: GUIDE_URL,
    sourceLabel: "Beijing Normal University 2026 international undergraduate admission brochure",
    sourceSha256: GUIDE_SHA,
    capturedAt: guideEvidence.fetchedAt,
    sourceFieldLineage: { openDate: "section III, Online Application", deadlineDate: "section III, Online Application" },
  })),
  scholarships: [],
};

const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`BNU candidate is invalid: ${validation.errors.join(" ")}`);
const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : value && typeof value === "object"
  ? `{${Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`
  : JSON.stringify(value);
const prohibitedPatterns = [/passport(?:Number)?/i, /personalEmail/i, /personalPhone/i, /cardNumber/i, /cvv/i, /passwordHash/i, /sessionToken/i];
if (prohibitedPatterns.some(pattern => pattern.test(canonical(candidate)))) throw new Error("The BNU candidate contains a prohibited-data marker.");

const legacyAliasesToArchive = ["beijing-normal-university-economics"];
const stableMatchingSlugs = [
  "beijing-normal-university-chinese-language",
  "beijing-normal-university-chinese-language-and-literature",
  "beijing-normal-university-education",
  "beijing-normal-university-history",
  "beijing-normal-university-law",
  "beijing-normal-university-mathematics-and-applied-mathematics",
  "beijing-normal-university-philosophy",
  "beijing-normal-university-psychology",
  "beijing-normal-university-teaching-chinese-to-speakers-of-other-languages",
];
const review = {
  version: 1,
  status: "awaiting_user_approval",
  generatedAt: guideEvidence.fetchedAt,
  scope: { schoolSlug: "beijing-normal-university", schoolCount: 1, applicationEntryCount: 33, coveredMajorCount, chineseProgramCount: 33, englishProgramCount: 0, programCount: 33, intakeCount: 33 },
  officialEvidence: {
    admissionBrochure: { sha256: GUIDE_SHA, fetchedAt: guideEvidence.fetchedAt, contentType: guideEvidence.contentType },
    englishMajorCatalog: { sha256: CATALOG_EN_SHA, fetchedAt: catalogEnEvidence.fetchedAt, contentType: catalogEnEvidence.contentType },
    chineseMajorCatalog: { sha256: CATALOG_ZH_SHA, fetchedAt: catalogZhEvidence.fetchedAt, contentType: catalogZhEvidence.contentType },
  },
  reviewItems: [
    { field: "catalog granularity", result: "33_application_entries_covering_40_majors", reason: "The official catalog publishes several combined major-category entries; these remain single application routes and their included majors are retained in the titles." },
    { field: "teaching language", result: "Chinese_only", reason: "The official 2026 undergraduate brochure states that all degree routes in this catalog use Chinese instruction." },
    { field: "CSCA", result: "required_program_specific", reason: "All applicants must submit CSCA; the official catalog supplies the subject combination for each application entry." },
    { field: "applicant data", result: "excluded", reason: "The candidate contains public catalog metadata only; no applicant-submitted documents or personal records are imported." },
  ],
  reconciliation: { actionAfterApproval: "upsert_official_2026_catalog_and_archive_unsupported_legacy_record", legacyAliasesToArchive, destructiveDeletion: false, stableMatchingSlugs },
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle only", note: "No applicant, account, payment, private-file or personal-contact fields are present. Raw official snapshots remain ignored and are not imported." },
  candidateBundleSha256: validation.bundleSha256,
  operationPlanSha256: validation.operationPlanSha256,
};

for (const [path, value] of [[candidatePath, candidate], [validationPath, validation], [reviewPath, review]] as const) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8" });
}
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, reviewPath, candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256, reviewSha256: createHash("sha256").update(JSON.stringify(review)).digest("hex"), summary: validation.summary, applicationEntryCount: rows.length, coveredMajorCount, legacyAliasesToArchive: legacyAliasesToArchive.length, stableMatchingSlugs: stableMatchingSlugs.length }, null, 2));
