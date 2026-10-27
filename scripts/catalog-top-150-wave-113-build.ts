import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type LockedSource = { run: string; id: string; sha256: string };
type Route = { nameEn: string; nameZh: string; language: string; level: string; sourceId: string; suffix?: string };

const root = process.cwd();
const lockedSources: LockedSource[] = [
  { run: "2026-10-26T05-29-21-688Z", id: "xidian-international-admission-brochure-hub-2026", sha256: "ba6b35c64f36d0487f0fc623d90754c0288bd201323d878b3fea189295aaad07" },
  { run: "2026-10-26T05-29-28-734Z", id: "xidian-international-undergraduate-guide-pdf-2026", sha256: "f24de910d6c0d79d0a6401b14dba842e1f7bc813a4f466bd93dedcd8b7931ee4" },
  { run: "2026-10-26T05-29-31-548Z", id: "xidian-international-doctoral-guide-pdf-2026", sha256: "51ea07f484f0efb26b20540746b012833f5273560caa6a77fbbaf03ea083ab21" },
  { run: "2026-10-26T05-29-35-267Z", id: "xidian-international-master-guide-pdf-2026", sha256: "83b747044b3ab3b3b35ce7dbc5d2c2a37e53f6cd8a0e1355c4af651477631b1e" },
  { run: "2026-10-26T05-29-37-945Z", id: "xidian-international-foundation-guide-pdf-2026", sha256: "28f091b20e923e0d44329f3b3ab1775f47862d98e10b35c52052eabd83ccba2d" },
];

const sources = new Map<string, ManifestSource>();
for (const locked of lockedSources) {
  const runRoot = resolve(root, "work/catalog-official", locked.run);
  const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
  const source = manifest.sources.find((row) => row.id === locked.id && row.status === 200 && row.sha256 === locked.sha256);
  if (!source) throw new Error(`Missing locked official evidence ${locked.id} at ${locked.sha256}.`);
  const artifact = await readFile(resolve(runRoot, source.artifactPath));
  if (createHash("sha256").update(artifact).digest("hex") !== locked.sha256) throw new Error(`Evidence hash mismatch: ${locked.id}.`);
  sources.set(locked.id, source);
}

const hub = sources.get("xidian-international-admission-brochure-hub-2026")!;
const sourceFields = (source: ManifestSource) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = dependency.cities?.find((row) => row.slug === "xian");
if (!city) throw new Error("Xi'an city dependency is missing.");
const schoolSlug = "xidian-university";
if (dependency.schools?.some((row) => row.slug === schoolSlug)) throw new Error("Xidian University already exists in the reviewed base.");

const school = {
  slug: schoolSlug,
  nameEn: "Xidian University",
  nameZh: "西安电子科技大学",
  citySlug: "xian",
  schoolType: "National key university",
  region: "Xi'an, Shaanxi, Northwest China",
  applicationLevel: "Foundation, Language, Bachelor, Master and Doctoral",
  languageOfInstruction: "Chinese and English",
  languageRequirement: "For the 2026 degree guides, Chinese International Education requires HSK 4 score 210; other Chinese-taught routes require HSK 5 score 180. English-taught routes accept IELTS 6.0 with no band below 5.5, TOEFL 80, Duolingo 110, A-level English A, FCE 169, CAE 180 or CPE.",
  hskRequirement: "HSK 4 score 210 for Chinese International Education; HSK 5 score 180 for other Chinese-taught degree routes.",
  englishRequirement: "IELTS 6.0 with no band below 5.5, TOEFL 80, Duolingo 110, A-level English A, FCE 169, CAE 180 or CPE.",
  deadlineSummary: "The 2026 degree guides list rounds closing March 1, May 17 and July 1, 2026. The foundation and Chinese-language programs closed June 15, 2026. No explicit 2027 inbound guide was found as of October 26, 2026.",
  tuitionSummary: "2026 annual tuition: CNY 25,000 bachelor, CNY 30,000 master, CNY 40,000 doctoral, CNY 20,000 foundation and CNY 14,000 Chinese-language program.",
  websiteUrl: "https://www.xidian.edu.cn/",
  admissionsUrl: hub.finalUrl ?? hub.url,
  subjectTags: ["Information and Communication Engineering", "Electronic Science and Technology", "Computer Science", "Cyberspace Security", "Integrated Circuits"],
  languageTags: ["Chinese", "English", "HSK 4", "HSK 5", "IELTS 6.0", "TOEFL 80"],
  campusHighlights: ["2026 official bachelor, master and doctoral catalogs", "55 structured study routes", "CSCA subjects stated for all four bachelor routes"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: hub.fetchedAt,
  ...sourceFields(hub),
  sourceFieldLineage: {
    nameEn: "official admissions hub and guides",
    nameZh: "official admissions hub and guides",
    citySlug: "official guide address and reviewed Xi'an dependency",
    applicationLevel: "official 2026 bachelor, postgraduate and foundation guides",
    languageOfInstruction: "official program tables",
    languageRequirement: "official 2026 degree guides",
    deadlineSummary: "official 2026 guide deadlines and current 2027 discovery status",
    tuitionSummary: "official 2026 guide fee tables",
    admissionsUrl: "captured official admissions brochure hub",
    subjectTags: "official program tables",
  },
};

const UG = "xidian-international-undergraduate-guide-pdf-2026";
const MA = "xidian-international-master-guide-pdf-2026";
const PHD = "xidian-international-doctoral-guide-pdf-2026";
const FOUND = "xidian-international-foundation-guide-pdf-2026";
const routes: Route[] = [
  { nameEn: "Computer Science and Technology", nameZh: "计算机科学与技术", language: "English", level: "Bachelor", sourceId: UG },
  { nameEn: "Information and Computing Science", nameZh: "信息与计算科学", language: "English", level: "Bachelor", sourceId: UG },
  { nameEn: "Applied Physics", nameZh: "应用物理", language: "English", level: "Bachelor", sourceId: UG },
  { nameEn: "Chinese International Education", nameZh: "汉语国际教育", language: "Chinese", level: "Bachelor", sourceId: UG },
  ...[
    ["Information and Communication Engineering", "信息与通信工程", "Chinese and English"], ["Electronic Science and Technology", "电子科学与技术", "Chinese and English"],
    ["Computer Science and Technology", "计算机科学与技术", "Chinese and English"], ["Software Engineering", "软件工程", "Chinese"],
    ["Mechanical Engineering", "机械工程", "Chinese and English"], ["Control Science and Engineering", "控制科学与工程", "Chinese and English"],
    ["Instrument Science and Technology", "仪器科学与技术", "Chinese and English"], ["Optical Engineering", "光学工程", "Chinese and English"],
    ["Physics", "物理学", "Chinese and English"], ["Business Administration", "工商管理", "English"],
    ["Applied Mathematics", "应用数学", "Chinese"], ["Philosophy", "哲学", "English"],
    ["Foreign Languages and Literature", "外国语言文学", "Chinese"], ["Area Studies", "区域国别学", "Chinese"],
    ["Electronic Science and Technology", "电子科学与技术", "Chinese and English", "integrated-circuits"], ["Integrated Circuit Engineering", "集成电路工程", "Chinese"],
    ["Biomedical Engineering", "生物医学工程", "English"], ["Biology and Medicine", "生物与医药", "English"],
    ["Instrument Science and Technology", "仪器科学与技术", "Chinese and English", "space-science"], ["Control Science and Engineering", "控制科学与工程", "Chinese and English", "space-science"],
    ["Materials Science and Engineering", "材料科学与工程", "Chinese"], ["Materials and Chemical Engineering", "材料与化工", "Chinese"],
    ["Cyberspace Security", "网络空间安全", "Chinese and English"], ["Intelligent Science and Technology", "智能科学与技术", "Chinese and English"],
    ["Computer Science and Technology", "计算机科学与技术", "Chinese", "guangzhou"], ["Optical Engineering", "光学工程", "Chinese", "guangzhou"],
    ["Mechanics", "力学", "English"], ["Remote Sensing Science and Technology", "遥感科学与技术", "English"],
  ].map(([nameEn, nameZh, language, suffix]) => ({ nameEn, nameZh, language, level: "Master", sourceId: MA, suffix })),
  ...[
    ["Information and Communication Engineering", "信息与通信工程", "Chinese and English"], ["Electronic Science and Technology", "电子科学与技术", "Chinese and English"],
    ["Computer Science and Technology", "计算机科学与技术", "Chinese and English"], ["Software Engineering", "软件工程", "Chinese"],
    ["Mechanical Engineering", "机械工程", "Chinese and English"], ["Control Science and Engineering", "控制科学与工程", "Chinese and English"],
    ["Instrument Science and Technology", "仪器科学与技术", "Chinese and English"], ["Optical Engineering", "光学工程", "Chinese and English"],
    ["Physics", "物理学", "Chinese and English"], ["Management Science and Engineering", "管理科学与工程", "English"],
    ["Mathematics", "数学", "Chinese"], ["Electronic Science and Technology", "电子科学与技术", "Chinese and English", "integrated-circuits"],
    ["Integrated Circuit Science and Engineering", "集成电路科学与工程", "Chinese and English"], ["Biomedical Engineering", "生物医学工程", "English"],
    ["Instrument Science and Technology", "仪器科学与技术", "Chinese and English", "space-science"], ["Control Science and Engineering", "控制科学与工程", "Chinese and English", "space-science"],
    ["Materials Science and Engineering", "材料科学与工程", "Chinese and English"], ["Cyberspace Security", "网络空间安全", "Chinese and English"],
    ["Intelligent Science and Technology", "智能科学与技术", "Chinese and English"], ["Mechanics", "力学", "English"],
    ["Remote Sensing Science and Technology", "遥感科学与技术", "English"],
  ].map(([nameEn, nameZh, language, suffix]) => ({ nameEn, nameZh, language, level: "Doctoral", sourceId: PHD, suffix })),
  { nameEn: "Foundation Program", nameZh: "预科项目", language: "Chinese", level: "Foundation", sourceId: FOUND },
  { nameEn: "Chinese Language Training Program", nameZh: "汉语进修项目", language: "Chinese", level: "Language Program", sourceId: FOUND },
];

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const category = (name: string) => /Computer|Software|Intelligent|Cyberspace/.test(name) ? "Computer Science and IT" : /Business|Management|Philosophy|Area/.test(name) ? "Economics, Management and Humanities" : /Physics|Mathematics/.test(name) ? "Natural Sciences" : /Chinese|Language/.test(name) ? "Languages and Culture" : /Foundation/.test(name) ? "Foundation Studies" : "Engineering and Technology";
const programs = routes.map((route) => {
  const source = sources.get(route.sourceId)!;
  const chineseInternational = route.nameEn === "Chinese International Education";
  const degree = ["Bachelor", "Master", "Doctoral"].includes(route.level);
  const tuition = route.level === "Bachelor" ? 25000 : route.level === "Master" ? 30000 : route.level === "Doctoral" ? 40000 : route.level === "Foundation" ? 20000 : 14000;
  const cscaSubjects = route.level === "Bachelor" ? (chineseInternational ? ["Chinese (Humanities)", "Mathematics"] : ["Mathematics", "Physics"]) : undefined;
  return {
    slug: `${schoolSlug}-${slugify(route.nameEn)}-${slugify(route.level)}${route.suffix ? `-${route.suffix}` : ""}`,
    schoolSlug,
    citySlug: "xian",
    nameEn: route.nameEn,
    nameZh: route.nameZh,
    degreeLevel: route.level,
    durationYears: route.level === "Bachelor" ? 4 : route.level === "Master" || route.level === "Doctoral" ? 3 : 1,
    fieldCategory: category(route.nameEn),
    subjectArea: route.nameEn,
    teachingLanguage: route.language,
    ...(cscaSubjects ? { cscaSubjects, cscaRequirement: `Submit the 2026 CSCA score report; tested subjects: ${cscaSubjects.join(", ")}.` } : {}),
    ...(route.language.includes("Chinese") && degree ? { hskRequirement: chineseInternational ? "HSK Level 4 score 210 or above." : "HSK Level 5 score 180 or above." } : {}),
    ...(route.language.includes("English") ? { englishRequirement: "IELTS 6.0 with no band below 5.5, TOEFL 80, Duolingo 110, A-level English A, FCE 169, CAE 180 or CPE." } : {}),
    tuitionAmount: tuition,
    tuitionCurrency: "CNY",
    tuitionPeriod: "year",
    tuitionText: `CNY ${tuition.toLocaleString("en-US")} per academic year for the 2026 cycle.`,
    applicationNote: degree ? "Application fee CNY 800; insurance CNY 1,000/year. Degree applicants submit identity, education, transcripts, language evidence, medical and no-criminal records, an 800+ character study plan, financial proof of at least CNY 30,000, a 3–5 minute introduction video and the applicable CSCA score for bachelor routes." : "Applicants must be non-Chinese citizens, at least 16 years old and high-school graduates. The 2026 guide requires authenticated highest education, passport valid for at least two years, in-China status documents where applicable, a medical record and a no-criminal record.",
    hasScholarship: false,
    badgeText: "2026 official route",
    displayTuition: `CNY ${tuition.toLocaleString("en-US")}/year`,
    displaySubjects: [route.nameEn],
    status: "active" as const,
    verificationStatus: "verified" as const,
    lastVerifiedAt: source.fetchedAt,
    ...sourceFields(source),
    sourceFieldLineage: {
      nameEn: "official 2026 program table",
      nameZh: "official 2026 guide or standard Chinese rendering of the official listed discipline",
      degreeLevel: "official guide title and program description",
      durationYears: "official guide duration",
      teachingLanguage: "official program table",
      ...(cscaSubjects ? { cscaSubjects: "official undergraduate program table", cscaRequirement: "official undergraduate program table" } : {}),
      ...(route.language.includes("Chinese") && degree ? { hskRequirement: "official degree-guide language table" } : {}),
      ...(route.language.includes("English") ? { englishRequirement: "official degree-guide language table" } : {}),
      tuitionAmount: "official 2026 fee table",
      applicationNote: "official 2026 eligibility, materials and fee sections",
    },
  };
});

const programIntakes = programs.map((program) => {
  const foundation = program.degreeLevel === "Foundation" || program.degreeLevel === "Language Program";
  const source = sources.get(routes.find((route) => `${schoolSlug}-${slugify(route.nameEn)}-${slugify(route.level)}${route.suffix ? `-${route.suffix}` : ""}` === program.slug)!.sourceId)!;
  return {
    programSlug: program.slug,
    intakeTerm: "2026 Entry",
    intakeYear: 2026,
    deadlineDate: foundation ? "2026-06-15T15:59:59.000Z" : "2026-07-01T15:59:59.000Z",
    deadlineLabel: foundation ? "The 2026 application deadline was June 15, 2026." : "The 2026 guide lists three rounds closing March 1, May 17 and July 1; CSC applicants could apply only in round one.",
    applicationRound: foundation ? "2026 foundation and language intake" : "2026 three-round degree intake",
    status: "closed" as const,
    ...sourceFields(source),
    sourceFieldLineage: { intakeTerm: "source-bounded cycle label; no semester inferred", intakeYear: "official guide title", deadlineDate: "official final deadline converted from Beijing end-of-day", deadlineLabel: "official application-date section", applicationRound: "official guide application schedule" },
  };
});

const generatedAt = hub.fetchedAt;
const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities: [city], schools: [school], programs, programIntakes, scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`Top-150 Wave 113 validation failed:\n${validation.errors.join("\n")}`);
const evidence = lockedSources.map((locked) => { const source = sources.get(locked.id)!; return { id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }; });
const review = {
  version: 1, status: "unreviewed_draft", generatedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 39, schoolSlugs: [schoolSlug], newSchools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: 0 },
  evidence,
  unresolved: [
    "No explicit 2027 inbound international degree guide was found on the official admissions hub as of October 26, 2026. No 2026 field is relabeled as 2027.",
    "The admissions hub summary says the second-round deadline is May 15, while each captured degree guide states May 17. Route records follow the program-specific PDFs and preserve this discrepancy for review.",
    "The separate undergraduate transfer guide is captured but is not modeled in this wave because transfer-year placement and credit recognition require a dedicated contract.",
    "The degree guides reference Chinese Government Scholarship eligibility in round one but do not state scholarship coverage. No scholarship record is inferred.",
    "These routes are closed 2026 evidence candidates and must not be presented as currently open 2027 routes.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Named contacts, email addresses, phone numbers and QR codes printed in the guides were excluded. Only institutional admissions facts are included." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-113");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 113, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
