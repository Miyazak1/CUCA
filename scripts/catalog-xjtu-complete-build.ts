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
const mainManifestPath = resolve(root, "work/catalog-official/xjtu-complete-batch-01/manifest.json");
const supportManifestPath = resolve(root, "work/catalog-official/xjtu-undergraduate-supporting-01/manifest.json");
const identityPath = resolve(root, "seeds/catalog.school-identity-replacements-batch-01.draft.json");
const candidatePath = resolve(root, "seeds/catalog.xjtu-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.xjtu-complete-batch-01.validation.json");
const [mainManifestText, supportManifestText, identityText] = await Promise.all([
  readFile(mainManifestPath, "utf8"),
  readFile(supportManifestPath, "utf8"),
  readFile(identityPath, "utf8"),
]);
const mainManifest = JSON.parse(mainManifestText);
const supportManifest = JSON.parse(supportManifestText);
const identityBundle = JSON.parse(identityText);
type SourceRecord = { id: string; status: number; url: string; label: string; sha256: string; fetchedAt: string };
const sources = new Map<string, SourceRecord>([
  ...(mainManifest.sources as SourceRecord[]),
  ...(supportManifest.sources as SourceRecord[]),
].map((row) => [row.id, row]));
const expected = {
  "xjtu-undergraduate-guide-2026": "746ca59861829b899a623abfd565e9022c7221754740d202ce985620eeedb418",
  "xjtu-undergraduate-programs-2026": "936c805a0738099c2c020dd5ea7829b6697cc5d1d2da2be775c0d33e54bb7e80",
  "xjtu-graduate-guide-2026": "75887ad9154dd9cfbc5dce42b3e6cb311b9608f7dacb16f0d5513055bbc9ffd8",
  "xjtu-graduate-programs-2026": "e0681f1d568a86a3d51896985ea27121c5e0171c1387cc6c06f4767c79616c74",
  "xjtu-atomic-energy-scholarship-2026": "5d24ae58b770ddd57e50a586d7f97a12c6d5c2221361427ea402cefe521cf1db",
  "xjtu-direct-doctoral-scholarship-2026": "7c1b2ef9ec9bf035e9e2786ff7f0a784db3283a8ba348131a9a86a6e20069b18",
  "xjtu-chinese-language-program-2026": "332443ebc47ad9d8886d94621c9a06fe8fcf60167255fcff3ee01933c063230e",
  "xjtu-undergraduate-program-csca-table-2026": "460683227698ccbe508d70d80e42da876ee9db4adde773764a4fa3b109e82539",
  "xjtu-medical-undergraduate-guide-2026": "35543637d348c71e0e453ee2b5c24a7acc721b7f782f8c24ac11102cbef7c7ff",
} as const;
for (const [id, digest] of Object.entries(expected)) {
  const source = sources.get(id);
  if (!source || source.status !== 200 || source.sha256 !== digest) throw new Error(`XJTU evidence mismatch: ${id}`);
}

const guide = sources.get("xjtu-undergraduate-guide-2026")!;
const csca = sources.get("xjtu-undergraduate-program-csca-table-2026")!;
const medical = sources.get("xjtu-medical-undergraduate-guide-2026")!;
const graduate = sources.get("xjtu-graduate-guide-2026")!;
const atomic = sources.get("xjtu-atomic-energy-scholarship-2026")!;
const directDoctoral = sources.get("xjtu-direct-doctoral-scholarship-2026")!;
const schoolSlug = "xi-an-jiaotong-university";
const citySlug = "xian";
const city = identityBundle.cities.find((row: { slug: string }) => row.slug === citySlug);
const school = identityBundle.schools.find((row: { slug: string }) => row.slug === schoolSlug);
if (!city || !school) throw new Error("XJTU identity dependencies are missing.");

type TuitionBand = "science" | "humanities" | "arts" | "english" | "mbbs";
type ProgramSpec = {
  suffix: string;
  nameEn: string;
  nameZh: string;
  school: string;
  category: string;
  language: "Chinese" | "English";
  duration?: number;
  degree: string;
  tuition: TuitionBand;
  cscaSubjects: string[];
};
const specs: ProgramSpec[] = [
  { suffix: "materials-science-and-engineering", nameEn: "Materials Science and Engineering", nameZh: "材料科学与工程", school: "School of Materials Science and Engineering", category: "Materials Science and Engineering", language: "Chinese", degree: "Bachelor of Engineering", tuition: "science", cscaSubjects: ["STEM Chinese", "Mathematics", "Chemistry"] },
  { suffix: "materials-science-and-engineering-english", nameEn: "Materials Science and Engineering (English)", nameZh: "材料科学与工程（英文授课）", school: "School of Materials Science and Engineering", category: "Materials Science and Engineering", language: "English", degree: "Bachelor of Engineering", tuition: "english", cscaSubjects: ["Mathematics", "Chemistry"] },
  { suffix: "electrical-engineering-and-automation", nameEn: "Electrical Engineering and Automation", nameZh: "电气工程及其自动化", school: "School of Electrical Engineering", category: "Electrical Engineering", language: "Chinese", degree: "Bachelor of Engineering", tuition: "science", cscaSubjects: ["STEM Chinese", "Mathematics", "Physics"] },
  { suffix: "electrical-engineering-and-automation-english", nameEn: "Electrical Engineering and Automation (English)", nameZh: "电气工程及其自动化（英文授课）", school: "School of Electrical Engineering", category: "Electrical Engineering", language: "English", degree: "Bachelor of Engineering", tuition: "english", cscaSubjects: ["Mathematics", "Physics"] },
  { suffix: "energy-internet-engineering", nameEn: "Energy Internet Engineering", nameZh: "能源互联网工程", school: "School of Electrical Engineering", category: "Energy Engineering", language: "Chinese", degree: "Bachelor of Engineering", tuition: "science", cscaSubjects: ["STEM Chinese", "Mathematics", "Physics"] },
  { suffix: "computer-science-and-technology", nameEn: "Computer Science and Technology", nameZh: "计算机科学与技术", school: "School of Computer Science and Technology", category: "Computer Science", language: "Chinese", degree: "Bachelor of Engineering", tuition: "science", cscaSubjects: ["STEM Chinese", "Mathematics", "Physics"] },
  { suffix: "electronic-science-and-technology", nameEn: "Electronic Science and Technology", nameZh: "电子科学与技术", school: "School of Electronic Science and Engineering", category: "Electronic Engineering", language: "Chinese", degree: "Bachelor of Engineering", tuition: "science", cscaSubjects: ["STEM Chinese", "Mathematics", "Physics"] },
  { suffix: "software-engineering", nameEn: "Software Engineering", nameZh: "软件工程", school: "School of Software Engineering", category: "Software Engineering", language: "Chinese", degree: "Bachelor of Engineering", tuition: "science", cscaSubjects: ["STEM Chinese", "Mathematics", "Physics"] },
  { suffix: "law", nameEn: "Law", nameZh: "法学", school: "School of Law", category: "Law", language: "Chinese", degree: "Bachelor of Law", tuition: "humanities", cscaSubjects: ["Humanities Chinese", "Mathematics"] },
  { suffix: "public-administration", nameEn: "Public Administration", nameZh: "行政管理", school: "School of Public Policy and Administration", category: "Public Administration", language: "Chinese", degree: "Bachelor of Management", tuition: "humanities", cscaSubjects: ["Humanities Chinese", "Mathematics"] },
  { suffix: "big-data-management-and-application", nameEn: "Big Data Management and Application", nameZh: "大数据管理与应用", school: "School of Management", category: "Business Administration", language: "Chinese", degree: "Bachelor of Management", tuition: "humanities", cscaSubjects: ["STEM Chinese", "Mathematics"] },
  { suffix: "business-administration", nameEn: "Business Administration", nameZh: "工商管理", school: "School of Management", category: "Business Administration", language: "Chinese", degree: "Bachelor of Management", tuition: "humanities", cscaSubjects: ["STEM Chinese", "Mathematics"] },
  { suffix: "chinese-language-business-chinese", nameEn: "Chinese Language (Business Chinese)", nameZh: "汉语言（商务汉语）", school: "School of International Education", category: "Chinese Language", language: "Chinese", degree: "Bachelor of Arts", tuition: "humanities", cscaSubjects: ["Humanities Chinese", "Mathematics"] },
  { suffix: "chemistry", nameEn: "Chemistry", nameZh: "化学", school: "School of Chemistry", category: "Chemistry", language: "Chinese", degree: "Bachelor of Science", tuition: "science", cscaSubjects: ["STEM Chinese", "Mathematics", "Chemistry"] },
  { suffix: "applied-chemistry", nameEn: "Applied Chemistry", nameZh: "应用化学", school: "School of Chemistry", category: "Chemistry", language: "Chinese", degree: "Bachelor of Science", tuition: "science", cscaSubjects: ["STEM Chinese", "Mathematics", "Chemistry"] },
  { suffix: "mechanical-engineering", nameEn: "Mechanical Engineering", nameZh: "机械工程", school: "School of Mechanical Engineering", category: "Mechanical Engineering", language: "Chinese", degree: "Bachelor of Engineering", tuition: "science", cscaSubjects: ["STEM Chinese", "Mathematics", "Physics"] },
  { suffix: "intelligent-manufacturing-engineering-english", nameEn: "Intelligent Manufacturing Engineering (English)", nameZh: "智能制造工程（英文授课）", school: "School of Mechanical Engineering", category: "Mechanical Engineering", language: "English", degree: "Bachelor of Engineering", tuition: "english", cscaSubjects: ["Mathematics", "Physics"] },
  { suffix: "international-economics-and-trade", nameEn: "International Economics and Trade", nameZh: "国际经济与贸易（国际班）", school: "School of Economics and Finance", category: "International Trade", language: "Chinese", degree: "Bachelor of Economics", tuition: "humanities", cscaSubjects: ["Humanities Chinese or STEM Chinese", "Mathematics"] },
  { suffix: "trade-economics", nameEn: "Trade Economics", nameZh: "贸易经济", school: "School of Economics and Finance", category: "Economics", language: "Chinese", degree: "Bachelor of Economics", tuition: "humanities", cscaSubjects: ["Humanities Chinese or STEM Chinese", "Mathematics"] },
  { suffix: "electronic-business", nameEn: "Electronic Business", nameZh: "电子商务", school: "School of Economics and Finance", category: "E-Commerce", language: "Chinese", degree: "Bachelor of Economics", tuition: "humanities", cscaSubjects: ["Humanities Chinese or STEM Chinese", "Mathematics"] },
  { suffix: "economics", nameEn: "Economics", nameZh: "经济学", school: "School of Economics and Finance", category: "Economics", language: "Chinese", degree: "Bachelor of Economics", tuition: "humanities", cscaSubjects: ["Humanities Chinese or STEM Chinese", "Mathematics"] },
  { suffix: "finance", nameEn: "Finance", nameZh: "金融学", school: "School of Economics and Finance", category: "Finance", language: "Chinese", degree: "Bachelor of Economics", tuition: "humanities", cscaSubjects: ["Humanities Chinese or STEM Chinese", "Mathematics"] },
  { suffix: "public-finance", nameEn: "Public Finance", nameZh: "财政学", school: "School of Economics and Finance", category: "Public Finance", language: "Chinese", degree: "Bachelor of Economics", tuition: "humanities", cscaSubjects: ["Humanities Chinese or STEM Chinese", "Mathematics"] },
  { suffix: "new-energy-science-and-engineering", nameEn: "New Energy Science and Engineering", nameZh: "新能源科学与工程", school: "School of Energy and Power Engineering", category: "Energy Engineering", language: "Chinese", degree: "Bachelor of Engineering", tuition: "science", cscaSubjects: ["STEM Chinese", "Mathematics", "Physics"] },
  { suffix: "energy-and-power-engineering", nameEn: "Energy and Power Engineering", nameZh: "能源与动力工程", school: "School of Energy and Power Engineering", category: "Energy Engineering", language: "Chinese", degree: "Bachelor of Engineering", tuition: "science", cscaSubjects: ["STEM Chinese", "Mathematics", "Physics"] },
  { suffix: "energy-and-power-engineering-english", nameEn: "Energy and Power Engineering (English)", nameZh: "能源与动力工程（英文授课）", school: "School of Energy and Power Engineering", category: "Energy Engineering", language: "English", degree: "Bachelor of Engineering", tuition: "english", cscaSubjects: ["Mathematics", "Physics"] },
  { suffix: "environmental-engineering", nameEn: "Environmental Engineering", nameZh: "环境工程", school: "School of Energy and Power Engineering", category: "Environmental Engineering", language: "Chinese", degree: "Bachelor of Engineering", tuition: "science", cscaSubjects: ["STEM Chinese", "Mathematics", "Physics"] },
  { suffix: "nuclear-engineering-and-technology", nameEn: "Nuclear Engineering and Technology", nameZh: "核工程与核技术", school: "School of Energy and Power Engineering", category: "Nuclear Engineering", language: "Chinese", degree: "Bachelor of Engineering", tuition: "science", cscaSubjects: ["STEM Chinese", "Mathematics", "Physics"] },
  { suffix: "energy-storage-science-and-engineering", nameEn: "Energy Storage Science and Engineering", nameZh: "储能科学与工程", school: "School of Energy and Power Engineering", category: "Energy Engineering", language: "Chinese", degree: "Bachelor of Engineering", tuition: "science", cscaSubjects: ["STEM Chinese", "Mathematics", "Physics"] },
  { suffix: "human-settlements-big-data-and-smart-city", nameEn: "Science and Technology of Human Settlements (Big Data and Smart City)", nameZh: "人居环境科学与技术（大数据与智慧城市方向）", school: "School of Human Settlements and Civil Engineering", category: "Human Settlements", language: "Chinese", degree: "Bachelor of Engineering", tuition: "science", cscaSubjects: ["STEM Chinese", "Mathematics", "Physics"] },
  { suffix: "human-settlements-structure-and-geotechnique-engineering", nameEn: "Science and Technology of Human Settlements (Structure and Geotechnique Engineering)", nameZh: "人居环境科学与技术（结构与岩土工程方向）", school: "School of Human Settlements and Civil Engineering", category: "Civil Engineering", language: "Chinese", degree: "Bachelor of Engineering", tuition: "science", cscaSubjects: ["STEM Chinese", "Mathematics", "Physics"] },
  { suffix: "human-settlements-built-environment-and-energy", nameEn: "Science and Technology of Human Settlements (Built Environment and Energy)", nameZh: "人居环境科学与技术（建筑环境与节能方向）", school: "School of Human Settlements and Civil Engineering", category: "Built Environment", language: "Chinese", degree: "Bachelor of Engineering", tuition: "science", cscaSubjects: ["STEM Chinese", "Mathematics", "Physics"] },
  { suffix: "human-settlements-earth-and-environment-sciences", nameEn: "Science and Technology of Human Settlements (Earth and Environment Sciences)", nameZh: "人居环境科学与技术（地球环境科学方向）", school: "School of Human Settlements and Civil Engineering", category: "Environmental Science", language: "Chinese", degree: "Bachelor of Engineering", tuition: "science", cscaSubjects: ["STEM Chinese", "Mathematics", "Chemistry"] },
  { suffix: "philosophy", nameEn: "Philosophy", nameZh: "哲学", school: "School of Humanities and Social Science", category: "Philosophy", language: "Chinese", degree: "Bachelor of Philosophy", tuition: "humanities", cscaSubjects: ["Humanities Chinese", "Mathematics"] },
  { suffix: "sociology", nameEn: "Sociology", nameZh: "社会学", school: "School of Humanities and Social Science", category: "Sociology", language: "Chinese", degree: "Bachelor of Law", tuition: "humanities", cscaSubjects: ["Humanities Chinese", "Mathematics"] },
  { suffix: "chinese-language-and-literature", nameEn: "Chinese Language and Literature", nameZh: "汉语言文学", school: "School of Humanities and Social Science", category: "Chinese Language and Literature", language: "Chinese", degree: "Bachelor of Arts", tuition: "humanities", cscaSubjects: ["Humanities Chinese", "Mathematics"] },
  { suffix: "environmental-design", nameEn: "Environmental Design", nameZh: "环境设计", school: "School of Humanities and Social Science", category: "Design", language: "Chinese", degree: "Bachelor of Fine Arts", tuition: "arts", cscaSubjects: ["Humanities Chinese", "Mathematics"] },
  { suffix: "calligraphy", nameEn: "Calligraphy", nameZh: "书法学", school: "School of Humanities and Social Science", category: "Fine Arts", language: "Chinese", degree: "Bachelor of Fine Arts", tuition: "arts", cscaSubjects: ["Humanities Chinese", "Mathematics"] },
  { suffix: "biomedical-engineering", nameEn: "Biomedical Engineering", nameZh: "生物医学工程", school: "School of Life Science and Technology", category: "Biomedical Engineering", language: "Chinese", degree: "Bachelor of Engineering", tuition: "science", cscaSubjects: ["STEM Chinese", "Mathematics", "Chemistry"] },
  { suffix: "biotechnology", nameEn: "Biotechnology", nameZh: "生物技术", school: "School of Life Science and Technology", category: "Biotechnology", language: "Chinese", degree: "Bachelor of Science", tuition: "science", cscaSubjects: ["STEM Chinese", "Mathematics", "Chemistry"] },
  { suffix: "english", nameEn: "English", nameZh: "英语", school: "School of Foreign Studies", category: "Foreign Languages", language: "Chinese", degree: "Bachelor of Arts", tuition: "humanities", cscaSubjects: ["Humanities Chinese", "Mathematics"] },
  { suffix: "japanese", nameEn: "Japanese", nameZh: "日语", school: "School of Foreign Studies", category: "Foreign Languages", language: "Chinese", degree: "Bachelor of Arts", tuition: "humanities", cscaSubjects: ["Humanities Chinese", "Mathematics"] },
  { suffix: "french", nameEn: "French", nameZh: "法语", school: "School of Foreign Studies", category: "Foreign Languages", language: "Chinese", degree: "Bachelor of Arts", tuition: "humanities", cscaSubjects: ["Humanities Chinese", "Mathematics"] },
  { suffix: "network-and-new-media", nameEn: "Network and New Media", nameZh: "网络与新媒体", school: "School of Journalism and New Media", category: "Journalism and New Media", language: "Chinese", degree: "Bachelor of Arts", tuition: "humanities", cscaSubjects: ["Humanities Chinese", "Mathematics"] },
  { suffix: "clinical-medicine-mbbs-english", nameEn: "Clinical Medicine MBBS (English)", nameZh: "临床医学 MBBS（英文授课）", school: "Health Science Center", category: "Clinical Medicine", language: "English", duration: 6, degree: "Bachelor of Medicine and Bachelor of Surgery", tuition: "mbbs", cscaSubjects: ["Mathematics", "Chemistry"] },
  { suffix: "chemical-engineering-and-technology", nameEn: "Chemical Engineering and Technology", nameZh: "化学工程与工艺", school: "School of Chemical Engineering and Technology", category: "Chemical Engineering", language: "Chinese", degree: "Bachelor of Engineering", tuition: "science", cscaSubjects: ["STEM Chinese", "Mathematics", "Chemistry"] },
  { suffix: "process-equipment-and-control-engineering", nameEn: "Process Equipment and Control Engineering", nameZh: "过程装备与控制工程", school: "School of Chemical Engineering and Technology", category: "Chemical Engineering", language: "Chinese", degree: "Bachelor of Engineering", tuition: "science", cscaSubjects: ["STEM Chinese", "Mathematics", "Chemistry"] },
  { suffix: "measurement-and-control-technology-and-instrument", nameEn: "Measurement and Control Technology and Instrument", nameZh: "测控技术与仪器", school: "School of Instrument Science and Technology", category: "Instrumentation", language: "Chinese", degree: "Bachelor of Engineering", tuition: "science", cscaSubjects: ["STEM Chinese", "Mathematics", "Physics"] },
  { suffix: "measurement-and-control-technology-and-instrument-intelligent-sensing", nameEn: "Measurement and Control Technology and Instrument (Intelligent Sensing Engineering)", nameZh: "测控技术与仪器（智能感知工程方向）", school: "School of Instrument Science and Technology", category: "Instrumentation", language: "Chinese", degree: "Bachelor of Engineering", tuition: "science", cscaSubjects: ["STEM Chinese", "Mathematics", "Physics"] },
];

const tuitionByBand: Record<TuitionBand, number> = { science: 22000, humanities: 20000, arts: 40000, english: 180000, mbbs: 40000 };
const programs: CatalogSeedProgram[] = specs.map((spec) => {
  const source = spec.tuition === "mbbs" ? medical : csca;
  const tuitionAmount = tuitionByBand[spec.tuition];
  return {
    slug: `${schoolSlug}-${spec.suffix}`,
    schoolSlug,
    citySlug,
    nameEn: spec.nameEn,
    nameZh: spec.nameZh,
    degreeLevel: "Undergraduate",
    durationYears: spec.duration ?? 4,
    fieldCategory: spec.category,
    subjectArea: spec.school,
    teachingLanguage: spec.language,
    cscaSubjects: spec.cscaSubjects,
    cscaRequirement: `Submit CSCA results for ${spec.cscaSubjects.join(", ")}.`,
    hskRequirement: spec.language === "Chinese" ? "HSK Level 4 or equivalent. Some named Chinese-language routes may exempt the CSCA Chinese subject with a valid HSK Level 4 report." : undefined,
    englishRequirement: spec.language === "English" ? (spec.tuition === "mbbs" ? "Submit accepted English proficiency evidence such as TOEFL, IELTS or Duolingo; the reviewed MBBS guide does not publish one universal numeric threshold." : "IELTS 6.0, TOEFL 80 or another English certificate accepted by XJTU.") : undefined,
    tuitionAmount,
    tuitionCurrency: "CNY",
    tuitionPeriod: "year",
    tuitionText: `CNY ${tuitionAmount.toLocaleString("en-US")}/academic year`,
    applicationUrl: spec.tuition === "mbbs" ? medical.url : guide.url,
    applicationNote: "Fall 2026 international undergraduate route. The published application window is closed; no 2027 intake is inferred.",
    hasScholarship: spec.tuition !== "mbbs",
    scholarshipText: spec.tuition !== "mbbs" ? "The official 2026 guide lists university and local-government scholarship routes for admitted non-medical undergraduates." : undefined,
    status: "draft",
    sourceUrl: source.url,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    sourceFieldLineage: {
      nameZh: "official 2026 undergraduate program and CSCA table",
      nameEn: "official 2026 undergraduate program and CSCA table",
      degreeLevel: "official 2026 undergraduate catalog title",
      durationYears: spec.tuition === "mbbs" ? "official 2026 medical guide page 4" : "official 2026 undergraduate program and CSCA table",
      teachingLanguage: "official 2026 undergraduate program and CSCA table",
      cscaSubjects: "official 2026 undergraduate program and CSCA table",
      cscaRequirement: "official 2026 undergraduate program and CSCA table",
      ...(spec.language === "Chinese" ? { hskRequirement: "official 2026 non-medical undergraduate guide page 2" } : { englishRequirement: spec.tuition === "mbbs" ? "official 2026 medical guide page 5" : "official 2026 non-medical undergraduate guide page 2" }),
      tuitionAmount: spec.tuition === "mbbs" ? "official 2026 medical guide page 4" : "official 2026 non-medical undergraduate guide page 2",
      applicationUrl: spec.tuition === "mbbs" ? "registered official 2026 medical guide" : "registered official 2026 non-medical undergraduate guide",
    },
  };
});

const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2026,
  openDate: "2025-10-31T16:00:00.000Z",
  deadlineDate: "2026-06-30T15:59:59.000Z",
  deadlineLabel: "June 30, 2026",
  applicationRound: "2026 international undergraduate admission",
  status: "closed" as const,
  sourceUrl: program.slug.endsWith("clinical-medicine-mbbs-english") ? medical.url : guide.url,
  sourceLabel: program.slug.endsWith("clinical-medicine-mbbs-english") ? medical.label : guide.label,
  sourceSha256: program.slug.endsWith("clinical-medicine-mbbs-english") ? medical.sha256 : guide.sha256,
  capturedAt: program.slug.endsWith("clinical-medicine-mbbs-english") ? medical.fetchedAt : guide.fetchedAt,
  sourceFieldLineage: {
    openDate: "official 2026 application-time section",
    deadlineDate: "official 2026 application-time section",
    intakeYear: "official September 2026 registration section",
  },
}));

const scholarshipBase = {
  schoolSlug,
  providerLocation: "Xi'an, Shaanxi, China",
  targetCountries: [] as string[],
  targetRegions: [] as string[],
  status: "draft" as const,
};
const scholarships: CatalogSeedScholarship[] = [
  {
    ...scholarshipBase,
    slug: "xjtu-international-undergraduate-freshman-scholarship-2026",
    title: "XJTU International Undergraduate Freshman Scholarship 2026",
    nameZh: "西安交通大学国际本科新生奖学金 2026",
    type: "university",
    typeLabel: "University freshman scholarship",
    providerName: "西安交通大学",
    providerNameEn: "Xi'an Jiaotong University",
    fundingLevel: "Partial to full tuition waiver",
    coverage: "First-year tuition waiver at 100%, 75%, 50%, 25% or 10%, subject to the university's award decision.",
    amountText: "Five first-year tuition-waiver levels: 100%, 75%, 50%, 25% and 10%.",
    applicableDegree: "Undergraduate",
    applicableProgram: "Non-medical undergraduate programs",
    requirementText: "Apply for and be admitted to a non-medical undergraduate program at XJTU.",
    benefitItems: [{ label: "First-year tuition waiver", included: true, note: "100%, 75%, 50%, 25% or 10%" }],
    actionLinks: [{ label: guide.label, url: guide.url, kind: "official-source" }],
    summary: "First-year tuition-waiver scholarship for admitted non-medical international undergraduates.",
    sourceUrl: guide.url,
    sourceLabel: guide.label,
    sourceSha256: guide.sha256,
    capturedAt: guide.fetchedAt,
    sourceFieldLineage: { title: "official guide page 2 scholarship section", fundingLevel: "official guide page 2 scholarship section", coverage: "official guide page 2 scholarship section", applicableProgram: "official guide page 2 scholarship section" },
  },
  {
    ...scholarshipBase,
    slug: "xi-an-jiaotong-university",
    title: "Xi'an City Government Belt and Road International Student Scholarship at XJTU",
    nameZh: "西安交通大学西安市政府“一带一路”外国留学生奖学金",
    type: "government",
    typeLabel: "Municipal government scholarship",
    providerName: "西安市政府 / 西安交通大学",
    providerNameEn: "Xi'an City Government / Xi'an Jiaotong University",
    fundingLevel: "First-year scholarship",
    coverage: "Applies to the first year of the degree program. The reviewed XJTU guides do not publish an exact amount.",
    amountText: "Exact amount is not published in the reviewed XJTU guides.",
    applicableDegree: "Undergraduate, Master and Doctoral",
    applicableProgram: "Eligible XJTU degree programs",
    requirementText: "Submit through the XJTU International Student Application System and meet the selected program's admission requirements.",
    benefitItems: [],
    actionLinks: [{ label: guide.label, url: guide.url, kind: "official-source" }, { label: graduate.label, url: graduate.url, kind: "official-source" }],
    summary: "First-year municipal scholarship route listed in XJTU's 2026 undergraduate and graduate guides.",
    sourceUrl: guide.url,
    sourceLabel: guide.label,
    sourceSha256: guide.sha256,
    capturedAt: guide.fetchedAt,
    sourceFieldLineage: { title: "official 2026 guide scholarship section", fundingLevel: "official 2026 guide scholarship section", applicableDegree: `undergraduate guide plus graduate guide ${graduate.sha256}`, requirementText: "official application-system instruction" },
  },
  {
    ...scholarshipBase,
    slug: "xi-an-jiaotong-university-70",
    title: "Chinese Government Scholarship at XJTU 2026",
    nameZh: "西安交通大学中国政府奖学金 2026",
    type: "government",
    typeLabel: "Chinese Government Scholarship",
    providerName: "中国政府 / 西安交通大学",
    providerNameEn: "Chinese Government / Xi'an Jiaotong University",
    fundingLevel: "Full scholarship",
    coverage: "Tuition waiver, free on-campus accommodation, monthly living allowance and comprehensive medical insurance for international students in China.",
    amountText: "The reviewed general graduate guide does not itemize the monthly allowance amount.",
    applicableDegree: "Master and Doctoral",
    applicableProgram: "Eligible 2026 international graduate programs",
    requirementText: "Meet the published graduate eligibility and language requirements and complete both the CSC and XJTU application steps.",
    deadlineDate: "2026-03-31",
    deadlineLabel: "March 31, 2026 at 17:00 Beijing time",
    applicationRound: "2026 international graduate admission",
    benefitItems: [{ label: "Tuition", included: true }, { label: "On-campus accommodation", included: true }, { label: "Living allowance", included: true }, { label: "Medical insurance", included: true }],
    actionLinks: [{ label: graduate.label, url: graduate.url, kind: "official-source" }],
    summary: "Closed 2026 full Chinese Government Scholarship route for eligible XJTU graduate programs.",
    sourceUrl: graduate.url,
    sourceLabel: graduate.label,
    sourceSha256: graduate.sha256,
    capturedAt: graduate.fetchedAt,
    sourceFieldLineage: { title: "official graduate guide scholarship section", fundingLevel: "official graduate guide page 4", coverage: "official graduate guide page 4", deadlineDate: "official graduate guide page 2" },
  },
  {
    ...scholarshipBase,
    slug: "xjtu-international-postgraduate-freshman-scholarship-2026",
    title: "XJTU International Freshman Scholarship for Postgraduate Programs 2026",
    nameZh: "西安交通大学国际研究生新生奖学金 2026",
    type: "university",
    typeLabel: "University freshman scholarship",
    providerName: "西安交通大学",
    providerNameEn: "Xi'an Jiaotong University",
    fundingLevel: "First-year scholarship",
    coverage: "Applies to the first year of the postgraduate degree program. The reviewed guide does not publish an exact amount.",
    amountText: "Exact amount is not published in the reviewed guide.",
    applicableDegree: "Master and Doctoral",
    applicableProgram: "Eligible XJTU postgraduate programs",
    requirementText: "Submit through the XJTU International Student Application System and meet the selected program's requirements.",
    deadlineDate: "2026-03-31",
    deadlineLabel: "March 31, 2026 at 17:00 Beijing time",
    applicationRound: "2026 international graduate admission",
    benefitItems: [],
    actionLinks: [{ label: graduate.label, url: graduate.url, kind: "official-source" }],
    summary: "Closed first-year university scholarship route for 2026 postgraduate applicants.",
    sourceUrl: graduate.url,
    sourceLabel: graduate.label,
    sourceSha256: graduate.sha256,
    capturedAt: graduate.fetchedAt,
    sourceFieldLineage: { title: "official graduate guide page 4", fundingLevel: "official graduate guide page 4", deadlineDate: "official graduate guide page 2" },
  },
  {
    ...scholarshipBase,
    slug: "xjtu-atomic-energy-scholarship-2026",
    title: "Atomic Energy Scholarship Program of China at XJTU 2026",
    nameZh: "西安交通大学中国原子能奖学金项目 2026",
    type: "government",
    typeLabel: "Chinese Government Scholarship special program",
    providerName: "中国政府 / 西安交通大学",
    providerNameEn: "Chinese Government / Xi'an Jiaotong University",
    fundingLevel: "Full scholarship",
    coverage: "Tuition, accommodation, monthly stipend of CNY 3,000 for master's students or CNY 3,500 for doctoral students, and comprehensive medical insurance in China.",
    amountText: "CNY 3,000/month for master's students or CNY 3,500/month for doctoral students, plus tuition, accommodation and medical insurance.",
    applicableDegree: "Master and Doctoral",
    applicableProgram: "Nuclear Science and Technology related programs",
    requirementText: "Applicants from outside China must meet the published academic, age and language requirements for the nuclear-energy route.",
    deadlineDate: "2026-05-15",
    deadlineLabel: "May 15, 2026",
    applicationRound: "2026 Atomic Energy Scholarship",
    benefitItems: [{ label: "Tuition", included: true }, { label: "Accommodation", included: true }, { label: "Monthly stipend", included: true, note: "CNY 3,000 master; CNY 3,500 doctoral" }, { label: "Medical insurance", included: true }],
    actionLinks: [{ label: atomic.label, url: atomic.url, kind: "official-source" }],
    summary: "Closed 2026 full scholarship for eligible nuclear science and technology master's and doctoral applicants.",
    sourceUrl: atomic.url,
    sourceLabel: atomic.label,
    sourceSha256: atomic.sha256,
    capturedAt: atomic.fetchedAt,
    sourceFieldLineage: { title: "official scholarship brochure title", fundingLevel: "official scholarship brochure page 2", coverage: "official scholarship brochure page 2", applicableProgram: "official scholarship brochure program table", deadlineDate: "official scholarship brochure page 2" },
  },
  {
    ...scholarshipBase,
    slug: "xjtu-direct-doctoral-program-scholarship-2026",
    title: "XJTU Direct Doctoral Program for Outstanding International Undergraduates 2026",
    nameZh: "西安交通大学优秀国际本科生直博项目 2026",
    type: "government",
    typeLabel: "Chinese Government Scholarship direct doctoral program",
    providerName: "中国政府 / 西安交通大学",
    providerNameEn: "Chinese Government / Xi'an Jiaotong University",
    fundingLevel: "Full scholarship",
    coverage: "CSC full scholarship. The reviewed brochure does not itemize the benefit amounts.",
    amountText: "Exact benefit amounts are not itemized in the reviewed brochure.",
    applicableDegree: "Doctoral",
    applicableProgram: "Published direct doctoral subjects for outstanding international undergraduate graduates",
    requirementText: "Bachelor's degree holders from qualifying universities must meet the published academic and language requirements.",
    deadlineDate: "2026-04-15",
    deadlineLabel: "April 15, 2026",
    applicationRound: "November 15, 2025-April 15, 2026",
    benefitItems: [],
    actionLinks: [{ label: directDoctoral.label, url: directDoctoral.url, kind: "official-source" }],
    summary: "Closed 2026 full-scholarship direct doctoral route with a published four-to-six-year duration.",
    sourceUrl: directDoctoral.url,
    sourceLabel: directDoctoral.label,
    sourceSha256: directDoctoral.sha256,
    capturedAt: directDoctoral.fetchedAt,
    sourceFieldLineage: { title: "official brochure title", fundingLevel: "official brochure program highlights", applicableDegree: "official brochure program introduction", deadlineDate: "official brochure application schedule" },
  },
];

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: supportManifest.generatedAt,
  cities: [city],
  schools: [school],
  programs,
  programIntakes,
  scholarships,
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 49 || validation.summary.programIntakes !== 49 || validation.summary.scholarships !== 6) {
  throw new Error(`XJTU candidate invalid:\n${validation.errors.join("\n")}`);
}
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha(candidateText),
  mainManifestSha256: sha(mainManifestText),
  supportManifestSha256: sha(supportManifestText),
  sourceReview: {
    status: "unreviewed_draft",
    notes: [
      "The official CSCA workbook contains 49 undergraduate teaching routes: 44 Chinese-taught and five English-taught, including MBBS.",
      "All program names, languages, durations, degrees and CSCA subjects are taken from the official 2026 workbook; no third-party catalog text is copied.",
      "The non-medical brochure supplies the published tuition bands and English/Chinese language rules; the separate medical brochure supplies MBBS duration, tuition and English-evidence rule.",
      "All Fall 2026 intakes are closed as of this build and no 2027 dates are inferred.",
      "The 15 legacy XJTU undergraduate routes currently in prohibited-source quarantine have exact official replacements in this bundle.",
      "Five additional exact scholarship identities are preserved alongside the two legacy-compatible scholarship slugs; the legacy developing-countries scholarship remains quarantined because no matching current official route was found.",
      "Graduate program tables were acquired and verified but are not converted in this batch because PDF table extraction requires a separate structured transformation pass.",
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
