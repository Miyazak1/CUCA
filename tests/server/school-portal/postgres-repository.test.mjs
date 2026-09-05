import assert from "node:assert/strict";
import test from "node:test";
import { CuacError, PostgresSchoolPortalRepository, schoolWorkflowCommandDigests } from "../../../src/server/index.ts";

function createClient(responder) {
  const calls = [];
  return {
    calls,
    client: {
      async query(statement, params) {
        calls.push({ statement, params });
        return responder(statement, params, calls.length);
      },
    },
  };
}

test("Postgres school portal repository lists tenant queue through school projection only", async () => {
  const { client, calls } = createClient(() => [
    {
      id: "app-1",
      applicationRecordFormat: "cuac.program-application.v1",
      cuacId: "CUAC-2026-004218",
      schoolId: "school-1",
      studentUserId: "student-1",
      programId: "program-1",
      programIntakeId: "intake-1",
      status: "submitted",
      schoolRevision: 1,
      statusChangedAt: new Date("2026-08-28T00:00:00.000Z"),
      submittedAt: null,
      firstViewedAt: null,
      schoolVisibleProfileJson: { displayName: "Ada" },
      routingMetadataJson: { source: "paid_submission" },
    },
  ]);
  const repository = new PostgresSchoolPortalRepository(client);

  const queue = await repository.listApplicationQueueBySchoolId("school-1");

  assert.equal(queue[0].schoolVisibleProfile.displayName, "Ada");
  assert.equal(queue[0].cuacId, "CUAC-2026-004218");
  assert.equal(queue[0].programIntakeId, "intake-1");
  assert.equal(Object.hasOwn(queue[0], "targetKey"), false);
  assert.match(calls[0].statement, /sa\.program_intake_id as "programIntakeId"/);
  assert.match(calls[0].statement, /from school_applications sa/);
  assert.match(calls[0].statement, /where sa\.school_id = \$1/);
  assert.match(calls[0].statement, /sa\.status <> 'pending_submission'/);
  assert.doesNotMatch(calls[0].statement, /select \*/i);
  assert.doesNotMatch(calls[0].statement, /application_choices|application_sets|student_profiles|payments|agent_/i);
  assert.deepEqual(calls[0].params, ["school-1"]);
});

test("Postgres school portal repository searches CUAC ID inside the current tenant projection", async () => {
  const { client, calls } = createClient(() => []);
  const repository = new PostgresSchoolPortalRepository(client);

  assert.deepEqual(await repository.listApplicationQueueBySchoolId("school-1", "CUAC-2026-004218"), []);
  assert.deepEqual(calls[0].params, ["school-1", "CUAC-2026-004218"]);
  assert.match(calls[0].statement, /sa\.school_id = \$1/);
  assert.match(calls[0].statement, /sa\.cuac_id = \$2/);
  assert.match(calls[0].statement, /sa\.status <> 'pending_submission'/);
  assert.doesNotMatch(calls[0].statement, /application_choices|application_sets|student_profiles|payments|agent_/i);
});

test("Postgres school portal repository detail loads status events without other student choices", async () => {
  const { client, calls } = createClient((statement) => {
    if (/from school_application_contact_logs c/.test(statement)) return [];
    if (/from school_applications sa/.test(statement) && !/from school_application_status_events/.test(statement)) {
      return [
        {
          id: "app-1",
          applicationRecordFormat: "cuac.program-application.v2",
          cuacId: "CUAC-2026-004218",
          schoolId: "school-1",
          studentUserId: "student-1",
          programId: "program-1",
          programIntakeId: null,
          status: "submitted",
          schoolRevision: 1,
          statusChangedAt: new Date("2026-08-28T00:00:00.000Z"),
          submittedAt: null,
          firstViewedAt: null,
          schoolVisibleProfileJson: {},
          routingMetadataJson: {},
        },
      ];
    }

    return [
      {
        id: "event-1",
        schoolApplicationId: "app-1",
        actorUserId: "staff-1",
        fromStatus: "pending_submission",
        toStatus: "submitted",
        reason: null,
        applicationRevision: null,
        createdAt: new Date("2026-08-28T00:00:00.000Z"),
      },
    ];
  });
  const repository = new PostgresSchoolPortalRepository(client);

  const detail = await repository.getApplicationById("app-1", "school-1");

  assert.equal(detail.statusEvents[0].toStatus, "submitted");
  assert.equal(detail.programIntakeId, null);
  assert.deepEqual(calls.map((call) => call.params), [["app-1", "school-1"], ["app-1", "school-1"], ["app-1", "school-1"]]);
  calls.forEach((call) => {
    assert.doesNotMatch(call.statement, /application_choices|application_sets|saved_items|payments|agent_/i);
    assert.doesNotMatch(call.statement, /select \*/i);
  });
});

test("Postgres school workflow rechecks live write authority and atomically records one revision event", async () => {
  const changedAt = new Date("2026-09-02T01:00:00.000Z");
  const command = { expectedRevision: 1, status: "needs_review", reason: null };
  const digests = schoolWorkflowCommandDigests("status.change", command, "school-status-repo-0001");
  const { client, calls } = createClient((statement) => {
    if (/from users/.test(statement)) return [{ id: "staff-1" }];
    if (/from user_roles/.test(statement)) return [{ id: "role-1" }];
    if (/from schools/.test(statement)) return [{ id: "school-1" }];
    if (/from school_staff_memberships/.test(statement)) return [{ role: "admissions" }];
    if (/from school_applications where/.test(statement)) return [{
      id: "app-1", schoolId: "school-1", applicationRecordFormat: "cuac.program-application.v2",
      applicationSetId: "set-1", studentUserId: "student-1", status: "new", schoolRevision: 1, submittedAt: changedAt,
    }];
    if (/from school_application_status_events/.test(statement)) return [];
    if (/with changed as/.test(statement)) return [{
      id: "app-1", schoolId: "school-1", status: "needs_review", schoolRevision: 2,
      statusChangedAt: changedAt, statusEventId: "event-1",
    }];
    throw new Error(`Unexpected SQL: ${statement}`);
  });
  const repository = new PostgresSchoolPortalRepository(client);

  const result = await repository.updateApplicationStatus({
    applicationId: "app-1", schoolId: "school-1", actorUserId: "staff-1", command, ...digests,
  });

  assert.equal(result.changed, true);
  assert.equal(result.result.schoolRevision, 2);
  assert.equal(result.result.status, "needs_review");
  assert.equal(result.recipientApplicationSetId, "set-1");
  assert.match(calls.find((call) => /from school_applications where/.test(call.statement)).statement,
    /application_set_id as "applicationSetId"/);
  const mutation = calls.find((call) => /with changed as/.test(call.statement));
  assert.match(mutation.statement, /school_revision = school_revision \+ 1/);
  assert.match(mutation.statement, /insert into school_application_status_events/);
  assert.deepEqual(mutation.params, ["app-1", "school-1", 1, "needs_review", "new", "staff-1", null,
    digests.keyHash, digests.requestHash]);
});

test("Postgres school workflow replays the same receipt and rejects changed key reuse without a second update", async () => {
  const changedAt = new Date("2026-09-02T01:00:00.000Z");
  const command = { expectedRevision: 1, status: "needs_review", reason: null };
  const digests = schoolWorkflowCommandDigests("status.change", command, "school-status-repo-0002");
  const { client, calls } = createClient((statement) => {
    if (/from users/.test(statement)) return [{ id: "staff-1" }];
    if (/from user_roles/.test(statement)) return [{ id: "role-1" }];
    if (/from schools/.test(statement)) return [{ id: "school-1" }];
    if (/from school_staff_memberships/.test(statement)) return [{ role: "school_admin" }];
    if (/from school_applications where/.test(statement)) return [{
      id: "app-1", schoolId: "school-1", applicationRecordFormat: "cuac.program-application.v2",
      applicationSetId: "set-1", studentUserId: "student-1", status: "contacted", schoolRevision: 3, submittedAt: changedAt,
    }];
    if (/from school_application_status_events/.test(statement)) return [{
      statusEventId: "event-1", requestHash: digests.requestHash, toStatus: "needs_review",
      applicationRevision: 2, createdAt: changedAt,
    }];
    throw new Error(`Unexpected SQL: ${statement}`);
  });
  const repository = new PostgresSchoolPortalRepository(client);
  const input = { applicationId: "app-1", schoolId: "school-1", actorUserId: "staff-1", command, ...digests };

  const replay = await repository.updateApplicationStatus(input);
  assert.equal(replay.changed, false);
  assert.equal(replay.result.schoolRevision, 2);
  assert.equal(calls.some((call) => /with changed as/.test(call.statement)), false);

  await assert.rejects(() => repository.updateApplicationStatus({ ...input, requestHash: "f".repeat(64) }),
    (error) => error instanceof CuacError && error.code === "CONFLICT");
});

test("Postgres school contact write is tenant-scoped, idempotent and denied to viewer membership", async () => {
  const createdAt = new Date("2026-09-02T01:00:00.000Z");
  const command = { channel: "email", direction: "outbound", outcome: "reached", note: "Private contact note" };
  const digests = schoolWorkflowCommandDigests("contact.record", command, "school-contact-repo-01");
  let membershipRole = "counselor";
  const { client, calls } = createClient((statement) => {
    if (/from users/.test(statement)) return [{ id: "staff-1" }];
    if (/from user_roles/.test(statement)) return [{ id: "role-1" }];
    if (/from schools/.test(statement)) return [{ id: "school-1" }];
    if (/from school_staff_memberships/.test(statement)) return [{ role: membershipRole }];
    if (/from school_applications where/.test(statement)) return [{
      id: "app-1", schoolId: "school-1", applicationRecordFormat: "cuac.program-application.v2",
      status: "contacted", schoolRevision: 3, submittedAt: createdAt,
    }];
    if (/from school_application_contact_logs c/.test(statement)) return [];
    if (/insert into school_application_contact_logs/.test(statement)) return [{
      id: "contact-1", schoolApplicationId: "app-1", actorUserId: "staff-1", ...command, createdAt,
    }];
    throw new Error(`Unexpected SQL: ${statement}`);
  });
  const repository = new PostgresSchoolPortalRepository(client);
  const input = { applicationId: "app-1", schoolId: "school-1", actorUserId: "staff-1", command, ...digests };

  const created = await repository.recordApplicationContact(input);
  assert.equal(created.created, true);
  assert.equal(created.contact.note, "Private contact note");
  assert.match(calls.find((call) => /insert into school_application_contact_logs/.test(call.statement)).statement,
    /school_application_id, school_id, actor_user_id/);

  membershipRole = "viewer";
  const before = calls.length;
  await assert.rejects(() => repository.recordApplicationContact(input),
    (error) => error instanceof CuacError && error.code === "FORBIDDEN");
  assert.equal(calls.slice(before).some((call) => /from school_applications where/.test(call.statement)), false);
});
