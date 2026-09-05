import assert from "node:assert/strict";
import test from "node:test";
import { createRequestContext, OpsBillingReviewService } from "../../../src/server/index.ts";

const eventId = "11111111-1111-4111-8111-111111111111";
const reviewId = "22222222-2222-4222-8222-222222222222";
const assigneeId = "33333333-3333-4333-8333-333333333333";
const adminId = "44444444-4444-4444-8444-444444444444";
const now = new Date("2026-09-03T03:00:00.000Z");

function context(overrides = {}) {
  return createRequestContext({ actorUserId: assigneeId, activeRole: "cuac_ops", selectedSurface: "ops",
    purpose: "billing_review", authStrength: "session", ...overrides });
}

function review(overrides = {}) {
  return { reviewId, revision: 1, status: "investigating", assignedUserId: assigneeId, assignedRole: "cuac_ops",
    escalationCode: null, escalationReference: null, escalatedAt: null, resolvedByUserId: null,
    resolutionCode: null, resolutionReference: null, resolvedAt: null, createdAt: now, updatedAt: now, ...overrides };
}

function row(index, overrides = {}) {
  return { eventId: `${String(index).padStart(8, "0")}-1111-4111-8111-111111111111`, provider: "cuac_hosted_gateway_v1",
    providerEventId: `provider-event-${index}`, eventType: "payment.succeeded",
    invoiceId: "55555555-5555-4555-8555-555555555555", paymentId: "66666666-6666-4666-8666-666666666666",
    amountMinor: 80000, currency: "CNY", occurredAt: now, receivedAt: now,
    quarantineReason: "payment_scope_mismatch", quarantinedAt: now, review: null, ...overrides };
}

function fixture(overrides = {}) {
  const calls = [], audits = [];
  const repository = {
    async listQuarantinedEvents(input) { calls.push({ method: "list", input }); return { authorized: true, cursorFound: true,
      rows: [row(1), row(2), row(3)] }; },
    async claimReview(input) { calls.push({ method: "claim", input }); return { authorized: true, value: review() }; },
    async escalateReview(input) { calls.push({ method: "escalate", input }); return { authorized: true,
      value: review({ revision: 2, status: "escalated", escalationCode: input.code,
        escalationReference: input.reference, escalatedAt: now }) }; },
    async resolveReview(input) { calls.push({ method: "resolve", input }); return { authorized: true,
      value: review({ revision: input.expectedRevision + 1, status: "resolved_no_change", resolvedByUserId: input.actorUserId,
        ...(input.expectedRevision === 2 ? { escalationCode: "provider_investigation_required",
          escalationReference: input.reference, escalatedAt: now } : {}),
        resolutionCode: input.code, resolutionReference: input.reference, resolvedAt: now }) }; },
    ...overrides,
  };
  return { calls, audits, service: new OpsBillingReviewService(repository, { async record(event) { audits.push(event); } }) };
}

test("Ops billing review lists a bounded quarantine projection with stable cursor and metadata-only audit", async () => {
  const { service, calls, audits } = fixture();
  const result = await service.listQuarantinedEvents(context(), { limit: 2 });
  assert.equal(result.items.length, 2);
  assert.equal(result.nextCursor, row(2).eventId);
  assert.deepEqual(calls[0].input, { actorUserId: assigneeId, activeRole: "cuac_ops", beforeEventId: null, limit: 3 });
  assert.equal(audits[0].action, "ops.billing_review.list");
  assert.deepEqual(audits[0].metadata, { itemCount: 2, hasCursor: false, hasNextPage: true });
  assert.doesNotMatch(JSON.stringify(audits[0]), /provider-event|invoiceId|paymentId|amountMinor/);
});

test("Ops billing review claims and escalates while only a different step-up admin may close without payment mutation", async () => {
  const { service, calls, audits } = fixture();
  assert.equal((await service.claimReview(context(), eventId, { expectedRevision: 0 })).status, "investigating");
  assert.equal((await service.escalateReview(context(), eventId, { expectedRevision: 1,
    code: "provider_investigation_required", reference: "PROVIDER:CASE-42" })).status, "escalated");
  const admin = context({ actorUserId: adminId, activeRole: "cuac_admin", authStrength: "step_up" });
  assert.equal((await service.resolveReview(admin, eventId, { expectedRevision: 2,
    code: "provider_confirmed_no_change", reference: "PROVIDER:CASE-42" })).status, "resolved_no_change");
  assert.deepEqual(calls.map(call => call.method), ["claim", "escalate", "resolve"]);
  assert.deepEqual(audits.map(audit => audit.action), [
    "ops.billing_review.claim", "ops.billing_review.escalate", "ops.billing_review.resolve_no_change",
  ]);
  assert.doesNotMatch(JSON.stringify(calls), /paymentStatus|invoiceStatus|entitlement|providerPayload/);
});

test("Ops billing review denies invalid personas and ordinary admin resolution before repository access", async () => {
  for (const candidate of [
    context({ actorUserId: null }), context({ activeRole: "student", selectedSurface: "student" }),
    context({ purpose: "ops_monitoring" }), context({ tenantSchoolId: eventId }),
    context({ dataClassAllowlist: ["ops_confidential", "audit_security"] }),
  ]) {
    const { service, calls } = fixture();
    await assert.rejects(service.listQuarantinedEvents(candidate), error => error.status === 403);
    assert.deepEqual(calls, []);
  }
  const ordinaryAdmin = fixture();
  await assert.rejects(ordinaryAdmin.service.resolveReview(context({ actorUserId: adminId, activeRole: "cuac_admin" }),
    eventId, { expectedRevision: 1, code: "invalid_event_no_change", reference: "CASE:1" }), error => error.status === 403);
  assert.deepEqual(ordinaryAdmin.calls, []);
});

test("Ops billing review rejects forged fields malformed evidence stale state and corrupt rows", async () => {
  for (const input of [
    { expectedRevision: 0, paymentStatus: "succeeded" },
    { expectedRevision: 0, activeRole: "cuac_admin" },
  ]) {
    const { service, calls } = fixture();
    await assert.rejects(service.claimReview(context(), eventId, input), error => error.status === 400);
    assert.deepEqual(calls, []);
  }
  const stale = fixture({ async claimReview() { return { authorized: true, value: null }; } });
  await assert.rejects(stale.service.claimReview(context(), eventId, { expectedRevision: 0 }), error => error.status === 409);
  const corrupt = fixture({ async listQuarantinedEvents() { return { authorized: true, cursorFound: true,
    rows: [row(1, { amountMinor: -1 })] }; } });
  await assert.rejects(corrupt.service.listQuarantinedEvents(context()), error => error.status === 503);
  assert.deepEqual(corrupt.audits, []);

  for (const corruptRow of [
    row(1, { provider: "unknown_provider" }),
    row(1, { providerEventId: "provider event with spaces" }),
    row(1, { quarantineReason: "unknown_reason" }),
    row(1, { review: review({ status: "escalated", revision: 2 }) }),
    row(1, { review: review({ status: "resolved_no_change", revision: 2, resolvedByUserId: assigneeId,
      resolutionCode: "invalid_event_no_change", resolutionReference: "CASE:1", resolvedAt: now }) }),
  ]) {
    const invalid = fixture({ async listQuarantinedEvents() { return { authorized: true, cursorFound: true,
      rows: [corruptRow] }; } });
    await assert.rejects(invalid.service.listQuarantinedEvents(context()), error => error.status === 503);
    assert.deepEqual(invalid.audits, []);
  }
});
