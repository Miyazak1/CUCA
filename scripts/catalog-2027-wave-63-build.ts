import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const expected = new Map([
  ["tsinghua-global-business-journalism-admissions-2027", "88e23ab0e373d952542860b83731fae5d0d5de2eaf17ba109d3c8af454063ccf"],
  ["tsinghua-global-business-journalism-required-documents", "26ec49e3589bf8fa6227a23aa271f06fe3d0c66aaad21779ae28d50ac3063acc"],
  ["tsinghua-global-business-journalism-faq", "60e00374f20b75b0350f5015aa1bfb6483a0da157f5e22b06eeb22a978de1379"],
]);
const evidence = new Map<string, ManifestSource>();

for (const entry of await readdir(resolve(root, "work/catalog-official"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(root, "work/catalog-official", entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    for (const row of manifest.sources ?? []) {
      if (row.status !== 200 || expected.get(row.id) !== row.sha256) continue;
      const bytes = await readFile(resolve(runRoot, row.artifactPath));
      if (createHash("sha256").update(bytes).digest("hex") !== row.sha256) throw new Error(`Tsinghua GBJ evidence hash mismatch: ${row.id}`);
      evidence.set(row.id, row);
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
for (const id of expected.keys()) if (!evidence.has(id)) throw new Error(`Missing locked Tsinghua GBJ evidence: ${id}`);

const admissions = evidence.get("tsinghua-global-business-journalism-admissions-2027")!;
const documents = evidence.get("tsinghua-global-business-journalism-required-documents")!;
const faq = evidence.get("tsinghua-global-business-journalism-faq")!;
const generatedAt = [admissions.fetchedAt, documents.fetchedAt, faq.fetchedAt].sort().at(-1)!;
const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-release-candidate.draft.json"), "utf8")) as CatalogSeedBundle;
const programSlug = "tsinghua-university-master-school-of-journalism-and-communication-master-s-program-in-global-business-journalism-gbj-english";
const city = prior.cities?.find((row) => row.slug === "beijing");
const school = prior.schools?.find((row) => row.slug === "tsinghua-university");
const priorProgram = prior.programs?.find((row) => row.slug === programSlug);
if (!city || !school || !priorProgram) throw new Error("Missing Tsinghua GBJ dependency or prior program row.");

const fields = { sourceUrl: admissions.finalUrl ?? admissions.url, sourceLabel: admissions.label, sourceSha256: admissions.sha256, capturedAt: admissions.fetchedAt };
const program = {
  ...priorProgram,
  durationYears: 2,
  fieldCategory: "Journalism and communication",
  subjectArea: "Global business journalism",
  englishRequirement: "For applicants whose native language is not English: IELTS 7.0; TOEFL iBT 103 for tests taken before January 21, 2026 or TOEFL iBT 5.5 for tests taken on or after January 21, 2026. Applicants whose prior degree was taught in English may request an exemption with an official university certificate and GBJ Office permission.",
  applicationUrl: admissions.finalUrl ?? admissions.url,
  applicationNote: "Two-year full-time English-taught program in Beijing. Required materials include a personal statement of at least 500 words, bachelor's degree or expected-graduation certificate plus required authentication, undergraduate transcript, English evidence where applicable, two recommendation letters from associate professors or above or senior professionals, and a personal ordinary-passport information page. Applicants who formerly held Chinese nationality must also provide the specified household-registration cancellation evidence.",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: generatedAt,
  ...fields,
  sourceFieldLineage: {
    ...(priorProgram.sourceFieldLineage ?? {}),
    durationYears: "official GBJ FAQ, About the Program, program length",
    fieldCategory: "official GBJ program title and overview",
    subjectArea: "official GBJ program title and overview",
    englishRequirement: "official 2027 admissions page, Language Requirement",
    applicationUrl: "registered official 2027 GBJ admissions page",
    applicationNote: "official GBJ required-documents page and FAQ",
  },
};

const intake = {
  programSlug,
  intakeTerm: "Fall",
  intakeYear: 2027,
  openDate: "2026-11-01T00:00:00.000Z",
  deadlineDate: "2027-03-31T09:00:00.000Z",
  deadlineLabel: "Round 1: 08:00 November 1 to 17:00 December 20, 2026; Round 2: 08:00 January 1 to 17:00 February 28, 2027; Round 3: 08:00 March 1 to 17:00 March 31, 2027 (Beijing time).",
  applicationRound: "Tsinghua GBJ 2027 international admission - three rounds",
  ...fields,
  sourceFieldLineage: {
    intakeTerm: "official 2027 GBJ admissions cycle and graduate enrollment year",
    intakeYear: "official 2027 admissions page",
    openDate: "official first-round opening time converted from Beijing time",
    deadlineDate: "official third-round deadline converted from Beijing time",
    deadlineLabel: "official Application Schedule",
    applicationRound: "official Application Schedule",
  },
};

const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities: [city], schools: [school], programs: [program], programIntakes: [intake], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 63 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: 1, refreshed2027Intakes: 1, sourceSnapshots: evidence.size },
  evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
  unresolved: ["The current seed contract has no upcoming intake status, so status remains absent until the first application round opens on November 1, 2026."],
  notes: ["The exact three-round GBJ schedule replaces the earlier general university-level deadline label for this program.", "No applicant, account, passport, payment or other personal data is included."],
};

await Promise.all([
  writeFile(resolve(root, "seeds/catalog.2027-wave-63.draft.json"), candidateText, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-63.validation.json"), `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-63.review.json"), `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 63, candidateSha256, counts: { cities: 1, schools: 1, programs: 1, programIntakes: 1, scholarships: 0, sourceSnapshots: evidence.size }, publicationAuthorized: false }, null, 2));
