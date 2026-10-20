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
  sha256: string;
  artifactPath: string;
};

const root = process.cwd();
const sourceId = "ustc-international-visiting-student-program-2026-2027";
const expectedSha256 = "8bcdd01ef30647d984a8ca86ee75275fef5139e865c37b87f59bd1e55fb166ce";
const runRoot = resolve(root, "work/catalog-official/ustc-visiting-2026-2027-2026-10-18");
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
const evidence = manifest.sources?.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
if (!evidence) throw new Error("Missing locked USTC 2026-2027 visiting-student evidence.");
const evidenceBytes = await readFile(resolve(runRoot, evidence.artifactPath));
if (createHash("sha256").update(evidenceBytes).digest("hex") !== expectedSha256) throw new Error("USTC visiting-student evidence hash mismatch.");

const baseline = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const schoolBase = baseline.schools?.find((row) => row.slug === "university-of-science-and-technology-of-china");
const city = baseline.cities?.find((row) => row.slug === "hefei");
if (!schoolBase || !city) throw new Error("Wave 36 USTC dependencies are missing from the reviewed 100-school release.");

const sourceFields = {
  sourceUrl: evidence.finalUrl ?? evidence.url,
  sourceLabel: evidence.label,
  sourceSha256: evidence.sha256,
  capturedAt: evidence.fetchedAt,
};
const verified = {
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: evidence.fetchedAt,
  ...sourceFields,
};

const school = {
  ...schoolBase,
  applicationLevel: "Undergraduate, Master, Doctoral and Non-degree",
  deadlineSummary: "The official CAS International Visiting Student Program accepted applications through March 21, 2026 for one- to six-month USTC visits scheduled between August 20, 2026 and June 30, 2027. General Fall 2027 degree rounds remain unresolved.",
  admissionsUrl: evidence.url,
  campusHighlights: [...new Set([...(schoolBase.campusHighlights ?? []), "Official CAS-funded international visiting-student research route through June 2027"])],
  ...verified,
  sourceFieldLineage: {
    ...(schoolBase.sourceFieldLineage ?? {}),
    applicationLevel: "official visiting-student program",
    deadlineSummary: "official application deadline and study-period sections",
    admissionsUrl: "registered official program PDF",
    campusHighlights: "official program introduction and study-period sections",
  },
};

const program: CatalogSeedProgram = {
  slug: "ustc-cas-international-visiting-student-program-2026-2027",
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: "CAS International Visiting Student Program 2026-2027",
  nameZh: "中国科学院国际访问学生项目（2026—2027）",
  degreeLevel: "Non-degree",
  durationMonths: 6,
  fieldCategory: "Academic visit and collaborative research",
  subjectArea: "Research area agreed with the applicant's USTC host supervisor",
  applicationUrl: evidence.url,
  applicationNote: "Applicants must be master's or PhD students at a world-leading university or top-tier international research institution, find a USTC research supervisor, and complete the joint application. Required documents are the bilingual application form, passport-style photo, passport information page, English research proposal, English CV, one recommendation from the USTC host supervisor and one recommendation from an international professor.",
  hasScholarship: true,
  scholarshipText: "CAS funding provides a monthly stipend of CNY 10,000 plus a one-time international travel subsidy of CNY 10,000.",
  badgeText: "Visits through June 2027",
  displayGroup: "Non-degree",
  displayGroupLabel: "International Visiting Student Program",
  ...verified,
  sourceFieldLineage: {
    nameEn: "official program title",
    nameZh: "official program title (translated label)",
    degreeLevel: "official visiting-student wording",
    durationMonths: "official one-to-six-month visit range; upper published bound represented",
    fieldCategory: "official academic-visit and collaborative-research description",
    subjectArea: "official host-supervisor application process",
    applicationUrl: "registered official program PDF",
    applicationNote: "official eligibility, application-process and materials sections",
    hasScholarship: "official funding section",
    scholarshipText: "official funding amounts",
  },
};

const intake: CatalogSeedProgramIntake = {
  programSlug: program.slug,
  intakeTerm: "Flexible",
  intakeYear: 2027,
  deadlineLabel: "Application deadline: March 21, 2026. The visit may be scheduled for 1 to 6 months between August 20, 2026 and June 30, 2027.",
  applicationRound: "USTC CAS visiting period through June 2027",
  status: "closed",
  ...sourceFields,
  sourceFieldLineage: {
    intakeTerm: "official applicant-selected visit dates",
    intakeYear: "official study-period end date in 2027",
    deadlineLabel: "official deadline and study-period sections",
    applicationRound: "official study-period section",
    status: "deadline compared with capturedAt",
  },
};

const scholarship: CatalogSeedScholarship = {
  slug: "ustc-cas-international-visiting-student-program-funding-2026-2027",
  title: "CAS International Visiting Student Program Funding 2026-2027",
  nameZh: "中国科学院国际访问学生项目资助（2026—2027）",
  schoolSlug: school.slug,
  programSlug: program.slug,
  type: "Government",
  providerName: "Chinese Academy of Sciences",
  fundingLevel: "Fully funded visiting-student support",
  coverage: "Monthly stipend and one-time international travel subsidy",
  applicableDegree: "Current master's and PhD students",
  applicableProgram: program.nameEn,
  amountText: "CNY 10,000 per month plus a one-time CNY 10,000 international travel subsidy.",
  requirementText: "Applicants must be current master's or PhD students from world-leading universities or top-tier international research institutions, secure a USTC host supervisor, and pass both USTC and CAS review.",
  deadlineLabel: "Application deadline: March 21, 2026.",
  applicationRound: "USTC CAS visiting period through June 2027",
  benefits: ["CNY 10,000 monthly stipend", "CNY 10,000 one-time international travel subsidy"],
  ...verified,
  sourceFieldLineage: {
    title: "official program and funding titles",
    nameZh: "official institution and program title (translated label)",
    schoolSlug: "official USTC domain",
    programSlug: "official program title",
    type: "CAS funding statement",
    providerName: "official program introduction",
    fundingLevel: "official funding details",
    coverage: "official funding details",
    applicableDegree: "official program introduction",
    applicableProgram: "official program title",
    amountText: "official funding details",
    requirementText: "official program introduction and application process",
    deadlineLabel: "official application deadline",
    applicationRound: "official study-period section",
    benefits: "official funding details",
  },
};

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: evidence.fetchedAt,
  cities: [city],
  schools: [school],
  programs: [program],
  programIntakes: [intake],
  scholarships: [scholarship],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 36 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: evidence.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: 1, new2027Intakes: 1, refreshedScholarships: 1, sourceSnapshots: 1 },
  evidence: [{ id: evidence.id, label: evidence.label, url: evidence.url, fetchedAt: evidence.fetchedAt, sha256: evidence.sha256 }],
  unresolved: [
    "The source publishes an applicant-selected visit window rather than a fixed Spring or Fall intake date, so the intake term is recorded as Flexible.",
    "The March 21, 2026 application deadline has passed; the route is retained as current 2026-2027 official history and marked closed.",
    "The source does not establish USTC's general Fall 2027 degree admissions, which remain unresolved.",
    "Accommodation, domestic transportation and living costs are described as uses of the monthly stipend, not separate fee waivers, and are not represented as additional benefits.",
  ],
  notes: ["No applicant, account, passport, payment or other personal data is included."],
};

const stem = resolve(root, "seeds/catalog.2027-wave-36");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 36, candidateSha256, counts: { schools: 1, programs: 1, programIntakes: 1, scholarships: 1, sourceSnapshots: 1 }, publicationAuthorized: false }, null, 2));
