import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const sourcePath = resolve(root, "seeds/catalog.tju-complete-batch-01.draft.json");
const manifestPath = resolve(root, "work/catalog-official/tju-complete-batch-01/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.tju-legacy-alignment-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.tju-legacy-alignment-batch-01.validation.json");
const [sourceText, manifestText] = await Promise.all([readFile(sourcePath, "utf8"), readFile(manifestPath, "utf8")]);
const source = JSON.parse(sourceText) as CatalogSeedBundle;
const manifest = JSON.parse(manifestText) as { generatedAt: string; sources: { url: string; sha256: string; status: number }[] };
const manifestEvidence = new Set(manifest.sources.filter((row) => row.status === 200).map((row) => `${row.url}\n${row.sha256}`));

const programMap: Record<string, string> = {
  "tianjin-university-biological-engineering": "tianjin-university-undergraduate-biological-engineering-chinese-98324",
  "tianjin-university-biomedical-engineering": "tianjin-university-undergraduate-biomedical-engineering-chinese-98309",
  "tianjin-university-chemical-engineering-and-technology": "tianjin-university-undergraduate-chemical-engineering-and-technology-chinese-98376",
  "tianjin-university-chemical-engineering-and-technology-english": "tianjin-university-undergraduate-chemical-engineering-and-technology-english-98377",
  "tianjin-university-chinese-language-and-literature": "tianjin-university-undergraduate-chinese-language-and-literature-chinese-98286",
  "tianjin-university-environmental-engineering-english": "tianjin-university-undergraduate-environmental-engineering-english-98188",
  "tianjin-university-fine-chemical-engineering": "tianjin-university-undergraduate-fine-chemical-engineering-chinese-98375",
  "tianjin-university-food-science-and-engineering": "tianjin-university-undergraduate-food-science-and-engineering-chinese-98326",
  "tianjin-university-intelligent-medical-engineering": "tianjin-university-undergraduate-intelligent-medical-engineering-chinese-98310",
  "tianjin-university-pharmaceutical-engineering": "tianjin-university-undergraduate-pharmaceutical-engineering-chinese-98325",
  "tianjin-university-pharmaceutical-science-english": "tianjin-university-undergraduate-pharmaceutical-science-english-98166",
  "tianjin-university-synthetic-biology": "tianjin-university-undergraduate-synthetic-biology-chinese-98327",
};
const programs = Object.entries(programMap).map(([legacySlug, canonicalSlug]) => {
  const record = source.programs.find((row) => row.slug === canonicalSlug);
  if (!record) throw new Error(`Missing TJU canonical program: ${canonicalSlug}`);
  if (!manifestEvidence.has(`${record.sourceUrl}\n${record.sourceSha256}`)) throw new Error(`Unpinned TJU program evidence: ${canonicalSlug}`);
  return {
    ...record,
    slug: legacySlug,
    applicationNote: `${record.applicationNote ?? ""} Legacy CUAC identity aligned to the unique official 2026 route; canonical draft identity: ${canonicalSlug}.`.trim(),
    sourceFieldLineage: { ...record.sourceFieldLineage, slug: `legacy CUAC identity aligned to unique official route ${canonicalSlug}; draft only` },
  };
});
const programIntakes = Object.entries(programMap).map(([legacySlug, canonicalSlug]) => {
  const record = source.programIntakes.find((row) => row.programSlug === canonicalSlug);
  if (!record) throw new Error(`Missing TJU canonical intake: ${canonicalSlug}`);
  if (!manifestEvidence.has(`${record.sourceUrl}\n${record.sourceSha256}`)) throw new Error(`Unpinned TJU intake evidence: ${canonicalSlug}`);
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
if (!validation.ok || validation.summary.programs !== 12 || validation.summary.programIntakes !== 12 || validation.summary.scholarships !== 0) {
  throw new Error(`TJU legacy alignment invalid:\n${validation.errors.join("\n")}`);
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
      "Twelve legacy undergraduate slugs map uniquely to one current official 2026 TJU route by name, level and teaching language.",
      "Legacy Process Equipment and Control Engineering is excluded because the current international undergraduate catalog has no exact route with that name.",
      "The four legacy faculty-special or generic university scholarship identities do not match the six current named official scholarship routes and remain unresolved.",
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
