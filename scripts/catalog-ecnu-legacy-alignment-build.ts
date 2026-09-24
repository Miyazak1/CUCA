import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const sourcePath = resolve(root, "seeds/catalog.ecnu-safe-new-batch-01.draft.json");
const manifestPath = resolve(root, "work/catalog-official/ecnu-complete-batch-01/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.ecnu-legacy-alignment-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.ecnu-legacy-alignment-batch-01.validation.json");
const [sourceText, manifestText] = await Promise.all([readFile(sourcePath, "utf8"), readFile(manifestPath, "utf8")]);
const source = JSON.parse(sourceText) as CatalogSeedBundle;
const manifest = JSON.parse(manifestText) as { generatedAt: string; sources: { url: string; sha256: string; status: number }[] };
const manifestEvidence = new Set(manifest.sources.filter((row) => row.status === 200).map((row) => `${row.url}\n${row.sha256}`));

const programMap: Record<string, string> = {
  "east-china-normal-university-accounting": "official-2026-ecnu-bachelor-accounting-school-of-economics-and-management-1",
  "east-china-normal-university-administration-management": "official-2026-ecnu-bachelor-administration-management-school-of-public-administration-1",
  "east-china-normal-university-applied-psychology": "official-2026-ecnu-bachelor-applied-psychology-school-of-psychology-and-cognitive-science-1",
  "east-china-normal-university-biology-science": "official-2026-ecnu-bachelor-biology-science-school-of-life-sciences-1",
  "east-china-normal-university-biology-technology": "official-2026-ecnu-bachelor-biology-technology-school-of-life-sciences-1",
  "east-china-normal-university-business-administration-faculty-of-economics-and-management-asia-europe-business-school": "official-2026-ecnu-bachelor-business-administration-asia-europe-business-school-1",
  "east-china-normal-university-business-administration-faculty-of-economics-and-management-school-of-economics-and-management": "official-2026-ecnu-bachelor-business-administration-school-of-economics-and-management-1",
  "east-china-normal-university-chemistry": "official-2026-ecnu-bachelor-chemistry-school-of-chemistry-and-molecular-engineering-1",
  "east-china-normal-university-double-degree-global-bba-bachelor-of-business-administration-asia-europe-business-school": "official-2026-ecnu-bachelor-business-administration-english-taught-double-degree-asia-europe-business-school-1",
  "east-china-normal-university-economics": "official-2026-ecnu-bachelor-economics-school-of-economics-and-management-1",
  "east-china-normal-university-environmental-science": "official-2026-ecnu-bachelor-environmental-science-school-of-ecological-and-environmental-science-1",
};
const scholarshipMap: Record<string, string> = {
  "east-china-normal-university": "official-2026-ecnu-shanghai-government-scholarship-undergraduate",
  "east-china-normal-university-15": "official-2026-ecnu-cgs-type-b-graduate",
  "east-china-normal-university-18": "official-2026-ecnu-excellent-freshmen-scholarship",
};

const programs = Object.entries(programMap).map(([legacySlug, canonicalSlug]) => {
  const record = source.programs.find((row) => row.slug === canonicalSlug);
  if (!record) throw new Error(`Missing ECNU canonical program: ${canonicalSlug}`);
  if (!manifestEvidence.has(`${record.sourceUrl}\n${record.sourceSha256}`)) throw new Error(`Unpinned ECNU program evidence: ${canonicalSlug}`);
  return {
    ...record,
    slug: legacySlug,
    applicationNote: `${record.applicationNote ?? ""} Legacy CUAC identity aligned to the unique official 2026 route; canonical draft identity: ${canonicalSlug}.`.trim(),
    sourceFieldLineage: {
      ...record.sourceFieldLineage,
      slug: `legacy CUAC identity aligned to unique official route ${canonicalSlug}; draft only`,
    },
  };
});
const programIntakes = Object.entries(programMap).map(([legacySlug, canonicalSlug]) => {
  const record = source.programIntakes.find((row) => row.programSlug === canonicalSlug);
  if (!record) throw new Error(`Missing ECNU canonical intake: ${canonicalSlug}`);
  if (!manifestEvidence.has(`${record.sourceUrl}\n${record.sourceSha256}`)) throw new Error(`Unpinned ECNU intake evidence: ${canonicalSlug}`);
  return { ...record, programSlug: legacySlug };
});
const scholarships = Object.entries(scholarshipMap).map(([legacySlug, canonicalSlug]) => {
  const record = source.scholarships.find((row) => row.slug === canonicalSlug);
  if (!record) throw new Error(`Missing ECNU canonical scholarship: ${canonicalSlug}`);
  if (!manifestEvidence.has(`${record.sourceUrl}\n${record.sourceSha256}`)) throw new Error(`Unpinned ECNU scholarship evidence: ${canonicalSlug}`);
  return {
    ...record,
    slug: legacySlug,
    summary: `${record.summary} Legacy CUAC identity aligned to this exact current route; canonical draft identity: ${canonicalSlug}.`,
    sourceFieldLineage: {
      ...record.sourceFieldLineage,
      slug: `legacy CUAC identity aligned to exact current route ${canonicalSlug}; draft only`,
    },
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
if (!validation.ok || validation.summary.programs !== 11 || validation.summary.programIntakes !== 11 || validation.summary.scholarships !== 3) {
  throw new Error(`ECNU legacy alignment invalid:\n${validation.errors.join("\n")}`);
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
      "Eleven legacy program slugs map to one unique official 2026 ECNU route by program name, degree level and school or faculty.",
      "The generic legacy Business Administration row is excluded because two current Chinese-taught schools publish that name.",
      "Three legacy scholarship identities map exactly to the current Shanghai Government undergraduate, Chinese Government Type B graduate and Excellent Freshmen routes.",
      "Generic ICLTS, historical excellence-award, school-special and separate Shanghai A/B legacy rows are not force-mapped to combined or degree-specific current records.",
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
