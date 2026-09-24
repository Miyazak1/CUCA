import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
} from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const coveragePath = resolve(root, "work/catalog-quality/catalog-official-draft-coverage.json");
const manifestPath = resolve(root, "work/catalog-official/residual-core-sources-batch-02/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.blcu-teaching-language-enrichment-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.blcu-teaching-language-enrichment-batch-01.validation.json");
const [coverageText, manifestText] = await Promise.all([readFile(coveragePath, "utf8"), readFile(manifestPath, "utf8")]);
const coverage = JSON.parse(coverageText) as {
  missingRecords: { entity: string; slug: string; schoolSlug: string; sourceFile: string; missing: string[] }[];
};
const manifest = JSON.parse(manifestText) as {
  sources: { id: string; status: number; sha256: string; fetchedAt: string }[];
};
const sourceId = "blcu-csca-instructions-en-2026";
const expectedDigest = "34341f59ccb7b8f7aa43004897f14d02951f038cb4a7fe35391703e680c67124";
const source = manifest.sources.find((row) => row.id === sourceId);
if (!source || source.status !== 200 || source.sha256 !== expectedDigest) {
  throw new Error("BLCU teaching-language evidence is missing or changed.");
}

const exactChineseSlugs = new Set([
  "beijing-language-and-culture-university-chinese-language-china-japan-bilingual-track-beijing-nara-2-2-program",
  "beijing-language-and-culture-university-chinese-language-chinese-english-bilingual-track",
  "beijing-language-and-culture-university-chinese-language-chinese-track",
  "beijing-language-and-culture-university-chinese-language-economics-and-trade-track",
  "beijing-language-and-culture-university-international-chinese-language-education",
  "beijing-language-and-culture-university-translation-english-chinese-translation",
  "beijing-language-and-culture-university-translation-korean-chinese-translation",
  "beijing-language-and-culture-university-applied-chinese-technology-2026",
  "beijing-language-and-culture-university-applied-chinese-business-2026",
  "beijing-language-and-culture-university-applied-chinese-tourism-2026",
  "beijing-language-and-culture-university-international-politics-2026",
  "beijing-language-and-culture-university-international-affairs-and-international-relations-2026",
  "beijing-language-and-culture-university-network-and-new-media-2026",
  "beijing-language-and-culture-university-journalism-2026",
  "beijing-language-and-culture-university-computer-science-and-technology-2026",
  "beijing-language-and-culture-university-artificial-intelligence-2026",
  "beijing-language-and-culture-university-data-science-and-big-data-technology-2026",
  "beijing-language-and-culture-university-digital-media-technology-2026",
  "beijing-language-and-culture-university-english-2026",
  "beijing-language-and-culture-university-english-english-spanish-bilingual-2026",
  "beijing-language-and-culture-university-business-english-2026",
]);
const missing = coverage.missingRecords.filter(
  (row) => row.entity === "program"
    && row.schoolSlug === "beijing-language-and-culture-university"
    && exactChineseSlugs.has(row.slug)
    && row.missing.includes("teachingLanguage"),
);
if (missing.length !== exactChineseSlugs.size) {
  throw new Error(`Expected ${exactChineseSlugs.size} exact BLCU gaps, received ${missing.length}.`);
}
const bundleCache = new Map<string, { text: string; bundle: CatalogSeedBundle }>();
for (const row of missing) {
  if (!bundleCache.has(row.sourceFile)) {
    const bundleText = await readFile(resolve(root, "seeds", row.sourceFile), "utf8");
    bundleCache.set(row.sourceFile, { text: bundleText, bundle: JSON.parse(bundleText) as CatalogSeedBundle });
  }
}
const programs: CatalogSeedProgram[] = missing.map((row) => {
  const program = bundleCache.get(row.sourceFile)!.bundle.programs.find((candidate) => candidate.slug === row.slug);
  if (!program || program.teachingLanguage) throw new Error(`BLCU source precondition changed: ${row.slug}`);
  return {
    ...program,
    teachingLanguage: "Chinese",
    status: "draft",
    sourceFieldLineage: {
      ...program.sourceFieldLineage,
      teachingLanguage: `${sourceId} ${expectedDigest}: 2026 CSCA major table explicitly labels the matched route Chinese`,
    },
  };
});
const dependencyBundle = bundleCache.values().next().value?.bundle;
const school = dependencyBundle?.schools.find((row) => row.slug === "beijing-language-and-culture-university");
if (!school) throw new Error("BLCU school dependency is missing.");
const city = dependencyBundle!.cities.find((row) => row.slug === school.citySlug);
if (!city) throw new Error("BLCU city dependency is missing.");
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: source.fetchedAt,
  cities: [city],
  schools: [school],
  programs,
  programIntakes: [],
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== exactChineseSlugs.size) {
  throw new Error(`BLCU teaching-language enrichment invalid:\n${validation.errors.join("\n")}`);
}
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha(candidateText),
  sourceManifestSha256: sha(manifestText),
  inputBundleSha256: Object.fromEntries([...bundleCache.entries()].map(([path, item]) => [path, sha(item.text)])),
  sourceReview: {
    status: "unreviewed_draft",
    notes: [
      "Only routes explicitly labelled Chinese in the official 2026 CSCA major table are updated.",
      "Same-name Chinese- and English-medium International Economics and Trade records remain unresolved because the current identity does not disambiguate the route.",
      "Joint-degree, associate and differently named routes absent from the CSCA table remain unresolved.",
      "No intake, deadline, identity, tuition, application URL or scholarship state is changed.",
      "This draft does not authorize publication or database writes.",
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
