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
  sha256: string;
  artifactPath: string;
};

const root = process.cwd();
const sourceId = "pku-spring-four-week-chinese-language-2027";
const expectedSha256 = "9ab86fa2ee9bcee6e0c3a9fb94a57963c0d49f1493abe1be4e436ce4c3dbfc59";
const runRoot = resolve(root, "work/catalog-official/pku-four-week-spring-2027-2026-10-20");
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
const evidence = manifest.sources?.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
if (!evidence) throw new Error("Missing locked Peking University Spring 2027 language-program evidence.");
const evidenceBytes = await readFile(resolve(runRoot, evidence.artifactPath));
if (createHash("sha256").update(evidenceBytes).digest("hex") !== expectedSha256) throw new Error("Peking University Wave 38 evidence hash mismatch.");

const baseline = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const school = baseline.schools?.find((row) => row.slug === "peking-university");
const city = baseline.cities?.find((row) => row.slug === "beijing");
if (!school || !city) throw new Error("Wave 38 Peking University or Beijing dependency is missing.");

const sourceFields = {
  sourceUrl: evidence.finalUrl ?? evidence.url,
  sourceLabel: evidence.label,
  sourceSha256: evidence.sha256,
  capturedAt: evidence.fetchedAt,
};
const programSlug = "peking-university-spring-four-week-chinese-language-2027";
const program: CatalogSeedProgram = {
  slug: programSlug,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: "Spring Four-week Chinese Language Studies Program",
  nameZh: "北京大学2027年春季四周汉语项目",
  degreeLevel: "Non-degree",
  fieldCategory: "Short-term Chinese language",
  subjectArea: "Intensive Reading and Spoken Chinese",
  teachingLanguage: "Chinese",
  hskRequirement: "No fixed HSK score is required. An HSK certificate or official full-time Mandarin-study transcript is submitted only if applicable; classes are offered at elementary, intermediate and advanced levels, with no beginner class.",
  tuitionAmount: 8000,
  tuitionCurrency: "CNY",
  tuitionPeriod: "program",
  tuitionText: "CNY 8,000 for the four-week program, including textbooks. The non-refundable application fee is CNY 400. Limited on-campus accommodation is published at CNY 180-220 per person per day, depending on room type.",
  applicationUrl: evidence.finalUrl ?? evidence.url,
  applicationNote: "Applicants must be non-Chinese citizens aged 18-50, be in good health, have no criminal record, and hold at least a high-school diploma while currently attending a college or university. Submit the passport information page, highest qualification or current enrolment certificate, any applicable HSK or Mandarin-study transcript, and a Chinese- or English-language recommendation letter. Insurance covering accidents and medical treatment is mandatory.",
  hasScholarship: false,
  badgeText: "Spring 2027",
  displayGroup: "Non-degree",
  displayGroupLabel: "Short-term Chinese language",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: evidence.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "official page title",
    nameZh: "official institution and 2027 program title",
    degreeLevel: "official non-degree application path",
    fieldCategory: "official four-week Chinese-language program description",
    subjectArea: "Program Details, Mandarin course",
    teachingLanguage: "Program Details, Mandarin course",
    hskRequirement: "requirements, document list and three-level class arrangement",
    tuitionAmount: "Fees & Payment",
    tuitionCurrency: "Fees & Payment",
    tuitionPeriod: "program title, duration and Fees & Payment",
    tuitionText: "Fees & Payment and Accommodation",
    applicationUrl: "registered official program page",
    applicationNote: "Application Requirements, document list and Insurance",
    hasScholarship: "official page describes a self-funded route and publishes fees",
    badgeText: "official February-March 2027 dates",
    displayGroup: "official non-degree application path",
    displayGroupLabel: "official program title",
  },
};

const intake: CatalogSeedProgramIntake = {
  programSlug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  openDate: "2026-11-14T16:00:00.000Z",
  deadlineDate: "2027-01-10T15:59:59.000Z",
  deadlineLabel: "Apply November 15, 2026-January 10, 2027; program runs February 22-March 19, 2027. Exact dates are confirmed in the admission letter.",
  applicationRound: "PKU Spring 2027 Four-week Chinese Language Studies Program",
  ...sourceFields,
  sourceFieldLineage: {
    intakeTerm: "official February-March program schedule",
    intakeYear: "official 2027 duration",
    openDate: "Application Period; Beijing start-of-day normalized to UTC",
    deadlineDate: "Application Period; Beijing end-of-day normalized to UTC",
    deadlineLabel: "Duration and Application Period",
    applicationRound: "official page title",
  },
};

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: evidence.fetchedAt,
  cities: [city],
  schools: [school],
  programs: [program],
  programIntakes: [intake],
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 38 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: evidence.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: 1, new2027Intakes: 1, refreshedScholarships: 0, sourceSnapshots: 1 },
  evidence: [{ id: evidence.id, label: evidence.label, url: evidence.url, fetchedAt: evidence.fetchedAt, sha256: evidence.sha256 }],
  unresolved: [
    "The four-week duration is preserved in the route name and dates because the catalog contract has no duration-weeks field; no inaccurate month value is emitted.",
    "The official page states that exact program dates will be confirmed in the admission letter, so the published dates remain labelled as provisional.",
    "This source establishes one Spring 2027 non-degree route, not Peking University's general 2027 undergraduate or graduate cycle.",
  ],
  notes: ["No applicant, account, passport, payment or other personal data is included."],
};

const stem = resolve(root, "seeds/catalog.2027-wave-38");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 38, candidateSha256, counts: { schools: 1, programs: 1, programIntakes: 1, scholarships: 0, sourceSnapshots: 1 }, publicationAuthorized: false }, null, 2));
