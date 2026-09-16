import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import pg from "pg";
import * as schema from "../../../src/server/db/schema.ts";
import { readPublicSchemaCatalog, schemaCatalogDifferences } from "./pg-schema-catalog.mjs";
import { checkMigrationSnapshots, readMigrationArtifactState,
  validateMigrationArtifactState } from "../../../scripts/lib/pg-schema-snapshot.ts";

const migrationsFolder = fileURLToPath(new URL("../../../drizzle/pg", import.meta.url));

async function installNonDeclarativeSchemaObjects(client) {
  for (const file of ["0049_catalog_publication_revision.sql", "0050_published_guides.sql"]) {
    const sql = await readFile(join(migrationsFolder, file), "utf8");
    const statements = sql.split("--> statement-breakpoint").map(value => value.trim()).filter(Boolean);
    for (const statement of statements) {
      if (/^CREATE (?:FUNCTION|TRIGGER)\b/i.test(statement)) await client.query(statement);
    }
  }
}

async function sealReviewedReconciliationBaseline() {
  const state = await readMigrationArtifactState(migrationsFolder);
  validateMigrationArtifactState(state);
  const nextIndex = state.manifest.throughIndex + 1;
  const pendingCount = Number(process.env.CUAC_PG_SCHEMA_BASELINE_PENDING_COUNT ?? "1");
  assert.ok(Number.isSafeInteger(pendingCount) && pendingCount > 0,
    "Baseline sealing requires a positive reviewed migration count");
  assert.equal(state.journal.entries.length, nextIndex + pendingCount,
    "Baseline sealing requires the exact declared number of reviewed journal migrations");
  assert.equal(state.journal.entries.at(-1).idx, nextIndex + pendingCount - 1,
    "Baseline sealing can advance only to the journal tail");
  const manifest = {
    version: 1,
    throughIndex: nextIndex + pendingCount - 1,
    journalEntries: state.journal.entries,
    sql: state.sql,
    snapshots: Object.fromEntries(state.snapshots.map(item => [item.file, item.sha256])),
    toolVersions: state.toolVersions,
  };
  validateMigrationArtifactState({ ...state, manifest });
  await writeFile(join(migrationsFolder, "_schema-baseline.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

export async function runSchemaConsistencyRehearsal(t, pool, databaseUrl) {
  const target = new URL(databaseUrl);
  assert.equal(target.hostname, "127.0.0.1");
  assert.equal(target.username, "cuac_rehearsal");
  assert.match(target.pathname, /^\/cuac_rehearsal_[a-f0-9]{24}$/);
  assert.equal((await pool.query("select current_database() as name")).rows[0].name, target.pathname.slice(1));
  const shadowName = `cuac_schema_${randomBytes(12).toString("hex")}`;
  assert.match(shadowName, /^cuac_schema_[a-f0-9]{24}$/);
  let shadow, created = false, databaseOid;
  try {
    await pool.query(`create database "${shadowName}"`);
    created = true;
    databaseOid = (await pool.query("select oid from pg_database where datname = $1", [shadowName])).rows[0].oid;
    target.pathname = `/${shadowName}`;
    shadow = new pg.Pool({ connectionString: target.href, max: 2, connectionTimeoutMillis: 5000, statement_timeout: 10_000 });
    // The declared search indexes use pg_trgm's GIN operator class. Drizzle
    // generates the indexes but does not emit extension lifecycle statements,
    // so the empty comparison database must mirror migration 0048 first.
    await shadow.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
    const current = generateDrizzleJson(schema);
    const withoutForeignKeys = structuredClone(current);
    for (const table of Object.values(withoutForeignKeys.tables)) table.foreignKeys = {};
    // Composite foreign keys require their referenced unique indexes to exist first.
    const base = await generateMigration(generateDrizzleJson({}), withoutForeignKeys);
    const references = await generateMigration(withoutForeignKeys, current);
    for (const statement of [...base, ...references]) await shadow.query(statement);
    // Triggers and stored functions are intentionally migration-owned because
    // Drizzle's schema model cannot declare them. Reuse the reviewed migration
    // statements so parity covers those objects without maintaining duplicate SQL.
    await installNonDeclarativeSchemaObjects(shadow);
    const actual = await readPublicSchemaCatalog(pool), expected = await readPublicSchemaCatalog(shadow);
    await t.test("migrated PostgreSQL schema matches declared and migration-owned schema objects", async () => {
      const differences = schemaCatalogDifferences(actual, expected);
      assert.equal(differences.length, 0, JSON.stringify(differences, null, 2));
      t.diagnostic(`Schema parity: ${Object.keys(actual.tables).length} public tables, ${Object.keys(actual.columns).length} columns, ${Object.keys(actual.constraints).length} constraints, ${Object.keys(actual.indexes).length} indexes.`);
      if (process.env.CUAC_PG_WRITE_SCHEMA_BASELINE === "1") await sealReviewedReconciliationBaseline();
    });
    await t.test("migration snapshots and immutable history match the current declared schema", async () => {
      assert.equal((await checkMigrationSnapshots(migrationsFolder)).tables, Object.keys(actual.tables).length);
    });
    await t.test("schema parity detects column, generated expression, default, index, foreign-key, check, RLS and unexpected-table drift", async () => {
      const cases = [
        ["columns", ["alter table student_profiles alter column display_name type varchar(64)"]],
        ["columns", ["alter table agent_context_candidates alter column expires_at drop not null"]],
        ["columns", ["alter table users alter column account_status set default 'suspended'"]],
        ["columns", ["alter table school_applications alter column target_key drop expression"]],
        ["indexes", ["drop index school_staff_invites_pending_school_email_unique", "create unique index school_staff_invites_pending_school_email_unique on school_staff_invites (school_id, email_normalized) where status = 'accepted'"]],
        ["constraints", ["alter table student_application_command_receipts drop constraint student_application_commands_hash_check"]],
        ["constraints", ["alter table agent_student_memory_settings rename constraint agent_student_memory_settings_user_id_fkey to changed_fk_name"]],
        ["constraints", ["alter table agent_student_memory_settings drop constraint agent_student_memory_settings_user_id_fkey", "alter table agent_student_memory_settings add constraint agent_student_memory_settings_user_id_fkey foreign key (user_id) references users(id) on delete restrict"]],
        ["tables", ["alter table users enable row level security"]],
        ["triggers", ["alter table cities disable trigger cities_public_catalog_revision_trigger"]],
        ["functions", ["create or replace function bump_public_catalog_revision() returns trigger language plpgsql set search_path = pg_catalog, public as $$ begin return null; end; $$"]],
        ["tables", ["create table unexpected_schema_object (id integer)"]],
      ];
      const connection = await shadow.connect();
      try {
        for (const [kind, statements] of cases) {
          await connection.query("begin");
          try {
            for (const statement of statements) await connection.query(statement);
            const differences = schemaCatalogDifferences(await readPublicSchemaCatalog(connection), expected);
            assert.ok(differences.some(item => item.kind === kind), `${kind} drift was missed`);
          } finally { await connection.query("rollback"); }
          assert.deepEqual(schemaCatalogDifferences(await readPublicSchemaCatalog(connection), expected), []);
        }
      } finally { connection.release(); }
    });
  } finally {
    if (shadow) await shadow.end();
    if (created) {
      const currentOid = (await pool.query("select oid from pg_database where datname = $1", [shadowName])).rows[0]?.oid;
      assert.equal(currentOid, databaseOid, "Shadow database ownership changed; refusing cleanup");
      await pool.query(`drop database "${shadowName}"`);
    }
  }
}
