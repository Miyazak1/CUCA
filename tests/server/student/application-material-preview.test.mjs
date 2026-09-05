import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { secureApiRoute } from "../../../src/server/shared/http-boundary.ts";
import { buildMaterialPreview, parseMaterialPreview, requireMaterialPreviewQuery } from "../../../src/server/student/application-material-preview.ts";
import { PostgresApplicationMaterialPreview } from "../../../src/server/student/postgres-application-material-preview.ts";
import { createApplicationMaterialPreviewHandler } from "../../../src/server/student/application-material-preview-http.ts";
import { assessmentInput } from "./assessment-fixture.mjs";

const context = extra => createRequestContext({ actorUserId: randomUUID(), activeRole: "student", selectedSurface: "student", purpose: "student_action", ...extra });
function fixture() {
  const education = { id: randomUUID(), institutionName: "Chosen school", institutionCountry: "CN", educationLevel: "bachelor",
    qualificationName: null, fieldOfStudy: null, attendanceStatus: "completed", startYear: 2020, endYear: 2024, expectedCompletionYear: null };
  const { expectedRevision, ...assessment } = assessmentInput(); assert.equal(expectedRevision, 0);
  assessment.id = randomUUID(); assessment.evidenceStatus = "unverified";
  const target = { applicationSetId: randomUUID(), choiceId: randomUUID(), schoolId: randomUUID(), programId: randomUUID(), programIntakeId: randomUUID() };
  const input = { expectedVersions: { applicationSet: 2, applicant: 1, education: 1, assessments: 1 },
    selection: { applicantFields: ["fullName"], educationRecordIds: [education.id], assessmentRecordIds: [assessment.id] } };
  return { owner: randomUUID(), target, input, clock: new Date("2026-09-01T00:00:00Z"),
    sources: { applicant: { fullName: "Selected name", contactEmail: "UNSELECTED_EMAIL", privateNote: "PRIVATE_NOTE" }, education: [education], assessments: [assessment] } };
}
const build = f => buildMaterialPreview(f.owner, f.target, f.clock, parseMaterialPreview(f.input), f.sources);
function fakeReader(f, change = {}) {
  const calls = [], scope = { ...f.target, ...f.input.expectedVersions, checkedAt: f.clock, editable: true, fullName: "Selected name", contactEmail: null, citizenshipCountry: null, ...change };
  const tx = { async query(sql, params) {
    calls.push({ sql, params });
    if (sql.startsWith("set transaction")) return [];
    if (sql.includes('as "choiceId"')) return [scope];
    return [{ records: sql.includes("student_education_records") ? f.sources.education : f.sources.assessments }];
  } };
  return { calls, scope, reader: new PostgresApplicationMaterialPreview({ async transaction(work) { return work(tx); } }) };
}

test("material selection is explicit bounded canonical and rejects client authority or raw data", () => {
  const f = fixture(), normalized = parseMaterialPreview(f.input);
  assert.deepEqual(normalized, f.input);
  const uppercase = structuredClone(f.input); uppercase.selection.educationRecordIds[0] = uppercase.selection.educationRecordIds[0].toUpperCase();
  assert.deepEqual(parseMaterialPreview(uppercase), normalized);
  for (const input of [null, [], {}, { ...f.input, consent: true }, { ...f.input, content: f.sources },
    { ...f.input, expectedVersions: { ...f.input.expectedVersions, userId: f.owner } },
    { ...f.input, expectedVersions: { ...f.input.expectedVersions, applicationSet: 0 } },
    { ...f.input, expectedVersions: { ...f.input.expectedVersions, applicant: "1" } },
    { ...f.input, selection: { ...f.input.selection, applicantFields: ["fullName", "fullName"] } },
    { ...f.input, selection: { ...f.input.selection, applicantFields: ["passportNumber"] } },
    { ...f.input, selection: { ...f.input.selection, assessmentRecordIds: [f.sources.assessments[0].id, f.sources.assessments[0].id.toUpperCase()] } },
    { ...f.input, selection: { ...f.input.selection, educationRecordIds: Array.from({ length: 21 }, randomUUID) } },
    { ...f.input, selection: { ...f.input.selection, assessmentRecordIds: new Array(1) } },
    { ...f.input, selection: { applicantFields: [] } }]) assert.throws(() => parseMaterialPreview(input), e => e.status === 400);
  requireMaterialPreviewQuery("https://cuac.test/");
  for (const query of ["userId=x", "schoolId=x", "locale=en", "confirmed=true"]) assert.throws(() => requireMaterialPreviewQuery(`https://cuac.test/?${query}`), e => e.status === 400);
});

test("material preview exposes only selected values and never becomes consent a snapshot or a school receipt", () => {
  const f = fixture(), result = build(f);
  assert.deepEqual(result.content.materials.applicant, { fullName: "Selected name" });
  assert.equal(result.content.materials.assessments[0].components[0].value, "7.50");
  assert.equal(result.content.materials.assessments[0].evidenceStatus, "unverified");
  assert.equal(result.mode, "self_review"); assert.equal(result.canSubmit, false); assert.equal(result.persisted, false); assert.equal(result.consentRecorded, false);
  assert.doesNotMatch(JSON.stringify(result), /UNSELECTED_EMAIL|PRIVATE_NOTE|userId|expectedRevision|schoolVisibleProfile|paid/);
  result.content.materials.assessments[0].components[0].value = "CHANGED";
  assert.equal(f.sources.assessments[0].components[0].value, "7.50", "projection does not retain a mutable component alias");
});

test("material digest is stable across time and selection ordering but binds owner target versions and content", () => {
  const f = fixture(); f.input.selection.applicantFields = ["contactEmail", "fullName"]; f.sources.applicant.contactEmail = "chosen@example.invalid";
  const first = build(f); f.clock = new Date("2026-09-02T00:00:00Z"); f.input.selection.applicantFields.reverse();
  assert.equal(build(f).contentSha256, first.contentSha256);
  for (const mutate of [x => { x.owner = randomUUID(); }, x => { x.target.choiceId = randomUUID(); }, x => { x.target.programId = randomUUID(); },
    x => { x.target.programIntakeId = randomUUID(); }, x => { x.input.expectedVersions.education++; },
    x => { x.sources.applicant.fullName = "Changed name"; }, x => { x.input.selection.applicantFields = ["fullName"]; }]) {
    const next = structuredClone(f); mutate(next); assert.notEqual(build(next).contentSha256, first.contentSha256);
  }
});

test("empty selection never defaults to all records and missing applicant values remain explicit nulls", () => {
  const f = fixture(); f.input.expectedVersions = { applicationSet: 2, applicant: 0, education: 0, assessments: 0 };
  f.input.selection = { applicantFields: [], educationRecordIds: [], assessmentRecordIds: [] };
  f.sources = { applicant: {}, education: [], assessments: [] };
  assert.deepEqual(build(f).content.materials, { applicant: {}, education: [], assessments: [] });
  f.input.selection.applicantFields = ["fullName"]; f.sources.applicant.fullName = null;
  assert.deepEqual(build(f).content.materials.applicant, { fullName: null });
});

test("corrupt material values scope and inventories fail closed without returning partial private data", () => {
  for (const mutate of [f => { f.sources.applicant.fullName = "PRIVATE\nCORRUPTION"; }, f => { f.sources.education[0].institutionName = " padded "; },
    f => { f.sources.education[0].attendanceStatus = "in_progress"; }, f => { f.sources.assessments[0].components = [{ name: "Overall", value: "PRIVATE".repeat(100) }]; },
    f => { f.sources.education.push(f.sources.education[0]); }, f => { f.sources.education[0].id = randomUUID(); },
    f => { f.input.expectedVersions.assessments = 0; }, f => { f.clock = new Date("invalid"); }, f => { f.target.programId = null; }]) {
    const f = fixture(); mutate(f); assert.throws(() => build(f), e => e.status === 503 && !/PRIVATE/.test(e.message));
  }
});

test("material preview denies nonstudent persona purpose tenant auth and classifications before SQL", async () => {
  let calls = 0; const reader = new PostgresApplicationMaterialPreview({ async transaction() { calls++; } });
  for (const extra of [{ actorUserId: null }, { activeRole: "school_staff" }, { activeRole: "cuac_ops" }, { activeRole: "cuac_admin" },
    { selectedSurface: "public" }, { selectedSurface: "school" }, { purpose: "agent_tool" }, { purpose: "public_catalog_read" },
    { tenantSchoolId: randomUUID() }, { authStrength: "guest" }, { authStrength: "invented" }, { dataClassAllowlist: ["student_pii"] }, { dataClassAllowlist: ["education_record"] }]) {
    await assert.rejects(reader.preview(context(extra), "bad", "bad", {}), e => e.status === 403);
  }
  await assert.rejects(reader.preview(context(), "bad", randomUUID(), {}), e => e.status === 400); assert.equal(calls, 0);
});

test("material SQL is read-only owner-scoped and projects selected fields and IDs only", async () => {
  const f = fixture(), mock = fakeReader(f), actor = context({ actorUserId: f.owner });
  const result = await mock.reader.preview(actor, f.target.applicationSetId, f.target.choiceId, f.input);
  assert.equal(result.contentSha256, build(f).contentSha256);
  assert.equal(mock.calls[0].sql, "set transaction isolation level repeatable read, read only");
  assert.deepEqual(mock.calls[1].params, [f.owner, f.target.applicationSetId, f.target.choiceId, ["fullName"]]);
  for (const call of mock.calls.slice(2)) { assert.equal(call.params[0], f.owner); assert.match(call.sql, /r\.user_id = \$1 and r\.id = any\(\$2::uuid\[\]\)/); }
  assert.doesNotMatch(mock.calls.map(c => c.sql).join("\n"), /student_notes|consent_summary|school_visible_profile|payments|agent_|insert |update |delete /i);
  f.input.selection = { applicantFields: [], educationRecordIds: [], assessmentRecordIds: [] }; const empty = fakeReader(f);
  await empty.reader.preview(actor, f.target.applicationSetId, f.target.choiceId, f.input); assert.equal(empty.calls.length, 2);
});

test("material previews reject each stale source frozen or unbound target and invalid stored versions", async () => {
  const f = fixture();
  for (const change of [{ applicationSet: 3 }, { applicant: 2 }, { education: 2 }, { assessments: 2 }, { editable: false }, { programId: null }, { programIntakeId: null }]) {
    const mock = fakeReader(f, change); await assert.rejects(mock.reader.preview(context(), f.target.applicationSetId, f.target.choiceId, f.input), e => e.status === 409);
    assert.equal(mock.calls.length, 2);
  }
  for (const change of [{ applicant: -1 }, { education: 2147483648 }, { assessments: "1" }, { editable: null }]) {
    const mock = fakeReader(f, change); await assert.rejects(mock.reader.preview(context(), f.target.applicationSetId, f.target.choiceId, f.input), e => e.status === 503);
  }
});

test("material HTTP resolves session authority and rejects query fetch metadata and corrupt input with private headers", async () => {
  const f = fixture(); let captured, authCalls = 0;
  const auth = { async findActiveSessionByTokenHash() { authCalls++; return { userId: f.owner, selectedSurface: "student", activeRole: "student", tenantSchoolId: null,
    authStrength: "session", expiresAt: new Date(Date.now() + 86400000), revokedAt: null, accountStatus: "active" }; } };
  const handler = createApplicationMaterialPreviewHandler({ async preview(...args) { captured = args; return build(f); } }, auth);
  const route = secureApiRoute("POST", request => handler(request, f.target.applicationSetId, f.target.choiceId), { env: { CUAC_ENV: "development", CUAC_PUBLIC_APP_URL: "https://cuac.test" } });
  const request = (query = "", body = JSON.stringify(f.input), headers = {}) => new Request(`https://cuac.test/${query}`, { method: "POST", body,
    headers: { cookie: "cuac_session=synthetic", origin: "https://cuac.test", "content-type": "application/json", "x-user-id": randomUUID(), "x-role": "cuac_admin", ...headers } });
  const response = await route(request()); assert.equal(response.status, 200); assert.equal(captured[0].actorUserId, f.owner); assert.equal(captured[0].purpose, "student_action");
  assert.equal(response.headers.get("cache-control"), "no-store"); assert.equal(response.headers.get("set-cookie"), null);
  assert.equal((await route(request("?userId=x"))).status, 400);
  for (const site of ["cross-site", "same-site", "invented"]) assert.equal((await route(request("", JSON.stringify(f.input), { "sec-fetch-site": site }))).status, 403);
  assert.equal((await route(request("", "[]"))).status, 400); assert.equal(authCalls, 1);
  const broken = createApplicationMaterialPreviewHandler({ async preview() { throw new Error("PRIVATE_STORAGE_VALUE"); } }, auth);
  const failed = await broken(request(), f.target.applicationSetId, f.target.choiceId); assert.equal(failed.status, 500); assert.doesNotMatch(await failed.text(), /PRIVATE_STORAGE/);
  assert.equal((await createApplicationMaterialPreviewHandler()(request(), f.target.applicationSetId, f.target.choiceId)).status, 503);
});
