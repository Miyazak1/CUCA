import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import pg from "pg";
import { CatalogSeedWriter } from "../../../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport } from "../../../src/server/catalog/seed-contract.ts";
import { PostgresCatalogRepository } from "../../../src/server/catalog/postgres-repository.ts";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { runPostgresMigrations } from "../../../src/server/db/migration-runtime.ts";

const databaseUrl = process.env.CUAC_PG_REHEARSAL_URL;
const seedPath = process.env.CUAC_PG_CATALOG_SEED_PATH;
assert.ok(databaseUrl, "Catalog migration rehearsal requires its owned disposable database URL.");
assert.ok(seedPath, "Catalog migration rehearsal requires an explicit validated seed path.");
const target = new URL(databaseUrl);
assert.equal(target.protocol, "postgresql:");
assert.equal(target.hostname, "127.0.0.1");
assert.equal(target.username, "cuac_rehearsal");
assert.match(target.pathname, /^\/cuac_rehearsal_[a-f0-9]{24}$/);
assert.equal(target.search, "");

const pool = new pg.Pool({ connectionString: databaseUrl, max: 2, connectionTimeoutMillis: 5000, statement_timeout: 10_000 });
const client = createTransactionalSqlClient(pool);

test("validated catalog bundle imports atomically and replays deterministically", { timeout: 120_000 }, async t => {
  t.after(() => pool.end());
  const bundle = JSON.parse(await readFile(seedPath, "utf8"));
  const report = createCatalogMigrationValidationReport(bundle);
  assert.equal(report.ok, true, report.errors.join("\n"));

  await runPostgresMigrations({
    databaseUrl,
    migrationsFolder: fileURLToPath(new URL("../../../drizzle/pg", import.meta.url)),
    targetEnvironment: "development",
    productionMigrationAllowed: false,
    runbookAcknowledged: false,
  });

  const first = await client.transaction(tx => new CatalogSeedWriter(tx).writeBundle(bundle));
  const second = await client.transaction(tx => new CatalogSeedWriter(tx).writeBundle(bundle));
  assert.equal(first.ok, true);
  assert.deepEqual(second.written, first.written);
  assert.equal(first.written.length, report.operations.length);

  const expected = report.summary;
  const counts = await pool.query(`select
    (select count(*)::int from cities) as cities,
    (select count(*)::int from schools) as schools,
    (select count(*)::int from programs) as programs,
    (select count(*)::int from program_intakes) as "programIntakes",
    (select count(*)::int from scholarships) as scholarships,
    (select count(*)::int from catalog_source_evidence) as evidence`);
  assert.deepEqual(counts.rows[0], { ...expected, evidence: report.operations.length });

  const repository = new PostgresCatalogRepository(client);
  const activeCounts = {
    cities: (bundle.cities || []).filter(item => (item.status || "draft") === "active").length,
    schools: (bundle.schools || []).filter(item => (item.status || "draft") === "active").length,
    programs: (bundle.programs || []).filter(item => (item.status || "draft") === "active").length,
    scholarships: (bundle.scholarships || []).filter(item =>
      (item.status || "draft") === "active" && item.verificationStatus === "verified"
    ).length,
  };
  const countPublicRows = async list => {
    let total = 0;
    for (let offset = 0; ; offset += 100) {
      const page = await list({ limit: 100, offset });
      total += page.length;
      if (page.length < 100) return total;
    }
  };
  assert.equal(await countPublicRows(options => repository.listCities(options)), activeCounts.cities);
  assert.equal(await countPublicRows(options => repository.listSchools(options)), activeCounts.schools);
  assert.equal(await countPublicRows(options => repository.listPrograms(options)), activeCounts.programs);
  assert.equal(await countPublicRows(options => repository.listScholarships(options)), activeCounts.scholarships);
});
