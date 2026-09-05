import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  NOTIFICATION_EMAIL_PROVIDER_ALIYUN_SMTP,
  createNotificationWorkerConfigurationFromEnv,
  runNotificationWorker,
} from "../../../src/server/notifications/runtime/worker.ts";

const enabled = {
  CUAC_NOTIFICATION_EMAIL_PROVIDER: NOTIFICATION_EMAIL_PROVIDER_ALIYUN_SMTP,
  CUAC_NOTIFICATION_EMAIL_FROM: "no-reply@example.invalid",
  CUAC_PUBLIC_APP_URL: "https://cuac.example.invalid",
  CUAC_NOTIFICATION_EMAIL_SMTP_REGION: "cn-hangzhou",
  CUAC_NOTIFICATION_EMAIL_SMTP_USERNAME: "no-reply@example.invalid",
  CUAC_NOTIFICATION_EMAIL_SMTP_PASSWORD: "PRIVATE_SMTP_PASSWORD",
};

test("notification runtime is explicit and rejects disabled or unreviewed providers", () => {
  for (const provider of [undefined, "disabled", "smtp", "aliyun", "reviewed-provider-placeholder"]) {
    assert.throws(() => createNotificationWorkerConfigurationFromEnv(
      provider === undefined ? {} : { CUAC_NOTIFICATION_EMAIL_PROVIDER: provider },
    ), /reviewed Aliyun/);
  }
});

test("notification runtime parses exact provider and bounded worker timing", () => {
  const config = createNotificationWorkerConfigurationFromEnv({
    ...enabled, CUAC_NOTIFICATION_WORKER_POLL_MS: "250", CUAC_NOTIFICATION_WORKER_RECOVERY_MS: "300000",
  });
  assert.deepEqual(config.email, {
    from: enabled.CUAC_NOTIFICATION_EMAIL_FROM,
    publicAppUrl: enabled.CUAC_PUBLIC_APP_URL,
    region: enabled.CUAC_NOTIFICATION_EMAIL_SMTP_REGION,
    username: enabled.CUAC_NOTIFICATION_EMAIL_SMTP_USERNAME,
    password: enabled.CUAC_NOTIFICATION_EMAIL_SMTP_PASSWORD,
  });
  assert.equal(config.pollIntervalMs, 250);
  assert.equal(config.recoveryIntervalMs, 300000);
});

test("notification runtime rejects malformed protected configuration without echoing it", () => {
  const invalid = [
    { CUAC_NOTIFICATION_EMAIL_SMTP_REGION: "arbitrary-host.example.invalid" },
    { CUAC_NOTIFICATION_EMAIL_SMTP_PASSWORD: "" },
    { CUAC_NOTIFICATION_EMAIL_SMTP_PASSWORD: "PRIVATE\nBROKEN" },
    { CUAC_NOTIFICATION_WORKER_POLL_MS: "249" },
    { CUAC_NOTIFICATION_WORKER_RECOVERY_MS: "300001" },
  ];
  for (const patch of invalid) {
    assert.throws(() => createNotificationWorkerConfigurationFromEnv({ ...enabled, ...patch }), error => {
      const serialized = `${error.message} ${JSON.stringify(error)}`;
      assert.equal(serialized.includes("PRIVATE_SMTP_PASSWORD"), false);
      assert.equal(serialized.includes("PRIVATE\nBROKEN"), false);
      return error.status === 503;
    });
  }
});

test("notification worker recovers leases, drains a bounded batch and stops through AbortSignal", async () => {
  const controller = new AbortController();
  const statuses = ["skipped", "accepted", "not_accepted", "unknown", "unconfirmed", "idle"];
  const events = [];
  let recoveries = 0;
  const config = createNotificationWorkerConfigurationFromEnv(enabled);
  const summary = await runNotificationWorker({
    queue: { async recover(limit) { assert.equal(limit, 100); recoveries++; return { recovered: 2 }; } },
    provider: {}, config, signal: controller.signal,
  }, {
    now: () => 1000,
    processOne: async () => ({ status: statuses.shift() }),
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
    { event: "notification_worker.recovery", recovered: 2 },
    { event: "notification_worker.batch", processed: 5 },
  ]);
});

test("notification worker propagates database failures and package wiring stays explicit", async () => {
  let waited = 0;
  const config = createNotificationWorkerConfigurationFromEnv(enabled);
  await assert.rejects(runNotificationWorker({
    queue: { async recover() { throw new Error("PRIVATE_DATABASE_URL"); } },
    provider: {}, config, signal: new AbortController().signal,
  }, { wait: async () => { waited++; } }), /PRIVATE_DATABASE_URL/);
  assert.equal(waited, 0);

  const packageJson = JSON.parse(await readFile(new URL("../../../package.json", import.meta.url), "utf8"));
  assert.equal(packageJson.scripts["start:notification-worker"], "node scripts/start-notification-worker.ts");
  const entry = await readFile(new URL("../../../scripts/start-notification-worker.ts", import.meta.url), "utf8");
  assert.match(entry, /applicationName: "cuac:notification-worker"/);
  assert.match(entry, /process\.once\("SIGTERM"/);
  assert.doesNotMatch(entry, /console\.(log|error)\([^\n]*(PASSWORD|DATABASE_URL)/);
});
