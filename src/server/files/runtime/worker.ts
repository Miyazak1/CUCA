import { serviceUnavailable } from "../../shared/errors.ts";
import type { PrivateFileScanner } from "../clamav-scanner.ts";
import type { PrivateObjectStorage } from "../private-object-storage.ts";
import { processOneStudentFileJob, type PostgresStudentFileJobs } from "../postgres-student-file-jobs.ts";

export type StudentFileWorkerConfiguration = {
  pollIntervalMs: number;
  recoveryIntervalMs: number;
  retentionIntervalMs: number;
};

export type StudentFileWorkerSummary = {
  recovered: number;
  retentionEnqueued: number;
  expiredUploadsEnqueued: number;
  scanned: number;
  scanUnconfirmed: number;
  deleted: number;
  deleteRetries: number;
  deleteUnconfirmed: number;
};

type WorkerDependencies = {
  processOne?: typeof processOneStudentFileJob;
  wait?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  now?: () => number;
  onEvent?: (event: { event: "student_file_worker.recovery"; recovered: number; retentionEnqueued: number; expiredUploadsEnqueued: number }
    | { event: "student_file_worker.batch"; processed: number }) => void;
};

export function createStudentFileWorkerConfigurationFromEnv(
  env: Record<string, string | undefined> = process.env,
): StudentFileWorkerConfiguration {
  return {
    pollIntervalMs: boundedInteger(env.CUAC_FILE_WORKER_POLL_MS, 250, 60_000, 1_000),
    recoveryIntervalMs: boundedInteger(env.CUAC_FILE_WORKER_RECOVERY_MS, 1_000, 300_000, 60_000),
    retentionIntervalMs: boundedInteger(env.CUAC_FILE_WORKER_RETENTION_MS, 60_000, 86_400_000, 3_600_000),
  };
}

export async function runStudentFileWorker(
  input: {
    jobs: PostgresStudentFileJobs;
    storage: PrivateObjectStorage;
    scanner: PrivateFileScanner;
    config: StudentFileWorkerConfiguration;
    signal: AbortSignal;
  },
  dependencies: WorkerDependencies = {},
): Promise<StudentFileWorkerSummary> {
  const execute = dependencies.processOne ?? processOneStudentFileJob;
  const wait = dependencies.wait ?? waitForSignal;
  const now = dependencies.now ?? Date.now;
  const summary: StudentFileWorkerSummary = {
    recovered: 0, retentionEnqueued: 0, expiredUploadsEnqueued: 0, scanned: 0, scanUnconfirmed: 0,
    deleted: 0, deleteRetries: 0, deleteUnconfirmed: 0,
  };
  let nextRecoveryAt = 0;
  let nextRetentionAt = 0;
  while (!input.signal.aborted) {
    let recovered = 0;
    let retentionEnqueued = 0;
    let expiredUploadsEnqueued = 0;
    if (now() >= nextRecoveryAt) {
      recovered = (await input.jobs.recover(100)).recovered;
      summary.recovered += recovered;
      nextRecoveryAt = now() + input.config.recoveryIntervalMs;
    }
    if (now() >= nextRetentionAt) {
      retentionEnqueued = (await input.jobs.enqueueExpiredRetention(100)).enqueued;
      expiredUploadsEnqueued = (await input.jobs.enqueueExpiredUploads(100)).enqueued;
      summary.retentionEnqueued += retentionEnqueued;
      summary.expiredUploadsEnqueued += expiredUploadsEnqueued;
      nextRetentionAt = retentionEnqueued === 100 || expiredUploadsEnqueued === 100 ? now() : now() + input.config.retentionIntervalMs;
    }
    dependencies.onEvent?.({ event: "student_file_worker.recovery", recovered, retentionEnqueued, expiredUploadsEnqueued });

    let processed = 0;
    while (!input.signal.aborted && processed < 100) {
      const result = await execute(input.jobs, input.storage, input.scanner, { preferDelete: processed % 2 === 1 });
      if (result.status === "idle") break;
      processed += 1;
      if (result.status === "scanned") summary.scanned += 1;
      else if (result.status === "scan_unconfirmed") summary.scanUnconfirmed += 1;
      else if (result.status === "deleted") summary.deleted += 1;
      else if (result.status === "delete_retry") summary.deleteRetries += 1;
      else summary.deleteUnconfirmed += 1;
    }
    dependencies.onEvent?.({ event: "student_file_worker.batch", processed });
    if (!input.signal.aborted) await wait(input.config.pollIntervalMs, input.signal);
  }
  return summary;
}

function boundedInteger(value: string | undefined, minimum: number, maximum: number, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  if (!/^\d+$/.test(value)) throw serviceUnavailable("Student file worker timing is not configured correctly.");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw serviceUnavailable("Student file worker timing is not configured correctly.");
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
