import assert from "node:assert/strict";
import test from "node:test";
import { dataQualityIssueForTest, PostgresOpsDataQualityRepository } from "../../../src/server/index.ts";

const authority = { grantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  actorUserId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", activeRole: "cuac_ops",
  expiresAt: new Date("2026-09-04T00:00:00Z") };
const entityId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const evidenceId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const sourceAt = new Date("2026-09-03T00:00:00Z");

function review(overrides = {}) {
  return { reviewId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", sourceEntityUpdatedAt: sourceAt,
    sourceEvidenceId: evidenceId, sourceEvidenceCapturedAt: sourceAt, sourceIssueCode: "unverified",
    revision: 1, status: "investigating", assignedUserId: authority.actorUserId, assignedRole: "cuac_ops",
    escalationCode: null, escalationReference: null, escalatedAt: null, resolvedByUserId: null,
    resolutionCode: null, resolutionReference: null, resolvedAt: null, reviewDueAt: null,
    resultEntityUpdatedAt: null, createdAt: sourceAt, updatedAt: sourceAt, ...overrides };
}

function fakeClient(responder) {
  const calls = [];
  const client = { async transaction(work) { return work(client); },
    async query(statement, params) { calls.push({ statement, params }); return responder(statement, params, calls.length); } };
  return { calls, client };
}

test("Postgres data-quality queue uses a fixed catalog union and minimal source projection", async () => {
  const { calls, client } = fakeClient(statement => /from users u/.test(statement) ? [authority] : []);
  assert.deepEqual(await new PostgresOpsDataQualityRepository(client).listCandidates({
    actorUserId: authority.actorUserId, activeRole: "cuac_ops", cursor: null, limit: 21,
  }), { authorized: true, cursorFound: true, rows: [] });
  assert.match(calls[0].statement, /for share of u, r, g/);
  assert.match(calls[1].statement, /from cities/);
  assert.match(calls[1].statement, /from schools/);
  assert.match(calls[1].statement, /from programs/);
  assert.match(calls[1].statement, /from scholarships/);
  assert.match(calls[1].statement, /order by captured_at desc, id desc limit 1/);
  assert.doesNotMatch(calls[1].statement, /evidence_note|metadata_json|source_field_lineage_json|quality_score|missing_fields/i);
});

test("Postgres data-quality claim binds current entity and latest evidence generation", async () => {
  const current = review();
  const { calls, client } = fakeClient(statement => /from users u/.test(statement) ? [authority]
    : /insert into ops_catalog_quality_reviews/.test(statement) ? [current] : []);
  assert.deepEqual(await new PostgresOpsDataQualityRepository(client).claimReview({
    actorUserId: authority.actorUserId, activeRole: "cuac_ops", entityType: "program", entityId,
  }), { authorized: true, value: current });
  assert.match(calls[1].statement, /from programs e where e\.id = \$1 for update/);
  assert.match(calls[1].statement, /source_entity_updated_at,source_evidence_id,source_evidence_captured_at/);
  assert.match(calls[1].statement, /on conflict on constraint ops_catalog_quality_reviews_generation_unique do nothing/);
  assert.deepEqual(calls[1].params.slice(1), [authority.actorUserId, authority.grantId, "cuac_ops"]);
});

test("Postgres data-quality resolution uses database-side generation CAS and bounded review dates", async () => {
  const admin = { ...authority, actorUserId: "ffffffff-ffff-4fff-8fff-ffffffffffff", activeRole: "cuac_admin" };
  const due = new Date("2027-03-03T00:00:00Z"), resolved = review({ revision: 2, status: "verified",
    resolvedByUserId: admin.actorUserId, resolutionCode: "source_confirmed", resolutionReference: "CASE:1",
    resolvedAt: sourceAt, reviewDueAt: due, resultEntityUpdatedAt: sourceAt });
  const { calls, client } = fakeClient(statement => /from users u/.test(statement) ? [admin]
    : /update ops_catalog_quality_reviews r set status = \$9/.test(statement) ? [resolved] : []);
  assert.deepEqual(await new PostgresOpsDataQualityRepository(client).resolveReview({
    actorUserId: admin.actorUserId, activeRole: "cuac_admin", entityType: "program", entityId,
    expectedRevision: 1, code: "source_confirmed", reference: "CASE:1", reviewDueAt: due,
  }), { authorized: true, value: resolved });
  const sql = calls[1].statement;
  assert.match(sql, /r\.source_entity_updated_at = q\.entity_updated_at/);
  assert.match(sql, /source_evidence_id is not distinct from q\.evidence_id/);
  assert.match(sql, /interval '30 days'/);
  assert.match(sql, /interval '366 days'/);
  assert.match(sql, /verified_by_user_id/);
  assert.match(sql, /result_entity_updated_at/);
});

test("data-quality classification and authority fail closed", async () => {
  const now = new Date("2026-09-03T00:00:00Z"), evidence = { id: evidenceId,
    sourceUrl: "https://example.edu/source", capturedAt: sourceAt };
  const base = { verificationStatus: "unverified", verifiedByUserId: null, lastVerifiedAt: null,
    nextReviewDueAt: null, entityUpdatedAt: sourceAt, evidence, now };
  assert.equal(dataQualityIssueForTest(base), "unverified");
  assert.equal(dataQualityIssueForTest({ ...base, evidence: null }), "missing_source_evidence");
  assert.equal(dataQualityIssueForTest({ ...base, evidence: { ...evidence, sourceUrl: "http://unsafe" } }),
    "invalid_source_url");
  assert.equal(dataQualityIssueForTest({ ...base, verificationStatus: "verified", verifiedByUserId: authority.actorUserId,
    lastVerifiedAt: sourceAt, nextReviewDueAt: new Date("2027-01-01T00:00:00Z") }), null);
  const { calls, client } = fakeClient(() => []);
  assert.deepEqual(await new PostgresOpsDataQualityRepository(client).claimReview({
    actorUserId: authority.actorUserId, activeRole: "cuac_ops", entityType: "program", entityId,
  }), { authorized: false });
  assert.equal(calls.length, 1);
});
