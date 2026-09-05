import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { secureApiRoute } from "../../../src/server/shared/http-boundary.ts";
import { parseMaterialSelectionUpdate } from "../../../src/server/student/material-selection.ts";
import { PostgresMaterialSelection } from "../../../src/server/student/postgres-material-selection.ts";
import { createMaterialSelectionHttpHandler } from "../../../src/server/student/material-selection-http.ts";

const empty = () => ({ applicantFields: [], educationRecordIds: [], assessmentRecordIds: [] });
const input = () => ({ expectedRevision: 0, expectedVersions: { applicationSet: 2, applicant: 0, education: 0, assessments: 0 }, selection: empty() });
const context = extra => createRequestContext({ actorUserId: randomUUID(), activeRole: "student", selectedSurface: "student", purpose: "student_action", ...extra });
function fixture(change = {}, stored = null) {
  const calls = [], scope = { applicationSetId: randomUUID(), choiceId: randomUUID(), schoolId: randomUUID(), programId: randomUUID(), programIntakeId: randomUUID(),
    ...input().expectedVersions, editable: true, ...change };
  const tx = { async query(sql, params) {
    calls.push({ sql, params });
    if (sql.includes('as "choiceId"')) return [scope];
    if (sql.includes("from application_material_selections")) return stored ? [stored] : [];
    if (sql.includes("select id from")) return [{ id: randomUUID() }];
    return [];
  } };
  return { calls, scope, service: new PostgresMaterialSelection({ transaction: work => work(tx) }) };
}

test("selection draft requires explicit canonical selection and both independent and source versions", () => {
  const value = input(); assert.deepEqual(parseMaterialSelectionUpdate(value), value);
  for (const bad of [null, [], {}, { ...value, expectedRevision: undefined }, { ...value, expectedRevision: -1 },
    { ...value, expectedRevision: "0" }, { ...value, expectedRevision: 2147483648 }, { ...value, consent: true },
    { ...value, userId: randomUUID() }, { ...value, rawMaterials: {} }, { ...value, selection: null },
    { ...value, selection: { ...empty(), applicantFields: ["passportNumber"] } },
    { ...value, selection: { ...empty(), educationRecordIds: new Array(2) } },
    { ...value, expectedVersions: { ...value.expectedVersions, applicationSet: 0 } },
    { ...value, expectedVersions: { ...value.expectedVersions, guardianApproved: true } }]) {
    assert.throws(() => parseMaterialSelectionUpdate(bad), e => e.status === 400);
  }
  value.selection.applicantFields = ["contactEmail", "fullName"];
  assert.deepEqual(parseMaterialSelectionUpdate(value).selection.applicantFields, ["fullName", "contactEmail"]);
});

test("selection GET and PUT deny wrong role purpose surface tenant and data class before opening a transaction", async () => {
  let calls = 0; const service = new PostgresMaterialSelection({ async transaction() { calls++; } });
  for (const extra of [{ actorUserId: null }, { activeRole: "school_staff" }, { activeRole: "cuac_ops" }, { activeRole: "cuac_admin" },
    { selectedSurface: "public" }, { selectedSurface: "school" }, { purpose: "agent_tool" }, { purpose: "public_catalog_read" },
    { tenantSchoolId: randomUUID() }, { authStrength: "guest" }, { dataClassAllowlist: ["student_pii"] }, { dataClassAllowlist: ["education_record"] }]) {
    for (const method of ["get", "put"]) await assert.rejects(service[method](context(extra), "bad", "bad", {}), e => e.status === 403);
  }
  await assert.rejects(service.put(context(), randomUUID(), randomUUID(), {}), e => e.status === 400);
  await assert.rejects(service.get(context(), "bad", randomUUID()), e => e.status === 400);
  assert.equal(calls, 0);
});

test("selection GET is a read-only metadata projection and missing selection never selects or persists anything", async () => {
  const f = fixture(), actor = context(), result = await f.service.get(actor, f.scope.applicationSetId, f.scope.choiceId);
  assert.equal(result.revision, 0); assert.equal(result.selection, null); assert.equal(result.savedVersions, null);
  assert.equal(result.mode, "selection_draft"); assert.equal(result.canSubmit, false); assert.equal(result.consentRecorded, false);
  assert.deepEqual(result.changedSources, []); assert.deepEqual(result.unavailable, { educationRecordIds: [], assessmentRecordIds: [] });
  assert.deepEqual(f.calls[1].params, [actor.actorUserId, f.scope.applicationSetId, f.scope.choiceId]);
  assert.equal(f.calls[0].sql, "set transaction isolation level repeatable read, read only");
  assert.doesNotMatch(f.calls.map(c => c.sql).join("\n"), /full_name|contact_email|institution_name|components_json|student_notes|agent_|payments|insert |update |delete /i);
});

test("selection no-op still checks current scope versions and returns canonical choices without audit or writes", async () => {
  const value = input(), stored = { revision: 1, ...value.expectedVersions, selection: { assessmentRecordIds: [], educationRecordIds: [], applicantFields: [] } };
  const f = fixture({}, stored), actor = context(); value.expectedRevision = 1;
  const result = await f.service.put(actor, f.scope.applicationSetId, f.scope.choiceId, value);
  assert.equal(result.revision, 1); assert.deepEqual(result.selection, empty());
  assert.doesNotMatch(f.calls.map(c => c.sql).join("\n"), /insert into|delete from|update application_material/);
  for (const change of [{ editable: false }, { programId: null, programIntakeId: null }, { applicant: 1 }, { applicationSet: 3 }]) {
    const stale = fixture(change, stored);
    await assert.rejects(stale.service.put(actor, stale.scope.applicationSetId, stale.scope.choiceId, value), e => e.status === 409);
  }
  await assert.rejects(f.service.put(actor, f.scope.applicationSetId, f.scope.choiceId, { ...value, expectedRevision: 0 }), e => e.status === 409);
});

test("selection stored corruption fails closed and maximum revision permits only a current no-op", async () => {
  const value = input(), actor = context();
  for (const stored of [{ revision: 0, ...value.expectedVersions, selection: empty() },
    { revision: 1, ...value.expectedVersions, selection: { ...empty(), secret: "PRIVATE" } },
    { revision: 1, ...value.expectedVersions, selection: { ...empty(), educationRecordIds: [randomUUID()] } }]) {
    const f = fixture({}, stored); await assert.rejects(f.service.get(actor, f.scope.applicationSetId, f.scope.choiceId), e => e.status === 503 && !e.message.includes("PRIVATE"));
  }
  const f = fixture({}, { revision: 2147483647, ...value.expectedVersions, selection: empty() }); value.expectedRevision = 2147483647;
  assert.equal((await f.service.put(actor, f.scope.applicationSetId, f.scope.choiceId, value)).revision, 2147483647);
  value.selection.applicantFields = ["fullName"];
  await assert.rejects(f.service.put(actor, f.scope.applicationSetId, f.scope.choiceId, value), e => e.status === 409);
});

test("selection HTTP resolves session identity and keeps both methods private with bounded error envelopes", async () => {
  const userId = randomUUID(), setId = randomUUID(), choiceId = randomUUID(); let captured;
  const auth = { async findActiveSessionByTokenHash() { return { userId, selectedSurface: "student", activeRole: "student", tenantSchoolId: null,
    authStrength: "session", expiresAt: new Date(Date.now() + 86400000), revokedAt: null, accountStatus: "active" }; } };
  const handler = createMaterialSelectionHttpHandler({ async get(...args) { captured = args; return { revision: 0 }; },
    async put(...args) { captured = args; return { revision: 1 }; } }, auth);
  for (const method of ["GET", "PUT"]) {
    const request = (query = "", headers = {}) => new Request(`https://cuac.test/selection${query}`, { method,
      ...(method === "PUT" ? { body: JSON.stringify(input()) } : {}), headers: { cookie: "cuac_session=synthetic", origin: "https://cuac.test",
        "content-type": "application/json", "x-user-id": randomUUID(), "x-role": "cuac_admin", ...headers } });
    const route = secureApiRoute(method, req => handler(req, setId, choiceId, method.toLowerCase()), { env: { CUAC_ENV: "development", CUAC_PUBLIC_APP_URL: "https://cuac.test" } });
    const response = await route(request()); assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("set-cookie"), null); assert.equal(captured[0].actorUserId, userId); assert.equal(captured[0].purpose, "student_action");
    assert.equal((await route(request("?userId=x"))).status, 400);
    assert.equal((await route(request("", { "sec-fetch-site": "same-site" }))).status, 403);
    assert.equal((await createMaterialSelectionHttpHandler()(request(), setId, choiceId, method.toLowerCase())).status, 503);
  }
  const broken = createMaterialSelectionHttpHandler({ async get() { throw new Error("PRIVATE_DATABASE_SECRET"); }, async put() {} }, auth);
  const response = await broken(new Request("https://cuac.test/"), setId, choiceId, "get");
  assert.equal(response.status, 500); assert.doesNotMatch(await response.text(), /PRIVATE_DATABASE_SECRET/);
});
