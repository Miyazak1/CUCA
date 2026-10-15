import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import pg from "pg";
import { runPostgresMigrations } from "../../../src/server/db/migration-runtime.ts";
import {
  applyRequirementCandidateForDisposableRehearsal,
  stableRequirementVersionIdentity,
  validateRequirementReleaseCandidate,
} from "../../../scripts/lib/catalog-requirement-candidate-runtime.ts";

const databaseUrl = process.env.CUAC_PG_REHEARSAL_URL;
assert.equal(process.env.CUAC_PG_CATALOG_REQUIREMENT_CANDIDATE, "1");
assert.ok(databaseUrl);
const target = new URL(databaseUrl);
assert.equal(target.hostname, "127.0.0.1");
assert.equal(target.username, "cuac_rehearsal");
assert.match(target.pathname, /^\/cuac_rehearsal_[a-f0-9]{24}$/);
const candidate = validateRequirementReleaseCandidate(JSON.parse(await readFile(
  new URL("../../../seeds/application-requirements-release-candidate.unreviewed.json", import.meta.url), "utf8")));
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5000, statement_timeout: 120_000 });

test("unreviewed requirement candidate creates only rollback-scoped drafts in disposable PostgreSQL", { timeout: 180_000 }, async t => {
  t.after(() => pool.end());
  await runPostgresMigrations({ databaseUrl, migrationsFolder: fileURLToPath(new URL("../../../drizzle/pg", import.meta.url)), targetEnvironment: "development", productionMigrationAllowed: false, runbookAcknowledged: false });
  const connection = await pool.connect();
  try {
    await connection.query("begin isolation level serializable");
    const schools = [...new Set(candidate.operations.map(operation => operation.schoolSlug))];
    for (const schoolSlug of schools) {
      await connection.query("insert into schools(id,slug,name_en,status) values($1::uuid,$2,$2,'draft')", [stableRequirementVersionIdentity(`rehearsal-school:${schoolSlug}`), schoolSlug]);
    }
    const programs = new Map(candidate.operations.map(operation => [operation.programSlug, operation.schoolSlug]));
    for (const [programSlug, schoolSlug] of programs) {
      const schoolId = stableRequirementVersionIdentity(`rehearsal-school:${schoolSlug}`);
      const programId = stableRequirementVersionIdentity(`rehearsal-program:${programSlug}`);
      await connection.query("insert into programs(id,school_id,slug,name_en,degree_level,status) values($1::uuid,$2::uuid,$3,$3,'Rehearsal','draft')", [programId, schoolId, programSlug]);
    }
    for (const operation of candidate.operations) {
      const programId = stableRequirementVersionIdentity(`rehearsal-program:${operation.programSlug}`);
      const intakeId = stableRequirementVersionIdentity(`rehearsal-intake:${operation.programSlug}:${operation.intakeTerm}:${operation.intakeYear}`);
      await connection.query("insert into program_intakes(id,program_id,intake_term,intake_year,status) values($1::uuid,$2::uuid,$3,$4,'closed')", [intakeId, programId, operation.intakeTerm, operation.intakeYear]);
    }
    const first = await applyRequirementCandidateForDisposableRehearsal(connection, candidate);
    assert.equal(first.draftsChanged, candidate.summary.operationCount);
    assert.equal((await applyRequirementCandidateForDisposableRehearsal(connection, candidate)).draftsChanged, 0);
    const counts = await connection.query(`select
      (select count(*)::integer from program_requirement_versions where review_status='draft') drafts,
      (select count(*)::integer from program_requirement_versions where review_status='approved') approved,
      (select count(*)::integer from program_requirement_publications) publications`);
    assert.deepEqual(counts.rows[0], { drafts: candidate.summary.operationCount, approved: 0, publications: 0 });
    await connection.query("rollback");
    const after = await connection.query("select count(*)::integer count from program_requirement_versions");
    assert.equal(after.rows[0].count, 0);
    t.diagnostic(`${candidate.summary.operationCount} requirement drafts, including ${candidate.summary.currentOperationCount} current 2027 routes, resolved, replayed idempotently, remained non-public, and were rolled back`);
  } catch (error) {
    try { await connection.query("rollback"); } catch { /* Disposable cleanup only. */ }
    throw error;
  } finally {
    connection.release();
  }
});
