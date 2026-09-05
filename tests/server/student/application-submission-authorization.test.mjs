import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { secureApiRoute } from "../../../src/server/shared/http-boundary.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import {
  APPLICATION_AUTHORIZATION_CONFIRMATION,
  applicationAuthorizationDigests,
  parseApplicationAuthorizationInput,
  parseApplicationAuthorizationWithdrawal,
  requireApplicationAuthorizationQuery,
} from "../../../src/server/student/application-submission-authorization.ts";
import { createApplicationSubmissionAuthorizationHttpHandler } from "../../../src/server/student/application-submission-authorization-http.ts";
import { PostgresApplicationSubmissionAuthorization } from "../../../src/server/student/postgres-application-submission-authorization.ts";

const sha = character => character.repeat(64);
const input = () => ({
  locale: "en",
  expectedMaterialSelectionRevision: 2,
  expectedVersions: { applicationSet: 3, applicant: 1, education: 1, assessments: 1 },
  expectedNotice: { versionId: randomUUID(), publicationRevision: 4, contentSha256: sha("a") },
  expectedPolicy: { admissionRouteKey: "direct_university", versionId: randomUUID(), publicationRevision: 2,
    documentSha256: sha("c") },
  materialContentSha256: sha("b"),
  confirmation: APPLICATION_AUTHORIZATION_CONFIRMATION,
});
const context = extra => createRequestContext({ actorUserId: randomUUID(), activeRole: "student", selectedSurface: "student",
  purpose: "student_action", ...extra });

test("submission authorization input is explicit, bounded and contains no client authority", () => {
  const value = input();
  assert.deepEqual(parseApplicationAuthorizationInput(value), value);
  assert.deepEqual(parseApplicationAuthorizationWithdrawal({ authorizationId: value.expectedNotice.versionId.toUpperCase() }),
    { authorizationId: value.expectedNotice.versionId });
  for (const bad of [null, [], {}, { ...value, consent: true }, { ...value, userId: randomUUID() },
    { ...value, confirmation: true }, { ...value, confirmation: "yes" },
    { ...value, expectedMaterialSelectionRevision: 0 }, { ...value, expectedMaterialSelectionRevision: "2" },
    { ...value, expectedVersions: { ...value.expectedVersions, applicationSet: 0 } },
    { ...value, expectedVersions: { ...value.expectedVersions, userId: randomUUID() } },
    { ...value, expectedNotice: { ...value.expectedNotice, publicationRevision: 0 } },
    { ...value, expectedNotice: { ...value.expectedNotice, contentSha256: "A".repeat(64) } },
    { ...value, expectedPolicy: { ...value.expectedPolicy, admissionRouteKey: "Direct University" } },
    { ...value, expectedPolicy: { ...value.expectedPolicy, publicationRevision: 0 } },
    { ...value, expectedPolicy: { ...value.expectedPolicy, documentSha256: "C".repeat(64) } },
    { ...value, materialContentSha256: "private material" }, { ...value, locale: "fr" }]) {
    assert.throws(() => parseApplicationAuthorizationInput(bad), error => error.status === 400);
  }
  for (const bad of [null, {}, { authorizationId: "bad" }, { authorizationId: randomUUID(), reason: "skip" }]) {
    assert.throws(() => parseApplicationAuthorizationWithdrawal(bad), error => error.status === 400);
  }
  requireApplicationAuthorizationQuery("https://cuac.test/authorization");
  for (const query of ["userId=x", "schoolId=x", "consent=true"]) {
    assert.throws(() => requireApplicationAuthorizationQuery(`https://cuac.test/authorization?${query}`), error => error.status === 400);
  }
});

test("authorization scope digest is canonical and binds one exact program application", () => {
  const ids = Array.from({ length: 8 }, randomUUID);
  const binding = {
    userId: ids[0], applicationSetId: ids[1], applicationChoiceId: ids[2], schoolId: ids[3], programId: ids[4],
    programIntakeId: ids[5], materialSelectionRevision: 2,
    sourceVersions: { applicationSet: 3, applicant: 1, education: 1, assessments: 1 },
    selection: { applicantFields: ["contactEmail", "fullName"], educationRecordIds: [ids[7], ids[6]], assessmentRecordIds: [] },
    materialContentSha256: sha("b"),
    notice: { scopeKey: "application_disclosure:en", locale: "en", versionId: ids[7], publicationRevision: 4, contentSha256: sha("a") },
    policy: { admissionRouteKey: "direct_university", versionId: randomUUID(), publicationRevision: 2,
      documentSha256: sha("c"), targetSetSha256: sha("d"), approvalSha256: sha("e") },
  };
  const first = applicationAuthorizationDigests(binding);
  const reordered = structuredClone(binding);
  reordered.userId = reordered.userId.toUpperCase();
  reordered.selection.applicantFields.reverse();
  reordered.selection.educationRecordIds.reverse();
  reordered.sourceVersions = { assessments: 1, education: 1, applicant: 1, applicationSet: 3 };
  assert.deepEqual(applicationAuthorizationDigests(reordered), first);
  assert.deepEqual(first.selection.applicantFields, ["fullName", "contactEmail"]);
  assert.match(first.selectionSha256, /^[a-f0-9]{64}$/);
  assert.match(first.scopeSha256, /^[a-f0-9]{64}$/);
  for (const change of [x => { x.applicationChoiceId = randomUUID(); }, x => { x.programId = randomUUID(); },
    x => { x.programIntakeId = randomUUID(); }, x => { x.sourceVersions.education++; },
    x => { x.materialContentSha256 = sha("f"); }, x => { x.notice.publicationRevision++; },
    x => { x.policy.admissionRouteKey = "csc"; }, x => { x.policy.versionId = randomUUID(); },
    x => { x.policy.publicationRevision++; }, x => { x.policy.documentSha256 = sha("f"); },
    x => { x.policy.targetSetSha256 = sha("f"); }, x => { x.policy.approvalSha256 = sha("f"); }]) {
    const next = structuredClone(binding); change(next);
    assert.notEqual(applicationAuthorizationDigests(next).scopeSha256, first.scopeSha256);
  }
  const sameSchoolOtherProgram = structuredClone(binding);
  sameSchoolOtherProgram.applicationChoiceId = randomUUID();
  sameSchoolOtherProgram.programId = randomUUID();
  sameSchoolOtherProgram.programIntakeId = randomUUID();
  assert.equal(sameSchoolOtherProgram.schoolId, binding.schoolId);
  assert.notEqual(applicationAuthorizationDigests(sameSchoolOtherProgram).scopeSha256, first.scopeSha256);
  for (const change of [x => { x.selection.applicantFields.push("fullName"); }, x => { x.notice.scopeKey = "profile:en"; },
    x => { x.applicationChoiceId = "bad"; }, x => { x.policy.admissionRouteKey = "Direct University"; }]) {
    const bad = structuredClone(binding); change(bad);
    assert.throws(() => applicationAuthorizationDigests(bad), error => error.status === 503);
  }
});

test("authorization service denies nonstudent contexts before opening PostgreSQL", async () => {
  let transactions = 0;
  const service = new PostgresApplicationSubmissionAuthorization({ async transaction() { transactions++; } });
  const setId = randomUUID(), choiceId = randomUUID(), value = input();
  for (const extra of [{ actorUserId: null }, { activeRole: "school_staff" }, { activeRole: "cuac_ops" },
    { selectedSurface: "public" }, { selectedSurface: "school" }, { purpose: "agent_tool" },
    { tenantSchoolId: randomUUID() }, { authStrength: "guest" }, { dataClassAllowlist: ["student_pii"] },
    { dataClassAllowlist: ["education_record"] }]) {
    await assert.rejects(service.record(context(extra), setId, choiceId, value, "authorization-key-0001"), error => error.status === 403);
    await assert.rejects(service.get(context(extra), setId, choiceId), error => error.status === 403);
  }
  await assert.rejects(service.record(context(), "bad", choiceId, value, "authorization-key-0001"), error => error.status === 400);
  await assert.rejects(service.record(context(), setId, choiceId, value, "short"), error => error.status === 400);
  assert.equal(transactions, 0);
});

test("authorization HTTP derives student identity and keeps GET POST DELETE private", async () => {
  const userId = randomUUID(), setId = randomUUID(), choiceId = randomUUID(), authorizationId = randomUUID();
  const calls = [];
  const auth = { async findActiveSessionByTokenHash() { return { userId, selectedSurface: "student", activeRole: "student",
    tenantSchoolId: null, authStrength: "session", expiresAt: new Date(Date.now() + 60_000), revokedAt: null, accountStatus: "active" }; } };
  const service = {
    async get(...args) { calls.push(["get", ...args]); return null; },
    async record(...args) { calls.push(["record", ...args]); return { id: authorizationId, canSubmit: false }; },
    async withdraw(...args) { calls.push(["withdraw", ...args]); return { id: authorizationId, status: "withdrawn" }; },
  };
  const handler = createApplicationSubmissionAuthorizationHttpHandler(service, auth);
  const cases = [
    ["GET", "get", undefined],
    ["POST", "record", input()],
    ["DELETE", "withdraw", { authorizationId }],
  ];
  for (const [method, operation, body] of cases) {
    const request = (query = "", headers = {}) => new Request(`https://cuac.test/authorization${query}`, { method,
      ...(body ? { body: JSON.stringify(body) } : {}), headers: { cookie: "cuac_session=synthetic", origin: "https://cuac.test",
        ...(body ? { "content-type": "application/json" } : {}), ...(method === "POST" ? { "idempotency-key": "authorization-key-0001" } : {}),
        "x-user-id": randomUUID(), "x-role": "cuac_admin", ...headers } });
    const route = secureApiRoute(method, req => handler(req, setId, choiceId, operation),
      { env: { CUAC_ENV: "development", CUAC_PUBLIC_APP_URL: "https://cuac.test" } });
    const response = await route(request());
    assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
    const call = calls.at(-1); assert.equal(call[0], operation); assert.equal(call[1].actorUserId, userId);
    assert.equal(call[1].purpose, "student_action"); assert.equal(call[2], setId); assert.equal(call[3], choiceId);
    if (operation === "record") assert.equal(call[5], "authorization-key-0001");
    assert.equal((await route(request("?userId=x"))).status, 400);
    assert.equal((await route(request("", { "sec-fetch-site": "same-site" }))).status, 403);
  }
  const unavailable = createApplicationSubmissionAuthorizationHttpHandler();
  const response = await unavailable(new Request("https://cuac.test/authorization", { headers: { cookie: "cuac_session=x" } }), setId, choiceId, "get");
  assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /postgres|database|PRIVATE/i);
});
