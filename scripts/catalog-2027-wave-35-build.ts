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
const sourceId = "jnu-summer-fall-winter-sessions-2026-2027";
const expectedSha256 = "1ca66a6ec6934b932c86b542b93005659e73063c0925f76ff5ef5764f8aeff8d";
const runRoot = resolve(root, "work/catalog-official/wave35");
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
const evidence = manifest.sources?.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
if (!evidence) throw new Error("Missing locked Jinan University 2027 session evidence.");
const evidenceBytes = await readFile(resolve(runRoot, evidence.artifactPath));
if (createHash("sha256").update(evidenceBytes).digest("hex") !== expectedSha256) throw new Error("Jinan University evidence hash mismatch.");

const baseline = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const schoolBase = baseline.schools?.find((row) => row.slug === "jinan-university");
const city = baseline.cities?.find((row) => row.slug === "guangzhou");
if (!schoolBase || !city) throw new Error("Wave 35 baseline dependencies are missing.");

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
  deadlineSummary: "The official 2026-2027 session page publishes three 2027 summer non-degree sessions. General Fall 2027 degree rounds remain unresolved.",
  admissionsUrl: evidence.url,
  languageTags: [...new Set([...(schoolBase.languageTags ?? []), "English-taught short-term study"])],
  campusHighlights: [...new Set([...(schoolBase.campusHighlights ?? []), "Official 2027 English-taught summer sessions for visiting students"])],
  ...verified,
  sourceFieldLineage: {
    ...(schoolBase.sourceFieldLineage ?? {}),
    applicationLevel: "official non-degree visiting-student sessions",
    deadlineSummary: "official 2027 session calendar",
    admissionsUrl: "registered official session page",
    languageTags: "official course-format section",
    campusHighlights: "official 2027 session calendar and eligibility",
  },
};

const commonProgram = {
  schoolSlug: school.slug,
  citySlug: city.slug,
  degreeLevel: "Non-degree",
  fieldCategory: "Visiting-student summer session",
  subjectArea: "English-taught courses across multiple disciplines; the published course list includes economics, business, mathematics, science, computing, humanities and social sciences.",
  teachingLanguage: "English",
  englishRequirement: "IELTS 6.5, TOEFL 90, or current/graduated study at an English-medium institution.",
  tuitionText: "Published session fees: online CNY 24,010 for one course or CNY 30,660 for two courses; in-person CNY 26,110 for one course or CNY 32,760 for two courses.",
  applicationUrl: evidence.url,
  applicationNote: "Open to undergraduate and graduate students worldwide. Courses carry 3-6 Jinan University credits; students may normally take up to three courses. The official page does not publish a fixed application deadline.",
  hasScholarship: false,
  badgeText: "Summer 2027",
  displayGroup: "Non-degree",
  displayGroupLabel: "Summer, Fall and Winter Sessions",
  ...verified,
  sourceFieldLineage: {
    degreeLevel: "official visiting-student eligibility and non-degree wording",
    fieldCategory: "official session description",
    subjectArea: "official 2027 course list",
    teachingLanguage: "official course-format section",
    englishRequirement: "official eligibility section",
    tuitionText: "official tuition and fees table",
    applicationUrl: "registered official session page",
    applicationNote: "official application, eligibility and credit sections",
  },
};

const routes = [
  { slug: "jinan-university-summer-session-i-2027", nameEn: "Summer Session I 2027", nameZh: "暨南大学2027年暑期学校第一期", start: "2027-05-17", end: "2027-06-18", round: "Summer I" },
  { slug: "jinan-university-summer-session-ii-2027", nameEn: "Summer Session II 2027", nameZh: "暨南大学2027年暑期学校第二期", start: "2027-06-28", end: "2027-07-16", round: "Summer II" },
  { slug: "jinan-university-summer-session-ii-guangzhou-2027", nameEn: "Summer Session II (Guangzhou) 2027", nameZh: "暨南大学2027年暑期学校第二期（广州）", start: "2027-06-28", end: "2027-07-30", round: "Summer II Guangzhou" },
] as const;

const programs: CatalogSeedProgram[] = routes.map((route) => ({
  slug: route.slug,
  nameEn: route.nameEn,
  nameZh: route.nameZh,
  ...commonProgram,
  sourceFieldLineage: {
    ...commonProgram.sourceFieldLineage,
    nameEn: "official 2027 session calendar",
    nameZh: "official institution and session calendar",
  },
}));

const programIntakes: CatalogSeedProgramIntake[] = routes.map((route) => ({
  programSlug: route.slug,
  intakeTerm: "Summer",
  intakeYear: 2027,
  deadlineLabel: `Session dates: ${route.start} to ${route.end}; the official page does not publish a fixed application deadline.`,
  applicationRound: `${route.round} 2027`,
  ...sourceFields,
  sourceFieldLineage: {
    intakeTerm: "official 2027 session calendar",
    intakeYear: "official 2027 session calendar",
    deadlineLabel: "official session dates and unresolved application deadline",
    applicationRound: "official session title",
  },
}));

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: evidence.fetchedAt,
  cities: [city],
  schools: [school],
  programs,
  programIntakes,
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 35 validation failed:\n${validation.errors.join("\n")}`);
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
    "The official page publishes session dates but no fixed application deadline, so deadlineDate remains absent.",
    "The page lists more than fifty course choices but does not confirm which course will run until enrollment; the catalog preserves the sessions rather than inventing per-course availability.",
    "The source establishes 2027 non-degree summer sessions, not Jinan University's general Fall 2027 degree admissions.",
  ],
  notes: ["No applicant, account, passport, payment or other personal data is included."],
};

const stem = resolve(root, "seeds/catalog.2027-wave-35");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 35, candidateSha256, counts: { schools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: 0, sourceSnapshots: 1 }, publicationAuthorized: false }, null, 2));
