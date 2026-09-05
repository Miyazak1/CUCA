import assert from "node:assert/strict";
import test from "node:test";
import { createRequestContext, OpsRoutingReviewService } from "../../../src/server/index.ts";

const outboxId = "11111111-1111-4111-8111-111111111111";
const reviewId = "22222222-2222-4222-8222-222222222222";
const assigneeId = "33333333-3333-4333-8333-333333333333";
const adminId = "44444444-4444-4444-8444-444444444444";
const now = new Date("2026-09-03T03:00:00.000Z");

function context(overrides = {}) {
  return createRequestContext({ actorUserId: assigneeId, activeRole: "cuac_ops", selectedSurface: "ops",
    purpose: "routing_review", authStrength: "session", ...overrides });
}

function review(overrides = {}) {
  return { reviewId, sourceOutcome: "unknown", sourceErrorCode: "PROVIDER_RESULT_UNKNOWN", sourceAttemptCount: 1,
    sourceQuarantinedAt: now, revision: 1, status: "investigating", assignedUserId: assigneeId,
    assignedRole: "cuac_ops", escalationCode: null, escalationReference: null, escalatedAt: null,
    resolvedByUserId: null, resolutionCode: null, resolutionReference: null, resolvedAt: null,
    createdAt: now, updatedAt: now, ...overrides };
}

function row(index, overrides = {}) {
  return { outboxId: `${String(index).padStart(8, "0")}-1111-4111-8111-111111111111`,
    groupId: "55555555-5555-4555-8555-555555555555", schoolId: "66666666-6666-4666-8666-666666666666",
    schoolNameEn: "Example University", admissionRouteKey: "standard_route", externalChannelType: "university_portal",
    memberCount: 2, attemptCount: 1, outcome: "unknown", errorCode: "PROVIDER_RESULT_UNKNOWN",
    quarantinedAt: now, retryEligible: false, review: null, ...overrides };
}

function fixture(overrides = {}) {
  const calls = [], audits = [];
  const repository = {
    async listQuarantinedDeliveries(input) { calls.push({ method: "list", input });
      return { authorized: true, cursorFound: true, rows: [row(1), row(2), row(3)] }; },
    async claimReview(input) { calls.push({ method: "claim", input }); return { authorized: true, value: review() }; },
    async escalateReview(input) { calls.push({ method: "escalate", input }); return { authorized: true,
      value: review({ revision: 2, status: "escalated", escalationCode: input.code,
        escalationReference: input.reference, escalatedAt: now }) }; },
    async closeReview(input) { calls.push({ method: "close", input }); return { authorized: true,
      value: review({ revision: input.expectedRevision + 1, status: "closed_no_retry",
        ...(input.expectedRevision === 2 ? { escalationCode: "provider_receipt_investigation",
          escalationReference: input.reference, escalatedAt: now } : {}),
        resolvedByUserId: input.actorUserId, resolutionCode: input.code,
        resolutionReference: input.reference, resolvedAt: now }) }; },
    async approveRetry(input) { calls.push({ method: "retry", input }); return { authorized: true,
      value: review({ sourceOutcome: "attempt_limit", sourceErrorCode: "ATTEMPT_LIMIT", sourceAttemptCount: 5,
        revision: 2, status: "retry_approved", resolvedByUserId: input.actorUserId,
        resolutionCode: input.code, resolutionReference: input.reference, resolvedAt: now }) }; },
    ...overrides,
  };
  return { calls, audits, service: new OpsRoutingReviewService(repository,
    { async record(event) { audits.push(event); } }) };
}

test("Ops routing review lists only a bounded operational projection with metadata-only audit", async () => {
  const { service, calls, audits } = fixture();
  const result = await service.listQuarantinedDeliveries(context(), { limit: 2 });
  assert.equal(result.items.length, 2);
  assert.equal(result.nextCursor, row(2).outboxId);
  assert.deepEqual(calls[0].input, { actorUserId: assigneeId, activeRole: "cuac_ops",
    beforeOutboxId: null, limit: 3 });
  assert.deepEqual(audits[0].metadata, { itemCount: 2, hasCursor: false, hasNextPage: true });
  assert.doesNotMatch(JSON.stringify(audits[0]), /schoolName|groupId|payload|providerReceipt|student|cuacId/i);
});

test("Ops routing review supports dual-control close and the sole bounded retry approval", async () => {
  const first = fixture();
  await first.service.claimReview(context(), outboxId, { expectedRevision: 0 });
  await first.service.escalateReview(context(), outboxId, { expectedRevision: 1,
    code: "provider_receipt_investigation", reference: "PROVIDER:CASE-42" });
  const admin = context({ actorUserId: adminId, activeRole: "cuac_admin", authStrength: "step_up" });
  assert.equal((await first.service.closeReview(admin, outboxId, { expectedRevision: 2,
    code: "provider_acceptance_uncertain_no_retry", reference: "PROVIDER:CASE-42" })).status, "closed_no_retry");
  assert.deepEqual(first.calls.map(call => call.method), ["claim", "escalate", "close"]);

  const second = fixture();
  assert.equal((await second.service.approveRetry(admin, outboxId, { expectedRevision: 1,
    code: "provider_not_accepted_retry_approved", reference: "DELIVERY:RETRY-1" })).status, "retry_approved");
  assert.equal(second.audits[0].action, "ops.routing_review.retry_approved");
  assert.doesNotMatch(JSON.stringify(second.audits[0].metadata),
    /payloadSha256|providerName|providerReceipt|schoolId|groupId/i);
});

test("Ops routing review rejects other personas, ordinary admin resolution and forged authority", async () => {
  for (const candidate of [
    context({ actorUserId: null }), context({ activeRole: "student", selectedSurface: "student" }),
    context({ purpose: "billing_review" }), context({ tenantSchoolId: outboxId }),
    context({ authStrength: "guest" }),
  ]) {
    const current = fixture();
    await assert.rejects(current.service.listQuarantinedDeliveries(candidate), error => error.status === 403);
    assert.deepEqual(current.calls, []);
  }
  for (const method of ["closeReview", "approveRetry"]) {
    const current = fixture();
    await assert.rejects(current.service[method](context({ actorUserId: adminId, activeRole: "cuac_admin" }),
      outboxId, { expectedRevision: 1, code: method === "closeReview"
        ? "payload_rebuild_required_no_retry" : "provider_not_accepted_retry_approved", reference: "CASE:1" }),
    error => error.status === 403);
    assert.deepEqual(current.calls, []);
  }
});

test("Ops routing review fails closed on stale, unauthorized and corrupt routing state", async () => {
  const forged = fixture();
  await assert.rejects(forged.service.claimReview(context(), outboxId,
    { expectedRevision: 0, providerName: "forged" }), error => error.status === 400);
  assert.deepEqual(forged.calls, []);

  const unauthorized = fixture({ async claimReview() { return { authorized: false }; } });
  await assert.rejects(unauthorized.service.claimReview(context(), outboxId,
    { expectedRevision: 0 }), error => error.status === 403);
  const stale = fixture({ async claimReview() { return { authorized: true, value: null }; } });
  await assert.rejects(stale.service.claimReview(context(), outboxId,
    { expectedRevision: 0 }), error => error.status === 409);

  for (const corruptRow of [
    row(1, { outcome: "attempt_limit", errorCode: "ATTEMPT_LIMIT", attemptCount: 4 }),
    row(1, { retryEligible: true }),
    row(1, { admissionRouteKey: "Invalid Route" }),
    row(1, { review: review({ status: "escalated", revision: 2 }) }),
    row(1, { review: review({ status: "retry_approved", revision: 2, resolvedByUserId: adminId,
      resolutionCode: "provider_not_accepted_retry_approved", resolutionReference: "CASE:1", resolvedAt: now }) }),
  ]) {
    const current = fixture({ async listQuarantinedDeliveries() {
      return { authorized: true, cursorFound: true, rows: [corruptRow] }; } });
    await assert.rejects(current.service.listQuarantinedDeliveries(context()), error => error.status === 503);
    assert.deepEqual(current.audits, []);
  }
});
