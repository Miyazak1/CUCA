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
  sha256: string;
  artifactPath: string;
};

const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/2026-10-26T04-20-19-832Z");
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { generatedAt: string; sources: ManifestSource[] };
const expected = new Map([
  ["ustb-international-nondegree-admissions-2027", "9e60587e685aa80ac56b53767c6781db608ddc67faec3adbaae1f4c14b7312aa"],
  ["dhu-full-time-comprehensive-chinese-spring-2027", "12993ea469dc2eb9d3e83628ca0b88dbc9961c4ea15c2ee60e9e9cf8cbebfcb6"],
]);
const evidence = new Map<string, ManifestSource>();
for (const [id, sha256] of expected) {
  const source = manifest.sources.find((row) => row.id === id && row.status === 200 && row.sha256 === sha256);
  if (!source) throw new Error(`Missing locked official evidence ${id} at ${sha256}.`);
  const artifact = await readFile(resolve(runRoot, source.artifactPath));
  if (createHash("sha256").update(artifact).digest("hex") !== sha256) throw new Error(`Evidence hash mismatch: ${id}.`);
  evidence.set(id, source);
}
const sourceFields = (id: string) => {
  const source = evidence.get(id);
  if (!source) throw new Error(`Missing source ${id}.`);
  return { sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
};

const ustbSourceId = "ustb-international-nondegree-admissions-2027";
const dhuSourceId = "dhu-full-time-comprehensive-chinese-spring-2027";
const ustbSource = evidence.get(ustbSourceId)!;
const dhuSource = evidence.get(dhuSourceId)!;
const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;

const ustbSlug = "university-of-science-and-technology-beijing";
const ustbBase = dependency.schools?.find((row) => row.slug === ustbSlug);
const beijing = dependency.cities?.find((row) => row.slug === "beijing");
if (!ustbBase || !beijing) throw new Error("USTB or Beijing dependency is missing.");
const ustbLanguageSlug = `${ustbSlug}-chinese-language`;
const ustbFoundationSlug = `${ustbSlug}-pre-university`;
for (const slug of [ustbLanguageSlug, ustbFoundationSlug]) {
  if (dependency.programs?.some((row) => row.slug === slug)) throw new Error(`Program ${slug} already exists in the base.`);
}

const ustbSchool = {
  ...ustbBase,
  applicationLevel: "Undergraduate, Master, Doctoral and Non-degree Chinese Language / Pre-university",
  deadlineSummary: "2027 Chinese-language applications run October-December 2026 for Spring and February-June 2027 for Fall; 2027 pre-university applications run November 2026-June 2027. Exact day deadlines are not published. Degree routes retain their separate official deadlines.",
  tuitionSummary: "2027 Chinese Language: CNY 8,320/semester. Pre-university: CNY 23,300/year. Both publish a CNY 600 application fee; accommodation is CNY 1,500/month for a double room or CNY 750/month for a four-person room.",
  applicationFee: "CNY 600 for the 2027 non-degree routes",
  admissionsUrl: sourceFields(ustbSourceId).sourceUrl,
  subjectTags: Array.from(new Set([...(ustbBase.subjectTags ?? []), "Chinese Language", "Pre-university", "CSCA Preparation"])),
  campusHighlights: Array.from(new Set([...(ustbBase.campusHighlights ?? []), "2027 Spring and Fall Chinese-language routes", "2027-2028 pre-university route"])),
  contactNotes: "International Student Center, 30 Xueyuan Road, Haidian District, Beijing 100083; feixueli@ustb.edu.cn; +86-10-62332037.",
  lastVerifiedAt: ustbSource.fetchedAt,
  ...sourceFields(ustbSourceId),
  sourceFieldLineage: {
    ...(ustbBase.sourceFieldLineage ?? {}),
    applicationLevel: "official 2027 international non-degree guide",
    deadlineSummary: "official guide program tables; month-level periods retained without invented day dates",
    tuitionSummary: "official guide fee table",
    applicationFee: "official guide fee table",
    admissionsUrl: "official 2027 non-degree guide",
    campusHighlights: "official guide program schedule",
    contactNotes: "official guide contact section",
  },
};

const ustbLanguageProgram = {
  slug: ustbLanguageSlug,
  schoolSlug: ustbSlug,
  citySlug: "beijing",
  nameEn: "Chinese Language Visiting Program",
  nameZh: "汉语言进修项目",
  degreeLevel: "Non-degree",
  fieldCategory: "Language",
  subjectArea: "Chinese Language and Chinese Culture",
  teachingLanguage: "Chinese",
  tuitionAmount: 8320,
  tuitionCurrency: "CNY",
  tuitionPeriod: "semester",
  tuitionText: "CNY 8,320 per semester; CNY 600 non-refundable application fee; insurance CNY 400/semester or CNY 800/year; accommodation CNY 1,500/month/bed in a double room or CNY 750/month/bed in a four-person room, subject to 2027 availability.",
  scholarshipText: "The guide names Chinese Government Scholarship Type A and the International Chinese Language Teachers Scholarship for eligible one-semester or one-year Chinese study. Coverage includes tuition, accommodation, living allowance and medical insurance; award-specific amounts and a fixed university deadline are not printed on this page.",
  applicationUrl: "https://onlineapply.ustb.edu.cn",
  applicationNote: "One-semester Spring and Fall options and a one-academic-year Fall option are published. Beginner, intermediate and advanced classes receive 20 hours per week; semester routes total 320 hours and the academic-year route totals 640 hours.",
  hasScholarship: true,
  badgeText: "2027 Spring + Fall",
  displayTuition: "CNY 8,320/semester",
  displaySubjects: ["Comprehensive Chinese", "Listening and Speaking", "Reading and Writing", "Chinese Culture"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: ustbSource.fetchedAt,
  ...sourceFields(ustbSourceId),
  sourceFieldLineage: {
    nameEn: "translated from official 2027 Chinese-language project title",
    nameZh: "official guide project title",
    degreeLevel: "official non-degree guide classification",
    fieldCategory: "official Chinese-language program table",
    subjectArea: "official program table curriculum",
    teachingLanguage: "official program and fee tables",
    tuitionAmount: "official guide fee table",
    tuitionText: "official guide fee table and accommodation note",
    scholarshipText: "official guide Chinese-language scholarship section",
    applicationUrl: "official guide application process",
    applicationNote: "official guide schedule and curriculum tables",
  },
};

const ustbFoundationProgram = {
  slug: ustbFoundationSlug,
  schoolSlug: ustbSlug,
  citySlug: "beijing",
  nameEn: "Pre-university Program",
  nameZh: "预科项目",
  degreeLevel: "Pre-university",
  durationYears: 1,
  fieldCategory: "Foundation",
  subjectArea: "Chinese Language, Chinese Culture and CSCA Preparation",
  teachingLanguage: "Chinese",
  cscaRequirement: "The curriculum includes CSCA examination-related courses and completion assessment before progression to an eligible undergraduate major.",
  hskRequirement: "Applicants submit an HSK certificate when available; applicants without a language certificate state their current Chinese level. The page does not publish a minimum entry HSK score for self-funded admission.",
  tuitionAmount: 23300,
  tuitionCurrency: "CNY",
  tuitionPeriod: "year",
  tuitionText: "CNY 23,300/year; CNY 600 non-refundable application fee; insurance CNY 800/year; accommodation CNY 1,500/month/bed in a double room or CNY 750/month/bed in a four-person room, subject to 2027 availability.",
  scholarshipText: "The 2027 guide names Beijing Government Scholarship A, B and C routes. A requires a key-high-school average of at least 85/GPA 3.6; B/C require at least 80/GPA 3.0. Applicants must be no older than 24 and have at least HSK Level 3. Award coverage amounts are not printed on this page.",
  applicationUrl: "https://onlineapply.ustb.edu.cn",
  applicationNote: "The one-year route runs September 2027-July 2028, publishes 40 hours per week and 1,280 total hours, and prepares students for assessment and progression to the guide's listed undergraduate majors.",
  hasScholarship: true,
  badgeText: "2027-2028",
  displayTuition: "CNY 23,300/year",
  displaySubjects: ["Chinese Language", "Chinese Culture", "CSCA Preparation"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: ustbSource.fetchedAt,
  ...sourceFields(ustbSourceId),
  sourceFieldLineage: {
    nameEn: "official 2027 pre-university program table",
    nameZh: "official guide project title",
    degreeLevel: "official pre-university classification",
    durationYears: "official September 2027-July 2028 schedule",
    fieldCategory: "official pre-university program table",
    subjectArea: "official curriculum",
    teachingLanguage: "official program and fee tables",
    cscaRequirement: "official curriculum and completion assessment",
    hskRequirement: "official application-material table; no minimum self-funded score inferred",
    tuitionAmount: "official fee table",
    tuitionText: "official fee table and accommodation note",
    scholarshipText: "official guide Beijing Government Scholarship section",
    applicationUrl: "official application process",
    applicationNote: "official schedule, hours and progression table",
  },
};

const ustbIntakes = [
  {
    programSlug: ustbLanguageSlug,
    intakeTerm: "Spring",
    intakeYear: 2027,
    deadlineLabel: "Apply during October-December 2026; study runs March-July 2027. The official guide does not publish exact opening or closing days.",
    applicationRound: "USTB 2027 Spring one-semester Chinese Language Program",
    status: "open" as const,
    ...sourceFields(ustbSourceId),
    sourceFieldLineage: { intakeTerm: "official program table", intakeYear: "official program table", deadlineLabel: "official month-level application and study periods", applicationRound: "official guide scope" },
  },
  {
    programSlug: ustbLanguageSlug,
    intakeTerm: "Fall",
    intakeYear: 2027,
    deadlineLabel: "Apply during February-June 2027; semester study runs September 2027-January 2028 and the one-academic-year option runs through July 2028. Exact opening and closing days are not published.",
    applicationRound: "USTB 2027 Fall Chinese Language Program",
    status: "open" as const,
    ...sourceFields(ustbSourceId),
    sourceFieldLineage: { intakeTerm: "official program table", intakeYear: "official program table", deadlineLabel: "official month-level application and study periods", applicationRound: "official guide scope" },
  },
  {
    programSlug: ustbFoundationSlug,
    intakeTerm: "Fall",
    intakeYear: 2027,
    deadlineLabel: "Apply during November 2026-June 2027; study runs September 2027-July 2028. Exact opening and closing days are not published.",
    applicationRound: "USTB 2027-2028 Pre-university Program",
    status: "open" as const,
    ...sourceFields(ustbSourceId),
    sourceFieldLineage: { intakeTerm: "official program table", intakeYear: "official program table", deadlineLabel: "official month-level application and study periods", applicationRound: "official guide title and schedule" },
  },
];

const dhuSlug = "donghua-university";
const dhuBase = dependency.schools?.find((row) => row.slug === dhuSlug);
const shanghai = dependency.cities?.find((row) => row.slug === "shanghai");
if (!dhuBase || !shanghai) throw new Error("Donghua University or Shanghai dependency is missing.");
const dhuProgramSlug = `${dhuSlug}-full-time-comprehensive-chinese`;
if (dependency.programs?.some((row) => row.slug === dhuProgramSlug)) throw new Error(`Program ${dhuProgramSlug} already exists in the base.`);

const dhuSchool = {
  ...dhuBase,
  applicationLevel: "Undergraduate, Master, Doctoral and Non-degree Chinese Language",
  deadlineSummary: "The 2027 Full-time Comprehensive Chinese program closes December 31, 2026 for Spring and June 30, 2027 for Fall. Other degree and scholarship routes retain their own deadlines.",
  tuitionSummary: "2027 Full-time Comprehensive Chinese tuition is CNY 10,800/semester, with published continuation discounts from the second consecutive semester. Other degree routes retain their separate fees.",
  applicationFee: "CNY 600 for the Full-time Comprehensive Chinese program, with published referral and continuing-study waivers",
  admissionsUrl: sourceFields(dhuSourceId).sourceUrl,
  subjectTags: Array.from(new Set([...(dhuBase.subjectTags ?? []), "Chinese Language", "Chinese Culture", "HSK Preparation"])),
  campusHighlights: Array.from(new Set([...(dhuBase.campusHighlights ?? []), "2027 Spring and Fall full-time Chinese program at Yan'an Road Campus"])),
  contactNotes: "International Education Center Admissions and Development Section, Room 121, 1882 West Yan'an Road, Shanghai; iec@dhu.edu.cn; +86-21-62378595/62379336.",
  lastVerifiedAt: dhuSource.fetchedAt,
  ...sourceFields(dhuSourceId),
  sourceFieldLineage: {
    ...(dhuBase.sourceFieldLineage ?? {}),
    applicationLevel: "official 2027 full-time Chinese program",
    deadlineSummary: "official Spring and Fall 2027 program table",
    tuitionSummary: "official fee and continuation-discount section",
    applicationFee: "official fee and waiver section",
    admissionsUrl: "official current program page with explicit 2027 sessions",
    campusHighlights: "official program location and schedule",
    contactNotes: "official contact section",
  },
};

const dhuProgram = {
  slug: dhuProgramSlug,
  schoolSlug: dhuSlug,
  citySlug: "shanghai",
  nameEn: "Full-time Comprehensive Chinese Program (Program A)",
  nameZh: "全日制综合汉语项目（项目A）",
  degreeLevel: "Non-degree",
  fieldCategory: "Language",
  subjectArea: "Comprehensive Chinese Language and Culture",
  teachingLanguage: "Chinese",
  tuitionAmount: 10800,
  tuitionCurrency: "CNY",
  tuitionPeriod: "semester",
  tuitionText: "CNY 10,800 for the first semester; continuation tuition is CNY 10,200 for the second consecutive semester, CNY 9,800 for the third and CNY 9,400 from the fourth. Application fee CNY 600 and insurance CNY 400/semester.",
  scholarshipText: "The page publishes referral and consecutive-study fee reductions, not a scholarship award. First-time applicants referred by a current or former Donghua international student may receive an application-fee waiver.",
  applicationUrl: "https://admissions.dhu.edu.cn/index",
  applicationNote: "Applicants must be non-Chinese citizens age 16-55 and in good physical and mental health. Classes run Monday-Friday, 9:00-12:15, with up to nine placement levels from introductory through HSK 6 preparation. Required uploads are the passport information page and a current ID photo; visa/entry pages are also required for applicants already in China.",
  hasScholarship: false,
  badgeText: "2027 Spring + Fall",
  displayTuition: "CNY 10,800/semester",
  displaySubjects: ["Reading and Writing", "Listening and Speaking", "Practical Chinese", "HSK Preparation", "Chinese Culture"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: dhuSource.fetchedAt,
  ...sourceFields(dhuSourceId),
  sourceFieldLineage: {
    nameEn: "official bilingual program heading",
    nameZh: "official program heading",
    degreeLevel: "official semester language-program scope",
    fieldCategory: "official program description",
    subjectArea: "official program description and timetable",
    teachingLanguage: "official Chinese-language program",
    tuitionAmount: "official fee section",
    tuitionText: "official fee and continuation-discount section",
    scholarshipText: "official fee-waiver section; not represented as a scholarship entity",
    applicationUrl: "official application procedure",
    applicationNote: "official eligibility, schedule, levels and materials sections",
  },
};

const dhuIntakes = [
  {
    programSlug: dhuProgramSlug,
    intakeTerm: "Spring",
    intakeYear: 2027,
    deadlineDate: "2026-12-31T15:59:59.000Z",
    deadlineLabel: "Apply by December 31, 2026; study runs March 1-June 18, 2027 and registration is February 24-25.",
    applicationRound: "Donghua University 2027 Spring Full-time Comprehensive Chinese Program",
    status: "open" as const,
    ...sourceFields(dhuSourceId),
    sourceFieldLineage: { intakeTerm: "official 2027 program table", intakeYear: "official 2027 program table", deadlineDate: "official deadline converted from Beijing end-of-day", deadlineLabel: "official study, deadline and registration dates", applicationRound: "official program heading and Spring schedule" },
  },
  {
    programSlug: dhuProgramSlug,
    intakeTerm: "Fall",
    intakeYear: 2027,
    deadlineDate: "2027-06-30T15:59:59.000Z",
    deadlineLabel: "Apply by June 30, 2027; study runs September 6-December 24, 2027 and registration is September 1-2.",
    applicationRound: "Donghua University 2027 Fall Full-time Comprehensive Chinese Program",
    status: "open" as const,
    ...sourceFields(dhuSourceId),
    sourceFieldLineage: { intakeTerm: "official 2027 program table", intakeYear: "official 2027 program table", deadlineDate: "official deadline converted from Beijing end-of-day", deadlineLabel: "official study, deadline and registration dates", applicationRound: "official program heading and Fall schedule" },
  },
];

const generatedAt = [...evidence.values()].map((row) => row.fetchedAt).sort().at(-1) ?? manifest.generatedAt;
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt,
  cities: [beijing, shanghai],
  schools: [ustbSchool, dhuSchool],
  programs: [ustbLanguageProgram, ustbFoundationProgram, dhuProgram],
  programIntakes: [...ustbIntakes, ...dhuIntakes],
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 Wave 107 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [ustbSlug, dhuSlug], refreshedSchools: 2, programs: 3, programIntakes: 5, scholarships: 0 },
  evidence: [...evidence.values()].map((row) => ({ id: row.id, label: row.label, url: row.finalUrl ?? row.url, fetchedAt: row.fetchedAt, sha256: row.sha256 })),
  unresolved: [
    "USTB publishes month-level application periods for all three candidate rounds but not exact opening or closing days. No openDate or deadlineDate is invented for those intakes.",
    "The USTB guide names scholarship routes and coverage but does not publish complete 2027 award-specific amounts and deadlines on this page. Existing scholarship records are not overwritten and no new scholarship entity is inferred.",
    "Donghua publishes application-fee and continuation-tuition reductions rather than a scholarship award; these are retained as program fee rules, not converted into a scholarship entity.",
    "General Fall 2027 degree admissions for both universities remain source-bounded to their separate existing records and are not inferred from these non-degree guides.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public institutional admissions facts and public office contact details are included; no applicant or account data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-107");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 107, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
