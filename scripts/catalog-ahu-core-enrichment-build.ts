import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
} from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const inputPaths = [
  "seeds/catalog.ahu-programs-safe-new-batch-01.draft.json",
  "seeds/catalog.ahu-economics-cleanup.draft.json",
  "seeds/catalog.ahu-legacy-alignment-batch-01.draft.json",
] as const;
const manifestPath = resolve(root, "work/catalog-official/ahu-fees-application-batch-01/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.ahu-core-enrichment-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.ahu-core-enrichment-batch-01.validation.json");
const [manifestText, ...inputTexts] = await Promise.all([
  readFile(manifestPath, "utf8"),
  ...inputPaths.map((path) => readFile(resolve(root, path), "utf8")),
]);
const manifest = JSON.parse(manifestText) as {
  generatedAt: string;
  sources: { id: string; status: number; sha256: string; url: string; fetchedAt: string }[];
};
const feeSource = manifest.sources.find((row) => row.id === "ahu-international-admissions-fees-and-application-current");
const expectedFeeDigest = "77e5a55b153c3764e84aebcae215c7ee13879479705c26181f76b82574cd8139";
if (!feeSource || feeSource.status !== 200 || feeSource.sha256 !== expectedFeeDigest) {
  throw new Error("Anhui University fee evidence is missing or changed.");
}
const inputs = inputTexts.map((text) => JSON.parse(text) as CatalogSeedBundle);
const cities = [...new Map(inputs.flatMap((bundle) => bundle.cities ?? []).map((city) => [city.slug, city])).values()];
const schools = [...new Map(inputs.flatMap((bundle) => bundle.schools ?? []).map((school) => [school.slug, school])).values()];
const basePrograms = [...new Map(inputs.flatMap((bundle) => bundle.programs ?? []).map((program) => [program.slug, program])).values()];
if (basePrograms.length !== 170) throw new Error(`Expected 170 AHU program identities, received ${basePrograms.length}.`);
const tuitionByLevel: Record<string, number> = { Undergraduate: 15000, Master: 18000, Doctoral: 24000 };
const programs: CatalogSeedProgram[] = basePrograms.map((program) => {
  if (program.schoolSlug !== "anhui-university") throw new Error(`Unexpected school for ${program.slug}`);
  const tuitionAmount = tuitionByLevel[program.degreeLevel];
  if (!tuitionAmount) throw new Error(`No official AHU tuition band for ${program.degreeLevel}: ${program.slug}`);
  return {
    ...program,
    tuitionAmount,
    tuitionCurrency: "CNY",
    tuitionPeriod: "academic_year",
    tuitionText: `CNY ${tuitionAmount.toLocaleString("en-US")} per academic year`,
    displayTuition: `CNY ${tuitionAmount.toLocaleString("en-US")}/year`,
    applicationUrl: "https://sie.ahu.edu.cn/",
    status: "draft",
    sourceFieldLineage: {
      ...program.sourceFieldLineage,
      tuitionAmount: `ahu-international-admissions-fees-and-application-current ${expectedFeeDigest}: official fee table by degree level`,
      tuitionText: `ahu-international-admissions-fees-and-application-current ${expectedFeeDigest}: official fee table by degree level`,
      applicationUrl: `ahu-international-admissions-fees-and-application-current ${expectedFeeDigest}: official international-education website printed in the brochure`,
    },
  };
});

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: feeSource.fetchedAt,
  cities,
  schools,
  programs,
  programIntakes: [],
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 170) {
  throw new Error(`AHU core enrichment invalid:\n${validation.errors.join("\n")}`);
}
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha(candidateText),
  sourceManifestSha256: sha(manifestText),
  inputBundles: inputPaths.map((path, index) => ({ path, sha256: sha(inputTexts[index]) })),
  sourceReview: {
    status: "unreviewed_draft",
    notes: [
      "The official brochure explicitly publishes CNY 15,000/year for undergraduate study and CNY 18,000/year for master's study.",
      "The brochure prints the Anhui University School of International Education website, which is retained as the application information entry point.",
      "Teaching language remains unresolved per program because the brochure directs readers to separate major information and does not classify these 170 routes individually.",
      "No intake year, deadline or teaching language is inferred, and this bundle does not authorize publication or database writes.",
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
