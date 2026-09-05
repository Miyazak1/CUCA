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
  const { PostgresNotificationDeliveryQueue } = await import("../src/server/notifications/delivery-queue.ts");
  const {
    createNotificationProviderFromConfiguration,
    createNotificationWorkerConfigurationFromEnv,
    runNotificationWorker,
  } = await import("../src/server/notifications/runtime/worker.ts");

  const config = createNotificationWorkerConfigurationFromEnv();
  const provider = createNotificationProviderFromConfiguration(config);
  pool = createPostgresPool({ applicationName: "cuac:notification-worker", max: 4 });
  const queue = new PostgresNotificationDeliveryQueue(createTransactionalSqlClient(pool));
  console.log(JSON.stringify({ event: "notification_worker.started", releaseGate: authorization.mode }));
  const summary = await runNotificationWorker({ queue, provider, config, signal: controller.signal }, {
    onEvent(event) {
      if (event.event === "notification_worker.recovery" && event.recovered > 0) console.log(JSON.stringify(event));
    },
  });
  console.log(JSON.stringify({ event: "notification_worker.stopped", ...summary }));
} catch {
  console.error("Notification worker failed. Check protected delivery configuration and service health.");
  process.exitCode = 1;
} finally {
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
  try { await pool?.end(); } catch { process.exitCode = 1; }
}

export {};
