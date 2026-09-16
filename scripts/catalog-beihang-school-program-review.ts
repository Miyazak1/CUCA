import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const guideManifestPath = resolve(root, "work/catalog-official/2026-09-11T08-53-09-123Z/manifest.json");
const cscaManifestPath = resolve(root, "work/catalog-official/2026-09-11T08-53-18-862Z/manifest.json");
const campusManifestPath = resolve(root, "work/catalog-official/2026-09-11T08-55-42-633Z/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.beihang-school-program-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.beihang-school-program-batch-01.validation.json");
const reviewPath = resolve(root, "seeds/catalog.beihang-school-program-batch-01.review.json");

const GUIDE_ID = "beihang-undergraduate-admissions-2026";
const GUIDE_URL = "https://is.buaa.edu.cn/lxsq/bks1.htm";
const GUIDE_SHA = "e10c61e03f764a1f19215cc2803473f863e379ae31d6f0afed0b281959d81b56";
const CSCA_ID = "beihang-undergraduate-csca-requirements-2026";
const CSCA_URL = "https://is.buaa.edu.cn/2026nianbeijinghangkonghangtiandaxueguojixueshengbenkezhuanyeCSCAceshikemuyaoqiu.pdf";
const CSCA_SHA = "b308f3a2575b97e166fed5851f62443ea95bf3edd93cd448cf474d5d997cd72b";
const CAMPUS_ID = "beihang-zhongfa-aviation-institute-campus";
const CAMPUS_URL = "https://zfai.buaa.edu.cn/zjzf/xygl.htm";
const CAMPUS_SHA = "0be6fd37c1ea60fe99cd2619d624003e435f337d771bbc824172a0519d1c7fb3";
const APPLICATION_URL = "https://admission.buaa.edu.cn/";

const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const guideEvidence = (await parse(guideManifestPath)).sources?.[0];
const cscaEvidence = (await parse(cscaManifestPath)).sources?.[0];
const campusEvidence = (await parse(campusManifestPath)).sources?.[0];
for (const [evidence, id, sha, contentType] of [
  [guideEvidence, GUIDE_ID, GUIDE_SHA, "text/html"],
  [cscaEvidence, CSCA_ID, CSCA_SHA, "application/pdf"],
  [campusEvidence, CAMPUS_ID, CAMPUS_SHA, "text/html"],
] as const) {
  if (evidence?.id !== id || evidence?.sha256 !== sha || evidence?.status !== 200 || evidence?.contentType !== contentType) {
    throw new Error(`The refreshed official source does not match the reviewed snapshot: ${id}`);
  }
}

const STEM_CHINESE = ["Chinese (for Science Disciplines)", "Mathematics", "Physics"];
const STEM_CHEMISTRY = ["Chinese (for Science Disciplines)", "Mathematics", "Chemistry"];
const STEM_BIOMEDICAL = ["Chinese (for Science Disciplines)", "Mathematics", "Physics", "Chemistry"];
const HUMANITIES_CHINESE = ["Chinese (for Humanities Disciplines)", "Mathematics"];
const STEM_ENGLISH = ["Mathematics", "Physics"];
const BIOMEDICAL_ENGLISH = ["Mathematics", "Physics", "Chemistry"];

type Language = "Chinese" | "English" | "French";
type Row = {
  nameEn: string;
  nameZh: string;
  school: string;
  category: string;
  language: Language;
  subjects: string[];
  tuition?: number;
  slug?: string;
  citySlug?: "beijing" | "hangzhou";
  note?: string;
};
const rows: Row[] = [];
const add = (school: string, category: string, language: Language, subjects: string[], tuition: number | undefined, majors: Array<[string, string, Partial<Row>?]>) => {
  for (const [nameEn, nameZh, extra = {}] of majors) rows.push({ nameEn, nameZh, school, category, language, subjects, tuition, ...extra });
};

add("School of Materials Science and Engineering", "Materials Science", "Chinese", STEM_CHEMISTRY, 25000, [
  ["Materials Science and Engineering", "材料科学与工程"],
  ["Nanomaterials and Technology", "纳米材料与技术"],
]);
add("School of Electronic Information Engineering", "Electronic Engineering", "Chinese", STEM_CHINESE, 25000, [
  ["Electronic Information Engineering", "电子信息工程"],
  ["Communication Engineering", "通信工程"],
  ["Electronic Science and Technology", "电子科学与技术"],
]);
add("School of Automation Science and Electrical Engineering", "Automation", "Chinese", STEM_CHINESE, 25000, [
  ["Automation", "自动化"],
  ["Robot Engineering", "机器人工程", { slug: "beihang-university-robot-engineering" }],
]);
add("School of Energy and Power Engineering", "Energy and Power Engineering", "Chinese", STEM_CHINESE, 25000, [
  ["Energy and Power Engineering", "能源与动力工程"],
]);
add("School of Aeronautic Science and Engineering", "Aerospace Engineering", "Chinese", STEM_CHINESE, 25000, [
  ["Flight Vehicle Design and Engineering", "飞行器设计与工程"],
  ["Low-Altitude Technology and Engineering", "低空技术与工程"],
  ["Aircraft Environment and Life Support Engineering", "飞行器环境与生命保障工程"],
  ["Engineering Mechanics", "工程力学"],
  ["Aircraft Control and Information Engineering (Aeronautics)", "飞行器控制与信息工程（航空）", { slug: "beihang-university-aircraft-control-and-information-engineering-aeronautics" }],
]);
add("School of Computer Science and Engineering", "Computer Science", "Chinese", STEM_CHINESE, 25000, [
  ["Computer Science and Technology", "计算机科学与技术"],
  ["Virtual Reality Technology", "虚拟现实技术"],
]);
add("School of Mechanical Engineering and Automation", "Mechanical Engineering", "Chinese", STEM_CHINESE, 25000, [
  ["Mechanical Engineering", "机械工程"],
  ["Aircraft Manufacturing Engineering", "飞行器制造工程"],
  ["Micro-electromechanical Systems Engineering", "微机电系统工程"],
  ["Industrial Design", "工业设计"],
  ["Robot Engineering", "机器人工程", { slug: "beihang-university-robot-engineering-mechanical-engineering-and-automation" }],
  ["Intelligent Manufacturing Engineering", "智能制造工程"],
]);
add("School of Biological Science and Medical Engineering", "Biomedical Engineering", "Chinese", STEM_BIOMEDICAL, 30000, [
  ["Biomedical Engineering", "生物医学工程"],
]);
add("School of Transportation Science and Engineering", "Transportation Engineering", "Chinese", STEM_CHINESE, 25000, [
  ["Vehicle Engineering", "车辆工程"],
  ["Smart Transportation (Intelligent Transportation)", "智慧交通（智能交通）"],
  ["Smart Transportation (Intelligent Transportation Infrastructure)", "智慧交通（智能交通基础设施）"],
  ["Aircraft Airworthiness Technology", "飞行器适航技术"],
]);
add("School of Reliability and Systems Engineering", "Safety and Reliability Engineering", "Chinese", STEM_CHINESE, 25000, [
  ["Safety Engineering", "安全工程"],
  ["Quality and Reliability Engineering", "飞行器质量与可靠性"],
]);
add("School of Astronautics", "Aerospace Engineering", "Chinese", STEM_CHINESE, 25000, [
  ["Flight Vehicle Design and Engineering (Astronautics)", "飞行器设计与工程（航天）", { slug: "beihang-university-flight-vehicle-design-and-engineering-astronautics" }],
  ["Aircraft Power Engineering (Astronautics)", "飞行器动力工程（航天）"],
  ["Aircraft Control and Information Engineering", "飞行器控制与信息工程", { slug: "beihang-university-aircraft-control-and-information-engineering-astronautics" }],
  ["Intelligent Aircraft Technology", "智能飞行器技术"],
  ["Intelligent Electric Propulsion Technology of Flight Vehicle (Astronautics)", "空天智能电推进技术（航天）"],
]);
add("School of Instrumentation and Optoelectronic Engineering", "Instrumentation and Optoelectronics", "Chinese", STEM_CHINESE, 25000, [
  ["Optoelectronic Information Science and Engineering", "光电信息科学与工程"],
  ["Measurement and Control Technology and Instrument", "测控技术与仪器"],
]);
add("School of Software", "Software Engineering", "Chinese", STEM_CHINESE, 25000, [["Software Engineering", "软件工程"]]);
add("School of Integrated Circuit Science and Engineering", "Integrated Circuits", "Chinese", STEM_CHINESE, 25000, [["Microelectronics Science and Engineering", "微电子科学与工程"]]);
add("School of Physics", "Physics", "Chinese", STEM_CHINESE, 25000, [
  ["Applied Physics", "应用物理学"],
  ["Nuclear Physics", "核物理"],
  ["Physics", "物理学"],
]);
add("School of Chemistry", "Chemistry", "Chinese", STEM_CHEMISTRY, 25000, [["Applied Chemistry", "应用化学"]]);
add("School of Space and Earth Sciences", "Space and Earth Sciences", "Chinese", STEM_CHINESE, 25000, [
  ["Space Science and Technology", "空间科学与技术"],
  ["Applied Physics (Space Science)", "应用物理学（空间科学）", { slug: "beihang-university-applied-physics-space-science" }],
]);
add("School of Artificial Intelligence", "Artificial Intelligence", "Chinese", STEM_CHINESE, 25000, [["Artificial Intelligence", "人工智能"]]);
add("School of Economics and Management", "Economics and Management", "Chinese", HUMANITIES_CHINESE, 25000, [
  ["Engineering Management", "工程管理"],
  ["Information Management and Information System", "信息管理与信息系统"],
  ["Industrial Engineering", "工业工程"],
  ["Economic Statistics", "经济统计学"],
  ["Energy Economics", "能源经济"],
  ["Finance", "金融学"],
  ["International Economics and Trade", "国际经济与贸易"],
]);
add("School of Humanities and Social Sciences (School of Public Administration)", "Humanities and Social Sciences", "Chinese", HUMANITIES_CHINESE, 25000, [
  ["Economics", "经济学"],
  ["Administration Management", "行政管理"],
]);
add("School of Foreign Languages", "Languages", "Chinese", HUMANITIES_CHINESE, 25000, [["English", "英语"]]);
add("School of Law", "Law", "Chinese", HUMANITIES_CHINESE, 25000, [["Laws", "法学"]]);
add("School of New Media Art and Design", "Art and Design", "Chinese", HUMANITIES_CHINESE, 30000, [
  ["Visual Communication Design", "视觉传达设计", { note: "Art applicants must submit a painting portfolio as required by the official guide." }],
  ["Painting", "绘画", { note: "Art applicants must submit a painting portfolio as required by the official guide." }],
]);

const frenchCscaNote = "CSCA is required by the 2026 admission guide, but the official 2026 CSCA subject table does not publish a subject combination for this French-taught route.";
add("l'Ecole Centrale de Pekin / International Research Institute for Multidisciplinary Science", "General Engineering", "French", [], undefined, [
  ["Mathematics and Applied Mathematics (French)", "数学与应用数学（法语授课为主）", { note: frenchCscaNote }],
  ["Information and Computing Sciences (French)", "信息与计算科学（法语授课为主）", { note: frenchCscaNote }],
  ["Applied Physics (French)", "应用物理学（法语授课为主）", { note: frenchCscaNote }],
  ["Engineering Mechanics (French)", "工程力学（法语授课为主）", { note: frenchCscaNote }],
]);
add("Zhongfa Aviation Institute", "Aviation Engineering", "French", [], undefined, [
  ["Transport (French)", "交通运输（法语授课为主）", { citySlug: "hangzhou", note: frenchCscaNote }],
  ["Aircraft Airworthiness Technology (French)", "飞行器适航技术（法语授课为主）", { citySlug: "hangzhou", note: frenchCscaNote }],
  ["Measurement and Control Technology and Instrument (French)", "测控技术与仪器（法语授课为主）", { citySlug: "hangzhou", note: frenchCscaNote }],
  ["Electronic Information Engineering (French)", "电子信息工程（法语授课为主）", { citySlug: "hangzhou", note: frenchCscaNote }],
]);

add("School of Electronic Information Engineering", "Electronic Engineering", "English", [], 30000, [["Communication Engineering (English)", "通信工程（英文授课）", { note: "The current 2026 program catalog lists Communication Engineering, while the linked CSCA PDF instead lists Electronic Information Engineering. The CSCA combination is withheld pending university clarification." }]]);
add("School of Aeronautic Science and Engineering", "Aerospace Engineering", "English", STEM_ENGLISH, 30000, [
  ["Flight Vehicle Design and Engineering (English)", "飞行器设计与工程（英文授课）"],
  ["Low-Altitude Technology and Engineering (English)", "低空技术与工程（英文授课）"],
]);
add("School of Computer Science and Engineering", "Computer Science", "English", STEM_ENGLISH, 30000, [["Computer Science and Technology (English)", "计算机科学与技术（英文授课）"]]);
add("School of Mechanical Engineering and Automation", "Mechanical Engineering", "English", STEM_ENGLISH, 30000, [
  ["Mechanical Engineering (English)", "机械工程（英文授课）"],
  ["Robotics Engineering (English)", "机器人工程（英文授课）"],
]);
add("School of Reliability and Systems Engineering", "Safety and Reliability Engineering", "English", STEM_ENGLISH, 30000, [
  ["Safety Engineering (English)", "安全工程（英文授课）"],
  ["Quality and Reliability Engineering (English)", "飞行器质量与可靠性（英文授课）"],
]);
add("School of Artificial Intelligence", "Artificial Intelligence", "English", STEM_ENGLISH, 30000, [["Artificial Intelligence (English)", "人工智能（英文授课）"]]);
add("School of Biological Science and Medical Engineering", "Biomedical Engineering", "English", BIOMEDICAL_ENGLISH, 30000, [["Biomedical Engineering (English)", "生物医学工程（英文授课）"]]);
add("School of Economics and Management", "Economics and Management", "English", ["Mathematics"], 30000, [["International Economics and Trade (English)", "国际经济与贸易（英文授课）"]]);

if (rows.length !== 76) throw new Error(`Unexpected Beihang route count: ${rows.length}.`);
const counts = rows.reduce((result, item) => ({ ...result, [item.language]: (result[item.language] ?? 0) + 1 }), {} as Record<Language, number>);
if (counts.Chinese !== 57 || counts.French !== 8 || counts.English !== 11) throw new Error(`Unexpected Beihang language counts: ${JSON.stringify(counts)}.`);
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const programs: CatalogSeedProgram[] = rows.map((item, index) => {
  const slug = item.slug ?? `beihang-university-${slugify(item.nameEn)}`;
  const cscaRequirement = item.subjects.length
    ? `CSCA in ${item.language === "Chinese" ? "Chinese" : "English"}: ${item.subjects.join(", ")}`
    : item.language === "French"
      ? frenchCscaNote
      : "CSCA is required by the 2026 admission guide, but the current catalog and linked CSCA PDF conflict on this English-taught route; the subject combination is withheld pending university clarification.";
  return {
    slug,
    schoolSlug: "beihang-university",
    citySlug: item.citySlug ?? "beijing",
    nameEn: item.nameEn,
    nameZh: item.nameZh,
    degreeLevel: "Undergraduate",
    durationYears: 4,
    fieldCategory: item.category,
    subjectArea: item.school,
    teachingLanguage: item.language,
    cscaSubjects: item.subjects,
    cscaRequirement,
    ...(item.language === "Chinese" ? { hskRequirement: "HSK Level 5, score 180 or above" } : {}),
    ...(item.language === "English" ? { englishRequirement: "IELTS 6.0, TOEFL 90, or proof that all high-school courses were taught in English" } : {}),
    ...(item.tuition !== undefined ? {
      tuitionAmount: item.tuition,
      tuitionCurrency: "RMB",
      tuitionPeriod: "year",
      tuitionText: `RMB ${item.tuition.toLocaleString("en-US")}/year`,
    } : { tuitionText: "A separate tuition amount is not published for this French-taught route in the 2026 guide." }),
    applicationUrl: APPLICATION_URL,
    applicationNote: [item.school, item.note].filter(Boolean).join(". "),
    scholarshipText: "The 2026 guide lists Chinese Government, Beihang undergraduate, Beijing Government, and partner/self-funded scholarships; route-specific eligibility must be checked separately.",
    status: "draft",
    sourceUrl: GUIDE_URL,
    sourceLabel: "Beihang University 2026 International Undergraduate Admission Guide and Program Catalog",
    sourceSha256: GUIDE_SHA,
    capturedAt: guideEvidence.fetchedAt,
    sourceFieldLineage: {
      nameEn: `2026 program catalog route ${index + 1}`,
      nameZh: `2026 program catalog route ${index + 1}`,
      subjectArea: `2026 program catalog route ${index + 1}, School column`,
      teachingLanguage: `2026 program catalog route ${index + 1}, teaching-language section`,
      cscaSubjects: item.subjects.length ? `official CSCA PDF table, snapshot ${CSCA_SHA}` : item.language === "French" ? `not listed in official CSCA PDF snapshot ${CSCA_SHA}` : `source conflict between current program catalog and official CSCA PDF snapshot ${CSCA_SHA}`,
      durationYears: "2026 admission guide section IV",
      tuitionText: "2026 admission guide section IV",
      applicationUrl: "2026 admission guide section III",
      scholarshipText: "2026 admission guide section V",
      ...(item.citySlug === "hangzhou" ? { citySlug: `Zhongfa Aviation Institute campus profile, snapshot ${CAMPUS_SHA}` } : {}),
      ...(item.note ? { applicationNote: item.language === "French" ? `official catalog and omitted-CSCA review finding; campus profile ${CAMPUS_SHA}` : "2026 admission guide application-material note" } : {}),
    },
  };
});
if (new Set(programs.map(program => program.slug)).size !== programs.length) throw new Error("Generated Beihang program slugs are not unique.");

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: guideEvidence.fetchedAt,
  cities: [
    { slug: "beijing", nameEn: "Beijing", nameZh: "北京", region: "North China", province: "Beijing", status: "draft", sourceUrl: GUIDE_URL, sourceLabel: "Beihang 2026 undergraduate admission guide", sourceSha256: GUIDE_SHA, capturedAt: guideEvidence.fetchedAt, sourceFieldLineage: { nameEn: "contact address", province: "contact address" } },
    { slug: "hangzhou", nameEn: "Hangzhou", nameZh: "杭州", region: "East China", province: "Zhejiang", status: "draft", sourceUrl: CAMPUS_URL, sourceLabel: "Beihang Zhongfa Aviation Institute official campus profile", sourceSha256: CAMPUS_SHA, capturedAt: campusEvidence.fetchedAt, sourceFieldLineage: { nameEn: "institute location statement", province: "Hangzhou International Campus address" } },
  ],
  schools: [{
    slug: "beihang-university",
    nameEn: "Beihang University",
    nameZh: "北京航空航天大学",
    citySlug: "beijing",
    schoolType: "public",
    region: "North China",
    applicationLevel: "Undergraduate",
    languageOfInstruction: "Chinese, English, and French",
    languageRequirement: "Chinese-taught routes require HSK Level 5 score 180; English-taught routes require IELTS 6.0, TOEFL 90, or English-medium high-school proof. A separate French threshold is not published in this guide.",
    hskRequirement: "HSK Level 5, score 180 or above for Chinese-taught routes",
    englishRequirement: "IELTS 6.0, TOEFL 90, or proof that all high-school courses were taught in English",
    deadlineSummary: "Applications opened November 1, 2025 and close June 30, 2026; CSCA results must be submitted by May 30, 2026.",
    tuitionSummary: "RMB 25,000/year for Chinese-taught science, engineering, management, humanities and law routes; RMB 30,000/year for Chinese-taught biomedical/art routes and all English-taught routes. The guide does not state a separate French-route amount.",
    applicationFee: "RMB 400",
    websiteUrl: "https://is.buaa.edu.cn/",
    admissionsUrl: GUIDE_URL,
    cscaRequired: true,
    cscaRequirement: "All applicants must submit CSCA results by May 30, 2026. The official PDF has 68 route rows; 67 exactly match the current catalog. It omits the 8 French-taught routes and conflicts with the catalog on one English route.",
    cscaSubjects: [...new Set(rows.flatMap(item => item.subjects))],
    subjectTags: [...new Set(rows.map(item => item.category))],
    languageTags: ["Chinese-taught", "English-taught", "French-taught"],
    campusHighlights: ["76 routes in the current official 2026 undergraduate catalog", "57 Chinese, 11 English, and 8 French routes", "Beijing campuses and Zhongfa Aviation Institute routes in Hangzhou"],
    contactNotes: "International undergraduate admissions contact details are published on the official guide; use the official page for current contact information.",
    status: "draft",
    sourceUrl: GUIDE_URL,
    sourceLabel: "Beihang University 2026 International Undergraduate Admission Guide",
    sourceSha256: GUIDE_SHA,
    capturedAt: guideEvidence.fetchedAt,
    sourceFieldLineage: {
      nameEn: "official guide title",
      citySlug: "official guide contact address",
      applicationLevel: "official guide title",
      languageOfInstruction: "section VI program catalog",
      languageRequirement: "section I",
      deadlineSummary: "sections II-III",
      tuitionSummary: "section IV",
      applicationFee: "section III-IV",
      admissionsUrl: "registered official guide URL",
      cscaRequirement: `section III and official CSCA PDF snapshot ${CSCA_SHA}`,
      campusHighlights: `section VI program catalog and Zhongfa campus snapshot ${CAMPUS_SHA}`,
    },
  }],
  programs,
  programIntakes: programs.map(program => ({
    programSlug: program.slug,
    intakeTerm: "Fall",
    intakeYear: 2026,
    openDate: "2025-10-31T16:00:00.000Z",
    deadlineDate: "2026-06-30T15:59:59.000Z",
    deadlineLabel: "June 30, 2026 (China Standard Time)",
    applicationRound: "2026 international undergraduate admission",
    status: "closed" as const,
    sourceUrl: GUIDE_URL,
    sourceLabel: "Beihang University 2026 International Undergraduate Admission Guide",
    sourceSha256: GUIDE_SHA,
    capturedAt: guideEvidence.fetchedAt,
    sourceFieldLineage: { openDate: "section II", deadlineDate: "section II" },
  })),
  scholarships: [],
};

const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`Beihang candidate is invalid: ${validation.errors.join(" ")}`);
const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : value && typeof value === "object"
  ? `{${Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`
  : JSON.stringify(value);
const prohibitedPatterns = [/passport(?:Number)?/i, /personalEmail/i, /personalPhone/i, /cardNumber/i, /cvv/i, /passwordHash/i, /sessionToken/i];
if (prohibitedPatterns.some(pattern => pattern.test(canonical(candidate)))) throw new Error("The Beihang candidate contains a prohibited-data marker.");

const stableMatchingSlugs = [
  "beihang-university-aircraft-environment-and-life-support-engineering",
  "beihang-university-artificial-intelligence-english",
  "beihang-university-automation",
  "beihang-university-biomedical-engineering-english",
  "beihang-university-communication-engineering",
  "beihang-university-computer-science-and-technology-english",
  "beihang-university-electronic-information-engineering",
  "beihang-university-electronic-science-and-technology",
  "beihang-university-flight-vehicle-design-and-engineering",
  "beihang-university-flight-vehicle-design-and-engineering-english",
  "beihang-university-international-economics-and-trade-english",
  "beihang-university-low-altitude-technology-and-engineering",
  "beihang-university-materials-science-and-engineering",
  "beihang-university-mechanical-engineering-english",
  "beihang-university-nanomaterials-and-technology",
  "beihang-university-robot-engineering",
  "beihang-university-robotics-engineering-english",
];
for (const slug of stableMatchingSlugs) if (!programs.some(program => program.slug === slug)) throw new Error(`Stable Beihang slug is missing from the candidate: ${slug}`);

const review = {
  version: 1,
  status: "awaiting_user_approval",
  generatedAt: guideEvidence.fetchedAt,
  scope: { schoolSlug: "beihang-university", schoolCount: 1, programCount: 76, chineseProgramCount: 57, englishProgramCount: 11, frenchProgramCount: 8, beijingProgramCount: 72, hangzhouProgramCount: 4, intakeCount: 76 },
  officialEvidence: {
    admissionGuideAndCatalog: { url: GUIDE_URL, sha256: GUIDE_SHA, fetchedAt: guideEvidence.fetchedAt, contentType: guideEvidence.contentType },
    cscaSubjectTable: { url: CSCA_URL, sha256: CSCA_SHA, fetchedAt: cscaEvidence.fetchedAt, contentType: cscaEvidence.contentType, pagesReviewed: 8 },
    zhongfaCampusProfile: { url: CAMPUS_URL, sha256: CAMPUS_SHA, fetchedAt: campusEvidence.fetchedAt, contentType: campusEvidence.contentType },
  },
  reviewItems: [
    { field: "catalog granularity", result: "76_official_routes", reason: "Separate Chinese, English and French routes remain separate records. Duplicate major names offered by different schools remain separate application routes with distinct slugs." },
    { field: "teaching language", result: "57_chinese_11_english_8_french", reason: "The official guide publishes 65 routes in its Chinese-section table, of which 8 explicitly state French as the main teaching language, plus 11 English-taught routes." },
    { field: "CSCA", result: "67_exact_matches_9_withheld_one_pdf_only_conflict", reason: "The official eight-page CSCA table has 68 rows. Sixty-seven exactly match the current catalog; it omits the 8 French routes and substitutes English Electronic Information Engineering where the current catalog lists English Communication Engineering. The candidate does not infer the 9 unresolved combinations." },
    { field: "tuition", result: "68_route_amounts_published_8_withheld", reason: "The guide specifies Chinese and English fee bands but no separate French-route band. French route tuition amounts remain unpublished rather than inferred." },
    { field: "campus", result: "four_zhongfa_routes_hangzhou", reason: "The official Zhongfa Aviation Institute profile states that the institute is located at Beihang Hangzhou International Campus." },
    { field: "applicant data", result: "excluded", reason: "The candidate contains public catalog metadata only; no applicant-submitted documents or personal records are imported." },
  ],
  reconciliation: { actionAfterApproval: "upsert_current_official_2026_catalog_and_archive_conflicting_legacy_record", legacyAliasesToArchive: ["beihang-university-electronic-information-engineering-english"], destructiveDeletion: false, stableMatchingSlugs, newProgramCount: 59 },
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle only", note: "No applicant, account, payment, private-file or personal-contact values are present. Raw official snapshots remain ignored and are not imported." },
  candidateBundleSha256: validation.bundleSha256,
  operationPlanSha256: validation.operationPlanSha256,
};

for (const [path, value] of [[candidatePath, candidate], [validationPath, validation], [reviewPath, review]] as const) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8" });
}
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, reviewPath, candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256, reviewSha256: createHash("sha256").update(JSON.stringify(review)).digest("hex"), summary: validation.summary, counts, stableMatchingSlugs: stableMatchingSlugs.length, newProgramCount: 59, legacyAliasesToArchive: 1 }, null, 2));
