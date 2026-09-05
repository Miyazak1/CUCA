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
  const { PostgresPaymentProviderEvents } = await import("../src/server/billing/postgres-payment-events.ts");
  const { paymentReconciliationWorkerConfigFromEnv, runPaymentReconciliationWorker } =
    await import("../src/server/billing/runtime/payment.ts");
  const config = paymentReconciliationWorkerConfigFromEnv();
  pool = createPostgresPool({ applicationName: "cuac:payment-reconciliation-worker", max: 4 });
  const events = new PostgresPaymentProviderEvents(createTransactionalSqlClient(pool));
  console.log(JSON.stringify({ event: "payment_reconciliation_worker.started", releaseGate: authorization.mode }));
  const summary = await runPaymentReconciliationWorker({ events, config, signal: controller.signal });
  console.log(JSON.stringify({ event: "payment_reconciliation_worker.stopped", ...summary }));
} catch {
  console.error("Payment reconciliation worker failed. Check protected payment configuration and service health.");
  process.exitCode = 1;
} finally {
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
  try { await pool?.end(); } catch { process.exitCode = 1; }
}

export {};
