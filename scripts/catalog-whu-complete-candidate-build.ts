import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const basePath = resolve(root, "seeds/catalog.whu-programs-batch-01.draft.json");
const tuitionPath = resolve(root, "seeds/catalog.whu-tuition-enrichment-batch-01.draft.json");
const scholarshipPath = resolve(root, "seeds/catalog.whu-school-scholarships-batch-01.draft.json");
const outputPath = resolve(root, "seeds/catalog.whu-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.whu-complete-batch-01.validation.json");

const [baseText, tuitionText, scholarshipText] = await Promise.all([
  readFile(basePath, "utf8"), readFile(tuitionPath, "utf8"), readFile(scholarshipPath, "utf8"),
]);
const base = JSON.parse(baseText) as CatalogSeedBundle;
const tuition = JSON.parse(tuitionText) as CatalogSeedBundle;
const scholarship = JSON.parse(scholarshipText) as CatalogSeedBundle;
const basePrograms = base.programs;
const baseProgramIntakes = base.programIntakes;
const tuitionPrograms = tuition.programs;
const scholarshipRecords = scholarship.scholarships;
if (!basePrograms || !baseProgramIntakes || !tuitionPrograms || !scholarshipRecords
  || basePrograms.length !== 599 || baseProgramIntakes.length !== 599 || tuitionPrograms.length !== 599 || scholarshipRecords.length !== 6) {
  throw new Error("Unexpected WHU source-bundle cardinality.");
}
const baseSlugs = new Set(basePrograms.map((program) => program.slug));
const tuitionSlugs = new Set(tuitionPrograms.map((program) => program.slug));
if (baseSlugs.size !== 599 || tuitionSlugs.size !== 599 || [...baseSlugs].some((slug) => !tuitionSlugs.has(slug))) {
  throw new Error("WHU tuition overlay does not map one-to-one to the official program catalog.");
}
const intakeSlugs = new Set(baseProgramIntakes.map((intake) => intake.programSlug));
if (intakeSlugs.size !== 599 || [...baseSlugs].some((slug) => !intakeSlugs.has(slug))) throw new Error("WHU intake coverage is incomplete.");
for (const program of tuitionPrograms) {
  if (!program.tuitionAmount || !program.tuitionText || program.status !== "draft") throw new Error(`WHU tuition is incomplete: ${program.slug}`);
}
for (const intake of baseProgramIntakes) {
  const expectedDeadline = basePrograms.find((program) => program.slug === intake.programSlug)?.degreeLevel === "Undergraduate"
    ? "2026-06-30T15:59:59.000Z" : "2026-06-15T15:59:59.000Z";
  if (intake.intakeTerm !== "Fall" || intake.intakeYear !== 2026 || intake.deadlineDate !== expectedDeadline || intake.status !== "closed") {
    throw new Error(`WHU intake is not an exact closed Fall 2026 binding: ${intake.programSlug}`);
  }
}

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: new Date().toISOString(),
  cities: scholarship.cities,
  schools: scholarship.schools,
  programs: tuitionPrograms,
  programIntakes: baseProgramIntakes,
  scholarships: scholarshipRecords,
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 599 || validation.summary.programIntakes !== 599 || validation.summary.scholarships !== 6) {
  throw new Error(`WHU complete candidate invalid:\n${validation.errors.join("\n")}`);
}
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const artifact = {
  ...validation,
  candidateSha256: sha256(candidateText),
  inputs: {
    programCatalogSha256: sha256(baseText),
    tuitionOverlaySha256: sha256(tuitionText),
    schoolScholarshipsSha256: sha256(scholarshipText),
  },
  review: {
    status: "unreviewed_draft",
    notes: [
      "All 599 official 2026 program rows map one-to-one to a tuition row and an exact closed Fall 2026 intake.",
      "Undergraduate routes close June 30, 2026; master's and doctoral routes close June 15, 2026.",
      "Six official scholarship records remain independent of program eligibility; no route-level entitlement is inferred.",
      "This bundle is a non-public candidate and requires human review before any persistent database write or publication.",
    ],
  },
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
};
await Promise.all([
  writeFile(outputPath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, outputPath, validationPath, summary: validation.summary, candidateSha256: artifact.candidateSha256 }, null, 2));
