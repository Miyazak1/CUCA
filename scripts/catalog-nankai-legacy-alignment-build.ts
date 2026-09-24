import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const sourcePath = resolve(root, "seeds/catalog.nankai-complete-batch-01.draft.json");
const manifestPath = resolve(root, "work/catalog-official/nankai-complete-batch-01/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.nankai-legacy-alignment-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.nankai-legacy-alignment-batch-01.validation.json");
const [sourceText, manifestText] = await Promise.all([readFile(sourcePath, "utf8"), readFile(manifestPath, "utf8")]);
const source = JSON.parse(sourceText) as CatalogSeedBundle;
const manifest = JSON.parse(manifestText) as { generatedAt: string; sources: { url: string; sha256: string; status: number }[] };
const manifestEvidence = new Set(manifest.sources.filter((row) => row.status === 200).map((row) => `${row.url}\n${row.sha256}`));

const programMap: Record<string, string> = {
  "nankai-university-business-administration": "nankai-university-undergraduate-business-school-business-administration-chinese-and-english-20000-4",
  "nankai-university-insurance": "nankai-university-undergraduate-school-of-finance-insurance-chinese-20000-4",
};
const programs = Object.entries(programMap).map(([legacySlug, canonicalSlug]) => {
  const record = source.programs.find((row) => row.slug === canonicalSlug);
  if (!record) throw new Error(`Missing Nankai canonical program: ${canonicalSlug}`);
  if (!manifestEvidence.has(`${record.sourceUrl}\n${record.sourceSha256}`)) throw new Error(`Unpinned Nankai program evidence: ${canonicalSlug}`);
  return {
    ...record,
    slug: legacySlug,
    applicationNote: `${record.applicationNote ?? ""} Legacy CUAC identity aligned to the unique official 2026 undergraduate route; canonical draft identity: ${canonicalSlug}.`.trim(),
    sourceFieldLineage: { ...record.sourceFieldLineage, slug: `legacy CUAC identity aligned to unique official route ${canonicalSlug}; draft only` },
  };
});
const programIntakes = Object.entries(programMap).map(([legacySlug, canonicalSlug]) => {
  const record = source.programIntakes.find((row) => row.programSlug === canonicalSlug);
  if (!record) throw new Error(`Missing Nankai canonical intake: ${canonicalSlug}`);
  if (!manifestEvidence.has(`${record.sourceUrl}\n${record.sourceSha256}`)) throw new Error(`Unpinned Nankai intake evidence: ${canonicalSlug}`);
  return { ...record, programSlug: legacySlug };
});

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: manifest.generatedAt,
  cities: source.cities,
  schools: source.schools,
  programs,
  programIntakes,
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 2 || validation.summary.programIntakes !== 2 || validation.summary.scholarships !== 0) {
  throw new Error(`Nankai legacy alignment invalid:\n${validation.errors.join("\n")}`);
}
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha(candidateText),
  sourceBundleSha256: sha(sourceText),
  manifestSha256: sha(manifestText),
  sourceReview: {
    status: "unreviewed_draft",
    notes: [
      "Business Administration and Insurance are the only legacy undergraduate identities with one exact current official route by name and level.",
      "Accounting and Financial Engineering only occur at graduate level; Finance is published as Finance Specialty; the remaining legacy names have no exact current undergraduate identity and stay unresolved.",
      "The generic legacy university scholarship is not mapped to either of the two distinct current named scholarship routes.",
      "This bundle is a draft identity alignment only; it does not authorize duplicate insertion, archival, publication or database writes.",
    ],
  },
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
};
await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({
  ok: true,
  candidatePath,
  validationPath,
  summary: validation.summary,
  candidateSha256: validationArtifact.candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
}, null, 2));
