import assert from "node:assert/strict";
import test from "node:test";
import { createRequestContext, OpsApplicationSupportService } from "../../../src/server/index.ts";

const cuacId = "CUAC-2026-004218";
const supportSessionId = "55555555-5555-4555-8555-555555555555";
const session = {
  supportSessionId, cuacId, reasonCode: "student_inquiry",
  createdAt: new Date("2026-09-02T00:00:00Z"), expiresAt: new Date("2026-09-02T00:15:00Z"),
};
const projection = {
  cuacId,
  applicationSet: {
    status: "submitted", targetIntake: "fall-2027", revision: 4, activeChoiceCount: 2,
    createdAt: new Date("2026-08-01T00:00:00Z"), updatedAt: new Date("2026-09-01T00:00:00Z"),
    submittedAt: new Date("2026-09-01T00:00:00Z"),
  },
  submission: {
    status: "accepted", submittedAt: new Date("2026-09-01T00:00:00Z"), groupCount: 2,
    pendingGroupCount: 1, dispatchedGroupCount: 1, quarantinedGroupCount: 0,
  },
  programApplications: [{
    applicationId: "11111111-1111-4111-8111-111111111111",
    schoolId: "22222222-2222-4222-8222-222222222222", schoolName: "Reviewed University",
    programId: "33333333-3333-4333-8333-333333333333", programName: "Reviewed Program",
    programIntakeId: "44444444-4444-4444-8444-444444444444", intakeTerm: "fall", intakeYear: 2027,
    status: "new", statusChangedAt: new Date("2026-09-01T00:00:00Z"),
    submittedAt: new Date("2026-09-01T00:00:00Z"), firstViewedAt: null,
  }],
};
const context = createRequestContext({
  actorUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", activeRole: "cuac_ops",
  selectedSurface: "ops", purpose: "ops_support", authStrength: "session",
});

function fixture(options = {}) {
  const calls = [], audits = [];
  const service = new OpsApplicationSupportService({
    async openApplicationSupportSession(input) {
      calls.push({ method: "open", input });
      if (options.authorized === false) return { authorized: false };
      if (options.targetFound === false) return { authorized: true, targetFound: false };
      return { authorized: true, targetFound: true, session };
    },
    async resolveApplicationSupportSession(input) {
      calls.push({ method: "resolve", input });
      if (options.authorized === false) return { authorized: false };
      return { authorized: true, session: options.activeSession === false ? null : { ...session, applicationSetId: "set-1" } };
    },
    async closeApplicationSupportSession(input) {
      calls.push({ method: "close", input });
      if (options.authorized === false) return { authorized: false };
      return { authorized: true, closedAt: options.activeSession === false ? null : new Date("2026-09-02T00:05:00Z") };
    },
    async findApplicationSupportByCuacId(value) {
      calls.push({ method: "find", cuacId: value });
      return projection;
    },
  }, { async record(event) { audits.push(event); } });
  return { service, calls, audits };
}

test("Ops support opens, uses and closes one bounded application session with separate audits", async () => {
  const { service, calls, audits } = fixture();
  assert.deepEqual(await service.openApplicationSupportSession(context, { cuacId, reasonCode: "student_inquiry" }), session);
  assert.deepEqual(await service.getApplicationBySupportSession(context, { supportSessionId }), projection);
  assert.deepEqual(await service.closeApplicationSupportSession(context, supportSessionId), {
    supportSessionId, closed: true, closedAt: new Date("2026-09-02T00:05:00Z"),
  });
  assert.deepEqual(calls.map(call => call.method), ["open", "resolve", "find", "close"]);
  assert.equal(calls[0].input.ttlMs, 15 * 60 * 1000);
  assert.deepEqual(audits.map(event => event.action), [
    "ops.application_support_session.open", "ops.application_support.lookup", "ops.application_support_session.close",
  ]);
  assert.deepEqual(audits[1].metadata, { reasonCode: "student_inquiry", programApplicationCount: 1 });
  assert.doesNotMatch(JSON.stringify(projection), /studentUserId|email|profile|material|invoice|payment|authorization/i);
});

test("Ops support does not create a session for an unknown CUAC ID and audits only bounded metadata", async () => {
  const { service, calls, audits } = fixture({ targetFound: false });
  assert.equal(await service.openApplicationSupportSession(context, { cuacId, reasonCode: "school_inquiry" }), null);
  assert.deepEqual(calls.map(call => call.method), ["open"]);
  assert.deepEqual(audits[0].metadata, { reasonCode: "school_inquiry", found: false, expiresAt: null });
});

test("Ops support denies missing authority and inactive support sessions before application projection", async () => {
  for (const options of [{ authorized: false }, { activeSession: false }]) {
    const { service, calls, audits } = fixture(options);
    await assert.rejects(service.getApplicationBySupportSession(context, { supportSessionId }), error => error.status === 403);
    assert.equal(calls.some(call => call.method === "find"), false);
    assert.deepEqual(audits, []);
  }
});

test("Ops support rejects wrong persona, malformed identifiers, free text reasons and authority fields before repository access", async () => {
  for (const [method, candidateContext, input] of [
    ["open", { ...context, selectedSurface: "student" }, { cuacId, reasonCode: "student_inquiry" }],
    ["open", context, { cuacId: "cuac-2026-4218", reasonCode: "student_inquiry" }],
    ["open", context, { cuacId, reasonCode: "because the student called" }],
    ["lookup", context, { supportSessionId, role: "cuac_admin" }],
    ["lookup", context, { supportSessionId: "bad-id" }],
  ]) {
    const { service, calls, audits } = fixture();
    const operation = method === "open"
      ? service.openApplicationSupportSession(candidateContext, input)
      : service.getApplicationBySupportSession(candidateContext, input);
    await assert.rejects(operation, error => [400, 403].includes(error.status));
    assert.deepEqual(calls, []);
    assert.deepEqual(audits, []);
  }
});
