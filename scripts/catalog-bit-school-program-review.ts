import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const pageManifestPath = resolve(root, "work/catalog-official/2026-09-11T09-18-31-474Z/manifest.json");
const pdfManifestPath = resolve(root, "work/catalog-official/2026-09-11T09-19-34-830Z/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.bit-school-program-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.bit-school-program-batch-01.validation.json");
const reviewPath = resolve(root, "seeds/catalog.bit-school-program-batch-01.review.json");

const PAGE_ID = "bit-undergraduate-admissions-2026";
const PAGE_URL = "https://isc.bit.edu.cn/aboutbit/faq/b112085.htm";
const PAGE_SHA = "49286d21e3e1941d4d5f5b87f71400373743244c7a8a229c5137cc7cc69a0c29";
const PDF_ID = "bit-admission-scholarship-book-2026";
const PDF_URL = "https://isc.bit.edu.cn/docs/2025-11/b59c4c1d2b41494f9e2edc2c0993742b.pdf";
const PDF_SHA = "b0b66ba49c95ea86d2efcb0099aaf7a585ab3f0f34d56e6ec0161199001d3195";
const APPLICATION_URL = "https://apply.isc.bit.edu.cn/";

const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const pageEvidence = (await parse(pageManifestPath)).sources?.[0];
const pdfEvidence = (await parse(pdfManifestPath)).sources?.[0];
for (const [evidence, id, sha, contentType] of [
  [pageEvidence, PAGE_ID, PAGE_SHA, "text/html"],
  [pdfEvidence, PDF_ID, PDF_SHA, "application/pdf"],
] as const) {
  if (evidence?.id !== id || evidence?.sha256 !== sha || evidence?.status !== 200 || evidence?.contentType !== contentType) {
    throw new Error(`The refreshed official source does not match the reviewed snapshot: ${id}`);
  }
}

type Route = {
  slug: string;
  nameEn: string;
  nameZh: string;
  citySlug: "beijing" | "zhuhai";
  teachingLanguage: "Chinese" | "Chinese and Russian" | "English";
  category: string;
  subjectArea: string;
  subjects: string[];
  cscaRequirement: string;
  tuition: number;
  note: string;
  pdfPage: 11 | 12;
};
const mp = ["Mathematics", "Physics"];
const math = ["Mathematics"];
const chineseCategory = (
  slug: string,
  nameEn: string,
  nameZh: string,
  category: string,
  subjectArea: string,
  subjects: string[],
  directions: string,
): Route => ({
  slug: `beijing-institute-of-technology-${slug}`,
  nameEn,
  nameZh,
  citySlug: "beijing",
  teachingLanguage: "Chinese",
  category,
  subjectArea,
  subjects,
  cscaRequirement: subjects.join(" + "),
  tuition: 23000,
  note: `BIT admits this as a broad category. Students select a covered major after the first year. Covered directions: ${directions}`,
  pdfPage: 11,
});
const zhuhaiRoute = (slug: string, nameEn: string, nameZh: string, domain: string): Route => ({
  slug: `beijing-institute-of-technology-${slug}-chinese-russian-zhuhai`,
  nameEn: `${nameEn} (Chinese/Russian, Zhuhai)`,
  nameZh: `${nameZh}（中俄双语，珠海校区）`,
  citySlug: "zhuhai",
  teachingLanguage: "Chinese and Russian",
  category: domain,
  subjectArea: `${domain}, BIT Zhuhai`,
  subjects: mp,
  cscaRequirement: "Mathematics + Physics",
  tuition: 23000,
  note: "Some advanced-year courses are taught in Russian. BIT provides Russian-language training after enrollment and does not require a Russian score at application; HSK Level 5 score 180 is required.",
  pdfPage: 11,
});
const englishRoute = (slug: string, nameEn: string, nameZh: string, citySlug: "beijing" | "zhuhai", subjects: string[]): Route => ({
  slug: `beijing-institute-of-technology-${slug}`,
  nameEn: `${nameEn} (English)`,
  nameZh: `${nameZh}（英文授课）`,
  citySlug,
  teachingLanguage: "English",
  category: citySlug === "zhuhai" ? "Artificial Intelligence" : "English-taught undergraduate program",
  subjectArea: citySlug === "zhuhai" ? "Aerospace and Informatics Domain, BIT Zhuhai" : "BIT Beijing Campus",
  subjects,
  cscaRequirement: subjects.join(" + "),
  tuition: 30000,
  note: `Direct English-taught undergraduate application at BIT ${citySlug === "zhuhai" ? "Zhuhai" : "Beijing"} Campus.`,
  pdfPage: 12,
});

const routes: Route[] = [
  chineseCategory("aerospace-and-mechatronics-category", "Aerospace and Mechatronics Category", "宇航与机电类", "Engineering", "School of Aerospace Engineering; School of Mechatronical Engineering", mp, "Aeronautical and Astronautical Engineering; Mechatronics Engineering (both also offered in English)"),
  chineseCategory("intelligent-manufacturing-and-intelligent-vehicles-category", "Intelligent Manufacturing and Intelligent Vehicles Category", "智能制造与智能车辆类", "Engineering", "School of Mechanical Engineering", mp, "Mechanical Engineering (also offered in English); Industrial Engineering; Vehicle Engineering; Energy and Power Engineering"),
  chineseCategory("electronic-information-category", "Electronic Information Category", "电子信息类", "Electronic Engineering", "School of Optics and Photonics; School of Information and Electronics; School of Integrated Circuits and Electronics", mp, "Optoelectronic Information Science and Engineering; Measurement and Control Technology and Instrument; Intelligent Perception Engineering; Electronic Information Engineering; Communication Engineering; Electronic Science and Technology (also offered in English)"),
  chineseCategory("information-science-and-technology-category", "Information Science and Technology Category", "信息科学技术类", "Information Technology", "School of Automation; School of Computer Science and Technology; School of Cyberspace Science and Technology; School of AI", mp, "Automation and Computer Science and Technology (also offered in English); Electrical Engineering and Automation; Software Engineering; Data Science and Big Data Technology; Cyberspace Security; Artificial Intelligence"),
  chineseCategory("science-and-materials-category", "Science and Materials Category", "理学与材料类", "Science and Materials", "Schools of Materials, Chemistry and Chemical Engineering, Life Science, Medical Technology, and Physics", ["Mathematics", "Physics or Chemistry"], "Materials Science and Engineering; Materials Chemistry; Chemistry; Applied Chemistry; Chemical Engineering and Technology; Pharmaceutical Engineering; Energy Chemical Engineering; Biotechnology; Biomedical Engineering; Intelligent Medical Engineering; Applied Physics"),
  chineseCategory("social-sciences-management-and-economics-category", "Social Sciences Category (Management and Economics)", "社会科学类（管理与经济方向）", "Management and Economics", "School of Management; School of Economics", math, "Business Administration including Digital Innovation Management; Accounting; International Economics and Trade including Digital Finance and Digital Trade (also offered in English)"),
  chineseCategory("social-sciences-humanities-category", "Social Sciences Category (Humanities)", "社会科学类（人文社科方向）", "Humanities and Social Sciences", "School of Education; School of Law; School of Foreign Languages", math, "Social Work; Law; English; Japanese; German; Spanish"),
  chineseCategory("design-category", "Design Category", "设计学类", "Art and Design", "School of Design and Arts", math, "Industrial Design; Product Design; Visual Communication Design; Environmental Design"),
  zhuhaiRoute("aeronautical-and-astronautical-engineering", "Aeronautical and Astronautical Engineering", "航空航天工程", "Aerospace and Informatics Domain"),
  zhuhaiRoute("vehicle-engineering", "Vehicle Engineering", "车辆工程", "Energy and Transportation Domain"),
  zhuhaiRoute("energy-and-power-engineering", "Energy and Power Engineering", "能源与动力工程", "Energy and Transportation Domain"),
  zhuhaiRoute("automation", "Automation", "自动化", "Marine Science and Technology Domain"),
  zhuhaiRoute("optoelectronic-information-science-and-engineering", "Optoelectronic Information Science and Engineering", "光电信息科学与工程", "Frontier Interdisciplinary Domain"),
  englishRoute("aerospace-engineering-english", "Aeronautical and Astronautical Engineering", "航空航天工程", "beijing", mp),
  englishRoute("automation-english", "Automation", "自动化", "beijing", mp),
  englishRoute("computer-science-and-technology-english", "Computer Science and Technology", "计算机科学与技术", "beijing", mp),
  englishRoute("mechatronics-engineering-english", "Mechatronics Engineering", "机械电子工程", "beijing", mp),
  englishRoute("electronic-science-and-technology-english", "Electronics Science and Technology", "电子科学与技术", "beijing", mp),
  englishRoute("mechanical-engineering-english", "Mechanical Engineering", "机械工程", "beijing", mp),
  englishRoute("international-economics-and-trade-english", "International Economics and Trade", "国际经济与贸易", "beijing", math),
  englishRoute("artificial-intelligence-english", "Artificial Intelligence", "人工智能", "zhuhai", mp),
];
if (routes.length !== 21) throw new Error(`Unexpected BIT application-route count: ${routes.length}.`);
const languageCounts = routes.reduce((result, item) => ({ ...result, [item.teachingLanguage]: (result[item.teachingLanguage] ?? 0) + 1 }), {} as Record<string, number>);
if (languageCounts.Chinese !== 8 || languageCounts["Chinese and Russian"] !== 5 || languageCounts.English !== 8) throw new Error(`Unexpected BIT language counts: ${JSON.stringify(languageCounts)}.`);
if (new Set(routes.map(route => route.slug)).size !== routes.length) throw new Error("Generated BIT program slugs are not unique.");

const programs: CatalogSeedProgram[] = routes.map(route => ({
  slug: route.slug,
  schoolSlug: "beijing-institute-of-technology",
  citySlug: route.citySlug,
  nameEn: route.nameEn,
  nameZh: route.nameZh,
  degreeLevel: "Undergraduate",
  durationYears: 4,
  fieldCategory: route.category,
  subjectArea: route.subjectArea,
  teachingLanguage: route.teachingLanguage,
  cscaSubjects: route.subjects,
  cscaRequirement: route.cscaRequirement,
  ...(route.teachingLanguage === "English"
    ? { englishRequirement: "IELTS 6.0, TOEFL 85, Duolingo 110, another BIT-recognized equivalent, or an applicable English-medium/native-speaker exemption" }
    : { hskRequirement: "HSK Level 5, score 180 or above" }),
  tuitionAmount: route.tuition,
  tuitionCurrency: "RMB",
  tuitionPeriod: "year",
  tuitionText: `RMB ${route.tuition.toLocaleString("en-US")}/year`,
  applicationUrl: APPLICATION_URL,
  applicationNote: route.note,
  scholarshipText: `BIT publishes campus-specific government and university scholarships; Beijing Government Scholarship applies only to Beijing Campus and Guangdong Government Outstanding International Student Scholarship only to Zhuhai Campus.`,
  status: "draft",
  sourceUrl: PDF_URL,
  sourceLabel: "Beijing Institute of Technology 2026 Admission Book",
  sourceSha256: PDF_SHA,
  capturedAt: pdfEvidence.fetchedAt,
  sourceFieldLineage: {
    nameEn: `PDF page ${route.pdfPage}, undergraduate program table`,
    nameZh: `PDF page ${route.pdfPage}, undergraduate program table`,
    citySlug: `PDF page ${route.pdfPage}, campus heading`,
    subjectArea: `PDF page ${route.pdfPage}, category/domain/school column`,
    teachingLanguage: `PDF page ${route.pdfPage}, section heading and route label`,
    cscaSubjects: `PDF page ${route.pdfPage}, CSCA required subjects column`,
    durationYears: "official 2026 undergraduate admissions page, program duration",
    tuitionAmount: "PDF page 20, tuition table",
    applicationUrl: "official 2026 undergraduate admissions page, section IV",
    applicationNote: `PDF page ${route.pdfPage} and official admissions page section II`,
    scholarshipText: "PDF pages 18-19, scholarship sections C-E",
  },
}));

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: pageEvidence.fetchedAt,
  cities: [
    { slug: "beijing", nameEn: "Beijing", nameZh: "北京", region: "North China", province: "Beijing", status: "draft", sourceUrl: PDF_URL, sourceLabel: "BIT 2026 Admission Book", sourceSha256: PDF_SHA, capturedAt: pdfEvidence.fetchedAt, sourceFieldLineage: { nameEn: "PDF pages 2 and 21", province: "PDF page 21 campus table" } },
    { slug: "zhuhai", nameEn: "Zhuhai", nameZh: "珠海", region: "South China", province: "Guangdong", status: "draft", sourceUrl: PDF_URL, sourceLabel: "BIT 2026 Admission Book", sourceSha256: PDF_SHA, capturedAt: pdfEvidence.fetchedAt, sourceFieldLineage: { nameEn: "PDF pages 2 and 21", province: "PDF page 21 campus table" } },
  ],
  schools: [{
    slug: "beijing-institute-of-technology",
    nameEn: "Beijing Institute of Technology",
    nameZh: "北京理工大学",
    citySlug: "beijing",
    schoolType: "public",
    region: "North China",
    applicationLevel: "Undergraduate",
    languageOfInstruction: "Chinese, Chinese and Russian, and English",
    languageRequirement: "Chinese and Chinese/Russian routes require HSK Level 5 score 180; no Russian score is required for the bilingual Zhuhai routes. English routes require IELTS 6.0, TOEFL 85, Duolingo 110, another recognized equivalent, or an applicable exemption.",
    hskRequirement: "HSK Level 5, score 180 or above for Chinese and Chinese/Russian routes",
    englishRequirement: "IELTS 6.0, TOEFL 85, Duolingo 110, another BIT-recognized equivalent, or an applicable exemption",
    deadlineSummary: "The application system opened October 15, 2025. The 2026 undergraduate deadline was June 1, 2026; CSCA results had to be uploaded before the comprehensive interview.",
    tuitionSummary: "RMB 23,000/year for Chinese-program routes and RMB 30,000/year for English-taught routes; degree application fee RMB 600 and insurance RMB 800-1,800/year.",
    applicationFee: "RMB 600",
    websiteUrl: "https://isc.bit.edu.cn/",
    admissionsUrl: PAGE_URL,
    cscaRequired: true,
    cscaRequirement: "All undergraduate applicants submit CSCA. The official tables assign Mathematics + Physics to engineering/science routes except Science and Materials (Mathematics + Physics or Chemistry), and Mathematics to management, humanities, design, and International Economics and Trade.",
    cscaSubjects: ["Mathematics", "Physics", "Chemistry"],
    subjectTags: [...new Set(routes.map(route => route.category))],
    languageTags: ["Chinese-taught", "Chinese/Russian bilingual", "English-taught"],
    campusHighlights: ["21 verified 2026 application routes", "Beijing and Zhuhai campuses", "Chinese admission by broad category with major selection after the first year", "Five Zhuhai Chinese/Russian routes and one Zhuhai English AI route"],
    contactNotes: "Use the official 2026 admissions page for the current Beijing and Zhuhai admissions contacts.",
    status: "draft",
    sourceUrl: PAGE_URL,
    sourceLabel: "Beijing Institute of Technology 2026 International Undergraduate Admissions",
    sourceSha256: PAGE_SHA,
    capturedAt: pageEvidence.fetchedAt,
    sourceFieldLineage: {
      nameEn: "section I",
      citySlug: "sections I-II",
      applicationLevel: "page title",
      languageOfInstruction: "section II and PDF pages 11-12",
      languageRequirement: "section V",
      deadlineSummary: "sections IV-VI",
      tuitionSummary: "section VII and PDF page 20",
      applicationFee: "section VI and PDF page 20",
      admissionsUrl: "registered official URL",
      cscaRequirement: "sections II, V-VI and PDF pages 11-12",
      campusHighlights: "section II and PDF pages 11-12",
    },
  }],
  programs,
  programIntakes: programs.map(program => ({
    programSlug: program.slug,
    intakeTerm: "Fall",
    intakeYear: 2026,
    openDate: "2025-10-14T16:00:00.000Z",
    deadlineDate: "2026-06-01T15:59:59.000Z",
    deadlineLabel: "June 1, 2026 (China Standard Time)",
    applicationRound: "2026 international undergraduate admission",
    status: "closed" as const,
    sourceUrl: PAGE_URL,
    sourceLabel: "Beijing Institute of Technology 2026 International Undergraduate Admissions",
    sourceSha256: PAGE_SHA,
    capturedAt: pageEvidence.fetchedAt,
    sourceFieldLineage: { openDate: "section IV", deadlineDate: "section VI" },
  })),
  scholarships: [],
};

const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`BIT candidate is invalid: ${validation.errors.join(" ")}`);
const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : value && typeof value === "object"
  ? `{${Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`
  : JSON.stringify(value);
const prohibitedPatterns = [/passport(?:Number)?/i, /personalEmail/i, /personalPhone/i, /cardNumber/i, /cvv/i, /passwordHash/i, /sessionToken/i];
if (prohibitedPatterns.some(pattern => pattern.test(canonical(candidate)))) throw new Error("The BIT candidate contains a prohibited-data marker.");

const stableMatchingSlugs = [
  "beijing-institute-of-technology-aerospace-engineering-english",
  "beijing-institute-of-technology-artificial-intelligence-english",
  "beijing-institute-of-technology-automation-english",
  "beijing-institute-of-technology-computer-science-and-technology-english",
  "beijing-institute-of-technology-electronic-science-and-technology-english",
  "beijing-institute-of-technology-international-economics-and-trade-english",
  "beijing-institute-of-technology-mechanical-engineering-english",
];
const legacyAliasesToArchive = [
  "beijing-institute-of-technology-aerospace-engineering",
  "beijing-institute-of-technology-artificial-intelligence",
  "beijing-institute-of-technology-communication-engineering",
  "beijing-institute-of-technology-computer-science-and-technology",
  "beijing-institute-of-technology-data-science-and-big-data-technology",
  "beijing-institute-of-technology-electronic-information-engineering",
  "beijing-institute-of-technology-energy-and-power-engineering",
  "beijing-institute-of-technology-mechanical-engineering",
  "beijing-institute-of-technology-software-engineering",
  "beijing-institute-of-technology-vehicle-engineering",
];
for (const slug of stableMatchingSlugs) if (!programs.some(program => program.slug === slug)) throw new Error(`Stable BIT slug is missing from the candidate: ${slug}`);
if (legacyAliasesToArchive.some(slug => programs.some(program => program.slug === slug))) throw new Error("A BIT archive alias overlaps the official application-route candidate.");

const review = {
  version: 1,
  status: "awaiting_user_approval",
  generatedAt: pageEvidence.fetchedAt,
  scope: { schoolSlug: "beijing-institute-of-technology", schoolCount: 1, applicationRouteCount: 21, programCount: 21, chineseCategoryCount: 8, chineseRussianZhuhaiCount: 5, englishProgramCount: 8, beijingProgramCount: 15, zhuhaiProgramCount: 6, intakeCount: 21 },
  officialEvidence: {
    undergraduateAdmissionsPage: { url: PAGE_URL, sha256: PAGE_SHA, fetchedAt: pageEvidence.fetchedAt, contentType: pageEvidence.contentType },
    admissionBook: { url: PDF_URL, sha256: PDF_SHA, fetchedAt: pdfEvidence.fetchedAt, contentType: pdfEvidence.contentType, pagesReviewed: [11, 12, 17, 20, 21], unchangedFromPriorScholarshipReview: true },
  },
  reviewItems: [
    { field: "catalog granularity", result: "21_application_routes", reason: "BIT states that Chinese students enter eight Beijing broad categories and choose a covered major after the first year. Those directions are therefore notes, not separate application records. Five bilingual Zhuhai directions and eight direct English programs remain separate routes." },
    { field: "CSCA", result: "explicit_by_route", reason: "The PDF publishes route-level requirements. Science and Materials retains the exact unresolved choice 'Physics or Chemistry' rather than selecting one subject." },
    { field: "campus", result: "15_beijing_6_zhuhai", reason: "The official tables explicitly separate campuses. The existing English Artificial Intelligence record moves from Beijing to Zhuhai." },
    { field: "existing Chinese records", result: "archive_10_major_direction_aliases", reason: "The ten existing Chinese major-level records are covered directions inside broad-category admission and are not direct 2026 application entries." },
    { field: "applicant data", result: "excluded", reason: "The candidate contains public catalog metadata only; no application materials, applicant records, or personal contacts are imported." },
  ],
  reconciliation: { actionAfterApproval: "upsert_official_2026_application_routes_and_archive_major_direction_aliases", stableMatchingSlugs, legacyAliasesToArchive, newProgramCount: 14, destructiveDeletion: false },
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle only", note: "No applicant, account, payment, private-file or personal-contact values are present. Raw official snapshots remain ignored and are not imported." },
  candidateBundleSha256: validation.bundleSha256,
  operationPlanSha256: validation.operationPlanSha256,
};

for (const [path, value] of [[candidatePath, candidate], [validationPath, validation], [reviewPath, review]] as const) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8" });
}
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, reviewPath, candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256, reviewSha256: createHash("sha256").update(JSON.stringify(review)).digest("hex"), summary: validation.summary, languageCounts, stableMatchingSlugs: stableMatchingSlugs.length, newProgramCount: 14, legacyAliasesToArchive: legacyAliasesToArchive.length }, null, 2));
