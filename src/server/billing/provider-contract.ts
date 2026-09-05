import { createHash } from "node:crypto";
import { badRequest, serviceUnavailable } from "../shared/errors.ts";
import { inputUuid } from "../shared/input.ts";

export const CUAC_HOSTED_PAYMENT_PROVIDER = "cuac_hosted_gateway_v1" as const;
export const HOSTED_CHECKOUT_REQUEST_FORMAT = "cuac.hosted-checkout-request.v1" as const;
export const HOSTED_CHECKOUT_RESPONSE_FORMAT = "cuac.hosted-checkout-response.v1" as const;
export const PAYMENT_PROVIDER_EVENT_FORMAT = "cuac.payment-event.v1" as const;
export const PAYMENT_WEBHOOK_MAX_BYTES = 16 * 1024;

export type PaymentProviderEventType = "payment.succeeded" | "payment.canceled" | "payment.refunded";

export type PaymentProviderEvent = {
  format: typeof PAYMENT_PROVIDER_EVENT_FORMAT;
  eventId: string;
  eventType: PaymentProviderEventType;
  invoiceId: string;
  providerCheckoutSessionId: string;
  providerPaymentId: string | null;
  amountMinor: number;
  currency: string;
  occurredAt: Date;
};

const externalReferencePattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function parsePaymentProviderEvent(serialized: string): PaymentProviderEvent {
  let value: unknown;
  try { value = JSON.parse(serialized); } catch { throw badRequest("Payment event body must be valid JSON."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw badRequest("Payment event must be a JSON object.");
  const data = value as Record<string, unknown>;
  if (Object.keys(data).sort().join(",") !== ["amountMinor", "currency", "eventId", "eventType", "format",
    "invoiceId", "occurredAt", "providerCheckoutSessionId", "providerPaymentId"].sort().join(",")) {
    throw badRequest("Payment event fields do not match the reviewed contract.");
  }
  if (data.format !== PAYMENT_PROVIDER_EVENT_FORMAT || typeof data.eventId !== "string"
    || !externalReferencePattern.test(data.eventId)
    || !["payment.succeeded", "payment.canceled", "payment.refunded"].includes(String(data.eventType))) {
    throw badRequest("Payment event identity is invalid.");
  }
  const invoiceId = inputUuid(data.invoiceId, "Payment event invoice id");
  const providerCheckoutSessionId = externalReference(data.providerCheckoutSessionId, "Payment checkout session id", 256);
  const providerPaymentId = data.providerPaymentId === null ? null
    : externalReference(data.providerPaymentId, "Payment provider payment id", 256);
  if (data.eventType !== "payment.canceled" && providerPaymentId === null) {
    throw badRequest("Successful and refunded payment events require a provider payment reference.");
  }
  if (!Number.isSafeInteger(data.amountMinor) || Number(data.amountMinor) < 0 || Number(data.amountMinor) > 2_147_483_647
    || typeof data.currency !== "string" || !/^[A-Z]{3}$/.test(data.currency)) {
    throw badRequest("Payment event amount is invalid.");
  }
  if (typeof data.occurredAt !== "string") throw badRequest("Payment event occurrence time is invalid.");
  const occurredAt = new Date(data.occurredAt);
  if (!Number.isFinite(occurredAt.getTime()) || occurredAt.toISOString() !== data.occurredAt) {
    throw badRequest("Payment event occurrence time is invalid.");
  }
  return {
    format: PAYMENT_PROVIDER_EVENT_FORMAT,
    eventId: data.eventId,
    eventType: data.eventType as PaymentProviderEventType,
    invoiceId,
    providerCheckoutSessionId,
    providerPaymentId,
    amountMinor: Number(data.amountMinor),
    currency: data.currency,
    occurredAt,
  };
}

export function paymentPayloadSha256(serialized: string): string {
  if (typeof serialized !== "string") throw serviceUnavailable("Payment payload digest input is invalid.");
  return createHash("sha256").update(serialized).digest("hex");
}

export function paymentWebhookSignatureBinding(path: string, timestamp: string, payloadSha256: string): string {
  if (!path.startsWith("/") || path.includes("?") || path.includes("#") || !/^[a-f0-9]{64}$/.test(payloadSha256)) {
    throw serviceUnavailable("Payment webhook signature binding is invalid.");
  }
  return JSON.stringify(["cuac-payment-webhook", 1, "POST", path, timestamp, payloadSha256]);
}

function externalReference(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || value.length < 1 || value.length > maxLength
    || /[\u0000-\u001f\u007f]/.test(value)) throw badRequest(`${field} is invalid.`);
  return value;
}
