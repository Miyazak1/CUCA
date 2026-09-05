import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PostgresAuditWriter } from "../../../src/server/audit/postgres-writer.ts";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { PostgresNotificationDeliveryQueue } from "../../../src/server/notifications/delivery-queue.ts";
import { PostgresNotificationPublisher, PostgresNotificationRepository } from "../../../src/server/notifications/postgres-repository.ts";
import { NotificationService } from "../../../src/server/notifications/service.ts";
import { materializeSchoolApplicationStatusNotification } from "../../../src/server/notifications/templates.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";

export async function runNotificationDeliveryRehearsal(t, pool) {
  await t.test("notification event, persona API and reliable delivery lifecycle hold in PostgreSQL", async () => {
    const email = `notification-${randomUUID()}@example.invalid`;
    const user = (await pool.query(`insert into users (email,email_normalized,email_verified_at)
      values ($1,$1,clock_timestamp()) returning id`, [email])).rows[0];
    await pool.query("insert into user_roles (user_id,role) values ($1,'student')", [user.id]);
    const sql = createTransactionalSqlClient(pool);
    const publisher = new PostgresNotificationPublisher(sql);
    const createService = tx => new NotificationService(new PostgresNotificationRepository(tx), new PostgresAuditWriter(tx));
    const execute = (method, ...args) => sql.transaction(tx => createService(tx)[method](...args));
    const context = createRequestContext({ actorUserId: user.id, activeRole: "student", selectedSurface: "student",
      purpose: "notification_management", authStrength: "session", requestId: randomUUID() });
    const applicationSetId = randomUUID();
    const eventInput = (statusEventId = randomUUID(), status = "waiting_for_documents") =>
      materializeSchoolApplicationStatusNotification({ recipientUserId: user.id, schoolApplicationId: randomUUID(),
        applicationSetId, statusEventId, status, occurredAt: new Date() });

    try {
      const input = eventInput();
      const first = await publisher.publish(input);
      const replay = await publisher.publish(input);
      assert.equal(first.created, true);
      assert.deepEqual(replay, { eventId: first.eventId, created: false });
      assert.equal((await pool.query("select count(*)::int as total from notification_events where recipient_user_id = $1", [user.id])).rows[0].total, 1);
      const deliveries = (await pool.query(`select channel,status,outcome from notification_deliveries
        where event_id = $1 order by channel`, [first.eventId])).rows;
      assert.deepEqual(deliveries, [
        { channel: "email", status: "queued", outcome: null },
        { channel: "in_app", status: "unread", outcome: null },
        { channel: "sms", status: "suppressed", outcome: "preference_disabled" },
      ]);
      assert.equal((await pool.query("select count(*)::int as total from notification_templates")).rows[0].total, 3);

      const listed = await createService(sql).list(context, { limit: 10 });
      assert.equal(listed.items.length, 1);
      assert.doesNotMatch(JSON.stringify(listed), /email_normalized|event_key|variables|template/i);
      const read = await execute("markRead", context, listed.items[0].id, { expectedRevision: 0 });
      assert.deepEqual({ status: read.status, revision: read.revision }, { status: "read", revision: 1 });
      await assert.rejects(execute("markRead", context, listed.items[0].id, { expectedRevision: 0 }), error => error.status === 409);

      const otherEmail = `notification-other-${randomUUID()}@example.invalid`;
      const other = (await pool.query("insert into users (email,email_normalized) values ($1,$1) returning id", [otherEmail])).rows[0];
      await pool.query("insert into user_roles (user_id,role) values ($1,'student')", [other.id]);
      const otherContext = { ...context, actorUserId: other.id, requestId: randomUUID() };
      assert.equal((await createService(sql).list(otherContext)).items.length, 0);
      await assert.rejects(execute("markRead", otherContext, listed.items[0].id, { expectedRevision: 1 }), error => error.status === 404);
      await pool.query("delete from users where id = $1", [other.id]);

      const disabled = await execute("updatePreferences", context, { preferences: [{ topic: "application_updates",
        inAppEnabled: true, emailEnabled: false, smsEnabled: false, expectedRevision: 0 }] });
      assert.equal(disabled.preferences[0].revision, 1);
      await assert.rejects(execute("updatePreferences", context, { preferences: [{ topic: "application_updates",
        inAppEnabled: true, emailEnabled: true, smsEnabled: false, expectedRevision: 0 }] }), error => error.status === 409);
      const suppressedEvent = await publisher.publish(eventInput());
      assert.deepEqual((await pool.query(`select status,outcome from notification_deliveries
        where event_id = $1 and channel = 'email'`, [suppressedEvent.eventId])).rows[0],
      { status: "suppressed", outcome: "preference_disabled" });

      const enabled = await execute("updatePreferences", context, { preferences: [{ topic: "application_updates",
        inAppEnabled: true, emailEnabled: true, smsEnabled: true, expectedRevision: 1 }] });
      assert.equal(enabled.preferences[0].revision, 2);
      const queued = await publisher.publish(eventInput());
      const queue = new PostgresNotificationDeliveryQueue(sql);
      let acceptedCount = 0, smsSuppressed = false;
      while (true) {
        const lease = await queue.claim();
        if (!lease) break;
        const channel = (await pool.query("select channel from notification_deliveries where id = $1", [lease.id])).rows[0].channel;
        const prepared = await queue.prepare(lease);
        if (channel === "email") {
          assert.equal(prepared.to, email);
          assert.equal(await queue.finish(lease, "accepted", `provider-message-${acceptedCount}`), true);
          acceptedCount += 1;
        } else {
          assert.equal(prepared, null);
          assert.deepEqual((await pool.query("select status,outcome from notification_deliveries where id = $1", [lease.id])).rows[0],
            { status: "suppressed", outcome: "destination_unavailable" });
          smsSuppressed = true;
        }
      }
      assert.equal(acceptedCount, 2);
      assert.equal(smsSuppressed, true);
      await execute("updatePreferences", context, { preferences: [{ topic: "application_updates",
        inAppEnabled: true, emailEnabled: true, smsEnabled: false, expectedRevision: 2 }] });

      const retryEvent = await publisher.publish(eventInput());
      const retryId = (await pool.query("select id from notification_deliveries where event_id = $1 and channel = 'email'", [retryEvent.eventId])).rows[0].id;
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        await pool.query("update notification_deliveries set available_at = clock_timestamp() where id = $1", [retryId]);
        const lease = await queue.claim();
        assert.equal(lease.id, retryId);
        assert.ok(await queue.prepare(lease));
        assert.equal(await queue.finish(lease, "not_accepted"), true);
      }
      assert.deepEqual((await pool.query("select status,outcome,attempt_count from notification_deliveries where id = $1", [retryId])).rows[0],
        { status: "failed", outcome: "attempt_limit", attempt_count: 5 });

      const uncertainEvent = await publisher.publish(eventInput());
      const uncertainId = (await pool.query("select id from notification_deliveries where event_id = $1 and channel = 'email'", [uncertainEvent.eventId])).rows[0].id;
      await pool.query("update notification_deliveries set available_at = clock_timestamp() where id = $1", [uncertainId]);
      const uncertainLease = await queue.claim();
      assert.equal(uncertainLease.id, uncertainId);
      assert.ok(await queue.prepare(uncertainLease));
      assert.equal(await queue.finish(uncertainLease, "unknown"), true);
      assert.deepEqual((await pool.query("select status,outcome from notification_deliveries where id = $1", [uncertainId])).rows[0],
        { status: "uncertain", outcome: "unknown" });

      await assert.rejects(pool.query(`insert into notification_preferences
        (user_id,audience_role,topic,in_app_enabled,email_enabled) values ($1,'student','account_security',false,false)`, [user.id]),
      error => error.code === "23514" && error.constraint === "notification_preferences_security_check");
      await assert.rejects(pool.query("update notification_deliveries set recipient_user_id = $2 where id = $1", [listed.items[0].id, randomUUID()]),
      error => error.code === "23503" && error.constraint === "notification_deliveries_event_scope_fk");
      assert.equal((await pool.query(`select count(*)::int as total from audit_logs where resource_type = 'notification'
        and action like 'notification.%'`)).rows[0].total > 0, true);
      assert.equal(queued.created, true);
    } finally {
      await pool.query("delete from users where id = $1", [user.id]);
    }
  });
}
