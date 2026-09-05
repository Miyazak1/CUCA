import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import {
  OFFICIAL_SUBMISSION_PROVIDER_HANDOFF_HTTP,
  createOfficialSubmissionHttpProvider,
  officialSubmissionHttpProviderConfigFromEnv,
} from "../../../src/server/submission-delivery/http-provider.ts";

const endpoint = "https://handoff.cuac-services.com/v1/official-submissions";
const secret = randomBytes(32);
const payloadSha256 = "a".repeat(64);
const idempotencyKey = `official-submission:${randomUUID()}`;

function response(body, signature = true) {
  const text = JSON.stringify(body);
  const digest = createHmac("sha256", secret).update(text).digest("hex");
  const binding = JSON.stringify(["cuac-official-submission-response", 1, idempotencyKey, payloadSha256, digest]);
  const value = createHmac("sha256", secret).update(binding).digest("hex");
  return new Response(text, { status: 200, headers: {
    "content-type": "application/json",
    "x-cuac-response-signature": signature ? `v1=${value}` : `v1=${"0".repeat(64)}`,
  } });
}

test("handoff provider signs a fixed endpoint request and accepts only a signed bound receipt", async () => {
  let request;
  const receivedAt = new Date().toISOString();
  const provider = createOfficialSubmissionHttpProvider({ endpoint, allowedHost: "handoff.cuac-services.com", hmacSecret: secret }, {
    now: () => new Date("2026-09-02T00:00:00.000Z"),
    async fetch(url, init) {
      request = { url: String(url), init };
      return response({ format: "cuac.official-submission-receipt.v1", status: "accepted",
        providerName: OFFICIAL_SUBMISSION_PROVIDER_HANDOFF_HTTP, payloadSha256,
        receiptId: "gateway:receipt.1", receivedAt });
    },
  });
  const result = await provider.deliver('{"safe":true}', { idempotencyKey, payloadSha256, signal: new AbortController().signal });
  assert.equal(result.status, "accepted");
  assert.equal(result.receiptId, "gateway:receipt.1");
  assert.equal(request.url, endpoint);
  assert.equal(request.init.redirect, "error");
  assert.equal(request.init.headers["x-cuac-idempotency-key"], idempotencyKey);
  assert.equal(request.init.headers["x-cuac-payload-sha256"], payloadSha256);
  assert.match(request.init.headers["x-cuac-signature"], /^v1=[a-f0-9]{64}$/);
});

test("handoff provider treats unsigned, oversized and non-JSON responses as unavailable", async () => {
  for (const fetcher of [
    async () => response({ format: "cuac.official-submission-receipt.v1", status: "not_accepted",
      providerName: OFFICIAL_SUBMISSION_PROVIDER_HANDOFF_HTTP, payloadSha256 }, false),
    async () => new Response("x".repeat(8_193), { status: 200, headers: { "content-type": "application/json",
      "x-cuac-response-signature": `v1=${"0".repeat(64)}` } }),
    async () => new Response("not-json", { status: 200, headers: { "content-type": "text/plain" } }),
  ]) {
    const provider = createOfficialSubmissionHttpProvider({ endpoint, allowedHost: "handoff.cuac-services.com", hmacSecret: secret }, { fetch: fetcher });
    await assert.rejects(provider.deliver("{}", { idempotencyKey, payloadSha256,
      signal: new AbortController().signal }), error => error.status === 503 && !error.message.includes(secret.toString("hex")));
  }
});

test("handoff provider configuration rejects arbitrary hosts, URL authority and weak secrets", () => {
  for (const config of [
    { endpoint, allowedHost: "other.cuac-services.com", hmacSecret: secret },
    { endpoint: "https://user:secret@handoff.cuac-services.com/v1", allowedHost: "handoff.cuac-services.com", hmacSecret: secret },
    { endpoint: "http://handoff.cuac-services.com/v1", allowedHost: "handoff.cuac-services.com", hmacSecret: secret },
    { endpoint, allowedHost: "handoff.cuac-services.com", hmacSecret: new Uint8Array(16) },
  ]) assert.throws(() => createOfficialSubmissionHttpProvider(config), error => error.status === 503);
  const encoded = secret.toString("base64url");
  assert.deepEqual(officialSubmissionHttpProviderConfigFromEnv({
    CUAC_SUBMISSION_DELIVERY_ENDPOINT: endpoint,
    CUAC_SUBMISSION_DELIVERY_ALLOWED_HOST: "handoff.cuac-services.com",
    CUAC_SUBMISSION_DELIVERY_HMAC_SECRET: encoded,
  }), { endpoint, allowedHost: "handoff.cuac-services.com", hmacSecret: secret });
});
