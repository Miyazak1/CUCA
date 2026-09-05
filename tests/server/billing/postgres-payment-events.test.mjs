import assert from "node:assert/strict";
import test from "node:test";
import { PostgresPaymentProviderEvents } from "../../../src/server/index.ts";

const occurredAt = new Date("2026-09-02T00:00:00.000Z");
const event = {
  format: "cuac.payment-event.v1",
  eventId: "evt:success.1",
  eventType: "payment.succeeded",
  invoiceId: "00000000-0000-4000-8000-000000000001",
  providerCheckoutSessionId: "checkout:1",
  providerPaymentId: "payment:1",
  amountMinor: 80000,
  currency: "CNY",
  occurredAt,
};

function row(overrides = {}) {
  return { id: "00000000-0000-4000-8000-000000000002", provider: "cuac_hosted_gateway_v1",
    providerEventId: event.eventId, eventType: event.eventType, payloadSha256: "a".repeat(64),
    invoiceId: event.invoiceId, paymentId: null, providerCheckoutSessionId: event.providerCheckoutSessionId,
    providerPaymentId: event.providerPaymentId, amountMinor: event.amountMinor, currency: event.currency,
    occurredAt, state: "pending", outcome: null, attemptCount: 0, receivedAt: occurredAt, ...overrides };
}

test("payment event inbox uses fixed SQL and detects changed-content replay", async () => {
  const calls = [];
  const client = { async transaction(work) { return work(client); }, async query(statement, params) {
    calls.push({ statement, params });
    if (/insert into payment_provider_events/.test(statement)) return [row()];
    return [];
  } };
  const events = new PostgresPaymentProviderEvents(client);
  const result = await events.ingest(event, "a".repeat(64));
  assert.equal(result.state, "pending");
  assert.match(calls[0].statement, /on conflict \(provider, provider_event_id\) do nothing/);
  assert.doesNotMatch(calls[0].statement, /card|cvv|bank|raw_payload/i);

  const replayClient = { async transaction(work) { return work(replayClient); }, async query(statement) {
    return /insert into/.test(statement) ? [] : [row({ payloadSha256: "b".repeat(64) })];
  } };
  await assert.rejects(new PostgresPaymentProviderEvents(replayClient).ingest(event, "a".repeat(64)),
    error => error.status === 409);
});

test("payment event processor defers a valid event while checkout persistence is racing", async () => {
  const calls = [];
  const client = { async transaction(work) { return work(client); }, async query(statement, params) {
    calls.push({ statement, params });
    if (/from payment_provider_events where/.test(statement)) return [row()];
    if (/from payments p join invoices/.test(statement)) return [];
    if (/select transaction_timestamp/.test(statement)) return [{ now: new Date("2026-09-02T00:00:01.000Z") }];
    if (/update payment_provider_events set attempt_count/.test(statement)) return [{
      id: row().id, providerEventId: event.eventId, state: "pending", outcome: null,
    }];
    return [];
  } };
  const result = await new PostgresPaymentProviderEvents(client).process(event.eventId);
  assert.equal(result.state, "pending");
  assert.match(calls.at(-1).statement, /next_attempt_at/);
  assert.equal(calls.at(-1).params[1], 1);
});
