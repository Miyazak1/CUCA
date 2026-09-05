import assert from "node:assert/strict";
import test from "node:test";
import { PostgresOpsApplicationSupportRepository } from "../../../src/server/index.ts";

function fakeClient(responder) {
  const calls = [];
  const client = {
    async transaction(work) { return work(client); },
    async query(statement, params) { calls.push({ statement, params }); return responder(statement, params, calls.length); },
  };
  return { calls, client };
}

const authority = {
  grantId: "grant-1", actorUserId: "ops-1", activeRole: "cuac_ops",
  expiresAt: new Date("2026-09-03T00:00:00Z"),
};

test("Postgres Ops support opens a 15-minute session bound to current grant and exact CUAC target", async () => {
  const row = {
    supportSessionId: "session-1", applicationSetId: "set-1", cuacId: "CUAC-2026-004218",
    reasonCode: "student_inquiry", createdAt: new Date("2026-09-02T00:00:00Z"), expiresAt: new Date("2026-09-02T00:15:00Z"),
  };
  const { calls, client } = fakeClient((statement) => {
    if (/from users u/.test(statement)) return [authority];
    if (/from application_sets where/.test(statement)) return [{ applicationSetId: "set-1", cuacId: row.cuacId }];
    return [row];
  });
  const result = await new PostgresOpsApplicationSupportRepository(client).openApplicationSupportSession({
    actorUserId: "ops-1", activeRole: "cuac_ops", cuacId: row.cuacId,
    reasonCode: "student_inquiry", ttlMs: 15 * 60 * 1000,
  });
  assert.deepEqual(result, { authorized: true, targetFound: true, session: row });
  assert.equal(calls.length, 3);
  assert.match(calls[0].statement, /for share of u, r, g/);
  assert.match(calls[1].statement, /where cuac_id = \$1 for share/);
  assert.match(calls[2].statement, /insert into ops_support_access_sessions/);
  assert.match(calls[2].statement, /with database_clock as/);
  assert.doesNotMatch(calls[2].statement, /with current_time as/);
  assert.match(calls[2].statement, /least\(\$8::timestamptz/);
  assert.deepEqual(calls[2].params.slice(0, 6), ["ops-1", "grant-1", "cuac_ops", "set-1", row.cuacId, "student_inquiry"]);
});

test("Postgres Ops support distinguishes missing authority from an unknown target without creating a session", async () => {
  for (const [authorityRows, expected, queryCount] of [
    [[], { authorized: false }, 1],
    [[authority], { authorized: true, targetFound: false }, 2],
  ]) {
    const { calls, client } = fakeClient((statement) => /from users u/.test(statement) ? authorityRows : []);
    const result = await new PostgresOpsApplicationSupportRepository(client).openApplicationSupportSession({
      actorUserId: "ops-1", activeRole: "cuac_ops", cuacId: "CUAC-2026-999999",
      reasonCode: "incident_response", ttlMs: 15 * 60 * 1000,
    });
    assert.deepEqual(result, expected);
    assert.equal(calls.length, queryCount);
  }
});

test("Postgres Ops support resolves and closes only an owner-role session bound to the current grant", async () => {
  const support = {
    supportSessionId: "session-1", applicationSetId: "set-1", cuacId: "CUAC-2026-004218",
    reasonCode: "student_inquiry", createdAt: new Date(1), expiresAt: new Date(2),
  };
  const { calls, client } = fakeClient((statement) => {
    if (/from users u/.test(statement)) return [authority];
    if (/from ops_support_access_sessions/.test(statement)) return [support];
    if (/update ops_support_access_sessions/.test(statement)) return [{ closedAt: new Date(3) }];
    return [];
  });
  const repository = new PostgresOpsApplicationSupportRepository(client);
  assert.deepEqual(await repository.resolveApplicationSupportSession({
    actorUserId: "ops-1", activeRole: "cuac_ops", supportSessionId: "session-1",
  }), { authorized: true, session: support });
  assert.deepEqual(await repository.closeApplicationSupportSession({
    actorUserId: "ops-1", activeRole: "cuac_ops", supportSessionId: "session-1",
  }), { authorized: true, closedAt: new Date(3) });
  const sql = calls.map(call => call.statement).join("\n");
  assert.match(sql, /staff_access_grant_id = \$4/);
  assert.match(sql, /ss\.expires_at > clock_timestamp\(\)/);
  assert.match(sql, /for share of ss, a/);
  assert.match(sql, /set closed_at = date_trunc/);
});

test("Postgres Ops support projects routing state without student payment or material tables", async () => {
  const { calls, client } = fakeClient((statement) => {
    if (/from application_sets a/.test(statement)) return [{
      applicationSetId: "set-1", cuacId: "CUAC-2026-004218", status: "submitted",
      targetIntake: "fall-2027", revision: 3, activeChoiceCount: 1,
      createdAt: new Date(1), updatedAt: new Date(2), submittedAt: new Date(2),
      submissionStatus: "accepted", submissionSubmittedAt: new Date(2), groupCount: 1,
      pendingGroupCount: 1, dispatchedGroupCount: 0, quarantinedGroupCount: 0,
    }];
    return [{
      applicationId: "app-1", schoolId: "school-1", schoolName: "University",
      programId: "program-1", programName: "Program", programIntakeId: "intake-1",
      intakeTerm: "fall", intakeYear: 2027, status: "new", statusChangedAt: new Date(2),
      submittedAt: new Date(2), firstViewedAt: null,
    }];
  });
  const result = await new PostgresOpsApplicationSupportRepository(client).findApplicationSupportByCuacId("CUAC-2026-004218");
  assert.equal(result.programApplications.length, 1);
  const sql = calls.map(call => call.statement).join("\n");
  assert.match(sql, /official_submission_groups/);
  assert.match(sql, /school_applications/);
  assert.doesNotMatch(sql, /student_profiles|student_applicant_profiles|material_snapshot|invoice|payment|auth_identities/i);
  assert.doesNotMatch(JSON.stringify(result), /userId|email|profile|material|invoice|payment/i);
});

test("Postgres Ops support returns null without running child projection query", async () => {
  const { calls, client } = fakeClient(() => []);
  assert.equal(await new PostgresOpsApplicationSupportRepository(client).findApplicationSupportByCuacId("CUAC-2026-999999"), null);
  assert.equal(calls.length, 1);
});
