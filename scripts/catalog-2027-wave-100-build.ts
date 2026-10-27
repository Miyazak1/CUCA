import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = {
  id: string;
  label: string;
  url: string;
  finalUrl?: string;
  fetchedAt: string;
  status: number;
  sha256: string;
  artifactPath: string;
};

type ProgramSpec = {
  nameEn: string;
  nameZh: string;
  degreeLevel: "Undergraduate" | "Master" | "Doctoral" | "Non-degree";
  fieldCategory: string;
  subjectArea: string;
  teachingLanguage: "Chinese" | "English" | "Chinese and English";
  durationYears: number;
  cscaSubjects?: string[];
};

const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/2026-10-26T03-19-44-642Z");
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
const expectedHashes: Record<string, string> = {
  "lnu-international-admissions-2027": "b9c62c3d696e96bc507c4bd47eee5fbf0df3deff93f5a50545029b3ec2479bdf",
  "lnu-international-degree-program-catalog-2027": "8f940e44ee2cbe857c7427532bc190582d0e820b9a15e60ed441de4fa21ae867",
};
const evidence = new Map<string, ManifestSource>();
for (const [id, expectedHash] of Object.entries(expectedHashes)) {
  const source = manifest.sources.find((row) => row.id === id && row.status === 200 && row.sha256 === expectedHash);
  if (!source) throw new Error(`Missing locked official evidence ${id} at ${expectedHash}.`);
  const artifact = await readFile(resolve(runRoot, source.artifactPath));
  if (createHash("sha256").update(artifact).digest("hex") !== expectedHash) throw new Error(`Evidence hash mismatch: ${id}.`);
  evidence.set(id, source);
}

const guide = evidence.get("lnu-international-admissions-2027");
const catalog = evidence.get("lnu-international-degree-program-catalog-2027");
if (!guide || !catalog) throw new Error("Liaoning University official evidence is incomplete.");
const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = dependency.cities?.find((row) => row.slug === "shenyang");
if (!city) throw new Error("Shenyang city dependency is missing.");
const schoolSlug = "liaoning-university";
if (dependency.schools?.some((row) => row.slug === schoolSlug)) throw new Error("Liaoning University is already present in the 100-school base.");

const humanitiesCsca = ["Chinese (Humanities)", "Mathematics"];
const scienceCsca = ["Chinese (Science)", "Mathematics"];
const physicsCsca = ["Chinese (Science)", "Mathematics", "Physics"];
const undergraduate: ProgramSpec[] = [
  ["Chinese Language and Literature", "汉语言文学", "Literature", "Chinese Language and Literature", "Chinese", humanitiesCsca],
  ["Art Design", "艺术设计学", "Arts", "Design", "Chinese", humanitiesCsca],
  ["History", "历史学", "History", "History", "Chinese", humanitiesCsca],
  ["Economics", "经济学", "Economics", "Economics", "Chinese", humanitiesCsca],
  ["Economic Statistics", "经济统计学", "Economics", "Economics", "Chinese", humanitiesCsca],
  ["National Economic Management", "国民经济管理", "Economics", "Economics", "Chinese", humanitiesCsca],
  ["Public Finance", "财政学", "Economics", "Public Finance", "Chinese", humanitiesCsca],
  ["Finance", "金融学", "Economics", "Finance", "Chinese", humanitiesCsca],
  ["Insurance", "保险学", "Economics", "Finance", "Chinese", humanitiesCsca],
  ["International Economics and Trade", "国际经济与贸易", "Economics", "Economics and Trade", "Chinese and English", humanitiesCsca],
  ["Business Administration", "工商管理", "Management", "Business Administration", "Chinese", humanitiesCsca],
  ["Marketing", "市场营销", "Management", "Business Administration", "Chinese", humanitiesCsca],
  ["Human Resource Management", "人力资源管理", "Management", "Business Administration", "Chinese", humanitiesCsca],
  ["English", "英语", "Literature", "Foreign Languages and Literature", "Chinese and English", humanitiesCsca],
  ["German", "德语", "Literature", "Foreign Languages and Literature", "Chinese", humanitiesCsca],
  ["Russian", "俄语", "Literature", "Foreign Languages and Literature", "Chinese", humanitiesCsca],
  ["French", "法语", "Literature", "Foreign Languages and Literature", "Chinese", humanitiesCsca],
  ["Japanese", "日语", "Literature", "Foreign Languages and Literature", "Chinese", humanitiesCsca],
  ["Radio and Television Editing and Directing", "广播电视编导", "Arts", "Drama, Film and Television Studies", "Chinese", humanitiesCsca],
  ["Broadcasting and Hosting", "播音与主持艺术", "Arts", "Drama, Film and Television Studies", "Chinese", humanitiesCsca],
  ["Korean", "朝鲜语", "Literature", "Foreign Languages and Literature", "Chinese", humanitiesCsca],
  ["International Politics", "国际政治", "Law", "Political Science", "Chinese", humanitiesCsca],
  ["Digital Economy", "数字经济", "Economics", "Economics", "Chinese", humanitiesCsca],
  ["Marxist Theory", "马克思主义理论", "Law", "Marxist Theory", "Chinese", humanitiesCsca],
  ["Performance", "表演", "Arts", "Drama, Film and Television Studies", "Chinese", humanitiesCsca],
  ["Dance", "舞蹈学", "Arts", "Music and Dance", "Chinese", humanitiesCsca],
  ["Music Performance", "音乐表演", "Arts", "Music and Dance", "Chinese", humanitiesCsca],
  ["Journalism", "新闻学", "Literature", "Journalism and Communication", "Chinese", humanitiesCsca],
  ["Advertising", "广告学", "Literature", "Journalism and Communication", "Chinese", humanitiesCsca],
  ["Editing and Publishing", "编辑出版学", "Literature", "Journalism and Communication", "Chinese", humanitiesCsca],
  ["International Chinese Language Education", "汉语国际教育", "Literature", "Chinese Language and Literature", "Chinese", humanitiesCsca],
  ["Chinese Language", "汉语言", "Literature", "Chinese Language and Literature", "Chinese", humanitiesCsca],
  ["Measurement and Control Technology and Instrumentation", "测控技术与仪器", "Engineering", "Instrumentation", "Chinese", physicsCsca],
  ["Microelectronics Science and Engineering", "微电子科学与工程", "Engineering", "Electronic Information", "Chinese", physicsCsca],
  ["Physics", "物理学", "Science", "Physics", "Chinese", physicsCsca],
  ["Environmental Ecological Engineering", "环境生态工程", "Engineering", "Environmental Science and Engineering", "Chinese", scienceCsca],
  ["Environmental Engineering", "环境工程", "Engineering", "Environmental Science and Engineering", "Chinese", scienceCsca],
  ["Engineering Mechanics", "工程力学", "Engineering", "Mechanics", "Chinese", scienceCsca],
  ["Computer Science and Technology", "计算机科学与技术", "Engineering", "Computer Science", "Chinese", scienceCsca],
  ["Data Science and Big Data Technology", "数据科学与大数据技术", "Engineering", "Computer Science", "Chinese", scienceCsca],
  ["Electronic Information Science and Technology", "电子信息科学与技术", "Engineering", "Electronic Information", "Chinese", scienceCsca],
  ["Communication Engineering", "通信工程", "Engineering", "Electronic Information", "Chinese", scienceCsca],
  ["Food Science and Engineering", "食品科学与工程", "Engineering", "Food Science and Engineering", "Chinese", scienceCsca],
  ["Electrical Engineering and Automation", "电气工程及其自动化", "Engineering", "Electrical Engineering", "Chinese", physicsCsca],
  ["Mathematics and Applied Mathematics", "数学与应用数学", "Science", "Mathematics", "Chinese", scienceCsca],
  ["Artificial Intelligence", "人工智能", "Engineering", "Electronic Information", "Chinese", scienceCsca],
].map(([nameEn, nameZh, fieldCategory, subjectArea, teachingLanguage, cscaSubjects]) => ({
  nameEn: nameEn as string,
  nameZh: nameZh as string,
  degreeLevel: "Undergraduate",
  fieldCategory: fieldCategory as string,
  subjectArea: subjectArea as string,
  teachingLanguage: teachingLanguage as ProgramSpec["teachingLanguage"],
  durationYears: 4,
  cscaSubjects: cscaSubjects as string[],
}));

const graduate: ProgramSpec[] = [
  ["Linguistics and Applied Linguistics", "语言学及应用语言学", "Master", "Literature", "Chinese Language and Literature", "Chinese and English", 3],
  ["Modern and Contemporary Chinese Literature", "中国现当代文学", "Doctoral", "Literature", "Chinese Language and Literature", "Chinese", 3],
  ["Chinese History", "中国史", "Master", "History", "Chinese History", "Chinese", 3],
  ["World History", "世界史", "Master", "History", "World History", "Chinese", 3],
  ["Chinese History", "中国史", "Doctoral", "History", "Chinese History", "Chinese", 3],
  ["Foreign Philosophy", "外国哲学", "Doctoral", "Philosophy", "Philosophy", "Chinese", 3],
  ["Industrial Economics", "产业经济学", "Master", "Economics", "Applied Economics", "English", 3],
  ["Industrial Economics", "产业经济学", "Doctoral", "Economics", "Applied Economics", "English", 3],
  ["Finance", "金融学", "Master", "Economics", "Applied Economics", "Chinese and English", 3],
  ["International Trade", "国际贸易学", "Master", "Economics", "Applied Economics", "Chinese and English", 3],
  ["International Trade", "国际贸易学", "Doctoral", "Economics", "Applied Economics", "Chinese and English", 3],
  ["Jurisprudence", "法学理论", "Master", "Law", "Law", "Chinese", 3],
  ["Legal History", "法律史", "Master", "Law", "Law", "Chinese", 3],
  ["Constitutional and Administrative Law", "宪法学与行政法学", "Master", "Law", "Law", "Chinese", 3],
  ["Criminal Law", "刑法学", "Master", "Law", "Law", "Chinese", 3],
  ["Civil and Commercial Law", "民商法学", "Master", "Law", "Law", "Chinese and English", 3],
  ["Procedural Law", "诉讼法学", "Master", "Law", "Law", "Chinese", 3],
  ["International Law", "国际法学", "Master", "Law", "Law", "Chinese and English", 3],
  ["Intellectual Property and Artificial Intelligence Law", "知识产权与人工智能法学", "Master", "Law", "Law", "Chinese", 3],
  ["English Language and Literature", "英语语言文学", "Master", "Literature", "Foreign Languages and Literature", "Chinese", 3],
  ["Russian Language and Literature", "俄语语言文学", "Master", "Literature", "Foreign Languages and Literature", "Chinese", 3],
  ["Japanese Language and Literature", "日语语言文学", "Master", "Literature", "Foreign Languages and Literature", "Chinese", 3],
  ["Foreign Linguistics and Applied Linguistics", "外国语言学及应用语言学", "Master", "Literature", "Foreign Languages and Literature", "Chinese", 3],
  ["English Translation", "英语笔译", "Master", "Literature", "Translation", "Chinese", 2],
  ["English Interpreting", "英语口译", "Master", "Literature", "Translation", "Chinese", 2],
  ["Russian Translation", "俄语笔译", "Master", "Literature", "Translation", "Chinese", 2],
  ["World Economics", "世界经济", "Doctoral", "Economics", "Theoretical Economics", "Chinese", 3],
  ["New International Political Economy", "新国际政治经济学", "Doctoral", "Economics", "Theoretical Economics", "Chinese", 3],
  ["Digital Economics", "数字经济学", "Doctoral", "Economics", "Theoretical Economics", "Chinese", 3],
  ["Drama, Film and Television", "戏剧与影视", "Master", "Arts", "Drama, Film and Television Studies", "Chinese", 3],
  ["Overseas Marxist Studies", "国外马克思主义研究", "Master", "Law", "Marxist Theory", "Chinese", 3],
  ["History of Marxist Development", "马克思主义发展史", "Master", "Law", "Marxist Theory", "Chinese", 3],
  ["Scientific Socialism and the International Communist Movement", "科学社会主义与国际共产主义运动", "Master", "Law", "Political Science", "Chinese", 3],
  ["Basic Principles of Marxism", "马克思主义基本原理", "Doctoral", "Law", "Marxist Theory", "Chinese", 3],
  ["Studies on the Sinicization of Marxism", "马克思主义中国化研究", "Doctoral", "Law", "Marxist Theory", "Chinese", 3],
  ["Journalism and Communication", "新闻与传播", "Master", "Literature", "Journalism and Communication", "Chinese and English", 3],
  ["International Chinese Language Education", "国际中文教育", "Master", "Education", "Education", "Chinese", 3],
  ["Integrated Circuit Science and Engineering", "集成电路科学与工程", "Master", "Engineering", "Electronic Science and Technology", "Chinese and English", 3],
  ["Optics", "光学", "Master", "Science", "Physics", "Chinese and English", 3],
  ["Theoretical Physics", "理论物理", "Master", "Science", "Physics", "English", 3],
  ["Optics", "光学", "Doctoral", "Science", "Physics", "Chinese and English", 3],
  ["Physical Chemistry", "物理化学", "Master", "Science", "Chemistry", "Chinese", 3],
  ["Medicinal Chemistry", "药物化学", "Master", "Science", "Pharmacy", "English", 3],
  ["Software Engineering", "软件工程", "Master", "Engineering", "Software Engineering", "Chinese", 3],
  ["Network and Information Security", "网络与信息安全", "Master", "Engineering", "Computer Science and Technology", "Chinese", 3],
  ["Artificial Intelligence", "人工智能", "Master", "Engineering", "Computer Science and Technology", "Chinese", 3],
  ["Food Engineering", "食品工程", "Master", "Engineering", "Engineering", "Chinese", 3],
  ["Materials Engineering", "材料工程", "Master", "Engineering", "Engineering", "Chinese", 3],
  ["Environmental Science (Engineering)", "环境科学（工学）", "Doctoral", "Engineering", "Environmental Science and Engineering", "Chinese and English", 3],
].map(([nameEn, nameZh, degreeLevel, fieldCategory, subjectArea, teachingLanguage, durationYears]) => ({
  nameEn: nameEn as string,
  nameZh: nameZh as string,
  degreeLevel: degreeLevel as ProgramSpec["degreeLevel"],
  fieldCategory: fieldCategory as string,
  subjectArea: subjectArea as string,
  teachingLanguage: teachingLanguage as ProgramSpec["teachingLanguage"],
  durationYears: durationYears as number,
}));

const nonDegree: ProgramSpec = {
  nameEn: "Chinese Language Advanced Study",
  nameZh: "汉语进修",
  degreeLevel: "Non-degree",
  fieldCategory: "Language study",
  subjectArea: "Chinese Language",
  teachingLanguage: "Chinese",
  durationYears: 1,
};
const specs = [...undergraduate, ...graduate, nonDegree];
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const catalogFields = {
  sourceUrl: catalog.finalUrl ?? catalog.url,
  sourceLabel: catalog.label,
  sourceSha256: catalog.sha256,
  capturedAt: catalog.fetchedAt,
};
const guideFields = {
  sourceUrl: guide.finalUrl ?? guide.url,
  sourceLabel: guide.label,
  sourceSha256: guide.sha256,
  capturedAt: guide.fetchedAt,
};
const applicationUrl = "https://lnu.17gz.org/member/login.do";
const tuitionByDegree = { Undergraduate: 18000, Master: 25000, Doctoral: 30000, "Non-degree": 13000 } as const;
const deadlineByDegree = {
  Undergraduate: "2027-07-31T15:59:59.000Z",
  Master: "2027-06-30T15:59:59.000Z",
  Doctoral: "2027-06-30T15:59:59.000Z",
  "Non-degree": "2027-02-08T15:59:59.000Z",
} as const;

const programs: CatalogSeedProgram[] = specs.map((spec) => {
  const slug = `${schoolSlug}-${slugify(spec.degreeLevel)}-${slugify(spec.nameEn)}`;
  const usesChinese = spec.teachingLanguage.includes("Chinese");
  const usesEnglish = spec.teachingLanguage.includes("English");
  return {
    slug,
    schoolSlug,
    citySlug: "shenyang",
    nameEn: spec.nameEn,
    nameZh: spec.nameZh,
    degreeLevel: spec.degreeLevel,
    durationYears: spec.durationYears,
    fieldCategory: spec.fieldCategory,
    subjectArea: spec.subjectArea,
    teachingLanguage: spec.teachingLanguage,
    ...(spec.cscaSubjects ? {
      cscaSubjects: spec.cscaSubjects,
      cscaRequirement: spec.nameEn === "Chinese Language"
        ? "The 2027 catalog requires CSCA Chinese (Humanities) and Mathematics; applicants to the Chinese Language major with a valid HSK Level 4 score of at least 180 may waive Professional Chinese."
        : `The 2027 catalog requires ${spec.cscaSubjects.join(", ")}.`,
    } : {}),
    ...(usesChinese ? { hskRequirement: "HSK Level 4 with a score of at least 180 for Chinese-taught study." } : {}),
    ...(usesEnglish ? { englishRequirement: "IELTS 5.0 or TOEFL 60 for English-taught study." } : {}),
    tuitionAmount: tuitionByDegree[spec.degreeLevel],
    tuitionCurrency: "CNY",
    tuitionPeriod: "academic year",
    tuitionText: spec.degreeLevel === "Non-degree"
      ? "CNY 13,000 per academic year or CNY 2,500 per month."
      : `Standard ${spec.degreeLevel.toLowerCase()} tuition is CNY ${tuitionByDegree[spec.degreeLevel].toLocaleString("en-US")} per year; special fully English-taught programs may differ and must be confirmed with the university.`,
    applicationUrl,
    applicationNote: "The 2027 guide requires identity, education and transcript evidence, language evidence, physical examination and non-criminal record materials. Graduate applicants also submit a study plan and two academic recommendations. Route-specific academic and admission-examination requirements apply.",
    badgeText: "2027 official catalog",
    displayTuition: `CNY ${tuitionByDegree[spec.degreeLevel].toLocaleString("en-US")}/year`,
    displaySubjects: [spec.subjectArea],
    displayGroup: slugify(spec.degreeLevel),
    displayGroupLabel: spec.degreeLevel,
    status: "active",
    verificationStatus: "verified",
    lastVerifiedAt: catalog.fetchedAt,
    ...catalogFields,
    sourceFieldLineage: {
      nameEn: "official 2027 program workbook, Major / Program Name",
      nameZh: "official 2027 program workbook, Major / Program Name",
      degreeLevel: "official 2027 program workbook, Student Type",
      durationYears: "official 2027 program workbook, Duration",
      fieldCategory: "official 2027 program workbook, Discipline Category",
      subjectArea: "official 2027 program workbook, First-Level Discipline",
      teachingLanguage: "official 2027 program workbook, Language of Instruction",
      ...(spec.cscaSubjects ? { cscaSubjects: "official 2027 program workbook, undergraduate CSCA subject columns" } : {}),
      ...(usesChinese ? { hskRequirement: "official 2027 admissions guide, Language Requirements" } : {}),
      ...(usesEnglish ? { englishRequirement: "official 2027 admissions guide, Language Requirements" } : {}),
      tuitionAmount: "official 2027 admissions guide, Fees",
      tuitionText: "official 2027 admissions guide, Fees and special-program note",
      applicationUrl: "official 2027 admissions guide, Application Process",
      applicationNote: "official 2027 admissions guide, Eligibility, Materials and Entrance Examination",
    },
  };
});

const programIntakes: CatalogSeedProgramIntake[] = programs.flatMap((program) => {
  if (program.degreeLevel === "Non-degree") {
    return [
      {
        programSlug: program.slug,
        intakeTerm: "Spring",
        intakeYear: 2027,
        openDate: "2026-10-20T08:40:00.000Z",
        deadlineDate: "2027-02-08T15:59:59.000Z",
        deadlineLabel: "Spring 2027 long-term Chinese study: applications accepted through February 8, 2027.",
        applicationRound: "Liaoning University Spring 2027 long-term Chinese study",
        ...guideFields,
        sourceFieldLineage: { intakeTerm: "2027 guide, Non-degree application time", intakeYear: "2027 guide, Non-degree application time", openDate: "guide publication time and applications accepted immediately", deadlineDate: "2027 guide, Non-degree application time", deadlineLabel: "2027 guide, Non-degree application time", applicationRound: "2027 guide, Non-degree Programs" },
      },
      {
        programSlug: program.slug,
        intakeTerm: "Fall",
        intakeYear: 2027,
        openDate: "2027-03-31T16:00:00.000Z",
        deadlineDate: "2027-08-15T15:59:59.000Z",
        deadlineLabel: "Fall 2027 long-term Chinese study: April 1-August 15, 2027.",
        applicationRound: "Liaoning University Fall 2027 long-term Chinese study",
        ...guideFields,
        sourceFieldLineage: { intakeTerm: "2027 guide, Non-degree application time", intakeYear: "2027 guide, Non-degree application time", openDate: "2027 guide, Non-degree application time", deadlineDate: "2027 guide, Non-degree application time", deadlineLabel: "2027 guide, Non-degree application time", applicationRound: "2027 guide, Non-degree Programs" },
      },
    ];
  }
  const deadlineDate = deadlineByDegree[program.degreeLevel as "Undergraduate" | "Master" | "Doctoral"];
  return [{
    programSlug: program.slug,
    intakeTerm: "2027 degree cohort",
    intakeYear: 2027,
    openDate: "2026-10-20T08:40:00.000Z",
    deadlineDate,
    deadlineLabel: program.degreeLevel === "Undergraduate" ? "Undergraduate applications accepted through July 31, 2027." : "Master's and doctoral applications accepted through June 30, 2027.",
    applicationRound: `Liaoning University 2027 international ${program.degreeLevel.toLowerCase()} admission`,
    ...guideFields,
    sourceFieldLineage: { intakeTerm: "2027 guide title; semester intentionally not inferred", intakeYear: "2027 guide title", openDate: "guide publication time and applications accepted immediately", deadlineDate: "2027 guide, Degree Programs application time", deadlineLabel: "2027 guide, Degree Programs application time", applicationRound: "2027 guide title and degree category" },
  }];
});

const school = {
  slug: schoolSlug,
  nameEn: "Liaoning University",
  nameZh: "辽宁大学",
  citySlug: "shenyang",
  schoolType: "Public",
  region: "Shenyang, Liaoning, Northeast China",
  applicationLevel: "Undergraduate, Master, Doctoral and Non-degree",
  languageOfInstruction: "Chinese and English, by program",
  languageRequirement: "Chinese-taught programs require HSK Level 4 score 180 or above. English-taught programs require IELTS 5.0 or TOEFL 60.",
  hskRequirement: "HSK Level 4 score 180 or above for Chinese-taught programs.",
  englishRequirement: "IELTS 5.0 or TOEFL 60 for English-taught programs.",
  deadlineSummary: "2027 undergraduate: July 31; master's and doctoral: June 30; long-term Chinese study: February 8 for spring or April 1-August 15 for fall.",
  tuitionSummary: "Undergraduate CNY 18,000/year; master CNY 25,000/year; doctoral CNY 30,000/year; Chinese study CNY 13,000/year or CNY 2,500/month. Special English-taught program fees may differ.",
  applicationFee: "CNY 800 per applicant per program",
  websiteUrl: "https://ie.lnu.edu.cn/",
  admissionsUrl: guide.finalUrl ?? guide.url,
  cscaRequired: true,
  cscaRequirement: "2027 undergraduate applicants must submit CSCA results. The official program workbook identifies Chinese and Mathematics for every route, with Physics additionally required for selected science and engineering routes; no listed route requires Chemistry in the captured workbook.",
  cscaSubjects: ["Chinese (Humanities) or Chinese (Science)", "Mathematics", "Physics for selected routes"],
  subjectTags: Array.from(new Set(programs.map((program) => program.fieldCategory).filter((value): value is string => Boolean(value)))),
  languageTags: ["Chinese", "English"],
  campusHighlights: ["2027 official undergraduate catalog", "2027 official graduate catalog", "Bachelor, master, doctoral and Chinese-language routes"],
  contactNotes: "International Education College, Liaoning University, 66 Chongshan Middle Road, Huanggu District, Shenyang 110036; +86-24-62202503; studyinlnu@lnu.edu.cn.",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: guide.fetchedAt,
  ...guideFields,
  sourceFieldLineage: {
    nameEn: "official 2027 guide institutional identity",
    nameZh: "official 2027 guide title",
    citySlug: "official 2027 guide contact address",
    schoolType: "official institutional profile",
    region: "official address plus CUAC geographic taxonomy",
    applicationLevel: "official 2027 guide, Degree and Non-degree Programs",
    languageOfInstruction: "official 2027 program workbook",
    languageRequirement: "official 2027 guide, Language Requirements",
    hskRequirement: "official 2027 guide, Language Requirements",
    englishRequirement: "official 2027 guide, Language Requirements",
    deadlineSummary: "official 2027 guide, Application Time",
    tuitionSummary: "official 2027 guide, Fees",
    applicationFee: "official 2027 guide, Application Process and Fees",
    websiteUrl: "official International Education College domain",
    admissionsUrl: "official 2027 guide URL",
    cscaRequirement: "official 2027 guide and official 2027 program workbook",
    contactNotes: "official 2027 guide, Contact Information",
  },
};

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: [guide.fetchedAt, catalog.fetchedAt].sort().at(-1) ?? guide.fetchedAt,
  cities: [city],
  schools: [school],
  programs,
  programIntakes,
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 Wave 100 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: candidate.generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [schoolSlug], newSchools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: 0 },
  evidence: [...evidence.values()].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, fetchedAt: source.fetchedAt, sha256: source.sha256 })),
  unresolved: [
    "The 2027 guide names scholarship eligibility but does not publish award-specific coverage or application rules, so no scholarship row is inferred.",
    "The guide states that special fully English-taught program tuition may differ; the standard degree tuition is retained with that qualification and no unpublished special fee is invented.",
    "The degree application sections identify the 2027 cohort but do not explicitly label Fall, so degree intakeTerm remains '2027 degree cohort'.",
    "Short-term and customized non-degree projects are offered, but no fixed current dates, curriculum or price are published; only the fully specified long-term Chinese route is structured.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public institutional admissions facts and public office contact details are included; supervisor and faculty personal contact columns are intentionally excluded." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-100");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 100, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
