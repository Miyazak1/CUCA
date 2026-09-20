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
  const { PostgresRetentionProcessor } = await import("../src/server/retention/postgres-retention.ts");
  const { retentionWorkerConfigFromEnv, runRetentionWorker } = await import("../src/server/retention/runtime/worker.ts");
  const config = retentionWorkerConfigFromEnv();
  pool = createPostgresPool({ applicationName: "cuac:retention-worker", max: 2 });
  const processor = new PostgresRetentionProcessor(createTransactionalSqlClient(pool));
  console.log(JSON.stringify({ event: "retention_worker.started", releaseGate: authorization.mode }));
  const summary = await runRetentionWorker({ processor, config, signal: controller.signal }, {
    onBatch(result) {
      if (result.processed > 0) console.log(JSON.stringify({ event: "retention_worker.batch", ...result }));
    },
  });
  console.log(JSON.stringify({ event: "retention_worker.stopped", ...summary }));
} catch {
  console.error("Retention worker failed. Check protected database configuration and service health.");
  process.exitCode = 1;
} finally {
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
  try { await pool?.end(); } catch { process.exitCode = 1; }
}

export {};
