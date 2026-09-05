import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { assertMigrationPlan, assertMigrationLedgerPrefix, runCheckedMigrationPlan } from "../../../src/server/db/migration-guard.ts";
import {
  assertPostgresMigrationSafety,
  createPostgresMigrationConfig,
  inspectPostgresMigrationEnv,
  POSTGRES_MIGRATION_RUNBOOK_PATH,
  resolvePostgresSsl,
} from "../../../src/server/index.ts";

test("PostgreSQL migration env check reports missing configuration without throwing", () => {
  const check = inspectPostgresMigrationEnv({});

  assert.equal(check.configured, false);
  assert.equal(check.databaseUrlVariable, null);
  assert.equal(check.targetEnvironment, "unknown");
  assert.match(check.warnings[0], /PostgreSQL URL is not configured/);
});

test("PostgreSQL migration env check resolves supported database URL variables", () => {
  const check = inspectPostgresMigrationEnv({ POSTGRES_URL: "postgres://example" });

  assert.equal(check.configured, true);
  assert.equal(check.databaseUrlVariable, "POSTGRES_URL");
});

test("PostgreSQL SSL resolver supports Aliyun-style required SSL modes", () => {
  assert.equal(resolvePostgresSsl({ PGSSLMODE: "disable" }), undefined);
  assert.deepEqual(resolvePostgresSsl({ PGSSLMODE: "require" }), { rejectUnauthorized: false });
  assert.equal(resolvePostgresSsl({ PGSSLMODE: "verify-full" }), true);
  assert.throws(() => resolvePostgresSsl({ PGSSLMODE: "true" }), /Unsupported PostgreSQL SSL mode/);
});

test("PostgreSQL migration config uses resolved database URL and migration folder", () => {
  const config = createPostgresMigrationConfig("drizzle/pg", {
    DATABASE_URL: "postgres://primary",
    PGSSLMODE: "verify-full",
    CUAC_MIGRATION_TARGET_ENV: "staging",
  });

  assert.equal(config.databaseUrl, "postgres://primary");
  assert.equal(config.migrationsFolder, "drizzle/pg");
  assert.equal(config.targetEnvironment, "staging");
  assert.equal(config.ssl, true);
});

test("PostgreSQL migration env check blocks production without explicit approval and runbook acknowledgement", () => {
  const check = inspectPostgresMigrationEnv({
    CUAC_MIGRATION_TARGET_ENV: "production",
    DATABASE_URL: "postgres://primary",
    PGSSLMODE: "require",
  });

  assert.equal(check.configured, true);
  assert.equal(check.targetEnvironment, "production");
  assert.equal(check.productionMigrationAllowed, false);
  assert.equal(check.runbookAcknowledged, false);
  assert.equal(check.runbookPath, POSTGRES_MIGRATION_RUNBOOK_PATH);
  assert.match(check.blockers.join("\n"), /CUAC_ALLOW_PRODUCTION_MIGRATION=true/);
  assert.match(check.blockers.join("\n"), /CUAC_MIGRATION_RUNBOOK_ACK=true/);
  assert.match(check.blockers.join("\n"), /CUAC_POSTGRES_MIGRATION_RUNBOOK\.md/);
  assert.match(check.blockers.join("\n"), /PGSSLMODE=verify-full/);
});

test("PostgreSQL migration safety refuses unsafe production and staging targets before connecting", () => {
  assert.throws(
    () =>
      assertPostgresMigrationSafety({
        databaseUrl: "postgres://primary",
        migrationsFolder: "drizzle/pg",
        targetEnvironment: "production",
        productionMigrationAllowed: false,
        runbookAcknowledged: true,
      }),
    /Refusing production migration/,
  );

  assert.throws(
    () =>
      assertPostgresMigrationSafety({
        databaseUrl: "postgres://cuac:secret@127.0.0.1:5432/cuac",
        migrationsFolder: "drizzle/pg",
        targetEnvironment: "staging",
        ssl: true,
        productionMigrationAllowed: false,
        runbookAcknowledged: false,
      }),
    /localhost PostgreSQL URL/,
  );
});

test("PostgreSQL migration safety allows approved production migration config", () => {
  assert.doesNotThrow(() =>
    assertPostgresMigrationSafety({
      databaseUrl: "postgres://primary",
      migrationsFolder: "drizzle/pg",
      targetEnvironment: "production",
      ssl: true,
      productionMigrationAllowed: true,
      runbookAcknowledged: true,
    }),
  );
});

test("PostgreSQL migration safety rejects unverified TLS before connecting", () => {
  for (const ssl of [undefined, false, { rejectUnauthorized: false }]) {
    assert.throws(() => assertPostgresMigrationSafety({
      databaseUrl: "postgres://primary",
      migrationsFolder: "drizzle/pg",
      targetEnvironment: "staging",
      ssl,
      productionMigrationAllowed: false,
      runbookAcknowledged: false,
    }), /without verified PostgreSQL TLS/);
  }
});

test("PostgreSQL migration safety rejects connection-string option overrides before connecting", () => {
  for (const suffix of ["?sslmode=disable", "?options=-csearch_path%3Dpublic", "#sslmode=disable"]) {
    assert.throws(() => assertPostgresMigrationSafety({
      databaseUrl: `postgres://user:PRIVATE_SECRET@example.invalid/cuac${suffix}`,
      migrationsFolder: "drizzle/pg",
      targetEnvironment: "staging",
      ssl: true,
      productionMigrationAllowed: false,
      runbookAcknowledged: false,
    }), error => error.code === "SERVICE_UNAVAILABLE" && !error.message.includes("PRIVATE_SECRET"));
  }
});

test("PostgreSQL migration runbook documents production approval gates", async () => {
  const runbook = await readFile(new URL("../../../../CUAC_POSTGRES_MIGRATION_RUNBOOK.md", import.meta.url), "utf8");

  assert.match(runbook, /CUAC_ALLOW_PRODUCTION_MIGRATION=true/);
  assert.match(runbook, /CUAC_MIGRATION_RUNBOOK_ACK=true/);
  assert.match(runbook, /CUAC_MIGRATION_TARGET_ENV=production/);
  assert.match(runbook, /staging/);
  assert.match(runbook, /restore/i);
});

const planFixture = () => [
  { folderMillis: 100, hash: "a".repeat(64), bps: true, sql: ["select 'migration-one'"] },
  { folderMillis: 200, hash: "b".repeat(64), bps: true, sql: ["select 'migration-two'"] },
];
const rowsFixture = () => planFixture().map((migration, index) => ({ id: index * 3 + 1, hash: migration.hash, created_at: String(migration.folderMillis) }));

test("checked migration plans require ordered safe cursors, hashes and executable entries", () => {
  assert.doesNotThrow(() => assertMigrationPlan(planFixture()));
  assert.throws(() => assertMigrationPlan([]), /plan length/);
  for (const mutation of [
    plan => { plan[1].folderMillis = 100; }, plan => { plan[1].folderMillis = Number.MAX_SAFE_INTEGER + 1; },
    plan => { plan[0].hash = "unknown"; }, plan => { plan[0].bps = "true"; },
    plan => { plan[0].sql = [null]; }, plan => { plan[0].sql = [" "]; },
  ]) {
    const plan = planFixture(); mutation(plan);
    assert.throws(() => assertMigrationPlan(plan), /plan entry/);
  }
});

test("ledger validation accepts only the exact release prefix and permits harmless serial gaps", () => {
  assert.equal(assertMigrationLedgerPrefix([], planFixture()), 0);
  assert.equal(assertMigrationLedgerPrefix(rowsFixture().slice(0, 1), planFixture()), 1);
  assert.equal(assertMigrationLedgerPrefix(rowsFixture(), planFixture()), 2);
  for (const mutation of [
    rows => { rows[0].hash = "c".repeat(64); }, rows => { rows[0].created_at = "101"; },
    rows => { rows[0].created_at = null; }, rows => { rows[0].created_at = 100; },
    rows => { rows.shift(); }, rows => { rows.reverse(); }, rows => { rows[1].id = rows[0].id; },
    rows => { rows[0].id = 0; }, rows => { rows.push({ ...rows[1], id: 99 }); },
  ]) {
    const rows = rowsFixture(); mutation(rows);
    assert.throws(() => assertMigrationLedgerPrefix(rows, planFixture()), /ledger/);
  }
});

function migrationClientFixture({ acquired = true, rows = [], table = null, onQuery = () => {} } = {}) {
  const statements = [], state = { rows: structuredClone(rows), table };
  let connects = 0;
  const client = createTransactionalSqlClient({
    query() { throw new Error("A migration must never query outside its connection"); },
    async connect() {
      connects++;
      return {
        async query(sql, params = []) {
          statements.push(sql); onQuery(sql, params, state);
          if (sql.includes("pg_try_advisory_xact_lock")) return { rows: [{ acquired }] };
          if (sql.includes("n.nspname = 'drizzle'")) return { rows: state.table ? [state.table] : [] };
          if (sql.includes("as present")) return { rows: [{ present: false }] };
          if (sql.startsWith('create table "drizzle"')) state.table = { oid: 42, relkind: "r", relrowsecurity: false, relforcerowsecurity: false };
          if (sql.startsWith('insert into "drizzle"')) state.rows.push({ id: state.rows.length + 1, hash: params[0], created_at: String(params[1]) });
          if (sql.startsWith("select id, hash")) return { rows: structuredClone(state.rows) };
          return { rows: [] };
        },
        release(discard) { statements.push(`release:${discard}`); },
      };
    },
  });
  return { client, state, statements, connections: () => connects };
}

test("checked execution uses one transaction and a private plan snapshot through final verification", async () => {
  const plan = planFixture();
  const fixture = migrationClientFixture({ onQuery(sql) {
    if (sql.startsWith("begin")) plan[1].sql = ["select 'unreviewed-replacement'"];
  } });
  assert.deepEqual(await runCheckedMigrationPlan(fixture.client, plan), { appliedBefore: 0, appliedNow: 2, appliedTotal: 2 });
  assert.equal(fixture.connections(), 1);
  assert.equal(fixture.statements[0], "begin isolation level read committed");
  assert.match(fixture.statements[1], /pg_try_advisory_xact_lock/);
  assert.ok(fixture.statements.includes("select 'migration-two'"));
  assert.ok(!fixture.statements.includes("select 'unreviewed-replacement'"));
  assert.deepEqual(fixture.statements.slice(-2), ["commit", "release:false"]);
});

test("a competing migration fails before reading history or executing DDL", async () => {
  const fixture = migrationClientFixture({ acquired: false });
  await assert.rejects(runCheckedMigrationPlan(fixture.client, planFixture()), /Another CUAC migration job/);
  assert.equal(fixture.statements.length, 4);
  assert.deepEqual(fixture.statements.slice(-2), ["rollback", "release:false"]);
});

test("ledger mismatch and hidden ledger rows fail before pending SQL", async () => {
  for (const hidden of [false, true]) {
    const rows = rowsFixture(); rows[0].hash = "c".repeat(64);
    const fixture = migrationClientFixture({ rows, table: { oid: 42, relkind: "r", relrowsecurity: hidden, relforcerowsecurity: false } });
    await assert.rejects(runCheckedMigrationPlan(fixture.client, planFixture()), /ledger/);
    assert.ok(!fixture.statements.some(sql => sql.startsWith("select 'migration-") || sql.startsWith("create ")));
    assert.deepEqual(fixture.statements.slice(-2), ["rollback", "release:false"]);
  }
});

test("SQL failure and failed final ledger verification prevent commit", async () => {
  for (const failure of ["sql", "ledger"]) {
    const fixture = migrationClientFixture({ onQuery(sql, params, state) {
      if (failure === "sql" && sql === "select 'migration-two'") throw new Error("Synthetic DDL failure");
      if (failure === "ledger" && sql.startsWith("select id, hash") && state.rows.length) state.rows[0].hash = "d".repeat(64);
    } });
    await assert.rejects(runCheckedMigrationPlan(fixture.client, planFixture()), /Synthetic DDL failure|ledger/);
    assert.ok(!fixture.statements.includes("commit"));
    assert.deepEqual(fixture.statements.slice(-2), ["rollback", "release:false"]);
  }
});

test("invalid plans never acquire a connection", async () => {
  const fixture = migrationClientFixture();
  await assert.rejects(runCheckedMigrationPlan(fixture.client, []), /plan length/);
  assert.equal(fixture.connections(), 0);
});
