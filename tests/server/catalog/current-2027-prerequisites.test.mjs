import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createCatalogMigrationValidationReport } from "../../../src/server/catalog/seed-contract.ts";

test("reviewed current 2027 prerequisite bundle covers every current requirement target", async () => {
  const [bundle, review, requirements] = await Promise.all([
    readFile("seeds/catalog.current-2027-prerequisites.reviewed.json", "utf8").then(JSON.parse),
    readFile("seeds/catalog.current-2027-prerequisites.review.json", "utf8").then(JSON.parse),
    readFile("seeds/application-requirements-release-candidate.unreviewed.json", "utf8").then(JSON.parse),
  ]);
  const report = createCatalogMigrationValidationReport(bundle);
  assert.equal(report.ok, true, report.errors.join("\n"));
  assert.deepEqual(report.summary, { cities: 11, schools: 15, programs: 346, programIntakes: 347, scholarships: 0 });
  assert.equal(report.bundleSha256, review.publicationBundleSha256);
  assert.equal(report.operationPlanSha256, review.operationPlanSha256);
  assert.equal(bundle.handoff.reviewReference, review.reviewReference);
  assert.equal(bundle.handoff.prohibitedDataReviewReference, review.reviewReference);
  assert.ok(bundle.programs.every(row => row.status === "active" && row.verificationStatus === "verified"));
  assert.ok(bundle.programIntakes.every(row => row.status === "open" && row.intakeYear === 2027));
  const publishedTargets = new Set(bundle.programIntakes.map(row => `${row.programSlug}:${row.intakeTerm}:${row.intakeYear}`));
  const requiredTargets = new Set(requirements.operations.filter(row => row.intakeYear === 2027)
    .map(row => `${row.programSlug}:${row.intakeTerm}:${row.intakeYear}`));
  assert.deepEqual(publishedTargets, requiredTargets);
});
