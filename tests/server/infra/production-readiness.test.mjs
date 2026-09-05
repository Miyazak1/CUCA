import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { inspectProductionReadiness } from "../../../src/server/index.ts";

const strongSecret = "0123456789abcdef0123456789abcdef";
const paymentGatewaySecret = Buffer.alloc(32, 19).toString("base64url");
const paymentWebhookSecret = Buffer.alloc(32, 29).toString("base64url");
const submissionSecret = Buffer.alloc(32, 23).toString("base64url");
const materialSnapshotKey = Buffer.alloc(32, 41).toString("base64url");

test("production readiness requires an explicit public origin and rejects placeholder guest signing keys", () => {
  for (const url of [undefined, "http://cuac.test", "https://cuac.test/path", "https://user:secret@cuac.test", "https://cuac.test?token=secret"]) {
    const report = inspectProductionReadiness({ CUAC_ENV: "production", CUAC_PUBLIC_APP_URL: url });
    assert.equal(report.checks.find((check) => check.id === "http.public_origin").status, "fail");
  }
  const report = inspectProductionReadiness({ CUAC_ENV: "production", CUAC_PUBLIC_APP_URL: "https://cuac.test", CUAC_SESSION_SECRET: "replace-with-at-least-32-random-characters" });
  assert.equal(report.checks.find((check) => check.id === "http.public_origin").status, "pass");
  assert.equal(report.checks.find((check) => check.id === "auth.session_secret").status, "fail");
});

test("production readiness rejects Node.js overrides that can bypass code or TLS review", () => {
  for (const [key, value] of [["NODE_OPTIONS", "--import=PRIVATE_MODULE"], ["NODE_PATH", "PRIVATE_PATH"],
    ["NODE_TLS_REJECT_UNAUTHORIZED", "0"]]) {
    const report = inspectProductionReadiness({ NODE_ENV: "production", [key]: value });
    assert.equal(check(report, "deployment.runtime_overrides").status, "fail");
    assert.doesNotMatch(JSON.stringify(report), /PRIVATE_MODULE|PRIVATE_PATH/);
  }
  assert.equal(check(inspectProductionReadiness({ NODE_ENV: "development" }),
    "deployment.runtime_overrides").status, "pass");
});

test("production readiness allows local development to remain warning-only for missing cloud config", () => {
  const report = inspectProductionReadiness({ NODE_ENV: "development" });

  assert.equal(report.environment, "development");
  assert.equal(report.scope, "offline_preflight");
  assert.equal(report.runtimeVerified, false);
  assert.equal(report.gateMode, "advisory");
  assert.equal(report.ready, true);
  assert.equal(report.failures.length, 0);
  assert.match(report.warnings.join("\n"), /PostgreSQL URL is missing/);
});

test("production readiness fails closed for production without PostgreSQL, secrets, an explicit Agent mode, and fee config", () => {
  const report = inspectProductionReadiness({ NODE_ENV: "production" });

  assert.equal(report.environment, "production");
  assert.equal(report.ready, false);
  assert.match(report.failures.join("\n"), /PostgreSQL URL is missing/);
  assert.match(report.failures.join("\n"), /Session secret is missing/);
  assert.match(report.failures.join("\n"), /Auth endpoints must enforce shared rate limiting/);
  assert.match(report.failures.join("\n"), /Auth email delivery is disabled/);
  assert.match(report.failures.join("\n"), /explicitly set CUAC_AGENT_ENABLED/);
  assert.match(report.failures.join("\n"), /Billing fee schedule is missing/);
});

test("core production readiness permits an explicitly disabled Agent but gates every enabled Agent", () => {
  const disabled = inspectProductionReadiness({ NODE_ENV: "production", CUAC_AGENT_ENABLED: "false",
    CUAC_AGENT_DIRECT_DB_ACCESS: "false" });
  assert.equal(disabled.checks.find((entry) => entry.id === "agent.sandbox").status, "pass");

  const enabledWithoutBoundary = inspectProductionReadiness({ NODE_ENV: "production", CUAC_AGENT_ENABLED: "true",
    CUAC_AGENT_DIRECT_DB_ACCESS: "false" });
  assert.equal(enabledWithoutBoundary.checks.find((entry) => entry.id === "agent.sandbox").status, "fail");
  assert.match(enabledWithoutBoundary.failures.join("\n"), /Enabled Agent runtime must use enforced Tool Gateway/);

  const enabledWithBoundary = inspectProductionReadiness({ NODE_ENV: "production", CUAC_AGENT_ENABLED: "true",
    CUAC_AGENT_TOOL_GATEWAY_MODE: "enforced", CUAC_AGENT_SANDBOX_MODE: "enabled", CUAC_AGENT_DIRECT_DB_ACCESS: "false" });
  assert.equal(enabledWithBoundary.checks.find((entry) => entry.id === "agent.sandbox").status, "pass");

  for (const directDbAccess of [undefined, "", "maybe", "0", "off"]) {
    const unsafe = inspectProductionReadiness({
      NODE_ENV: "production",
      CUAC_AGENT_ENABLED: "true",
      CUAC_AGENT_TOOL_GATEWAY_MODE: "enforced",
      CUAC_AGENT_SANDBOX_MODE: "enabled",
      CUAC_AGENT_DIRECT_DB_ACCESS: directDbAccess,
    });
    assert.equal(unsafe.checks.find((entry) => entry.id === "agent.sandbox").status, "fail");
    assert.match(unsafe.failures.join("\n"), /direct database access/);
  }

  const localCore = inspectProductionReadiness({ NODE_ENV: "development" });
  assert.equal(localCore.checks.find((entry) => entry.id === "agent.sandbox").status, "pass");

  for (const value of ["maybe", "1", "yes"]) {
    const invalid = inspectProductionReadiness({ NODE_ENV: "production", CUAC_AGENT_ENABLED: value });
    assert.equal(invalid.checks.find((entry) => entry.id === "agent.sandbox").status, "fail");

    const invalidLocal = inspectProductionReadiness({ NODE_ENV: "development", CUAC_AGENT_ENABLED: value });
    assert.equal(invalidLocal.checks.find((entry) => entry.id === "agent.sandbox").status, "fail");
  }
});

test("Alibaba Cloud configuration alone cannot pass without an Auth email runtime adapter", () => {
  const report = inspectProductionReadiness({
    NODE_ENV: "production",
    DATABASE_URL: "postgres://cuac:secret@pgm-aliyun.rds.aliyuncs.com:5432/cuac",
    PGSSLMODE: "require",
    ALIBABA_CLOUD_REGION: "cn-shanghai",
    CUAC_APP_RUNTIME: "ecs-container",
    CUAC_SESSION_SECRET: strongSecret,
    CUAC_AUTH_RATE_LIMIT_ENFORCED: "true",
    CUAC_AUTH_RATE_LIMIT_BACKEND: "gateway",
    CUAC_AUTH_EMAIL_DELIVERY_PROVIDER: "reviewed-provider-placeholder",
    CUAC_AUTH_EMAIL_FROM: "no-reply@example.com",
    CUAC_PUBLIC_APP_URL: "https://www.example.com",
    CUAC_AGENT_TOOL_GATEWAY_MODE: "enforced",
    CUAC_AGENT_SANDBOX_MODE: "enabled",
    CUAC_APPLICATION_FEE_MINOR: "80000",
    CUAC_SERVICE_FEE_MINOR: "40000",
    CUAC_BILLING_CURRENCY: "CNY",
    CUAC_SECRET_MANAGER: "aliyun-kms",
  });

  assert.equal(report.environment, "production");
  assert.equal(report.gateMode, "required");
  assert.equal(report.ready, false);
  assert.match(report.failures.join("\n"), /runtime adapter is not implemented/);
  assert.match(report.failures.join("\n"), /Payment delivery is disabled/);
});

test("production readiness rejects Redis Auth rate limiting until the adapter exists", () => {
  const report = inspectProductionReadiness({
    NODE_ENV: "production",
    DATABASE_URL: "postgres://cuac:secret@pgm-aliyun.rds.aliyuncs.com:5432/cuac",
    PGSSLMODE: "require",
    ALIBABA_CLOUD_REGION: "cn-shanghai",
    CUAC_APP_RUNTIME: "ecs-container",
    CUAC_SESSION_SECRET: strongSecret,
    CUAC_AUTH_RATE_LIMIT_ENFORCED: "true",
    CUAC_AUTH_RATE_LIMIT_BACKEND: "redis",
    CUAC_AUTH_EMAIL_DELIVERY_PROVIDER: "reviewed-provider-placeholder",
    CUAC_AUTH_EMAIL_FROM: "no-reply@example.com",
    CUAC_PUBLIC_APP_URL: "https://www.example.com",
    CUAC_AGENT_TOOL_GATEWAY_MODE: "enforced",
    CUAC_AGENT_SANDBOX_MODE: "enabled",
    CUAC_APPLICATION_FEE_MINOR: "80000",
    CUAC_SERVICE_FEE_MINOR: "40000",
    CUAC_BILLING_CURRENCY: "CNY",
    CUAC_SECRET_MANAGER: "aliyun-kms",
  });

  assert.equal(report.ready, false);
  assert.match(report.failures.join("\n"), /API Gateway or WAF until Redis support is implemented/);
});

test("production readiness rejects demo databases, localhost, direct Agent DB access, and weak payment webhooks", () => {
  const report = inspectProductionReadiness({
    NODE_ENV: "production",
    DATABASE_URL: "sqlite://demo.db",
    PGSSLMODE: "require",
    ALIBABA_CLOUD_REGION: "cn-shanghai",
    CUAC_APP_RUNTIME: "ecs-container",
    CUAC_SESSION_SECRET: strongSecret,
    CUAC_AUTH_RATE_LIMIT_ENFORCED: "true",
    CUAC_AUTH_RATE_LIMIT_BACKEND: "gateway",
    CUAC_AUTH_EMAIL_DELIVERY_PROVIDER: "reviewed-provider-placeholder",
    CUAC_AUTH_EMAIL_FROM: "no-reply@example.com",
    CUAC_PUBLIC_APP_URL: "https://www.example.com",
    CUAC_AGENT_TOOL_GATEWAY_MODE: "enforced",
    CUAC_AGENT_SANDBOX_MODE: "enabled",
    CUAC_AGENT_ENABLED: "true",
    CUAC_AGENT_DIRECT_DB_ACCESS: "true",
    CUAC_APPLICATION_FEE_MINOR: "80000",
    CUAC_PAYMENT_MODE: "live",
    CUAC_PAYMENT_PROVIDER: "hosted-provider",
    CUAC_PAYMENT_WEBHOOK_SECRET: "short",
    CUAC_SECRET_MANAGER: "aliyun-kms",
  });

  assert.equal(report.ready, false);
  assert.match(report.failures.join("\n"), /Database URL must point to PostgreSQL/);
  assert.match(report.failures.join("\n"), /Agent direct database access must stay disabled/);
  assert.match(report.failures.join("\n"), /Hosted payment gateway, checkout host, separated HMAC secrets/);
});

test("production readiness rejects staging localhost PostgreSQL and unsafe billing fees", () => {
  const report = inspectProductionReadiness({
    NODE_ENV: "staging",
    DATABASE_URL: "postgres://cuac:secret@127.0.0.1:5432/cuac",
    PGSSLMODE: "require",
    CUAC_SESSION_SECRET: strongSecret,
    CUAC_AUTH_RATE_LIMIT_ENFORCED: "false",
    CUAC_AUTH_RATE_LIMIT_BACKEND: "memory",
    CUAC_AUTH_EMAIL_DELIVERY_PROVIDER: "reviewed-provider-placeholder",
    CUAC_AUTH_EMAIL_FROM: "no-reply@example.com",
    CUAC_PUBLIC_APP_URL: "https://staging.example.com",
    CUAC_AGENT_TOOL_GATEWAY_MODE: "enforced",
    CUAC_AGENT_SANDBOX_MODE: "enabled",
    CUAC_APPLICATION_FEE_MINOR: "12.34",
    ALIYUN_KMS_KEY_ID: "kms-key",
  });

  assert.equal(report.environment, "staging");
  assert.equal(report.ready, false);
  assert.match(report.failures.join("\n"), /must not point to localhost/);
  assert.match(report.failures.join("\n"), /Auth endpoints must enforce shared rate limiting/);
  assert.match(report.failures.join("\n"), /Billing fee schedule is missing or unsafe/);
});

test("staging and production require PostgreSQL certificate and hostname verification", () => {
  for (const environment of ["staging", "production"]) {
    for (const mode of [undefined, "disable", "require", "true", "no-verify"]) {
      const report = inspectProductionReadiness({
        NODE_ENV: environment,
        DATABASE_URL: "postgres://cuac:secret@pgm-aliyun.rds.aliyuncs.com:5432/cuac",
        PGSSLMODE: mode,
        CUAC_PRIVATE_NETWORK_APPROVED: "true",
      });
      assert.equal(check(report, "postgres.ssl").status, "fail");
      assert.match(check(report, "postgres.ssl").message, /PGSSLMODE=verify-full/);
    }

    const verified = inspectProductionReadiness({
      NODE_ENV: environment,
      DATABASE_URL: "postgres://cuac:secret@pgm-aliyun.rds.aliyuncs.com:5432/cuac",
      PGSSLMODE: "verify-full",
    });
    assert.equal(check(verified, "postgres.ssl").status, "pass");
  }
});

test("production readiness rejects PostgreSQL URL options that can override reviewed connection security", () => {
  for (const suffix of ["?sslmode=disable", "?host=%2Ftmp%2Fpostgres", "?options=-csearch_path%3Dpublic", "#sslmode=disable"]) {
    const report = inspectProductionReadiness({
      NODE_ENV: "production",
      DATABASE_URL: `postgres://cuac:PRIVATE_SECRET@pgm-aliyun.rds.aliyuncs.com:5432/cuac${suffix}`,
      PGSSLMODE: "verify-full",
    });
    assert.equal(check(report, "postgres.url").status, "fail");
    assert.match(check(report, "postgres.url").message, /without query parameters or fragments/);
    assert.doesNotMatch(JSON.stringify(report), /PRIVATE_SECRET|pgm-aliyun/);
  }
});

test("production readiness blocks sensitive uploads until private OSS and worker configuration is complete", () => {
  const report = inspectProductionReadiness({
    NODE_ENV: "production",
    DATABASE_URL: "postgres://cuac:secret@pgm-aliyun.rds.aliyuncs.com:5432/cuac",
    PGSSLMODE: "require",
    ALIBABA_CLOUD_REGION: "cn-shanghai",
    CUAC_APP_RUNTIME: "ecs-container",
    CUAC_SESSION_SECRET: strongSecret,
    CUAC_AUTH_RATE_LIMIT_ENFORCED: "true",
    CUAC_AUTH_RATE_LIMIT_BACKEND: "waf",
    CUAC_AUTH_EMAIL_DELIVERY_PROVIDER: "reviewed-provider-placeholder",
    CUAC_AUTH_EMAIL_FROM: "no-reply@example.com",
    CUAC_PUBLIC_APP_URL: "https://www.example.com",
    CUAC_AGENT_TOOL_GATEWAY_MODE: "enforced",
    CUAC_AGENT_SANDBOX_MODE: "enabled",
    CUAC_APPLICATION_FEE_MINOR: "80000",
    CUAC_SECRET_MANAGER: "aliyun-kms",
    CUAC_FILE_UPLOAD_ENABLED: "true",
    CUAC_PAYMENT_MODE: "live",
    CUAC_PAYMENT_PROVIDER: "foreign-provider",
    CUAC_PAYMENT_WEBHOOK_SECRET: paymentWebhookSecret,
  });

  assert.equal(report.ready, false);
  assert.match(report.failures.join("\n"), /Private OSS, KMS, ClamAV worker/);
});

const configuredProduction = {
  NODE_ENV: "production", CUAC_ENV: "production",
  DATABASE_URL: "postgres://cuac:synthetic-password@pgm-example.rds.aliyuncs.com:5432/cuac",
  PGSSLMODE: "verify-full", ALIBABA_CLOUD_REGION: "cn-shanghai", CUAC_APP_RUNTIME: "ecs-container",
  CUAC_SESSION_SECRET: "synthetic-session-0123456789abcdef0123456789abcdef",
  CUAC_AUTH_RATE_LIMIT_ENFORCED: "true", CUAC_AUTH_RATE_LIMIT_BACKEND: "gateway",
  CUAC_AUTH_EMAIL_DELIVERY_PROVIDER: "arbitrary-provider-with-no-adapter",
  CUAC_AUTH_EMAIL_FROM: "no-reply@example.com", CUAC_PUBLIC_APP_URL: "https://www.example.com",
  CUAC_AGENT_ENABLED: "false", CUAC_AGENT_TOOL_GATEWAY_MODE: "disabled", CUAC_AGENT_SANDBOX_MODE: "disabled",
  CUAC_AGENT_DIRECT_DB_ACCESS: "false",
  CUAC_APPLICATION_FEE_MINOR: "80000", CUAC_SERVICE_FEE_MINOR: "0", CUAC_BILLING_CURRENCY: "CNY",
  CUAC_PAYMENT_MODE: "disabled", CUAC_SECRET_MANAGER: "aliyun-kms", CUAC_FILE_UPLOAD_ENABLED: "false",
};

const configuredPrivateFiles = {
  CUAC_FILE_UPLOAD_ENABLED: "true",
  ALIYUN_OSS_REGION: "oss-cn-shanghai",
  ALIYUN_OSS_PRIVATE_BUCKET: "synthetic-private-bucket",
  ALIBABA_CLOUD_ACCESS_KEY_ID: "synthetic-access-key",
  ALIBABA_CLOUD_ACCESS_KEY_SECRET: "synthetic-access-secret",
  ALIYUN_OSS_KMS_KEY_ID: "synthetic-oss-kms-key",
  CUAC_FILE_MAX_BYTES: "26214400",
  CUAC_FILE_UPLOAD_TTL_SECONDS: "900",
  CUAC_FILE_DOWNLOAD_TTL_SECONDS: "60",
  CUAC_FILE_RETENTION_DAYS: "365",
  CUAC_CLAMDSCAN_PATH: "clamdscan",
  CUAC_FILE_WORKER_POLL_MS: "1000",
  CUAC_FILE_WORKER_RECOVERY_MS: "60000",
  CUAC_FILE_WORKER_RETENTION_MS: "3600000",
};

function check(report, id) {
  const result = report.checks.find(entry => entry.id === id);
  assert.ok(result, `Missing check ${id}`);
  return result;
}

test("official submission delivery fails closed until the reviewed gateway is configured and accepted", () => {
  for (const environment of ["development", "staging", "production"]) {
    const disabled = inspectProductionReadiness({ ...configuredProduction, CUAC_ENV: environment,
      CUAC_SUBMISSION_DELIVERY_PROVIDER: "disabled" });
    assert.equal(check(disabled, "submission.delivery").status, environment === "development" ? "warn" : "fail");
  }

  const configured = {
    ...configuredProduction,
    CUAC_SUBMISSION_DELIVERY_PROVIDER: "cuac_handoff_gateway_v1",
    CUAC_SUBMISSION_DELIVERY_ENDPOINT: "https://handoff.cuac-services.com/v1/official-submissions",
    CUAC_SUBMISSION_DELIVERY_ALLOWED_HOST: "handoff.cuac-services.com",
    CUAC_SUBMISSION_DELIVERY_HMAC_SECRET: submissionSecret,
    CUAC_MATERIAL_SNAPSHOT_ACTIVE_KEY_ID: "snapshot-key-a",
    CUAC_MATERIAL_SNAPSHOT_KEYRING_JSON: JSON.stringify({ "snapshot-key-a": materialSnapshotKey }),
  };
  const awaitingAcceptance = inspectProductionReadiness(configured);
  assert.equal(check(awaitingAcceptance, "submission.delivery").status, "fail");
  assert.match(check(awaitingAcceptance, "submission.delivery").message, /signed staging receipt round trip/);

  const accepted = inspectProductionReadiness({ ...configured,
    CUAC_SUBMISSION_DELIVERY_WORKER_SUPERVISED: "true",
    CUAC_SUBMISSION_DELIVERY_STAGING_ACCEPTED: "true" });
  assert.equal(check(accepted, "submission.delivery").status, "pass");

  const arbitrary = inspectProductionReadiness({ ...configured,
    CUAC_SUBMISSION_DELIVERY_PROVIDER: "generic-webhook" });
  assert.equal(check(arbitrary, "submission.delivery").status, "fail");
  assert.match(check(arbitrary, "submission.delivery").message, /configured completely/);
});

test("arbitrary email provider names never invent a runtime adapter in any environment", () => {
  for (const environment of ["development", "staging", "production"]) {
    for (const provider of ["reviewed-provider-placeholder", "aliyun", "smtp", "deferred", configuredProduction.CUAC_AUTH_EMAIL_DELIVERY_PROVIDER]) {
      const report = inspectProductionReadiness({ ...configuredProduction, CUAC_ENV: environment, CUAC_AUTH_EMAIL_DELIVERY_PROVIDER: provider });
      assert.equal(report.ready, false);
      assert.equal(check(report, "auth.email_delivery").status, "fail");
      assert.match(check(report, "auth.email_delivery").message, /runtime adapter is not implemented/);
      assert.equal(report.runtimeVerified, false);
    }
  }
});

test("disabled email is a local warning but a staging and production blocker", () => {
  for (const environment of ["development", "staging", "production"]) {
    const report = inspectProductionReadiness({ ...configuredProduction, CUAC_ENV: environment, CUAC_AUTH_EMAIL_DELIVERY_PROVIDER: "disabled" });
    assert.equal(check(report, "auth.email_delivery").status, environment === "development" ? "warn" : "fail");
  }
});

test("reviewed Aliyun auth email passes only after worker supervision and staging round-trip acceptance", () => {
  const provider = "aliyun-directmail-smtp";
  const incomplete = inspectProductionReadiness({ ...configuredProduction, CUAC_AUTH_EMAIL_DELIVERY_PROVIDER: provider });
  assert.equal(check(incomplete, "auth.email_delivery").status, "fail");
  assert.match(check(incomplete, "auth.email_delivery").message, /configuration must be complete/);

  const configured = inspectProductionReadiness({
    ...configuredProduction,
    CUAC_AUTH_EMAIL_DELIVERY_PROVIDER: provider,
    CUAC_AUTH_EMAIL_VERIFICATION_PATH: "/auth/verify-email",
    CUAC_AUTH_PASSWORD_RESET_PATH: "/auth/reset-password",
    CUAC_AUTH_EMAIL_SMTP_REGION: "cn-hangzhou",
    CUAC_AUTH_EMAIL_SMTP_USERNAME: configuredProduction.CUAC_AUTH_EMAIL_FROM,
    CUAC_AUTH_EMAIL_SMTP_PASSWORD: "synthetic-smtp-password",
    CUAC_AUTH_EMAIL_OUTBOX_ACTIVE_KEY_ID: "key-a",
    CUAC_AUTH_EMAIL_OUTBOX_KEYS_JSON: JSON.stringify({ "key-a": Buffer.alloc(32, 7).toString("base64url") }),
  });
  assert.equal(check(configured, "auth.email_delivery").status, "fail");
  assert.match(check(configured, "auth.email_delivery").message, /supervised worker operation/);
  assert.equal(configured.runtimeVerified, false);

  const accepted = inspectProductionReadiness({
    ...configuredProduction,
    CUAC_AUTH_EMAIL_DELIVERY_PROVIDER: provider,
    CUAC_AUTH_EMAIL_VERIFICATION_PATH: "/auth/verify-email",
    CUAC_AUTH_PASSWORD_RESET_PATH: "/auth/reset-password",
    CUAC_AUTH_EMAIL_SMTP_REGION: "cn-hangzhou",
    CUAC_AUTH_EMAIL_SMTP_USERNAME: configuredProduction.CUAC_AUTH_EMAIL_FROM,
    CUAC_AUTH_EMAIL_SMTP_PASSWORD: "synthetic-smtp-password",
    CUAC_AUTH_EMAIL_OUTBOX_ACTIVE_KEY_ID: "key-a",
    CUAC_AUTH_EMAIL_OUTBOX_KEYS_JSON: JSON.stringify({ "key-a": Buffer.alloc(32, 7).toString("base64url") }),
    CUAC_AUTH_EMAIL_WORKER_SUPERVISED: "true",
    CUAC_AUTH_EMAIL_STAGING_ACCEPTED: "true",
  });
  assert.equal(check(accepted, "auth.email_delivery").status, "pass");
});

test("notification delivery stays disabled by default and rejects unreviewed providers", () => {
  for (const environment of ["development", "staging", "production"]) {
    const disabled = inspectProductionReadiness({
      ...configuredProduction, CUAC_ENV: environment, CUAC_NOTIFICATION_EMAIL_PROVIDER: "disabled",
    });
    assert.equal(check(disabled, "notification.delivery").status, environment === "development" ? "warn" : "fail");
    const arbitrary = inspectProductionReadiness({
      ...configuredProduction, CUAC_ENV: environment, CUAC_NOTIFICATION_EMAIL_PROVIDER: "generic-smtp",
    });
    assert.equal(check(arbitrary, "notification.delivery").status, "fail");
    assert.match(check(arbitrary, "notification.delivery").message, /runtime adapter is not implemented/);
  }
});

test("reviewed notification runtime passes only after supervision and staging acceptance", () => {
  const configuredNotification = {
    CUAC_NOTIFICATION_EMAIL_PROVIDER: "aliyun-directmail-smtp",
    CUAC_NOTIFICATION_EMAIL_FROM: "no-reply@example.com",
    CUAC_NOTIFICATION_EMAIL_SMTP_REGION: "cn-hangzhou",
    CUAC_NOTIFICATION_EMAIL_SMTP_USERNAME: "no-reply@example.com",
    CUAC_NOTIFICATION_EMAIL_SMTP_PASSWORD: "synthetic-notification-smtp-password",
    CUAC_NOTIFICATION_WORKER_POLL_MS: "1000",
    CUAC_NOTIFICATION_WORKER_RECOVERY_MS: "60000",
  };
  const incomplete = inspectProductionReadiness({ ...configuredProduction, ...configuredNotification });
  assert.equal(check(incomplete, "notification.delivery").status, "fail");
  assert.match(check(incomplete, "notification.delivery").message, /supervised worker operation/);

  const accepted = inspectProductionReadiness({
    ...configuredProduction,
    ...configuredNotification,
    CUAC_NOTIFICATION_WORKER_SUPERVISED: "true",
    CUAC_NOTIFICATION_STAGING_ACCEPTED: "true",
  });
  assert.equal(check(accepted, "notification.delivery").status, "pass");
  assert.equal(accepted.runtimeVerified, false);

  const malformed = inspectProductionReadiness({
    ...configuredProduction,
    ...configuredNotification,
    CUAC_NOTIFICATION_EMAIL_SMTP_REGION: "attacker.example.invalid",
  });
  assert.equal(check(malformed, "notification.delivery").status, "fail");
  assert.match(check(malformed, "notification.delivery").message, /configuration must be complete/);
});

const configuredPayment = {
  CUAC_PAYMENT_MODE: "live",
  CUAC_PAYMENT_PROVIDER: "cuac_hosted_gateway_v1",
  CUAC_PAYMENT_GATEWAY_ENDPOINT: "https://gateway.cuac-services.com/v1/checkout-sessions",
  CUAC_PAYMENT_GATEWAY_ALLOWED_HOST: "gateway.cuac-services.com",
  CUAC_PAYMENT_CHECKOUT_ALLOWED_HOST: "checkout.cuac-services.com",
  CUAC_PAYMENT_GATEWAY_HMAC_SECRET: paymentGatewaySecret,
  CUAC_PAYMENT_WEBHOOK_SECRET: paymentWebhookSecret,
  CUAC_PAYMENT_GATEWAY_TIMEOUT_MS: "10000",
  CUAC_PAYMENT_WEBHOOK_MAX_SKEW_MS: "300000",
  CUAC_PAYMENT_RECONCILIATION_POLL_MS: "1000",
};

test("live and test payment modes fail closed unless the reviewed runtime is fully configured", () => {
  for (const environment of ["development", "staging", "production"]) {
    for (const mode of ["live", "test"]) {
      const report = inspectProductionReadiness({
        ...configuredProduction, CUAC_ENV: environment, CUAC_PAYMENT_MODE: mode,
        CUAC_PAYMENT_PROVIDER: "foreign-provider", CUAC_PAYMENT_WEBHOOK_SECRET: paymentWebhookSecret,
      });
      assert.equal(check(report, "billing.provider").status, "fail");
      assert.match(check(report, "billing.provider").message,
        environment === "production" && mode === "test" ? /Production payment mode must be live/
          : /Hosted payment gateway, checkout host, separated HMAC secrets/);
    }
  }
});

test("disabled payments block staging and production while remaining a local warning", () => {
  for (const environment of ["development", "staging", "production"]) {
    const report = inspectProductionReadiness({ ...configuredProduction, CUAC_ENV: environment,
      CUAC_PAYMENT_MODE: "disabled" });
    assert.equal(check(report, "billing.provider").status, environment === "development" ? "warn" : "fail");
    assert.match(check(report, "billing.provider").message, /Payment delivery is disabled/);
  }
  for (const mode of ["", "sandbox", "true", "lve"]) {
    const report = inspectProductionReadiness({ ...configuredProduction, CUAC_PAYMENT_MODE: mode });
    assert.equal(check(report, "billing.provider").status, "fail");
    assert.match(check(report, "billing.provider").message, /must be disabled, test, or live/);
  }
});

test("reviewed payment runtime passes only after worker supervision and staging round-trip attestations", () => {
  const configured = inspectProductionReadiness({ ...configuredProduction, ...configuredPayment });
  assert.equal(check(configured, "billing.provider").status, "fail");
  assert.match(check(configured, "billing.provider").message, /supervised reconciliation/);
  const accepted = inspectProductionReadiness({ ...configuredProduction, ...configuredPayment,
    CUAC_PAYMENT_RECONCILIATION_WORKER_SUPERVISED: "true", CUAC_PAYMENT_STAGING_ACCEPTED: "true" });
  assert.equal(check(accepted, "billing.provider").status, "pass");
  assert.equal(accepted.runtimeVerified, false);
});

test("an OSS bucket name alone cannot enable the private file pipeline", () => {
  for (const environment of ["development", "staging", "production"]) {
    for (const bucket of [undefined, "synthetic-private-bucket"]) {
      const report = inspectProductionReadiness({ ...configuredProduction, CUAC_ENV: environment, CUAC_FILE_UPLOAD_ENABLED: "true", ALIYUN_OSS_PRIVATE_BUCKET: bucket });
      assert.equal(check(report, "storage.private_files").status, "fail");
      assert.match(check(report, "storage.private_files").message, /Private OSS, KMS, ClamAV worker/);
    }
  }
});

test("disabled private files are a local warning and a staging or production blocker", () => {
  for (const environment of ["development", "staging", "production"]) {
    const report = inspectProductionReadiness({ ...configuredProduction, CUAC_ENV: environment, CUAC_FILE_UPLOAD_ENABLED: "false" });
    assert.equal(check(report, "storage.private_files").status, environment === "development" ? "warn" : "fail");
  }
});

test("configured private files remain blocked until every cloud acceptance attestation is true", () => {
  const incomplete = inspectProductionReadiness({ ...configuredProduction, ...configuredPrivateFiles });
  assert.equal(check(incomplete, "storage.private_files").status, "fail");
  assert.match(check(incomplete, "storage.private_files").message, /versioning\/lifecycle\/CORS/);

  const accepted = inspectProductionReadiness({
    ...configuredProduction,
    ...configuredPrivateFiles,
    CUAC_FILE_WORKER_SUPERVISED: "true",
    CUAC_OSS_VERSIONING_CONFIRMED: "true",
    CUAC_OSS_LIFECYCLE_CONFIRMED: "true",
    CUAC_OSS_CORS_CONFIRMED: "true",
    CUAC_FILE_STAGING_ACCEPTED: "true",
  });
  assert.equal(check(accepted, "storage.private_files").status, "pass");
  assert.equal(accepted.runtimeVerified, false);
});

test("invalid upload flags fail instead of silently disabling a requested feature", () => {
  for (const value of ["", "enabled", "yes", "1", "flase"]) {
    const report = inspectProductionReadiness({ ...configuredProduction, CUAC_FILE_UPLOAD_ENABLED: value });
    assert.equal(check(report, "storage.private_files").status, "fail");
    assert.match(check(report, "storage.private_files").message, /must be true or false/);
  }
});

test("unknown environments cannot silently use development checks", () => {
  for (const env of [{}, { CUAC_ENV: "prodution" }, { CUAC_ENV: "", NODE_ENV: "production" }]) {
    const report = inspectProductionReadiness(env);
    assert.equal(report.environment, "unknown");
    assert.equal(report.ready, false);
    assert.equal(check(report, "deployment.environment").status, "fail");
  }
  for (const [name, expected] of [["dev", "development"], ["test", "development"], ["stage", "staging"], ["prod", "production"]]) {
    assert.equal(inspectProductionReadiness({ DEPLOY_ENV: name }).environment, expected);
  }
});

test("hard gate requires a deployment environment and rejects invalid boolean flags", () => {
  const local = inspectProductionReadiness({ NODE_ENV: "development", CUAC_REQUIRE_PRODUCTION_READY: "true" });
  assert.equal(local.gateMode, "required");
  assert.equal(local.ready, false);
  assert.match(check(local, "deployment.gate").message, /requires staging or production/);
  for (const value of ["", "yes", "1", "treu", "flase"]) {
    const report = inspectProductionReadiness({ ...configuredProduction, CUAC_REQUIRE_PRODUCTION_READY: value });
    assert.equal(report.gateMode, "invalid");
    assert.equal(check(report, "deployment.gate").status, "fail");
  }
});

test("offline reports never echo secrets, private endpoints or arbitrary provider strings", () => {
  const env = {
    ...configuredProduction, ...configuredPayment,
    CUAC_PAYMENT_GATEWAY_ENDPOINT: "https://gateway-canary-7391.cuac-services.com/v1/checkout",
    ...configuredPrivateFiles,
    ALIYUN_OSS_PRIVATE_BUCKET: "bucket-canary-7391",
    ALIBABA_CLOUD_ACCESS_KEY_SECRET: "oss-secret-canary-7391",
    ALIYUN_OSS_KMS_KEY_ID: "oss-kms-canary-7391",
    ALIBABA_CLOUD_KMS_KEY_ID: "kms-canary-7391",
  };
  const serialized = JSON.stringify(inspectProductionReadiness(env));
  for (const key of ["DATABASE_URL", "CUAC_SESSION_SECRET", "CUAC_PAYMENT_PROVIDER", "CUAC_PAYMENT_GATEWAY_ENDPOINT",
    "CUAC_PAYMENT_GATEWAY_HMAC_SECRET", "CUAC_PAYMENT_WEBHOOK_SECRET", "CUAC_AUTH_EMAIL_DELIVERY_PROVIDER",
    "CUAC_AUTH_EMAIL_FROM", "CUAC_PUBLIC_APP_URL", "ALIYUN_OSS_PRIVATE_BUCKET", "ALIBABA_CLOUD_ACCESS_KEY_SECRET",
    "ALIYUN_OSS_KMS_KEY_ID", "ALIBABA_CLOUD_KMS_KEY_ID"]) {
    assert.equal(serialized.includes(env[key]), false, `Leaked ${key}`);
  }
});

function runCli(env) {
  const systemEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(path|systemroot|windir|temp|tmp)$/i.test(key)));
  const child = spawnSync(process.execPath, [fileURLToPath(new URL("../../../scripts/production-readiness-check.ts", import.meta.url))], {
    env: { ...systemEnv, ...env }, cwd: fileURLToPath(new URL("../../../", import.meta.url)),
    encoding: "utf8", timeout: 10000, maxBuffer: 64 * 1024, windowsHide: true,
  });
  assert.ifError(child.error);
  assert.equal(child.signal, null);
  assert.equal(child.stderr, "");
  return { status: child.status, report: JSON.parse(child.stdout) };
}

test("CLI defaults staging and production to a hard failure for unavailable email", () => {
  for (const environment of ["staging", "production"]) {
    const { status, report } = runCli({ ...configuredProduction, CUAC_ENV: environment });
    assert.equal(status, 1);
    assert.equal(report.gateMode, "required");
    assert.equal(report.ready, false);
    assert.equal(check(report, "auth.email_delivery").status, "fail");
  }
});

test("CLI explicit advisory mode reports failure but never claims runtime verification", () => {
  const { status, report } = runCli({ ...configuredProduction, CUAC_REQUIRE_PRODUCTION_READY: "false" });
  assert.equal(status, 0);
  assert.equal(report.gateMode, "advisory");
  assert.equal(report.ready, false);
  assert.equal(report.scope, "offline_preflight");
  assert.equal(report.runtimeVerified, false);
});

test("CLI local defaults are advisory and cannot pass an explicitly required deployment gate", () => {
  assert.equal(runCli({ NODE_ENV: "development" }).status, 0);
  const { status, report } = runCli({ NODE_ENV: "development", CUAC_REQUIRE_PRODUCTION_READY: "true" });
  assert.equal(status, 1);
  assert.equal(report.ready, false);
});

test("CLI invalid hard-gate flags fail instead of falling back to advisory mode", () => {
  for (const value of ["", "treu", "flase"]) {
    const { status, report } = runCli({ NODE_ENV: "development", CUAC_REQUIRE_PRODUCTION_READY: value });
    assert.equal(status, 1);
    assert.equal(report.gateMode, "invalid");
  }
});

test("CLI unknown deployment environment fails by default and with an explicit hard gate", () => {
  for (const env of [{}, { CUAC_ENV: "prodution" }, { CUAC_ENV: "prodution", CUAC_REQUIRE_PRODUCTION_READY: "true" }]) {
    const { status, report } = runCli(env);
    assert.equal(status, 1);
    assert.equal(report.gateMode, "required");
    assert.equal(check(report, "deployment.environment").status, "fail");
  }
  const { status, report } = runCli({ ...configuredProduction, CUAC_REQUIRE_PRODUCTION_READY: "true" });
  assert.equal(status, 1);
  assert.equal(check(report, "auth.email_delivery").status, "fail");
});
