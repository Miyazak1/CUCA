import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import pg from "pg";
import { runPostgresMigrations } from "../../../src/server/db/migration-runtime.ts";
import { applyCatalogReleaseCandidateForDisposableRehearsal, catalogCandidateSha256, validateCatalogReleaseCandidate } from "../../../scripts/lib/catalog-data-candidate-runtime.ts";

const databaseUrl = process.env.CUAC_PG_REHEARSAL_URL;
assert.equal(process.env.CUAC_PG_CATALOG_RELEASE_CANDIDATE, "1");
assert.ok(databaseUrl);
const target = new URL(databaseUrl);
assert.equal(target.hostname, "127.0.0.1");
assert.equal(target.username, "cuac_rehearsal");
assert.match(target.pathname, /^\/cuac_rehearsal_[a-f0-9]{24}$/);
const candidate = JSON.parse(await readFile(new URL("../../../work/catalog-quality/catalog-data-release-candidate.json", import.meta.url), "utf8"));
assert.deepEqual(validateCatalogReleaseCandidate(candidate), { ok: true, errors: [] });
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5000, statement_timeout: 120_000 });

test("owner-default-accepted candidate applies only in disposable PostgreSQL, is idempotent and rolls back exactly", { timeout: 180_000 }, async t => {
  t.after(() => pool.end());
  await runPostgresMigrations({ databaseUrl, migrationsFolder: fileURLToPath(new URL("../../../drizzle/pg", import.meta.url)), targetEnvironment: "development", productionMigrationAllowed: false, runbookAcknowledged: false });
  const fixtures = candidate.rehearsalFixtures;
  for (const [table, rows] of [["cities", fixtures.cities], ["schools", fixtures.schools], ["programs", fixtures.programs], ["scholarships", fixtures.scholarships], ["program_intakes", fixtures.programIntakes]]) {
    if (rows.length) await pool.query(`insert into ${table} select * from jsonb_populate_recordset(null::${table},$1::jsonb)`, [JSON.stringify(rows)]);
  }
  const targetIds = Object.fromEntries(Object.entries(candidate.preimage.targets).map(([entity, rows]) => [entity, rows.map(row => row.id)]));
  const state = async client => ({
    schools: (await client.query("select to_jsonb(t) data from schools t where id=any($1::uuid[]) order by slug", [targetIds.school])).rows.map(row => row.data),
    programs: (await client.query("select to_jsonb(t) data from programs t where id=any($1::uuid[]) order by slug", [targetIds.program])).rows.map(row => row.data),
    scholarships: (await client.query("select to_jsonb(t) data from scholarships t where id=any($1::uuid[]) order by slug", [targetIds.scholarship])).rows.map(row => row.data),
    intakes: (await client.query("select to_jsonb(i) data from program_intakes i join programs p on p.id=i.program_id where p.slug=any($1::text[]) order by p.slug,i.intake_term,i.intake_year", [candidate.operations.intakeOperations.map(row => row.programSlug)])).rows.map(row => row.data),
  });
  const connection = await pool.connect();
  try {
    const before = catalogCandidateSha256(await state(connection));
    await connection.query("begin isolation level serializable");
    const first = await applyCatalogReleaseCandidateForDisposableRehearsal(connection, candidate);
    assert.ok(first.totalChanged > 0);
    assert.equal(first.replacementsChanged, candidate.summary.officialReplacements);
    assert.equal(first.fieldsChanged, candidate.summary.expectedEffectiveFieldChanges);
    assert.equal(first.intakesChanged, candidate.summary.intakeOperations);
    assert.equal(first.archivesChanged, candidate.summary.recoverableArchives);
    assert.equal(first.totalChanged, candidate.summary.expectedFirstPassActions);
    t.diagnostic(`first-pass changes ${JSON.stringify(first)}`);
    const second = await applyCatalogReleaseCandidateForDisposableRehearsal(connection, candidate);
    assert.equal(second.totalChanged, 0);
    const publicProhibited = await connection.query(`select
      (select count(*)::integer from schools where status='active' and verification_status in ('verified','stale') and source_url ~* '(cscapilot\\.com|csca\\.app|wentchina\\.com)')
      +(select count(*)::integer from programs p join schools s on s.id=p.school_id where p.status='active' and s.status='active' and p.verification_status in ('verified','stale') and p.source_url ~* '(cscapilot\\.com|csca\\.app|wentchina\\.com)')
      +(select count(*)::integer from scholarships where status='active' and verification_status='verified' and source_url ~* '(cscapilot\\.com|csca\\.app|wentchina\\.com)') count`);
    assert.equal(publicProhibited.rows[0].count, 0);
    await connection.query("rollback");
    assert.equal(catalogCandidateSha256(await state(connection)), before);
  } catch (error) {
    try { await connection.query("rollback"); } catch { /* Disposable cleanup only. */ }
    throw error;
  } finally {
    connection.release();
  }
});
