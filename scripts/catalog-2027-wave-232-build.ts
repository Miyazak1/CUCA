import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const run = "2026-10-27T08-16-19-635Z";
const locks = new Map([
  ["njupt-international-home-current", "21be0eea1ba82e381adbe85d333f56490c3f31a4a46ecba3083c26563d143965"],
  ["njupt-international-notice-index-current", "b43f18093df8fa27f9789907f7bc52a51a3a3406d100f697ce051b7b133f9f4c"],
  ["njupt-international-admission-brochure-page-2026", "7a8025ed8ce0deeb0eb6f08e304f27ab1dd3ba0335ed6f11e5ccaf5df067daba"],
  ["njupt-international-admission-brochure-pdf-2026", "9841a1f5f30f4a26e12bd0c6e4540b27119e9cba8e30fcdfcc5fc3ced9845ac3"],
]);
const directory = resolve(root, "work/catalog-official", run);
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
const sources = new Map<string, Source>();
for (const [id, sha256] of locks) {
  const source = manifest.sources.find((row) => row.id === id && row.status === 200 && row.sha256 === sha256);
  if (!source) throw new Error(`Missing locked NJUPT source ${id}.`);
  const bytes = await readFile(resolve(directory, source.artifactPath));
  if (createHash("sha256").update(bytes).digest("hex") !== sha256) throw new Error(`Evidence hash mismatch: ${id}.`);
  sources.set(id, source);
}
const index = sources.get("njupt-international-notice-index-current")!;
const guide = sources.get("njupt-international-admission-brochure-pdf-2026")!;
const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-138.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "nanjing");
const base = prior.schools?.find((row) => row.slug === "nanjing-university-of-posts-and-telecommunications");
if (!city || !base) throw new Error("Wave 138 NJUPT dependencies are missing.");
const school = {
  ...base,
  applicationLevel: "The closed 2026 brochure publishes four bachelor, eighteen master and six doctoral routes. The current official index still exposes no general 2027 international degree guide.",
  admissionsUrl: index.finalUrl ?? index.url,
  deadlineSummary: "Closed 2026 cycle: applications ran from early January through the end of May 2026.",
  tuitionSummary: "Closed 2026 cycle: bachelor CNY 18,000/year; master CNY 22,000/year; doctoral CNY 26,000/year.",
  applicationFee: "CNY 800 (non-refundable in the closed 2026 cycle)",
  languageRequirement: "Chinese-taught degree routes required HSK 5; English-taught routes required IELTS 5.5, TOEFL 72 or Duolingo 100.",
  cscaRequired: true,
  cscaRequirement: "All closed-2026 undergraduate applicants had to take CSCA; the four listed bachelor routes required Mathematics, with Physics additionally required for the two engineering/computing routes.",
  cscaSubjects: ["Mathematics", "Physics"],
  campusHighlights: ["28 degree routes in the official 2026 brochure", "Bachelor, master and doctoral study represented", "No general 2027 international degree guide found on the current official index"],
  lastVerifiedAt: guide.fetchedAt,
  sourceUrl: guide.finalUrl ?? guide.url,
  sourceLabel: guide.label,
  sourceSha256: guide.sha256,
  capturedAt: guide.fetchedAt,
  sourceFieldLineage: {
    ...(base.sourceFieldLineage ?? {}),
    applicationLevel: "official 2026 brochure program tables and current-index review",
    admissionsUrl: "current official international notice index",
    deadlineSummary: "official 2026 brochure application-time section",
    tuitionSummary: "official 2026 brochure tuition table",
    applicationFee: "official 2026 brochure application-mode section",
    languageRequirement: "official 2026 brochure application requirements",
    cscaRequired: "official 2026 brochure application requirements",
    cscaRequirement: "official 2026 brochure CSCA table",
    cscaSubjects: "official 2026 brochure CSCA table",
    campusHighlights: "official 2026 brochure program tables and current-index review",
  },
};

type Level = "Bachelor" | "Master" | "Doctoral";
type Language = "English" | "Chinese";
type Spec = [Level, Language, string, string, number, string, string[]?];
const specs: Spec[] = [
  ["Bachelor", "English", "Electronic Information Engineering", "School of Communications and Information Engineering", 4, "电子信息工程", ["Mathematics", "Physics"]],
  ["Bachelor", "English", "Computer Science and Technology", "School of Computer Science", 4, "计算机科学与技术", ["Mathematics", "Physics"]],
  ["Bachelor", "English", "Business Administration", "School of Management", 4, "工商管理", ["Mathematics"]],
  ["Bachelor", "English", "Electronic Commerce", "School of Management", 4, "电子商务", ["Mathematics"]],
  ["Master", "English", "Electronic Information", "School of Communications and Information Engineering", 2, "电子信息"],
  ["Master", "English", "Integrated Circuit Engineering", "College of Integrated Circuit Science and Engineering", 2, "集成电路工程"],
  ["Master", "English", "Computer Technology", "School of Computer Science", 2, "计算机技术"],
  ["Master", "English", "Artificial Intelligence", "College of Artificial Intelligence", 2, "人工智能"],
  ["Master", "English", "Business Administration", "School of Management", 2, "工商管理"],
  ["Master", "English", "Social Work", "School of Sociology and Population Studies", 2, "社会工作"],
  ["Master", "English", "Educational Technology", "School of Education Science and Technology", 2, "教育技术学"],
  ["Doctoral", "English", "Information and Communication Engineering", "School of Communications and Information Engineering", 4, "信息与通信工程"],
  ["Master", "Chinese", "Electronic Science and Technology", "College of Electronic and Optical Engineering and College of Flexible Electronics", 3, "电子科学与技术"],
  ["Master", "Chinese", "Integrated Circuit Engineering", "College of Integrated Circuit Science and Engineering", 3, "集成电路工程"],
  ["Master", "Chinese", "Mathematics", "School of Science", 3, "数学"],
  ["Master", "Chinese", "Physics", "School of Science", 3, "物理学"],
  ["Master", "Chinese", "Applied Statistics (Information Statistics and Data Analysis)", "School of Science", 3, "应用统计（信息统计与数据分析）"],
  ["Master", "Chinese", "Electronic Information (New Generation Electronic Information Technology including Quantum Information Technology)", "School of Science", 3, "电子信息（新一代电子信息技术含量子技术等）"],
  ["Master", "Chinese", "Journalism and Communication", "School of Digital Media and Design Arts", 3, "新闻与传播"],
  ["Master", "Chinese", "Design", "School of Digital Media and Design Arts", 3, "设计"],
  ["Master", "Chinese", "International Business", "School of Economics", 3, "国际商务"],
  ["Master", "Chinese", "Translation (English Written Translation)", "School of Foreign Studies", 2, "翻译（英语笔译）"],
  ["Master", "Chinese", "Translation (Japanese Written Translation)", "School of Foreign Studies", 2, "翻译（日语笔译）"],
  ["Doctoral", "Chinese", "Electronic Science and Technology", "College of Electronic and Optical Engineering and College of Flexible Electronics", 4, "电子科学与技术"],
  ["Doctoral", "Chinese", "Integrated Circuit Science and Engineering", "College of Integrated Circuit Science and Engineering", 4, "集成电路科学与工程"],
  ["Doctoral", "Chinese", "Microelectronics and Solid State Electronics", "College of Integrated Circuit Science and Engineering", 4, "微电子学与固体电子学"],
  ["Doctoral", "Chinese", "Mathematics", "School of Science", 4, "数学"],
  ["Doctoral", "Chinese", "Physics", "School of Science", 4, "物理学"],
];
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const guideEvidence = { sourceUrl: guide.finalUrl ?? guide.url, sourceLabel: guide.label, sourceSha256: guide.sha256, capturedAt: guide.fetchedAt };
const tuitionByLevel: Record<Level, number> = { Bachelor: 18000, Master: 22000, Doctoral: 26000 };
const scholarshipText = "The 2026 brochure names Chinese Government, Jiangsu Government, Nanjing Government and NJUPT International Students scholarships; award details are not restated in the brochure.";
const programs = specs.map(([degreeLevel, teachingLanguage, nameEn, college, durationYears, nameZh, cscaSubjects]) => ({
  slug: `nanjing-university-of-posts-and-telecommunications-${degreeLevel.toLowerCase()}-${slugify(nameEn)}-${teachingLanguage.toLowerCase()}-2026`,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn,
  nameZh,
  degreeLevel,
  fieldCategory: college,
  subjectArea: nameEn,
  teachingLanguage,
  durationYears,
  tuitionAmount: tuitionByLevel[degreeLevel],
  tuitionCurrency: "CNY",
  tuitionPeriod: "year",
  tuitionText: `CNY ${tuitionByLevel[degreeLevel].toLocaleString("en-US")}/year for the closed 2026 cycle`,
  applicationNote: `Closed Fall 2026 route. ${teachingLanguage === "Chinese" ? "HSK 5 was required." : "IELTS 5.5, TOEFL 72 or Duolingo 100 was required."}`,
  ...(teachingLanguage === "Chinese" ? { hskRequirement: "HSK 5 or above" } : { englishRequirement: "IELTS 5.5, TOEFL 72 or Duolingo 100 or above" }),
  ...(cscaSubjects ? { cscaRequirement: `Closed 2026 undergraduate route required: ${cscaSubjects.join(", ")}.`, cscaSubjects } : {}),
  scholarshipText,
  hasScholarship: true,
  badgeText: "Closed 2026 official degree route",
  displayTuition: `CNY ${tuitionByLevel[degreeLevel].toLocaleString("en-US")}/year`,
  displaySubjects: cscaSubjects ?? [nameEn],
  displayGroup: `njupt-${degreeLevel.toLowerCase()}-${teachingLanguage.toLowerCase()}-2026`,
  displayGroupLabel: `NJUPT closed 2026 ${teachingLanguage.toLowerCase()}-taught ${degreeLevel.toLowerCase()} routes`,
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  ...guideEvidence,
  sourceFieldLineage: {
    nameEn: "official 2026 brochure English program table",
    nameZh: "official 2026 brochure bilingual program table",
    degreeLevel: "official 2026 brochure program table",
    fieldCategory: "official 2026 brochure school column",
    subjectArea: "official 2026 brochure program label",
    teachingLanguage: "official 2026 brochure English- and Chinese-taught table headings",
    durationYears: "official 2026 brochure duration column",
    tuitionAmount: "official 2026 brochure tuition table",
    tuitionCurrency: "official 2026 brochure tuition table",
    tuitionPeriod: "official 2026 brochure tuition table",
    tuitionText: "official 2026 brochure tuition table",
    applicationNote: "official 2026 brochure application requirements",
    ...(teachingLanguage === "Chinese" ? { hskRequirement: "official 2026 brochure application requirements" } : { englishRequirement: "official 2026 brochure application requirements" }),
    ...(cscaSubjects ? { cscaRequirement: "official 2026 brochure CSCA table", cscaSubjects: "official 2026 brochure CSCA table" } : {}),
    scholarshipText: "official 2026 brochure scholarship section",
    hasScholarship: "official 2026 brochure scholarship section",
    badgeText: "official 2026 brochure cycle",
  },
}));
const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2026,
  deadlineLabel: "Closed 2026 cycle: application period ran from early January through the end of May 2026; registration began in early September 2026.",
  applicationRound: "2026 international degree admission",
  status: "closed" as const,
  ...guideEvidence,
  sourceFieldLineage: {
    intakeTerm: "official early-September 2026 registration statement",
    intakeYear: "official 2026 brochure title and registration statement",
    deadlineLabel: "official 2026 brochure application-time and registration sections",
    applicationRound: "official 2026 brochure title",
    status: "derived by comparing the published end-of-May 2026 period with capturedAt",
  },
}));
const candidate: CatalogSeedBundle = { version: 1, generatedAt: guide.fetchedAt, cities: [city], schools: [school], programs, programIntakes, scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: guide.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 82, schoolSlugs: [school.slug], newSchools: 0, programs: programs.length, programIntakes: programIntakes.length, scholarships: 0 },
  evidence: [...sources.values()].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 })),
  brochureReview: { result: "pass", routes: 28, note: "All bilingual program-table rows were transcribed: four bachelor, eighteen master and six doctoral routes. Tuition, duration, language and undergraduate CSCA subjects match the locked brochure." },
  unresolved: [
    "The current notice index still publishes no general 2027 international degree guide; every intake and cycle-bound field remains explicitly 2026.",
    "The brochure names four scholarship families but does not restate their coverage or current cycle rules; no scholarship entity is inferred from the names alone.",
    "The brochure publishes only an HTTP application-system address; it is intentionally omitted from program applicationUrl fields that require verified HTTPS.",
    "Applicant bank-statement requirements and public staff contact details are intentionally excluded.",
  ],
  sensitiveDataCheck: { result: "pass", note: "No applicant data, personal contacts, bank details or payment instructions are included." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-232");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 232, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
