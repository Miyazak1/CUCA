import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const candidatePath = resolve(root, "seeds/catalog.fudan-school-program-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.fudan-school-program-batch-01.validation.json");
const reviewPath = resolve(root, "seeds/catalog.fudan-school-program-batch-01.review.json");

const evidenceSpecs = [
  ["work/catalog-official/2026-09-11T07-19-42-583Z/manifest.json", "fudan-university-chinese-undergraduate-guide-pdf-2026", "66d6beb3f65842d869e734f098cda91b3ff39fac81be5382bf781044119ff7e9"],
  ["work/catalog-official/2026-09-11T07-16-50-153Z/manifest.json", "fudan-university-chinese-undergraduate-catalog-2026", "1b225b50362b99910da053fac651a123ea3c26e4869e99db267fac6ad6400516"],
  ["work/catalog-official/2026-09-11T07-16-48-711Z/manifest.json", "fudan-university-chinese-undergraduate-csca-2026", "629bf87e21760b29551cd4c5cd5b0bcdc811572f0d3565c9d0c5ff5022da10a7"],
  ["work/catalog-official/2026-09-11T07-16-52-029Z/manifest.json", "fudan-university-chinese-undergraduate-tuition-2026", "0f73d20d7611334e76006c692d05e154670b062c24e1fb94730f8ab83361a1de"],
  ["work/catalog-official/2026-09-11T07-22-15-938Z/manifest.json", "fudan-university-chinese-undergraduate-catalog-pdf-2026", "f0bf0a8a0e53daa3cbf412a1e4c95aece821db28c624175e92eabe30759c479e"],
  ["work/catalog-official/2026-09-11T07-22-15-204Z/manifest.json", "fudan-university-chinese-undergraduate-csca-pdf-2026", "c375df7e16f722681b9c437e52b4608636515f5228c01b2f0d630d69b176483f"],
  ["work/catalog-official/2026-09-11T07-22-19-237Z/manifest.json", "fudan-university-chinese-undergraduate-tuition-pdf-2026", "98f2993bd06d3aa8a51a40767cab54e0f399b6eca23a6c30ab620bd77877c2d6"],
  ["work/catalog-official/2026-09-11T07-16-51-026Z/manifest.json", "fudan-university-english-undergraduate-catalog-2026", "f4b5f077261c452f36c7ac2d840a818bfdf5fff27b21b747b3b4c6d115729cc0"],
  ["work/catalog-official/2026-09-11T07-27-36-382Z/manifest.json", "fudan-university-iogg-guide-pdf-2026", "ac328a0506edea3e1e101b06b8af706a707d11bdb720e63e12a24f57bac503e8"],
  ["work/catalog-official/2026-09-11T07-27-31-917Z/manifest.json", "fudan-university-uipe-guide-pdf-2026", "1521845d0ce4b74603c2996c3e6dc237c0e0e40b98ebe5174ec56f1e58f224da"],
  ["work/catalog-official/2026-09-11T07-27-35-291Z/manifest.json", "fudan-university-gbf-guide-pdf-2026", "a97d5adb90c8b2935d514afa1984c22f523ccbd3dc83869a2ab8173047c1fc21"],
  ["work/catalog-official/2026-09-11T07-27-34-307Z/manifest.json", "fudan-university-uipdb-guide-pdf-2026", "6b483db040d619c7c7b520545de0fdbf450e2f8d7857c319223af8005231a999"],
  ["work/catalog-official/2026-09-11T07-27-41-792Z/manifest.json", "fudan-university-mbbs-guide-pdf-2026", "fed3bd11981a418ad76f3e5050dcab65df92fe47ba6194d11ee29c4d2b281073"],
] as const;

const evidence = new Map<string, Record<string, unknown>>();
for (const [relativePath, id, sha] of evidenceSpecs) {
  const manifest = JSON.parse(await readFile(resolve(root, relativePath), "utf8"));
  const source = manifest.sources?.[0];
  if (source?.id !== id || source?.sha256 !== sha || source?.status !== 200) throw new Error(`Official snapshot mismatch: ${id}`);
  evidence.set(id, source);
}
const source = (id: string) => evidence.get(id)!;
const GUIDE_ID = "fudan-university-chinese-undergraduate-guide-pdf-2026";
const CATALOG_ID = "fudan-university-chinese-undergraduate-catalog-2026";
const CSCA_ID = "fudan-university-chinese-undergraduate-csca-2026";
const TUITION_ID = "fudan-university-chinese-undergraduate-tuition-2026";
const ENGLISH_CATALOG_ID = "fudan-university-english-undergraduate-catalog-2026";
const GUIDE = source(GUIDE_ID);
const CATALOG = source(CATALOG_ID);
const CSCA = source(CSCA_ID);
const TUITION = source(TUITION_ID);
const ENGLISH_CATALOG = source(ENGLISH_CATALOG_ID);
const APPLY_URL = "https://istudent.fudan.edu.cn/apply";

type ChineseSpec = { nameEn: string; nameZh: string; field: string; school: string; slug?: string };
const c = (nameEn: string, nameZh: string, field: string, school: string, slug?: string): ChineseSpec => ({ nameEn, nameZh, field, school, slug });
const chineseSpecs: ChineseSpec[] = [
  c("Chinese Language for Foreigners (Language & Culture)", "汉语言（对外语言文化方向）", "Chinese Language for Foreigners", "International Cultural Exchange School", "fudan-university-chinese-language-international-language-and-culture"),
  c("Chinese Language for Foreigners (Business Chinese)", "汉语言（对外商务汉语方向）", "Chinese Language for Foreigners", "International Cultural Exchange School", "fudan-university-chinese-language-international-business-chinese"),
  c("Chinese Literature", "汉语言文学", "Chinese Language and Literature", "Department of Chinese Language and Literature", "fudan-university-chinese-language-and-literature"),
  c("Chinese Language", "汉语言", "Chinese Language and Literature", "Department of Chinese Language and Literature", "fudan-university-chinese-language"),
  c("History", "历史学", "History", "Department of History", "fudan-university-history"),
  c("Cultural Heritage and Museology", "文物与博物馆学", "History", "Department of Cultural Heritage and Museology", "fudan-university-museology"),
  c("Philosophy", "哲学", "Philosophy", "School of Philosophy", "fudan-university-philosophy"),
  c("Religion", "宗教学", "Philosophy", "School of Philosophy", "fudan-university-religious-studies"),
  c("Law", "法学", "Law", "Law School", "fudan-university-law"),
  c("English", "英语", "English", "College of Foreign Languages and Literature", "fudan-university-english"),
  c("Translation", "翻译", "Translation", "College of Foreign Languages and Literature"),
  c("French", "法语", "French", "College of Foreign Languages and Literature"),
  c("German", "德语", "German", "College of Foreign Languages and Literature"),
  c("Japanese", "日语", "Japanese", "College of Foreign Languages and Literature"),
  c("Spanish", "西班牙语", "Spanish", "College of Foreign Languages and Literature"),
  c("Russian", "俄语", "Russian", "College of Foreign Languages and Literature"),
  c("Korean", "朝鲜语", "Korean", "College of Foreign Languages and Literature"),
  c("Journalism", "新闻学", "Journalism and Communication Studies", "School of Journalism"),
  c("Broadcasting", "广播电视学", "Journalism and Communication Studies", "School of Journalism"),
  c("Communication", "传播学", "Journalism and Communication Studies", "School of Journalism"),
  c("Advertising", "广告学", "Journalism and Communication Studies", "School of Journalism"),
  c("Political Science and Administration", "政治学与行政学", "Social Sciences Experimental Program", "School of International Relations and Public Affairs"),
  c("International Politics", "国际政治", "Social Sciences Experimental Program", "School of International Relations and Public Affairs"),
  c("Public Administration", "行政管理", "Social Sciences Experimental Program", "School of International Relations and Public Affairs"),
  c("Sociology", "社会学", "Social Sciences Experimental Program", "School of Social Development and Public Policy"),
  c("Social Work", "社会工作", "Social Sciences Experimental Program", "School of Social Development and Public Policy"),
  c("Tourism Management", "旅游管理", "History", "Department of Tourism"),
  c("Economics", "经济学", "Economics", "School of Economics"),
  c("International Economics and Trade", "国际经济与贸易", "Economics", "School of Economics"),
  c("Finance", "金融学", "Economics", "School of Economics"),
  c("Insurance", "保险学", "Economics", "School of Economics"),
  c("Public Finance", "财政学", "Economics", "School of Economics"),
  c("Management (including Accounting, Marketing, Business Administration, Management Science, Information Management and Information System, Financial Management, Statistics)", "管理学类（含会计学、市场营销、工商管理、管理科学、信息管理与信息系统、财务管理、统计学）", "Economics and Management Experimental Program", "School of Management"),
  c("Mathematics and Applied Mathematics", "数学与应用数学", "Mathematics", "School of Mathematical Sciences"),
  c("Physics", "物理学", "Physics", "Department of Physics"),
  c("Chemistry", "化学", "Chemistry", "Department of Chemistry"),
  c("Energy Chemistry", "能源化学", "Chemistry", "Department of Chemistry"),
  c("Biological Sciences", "生物科学", "Biological Sciences", "School of Life Sciences"),
  c("Biotechnology", "生物技术", "Biological Sciences", "School of Life Sciences"),
  c("Atmospheric Sciences", "大气科学", "Atmospheric Science", "Department of Atmospheric and Oceanic Sciences"),
  c("Environmental Science", "环境科学", "Environmental Science", "Department of Environmental Science and Engineering"),
  c("Polymer Materials and Engineering", "高分子材料与工程", "Polymer Materials and Engineering", "Department of Macromolecular Science"),
  c("Psychology", "心理学", "Psychology", "School of Social Development and Public Policy"),
  c("Computer Science and Technology", "计算机科学与技术", "Computer Science and Technology", "College of Computer Science and Artificial Intelligence"),
  c("Software Engineering", "软件工程", "Software Engineering", "College of Computer Science and Artificial Intelligence"),
  c("Artificial Intelligence", "人工智能", "Engineering Experimental Program", "College of Computer Science and Artificial Intelligence"),
  c("Electronic Information Science and Technology", "电子信息科学与技术", "Engineering Experimental Program", "College of Future Information Innovation"),
  c("Optoelectronic Information Science and Engineering", "光电信息科学与工程", "Engineering Experimental Program", "College of Future Information Innovation"),
  c("Communications Engineering", "通信工程", "Engineering Experimental Program", "College of Future Information Innovation"),
  c("Biomedical Engineering", "生物医学工程", "Engineering Experimental Program", "College of Biomedical Engineering"),
  c("Materials Science and Engineering", "材料科学与工程", "Engineering Experimental Program", "College of Smart Materials and Future Energy"),
  c("New Energy Science and Engineering", "新能源科学与工程", "Engineering Experimental Program", "College of Smart Materials and Future Energy"),
  c("Aircraft Design and Engineering", "飞行器设计与工程", "Engineering Experimental Program", "College of Intelligent Robotics and Advanced Manufacturing"),
  c("Theoretical and Applied Mechanics", "理论与应用力学", "Engineering Experimental Program", "College of Intelligent Robotics and Advanced Manufacturing"),
  c("Intelligent Science and Technology", "智能科学与技术", "Engineering Experimental Program", "College of Intelligent Robotics and Advanced Manufacturing"),
  c("Nursing", "护理学", "Nursing", "School of Nursing, Shanghai Medical College"),
  c("Pharmaceutical Sciences", "药学", "Pharmaceutical Sciences", "School of Pharmacy, Shanghai Medical College"),
  c("Stomatology", "口腔医学", "Stomatology", "School of Stomatology, Shanghai Medical College"),
  c("Clinical Medicine (5 years)", "临床医学（五年制）", "Clinical Medicine", "School of Medicine, Shanghai Medical College"),
  c("Basic Medical Sciences", "基础医学", "Basic Medical Sciences", "School of Basic Medical Sciences, Shanghai Medical College"),
  c("Preventive Medicine", "预防医学", "Preventive Medicine", "School of Public Health, Shanghai Medical College"),
  c("Public Utilities Management", "公共事业管理", "Public Utilities Management", "School of Public Health, Shanghai Medical College"),
];

const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const arts = ["Chinese (Humanities)", "Mathematics"];
const stem = (subjects: string[]) => ["Chinese (STEM)", "Mathematics", ...subjects];
const subjectsFor = (index: number) => index <= 32 ? arts : index <= 34 ? stem(["Physics"])
  : index <= 41 ? stem(["Physics", "Chemistry"]) : index === 42 ? stem([])
    : index <= 49 ? stem(["Physics"]) : index <= 51 ? stem(["Chemistry"])
      : index <= 54 ? stem(["Physics"]) : index === 55 ? stem(["Chemistry"])
        : index <= 58 ? stem(["Physics", "Chemistry"]) : index === 59 ? stem(["Chemistry"]) : stem(["Physics", "Chemistry"]);
const noteFor = (index: number): string | undefined => {
  if (index <= 1) return "Designed for international students only; changing major is not allowed. HSK Level 4 score 180 or above may exempt the Chinese (Humanities) CSCA subject.";
  if ([2, 3, 4, 8].includes(index)) return "Some courses are taught in English.";
  if (index === 5) return "Not suitable for applicants with color blindness.";
  if ([15, 16].includes(index)) return "Changing major is not allowed.";
  if ([23, 24].includes(index)) return "Applicants should have good high-school Mathematics performance.";
  if (index === 26) return "Applicants should have good high-school Mathematics performance; some courses are taught in English.";
  if (index >= 27 && index <= 31) return "Applicants should have excellent high-school Mathematics performance.";
  if (index === 32) return "A solid high-school Mathematics and Science foundation is recommended; some courses are taught in English; the specific major is determined in later years.";
  if (index >= 33 && index <= 34) return "Applicants should have excellent high-school Mathematics and Physics performance.";
  if (index >= 35 && index <= 41) return "Not suitable for applicants with color blindness or color weakness; excellent high-school Mathematics, Physics, Chemistry and Biology performance is expected; some courses are taught in English.";
  if (index === 42) return "Not suitable for applicants with color blindness or color weakness; excellent high-school Mathematics, Physics and Biology performance is expected.";
  if (index >= 43 && index <= 48) return "Not suitable for applicants with color blindness or color weakness; excellent high-school Mathematics and Physics performance is expected; some courses are taught in English.";
  if (index === 49 || index === 50 || index === 51) return "Not suitable for applicants with color blindness or color weakness; excellent high-school Mathematics, Physics, Chemistry and Biology performance is expected; some courses are taught in English.";
  if (index >= 52 && index <= 54) return "Excellent high-school Mathematics and Physics performance is expected; some courses are taught in English.";
  if (index === 55) return "Not suitable for applicants with color blindness or color weakness; good high-school Mathematics, Chemistry and Biology performance is expected.";
  if (index === 56 || index === 59 || index === 60) return "Not suitable for applicants with color blindness or color weakness; excellent high-school Chemistry and good Mathematics, Physics and Biology performance is expected; some courses are taught in English.";
  if (index === 57 || index === 58) return "Not suitable for applicants with color blindness or color weakness; good high-school Mathematics, Physics, Chemistry and Biology performance is expected.";
  if (index === 61) return "Not suitable for applicants with color blindness or color weakness; excellent high-school Mathematics performance is expected; some courses are taught in English.";
};
const chinesePrograms: CatalogSeedProgram[] = chineseSpecs.map((spec, index) => {
  const tuition = index <= 32 ? 23000 : index <= 54 ? 26000 : 42000;
  const subjects = subjectsFor(index);
  const duration = [57, 58, 59, 60].includes(index) ? 5 : 4;
  const note = noteFor(index);
  return {
    slug: spec.slug ?? `fudan-university-${slugify(spec.nameEn)}`, schoolSlug: "fudan-university", citySlug: "shanghai",
    nameEn: spec.nameEn, nameZh: spec.nameZh, degreeLevel: "Undergraduate", durationYears: duration,
    fieldCategory: spec.field, subjectArea: spec.school, teachingLanguage: "Chinese", cscaSubjects: subjects,
    cscaRequirement: `CSCA in Chinese: ${subjects.join(", ")}`,
    hskRequirement: "HSK Level 5 score 210 or HSK Level 6 score 180 is listed as an optional supporting result, not a mandatory admission condition.",
    tuitionAmount: tuition, tuitionCurrency: "RMB", tuitionPeriod: "year", tuitionText: `RMB ${tuition.toLocaleString("en-US")}/year (official reference; exact amount announced at enrollment)`,
    scholarshipText: "The official 2026 guide lists CSC bilateral, International Chinese Language Teachers, Shanghai Government and Fudan international-student scholarship routes; eligibility must be checked separately.",
    hasScholarship: true, applicationUrl: APPLY_URL, ...(note ? { applicationNote: note } : {}), status: "draft",
    sourceUrl: String(CATALOG.url), sourceLabel: "Fudan University 2026 Chinese-taught Undergraduate Program Catalog", sourceSha256: String(CATALOG.sha256), capturedAt: String(CATALOG.fetchedAt),
    sourceFieldLineage: {
      nameEn: `English program catalog row ${index + 3}`, nameZh: `Chinese program catalog item ${index + 1}`,
      fieldCategory: `English program catalog row ${index + 3} Field column`, subjectArea: `English program catalog row ${index + 3} School/Department column`,
      durationYears: `official tuition schedule row ${index + 3}`, tuitionAmount: `official tuition schedule row ${index + 3}`,
      cscaSubjects: `official CSCA schedule program item ${index + 1}`, hskRequirement: "2026 Chinese-taught undergraduate guide page 2",
      scholarshipText: "2026 Chinese-taught undergraduate guide pages 7-8", applicationUrl: "2026 Chinese-taught undergraduate guide application procedure",
      ...(note ? { applicationNote: `English program catalog row ${index + 3} Remarks column` } : {}),
    },
  };
});

type EnglishSpec = { nameEn: string; nameZh: string; slug: string; field: string; school: string; duration: number; tuition: number; subjects: string[]; guideId: string; scholarship: string; note?: string };
const englishSpecs: EnglishSpec[] = [
  { nameEn: "International Organizations and Global Governance (IOGG)", nameZh: "国际组织与全球治理", slug: "fudan-university-international-organizations-and-global-governance-iogg", field: "International Relations and Public Affairs", school: "School of International Relations and Public Affairs", duration: 4, tuition: 100000, subjects: ["Mathematics"], guideId: "fudan-university-iogg-guide-pdf-2026", scholarship: "Fudan University International Students' Scholarship; awards depend on academic performance and admission evaluation." },
  { nameEn: "Undergraduate International Program in Economics (UIPE)", nameZh: "经济学（国际项目）", slug: "fudan-university-undergraduate-international-program-in-economics-uipe", field: "Economics", school: "School of Economics", duration: 4, tuition: 80000, subjects: ["Mathematics"], guideId: "fudan-university-uipe-guide-pdf-2026", scholarship: "Fudan University International Students' Scholarship; awards depend on academic performance and admission evaluation." },
  { nameEn: "Global Bachelor of Fintech (GBF)", nameZh: "金融科技全球本科项目", slug: "fudan-university-global-bachelor-of-fintech-gbf", field: "Financial Technology", school: "International School of Finance", duration: 4, tuition: 80000, subjects: ["Mathematics"], guideId: "fudan-university-gbf-guide-pdf-2026", scholarship: "Fudan University International Students' Scholarship; awards depend on academic performance and admission evaluation." },
  { nameEn: "Undergraduate International Program in Data Science and Big Data Technology (UIPDB)", nameZh: "数据科学与大数据技术（国际项目）", slug: "fudan-university-undergraduate-international-program-in-data-science-and-big-data-technology-uipdb", field: "Data Science", school: "School of Data Science", duration: 4, tuition: 80000, subjects: ["Mathematics", "Physics"], guideId: "fudan-university-uipdb-guide-pdf-2026", scholarship: "Fudan University International Students' Scholarship; awards depend on academic performance and admission evaluation." },
  { nameEn: "Bachelor of Medicine and Bachelor of Surgery (MBBS)", nameZh: "临床医学（英文授课）", slug: "fudan-university-mbbs", field: "Clinical Medicine", school: "School of Clinical Medicine", duration: 6, tuition: 75000, subjects: ["Mathematics", "Physics", "Chemistry"], guideId: "fudan-university-mbbs-guide-pdf-2026", scholarship: "Shanghai Government Scholarship (Class B; two admitted students, tuition exemption) and Fudan University International Students' Scholarship; awards depend on academic performance and admission evaluation.", note: "Applicants should have studied Mathematics, Physics, Chemistry and Biology in high school. The official catalog marks a color-vision restriction and does not permit changing major." },
];
const englishPrograms: CatalogSeedProgram[] = englishSpecs.map((spec, index) => {
  const guide = source(spec.guideId);
  return {
    slug: spec.slug, schoolSlug: "fudan-university", citySlug: "shanghai", nameEn: spec.nameEn, nameZh: spec.nameZh,
    degreeLevel: "Undergraduate", durationYears: spec.duration, fieldCategory: spec.field, subjectArea: spec.school,
    teachingLanguage: "English", cscaSubjects: spec.subjects, cscaRequirement: `CSCA in English: ${spec.subjects.join(", ")}`,
    englishRequirement: "TOEFL 90, IELTS 6.5, Duolingo English Test 110 or PTE Academic 61; waived for native English speakers or applicants whose major high-school courses were taught in English.",
    tuitionAmount: spec.tuition, tuitionCurrency: "RMB", tuitionPeriod: "year", tuitionText: `RMB ${spec.tuition.toLocaleString("en-US")}/year (exact amount announced at enrollment)`,
    scholarshipText: spec.scholarship, hasScholarship: true, applicationUrl: APPLY_URL, ...(spec.note ? { applicationNote: spec.note } : {}), status: "draft",
    sourceUrl: String(guide.url), sourceLabel: String(guide.label), sourceSha256: String(guide.sha256), capturedAt: String(guide.fetchedAt),
    sourceFieldLineage: {
      nameEn: `English-taught catalog row ${index + 2} and project guide title`, nameZh: "editorial Chinese display translation of the official English title",
      durationYears: "project guide Program Duration", tuitionAmount: "project guide Tuition section", cscaSubjects: "project guide Mandatory Assessment Subjects",
      englishRequirement: "project guide English Proficiency Test Result table", scholarshipText: "project guide Scholarship section", applicationUrl: "project guide online application step",
      ...(spec.note ? { applicationNote: "English-taught program catalog Remarks column" } : {}),
    },
  };
});

const programs = [...chinesePrograms, ...englishPrograms];
if (chinesePrograms.length !== 62 || englishPrograms.length !== 5 || programs.length !== 67) throw new Error("Unexpected Fudan program count.");
if (new Set(programs.map(program => program.slug)).size !== programs.length) throw new Error("Generated Fudan slugs are not unique.");

const candidate: CatalogSeedBundle = {
  version: 1, generatedAt: String(GUIDE.fetchedAt),
  cities: [{
    slug: "shanghai", nameEn: "Shanghai", nameZh: "上海", region: "East China", province: "Shanghai", status: "draft",
    sourceUrl: String(GUIDE.url), sourceLabel: String(GUIDE.label), sourceSha256: String(GUIDE.sha256), capturedAt: String(GUIDE.fetchedAt),
    sourceFieldLineage: { nameEn: "official guide institution address", province: "official guide institution address" },
  }],
  schools: [{
    slug: "fudan-university", nameEn: "Fudan University", nameZh: "复旦大学", citySlug: "shanghai", schoolType: "public", region: "East China",
    applicationLevel: "Undergraduate", languageOfInstruction: "Chinese and English",
    languageRequirement: "Chinese-taught routes list optional HSK supporting scores; English-taught routes accept TOEFL, IELTS, Duolingo or PTE Academic subject to the official exemption rule.",
    hskRequirement: "HSK Level 5 score 210 or HSK Level 6 score 180 is listed as optional, not mandatory. The two Chinese Language for Foreigners routes may use HSK Level 4 score 180 to waive Chinese (Humanities) in CSCA.",
    englishRequirement: "TOEFL 90, IELTS 6.5, Duolingo English Test 110 or PTE Academic 61; waived for native English speakers or applicants whose major high-school courses were taught in English.",
    deadlineSummary: "2026 applications had two phases: January 1-15 and February 23-March 6 (Beijing time).",
    tuitionSummary: "Chinese-taught programs: RMB 23,000-42,000/year. English-taught programs: RMB 75,000-100,000/year. Official schedules state that exact tuition is announced at enrollment.",
    applicationFee: "RMB 800, online payment, non-refundable", websiteUrl: "https://www.fudan.edu.cn/", admissionsUrl: "https://iso.fudan.edu.cn/isoenglish/wnglish/Undergraduate/list.htm",
    cscaRequired: true, cscaRequirement: "All 2026 undergraduate routes require CSCA. Subjects vary by program and teaching language; Phase 1 accepts December 2025 results, while Phase 2 accepts December 2025 or January 2026 results.",
    cscaSubjects: ["Chinese (Humanities)", "Chinese (STEM)", "Mathematics", "Physics", "Chemistry"], subjectTags: [...new Set(programs.map(program => program.fieldCategory!).filter(Boolean))],
    languageTags: ["Chinese-taught", "English-taught"], tuitionBandLabel: "RMB 23,000-100,000/year",
    campusHighlights: ["67 official 2026 undergraduate routes", "62 Chinese-taught and 5 English-taught routes", "Two application phases", "Program-level tuition, duration and CSCA subjects"],
    status: "draft", sourceUrl: String(GUIDE.url), sourceLabel: String(GUIDE.label), sourceSha256: String(GUIDE.sha256), capturedAt: String(GUIDE.fetchedAt),
    sourceFieldLineage: { nameEn: "official guide title", nameZh: "official Chinese catalog institution context", citySlug: "official guide institution address", applicationLevel: "official guide title", languageOfInstruction: "Chinese and English program catalogs", languageRequirement: "Chinese guide page 2 and English project guides", hskRequirement: "Chinese guide page 2 and catalog waiver note", englishRequirement: "English project guides proficiency table", deadlineSummary: "all six official admission guides Application Period", tuitionSummary: "official Chinese tuition schedule and English program catalog", applicationFee: "all official admission guides application fee step", websiteUrl: "official university domain", admissionsUrl: "registered official undergraduate admissions index", cscaRequirement: "official guides CSCA step" },
  }],
  programs,
  programIntakes: programs.map(program => ({
    programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, openDate: "2025-12-31T16:00:00.000Z", deadlineDate: "2026-03-06T15:59:59.000Z",
    deadlineLabel: "March 6, 2026", applicationRound: "2026 undergraduate admission (two phases)", status: "closed" as const,
    sourceUrl: program.teachingLanguage === "Chinese" ? String(GUIDE.url) : program.sourceUrl, sourceLabel: program.teachingLanguage === "Chinese" ? String(GUIDE.label) : program.sourceLabel,
    sourceSha256: program.teachingLanguage === "Chinese" ? String(GUIDE.sha256) : program.sourceSha256, capturedAt: program.teachingLanguage === "Chinese" ? String(GUIDE.fetchedAt) : program.capturedAt,
    sourceFieldLineage: { openDate: "Application Period phase 1 start; converted from Beijing local day", deadlineDate: "Application Period phase 2 end; converted from Beijing local day" },
  })),
  scholarships: [],
};

const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`Fudan candidate is invalid: ${validation.errors.join(" ")}`);
const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : value && typeof value === "object"
  ? `{${Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`
  : JSON.stringify(value);
const prohibitedPatterns = [/passport(?:Number)?/i, /personalEmail/i, /personalPhone/i, /cardNumber/i, /cvv/i, /passwordHash/i, /sessionToken/i, /beneficiaryBank/i, /applicationNumber/i];
if (prohibitedPatterns.some(pattern => pattern.test(canonical(candidate)))) throw new Error("The Fudan candidate contains a prohibited-data marker.");

const stableMatchingSlugs = [
  "fudan-university-chinese-language-international-language-and-culture", "fudan-university-chinese-language-and-literature", "fudan-university-law",
  "fudan-university-chinese-language-international-business-chinese", "fudan-university-history", "fudan-university-museology",
  "fudan-university-undergraduate-international-program-in-economics-uipe", "fudan-university-mbbs", "fudan-university-chinese-language",
  "fudan-university-philosophy", "fudan-university-religious-studies", "fudan-university-english",
];
for (const slug of stableMatchingSlugs) if (!programs.some(program => program.slug === slug)) throw new Error(`Reviewed stable slug is missing: ${slug}`);
const review = {
  version: 1, status: "awaiting_user_approval", generatedAt: String(GUIDE.fetchedAt),
  scope: { schoolSlug: "fudan-university", schoolCount: 1, chineseProgramCount: 62, englishProgramCount: 5, programCount: 67, intakeCount: 67 },
  officialEvidence: Object.fromEntries([...evidence.entries()].map(([id, item]) => [id, { sha256: item.sha256, fetchedAt: item.fetchedAt, contentType: item.contentType }])),
  reviewItems: [
    { field: "English program spelling", result: "normalized", reason: "The official English spreadsheet contains 'Artifical Intelligence' and 'Electronical Information Science and Technology'; public display uses standard spellings corroborated by the Chinese catalog." },
    { field: "English-route Chinese names", result: "editorial_translation", reason: "The five Chinese display labels are translations of official English titles and are not represented as official catalog titles." },
    { field: "tuition", result: "qualified", reason: "All values are official 2026 reference amounts; the sources state that exact tuition is announced at enrollment." },
    { field: "third-party/applicant sources", result: "excluded", reason: "No third-party page, scholarship award list, applicant name, application number or applicant document was used." },
  ],
  reconciliation: { actionAfterApproval: "upsert_official_2026_catalog", legacyAliasesToArchive: [], destructiveDeletion: false, stableMatchingSlugs },
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle only", note: "The candidate excludes applicant data, contacts, identity/financial document instructions and award-recipient lists. Raw official snapshots remain ignored and are not imported." },
  candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256,
};

for (const [path, value] of [[candidatePath, candidate], [validationPath, validation], [reviewPath, review]] as const) await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, reviewPath, candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256, reviewSha256: createHash("sha256").update(JSON.stringify(review)).digest("hex"), summary: validation.summary, chinesePrograms: chinesePrograms.length, englishPrograms: englishPrograms.length, stableMatchingSlugs: stableMatchingSlugs.length, legacyAliasesToArchive: 0 }, null, 2));
