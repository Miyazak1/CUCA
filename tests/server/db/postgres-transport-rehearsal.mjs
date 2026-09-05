import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { closeSharedPostgresPool, createPostgresPool, createTransactionalSqlClient, getPostgresPoolDiagnostics, getSharedPostgresPool, probePostgresPool } from "../../../src/server/db/postgres-client.ts";
import { createHealthHttpHandlers } from "../../../src/server/health/http.ts";

async function eventually(check) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (await check()) return;
    await delay(20);
  }
  assert.fail("PostgreSQL transport condition was not observed within 3 seconds.");
}

export async function runPostgresTransportRehearsal(t, admin, databaseUrl) {
  const config = { databaseUrl, max: 1, connectionTimeoutMillis: 200, applicationName: "cuac:transport-rehearsal" };
  const appPool = getSharedPostgresPool(config);
  const client = createTransactionalSqlClient(appPool);
  const health = createHealthHttpHandlers({ env: { DATABASE_URL: databaseUrl }, databaseProbe: () => probePostgresPool(appPool) });
  await admin.query("create table cuac_transport_rehearsal (id text primary key, kind text not null)");
  try {
    await t.test("application shared pool survives idle termination and reconnects without replay", async () => {
      const pid = (await appPool.query("select pg_backend_pid() as pid")).rows[0].pid;
      assert.equal((await health.getHealth()).status, 200);
      assert.equal((await admin.query("select pg_terminate_backend($1) as terminated", [pid])).rows[0].terminated, true);
      await eventually(() => getPostgresPoolDiagnostics(appPool).idleConnectionErrors > 0);
      assert.equal(getSharedPostgresPool(config), appPool);
      const replacement = (await appPool.query("select pg_backend_pid() as pid")).rows[0].pid;
      assert.notEqual(replacement, pid);
      assert.equal((await health.getHealth()).status, 200);
      assert.equal(appPool.waitingCount, 0);
    });

    await t.test("checked-out loss between queries rejects without committing business or audit", async () => {
      const id = randomUUID();
      let attempts = 0;
      await assert.rejects(client.transaction(async tx => {
        attempts += 1;
        const [{ pid }] = await tx.query("select pg_backend_pid() as pid", []);
        await tx.query("insert into cuac_transport_rehearsal values ($1, 'business'), ($2, 'audit')", [id, id + "-audit"]);
        await admin.query("select pg_terminate_backend($1)", [pid]);
        // No error observer is added by this test: the application adapter must handle the event.
        await delay(100);
        return "must not commit";
      }));
      assert.equal(attempts, 1);
      assert.equal((await admin.query("select * from cuac_transport_rehearsal where id like $1", [id + "%"])).rowCount, 0);
      assert.equal(await probePostgresPool(appPool), true);
      assert.equal(appPool.totalCount, appPool.idleCount);
    });

    await t.test("active SQL termination rolls back and a later explicit request uses a new connection", async () => {
      const id = randomUUID();
      let pid;
      const work = client.transaction(async tx => {
        [{ pid }] = await tx.query("select pg_backend_pid() as pid", []);
        await tx.query("insert into cuac_transport_rehearsal values ($1, 'business')", [id]);
        await tx.query("select pg_sleep(10)", []);
      });
      const rejected = assert.rejects(work);
      await eventually(async () => pid && (await admin.query("select 1 from pg_stat_activity where pid = $1 and wait_event = 'PgSleep'", [pid])).rowCount === 1);
      await admin.query("select pg_terminate_backend($1)", [pid]);
      await rejected;
      assert.equal((await admin.query("select * from cuac_transport_rehearsal where id = $1", [id])).rowCount, 0);
      const [retry] = await client.transaction(tx => tx.query("select pg_backend_pid() as pid", []));
      assert.notEqual(retry.pid, pid);
    });

    await t.test("pool saturation produces bounded unhealthy readiness and drains its waiter", async () => {
      const held = await appPool.connect();
      try {
        const started = performance.now();
        const response = await health.getHealth();
        assert.equal(response.status, 503);
        assert.equal((await response.json()).database.reachable, false);
        assert.ok(performance.now() - started < 3000);
        assert.equal(appPool.waitingCount, 0);
      } finally { held.release(); }
      assert.equal((await health.getHealth()).status, 200);
    });

    await t.test("client read timeout destroys the connection and leaves no late writes", async () => {
      const timedPool = createPostgresPool({ ...config, queryTimeoutMillis: 150, statementTimeoutMillis: 1000 });
      const timedClient = createTransactionalSqlClient(timedPool);
      const id = randomUUID();
      let pid;
      try {
        await assert.rejects(timedClient.transaction(async tx => {
          [{ pid }] = await tx.query("select pg_backend_pid() as pid", []);
          await tx.query("insert into cuac_transport_rehearsal values ($1, 'business')", [id]);
          await tx.query("select pg_sleep(10)", []);
        }), /Query read timeout/);
        assert.equal(timedPool.totalCount, 0);
        // Socket closure does not instantly cancel server execution; statement_timeout bounds it.
        await eventually(async () => (await admin.query("select 1 from pg_stat_activity where pid = $1", [pid])).rowCount === 0);
        assert.equal((await admin.query("select * from cuac_transport_rehearsal where id = $1", [id])).rowCount, 0);
        assert.equal(await probePostgresPool(timedPool), true);
      } finally { await timedPool.end(); }
    });

    await t.test("server statement timeout rolls back SQL and preserves a healthy connection", async () => {
      const timedPool = createPostgresPool({ ...config, statementTimeoutMillis: 150, queryTimeoutMillis: 5000 });
      const id = randomUUID();
      let pid;
      try {
        await assert.rejects(createTransactionalSqlClient(timedPool).transaction(async tx => {
          [{ pid }] = await tx.query("select pg_backend_pid() as pid", []);
          await tx.query("insert into cuac_transport_rehearsal values ($1, 'business')", [id]);
          await tx.query("select pg_sleep(10)", []);
        }), error => error.code === "57014");
        assert.equal((await admin.query("select * from cuac_transport_rehearsal where id = $1", [id])).rowCount, 0);
        assert.equal((await timedPool.query("select pg_backend_pid() as pid")).rows[0].pid, pid);
      } finally { await timedPool.end(); }
    });

    await t.test("lost commit acknowledgement stays ambiguous and never reruns the transaction", async () => {
      let attempts = 0;
      const id = randomUUID();
      const adapter = createTransactionalSqlClient({
        query: appPool.query.bind(appPool),
        async connect() {
          const connection = await appPool.connect();
          return {
            on: connection.on.bind(connection), removeListener: connection.removeListener.bind(connection),
            release: connection.release.bind(connection),
            async query(sql, params) {
              const result = await connection.query(sql, params);
              if (sql === "commit") throw Object.assign(new Error("Synthetic lost COMMIT acknowledgement"), { code: "ECONNRESET" });
              return result;
            },
          };
        },
      });
      await assert.rejects(adapter.transaction(async tx => {
        attempts += 1;
        await tx.query("insert into cuac_transport_rehearsal values ($1, 'business'), ($2, 'audit')", [id, id + "-audit"]);
      }), /lost COMMIT acknowledgement/);
      assert.equal(attempts, 1);
      assert.equal((await admin.query("select * from cuac_transport_rehearsal where id like $1", [id + "%"])).rowCount, 2);
      assert.equal(await probePostgresPool(appPool), true);
    });

    await t.test("shared shutdown rejects new acquisitions, waits for release, and closes all clients", async () => {
      const held = await appPool.connect();
      const closing = closeSharedPostgresPool();
      try {
        assert.throws(() => getSharedPostgresPool(config), /shutting down/);
        assert.equal(await probePostgresPool(appPool), false);
        await assert.rejects(appPool.connect(), /end on the pool/);
      } finally { held.release(); }
      await Promise.all([closing, closeSharedPostgresPool()]);
      assert.equal(appPool.ended, true);
      assert.equal(appPool.totalCount, 0);
      assert.equal(appPool.waitingCount, 0);
      const replacement = getSharedPostgresPool(config);
      assert.notEqual(replacement, appPool);
      assert.equal(await probePostgresPool(replacement), true);
    });
  } finally {
    await closeSharedPostgresPool();
    await admin.query("drop table cuac_transport_rehearsal");
  }
}
