import assert from "node:assert/strict";
import test from "node:test";
import { PostgresOpsRoutingReviewRepository } from "../../../src/server/index.ts";

const authority = { grantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  actorUserId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", activeRole: "cuac_ops",
  expiresAt: new Date("2026-09-04T00:00:00Z") };
const outboxId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const groupId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const quarantinedAt = new Date("2026-09-03T00:00:00Z");

function review(overrides = {}) {
  return { reviewId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", sourceOutcome: "attempt_limit",
    sourceErrorCode: "ATTEMPT_LIMIT", sourceAttemptCount: 5, sourceQuarantinedAt: quarantinedAt,
    revision: 1, status: "investigating", assignedUserId: authority.actorUserId, assignedRole: "cuac_ops",
    escalationCode: null, escalationReference: null, escalatedAt: null, resolvedByUserId: null,
    resolutionCode: null, resolutionReference: null, resolvedAt: null,
    createdAt: quarantinedAt, updatedAt: quarantinedAt, ...overrides };
}

function fakeClient(responder) {
  const calls = [];
  const client = { async transaction(work) { return work(client); },
    async query(statement, params) { calls.push({ statement, params }); return responder(statement, params, calls.length); } };
  return { calls, client };
}

test("Postgres routing queue rechecks live authority and excludes sensitive delivery material", async () => {
  const { calls, client } = fakeClient(statement => /from users u/.test(statement) ? [authority] : []);
  assert.deepEqual(await new PostgresOpsRoutingReviewRepository(client).listQuarantinedDeliveries({
    actorUserId: authority.actorUserId, activeRole: "cuac_ops", beforeOutboxId: null, limit: 21,
  }), { authorized: true, cursorFound: true, rows: [] });
  assert.match(calls[0].statement, /for share of u, r, g/);
  assert.match(calls[1].statement, /o\.status = 'quarantined'/);
  assert.match(calls[1].statement, /g\.transport_status = 'quarantined'/);
  assert.doesNotMatch(calls[1].statement,
    /provider_name|payload_sha256|provider_receipt|application_choice_id|student_user_id|cuac_id/i);
});

test("Postgres routing review claim snapshots only supported quarantine generations", async () => {
  const current = review({ sourceOutcome: "unknown", sourceErrorCode: "PROVIDER_RESULT_UNKNOWN", sourceAttemptCount: 1 });
  const { calls, client } = fakeClient(statement => /from users u/.test(statement) ? [authority]
    : /insert into ops_submission_delivery_reviews/.test(statement) ? [current] : []);
  assert.deepEqual(await new PostgresOpsRoutingReviewRepository(client).claimReview({
    actorUserId: authority.actorUserId, activeRole: "cuac_ops", outboxId,
  }), { authorized: true, value: current });
  assert.match(calls[1].statement, /o\.outcome = 'attempt_limit'/);
  assert.match(calls[1].statement, /o\.outcome = 'invalid_payload'/);
  assert.match(calls[1].statement, /o\.outcome = 'unknown'/);
  assert.match(calls[1].statement,
    /on conflict \(official_submission_outbox_id, source_quarantined_at\) do nothing/);
  assert.deepEqual(calls[1].params.slice(1), [authority.actorUserId, authority.grantId, "cuac_ops"]);
});

test("Postgres retry approval is limited to explicit exhausted rejection and preserves delivery binding", async () => {
  const adminAuthority = { ...authority, actorUserId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    activeRole: "cuac_admin" };
  const resolved = review({ revision: 2, status: "retry_approved", resolvedByUserId: adminAuthority.actorUserId,
    resolutionCode: "provider_not_accepted_retry_approved", resolutionReference: "CASE:1", resolvedAt: quarantinedAt });
  const { calls, client } = fakeClient(statement => {
    if (/from users u/.test(statement)) return [adminAuthority];
    if (/from official_submission_outbox o where/.test(statement)) return [{ groupId, outcome: "attempt_limit",
      errorCode: "ATTEMPT_LIMIT", attemptCount: 5, quarantinedAt }];
    if (/select id from official_submission_groups/.test(statement)) return [{ id: groupId }];
    if (/update ops_submission_delivery_reviews/.test(statement)) return [resolved];
    if (/update official_submission_outbox/.test(statement)) return [{ id: outboxId }];
    if (/update official_submission_groups/.test(statement)) return [{ id: groupId }];
    return [];
  });
  assert.deepEqual(await new PostgresOpsRoutingReviewRepository(client).approveRetry({
    actorUserId: adminAuthority.actorUserId, activeRole: "cuac_admin", outboxId, expectedRevision: 1,
    code: "provider_not_accepted_retry_approved", reference: "CASE:1",
  }), { authorized: true, value: resolved });
  const source = calls.find(call => /from official_submission_outbox o where/.test(call.statement)).statement;
  assert.match(source, /outcome = 'attempt_limit'/);
  assert.match(source, /last_error_code = 'ATTEMPT_LIMIT'/);
  assert.match(source, /attempt_count = 5/);
  assert.match(source, /not exists \(select 1 from official_submission_delivery_receipts/);
  assert.match(source, /prior\.status = 'retry_approved'/);
  const outboxUpdate = calls.find(call => /update official_submission_outbox/.test(call.statement)).statement;
  assert.match(outboxUpdate, /status = 'pending'/);
  assert.match(outboxUpdate, /attempt_count = 0/);
  assert.match(outboxUpdate, /last_error_code = 'OPS_RETRY_APPROVED'/);
  assert.doesNotMatch(outboxUpdate, /provider_name\s*=|payload_sha256\s*=/i);
});

test("Postgres routing review does not inspect delivery state after staff grant revocation", async () => {
  const { calls, client } = fakeClient(() => []);
  assert.deepEqual(await new PostgresOpsRoutingReviewRepository(client).claimReview({
    actorUserId: authority.actorUserId, activeRole: "cuac_ops", outboxId,
  }), { authorized: false });
  assert.equal(calls.length, 1);
});
