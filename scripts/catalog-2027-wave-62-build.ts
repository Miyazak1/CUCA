import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const sourceId = "tsinghua-mia-global-governance-admissions-2027";
const expectedSha256 = "dc9722477e07731ad835903bb1d0bb6dce81d8488e2c29b88774b125bedcfaf6";
let source: ManifestSource | undefined;

for (const entry of await readdir(resolve(root, "work/catalog-official"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(root, "work/catalog-official", entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    const found = manifest.sources?.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
    if (!found) continue;
    const bytes = await readFile(resolve(runRoot, found.artifactPath));
    if (createHash("sha256").update(bytes).digest("hex") !== found.sha256) throw new Error("Tsinghua MIA-GG evidence hash mismatch.");
    source = found;
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
if (!source) throw new Error("Missing locked Tsinghua MIA-GG 2027 evidence.");

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-release-candidate.draft.json"), "utf8")) as CatalogSeedBundle;
const programSlug = "tsinghua-university-2027-master-master-of-international-affairs-global-governance-mia-gg-program-part-time";
const city = prior.cities?.find((row) => row.slug === "beijing");
const school = prior.schools?.find((row) => row.slug === "tsinghua-university");
const priorProgram = prior.programs?.find((row) => row.slug === programSlug);
if (!city || !school || !priorProgram) throw new Error("Missing Tsinghua MIA-GG dependency or prior program row.");

const fields = { sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const program = {
  ...priorProgram,
  durationYears: 2,
  fieldCategory: "International affairs and global governance",
  subjectArea: "International affairs, international relations, political science and global governance",
  englishRequirement: "IELTS 6.5; TOEFL iBT 90 for tests before January 21, 2026 or TOEFL iBT 4.5 for tests on or after January 21, 2026. Applicants whose prior bachelor's or master's degree was taught in English may submit an official medium-of-instruction certificate and request an exemption.",
  applicationUrl: source.finalUrl ?? source.url,
  applicationNote: "Part-time English-taught program normally delivered on weekends or in concentrated periods. Applicants need a bachelor's-equivalent degree and at least three years of full-time work experience after the bachelor's degree before enrollment. Preferred profiles include government or international-organization civil servants, senior managers, university or research staff, and other international-affairs professionals. Required materials include an English CV, a program-specific personal statement of no more than 600 words, degree/authentication documents, undergraduate transcripts, two recommendations, English evidence, passport and nationality-status documents; GRE/GMAT is optional. Selection uses document review and normally an interview.",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...fields,
  sourceFieldLineage: {
    ...(priorProgram.sourceFieldLineage ?? {}),
    durationYears: "official Training Methods section",
    fieldCategory: "official program overview and curriculum",
    subjectArea: "official program overview and curriculum",
    englishRequirement: "official Documents Requirements item 7",
    applicationUrl: "registered official program brochure",
    applicationNote: "official Required Qualifications, Documents Requirements, Evaluation and Training Methods sections",
  },
};

const intake = {
  programSlug,
  intakeTerm: "Fall",
  intakeYear: 2027,
  openDate: "2026-09-15T00:00:00.000Z",
  deadlineDate: "2027-03-01T08:00:00.000Z",
  deadlineLabel: "Round 1: through 16:00 December 14, 2026; Round 2: 08:00 January 1 through 16:00 March 1, 2027 (Beijing time). A third round may open only if separately announced.",
  applicationRound: "Tsinghua MIA-GG 2027 international admission - rounds 1 and 2",
  status: "open" as const,
  ...fields,
  sourceFieldLineage: {
    intakeTerm: "official 2027 graduate program and enrollment year",
    intakeYear: "official brochure title",
    openDate: "official brochure publication date used as the confirmed first-round open boundary; no earlier time is inferred",
    deadlineDate: "official final published round deadline converted from Beijing time",
    deadlineLabel: "official Application Schedule",
    applicationRound: "official Application Schedule",
    status: "final published deadline compared with capturedAt",
  },
};

const candidate: CatalogSeedBundle = { version: 1, generatedAt: source.fetchedAt, cities: [city], schools: [school], programs: [program], programIntakes: [intake], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 62 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: source.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: 1, refreshed2027Intakes: 1, sourceSnapshots: 1 },
  evidence: [{ id: source.id, label: source.label, url: source.url, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: ["The brochure says a third application round may open depending on demand, but no dates are published; no third round is structured."],
  notes: ["The final published round deadline replaces the earlier general university-level deadline label for this exact program.", "No applicant, account, passport, payment or other personal data is included."],
};

await Promise.all([
  writeFile(resolve(root, "seeds/catalog.2027-wave-62.draft.json"), candidateText, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-62.validation.json"), `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-62.review.json"), `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 62, candidateSha256, counts: { cities: 1, schools: 1, programs: 1, programIntakes: 1, scholarships: 0, sourceSnapshots: 1 }, publicationAuthorized: false }, null, 2));
