import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { buildApplicationPreflight, parsePreflightQuery } from "../../../src/server/student/application-preflight.ts";
import { PostgresApplicationPreflight } from "../../../src/server/student/postgres-application-preflight.ts";
import { createApplicationPreflightHandler } from "../../../src/server/student/application-preflight-http.ts";
import { getPublishedProgramRequirements } from "../../../src/server/catalog/postgres-requirements.ts";
import { PostgresNoticeReader } from "../../../src/server/notices/public-reader.ts";
import { requirementDocument } from "../catalog/requirements-fixture.mjs";

const context = extra => createRequestContext({ actorUserId: randomUUID(), activeRole: "student", selectedSurface: "student", purpose: "student_action", ...extra });
function fixture() {
  return { target: { applicationSetId: randomUUID(), choiceId: randomUUID(), schoolId: randomUUID(), programId: randomUUID(), programIntakeId: randomUUID(),
    admissionRouteKey: null,
    revision: 2, checkedAt: new Date("2026-09-01T00:00:00Z"), setEditable: true, choiceEditable: true,
    schoolAvailable: true, programAvailable: true, intakeAvailable: true, opensAt: new Date("2026-01-01T00:00:00Z"), deadlineAt: new Date("2027-01-01T00:00:00Z"),
    scholarshipAvailable: true, schoolApplicationExists: false, otherApplicationExists: false },
  inventory: { applicantRevision: 0, fullNamePresent: false, contactEmailPresent: false, citizenshipCountryPresent: false,
    educationRevision: 0, educationCount: 0, assessmentRevision: 0, assessmentCount: 0 } };
}
const report = f => buildApplicationPreflight(f.target, f.inventory, "en", null, null);
const policyFor = f => ({
  schoolId: f.target.schoolId, programId: f.target.programId, programIntakeId: f.target.programIntakeId,
  admissionRouteKey: "direct_university", publicationRevision: 3, versionId: randomUUID(), version: 2,
  documentSha256: "c".repeat(64), targetSetSha256: "d".repeat(64), approvalSha256: "e".repeat(64),
  reviewedAt: "2026-08-01T00:00:00.000Z", effectiveFrom: "2026-08-02T00:00:00.000Z",
  reviewDueAt: "2027-08-01T00:00:00.000Z",
  rule: { formMode: "one_program_per_form", maxProgramChoices: 1, orderingMode: "none", externalChannelType: "university_portal" },
});
const authorizationFor = (f, policy) => ({
  id: randomUUID(), status: "active", confirmedAt: new Date("2026-08-31T12:00:00Z"),
  schoolId: f.target.schoolId, programId: f.target.programId, programIntakeId: f.target.programIntakeId, evidenceCurrent: true,
  authorizationFormat: "cuac.application-submission-authorization.v2", admissionRouteKey: policy.admissionRouteKey,
  policyVersionId: policy.versionId, policyPublicationRevision: policy.publicationRevision,
  policyDocumentSha256: policy.documentSha256, policyTargetSetSha256: policy.targetSetSha256,
  policyApprovalSha256: policy.approvalSha256,
});
const entitlementFor = f => ({
  id: randomUUID(), userId: randomUUID(), applicationSetId: f.target.applicationSetId,
  applicationChoiceId: f.target.choiceId, schoolId: f.target.schoolId, programId: f.target.programId,
  programIntakeId: f.target.programIntakeId, admissionRouteKey: "direct_university", status: "active",
  grantedAt: new Date("2026-08-31T12:00:02Z"), expiresAt: null, evidenceCurrent: true,
});

test("preflight requires one exact locale and rejects every client authority or clock override", () => {
  assert.equal(parsePreflightQuery("https://cuac.test/?locale=en"), "en");
  assert.equal(parsePreflightQuery("https://cuac.test/?locale=zh-CN"), "zh-CN");
  for (const query of ["", "locale=EN", "locale=zh", "locale=en&locale=en", "locale=en&userId=x", "locale=en&paid=true", "locale=en&canSubmit=true", "locale=en&checkedAt=2099", "locale=en&revision=1"]) {
    assert.throws(() => parsePreflightQuery(`https://cuac.test/?${query}`), e => e.status === 400);
  }
});

test("preflight preserves one program target and never treats empty preparation metadata as authority", () => {
  const f = fixture(), result = report(f);
  assert.equal(result.choiceId, f.target.choiceId); assert.equal(result.target.programIntakeId, f.target.programIntakeId);
  assert.equal(result.canSubmit, false); assert.equal(result.assessmentMode, "preparation_only");
  assert.equal(result.platformBlockers.length, 5); assert.equal(result.target.window.status, "open");
  assert.ok(result.platformBlockers.includes("SUBMISSION_AUTHORIZATION_UNAVAILABLE"));
  assert.ok(result.issues.includes("ADMISSION_ROUTE_REQUIRED"));
  assert.equal(result.target.admissionRouteKey, null); assert.equal(result.officialSubmissionPolicy, null);
  assert.equal(result.submissionAuthorization, null);
  assert.deepEqual(result.preparation.applicant.missingFields, ["fullName", "contactEmail", "citizenshipCountry"]);
  assert.deepEqual(result.preparation.education, { revision: 0, recordCount: 0 });
  result.platformBlockers.length = 0; assert.equal(report(f).platformBlockers.length, 5);
  assert.ok(!result.issues.some(code => code.includes("SCORE") || code.includes("EDUCATION")));
});

test("preflight time windows include opening and exclude deadline without treating unknown dates as open", () => {
  for (const [opensAt, deadlineAt, state] of [[null, null, "unconfirmed"], [null, "2027-01-01", "unconfirmed"],
    ["2027-01-01", "2028-01-01", "not_open"], ["2026-09-01", "2027-01-01", "open"],
    ["2025-01-01", "2026-09-01", "closed"], ["2027-01-01", "2027-01-01", "invalid"]]) {
    const f = fixture(); f.target.opensAt = opensAt && new Date(opensAt); f.target.deadlineAt = deadlineAt && new Date(deadlineAt);
    assert.equal(report(f).target.window.status, state);
  }
  const f = fixture(); f.target.intakeAvailable = false;
  assert.deepEqual(report(f).target.window, { status: "unavailable", opensAt: null, deadlineAt: null });
});

test("preflight reports unresolved frozen unavailable and existing targets without merging school states", () => {
  const f = fixture(); Object.assign(f.target, { programId: null, programIntakeId: null, setEditable: false, choiceEditable: false,
    schoolAvailable: false, programAvailable: false, intakeAvailable: false, scholarshipAvailable: false, schoolApplicationExists: true, otherApplicationExists: true });
  const codes = report(f).issues;
  for (const code of ["APPLICATION_SET_NOT_EDITABLE", "CHOICE_NOT_EDITABLE", "SCHOOL_UNAVAILABLE", "PROGRAM_REQUIRED", "INTAKE_REQUIRED",
    "SCHOLARSHIP_UNAVAILABLE", "SCHOOL_APPLICATION_EXISTS", "EXISTING_APPLICATION_REVIEW_REQUIRED"]) assert.ok(codes.includes(code));
});

test("complete reviewed requirements and notice are references not eligibility consent or submission", () => {
  const f = fixture(), document = requirementDocument(); document.coverage = "complete";
  const requirements = { programId: f.target.programId, programIntakeId: f.target.programIntakeId, versionId: randomUUID(), version: 1,
    publicationRevision: 2, contentSha256: "a".repeat(64), document };
  const notice = { noticeKey: "application_disclosure", locale: "en", versionId: randomUUID(), version: 2, publicationRevision: 3,
    contentSha256: "b".repeat(64), document: { title: "PRIVATE_SENTINEL" }, preparedByUserId: "PRIVATE_ACTOR" };
  const result = buildApplicationPreflight(f.target, f.inventory, "en", requirements, notice);
  assert.equal(result.requirements.coverage, "complete"); assert.equal(result.requirements.items[0].result, "unassessed");
  assert.equal(result.requirements.items[0].level, "conditional"); assert.equal(result.canSubmit, false);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_SENTINEL|PRIVATE_ACTOR|ruleText|appliesTo|sources|preparedByUserId/);
  assert.throws(() => buildApplicationPreflight(f.target, f.inventory, "zh-CN", requirements, notice), e => e.status === 503);
  assert.throws(() => buildApplicationPreflight(f.target, f.inventory, "en", { ...requirements, programId: randomUUID() }, notice), e => e.status === 503);
});

test("current project authorization requires the exact stored route and policy binding", () => {
  const f = fixture(); f.target.admissionRouteKey = "direct_university";
  const policy = policyFor(f), authorization = authorizationFor(f, policy);
  const current = buildApplicationPreflight(f.target, f.inventory, "en", null, null, authorization, null, policy);
  assert.equal(current.submissionAuthorization.current, true); assert.equal(current.submissionAuthorization.id, authorization.id);
  assert.equal(current.submissionAuthorization.format, "cuac.application-submission-authorization.v2");
  assert.equal(current.platformBlockers.length, 3); assert.ok(!current.platformBlockers.includes("SUBMISSION_AUTHORIZATION_UNAVAILABLE"));
  assert.equal(current.canSubmit, false);
  for (const change of [{ status: "withdrawn", evidenceCurrent: false }, { status: "active", evidenceCurrent: false },
    { admissionRouteKey: "csc" }, { policyPublicationRevision: policy.publicationRevision + 1 }]) {
    const stale = buildApplicationPreflight(f.target, f.inventory, "en", null, null,
      { ...authorization, ...change }, null, policy);
    assert.equal(stale.submissionAuthorization.current, false);
    assert.ok(stale.platformBlockers.includes("SUBMISSION_AUTHORIZATION_UNAVAILABLE"));
  }
  const legacy = { ...authorization, authorizationFormat: "cuac.application-submission-authorization.v1",
    admissionRouteKey: null, policyVersionId: null, policyPublicationRevision: null, policyDocumentSha256: null,
    policyTargetSetSha256: null, policyApprovalSha256: null };
  assert.equal(buildApplicationPreflight(f.target, f.inventory, "en", null, null, legacy, null, policy).
    submissionAuthorization.current, false);
  const closed = structuredClone(f); closed.target.deadlineAt = closed.target.checkedAt;
  assert.equal(buildApplicationPreflight(closed.target, closed.inventory, "en", null, null, authorization, null, policy).
    submissionAuthorization.current, false);
  assert.throws(() => buildApplicationPreflight(f.target, f.inventory, "en", null, null,
    { ...authorization, programId: randomUUID() }, null, policy), error => error.status === 503);
});

test("current encrypted material snapshot removes only its blocker and remains bound to the same authorization", () => {
  const f = fixture(); f.target.admissionRouteKey = "direct_university";
  const policy = policyFor(f), authorization = authorizationFor(f, policy);
  const snapshot = { id: randomUUID(), authorizationId: authorization.id, capturedAt: new Date("2026-08-31T12:00:01Z"),
    schoolId: f.target.schoolId, programId: f.target.programId, programIntakeId: f.target.programIntakeId, evidenceCurrent: true };
  const current = buildApplicationPreflight(f.target, f.inventory, "en", null, null, authorization, snapshot, policy);
  assert.equal(current.materialSnapshot.current, true); assert.equal(current.materialSnapshot.authorizationId, authorization.id);
  assert.equal(current.platformBlockers.length, 2);
  assert.ok(!current.platformBlockers.includes("SUBMISSION_AUTHORIZATION_UNAVAILABLE"));
  assert.ok(!current.platformBlockers.includes("MATERIAL_SNAPSHOT_UNAVAILABLE"));
  assert.deepEqual(current.platformBlockers, ["BILLING_ENTITLEMENT_UNAVAILABLE", "SUBMISSION_UNAVAILABLE"]);
  assert.equal(current.canSubmit, false);
  for (const changed of [{ evidenceCurrent: false }, { authorizationId: randomUUID() }]) {
    const stale = buildApplicationPreflight(f.target, f.inventory, "en", null, null, authorization,
      { ...snapshot, ...changed }, policy);
    assert.equal(stale.materialSnapshot.current, false); assert.ok(stale.platformBlockers.includes("MATERIAL_SNAPSHOT_UNAVAILABLE"));
  }
  assert.throws(() => buildApplicationPreflight(f.target, f.inventory, "en", null, null, authorization,
    { ...snapshot, programIntakeId: randomUUID() }, policy), error => error.status === 503);
});

test("exact published route policy removes only its blocker and exposes a minimal student projection", () => {
  const f = fixture(); f.target.admissionRouteKey = "direct_university";
  const policy = { ...policyFor(f),
    preparedByUserId: "PRIVATE_PREPARER", reviewEvidence: { private: true },
  };
  const result = buildApplicationPreflight(f.target, f.inventory, "en", null, null, null, null, policy);
  assert.equal(result.target.admissionRouteKey, "direct_university");
  assert.equal(result.officialSubmissionPolicy.versionId, policy.versionId);
  assert.deepEqual(result.officialSubmissionPolicy.rule, policy.rule);
  assert.ok(!result.platformBlockers.includes("OFFICIAL_SUBMISSION_POLICY_UNAVAILABLE"));
  assert.ok(result.platformBlockers.includes("BILLING_ENTITLEMENT_UNAVAILABLE"));
  assert.ok(result.platformBlockers.includes("SUBMISSION_UNAVAILABLE"));
  assert.equal(result.canSubmit, false);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_PREPARER|reviewEvidence|targetSetSha256|approvalSha256|effectiveFrom/);
  for (const changed of [{ admissionRouteKey: "csc" }, { schoolId: randomUUID() }, { programIntakeId: randomUUID() }]) {
    assert.throws(() => buildApplicationPreflight(f.target, f.inventory, "en", null, null, null, null,
      { ...policy, ...changed }), error => error.status === 503);
  }
});

test("current per-project billing entitlement removes only its blocker and exposes no payment evidence", () => {
  const f = fixture(); f.target.admissionRouteKey = "direct_university";
  const policy = policyFor(f), entitlement = entitlementFor(f);
  const result = buildApplicationPreflight(f.target, f.inventory, "en", null, null, null, null, policy, entitlement);
  assert.equal(result.billingEntitlement.id, entitlement.id);
  assert.equal(result.billingEntitlement.current, true);
  assert.equal(result.billingEntitlement.status, "active");
  assert.ok(!result.platformBlockers.includes("BILLING_ENTITLEMENT_UNAVAILABLE"));
  assert.ok(result.platformBlockers.includes("SUBMISSION_UNAVAILABLE"));
  assert.equal(result.canSubmit, false);
  assert.doesNotMatch(JSON.stringify(result.billingEntitlement), /payment|invoice|event|amount|currency|digest|sha256/i);
  for (const changed of [{ status: "revoked", evidenceCurrent: false }, { evidenceCurrent: false },
    { admissionRouteKey: "csc" }]) {
    const stale = buildApplicationPreflight(f.target, f.inventory, "en", null, null, null, null, policy,
      { ...entitlement, ...changed });
    assert.equal(stale.billingEntitlement.current, false);
    assert.ok(stale.platformBlockers.includes("BILLING_ENTITLEMENT_UNAVAILABLE"));
  }
  assert.throws(() => buildApplicationPreflight(f.target, f.inventory, "en", null, null, null, null, policy,
    { ...entitlement, programId: randomUUID() }), error => error.status === 503);
});

test("malformed preparation metadata fails closed instead of claiming missing or complete information", () => {
  for (const extra of [{ applicantRevision: -1 }, { fullNamePresent: "true" }, { applicantRevision: 0, fullNamePresent: true },
    { educationCount: 1 }, { educationRevision: 1, educationCount: 21 }, { assessmentRevision: 1, assessmentCount: 41 }, { assessmentRevision: 2147483648 }]) {
    const f = fixture(); Object.assign(f.inventory, extra); assert.throws(() => report(f), e => e.status === 503);
  }
  for (const extra of [{ revision: 0 }, { checkedAt: new Date("invalid") }, { programId: "invalid" }, { schoolAvailable: null }]) {
    const f = fixture(); Object.assign(f.target, extra); assert.throws(() => report(f), e => e.status === 503);
  }
});

test("preflight denies role purpose surface tenant auth and data-class violations before accessing storage", async () => {
  let calls = 0;
  const reader = new PostgresApplicationPreflight({ async transaction() { calls++; } });
  const requiredClasses = ["student_pii", "education_record", "public_catalog", "public_notice", "payment_business"];
  for (const extra of [{ actorUserId: null }, { activeRole: "guest" }, { activeRole: "school_staff" }, { activeRole: "cuac_admin" },
    { selectedSurface: "public" }, { selectedSurface: "ops" }, { purpose: "agent_tool" }, { purpose: "public_notice_read" },
    { tenantSchoolId: randomUUID() }, { authStrength: "guest" }, { authStrength: "invented" },
    ...requiredClasses.map(missing => ({ dataClassAllowlist: requiredClasses.filter(c => c !== missing) }))]) {
    await assert.rejects(reader.get(context(extra), "bad", "bad", "bad"), e => e.status === 403);
  }
  await assert.rejects(reader.get(context(), "bad", randomUUID(), "en"), e => e.status === 400); assert.equal(calls, 0);
});

test("preflight uses a read-only snapshot and forwards only the database clock to publication readers", async () => {
  const f = fixture(), calls = [], actor = context(); f.target.admissionRouteKey = "direct_university";
  const tx = { async query(sql, params) {
    calls.push({ sql, params });
    if (sql.startsWith("set transaction")) return [];
    if (sql.includes('as "choiceId"')) return [f.target];
    if (sql.includes('as "applicantRevision"')) return [f.inventory];
    return [];
  } };
  const reader = new PostgresApplicationPreflight({ async transaction(work) { return work(tx); } });
  const result = await reader.get(actor, f.target.applicationSetId, f.target.choiceId, "en");
  assert.equal(calls[0].sql, "set transaction isolation level repeatable read, read only");
  assert.deepEqual(calls[1].params, [actor.actorUserId, f.target.applicationSetId, f.target.choiceId]);
  const clocked = calls.filter(call => /program_requirement_publications|privacy_notice_publications|official_submission_policy_publications|application_submission_authorizations/.test(call.sql));
  assert.ok(clocked.length >= 4); assert.ok(clocked.every(call => call.params.at(-1) === f.target.checkedAt));
  const snapshot = calls.find(call => /from application_material_snapshots/.test(call.sql));
  assert.deepEqual(snapshot.params, [actor.actorUserId, f.target.applicationSetId, f.target.choiceId]);
  assert.ok(calls.every(call => !/insert |update |delete |for share|for update/i.test(call.sql)));
  assert.doesNotMatch(calls.map(c => c.sql).join("\n"),
    /student_notes|components_json|consent_summary|school_visible_profile|provider_payment_id|provider_checkout_session_id|failure_message|metadata_json|agent_/);
  assert.equal(result.canSubmit, false);
});

test("snapshot publication clocks are bounded typed parameters and invalid clocks never reach SQL", async () => {
  let calls = 0; const client = { async query() { calls++; return []; } }, publicContext = createRequestContext({ purpose: "public_notice_read" });
  for (const clock of [null, "2026-01-01", new Date("invalid")]) {
    await assert.rejects(getPublishedProgramRequirements(client, randomUUID(), randomUUID(), clock), e => e.status === 503);
    await assert.rejects(new PostgresNoticeReader(client).getPublished(publicContext, "application_disclosure", "en", clock), e => e.status === 503);
  }
  assert.equal(calls, 0);
});

test("preflight HTTP derives student identity from the session and redacts storage failures", async () => {
  const f = fixture(), userId = randomUUID(); let captured, authCalls = 0;
  const auth = { async findActiveSessionByTokenHash() { authCalls++; return { userId, selectedSurface: "student", activeRole: "student", tenantSchoolId: null,
    authStrength: "session", expiresAt: new Date(Date.now() + 86400000), revokedAt: null, accountStatus: "active" }; } };
  const handler = createApplicationPreflightHandler({ async get(...args) { captured = args; return report(f); } }, auth);
  const request = new Request("https://cuac.test/?locale=en", { headers: { cookie: "cuac_session=synthetic", "x-user-id": randomUUID(), "x-role": "cuac_admin" } });
  const response = await handler(request, f.target.applicationSetId, f.target.choiceId); assert.equal(response.status, 200);
  assert.equal(captured[0].actorUserId, userId); assert.equal(captured[0].activeRole, "student"); assert.equal(captured[0].purpose, "student_action");
  assert.equal(response.headers.get("set-cookie"), null);
  for (const site of ["cross-site", "same-site", "invented"]) {
    const blocked = await handler(new Request(request, { headers: { cookie: "cuac_session=synthetic", "sec-fetch-site": site } }), f.target.applicationSetId, f.target.choiceId);
    assert.equal(blocked.status, 403);
  }
  assert.equal(authCalls, 1, "browser fetch metadata is checked before reading the session");
  const broken = createApplicationPreflightHandler({ async get() { throw new Error("RAW_DATABASE_PRIVATE_VALUE"); } }, auth);
  const failed = await broken(request, f.target.applicationSetId, f.target.choiceId); assert.equal(failed.status, 500); assert.doesNotMatch(await failed.text(), /RAW_DATABASE/);
  const unavailable = await createApplicationPreflightHandler()(new Request("https://cuac.test/?locale=en"), f.target.applicationSetId, f.target.choiceId);
  assert.equal(unavailable.status, 503);
});
