import assert from "node:assert/strict";
import test from "node:test";
import { createRequestContext, OpsAccountDeletionService } from "../../../src/server/index.ts";

const executionId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const reviewId = "33333333-3333-4333-8333-333333333333";
const adminId = "44444444-4444-4444-8444-444444444444";
const now = new Date("2026-09-20T00:00:00.000Z");
const row = overrides => ({ executionId, dataRightsRequestId: requestId, status: "review_required",
  blockerCodes: ["legal_hold_review_required", "backup_tombstone_required"], revision: 1,
  preparedAt: now, updatedAt: now, latestLegalHoldReview: null, ...overrides });
const context = overrides => createRequestContext({ actorUserId: adminId, activeRole: "cuac_admin",
  selectedSurface: "ops", purpose: "account_deletion_execution", authStrength: "step_up", ...overrides });

test("account-deletion queue returns metadata only and audits bounded counts", async () => {
  const audits = [], service = new OpsAccountDeletionService({
    async list(input) { assert.equal(input.limit, 10); return { authorized: true, value: [row()] }; },
    async refresh() { throw new Error("unexpected"); }, async recordLegalHoldReview() { throw new Error("unexpected"); },
  }, { async record(event) { audits.push(event); } });
  const result = await service.list(context({ authStrength: "session" }), { limit: 10 });
  assert.equal(result[0].dataRightsRequestId, requestId);
  assert.doesNotMatch(JSON.stringify(result), /email|name|subjectReferenceHash/i);
  assert.deepEqual(audits[0].metadata, { itemCount: 1 });
});

test("legal-hold review requires step-up admin and enforces paired reason semantics", async () => {
  let called = false;
  const service = new OpsAccountDeletionService({ async list() { throw new Error("unexpected"); },
    async refresh() { throw new Error("unexpected"); }, async recordLegalHoldReview(input) { called = true;
      return { authorized: true, value: row({ revision: 2, latestLegalHoldReview: { reviewId, version: 1,
        sourceExecutionRevision: 1, result: input.result, reasonCode: input.reasonCode,
        caseReference: input.caseReference, reviewedByUserId: adminId, reviewedAt: now } }) }; } }, { async record() {} });
  const body = { reviewId, expectedRevision: 1, result: "clear_candidate", reasonCode: "no_hold_found", caseReference: "LEGAL:1" };
  await assert.rejects(service.reviewLegalHold(context({ activeRole: "cuac_ops", authStrength: "session" }), executionId, body),
    error => error.status === 403);
  await assert.rejects(service.reviewLegalHold(context(), executionId, { ...body, reasonCode: "legal_hold" }),
    error => error.status === 400);
  const result = await service.reviewLegalHold(context(), executionId, body);
  assert.equal(called, true); assert.equal(result.revision, 2);
  assert.deepEqual(result.blockerCodes, ["legal_hold_review_required", "backup_tombstone_required"]);
});

test("refresh fails closed on stale execution and live grant denial", async () => {
  const service = new OpsAccountDeletionService({ async list() { throw new Error("unexpected"); },
    async refresh() { return { authorized: true, value: null }; }, async recordLegalHoldReview() { throw new Error("unexpected"); } },
  { async record() {} });
  await assert.rejects(service.refresh(context({ authStrength: "session" }), executionId, { expectedRevision: 1 }),
    error => error.status === 409);
  const denied = new OpsAccountDeletionService({ async list() { return { authorized: false }; },
    async refresh() { return { authorized: false }; }, async recordLegalHoldReview() { return { authorized: false }; } }, { async record() {} });
  await assert.rejects(denied.list(context({ authStrength: "session" })), error => error.status === 403);
});
