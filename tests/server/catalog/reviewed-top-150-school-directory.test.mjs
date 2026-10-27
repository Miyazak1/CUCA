import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCatalogMigrationValidationReport } from "../../../src/server/catalog/seed-contract.ts";

test("reviewed top-150 school directory is an exact school-only official-source release", async () => {
  const [bundle, review, registry] = await Promise.all([
    readFile("seeds/catalog.reviewed-top-150-school-directory.json", "utf8").then(JSON.parse),
    readFile("seeds/catalog.reviewed-top-150-school-directory.review.json", "utf8").then(JSON.parse),
    readFile("catalog-sources/official-sources.json", "utf8").then(JSON.parse),
  ]);
  const report = createCatalogMigrationValidationReport(bundle);
  const registeredUrls = new Set(registry.sources.map((row) => row.url));
  assert.equal(report.ok, true, report.errors.join("\n"));
  assert.deepEqual(report.summary, { cities: 51, schools: 150, programs: 0, programIntakes: 0, scholarships: 0 });
  assert.equal(report.bundleSha256, review.publicationBundleSha256);
  assert.equal(report.operationPlanSha256, review.operationPlanSha256);
  assert.equal(review.approvedCandidateFileSha256, "df4b9d75bd49832898ddbc51549df436fdc86a71e1524fa27deb253fcad056d6");
  assert.equal(review.confirmations.preserveSchoolsOutsideTarget, true);
  assert.equal(review.confirmations.programsMustRemainUnchanged, true);
  assert.equal(review.confirmations.programIntakesMustRemainUnchanged, true);
  assert.equal(review.confirmations.scholarshipsMustRemainUnchanged, true);
  assert.equal(new Set(bundle.schools.map((row) => row.slug)).size, 150);
  assert.ok(bundle.schools.every((row) => row.status === "active" && row.verificationStatus === "verified"));
  assert.ok(bundle.schools.every((row) => registeredUrls.has(row.sourceUrl) && row.sourceSha256 && row.capturedAt));
  assert.ok(bundle.schools.every((row) => !row.contactNotes));
});

test("top-150 publisher preserves existing schools and protects non-school catalog tables", async () => {
  const [publisher, preflight, releaseHelper] = await Promise.all([
    readFile("scripts/catalog-top-150-school-directory-single-host-publish.ts", "utf8"),
    readFile("scripts/catalog-top-150-school-directory-single-host-preflight.ts", "utf8"),
    readFile("scripts/lib/top-150-school-directory-release.ts", "utf8"),
  ]);
  assert.match(publisher, /preserveExistingSchoolSlugs: preservedSchoolSlugs/);
  assert.match(publisher, /preserveExistingCitySlugs: preservedCitySlugs/);
  assert.match(publisher, /update schools set status='active', verification_status='verified'/);
  assert.doesNotMatch(publisher, /update schools set[\s\S]{0,300}name_en\s*=/);
  assert.match(publisher, /protectedCatalogSnapshotSql/);
  assert.match(publisher, /JSON\.stringify\(after\) !== JSON\.stringify\(before\)/);
  assert.match(publisher, /target_count !== 150/);
  assert.doesNotMatch(publisher, /delete from|truncate|update programs|update program_intakes|update scholarships/i);
  assert.match(preflight, /repeatable read read only/);
  assert.doesNotMatch(preflight, /CatalogSeedWriter|insert into|update schools|delete from/i);
  assert.match(releaseHelper, /TOP_150_SCHOOL_DIRECTORY_APPROVED_CANDIDATE_SHA256/);
  assert.match(releaseHelper, /TOP_150_SCHOOL_DIRECTORY_PUBLICATION_SHA256/);
  assert.match(releaseHelper, /TOP_150_SCHOOL_DIRECTORY_OPERATION_PLAN_SHA256/);
});
