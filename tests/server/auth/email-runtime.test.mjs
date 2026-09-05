import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import {
  AUTH_EMAIL_PROVIDER_ALIYUN_SMTP,
  createAuthEmailOutboxCipherFromEnv,
  createAuthEmailWorkerConfigurationFromEnv,
  runAuthEmailWorker,
} from "../../../src/server/auth/runtime/email-delivery.ts";

const key = randomBytes(32).toString("base64url");
const enabled = {
  CUAC_AUTH_EMAIL_DELIVERY_PROVIDER: AUTH_EMAIL_PROVIDER_ALIYUN_SMTP,
  CUAC_AUTH_EMAIL_FROM: "no-reply@example.invalid",
  CUAC_PUBLIC_APP_URL: "https://cuac.example.invalid",
  CUAC_AUTH_EMAIL_VERIFICATION_PATH: "/auth/verify-email",
  CUAC_AUTH_PASSWORD_RESET_PATH: "/auth/reset-password",
  CUAC_AUTH_EMAIL_SMTP_REGION: "cn-hangzhou",
  CUAC_AUTH_EMAIL_SMTP_USERNAME: "no-reply@example.invalid",
  CUAC_AUTH_EMAIL_SMTP_PASSWORD: "PRIVATE_SMTP_PASSWORD",
  CUAC_AUTH_EMAIL_OUTBOX_ACTIVE_KEY_ID: "key-a",
  CUAC_AUTH_EMAIL_OUTBOX_KEYS_JSON: JSON.stringify({ "key-a": key }),
};

test("Auth email runtime remains disabled by default and rejects unreviewed provider names", () => {
  assert.equal(createAuthEmailOutboxCipherFromEnv({}), undefined);
  assert.equal(createAuthEmailOutboxCipherFromEnv({ CUAC_AUTH_EMAIL_DELIVERY_PROVIDER: "disabled" }), undefined);
  for (const provider of ["smtp", "aliyun", "reviewed-provider-placeholder"]) {
    assert.throws(() => createAuthEmailOutboxCipherFromEnv({ CUAC_AUTH_EMAIL_DELIVERY_PROVIDER: provider }), /reviewed Aliyun/);
    assert.throws(() => createAuthEmailWorkerConfigurationFromEnv({ CUAC_AUTH_EMAIL_DELIVERY_PROVIDER: provider }), /reviewed Aliyun/);
  }
});

test("Auth email runtime parses exact delivery config, bounded timing and rotatable encryption keys", () => {
  const config = createAuthEmailWorkerConfigurationFromEnv({ ...enabled, CUAC_AUTH_EMAIL_WORKER_POLL_MS: "250", CUAC_AUTH_EMAIL_WORKER_RECOVERY_MS: "300000" });
  assert.deepEqual(config.delivery, {
    from: "no-reply@example.invalid",
    publicAppUrl: "https://cuac.example.invalid",
    verificationPath: "/auth/verify-email",
    passwordResetPath: "/auth/reset-password",
  });
  assert.equal(config.smtp.region, "cn-hangzhou");
  assert.equal(config.pollIntervalMs, 250);
  assert.equal(config.recoveryIntervalMs, 300000);
  assert.ok(config.cipher);
  assert.ok(createAuthEmailOutboxCipherFromEnv(enabled));
});

test("Auth email runtime rejects missing, malformed and secret-bearing configuration without echoing values", () => {
  const invalid = [
    { CUAC_AUTH_EMAIL_SMTP_REGION: "arbitrary-host.example.invalid" },
    { CUAC_AUTH_EMAIL_SMTP_PASSWORD: "" },
    { CUAC_AUTH_EMAIL_OUTBOX_ACTIVE_KEY_ID: "missing" },
    { CUAC_AUTH_EMAIL_OUTBOX_KEYS_JSON: "PRIVATE_BROKEN_JSON" },
    { CUAC_AUTH_EMAIL_OUTBOX_KEYS_JSON: JSON.stringify({ "key-a": "short" }) },
    { CUAC_AUTH_EMAIL_WORKER_POLL_MS: "249" },
    { CUAC_AUTH_EMAIL_WORKER_RECOVERY_MS: "300001" },
  ];
  for (const patch of invalid) {
    assert.throws(() => createAuthEmailWorkerConfigurationFromEnv({ ...enabled, ...patch }), error => {
      const serialized = `${error.message} ${JSON.stringify(error)}`;
      assert.equal(serialized.includes("PRIVATE_SMTP_PASSWORD"), false);
      assert.equal(serialized.includes("PRIVATE_BROKEN_JSON"), false);
      return error.status === 503;
    });
  }
});

test("Auth email worker recovers leases, drains a bounded batch and stops through AbortSignal", async () => {
  const controller = new AbortController();
  const statuses = ["skipped", "accepted", "not_accepted", "unknown", "unconfirmed", "idle"];
  const events = [];
  let recoveries = 0;
  const config = createAuthEmailWorkerConfigurationFromEnv(enabled);
  const summary = await runAuthEmailWorker({
    outbox: { async recover(limit) { assert.equal(limit, 100); recoveries++; return { recovered: 2 }; } },
    provider: {},
    config,
    signal: controller.signal,
  }, {
    now: () => 1000,
    processOne: async (_outbox, _provider, delivery) => {
      assert.deepEqual(delivery, config.delivery);
      return { status: statuses.shift() };
    },
    wait: async (milliseconds, signal) => {
      assert.equal(milliseconds, 1000);
      assert.equal(signal.aborted, false);
      controller.abort();
    },
    onEvent: event => events.push(event),
  });
  assert.equal(recoveries, 1);
  assert.deepEqual(summary, { recovered: 2, accepted: 1, notAccepted: 1, unknown: 1, skipped: 1, unconfirmed: 1 });
  assert.deepEqual(events, [
    { event: "auth_email_worker.recovery", recovered: 2 },
    { event: "auth_email_worker.batch", processed: 5 },
  ]);
});

test("Auth email worker propagates database failures without logging secrets or spinning", async () => {
  let waited = 0;
  const config = createAuthEmailWorkerConfigurationFromEnv(enabled);
  await assert.rejects(runAuthEmailWorker({
    outbox: { async recover() { throw new Error("PRIVATE_DATABASE_URL"); } },
    provider: {}, config, signal: new AbortController().signal,
  }, { wait: async () => { waited++; } }), /PRIVATE_DATABASE_URL/);
  assert.equal(waited, 0);
});
