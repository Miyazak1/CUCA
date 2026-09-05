import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { serviceUnavailable } from "../shared/errors.ts";
import { publicApiOrigin } from "../shared/http-config.ts";
import type { HostedCheckoutProvider } from "./postgres-repository.ts";
import {
  CUAC_HOSTED_PAYMENT_PROVIDER,
  HOSTED_CHECKOUT_REQUEST_FORMAT,
  HOSTED_CHECKOUT_RESPONSE_FORMAT,
} from "./provider-contract.ts";

export type HostedPaymentGatewayConfig = {
  endpoint: string;
  allowedHost: string;
  checkoutAllowedHost: string;
  publicOrigin: string;
  hmacSecret: Uint8Array;
  timeoutMs: number;
};

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export function createHostedPaymentGateway(
  input: HostedPaymentGatewayConfig,
  dependencies: { fetch?: FetchLike; now?: () => Date } = {},
): HostedCheckoutProvider {
  const config = validateConfig(input);
  const fetcher = dependencies.fetch ?? fetch;
  const now = dependencies.now ?? (() => new Date());
  return {
    provider: CUAC_HOSTED_PAYMENT_PROVIDER,
    async createCheckoutSession(request) {
      const successUrl = returnUrl(config.publicOrigin, request.successReturnPath);
      const cancelUrl = returnUrl(config.publicOrigin, request.cancelReturnPath);
      const payload = JSON.stringify({
        format: HOSTED_CHECKOUT_REQUEST_FORMAT,
        invoiceId: request.invoiceId,
        amountMinor: request.amountMinor,
        currency: request.currency,
        successUrl,
        cancelUrl,
        metadata: request.metadata,
      });
      const payloadSha256 = createHash("sha256").update(payload).digest("hex");
      const timestamp = now().toISOString();
      const signature = sign(config.secret, JSON.stringify(["cuac-hosted-checkout-request", 1, "POST",
        config.endpoint.pathname, timestamp, request.idempotencyKey, request.invoiceId, payloadSha256]));
      let response: Response;
      try {
        response = await fetcher(config.endpoint, {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(config.timeoutMs),
          headers: {
            "content-type": "application/json; charset=utf-8",
            "x-cuac-payment-format": HOSTED_CHECKOUT_REQUEST_FORMAT,
            "x-cuac-idempotency-key": request.idempotencyKey,
            "x-cuac-invoice-id": request.invoiceId,
            "x-cuac-payload-sha256": payloadSha256,
            "x-cuac-timestamp": timestamp,
            "x-cuac-signature": `v1=${signature}`,
          },
          body: payload,
        });
      } catch { throw unavailable(); }
      if (response.status !== 200 || !/^application\/json(?:;|$)/i.test(response.headers.get("content-type") ?? "")) {
        throw unavailable();
      }
      const body = await readBoundedBody(response, 8_192);
      const responseDigest = createHash("sha256").update(body).digest("hex");
      const expectedSignature = sign(config.secret, JSON.stringify(["cuac-hosted-checkout-response", 1,
        request.idempotencyKey, request.invoiceId, payloadSha256, responseDigest]));
      const suppliedSignature = response.headers.get("x-cuac-response-signature");
      if (!suppliedSignature || !constantTimeEqual(suppliedSignature, `v1=${expectedSignature}`)) throw unavailable();
      return parseResponse(body, request, config.checkoutAllowedHost);
    },
  };
}

export function hostedPaymentGatewayConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): HostedPaymentGatewayConfig {
  const rawSecret = required(env.CUAC_PAYMENT_GATEWAY_HMAC_SECRET);
  if (!/^[A-Za-z0-9_-]{43,86}$/.test(rawSecret)) throw unavailable();
  const hmacSecret = Buffer.from(rawSecret, "base64url");
  if (hmacSecret.byteLength < 32 || hmacSecret.byteLength > 64 || hmacSecret.toString("base64url") !== rawSecret) {
    throw unavailable();
  }
  return {
    endpoint: required(env.CUAC_PAYMENT_GATEWAY_ENDPOINT),
    allowedHost: required(env.CUAC_PAYMENT_GATEWAY_ALLOWED_HOST).toLowerCase(),
    checkoutAllowedHost: required(env.CUAC_PAYMENT_CHECKOUT_ALLOWED_HOST).toLowerCase(),
    publicOrigin: publicApiOrigin(env),
    hmacSecret,
    timeoutMs: boundedInteger(env.CUAC_PAYMENT_GATEWAY_TIMEOUT_MS, 1_000, 30_000, 10_000),
  };
}

function validateConfig(input: HostedPaymentGatewayConfig) {
  let endpoint: URL;
  let origin: URL;
  try { endpoint = new URL(input.endpoint); origin = new URL(input.publicOrigin); } catch { throw unavailable(); }
  const allowedHost = validPublicHost(input.allowedHost);
  const checkoutAllowedHost = validPublicHost(input.checkoutAllowedHost);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash
    || (endpoint.port && endpoint.port !== "443") || endpoint.hostname.toLowerCase() !== allowedHost
    || endpoint.pathname.length < 2 || endpoint.pathname.length > 512
    || origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/"
    || origin.search || origin.hash || !(input.hmacSecret instanceof Uint8Array)
    || input.hmacSecret.byteLength < 32 || input.hmacSecret.byteLength > 64
    || !Number.isSafeInteger(input.timeoutMs) || input.timeoutMs < 1_000 || input.timeoutMs > 30_000) throw unavailable();
  return { endpoint, allowedHost, checkoutAllowedHost, publicOrigin: origin.origin,
    secret: Buffer.from(input.hmacSecret), timeoutMs: input.timeoutMs };
}

function parseResponse(body: string, request: Parameters<HostedCheckoutProvider["createCheckoutSession"]>[0],
  checkoutAllowedHost: string) {
  let value: unknown;
  try { value = JSON.parse(body); } catch { throw unavailable(); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw unavailable();
  const data = value as Record<string, unknown>;
  if (Object.keys(data).sort().join(",") !== ["amountMinor", "checkoutUrl", "currency", "format", "invoiceId",
    "providerCheckoutSessionId", "providerName"].sort().join(",")
    || data.format !== HOSTED_CHECKOUT_RESPONSE_FORMAT || data.providerName !== CUAC_HOSTED_PAYMENT_PROVIDER
    || data.invoiceId !== request.invoiceId || data.amountMinor !== request.amountMinor || data.currency !== request.currency
    || typeof data.providerCheckoutSessionId !== "string" || data.providerCheckoutSessionId.length < 1
    || data.providerCheckoutSessionId.length > 256 || /[\u0000-\u001f\u007f]/.test(data.providerCheckoutSessionId)
    || typeof data.checkoutUrl !== "string") throw unavailable();
  let checkoutUrl: URL;
  try { checkoutUrl = new URL(data.checkoutUrl); } catch { throw unavailable(); }
  if (checkoutUrl.protocol !== "https:" || checkoutUrl.username || checkoutUrl.password
    || (checkoutUrl.port && checkoutUrl.port !== "443")
    || checkoutUrl.hostname.toLowerCase() !== checkoutAllowedHost) throw unavailable();
  return { providerCheckoutSessionId: data.providerCheckoutSessionId, checkoutUrl: checkoutUrl.toString() };
}

async function readBoundedBody(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) throw unavailable();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw unavailable();
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = Buffer.concat(chunks, total);
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (Buffer.byteLength(text, "utf8") !== total) throw unavailable();
  return text;
}

function returnUrl(publicOrigin: string, path: string): string {
  const url = new URL(path, publicOrigin);
  if (url.origin !== publicOrigin) throw unavailable();
  return url.toString();
}

function sign(secret: Uint8Array, value: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function constantTimeEqual(left: string, right: string) {
  const a = Buffer.from(left, "ascii"), b = Buffer.from(right, "ascii");
  return a.length === b.length && timingSafeEqual(a, b);
}

function validPublicHost(value: string): string {
  const host = value.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}\.)+[a-z]{2,63}$/.test(host)
    || /(^|\.)(localhost|local|internal|test|invalid|example)$/i.test(host)) throw unavailable();
  return host;
}

function boundedInteger(value: string | undefined, minimum: number, maximum: number, fallback: number) {
  if (value === undefined || value === "") return fallback;
  if (!/^\d+$/.test(value)) throw unavailable();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) throw unavailable();
  return parsed;
}

function required(value: string | undefined): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 4_096
    || /[\u0000-\u001f\u007f]/.test(value)) throw unavailable();
  return value;
}

function unavailable() {
  return serviceUnavailable("Hosted payment gateway is unavailable.");
}
