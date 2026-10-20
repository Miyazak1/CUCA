import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };

const root = process.cwd();
const sourceId = "tsinghua-architecture-international-programs-current";
const expectedSha256 = "8c281c9b94c43721b2c38c3773e0327a7ff85b4911f10b4847977a91593980f0";
let source: ManifestSource | undefined;

for (const entry of await readdir(resolve(root, "work/catalog-official"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(root, "work/catalog-official", entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    const found = manifest.sources?.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
    if (!found) continue;
    const bytes = await readFile(resolve(runRoot, found.artifactPath));
    if (createHash("sha256").update(bytes).digest("hex") !== found.sha256) throw new Error("Tsinghua Architecture evidence hash mismatch.");
    source = found;
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
if (!source) throw new Error("Missing locked Tsinghua Architecture evidence.");

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-release-candidate.draft.json"), "utf8")) as CatalogSeedBundle;
const programSlug = "tsinghua-university-2027-master-master-of-architecture-english";
const city = prior.cities?.find((row) => row.slug === "beijing");
const school = prior.schools?.find((row) => row.slug === "tsinghua-university");
const priorProgram = prior.programs?.find((row) => row.slug === programSlug);
if (!city || !school || !priorProgram) throw new Error("Missing Tsinghua Architecture dependency or prior program row.");

const fields = { sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const program = {
  ...priorProgram,
  durationYears: 2,
  fieldCategory: "Architecture",
  subjectArea: "Architecture and design in China",
  teachingLanguage: "English",
  tuitionAmount: 120000,
  tuitionCurrency: "RMB",
  tuitionPeriod: "program",
  tuitionText: "RMB 120,000 for the two-year program: RMB 80,000 in the first year and RMB 40,000 in the second year.",
  applicationUrl: source.finalUrl ?? source.url,
  applicationNote: "The English Program for Master in Architecture leads to the professional M.Arch II degree. Applicants should hold an accredited professional bachelor's degree in architecture and must submit a portfolio. The curriculum is taught in English and requires 27 credits across studios, seminars, theory courses, a site visit and public courses.",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...fields,
  sourceFieldLineage: {
    ...(priorProgram.sourceFieldLineage ?? {}),
    durationYears: "current official EPMA curriculum and tuition sections",
    fieldCategory: "current official EPMA program identity",
    subjectArea: "current official EPMA introduction",
    teachingLanguage: "current official EPMA curriculum",
    tuitionAmount: "current official EPMA tuition section; agrees with the locked Tsinghua 2027 tuition schedule",
    tuitionCurrency: "current official EPMA tuition section",
    tuitionPeriod: "current official EPMA tuition section",
    tuitionText: "current official EPMA tuition section",
    applicationUrl: "registered official School of Architecture admissions page",
    applicationNote: "current official EPMA introduction, curriculum and admission requirements",
  },
};

const candidate: CatalogSeedBundle = { version: 1, generatedAt: source.fetchedAt, cities: [city], schools: [school], programs: [program], programIntakes: [], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 71 validation failed:\n${validation.errors.join("\n")}`);
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
    "The page's application calendar is from the 2024 cycle and is deliberately excluded; the existing university-level 2027 intake remains unchanged.",
    "The EPMA section confirms English-medium instruction but does not publish a standardized English-test threshold, so englishRequirement remains absent.",
  ],
  notes: ["The current official tuition agrees with Tsinghua's separately locked 2027 fee schedule.", "No applicant, account, passport, payment or other personal data is included."],
};

await Promise.all([
  writeFile(resolve(root, "seeds/catalog.2027-wave-71.draft.json"), candidateText, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-71.validation.json"), `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-71.review.json"), `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({ ok: true, wave: 71, candidateSha256, counts: { cities: 1, schools: 1, programs: 1, programIntakes: 0, scholarships: 0, sourceSnapshots: 1 }, publicationAuthorized: false }, null, 2));
