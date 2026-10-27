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
const schoolSlug = "china-university-of-geosciences-wuhan";
const programSlug = "china-university-of-geosciences-wuhan-csca-pre-university-2027";
const evidenceSpecs = [
  { run: "work/catalog-official/cug-wuhan-2027-20261026", id: "cug-wuhan-undergraduate-application-guide-2027" },
  { run: "work/catalog-official/cug-wuhan-2027-20261026", id: "cug-wuhan-master-application-guide-2027" },
  { run: "work/catalog-official/cug-wuhan-2027-20261026", id: "cug-wuhan-doctoral-application-guide-2027" },
  { run: "work/catalog-official/cug-wuhan-2027-20261026", id: "cug-wuhan-csca-pre-university-2027" },
  { run: "work/catalog-official/cug-wuhan-degree-pdfs-2027-20261026", id: "cug-wuhan-undergraduate-application-guide-pdf-2027" },
  { run: "work/catalog-official/cug-wuhan-graduate-pdfs-2027-20261026", id: "cug-wuhan-master-application-guide-pdf-2027" },
  { run: "work/catalog-official/cug-wuhan-graduate-pdfs-2027-20261026", id: "cug-wuhan-doctoral-application-guide-pdf-2027" },
] as const;

const evidence: ManifestSource[] = [];
for (const spec of evidenceSpecs) {
  const runPath = resolve(root, spec.run);
  const manifest = JSON.parse(await readFile(resolve(runPath, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
  const source = manifest.sources.find((row) => row.id === spec.id && row.status === 200);
  if (!source) throw new Error(`Missing successful official source ${spec.id}.`);
  const artifact = await readFile(resolve(runPath, source.artifactPath));
  if (createHash("sha256").update(artifact).digest("hex") !== source.sha256) throw new Error(`Artifact hash mismatch for ${spec.id}.`);
  evidence.push(source);
}

const source = evidence.find((row) => row.id === "cug-wuhan-csca-pre-university-2027");
if (!source) throw new Error("CUG 2027 pre-university source is missing.");
const sourceUrl = source.finalUrl ?? source.url;
const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-release.reviewed.json"), "utf8")) as CatalogSeedBundle;
const city = dependency.cities?.find((row) => row.slug === "wuhan");
if (!city) throw new Error("Wuhan city dependency is missing.");
if (dependency.schools?.some((row) => row.slug === schoolSlug)) throw new Error(`${schoolSlug} already exists in the reviewed release.`);
if (dependency.programs?.some((row) => row.slug === programSlug)) throw new Error(`${programSlug} already exists in the reviewed release.`);

const school = {
  slug: schoolSlug,
  nameEn: "China University of Geosciences (Wuhan)",
  nameZh: "中国地质大学（武汉）",
  citySlug: "wuhan",
  schoolType: "Public",
  region: "Wuhan, Hubei, Central China",
  applicationLevel: "Bachelor, Master, Doctoral and Pre-University",
  languageOfInstruction: "The 2027 pre-university route includes Chinese-language learning and academic foundation courses. Degree-route teaching languages remain under detailed review.",
  deadlineSummary: "The 2027 CSCA Pre-University Program accepts applications from January 1 through June 30, 2027. Bachelor, master and doctoral 2027 guides are published; their detailed round deadlines remain under extraction.",
  tuitionSummary: "2027 CSCA Pre-University tuition is CNY 18,000 per academic year. Degree-route tuition remains under detailed review.",
  applicationFee: "CNY 400 for the 2027 CSCA Pre-University Program",
  websiteUrl: "https://eniec.cug.edu.cn/",
  admissionsUrl: "https://admission.cug.edu.cn/",
  campusHighlights: [
    "Official 2027 international bachelor guide",
    "Official 2027 international master guide",
    "Official 2027 international doctoral guide",
    "Official 2027 CSCA pre-university route",
  ],
  contactNotes: "Official international admissions office: International Education College, 388 Lumo Road, Wuhan, Hubei 430074. Degree-guide PDFs are captured and hash-locked; program-level degree details remain pending structured extraction.",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  sourceUrl,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    nameEn: "official 2027 degree-guide cover and pre-university page identity",
    nameZh: "official 2027 degree-guide cover",
    citySlug: "official admissions-office address",
    schoolType: "official public-university institutional identity",
    region: "official admissions-office address plus CUAC geographic taxonomy",
    applicationLevel: "official 2027 bachelor, master, doctoral and pre-university guide titles",
    languageOfInstruction: "2027 CSCA Pre-University Program Overview; degree details intentionally unresolved",
    deadlineSummary: "2027 CSCA Pre-University Application period",
    tuitionSummary: "2027 CSCA Pre-University Fees table",
    applicationFee: "2027 CSCA Pre-University Fees table",
    websiteUrl: "official English international-education domain",
    admissionsUrl: "2027 CSCA Pre-University How to Apply section",
    campusHighlights: "official 2027 guide titles",
    contactNotes: "official degree-guide contact-information page and evidence review status",
  },
};

const program = {
  slug: programSlug,
  schoolSlug,
  citySlug: "wuhan",
  nameEn: "2027 CSCA Pre-University Program",
  nameZh: "2027年CSCA预科项目",
  degreeLevel: "Pre-University",
  durationYears: 1,
  fieldCategory: "Foundation and university preparation",
  subjectArea: "Chinese language, CSCA preparation and academic foundation",
  teachingLanguage: "Includes Chinese-language learning",
  tuitionAmount: 18000,
  tuitionCurrency: "CNY",
  tuitionPeriod: "academic year",
  tuitionText: "CNY 18,000 per academic year; application fee CNY 400, medical insurance CNY 1,000 per academic year, and double-room accommodation CNY 700 per bed per month are separate.",
  applicationUrl: "https://admission.cug.edu.cn/",
  applicationNote: "One-year (40-week) preparation for undergraduate study. The official guide states high-school graduates aged 18-25 and separately requires a guardian authorization for applicants under 18 as of September 1, 2027. Required materials include notarized education evidence and translation, passport and visa pages, a recent physical examination, a recent non-criminal record and proof of financial support.",
  badgeText: "2027 CSCA preparation",
  displayTuition: "CNY 18,000/year",
  displaySubjects: ["Chinese language", "CSCA preparation", "Academic foundation"],
  displayGroup: "pre-university",
  displayGroupLabel: "Pre-University",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  sourceUrl,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    nameEn: "official page title",
    nameZh: "faithful Chinese rendering of official title",
    degreeLevel: "official Pre-University classification",
    durationYears: "Program Overview: one year / 40 weeks",
    fieldCategory: "Program Overview",
    subjectArea: "Program Overview",
    teachingLanguage: "Program Overview Chinese-language-learning component; broader medium not inferred",
    tuitionAmount: "Fees table",
    tuitionCurrency: "Fees table",
    tuitionPeriod: "Fees table",
    tuitionText: "Fees table",
    applicationUrl: "How to Apply section",
    applicationNote: "Eligibility and Application Materials sections",
  },
};

const intake = {
  programSlug,
  intakeTerm: "2027 cohort",
  intakeYear: 2027,
  openDate: "2027-01-01T00:00:00.000Z",
  deadlineDate: "2027-06-30T23:59:59.000Z",
  deadlineLabel: "Application period: January 1-June 30, 2027.",
  applicationRound: "CUG Wuhan 2027 CSCA Pre-University admission",
  sourceUrl,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    intakeTerm: "official page title; Fall/Spring term is not inferred",
    intakeYear: "official page title and Application period",
    openDate: "Application period",
    deadlineDate: "Application period",
    deadlineLabel: "Application period",
    applicationRound: "official page title",
  },
};

const generatedAt = evidence.map((row) => row.fetchedAt).sort().at(-1) ?? source.fetchedAt;
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt,
  cities: [city],
  schools: [school],
  programs: [program],
  programIntakes: [intake],
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 Wave 96 validation failed: ${validation.errors.join(" ")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [schoolSlug], newSchools: 1, programs: 1, programIntakes: 1, scholarships: 0 },
  evidence: evidence.map((row) => ({ id: row.id, label: row.label, url: row.finalUrl ?? row.url, fetchedAt: row.fetchedAt, sha256: row.sha256 })),
  unresolved: [
    "The degree-guide PDFs are image-based. Their covers and official page titles verify the 2027 bachelor, master and doctoral cycles, but program-level tables and route-specific fields still require structured visual extraction.",
    "The captured scholarship download returned text/html rather than a PDF and remains excluded until its content type is resolved.",
    "The pre-university guide does not label the cohort Fall or Spring, so the intake term is kept as '2027 cohort' rather than inferred.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public institutional admissions facts are included; no applicant or account data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-96");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 96, candidateSha256, counts: { cities: 1, schools: 1, programs: 1, programIntakes: 1, scholarships: 0 }, publicationAuthorized: false }, null, 2));
