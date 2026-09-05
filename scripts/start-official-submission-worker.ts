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
  const { resolveApplicationMaterialSnapshotCipher } = await import("../src/server/student/application-material-snapshot-envelope.ts");
  const { PostgresOfficialSubmissionOutbox } = await import("../src/server/submission-delivery/postgres-outbox.ts");
  const {
    createOfficialSubmissionProviderFromEnv,
    createOfficialSubmissionWorkerConfigurationFromEnv,
    runOfficialSubmissionWorker,
  } = await import("../src/server/submission-delivery/runtime.ts");

  const config = createOfficialSubmissionWorkerConfigurationFromEnv();
  const provider = createOfficialSubmissionProviderFromEnv();
  const cipher = resolveApplicationMaterialSnapshotCipher();
  pool = createPostgresPool({ applicationName: "cuac:official-submission-worker", max: 4 });
  const outbox = new PostgresOfficialSubmissionOutbox(createTransactionalSqlClient(pool), cipher);
  console.log(JSON.stringify({ event: "official_submission_worker.started", provider: provider.name, releaseGate: authorization.mode }));
  const summary = await runOfficialSubmissionWorker({ outbox, provider, config, signal: controller.signal }, {
    onEvent(event) {
      if (event.event === "official_submission_worker.recovery"
        && (event.recovered > 0 || event.quarantined > 0)) console.log(JSON.stringify(event));
    },
  });
  console.log(JSON.stringify({ event: "official_submission_worker.stopped", ...summary }));
} catch {
  console.error("Official submission worker failed. Check protected delivery configuration and service health.");
  process.exitCode = 1;
} finally {
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
  try { await pool?.end(); } catch { process.exitCode = 1; }
}

export {};
