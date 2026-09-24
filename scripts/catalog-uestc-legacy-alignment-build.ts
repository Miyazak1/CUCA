import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const sourcePath = resolve(root, "seeds/catalog.uestc-complete-batch-01.draft.json");
const manifestPath = resolve(root, "work/catalog-official/uestc-complete-batch-01/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.uestc-legacy-alignment-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.uestc-legacy-alignment-batch-01.validation.json");
const [sourceText, manifestText] = await Promise.all([readFile(sourcePath, "utf8"), readFile(manifestPath, "utf8")]);
const source = JSON.parse(sourceText) as CatalogSeedBundle;
const manifest = JSON.parse(manifestText) as { generatedAt: string; sources: { url: string; sha256: string; status: number }[] };
const evidence = new Set(manifest.sources.filter((row) => row.status === 200).map((row) => `${row.url}\n${row.sha256}`));
const programMap: Record<string, string> = {
  "university-of-electronic-science-and-technology-of-china-biomedical-engineering": "official-2026-uestc-bachelor-biomedical-engineering-chinese",
  "university-of-electronic-science-and-technology-of-china-mechanical-design-manufacture-and-automation": "official-2026-uestc-bachelor-mechanical-design-manufacture-and-automation-chinese",
};
const programs = Object.entries(programMap).map(([legacySlug, canonicalSlug]) => {
  const record = source.programs.find((row) => row.slug === canonicalSlug);
  if (!record) throw new Error(`Missing UESTC canonical program: ${canonicalSlug}`);
  if (!evidence.has(`${record.sourceUrl}\n${record.sourceSha256}`)) throw new Error(`Unpinned UESTC program evidence: ${canonicalSlug}`);
  return { ...record, slug: legacySlug, applicationNote: `${record.applicationNote ?? ""} Legacy CUAC identity aligned to the unique current official bachelor's route; canonical draft identity: ${canonicalSlug}.`.trim(), sourceFieldLineage: { ...record.sourceFieldLineage, slug: `legacy CUAC identity aligned to unique official route ${canonicalSlug}; draft only` } };
});
const programIntakes = Object.entries(programMap).map(([legacySlug, canonicalSlug]) => {
  const record = source.programIntakes.find((row) => row.programSlug === canonicalSlug);
  if (!record) throw new Error(`Missing UESTC canonical intake: ${canonicalSlug}`);
  if (!evidence.has(`${record.sourceUrl}\n${record.sourceSha256}`)) throw new Error(`Unpinned UESTC intake evidence: ${canonicalSlug}`);
  return { ...record, programSlug: legacySlug };
});
const candidate: CatalogSeedBundle = { version: 1, generatedAt: manifest.generatedAt, cities: source.cities, schools: source.schools, programs, programIntakes, scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 2 || validation.summary.programIntakes !== 2) throw new Error(`UESTC legacy alignment invalid:\n${validation.errors.join("\n")}`);
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha(candidateText),
  sourceBundleSha256: sha(sourceText),
  manifestSha256: sha(manifestText),
  sourceReview: {
    status: "unreviewed_draft",
    notes: [
      "Biomedical Engineering and Mechanical Design Manufacture and Automation map uniquely to current official Chinese-taught bachelor's routes.",
      "Urban Management has no exact current route in the reviewed complete bundle and remains unresolved.",
      "The legacy freshman-scholarship title is not forced onto the broader current UESTC University Scholarship; the other two legacy rows name different universities and remain quarantined.",
      "This bundle is a draft identity alignment only; it does not authorize duplicate insertion, archival, publication or database writes.",
    ],
  },
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
};
await Promise.all([writeFile(candidatePath, candidateText, "utf8"), writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary, candidateSha256: validationArtifact.candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
