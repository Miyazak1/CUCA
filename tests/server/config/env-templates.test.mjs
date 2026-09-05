import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseEnv } from "node:util";
import { inspectProductionReadiness } from "../../../src/server/infra/production-readiness.ts";

const requiredKeys = [
  "NODE_ENV",
  "CUAC_ENV",
  "CUAC_REQUIRE_PRODUCTION_READY",
  "CUAC_MIGRATION_TARGET_ENV",
  "CUAC_RELEASE_COMMIT_SHA",
  "CUAC_RELEASE_IMAGE_DIGEST",
  "CUAC_MIGRATION_MANIFEST_SHA256",
  "ALIBABA_CLOUD_REGION",
  "CUAC_APP_RUNTIME",
  "CUAC_SECRET_MANAGER",
  "ALIBABA_CLOUD_KMS_KEY_ID",
  "DATABASE_URL",
  "PGSSLMODE",
  "CUAC_SESSION_SECRET",
  "CUAC_AUTH_RATE_LIMIT_ENFORCED",
  "CUAC_AUTH_RATE_LIMIT_BACKEND",
  "CUAC_AUTH_EMAIL_DELIVERY_PROVIDER",
  "CUAC_AUTH_EMAIL_FROM",
  "CUAC_PUBLIC_APP_URL",
  "CUAC_AUTH_EMAIL_VERIFICATION_PATH",
  "CUAC_AUTH_PASSWORD_RESET_PATH",
  "CUAC_AUTH_EMAIL_SMTP_REGION",
  "CUAC_AUTH_EMAIL_SMTP_USERNAME",
  "CUAC_AUTH_EMAIL_SMTP_PASSWORD",
  "CUAC_AUTH_EMAIL_OUTBOX_ACTIVE_KEY_ID",
  "CUAC_AUTH_EMAIL_OUTBOX_KEYS_JSON",
  "CUAC_AUTH_EMAIL_WORKER_POLL_MS",
  "CUAC_AUTH_EMAIL_WORKER_RECOVERY_MS",
  "CUAC_AUTH_EMAIL_WORKER_SUPERVISED",
  "CUAC_AUTH_EMAIL_STAGING_ACCEPTED",
  "CUAC_NOTIFICATION_EMAIL_PROVIDER",
  "CUAC_NOTIFICATION_EMAIL_FROM",
  "CUAC_NOTIFICATION_EMAIL_SMTP_REGION",
  "CUAC_NOTIFICATION_EMAIL_SMTP_USERNAME",
  "CUAC_NOTIFICATION_EMAIL_SMTP_PASSWORD",
  "CUAC_NOTIFICATION_WORKER_POLL_MS",
  "CUAC_NOTIFICATION_WORKER_RECOVERY_MS",
  "CUAC_NOTIFICATION_WORKER_SUPERVISED",
  "CUAC_NOTIFICATION_STAGING_ACCEPTED",
  "CUAC_MATERIAL_SNAPSHOT_ACTIVE_KEY_ID",
  "CUAC_MATERIAL_SNAPSHOT_KEYRING_JSON",
  "CUAC_SUBMISSION_DELIVERY_PROVIDER",
  "CUAC_SUBMISSION_DELIVERY_ENDPOINT",
  "CUAC_SUBMISSION_DELIVERY_ALLOWED_HOST",
  "CUAC_SUBMISSION_DELIVERY_HMAC_SECRET",
  "CUAC_SUBMISSION_DELIVERY_WORKER_POLL_MS",
  "CUAC_SUBMISSION_DELIVERY_RECOVERY_MS",
  "CUAC_SUBMISSION_DELIVERY_TIMEOUT_MS",
  "CUAC_SUBMISSION_DELIVERY_WORKER_SUPERVISED",
  "CUAC_SUBMISSION_DELIVERY_STAGING_ACCEPTED",
  "CUAC_AGENT_ENABLED",
  "CUAC_AGENT_TOOL_GATEWAY_MODE",
  "CUAC_AGENT_SANDBOX_MODE",
  "CUAC_AGENT_DIRECT_DB_ACCESS",
  "CUAC_APPLICATION_FEE_MINOR",
  "CUAC_SERVICE_FEE_MINOR",
  "CUAC_BILLING_CURRENCY",
  "CUAC_PAYMENT_MODE",
  "CUAC_PAYMENT_PROVIDER",
  "CUAC_PAYMENT_GATEWAY_ENDPOINT",
  "CUAC_PAYMENT_GATEWAY_ALLOWED_HOST",
  "CUAC_PAYMENT_CHECKOUT_ALLOWED_HOST",
  "CUAC_PAYMENT_GATEWAY_HMAC_SECRET",
  "CUAC_PAYMENT_WEBHOOK_SECRET",
  "CUAC_PAYMENT_GATEWAY_TIMEOUT_MS",
  "CUAC_PAYMENT_WEBHOOK_MAX_SKEW_MS",
  "CUAC_PAYMENT_RECONCILIATION_POLL_MS",
  "CUAC_PAYMENT_RECONCILIATION_WORKER_SUPERVISED",
  "CUAC_PAYMENT_STAGING_ACCEPTED",
  "CUAC_FILE_UPLOAD_ENABLED",
  "ALIYUN_OSS_REGION",
  "ALIYUN_OSS_PRIVATE_BUCKET",
  "ALIBABA_CLOUD_ACCESS_KEY_ID",
  "ALIBABA_CLOUD_ACCESS_KEY_SECRET",
  "ALIYUN_OSS_KMS_KEY_ID",
  "CUAC_FILE_MAX_BYTES",
  "CUAC_FILE_UPLOAD_TTL_SECONDS",
  "CUAC_FILE_DOWNLOAD_TTL_SECONDS",
  "CUAC_FILE_RETENTION_DAYS",
  "CUAC_CLAMDSCAN_PATH",
  "CUAC_FILE_WORKER_POLL_MS",
  "CUAC_FILE_WORKER_RECOVERY_MS",
  "CUAC_FILE_WORKER_RETENTION_MS",
  "CUAC_FILE_WORKER_SUPERVISED",
  "CUAC_OSS_VERSIONING_CONFIRMED",
  "CUAC_OSS_LIFECYCLE_CONFIRMED",
  "CUAC_OSS_CORS_CONFIRMED",
  "CUAC_FILE_STAGING_ACCEPTED",
  "CUAC_ALLOW_PRODUCTION_MIGRATION",
  "CUAC_MIGRATION_RUNBOOK_ACK",
];

test("Alibaba Cloud env templates include production readiness and migration gate keys", async () => {
  const templates = await Promise.all(
    ["../../../config/staging.env.example", "../../../config/production.env.example"].map(async (templatePath) => ({
      templatePath,
      values: parseEnvTemplate(await readFile(new URL(templatePath, import.meta.url), "utf8")),
    })),
  );

  templates.forEach(({ templatePath, values }) => {
    requiredKeys.forEach((key) => {
      assert.ok(key in values, `${templatePath} is missing ${key}`);
    });
    assert.match(values.DATABASE_URL, /^postgres:\/\//);
    assert.equal(values.PGSSLMODE, "verify-full");
    assert.equal(values.CUAC_AUTH_RATE_LIMIT_ENFORCED, "true");
    assert.match(values.CUAC_AUTH_RATE_LIMIT_BACKEND, /gateway|waf/);
    assert.equal(values.CUAC_AUTH_EMAIL_DELIVERY_PROVIDER, "disabled");
    assert.equal(values.CUAC_NOTIFICATION_EMAIL_PROVIDER, "disabled");
    assert.equal(values.CUAC_SUBMISSION_DELIVERY_PROVIDER, "disabled");
    assert.equal(values.CUAC_REQUIRE_PRODUCTION_READY, "true");
    assert.match(values.CUAC_AUTH_EMAIL_FROM, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    assert.match(values.CUAC_PUBLIC_APP_URL, /^https:\/\//);
    assert.equal(values.CUAC_AGENT_ENABLED, "false");
    assert.equal(values.CUAC_AGENT_TOOL_GATEWAY_MODE, "disabled");
    assert.equal(values.CUAC_AGENT_SANDBOX_MODE, "disabled");
    assert.equal(values.CUAC_AGENT_DIRECT_DB_ACCESS, "false");
    assert.equal(values.CUAC_FILE_UPLOAD_ENABLED, "false");
    assert.equal(values.ALIYUN_OSS_REGION, `oss-${values.ALIBABA_CLOUD_REGION}`);
    for (const key of ["CUAC_FILE_WORKER_SUPERVISED", "CUAC_OSS_VERSIONING_CONFIRMED",
      "CUAC_OSS_LIFECYCLE_CONFIRMED", "CUAC_OSS_CORS_CONFIRMED", "CUAC_FILE_STAGING_ACCEPTED",
      "CUAC_SUBMISSION_DELIVERY_WORKER_SUPERVISED", "CUAC_SUBMISSION_DELIVERY_STAGING_ACCEPTED",
      "CUAC_PAYMENT_RECONCILIATION_WORKER_SUPERVISED", "CUAC_PAYMENT_STAGING_ACCEPTED",
      "CUAC_NOTIFICATION_WORKER_SUPERVISED", "CUAC_NOTIFICATION_STAGING_ACCEPTED",
      "CUAC_AUTH_EMAIL_WORKER_SUPERVISED", "CUAC_AUTH_EMAIL_STAGING_ACCEPTED"]) {
      assert.equal(values[key], "false");
    }
    assert.equal(values.CUAC_ALLOW_PRODUCTION_MIGRATION, "false");
    assert.equal(values.CUAC_MIGRATION_RUNBOOK_ACK, "false");
    assert.doesNotMatch(values.DATABASE_URL, /localhost|127\.0\.0\.1/i);
  });
});

test("production env template keeps payments disabled pending staging acceptance", async () => {
  const values = parseEnvTemplate(await readFile(new URL("../../../config/production.env.example", import.meta.url), "utf8"));

  assert.equal(values.CUAC_ENV, "production");
  assert.equal(values.CUAC_MIGRATION_TARGET_ENV, "production");
  assert.equal(values.CUAC_REQUIRE_PRODUCTION_READY, "true");
  assert.equal(values.CUAC_PAYMENT_MODE, "disabled");
  assert.equal(values.CUAC_PAYMENT_PROVIDER, "");
  assert.equal(values.CUAC_PAYMENT_GATEWAY_ENDPOINT, "");
  assert.equal(values.CUAC_PAYMENT_WEBHOOK_SECRET, "");
  assert.equal(inspectProductionReadiness(values).ready, false);
});

test("staging env template stays non-live for payment and production migration approval", async () => {
  const values = parseEnvTemplate(await readFile(new URL("../../../config/staging.env.example", import.meta.url), "utf8"));

  assert.equal(values.CUAC_ENV, "staging");
  assert.equal(values.CUAC_MIGRATION_TARGET_ENV, "staging");
  assert.equal(values.CUAC_PAYMENT_MODE, "disabled");
  assert.equal(values.CUAC_PAYMENT_PROVIDER, "");
  assert.equal(values.CUAC_PAYMENT_GATEWAY_ENDPOINT, "");
  assert.equal(values.CUAC_PAYMENT_WEBHOOK_SECRET, "");
  assert.equal(inspectProductionReadiness(values).ready, false);
  assert.equal(values.CUAC_ALLOW_PRODUCTION_MIGRATION, "false");
  assert.equal(values.CUAC_MIGRATION_RUNBOOK_ACK, "false");
});

function parseEnvTemplate(source) {
  return parseEnv(source);
}
