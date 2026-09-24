import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const sourcePath = resolve(root, "seeds/catalog.dut-scholarships-batch-01.draft.json");
const candidatePath = resolve(root, "seeds/catalog.dut-legacy-alignment-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.dut-legacy-alignment-batch-01.validation.json");
const sourceText = await readFile(sourcePath, "utf8");
const source = JSON.parse(sourceText) as CatalogSeedBundle;
const canonicalSlug = "official-2026-dut-international-students-presidential-scholarship";
const record = source.scholarships.find((row) => row.slug === canonicalSlug);
if (!record) throw new Error(`Missing DUT canonical scholarship: ${canonicalSlug}`);
const scholarship = {
  ...record,
  slug: "dalian-university-of-technology-13",
  summary: `${record.summary ?? ""} Legacy CUAC identity aligned to the exact current DUT presidential-scholarship route; canonical draft identity: ${canonicalSlug}.`.trim(),
  sourceFieldLineage: { ...record.sourceFieldLineage, slug: `legacy CUAC identity aligned to exact official route ${canonicalSlug}; draft only` },
};
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: source.generatedAt,
  cities: [],
  schools: source.schools,
  programs: [],
  programIntakes: [],
  scholarships: [scholarship],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.scholarships !== 1) throw new Error(`DUT legacy alignment invalid:\n${validation.errors.join("\n")}`);
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha(candidateText),
  sourceBundleSha256: sha(sourceText),
  sourceReview: {
    status: "unreviewed_draft",
    notes: [
      "The legacy DUT International Students Presidential Scholarship title maps exactly to the current official 2026 university-funded route.",
      "The legacy International Chinese Language Teachers Scholarship remains unresolved because it is not evidenced by the reviewed current scholarship pages.",
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
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary, candidateSha256: validationArtifact.candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
