import assert from "node:assert/strict";
import test from "node:test";
import { parseApplicantProfileUpdate, toApplicantProfileDto } from "../../../src/server/student/applicant-profile.ts";
import { PostgresApplicantProfiles } from "../../../src/server/student/postgres-applicant-profiles.ts";
import { StudentCoreService } from "../../../src/server/student/service.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { createStudentHttpHandlers } from "../../../src/server/student/http.ts";

const context = createRequestContext({ actorUserId: "owner", activeRole: "student", selectedSurface: "student", purpose: "student_action" });
const profile = { id: "profile", userId: "owner", revision: 1, fullName: "Applicant Name", contactEmail: null, citizenshipCountry: null };

test("applicant input preserves omission, explicit clears, Unicode names and email case", () => {
  assert.deepEqual(parseApplicantProfileUpdate({ expectedRevision: 0, fullName: " \u738b\u660e ", contactEmail: " Student@Example.test " }),
    { expectedRevision: 0, fullName: "\u738b\u660e", contactEmail: "Student@Example.test" });
  assert.deepEqual(parseApplicantProfileUpdate({ expectedRevision: 1, fullName: " ", citizenshipCountry: null }),
    { expectedRevision: 1, fullName: null, citizenshipCountry: null });
  assert.deepEqual(parseApplicantProfileUpdate({ expectedRevision: 1, citizenshipCountry: "CN" }), { expectedRevision: 1, citizenshipCountry: "CN" });
});

test("applicant input rejects authority, arbitrary payloads, invalid versions and malformed sensitive fields", () => {
  for (const extra of ["userId", "actorUserId", "role", "tenantSchoolId", "revision", "verified", "consent", "profileCompletion", "passport"]) {
    assert.throws(() => parseApplicantProfileUpdate({ expectedRevision: 0, fullName: "Name", [extra]: "untrusted" }), e => e.status === 400);
  }
  for (const expectedRevision of [undefined, null, -1, 0.1, "1", 2147483648, NaN]) {
    assert.throws(() => parseApplicantProfileUpdate({ expectedRevision, fullName: "Name" }), e => e.status === 400);
  }
  for (const [field, values] of [["fullName", [{}, true, "x".repeat(201), "x\nname", "Name\n", "x\u0000", "x\u0085", "x\u2028", "\ud800"]],
    ["contactEmail", ["bad", "a\n@example.test", "a..b@example.test", "x".repeat(321)]], ["citizenshipCountry", ["cn", "CHN", "1A", 12]]]) {
    for (const value of values) assert.throws(() => parseApplicantProfileUpdate({ expectedRevision: 0, [field]: value }), e => e.status === 400);
  }
  for (const value of [null, [], {}, { expectedRevision: 0 }]) assert.throws(() => parseApplicantProfileUpdate(value), e => e.status === 400);
});

test("applicant service denies wrong role, tenant or data class before repository access", async () => {
  const service = new StudentCoreService(new Proxy({}, { get() { assert.fail("Denied context reached repository"); } }));
  for (const overrides of [{ actorUserId: null }, { activeRole: "guest" }, { activeRole: "school_staff" },
    { activeRole: "cuac_admin" }, { tenantSchoolId: "school" }, { dataClassAllowlist: [] }]) {
    await assert.rejects(service.getOwnApplicantProfile({ ...context, ...overrides }), e => e.status === 403);
    await assert.rejects(service.updateOwnApplicantProfile({ ...context, ...overrides }, { expectedRevision: 0, fullName: "Name" }), e => e.status === 403);
  }
});

test("applicant audit contains fields and version but no personal values, and no-op emits nothing", async () => {
  const audits = [], calls = [];
  const service = new StudentCoreService({
    async updateApplicantProfile(userId, input) { calls.push({ userId, input }); return { profile, changed: calls.length === 1 }; },
    async getApplicantProfileByUserId(userId) { assert.equal(userId, "owner"); return profile; },
  }, { async record(event) { audits.push(event); } });
  for (let i = 0; i < 2; i++) assert.deepEqual(await service.updateOwnApplicantProfile(context, { expectedRevision: 0, fullName: profile.fullName }), profile);
  assert.equal(audits.length, 1);
  assert.doesNotMatch(JSON.stringify(audits), /Applicant Name/);
  assert.deepEqual(audits[0].metadata, { fields: ["fullName"], revision: 1 });
  assert.equal((await service.getOwnApplicantProfile(context)).id, profile.id);
});

test("applicant read checks current authority and returns only the explicit projection", async () => {
  let rows = [{ ...profile, secret: "not-visible", consent: true }];
  const repo = new PostgresApplicantProfiles({ async query(sql, params) {
    assert.deepEqual(params, ["owner"]); assert.match(sql, /p.user_id = u.id/);
    assert.match(sql, /account_status = 'active'/); assert.match(sql, /revoked_at is null/);
    assert.doesNotMatch(sql, /select \*|payments|agent_|school_applications/); return rows;
  } });
  assert.deepEqual(await repo.get("owner"), profile);
  assert.deepEqual(toApplicantProfileDto({ ...profile, secret: "hidden" }), profile);
  rows = [{ id: null }]; assert.equal(await repo.get("owner"), null);
  rows = []; await assert.rejects(repo.get("owner"), e => e.status === 403);
});

test("applicant mutation locks account, role and profile and rejects stale no-op", async () => {
  const calls = [];
  const repo = new PostgresApplicantProfiles({ async query(sql, params) { calls.push({ sql, params }); return calls.length % 3 === 0 ? [profile] : [{ id: "authority" }]; } });
  assert.deepEqual(await repo.update("owner", { expectedRevision: 1, fullName: profile.fullName }), { profile, changed: false });
  assert.match(calls[0].sql, /from users .*for share/); assert.match(calls[1].sql, /from user_roles .*for share/);
  assert.match(calls[2].sql, /p.user_id = \$1 for update/);
  await assert.rejects(repo.update("owner", { expectedRevision: 0, fullName: profile.fullName }), e => e.status === 409);
});

test("applicant HTTP dispatch reaches the same strict parser and never trusts a body owner", async () => {
  const auth = { async findActiveSessionByTokenHash() { return { id: "session", userId: "owner", activeRole: "student", selectedSurface: "student", tenantSchoolId: null, authStrength: "session", accountStatus: "active", expiresAt: new Date(Date.now() + 60000), revokedAt: null }; } };
  const service = new StudentCoreService({ async updateApplicantProfile(userId, input) {
    assert.equal(userId, "owner"); assert.deepEqual(input, { expectedRevision: 0, fullName: "Name" }); return { profile, changed: false };
  }, async getApplicantProfileByUserId() { return profile; } });
  const handlers = createStudentHttpHandlers(service, auth);
  const request = body => new Request("https://cuac.test/api/v1/student/applicant-profile", { method: "PATCH", headers: { cookie: "cuac_session=session-token", "content-type": "application/json" }, body: JSON.stringify(body) });
  assert.equal((await handlers.updateApplicantProfile(request({ expectedRevision: 0, fullName: "Name" }))).status, 200);
  assert.equal((await handlers.updateApplicantProfile(request({ expectedRevision: 0, fullName: "Name", userId: "other" }))).status, 400);
  assert.equal((await handlers.getApplicantProfile(new Request("https://cuac.test", { headers: { cookie: "cuac_session=session-token" } }))).status, 200);
});
