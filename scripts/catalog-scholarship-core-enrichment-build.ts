import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
} from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const inputPath = resolve(root, "seeds/catalog.zjsu-safe-new-batch-01.draft.json");
const candidatePath = resolve(root, "seeds/catalog.scholarship-core-enrichment-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.scholarship-core-enrichment-batch-01.validation.json");
const inputText = await readFile(inputPath, "utf8");
const input = JSON.parse(inputText) as CatalogSeedBundle;
const scholarshipSlug = "official-2026-zjsu-international-chinese-language-teachers-scholarship";
const expectedDigest = "77edca771d2f4ca7c48457c91da63afb6cd2f80992bc47a0cc4986ff5b89be09";
const scholarship = input.scholarships.find((row) => row.slug === scholarshipSlug);
if (!scholarship || scholarship.sourceSha256 !== expectedDigest) {
  throw new Error("ZJSU scholarship evidence is missing or changed.");
}
const school = input.schools.find((row) => row.slug === scholarship.schoolSlug);
if (!school) throw new Error("ZJSU school dependency is missing.");
const city = input.cities.find((row) => row.slug === school.citySlug);
if (!city) throw new Error("ZJSU city dependency is missing.");

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: scholarship.capturedAt,
  cities: [city],
  schools: [school],
  programs: [],
  programIntakes: [],
  scholarships: [{
    ...scholarship,
    amountText: "Tuition, accommodation, living expenses and comprehensive medical insurance are included; the reviewed ZJSU page does not itemize one universal cash amount.",
    status: "draft",
    sourceFieldLineage: {
      ...scholarship.sourceFieldLineage,
      amountText: "official coverage categories retained; absence of an itemized universal cash amount stated explicitly",
    },
  }],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.scholarships !== 1) {
  throw new Error(`Scholarship core enrichment invalid:\n${validation.errors.join("\n")}`);
}
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha(candidateText),
  inputBundleSha256: sha(inputText),
  sourceReview: {
    status: "unreviewed_draft",
    notes: [
      "The amount text restates the four official coverage categories and explicitly preserves the absence of a universal itemized cash amount.",
      "No stipend number or award value is imported from another institution or inferred from a general scholarship standard.",
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
