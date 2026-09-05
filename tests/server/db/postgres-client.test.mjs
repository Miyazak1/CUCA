import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { assertSafePostgresConnectionString, closeSharedPostgresPool, createPostgresPool, createSqlCatalogClient, createTransactionalSqlClient, getDatabaseUrl } from "../../../src/server/index.ts";
import { getPostgresPoolDiagnostics, getSharedPostgresPool, probePostgresPool } from "../../../src/server/db/postgres-client.ts";
import { transactionalMethod } from "../../../src/server/db/transactional-method.ts";

function transactionFixture(query = async () => ({ rows: [] })) {
  const calls = [];
  const client = createTransactionalSqlClient({
    query() { throw new Error("Transaction escaped to the pool"); },
    async connect() { return {
      async query(statement, params) { calls.push(statement); return query(statement, params); },
      release(discard) { calls.push({ discard }); },
    }; },
  });
  return { client, calls };
}

test("nested repository transactions join the outer service transaction and never commit early", async () => {
  const { client, calls } = transactionFixture();
  await client.transaction(async (tx) => {
    await tx.query("business before", []);
    await tx.transaction(async (nested) => {
      assert.equal(nested, tx);
      await nested.query("business inner", []);
    });
    await tx.query("audit after", []);
  });
  assert.deepEqual(calls, ["begin isolation level read committed", "business before", "business inner", "audit after", "commit", { discard: false }]);
});

test("caught query and nested callback failures still make the entire transaction rollback-only", async () => {
  for (const queryFails of [false, true]) {
    const failure = new Error("synthetic failure");
    const { client, calls } = transactionFixture(async (sql) => {
      if (queryFails && sql === "fail") throw failure;
      return { rows: [] };
    });
    await assert.rejects(client.transaction(async (tx) => {
      try {
        if (queryFails) await tx.query("fail", []);
        else await tx.transaction(async () => { throw failure; });
      } catch { /* Caller recovery must not permit a partial commit. */ }
      return "must not commit";
    }), (error) => error === failure);
    assert.ok(calls.includes("rollback"));
    assert.equal(calls.includes("commit"), false);
  }
});

test("transaction clients cannot be reused after commit or rollback", async () => {
  for (const fail of [false, true]) {
    const { client, calls } = transactionFixture();
    let scoped;
    const work = client.transaction(async (tx) => { scoped = tx; if (fail) throw new Error("rollback"); });
    if (fail) await assert.rejects(work); else await work;
    const before = calls.length;
    await assert.rejects(scoped.query("late query", []), /scope is closed/);
    await assert.rejects(scoped.transaction(async () => {}), /scope is closed/);
    assert.equal(calls.length, before);
  }
});

test("unawaited nested work cannot commit after the transaction scope has finished", async () => {
  const { client, calls } = transactionFixture();
  let finish, pending;
  await assert.rejects(client.transaction(async (tx) => {
    pending = tx.transaction(async (nested) => {
      await new Promise((resolve) => { finish = resolve; });
      await nested.query("late write", []);
    });
  }), /unfinished operations/);
  finish();
  await assert.rejects(pending, /scope is closed/);
  assert.equal(calls.includes("commit"), false);
  assert.equal(calls.includes("late write"), false);
});

test("transactional service methods commit only after business and audit and propagate commit errors", async () => {
  for (const failureAt of [null, "audit", "commit"]) {
    const failure = new Error("synthetic commit/audit failure");
    const { client, calls } = transactionFixture(async (sql) => { if (sql === failureAt) throw failure; return { rows: [] }; });
    class Service {
      constructor(tx) { this.tx = tx; }
      async mutate(value) { await this.tx.query("business", [value]); await this.tx.query("audit", []); return value; }
    }
    const mutate = transactionalMethod(client, (tx) => new Service(tx), "mutate");
    if (failureAt) await assert.rejects(mutate("result"), (error) => error === failure);
    else assert.equal(await mutate("result"), "result");
    assert.deepEqual(calls.at(-1), { discard: failureAt === "commit" });
    assert.equal(calls.includes("rollback"), failureAt === "audit");
    if (failureAt === "audit") assert.equal(calls.includes("commit"), false);
  }
});

test("a checked-out asynchronous connection error aborts work even without a running query", async () => {
  const connection = new EventEmitter();
  const calls = [];
  connection.query = async (sql) => { calls.push(sql); return { rows: [] }; };
  connection.release = (discard) => calls.push({ discard });
  const client = createTransactionalSqlClient({ async connect() { return connection; } });
  const failure = new Error("Connection terminated unexpectedly");
  await assert.rejects(client.transaction(async (tx) => {
    connection.emit("error", failure);
    await assert.rejects(tx.query("must not execute", []), /scope is closed/);
    return "must not commit";
  }), error => error === failure);
  assert.deepEqual(calls, ["begin isolation level read committed", { discard: true }]);
  assert.equal(connection.listenerCount("error"), 0);
});

test("transport failures and client read timeouts discard without replay; SQL failures roll back", async () => {
  for (const [code, message, discard] of [["57P01", "terminated", true], ["08006", "lost", true], [undefined, "Query read timeout", true], ["23505", "duplicate", false]]) {
    const failure = Object.assign(new Error(message), { code });
    const { client, calls } = transactionFixture(async (sql) => { if (sql === "business") throw failure; return { rows: [] }; });
    await assert.rejects(client.transaction(tx => tx.query("business", [])), error => error === failure);
    assert.equal(calls.filter(sql => sql === "business").length, 1);
    assert.equal(calls.includes("rollback"), !discard);
    assert.equal(calls.includes("commit"), false);
    assert.deepEqual(calls.at(-1), { discard });
  }
});

test("shared pool configuration changes fail closed and shutdown is idempotent", async () => {
  const config = { databaseUrl: "postgres://synthetic:PRIVATE_CREDENTIAL@example.invalid/unused" };
  const pool = getSharedPostgresPool(config);
  assert.equal(getSharedPostgresPool(config), pool);
  for (const changed of [{ ...config, databaseUrl: config.databaseUrl + "2" }, { ...config, max: 2 }, { ...config, ssl: true }]) {
    assert.throws(() => getSharedPostgresPool(changed), error => error.code === "SERVICE_UNAVAILABLE" && !error.message.includes("PRIVATE_CREDENTIAL"));
  }
  pool.emit("error", new Error("PRIVATE_CREDENTIAL"));
  assert.equal(getPostgresPoolDiagnostics(pool).idleConnectionErrors, 1);
  assert.doesNotMatch(JSON.stringify(getPostgresPoolDiagnostics(pool)), /PRIVATE_CREDENTIAL|example/);
  const closing = closeSharedPostgresPool();
  assert.throws(() => getSharedPostgresPool(config), /shutting down/);
  await Promise.all([closing, closeSharedPostgresPool()]);
  assert.equal(await probePostgresPool(pool), false);
  assert.equal(pool.ended, true);
  assert.notEqual(getSharedPostgresPool(config), pool);
});

test("pool configuration rejects disabled or invalid runtime limits", () => {
  for (const key of ["max", "connectionTimeoutMillis", "queryTimeoutMillis", "statementTimeoutMillis"]) {
    for (const value of [0, -1, Infinity, 1.5]) {
      assert.throws(() => createPostgresPool({ databaseUrl: "postgres://example.invalid/unused", [key]: value }), /positive integers/);
    }
  }
});

test.afterEach(async () => {
  await closeSharedPostgresPool();
});

test("database URL resolution accepts production PostgreSQL environment names", () => {
  assert.equal(getDatabaseUrl({ DATABASE_URL: "postgres://primary" }), "postgres://primary");
  assert.equal(getDatabaseUrl({ POSTGRES_URL: "postgres://secondary" }), "postgres://secondary");
  assert.equal(getDatabaseUrl({ PG_DATABASE_URL: "postgres://pg" }), "postgres://pg");
});

test("PostgreSQL pool creation fails closed when no database URL is configured", () => {
  assert.throws(
    () => createPostgresPool({ databaseUrl: "" }),
    (error) => error instanceof Error && "code" in error && error.code === "SERVICE_UNAVAILABLE" && error.status === 503,
  );
});

test("PostgreSQL connection strings cannot override reviewed connection authority", () => {
  assert.doesNotThrow(() => assertSafePostgresConnectionString("postgresql://user:secret@example.invalid/cuac"));
  for (const databaseUrl of [
    "postgres://user:PRIVATE_SECRET@example.invalid/cuac?sslmode=disable",
    "postgres://user:PRIVATE_SECRET@example.invalid/cuac?host=%2Ftmp%2Fpostgres",
    "postgres://user:PRIVATE_SECRET@example.invalid/cuac#sslmode=disable",
    "https://user:PRIVATE_SECRET@example.invalid/cuac",
    "not a database url containing PRIVATE_SECRET",
  ]) {
    assert.throws(() => createPostgresPool({ databaseUrl }), error =>
      error.code === "SERVICE_UNAVAILABLE" && !error.message.includes("PRIVATE_SECRET") && !error.message.includes("example.invalid"));
  }
});

test("SQL catalog client adapts pg query results to typed rows", async () => {
  const calls = [];
  const client = createSqlCatalogClient({
    async query(statement, params) {
      calls.push({ statement, params });
      return {
        rows: [{ id: "program_1" }],
      };
    },
  });

  const rows = await client.query("select id from programs where id = $1", ["program_1"]);

  assert.deepEqual(rows, [{ id: "program_1" }]);
  assert.deepEqual(calls, [
    {
      statement: "select id from programs where id = $1",
      params: ["program_1"],
    },
  ]);
});

test("transaction client pins all statements to one connection and releases after commit", async () => {
  const calls = [];
  const client = createTransactionalSqlClient({
    query() { throw new Error("Transaction must not use pool.query"); },
    async connect() {
      return {
        async query(statement) { calls.push(statement); return { rows: [{ id: 1 }] }; },
        release(discard) { calls.push({ discard }); },
      };
    },
  });
  const result = await client.transaction((tx) => tx.query("select 1 as id", []));
  assert.deepEqual(result, [{ id: 1 }]);
  assert.deepEqual(calls, ["begin isolation level read committed", "select 1 as id", "commit", { discard: false }]);
});

for (const rollbackFails of [false, true]) {
  test(`transaction failure rolls back and ${rollbackFails ? "discards broken" : "releases healthy"} connection`, async () => {
    const calls = [];
    const failure = new Error("business write failed");
    const client = createTransactionalSqlClient({
      query() { throw new Error("Transaction must not use pool.query"); },
      async connect() {
        return {
          async query(statement) {
            calls.push(statement);
            if (statement === "rollback" && rollbackFails) throw new Error("connection lost");
            return { rows: [] };
          },
          release(discard) { calls.push({ discard }); },
        };
      },
    });
    await assert.rejects(client.transaction(async () => { throw failure; }), (error) => error === failure);
    assert.deepEqual(calls, ["begin isolation level read committed", "rollback", { discard: rollbackFails }]);
  });
}
