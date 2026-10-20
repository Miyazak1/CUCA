import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };

const root = process.cwd();
const sourceId = "tsinghua-global-mba-admissions-2027";
const expectedSha256 = "37e9f5c9f183e98dcbbc48531705f113668c134fc54e613754a4bcf011dc0aea";
let source: ManifestSource | undefined;

for (const entry of await readdir(resolve(root, "work/catalog-official"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(root, "work/catalog-official", entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    const found = manifest.sources?.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
    if (!found) continue;
    const bytes = await readFile(resolve(runRoot, found.artifactPath));
    if (createHash("sha256").update(bytes).digest("hex") !== found.sha256) throw new Error("Tsinghua Global MBA evidence hash mismatch.");
    source = found;
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
if (!source) throw new Error("Missing locked Tsinghua Global MBA 2027 evidence.");

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-release-candidate.draft.json"), "utf8")) as CatalogSeedBundle;
const programSlug = "tsinghua-university-master-school-of-economics-and-management-tsinghua-global-mba-program-gmba-english";
const city = prior.cities?.find((row) => row.slug === "beijing");
const school = prior.schools?.find((row) => row.slug === "tsinghua-university");
const priorProgram = prior.programs?.find((row) => row.slug === programSlug);
if (!city || !school || !priorProgram) throw new Error("Missing Tsinghua Global MBA dependency or prior program row.");

const fields = { sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const program = {
  ...priorProgram,
  durationYears: 2,
  fieldCategory: "Business administration",
  subjectArea: "Global MBA",
  englishRequirement: "For applicants who are not native English speakers: IELTS 6.5; TOEFL iBT 85 for tests taken before January 21, 2026 or TOEFL iBT 4.5 for tests taken on or after January 21, 2026; Duolingo English Test 120; or a certificate confirming that the prior degree was taught entirely in English.",
  tuitionAmount: 198000,
  tuitionCurrency: "RMB",
  tuitionPeriod: "program",
  tuitionText: "RMB 198,000 for the full two-year program.",
  scholarshipText: "The Chinese Government Scholarship full award covers tuition, on-campus accommodation, medical insurance and a monthly stipend. Tsinghua MBA Program scholarships are awarded from interview performance and comprehensive evaluation and may cover up to full tuition.",
  applicationUrl: source.finalUrl ?? source.url,
  applicationNote: "Two-year full-time English program on the Beijing campus. Applicants need at least three years of post-graduation work experience after a bachelor's degree, or at least two years after a master's or doctoral degree. Required materials include personal statement, authenticated degree evidence, undergraduate transcript and GPA evidence where needed, two recommendations, passport and nationality-status documents, English resume, English proof, essays, employment information, and a qualifying GMAT/GMAT Focus/GRE result or the Tsinghua MBA Entrance Exam.",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...fields,
  sourceFieldLineage: {
    ...(priorProgram.sourceFieldLineage ?? {}),
    durationYears: "official Global MBA 2027 guide, Programs table",
    fieldCategory: "official program identity",
    subjectArea: "official program identity",
    englishRequirement: "official Global MBA 2027 guide, Language Proficiency Test score report",
    tuitionAmount: "official Global MBA 2027 guide, Costs",
    tuitionCurrency: "official Global MBA 2027 guide, Costs",
    tuitionPeriod: "official Global MBA 2027 guide, Costs",
    tuitionText: "official Global MBA 2027 guide, Costs",
    scholarshipText: "official Global MBA 2027 guide, Scholarships",
    applicationUrl: "registered official Global MBA 2027 guide",
    applicationNote: "official Global MBA 2027 guide, Programs, Required Qualifications and Application Documents",
  },
};

const intake = {
  programSlug,
  intakeTerm: "Fall",
  intakeYear: 2027,
  deadlineDate: "2027-03-31T15:59:59.000Z",
  deadlineLabel: "Round 1: October 19, 2026; Round 2: December 14, 2026; Round 3: February 22, 2027; Round 4: March 31, 2027. The application system opened in September 2026.",
  applicationRound: "Tsinghua Global MBA 2027 - four application rounds",
  status: "open" as const,
  ...fields,
  sourceFieldLineage: {
    intakeTerm: "official August 2027 enrollment schedule",
    intakeYear: "official Global MBA 2027 guide",
    deadlineDate: "official final-round date normalized to end of day in Beijing",
    deadlineLabel: "official Admission Calendar",
    applicationRound: "official Admission Calendar",
    status: "official application system opening month and final deadline compared with capturedAt",
  },
};

const candidate: CatalogSeedBundle = { version: 1, generatedAt: source.fetchedAt, cities: [city], schools: [school], programs: [program], programIntakes: [intake], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 65 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: source.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: 1, refreshed2027Intakes: 1, sourceSnapshots: 1 },
  evidence: [{ id: source.id, label: source.label, url: source.url, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "The official page states that the application system opened in September 2026 but does not publish an exact opening day, so openDate remains absent.",
    "Program scholarships are described at coverage-category level; no award-specific candidate entitlement is inferred.",
    "The official IMAP 2027 notice remains visible in Tsinghua's notice index but its article URL returned HTTP 404 during controlled collection, so no IMAP fields are imported in this wave.",
  ],
  notes: ["The exact four-round Global MBA calendar replaces the prior university-level generic deadline label.", "No applicant, account, passport, payment or other personal data is included."],
};

await Promise.all([
  writeFile(resolve(root, "seeds/catalog.2027-wave-65.draft.json"), candidateText, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-65.validation.json"), `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-65.review.json"), `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({ ok: true, wave: 65, candidateSha256, counts: { cities: 1, schools: 1, programs: 1, programIntakes: 1, scholarships: 0, sourceSnapshots: 1 }, publicationAuthorized: false }, null, 2));
