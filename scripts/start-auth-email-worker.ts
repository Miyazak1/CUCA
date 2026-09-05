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
  const { PostgresAuthEmailOutbox } = await import("../src/server/auth/postgres-email-outbox.ts");
  const {
    createAuthEmailProviderFromConfiguration,
    createAuthEmailWorkerConfigurationFromEnv,
    runAuthEmailWorker,
  } = await import("../src/server/auth/runtime/email-delivery.ts");

  const config = createAuthEmailWorkerConfigurationFromEnv();
  pool = createPostgresPool({ applicationName: "cuac:auth-email-worker", max: 4 });
  const outbox = new PostgresAuthEmailOutbox(createTransactionalSqlClient(pool), config.cipher);
  const provider = createAuthEmailProviderFromConfiguration(config);
  console.log(JSON.stringify({ event: "auth_email_worker.started", releaseGate: authorization.mode }));
  const summary = await runAuthEmailWorker({ outbox, provider, config, signal: controller.signal }, {
    onEvent(event) {
      if (event.event === "auth_email_worker.recovery" && event.recovered > 0) console.log(JSON.stringify(event));
    },
  });
  console.log(JSON.stringify({ event: "auth_email_worker.stopped", ...summary }));
} catch {
  console.error("Auth email worker failed. Check protected runtime configuration and service health.");
  process.exitCode = 1;
} finally {
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
  try { await pool?.end(); }
  catch { process.exitCode = 1; }
}

export {};
