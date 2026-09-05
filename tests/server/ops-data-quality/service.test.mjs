import assert from "node:assert/strict";
import test from "node:test";
import { createRequestContext, OpsDataQualityService } from "../../../src/server/index.ts";

const entityId = "11111111-1111-4111-8111-111111111111";
const evidenceId = "22222222-2222-4222-8222-222222222222";
const reviewId = "33333333-3333-4333-8333-333333333333";
const assigneeId = "44444444-4444-4444-8444-444444444444";
const adminId = "55555555-5555-4555-8555-555555555555";
const sourceAt = new Date("2026-09-03T03:00:00.000Z");
const now = new Date("2026-09-03T03:01:00.000Z");
const due = new Date("2027-03-03T03:01:00.000Z");

function context(overrides = {}) {
  return createRequestContext({ actorUserId: assigneeId, activeRole: "cuac_ops", selectedSurface: "ops",
    purpose: "data_quality_review", authStrength: "session", ...overrides });
}

function review(overrides = {}) {
  return { reviewId, sourceEntityUpdatedAt: sourceAt, sourceEvidenceId: evidenceId,
    sourceEvidenceCapturedAt: sourceAt, sourceIssueCode: "unverified", revision: 1, status: "investigating",
    assignedUserId: assigneeId, assignedRole: "cuac_ops", escalationCode: null, escalationReference: null,
    escalatedAt: null, resolvedByUserId: null, resolutionCode: null, resolutionReference: null,
    resolvedAt: null, reviewDueAt: null, resultEntityUpdatedAt: null, createdAt: now, updatedAt: now,
    ...overrides };
}

function row(index, overrides = {}) {
  return { entityType: "program", entityId: `${String(index).padStart(8, "0")}-1111-4111-8111-111111111111`,
    label: `Program ${index}`, verificationStatus: "unverified", lastVerifiedAt: null, nextReviewDueAt: null,
    entityUpdatedAt: sourceAt, issueCode: "unverified",
    evidence: { evidenceId, sourceUrl: "https://example.edu/catalog", sourceLabel: "Official catalog",
      capturedAt: sourceAt }, review: null, ...overrides };
}

function fixture(overrides = {}) {
  const calls = [], audits = [];
  const repository = {
    async listCandidates(input) { calls.push({ method: "list", input });
      return { authorized: true, cursorFound: true, rows: [row(1), row(2), row(3)] }; },
    async claimReview(input) { calls.push({ method: "claim", input }); return { authorized: true, value: review() }; },
    async escalateReview(input) { calls.push({ method: "escalate", input }); return { authorized: true,
      value: review({ revision: 2, status: "escalated", escalationCode: input.code,
        escalationReference: input.reference, escalatedAt: now }) }; },
    async resolveReview(input) { calls.push({ method: "resolve", input });
      const status = input.code === "source_confirmed" ? "verified"
        : input.code === "source_evidence_required_no_change" ? "closed_no_change" : "disputed";
      return { authorized: true, value: review({ revision: 2, status, resolvedByUserId: input.actorUserId,
        resolutionCode: input.code, resolutionReference: input.reference, resolvedAt: now,
        reviewDueAt: input.reviewDueAt, resultEntityUpdatedAt: status === "closed_no_change" ? sourceAt : now,
        ...(status === "closed_no_change" ? { sourceEvidenceId: null, sourceEvidenceCapturedAt: null,
          sourceIssueCode: "missing_source_evidence" } : {}) }) }; },
    ...overrides,
  };
  return { calls, audits, service: new OpsDataQualityService(repository,
    { async record(event) { audits.push(event); } }) };
}

test("data-quality queue is cursor bounded and audits metadata only", async () => {
  const { service, calls, audits } = fixture();
  const result = await service.listCandidates(context(), { cursorType: "school", cursor: entityId, limit: 2 });
  assert.equal(result.items.length, 2);
  assert.deepEqual(result.nextCursor, { entityType: "program", entityId: row(2).entityId });
  assert.deepEqual(calls[0].input, { actorUserId: assigneeId, activeRole: "cuac_ops",
    cursor: { entityType: "school", entityId }, limit: 3 });
  assert.deepEqual(audits[0].metadata, { itemCount: 2, hasCursor: true, hasNextPage: true });
  assert.doesNotMatch(JSON.stringify(audits[0]), /sourceUrl|sourceLabel|entityId|label|grantId/i);
});

test("data-quality review supports assignee escalation and dual-control verification", async () => {
  const { service, calls, audits } = fixture();
  await service.claimReview(context(), "program", entityId, { expectedRevision: 0 });
  await service.escalateReview(context(), "program", entityId, { expectedRevision: 1,
    code: "source_owner_confirmation_required", reference: "SOURCE:CASE-42" });
  const admin = context({ actorUserId: adminId, activeRole: "cuac_admin", authStrength: "step_up" });
  const result = await service.resolveReview(admin, "program", entityId, { expectedRevision: 1,
    code: "source_confirmed", reference: "SOURCE:CASE-43", reviewDueAt: due.toISOString() });
  assert.equal(result.status, "verified");
  assert.deepEqual(calls.map(call => call.method), ["claim", "escalate", "resolve"]);
  assert.equal(calls[2].input.reviewDueAt.toISOString(), due.toISOString());
  assert.equal(audits[2].action, "ops.data_quality.resolve");
  assert.doesNotMatch(JSON.stringify(audits[2].metadata), /reference|sourceUrl|verifiedBy/i);
});

test("data-quality review rejects forged authority, weak admin resolution and invalid due dates", async () => {
  for (const candidate of [context({ actorUserId: null }), context({ activeRole: "student", selectedSurface: "student" }),
    context({ purpose: "routing_review" }), context({ tenantSchoolId: entityId }), context({ authStrength: "guest" })]) {
    const current = fixture();
    await assert.rejects(current.service.listCandidates(candidate), error => error.status === 403);
    assert.deepEqual(current.calls, []);
  }
  const weak = fixture();
  await assert.rejects(weak.service.resolveReview(context({ actorUserId: adminId, activeRole: "cuac_admin" }),
    "program", entityId, { expectedRevision: 1, code: "source_invalid", reference: "CASE:1" }),
  error => error.status === 403);
  assert.deepEqual(weak.calls, []);
  for (const input of [
    { expectedRevision: 1, code: "source_confirmed", reference: "CASE:1", reviewDueAt: "2027-01-01" },
    { expectedRevision: 1, code: "source_invalid", reference: "CASE:1", reviewDueAt: due.toISOString() },
    { expectedRevision: 1, code: "source_invalid", reference: "free text is forbidden" },
  ]) {
    const current = fixture();
    await assert.rejects(current.service.resolveReview(
      context({ actorUserId: adminId, activeRole: "cuac_admin", authStrength: "step_up" }),
      "program", entityId, input), error => error.status === 400);
    assert.deepEqual(current.calls, []);
  }
});

test("data-quality review fails closed on missing authority, stale state and corrupt projection", async () => {
  const unauthorized = fixture({ async claimReview() { return { authorized: false }; } });
  await assert.rejects(unauthorized.service.claimReview(context(), "program", entityId,
    { expectedRevision: 0 }), error => error.status === 403);
  const stale = fixture({ async claimReview() { return { authorized: true, value: null }; } });
  await assert.rejects(stale.service.claimReview(context(), "program", entityId,
    { expectedRevision: 0 }), error => error.status === 409);
  for (const corrupt of [row(1, { label: "" }), row(1, { issueCode: "missing_source_evidence" }),
    row(1, { evidence: { evidenceId, sourceUrl: "http://unsafe.example", sourceLabel: "Unsafe", capturedAt: now } }),
    row(1, { review: review({ status: "escalated", revision: 2 }) })]) {
    const current = fixture({ async listCandidates() {
      return { authorized: true, cursorFound: true, rows: [corrupt] }; } });
    await assert.rejects(current.service.listCandidates(context()), error => error.status === 503);
    assert.deepEqual(current.audits, []);
  }
});
