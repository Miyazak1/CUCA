import { createHmac, timingSafeEqual } from "node:crypto";
import { serviceUnavailable } from "../shared/errors.ts";
import {
  OFFICIAL_SUBMISSION_RECEIPT_FORMAT,
  validateOfficialSubmissionDeliveryResult,
  validateOfficialSubmissionProviderName,
  type OfficialSubmissionDeliveryResult,
} from "./contract.ts";
import type { OfficialSubmissionProvider } from "./worker.ts";

export const OFFICIAL_SUBMISSION_PROVIDER_HANDOFF_HTTP = "cuac_handoff_gateway_v1";

export type OfficialSubmissionHttpProviderConfig = {
  endpoint: string;
  allowedHost: string;
  hmacSecret: Uint8Array;
};

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export function createOfficialSubmissionHttpProvider(
  input: OfficialSubmissionHttpProviderConfig,
  dependencies: { fetch?: FetchLike; now?: () => Date } = {},
): OfficialSubmissionProvider {
  const config = validateConfig(input);
  const fetcher = dependencies.fetch ?? fetch;
  const now = dependencies.now ?? (() => new Date());
  return {
    name: OFFICIAL_SUBMISSION_PROVIDER_HANDOFF_HTTP,
    async deliver(serialized, options) {
      if (typeof serialized !== "string" || Buffer.byteLength(serialized, "utf8") < 1
        || !/^[a-f0-9]{64}$/.test(options.payloadSha256)
        || !/^official-submission:[a-f0-9-]{36}$/.test(options.idempotencyKey)) throw unavailable();
      const timestamp = now().toISOString();
      const requestSignature = sign(config.secret, requestBinding(config.endpoint.pathname, timestamp,
        options.idempotencyKey, options.payloadSha256));
      const response = await fetcher(config.endpoint, {
        method: "POST",
        redirect: "error",
        signal: options.signal,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "x-cuac-delivery-format": "cuac.official-submission-package.v1",
          "x-cuac-idempotency-key": options.idempotencyKey,
          "x-cuac-payload-sha256": options.payloadSha256,
          "x-cuac-timestamp": timestamp,
          "x-cuac-signature": `v1=${requestSignature}`,
        },
        body: serialized,
      });
      if (response.status !== 200 || !/^application\/json(?:;|$)/i.test(response.headers.get("content-type") ?? "")) {
        throw unavailable();
      }
      const body = await readBoundedBody(response, 8_192);
      const responseDigest = createHmac("sha256", config.secret).update(body).digest("hex");
      const expectedResponseSignature = sign(config.secret,
        JSON.stringify(["cuac-official-submission-response", 1, options.idempotencyKey, options.payloadSha256, responseDigest]));
      const supplied = response.headers.get("x-cuac-response-signature");
      if (!supplied || !constantTimeEqual(supplied, `v1=${expectedResponseSignature}`)) throw unavailable();
      return parseResponse(body, {
        providerName: OFFICIAL_SUBMISSION_PROVIDER_HANDOFF_HTTP,
        payloadSha256: options.payloadSha256,
      });
    },
  };
}

export function officialSubmissionHttpProviderConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): OfficialSubmissionHttpProviderConfig {
  const endpoint = required(env.CUAC_SUBMISSION_DELIVERY_ENDPOINT);
  const allowedHost = required(env.CUAC_SUBMISSION_DELIVERY_ALLOWED_HOST).toLowerCase();
  const rawSecret = required(env.CUAC_SUBMISSION_DELIVERY_HMAC_SECRET);
  if (!/^[A-Za-z0-9_-]{43,86}$/.test(rawSecret)) throw unavailable();
  const hmacSecret = Buffer.from(rawSecret, "base64url");
  if (hmacSecret.byteLength < 32 || hmacSecret.byteLength > 64 || hmacSecret.toString("base64url") !== rawSecret) throw unavailable();
  return { endpoint, allowedHost, hmacSecret };
}

function validateConfig(input: OfficialSubmissionHttpProviderConfig) {
  let endpoint: URL;
  try { endpoint = new URL(input.endpoint); } catch { throw unavailable(); }
  const allowedHost = input.allowedHost.trim().toLowerCase();
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash
    || (endpoint.port && endpoint.port !== "443") || endpoint.hostname.toLowerCase() !== allowedHost
    || !/^[a-z0-9](?:[a-z0-9-]{0,62}\.)+[a-z]{2,63}$/.test(allowedHost)
    || /(^|\.)(localhost|local|internal|test|invalid|example)$/i.test(allowedHost)
    || endpoint.pathname.length < 2 || endpoint.pathname.length > 512
    || !(input.hmacSecret instanceof Uint8Array) || input.hmacSecret.byteLength < 32
    || input.hmacSecret.byteLength > 64) throw unavailable();
  validateOfficialSubmissionProviderName(OFFICIAL_SUBMISSION_PROVIDER_HANDOFF_HTTP);
  return { endpoint, secret: Buffer.from(input.hmacSecret) };
}

function parseResponse(body: string, expected: { providerName: string; payloadSha256: string }) {
  let value: unknown;
  try { value = JSON.parse(body); } catch { throw unavailable(); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw unavailable();
  const data = value as Record<string, unknown>;
  if (data.format !== OFFICIAL_SUBMISSION_RECEIPT_FORMAT || typeof data.status !== "string"
    || data.providerName !== expected.providerName || data.payloadSha256 !== expected.payloadSha256) throw unavailable();
  if (data.status === "accepted") {
    if (Object.keys(data).sort().join(",") !== "format,payloadSha256,providerName,receiptId,receivedAt,status"
      || typeof data.receiptId !== "string" || typeof data.receivedAt !== "string") throw unavailable();
    const receivedAt = new Date(data.receivedAt);
    if (!Number.isFinite(receivedAt.getTime()) || receivedAt.toISOString() !== data.receivedAt) throw unavailable();
    return validateOfficialSubmissionDeliveryResult({ status: "accepted", providerName: expected.providerName,
      payloadSha256: expected.payloadSha256, receiptId: data.receiptId, receivedAt }, expected);
  }
  if (data.status === "not_accepted") {
    if (Object.keys(data).sort().join(",") !== "format,payloadSha256,providerName,status") throw unavailable();
    return validateOfficialSubmissionDeliveryResult({ status: "not_accepted", providerName: expected.providerName,
      payloadSha256: expected.payloadSha256 }, expected);
  }
  throw unavailable();
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
  const text = bytes.toString("utf8");
  if (Buffer.byteLength(text, "utf8") !== total) throw unavailable();
  return text;
}

function requestBinding(path: string, timestamp: string, idempotencyKey: string, payloadSha256: string) {
  return JSON.stringify(["cuac-official-submission-request", 1, "POST", path, timestamp, idempotencyKey, payloadSha256]);
}

function sign(secret: Uint8Array, value: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function constantTimeEqual(left: string, right: string) {
  const a = Buffer.from(left, "ascii"), b = Buffer.from(right, "ascii");
  return a.length === b.length && timingSafeEqual(a, b);
}

function required(value: string | undefined) {
  if (typeof value !== "string" || value.length < 1 || value.length > 4_096
    || Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw unavailable();
  return value;
}

function unavailable() {
  return serviceUnavailable("Official submission handoff provider is unavailable.");
}
