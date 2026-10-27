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
  sha256: string;
  artifactPath: string;
};

const root = process.cwd();
const run = "2026-10-27T05-38-16-569Z";
const sourceId = "lanzhou-university-exchange-program-spring-2027";
const expectedSha256 = "6dd73fb607ace3bcf730be1560c1ef517c282eb1e8108a31374bd67379541dc8";
const runRoot = resolve(root, "work/catalog-official", run);
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
const source = manifest.sources.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
if (!source) throw new Error("Missing locked Lanzhou University Spring 2027 exchange guide.");
const evidence = await readFile(resolve(runRoot, source.artifactPath));
if (createHash("sha256").update(evidence).digest("hex") !== expectedSha256) throw new Error("Lanzhou University evidence hash mismatch.");

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-114.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "lanzhou");
const baseSchool = prior.schools?.find((row) => row.slug === "lanzhou-university");
if (!city || !baseSchool) throw new Error("Wave 114 Lanzhou University dependencies are missing.");
const sourceFields = {
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
};

const school = {
  ...baseSchool,
  applicationLevel: "The official 2026-2027 exchange guide publishes a Spring 2027 partner-university exchange route for undergraduate and graduate students. General Fall 2027 degree admissions remain unpublished.",
  languageRequirement: "Chinese-language regular courses require HSK Level 4 or above. English-taught IMBA courses and arranged tutoring require English proficiency certified by the home university. Chinese language and culture courses may be taught in Chinese or English depending on proficiency.",
  hskRequirement: "HSK Level 4 or above for regular Chinese-taught courses; no numeric HSK score is published.",
  englishRequirement: "English proficiency certified by the applicant's home university for English-taught IMBA courses or arranged tutoring; no test name or minimum score is published.",
  deadlineSummary: "Partner-university nomination closes October 31, 2026; the student application session runs September 10-November 10, 2026 for Spring 2027 entry.",
  tuitionSummary: "Tuition is waived for exchange students from partner universities. Accommodation is CNY 30/day or CNY 4,500/semester unless waived under the exchange agreement; insurance is about CNY 500/semester.",
  admissionsUrl: source.finalUrl ?? source.url,
  campusHighlights: [...new Set([...(baseSchool.campusHighlights ?? []), "Spring 2027 partner-university exchange route"])],
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    ...(baseSchool.sourceFieldLineage ?? {}),
    applicationLevel: "official 2026-2027 exchange guide level and Spring 2027 column",
    languageRequirement: "official available-courses section",
    hskRequirement: "official regular-course requirement",
    englishRequirement: "official arranged-tutoring and English-teaching-program requirements",
    deadlineSummary: "official Spring 2027 nomination and application schedule",
    tuitionSummary: "official tuition, accommodation and insurance rows",
    admissionsUrl: "registered official Lanzhou University PDF",
    campusHighlights: "official Spring 2027 exchange route",
  },
};

const program: CatalogSeedProgram = {
  slug: "lanzhou-university-partner-exchange-spring-2027",
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: "Partner University Exchange Program - Spring 2027",
  nameZh: "兰州大学合作院校交换生项目（2027年春季）",
  degreeLevel: "Non-degree",
  durationMonths: 5,
  fieldCategory: "Exchange and visiting study",
  subjectArea: "Chinese Language and Culture; Regular University Courses; Arranged Tutoring; English-taught IMBA Courses",
  teachingLanguage: "Chinese and English",
  hskRequirement: "HSK Level 4 or above for regular Chinese-taught courses. Chinese language and culture courses are placed according to proficiency.",
  englishRequirement: "Home-university proof of English proficiency for English-taught IMBA courses and arranged tutoring; no numeric threshold is published.",
  tuitionText: "Tuition is waived for exchange students from partner universities. The number of places and any accommodation waiver depend on the institutional exchange agreement.",
  applicationUrl: source.finalUrl ?? source.url,
  applicationNote: "Only students formally nominated under a partner-university exchange agreement are eligible. Required uploads are passport copy, physical-examination form, latest home-university transcript, enrollment certificate, ID photo and non-criminal record. Personal staff contact details printed in the guide are excluded.",
  hasScholarship: false,
  badgeText: "Spring 2027 partner exchange",
  displaySubjects: ["Chinese Language and Culture", "Regular Courses", "IMBA", "Arranged Tutoring"],
  displayGroup: "Non-degree",
  displayGroupLabel: "Partner exchange programs",
  status: "draft",
  verificationStatus: "unverified",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "official exchange-program title and Spring 2027 schedule",
    nameZh: "official university and exchange-program identity",
    degreeLevel: "official exchange level rather than degree award",
    durationMonths: "official one-semester route and guide's approximately five-month visa guidance",
    fieldCategory: "CUAC grouping of the official exchange route",
    subjectArea: "official available-courses section",
    teachingLanguage: "official course-language descriptions",
    hskRequirement: "official regular-course requirement",
    englishRequirement: "official English-track proof requirement",
    tuitionText: "official tuition and agreement conditions",
    applicationUrl: "registered official Lanzhou University PDF",
    applicationNote: "official eligibility and upload-material sections with personal contacts excluded",
  },
};

const intake: CatalogSeedProgramIntake = {
  programSlug: program.slug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  openDate: "2026-09-10T00:00:00.000Z",
  deadlineDate: "2026-11-10T15:59:59.000Z",
  deadlineLabel: "Home-university nomination closes October 31, 2026. Student applications are accepted September 10-November 10, 2026; the guide publishes no time or timezone, so CUAC uses Beijing end-of-day for the normalized deadline.",
  applicationRound: "Lanzhou University Spring 2027 partner exchange",
  status: "open",
  ...sourceFields,
  sourceFieldLineage: {
    intakeTerm: "official Spring 2027 schedule column",
    intakeYear: "official Spring 2027 schedule column",
    openDate: "official application-session opening date",
    deadlineDate: "official application-session closing date normalized to Beijing end-of-day",
    deadlineLabel: "official nomination and application schedule",
    applicationRound: "official exchange-program scope and entry term",
    status: "application window compared with source capture date",
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
if (!validation.ok) throw new Error(`Wave 216 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: source.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 40, schoolSlugs: [school.slug], newSchools: 0, programs: 1, programIntakes: 1, scholarships: 0 },
  evidence: [{ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "This partner-university exchange route does not establish general Fall 2027 degree admissions, degree-program availability or self-funded visiting admission.",
    "The guide publishes no numeric English threshold, no numeric HSK score, no exact registration date and no institution-wide exchange place count; those fields remain unresolved.",
    "Tuition is waived for eligible partner exchange students, but accommodation waiver and place numbers depend on the bilateral agreement and are not generalized.",
  ],
  sensitiveDataCheck: { result: "pass", note: "The named coordinator, institutional email addresses, telephone numbers and applicant identifiers are excluded. No applicant data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-216");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 216, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
