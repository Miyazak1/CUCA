import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import pg from "pg";
import { runPostgresMigrations } from "../../../src/server/db/migration-runtime.ts";
import { runOpsDataQualityRehearsal } from "./ops-data-quality-rehearsal.mjs";

const databaseUrl = process.env.CUAC_PG_REHEARSAL_URL;
assert.ok(databaseUrl, "Run npm run db:pg:rehearse:data-quality; this test never uses DATABASE_URL.");
const target = new URL(databaseUrl);
assert.equal(target.protocol, "postgresql:");
assert.equal(target.hostname, "127.0.0.1");
assert.equal(target.username, "cuac_rehearsal");
assert.match(target.pathname, /^\/cuac_rehearsal_[a-f0-9]{24}$/);
assert.equal(target.search, "");

const pool = new pg.Pool({ connectionString: databaseUrl, max: 8,
  connectionTimeoutMillis: 5000, statement_timeout: 10_000 });

test("real PostgreSQL Ops data-quality rehearsal", { timeout: 120_000 }, async t => {
  t.after(() => pool.end());
  await runPostgresMigrations({
    databaseUrl,
    migrationsFolder: fileURLToPath(new URL("../../../drizzle/pg", import.meta.url)),
    targetEnvironment: "development",
    productionMigrationAllowed: false,
    runbookAcknowledged: false,
  });
  await runOpsDataQualityRehearsal(t, pool);
});
