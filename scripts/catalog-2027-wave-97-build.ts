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
const schoolSlug = "chengdu-university";
const sourceId = "chengdu-university-chinese-language-culture-spring-2027";
const runPath = resolve(root, "work/catalog-official/chengdu-university-spring-2027-20261026");
const manifest = JSON.parse(await readFile(resolve(runPath, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
const source = manifest.sources.find((row) => row.id === sourceId && row.status === 200);
if (!source) throw new Error(`Missing successful official source ${sourceId}.`);
const artifact = await readFile(resolve(runPath, source.artifactPath));
if (createHash("sha256").update(artifact).digest("hex") !== source.sha256) throw new Error(`Artifact hash mismatch for ${sourceId}.`);

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-release.reviewed.json"), "utf8")) as CatalogSeedBundle;
const city = dependency.cities?.find((row) => row.slug === "chengdu");
if (!city) throw new Error("Chengdu city dependency is missing.");
if (dependency.schools?.some((row) => row.slug === schoolSlug)) throw new Error(`${schoolSlug} already exists in the reviewed release.`);

const sourceUrl = source.finalUrl ?? source.url;
const semesterSlug = "chengdu-university-chinese-language-culture-one-semester-spring-2027";
const yearSlug = "chengdu-university-chinese-language-culture-one-academic-year-spring-2027";
const school = {
  slug: schoolSlug,
  nameEn: "Chengdu University",
  nameZh: "成都大学",
  citySlug: "chengdu",
  region: "Chengdu, Sichuan, Southwest China",
  applicationLevel: "Undergraduate, Master and Non-degree",
  languageOfInstruction: "The Spring 2027 non-degree route is Chinese Language and Culture. Degree-route teaching languages remain unresolved for 2027.",
  deadlineSummary: "Spring 2027 Chinese Language and Culture applications run from October 15 through December 31, 2026 for February 2027 entry.",
  tuitionSummary: "Spring 2027 Chinese Language and Culture tuition is CNY 7,000 for one semester or CNY 14,000 for one academic year.",
  applicationFee: "CNY 400",
  websiteUrl: "https://coe.cdu.edu.cn/",
  admissionsUrl: "https://admissions.cdu.edu.cn/",
  languageTags: ["Chinese language", "Chinese culture"],
  campusHighlights: ["Spring 2027 Chinese Language and Culture route", "International students from 78 countries reported by the official college"],
  contactNotes: "The official Spring 2027 announcement verifies the non-degree route. General 2027 undergraduate and master's admission rounds remain unpublished or unresolved.",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  sourceUrl,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    nameEn: "official institution profile and page identity",
    nameZh: "official institution identity",
    citySlug: "official contact address",
    region: "official contact address plus CUAC geographic taxonomy",
    applicationLevel: "official announcement introduction",
    languageOfInstruction: "Spring 2027 program description; degree routes intentionally unresolved",
    deadlineSummary: "Application Period and Category",
    tuitionSummary: "Fees table",
    applicationFee: "Fees table",
    websiteUrl: "Contact Information",
    admissionsUrl: "How to Apply",
    languageTags: "official route name and curriculum",
    campusHighlights: "official institution profile and program scope",
    contactNotes: "source-bounded 2027 review",
  },
};

const commonProgram = {
  schoolSlug,
  citySlug: "chengdu",
  degreeLevel: "Non-degree",
  fieldCategory: "Chinese language and culture",
  subjectArea: "Chinese listening, speaking, reading, writing, grammar, China studies and cultural practice",
  teachingLanguage: "Chinese",
  tuitionCurrency: "CNY",
  applicationUrl: "https://admissions.cdu.edu.cn/",
  applicationNote: "Applicants must be non-Chinese citizens aged 18 or above with a valid ordinary passport and be in good physical and mental health. Required materials include passport, education evidence, recent medical and non-criminal records, ID photo, personal statement and a recent financial guarantee. HSK evidence is optional if available.",
  badgeText: "Spring 2027",
  displaySubjects: ["Chinese language", "Chinese culture", "Cultural practice"],
  displayGroup: "language",
  displayGroupLabel: "Chinese Language",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  sourceUrl,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
};
const commonLineage = {
  degreeLevel: "official non-degree program classification",
  fieldCategory: "official route name",
  subjectArea: "official curriculum description",
  teachingLanguage: "Chinese Language and Culture route",
  applicationUrl: "How to Apply",
  applicationNote: "Eligibility and Required Application Materials",
};
const programs = [
  {
    ...commonProgram,
    slug: semesterSlug,
    nameEn: "Chinese Language and Culture - One Semester",
    nameZh: "汉语言文化（一学期）",
    tuitionAmount: 7000,
    tuitionPeriod: "semester",
    tuitionText: "CNY 7,000 tuition; CNY 400 registration, CNY 400 insurance, class-dependent textbooks and CNY 2,500 four-person-room accommodation are separate.",
    displayTuition: "CNY 7,000/semester",
    sourceFieldLineage: { ...commonLineage, nameEn: "official program description and Fees table", nameZh: "faithful Chinese rendering", tuitionAmount: "Fees table", tuitionPeriod: "Fees table", tuitionText: "Fees and Accommodation tables" },
  },
  {
    ...commonProgram,
    slug: yearSlug,
    nameEn: "Chinese Language and Culture - One Academic Year",
    nameZh: "汉语言文化（一学年）",
    durationYears: 1,
    tuitionAmount: 14000,
    tuitionPeriod: "academic year",
    tuitionText: "CNY 14,000 tuition; CNY 400 registration, CNY 800 insurance, class-dependent textbooks and CNY 5,000 four-person-room accommodation are separate.",
    displayTuition: "CNY 14,000/year",
    sourceFieldLineage: { ...commonLineage, nameEn: "official program description and Fees table", nameZh: "faithful Chinese rendering", durationYears: "Fees table", tuitionAmount: "Fees table", tuitionPeriod: "Fees table", tuitionText: "Fees and Accommodation tables" },
  },
];

const intakes = [semesterSlug, yearSlug].map((programSlug) => ({
  programSlug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  openDate: "2026-10-15T00:00:00.000Z",
  deadlineDate: "2026-12-31T23:59:59.000Z",
  deadlineLabel: "Application period: October 15-December 31, 2026; February 2027 entry.",
  applicationRound: "Chengdu University Spring 2027 Chinese Language and Culture admission",
  status: "open" as const,
  sourceUrl,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    intakeTerm: "Application Period and Category: February 2027 intake",
    intakeYear: "Application Period and Category",
    openDate: "Application Period and Category",
    deadlineDate: "Application Period and Category",
    deadlineLabel: "Application Period and Category",
    applicationRound: "official page title and category",
    status: "capturedAt falls inside the published application period",
  },
}));

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: source.fetchedAt,
  cities: [city],
  schools: [school],
  programs,
  programIntakes: intakes,
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 Wave 97 validation failed: ${validation.errors.join(" ")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: source.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [schoolSlug], newSchools: 1, programs: 2, programIntakes: 2, scholarships: 0 },
  evidence: [{ id: source.id, label: source.label, url: sourceUrl, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "General 2027 undergraduate and master's admission guides are not established by this source and remain unresolved.",
    "The official page offers both one-semester and one-academic-year fee options for the February 2027 intake but does not publish exact teaching start or end dates.",
    "No scholarship for this Spring 2027 non-degree route is claimed because the announcement does not publish one.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public institutional admissions facts are included; no applicant or account data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-97");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 97, candidateSha256, counts: { cities: 1, schools: 1, programs: 2, programIntakes: 2, scholarships: 0 }, publicationAuthorized: false }, null, 2));
