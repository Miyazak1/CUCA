import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const sourcePath = resolve(root, "seeds/catalog.blcu-school-undergraduate-cleanup.draft.json");
const manifestPath = resolve(root, "work/catalog-official/blcu-school-programs-attachments-batch-01/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.blcu-legacy-alignment-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.blcu-legacy-alignment-batch-01.validation.json");
const [sourceText, manifestText] = await Promise.all([readFile(sourcePath, "utf8"), readFile(manifestPath, "utf8")]);
const source = JSON.parse(sourceText) as CatalogSeedBundle;
const manifest = JSON.parse(manifestText) as { generatedAt: string; sources: { url: string; sha256: string; status: number }[] };
const evidence = new Set(manifest.sources.filter((row) => row.status === 200).map((row) => `${row.url}\n${row.sha256}`));
const legacySlug = "beijing-language-and-culture-university-international-economics-and-trade-52";
const canonicalSlug = "beijing-language-and-culture-university-international-economics-and-trade";
const current = source.programs.find((row) => row.slug === canonicalSlug);
if (!current) throw new Error(`Missing BLCU canonical program: ${canonicalSlug}`);
if (!evidence.has(`${current.sourceUrl}\n${current.sourceSha256}`)) throw new Error(`Unpinned BLCU program evidence: ${canonicalSlug}`);
const program = {
  ...current,
  slug: legacySlug,
  applicationNote: `${current.applicationNote ?? ""} Legacy CUAC identity aligned to the exact current independent bachelor's route; canonical draft identity: ${canonicalSlug}.`.trim(),
  sourceFieldLineage: { ...current.sourceFieldLineage, slug: `legacy CUAC identity aligned to exact official route ${canonicalSlug}; draft only` },
};
const programIntakes = source.programIntakes.filter((row) => row.programSlug === canonicalSlug).map((row) => {
  if (!evidence.has(`${row.sourceUrl}\n${row.sourceSha256}`)) throw new Error(`Unpinned BLCU intake evidence: ${canonicalSlug}`);
  return { ...row, programSlug: legacySlug };
});
const candidate: CatalogSeedBundle = { version: 1, generatedAt: manifest.generatedAt, cities: source.cities, schools: source.schools, programs: [program], programIntakes, scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 1 || validation.summary.programIntakes !== 2) throw new Error(`BLCU legacy alignment invalid:\n${validation.errors.join("\n")}`);
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha(candidateText),
  sourceBundleSha256: sha(sourceText),
  manifestSha256: sha(manifestText),
  sourceReview: {
    status: "unreviewed_draft",
    notes: [
      "The suffixed legacy International Economics and Trade identity maps exactly to the current official independent bachelor's route.",
      "The dual-degree Chinese Language plus Artificial Intelligence and Translation (Localization) legacy identities have no exact current record in the reviewed bundles and remain unresolved.",
      "The five remaining legacy scholarship rows are historical, program-list, Chinese-plus, or Type A identities that do not match the three reviewed current named scholarship routes.",
      "This bundle is a draft identity alignment only; it does not authorize duplicate insertion, archival, publication or database writes.",
    ],
  },
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
};
await Promise.all([writeFile(candidatePath, candidateText, "utf8"), writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary, candidateSha256: validationArtifact.candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
