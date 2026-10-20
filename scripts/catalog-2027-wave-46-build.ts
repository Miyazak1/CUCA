import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/shu-pre-university-spring-2027-2026-10-20");
const sourceId = "shu-pre-university-program-spring-2027";
const expectedSha256 = "727382c00c17330dca574dc128fc9daf352e8540788f53e834db7a40fb9365eb";
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
const evidence = manifest.sources?.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
if (!evidence) throw new Error("Missing locked Shanghai University Spring 2027 pre-university evidence.");
const evidenceBytes = await readFile(resolve(runRoot, evidence.artifactPath));
if (createHash("sha256").update(evidenceBytes).digest("hex") !== expectedSha256) throw new Error("Shanghai University Wave 46 evidence hash mismatch.");

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-16.draft.json"), "utf8")) as CatalogSeedBundle;
const school = dependency.schools?.find((row) => row.slug === "shanghai-university");
const city = dependency.cities?.find((row) => row.slug === "shanghai");
if (!school || !city) throw new Error("Wave 46 Shanghai University or Shanghai dependency is missing.");
const sourceFields = { sourceUrl: evidence.finalUrl ?? evidence.url, sourceLabel: evidence.label, sourceSha256: evidence.sha256, capturedAt: evidence.fetchedAt };
const commonHskRequirement = "Applicants should hold HSK Level 3 with 180 or above, or demonstrate equivalent Chinese proficiency; applicants below that level may be considered case by case. To apply for Shanghai University undergraduate study after completing the pathway, students must achieve HSK Level 4 or 5 with 180 or above and pass the CSCA test.";
const commonApplicationNote = "Applicants must be non-Chinese citizens aged 16-24 with a high-school diploma or equivalent, good physical and mental health, and no criminal record. Required documents include passport, China visa page if currently in China, recent ID photo, a signed 300-500 word study plan, diploma or pre-graduation certificate, full high-school transcript, recent HSK evidence, financial-support statement, no-criminal-record commitment and, for applicants under 18, a guarantee statement. The program begins in March 2027; the exact registration date follows the admission notice.";
const routes = [
  {
    key: "science-and-engineering",
    name: "Pre-University Program - Science and Engineering Track",
    subjectArea: "Chinese, Professional Chinese, mathematics, optional physics or chemistry, Experience China and Academic Salon. The track provides HSK and CSCA preparation.",
  },
  {
    key: "humanities-economics-and-management",
    name: "Pre-University Program - Humanities, Economics and Management Track",
    subjectArea: "Chinese, Professional Chinese, mathematics, optional fundamentals of economics or management, Experience China and Academic Salon. The track provides HSK and CSCA preparation.",
  },
];
const programs: CatalogSeedProgram[] = routes.map((route) => ({
  slug: `shanghai-university-pre-university-${route.key}-spring-2027`,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: route.name,
  nameZh: route.key === "science-and-engineering" ? "上海大学预科项目（理工方向，2027年春季）" : "上海大学预科项目（人文、经管方向，2027年春季）",
  degreeLevel: "Non-degree",
  fieldCategory: "Pre-university pathway",
  subjectArea: route.subjectArea,
  teachingLanguage: "Mainly Chinese",
  hskRequirement: commonHskRequirement,
  cscaRequirement: "Students must pass the China Scholastic Competency Assessment before applying to Shanghai University's undergraduate programs after the pathway. The guide does not publish a route-specific CSCA subject mapping or score threshold.",
  tuitionAmount: 26000,
  tuitionCurrency: "CNY",
  tuitionPeriod: "semester",
  tuitionText: "CNY 26,000 for the one-semester program, including tuition, CSCA preparation, HSK mock tests and undergraduate-application guidance; application fee CNY 500 and insurance CNY 400 per semester are separate.",
  scholarshipText: "Students with outstanding academic performance and conduct may apply for scholarships; evaluation criteria are to be published separately.",
  applicationUrl: "https://apply.shu.edu.cn",
  applicationNote: commonApplicationNote,
  hasScholarship: true,
  badgeText: "Spring 2027 pathway",
  displayGroup: "Non-degree",
  displayGroupLabel: "Pre-University Program",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: evidence.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "official program title and track heading",
    nameZh: "official program title and track heading (translated)",
    degreeLevel: "official Program Introduction",
    fieldCategory: "official program title and objectives",
    subjectArea: "official Course Content and Tracks tables",
    teachingLanguage: "official course-arrangement note",
    hskRequirement: "official Eligibility and Clear Pathway sections",
    cscaRequirement: "official Clear Pathway and program-support sections",
    tuitionAmount: "official Fee Structure",
    tuitionCurrency: "official Fee Structure",
    tuitionPeriod: "official one-semester title and Fee Structure",
    tuitionText: "official Fee Structure",
    scholarshipText: "official Scholarships section",
    applicationUrl: "official Application Procedure",
    applicationNote: "official Eligibility, Application Materials and Course Arrangements",
  },
}));
const programIntakes: CatalogSeedProgramIntake[] = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  openDate: "2026-09-30T00:00:00.000Z",
  deadlineDate: "2026-12-30T15:59:59.000Z",
  deadlineLabel: "Apply September 30-December 30, 2026 for commencement in March 2027. The deadline is normalized to end of day in Shanghai because the official guide publishes no time.",
  applicationRound: "Shanghai University Spring 2027 Pre-University Program",
  status: "open",
  ...sourceFields,
  sourceFieldLineage: {
    intakeTerm: "official Spring 2027 title",
    intakeYear: "official Spring 2027 title and March 2027 commencement",
    openDate: "official Application Period",
    deadlineDate: "official Application Period; Shanghai end-of-day normalization",
    deadlineLabel: "official Application Period and Commencement Date",
    applicationRound: "official program title",
    status: "deadline compared with capturedAt",
  },
}));

const candidate: CatalogSeedBundle = { version: 1, generatedAt: evidence.fetchedAt, cities: [city], schools: [school], programs, programIntakes, scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 46 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: evidence.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: programs.length, new2027Intakes: programIntakes.length, refreshedScholarships: 0, sourceSnapshots: 1 },
  evidence: [{ id: evidence.id, label: evidence.label, url: evidence.url, fetchedAt: evidence.fetchedAt, sha256: evidence.sha256 }],
  unresolved: [
    "The one-semester title does not publish an exact end date or month/week duration, so the structured duration field remains empty.",
    "The guide requires a passed CSCA for subsequent undergraduate application but publishes no route-specific CSCA subject mapping or score threshold.",
    "Scholarship evaluation criteria are to be published separately, so no scholarship entity is emitted.",
    "The minimum class size is ten; if it is not met, the class will not open. The candidate retains the route as active while the published application window is open and records this contingency in review rather than asserting that a class has formed.",
  ],
  notes: [
    "The PDF was text-extracted and visually checked page by page; the two published course tracks are represented separately while sharing one official application route.",
    "No 2026 Shanghai University degree-admission date is rolled forward to this Spring 2027 non-degree route.",
    "No applicant, account, passport, payment or other personal data is included.",
  ],
};
const stem = resolve(root, "seeds/catalog.2027-wave-46");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 46, candidateSha256, counts: { schools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: 0, sourceSnapshots: 1 }, publicationAuthorized: false }, null, 2));
