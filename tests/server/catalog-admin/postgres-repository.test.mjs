import assert from "node:assert/strict";
import test from "node:test";
import { PostgresCatalogAdminRepository } from "../../../src/server/catalog-admin/postgres-repository.ts";
import { CITY_PUBLICATION_PREDICATE, SCHOOL_PUBLICATION_PREDICATE, PROGRAM_PUBLICATION_PREDICATE,
  SCHOLARSHIP_PUBLICATION_PREDICATE } from "../../../src/server/catalog-admin/publication-readiness.ts";

const actor = { actorUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", activeRole: "cuac_ops" };
const authority = { grantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", ...actor,
  expiresAt: new Date("2027-01-01T00:00:00Z") };

function fakeClient(responder) {
  const calls = [];
  const client = { async transaction(work) { return work(client); }, async query(statement, params = []) {
    calls.push({ statement, params }); return responder(statement, params, calls.length);
  } };
  return { client, calls };
}

test("publication lifecycle and readiness share canonical cross-entity gates", () => {
  assert.match(CITY_PUBLICATION_PREDICATE, /catalog_source_evidence/);
  assert.match(SCHOOL_PUBLICATION_PREDICATE, /city_ref\.status='active'/);
  assert.match(PROGRAM_PUBLICATION_PREDICATE, /s\.status='active'/);
  assert.match(PROGRAM_PUBLICATION_PREDICATE, /c\.status='active'/);
  assert.match(SCHOLARSHIP_PUBLICATION_PREDICATE, /deadline_date>clock_timestamp/);
  assert.match(SCHOLARSHIP_PUBLICATION_PREDICATE, /p\.school_id=sc\.school_id/);
});

test("Postgres readiness projection is fixed, paginated and aggregates all four entity types", async () => {
  const { client, calls } = fakeClient(statement => {
    if (/from users u/.test(statement)) return [authority];
    if (/select count\(\*\)::int as total from readiness/.test(statement)) return [{ total: 0 }];
    return [];
  });
  const result = await new PostgresCatalogAdminRepository(client).listReadiness({ ...actor, entityType: null,
    status: null, readiness: "blocked", reason: "inactive_school", query: null, limit: 25, offset: 0 });
  assert.equal(result.authorized, true);
  assert.equal(result.value.total, 0);
  assert.deepEqual(result.value.summary.byEntityType, {
    city: { total: 0, ready: 0, blocked: 0 }, school: { total: 0, ready: 0, blocked: 0 },
    program: { total: 0, ready: 0, blocked: 0 }, scholarship: { total: 0, ready: 0, blocked: 0 },
  });
  const sql = calls.slice(1).map(call => call.statement).join("\n");
  for (const table of ["cities c", "schools s", "programs p", "scholarships sc"]) assert.match(sql, new RegExp(table));
  assert.match(sql, /blocking_reasons/);
  assert.match(sql, /warning_reasons/);
  assert.match(sql, /limit \$6 offset \$7/);
  assert.deepEqual(calls[2].params.slice(0, 4), [null, null, "blocked", "inactive_school"]);
});

test("Postgres readiness detail returns only the exact typed entity", async () => {
  const entityId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc", updatedAt = new Date();
  const row = { entityType: "program", entityId, slug: "example-program", label: "Example program", status: "draft",
    verificationStatus: "unverified", version: 1, ready: false, blockingReasons: ["inactive_school"],
    warningReasons: ["draft_record"], nextReviewDueAt: null, updatedAt };
  const { client, calls } = fakeClient(statement => /from users u/.test(statement) ? [authority]
    : /from readiness where entity_type=\$1 and id=\$2/.test(statement) ? [row] : []);
  const result = await new PostgresCatalogAdminRepository(client).getReadiness({ ...actor, entityType: "program", entityId });
  assert.equal(result.authorized, true);
  assert.deepEqual(result.value, row);
  assert.deepEqual(calls[1].params, ["program", entityId]);
});
