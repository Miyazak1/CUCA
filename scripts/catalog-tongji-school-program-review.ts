import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const pageManifestPath = resolve(root, "work/catalog-official/2026-09-11T06-57-40-629Z/manifest.json");
const guideManifestPath = resolve(root, "work/catalog-official/2026-09-11T06-58-29-975Z/manifest.json");
const catalogManifestPath = resolve(root, "work/catalog-official/2026-09-11T06-58-37-113Z/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.tongji-school-program-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.tongji-school-program-batch-01.validation.json");
const reviewPath = resolve(root, "seeds/catalog.tongji-school-program-batch-01.review.json");

const PAGE_ID = "tongji-university-undergraduate-2026";
const PAGE_SHA = "9ab5c8503f5606109df8a69aae9539e4c8f2c4ca9f186d06d38eade48d76b84e";
const PAGE_URL = "https://study.tongji.edu.cn/en/info/1075/1231.htm";
const GUIDE_ID = "tongji-university-undergraduate-guide-pdf-2026";
const GUIDE_SHA = "7cf8162c041e744b929a97d54bdac41930426147a948120f42acb093f77244e6";
const GUIDE_URL = "https://study.tongji.edu.cn/__local/6/AE/A6/66E0A7D71A250672DFF40ED4048_3682FBF2_3762E.pdf";
const CATALOG_ID = "tongji-university-undergraduate-catalog-2026";
const CATALOG_SHA = "448d5f1fd4e6ffce0d9a390fbfa704c8e5b583372ae7a4cdab69f72b75de9c89";
const CATALOG_URL = "https://study.tongji.edu.cn/2026nianguojixueshengbenkezhaoshengzhuanyemuluhanzhongyingwenshouke.xls";

const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const pageEvidence = (await parse(pageManifestPath)).sources?.[0];
const guideEvidence = (await parse(guideManifestPath)).sources?.[0];
const catalogEvidence = (await parse(catalogManifestPath)).sources?.[0];
for (const [evidence, id, sha] of [
  [pageEvidence, PAGE_ID, PAGE_SHA],
  [guideEvidence, GUIDE_ID, GUIDE_SHA],
  [catalogEvidence, CATALOG_ID, CATALOG_SHA],
] as const) {
  if (evidence?.id !== id || evidence?.sha256 !== sha || evidence?.status !== 200) {
    throw new Error(`The refreshed official source does not match the reviewed snapshot: ${id}`);
  }
}

type ProgramSpec = {
  nameEn: string;
  nameZh: string;
  slug?: string;
  durationYears?: number;
  tuition?: number;
  subjects?: string[];
  note?: string;
};
type ProgramGroup = {
  school: string;
  category: string;
  language?: "Chinese" | "English";
  durationYears?: number;
  tuition: number;
  subjects: string[];
  note?: string;
  programs: ProgramSpec[];
};

const H = "Chinese (Humanities)";
const S = "Chinese (STEM)";
const M = "Mathematics";
const P = "Physics";
const C = "Chemistry";
const p = (nameEn: string, nameZh: string, extra: Omit<ProgramSpec, "nameEn" | "nameZh"> = {}): ProgramSpec => ({ nameEn, nameZh, ...extra });
const COLOR_VISION = "Applicants with color blindness or color weakness are not admitted to this school or program.";
const COLOR_RECOGNITION = "Applicants with partial color blindness are not admitted to this school or program.";
const PORTFOLIO = "Applicants must submit the required supplementary professional materials in the Portfolio section of the application system.";
const joinNote = (...notes: Array<string | undefined>) => notes.filter(Boolean).join(" ");

const groups: ProgramGroup[] = [
  { school: "School of Material Science and Engineering", category: "Materials Science", tuition: 24600, subjects: [S, M, C], note: COLOR_VISION, programs: [p("Materials Science and Engineering", "材料科学与工程"), p("New Energy Materials and Devices", "新能源材料与器件")] },
  { school: "College of Surveying and Geoinformatics", category: "Surveying and Geoinformatics", tuition: 24600, subjects: [S, M, P], programs: [p("Surveying Engineering in Geoinformatics", "测绘工程", { slug: "tongji-university-surveying-engineering" })] },
  { school: "School of Electronics and Information Engineering", category: "Electronic and Information Engineering", tuition: 24600, subjects: [S, M, P], note: COLOR_RECOGNITION, programs: [p("Electrical Engineering and Automation", "电气工程及其自动化"), p("Telecommunications Engineering", "通信工程"), p("Microelectronics Science and Engineering", "微电子科学与工程"), p("Artificial Intelligence", "人工智能"), p("Automation", "自动化")] },
  { school: "School of Law", category: "Law", tuition: 20000, subjects: [H, M], programs: [p("Law", "法学")] },
  { school: "International College of Football", category: "Sports", tuition: 20000, subjects: [H, M], programs: [p("Sports Training", "运动训练")] },
  { school: "School of Ocean and Earth Science", category: "Ocean and Earth Science", tuition: 24600, subjects: [S, M, P], programs: [p("Marine Science", "海洋科学与技术"), p("Geophysics", "地球物理学")] },
  { school: "School of Aerospace Engineering and Applied Mechanics", category: "Aerospace and Mechanics", tuition: 24600, subjects: [S, M, P], programs: [p("Engineering Mechanics", "工程力学"), p("Flight Vehicle Manufacture Engineering", "飞行器制造工程")] },
  { school: "School of Chemical Science and Engineering", category: "Chemistry", tuition: 24600, subjects: [S, M, C], note: COLOR_VISION, programs: [p("Applied Chemistry", "应用化学")] },
  { school: "College of Environmental Science and Engineering", category: "Environmental Science and Engineering", tuition: 24600, subjects: [S, M, C], note: COLOR_VISION, programs: [p("Water Supply And Drainage", "给排水科学与工程"), p("Environmental Engineering", "环境工程"), p("Environmental Science", "环境科学")] },
  { school: "School of Mechanical Engineering", category: "Mechanical and Energy Engineering", tuition: 24600, subjects: [S, M, P, C], programs: [p("Machine Design & Manufacturing and Their Automation", "机械设计制造及其自动化"), p("Intelligent Manufacturing Engineering", "智能制造工程"), p("Thermal Energy & Dynamic Engineering", "能源与动力工程", { note: COLOR_RECOGNITION }), p("Building Environment and Energy Application Engineering", "建筑环境与能源应用工程")] },
  { school: "School of Computer Science and Technology", category: "Computer Science", tuition: 24600, subjects: [S, M, P], programs: [p("Computer Science and Technology", "计算机科学与技术"), p("Software Engineering", "软件工程"), p("Information Security", "信息安全"), p("Data Science and Big-Data Technologies", "数据科学与大数据技术")] },
  { school: "College of Architecture and Urban Planning", category: "Architecture and Urban Planning", tuition: 28700, subjects: [S, M, P], note: joinNote(COLOR_VISION, PORTFOLIO), programs: [p("Architecture", "建筑学", { durationYears: 5 }), p("Urban Planning", "城乡规划"), p("Landscape Studies", "风景园林"), p("Historic Building Protection Engineering", "历史建筑保护工程"), p("Landscape Design", "城市设计")] },
  { school: "College of Transportation Engineering", category: "Transportation Engineering", tuition: 24600, subjects: [S, M, P], programs: [p("Vehicle Engineering (College of Transportation Engineering)", "车辆工程"), p("Traffic and Transportation", "交通运输", { note: COLOR_VISION }), p("Traffic Engineering", "交通工程", { note: COLOR_VISION })] },
  { school: "School of Economics and Management", category: "Economics and Management", tuition: 24600, subjects: [H, M], programs: [p("Finance", "金融学"), p("Information Management and Information Systems", "信息管理与信息系统"), p("Project Management", "工程管理"), p("Accounting", "会计学")] },
  { school: "School of Dentistry", category: "Dentistry", tuition: 28700, subjects: [S, M, C], programs: [p("Oral Medicine", "口腔医学", { durationYears: 5 })] },
  { school: "School of Automotive Studies", category: "Automotive Engineering", tuition: 24600, subjects: [S, M, P, C], programs: [p("Vehicle Engineering (College of Automotive Engineering)", "车辆工程（汽车）")] },
  { school: "School of Humanities", category: "Humanities", tuition: 20000, subjects: [H, M], programs: [p("Philosophy", "哲学"), p("Chinese Language and Culture", "汉语言文学"), p("Culture Industry Management", "文化产业管理")] },
  { school: "College of Design and Innovation", category: "Design", tuition: 28700, subjects: [S, M, P], note: joinNote(COLOR_VISION, PORTFOLIO), programs: [p("Industrial Design", "工业设计"), p("Art and Design", "艺术设计学", { subjects: [H, M] })] },
  { school: "School of Life Science and Technology", category: "Life Sciences", tuition: 24600, subjects: [S, M, P, C], programs: [p("Biotechnology", "生物技术"), p("Biological Information", "生物信息学")] },
  { school: "School of Mathematical Science", category: "Mathematics and Statistics", tuition: 24600, subjects: [S, M, P], programs: [p("Mathematics and Applied Mathematics", "数学与应用数学"), p("Statistics", "统计学")] },
  { school: "College of Civil Engineering", category: "Civil Engineering", tuition: 24600, subjects: [S, M, P], programs: [p("Civil Engineering", "土木工程"), p("Intelligent Construction", "智能建造"), p("Geological Engineering", "地质工程")] },
  { school: "School of Foreign Languages", category: "Languages", tuition: 20000, subjects: [H, M], programs: [p("English", "英语"), p("German", "德语"), p("Japanese", "日语")] },
  { school: "School of Physical Science and Engineering", category: "Physics and Optical Engineering", tuition: 24600, subjects: [S, M, P], note: COLOR_VISION, programs: [p("Applied Physics", "应用物理学"), p("Optical Information Science and Technology", "光电信息科学与工程")] },
  { school: "School of Medicine", category: "Medicine and Rehabilitation", tuition: 28700, subjects: [S, M, C], programs: [p("Clinical Medicine", "临床医学", { durationYears: 5 }), p("Physical Therapy of Rehabilitation", "康复物理治疗", { note: COLOR_VISION }), p("Nursing", "护理学", { note: COLOR_VISION })] },
  { school: "College of Arts and Media", category: "Arts and Media", tuition: 28700, subjects: [H, M], programs: [p("Communication", "传播学", { tuition: 20000, note: COLOR_VISION }), p("Music Performance", "音乐表演"), p("Acting", "表演"), p("Radio & Television Editing & Directing", "广播电视编导"), p("Science of Animated Cartoon", "动画", { note: COLOR_VISION })] },
  { school: "School of Political Science and International Relations", category: "Political Science", tuition: 20000, subjects: [H, M], programs: [p("Political Science & Public Administration", "政治学与行政学")] },
  { school: "International School", category: "Chinese Language", tuition: 20000, subjects: [H, M], programs: [p("Chinese Language (Teaching Chinese to Speakers of Other Languages)", "汉语言（国际教育）", { note: "Applicants holding a valid HSK Level 4 certificate with a score of 180 or above may be exempted from the Humanities Chinese CSCA subject." }), p("Chinese Language (Economics and Trade Oriented)", "汉语言（经贸方向）", { note: "Applicants holding a valid HSK Level 4 certificate with a score of 180 or above may be exempted from the Humanities Chinese CSCA subject." })] },
  { school: "College of Architecture and Urban Planning", category: "Architecture and Urban Planning", language: "English", tuition: 33800, subjects: [M, P], note: joinNote(COLOR_VISION, PORTFOLIO), programs: [p("Architecture (International Class)", "建筑学（国际班）")] },
  { school: "School of Medicine", category: "Medicine", language: "English", tuition: 45000, subjects: [M, C], programs: [p("Clinical Medicine (MBBS)", "临床医学专业", { durationYears: 6 })] },
  { school: "College of Civil Engineering", category: "Civil Engineering", language: "English", tuition: 35000, subjects: [M, P], programs: [p("Civil Engineering (International Class)", "土木工程（国际班）")] },
];

const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const programs: CatalogSeedProgram[] = groups.flatMap(group => group.programs.map(program => {
  const language = group.language ?? "Chinese";
  const tuition = program.tuition ?? group.tuition;
  const subjects = program.subjects ?? group.subjects;
  const note = joinNote(group.note, program.note);
  const chineseLanguageRoute = group.school === "International School";
  return {
    slug: program.slug ?? `tongji-university-${slugify(program.nameEn)}`,
    schoolSlug: "tongji-university",
    citySlug: "shanghai",
    nameEn: program.nameEn,
    nameZh: program.nameZh,
    degreeLevel: "Undergraduate",
    durationYears: program.durationYears ?? group.durationYears ?? 4,
    fieldCategory: group.category,
    subjectArea: group.school,
    teachingLanguage: language,
    cscaSubjects: subjects,
    cscaRequirement: language === "Chinese" ? `CSCA in Chinese: ${subjects.join(", ")}` : `CSCA: ${subjects.join(", ")}`,
    ...(language === "Chinese" ? { hskRequirement: chineseLanguageRoute ? "HSK Level 4, score 180 or above for first-year admission" : "HSK Level 5, score 180 or above" } : { englishRequirement: "IELTS 6.5 or TOEFL iBT 85 or above, unless exempt as a native English speaker or graduate of an English-medium high school" }),
    tuitionAmount: tuition,
    tuitionCurrency: "RMB",
    tuitionPeriod: "year",
    tuitionText: `RMB ${tuition.toLocaleString("en-US")}/year`,
    scholarshipText: language === "Chinese" ? "The 2026 guide lists Chinese Government Scholarship bilateral and Silk Road routes and the Shanghai Municipal Government Scholarship for Chinese-taught programs; eligibility must be checked separately." : "The 2026 guide lists the Tongji University International Student Excellence Scholarship for English-taught programs; eligibility must be checked separately.",
    hasScholarship: true,
    applicationUrl: PAGE_URL,
    ...(note ? { applicationNote: note } : {}),
    status: "draft",
    sourceUrl: CATALOG_URL,
    sourceLabel: "Tongji University 2026 International Student Undergraduate Major Catalog",
    sourceSha256: CATALOG_SHA,
    capturedAt: catalogEvidence.fetchedAt,
    sourceFieldLineage: {
      nameEn: "Major column",
      nameZh: "专业名称 column",
      durationYears: "Duration of Study column",
      tuitionAmount: "Tuition (RMB) column",
      cscaSubjects: "CSCA Test Subjects column",
      teachingLanguage: "Chinese Taught Majors / English Taught Majors section",
      ...(language === "Chinese" ? { hskRequirement: chineseLanguageRoute ? "2026 enrollment guide page 2 and catalog row note" : "2026 enrollment guide page 2" } : { englishRequirement: "2026 enrollment guide page 3" }),
      scholarshipText: language === "Chinese" ? "2026 enrollment guide pages 7-8" : "2026 enrollment guide page 8",
      applicationUrl: "registered HTTPS 2026 enrollment page, which links to the Tongji online application system",
      ...(note ? { applicationNote: "catalog color-vision marker note and/or 2026 enrollment guide pages 4-5" } : {}),
    },
  };
}));

const chinesePrograms = programs.filter(program => program.teachingLanguage === "Chinese");
const englishPrograms = programs.filter(program => program.teachingLanguage === "English");
if (programs.length !== 71 || chinesePrograms.length !== 68 || englishPrograms.length !== 3) {
  throw new Error(`Unexpected Tongji program count: ${chinesePrograms.length} Chinese + ${englishPrograms.length} English.`);
}
if (new Set(programs.map(program => program.slug)).size !== programs.length) throw new Error("Generated Tongji program slugs are not unique.");

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: pageEvidence.fetchedAt,
  cities: [{
    slug: "shanghai", nameEn: "Shanghai", nameZh: "上海", region: "East China", province: "Shanghai", status: "draft",
    sourceUrl: GUIDE_URL, sourceLabel: "Tongji University Undergraduate Enrollment Guide for International Students in 2026", sourceSha256: GUIDE_SHA, capturedAt: guideEvidence.fetchedAt,
    sourceFieldLineage: { nameEn: "contact address on page 8", province: "contact address on page 8" },
  }],
  schools: [{
    slug: "tongji-university", nameEn: "Tongji University", nameZh: "同济大学", citySlug: "shanghai", schoolType: "public", region: "East China",
    applicationLevel: "Undergraduate", languageOfInstruction: "Chinese and English",
    languageRequirement: "Chinese-taught majors normally require HSK Level 5 score 180 or above. English-taught majors require IELTS 6.5 or TOEFL iBT 85 or above unless exempt under the official guide.",
    hskRequirement: "HSK Level 5, score 180 or above; first-year Chinese Language routes in the International School require HSK Level 4, score 180 or above. Chinese-medium high-school graduates may submit proof for exemption.",
    englishRequirement: "IELTS 6.5 or TOEFL iBT 85 or above; native English speakers and applicants from English-medium high schools are exempt with supporting evidence.",
    deadlineSummary: "Applications ran from January 10 to March 31, 2026.",
    tuitionSummary: "RMB 20,000-28,700/year for Chinese-taught programs and RMB 33,800-45,000/year for English-taught programs in the official 2026 catalog.",
    websiteUrl: "https://www.tongji.edu.cn/", admissionsUrl: PAGE_URL,
    cscaRequired: true,
    cscaRequirement: "All 2026 undergraduate applicants must take CSCA and upload the score report before applying. For Chinese-taught programs, Mathematics, Physics and Chemistry papers must also be taken in Chinese.",
    cscaSubjects: [H, S, M, P, C], subjectTags: [...new Set(groups.map(group => group.category))], languageTags: ["Chinese-taught", "English-taught"],
    tuitionBandLabel: "RMB 20,000-45,000/year",
    campusHighlights: ["71 official 2026 undergraduate routes", "68 Chinese-taught and 3 English-taught routes", "One major may be selected per application", "Program-specific CSCA subject combinations"],
    status: "draft", sourceUrl: GUIDE_URL, sourceLabel: "Tongji University Undergraduate Enrollment Guide for International Students in 2026", sourceSha256: GUIDE_SHA, capturedAt: guideEvidence.fetchedAt,
    sourceFieldLineage: { nameEn: "guide title", nameZh: "official catalog institution context", citySlug: "contact address on page 8", applicationLevel: "guide title", languageOfInstruction: "guide pages 2-3 and catalog sections", languageRequirement: "guide pages 2-3", deadlineSummary: "Application Time on page 1", tuitionSummary: "official 2026 major catalog Tuition column", websiteUrl: "official enrollment page navigation", admissionsUrl: "registered source URL", cscaRequirement: "Application Procedure on page 5" },
  }],
  programs,
  programIntakes: programs.map(program => ({
    programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026,
    openDate: "2026-01-09T16:00:00.000Z", deadlineDate: "2026-03-31T15:59:59.000Z", deadlineLabel: "March 31, 2026", applicationRound: "2026 undergraduate admission", status: "closed" as const,
    sourceUrl: GUIDE_URL, sourceLabel: "Tongji University Undergraduate Enrollment Guide for International Students in 2026", sourceSha256: GUIDE_SHA, capturedAt: guideEvidence.fetchedAt,
    sourceFieldLineage: { openDate: "Application Time on page 1; Beijing local-day boundary", deadlineDate: "Application Time on page 1; Beijing local-day boundary" },
  })),
  scholarships: [],
};

const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`Tongji candidate is invalid: ${validation.errors.join(" ")}`);
const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : value && typeof value === "object"
  ? `{${Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`
  : JSON.stringify(value);
const prohibitedPatterns = [/passport(?:Number)?/i, /personalEmail/i, /personalPhone/i, /cardNumber/i, /cvv/i, /passwordHash/i, /sessionToken/i, /beneficiaryBank/i];
if (prohibitedPatterns.some(pattern => pattern.test(canonical(candidate)))) throw new Error("The Tongji candidate contains a prohibited-data marker.");

const stableMatchingSlugs = [
  "tongji-university-architecture-international-class", "tongji-university-artificial-intelligence", "tongji-university-automation",
  "tongji-university-civil-engineering-international-class", "tongji-university-clinical-medicine-mbbs", "tongji-university-electrical-engineering-and-automation",
  "tongji-university-law", "tongji-university-materials-science-and-engineering", "tongji-university-microelectronics-science-and-engineering",
  "tongji-university-new-energy-materials-and-devices", "tongji-university-sports-training", "tongji-university-surveying-engineering",
  "tongji-university-telecommunications-engineering",
];
const legacyAliasesToArchive: string[] = [];
for (const slug of stableMatchingSlugs) if (!programs.some(program => program.slug === slug)) throw new Error(`Reviewed stable slug is missing: ${slug}`);
const review = {
  version: 1, status: "awaiting_user_approval", generatedAt: pageEvidence.fetchedAt,
  scope: { schoolSlug: "tongji-university", schoolCount: 1, chineseProgramCount: 68, englishProgramCount: 3, programCount: 71, intakeCount: 71 },
  officialEvidence: {
    enrollmentPage: { sha256: PAGE_SHA, fetchedAt: pageEvidence.fetchedAt, contentType: pageEvidence.contentType },
    enrollmentGuide: { sha256: GUIDE_SHA, fetchedAt: guideEvidence.fetchedAt, contentType: guideEvidence.contentType, pageCount: 10 },
    programCatalog: { sha256: CATALOG_SHA, fetchedAt: catalogEvidence.fetchedAt, contentType: catalogEvidence.contentType, sheetName: "招生专业", sourceRange: "A1:G76" },
  },
  reviewItems: [{ field: "registration date", result: "not_published", reason: "The 2026 guide page 8 says September 2025, which is internally inconsistent with the 2026 intake." }],
  reconciliation: { actionAfterApproval: "upsert_official_2026_catalog", legacyAliasesToArchive, destructiveDeletion: false, stableMatchingSlugs },
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle only", note: "The candidate excludes applicant data, college staff contacts, bank-account instructions and application-document content. Raw official snapshots remain ignored and are not imported." },
  candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256,
};

for (const [path, value] of [[candidatePath, candidate], [validationPath, validation], [reviewPath, review]] as const) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8" });
}
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, reviewPath, candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256, reviewSha256: createHash("sha256").update(JSON.stringify(review)).digest("hex"), summary: validation.summary, chinesePrograms: chinesePrograms.length, englishPrograms: englishPrograms.length, stableMatchingSlugs: stableMatchingSlugs.length, legacyAliasesToArchive: legacyAliasesToArchive.length }, null, 2));
