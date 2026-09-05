import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PostgresAuditWriter } from "../../../src/server/audit/postgres-writer.ts";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { transactionalMethod } from "../../../src/server/db/transactional-method.ts";
import { PostgresOpsRoutingReviewRepository } from "../../../src/server/ops-routing-review/postgres-repository.ts";
import { OpsRoutingReviewService } from "../../../src/server/ops-routing-review/service.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { PostgresOfficialSubmissionOutbox } from "../../../src/server/submission-delivery/postgres-outbox.ts";
import {
  applicationAtomicSubmissionFixture,
  clearApplicationAtomicSubmissions,
} from "./application-atomic-submission-fixture.mjs";
import { createAuditFailureFixture } from "./audit-failure-fixture.mjs";
import { grantCuacStaffAccess } from "./cuac-staff-access-fixture.mjs";

const providerName = "cuac_handoff_gateway_v1";

export async function runOpsRoutingReviewRehearsal(t, pool) {
  await clearApplicationAtomicSubmissions(pool);
  const client = createTransactionalSqlClient(pool);
  const createService = transaction => new OpsRoutingReviewService(
    new PostgresOpsRoutingReviewRepository(transaction), new PostgresAuditWriter(transaction));
  const api = Object.fromEntries([
    "listQuarantinedDeliveries", "claimReview", "escalateReview", "closeReview", "approveRetry",
  ].map(method => [method, transactionalMethod(client, createService, method)]));
  const deliveries = await quarantinedDeliveries(pool);

  try {
  await t.test("Ops routing review closes unknown delivery with dual control and never retries it", async () => {
    const fixture = deliveries.unknown;
    const assignee = await createStaff(pool, "cuac_ops"), resolver = await createStaff(pool, "cuac_admin");
    const assigneeContext = routingContext(assignee.userId, "cuac_ops", "session");
    const resolverSession = routingContext(resolver.userId, "cuac_admin", "session");
    const resolverStepUp = routingContext(resolver.userId, "cuac_admin", "step_up");
    const before = await routingFacts(pool, fixture.lease.id);

    const queue = await api.listQuarantinedDeliveries(assigneeContext, { limit: 10 });
    const item = queue.items.find(candidate => candidate.outboxId === fixture.lease.id);
    assert.ok(item);
    assert.equal(item.outcome, "unknown");
    assert.equal(item.retryEligible, false);
    for (const field of ["providerName", "payloadSha256", "providerReceiptId", "studentUserId", "cuacId"]) {
      assert.equal(Object.hasOwn(item, field), false);
    }

    await api.claimReview(assigneeContext, fixture.lease.id, { expectedRevision: 0 });
    await assert.rejects(api.approveRetry(resolverStepUp, fixture.lease.id, { expectedRevision: 1,
      code: "provider_not_accepted_retry_approved", reference: "CASE:NO-RETRY" }), error => error.status === 409);
    const escalated = await api.escalateReview(assigneeContext, fixture.lease.id, { expectedRevision: 1,
      code: "provider_receipt_investigation", reference: "PROVIDER:UNKNOWN-1" });
    assert.equal(escalated.status, "escalated");
    await assert.rejects(api.closeReview(resolverSession, fixture.lease.id, { expectedRevision: 2,
      code: "provider_acceptance_uncertain_no_retry", reference: "PROVIDER:UNKNOWN-1" }),
    error => error.status === 403);
    const closed = await api.closeReview(resolverStepUp, fixture.lease.id, { expectedRevision: 2,
      code: "provider_acceptance_uncertain_no_retry", reference: "PROVIDER:UNKNOWN-1" });
    assert.equal(closed.status, "closed_no_retry");
    assert.equal(closed.revision, 3);
    assert.notEqual(closed.assignedUserId, closed.resolvedByUserId);
    assert.deepEqual(await routingFacts(pool, fixture.lease.id), before);

    const audits = (await pool.query(`select action,metadata_json from audit_logs
      where resource_id = $1 and action like 'ops.routing_review.%' order by created_at,id`, [fixture.lease.id])).rows;
    assert.deepEqual(audits.map(row => row.action), ["ops.routing_review.claim",
      "ops.routing_review.escalate", "ops.routing_review.close_no_retry"]);
    assert.doesNotMatch(JSON.stringify(audits.map(row => row.metadata_json)),
      /payloadSha256|providerName|providerReceipt|schoolId|groupId|student|cuacId/i);
  });

  await t.test("Ops routing review permits one explicit exhausted retry and reviews its next generation", async () => {
    const fixture = deliveries.attemptLimit;
    const assignee = await createStaff(pool, "cuac_ops"), resolver = await createStaff(pool, "cuac_admin");
    const assigneeContext = routingContext(assignee.userId, "cuac_ops", "session");
    const resolverSession = routingContext(resolver.userId, "cuac_admin", "session");
    const resolverStepUp = routingContext(resolver.userId, "cuac_admin", "step_up");
    const beforeBinding = (await pool.query(`select provider_name,payload_sha256 from official_submission_outbox
      where id = $1`, [fixture.lease.id])).rows[0];

    const queue = await api.listQuarantinedDeliveries(assigneeContext, { limit: 10 });
    assert.equal(queue.items.find(item => item.outboxId === fixture.lease.id).retryEligible, true);
    await api.claimReview(assigneeContext, fixture.lease.id, { expectedRevision: 0 });
    await assert.rejects(api.approveRetry(resolverSession, fixture.lease.id, { expectedRevision: 1,
      code: "provider_not_accepted_retry_approved", reference: "DELIVERY:RETRY-1" }), error => error.status === 403);
    const approved = await api.approveRetry(resolverStepUp, fixture.lease.id, { expectedRevision: 1,
      code: "provider_not_accepted_retry_approved", reference: "DELIVERY:RETRY-1" });
    assert.equal(approved.status, "retry_approved");
    const reset = (await pool.query(`select o.status,o.outcome,o.last_error_code,o.attempt_count,
      o.provider_name,o.payload_sha256,o.completed_at,o.quarantined_at,g.transport_status
      from official_submission_outbox o join official_submission_groups g on g.id = o.group_id
      where o.id = $1`, [fixture.lease.id])).rows[0];
    assert.deepEqual(reset, { status: "pending", outcome: "not_accepted", last_error_code: "OPS_RETRY_APPROVED",
      attempt_count: 0, provider_name: beforeBinding.provider_name, payload_sha256: beforeBinding.payload_sha256,
      completed_at: null, quarantined_at: null, transport_status: "pending" });

    const retryLease = await fixture.outbox.claim();
    assert.equal(retryLease.id, fixture.lease.id);
    const retryJob = await fixture.outbox.prepare(retryLease, providerName);
    assert.equal(retryJob.payloadSha256, beforeBinding.payload_sha256);
    assert.equal(await fixture.outbox.finish(retryLease,
      { status: "unknown", providerName, payloadSha256: retryJob.payloadSha256 }), true);

    const nextQueue = await api.listQuarantinedDeliveries(assigneeContext, { limit: 10 });
    const next = nextQueue.items.find(item => item.outboxId === fixture.lease.id);
    assert.equal(next.review, null);
    assert.equal(next.retryEligible, false);

    const first = await createStaff(pool, "cuac_ops"), second = await createStaff(pool, "cuac_ops");
    const results = await Promise.allSettled([
      api.claimReview(routingContext(first.userId, "cuac_ops", "session"), fixture.lease.id, { expectedRevision: 0 }),
      api.claimReview(routingContext(second.userId, "cuac_ops", "session"), fixture.lease.id, { expectedRevision: 0 }),
    ]);
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(results.filter(result => result.status === "rejected" && result.reason.status === 409).length, 1);
    const nextReview = results.find(result => result.status === "fulfilled").value;
    assert.equal(nextReview.sourceOutcome, "unknown");
    const winnerStaff = nextReview.assignedUserId === first.userId ? first : second;
    await pool.query(`update cuac_staff_access_grants set status = 'revoked', revoked_at = clock_timestamp()
      where id = $1`, [winnerStaff.grantId]);
    await assert.rejects(api.escalateReview(routingContext(winnerStaff.userId, "cuac_ops", "session"),
      fixture.lease.id, { expectedRevision: 1, code: "security_investigation_required", reference: "SECURITY:1" }),
    error => error.status === 403);
    await assert.rejects(api.approveRetry(resolverStepUp, fixture.lease.id, { expectedRevision: 1,
      code: "provider_not_accepted_retry_approved", reference: "DELIVERY:RETRY-2" }), error => error.status === 409);

    const fault = await createAuditFailureFixture(pool);
    try {
      await assert.rejects(fault.during("ops.routing_review.close_no_retry", () => api.closeReview(resolverStepUp,
        fixture.lease.id, { expectedRevision: 1, code: "duplicate_risk_unresolved_no_retry",
          reference: "CASE:ROLLBACK" })), error => error.code === "P0001");
      assert.deepEqual((await pool.query(`select status,revision,resolved_at from ops_submission_delivery_reviews
        where id = $1`, [nextReview.reviewId])).rows[0],
      { status: "investigating", revision: 1, resolved_at: null });
    } finally { await fault.close(); }

    await assert.rejects(pool.query(`update ops_submission_delivery_reviews
      set status = 'retry_approved', resolution_code = 'provider_not_accepted_retry_approved'
      where official_submission_outbox_id = $1`, [deliveries.unknown.lease.id]),
    error => error.code === "23514" && error.constraint === "ops_submission_delivery_reviews_lifecycle_check");
    assert.equal((await api.closeReview(resolverStepUp, fixture.lease.id, { expectedRevision: 1,
      code: "provider_acceptance_uncertain_no_retry", reference: "DELIVERY:FINAL" })).status, "closed_no_retry");
    assert.equal((await pool.query(`select count(*)::int as total from ops_submission_delivery_reviews
      where official_submission_outbox_id = $1`, [fixture.lease.id])).rows[0].total, 2);
    assert.equal((await pool.query(`select count(*)::int as total from ops_submission_delivery_reviews
      where official_submission_outbox_id = $1 and status = 'retry_approved'`, [fixture.lease.id])).rows[0].total, 1);
  });
  } finally {
    await pool.query("delete from ops_submission_delivery_reviews");
    await clearApplicationAtomicSubmissions(pool);
  }
}

async function quarantinedDeliveries(pool) {
  const fixture = await applicationAtomicSubmissionFixture(pool, { formMode: "one_program_per_form" });
  await fixture.submit();
  const outbox = new PostgresOfficialSubmissionOutbox(fixture.client, fixture.cipher);
  const unknown = await quarantineNext(pool, fixture, outbox, "unknown");
  const attemptLimit = await quarantineNext(pool, fixture, outbox, "attempt_limit");
  assert.equal(await outbox.claim(), null);
  return { unknown, attemptLimit };
}

async function quarantineNext(pool, fixture, outbox, mode) {
  const lease = await outbox.claim();
  assert.ok(lease);
  const job = await outbox.prepare(lease, providerName);
  assert.ok(job);
  if (mode === "attempt_limit") {
    await pool.query("update official_submission_outbox set attempt_count = 5 where id = $1 and status = 'sending'",
      [lease.id]);
  }
  assert.equal(await outbox.finish(lease, { status: mode === "unknown" ? "unknown" : "not_accepted",
    providerName, payloadSha256: job.payloadSha256 }), true);
  const expected = mode === "unknown"
    ? { status: "quarantined", outcome: "unknown", last_error_code: "PROVIDER_RESULT_UNKNOWN", attempt_count: 1 }
    : { status: "quarantined", outcome: "attempt_limit", last_error_code: "ATTEMPT_LIMIT", attempt_count: 5 };
  assert.deepEqual((await pool.query(`select status,outcome,last_error_code,attempt_count
    from official_submission_outbox where id = $1`, [lease.id])).rows[0], expected);
  return { fixture, outbox, lease, job };
}

async function createStaff(pool, role) {
  const email = `ops-routing-review-${randomUUID()}@example.invalid`;
  const user = (await pool.query("insert into users (email,email_normalized) values ($1,$1) returning id", [email])).rows[0];
  await pool.query("insert into user_roles (user_id,role) values ($1,$2)", [user.id, role]);
  const grant = await grantCuacStaffAccess(pool, user.id, role);
  return { userId: user.id, grantId: grant.grantId };
}

function routingContext(actorUserId, activeRole, authStrength) {
  return createRequestContext({ actorUserId, activeRole, authStrength,
    selectedSurface: "ops", purpose: "routing_review" });
}

async function routingFacts(pool, outboxId) {
  return {
    outbox: (await pool.query(`select o.status,o.outcome,o.last_error_code,o.attempt_count,
      o.provider_name,o.payload_sha256,o.provider_receipt_id,o.completed_at,o.quarantined_at,
      g.transport_status from official_submission_outbox o join official_submission_groups g on g.id = o.group_id
      where o.id = $1`, [outboxId])).rows[0],
    applications: (await pool.query(`select sa.id,sa.status,sa.submitted_at from school_applications sa
      join official_submission_group_members m on m.school_application_id = sa.id
      join official_submission_outbox o on o.group_id = m.group_id where o.id = $1 order by sa.id`, [outboxId])).rows,
    receiptCount: (await pool.query(`select count(*)::int as total from official_submission_delivery_receipts
      where outbox_id = $1`, [outboxId])).rows[0].total,
  };
}
