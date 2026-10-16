import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCatalogMigrationValidationReport } from "../../../src/server/catalog/seed-contract.ts";

test("reviewed school directory contains 50 exact official-source identities", async () => {
  const [bundle, review, registry] = await Promise.all([
    readFile("seeds/catalog.reviewed-50-school-directory.json", "utf8").then(JSON.parse),
    readFile("seeds/catalog.reviewed-50-school-directory.review.json", "utf8").then(JSON.parse),
    readFile("catalog-sources/official-sources.json", "utf8").then(JSON.parse),
  ]);
  const report = createCatalogMigrationValidationReport(bundle);
  const registeredUrls = new Set(registry.sources.map(row => row.url));
  assert.equal(report.ok, true, report.errors.join("\n"));
  assert.deepEqual(report.summary, { cities: 22, schools: 50, programs: 0, programIntakes: 0, scholarships: 0 });
  assert.equal(report.bundleSha256, review.publicationBundleSha256);
  assert.equal(report.operationPlanSha256, review.operationPlanSha256);
  assert.ok(bundle.schools.every(row => row.status === "active" && row.verificationStatus === "verified"));
  assert.ok(bundle.schools.every(row => registeredUrls.has(row.sourceUrl) && row.sourceSha256 && row.capturedAt));
  assert.deepEqual(review.excludedSchoolSlugs.sort(), ["guangxi-medical-university", "xi-an-jiaotong-university"]);
});

test("single-host publisher preserves existing directory records", async () => {
  const source = await readFile("scripts/catalog-reviewed-school-directory-single-host-publish.ts", "utf8");
  assert.match(source, /preserveExistingSchoolSlugs: preservedSchoolSlugs/);
  assert.match(source, /preserveExistingCitySlugs: preservedCitySlugs/);
  assert.match(source, /publicTargetSchools/);
  assert.match(source, /target_count !== 50/);
});
