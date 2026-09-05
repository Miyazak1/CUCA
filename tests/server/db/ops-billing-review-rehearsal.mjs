import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PostgresAuditWriter } from "../../../src/server/audit/postgres-writer.ts";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { transactionalMethod } from "../../../src/server/db/transactional-method.ts";
import { PostgresOpsBillingReviewRepository } from "../../../src/server/ops-billing-review/postgres-repository.ts";
import { OpsBillingReviewService } from "../../../src/server/ops-billing-review/service.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { createAuditFailureFixture } from "./audit-failure-fixture.mjs";
import { grantCuacStaffAccess } from "./cuac-staff-access-fixture.mjs";
import { checkoutFixture, ingestAndProcess, providerEvent } from "./payment-provider-reconciliation-rehearsal.mjs";

export async function runOpsBillingReviewRehearsal(t, pool) {
  const client = createTransactionalSqlClient(pool);
  const createService = transaction => new OpsBillingReviewService(
    new PostgresOpsBillingReviewRepository(transaction), new PostgresAuditWriter(transaction));
  const api = Object.fromEntries(["listQuarantinedEvents", "claimReview", "escalateReview", "resolveReview"].map(method => [
    method, transactionalMethod(client, createService, method),
  ]));

  await t.test("Ops billing review claims escalates and closes with dual control without changing payment facts", async () => {
    const fixture = await quarantinedEvent(pool);
    const assignee = await createStaff(pool, "cuac_ops"), resolver = await createStaff(pool, "cuac_admin");
    const assigneeContext = billingContext(assignee.userId, "cuac_ops", "session");
    const resolverSession = billingContext(resolver.userId, "cuac_admin", "session");
    const resolverStepUp = billingContext(resolver.userId, "cuac_admin", "step_up");
    const before = await paymentFacts(pool, fixture);

    const queue = await api.listQuarantinedEvents(assigneeContext, { limit: 10 });
    const item = queue.items.find(candidate => candidate.eventId === fixture.eventRowId);
    assert.ok(item);
    assert.equal(item.review, null);
    assert.equal(item.quarantineReason, "payment_scope_mismatch");
    assert.equal(Object.hasOwn(item, "payloadSha256"), false);
    assert.equal(Object.hasOwn(item, "providerPaymentId"), false);
    assert.equal(Object.hasOwn(item, "providerCheckoutSessionId"), false);

    const claimed = await api.claimReview(assigneeContext, fixture.eventRowId, { expectedRevision: 0 });
    assert.equal(claimed.status, "investigating");
    const escalated = await api.escalateReview(assigneeContext, fixture.eventRowId, { expectedRevision: 1,
      code: "provider_investigation_required", reference: "PROVIDER:CASE-0042" });
    assert.equal(escalated.status, "escalated");
    await assert.rejects(api.resolveReview(resolverSession, fixture.eventRowId, { expectedRevision: 2,
      code: "provider_confirmed_no_change", reference: "PROVIDER:CASE-0042" }), error => error.status === 403);
    const resolved = await api.resolveReview(resolverStepUp, fixture.eventRowId, { expectedRevision: 2,
      code: "provider_confirmed_no_change", reference: "PROVIDER:CASE-0042" });
    assert.equal(resolved.status, "resolved_no_change");
    assert.equal(resolved.revision, 3);
    assert.equal(resolved.resolvedByUserId, resolver.userId);
    assert.notEqual(resolved.assignedUserId, resolved.resolvedByUserId);
    assert.deepEqual(await paymentFacts(pool, fixture), before);

    const audits = (await pool.query(`select action,actor_user_id,active_role,metadata_json
      from audit_logs where resource_id = $1 and action like 'ops.billing_review.%' order by created_at,id`,
    [fixture.eventRowId])).rows;
    assert.deepEqual(audits.map(row => row.action), ["ops.billing_review.claim",
      "ops.billing_review.escalate", "ops.billing_review.resolve_no_change"]);
    assert.equal(audits.at(-1).active_role, "cuac_admin");
    assert.doesNotMatch(JSON.stringify(audits), new RegExp(`${fixture.providerEvent.providerPaymentId}|${fixture.providerSessionId}`, "i"));
  });

  await t.test("Ops billing review concurrent claim has one winner and revoked grants cannot continue", async () => {
    const fixture = await quarantinedEvent(pool);
    const first = await createStaff(pool, "cuac_ops"), second = await createStaff(pool, "cuac_ops");
    const results = await Promise.allSettled([
      api.claimReview(billingContext(first.userId, "cuac_ops", "session"), fixture.eventRowId, { expectedRevision: 0 }),
      api.claimReview(billingContext(second.userId, "cuac_ops", "session"), fixture.eventRowId, { expectedRevision: 0 }),
    ]);
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(results.filter(result => result.status === "rejected" && result.reason.status === 409).length, 1);
    const winner = results.find(result => result.status === "fulfilled").value;
    const winnerStaff = winner.assignedUserId === first.userId ? first : second;
    await pool.query("update cuac_staff_access_grants set status = 'revoked', revoked_at = clock_timestamp() where id = $1",
      [winnerStaff.grantId]);
    await assert.rejects(api.escalateReview(billingContext(winnerStaff.userId, "cuac_ops", "session"),
      fixture.eventRowId, { expectedRevision: 1, code: "finance_approval_required", reference: "FINANCE:1" }),
    error => error.status === 403);
    assert.equal((await pool.query("select status,revision from ops_payment_event_reviews where payment_provider_event_id = $1",
      [fixture.eventRowId])).rows[0].revision, 1);
  });

  await t.test("Ops billing review audit failures roll back workflow changes and database constraints reject bypass", async () => {
    const fixture = await quarantinedEvent(pool);
    const assignee = await createStaff(pool, "cuac_admin"), resolver = await createStaff(pool, "cuac_admin");
    const assigneeContext = billingContext(assignee.userId, "cuac_admin", "step_up");
    const resolverContext = billingContext(resolver.userId, "cuac_admin", "step_up");
    const fault = await createAuditFailureFixture(pool);
    try {
      await assert.rejects(fault.during("ops.billing_review.claim", () => api.claimReview(assigneeContext,
        fixture.eventRowId, { expectedRevision: 0 })), error => error.code === "P0001");
      assert.equal((await pool.query("select count(*)::int as total from ops_payment_event_reviews where payment_provider_event_id = $1",
        [fixture.eventRowId])).rows[0].total, 0);
      await api.claimReview(assigneeContext, fixture.eventRowId, { expectedRevision: 0 });
      await assert.rejects(fault.during("ops.billing_review.resolve_no_change", () => api.resolveReview(resolverContext,
        fixture.eventRowId, { expectedRevision: 1, code: "invalid_event_no_change", reference: "CASE:ROLLBACK" })),
      error => error.code === "P0001");
      assert.deepEqual((await pool.query("select status,revision,resolved_at from ops_payment_event_reviews where payment_provider_event_id = $1",
        [fixture.eventRowId])).rows[0], { status: "investigating", revision: 1, resolved_at: null });
    } finally { await fault.close(); }

    await assert.rejects(pool.query(`update ops_payment_event_reviews set status = 'resolved_no_change', revision = 2,
      resolved_by_user_id = assigned_user_id, resolved_by_grant_id = assigned_grant_id, resolved_by_role = 'cuac_admin',
      resolution_code = 'invalid_event_no_change', resolution_reference = 'BYPASS:1', resolved_at = now(), updated_at = now()
      where payment_provider_event_id = $1`, [fixture.eventRowId]),
    error => error.code === "23514" && error.constraint === "ops_payment_event_reviews_lifecycle_check");
  });
}

async function quarantinedEvent(pool) {
  const checkout = await checkoutFixture(pool);
  const providerEventValue = providerEvent(checkout, "payment.succeeded", { amountMinor: 80001 });
  assert.equal((await ingestAndProcess(checkout.events, providerEventValue)).state, "quarantined");
  const event = (await pool.query("select id from payment_provider_events where provider_event_id = $1",
    [providerEventValue.eventId])).rows[0];
  return { ...checkout, eventRowId: event.id, providerEvent: providerEventValue };
}

async function createStaff(pool, role) {
  const email = `ops-billing-review-${randomUUID()}@example.invalid`;
  const user = (await pool.query("insert into users (email,email_normalized) values ($1,$1) returning id", [email])).rows[0];
  await pool.query("insert into user_roles (user_id,role) values ($1,$2)", [user.id, role]);
  const grant = await grantCuacStaffAccess(pool, user.id, role);
  return { userId: user.id, grantId: grant.grantId };
}

function billingContext(actorUserId, activeRole, authStrength) {
  return createRequestContext({ actorUserId, activeRole, authStrength, selectedSurface: "ops", purpose: "billing_review" });
}

async function paymentFacts(pool, fixture) {
  return {
    payment: (await pool.query("select status,provider_payment_id,paid_at,canceled_at,refunded_at from payments where id = $1",
      [fixture.paymentId])).rows[0],
    invoice: (await pool.query("select status,finalized_at,voided_at from invoices where id = $1", [fixture.invoiceId])).rows[0],
    providerEvent: (await pool.query("select state,outcome,quarantine_reason,processed_at from payment_provider_events where id = $1",
      [fixture.eventRowId])).rows[0],
    entitlements: (await pool.query("select count(*)::int as total from application_fee_entitlements where payment_id = $1",
      [fixture.paymentId])).rows[0].total,
  };
}
