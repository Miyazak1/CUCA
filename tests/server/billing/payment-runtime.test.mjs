import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import {
  CUAC_HOSTED_PAYMENT_PROVIDER,
  createPaymentProviderFromEnv,
  runPaymentReconciliationWorker,
} from "../../../src/server/index.ts";

test("payment runtime is disabled by default and accepts only the reviewed hosted provider", () => {
  assert.equal(createPaymentProviderFromEnv({}), null);
  assert.throws(() => createPaymentProviderFromEnv({ CUAC_PAYMENT_MODE: "live", CUAC_PAYMENT_PROVIDER: "foreign" }),
    error => error.status === 503);
  const gatewaySecret = randomBytes(32).toString("base64url");
  const webhookSecret = randomBytes(32).toString("base64url");
  const provider = createPaymentProviderFromEnv({
    CUAC_PAYMENT_MODE: "test", CUAC_PAYMENT_PROVIDER: CUAC_HOSTED_PAYMENT_PROVIDER,
    CUAC_PAYMENT_GATEWAY_ENDPOINT: "https://gateway.cuac-services.com/v1/checkout-sessions",
    CUAC_PAYMENT_GATEWAY_ALLOWED_HOST: "gateway.cuac-services.com",
    CUAC_PAYMENT_CHECKOUT_ALLOWED_HOST: "checkout.cuac-services.com",
    CUAC_PAYMENT_GATEWAY_HMAC_SECRET: gatewaySecret, CUAC_PAYMENT_WEBHOOK_SECRET: webhookSecret,
    CUAC_PUBLIC_APP_URL: "https://apply.cuac-services.com",
  });
  assert.equal(provider.provider, CUAC_HOSTED_PAYMENT_PROVIDER);
});

test("payment runtime requires distinct gateway and webhook signing secrets", () => {
  const sharedSecret = randomBytes(32).toString("base64url");
  assert.throws(() => createPaymentProviderFromEnv({
    CUAC_PAYMENT_MODE: "live", CUAC_PAYMENT_PROVIDER: CUAC_HOSTED_PAYMENT_PROVIDER,
    CUAC_PAYMENT_GATEWAY_ENDPOINT: "https://gateway.cuac-services.com/v1/checkout-sessions",
    CUAC_PAYMENT_GATEWAY_ALLOWED_HOST: "gateway.cuac-services.com",
    CUAC_PAYMENT_CHECKOUT_ALLOWED_HOST: "checkout.cuac-services.com",
    CUAC_PAYMENT_GATEWAY_HMAC_SECRET: sharedSecret, CUAC_PAYMENT_WEBHOOK_SECRET: sharedSecret,
    CUAC_PUBLIC_APP_URL: "https://apply.cuac-services.com",
  }), error => error.status === 503);
});

test("reconciliation worker drains bounded due-event batches and stops on abort", async () => {
  const controller = new AbortController();
  let calls = 0;
  const result = await runPaymentReconciliationWorker({
    events: { async processNext() { calls += 1; return calls <= 2 ? { state: "processed" } : null; } },
    config: { pollIntervalMs: 1000 }, signal: controller.signal,
  }, { async wait() { controller.abort(); } });
  assert.deepEqual(result, { processed: 2 });
  assert.equal(calls, 3);
});
