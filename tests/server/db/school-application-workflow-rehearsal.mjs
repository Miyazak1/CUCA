import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  PostgresAuditWriter,
  PostgresSchoolPortalRepository,
  SchoolPortalService,
  createRequestContext,
  createTransactionalSqlClient,
} from "../../../src/server/index.ts";
import {
  applicationAtomicSubmissionFixture,
  clearApplicationAtomicSubmissions,
} from "./application-atomic-submission-fixture.mjs";
import { createAuditFailureFixture } from "./audit-failure-fixture.mjs";
import { PostgresNotificationPublisher } from "../../../src/server/notifications/postgres-repository.ts";

export async function runSchoolApplicationWorkflowRehearsal(t, pool) {
  await t.test("school workflow hides undelivered applications and serializes tenant status and contact writes", async () => {
    await clearApplicationAtomicSubmissions(pool);
    const fixture = await applicationAtomicSubmissionFixture(pool, {});
    const submission = await fixture.submit();
    const [application, pendingSibling] = submission.programApplications;
    const staffEmail = `school-workflow-${randomUUID()}@example.invalid`;
    const staff = (await pool.query("insert into users (email,email_normalized) values ($1,$1) returning id", [staffEmail])).rows[0];
    await pool.query("insert into user_roles (user_id,role) values ($1,'school_staff')", [staff.id]);
    await pool.query(`insert into school_staff_memberships (school_id,user_id,role,status)
      values ($1,$2,'admissions','active')`, [application.schoolId, staff.id]);
    await pool.query(`update school_applications set status = 'new', submitted_at = clock_timestamp(),
      status_changed_at = clock_timestamp() where id = $1`, [application.id]);

    const sql = createTransactionalSqlClient(pool);
    const createService = tx => new SchoolPortalService(
      new PostgresSchoolPortalRepository(tx), new PostgresAuditWriter(tx),
      new PostgresNotificationPublisher(tx),
    );
    const execute = (method, ...args) => sql.transaction(tx => createService(tx)[method](...args));
    const context = createRequestContext({
      activeRole: "school_staff",
      actorUserId: staff.id,
      tenantSchoolId: application.schoolId,
      selectedSurface: "school",
      purpose: "school_review",
      authStrength: "session",
      requestId: `school-workflow-${randomUUID()}`,
    });

    try {
      const queue = await createService(sql).listTenantApplicationQueue(context);
      assert.deepEqual(queue.map(row => row.id), [application.id]);
      assert.equal(queue.some(row => row.id === pendingSibling.id), false);
      assert.equal((await createService(sql).getTenantApplication(context, pendingSibling.id)), null);

      await assert.rejects(execute("updateTenantApplicationStatus", context, pendingSibling.id,
        { expectedRevision: 1, status: "needs_review", reason: null },
        { idempotencyKey: randomUUID() }), error => error.status === 409);

      const statusKey = randomUUID();
      const first = await execute("updateTenantApplicationStatus", context, application.id,
        { expectedRevision: 1, status: "needs_review", reason: null }, { idempotencyKey: statusKey });
      const replay = await execute("updateTenantApplicationStatus", { ...context, requestId: `replay-${randomUUID()}` },
        application.id, { expectedRevision: 1, status: "needs_review", reason: null }, { idempotencyKey: statusKey });
      assert.deepEqual(replay, first);
      assert.equal(first.schoolRevision, 2);
      assert.equal((await pool.query(`select count(*)::int as total from school_application_status_events
        where school_application_id = $1 and command_key_hash is not null`, [application.id])).rows[0].total, 1);
      assert.equal((await pool.query(`select count(*)::int as total from audit_logs
        where action = 'school.application.status.change' and resource_id = $1`, [application.id])).rows[0].total, 1);
      assert.equal((await pool.query(`select count(*)::int as total from notification_events
        where resource_type = 'school_application' and resource_id = $1`, [application.id])).rows[0].total, 1);
      assert.equal((await pool.query(`select count(*)::int as total from notification_deliveries d
        join notification_events e on e.id = d.event_id where e.resource_id = $1`, [application.id])).rows[0].total, 3);
      await assert.rejects(execute("updateTenantApplicationStatus", context, application.id,
        { expectedRevision: 1, status: "not_a_fit", reason: "Changed command" },
        { idempotencyKey: statusKey }), error => error.status === 409);

      const contactKey = randomUUID();
      const contactInput = { channel: "email", direction: "outbound", outcome: "follow_up_required",
        note: "Private transcript follow-up note" };
      const contact = await execute("recordTenantApplicationContact", context, application.id, contactInput,
        { idempotencyKey: contactKey });
      const contactReplay = await execute("recordTenantApplicationContact", { ...context, requestId: `contact-replay-${randomUUID()}` },
        application.id, contactInput, { idempotencyKey: contactKey });
      assert.deepEqual(contactReplay, contact);
      assert.equal((await pool.query("select count(*)::int as total from school_application_contact_logs where school_application_id = $1", [application.id])).rows[0].total, 1);
      const contactAudit = (await pool.query(`select metadata_json from audit_logs
        where action = 'school.application.contact.record' and resource_id = $1`, [contact.id])).rows;
      assert.equal(contactAudit.length, 1);
      assert.equal(JSON.stringify(contactAudit).includes("Private transcript follow-up note"), false);

      await pool.query("update school_staff_memberships set role = 'viewer' where user_id = $1 and school_id = $2", [staff.id, application.schoolId]);
      await assert.rejects(execute("recordTenantApplicationContact", context, application.id,
        { ...contactInput, note: "Viewer must not write" }, { idempotencyKey: randomUUID() }),
      error => error.status === 403);
      await pool.query("update school_staff_memberships set role = 'admissions' where user_id = $1 and school_id = $2", [staff.id, application.schoolId]);

      const fault = await createAuditFailureFixture(pool);
      try {
        const beforeNotifications = (await pool.query(`select count(*)::int as total from notification_events
          where resource_type = 'school_application' and resource_id = $1`, [application.id])).rows[0].total;
        await assert.rejects(fault.during("school.application.status.change", () =>
          execute("updateTenantApplicationStatus", context, application.id,
            { expectedRevision: 2, status: "contact_queued", reason: null }, { idempotencyKey: randomUUID() })),
        error => error.code === "P0001");
        assert.deepEqual((await pool.query("select status,school_revision from school_applications where id = $1", [application.id])).rows[0],
          { status: "needs_review", school_revision: 2 });
        assert.equal((await pool.query(`select count(*)::int as total from notification_events
          where resource_type = 'school_application' and resource_id = $1`, [application.id])).rows[0].total, beforeNotifications);
      } finally {
        await fault.close();
      }

      const races = await Promise.allSettled([
        execute("updateTenantApplicationStatus", context, application.id,
          { expectedRevision: 2, status: "contact_queued", reason: null }, { idempotencyKey: randomUUID() }),
        execute("updateTenantApplicationStatus", { ...context, requestId: `race-${randomUUID()}` }, application.id,
          { expectedRevision: 2, status: "not_a_fit", reason: "Closed after review" }, { idempotencyKey: randomUUID() }),
      ]);
      assert.equal(races.filter(result => result.status === "fulfilled").length, 1);
      assert.equal(races.filter(result => result.status === "rejected" && result.reason?.status === 409).length, 1);
      assert.equal((await pool.query("select school_revision from school_applications where id = $1", [application.id])).rows[0].school_revision, 3);

      await assert.rejects(pool.query("update school_applications set status = 'invented_state' where id = $1", [application.id]),
        error => error.code === "23514" && error.constraint === "school_applications_workflow_check");
      await assert.rejects(pool.query(`insert into school_application_contact_logs
        (school_application_id,school_id,actor_user_id,channel,direction,outcome,note,command_key_hash,request_hash)
        values ($1,$2,$3,'sms','outbound','reached','bad',$4,$5)`,
      [application.id, application.schoolId, staff.id, "a".repeat(64), "b".repeat(64)]),
      error => error.code === "23514" && error.constraint === "school_application_contact_logs_value_check");
    } finally {
      await clearApplicationAtomicSubmissions(pool);
      await pool.query("delete from users where id = $1", [staff.id]);
    }
  });
}
