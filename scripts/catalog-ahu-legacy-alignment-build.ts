import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const sourcePath = resolve(root, "seeds/catalog.ahu-economics-cleanup.draft.json");
const dependencyPath = resolve(root, "seeds/catalog.school-identity-replacements-batch-01.draft.json");
const manifestPath = resolve(root, "work/catalog-official/ahu-programs-batch-01/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.ahu-legacy-alignment-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.ahu-legacy-alignment-batch-01.validation.json");

const [sourceText, dependencyText, manifestText] = await Promise.all([
  readFile(sourcePath, "utf8"),
  readFile(dependencyPath, "utf8"),
  readFile(manifestPath, "utf8"),
]);
const source = JSON.parse(sourceText) as CatalogSeedBundle;
const dependencies = JSON.parse(dependencyText) as CatalogSeedBundle;
const manifest = JSON.parse(manifestText) as { generatedAt: string; sources: { url: string; sha256: string; status: number }[] };
const evidence = new Set(manifest.sources.filter((row) => row.status === 200).map((row) => `${row.url}\n${row.sha256}`));

const canonicalSlug = "anhui-university-undergraduate-economics-economy";
const record = source.programs.find((row) => row.slug === canonicalSlug);
if (!record) throw new Error(`Missing Anhui University canonical program: ${canonicalSlug}`);
if (!evidence.has(`${record.sourceUrl}\n${record.sourceSha256}`)) throw new Error(`Unpinned Anhui University program evidence: ${canonicalSlug}`);
const city = dependencies.cities.find((row) => row.slug === "hefei");
const school = dependencies.schools.find((row) => row.slug === "anhui-university");
if (!city || !school) throw new Error("Missing official Anhui University dependencies");

const legacySlug = "anhui-university-economics";
const program = {
  ...record,
  slug: legacySlug,
  applicationNote: `${record.applicationNote ?? ""} Legacy CUAC identity aligned to the unique current official undergraduate Economics route; canonical draft identity: ${canonicalSlug}.`.trim(),
  sourceFieldLineage: {
    ...record.sourceFieldLineage,
    slug: `legacy CUAC identity aligned to unique official route ${canonicalSlug}; draft only`,
  },
};
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: manifest.generatedAt,
  cities: [city],
  schools: [school],
  programs: [program],
  programIntakes: [],
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 1 || validation.summary.programIntakes !== 0) {
  throw new Error(`Anhui University legacy alignment invalid:\n${validation.errors.join("\n")}`);
}
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha(candidateText),
  sourceBundleSha256: sha(sourceText),
  dependencyBundleSha256: sha(dependencyText),
  manifestSha256: sha(manifestText),
  sourceReview: {
    status: "unreviewed_draft",
    notes: [
      "The unsuffixed legacy Economics identity maps uniquely to the current official undergraduate Economics route.",
      "The duplicate legacy identity anhui-university-economics-3 intentionally remains quarantined for later merge or archival review; this bundle does not create a second copy.",
      "No intake is created because the reviewed program-list evidence does not publish a current intake year or deadline.",
      "Official Hefei and Anhui University dependencies replace the prohibited-source dependencies present in the earlier cleanup draft.",
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
