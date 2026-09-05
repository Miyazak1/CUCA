import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { secureApiRoute } from "../../../src/server/shared/http-boundary.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import {
  buildOfficialSubmissionGroupPlans,
  parseApplicationSubmissionInput,
} from "../../../src/server/student/application-submission.ts";
import { createApplicationSubmissionHttpHandler } from "../../../src/server/student/application-submission-http.ts";
import { PostgresApplicationSubmissionService } from "../../../src/server/student/postgres-application-submission.ts";

function policy(target, rule = {}) {
  return {
    schoolId: target.schoolId,
    programId: target.programId,
    programIntakeId: target.programIntakeId,
    admissionRouteKey: "direct_university",
    publicationRevision: 1,
    versionId: target.policyVersionId,
    version: 1,
    documentSha256: "a".repeat(64),
    targetSetSha256: "b".repeat(64),
    approvalSha256: "c".repeat(64),
    reviewedAt: "2026-01-01T00:00:00.000Z",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    reviewDueAt: "2027-01-01T00:00:00.000Z",
    rule: { formMode: "one_program_per_form", maxProgramChoices: 2, orderingMode: "none",
      externalChannelType: "university_portal", ...rule },
  };
}

function applications(rule = {}) {
  const schoolId = randomUUID(), policyVersionId = randomUUID();
  return [0, 1].map(rankOrder => {
    const target = { schoolId, policyVersionId, programId: randomUUID(), programIntakeId: randomUUID() };
    return {
      schoolApplicationId: randomUUID(),
      applicationChoiceId: randomUUID(),
      schoolId,
      programId: target.programId,
      programIntakeId: target.programIntakeId,
      admissionRouteKey: "direct_university",
      authorizationId: randomUUID(),
      materialSnapshotId: randomUUID(),
      feeEntitlementId: randomUUID(),
      rankOrder,
      policy: policy(target, rule),
    };
  });
}

test("submit input requires explicit confirmation exact unique choices and canonicalizes UUID order", () => {
  const ids = [randomUUID(), randomUUID()];
  const parsed = parseApplicationSubmissionInput({ expectedRevision: 7, choiceIds: [...ids].reverse(), confirmSubmission: true });
  assert.deepEqual(parsed, { expectedRevision: 7, choiceIds: [...ids].sort(), confirmSubmission: true });
  for (const value of [
    {},
    { expectedRevision: 1, choiceIds: [], confirmSubmission: true },
    { expectedRevision: 1, choiceIds: [ids[0], ids[0]], confirmSubmission: true },
    { expectedRevision: 1, choiceIds: ids, confirmSubmission: false },
    { expectedRevision: 0, choiceIds: ids, confirmSubmission: true },
    { expectedRevision: 1, choiceIds: ids, confirmSubmission: true, paymentId: randomUUID() },
  ]) assert.throws(() => parseApplicationSubmissionInput(value), error => error.status === 400);
});

test("one-program policy keeps same-school programs as two applications and two transport groups", () => {
  const items = applications();
  const groups = buildOfficialSubmissionGroupPlans(randomUUID(), items, randomUUID);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map(group => group.memberCount), [1, 1]);
  assert.deepEqual(new Set(groups.flatMap(group => group.members.map(member => member.schoolApplicationId))),
    new Set(items.map(item => item.schoolApplicationId)));
  assert.ok(groups.every(group => /^[a-f0-9]{64}$/.test(group.memberManifestSha256)));
});

test("multi-program policy may group same-school programs without collapsing their identities", () => {
  const items = applications({ formMode: "multi_program_form", orderingMode: "ranked" });
  const groups = buildOfficialSubmissionGroupPlans(randomUUID(), [...items].reverse(), randomUUID);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].memberCount, 2);
  assert.deepEqual(groups[0].members.map(member => member.schoolApplicationId), items.map(item => item.schoolApplicationId));
  assert.deepEqual(groups[0].members.map(member => member.memberPosition), [1, 2]);
  assert.notEqual(groups[0].members[0].memberManifestSha256, groups[0].members[1].memberManifestSha256);
});

test("different reviewed policy versions cannot share a transport group", () => {
  const items = applications({ formMode: "multi_program_form" });
  items[1].policy = { ...items[1].policy, versionId: randomUUID() };
  const groups = buildOfficialSubmissionGroupPlans(randomUUID(), items, randomUUID);
  assert.equal(groups.length, 2);
});

test("application submission service requires a step-up student before opening PostgreSQL", async () => {
  let transactions = 0;
  const service = new PostgresApplicationSubmissionService({ async transaction() { transactions += 1; } }, {});
  const setId = randomUUID(), choiceId = randomUUID();
  const value = { expectedRevision: 1, choiceIds: [choiceId], confirmSubmission: true };
  const base = { actorUserId: randomUUID(), activeRole: "student", selectedSurface: "student",
    purpose: "student_action", authStrength: "session" };
  for (const change of [{}, { authStrength: "guest" }, { activeRole: "school_staff" },
    { selectedSurface: "ops" }, { purpose: "agent_tool" }, { tenantSchoolId: randomUUID() }]) {
    await assert.rejects(service.submit(createRequestContext({ ...base, ...change }), setId, value,
      "application-submit-key-0001"), error => error.status === 403);
  }
  assert.equal(transactions, 0);
});

test("application submission HTTP derives step-up identity and forwards only the exact set command", async () => {
  const userId = randomUUID(), setId = randomUUID(), choiceIds = [randomUUID(), randomUUID()];
  const calls = [];
  const auth = { async findActiveSessionByTokenHash() { return { userId, selectedSurface: "student", activeRole: "student",
    tenantSchoolId: null, authStrength: "step_up", expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null, accountStatus: "active" }; } };
  const result = { id: randomUUID(), applicationSetId: setId, status: "accepted",
    programApplications: [], officialSubmissionGroups: [] };
  const handler = createApplicationSubmissionHttpHandler({ async submit(...args) { calls.push(args); return result; } }, auth);
  const body = { expectedRevision: 3, choiceIds, confirmSubmission: true };
  const route = secureApiRoute("POST", request => handler(request, setId),
    { env: { CUAC_ENV: "development", CUAC_PUBLIC_APP_URL: "https://cuac.test" } });
  const request = (suffix = "") => new Request(`https://cuac.test/submit${suffix}`, { method: "POST",
    headers: { origin: "https://cuac.test", cookie: "cuac_session=synthetic",
      "content-type": "application/json", "idempotency-key": "application-submit-key-0001",
      "x-user-id": randomUUID(), "x-role": "cuac_admin" }, body: JSON.stringify(body) });
  const response = await route(request());
  assert.equal(response.status, 201);
  assert.deepEqual((await response.json()).data, result);
  assert.equal(calls[0][0].actorUserId, userId);
  assert.equal(calls[0][0].authStrength, "step_up");
  assert.equal(calls[0][1], setId);
  assert.deepEqual(calls[0][2], body);
  assert.equal(calls[0][3], "application-submit-key-0001");
  assert.equal((await route(request("?schoolId=forged"))).status, 400);
  assert.equal(calls.length, 1);
});

test("application submission route stays thin and the unavailable handler fails closed", async () => {
  const source = await readFile(new URL("../../../app/api/v1/student/application-sets/[applicationSetId]/submit/route.ts",
    import.meta.url), "utf8");
  assert.match(source, /secureApiRoute\("POST"/);
  assert.match(source, /requireRouteUuid/);
  assert.doesNotMatch(source, /select\s+|insert\s+|payment|authorization|snapshot|cuac-data|public\//i);
  const handler = createApplicationSubmissionHttpHandler();
  const response = await handler(new Request("https://cuac.test/submit", { method: "POST",
    body: JSON.stringify({ expectedRevision: 1, choiceIds: [randomUUID()], confirmSubmission: true }) }), randomUUID());
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /postgres|database|secret/i);
});
