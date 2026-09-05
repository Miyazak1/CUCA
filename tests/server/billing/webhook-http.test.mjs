import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import test from "node:test";
import {
  PAYMENT_PROVIDER_EVENT_FORMAT,
  createPaymentWebhookHandler,
  paymentPayloadSha256,
  paymentWebhookSignatureBinding,
} from "../../../src/server/index.ts";

const secret = randomBytes(32);
const now = new Date("2026-09-02T00:00:00.000Z");
const event = {
  format: PAYMENT_PROVIDER_EVENT_FORMAT,
  eventId: "evt:success.1",
  eventType: "payment.succeeded",
  invoiceId: "00000000-0000-4000-8000-000000000001",
  providerCheckoutSessionId: "checkout:1",
  providerPaymentId: "payment:1",
  amountMinor: 80000,
  currency: "CNY",
  occurredAt: now.toISOString(),
};

function request(body, signature = true, timestamp = now.toISOString()) {
  const digest = paymentPayloadSha256(body);
  const binding = paymentWebhookSignatureBinding("/api/v1/billing/provider-events", timestamp, digest);
  const value = createHmac("sha256", secret).update(binding).digest("hex");
  return new Request("https://apply.cuac-services.com/api/v1/billing/provider-events", {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-cuac-payment-timestamp": timestamp,
      "x-cuac-payment-signature": signature ? `v1=${value}` : `v1=${"0".repeat(64)}`,
    },
    body,
  });
}

test("signed webhook stores raw-body digest before processing and returns a bounded receipt", async () => {
  const calls = [];
  const handler = createPaymentWebhookHandler({
    async ingest(value, digest) {
      calls.push({ action: "ingest", value, digest });
      return { id: "inbox-1", providerEventId: value.eventId, state: "pending", outcome: null };
    },
    async process(eventId) {
      calls.push({ action: "process", eventId });
      return { id: "inbox-1", providerEventId: eventId, state: "processed", outcome: "applied_succeeded" };
    },
  }, { hmacSecret: secret, maxClockSkewMs: 300000 }, { now: () => now });
  const body = JSON.stringify(event);
  const response = await handler(request(body));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, {
    providerEventId: event.eventId, state: "processed", outcome: "applied_succeeded",
  });
  assert.equal(calls[0].digest, paymentPayloadSha256(body));
  assert.equal(calls[1].eventId, event.eventId);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("unsigned, stale and contract-invalid webhooks are rejected before storage", async () => {
  let calls = 0;
  const handler = createPaymentWebhookHandler({
    async ingest() { calls += 1; }, async process() { calls += 1; },
  }, { hmacSecret: secret, maxClockSkewMs: 300000 }, { now: () => now });
  assert.equal((await handler(request(JSON.stringify(event), false))).status, 403);
  assert.equal((await handler(request(JSON.stringify(event), true, "2026-09-01T00:00:00.000Z"))).status, 403);
  assert.equal((await handler(request(JSON.stringify({ ...event, cardNumber: "4111111111111111" })))).status, 400);
  assert.equal(calls, 0);
});
