import assert from "node:assert/strict";
import test from "node:test";
import { PostgresAccountDeletionExecutionRepository } from "../../../src/server/index.ts";

const actor = { actorUserId: "11111111-1111-4111-8111-111111111111", activeRole: "cuac_admin" };
const authority = { grantId: "22222222-2222-4222-8222-222222222222", ...actor, expiresAt: new Date() };
const executionId = "33333333-3333-4333-8333-333333333333";
function client(responder) { const calls = [], value = { async transaction(work) { return work(value); },
  async query(statement, params) { calls.push({ statement, params }); return responder(statement, params, calls.length); } };
  return { calls, value }; }
const dbRow = { executionId, dataRightsRequestId: "44444444-4444-4444-8444-444444444444",
  status: "review_required", blockerCodes: ["legal_hold_review_required", "backup_tombstone_required"], revision: 2,
  preparedAt: new Date("2026-09-20T00:00:00Z"), updatedAt: new Date("2026-09-20T00:01:00Z"),
  quarantinedAt: null, purgeAfter: null,
  reviewId: null, reviewVersion: null, sourceExecutionRevision: null, legalHoldResult: null,
  legalHoldReasonCode: null, legalHoldCaseReference: null, reviewedByUserId: null, reviewedAt: null };

test("refresh recomputes blockers from server-side facts while preserving both mandatory gates", async () => {
  const f = client(statement => /from users u/.test(statement) ? [authority]
    : /update account_deletion_executions x set blocker_codes_json/.test(statement) ? [{ id: executionId }]
    : /select x.id as/.test(statement) ? [dbRow] : []);
  const result = await new PostgresAccountDeletionExecutionRepository(f.value).refresh({ ...actor, executionId, expectedRevision: 1 });
  assert.equal(result.authorized, true); assert.equal(result.value.revision, 2);
  const sql = f.calls[1].statement;
  assert.match(sql, /'legal_hold_review_required','backup_tombstone_required'/);
  assert.match(sql, /student_file_assets/); assert.match(sql, /application_fee_entitlements/);
  assert.match(sql, /school_applications/); assert.match(sql, /student_age_assurances/);
  assert.doesNotMatch(sql, /delete from|account_status\s*=|revoked_at\s*=/i);
});

test("legal-hold decisions are append-only and bind exact live admin grant plus execution revision", async () => {
  const reviewed = { ...dbRow, reviewId: "55555555-5555-4555-8555-555555555555", reviewVersion: 1,
    sourceExecutionRevision: 1, legalHoldResult: "clear_candidate", legalHoldReasonCode: "no_hold_found",
    legalHoldCaseReference: "LEGAL:1", reviewedByUserId: actor.actorUserId, reviewedAt: dbRow.updatedAt };
  const f = client(statement => /from users u/.test(statement) ? [authority]
    : /insert into account_deletion_legal_hold_reviews/.test(statement) ? [{ id: executionId }]
    : /select x.id as/.test(statement) ? [reviewed] : []);
  const result = await new PostgresAccountDeletionExecutionRepository(f.value).recordLegalHoldReview({ ...actor,
    executionId, reviewId: reviewed.reviewId, expectedRevision: 1, result: "clear_candidate",
    reasonCode: "no_hold_found", caseReference: "LEGAL:1" });
  assert.equal(result.value.latestLegalHoldReview.version, 1);
  assert.match(f.calls[1].statement, /max\(r\.version\)\+1/);
  assert.match(f.calls[1].statement, /on conflict do nothing/);
  assert.deepEqual(f.calls[1].params.slice(6), [actor.actorUserId, authority.grantId, "cuac_admin"]);
});

test("repository checks live staff authority before queue access", async () => {
  const f = client(() => []);
  assert.deepEqual(await new PostgresAccountDeletionExecutionRepository(f.value).list({ ...actor, limit: 50 }),
    { authorized: false }); assert.equal(f.calls.length, 1);
});

test("quarantine atomically revokes sessions, disables login, advances execution and stores trusted evidence", async () => {
  const quarantinedAt = new Date("2026-09-20T00:05:00Z"), purgeAfter = new Date("2026-10-20T00:05:00Z");
  const quarantined = { ...dbRow, status: "quarantined", blockerCodes: [], revision: 3,
    updatedAt: quarantinedAt, quarantinedAt, purgeAfter };
  const f = client(statement => /from users u/.test(statement) && /cuac_staff_access_grants/.test(statement) ? [authority]
    : /with target as/.test(statement) && /account_deletion_quarantine_receipts/.test(statement) ? [{ id: executionId }]
    : /select x.id as/.test(statement) ? [quarantined] : []);
  const result = await new PostgresAccountDeletionExecutionRepository(f.value).quarantine({ ...actor, executionId,
    quarantineId: "66666666-6666-4666-8666-666666666666", expectedRevision: 2,
    tombstone: { receiptSha256: `sha256:${"c".repeat(64)}`, recordedAt: dbRow.preparedAt } });
  assert.equal(result.value.status, "quarantined");
  const sql = f.calls[1].statement;
  assert.match(sql, /h\.source_execution_revision\+1=x\.revision/);
  assert.match(sql, /account_status='deletion_quarantined'/);
  assert.match(sql, /update auth_sessions s set revoked_at=/);
  assert.match(sql, /step_up_expires_at=null/);
  assert.match(sql, /purge_after=d\.quarantined_at\+interval '30 days'/);
  assert.match(sql, /insert into account_deletion_quarantine_receipts/);
  assert.doesNotMatch(sql, /delete from/i);
});
