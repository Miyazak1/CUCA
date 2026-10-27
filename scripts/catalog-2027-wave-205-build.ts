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
  contentType: string;
  byteLength: number;
  sha256: string;
  artifactPath: string;
};

const root = process.cwd();
const run = "2026-10-27T02-52-39-795Z";
const sourceId = "sdu-chinese-language-program-spring-2027";
const expectedSha256 = "79436015f68a1ab37310bc9cc9cc6e0c540667a8cdc62fbbf3366f2a4c0029ce";
const runRoot = resolve(root, "work/catalog-official", run);
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
const source = manifest.sources.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
if (!source) throw new Error("Missing locked SDU Spring 2027 Chinese-language source.");
const sourceBytes = await readFile(resolve(runRoot, source.artifactPath));
if (createHash("sha256").update(sourceBytes).digest("hex") !== expectedSha256) throw new Error("SDU evidence hash mismatch.");

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-29.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "jinan");
const baseSchool = prior.schools?.find((row) => row.slug === "shandong-university");
if (!city || !baseSchool) throw new Error("Wave 29 SDU dependencies are missing.");

const sourceFields = {
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
};

const school = {
  ...baseSchool,
  applicationLevel: "Undergraduate, Master, Doctoral and Non-degree",
  deadlineSummary: "The official Spring 2027 Chinese-language program accepts applications from October 15 through December 31, 2026. Other 2027 degree rounds remain unresolved.",
  tuitionSummary: "Spring 2027 Chinese-language study costs CNY 9,000 per semester or CNY 18,000 per academic year, plus insurance and accommodation. General 2027 degree tuition remains unresolved.",
  admissionsUrl: source.finalUrl ?? source.url,
  languageTags: [...new Set([...(baseSchool.languageTags ?? []), "Chinese language study", "No prior Chinese required"])].sort(),
  campusHighlights: [...new Set([...(baseSchool.campusHighlights ?? []), "Explicit Spring 2027 Chinese-language routes"])],
  verificationStatus: "unverified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    ...(baseSchool.sourceFieldLineage ?? {}),
    applicationLevel: "official Spring 2027 non-degree guide",
    deadlineSummary: "official application window; other 2027 degree rounds unresolved",
    tuitionSummary: "official Spring 2027 fee schedule",
    admissionsUrl: "official captured Spring 2027 guide",
    languageTags: "official placement and no-prior-Chinese statement",
    campusHighlights: "official Spring 2027 guide",
  },
};

const commonProgram = {
  schoolSlug: school.slug,
  citySlug: city.slug,
  degreeLevel: "Non-degree",
  fieldCategory: "Chinese Language and Culture",
  subjectArea: "Chinese language",
  teachingLanguage: "Chinese",
  hskRequirement: "No prior Chinese proficiency is required. Students take a placement test after arrival and are assigned to beginner, intermediate or advanced classes.",
  applicationUrl: "https://www.apply.sdu.edu.cn",
  applicationNote: "Applicants must be non-Chinese citizens in good physical and mental health, hold a high-school diploma or above, and meet the published nationality rules. The official guide requires the listed identity, education, transcript, statement, medical, criminal-record and financial-guarantee documents.",
  hasScholarship: false,
  displayGroup: "Non-degree",
  displayGroupLabel: "Spring 2027 Chinese-language study",
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  ...sourceFields,
};

const programs: CatalogSeedProgram[] = [
  {
    ...commonProgram,
    slug: "shandong-university-chinese-language-one-semester-spring-2027",
    nameEn: "Chinese Language Program - One Semester (Spring 2027)",
    nameZh: "山东大学2027年春季学期中文研修一学期项目",
    tuitionAmount: 9000,
    tuitionCurrency: "CNY",
    tuitionPeriod: "semester",
    tuitionText: "CNY 9,000 per semester; medical insurance CNY 400 per semester; accommodation generally CNY 690-1,050 per person per month; application fee CNY 400.",
    scholarshipText: "No scholarship is stated in this program guide.",
    badgeText: "February-July 2027",
    sourceFieldLineage: {
      nameEn: "official program title and one-semester option",
      nameZh: "official bilingual guide",
      degreeLevel: "official language-study category",
      subjectArea: "official program overview",
      teachingLanguage: "official Chinese placement and curriculum sections",
      hskRequirement: "official no-prior-Chinese and placement statements",
      tuitionAmount: "official fee schedule",
      tuitionText: "official application, tuition, insurance and accommodation fees",
      applicationUrl: "official application method",
      applicationNote: "official eligibility and document list",
      hasScholarship: "no scholarship stated in this guide",
      badgeText: "official February-July 2027 study period",
    },
  },
  {
    ...commonProgram,
    slug: "shandong-university-chinese-language-one-academic-year-spring-2027",
    nameEn: "Chinese Language Program - One Academic Year (Spring 2027)",
    nameZh: "山东大学2027年春季学期中文研修一学年项目",
    tuitionAmount: 18000,
    tuitionCurrency: "CNY",
    tuitionPeriod: "year",
    tuitionText: "CNY 18,000 per academic year; medical insurance CNY 800 per year; accommodation generally CNY 690-1,050 per person per month; application fee CNY 400.",
    scholarshipText: "No scholarship is stated in this program guide.",
    badgeText: "February 2027-January 2028",
    sourceFieldLineage: {
      nameEn: "official program title and one-academic-year option",
      nameZh: "official bilingual guide",
      degreeLevel: "official language-study category",
      subjectArea: "official program overview",
      teachingLanguage: "official Chinese placement and curriculum sections",
      hskRequirement: "official no-prior-Chinese and placement statements",
      tuitionAmount: "official fee schedule",
      tuitionText: "official application, tuition, insurance and accommodation fees",
      applicationUrl: "official application method",
      applicationNote: "official eligibility and document list",
      hasScholarship: "no scholarship stated in this guide",
      badgeText: "official February 2027-January 2028 study period",
    },
  },
];

const programIntakes: CatalogSeedProgramIntake[] = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  deadlineDate: "2026-12-31T15:59:59.000Z",
  deadlineLabel: "Application period: October 15-December 31, 2026; the university recommends applying at least two weeks before the deadline.",
  applicationRound: "Spring 2027 Chinese-language study",
  status: "open",
  ...sourceFields,
  sourceFieldLineage: {
    intakeTerm: "official February 2027 start",
    intakeYear: "official February 2027 start",
    deadlineDate: "official December 31, 2026 deadline normalized to the end of the Beijing calendar day",
    deadlineLabel: "official application window and timing advice",
    applicationRound: "official Spring 2027 guide",
    status: "capture date precedes the published deadline",
  },
}));

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: source.fetchedAt,
  cities: [city],
  schools: [school],
  programs,
  programIntakes,
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));

const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: source.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: {
    target: "2026 ShanghaiRanking BCUR top 150",
    targetPosition: 22,
    schoolSlugs: [school.slug],
    newSchools: 0,
    programs: programs.length,
    programIntakes: programIntakes.length,
    scholarships: 0,
  },
  evidence: [{
    id: source.id,
    label: source.label,
    url: source.finalUrl ?? source.url,
    contentType: source.contentType,
    byteLength: source.byteLength,
    fetchedAt: source.fetchedAt,
    sha256: source.sha256,
  }],
  unresolved: [
    "The official preparatory-program listing points to a dead article URL at capture time, so no preparatory route is structured from it.",
    "This source is limited to non-degree Chinese-language study and does not establish a general Fall 2027 undergraduate, master's or doctoral cycle.",
    "Exact registration dates and semester end dates are not published beyond the stated month ranges.",
    "No scholarship is inferred because the guide does not state one.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Published institutional contact details are not copied into the candidate." },
};

const stem = resolve(root, "seeds/catalog.2027-wave-205");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 205, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
