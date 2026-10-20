import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };

const root = process.cwd();
const sourceId = "tsinghua-environment-master-admissions-2027";
const expectedSha256 = "f2dc53bc52756e7344b9fc7d9ad42fcf206d7c5160a368476250dd3c3800a6e9";
let source: ManifestSource | undefined;

for (const entry of await readdir(resolve(root, "work/catalog-official"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(root, "work/catalog-official", entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    const found = manifest.sources?.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
    if (!found) continue;
    const bytes = await readFile(resolve(runRoot, found.artifactPath));
    if (createHash("sha256").update(bytes).digest("hex") !== found.sha256) throw new Error("Tsinghua Environment evidence hash mismatch.");
    source = found;
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
if (!source) throw new Error("Missing locked Tsinghua Environment 2027 evidence.");

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-release-candidate.draft.json"), "utf8")) as CatalogSeedBundle;
const programSlug = "tsinghua-university-2027-master-master-program-in-environmental-science-engineering-and-management";
const city = prior.cities?.find((row) => row.slug === "beijing");
const school = prior.schools?.find((row) => row.slug === "tsinghua-university");
const priorProgram = prior.programs?.find((row) => row.slug === programSlug);
if (!city || !school || !priorProgram) throw new Error("Missing Tsinghua Environment dependency or prior program row.");

const fields = { sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const program = {
  ...priorProgram,
  fieldCategory: "Environmental science, engineering and management",
  subjectArea: "Environmental engineering, environmental science, management and planning",
  teachingLanguage: "English",
  englishRequirement: "Non-native English speakers must provide TOEFL iBT 90 overall with writing 23 for tests taken before January 21, 2026; TOEFL iBT 5 overall with writing 5 for tests taken on or after January 21, 2026; or IELTS 6.5 overall with writing 6. Applicants who completed an undergraduate or master's degree in English may submit an official English-medium certificate and request an exemption.",
  scholarshipText: "Chinese Government Scholarship full awards typically cover tuition, stipend, on-campus accommodation or subsidy, and medical insurance; applicants seeking CGS should submit the Tsinghua application by December 15, 2026 at 17:00 Beijing time. Tuition scholarships such as the Beijing Government Scholarship may cover full or partial tuition for one academic year.",
  applicationUrl: source.finalUrl ?? source.url,
  applicationNote: "Applicants need a bachelor's degree or equivalent in environmental science and engineering, environmental economics and management, civil engineering, chemical engineering, chemistry, biology, materials science and engineering, mechanical engineering, or another related field. The bachelor's degree must come from a formal four-year program with at least 100 credits or 30 courses; required-course average must be at least 70%, with no more than five courses below 60%. Applicants apply through Tsinghua's graduate application system and upload the required documents and application fee.",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...fields,
  sourceFieldLineage: {
    ...(priorProgram.sourceFieldLineage ?? {}),
    fieldCategory: "official 2027 program overview",
    subjectArea: "official 2027 program overview",
    teachingLanguage: "official page title and Full English Programs section",
    englishRequirement: "official 2027 guide, Required Qualification of Applicants, item 4",
    tuitionAmount: "Tsinghua 2027 international graduate tuition schedule (https://yzbm.tsinghua.edu.cn/publish/s05/s0501/detail/bb745c8c-e817-4532-8cc1-70fa21bae1b5; SHA-256 86a5b60157fe6fd0fc77d2b4b6bb89ef8beebfedb50dbdc2c7e19f1348ad1b46)",
    tuitionCurrency: "Tsinghua 2027 international graduate tuition schedule (SHA-256 86a5b60157fe6fd0fc77d2b4b6bb89ef8beebfedb50dbdc2c7e19f1348ad1b46)",
    tuitionPeriod: "Tsinghua 2027 international graduate tuition schedule (SHA-256 86a5b60157fe6fd0fc77d2b4b6bb89ef8beebfedb50dbdc2c7e19f1348ad1b46)",
    tuitionText: "Tsinghua 2027 international graduate tuition schedule (SHA-256 86a5b60157fe6fd0fc77d2b4b6bb89ef8beebfedb50dbdc2c7e19f1348ad1b46)",
    scholarshipText: "official 2027 guide, Scholarship section",
    applicationUrl: "registered official School of Environment 2027 guide",
    applicationNote: "official 2027 guide, qualifications and application sections",
  },
};

const intake = {
  programSlug,
  intakeTerm: "Fall",
  intakeYear: 2027,
  deadlineDate: "2027-02-27T09:00:00.000Z",
  deadlineLabel: "Round 1: now through December 15, 2026 at 17:00 Beijing time. Round 2: January 1, 2027 at 08:00 through February 27, 2027 at 17:00 Beijing time.",
  applicationRound: "Tsinghua School of Environment 2027 - two application rounds",
  status: "open" as const,
  ...fields,
  sourceFieldLineage: {
    intakeTerm: "2027 English master's admission cycle and Tsinghua's normal Fall registration",
    intakeYear: "official 2027 guide title",
    deadlineDate: "official second-round closing time converted from Beijing time to UTC",
    deadlineLabel: "official 2027 Application Schedule",
    applicationRound: "official 2027 Application Schedule",
    status: "official first-round availability compared with capturedAt",
  },
};

const candidate: CatalogSeedBundle = { version: 1, generatedAt: source.fetchedAt, cities: [city], schools: [school], programs: [program], programIntakes: [intake], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 70 validation failed:\n${validation.errors.join("\n")}`);
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
    "The School of Environment guide does not publish a numeric program duration, so durationYears remains absent.",
    "The program tuition is retained from Tsinghua's separately locked official 2027 international graduate tuition schedule; the School of Environment guide does not repeat it.",
    "Scholarship text describes general coverage and application timing, not an applicant entitlement or guaranteed award.",
  ],
  notes: ["The department-specific two-round calendar replaces the prior university-level generic deadline for this route.", "No applicant, account, passport, payment or other personal data is included."],
};

await Promise.all([
  writeFile(resolve(root, "seeds/catalog.2027-wave-70.draft.json"), candidateText, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-70.validation.json"), `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-70.review.json"), `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({ ok: true, wave: 70, candidateSha256, counts: { cities: 1, schools: 1, programs: 1, programIntakes: 1, scholarships: 0, sourceSnapshots: 1 }, publicationAuthorized: false }, null, 2));
