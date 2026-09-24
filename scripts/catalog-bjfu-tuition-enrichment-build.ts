import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
} from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const inputPath = resolve(root, "seeds/catalog.bjfu-complete-batch-01.approved.local.json");
const manifestPath = resolve(root, "work/catalog-official/bjfu-tuition-batch-01/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.bjfu-tuition-enrichment-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.bjfu-tuition-enrichment-batch-01.validation.json");
const [inputText, manifestText] = await Promise.all([readFile(inputPath, "utf8"), readFile(manifestPath, "utf8")]);
const input = JSON.parse(inputText) as CatalogSeedBundle;
const manifest = JSON.parse(manifestText) as {
  sources: { id: string; status: number; sha256: string; fetchedAt: string }[];
};
const tuitionSource = manifest.sources.find((row) => row.id === "bjfu-international-tuition-accommodation-current");
const expectedDigest = "bb1d3885ebadd2c7fee35056d88c534459caf99dea4f31796bfda75d6e520338";
if (!tuitionSource || tuitionSource.status !== 200 || tuitionSource.sha256 !== expectedDigest) {
  throw new Error("BFU tuition evidence is missing or changed.");
}
const schoolSlug = "beijing-forestry-university";
const programsNeedingTuition = input.programs.filter((program) => program.schoolSlug === schoolSlug && !program.tuitionText);
if (programsNeedingTuition.length !== 112) {
  throw new Error(`Expected 112 BFU programs needing tuition, received ${programsNeedingTuition.length}.`);
}
const tuitionBands: Record<string, number> = {
  "Master|Chinese": 29800,
  "Master|English": 33000,
  "Doctoral|Chinese": 33000,
  "Doctoral|English": 39000,
};
const programs: CatalogSeedProgram[] = programsNeedingTuition.map((program) => {
  const key = `${program.degreeLevel}|${program.teachingLanguage}`;
  const tuitionAmount = tuitionBands[key];
  if (!tuitionAmount) throw new Error(`No official BFU tuition band for ${key}: ${program.slug}`);
  return {
    ...program,
    tuitionAmount,
    tuitionCurrency: "CNY",
    tuitionPeriod: "year",
    tuitionText: `CNY ${tuitionAmount.toLocaleString("en-US")} per year`,
    displayTuition: `CNY ${tuitionAmount.toLocaleString("en-US")}/year`,
    status: "draft",
    sourceFieldLineage: {
      ...program.sourceFieldLineage,
      tuitionAmount: `bjfu-international-tuition-accommodation-current ${expectedDigest}: official degree-level and teaching-language tuition table`,
      tuitionText: `bjfu-international-tuition-accommodation-current ${expectedDigest}: official degree-level and teaching-language tuition table`,
    },
  };
});
const school = input.schools.find((row) => row.slug === schoolSlug);
if (!school) throw new Error("BFU school dependency is missing.");
const city = input.cities.find((row) => row.slug === school.citySlug);
if (!city) throw new Error("BFU city dependency is missing.");
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: tuitionSource.fetchedAt,
  cities: [city],
  schools: [school],
  programs,
  programIntakes: [],
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 112) {
  throw new Error(`BFU tuition enrichment invalid:\n${validation.errors.join("\n")}`);
}
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha(candidateText),
  inputBundleSha256: sha(inputText),
  sourceManifestSha256: sha(manifestText),
  sourceReview: {
    status: "unreviewed_draft",
    notes: [
      "The current official tuition page publishes separate Chinese- and English-program annual tuition for master's and doctoral study.",
      "Each amount is mapped only by the program's already evidenced degree level and teaching language.",
      "No intake, deadline, program identity or scholarship state is changed.",
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
