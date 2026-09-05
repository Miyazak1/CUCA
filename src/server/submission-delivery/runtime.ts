import { serviceUnavailable } from "../shared/errors.ts";
import {
  OFFICIAL_SUBMISSION_PROVIDER_HANDOFF_HTTP,
  createOfficialSubmissionHttpProvider,
  officialSubmissionHttpProviderConfigFromEnv,
} from "./http-provider.ts";
import type { PostgresOfficialSubmissionOutbox } from "./postgres-outbox.ts";
import { processOneOfficialSubmission, type OfficialSubmissionProvider } from "./worker.ts";

export type OfficialSubmissionWorkerConfiguration = {
  providerName: typeof OFFICIAL_SUBMISSION_PROVIDER_HANDOFF_HTTP;
  pollIntervalMs: number;
  recoveryIntervalMs: number;
  timeoutMs: number;
};

export type OfficialSubmissionWorkerSummary = {
  recovered: number;
  quarantined: number;
  accepted: number;
  notAccepted: number;
  unknown: number;
  skipped: number;
  unconfirmed: number;
};

type WorkerDependencies = {
  processOne?: typeof processOneOfficialSubmission;
  wait?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  now?: () => number;
  onEvent?: (event: { event: "official_submission_worker.recovery"; recovered: number; quarantined: number }
    | { event: "official_submission_worker.batch"; processed: number }) => void;
};

export function createOfficialSubmissionWorkerConfigurationFromEnv(
  env: Record<string, string | undefined> = process.env,
): OfficialSubmissionWorkerConfiguration {
  const providerName = (env.CUAC_SUBMISSION_DELIVERY_PROVIDER ?? "disabled").trim().toLowerCase();
  if (providerName !== OFFICIAL_SUBMISSION_PROVIDER_HANDOFF_HTTP) throw unsupported();
  officialSubmissionHttpProviderConfigFromEnv(env);
  return {
    providerName,
    pollIntervalMs: boundedInteger(env.CUAC_SUBMISSION_DELIVERY_WORKER_POLL_MS, 250, 60_000, 1_000),
    recoveryIntervalMs: boundedInteger(env.CUAC_SUBMISSION_DELIVERY_RECOVERY_MS, 1_000, 300_000, 60_000),
    timeoutMs: boundedInteger(env.CUAC_SUBMISSION_DELIVERY_TIMEOUT_MS, 1_000, 120_000, 30_000),
  };
}

export function createOfficialSubmissionProviderFromEnv(
  env: Record<string, string | undefined> = process.env,
): OfficialSubmissionProvider {
  const config = createOfficialSubmissionWorkerConfigurationFromEnv(env);
  if (config.providerName !== OFFICIAL_SUBMISSION_PROVIDER_HANDOFF_HTTP) throw unsupported();
  return createOfficialSubmissionHttpProvider(officialSubmissionHttpProviderConfigFromEnv(env));
}

export async function runOfficialSubmissionWorker(input: {
  outbox: PostgresOfficialSubmissionOutbox;
  provider: OfficialSubmissionProvider;
  config: OfficialSubmissionWorkerConfiguration;
  signal: AbortSignal;
}, dependencies: WorkerDependencies = {}): Promise<OfficialSubmissionWorkerSummary> {
  const execute = dependencies.processOne ?? processOneOfficialSubmission;
  const wait = dependencies.wait ?? waitForSignal;
  const now = dependencies.now ?? Date.now;
  const summary: OfficialSubmissionWorkerSummary = {
    recovered: 0, quarantined: 0, accepted: 0, notAccepted: 0, unknown: 0, skipped: 0, unconfirmed: 0,
  };
  let nextRecoveryAt = 0;
  while (!input.signal.aborted) {
    if (now() >= nextRecoveryAt) {
      const recovery = await input.outbox.recover(100);
      summary.recovered += recovery.recovered;
      summary.quarantined += recovery.quarantined;
      dependencies.onEvent?.({ event: "official_submission_worker.recovery", ...recovery });
      nextRecoveryAt = now() + input.config.recoveryIntervalMs;
    }
    let processed = 0;
    while (!input.signal.aborted && processed < 100) {
      const result = await execute(input.outbox, input.provider, input.config.timeoutMs);
      if (result.status === "idle") break;
      processed += 1;
      if (result.status === "accepted") summary.accepted += 1;
      else if (result.status === "not_accepted") summary.notAccepted += 1;
      else if (result.status === "unknown") summary.unknown += 1;
      else if (result.status === "skipped") summary.skipped += 1;
      else summary.unconfirmed += 1;
    }
    dependencies.onEvent?.({ event: "official_submission_worker.batch", processed });
    if (!input.signal.aborted) await wait(input.config.pollIntervalMs, input.signal);
  }
  return summary;
}

function boundedInteger(value: string | undefined, minimum: number, maximum: number, fallback: number) {
  if (value === undefined || value === "") return fallback;
  if (!/^\d+$/.test(value)) throw unsupported();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) throw unsupported();
  return parsed;
}

function waitForSignal(milliseconds: number, signal: AbortSignal) {
  if (signal.aborted) return Promise.resolve();
  return new Promise<void>(resolve => {
    const timeout = setTimeout(done, milliseconds);
    signal.addEventListener("abort", done, { once: true });
    function done() {
      clearTimeout(timeout);
      signal.removeEventListener("abort", done);
      resolve();
    }
  });
}

function unsupported() {
  return serviceUnavailable("Official submission delivery requires the reviewed handoff gateway provider.");
}
