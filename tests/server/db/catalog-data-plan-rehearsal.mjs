import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import pg from "pg";
import { runPostgresMigrations } from "../../../src/server/db/migration-runtime.ts";

const databaseUrl = process.env.CUAC_PG_REHEARSAL_URL;
assert.equal(process.env.CUAC_PG_CATALOG_DATA_PLAN, "1");
assert.ok(databaseUrl, "Catalog data-plan rehearsal requires its owned disposable database URL.");
const target = new URL(databaseUrl);
assert.equal(target.protocol, "postgresql:");
assert.equal(target.hostname, "127.0.0.1");
assert.equal(target.username, "cuac_rehearsal");
assert.match(target.pathname, /^\/cuac_rehearsal_[a-f0-9]{24}$/);
assert.equal(target.search, "");

const read = async name => JSON.parse(await readFile(new URL(`../../../work/catalog-quality/${name}`, import.meta.url), "utf8"));
const canonical = value => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
};
const sha = value => createHash("sha256").update(canonical(value)).digest("hex");
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5000, statement_timeout: 60_000 });

test("the complete non-authorizing catalog plan is transactional, idempotent and rollback-safe in disposable PostgreSQL", { timeout: 120_000 }, async t => {
  t.after(() => pool.end());
  const [plan, readiness, prohibited] = await Promise.all([
    read("catalog-data-remediation-plan.draft.json"),
    read("catalog-data-migration-readiness.draft.json"),
    read("catalog-prohibited-source-remediation.draft.json"),
  ]);
  assert.equal(plan.databaseWriteAuthorized, false);
  assert.equal(readiness.executionAuthorized, false);
  assert.equal(readiness.summary.staleFieldOperations, 0);
  assert.equal(readiness.summary.readyFieldOperations, readiness.summary.fieldOperations);
  assert.equal(readiness.summary.readyIntakeOperations, readiness.summary.intakeOperations);

  await runPostgresMigrations({
    databaseUrl,
    migrationsFolder: fileURLToPath(new URL("../../../drizzle/pg", import.meta.url)),
    targetEnvironment: "development",
    productionMigrationAllowed: false,
    runbookAcknowledged: false,
  });

  const fieldOperations = [...plan.replayReady.fieldOperations, ...plan.reviewDeferred.fieldOperations].map(row => ({
    entity_type: row.entityType, entity_slug: row.entitySlug, field: row.field, value: row.value,
  }));
  const intakeOperations = [...plan.replayReady.intakeOperations, ...plan.reviewDeferred.intakeOperations].map(row => ({
    program_slug: row.programSlug, intake_term: row.intakeTerm, intake_year: row.intakeYear,
    payload_sha256: sha(row),
  }));
  const dispositions = [
    ...prohibited.classifications.officialReplacementDraft.map(row => ({
      entity_type: row.entityType, entity_id: row.id, action: "replace_after_review", candidate_sha256: row.candidate.sourceSha256,
    })),
    ...prohibited.classifications.quarantineRequired.map(row => ({
      entity_type: row.entityType, entity_id: row.id, action: "archive_after_approval", candidate_sha256: null,
    })),
  ];
  assert.equal(fieldOperations.length, 4535);
  assert.equal(intakeOperations.length, 160);
  assert.equal(dispositions.length, 827);

  await pool.query(`create table catalog_plan_field_targets (
    entity_type text not null, entity_slug text not null, field text not null, value jsonb,
    primary key(entity_type,entity_slug,field)
  )`);
  await pool.query(`create table catalog_plan_intake_targets (
    program_slug text not null, intake_term text not null, intake_year integer not null, payload_sha256 text not null,
    primary key(program_slug,intake_term,intake_year)
  )`);
  await pool.query(`create table catalog_plan_dispositions (
    entity_type text not null, entity_id uuid not null, action text not null, candidate_sha256 text,
    primary key(entity_type,entity_id)
  )`);
  await pool.query(`insert into catalog_plan_field_targets(entity_type,entity_slug,field,value)
    select entity_type,entity_slug,field,null from jsonb_to_recordset($1::jsonb)
      as x(entity_type text,entity_slug text,field text,value jsonb)`, [JSON.stringify(fieldOperations)]);

  const state = async () => ({
    fields: (await pool.query("select entity_type,entity_slug,field,value from catalog_plan_field_targets order by 1,2,3")).rows,
    intakes: (await pool.query("select * from catalog_plan_intake_targets order by 1,2,3")).rows,
    dispositions: (await pool.query("select entity_type,entity_id::text,action,candidate_sha256 from catalog_plan_dispositions order by 1,2")).rows,
  });
  const beforeSha256 = sha(await state());
  const connection = await pool.connect();
  try {
    await connection.query("begin isolation level serializable");
    const apply = async () => {
      const fields = await connection.query(`insert into catalog_plan_field_targets(entity_type,entity_slug,field,value)
        select entity_type,entity_slug,field,value from jsonb_to_recordset($1::jsonb)
          as x(entity_type text,entity_slug text,field text,value jsonb)
        on conflict(entity_type,entity_slug,field) do update set value=excluded.value
        where catalog_plan_field_targets.value is null`, [JSON.stringify(fieldOperations)]);
      const intakes = await connection.query(`insert into catalog_plan_intake_targets(program_slug,intake_term,intake_year,payload_sha256)
        select program_slug,intake_term,intake_year,payload_sha256 from jsonb_to_recordset($1::jsonb)
          as x(program_slug text,intake_term text,intake_year integer,payload_sha256 text)
        on conflict(program_slug,intake_term,intake_year) do nothing`, [JSON.stringify(intakeOperations)]);
      const disposition = await connection.query(`insert into catalog_plan_dispositions(entity_type,entity_id,action,candidate_sha256)
        select entity_type,entity_id::uuid,action,candidate_sha256 from jsonb_to_recordset($1::jsonb)
          as x(entity_type text,entity_id text,action text,candidate_sha256 text)
        on conflict(entity_type,entity_id) do update set action=excluded.action,candidate_sha256=excluded.candidate_sha256
        where (catalog_plan_dispositions.action,catalog_plan_dispositions.candidate_sha256)
          is distinct from (excluded.action,excluded.candidate_sha256)`, [JSON.stringify(dispositions)]);
      return fields.rowCount + intakes.rowCount + disposition.rowCount;
    };
    assert.equal(await apply(), readiness.summary.firstPassLogicalChanges);
    assert.equal(await apply(), 0);
    await connection.query("rollback");
  } catch (error) {
    try { await connection.query("rollback"); } catch { /* Disposable connection cleanup. */ }
    throw error;
  } finally {
    connection.release();
  }
  assert.equal(sha(await state()), beforeSha256);
});
