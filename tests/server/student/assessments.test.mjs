import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { assessmentRecordData, parseAddAssessmentRecord, parseUpdateAssessmentRecord, parseRemoveAssessmentRecord, validateAssessmentRecord, toAssessmentRecordDto } from "../../../src/server/student/assessments.ts";
import { PostgresAssessmentHistory } from "../../../src/server/student/postgres-assessments.ts";
import { StudentCoreService } from "../../../src/server/student/service.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { createStudentHttpHandlers } from "../../../src/server/student/http.ts";
import { assessmentInput } from "./assessment-fixture.mjs";

const data = assessmentRecordData(parseAddAssessmentRecord(assessmentInput()));
const record = toAssessmentRecordDto({ id: randomUUID(), ...data });
const history = { revision: 1, records: [record] };
const context = createRequestContext({ actorUserId: "owner", activeRole: "student", selectedSurface: "student", purpose: "student_action", authStrength: "session" });
const invalid = work => assert.throws(work, e => e.status === 400);

test("assessment records preserve original textual scores and explicit report types without verification or conversion", () => {
  const input = assessmentInput(0, { assessmentName: " \u8bed\u8a00\u8003\u8bd5 ", components: [{ name: "Overall", value: "7.50", scale: "0-9" }, { name: "Grade", value: "A*" }] });
  const parsed = parseAddAssessmentRecord(input);
  assert.equal(parsed.assessmentName, "\u8bed\u8a00\u8003\u8bd5");
  assert.deepEqual(parsed.components.map(c => c.value), ["7.50", "A*"]);
  assert.equal(parsed.components[1].scale, null); assert.equal(parsed.components[1].testDate, null);
  input.components[0].value = "changed"; assert.equal(parsed.components[0].value, "7.50");
  const dto = toAssessmentRecordDto({ id: record.id, ...assessmentRecordData(parsed), evidenceStatus: "verified", privateField: "hidden" });
  assert.equal(dto.evidenceStatus, "unverified"); assert.equal(dto.privateField, undefined); assert.equal(Object.keys(dto).length, 10);
});

test("planned and pending assessments remain incomplete with no automatic score dates expiry or acceptance", () => {
  for (const resultStatus of ["planned", "awaiting_result"]) {
    const parsed = parseAddAssessmentRecord({ expectedRevision: 0, assessmentCategory: "admissions", assessmentName: "Entrance exam", resultStatus });
    assert.equal(parsed.testDate, null); assert.equal(parsed.reportDate, null); assert.equal(parsed.resultForm, "unspecified");
    assert.deepEqual(parsed.components, []); assert.equal(parsed.assessmentVariant, null);
    invalid(() => parseAddAssessmentRecord({ ...parsed, components: [{ name: "Score", value: "100" }] }));
    invalid(() => parseAddAssessmentRecord({ ...parsed, reportDate: "2026-02-01" }));
  }
  invalid(() => parseAddAssessmentRecord(assessmentInput(0, { components: [] })));
  assert.equal(parseAddAssessmentRecord(assessmentInput(0, { testDate: null, reportDate: null })).reportDate, null);
});

test("assessment input rejects authority credential claims arbitrary metadata and invalid bounded text", () => {
  for (const key of ["userId", "recordId", "role", "tenantSchoolId", "evidenceStatus", "verified", "eligible", "expiresAt", "password", "reportNumber", "files", "metadata", "consent"]) {
    invalid(() => parseAddAssessmentRecord({ ...assessmentInput(), [key]: true }));
    invalid(() => parseUpdateAssessmentRecord({ expectedRevision: 1, [key]: true }));
    invalid(() => parseRemoveAssessmentRecord({ expectedRevision: 1, [key]: true }));
  }
  for (const extra of [{ assessmentName: null }, { assessmentName: " " }, { assessmentName: "x".repeat(121) }, { assessmentName: "\ud800" },
    { assessmentVariant: "a\n" }, { assessmentVariant: " " }, { assessmentCategory: "verified" }, { resultStatus: "passed" }, { resultForm: "best_guess" },
    { components: null }, { components: {} }, { components: [{ name: "Overall", value: 7.5 }] }, { components: [{ name: "Overall", value: " " }] },
    { components: [{ name: "Overall", value: "7.5", scale: "\udfff" }] }, { components: [{ name: "Overall", value: "7.5", verified: true }] },
    { components: [{ name: "Overall", value: "7.5", scale: "" }] }, { expectedRevision: -1 }, { expectedRevision: "0" }, { expectedRevision: 2147483648 }]) {
    invalid(() => parseAddAssessmentRecord(assessmentInput(0, extra)));
  }
  invalid(() => parseUpdateAssessmentRecord({ expectedRevision: 1 }));
  invalid(() => parseUpdateAssessmentRecord({ expectedRevision: 0, testDate: null }));
  invalid(() => parseRemoveAssessmentRecord({ expectedRevision: 0 }));
});

test("assessment component identity includes explicit scale and preserves ordering without implicit superscoring", () => {
  invalid(() => parseAddAssessmentRecord(assessmentInput(0, { components: [{ name: "Overall", value: "5.5", scale: "1-6" }, { name: " overall ", value: "6", scale: "1-6" }] })));
  invalid(() => parseAddAssessmentRecord(assessmentInput(0, { components: [{ name: "A", value: "1" }, { name: "\uff21", value: "2" }] })));
  const scales = parseAddAssessmentRecord(assessmentInput(0, { components: [{ name: "Overall", value: "5.5", scale: "1-6" }, { name: "Overall", value: "100", scale: "0-120" }] }));
  assert.deepEqual(scales.components.map(c => [c.value, c.scale]), [["5.5", "1-6"], ["100", "0-120"]]);
});

test("assessment dates are real civil dates and merged single-sitting chronology cannot silently become a combined report", () => {
  for (const testDate of ["2026-02-29", "2026-13-01", "2026-04-31", "2026-2-01", "2026-02-01T00:00:00Z", "2026-02-01 ", "1899-12-31", "2200-01-01", new Date()]) invalid(() => parseAddAssessmentRecord(assessmentInput(0, { testDate })));
  assert.equal(parseAddAssessmentRecord(assessmentInput(0, { testDate: "2024-02-29", components: [{ name: "Score", value: "1", testDate: "2024-02-29" }] })).testDate, "2024-02-29");
  for (const extra of [{ resultStatus: "awaiting_result" }, { testDate: "2026-02-02" }, { reportDate: "2026-01-31" }]) invalid(() => validateAssessmentRecord({ ...data, ...extra }));
  const next = validateAssessmentRecord({ ...data, resultForm: "partial_retake", components: [...data.components, { name: "Writing", value: "8", scale: "0-9", testDate: "2026-02-02" }] });
  assert.equal(next.resultForm, "partial_retake"); invalid(() => validateAssessmentRecord({ ...next, resultForm: "single_sitting" }));
  assert.deepEqual(parseUpdateAssessmentRecord({ expectedRevision: 1, assessmentVariant: null, components: [] }), { expectedRevision: 1, assessmentVariant: null, components: [] });
  assert.equal(validateAssessmentRecord({ ...data, resultStatus: "awaiting_result", reportDate: null, components: [] }).resultStatus, "awaiting_result");
});

test("assessment components and full canonical UTF-8 documents have independent hard bounds", () => {
  invalid(() => parseAddAssessmentRecord(assessmentInput(0, { components: Array.from({ length: 21 }, (_, i) => ({ name: "Score " + i, value: "1" })) })));
  const components = Array.from({ length: 20 }, (_, i) => ({ name: "Name " + i + "\u4e00".repeat(65), value: "\u4e00".repeat(80), scale: "\u4e00".repeat(80) }));
  invalid(() => parseAddAssessmentRecord(assessmentInput(0, { components })));
  invalid(() => parseUpdateAssessmentRecord({ expectedRevision: 1, components }));
});

test("all assessment commands reject wrong purpose surface tenant role strength and data class before storage", async () => {
  const service = new StudentCoreService(new Proxy({}, { get() { assert.fail("Denied context reached storage"); } }));
  for (const extra of [{ actorUserId: null }, { activeRole: "guest" }, { activeRole: "school_staff" }, { activeRole: "cuac_ops" }, { activeRole: "cuac_admin" },
    { selectedSurface: "public" }, { purpose: "agent_chat" }, { purpose: "catalog_management" }, { tenantSchoolId: "school" },
    { authStrength: "guest" }, { authStrength: null }, { authStrength: "unknown" }, { dataClassAllowlist: ["student_pii"] }]) {
    const ctx = { ...context, ...extra };
    await assert.rejects(service.getOwnAssessmentHistory(ctx), e => e.status === 403);
    await assert.rejects(service.addOwnAssessmentRecord(ctx, assessmentInput()), e => e.status === 403);
    await assert.rejects(service.updateOwnAssessmentRecord(ctx, record.id, { expectedRevision: 1, testDate: null }), e => e.status === 403);
    await assert.rejects(service.removeOwnAssessmentRecord(ctx, record.id, { expectedRevision: 1 }), e => e.status === 403);
  }
  await assert.rejects(service.addOwnAssessmentRecord(context, assessmentInput(0, { verified: true })), e => e.status === 400);
  await assert.rejects(service.updateOwnAssessmentRecord(context, "invalid", { expectedRevision: 1, testDate: null }), e => e.status === 400);
});

test("assessment service derives the owner and records only changed metadata without private results", async () => {
  const audit = []; let changed = true;
  const result = () => ({ history, recordId: record.id, changed });
  const service = new StudentCoreService({
    async getAssessmentHistory(owner) { assert.equal(owner, "owner"); return history; },
    async addAssessmentRecord(owner, revision, input) { assert.equal(owner, "owner"); assert.equal(revision, 0); assert.equal(input.components[0].value, "7.50"); return result(); },
    async updateAssessmentRecord(owner, id) { assert.equal(owner, "owner"); assert.equal(id, record.id); return result(); },
    async removeAssessmentRecord(owner, id, revision) { assert.equal(owner, "owner"); assert.equal(id, record.id); assert.equal(revision, 1); return result(); },
  }, { async record(event) { audit.push(event); } });
  assert.deepEqual(await service.getOwnAssessmentHistory(context), history);
  await service.addOwnAssessmentRecord(context, assessmentInput());
  await service.updateOwnAssessmentRecord(context, record.id, { expectedRevision: 1, assessmentVariant: "Private variant" });
  await service.removeOwnAssessmentRecord(context, record.id, { expectedRevision: 1 });
  changed = false; await service.removeOwnAssessmentRecord(context, record.id, { expectedRevision: 1 });
  assert.deepEqual(audit.map(a => a.action), ["student.assessment_record.add", "student.assessment_record.update", "student.assessment_record.remove"]);
  assert.doesNotMatch(JSON.stringify(audit), /Private language|Private variant|7\.50|2026-02/);
});

test("assessment reads use one authorized bounded snapshot and fail closed on corrupt nested data", async () => {
  let rows = [{ revision: 1, records: [{ ...record, evidenceStatus: "verified", secret: "hidden" }] }];
  const repo = new PostgresAssessmentHistory({ async query(sql, params) {
    assert.deepEqual(params, ["owner", 41]); assert.match(sql, /r.user_id = u.id/); assert.match(sql, /r.removed_at is null/);
    assert.match(sql, /account_status = 'active'/); assert.match(sql, /revoked_at is null/); assert.match(sql, /limit \$2/);
    assert.match(sql, /to_char\(r.test_date, 'YYYY-MM-DD'\)/); assert.doesNotMatch(sql, /select \*|agent_|payments|school_applications/); return rows;
  } });
  assert.deepEqual(await repo.get("owner"), history);
  for (const broken of [{ revision: -1, records: [] }, { revision: 0, records: [record] }, { revision: 1, records: Array(41).fill(record) },
    { revision: 1, records: [{ ...record, components: [{ name: "Overall", value: "7.5", secret: "hidden" }] }] },
    { revision: 1, records: [{ ...record, components: [{ name: "Overall", value: 7.5 }] }] }]) {
    rows = [broken]; await assert.rejects(repo.get("owner"), e => e.status === 503);
  }
  rows = [{ revision: 0, records: [] }]; assert.deepEqual(await repo.get("owner"), { revision: 0, records: [] });
  rows = []; await assert.rejects(repo.get("owner"), e => e.status === 403);
});

test("assessment HTTP adapters resolve session authority and strictly dispatch four operations", async () => {
  const auth = { async findActiveSessionByTokenHash() { return { userId: "owner", activeRole: "student", selectedSurface: "student", tenantSchoolId: null, accountStatus: "active", authStrength: "session", expiresAt: new Date(Date.now() + 60000), revokedAt: null }; } };
  const result = { history, recordId: record.id, changed: false };
  const service = new StudentCoreService({ async getAssessmentHistory() { return history; }, async addAssessmentRecord() { return result; }, async updateAssessmentRecord() { return result; }, async removeAssessmentRecord() { return result; } });
  const handlers = createStudentHttpHandlers(service, auth);
  const request = (body, method = "POST") => new Request("https://cuac.test/assessments", { method, headers: { cookie: "cuac_session=token", "content-type": "application/json" }, ...(method === "GET" ? {} : { body: JSON.stringify(body) }) });
  assert.equal((await handlers.getAssessmentHistory(request(null, "GET"))).status, 200);
  assert.equal((await handlers.addAssessmentRecord(request(assessmentInput()))).status, 200);
  assert.equal((await handlers.updateAssessmentRecord(request({ expectedRevision: 1, testDate: null }, "PATCH"), record.id)).status, 200);
  assert.equal((await handlers.removeAssessmentRecord(request({ expectedRevision: 1 }), record.id)).status, 200);
  assert.equal((await handlers.removeAssessmentRecord(request({ expectedRevision: 1, userId: "other" }), record.id)).status, 400);
  assert.equal((await handlers.updateAssessmentRecord(request({ expectedRevision: 1, testDate: null }, "PATCH"), "invalid")).status, 400);
});
