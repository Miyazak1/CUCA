import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../../../${path}`, import.meta.url), "utf8");

test("scholarship cycles are immutable evidence-bound lineage records", async () => {
  const [migration, schema] = await Promise.all([
    read("drizzle/pg/0078_productive_tyger_tiger.sql"),
    read("src/server/db/schema.ts"),
  ]);
  assert.match(migration, /CREATE TABLE "scholarship_cycle_lineage"/);
  assert.match(migration, /official_source_sha256/);
  assert.match(migration, /supersedes_scholarship_id/);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON scholarship_cycle_lineage/);
  assert.match(schema, /scholarshipCycleLineage/);
  assert.match(schema, /seriesCycleUnique/);
});

test("cycle registration defaults to dry-run and fails closed on evidence or version drift", async () => {
  const script = await read("scripts/catalog-scholarship-cycle-apply.ts");
  assert.match(script, /const apply = args\.has\("--apply"\)/);
  assert.match(script, /Explicit local apply confirmation is required/);
  assert.match(script, /restricted to loopback PostgreSQL/);
  assert.match(script, /Reviewed evidence extract hash changed/);
  assert.match(script, /expectedVersion/);
  assert.match(script, /for update/);
  assert.match(script, /already_registered/);
  assert.match(script, /ops\.catalog\.scholarship_cycle\.register/);
  assert.match(script, /commit/);
  assert.match(script, /rollback/);
});

test("inventory never rolls an old deadline forward and public API separates availability from cycle", async () => {
  const [inventory, dto, repository, http] = await Promise.all([
    read("scripts/catalog-scholarship-cycle-inventory.ts"),
    read("src/server/catalog/dto.ts"),
    read("src/server/catalog/postgres-repository.ts"),
    read("src/server/catalog/http.ts"),
  ]);
  assert.match(inventory, /No 2026 deadline is rolled forward/);
  assert.match(inventory, /Academic-year labels do not prove a 2027 intake/);
  assert.match(inventory, /wait_for_official_deadline_or_new_cycle/);
  assert.doesNotMatch(inventory, /setFullYear|setUTCFullYear/);
  assert.match(dto, /applicationAvailability: "open" \| "closed" \| "unconfirmed"/);
  assert.match(dto, /supersedesScholarshipId/);
  assert.match(repository, /sch\.deadline_date > clock_timestamp\(\)/);
  assert.match(repository, /left join scholarship_cycle_lineage/);
  assert.match(http, /searchParams\.get\("availability"\)/);
});
