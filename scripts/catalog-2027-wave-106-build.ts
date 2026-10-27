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

const root = process.cwd();
const locks = [
  {
    runRoot: "work/catalog-official/2026-10-26T04-11-46-706Z",
    id: "jlu-chinese-language-and-culture-program-2027",
    sha256: "db16bd2c4496017ac160a9d308147e8479e9b2a5e18b13a9f8ecc1a40efa215b",
  },
  {
    runRoot: "work/catalog-official/2026-10-26T04-13-27-474Z",
    id: "jlu-chinese-language-and-culture-fees-2027",
    sha256: "afaff60eed4e5bd64dc0a30334e50af04c4a4a773d567057ebb82f74d51226b8",
  },
  {
    runRoot: "work/catalog-official/2026-10-26T04-11-46-706Z",
    id: "ywicc-international-chinese-language-spring-2027",
    sha256: "a12a015c1c322efd4649e0f9c747922727f0bffdf6eff3bbf8fe6cca962c15e4",
  },
] as const;

const evidence = new Map<string, ManifestSource>();
for (const lock of locks) {
  const runRoot = resolve(root, lock.runRoot);
  const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
  const source = manifest.sources.find((row) => row.id === lock.id && row.status === 200 && row.sha256 === lock.sha256);
  if (!source) throw new Error(`Missing locked official evidence ${lock.id} at ${lock.sha256}.`);
  const artifact = await readFile(resolve(runRoot, source.artifactPath));
  if (createHash("sha256").update(artifact).digest("hex") !== lock.sha256) throw new Error(`Evidence hash mismatch: ${lock.id}.`);
  evidence.set(lock.id, source);
}
const sourceFields = (id: string) => {
  const source = evidence.get(id);
  if (!source) throw new Error(`Missing source ${id}.`);
  return { sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
};

const jluSourceId = "jlu-chinese-language-and-culture-program-2027";
const ywiccSourceId = "ywicc-international-chinese-language-spring-2027";
const jluSource = evidence.get(jluSourceId)!;
const ywiccSource = evidence.get(ywiccSourceId)!;
const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;

const jluSchoolSlug = "jilin-university";
const jluBase = dependency.schools?.find((row) => row.slug === jluSchoolSlug);
const changchun = dependency.cities?.find((row) => row.slug === "changchun");
if (!jluBase || !changchun) throw new Error("Jilin University or Changchun dependency is missing.");
const jluProgramSlug = `${jluSchoolSlug}-chinese-language-and-culture`;
if (dependency.programs?.some((row) => row.slug === jluProgramSlug)) throw new Error("Jilin Chinese Language and Culture program already exists in the base.");

const jluSchool = {
  ...jluBase,
  applicationLevel: "Undergraduate, Master, Doctoral and Non-degree Chinese Language",
  languageOfInstruction: "Chinese and English, by program",
  deadlineSummary: "The 2027 Chinese Language and Culture program closes December 31, 2026 for Spring and June 30, 2027 for Fall. Other degree and scholarship routes use their own official deadlines.",
  tuitionSummary: "Chinese Language and Culture is CNY 9,000 per semester plus CNY 600 application fee and CNY 200-350 textbook fee. Reviewed graduate routes remain CNY 21,000-36,000/year by discipline and language.",
  applicationFee: "CNY 600 for the 2027 Chinese Language and Culture program",
  admissionsUrl: sourceFields(jluSourceId).sourceUrl,
  subjectTags: Array.from(new Set([...(jluBase.subjectTags ?? []), "Chinese Language", "Chinese Culture"])),
  campusHighlights: Array.from(new Set([...(jluBase.campusHighlights ?? []), "2027 Spring and Fall Chinese Language and Culture intakes"])),
  contactNotes: "International Student Admissions Office, College of International Education, Room 216, Youyi Guesthouse, 1505 Xiuzheng Road, Changchun; study@jlu.edu.cn; +86-431-85166885/85166518.",
  lastVerifiedAt: jluSource.fetchedAt,
  ...sourceFields(jluSourceId),
  sourceFieldLineage: {
    ...(jluBase.sourceFieldLineage ?? {}),
    applicationLevel: "official 2027 Chinese Language and Culture program guide",
    languageOfInstruction: "existing reviewed degree routes plus official 2027 Chinese-language program",
    deadlineSummary: "official 2027 guide, application and enrollment dates",
    tuitionSummary: "official 2027 guide embedded fee table image plus existing reviewed graduate sources",
    applicationFee: "official 2027 guide embedded fee table image",
    admissionsUrl: "official 2027 program guide",
    campusHighlights: "official 2027 program guide",
    contactNotes: "official 2027 program guide contact section",
  },
};

const jluProgram = {
  slug: jluProgramSlug,
  schoolSlug: jluSchoolSlug,
  citySlug: "changchun",
  nameEn: "Chinese Language and Chinese Culture Program",
  nameZh: "汉语与中国文化进修项目",
  degreeLevel: "Non-degree",
  fieldCategory: "Language and Culture",
  subjectArea: "Chinese Language and Chinese Culture",
  teachingLanguage: "Chinese",
  tuitionAmount: 9000,
  tuitionCurrency: "CNY",
  tuitionPeriod: "semester",
  tuitionText: "CNY 9,000 per semester; CNY 600 application fee; CNY 200-350 textbook fee for offline courses; medical insurance is paid by the student.",
  scholarshipText: "No scholarship coverage is published for this self-funded program in the captured guide.",
  applicationUrl: "https://apply.jlu.edu.cn",
  applicationNote: "Applicants are placed from beginner I through advanced II after a Chinese placement test. A semester normally has 15 weeks and 20 Chinese class hours per week, with HSK, culture and sports electives.",
  hasScholarship: false,
  badgeText: "2027 Spring + Fall",
  displayTuition: "CNY 9,000/semester",
  displaySubjects: ["Comprehensive Chinese", "Speaking", "Listening", "Reading", "Writing", "HSK Preparation", "Chinese Culture"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: jluSource.fetchedAt,
  ...sourceFields(jluSourceId),
  sourceFieldLineage: {
    nameEn: "translated from official 2027 program title",
    nameZh: "official 2027 program title",
    degreeLevel: "official visiting-study program classification",
    fieldCategory: "official program introduction and curriculum",
    subjectArea: "official program title and curriculum",
    teachingLanguage: "official Chinese-language curriculum",
    tuitionAmount: "official embedded 2027 fee table image",
    tuitionText: "official embedded 2027 fee table image",
    applicationUrl: "official guide online-application section; HTTPS form of the published official host",
    applicationNote: "official guide, curriculum and online application sections",
    displaySubjects: "official guide, required and elective curriculum",
  },
};

const jluIntakes = [
  {
    programSlug: jluProgramSlug,
    intakeTerm: "Spring",
    intakeYear: 2027,
    deadlineDate: "2026-12-31T15:59:59.000Z",
    deadlineLabel: "Apply during October-December 31, 2026; registration is March 10-11, 2027.",
    applicationRound: "Jilin University 2027 Spring Chinese Language and Culture Program",
    status: "open" as const,
    ...sourceFields(jluSourceId),
    sourceFieldLineage: {
      intakeTerm: "official guide, Spring entry in March",
      intakeYear: "official guide, Spring 2027 entry",
      deadlineDate: "official guide, December 31 deadline; converted from Beijing end-of-day",
      deadlineLabel: "official guide, application and registration dates",
      applicationRound: "official guide title and Spring schedule",
    },
  },
  {
    programSlug: jluProgramSlug,
    intakeTerm: "Fall",
    intakeYear: 2027,
    deadlineDate: "2027-06-30T15:59:59.000Z",
    deadlineLabel: "Apply during March-June 30, 2027; the Fall semester begins in September 2027.",
    applicationRound: "Jilin University 2027 Fall Chinese Language and Culture Program",
    status: "open" as const,
    ...sourceFields(jluSourceId),
    sourceFieldLineage: {
      intakeTerm: "official guide, Fall entry in September",
      intakeYear: "official guide, Fall 2027 entry",
      deadlineDate: "official guide, June 30 deadline; converted from Beijing end-of-day",
      deadlineLabel: "official guide, application and entry months",
      applicationRound: "official guide title and Fall schedule",
    },
  },
];

const yiwuCity = {
  slug: "yiwu",
  nameEn: "Yiwu",
  nameZh: "义乌",
  province: "Zhejiang",
  region: "East China",
  tags: ["Zhejiang", "international-trade-city"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: ywiccSource.fetchedAt,
  ...sourceFields(ywiccSourceId),
  sourceFieldLineage: {
    nameEn: "official college identity and contact address; standardized English city name",
    nameZh: "official contact address",
    province: "official contact address",
    region: "CUAC geographic taxonomy derived from the verified provincial location",
    tags: "official institutional positioning plus CUAC geographic classification",
  },
};

const yiwuSchoolSlug = "yiwu-industrial-and-commercial-college";
if (dependency.schools?.some((row) => row.slug === yiwuSchoolSlug)) throw new Error("YWICC already exists in the 100-school base.");
if (dependency.cities?.some((row) => row.slug === "yiwu")) throw new Error("Yiwu city already exists in the base.");
const yiwuSchool = {
  slug: yiwuSchoolSlug,
  nameEn: "Yiwu Industrial and Commercial College",
  nameZh: "义乌工商职业技术学院",
  citySlug: "yiwu",
  schoolType: "Public vocational college",
  region: "Yiwu, Zhejiang, East China",
  applicationLevel: "Non-degree Chinese Language",
  languageOfInstruction: "Chinese",
  languageRequirement: "No minimum HSK score is published for the Spring 2027 language route; students enter foundation, elementary, intermediate or advanced classes according to level.",
  hskRequirement: "No entry HSK threshold is published. The curriculum includes HSK preparation and the college operates an HSK test center.",
  deadlineSummary: "Spring 2027 applications run November 1 through December 31, 2026.",
  tuitionSummary: "CNY 17,000 per year tuition; total published annual charge CNY 19,200 including CNY 600 custodial fee, CNY 600 application fee and CNY 1,000 insurance.",
  applicationFee: "CNY 600",
  websiteUrl: "https://gjjy.ywicc.edu.cn/",
  admissionsUrl: sourceFields(ywiccSourceId).sourceUrl,
  subjectTags: ["Chinese Language", "Chinese Culture", "HSK Preparation"],
  languageTags: ["Chinese", "Foundation", "Elementary", "Intermediate", "Advanced"],
  campusHighlights: ["Spring 2027 international Chinese-language intake", "20 class hours per week", "On-campus HSK test center"],
  contactNotes: "School of International Education, 2 Xueyuan Road, Yiwu, Zhejiang; admission@ywicc.edu.cn; +86-579-83803555. The guide states that the college currently does not provide international-student dormitories, so students arrange off-campus accommodation.",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: ywiccSource.fetchedAt,
  ...sourceFields(ywiccSourceId),
  sourceFieldLineage: {
    nameEn: "official page identity; standardized English name",
    nameZh: "official page title and institutional identity",
    citySlug: "official contact address",
    schoolType: "official college identity",
    region: "official contact address plus CUAC geographic taxonomy",
    applicationLevel: "official Spring 2027 language-student guide",
    languageOfInstruction: "official Chinese curriculum",
    languageRequirement: "official curriculum and admission conditions",
    hskRequirement: "official curriculum and FAQ",
    deadlineSummary: "official application period",
    tuitionSummary: "official annual fee table",
    applicationFee: "official annual fee table",
    admissionsUrl: "captured official Spring 2027 guide",
    campusHighlights: "official guide, curriculum and institutional overview",
    contactNotes: "official guide contact and FAQ sections",
  },
};

const yiwuProgramSlug = `${yiwuSchoolSlug}-chinese-language`;
const yiwuProgram = {
  slug: yiwuProgramSlug,
  schoolSlug: yiwuSchoolSlug,
  citySlug: "yiwu",
  nameEn: "Chinese Language Program",
  nameZh: "国际学生汉语语言项目",
  degreeLevel: "Non-degree",
  fieldCategory: "Language",
  subjectArea: "Chinese Language and Culture",
  teachingLanguage: "Chinese",
  tuitionAmount: 17000,
  tuitionCurrency: "CNY",
  tuitionPeriod: "year",
  tuitionText: "CNY 17,000/year tuition. Published annual total is CNY 19,200: tuition CNY 17,000, custodial fee CNY 600, application fee CNY 600 and insurance CNY 1,000.",
  scholarshipText: "The guide states that enrolled international students may compete for Zhejiang Provincial Government, Yiwu Municipal Government, college and special scholarships; it does not publish award amounts or application rules.",
  applicationUrl: sourceFields(ywiccSourceId).sourceUrl,
  applicationNote: "The Spring semester runs March-July. Foundation through advanced levels receive 20 class hours per week plus optional HSK preparation and Chinese-culture activities. Applicants complete online submission, document review, psychological assessment and application-fee payment.",
  hasScholarship: true,
  badgeText: "Spring 2027",
  displayTuition: "CNY 17,000/year",
  displaySubjects: ["Comprehensive Chinese", "Speaking", "Listening", "Reading and Writing", "HSK Preparation", "Chinese Culture"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: ywiccSource.fetchedAt,
  ...sourceFields(ywiccSourceId),
  sourceFieldLineage: {
    nameEn: "translated from official Spring 2027 language-student guide title",
    nameZh: "official guide title",
    degreeLevel: "official language-student classification",
    fieldCategory: "official curriculum",
    subjectArea: "official curriculum",
    teachingLanguage: "official Chinese-language curriculum",
    tuitionAmount: "official annual fee table",
    tuitionText: "official annual fee table",
    scholarshipText: "official FAQ; award details remain unresolved",
    applicationUrl: "official guide retained because the published registration system is HTTP-only",
    applicationNote: "official semester, curriculum and application-process sections",
    displaySubjects: "official curriculum table",
  },
};

const yiwuIntake = {
  programSlug: yiwuProgramSlug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  openDate: "2026-10-31T16:00:00.000Z",
  deadlineDate: "2026-12-31T15:59:59.000Z",
  deadlineLabel: "Apply November 1-December 31, 2026; the Spring semester runs March-July 2027.",
  applicationRound: "YWICC Spring 2027 International Chinese Language Program",
  status: "open" as const,
  ...sourceFields(ywiccSourceId),
  sourceFieldLineage: {
    intakeTerm: "official guide, Spring semester",
    intakeYear: "official guide title",
    openDate: "official guide, application period; converted from Beijing date boundary",
    deadlineDate: "official guide, application period; converted from Beijing end-of-day",
    deadlineLabel: "official guide, semester and application period",
    applicationRound: "official guide title",
  },
};

const generatedAt = [...evidence.values()].map((row) => row.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt,
  cities: [changchun, yiwuCity],
  schools: [jluSchool, yiwuSchool],
  programs: [jluProgram, yiwuProgram],
  programIntakes: [...jluIntakes, yiwuIntake],
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 Wave 106 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [jluSchoolSlug, yiwuSchoolSlug], refreshedSchools: 1, newCities: 1, newSchools: 1, programs: 2, programIntakes: 3, scholarships: 0 },
  evidence: [...evidence.values()].map((row) => ({ id: row.id, label: row.label, url: row.finalUrl ?? row.url, contentType: row.contentType, fetchedAt: row.fetchedAt, sha256: row.sha256 })),
  unresolved: [
    "Jilin University's linked application-material download returned text/html rather than the advertised PDF. No claims are taken from that response; only materials explicitly printed on the captured guide are retained.",
    "YWICC names four scholarship families but does not publish award values, coverage, deadlines or application rules in this guide. No scholarship entity is created and no award details are inferred.",
    "Dalian Medical University's Spring 2027 announcement is captured and establishes Pre-Medical and English-taught Clinical Medicine routes plus an October 20, 2026 system opening. Its linked 2026-2027 brochure returned text/html rather than the advertised PDF, so a program candidate is deferred until detailed requirements and fees can be captured.",
    "General 2027 degree admissions at Jilin University and YWICC degree routes remain outside these source-bounded program candidates.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public institutional admissions facts and public office contact details are included; no applicant or account data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-106");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 106, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
