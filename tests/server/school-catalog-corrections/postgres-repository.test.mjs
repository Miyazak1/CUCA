import assert from "node:assert/strict";
import test from "node:test";
import { PostgresSchoolCatalogCorrectionRepository } from "../../../src/server/index.ts";

const schoolId = "11111111-1111-4111-8111-111111111111";
const staffId = "22222222-2222-4222-8222-222222222222";
const opsId = "33333333-3333-4333-8333-333333333333";
const adminId = "44444444-4444-4444-8444-444444444444";
const correctionId = "55555555-5555-4555-8555-555555555555";
const grantId = "66666666-6666-4666-8666-666666666666";
const membershipId = "77777777-7777-4777-8777-777777777777";
const sourceAt = new Date("2026-09-03T01:00:00.000Z");
const now = new Date("2026-09-03T02:00:00.000Z");

function school() {
  return { id: schoolId, nameZh: null, nameEn: "Example University", updatedAt: "2026-09-03T01:00:00.000000Z",
    verificationStatus: "verified", websiteUrl: "https://example.edu/", admissionsUrl: null,
    applicationLevel: null, languageOfInstruction: null, deadlineSummary: null,
    tuitionSummary: null, applicationFee: null };
}
function correction(overrides = {}) {
  return { id: correctionId, schoolId, schoolNameZh: null, schoolNameEn: "Example University",
    sourceSchoolUpdatedAt: sourceAt, changes: { websiteUrl: "https://example.edu/new" },
    evidenceUrl: "https://example.edu/notice", reasonCode: "official_website_changed", revision: 1,
    status: "submitted", requestedMembershipRole: "school_admin", claimedByUserId: null,
    claimedByRole: null, claimedAt: null, resolvedByUserId: null, resolutionCode: null,
    resolutionReference: null, resolvedAt: null, resultSchoolUpdatedAt: null,
    createdAt: now, updatedAt: now, ...overrides };
}
function fakeClient(responder) {
  const calls = [];
  const client = { async transaction(work) { return work(client); },
    async query(statement, params) { calls.push({ statement, params }); return responder(statement, params, calls.length); } };
  return { calls, client };
}

test("school submission rechecks membership, locks the exact school generation and stores fixed JSON", async () => {
  const { calls, client } = fakeClient(statement => /from users u/.test(statement)
    ? [{ membershipId, membershipRole: "school_admin" }]
    : /from schools[\s\S]+for update/.test(statement) ? [school()]
    : /clock_timestamp\(\) as/.test(statement) ? [{ recordedAt: now }]
    : /insert into school_catalog_correction_requests/.test(statement) ? [{ id: correctionId }]
    : /from school_catalog_correction_requests r/.test(statement) ? [correction()] : []);
  const result = await new PostgresSchoolCatalogCorrectionRepository(client).submit({
    actorUserId: staffId, schoolId, sourceSchoolUpdatedAt: "2026-09-03T01:00:00.000000Z",
    changes: { websiteUrl: "https://example.edu/new" }, evidenceUrl: "https://example.edu/notice",
    reasonCode: "official_website_changed",
  });
  assert.equal(result.authorized, true);
  assert.match(calls[0].statement, /for share of u, r, m/);
  assert.match(calls[1].statement, /status = 'active' for update/);
  assert.match(calls[3].statement, /select s\.id,s\.updated_at/);
  assert.match(calls[3].statement, /to_char\(s\.updated_at at time zone 'UTC'/);
  assert.match(calls[3].statement, /on conflict \(school_id, source_school_updated_at\)/);
  assert.deepEqual(calls[3].params.slice(5, 8), [staffId, membershipId, "school_admin"]);
});

test("application uses fixed columns, generation CAS and clears verification authority", async () => {
  const claimed = correction({ revision: 2, status: "claimed", claimedByUserId: opsId,
    claimedByRole: "cuac_ops", claimedAt: now });
  const resolvedAt = new Date(now.getTime() + 1000);
  const resolved = correction({ ...claimed, revision: 3, status: "applied", resolvedByUserId: adminId,
    resolutionCode: "applied_unverified", resolutionReference: "CASE:42", resolvedAt,
    resultSchoolUpdatedAt: resolvedAt, updatedAt: resolvedAt });
  const authority = { grantId, actorUserId: adminId, activeRole: "cuac_admin", expiresAt: new Date("2027-01-01") };
  const { calls, client } = fakeClient(statement => /from users u/.test(statement) ? [authority]
    : /for update of r, s/.test(statement) ? [claimed]
    : /clock_timestamp\(\) as/.test(statement) ? [{ recordedAt: resolvedAt }]
    : /update schools set/.test(statement) ? [{ updatedAt: resolvedAt }]
    : /update school_catalog_correction_requests set status/.test(statement) ? [{ id: correctionId }]
    : /from school_catalog_correction_requests r/.test(statement) ? [resolved] : []);
  const result = await new PostgresSchoolCatalogCorrectionRepository(client).resolve({
    actorUserId: adminId, activeRole: "cuac_admin", correctionId, expectedRevision: 2,
    code: "applied_unverified", reference: "CASE:42",
  });
  assert.equal(result.value.status, "applied");
  const sql = calls.find(call => /update schools set/.test(call.statement)).statement;
  for (const column of ["website_url", "admissions_url", "application_level", "language_of_instruction",
    "deadline_summary", "tuition_summary", "application_fee"]) assert.match(sql, new RegExp(column));
  assert.match(sql, /verification_status = 'unverified'/);
  assert.match(sql, /verified_by_user_id = null/);
  assert.match(sql, /updated_at = \(select source_school_updated_at/);
  assert.doesNotMatch(sql, /\$\{.*field/i);
});

test("repository rejects same-person resolution and absent live authority before mutation", async () => {
  const claimed = correction({ revision: 2, status: "claimed", claimedByUserId: adminId,
    claimedByRole: "cuac_admin", claimedAt: now });
  const authority = { grantId, actorUserId: adminId, activeRole: "cuac_admin", expiresAt: new Date("2027-01-01") };
  const same = fakeClient(statement => /from users u/.test(statement) ? [authority]
    : /for update of r, s/.test(statement) ? [claimed] : []);
  assert.deepEqual(await new PostgresSchoolCatalogCorrectionRepository(same.client).resolve({
    actorUserId: adminId, activeRole: "cuac_admin", correctionId, expectedRevision: 2,
    code: "rejected_unverifiable", reference: "CASE:1",
  }), { authorized: true, value: null });
  assert.equal(same.calls.length, 2);
  const absent = fakeClient(() => []);
  assert.deepEqual(await new PostgresSchoolCatalogCorrectionRepository(absent.client).claim({
    actorUserId: opsId, activeRole: "cuac_ops", correctionId, expectedRevision: 1,
  }), { authorized: false });
  assert.equal(absent.calls.length, 1);
});
