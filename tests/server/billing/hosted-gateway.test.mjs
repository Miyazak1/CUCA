import assert from "node:assert/strict";
import { createHash, createHmac, randomBytes } from "node:crypto";
import test from "node:test";
import {
  CUAC_HOSTED_PAYMENT_PROVIDER,
  HOSTED_CHECKOUT_RESPONSE_FORMAT,
  createHostedPaymentGateway,
  hostedPaymentGatewayConfigFromEnv,
} from "../../../src/server/index.ts";

const secret = randomBytes(32);
const config = {
  endpoint: "https://gateway.cuac-services.com/v1/checkout-sessions",
  allowedHost: "gateway.cuac-services.com",
  checkoutAllowedHost: "checkout.cuac-services.com",
  publicOrigin: "https://apply.cuac-services.com",
  hmacSecret: secret,
  timeoutMs: 5000,
};

test("hosted gateway signs a fixed endpoint and accepts only a signed, invoice-bound checkout URL", async () => {
  let captured;
  const gateway = createHostedPaymentGateway(config, {
    now: () => new Date("2026-09-02T00:00:00.000Z"),
    async fetch(url, init) {
      captured = { url: String(url), init };
      const body = JSON.stringify({
        format: HOSTED_CHECKOUT_RESPONSE_FORMAT,
        providerName: CUAC_HOSTED_PAYMENT_PROVIDER,
        invoiceId: "00000000-0000-4000-8000-000000000001",
        providerCheckoutSessionId: "checkout:1",
        checkoutUrl: "https://checkout.cuac-services.com/session/checkout%3A1",
        amountMinor: 80000,
        currency: "CNY",
      });
      const requestDigest = createHash("sha256").update(init.body).digest("hex");
      const responseDigest = createHash("sha256").update(body).digest("hex");
      const binding = JSON.stringify(["cuac-hosted-checkout-response", 1, "cuac-checkout:invoice-1",
        "00000000-0000-4000-8000-000000000001", requestDigest, responseDigest]);
      const signature = createHmac("sha256", secret).update(binding).digest("hex");
      return new Response(body, { status: 200, headers: {
        "content-type": "application/json", "x-cuac-response-signature": `v1=${signature}`,
      } });
    },
  });
  const result = await gateway.createCheckoutSession({
    invoiceId: "00000000-0000-4000-8000-000000000001",
    idempotencyKey: "cuac-checkout:invoice-1",
    amountMinor: 80000,
    currency: "CNY",
    successReturnPath: "/application.html#paid",
    cancelReturnPath: "/application.html#fee",
    metadata: { invoiceId: "00000000-0000-4000-8000-000000000001" },
  });
  assert.equal(result.providerCheckoutSessionId, "checkout:1");
  assert.equal(captured.url, config.endpoint);
  assert.match(captured.init.headers["x-cuac-signature"], /^v1=[a-f0-9]{64}$/);
  const requestBody = JSON.parse(captured.init.body);
  assert.equal(requestBody.successUrl, "https://apply.cuac-services.com/application.html#paid");
  assert.doesNotMatch(captured.init.body, /card|cvv|bank/i);
});

test("hosted gateway rejects unsigned responses, arbitrary checkout hosts and unsafe configuration", async () => {
  const request = {
    invoiceId: "00000000-0000-4000-8000-000000000001", idempotencyKey: "cuac-checkout:invoice-1",
    amountMinor: 80000, currency: "CNY", successReturnPath: "/success", cancelReturnPath: "/cancel", metadata: {},
  };
  const body = JSON.stringify({ format: HOSTED_CHECKOUT_RESPONSE_FORMAT, providerName: CUAC_HOSTED_PAYMENT_PROVIDER,
    invoiceId: request.invoiceId, providerCheckoutSessionId: "checkout:1",
    checkoutUrl: "https://foreign.example.org/session/1", amountMinor: 80000, currency: "CNY" });
  const gateway = createHostedPaymentGateway(config, { async fetch() {
    return new Response(body, { status: 200, headers: { "content-type": "application/json",
      "x-cuac-response-signature": `v1=${"0".repeat(64)}` } });
  } });
  await assert.rejects(gateway.createCheckoutSession(request), error => error.status === 503);
  assert.throws(() => createHostedPaymentGateway({ ...config, allowedHost: "other.example.org" }),
    error => error.status === 503);
  const encoded = secret.toString("base64url");
  assert.deepEqual(hostedPaymentGatewayConfigFromEnv({
    CUAC_PAYMENT_GATEWAY_ENDPOINT: config.endpoint,
    CUAC_PAYMENT_GATEWAY_ALLOWED_HOST: config.allowedHost,
    CUAC_PAYMENT_CHECKOUT_ALLOWED_HOST: config.checkoutAllowedHost,
    CUAC_PAYMENT_GATEWAY_HMAC_SECRET: encoded,
    CUAC_PUBLIC_APP_URL: config.publicOrigin,
    CUAC_PAYMENT_GATEWAY_TIMEOUT_MS: "5000",
  }), config);
});
