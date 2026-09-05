import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { getApplicationLifecycle } from "../shared/application-lifecycle.ts";
import { CuacError, badRequest, forbidden, serviceUnavailable, toErrorEnvelope } from "../shared/errors.ts";
import type { PaymentProviderEventResult, PostgresPaymentProviderEvents } from "./postgres-payment-events.ts";
import {
  PAYMENT_WEBHOOK_MAX_BYTES,
  parsePaymentProviderEvent,
  paymentPayloadSha256,
  paymentWebhookSignatureBinding,
} from "./provider-contract.ts";

export type PaymentWebhookConfig = {
  hmacSecret: Uint8Array;
  maxClockSkewMs: number;
};

type PaymentEventProcessor = Pick<PostgresPaymentProviderEvents, "ingest" | "process">;

export function createPaymentWebhookHandler(
  processor: PaymentEventProcessor,
  input: PaymentWebhookConfig,
  dependencies: { now?: () => Date } = {},
) {
  const config = validateConfig(input);
  const now = dependencies.now ?? (() => new Date());
  return async (request: Request): Promise<Response> => {
    const requestId = randomUUID();
    let releaseRequest: (() => void) | undefined;
    let response: Response;
    try {
      releaseRequest = getApplicationLifecycle().enterRequest();
      if (!releaseRequest) throw serviceUnavailable("Application is shutting down.");
      if (request.method !== "POST") throw new CuacError("METHOD_NOT_ALLOWED", "Method is not allowed.", 405);
      const url = new URL(request.url);
      if (url.search || url.hash) throw badRequest("Payment webhook URL must not include query or fragment data.");
      if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") ?? "")
        || ![null, "identity"].includes(request.headers.get("content-encoding"))) {
        throw new CuacError("UNSUPPORTED_MEDIA_TYPE", "Use an uncompressed application/json request body.", 415);
      }
      const timestamp = verifiedTimestamp(request.headers.get("x-cuac-payment-timestamp"), now(), config.maxClockSkewMs);
      const bytes = await readBodyBytes(request, PAYMENT_WEBHOOK_MAX_BYTES);
      const serialized = decodeUtf8(bytes);
      const payloadSha256 = paymentPayloadSha256(serialized);
      verifySignature(config.secret, request.headers.get("x-cuac-payment-signature"),
        paymentWebhookSignatureBinding(url.pathname, timestamp, payloadSha256));
      const event = parsePaymentProviderEvent(serialized);
      const stored = await processor.ingest(event, payloadSha256);
      const result = stored.state === "pending" ? await processor.process(event.eventId) : stored;
      response = paymentResponse(result);
    } catch (error) {
      const status = error instanceof CuacError ? error.status : 500;
      response = Response.json(toErrorEnvelope(error, requestId), { status });
      if (status === 405) response.headers.set("allow", "POST");
    } finally {
      releaseRequest?.();
    }
    return secureResponse(response, requestId);
  };
}

export function paymentWebhookConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): PaymentWebhookConfig {
  const rawSecret = env.CUAC_PAYMENT_WEBHOOK_SECRET;
  if (!rawSecret || !/^[A-Za-z0-9_-]{43,86}$/.test(rawSecret)) throw unavailable();
  const hmacSecret = Buffer.from(rawSecret, "base64url");
  if (hmacSecret.byteLength < 32 || hmacSecret.byteLength > 64 || hmacSecret.toString("base64url") !== rawSecret) {
    throw unavailable();
  }
  return {
    hmacSecret,
    maxClockSkewMs: boundedInteger(env.CUAC_PAYMENT_WEBHOOK_MAX_SKEW_MS, 30_000, 900_000, 300_000),
  };
}

function paymentResponse(result: PaymentProviderEventResult): Response {
  const status = result.state === "pending" ? 202 : 200;
  return Response.json({ data: {
    providerEventId: result.providerEventId,
    state: result.state,
    outcome: result.outcome,
  } }, { status });
}

function secureResponse(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  headers.set("pragma", "no-cache");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-request-id", requestId);
  headers.delete("access-control-allow-origin");
  headers.delete("access-control-allow-credentials");
  return new Response(response.body, { status: response.status, headers });
}

function verifiedTimestamp(value: string | null, now: Date, maxClockSkewMs: number): string {
  if (!value) throw forbidden("Payment webhook signature is invalid.");
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime()) || timestamp.toISOString() !== value
    || Math.abs(now.getTime() - timestamp.getTime()) > maxClockSkewMs) {
    throw forbidden("Payment webhook signature is invalid.");
  }
  return value;
}

function verifySignature(secret: Uint8Array, supplied: string | null, binding: string) {
  const expected = `v1=${createHmac("sha256", secret).update(binding).digest("hex")}`;
  if (!supplied || !constantTimeEqual(supplied, expected)) throw forbidden("Payment webhook signature is invalid.");
}

async function readBodyBytes(request: Request, limit: number): Promise<Uint8Array> {
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit)) {
    throw new CuacError("PAYLOAD_TOO_LARGE", "Payment webhook body is too large.", 413);
  }
  if (!request.body) throw badRequest("Payment webhook body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new CuacError("REQUEST_TIMEOUT", "Payment webhook body timed out.", 408)), 5_000);
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new CuacError("PAYLOAD_TOO_LARGE", "Payment webhook body is too large.", 413);
      chunks.push(value);
    }
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

function decodeUtf8(bytes: Uint8Array): string {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw badRequest("Payment webhook body must be valid UTF-8 JSON."); }
}

function validateConfig(input: PaymentWebhookConfig) {
  if (!(input.hmacSecret instanceof Uint8Array) || input.hmacSecret.byteLength < 32
    || input.hmacSecret.byteLength > 64 || !Number.isSafeInteger(input.maxClockSkewMs)
    || input.maxClockSkewMs < 30_000 || input.maxClockSkewMs > 900_000) throw unavailable();
  return { secret: Buffer.from(input.hmacSecret), maxClockSkewMs: input.maxClockSkewMs };
}

function constantTimeEqual(left: string, right: string) {
  const a = Buffer.from(left, "ascii"), b = Buffer.from(right, "ascii");
  return a.length === b.length && timingSafeEqual(a, b);
}

function boundedInteger(value: string | undefined, minimum: number, maximum: number, fallback: number) {
  if (value === undefined || value === "") return fallback;
  if (!/^\d+$/.test(value)) throw unavailable();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) throw unavailable();
  return parsed;
}

function unavailable() {
  return serviceUnavailable("Payment webhook configuration is unavailable.");
}
