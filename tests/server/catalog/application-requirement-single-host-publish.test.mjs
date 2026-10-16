import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { validateRequirementReleaseCandidate } from "../../../scripts/lib/catalog-requirement-candidate-runtime.ts";
import {
  assertSingleHostRequirementPublishTarget,
  SINGLE_HOST_REQUIREMENT_PUBLISH_CONFIRMATION,
  validateRequirementReviewRecord,
} from "../../../scripts/lib/catalog-requirement-single-host-publish.ts";

test("reviewed requirement release binds the exact normalized candidate", async () => {
  const candidateBytes = await readFile("seeds/application-requirements-release-candidate.unreviewed.json");
  const review = JSON.parse(await readFile("seeds/application-requirements-release-candidate.review.json", "utf8"));
  const candidate = validateRequirementReleaseCandidate(JSON.parse(candidateBytes.toString("utf8")));
  const result = validateRequirementReviewRecord(review, candidate, candidateBytes);
  assert.equal(result.status, "human_review_completed");
  assert.equal(result.scope.operationCount, 6144);
  assert.equal(result.scope.publishResolvableOnly, true);
  assert.equal(result.scope.leaveUnavailableDataEmpty, true);
});

test("reviewed requirement release rejects changed bytes or incomplete confirmation", async () => {
  const candidateBytes = await readFile("seeds/application-requirements-release-candidate.unreviewed.json");
  const review = JSON.parse(await readFile("seeds/application-requirements-release-candidate.review.json", "utf8"));
  const candidate = validateRequirementReleaseCandidate(JSON.parse(candidateBytes.toString("utf8")));
  assert.throws(() => validateRequirementReviewRecord(review, candidate, Buffer.concat([candidateBytes, Buffer.from(" ")])), /exact candidate/);
  assert.throws(() => validateRequirementReviewRecord({ ...review, confirmations: { ...review.confirmations, publicContentConfirmed: false } }, candidate, candidateBytes), /incomplete/);
});

test("single-host reviewed publication requires loopback target, exact token and distinct accounts", () => {
  const env = {
    CUAC_REQUIREMENT_PUBLISH_CONFIRMATION: SINGLE_HOST_REQUIREMENT_PUBLISH_CONFIRMATION,
    CUAC_ENV: "development",
    CUAC_LOCAL_RUNTIME: "1",
    DATABASE_URL: "postgresql://cuac_local:secret@127.0.0.1:55432/cuac_local",
    CUAC_REQUIREMENT_PREPARER_EMAIL: "ops@example.test",
    CUAC_REQUIREMENT_REVIEWER_EMAIL: "admin@example.test",
    CUAC_REQUIREMENT_REVIEW_REFERENCE: "project-owner-chat-review-2026-10-16",
  };
  assert.equal(assertSingleHostRequirementPublishTarget(env).reviewerEmail, "admin@example.test");
  assert.throws(() => assertSingleHostRequirementPublishTarget({ ...env, DATABASE_URL: "postgresql://cuac_local:secret@db:5432/cuac_local" }), /loopback/);
  assert.throws(() => assertSingleHostRequirementPublishTarget({ ...env, CUAC_REQUIREMENT_REVIEWER_EMAIL: "ops@example.test" }), /Distinct/);
  assert.throws(() => assertSingleHostRequirementPublishTarget({ ...env, CUAC_REQUIREMENT_PUBLISH_CONFIRMATION: "wrong" }), /exact confirmation/);
});
