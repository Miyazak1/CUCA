import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { parseAddEducationRecord, parseUpdateEducationRecord, parseRemoveEducationRecord, validateEducationRecord, toEducationRecordDto } from "../../../src/server/student/education.ts";
import { PostgresEducationHistory } from "../../../src/server/student/postgres-education.ts";
import { StudentCoreService } from "../../../src/server/student/service.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { createStudentHttpHandlers } from "../../../src/server/student/http.ts";

const base = { expectedRevision: 0, institutionName: "School Name", educationLevel: "bachelor" };
const record = { id: randomUUID(), ...parseAddEducationRecord(base) };
delete record.expectedRevision;
const history = { revision: 1, records: [record] };
const context = createRequestContext({ actorUserId: "owner", activeRole: "student", selectedSurface: "student", purpose: "student_action" });

test("education defaults remain incomplete and preserve explicit self-reported data", () => {
  const parsed = parseAddEducationRecord({ ...base, institutionName: " \u5927\u5b66 ", institutionCountry: "CN" });
  assert.equal(parsed.institutionName, "\u5927\u5b66"); assert.equal(parsed.attendanceStatus, "unknown");
  for (const field of ["qualificationName", "fieldOfStudy", "startYear", "endYear", "expectedCompletionYear"]) assert.equal(parsed[field], null);
  assert.deepEqual(parseUpdateEducationRecord({ expectedRevision: 1, fieldOfStudy: null }), { expectedRevision: 1, fieldOfStudy: null });
  assert.deepEqual(parseRemoveEducationRecord({ expectedRevision: 1 }), { expectedRevision: 1 });
});

test("education fields reject authority, arbitrary metadata, malformed text, versions and years", () => {
  for (const key of ["userId", "recordId", "role", "tenantSchoolId", "verified", "GPA", "metadata", "consent", "files"]) {
    for (const parse of [parseAddEducationRecord, parseUpdateEducationRecord, parseRemoveEducationRecord]) {
      const input = parse === parseRemoveEducationRecord ? { expectedRevision: 1 } : { ...base, expectedRevision: 1 };
      assert.throws(() => parse({ ...input, [key]: "untrusted" }), e => e.status === 400);
    }
  }
  for (const extra of [{ institutionName: null }, { institutionName: " " }, { institutionName: "x".repeat(201) },
    { institutionName: "\ud800" }, { institutionName: "School\n" }, { fieldOfStudy: {} }, { fieldOfStudy: " " },
    { educationLevel: "verified_master" }, { attendanceStatus: "graduating" }, { institutionCountry: "cn" },
    { startYear: "2020" }, { endYear: 1899 }, { expectedCompletionYear: 2200 }, { startYear: 2020.5 },
    { expectedRevision: -1 }, { expectedRevision: "0" }, { expectedRevision: 2147483648 }]) {
    assert.throws(() => parseAddEducationRecord({ ...base, ...extra }), e => e.status === 400);
  }
  assert.throws(() => parseUpdateEducationRecord({ expectedRevision: 1 }), e => e.status === 400);
  assert.throws(() => parseUpdateEducationRecord({ expectedRevision: 0, fieldOfStudy: null }), e => e.status === 400);
  assert.throws(() => parseRemoveEducationRecord({ expectedRevision: 0 }), e => e.status === 400);
});

test("education chronology and expected completion are checked on the merged record", () => {
  const enrolled = parseAddEducationRecord({ ...base, attendanceStatus: "in_progress", startYear: 2022, expectedCompletionYear: 2026 });
  for (const extra of [{ endYear: 2025 }, { expectedCompletionYear: 2021 }, { attendanceStatus: "completed" }]) {
    assert.throws(() => validateEducationRecord({ ...enrolled, ...extra }), e => e.status === 400);
  }
  assert.equal(validateEducationRecord({ ...enrolled, attendanceStatus: "completed", endYear: 2026, expectedCompletionYear: null }).endYear, 2026);
  assert.throws(() => parseAddEducationRecord({ ...base, startYear: 2025, endYear: 2024 }), e => e.status === 400);
});

test("all education service operations deny wrong role, tenant or data class before storage", async () => {
  const service = new StudentCoreService(new Proxy({}, { get() { assert.fail("Denied context reached storage"); } }));
  for (const extra of [{ actorUserId: null }, { activeRole: "guest" }, { activeRole: "school_staff" }, { activeRole: "cuac_admin" }, { tenantSchoolId: "school" }, { dataClassAllowlist: ["student_pii"] }]) {
    const ctx = { ...context, ...extra };
    await assert.rejects(service.getOwnEducationHistory(ctx), e => e.status === 403);
    await assert.rejects(service.addOwnEducationRecord(ctx, base), e => e.status === 403);
    await assert.rejects(service.updateOwnEducationRecord(ctx, record.id, { expectedRevision: 1, fieldOfStudy: null }), e => e.status === 403);
    await assert.rejects(service.removeOwnEducationRecord(ctx, record.id, { expectedRevision: 1 }), e => e.status === 403);
  }
});

test("education service uses the owner and records metadata-only audits for changes, not no-op", async () => {
  const audit = []; let changed = true;
  const result = () => ({ history, recordId: record.id, changed });
  const service = new StudentCoreService({
    async getEducationHistory(userId) { assert.equal(userId, "owner"); return history; },
    async addEducationRecord(userId, revision, value) { assert.equal(userId, "owner"); assert.equal(revision, 0); assert.equal(value.institutionName, base.institutionName); return result(); },
    async updateEducationRecord(userId, id) { assert.equal(userId, "owner"); assert.equal(id, record.id); return result(); },
    async removeEducationRecord(userId, id, revision) { assert.equal(userId, "owner"); assert.equal(id, record.id); assert.equal(revision, 1); return result(); },
  }, { async record(event) { audit.push(event); } });
  assert.deepEqual(await service.getOwnEducationHistory(context), history);
  await service.addOwnEducationRecord(context, base);
  await service.updateOwnEducationRecord(context, record.id, { expectedRevision: 1, fieldOfStudy: "Private field" });
  await service.removeOwnEducationRecord(context, record.id, { expectedRevision: 1 });
  changed = false; await service.removeOwnEducationRecord(context, record.id, { expectedRevision: 1 });
  assert.equal(audit.length, 3); assert.doesNotMatch(JSON.stringify(audit), /School Name|Private field/);
  assert.deepEqual(audit.map(a => a.action), ["student.education_record.add", "student.education_record.update", "student.education_record.remove"]);
});

test("education collection read uses one owner-authorized snapshot and a bounded strict DTO", async () => {
  let rows = [{ revision: 1, records: [{ ...record, secret: "hidden" }] }];
  const repo = new PostgresEducationHistory({ async query(sql, params) {
    assert.deepEqual(params, ["owner", 21]); assert.match(sql, /r.user_id = u.id/); assert.match(sql, /r.removed_at is null/);
    assert.match(sql, /account_status = 'active'/); assert.match(sql, /revoked_at is null/); assert.match(sql, /limit \$2/);
    assert.doesNotMatch(sql, /select \*|agent_|payments|school_applications/); return rows;
  } });
  assert.deepEqual(await repo.get("owner"), history); assert.deepEqual(toEducationRecordDto({ ...record, secret: "hidden" }), record);
  rows = [{ revision: 0, records: [] }]; assert.deepEqual(await repo.get("owner"), { revision: 0, records: [] });
  rows = [{ revision: 1, records: Array(21).fill(record) }]; await assert.rejects(repo.get("owner"), e => e.status === 503);
  rows = []; await assert.rejects(repo.get("owner"), e => e.status === 403);
});

test("education HTTP handlers dispatch all commands through strict service parsing", async () => {
  const auth = { async findActiveSessionByTokenHash() { return { userId: "owner", activeRole: "student", selectedSurface: "student", tenantSchoolId: null, accountStatus: "active", authStrength: "session", expiresAt: new Date(Date.now() + 60000), revokedAt: null }; } };
  const result = { history, recordId: record.id, changed: false };
  const service = new StudentCoreService({ async getEducationHistory() { return history; }, async addEducationRecord() { return result; }, async updateEducationRecord() { return result; }, async removeEducationRecord() { return result; } });
  const handlers = createStudentHttpHandlers(service, auth);
  const request = (body, method = "POST") => new Request("https://cuac.test/education", { method, headers: { cookie: "cuac_session=token", "content-type": "application/json" }, ...(method === "GET" ? {} : { body: JSON.stringify(body) }) });
  assert.equal((await handlers.getEducationHistory(request(null, "GET"))).status, 200);
  assert.equal((await handlers.addEducationRecord(request(base))).status, 200);
  assert.equal((await handlers.updateEducationRecord(request({ expectedRevision: 1, fieldOfStudy: null }, "PATCH"), record.id)).status, 200);
  assert.equal((await handlers.removeEducationRecord(request({ expectedRevision: 1 }), record.id)).status, 200);
  assert.equal((await handlers.removeEducationRecord(request({ expectedRevision: 1, userId: "other" }), record.id)).status, 400);
  assert.equal((await handlers.updateEducationRecord(request({ expectedRevision: 1, fieldOfStudy: null }, "PATCH"), "invalid")).status, 400);
});
