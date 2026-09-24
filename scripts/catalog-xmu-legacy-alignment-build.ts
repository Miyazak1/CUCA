import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const sourcePath = resolve(root, "seeds/catalog.xmu-complete-batch-01.draft.json");
const manifestPath = resolve(root, "work/catalog-official/xmu-complete-batch-01/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.xmu-legacy-alignment-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.xmu-legacy-alignment-batch-01.validation.json");
const [sourceText, manifestText] = await Promise.all([readFile(sourcePath, "utf8"), readFile(manifestPath, "utf8")]);
const source = JSON.parse(sourceText) as CatalogSeedBundle;
const manifest = JSON.parse(manifestText) as { generatedAt: string; sources: { url: string; sha256: string; status: number }[] };
const manifestEvidence = new Set(manifest.sources.filter((row) => row.status === 200).map((row) => `${row.url}\n${row.sha256}`));

const programMap: Record<string, string> = {
  "xiamen-university-accounting": "xiamen-university-undergraduate-accounting-chinese-table-15-15",
  "xiamen-university-biological-science": "xiamen-university-undergraduate-biological-science-chinese-table-59-59",
  "xiamen-university-chemistry": "xiamen-university-undergraduate-chemistry-chinese-table-38-38",
  "xiamen-university-clinical-medicine-mbbs-english": "xiamen-university-undergraduate-clinical-medicine-mbbs-english-table-4-4",
  "xiamen-university-digital-media-art-english": "xiamen-university-undergraduate-digital-media-art-english-table-3-3",
  "xiamen-university-ecology": "xiamen-university-undergraduate-ecology-chinese-table-42-42",
  "xiamen-university-economics": "xiamen-university-undergraduate-economics-chinese-table-51-51",
  "xiamen-university-environmental-design-english": "xiamen-university-undergraduate-environmental-design-english-table-1-1",
  "xiamen-university-finance": "xiamen-university-undergraduate-finance-chinese-table-50-50",
  "xiamen-university-international-economics-and-trade": "xiamen-university-undergraduate-international-economics-and-trade-chinese-table-48-48",
  "xiamen-university-statistics": "xiamen-university-undergraduate-statistics-chinese-table-60-60",
  "xiamen-university-visual-communication-design-english": "xiamen-university-undergraduate-visual-communication-design-english-table-2-2",
};
const scholarshipMap: Record<string, string> = {
  "xiamen-university": "official-2026-xmu-new-international-student-scholarship",
  "xiamen-university-67": "official-2026-xmu-fujian-government-scholarship",
};

const programs = Object.entries(programMap).map(([legacySlug, canonicalSlug]) => {
  const record = source.programs.find((row) => row.slug === canonicalSlug);
  if (!record) throw new Error(`Missing XMU canonical program: ${canonicalSlug}`);
  if (!manifestEvidence.has(`${record.sourceUrl}\n${record.sourceSha256}`)) throw new Error(`Unpinned XMU program evidence: ${canonicalSlug}`);
  return {
    ...record,
    slug: legacySlug,
    applicationNote: `${record.applicationNote ?? ""} Legacy CUAC identity aligned to the unique official 2026 route; canonical draft identity: ${canonicalSlug}.`.trim(),
    sourceFieldLineage: { ...record.sourceFieldLineage, slug: `legacy CUAC identity aligned to unique official route ${canonicalSlug}; draft only` },
  };
});
const programIntakes = Object.entries(programMap).map(([legacySlug, canonicalSlug]) => {
  const record = source.programIntakes.find((row) => row.programSlug === canonicalSlug);
  if (!record) throw new Error(`Missing XMU canonical intake: ${canonicalSlug}`);
  if (!manifestEvidence.has(`${record.sourceUrl}\n${record.sourceSha256}`)) throw new Error(`Unpinned XMU intake evidence: ${canonicalSlug}`);
  return { ...record, programSlug: legacySlug };
});
const scholarships = Object.entries(scholarshipMap).map(([legacySlug, canonicalSlug]) => {
  const record = source.scholarships.find((row) => row.slug === canonicalSlug);
  if (!record) throw new Error(`Missing XMU canonical scholarship: ${canonicalSlug}`);
  if (!manifestEvidence.has(`${record.sourceUrl}\n${record.sourceSha256}`)) throw new Error(`Unpinned XMU scholarship evidence: ${canonicalSlug}`);
  return {
    ...record,
    slug: legacySlug,
    summary: `${record.summary} Legacy CUAC identity aligned to this exact current route; canonical draft identity: ${canonicalSlug}.`,
    sourceFieldLineage: { ...record.sourceFieldLineage, slug: `legacy CUAC identity aligned to exact current route ${canonicalSlug}; draft only` },
  };
});

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: manifest.generatedAt,
  cities: source.cities,
  schools: source.schools,
  programs,
  programIntakes,
  scholarships,
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 12 || validation.summary.programIntakes !== 12 || validation.summary.scholarships !== 2) {
  throw new Error(`XMU legacy alignment invalid:\n${validation.errors.join("\n")}`);
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
      "Twelve legacy undergraduate slugs map to one unique official 2026 XMU route by name, degree level, language and catalog row.",
      "Legacy Education is excluded because the current international undergraduate catalog has no exact standalone Education route.",
      "Legacy Marine Science is excluded because four separate current undergraduate rows share that name and the old record has no school or direction discriminator.",
      "The legacy new-international-student and Fujian Government scholarship identities map exactly to current official records.",
      "The legacy Tan Kah Kee Scholarship remains unresolved because the reviewed current bundle does not contain that exact route.",
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
