import { resolveBillingFeeSchedule } from "../billing/runtime/routes.ts";
import { createPaymentProviderFromEnv, paymentReconciliationWorkerConfigFromEnv } from "../billing/runtime/payment.ts";
import { AUTH_EMAIL_PROVIDER_ALIYUN_SMTP, createAuthEmailWorkerConfigurationFromEnv } from "../auth/runtime/email-delivery.ts";
import { assertSafePostgresConnectionString, getDatabaseUrl } from "../db/postgres-client.ts";
import { createClamAvScannerFromEnv } from "../files/clamav-scanner.ts";
import { parsePrivateOssConfiguration } from "../files/private-object-storage.ts";
import { parseStudentFileRetentionDays } from "../files/runtime/routes.ts";
import { createStudentFileWorkerConfigurationFromEnv } from "../files/runtime/worker.ts";
import { publicApiOrigin } from "../shared/http-config.ts";
import { createOfficialSubmissionWorkerConfigurationFromEnv } from "../submission-delivery/runtime.ts";
import { resolveApplicationMaterialSnapshotCipher } from "../student/application-material-snapshot-envelope.ts";
import { NOTIFICATION_EMAIL_PROVIDER_ALIYUN_SMTP, createNotificationWorkerConfigurationFromEnv } from "../notifications/runtime/worker.ts";
import { assertSafeApplicationProcessEnvironment } from "./startup-policy.ts";

export type ProductionReadinessStatus = "pass" | "warn" | "fail";

export type ProductionReadinessItem = {
  id: string;
  status: ProductionReadinessStatus;
  message: string;
};

export type ProductionReadinessReport = {
  scope: "offline_preflight";
  runtimeVerified: false;
  environment: "development" | "staging" | "production" | "unknown";
  gateMode: "advisory" | "required" | "invalid";
  // Passing these offline checks is necessary, not sufficient, for release approval.
  ready: boolean;
  failures: string[];
  warnings: string[];
  checks: ProductionReadinessItem[];
};

const unsafeSecretValues = new Set(["", "changeme", "change-me", "secret", "password", "development", "dev-secret"]);

export function inspectProductionReadiness(env: Record<string, string | undefined> = process.env): ProductionReadinessReport {
  const environment = resolveEnvironment(env);
  const strict = environment === "staging" || environment === "production";
  const gateMode = resolveGateMode(env, environment);
  const checks: ProductionReadinessItem[] = [
    checkEnvironment(environment),
    checkReadinessGate(gateMode, strict),
    checkRuntimeOverrides(env),
    checkDatabaseUrl(env, strict),
    checkPostgresSsl(env, strict),
    checkAlibabaCloudBaseline(env, environment),
    checkSessionSecret(env, strict),
    checkPublicOrigin(env, strict),
    checkAuthRateLimit(env, strict),
    checkAuthEmailDelivery(env, strict),
    checkNotificationDelivery(env, strict),
    checkAgentSandbox(env, strict),
    checkBillingFeeSchedule(env, strict),
    checkPaymentProvider(env, environment),
    checkSecretManagement(env, environment),
    checkFileStorage(env, strict),
    checkOfficialSubmissionDelivery(env, strict),
  ];

  const failures = checks.filter((check) => check.status === "fail").map((check) => check.message);
  const warnings = checks.filter((check) => check.status === "warn").map((check) => check.message);

  return {
    scope: "offline_preflight",
    runtimeVerified: false,
    environment,
    gateMode,
    ready: failures.length === 0,
    failures,
    warnings,
    checks,
  };
}

function checkRuntimeOverrides(env: Record<string, string | undefined>): ProductionReadinessItem {
  try {
    assertSafeApplicationProcessEnvironment(env);
    return item("pass", "deployment.runtime_overrides", "Node.js runtime override posture is safe.");
  } catch {
    return item("fail", "deployment.runtime_overrides", "NODE_OPTIONS, NODE_PATH, and NODE_TLS_REJECT_UNAUTHORIZED=0 are forbidden for CUAC application startup.");
  }
}

function resolveEnvironment(env: Record<string, string | undefined>): ProductionReadinessReport["environment"] {
  const value = normalize(env.CUAC_ENV ?? env.DEPLOY_ENV ?? env.NODE_ENV);

  if (value === "production" || value === "prod") {
    return "production";
  }

  if (value === "staging" || value === "stage") {
    return "staging";
  }

  if (value === "development" || value === "dev" || value === "test") {
    return "development";
  }

  return "unknown";
}

function resolveGateMode(
  env: Record<string, string | undefined>,
  environment: ProductionReadinessReport["environment"],
): ProductionReadinessReport["gateMode"] {
  if (env.CUAC_REQUIRE_PRODUCTION_READY === undefined) {
    return environment === "development" ? "advisory" : "required";
  }
  const value = normalize(env.CUAC_REQUIRE_PRODUCTION_READY);
  if (value === "true") return "required";
  if (value === "false") return "advisory";
  return "invalid";
}

function checkEnvironment(environment: ProductionReadinessReport["environment"]): ProductionReadinessItem {
  return environment === "unknown"
    ? item("fail", "deployment.environment", "Deployment environment is missing or unknown. Set CUAC_ENV to development, staging, or production.")
    : item("pass", "deployment.environment", "Deployment environment is recognized.");
}

function checkReadinessGate(gateMode: ProductionReadinessReport["gateMode"], strict: boolean): ProductionReadinessItem {
  if (gateMode === "invalid") {
    return item("fail", "deployment.gate", "CUAC_REQUIRE_PRODUCTION_READY must be true or false when set.");
  }
  if (gateMode === "required" && !strict) {
    return item("fail", "deployment.gate", "Hard readiness gate requires staging or production; development checks cannot approve deployment.");
  }
  return item("pass", "deployment.gate", gateMode === "required"
    ? "Hard offline gate is enabled. Runtime acceptance and release approval remain separate."
    : "Advisory report only. Exit status does not approve deployment.");
}

function checkDatabaseUrl(env: Record<string, string | undefined>, strict: boolean): ProductionReadinessItem {
  const databaseUrl = getDatabaseUrl(env);

  if (!databaseUrl) {
    return item(strict ? "fail" : "warn", "postgres.url", "PostgreSQL URL is missing. Set DATABASE_URL, POSTGRES_URL, or PG_DATABASE_URL.");
  }

  if (!/^postgres(ql)?:\/\//i.test(databaseUrl)) {
    return item("fail", "postgres.url", "Database URL must point to PostgreSQL, not a demo SQLite/D1/local file database.");
  }

  try { assertSafePostgresConnectionString(databaseUrl); }
  catch {
    return item("fail", "postgres.url", "PostgreSQL URL must be a valid postgres/postgresql URL without query parameters or fragments; connection security is configured separately.");
  }

  if (/localhost|127\.0\.0\.1/i.test(databaseUrl) && strict) {
    return item("fail", "postgres.url", "Staging/production database URL must not point to localhost.");
  }

  return item("pass", "postgres.url", "PostgreSQL URL is configured.");
}

function checkPostgresSsl(env: Record<string, string | undefined>, strict: boolean): ProductionReadinessItem {
  const sslMode = normalize(env.PGSSLMODE ?? env.PG_SSL ?? env.DATABASE_SSL);

  if (!strict) {
    return item("pass", "postgres.ssl", "PostgreSQL SSL is optional outside staging/production.");
  }

  if (sslMode === "verify-full") {
    return item("pass", "postgres.ssl", "PostgreSQL TLS certificate and hostname verification are required for Alibaba Cloud RDS.");
  }

  return item("fail", "postgres.ssl", "Staging/production PostgreSQL must set PGSSLMODE=verify-full; encryption or a private network alone does not verify the RDS certificate and hostname.");
}

function checkAlibabaCloudBaseline(
  env: Record<string, string | undefined>,
  environment: ProductionReadinessReport["environment"],
): ProductionReadinessItem {
  if (environment === "development") {
    return item("pass", "aliyun.baseline", "Alibaba Cloud baseline is not required for local development.");
  }

  const region = env.ALIBABA_CLOUD_REGION ?? env.ALIYUN_REGION;
  const runtime = env.CUAC_APP_RUNTIME ?? env.ALIYUN_APP_RUNTIME;

  if (region && runtime) {
    return item("pass", "aliyun.baseline", "Alibaba Cloud region and app runtime are configured.");
  }

  return item(
    environment === "production" ? "fail" : "warn",
    "aliyun.baseline",
    "Alibaba Cloud region and app runtime should be configured before staging/production deployment.",
  );
}

function checkSessionSecret(env: Record<string, string | undefined>, strict: boolean): ProductionReadinessItem {
  const secret = env.CUAC_SESSION_SECRET ?? env.SESSION_SECRET;

  if (!secret) {
    return item(strict ? "fail" : "warn", "auth.session_secret", "Session secret is missing.");
  }

  if (secret.length < 32 || unsafeSecretValues.has(normalize(secret)) || /replace-with|placeholder|changeme/i.test(secret)) {
    return item("fail", "auth.session_secret", "Session secret must be at least 32 characters and not a placeholder.");
  }

  return item("pass", "auth.session_secret", "Session secret posture is acceptable.");
}

function checkPublicOrigin(env: Record<string, string | undefined>, strict: boolean): ProductionReadinessItem {
  try {
    publicApiOrigin(env);
    return item("pass", "http.public_origin", "Public HTTPS origin is configured for same-origin API writes.");
  } catch {
    return item(strict ? "fail" : "warn", "http.public_origin", "API writes require CUAC_PUBLIC_APP_URL with an exact HTTPS origin and no credentials, query, fragment or path.");
  }
}

function checkAuthRateLimit(env: Record<string, string | undefined>, strict: boolean): ProductionReadinessItem {
  const enforced = normalize(env.CUAC_AUTH_RATE_LIMIT_ENFORCED);
  const backend = normalize(env.CUAC_AUTH_RATE_LIMIT_BACKEND);
  const sharedBackend = backend === "gateway" || backend === "waf";

  if (!strict) {
    return item("pass", "auth.rate_limit", "Shared Auth rate limiting is optional outside staging/production.");
  }

  if (enforced === "true" && sharedBackend) {
    return item("pass", "auth.rate_limit", "Shared Auth rate limiting is configured for staging/production.");
  }

  return item(
    "fail",
    "auth.rate_limit",
    "Staging/production Auth endpoints must enforce shared rate limiting with API Gateway or WAF until Redis support is implemented.",
  );
}

function checkAuthEmailDelivery(env: Record<string, string | undefined>, strict: boolean): ProductionReadinessItem {
  const provider = normalize(env.CUAC_AUTH_EMAIL_DELIVERY_PROVIDER);

  if (!provider || provider === "disabled") {
    return item(
      strict ? "fail" : "warn",
      "auth.email_delivery",
      "Auth email delivery is disabled. A reviewed runtime adapter and supervised staging acceptance are required before verification or reset delivery.",
    );
  }

  if (provider !== AUTH_EMAIL_PROVIDER_ALIYUN_SMTP) {
    return item("fail", "auth.email_delivery", "Auth email runtime adapter is not implemented for the configured provider. Only the reviewed Aliyun Direct Mail SMTP adapter is supported.");
  }

  try { createAuthEmailWorkerConfigurationFromEnv(env); }
  catch {
    return item("fail", "auth.email_delivery", "Aliyun Direct Mail SMTP, encrypted outbox and worker configuration must be complete and valid.");
  }

  const accepted = [
    env.CUAC_AUTH_EMAIL_WORKER_SUPERVISED,
    env.CUAC_AUTH_EMAIL_STAGING_ACCEPTED,
  ].every(value => normalize(value) === "true");
  return accepted
    ? item(
        "pass",
        "auth.email_delivery",
        "Auth email provider configuration and staging acceptance attestations are present; runtime evidence remains separate.",
      )
    : item(
        strict ? "fail" : "warn",
        "auth.email_delivery",
        "Auth email runtime is configured, but supervised worker operation and a staging verification/reset delivery round trip must both be confirmed.",
      );
}

function checkNotificationDelivery(env: Record<string, string | undefined>, strict: boolean): ProductionReadinessItem {
  const provider = normalize(env.CUAC_NOTIFICATION_EMAIL_PROVIDER);
  if (!provider || provider === "disabled") {
    return item(strict ? "fail" : "warn", "notification.delivery",
      "Notification email delivery is disabled. Staging/production requires the reviewed provider and supervised worker.");
  }
  if (provider !== NOTIFICATION_EMAIL_PROVIDER_ALIYUN_SMTP) {
    return item("fail", "notification.delivery",
      "Notification runtime adapter is not implemented for the configured provider. Only the reviewed Aliyun Direct Mail SMTP adapter is supported.");
  }
  try { createNotificationWorkerConfigurationFromEnv(env); }
  catch {
    return item("fail", "notification.delivery",
      "Notification Aliyun Direct Mail SMTP and worker configuration must be complete and valid.");
  }
  const accepted = [
    env.CUAC_NOTIFICATION_WORKER_SUPERVISED,
    env.CUAC_NOTIFICATION_STAGING_ACCEPTED,
  ].every(value => normalize(value) === "true");
  return accepted
    ? item("pass", "notification.delivery",
      "Notification provider configuration and staging acceptance attestations are present; runtime evidence remains separate.")
    : item(strict ? "fail" : "warn", "notification.delivery",
      "Notification runtime is configured, but supervised worker operation and a staging delivery/bounce round trip must both be confirmed.");
}

function checkAgentSandbox(env: Record<string, string | undefined>, strict: boolean): ProductionReadinessItem {
  const enabled = normalize(env.CUAC_AGENT_ENABLED);
  const gatewayMode = normalize(env.CUAC_AGENT_TOOL_GATEWAY_MODE);
  const sandboxMode = normalize(env.CUAC_AGENT_SANDBOX_MODE);
  const directDbAccess = normalize(env.CUAC_AGENT_DIRECT_DB_ACCESS);
  const agentEnabled = enabled === "true" || enabled === "enabled";
  const agentDisabled = enabled === "false" || enabled === "disabled";
  const directDbAccessDisabled = directDbAccess === "false" || directDbAccess === "disabled";

  if (directDbAccess === "true" || directDbAccess === "enabled") {
    return item("fail", "agent.sandbox", "Agent direct database access must stay disabled.");
  }

  if (enabled && !agentEnabled && !agentDisabled) {
    return item("fail", "agent.sandbox", "CUAC_AGENT_ENABLED must be true, enabled, false, or disabled.");
  }
  if (!enabled && strict) {
    return item("fail", "agent.sandbox", "Staging/production must explicitly set CUAC_AGENT_ENABLED to true or false.");
  }
  if (directDbAccess && !directDbAccessDisabled) {
    return item("fail", "agent.sandbox", "Agent direct database access setting must be false or disabled.");
  }
  if ((strict || agentEnabled) && !directDbAccessDisabled) {
    return item("fail", "agent.sandbox", "Agent runtime and staging/production must explicitly disable Agent direct database access.");
  }

  if (!enabled && !strict) {
    return item("pass", "agent.sandbox", "Agent is disabled by default; the local core platform does not depend on it.");
  }

  if (agentDisabled) {
    return item("pass", "agent.sandbox", "Agent is explicitly disabled; core platform release does not require Agent infrastructure.");
  }

  if (gatewayMode === "enforced" && (sandboxMode === "enabled" || sandboxMode === "enforced")) {
    return item("pass", "agent.sandbox", "Agent Tool Gateway and sandbox enforcement are configured.");
  }

  return item("fail", "agent.sandbox", "Enabled Agent runtime must use enforced Tool Gateway and sandbox mode.");
}

function checkBillingFeeSchedule(env: Record<string, string | undefined>, strict: boolean): ProductionReadinessItem {
  try {
    resolveBillingFeeSchedule(env);
    return item("pass", "billing.fee_schedule", "Billing fee schedule is explicitly configured with minor-unit amounts.");
  } catch {
    return item(
      strict ? "fail" : "warn",
      "billing.fee_schedule",
      "Billing fee schedule is missing or unsafe. Configure CUAC_APPLICATION_FEE_MINOR before enabling billing routes.",
    );
  }
}

function checkPaymentProvider(env: Record<string, string | undefined>,
  environment: ProductionReadinessReport["environment"]): ProductionReadinessItem {
  const mode = env.CUAC_PAYMENT_MODE === undefined ? "disabled" : normalize(env.CUAC_PAYMENT_MODE);
  const strict = environment === "staging" || environment === "production";

  if (mode === "disabled") {
    return item(strict ? "fail" : "warn", "billing.provider",
      "Payment delivery is disabled; staging/production requires the reviewed hosted gateway and reconciliation worker.");
  }

  if (mode !== "live" && mode !== "test") {
    return item("fail", "billing.provider", "CUAC_PAYMENT_MODE must be disabled, test, or live.");
  }

  if (environment === "production" && mode !== "live") {
    return item("fail", "billing.provider", "Production payment mode must be live after controlled staging acceptance.");
  }

  try {
    createPaymentProviderFromEnv(env);
    paymentReconciliationWorkerConfigFromEnv(env);
  } catch {
    return item("fail", "billing.provider",
      "Hosted payment gateway, checkout host, separated HMAC secrets, webhook and reconciliation configuration must be complete and valid.");
  }

  const accepted = [
    env.CUAC_PAYMENT_RECONCILIATION_WORKER_SUPERVISED,
    env.CUAC_PAYMENT_STAGING_ACCEPTED,
  ].every(value => normalize(value) === "true");
  return accepted
    ? item("pass", "billing.provider",
      "Hosted payment gateway configuration and staging acceptance attestations are present; runtime evidence remains separate.")
    : item(strict ? "fail" : "warn", "billing.provider",
      "Payment runtime is configured, but supervised reconciliation and a signed staging checkout-webhook-refund round trip must both be confirmed.");
}

function checkSecretManagement(
  env: Record<string, string | undefined>,
  environment: ProductionReadinessReport["environment"],
): ProductionReadinessItem {
  const secretManager = normalize(env.CUAC_SECRET_MANAGER);
  const kmsKeyId = env.ALIBABA_CLOUD_KMS_KEY_ID ?? env.ALIYUN_KMS_KEY_ID;

  if (environment === "development") {
    return item("pass", "secrets.manager", "KMS is not required for local development.");
  }

  if (secretManager === "aliyun-kms" || kmsKeyId) {
    return item("pass", "secrets.manager", "Alibaba Cloud KMS or secret manager posture is configured.");
  }

  return item(environment === "production" ? "fail" : "warn", "secrets.manager", "Alibaba Cloud KMS or secret manager should be configured.");
}

function checkFileStorage(env: Record<string, string | undefined>, strict: boolean): ProductionReadinessItem {
  const uploadsEnabled = env.CUAC_FILE_UPLOAD_ENABLED === undefined ? "false" : normalize(env.CUAC_FILE_UPLOAD_ENABLED);

  if (uploadsEnabled === "false") {
    return item(strict ? "fail" : "warn", "storage.private_files",
      "Sensitive file upload is disabled. Staging/production requires the reviewed private OSS file pipeline.");
  }

  if (uploadsEnabled !== "true") {
    return item("fail", "storage.private_files", "CUAC_FILE_UPLOAD_ENABLED must be true or false when set.");
  }

  try {
    const config = parsePrivateOssConfiguration(env);
    createClamAvScannerFromEnv(env);
    createStudentFileWorkerConfigurationFromEnv(env);
    parseStudentFileRetentionDays(env.CUAC_FILE_RETENTION_DAYS);
    const cloudRegion = normalize(env.ALIBABA_CLOUD_REGION ?? env.ALIYUN_REGION);
    if (!cloudRegion || config.region !== `oss-${cloudRegion}`) throw new Error();
  } catch {
    return item("fail", "storage.private_files",
      "Private OSS, KMS, ClamAV worker, retention and fixed-region credentials must be configured completely.");
  }

  const accepted = [
    env.CUAC_FILE_WORKER_SUPERVISED,
    env.CUAC_OSS_VERSIONING_CONFIRMED,
    env.CUAC_OSS_LIFECYCLE_CONFIRMED,
    env.CUAC_OSS_CORS_CONFIRMED,
    env.CUAC_FILE_STAGING_ACCEPTED,
  ].every(value => normalize(value) === "true");
  return accepted
    ? item("pass", "storage.private_files", "Private file pipeline configuration and staging acceptance attestations are present; runtime verification remains separate.")
    : item("fail", "storage.private_files",
      "Private file code is configured, but supervised worker, OSS versioning/lifecycle/CORS and staging upload-scan-download-delete acceptance must all be confirmed.");
}

function checkOfficialSubmissionDelivery(
  env: Record<string, string | undefined>,
  strict: boolean,
): ProductionReadinessItem {
  const provider = normalize(env.CUAC_SUBMISSION_DELIVERY_PROVIDER);
  if (!provider || provider === "disabled") {
    return item(strict ? "fail" : "warn", "submission.delivery",
      "Official submission delivery is disabled. Staging/production requires the reviewed handoff gateway and supervised worker.");
  }

  try {
    createOfficialSubmissionWorkerConfigurationFromEnv(env);
    resolveApplicationMaterialSnapshotCipher(env);
  } catch {
    return item("fail", "submission.delivery",
      "Official submission delivery provider, fixed HTTPS gateway, HMAC secret, worker and material snapshot keyring must be configured completely.");
  }

  const accepted = [
    env.CUAC_SUBMISSION_DELIVERY_WORKER_SUPERVISED,
    env.CUAC_SUBMISSION_DELIVERY_STAGING_ACCEPTED,
  ].every(value => normalize(value) === "true");
  return accepted
    ? item("pass", "submission.delivery",
      "Official submission gateway configuration and staging acceptance attestations are present; runtime evidence remains separate.")
    : item(strict ? "fail" : "warn", "submission.delivery",
      "Official submission delivery is configured, but supervised worker operation and a signed staging receipt round trip must both be confirmed.");
}

function item(status: ProductionReadinessStatus, id: string, message: string): ProductionReadinessItem {
  return { id, status, message };
}

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}
