import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  CUAC_HOSTED_PAYMENT_PROVIDER,
  PAYMENT_PROVIDER_EVENT_FORMAT,
  PostgresBillingRepository,
  PostgresPaymentProviderEvents,
  createTransactionalSqlClient,
  paymentPayloadSha256,
} from "../../../src/server/index.ts";
import { preflightFixture } from "./application-preflight-fixture.mjs";
import { createAuditFailureFixture, snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";

const feeSchedule = { currency: "CNY", applicationFeeMinor: 80000, serviceFeeMinor: 0 };

export async function runPaymentProviderReconciliationRehearsal(t, pool) {
  await t.test("signed provider success settles once and grants exact per-project entitlement atomically", async () => {
    const f = await checkoutFixture(pool);
    const initialStatus = await f.billing.getCheckoutStatus(f.userId, f.invoiceId);
    assert.equal(initialStatus.status, "requires_payment");
    assert.equal(initialStatus.invoiceStatus, "draft");
    assert.equal(initialStatus.applicationSetId, f.applicationSetId);
    assert.equal(await f.billing.getCheckoutStatus(randomUUID(), f.invoiceId), null);
    const success = providerEvent(f, "payment.succeeded");
    await ingest(f.events, success);
    const [first, second] = await Promise.all([f.events.process(success.eventId), f.events.process(success.eventId)]);
    assert.ok([first, second].every(result => result.state === "processed"));
    assert.ok([first, second].every(result => result.outcome === "applied_succeeded"));
    const duplicate = providerEvent(f, "payment.succeeded", { providerPaymentId: success.providerPaymentId });
    assert.equal((await ingestAndProcess(f.events, duplicate)).outcome, "already_applied");

    const payment = (await pool.query(`select status, provider_payment_id, paid_at, refunded_at
      from payments where id = $1`, [f.paymentId])).rows[0];
    assert.equal(payment.status, "succeeded");
    assert.equal(payment.provider_payment_id, success.providerPaymentId);
    assert.ok(payment.paid_at instanceof Date);
    assert.equal(payment.refunded_at, null);
    const invoice = (await pool.query("select status, finalized_at, voided_at from invoices where id = $1",
      [f.invoiceId])).rows[0];
    assert.equal(invoice.status, "paid");
    assert.ok(invoice.finalized_at instanceof Date);
    assert.equal(invoice.voided_at, null);
    const settledStatus = await f.billing.getCheckoutStatus(f.userId, f.invoiceId);
    assert.equal(settledStatus.status, "succeeded");
    assert.equal(settledStatus.invoiceStatus, "paid");
    assert.ok(settledStatus.paidAt);
    assert.equal((await pool.query(`select count(*)::int as total from payment_status_events
      where payment_id = $1 and to_status = 'succeeded'`, [f.paymentId])).rows[0].total, 1);
    const entitlement = (await pool.query(`select status, application_choice_id, program_id, program_intake_id
      from application_fee_entitlements where payment_id = $1`, [f.paymentId])).rows[0];
    assert.deepEqual(entitlement, { status: "active", application_choice_id: f.choiceId,
      program_id: f.programId, program_intake_id: f.programIntakeId });
    const audits = (await pool.query(`select actor_type, action from audit_logs
      where metadata_json->>'providerEventId' = $1 or metadata_json->>'paymentId' = $2`,
    [success.eventId, f.paymentId])).rows;
    assert.ok(audits.some(row => row.actor_type === "service" && row.action === "billing.payment.succeeded"));
    assert.ok(audits.some(row => row.actor_type === "service"
      && row.action === "billing.application_fee_entitlement.grant"));
    const notifications = (await pool.query(`select e.event_type,e.resource_id,d.channel,d.status,d.title,d.body
      from notification_events e join notification_deliveries d on d.event_id = e.id
      where e.resource_type = 'payment' and e.resource_id = $1 order by d.channel`, [f.paymentId])).rows;
    assert.deepEqual(notifications.map(row => ({ channel: row.channel, status: row.status })), [
      { channel: "email", status: "queued" },
      { channel: "in_app", status: "unread" },
      { channel: "sms", status: "suppressed" },
    ]);
    assert.ok(notifications.every(row => row.event_type === "payment_succeeded"
      && row.resource_id === f.paymentId && row.title === "Payment confirmed"));
    assert.doesNotMatch(JSON.stringify(notifications), /80000|CNY|providerPaymentId|checkout|card|bank/i);

    const replay = await f.events.ingest(success, digest(success));
    assert.equal(replay.state, "processed");
    await assert.rejects(f.events.ingest({ ...success, amountMinor: success.amountMinor + 1 }, digest({
      ...success, amountMinor: success.amountMinor + 1,
    })), error => error.status === 409);
    assert.equal((await pool.query(`select count(*)::int as total from notification_events
      where resource_type = 'payment' and resource_id = $1`, [f.paymentId])).rows[0].total, 1);
  });

  await t.test("refund revokes entitlement while preserving finalized invoice evidence", async () => {
    const f = await checkoutFixture(pool);
    const success = providerEvent(f, "payment.succeeded");
    await ingestAndProcess(f.events, success);
    const refund = providerEvent(f, "payment.refunded", { providerPaymentId: success.providerPaymentId });
    const result = await ingestAndProcess(f.events, refund);
    assert.equal(result.outcome, "applied_refunded");
    const payment = (await pool.query("select status, paid_at, refunded_at from payments where id = $1",
      [f.paymentId])).rows[0];
    assert.equal(payment.status, "refunded");
    assert.ok(payment.paid_at instanceof Date && payment.refunded_at instanceof Date);
    assert.equal((await pool.query("select status from invoices where id = $1", [f.invoiceId])).rows[0].status, "paid");
    const entitlement = (await pool.query(`select status, revoked_at, revocation_reason
      from application_fee_entitlements where payment_id = $1`, [f.paymentId])).rows[0];
    assert.equal(entitlement.status, "revoked");
    assert.ok(entitlement.revoked_at instanceof Date);
    assert.equal(entitlement.revocation_reason, "provider_refund");
    assert.deepEqual((await pool.query(`select event_type from notification_events
      where resource_type = 'payment' and resource_id = $1 order by occurred_at`, [f.paymentId])).rows.map(row => row.event_type),
    ["payment_succeeded", "payment_refunded"]);
  });

  await t.test("refund-before-success stays pending, then reconciles after settlement", async () => {
    const f = await checkoutFixture(pool);
    const providerPaymentId = `payment:${randomUUID()}`;
    const refund = providerEvent(f, "payment.refunded", { providerPaymentId });
    await ingest(f.events, refund);
    assert.equal((await f.events.process(refund.eventId)).state, "pending");
    const success = providerEvent(f, "payment.succeeded", { providerPaymentId });
    await ingestAndProcess(f.events, success);
    const reconciled = await f.events.process(refund.eventId);
    assert.equal(reconciled.outcome, "applied_refunded");
    assert.equal((await pool.query("select status from payments where id = $1", [f.paymentId])).rows[0].status,
      "refunded");
  });

  await t.test("cancellation voids only an unpaid invoice and grants no entitlement", async () => {
    const f = await checkoutFixture(pool);
    const canceled = providerEvent(f, "payment.canceled", { providerPaymentId: null });
    const result = await ingestAndProcess(f.events, canceled);
    assert.equal(result.outcome, "applied_canceled");
    const payment = (await pool.query("select status, canceled_at from payments where id = $1",
      [f.paymentId])).rows[0];
    assert.equal(payment.status, "canceled");
    assert.ok(payment.canceled_at instanceof Date);
    const invoice = (await pool.query("select status, voided_at from invoices where id = $1",
      [f.invoiceId])).rows[0];
    assert.equal(invoice.status, "void");
    assert.ok(invoice.voided_at instanceof Date);
    assert.equal((await pool.query("select count(*)::int as total from application_fee_entitlements where payment_id = $1",
      [f.paymentId])).rows[0].total, 0);
    assert.equal((await pool.query(`select event_type from notification_events
      where resource_type = 'payment' and resource_id = $1`, [f.paymentId])).rows[0].event_type, "payment_canceled");
  });

  await t.test("amount mismatch is quarantined without changing payment or entitlement", async () => {
    const f = await checkoutFixture(pool);
    const mismatched = providerEvent(f, "payment.succeeded", { amountMinor: 80001 });
    const result = await ingestAndProcess(f.events, mismatched);
    assert.equal(result.state, "quarantined");
    assert.equal((await pool.query("select status from payments where id = $1", [f.paymentId])).rows[0].status,
      "requires_payment");
    assert.equal((await pool.query("select status from invoices where id = $1", [f.invoiceId])).rows[0].status, "draft");
    const inbox = (await pool.query(`select quarantine_reason from payment_provider_events
      where provider_event_id = $1`, [mismatched.eventId])).rows[0];
    assert.equal(inbox.quarantine_reason, "payment_scope_mismatch");
    assert.equal((await pool.query("select count(*)::int as total from application_fee_entitlements where payment_id = $1",
      [f.paymentId])).rows[0].total, 0);
  });

  await t.test("payment settlement, entitlement and audit roll back together", async () => {
    const f = await checkoutFixture(pool);
    const success = providerEvent(f, "payment.succeeded");
    await ingest(f.events, success);
    const fault = await createAuditFailureFixture(pool);
    try {
      const before = await snapshotAuditedBusinessTables(pool);
      await assert.rejects(fault.during("billing.payment.succeeded", () => f.events.process(success.eventId)),
        error => error.code === "P0001");
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      await assert.rejects(fault.during("notification.event.created", () => f.events.process(success.eventId)),
        error => error.code === "P0001");
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    } finally { await fault.close(); }
    assert.equal((await pool.query("select status from payments where id = $1", [f.paymentId])).rows[0].status,
      "requires_payment");
    assert.equal((await pool.query("select state from payment_provider_events where provider_event_id = $1",
      [success.eventId])).rows[0].state, "pending");
    assert.equal((await pool.query("select count(*)::int as total from application_fee_entitlements where payment_id = $1",
      [f.paymentId])).rows[0].total, 0);
    assert.equal((await f.events.process(success.eventId)).outcome, "applied_succeeded");
  });

  await t.test("database constraints reject impossible payment and inbox lifecycle rows", async () => {
    const f = await checkoutFixture(pool);
    await assert.rejects(pool.query("update payments set status = 'succeeded' where id = $1", [f.paymentId]),
      error => error.code === "23514" && error.constraint === "payments_lifecycle_check");
    await assert.rejects(pool.query(`insert into payment_provider_events (
      provider, provider_event_id, event_type, payload_sha256, invoice_id, provider_checkout_session_id,
      provider_payment_id, amount_minor, currency, occurred_at, state)
      values ($1,$2,'payment.succeeded',$3,$4,$5,null,80000,'CNY',now(),'pending')`,
    [CUAC_HOSTED_PAYMENT_PROVIDER, `invalid:${randomUUID()}`, "a".repeat(64), f.invoiceId, f.providerSessionId]),
    error => error.code === "23514" && error.constraint === "payment_provider_events_format_check");
    await assert.rejects(pool.query(`insert into payments (
      invoice_id, user_id, provider, provider_checkout_session_id, status, amount_minor, currency, metadata_json)
      values ($1,$2,$3,$4,'requires_payment',80000,'CNY','{}'::jsonb)`,
    [f.invoiceId, f.userId, CUAC_HOSTED_PAYMENT_PROVIDER, `checkout:${randomUUID()}`]),
    error => error.code === "23505" && error.constraint === "payments_invoice_unique");
  });
}

export async function checkoutFixture(pool) {
  const base = await preflightFixture(pool);
  await pool.query("update application_choices set admission_route_key = 'direct_university' where id = $1",
    [base.choice.id]);
  const client = createTransactionalSqlClient(pool);
  const providerSessionId = `checkout:${randomUUID()}`;
  const billing = new PostgresBillingRepository(client, feeSchedule, {
    provider: CUAC_HOSTED_PAYMENT_PROVIDER,
    async createCheckoutSession() {
      return { providerCheckoutSessionId: providerSessionId,
        checkoutUrl: `https://checkout.cuac-services.com/session/${randomUUID()}` };
    },
  });
  const checkout = await billing.createCheckoutIntent(base.userId, {
    applicationSetId: base.set.id,
    applicationChoiceIds: [base.choice.id],
    successReturnPath: "/application.html#paid",
    cancelReturnPath: "/application.html#fee",
  });
  return {
    billing,
    events: new PostgresPaymentProviderEvents(client),
    userId: base.userId,
    applicationSetId: base.set.id,
    invoiceId: checkout.invoiceId,
    paymentId: checkout.checkoutSessionId,
    providerSessionId,
    choiceId: base.choice.id,
    programId: base.catalog.programId,
    programIntakeId: base.catalog.intakeId,
  };
}

export function providerEvent(f, eventType, overrides = {}) {
  return {
    format: PAYMENT_PROVIDER_EVENT_FORMAT,
    eventId: `event:${randomUUID()}`,
    eventType,
    invoiceId: f.invoiceId,
    providerCheckoutSessionId: f.providerSessionId,
    providerPaymentId: eventType === "payment.canceled" ? null : `payment:${randomUUID()}`,
    amountMinor: 80000,
    currency: "CNY",
    occurredAt: new Date(),
    ...overrides,
  };
}

function digest(event) {
  return paymentPayloadSha256(JSON.stringify({ ...event, occurredAt: event.occurredAt.toISOString() }));
}

async function ingest(events, event) {
  return events.ingest(event, digest(event));
}

export async function ingestAndProcess(events, event) {
  await ingest(events, event);
  return events.process(event.eventId);
}
