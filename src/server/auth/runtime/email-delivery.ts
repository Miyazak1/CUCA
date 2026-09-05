import { createAliyunDirectMailSmtpProvider, type AliyunDirectMailSmtpConfig } from "../aliyun-directmail-smtp.ts";
import { validateAuthEmailDeliveryConfig, type AuthEmailDeliveryConfig } from "../email-delivery.ts";
import { processOneAuthEmail, type AuthEmailProvider } from "../email-outbox-worker.ts";
import { EmailTokenCipher } from "../email-token-envelope.ts";
import type { PostgresAuthEmailOutbox } from "../postgres-email-outbox.ts";
import { serviceUnavailable } from "../../shared/errors.ts";

export const AUTH_EMAIL_PROVIDER_ALIYUN_SMTP = "aliyun-directmail-smtp";

export type AuthEmailWorkerConfiguration = {
  delivery: AuthEmailDeliveryConfig;
  smtp: AliyunDirectMailSmtpConfig;
  cipher: EmailTokenCipher;
  pollIntervalMs: number;
  recoveryIntervalMs: number;
};

export type AuthEmailWorkerSummary = {
  recovered: number;
  accepted: number;
  notAccepted: number;
  unknown: number;
  skipped: number;
  unconfirmed: number;
};

type WorkerEvent =
  | { event: "auth_email_worker.recovery"; recovered: number }
  | { event: "auth_email_worker.batch"; processed: number };

type WorkerDependencies = {
  processOne?: typeof processOneAuthEmail;
  wait?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  now?: () => number;
  onEvent?: (event: WorkerEvent) => void;
};

export function createAuthEmailOutboxCipherFromEnv(
  env: Record<string, string | undefined> = process.env,
): EmailTokenCipher | undefined {
  const provider = normalizeProvider(env.CUAC_AUTH_EMAIL_DELIVERY_PROVIDER);
  if (provider === "disabled") return undefined;
  if (provider !== AUTH_EMAIL_PROVIDER_ALIYUN_SMTP) throw unsupportedProvider();
  return parseCipher(env);
}

export function createAuthEmailWorkerConfigurationFromEnv(
  env: Record<string, string | undefined> = process.env,
): AuthEmailWorkerConfiguration {
  const provider = normalizeProvider(env.CUAC_AUTH_EMAIL_DELIVERY_PROVIDER);
  if (provider !== AUTH_EMAIL_PROVIDER_ALIYUN_SMTP) throw unsupportedProvider();

  const delivery = validateAuthEmailDeliveryConfig({
    from: env.CUAC_AUTH_EMAIL_FROM,
    publicAppUrl: env.CUAC_PUBLIC_APP_URL,
    verificationPath: env.CUAC_AUTH_EMAIL_VERIFICATION_PATH,
    passwordResetPath: env.CUAC_AUTH_PASSWORD_RESET_PATH,
  });
  const smtp: AliyunDirectMailSmtpConfig = {
    ...delivery,
    region: required(env.CUAC_AUTH_EMAIL_SMTP_REGION, "region") as AliyunDirectMailSmtpConfig["region"],
    username: required(env.CUAC_AUTH_EMAIL_SMTP_USERNAME, "credentials"),
    password: requiredSecret(env.CUAC_AUTH_EMAIL_SMTP_PASSWORD),
  };
  // Constructing the provider performs the endpoint, sender and credential posture validation without opening a connection.
  createAliyunDirectMailSmtpProvider(smtp, { createTransport: () => ({ async sendMail() { return {}; } }) });

  return {
    delivery,
    smtp,
    cipher: parseCipher(env),
    pollIntervalMs: boundedInteger(env.CUAC_AUTH_EMAIL_WORKER_POLL_MS, 250, 60_000, 1_000),
    recoveryIntervalMs: boundedInteger(env.CUAC_AUTH_EMAIL_WORKER_RECOVERY_MS, 1_000, 300_000, 60_000),
  };
}

export function createAuthEmailProviderFromConfiguration(config: AuthEmailWorkerConfiguration): AuthEmailProvider {
  return createAliyunDirectMailSmtpProvider(config.smtp);
}

export async function runAuthEmailWorker(
  input: {
    outbox: PostgresAuthEmailOutbox;
    provider: AuthEmailProvider;
    config: AuthEmailWorkerConfiguration;
    signal: AbortSignal;
  },
  dependencies: WorkerDependencies = {},
): Promise<AuthEmailWorkerSummary> {
  const execute = dependencies.processOne ?? processOneAuthEmail;
  const wait = dependencies.wait ?? waitForSignal;
  const now = dependencies.now ?? Date.now;
  const summary: AuthEmailWorkerSummary = { recovered: 0, accepted: 0, notAccepted: 0, unknown: 0, skipped: 0, unconfirmed: 0 };
  let nextRecoveryAt = 0;

  while (!input.signal.aborted) {
    if (now() >= nextRecoveryAt) {
      const recovery = await input.outbox.recover(100);
      summary.recovered += recovery.recovered;
      dependencies.onEvent?.({ event: "auth_email_worker.recovery", recovered: recovery.recovered });
      nextRecoveryAt = now() + input.config.recoveryIntervalMs;
    }

    let processed = 0;
    while (!input.signal.aborted && processed < 100) {
      const result = await execute(input.outbox, input.provider, input.config.delivery);
      if (result.status === "idle") break;
      processed += 1;
      if (result.status === "accepted") summary.accepted += 1;
      else if (result.status === "not_accepted") summary.notAccepted += 1;
      else if (result.status === "unknown") summary.unknown += 1;
      else if (result.status === "skipped") summary.skipped += 1;
      else summary.unconfirmed += 1;
    }
    dependencies.onEvent?.({ event: "auth_email_worker.batch", processed });
    if (!input.signal.aborted) await wait(input.config.pollIntervalMs, input.signal);
  }

  return summary;
}

function parseCipher(env: Record<string, string | undefined>): EmailTokenCipher {
  const activeKeyId = required(env.CUAC_AUTH_EMAIL_OUTBOX_ACTIVE_KEY_ID, "encryption key");
  const raw = requiredSecret(env.CUAC_AUTH_EMAIL_OUTBOX_KEYS_JSON);
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw invalidCipher(); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw invalidCipher();
  const entries = Object.entries(parsed);
  if (entries.length < 1 || entries.length > 8) throw invalidCipher();
  const keys = new Map<string, Uint8Array>();
  for (const [keyId, value] of entries) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) throw invalidCipher();
    const decoded = Buffer.from(value, "base64url");
    if (decoded.byteLength !== 32 || decoded.toString("base64url") !== value) throw invalidCipher();
    keys.set(keyId, decoded);
  }
  try { return new EmailTokenCipher({ activeKeyId, keys }); }
  catch { throw invalidCipher(); }
}

function normalizeProvider(value: string | undefined): string {
  return (value ?? "disabled").trim().toLowerCase() || "disabled";
}

function required(value: string | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized || normalized.length > 512 || hasControlCharacter(normalized)) {
    throw serviceUnavailable(`Auth email ${label} is not configured correctly.`);
  }
  return normalized;
}

function requiredSecret(value: string | undefined): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 4_096 || hasControlCharacter(value)) {
    throw serviceUnavailable("Auth email protected configuration is not available.");
  }
  return value;
}

function boundedInteger(value: string | undefined, minimum: number, maximum: number, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  if (!/^\d+$/.test(value)) throw serviceUnavailable("Auth email worker timing is not configured correctly.");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw serviceUnavailable("Auth email worker timing is not configured correctly.");
  }
  return parsed;
}

function waitForSignal(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise(resolve => {
    const timeout = setTimeout(done, milliseconds);
    signal.addEventListener("abort", done, { once: true });
    function done() {
      clearTimeout(timeout);
      signal.removeEventListener("abort", done);
      resolve();
    }
  });
}

function unsupportedProvider() {
  return serviceUnavailable("Auth email delivery requires the reviewed Aliyun Direct Mail SMTP provider.");
}

function invalidCipher() {
  return serviceUnavailable("Auth email outbox encryption keys are not configured correctly.");
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}
