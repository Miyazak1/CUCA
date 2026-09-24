import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
} from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const inputPath = resolve(root, "seeds/catalog.gdufs-complete-batch-01.draft.json");
const manifestPath = resolve(root, "work/catalog-official/gdufs-tuition-table-batch-01/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.gdufs-tuition-enrichment-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.gdufs-tuition-enrichment-batch-01.validation.json");
const [inputText, manifestText] = await Promise.all([readFile(inputPath, "utf8"), readFile(manifestPath, "utf8")]);
const input = JSON.parse(inputText) as CatalogSeedBundle;
const manifest = JSON.parse(manifestText) as {
  sources: { id: string; status: number; sha256: string; fetchedAt: string }[];
};
const sourceId = "gdufs-international-degree-tuition-table-fall-2026";
const expectedDigest = "06fdb5f5c6eb93f076a8fd6043310e686e6412455da1503a388953f1b128cd1f";
const tuitionSource = manifest.sources.find((row) => row.id === sourceId);
if (!tuitionSource || tuitionSource.status !== 200 || tuitionSource.sha256 !== expectedDigest) {
  throw new Error("GDUFS tuition-table evidence is missing or changed.");
}

const schoolSlug = "guangdong-university-of-foreign-studies";
const expectedProgramSlugs = new Set([
  "guangdong-university-of-foreign-studies-business-administration",
  "guangdong-university-of-foreign-studies-international-economics-and-trade",
]);
const sourcePrograms = input.programs.filter((program) => expectedProgramSlugs.has(program.slug));
if (sourcePrograms.length !== expectedProgramSlugs.size) {
  throw new Error(`Expected ${expectedProgramSlugs.size} GDUFS programs, received ${sourcePrograms.length}.`);
}
const invalidPrograms = sourcePrograms.filter(
  (program) => program.schoolSlug !== schoolSlug
    || program.degreeLevel !== "Undergraduate"
    || program.teachingLanguage !== "Chinese"
    || program.tuitionText,
);
if (invalidPrograms.length) {
  throw new Error(`GDUFS tuition mapping preconditions changed: ${invalidPrograms.map((row) => row.slug).join(", ")}`);
}

const programs: CatalogSeedProgram[] = sourcePrograms.map((program) => ({
  ...program,
  tuitionAmount: 20000,
  tuitionCurrency: "CNY",
  tuitionPeriod: "year",
  tuitionText: "CNY 20,000 per year",
  displayTuition: "CNY 20,000/year",
  status: "draft",
  sourceFieldLineage: {
    ...program.sourceFieldLineage,
    tuitionAmount: `${sourceId} ${expectedDigest}: row 4, Chinese-taught undergraduate programs`,
    tuitionText: `${sourceId} ${expectedDigest}: row 4, Chinese-taught undergraduate programs`,
  },
}));

const school = input.schools.find((row) => row.slug === schoolSlug);
if (!school) throw new Error("GDUFS school dependency is missing.");
const city = input.cities.find((row) => row.slug === school.citySlug);
if (!city) throw new Error("GDUFS city dependency is missing.");
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
if (!validation.ok || validation.summary.programs !== 2) {
  throw new Error(`GDUFS tuition enrichment invalid:\n${validation.errors.join("\n")}`);
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
      "The official Fall 2026 tuition table publishes CNY 20,000 per year for Chinese-taught undergraduate programs.",
      "The amount is mapped only to the two existing undergraduate records already evidenced as Chinese-taught.",
      "No intake, deadline, program identity, teaching language or scholarship state is changed.",
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
