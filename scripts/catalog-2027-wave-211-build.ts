import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
  type CatalogSeedScholarship,
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
const run = "2026-10-27T04-00-41-455Z";
const sourceId = "jiangnan-china-link-scholarship-2026-2027";
const expectedSha256 = "a310eb9224798d68826330895d29c421ec78c8eedf5eaa388e52bb9715d09ee9";
const runRoot = resolve(root, "work/catalog-official", run);
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
const source = manifest.sources.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
if (!source) throw new Error("Missing locked Jiangnan University China Link source.");
if (createHash("sha256").update(await readFile(resolve(runRoot, source.artifactPath))).digest("hex") !== expectedSha256) {
  throw new Error("Jiangnan University China Link evidence hash mismatch.");
}

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-121.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "wuxi");
const baseSchool = prior.schools?.find((row) => row.slug === "jiangnan-university");
if (!city || !baseSchool) throw new Error("Wave 121 Jiangnan University dependencies are missing.");

const sourceFields = {
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
};

const school = {
  ...baseSchool,
  applicationLevel: "The latest complete degree guides remain the 2026 cycle. The official China Link route accepts non-degree research-exchange entrants through August 31, 2027; no general Fall 2027 degree cycle is inferred.",
  deadlineSummary: "Applicants must submit at least three months before the proposed research start, and study must begin no later than August 31, 2027. No single calendar deadline is published.",
  admissionsUrl: source.finalUrl ?? source.url,
  campusHighlights: [...new Set([...(baseSchool.campusHighlights ?? []), "China Link research exchange with entry through August 2027"])],
  verificationStatus: "unverified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    ...(baseSchool.sourceFieldLineage ?? {}),
    applicationLevel: "official China Link categories and latest-start condition",
    deadlineSummary: "official three-month lead time and latest-start condition",
    admissionsUrl: "registered official China Link guide",
    campusHighlights: "official China Link scope and 2027 entry window",
  },
};

const program: CatalogSeedProgram = {
  slug: "jiangnan-university-china-link-research-exchange-2027",
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: "China Link Short-term Scientific Research Exchange - 2027",
  nameZh: "江南大学中国政府奖学金短期科研交流项目（2027年入学）",
  degreeLevel: "Non-degree",
  durationMonths: 12,
  fieldCategory: "Short-term research exchange",
  subjectArea: "All disciplines other than Chinese-language study",
  teachingLanguage: "Chinese or English",
  hskRequirement: "No fixed HSK score is published; language follows the selected Jiangnan University host program.",
  englishRequirement: "No fixed English-test score is published; language follows the selected Jiangnan University host program.",
  tuitionText: "Tuition is fully waived under the China Link scholarship; no self-funded tuition amount is published for this route.",
  scholarshipText: "Full tuition waiver, free on-campus accommodation, comprehensive medical insurance, and a monthly stipend of CNY 3,000 for general scholars or CNY 3,500 for senior scholars.",
  applicationUrl: "https://jiangnan.17gz.org/",
  applicationNote: "Apply in both Jiangnan University's system and the CSC system under Type B, agency number 10295. Submit at least three months before the proposed start; study must begin no later than August 31, 2027.",
  hasScholarship: true,
  badgeText: "Entry through August 2027",
  displayGroup: "Non-degree",
  displayGroupLabel: "Research exchange programs",
  status: "draft",
  verificationStatus: "unverified",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "official China Link title and latest-start condition",
    nameZh: "official Chinese title and latest-start condition",
    degreeLevel: "official general- and senior-scholar categories",
    durationMonths: "official one-to-twelve-month duration; upper published bound represented",
    subjectArea: "official field restriction excluding Chinese-language study",
    teachingLanguage: "official Chinese-or-English instruction statement",
    hskRequirement: "official source publishes no fixed score",
    englishRequirement: "official source publishes no fixed score",
    tuitionText: "official full tuition-waiver coverage",
    scholarshipText: "official funding section",
    applicationNote: "official two-system procedure, agency number, lead time, and latest-start condition",
  },
};

const intake: CatalogSeedProgramIntake = {
  programSlug: program.slug,
  intakeTerm: "Rolling",
  intakeYear: 2027,
  deadlineLabel: "Submit at least three months before the proposed research start. Study must begin no later than August 31, 2027; no single calendar deadline is published.",
  applicationRound: "2026 China Link call with entry no later than August 31, 2027",
  status: "open",
  ...sourceFields,
  sourceFieldLineage: {
    intakeTerm: "official flexible one-to-twelve-month route",
    intakeYear: "official latest-start condition",
    deadlineLabel: "official three-month lead time and latest-start condition",
    applicationRound: "official 2026 China Link call with 2027 entry window",
    status: "official page accepts applications at capture time",
  },
};

const scholarship: CatalogSeedScholarship = {
  slug: "jiangnan-university-china-link-scholarship-2027",
  title: "Jiangnan University China Link Scholarship - 2027 Entry",
  nameZh: "江南大学中国政府奖学金短期科研交流项目（2027年入学）",
  type: "government",
  typeLabel: "Chinese Government Scholarship - China Link",
  providerName: "国家留学基金管理委员会 / 江南大学",
  providerNameEn: "China Scholarship Council / Jiangnan University",
  providerLocation: "Wuxi, Jiangsu, China",
  schoolSlug: school.slug,
  programSlug: program.slug,
  fundingLevel: "Full",
  coverage: "Tuition waiver, free on-campus accommodation, comprehensive medical insurance, and monthly stipend.",
  applicableDegree: "Non-degree / Research exchange",
  applicableProgram: "General scholars and senior scholars in all disciplines other than Chinese-language study.",
  amountText: "CNY 3,000/month for general scholars; CNY 3,500/month for senior scholars.",
  requirementText: "Applicants must be non-Chinese citizens in good physical and mental health. General scholars must be 45 or younger; senior scholars must be 50 or younger. During application and participation they must be full-time students or staff at a CSC foreign partner institution.",
  benefitItems: [
    { label: "Tuition waiver", included: true },
    { label: "On-campus accommodation", included: true },
    { label: "Comprehensive medical insurance", included: true },
    { label: "Monthly stipend", included: true, note: "CNY 3,000 general / CNY 3,500 senior" },
  ],
  eligibilityItems: [
    { label: "General scholar age", value: "45 or younger" },
    { label: "Senior scholar age", value: "50 or younger" },
    { label: "Affiliation", value: "Full-time student or staff at a CSC foreign partner institution" },
  ],
  applicationSteps: [
    { label: "Step 1", body: "Submit the Short-term Program / CSC China Link Scholarship Program application in Jiangnan University's system." },
    { label: "Step 2", body: "Submit a Type B application in the CSC system using Jiangnan University agency number 10295." },
    { label: "Step 3", body: "Jiangnan University reviews the application, nominates candidates to CSC, and communicates the result." },
  ],
  actionLinks: [
    { label: "Official Jiangnan University source", url: source.finalUrl ?? source.url, kind: "official-source" },
    { label: "Jiangnan University application system", url: "https://jiangnan.17gz.org/", kind: "official-application" },
    { label: "CSC application system", url: "https://studyinchina.csc.edu.cn/#/login", kind: "official-application" },
  ],
  deadlineLabel: "Submit at least three months before the proposed start; study must begin no later than August 31, 2027.",
  applicationRound: "2026 China Link call with 2027 entry",
  summary: "Full scholarship for a one-to-twelve-month research exchange at Jiangnan University, with entry through August 2027.",
  status: "draft",
  verificationStatus: "unverified",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    title: "official project title and latest-start condition",
    fundingLevel: "official funding section",
    coverage: "official funding section",
    applicableDegree: "official general- and senior-scholar categories",
    applicableProgram: "official field restriction",
    amountText: "official stipend standards",
    requirementText: "official eligibility section",
    benefitItems: "official funding section",
    eligibilityItems: "official eligibility section",
    applicationSteps: "official application procedure",
    deadlineLabel: "official three-month lead time and latest-start condition",
    applicationRound: "official 2026 program notice with 2027 entry",
    summary: "official scope, duration, and funding",
  },
};

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: source.fetchedAt,
  cities: [city],
  schools: [school],
  programs: [program],
  programIntakes: [intake],
  scholarships: [scholarship],
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
    targetPosition: 52,
    schoolSlugs: [school.slug],
    newSchools: 0,
    programs: 1,
    programIntakes: 1,
    scholarships: 1,
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
    "The official page publishes a three-month lead time rather than one fixed deadline, so deadlineDate remains absent.",
    "The route does not establish general Fall 2027 bachelor, master's, or doctoral admissions.",
    "No fixed HSK or English-test score, named research placement, or self-funded tuition amount is published; those fields remain unresolved.",
    "The foreign partner list and application-system guides are attachments; their contents are not required to represent this group-level route.",
  ],
  sensitiveDataCheck: { result: "pass", note: "No applicant data, email addresses, phone numbers, bank details, or payment instructions are included." },
};

const stem = resolve(root, "seeds/catalog.2027-wave-211");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 211, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
