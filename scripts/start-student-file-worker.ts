import type pg from "pg";

Object.assign(process.env, { NODE_ENV: "production" });

const controller = new AbortController();
const stop = () => controller.abort();
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

let pool: pg.Pool | undefined;
try {
  const { authorizeWorkerStartup } = await import("./lib/worker-startup.ts");
  const authorization = await authorizeWorkerStartup(process.argv.slice(2));
  const { createPostgresPool, createTransactionalSqlClient } = await import("../src/server/db/postgres-client.ts");
  const { createClamAvScannerFromEnv } = await import("../src/server/files/clamav-scanner.ts");
  const { createPrivateOssStorageFromEnv } = await import("../src/server/files/private-object-storage.ts");
  const { PostgresStudentFileJobs } = await import("../src/server/files/postgres-student-file-jobs.ts");
  const { createStudentFileWorkerConfigurationFromEnv, runStudentFileWorker } = await import("../src/server/files/runtime/worker.ts");

  const { storage } = createPrivateOssStorageFromEnv();
  const scanner = createClamAvScannerFromEnv();
  const config = createStudentFileWorkerConfigurationFromEnv();
  pool = createPostgresPool({ applicationName: "cuac:student-file-worker", max: 4 });
  const jobs = new PostgresStudentFileJobs(createTransactionalSqlClient(pool));
  console.log(JSON.stringify({ event: "student_file_worker.started", releaseGate: authorization.mode }));
  const summary = await runStudentFileWorker({ jobs, storage, scanner, config, signal: controller.signal }, {
    onEvent(event) {
      if (event.event === "student_file_worker.recovery"
        && (event.recovered > 0 || event.retentionEnqueued > 0 || event.expiredUploadsEnqueued > 0)) {
        console.log(JSON.stringify(event));
      }
    },
  });
  console.log(JSON.stringify({ event: "student_file_worker.stopped", ...summary }));
} catch {
  console.error("Student file worker failed. Check protected runtime configuration and service health.");
  process.exitCode = 1;
} finally {
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
  try { await pool?.end(); }
  catch { process.exitCode = 1; }
}

export {};
