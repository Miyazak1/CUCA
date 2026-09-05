import assert from "node:assert/strict";
import test from "node:test";
import {
  PAYMENT_PROVIDER_EVENT_FORMAT,
  parsePaymentProviderEvent,
  paymentPayloadSha256,
} from "../../../src/server/billing/provider-contract.ts";

const value = {
  format: PAYMENT_PROVIDER_EVENT_FORMAT,
  eventId: "evt:accepted.1",
  eventType: "payment.succeeded",
  invoiceId: "00000000-0000-4000-8000-000000000001",
  providerCheckoutSessionId: "checkout:1",
  providerPaymentId: "payment:1",
  amountMinor: 80000,
  currency: "CNY",
  occurredAt: "2026-09-02T00:00:00.000Z",
};

test("payment provider event parser accepts only the exact reviewed identity and money contract", () => {
  const serialized = JSON.stringify(value);
  const event = parsePaymentProviderEvent(serialized);
  assert.equal(event.eventId, value.eventId);
  assert.equal(event.occurredAt.toISOString(), value.occurredAt);
  assert.match(paymentPayloadSha256(serialized), /^[a-f0-9]{64}$/);
  assert.throws(() => parsePaymentProviderEvent(JSON.stringify({ ...value, cardNumber: "4111111111111111" })),
    error => error.status === 400);
  assert.throws(() => parsePaymentProviderEvent(JSON.stringify({ ...value, providerPaymentId: null })),
    error => error.status === 400);
});

test("canceled events may omit a payment reference but preserve invoice and checkout scope", () => {
  const event = parsePaymentProviderEvent(JSON.stringify({
    ...value, eventType: "payment.canceled", providerPaymentId: null,
  }));
  assert.equal(event.eventType, "payment.canceled");
  assert.equal(event.providerPaymentId, null);
});
