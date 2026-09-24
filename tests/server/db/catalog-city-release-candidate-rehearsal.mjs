import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import pg from "pg";
import { runPostgresMigrations } from "../../../src/server/db/migration-runtime.ts";
import { PostgresCatalogRepository } from "../../../src/server/catalog/postgres-repository.ts";
import { applyCityReleaseCandidateForDisposableRehearsal, cityCandidateSha256, validateCityReleaseCandidate } from "../../../scripts/lib/catalog-city-candidate-runtime.ts";

const databaseUrl = process.env.CUAC_PG_REHEARSAL_URL;
assert.equal(process.env.CUAC_PG_CATALOG_CITY_RELEASE_CANDIDATE, "1");
assert.ok(databaseUrl);
const target = new URL(databaseUrl);
assert.equal(target.hostname, "127.0.0.1");
assert.equal(target.username, "cuac_rehearsal");
assert.match(target.pathname, /^\/cuac_rehearsal_[a-f0-9]{24}$/);
const candidate = JSON.parse(await readFile(new URL("../../../work/city-data/catalog-city-release-candidate.json", import.meta.url), "utf8"));
assert.deepEqual(validateCityReleaseCandidate(candidate), { ok: true, errors: [] });
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5000, statement_timeout: 120_000 });

test("city candidate is idempotent, remains non-public, passes the real public query hypothetically, and rolls back", { timeout: 180_000 }, async t => {
  t.after(() => pool.end());
  await runPostgresMigrations({ databaseUrl, migrationsFolder: fileURLToPath(new URL("../../../drizzle/pg", import.meta.url)), targetEnvironment: "development", productionMigrationAllowed: false, runbookAcknowledged: false });
  const fixtures = candidate.rehearsalFixtures;
  for (const [table, rows] of [["cities", fixtures.cities], ["schools", fixtures.schools], ["programs", fixtures.programs]]) {
    await pool.query(`insert into ${table} select * from jsonb_populate_recordset(null::${table},$1::jsonb)`, [JSON.stringify(rows)]);
  }
  const ids = fixtures.cities.map(row => row.id);
  const state = async client => (await client.query("select to_jsonb(c) data from cities c where id=any($1::uuid[]) order by slug", [ids])).rows.map(row => row.data);
  const connection = await pool.connect();
  try {
    const before = cityCandidateSha256(await state(connection));
    await connection.query("begin isolation level serializable");
    const first = await applyCityReleaseCandidateForDisposableRehearsal(connection, candidate);
    assert.equal(first.citiesChanged, candidate.summary.expectedFirstPassChanges);
    assert.equal((await applyCityReleaseCandidateForDisposableRehearsal(connection, candidate)).citiesChanged, 0);

    const repository = new PostgresCatalogRepository({ query: async (statement, params) => (await connection.query(statement, params)).rows });
    assert.equal((await repository.listCities({ limit: 100, offset: 0 })).length, 0, "draft candidate must not leak into public results");

    await connection.query("savepoint hypothetical_public_predicate");
    await connection.query("update cities set status='active',verification_status='verified' where id=any($1::uuid[])", [ids]);
    const hypothetical = await repository.listCities({ limit: 100, offset: 0 });
    assert.equal(hypothetical.length, candidate.summary.candidateCities);
    assert.deepEqual(hypothetical.map(city => city.slug).sort(), candidate.operations.map(row => row.slug).sort());
    await connection.query("rollback to savepoint hypothetical_public_predicate");
    assert.equal((await repository.listCities({ limit: 100, offset: 0 })).length, 0);

    await connection.query("rollback");
    assert.equal(cityCandidateSha256(await state(connection)), before);
    t.diagnostic(`rehearsed ${candidate.summary.candidateCities} cities against the real public repository query`);
  } catch (error) {
    try { await connection.query("rollback"); } catch { /* disposable cleanup only */ }
    throw error;
  } finally {
    connection.release();
  }
});
