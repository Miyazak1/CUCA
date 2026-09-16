import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CATALOG_MIGRATION_PROHIBITED_FIELDS,
  CATALOG_SEED_ALLOWED_FIELDS,
  createCatalogMigrationValidationReport,
  createCatalogSeedImportPlan,
  validateCatalogSeedBundle,
} from "../../../src/server/index.ts";

test("catalog seed sample validates as a dry-run contract", async () => {
  const sample = JSON.parse(await readFile(new URL("../../../seeds/catalog.sample.json", import.meta.url), "utf8"));
  const result = validateCatalogSeedBundle(sample);

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.summary, {
    cities: 1,
    schools: 1,
    programs: 1,
    programIntakes: 0,
    scholarships: 1,
  });
});

test("catalog seed import plan is ordered for idempotent PostgreSQL upserts", async () => {
  const sample = JSON.parse(await readFile(new URL("../../../seeds/catalog.sample.json", import.meta.url), "utf8"));
  const plan = createCatalogSeedImportPlan(sample);

  assert.equal(plan.ok, true);
  assert.deepEqual(
    plan.operations.map((operation) => operation.idempotencyKey),
    [
      "city:beijing",
      "school:sample-university",
      "program:sample-university-computer-science-bachelor",
      "scholarship:sample-scholarship",
    ],
  );
  assert.deepEqual(plan.operations.map((operation) => operation.order), [1, 2, 3, 4]);
  assert.deepEqual(plan.operations[1].dependencyKeys, ["city:beijing"]);
  assert.deepEqual(plan.operations[2].dependencyKeys, ["school:sample-university"]);
  assert.deepEqual(plan.operations[3].dependencyKeys, [
    "school:sample-university",
    "program:sample-university-computer-science-bachelor",
  ]);
  assert.equal(plan.operations[0].sourceEvidence.sourceUrl, "https://example.edu/catalog/beijing");
  assert.deepEqual(plan.operations[0].sourceEvidence.sourceFieldLineage, { nameEn: "source.name" });
});

test("catalog seed import plan does not produce operations for invalid bundles", () => {
  const plan = createCatalogSeedImportPlan({
    version: 1,
    generatedAt: "2026-08-28T00:00:00.000Z",
    programs: [{ slug: "program-a", schoolSlug: "missing-school", nameEn: "Program A", degreeLevel: "bachelor" }],
  });

  assert.equal(plan.ok, false);
  assert.deepEqual(plan.operations, []);
});

test("catalog seed validation rejects missing source evidence and broken references", () => {
  const result = validateCatalogSeedBundle({
    version: 1,
    generatedAt: "2026-08-28T00:00:00.000Z",
    schools: [{ slug: "school-a", nameEn: "School A", sourceUrl: "https://example.edu", sourceLabel: "Example" }],
    programs: [{ slug: "program-a", schoolSlug: "missing-school", nameEn: "Program A", degreeLevel: "bachelor" }],
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /programs\[0\]\.sourceUrl is required/);
  assert.match(result.errors.join("\n"), /programs\[0\]\.schoolSlug references unknown school missing-school/);
});

test("catalog migration validation rejects non-whitelisted and prohibited fields", () => {
  const result = validateCatalogSeedBundle({
    version: 1,
    generatedAt: "2026-09-10T00:00:00.000Z",
    users: [{ passwordHash: "must-never-enter-a-catalog-bundle" }],
    cities: [{
      slug: "safe-city", nameEn: "Safe City", sourceUrl: "https://source.example/city", sourceLabel: "Reviewed source",
      sourceFieldLineage: { nameEn: "cleaned.city.name" }, personalEmail: "private@example.invalid",
    }],
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /bundle\.users is not in the migration whitelist/);
  assert.match(result.errors.join("\n"), /bundle\.users\[0\]\.passwordHash is prohibited migration data/);
  assert.match(result.errors.join("\n"), /cities\[0\]\.personalEmail is prohibited migration data/);
  assert.ok(CATALOG_SEED_ALLOWED_FIELDS.programs.includes("schoolSlug"));
  assert.ok(CATALOG_MIGRATION_PROHIBITED_FIELDS.includes("passportNumber"));
});

test("catalog migration report is canonical and checks evidence and relation integrity", () => {
  const first = {
    version: 1,
    generatedAt: "2026-09-10T00:00:00.000Z",
    cities: [{ slug: "safe-city", nameEn: "Safe City", sourceUrl: "https://source.example/city", sourceLabel: "Reviewed", sourceFieldLineage: { nameEn: "cleaned.city.name" } }],
  };
  const reordered = { cities: first.cities, generatedAt: first.generatedAt, version: first.version };
  assert.equal(createCatalogMigrationValidationReport(first).bundleSha256, createCatalogMigrationValidationReport(reordered).bundleSha256);

  const invalid = validateCatalogSeedBundle({
    version: 1,
    generatedAt: "not-a-time",
    schools: [
      { slug: "school-one", nameEn: "One", sourceUrl: "http://source.example/one", sourceLabel: "One", sourceFieldLineage: { missing: "source.missing" } },
      { slug: "school-two", nameEn: "Two", sourceUrl: "https://source.example/two", sourceLabel: "Two", sourceFieldLineage: { nameEn: "source.name" } },
    ],
    programs: [{ slug: "program-two", schoolSlug: "school-two", nameEn: "Program", degreeLevel: "bachelor", sourceUrl: "https://source.example/program", sourceLabel: "Program", sourceFieldLineage: { nameEn: "source.name" } }],
    scholarships: [{ slug: "award", title: "Award", schoolSlug: "school-one", programSlug: "program-two", sourceUrl: "https://source.example/award", sourceLabel: "Award", sourceFieldLineage: { title: "source.title" } }],
  });
  assert.match(invalid.errors.join("\n"), /generatedAt must be an ISO-8601 UTC timestamp/);
  assert.match(invalid.errors.join("\n"), /sourceUrl must be an HTTPS URL/);
  assert.match(invalid.errors.join("\n"), /sourceFieldLineage\.missing does not describe an imported field/);
  assert.match(invalid.errors.join("\n"), /links a program outside school school-one/);
});

test("version 2 real-catalog bundles require a completed, path-free handoff", () => {
  const missing = validateCatalogSeedBundle({ version: 2, generatedAt: "2026-09-10T00:00:00.000Z" });
  assert.match(missing.errors.join("\n"), /handoff is required/);

  const result = validateCatalogSeedBundle({
    version: 2,
    generatedAt: "2026-09-10T00:00:00.000Z",
    handoff: {
      sourceSystem: "CSCAlite reviewed export",
      cleanedExportName: "D:\\private\\catalog.json",
      cleanedExportSha256: "not-a-digest",
      sourceSchemaSha256: "a".repeat(64),
      reviewReference: "pending",
      prohibitedDataReviewReference: "review-42",
      approvalRecordedAt: "2026-09-10T00:00:00.000Z",
      sourceReadOnly: false,
      prohibitedDataConfirmedExcluded: false,
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /filename, not a filesystem path/);
  assert.match(result.errors.join("\n"), /cleanedExportSha256 must be a lowercase SHA-256 digest/);
  assert.match(result.errors.join("\n"), /reviewReference must identify a completed review/);
  assert.match(result.errors.join("\n"), /sourceReadOnly must be true/);
  assert.match(result.errors.join("\n"), /prohibitedDataConfirmedExcluded must be true/);
});

test("scholarship rich fields require exact nested shapes and calendar dates", () => {
  const source = { sourceUrl: "https://official.example/scholarship", sourceLabel: "Official guide" };
  const result = validateCatalogSeedBundle({
    version: 1,
    generatedAt: "2026-09-11T00:00:00.000Z",
    schools: [{ slug: "school-a", nameEn: "School A", ...source }],
    scholarships: [{
      slug: "award-a", title: "Award A", schoolSlug: "school-a", ...source,
      deadlineDate: "2026-02-30",
      bodySections: [{ title: "Overview", paragraphs: ["Valid"], unexpected: "reject" }],
      benefitItems: [{ label: "Tuition", included: "yes" }],
      eligibilityItems: [{ label: "Eligible", value: 3 }],
      applicationMaterials: [{ body: "Missing label" }],
      actionLinks: [{ label: "Apply", url: "http://official.example/apply" }],
    }],
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /deadlineDate must be a valid calendar date/);
  assert.match(result.errors.join("\n"), /bodySections\[0\]\.unexpected is not in the migration whitelist/);
  assert.match(result.errors.join("\n"), /benefitItems\[0\]\.included must be boolean/);
  assert.match(result.errors.join("\n"), /eligibilityItems\[0\]\.value must be a non-empty string/);
  assert.match(result.errors.join("\n"), /applicationMaterials\[0\]\.label is required/);
  assert.match(result.errors.join("\n"), /actionLinks\[0\]\.url must be an HTTPS URL/);
});

test("verified scholarship seeds require a valid verification timestamp", () => {
  const source = {
    sourceUrl: "https://official.example/scholarship", sourceLabel: "Official guide",
    sourceFieldLineage: { title: "official heading" },
  };
  const result = validateCatalogSeedBundle({
    version: 1,
    generatedAt: "2026-09-11T00:00:00.000Z",
    scholarships: [{ slug: "award-a", title: "Award A", verificationStatus: "verified", ...source }],
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /lastVerifiedAt is required/);
});

test("verified school and program seeds require a valid verification timestamp", () => {
  const source = {
    sourceUrl: "https://official.example/catalog", sourceLabel: "Official catalog",
    sourceFieldLineage: { nameEn: "official heading" },
  };
  const result = validateCatalogSeedBundle({
    version: 1,
    generatedAt: "2026-09-11T00:00:00.000Z",
    schools: [{ slug: "school-a", nameEn: "School A", verificationStatus: "verified", ...source }],
    programs: [{
      slug: "program-a", schoolSlug: "school-a", nameEn: "Program A", degreeLevel: "bachelor",
      verificationStatus: "verified", ...source,
    }],
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /schools\[0\]\.lastVerifiedAt is required/);
  assert.match(result.errors.join("\n"), /programs\[0\]\.lastVerifiedAt is required/);
});
