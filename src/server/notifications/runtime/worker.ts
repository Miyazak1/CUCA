import type { AliyunDirectMailRegion } from "../../auth/aliyun-directmail-smtp.ts";
import { serviceUnavailable } from "../../shared/errors.ts";
import { createNotificationAliyunDirectMailProvider, type NotificationAliyunDirectMailConfig } from "../aliyun-directmail-smtp.ts";
import type { PostgresNotificationDeliveryQueue } from "../delivery-queue.ts";
import { processOneNotificationDelivery, type NotificationProviderFacade } from "../worker.ts";

export const NOTIFICATION_EMAIL_PROVIDER_ALIYUN_SMTP = "aliyun-directmail-smtp";

export type NotificationWorkerConfiguration = {
  email: NotificationAliyunDirectMailConfig;
  pollIntervalMs: number;
  recoveryIntervalMs: number;
};

export type NotificationWorkerSummary = {
  recovered: number;
  accepted: number;
  notAccepted: number;
  unknown: number;
  skipped: number;
  unconfirmed: number;
};

type WorkerEvent =
  | { event: "notification_worker.recovery"; recovered: number }
  | { event: "notification_worker.batch"; processed: number };

type WorkerDependencies = {
  processOne?: typeof processOneNotificationDelivery;
  wait?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  now?: () => number;
  onEvent?: (event: WorkerEvent) => void;
};

export function createNotificationWorkerConfigurationFromEnv(
  env: Record<string, string | undefined> = process.env,
): NotificationWorkerConfiguration {
  const provider = normalize(env.CUAC_NOTIFICATION_EMAIL_PROVIDER);
  if (provider !== NOTIFICATION_EMAIL_PROVIDER_ALIYUN_SMTP) {
    throw serviceUnavailable("Notification delivery requires the reviewed Aliyun Direct Mail SMTP provider.");
  }
  const email: NotificationAliyunDirectMailConfig = {
    from: required(env.CUAC_NOTIFICATION_EMAIL_FROM, "sender"),
    publicAppUrl: required(env.CUAC_PUBLIC_APP_URL, "public origin"),
    region: required(env.CUAC_NOTIFICATION_EMAIL_SMTP_REGION, "SMTP region") as AliyunDirectMailRegion,
    username: required(env.CUAC_NOTIFICATION_EMAIL_SMTP_USERNAME, "SMTP username"),
    password: requiredSecret(env.CUAC_NOTIFICATION_EMAIL_SMTP_PASSWORD),
  };
  // Provider construction validates the fixed endpoint, origin and sender posture without opening a connection.
  createNotificationAliyunDirectMailProvider(email, { createTransport: () => ({ async sendMail() { return {}; } }) });
  return {
    email,
    pollIntervalMs: boundedInteger(env.CUAC_NOTIFICATION_WORKER_POLL_MS, 250, 60_000, 1_000),
    recoveryIntervalMs: boundedInteger(env.CUAC_NOTIFICATION_WORKER_RECOVERY_MS, 1_000, 300_000, 60_000),
  };
}

export function createNotificationProviderFromConfiguration(config: NotificationWorkerConfiguration): NotificationProviderFacade {
  return createNotificationAliyunDirectMailProvider(config.email);
}

export async function runNotificationWorker(input: {
  queue: PostgresNotificationDeliveryQueue;
  provider: NotificationProviderFacade;
  config: NotificationWorkerConfiguration;
  signal: AbortSignal;
}, dependencies: WorkerDependencies = {}): Promise<NotificationWorkerSummary> {
  const execute = dependencies.processOne ?? processOneNotificationDelivery;
  const wait = dependencies.wait ?? waitForSignal;
  const now = dependencies.now ?? Date.now;
  const summary: NotificationWorkerSummary = {
    recovered: 0, accepted: 0, notAccepted: 0, unknown: 0, skipped: 0, unconfirmed: 0,
  };
  let nextRecoveryAt = 0;

  while (!input.signal.aborted) {
    if (now() >= nextRecoveryAt) {
      const recovery = await input.queue.recover(100);
      summary.recovered += recovery.recovered;
      dependencies.onEvent?.({ event: "notification_worker.recovery", recovered: recovery.recovered });
      nextRecoveryAt = now() + input.config.recoveryIntervalMs;
    }

    let processed = 0;
    while (!input.signal.aborted && processed < 100) {
      const result = await execute(input.queue, input.provider);
      if (result.status === "idle") break;
      processed += 1;
      if (result.status === "accepted") summary.accepted += 1;
      else if (result.status === "not_accepted") summary.notAccepted += 1;
      else if (result.status === "unknown") summary.unknown += 1;
      else if (result.status === "skipped") summary.skipped += 1;
      else summary.unconfirmed += 1;
    }
    dependencies.onEvent?.({ event: "notification_worker.batch", processed });
    if (!input.signal.aborted) await wait(input.config.pollIntervalMs, input.signal);
  }
  return summary;
}

function normalize(value: string | undefined): string {
  return (value ?? "disabled").trim().toLowerCase() || "disabled";
}

function required(value: string | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized || normalized.length > 512 || hasControlCharacter(normalized)) {
    throw serviceUnavailable(`Notification email ${label} is not configured correctly.`);
  }
  return normalized;
}

function requiredSecret(value: string | undefined): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 4_096 || hasControlCharacter(value)) {
    throw serviceUnavailable("Notification email protected configuration is not available.");
  }
  return value;
}

function boundedInteger(value: string | undefined, minimum: number, maximum: number, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  if (!/^\d+$/.test(value)) throw serviceUnavailable("Notification worker timing is not configured correctly.");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw serviceUnavailable("Notification worker timing is not configured correctly.");
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

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}
