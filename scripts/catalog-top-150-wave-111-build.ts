import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = {
  id: string;
  label: string;
  url: string;
  finalUrl?: string;
  fetchedAt: string;
  status: number;
  contentType: string;
  sha256: string;
  artifactPath: string;
};

type LockedSource = { run: string; id: string; sha256: string };

const root = process.cwd();
const lockedSources: LockedSource[] = [
  { run: "2026-10-26T05-19-53-439Z", id: "njust-international-undergraduate-admissions-index-2026", sha256: "115bfca59b75adb94f0f79fb8913be9b46898956ecfcdf98aae312329a39f184" },
  { run: "2026-10-26T05-20-02-951Z", id: "njust-international-undergraduate-programs-csca-pdf-2026", sha256: "04c47bd3c7f1253e38dbed0ea7a50eda4570c034e1444ebf4905b32e61106a66" },
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

const indexSource = sources.get("njust-international-undergraduate-admissions-index-2026")!;
const catalogSource = sources.get("njust-international-undergraduate-programs-csca-pdf-2026")!;
const sourceFields = (source: ManifestSource) => ({
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
});

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = dependency.cities?.find((row) => row.slug === "nanjing");
if (!city) throw new Error("Nanjing city dependency is missing.");

const schoolSlug = "nanjing-university-of-science-and-technology";
if (dependency.schools?.some((row) => row.slug === schoolSlug)) throw new Error("Nanjing University of Science and Technology already exists in the reviewed base.");

const school = {
  slug: schoolSlug,
  nameEn: "Nanjing University of Science and Technology",
  nameZh: "南京理工大学",
  citySlug: "nanjing",
  schoolType: "Science and engineering university",
  region: "Nanjing, Jiangsu, East China",
  applicationLevel: "Undergraduate",
  languageOfInstruction: "Chinese and English",
  deadlineSummary: "The official portal lists the 2026 international undergraduate guide. No 2027 international undergraduate guide or application dates were found as of October 26, 2026.",
  websiteUrl: "https://www.njust.edu.cn/",
  admissionsUrl: indexSource.finalUrl ?? indexSource.url,
  cscaRequired: true,
  cscaRequirement: "The 2026 official catalog publishes program-specific CSCA subject combinations for all 40 listed undergraduate routes.",
  subjectTags: ["Engineering", "Computer Science", "Materials", "Economics and Management", "Languages", "Design", "Law"],
  languageTags: ["Chinese", "English"],
  campusHighlights: ["40 official 2026 undergraduate routes", "36 Chinese-taught routes", "4 English-taught routes", "Program-specific CSCA subjects"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: catalogSource.fetchedAt,
  ...sourceFields(indexSource),
  sourceFieldLineage: {
    nameEn: "official 2026 undergraduate guide title",
    nameZh: "official 2026 undergraduate guide title",
    citySlug: "reviewed Nanjing city dependency",
    schoolType: "official institutional name and catalog scope",
    region: "reviewed Nanjing city dependency and CUAC geographic taxonomy",
    applicationLevel: "official 2026 undergraduate catalog title",
    languageOfInstruction: "official 2026 program catalog teaching-language column",
    deadlineSummary: "official portal freshness listing and absence of a published 2027 inbound guide",
    websiteUrl: "official university domain",
    admissionsUrl: "official international admissions portal guide entry",
    cscaRequirement: "official 2026 program catalog CSCA column",
    subjectTags: "official schools and majors in the 2026 catalog",
    languageTags: "official teaching-language column",
    campusHighlights: "official catalog row counts and teaching-language split",
  },
};

const stemChinese = ["STEM Chinese", "Mathematics (Chinese)", "Physics (Chinese)"];
const chemistryChinese = [...stemChinese, "Chemistry (Chinese)"];
const humanitiesChinese = ["Humanities Chinese", "Mathematics (Chinese)"];
const stemEnglish = ["Mathematics (English)", "Physics (English)"];
const chemistryEnglish = [...stemEnglish, "Chemistry (English)"];

type ProgramSpec = {
  nameEn: string;
  nameZh: string;
  school: string;
  category: string;
  language: "Chinese" | "English";
  subjects: string[];
};

const specs: ProgramSpec[] = [
  { nameEn: "Mechanical Engineering", nameZh: "机械工程", school: "School of Mechanical Engineering", category: "Engineering and Technology", language: "Chinese", subjects: stemChinese },
  { nameEn: "Vehicle Engineering", nameZh: "车辆工程", school: "School of Mechanical Engineering", category: "Engineering and Technology", language: "Chinese", subjects: stemChinese },
  { nameEn: "Industrial Engineering", nameZh: "工业工程", school: "School of Mechanical Engineering", category: "Engineering and Technology", language: "Chinese", subjects: stemChinese },
  { nameEn: "Robotics Engineering", nameZh: "机器人工程", school: "School of Mechanical Engineering", category: "Engineering and Technology", language: "Chinese", subjects: stemChinese },
  { nameEn: "Measurement & Control Technology and Instrumentation", nameZh: "测控技术与仪器", school: "School of Mechanical Engineering", category: "Engineering and Technology", language: "Chinese", subjects: stemChinese },
  { nameEn: "Aircraft Design and Engineering", nameZh: "飞行器设计与工程", school: "School of Mechanical Engineering", category: "Engineering and Technology", language: "Chinese", subjects: stemChinese },
  { nameEn: "Chemical Engineering and Technics", nameZh: "化学工程与工艺", school: "School of Chemistry and Chemical Engineering", category: "Engineering and Technology", language: "Chinese", subjects: chemistryChinese },
  { nameEn: "Pharmacy Engineering", nameZh: "制药工程", school: "School of Chemistry and Chemical Engineering", category: "Engineering and Technology", language: "Chinese", subjects: chemistryChinese },
  { nameEn: "Material Chemistry", nameZh: "材料化学", school: "School of Chemistry and Chemical Engineering", category: "Natural Sciences", language: "Chinese", subjects: chemistryChinese },
  { nameEn: "Polymer Materials and Engineering", nameZh: "高分子材料与工程", school: "School of Chemistry and Chemical Engineering", category: "Engineering and Technology", language: "Chinese", subjects: chemistryChinese },
  { nameEn: "Applied Chemistry", nameZh: "应用化学", school: "School of Chemistry and Chemical Engineering", category: "Natural Sciences", language: "Chinese", subjects: chemistryChinese },
  { nameEn: "Electronic and Information Engineering", nameZh: "电子信息工程", school: "School of Electronic and Optical Engineering", category: "Engineering and Technology", language: "Chinese", subjects: stemChinese },
  { nameEn: "Computer Science and Technology", nameZh: "计算机科学与技术", school: "School of Computer Science and Engineering", category: "Computer Science and IT", language: "Chinese", subjects: stemChinese },
  { nameEn: "Software Engineering", nameZh: "软件工程", school: "School of Computer Science and Engineering", category: "Computer Science and IT", language: "Chinese", subjects: stemChinese },
  { nameEn: "Intelligent Science and Technology", nameZh: "智能科学与技术", school: "School of Computer Science and Engineering", category: "Computer Science and IT", language: "Chinese", subjects: stemChinese },
  { nameEn: "International Economy and Trade", nameZh: "国际经济与贸易", school: "School of Economics & Management", category: "Economics and Management", language: "Chinese", subjects: humanitiesChinese },
  { nameEn: "Big Data Management and Application", nameZh: "大数据管理与应用", school: "School of Economics & Management", category: "Economics and Management", language: "Chinese", subjects: humanitiesChinese },
  { nameEn: "English", nameZh: "英语", school: "School of Foreign Studies", category: "Language and Culture", language: "Chinese", subjects: humanitiesChinese },
  { nameEn: "Language Science", nameZh: "语言学", school: "School of Foreign Studies", category: "Language and Culture", language: "Chinese", subjects: humanitiesChinese },
  { nameEn: "Japanese", nameZh: "日语", school: "School of Foreign Studies", category: "Language and Culture", language: "Chinese", subjects: humanitiesChinese },
  { nameEn: "Public Service Administration", nameZh: "公共事业管理", school: "School of Public Affairs", category: "Social Sciences", language: "Chinese", subjects: humanitiesChinese },
  { nameEn: "Social Work", nameZh: "社会工作", school: "School of Public Affairs", category: "Social Sciences", language: "Chinese", subjects: humanitiesChinese },
  { nameEn: "Materials Science and Engineering", nameZh: "材料科学与工程", school: "School of Materials Science and Engineering", category: "Engineering and Technology", language: "Chinese", subjects: chemistryChinese },
  { nameEn: "Material Physics", nameZh: "材料物理", school: "School of Materials Science and Engineering", category: "Natural Sciences", language: "Chinese", subjects: chemistryChinese },
  { nameEn: "Material Forming and Control Engineering", nameZh: "材料成型与控制工程", school: "School of Materials Science and Engineering", category: "Engineering and Technology", language: "Chinese", subjects: chemistryChinese },
  { nameEn: "Nanomaterials and Nanotechnology", nameZh: "纳米材料与技术", school: "School of Materials Science and Engineering", category: "Engineering and Technology", language: "Chinese", subjects: chemistryChinese },
  { nameEn: "Environmental Design", nameZh: "环境设计", school: "School of Design Arts & Media", category: "Arts and Design", language: "Chinese", subjects: humanitiesChinese },
  { nameEn: "Visual Communication Design", nameZh: "视觉传达设计", school: "School of Design Arts & Media", category: "Arts and Design", language: "Chinese", subjects: humanitiesChinese },
  { nameEn: "Industrial Design", nameZh: "工业设计", school: "School of Design Arts & Media", category: "Arts and Design", language: "Chinese", subjects: stemChinese },
  { nameEn: "Law", nameZh: "法学", school: "School of Intellectual Property", category: "Law", language: "Chinese", subjects: humanitiesChinese },
  { nameEn: "Information and Computing Science", nameZh: "信息与计算科学", school: "School of Mathematics & Statistics", category: "Natural Sciences", language: "Chinese", subjects: stemChinese },
  { nameEn: "Mathematics and Applied Mathematics", nameZh: "数学与应用数学", school: "School of Mathematics & Statistics", category: "Natural Sciences", language: "Chinese", subjects: stemChinese },
  { nameEn: "Applied Statistics", nameZh: "应用统计学", school: "School of Mathematics & Statistics", category: "Natural Sciences", language: "Chinese", subjects: stemChinese },
  { nameEn: "Microelectronics Science and Engineering", nameZh: "微电子科学与工程", school: "School of Microelectronics (School of Integrated Circuits)", category: "Engineering and Technology", language: "Chinese", subjects: stemChinese },
  { nameEn: "Security Engineering", nameZh: "安全工程", school: "School of Safety Science and Engineering (School of Emergency Management)", category: "Engineering and Technology", language: "Chinese", subjects: stemChinese },
  { nameEn: "Civil Engineering", nameZh: "土木工程", school: "School of Safety Science and Engineering (School of Emergency Management)", category: "Engineering and Technology", language: "Chinese", subjects: stemChinese },
  { nameEn: "Mechanical Engineering", nameZh: "机械工程", school: "School of Mechanical Engineering", category: "Engineering and Technology", language: "English", subjects: stemEnglish },
  { nameEn: "Software Engineering", nameZh: "软件工程", school: "School of Computer Science and Engineering", category: "Computer Science and IT", language: "English", subjects: stemEnglish },
  { nameEn: "International Economy and Trade", nameZh: "国际经济与贸易", school: "School of Economics & Management", category: "Economics and Management", language: "English", subjects: ["Mathematics (English)"] },
  { nameEn: "Nanomaterials and Nanotechnology", nameZh: "纳米材料与技术", school: "School of Materials Science and Engineering", category: "Engineering and Technology", language: "English", subjects: chemistryEnglish },
];

if (specs.length !== 40 || specs.filter((row) => row.language === "Chinese").length !== 36 || specs.filter((row) => row.language === "English").length !== 4) {
  throw new Error("Expected exactly 40 NJUST programs: 36 Chinese-taught and 4 English-taught.");
}

const slugify = (value: string) => value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const programs = specs.map((spec) => ({
  slug: `${schoolSlug}-${slugify(spec.nameEn)}${spec.language === "English" ? "-english-taught" : ""}`,
  schoolSlug,
  citySlug: "nanjing",
  nameEn: spec.nameEn,
  nameZh: spec.nameZh,
  degreeLevel: "Undergraduate",
  fieldCategory: spec.category,
  subjectArea: spec.school,
  teachingLanguage: spec.language,
  cscaSubjects: spec.subjects,
  cscaRequirement: `2026 CSCA required subjects: ${spec.subjects.join(", ")}.`,
  applicationNote: spec.language === "English"
    ? "The official 2026 catalog states that an English-taught undergraduate major opens only if enrollment reaches at least eight students; final placement is subject to the admission notice."
    : "Listed in the official 2026 international undergraduate program catalog. Application dates, tuition, duration and language thresholds are not stated in this catalog and are not inferred.",
  badgeText: `2026 ${spec.language}-taught`,
  displaySubjects: spec.subjects,
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: catalogSource.fetchedAt,
  ...sourceFields(catalogSource),
  sourceFieldLineage: {
    nameEn: "official 2026 program catalog major column",
    nameZh: "official 2026 program catalog major column",
    degreeLevel: "official 2026 undergraduate catalog title",
    fieldCategory: "official school/major identity mapped to CUAC taxonomy",
    subjectArea: "official 2026 school column",
    teachingLanguage: "official 2026 teaching-language column",
    cscaSubjects: "official 2026 CSCA required-subjects column",
    cscaRequirement: "official 2026 CSCA required-subjects column",
    applicationNote: spec.language === "English" ? "official catalog English-program minimum-enrollment note" : "official catalog scope and absence of application-detail fields",
    badgeText: "official catalog cycle and teaching language",
    displaySubjects: "official CSCA required-subjects column",
  },
}));

if (new Set(programs.map((row) => row.slug)).size !== programs.length) throw new Error("NJUST program slugs are not unique.");

const generatedAt = catalogSource.fetchedAt;
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt,
  cities: [city],
  schools: [school],
  programs,
  programIntakes: [],
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`Top-150 Wave 111 validation failed:\n${validation.errors.join("\n")}`);

const evidence = lockedSources.map((locked) => {
  const source = sources.get(locked.id)!;
  return { id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 };
});
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 36, schoolSlugs: [schoolSlug], newSchools: 1, programs: 40, programIntakes: 0, scholarships: 0 },
  evidence,
  unresolved: [
    "No explicit 2027 inbound international undergraduate guide or catalog was found on the current official portal as of October 26, 2026. No 2026 fact is relabeled as 2027.",
    "The official 2026 program catalog does not publish application opening dates, deadlines, tuition, duration, HSK or English-language thresholds. Those fields remain absent.",
    "The official English guide endpoint returned an anti-bot response with HTTP 202 during deterministic collection. No claims are taken from that response; only the HTTP 200 portal index and PDF catalog are evidence for this candidate.",
    "The catalog title establishes the 2026 admissions catalog but does not state an intake term. No programIntake records are inferred.",
    "The four English-taught majors require at least eight enrolled students to open; final placement remains subject to the admission notice.",
    "Scholarship guides are listed separately by the official portal, but scholarship details are outside this program-catalog candidate and remain pending a dedicated capture and review.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public institutional catalog facts are included; no applicant data or personal contact details are present." },
};

const stem = resolve(root, "seeds/catalog.2027-wave-111");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({ ok: true, wave: 111, candidateSha256, counts: validation.summary, teachingLanguages: { Chinese: 36, English: 4 }, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
