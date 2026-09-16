import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createCatalogMigrationValidationReport,
  createReviewedScholarshipPublication,
} from "../../../src/server/index.ts";

const load = async path => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));

test("reviewed scholarship publication creates a 20-record delta without restoring old scholarships", async () => {
  const draft = await load("../../../seeds/catalog.cscalite-online-20260910.scholarships-rich-batch-01.draft.json");
  const review = await load("../../../seeds/catalog.scholarships-rich-batch-01.review.json");
  const storedValidation = await load("../../../seeds/catalog.scholarships-rich-batch-01.validation.json");
  const approvedHash = createCatalogMigrationValidationReport(draft).bundleSha256;
  const result = createReviewedScholarshipPublication({
    draft, review, storedValidation, approvedDraftBundleSha256: approvedHash,
    reviewReference: `user-chat-approval-${approvedHash.slice(0, 12)}`,
    approvalRecordedAt: "2026-09-11T08:00:00.000Z",
  });

  assert.equal(result.report.ok, true);
  assert.equal(result.report.summary.scholarships, 20);
  assert.equal(result.bundle.scholarships.length, 20);
  assert.equal(result.bundle.scholarships.every(record => record.status === "active"), true);
  assert.equal(result.bundle.scholarships.every(record => record.verificationStatus === "verified"), true);
  assert.equal(result.bundle.scholarships.every(record => record.lastVerifiedAt === "2026-09-11T08:00:00.000Z"), true);
  assert.equal(result.bundle.scholarships.some(record => record.slug === "renmin-university-foreign-student-scholarship"), false);
  assert.equal(result.bundle.programIntakes.length, 0);
  assert.equal(result.bundle.handoff.reviewReference, `user-chat-approval-${approvedHash.slice(0, 12)}`);
});

test("reviewed scholarship publication fails closed on hash mismatch or non-draft review state", async () => {
  const draft = await load("../../../seeds/catalog.cscalite-online-20260910.scholarships-rich-batch-01.draft.json");
  const review = await load("../../../seeds/catalog.scholarships-rich-batch-01.review.json");
  const storedValidation = await load("../../../seeds/catalog.scholarships-rich-batch-01.validation.json");
  const input = {
    draft, review, storedValidation, approvedDraftBundleSha256: "0".repeat(64),
    reviewReference: "user-chat-approval-test", approvalRecordedAt: "2026-09-11T08:00:00.000Z",
  };
  assert.throws(() => createReviewedScholarshipPublication(input), /Approval hash does not match/);
  const approvedHash = createCatalogMigrationValidationReport(draft).bundleSha256;
  assert.throws(() => createReviewedScholarshipPublication({
    ...input, approvedDraftBundleSha256: approvedHash,
    review: { ...review, records: review.records.map((record, index) => index ? record : { ...record, status: "active" }) },
  }), /must still be draft/);
});
