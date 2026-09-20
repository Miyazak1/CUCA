import { serviceUnavailable } from "../../shared/errors.ts";
import type { RetentionBatchSummary } from "../postgres-retention.ts";

export type RetentionWorkerConfiguration = { pollIntervalMs: number; batchSize: number };
export type RetentionProcessor = { processBatch(limit: number): Promise<RetentionBatchSummary> };

export function retentionWorkerConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): RetentionWorkerConfiguration {
  return {
    pollIntervalMs: boundedInteger(env.CUAC_RETENTION_WORKER_POLL_MS, 60_000, 86_400_000, 3_600_000),
    batchSize: boundedInteger(env.CUAC_RETENTION_WORKER_BATCH_SIZE, 1, 500, 100),
  };
}

export async function runRetentionWorker(input: {
  processor: RetentionProcessor;
  config: RetentionWorkerConfiguration;
  signal: AbortSignal;
}, dependencies: {
  wait?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  onBatch?: (result: RetentionBatchSummary) => void;
} = {}): Promise<{ passes: number; processed: number }> {
  const wait = dependencies.wait ?? waitForSignal;
  const summary = { passes: 0, processed: 0 };
  while (!input.signal.aborted) {
    const result = await input.processor.processBatch(input.config.batchSize);
    summary.passes += 1;
    summary.processed += result.processed;
    dependencies.onBatch?.(result);
    if (!input.signal.aborted) {
      await wait(result.processed >= input.config.batchSize ? 1_000 : input.config.pollIntervalMs, input.signal);
    }
  }
  return summary;
}

function boundedInteger(value: string | undefined, minimum: number, maximum: number, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  if (!/^\d+$/.test(value)) throw serviceUnavailable("Retention worker timing is invalid.");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw serviceUnavailable("Retention worker timing is invalid.");
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
