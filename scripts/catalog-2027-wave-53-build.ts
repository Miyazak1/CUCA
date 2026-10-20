import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
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
const sourceId = "buct-korean-preparatory-undergraduate-pathway-2027";
const expectedSha256 = "84cf6dfb6864f3a7c94d2e64b8aad3aa90b4935bd2690410ef793895a73f6ab8";
let source: ManifestSource | undefined;

for (const entry of await readdir(resolve(root, "work/catalog-official"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(root, "work/catalog-official", entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    const match = manifest.sources?.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
    if (!match) continue;
    const bytes = await readFile(resolve(runRoot, match.artifactPath));
    if (createHash("sha256").update(bytes).digest("hex") !== match.sha256) throw new Error("BUCT Wave 53 evidence hash mismatch.");
    source = match;
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}

if (!source) throw new Error("Missing locked BUCT Wave 53 evidence.");

const baseline = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const priorCandidate = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-release-candidate.draft.json"), "utf8")) as CatalogSeedBundle;
const school = baseline.schools?.find((row) => row.slug === "beijing-university-of-chemical-technology");
const city = priorCandidate.cities?.find((row) => row.slug === "beijing") ?? baseline.cities?.find((row) => row.slug === "beijing");
if (!school || !city) throw new Error("Wave 53 BUCT dependency rows are incomplete.");

const sourceFields = {
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
};

const program: CatalogSeedProgram = {
  slug: "beijing-university-of-chemical-technology-korean-preparatory-undergraduate-pathway-2027",
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: "Preparatory & Undergraduate Program for Korean Students (BUCT-Shewai PCP)",
  nameZh: "北京化工大学韩国学生预科衔接本科项目",
  degreeLevel: "Non-degree",
  durationMonths: 8,
  fieldCategory: "Foundation and university preparation",
  subjectArea: "Intensive Chinese language, preliminary academic preparation, mathematics, physics, HSK preparation and CSCA preparation before progression to an undergraduate major open to international students.",
  teachingLanguage: "Chinese",
  cscaRequirement: "The CSCA score report is submitted during the preparatory period. Progression to undergraduate study requires passing both the CSCA Basic Competency Examination for International Students and the preparatory completion examination.",
  hskRequirement: "No fixed HSK entry score is published. Applicants with existing HSK proficiency may enter more advanced foundational coursework.",
  scholarshipText: "Outstanding Korean students may receive scholarships under university rules, and students from Korean partner high schools may receive scholarship benefits. No named award, amount, coverage or deadline is published on this page.",
  applicationUrl: source.finalUrl ?? source.url,
  applicationNote: "Applicants must be graduates or expected graduates of a Korean high school, or hold an equivalent qualification, and must be under 25. Required materials are the BUCT application form, high-school graduation or expected-graduation certificate, full high-school transcript, high-school student record, passport copy, photographs, study plan and a CSCA score report submitted during the preparatory period. The program does not publish a tuition amount.",
  hasScholarship: true,
  badgeText: "2027 preparatory pathway",
  displayGroup: "Non-degree",
  displayGroupLabel: "Foundation and pathway programs",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "official page program title",
    nameZh: "translated label of the official English program title",
    degreeLevel: "official preparatory phase preceding undergraduate progression",
    durationMonths: "Program Overview: eight-month curriculum; Academic Schedule: January to August",
    fieldCategory: "Program Overview",
    subjectArea: "Program Overview and Key Features",
    teachingLanguage: "Program Overview: intensive Chinese-language training",
    cscaRequirement: "Required Documents item 8 and Key Features item 2",
    hskRequirement: "Key Features item 3; no fixed entry score is stated",
    scholarshipText: "Key Features items 5-6",
    applicationUrl: "registered official HTTPS program page",
    applicationNote: "Eligibility and Required Documents sections",
  },
};

const intake: CatalogSeedProgramIntake = {
  programSlug: program.slug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  openDate: "2026-03-10T00:00:00.000Z",
  deadlineDate: "2027-01-10T15:59:59.000Z",
  deadlineLabel: "Apply March 10, 2026-January 10, 2027. Preparatory coursework runs from January through August, followed by undergraduate study from September; the page publishes no exact start day. The deadline is normalized to end of day in Beijing.",
  applicationRound: "BUCT Korean preparatory and undergraduate pathway 2027",
  status: "open",
  ...sourceFields,
  sourceFieldLineage: {
    intakeTerm: "Academic Schedule: January-August preparatory coursework, normalized as Spring",
    intakeYear: "application closes January 10, 2027 and the January-August schedule",
    openDate: "Application time",
    deadlineDate: "Application time; Beijing end-of-day normalization",
    deadlineLabel: "Application time and Academic Schedule",
    applicationRound: "official program title",
    status: "application deadline compared with capturedAt",
  },
};

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: source.fetchedAt,
  cities: [city],
  schools: [school],
  programs: [program],
  programIntakes: [intake],
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 53 validation failed:\n${validation.errors.join("\n")}`);

const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: source.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: 1, new2027Intakes: 1, refreshedScholarships: 0, sourceSnapshots: 1 },
  evidence: [{ id: source.id, label: source.label, url: source.url, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "The page publishes no tuition, registration-fee or accommodation amount; all fee fields remain absent.",
    "The page mentions possible scholarships but gives no award name, amount, coverage or deadline; no scholarship entity is emitted.",
    "The page permits progression to majors open to international students but does not enumerate those majors; no undergraduate program rows are inferred.",
    "The page gives January-August rather than an exact start date; no exact start date is asserted.",
    "This pathway does not establish BUCT's general 2027 undergraduate, master or doctoral admission cycle.",
  ],
  notes: [
    "Wave 53 is limited to the official Korean-student preparatory pathway and its directly supported 2027 application window.",
    "No applicant, account, passport, payment, contact-person or other personal data is included.",
  ],
};

const stem = resolve(root, "seeds/catalog.2027-wave-53");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({
  ok: true,
  wave: 53,
  candidateSha256,
  counts: { cities: 1, schools: 1, programs: 1, programIntakes: 1, scholarships: 0, sourceSnapshots: 1 },
  publicationAuthorized: false,
}, null, 2));
