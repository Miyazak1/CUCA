import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, join, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate as nativeMigrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { POSTGRES_MIGRATION_LOCK, runCheckedMigrationPlan } from "../../../src/server/db/migration-guard.ts";
import { runPostgresMigrations } from "../../../src/server/db/migration-runtime.ts";
import { readPublicSchemaCatalog } from "./pg-schema-catalog.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const base = ["create table migration_probe (id integer primary key, note text not null)", "insert into migration_probe values (1, 'existing')"];
const upgrade = "alter table migration_probe add column status text not null default 'ready';\n--> statement-breakpoint\ninsert into migration_probe values (2, 'new', 'ready')";

async function writeFixture(folder, statements) {
  await mkdir(join(folder, "meta"), { recursive: true });
  const entries = [];
  for (const [idx, sql] of statements.entries()) {
    const tag = `${String(idx).padStart(4, "0")}_fixture`;
    entries.push({ idx, version: "7", when: 1000 + idx, tag, breakpoints: true });
    await writeFile(join(folder, `${tag}.sql`), sql, { flag: "wx" });
  }
  await writeFile(join(folder, "meta/_journal.json"), JSON.stringify({ version: "7", dialect: "postgresql", entries }), { flag: "wx" });
}

async function snapshot(pool) {
  const schema = await readPublicSchemaCatalog(pool);
  const table = (await pool.query("select to_regclass('drizzle.__drizzle_migrations')::text as name")).rows[0].name;
  const metadata = (await pool.query("select nspname from pg_namespace where nspname = 'drizzle'")).rows;
  const ledger = table ? (await pool.query("select id, hash, created_at::text from drizzle.__drizzle_migrations order by id")).rows : null;
  const rows = schema.tables.migration_probe ? (await pool.query("select * from migration_probe order by id")).rows : null;
  return { schema, metadata, ledger, rows };
}

async function waitingMigrationPid(pool) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const result = await pool.query(`select a.pid from pg_stat_activity a join pg_locks l on l.pid = a.pid
      where a.datname = current_database() and a.application_name = 'cuac:migration' and a.wait_event_type = 'Lock'
      and l.locktype = 'advisory' and l.granted and l.classid = $1::oid and l.objid = $2::oid and l.objsubid = 2`, POSTGRES_MIGRATION_LOCK);
    if (result.rows.length === 1) return result.rows[0].pid;
    await delay(20);
  }
  assert.fail("Migration did not reach the real DDL lock barrier while holding its advisory lock");
}

export async function runMigrationGuardRehearsal(t, admin, databaseUrl) {
  const target = new URL(databaseUrl);
  assert.equal(target.hostname, "127.0.0.1");
  assert.equal(target.username, "cuac_rehearsal");
  assert.match(target.pathname, /^\/cuac_rehearsal_[a-f0-9]{24}$/);
  assert.equal((await admin.query("select current_database() as name")).rows[0].name, target.pathname.slice(1));
  const parent = join(await realpath(root), ".tmp");
  await mkdir(parent, { recursive: true });
  assert.equal(await realpath(parent), parent);
  const temp = await mkdtemp(join(parent, "migration-check-"));
  const verifyOwned = async () => {
    const resolved = await realpath(temp);
    assert.equal(dirname(resolved), parent);
    assert.ok(resolved.startsWith(parent + sep + "migration-check-"));
  };

  async function withDatabase(work) {
    const name = `cuac_migration_${randomBytes(12).toString("hex")}`;
    assert.match(name, /^cuac_migration_[a-f0-9]{24}$/);
    let pool, created = false, oid;
    try {
      await admin.query(`create database "${name}"`); created = true;
      oid = (await admin.query("select oid from pg_database where datname = $1", [name])).rows[0].oid;
      const url = new URL(target); url.pathname = `/${name}`;
      pool = new pg.Pool({ connectionString: url.href, max: 4, connectionTimeoutMillis: 5000, statement_timeout: 10_000 });
      const config = label => ({ databaseUrl: url.href, migrationsFolder: join(temp, label), targetEnvironment: "development", productionMigrationAllowed: false, runbookAcknowledged: false });
      await work(pool, config);
    } finally {
      if (pool) await pool.end();
      if (created) {
        assert.equal((await admin.query("select oid from pg_database where datname = $1", [name])).rows[0]?.oid, oid, "Migration fixture database ownership changed");
        await admin.query(`drop database "${name}"`);
      }
    }
  }

  try {
    await verifyOwned();
    await writeFixture(join(temp, "v1"), base);
    await writeFixture(join(temp, "v2"), [...base, upgrade]);
    await writeFixture(join(temp, "failure"), [...base, "create table migration_partial (id integer);\n--> statement-breakpoint\nupdate migration_probe set note = 'changed';\n--> statement-breakpoint\nselect 1 / 0"]);
    await writeFixture(join(temp, "tamper"), [...base, `${upgrade};\n--> statement-breakpoint\ninsert into drizzle.__drizzle_migrations (hash, created_at) values ('${"f".repeat(64)}', 999999)`]);
    await writeFixture(join(temp, "bootstrap_failure"), [base[0], "insert into migration_probe values (1, 'partial');\n--> statement-breakpoint\nselect 1 / 0"]);

    await t.test("guarded runner rejects connection overrides, upgrades a nonempty native database and replays", () => withDatabase(async (pool, config) => {
      await nativeMigrate(drizzle(pool), { migrationsFolder: config("v1").migrationsFolder });
      await pool.query("select nextval('drizzle.__drizzle_migrations_id_seq')");
      await pool.query("create schema migration_redirect");
      await pool.query("create table migration_redirect.migration_probe (id integer primary key, note text not null)");
      await pool.query("insert into migration_redirect.migration_probe values (999, 'untouched')");
      const redirected = config("v2"), url = new URL(redirected.databaseUrl);
      url.searchParams.set("options", "-c search_path=migration_redirect,public");
      redirected.databaseUrl = url.href;
      const probe = new pg.Pool({ connectionString: url.href, max: 1, connectionTimeoutMillis: 5000 });
      try {
        assert.equal((await probe.query("show search_path")).rows[0].search_path, "migration_redirect,public");
        assert.deepEqual((await probe.query("select id from migration_probe")).rows, [{ id: 999 }]);
      } finally { await probe.end(); }
      await assert.rejects(runPostgresMigrations(redirected), /must not contain query parameters or fragments/);
      const upgraded = await runPostgresMigrations(config("v2"));
      assert.equal(upgraded.appliedBefore, 2); assert.equal(upgraded.appliedNow, 1); assert.equal(upgraded.appliedTotal, 3);
      assert.deepEqual((await pool.query("select * from migration_probe order by id")).rows, [
        { id: 1, note: "existing", status: "ready" }, { id: 2, note: "new", status: "ready" },
      ]);
      assert.deepEqual((await pool.query("select * from migration_redirect.migration_probe")).rows, [{ id: 999, note: "untouched" }]);
      const before = await snapshot(pool);
      assert.equal((await runPostgresMigrations(config("v2"))).appliedNow, 0);
      assert.deepEqual(await snapshot(pool), before);
      await assert.rejects(runPostgresMigrations(config("v1")), /entries absent from this release/);
      assert.deepEqual(await snapshot(pool), before);
    }));

    await t.test("modified missing duplicate unknown and hidden ledger entries block DDL without changing data", async () => {
      for (const mutation of [
        "update drizzle.__drizzle_migrations set hash = repeat('f', 64) where id = 1",
        "update drizzle.__drizzle_migrations set created_at = 999 where id = 1",
        "delete from drizzle.__drizzle_migrations where id = 1",
        "insert into drizzle.__drizzle_migrations (hash, created_at) select hash, created_at from drizzle.__drizzle_migrations where id = 1",
        "insert into drizzle.__drizzle_migrations (hash, created_at) values (repeat('f', 64), 999999)",
        "delete from drizzle.__drizzle_migrations",
        "alter table drizzle.__drizzle_migrations enable row level security",
      ]) await withDatabase(async (pool, config) => {
        await runPostgresMigrations(config("v1")); await pool.query(mutation);
        const before = await snapshot(pool);
        await assert.rejects(runPostgresMigrations(config("v2")), /ledger|empty migration history/);
        assert.deepEqual(await snapshot(pool), before);
      });
    });

    await t.test("an untracked database is never automatically adopted or given a migration ledger", () => withDatabase(async (pool, config) => {
      await pool.query(base[0]); await pool.query(base[1]);
      const before = await snapshot(pool);
      await assert.rejects(runPostgresMigrations(config("v2")), /empty migration history/);
      assert.deepEqual(await snapshot(pool), before);
    }));

    await t.test("two migration jobs cannot enter DDL together and explicit retry observes the committed prefix", () => withDatabase(async (pool, config) => {
      await runPostgresMigrations(config("v1"));
      const blocker = await pool.connect(); let outcome;
      try {
        await blocker.query("begin"); await blocker.query("lock table migration_probe in access exclusive mode");
        outcome = runPostgresMigrations(config("v2")).then(value => ({ value }), error => ({ error }));
        await waitingMigrationPid(pool);
        await assert.rejects(runPostgresMigrations(config("v2")), /Another CUAC migration job/);
        assert.equal((await pool.query("select count(*)::int as count from drizzle.__drizzle_migrations")).rows[0].count, 2);
        await blocker.query("commit");
        const result = await outcome; assert.ifError(result.error); assert.equal(result.value.appliedNow, 1);
        assert.equal((await runPostgresMigrations(config("v2"))).appliedNow, 0);
      } finally { await blocker.query("rollback"); blocker.release(); if (outcome) await outcome; }
    }));

    await t.test("a non-cooperating ledger writer is rejected by the table lock before migration SQL", () => withDatabase(async (pool, config) => {
      await runPostgresMigrations(config("v1")); const before = await snapshot(pool);
      const blocker = await pool.connect();
      try {
        await blocker.query("begin"); await blocker.query("lock table drizzle.__drizzle_migrations in row exclusive mode");
        await assert.rejects(runPostgresMigrations(config("v2")), error => error.code === "55P03");
      } finally { await blocker.query("rollback"); blocker.release(); }
      assert.deepEqual(await snapshot(pool), before);
      assert.equal((await runPostgresMigrations(config("v2"))).appliedNow, 1);
    }));

    await t.test("DDL and ledger postcondition failures roll back the full pending batch and release its lock", async () => {
      for (const label of ["failure", "tamper"]) await withDatabase(async (pool, config) => {
        await runPostgresMigrations(config("v1")); const before = await snapshot(pool);
        await assert.rejects(runPostgresMigrations(config(label)), /division by zero|ledger/);
        assert.deepEqual(await snapshot(pool), before);
        assert.equal((await runPostgresMigrations(config("v2"))).appliedNow, 1);
      });
      await withDatabase(async (pool, config) => {
        const before = await snapshot(pool);
        await assert.rejects(runPostgresMigrations(config("bootstrap_failure")), /division by zero/);
        assert.deepEqual(await snapshot(pool), before, "First-run failure must also roll back metadata bootstrap");
        assert.equal((await runPostgresMigrations(config("v2"))).appliedNow, 3);
      });
    });

    await t.test("terminating the owned migration connection rolls back and frees the lock for an explicit retry", () => withDatabase(async (pool, config) => {
      await runPostgresMigrations(config("v1")); const before = await snapshot(pool);
      const blocker = await pool.connect(); let outcome;
      try {
        await blocker.query("begin"); await blocker.query("lock table migration_probe in access exclusive mode");
        outcome = runPostgresMigrations(config("v2")).then(value => ({ value }), error => ({ error }));
        const pid = await waitingMigrationPid(pool);
        assert.equal((await pool.query("select pg_terminate_backend($1) as terminated", [pid])).rows[0].terminated, true);
        assert.ok((await outcome).error);
      } finally { await blocker.query("rollback"); blocker.release(); if (outcome) await outcome; }
      assert.deepEqual(await snapshot(pool), before);
      assert.equal((await runPostgresMigrations(config("v2"))).appliedNow, 1);
    }));

    await t.test("lost COMMIT acknowledgement leaves one durable migration and a verified no-op on explicit retry", () => withDatabase(async (pool, config) => {
      await runPostgresMigrations(config("v1")); let commits = 0, discarded = false;
      const uncertain = createTransactionalSqlClient({ query: pool.query.bind(pool), async connect() {
        const connection = await pool.connect();
        return { async query(sql, params) {
          const result = await connection.query(sql, params);
          if (sql === "commit") { commits++; throw new Error("Synthetic lost migration COMMIT acknowledgement"); }
          return result;
        }, release(destroy) { discarded = destroy; connection.release(destroy); } };
      } });
      await assert.rejects(runCheckedMigrationPlan(uncertain, readMigrationFiles({ migrationsFolder: config("v2").migrationsFolder })), /Synthetic lost migration COMMIT/);
      assert.equal(commits, 1); assert.equal(discarded, true);
      const before = await snapshot(pool);
      assert.equal(before.ledger.length, 3); assert.equal(before.rows.length, 2);
      assert.equal((await runPostgresMigrations(config("v2"))).appliedNow, 0);
      assert.deepEqual(await snapshot(pool), before);
    }));
  } finally { await verifyOwned(); await rm(temp, { recursive: true }); }
}
