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
const run = "2026-10-27T03-02-54-565Z";
const sourceId = "ahnu-china-link-scholarship-2026-2027";
const expectedSha256 = "e5d0d51e86f058b9b73b9aaf41500e6227e60f3f0288b833d4e076c1eda8237a";
const runRoot = resolve(root, "work/catalog-official", run);
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
const source = manifest.sources.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
if (!source) throw new Error("Missing locked AHNU China Link source.");
if (createHash("sha256").update(await readFile(resolve(runRoot, source.artifactPath))).digest("hex") !== expectedSha256) {
  throw new Error("AHNU China Link evidence hash mismatch.");
}

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-183.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "wuhu");
const baseSchool = prior.schools?.find((row) => row.slug === "anhui-normal-university");
if (!city || !baseSchool) throw new Error("Wave 183 AHNU dependencies are missing.");

const sourceFields = {
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
};

const school = {
  ...baseSchool,
  applicationLevel: "The latest complete degree guide remains the closed 2026 cycle. The official China Link route accepts non-degree research-exchange entrants through August 31, 2027; no general Fall 2027 degree cycle is inferred.",
  deadlineSummary: "China Link applications are open year-round, but the host university must report a nominee at least two months before arrival and study must begin no later than August 31, 2027. AHNU publishes no single calendar deadline.",
  admissionsUrl: source.finalUrl ?? source.url,
  campusHighlights: [...new Set([...(baseSchool.campusHighlights ?? []), "China Link research exchange with entry through August 2027"])],
  verificationStatus: "unverified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    ...(baseSchool.sourceFieldLineage ?? {}),
    applicationLevel: "official China Link categories and latest-start condition",
    deadlineSummary: "official rolling application process, two-month institutional lead time, and latest-start condition",
    admissionsUrl: "registered official China Link guide",
    campusHighlights: "official China Link host eligibility and 2027 entry window",
  },
};

const program: CatalogSeedProgram = {
  slug: "anhui-normal-university-china-link-research-exchange-2027",
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: "China Link Short-term Scientific Research Exchange - 2027",
  nameZh: "安徽师范大学中国政府奖学金短期科研交流项目（2027年入学）",
  degreeLevel: "Non-degree",
  durationMonths: 12,
  fieldCategory: "Short-term research exchange",
  subjectArea: "All disciplines other than Chinese-language study",
  teachingLanguage: "Chinese or English",
  hskRequirement: "No fixed HSK score is published; applicants must satisfy the selected AHNU host arrangement.",
  englishRequirement: "No fixed English-test score is published; applicants must satisfy the selected AHNU host arrangement.",
  tuitionText: "Tuition is fully waived under the China Link scholarship; no self-funded tuition amount is published for this route.",
  scholarshipText: "Full tuition waiver, free on-campus accommodation, comprehensive medical insurance, and a monthly stipend of CNY 3,000 for general scholars or CNY 3,500 for senior scholars.",
  applicationUrl: "https://studyinchina.csc.edu.cn/#/login",
  applicationNote: "Applicants must first obtain AHNU admission eligibility, then submit the China Link application in the CSC system and notify the university. Applications are open year-round; the university must report nominees at least two months before arrival, and study must start no later than August 31, 2027.",
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
    applicationNote: "official eligibility and rolling application process",
  },
};

const intake: CatalogSeedProgramIntake = {
  programSlug: program.slug,
  intakeTerm: "Rolling",
  intakeYear: 2027,
  deadlineLabel: "Applications are open year-round. AHNU must submit nominees at least two months before arrival, and study must begin no later than August 31, 2027; no single calendar deadline is published.",
  applicationRound: "2026 China Link call with entry no later than August 31, 2027",
  status: "open",
  ...sourceFields,
  sourceFieldLineage: {
    intakeTerm: "official year-round application access",
    intakeYear: "official latest-start condition",
    deadlineLabel: "official rolling application process, institutional lead time, and latest-start condition",
    applicationRound: "official 2026 China Link call with 2027 entry window",
    status: "official year-round application access at capture time",
  },
};

const scholarship: CatalogSeedScholarship = {
  slug: "anhui-normal-university-china-link-scholarship-2027",
  title: "Anhui Normal University China Link Scholarship - 2027 Entry",
  nameZh: "安徽师范大学中国政府奖学金短期科研交流项目（2027年入学）",
  type: "government",
  typeLabel: "Chinese Government Scholarship - China Link",
  providerName: "国家留学基金管理委员会 / 安徽师范大学",
  providerNameEn: "China Scholarship Council / Anhui Normal University",
  providerLocation: "Wuhu, Anhui, China",
  schoolSlug: school.slug,
  programSlug: program.slug,
  fundingLevel: "Full",
  coverage: "Tuition waiver, free on-campus accommodation, comprehensive medical insurance, and monthly stipend.",
  applicableDegree: "Non-degree / Research exchange",
  applicableProgram: "General scholars and senior scholars in all disciplines other than Chinese-language study.",
  amountText: "CNY 3,000/month for general scholars; CNY 3,500/month for senior scholars.",
  requirementText: "Applicants must be non-Chinese citizens in good health. General scholars must be 45 or younger; senior scholars must be 50 or younger. During application and participation they must be full-time students or staff at a CSC foreign partner institution and obtain AHNU admission eligibility.",
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
    { label: "Step 1", body: "Contact AHNU early and obtain admission eligibility." },
    { label: "Step 2", body: "Submit the scholarship application in the CSC system." },
    { label: "Step 3", body: "Notify AHNU of the applicant name, CSC serial number, and China Link application." },
  ],
  actionLinks: [
    { label: "Official AHNU source", url: source.finalUrl ?? source.url, kind: "official-source" },
    { label: "CSC application system", url: "https://studyinchina.csc.edu.cn/#/login", kind: "official-application" },
  ],
  deadlineLabel: "Applications are open year-round; the university must report nominees at least two months before arrival, and study must start no later than August 31, 2027.",
  applicationRound: "2026 China Link call with 2027 entry",
  summary: "Full scholarship for a one-to-twelve-month research exchange at AHNU, with entry through August 2027.",
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
    applicationSteps: "official application process",
    deadlineLabel: "official rolling access, institutional lead time, and latest-start condition",
    applicationRound: "official 2026 program notice with 2027 entry window",
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
    targetPosition: 145,
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
    "The official page publishes rolling application access rather than one fixed AHNU deadline, so deadlineDate remains absent.",
    "The route does not establish general Fall 2027 bachelor, master's, or doctoral admissions.",
    "No fixed HSK, English-test score, named research placement, or self-funded tuition amount is published; those fields remain unresolved.",
    "The source links partner-university and system-guide attachments, but the group-level route does not require importing those lists into this candidate.",
  ],
  sensitiveDataCheck: { result: "pass", note: "No applicant data, personal contacts, bank details, or payment instructions are included." },
};

const stem = resolve(root, "seeds/catalog.2027-wave-206");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 206, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
