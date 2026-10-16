import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCatalogMigrationValidationReport } from "../../../src/server/catalog/seed-contract.ts";

test("reviewed 100-school release contains the full official catalog scope", async () => {
  const [bundle, review, registry] = await Promise.all([
    readFile("seeds/catalog.reviewed-100-official-release.json", "utf8").then(JSON.parse),
    readFile("seeds/catalog.reviewed-100-official-release.review.json", "utf8").then(JSON.parse),
    readFile("catalog-sources/official-sources.json", "utf8").then(JSON.parse),
  ]);
  const report = createCatalogMigrationValidationReport(bundle);
  const registeredUrls = new Set(registry.sources.map((row) => row.url));
  assert.equal(report.ok, true, report.errors.join("\n"));
  assert.equal(report.summary.schools, 100);
  assert.ok(report.summary.programs >= 10_000);
  assert.ok(report.summary.programIntakes >= 9_000);
  assert.ok(report.summary.scholarships >= 300);
  assert.equal(report.bundleSha256, review.publicationBundleSha256);
  assert.equal(report.operationPlanSha256, review.operationPlanSha256);
  for (const entity of [...bundle.cities, ...bundle.schools, ...bundle.programs, ...bundle.scholarships]) {
    assert.equal(entity.status, "active");
    assert.equal(entity.verificationStatus, "verified");
    assert.ok(registeredUrls.has(entity.sourceUrl));
    assert.match(entity.sourceSha256, /^[a-f0-9]{64}$/);
  }
});

test("100-school single-host publisher is fail-closed and verifies online counts", async () => {
  const source = await readFile("scripts/catalog-reviewed-100-official-release-single-host-publish.ts", "utf8");
  assert.match(source, /publish-reviewed-100-official-catalog-to-cuac-single-host/);
  assert.match(source, /single_host_loopback/);
  assert.match(source, /target_schools !== 100/);
  assert.match(source, /target_programs !== report\.summary\.programs/);
  assert.match(source, /target_intakes < report\.summary\.programIntakes/);
  assert.match(source, /public_schools < 100/);
});
