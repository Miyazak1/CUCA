import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };

const root = process.cwd();
const sourceId = "tsinghua-imap-admissions-2027";
const expectedSha256 = "db472a3632b38a8acfc382f26b9e626cf15d89d7d3263061049a270b7a056c9c";
let source: ManifestSource | undefined;

for (const entry of await readdir(resolve(root, "work/catalog-official"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(root, "work/catalog-official", entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    const found = manifest.sources?.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
    if (!found) continue;
    const bytes = await readFile(resolve(runRoot, found.artifactPath));
    if (createHash("sha256").update(bytes).digest("hex") !== found.sha256) throw new Error("Tsinghua IMAP evidence hash mismatch.");
    source = found;
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
if (!source) throw new Error("Missing locked Tsinghua IMAP 2027 evidence.");

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-release-candidate.draft.json"), "utf8")) as CatalogSeedBundle;
const programSlug = "tsinghua-university-master-department-of-psychological-and-cognitive-sciences-international-master-of-applied-psychology-imap-program-english";
const city = prior.cities?.find((row) => row.slug === "beijing");
const school = prior.schools?.find((row) => row.slug === "tsinghua-university");
const priorProgram = prior.programs?.find((row) => row.slug === programSlug);
if (!city || !school || !priorProgram) throw new Error("Missing Tsinghua IMAP dependency or prior program row.");

const fields = { sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const program = {
  ...priorProgram,
  durationYears: 2,
  fieldCategory: "Applied psychology",
  subjectArea: "Engineering psychology, ergonomics, human-computer interaction and user experience",
  teachingLanguage: "English",
  englishRequirement: "Non-native English speakers must provide IELTS 5.5, TOEFL iBT 72 under the old scoring version or 4.0 under the new scoring version, or other supporting evidence such as a certificate confirming that the undergraduate medium of instruction was English.",
  applicationUrl: source.finalUrl ?? source.url,
  applicationNote: "Full-time English-taught program designed for completion in two years, with an option to extend to three years based on individual needs. Applicants are evaluated through document review followed by an in-person or remote comprehensive assessment. The program welcomes relevant recent graduates, professionals in artificial intelligence or mental health, and applicants intending to work in applied psychology; practical Co-Op learning is available.",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...fields,
  sourceFieldLineage: {
    ...(priorProgram.sourceFieldLineage ?? {}),
    durationYears: "official IMAP 2027 guide, Teaching Methods and Degree Awarding",
    fieldCategory: "official IMAP 2027 project overview",
    subjectArea: "official IMAP 2027 project overview",
    teachingLanguage: "official IMAP 2027 guide, Teaching Methods and Degree Awarding",
    englishRequirement: "official IMAP 2027 guide, Application and Admission",
    applicationUrl: "registered official IMAP 2027 guide",
    applicationNote: "official IMAP 2027 guide, Prospective Students, Teaching Methods and Application and Admission",
  },
};

const candidate: CatalogSeedBundle = { version: 1, generatedAt: source.fetchedAt, cities: [city], schools: [school], programs: [program], programIntakes: [], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 66 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: source.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: 1, refreshed2027Intakes: 0, sourceSnapshots: 1 },
  evidence: [{ id: source.id, label: source.label, url: source.url, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "The IMAP article does not print an exact application deadline; the existing general Tsinghua 2027 intake record is retained without inventing a department date.",
    "The article's tuition section is image-only, so the existing amount from Tsinghua's separate official 2027 tuition schedule is preserved rather than re-extracted from the image.",
    "The program can extend to three years, but the structured duration records the published standard two-year design.",
  ],
  notes: ["The corrected official article URL was resolved from the department's current notice index after a stale indexed URL returned HTTP 404.", "No applicant, account, passport, payment or other personal data is included."],
};

await Promise.all([
  writeFile(resolve(root, "seeds/catalog.2027-wave-66.draft.json"), candidateText, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-66.validation.json"), `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-66.review.json"), `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({ ok: true, wave: 66, candidateSha256, counts: { cities: 1, schools: 1, programs: 1, programIntakes: 0, scholarships: 0, sourceSnapshots: 1 }, publicationAuthorized: false }, null, 2));
