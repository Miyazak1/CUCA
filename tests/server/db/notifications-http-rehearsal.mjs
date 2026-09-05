import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { PostgresNotificationPublisher } from "../../../src/server/notifications/postgres-repository.ts";
import { materializeSchoolApplicationStatusNotification } from "../../../src/server/notifications/templates.ts";
import { createAuditFailureFixture, snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";

export async function runNotificationsHttpRehearsal(t, pool, { send, browser, register }) {
  const publisher = new PostgresNotificationPublisher(createTransactionalSqlClient(pool));

  async function fixture(eventCount = 1) {
    const client = browser(), account = await register(client), records = [];
    for (let index = 0; index < eventCount; index += 1) {
      const schoolApplicationId = randomUUID(), applicationSetId = randomUUID();
      const published = await publisher.publish(materializeSchoolApplicationStatusNotification({
        recipientUserId: account.userId,
        schoolApplicationId,
        applicationSetId,
        statusEventId: randomUUID(),
        status: index % 2 === 0 ? "waiting_for_documents" : "contacted",
        occurredAt: new Date(Date.now() + index),
      }));
      records.push({ ...published, schoolApplicationId, applicationSetId });
    }
    return { client, account, records };
  }

  await t.test("network notification list is private, paginated and redacted", async () => {
    const f = await fixture(2), other = await fixture();
    assert.equal((await send("/api/v1/notifications")).status, 403);

    const firstResponse = await f.client.send("/api/v1/notifications?limit=1");
    assert.equal(firstResponse.status, 200, await firstResponse.clone().text());
    assert.equal(firstResponse.headers.get("cache-control"), "no-store");
    assert.equal(firstResponse.headers.get("x-content-type-options"), "nosniff");
    assert.ok(firstResponse.headers.get("x-request-id"));
    assert.equal(firstResponse.headers.get("set-cookie"), null);
    const first = (await firstResponse.json()).data;
    assert.equal(first.items.length, 1);
    assert.equal(first.items[0].eventId, f.records[1].eventId);
    assert.equal(first.nextCursor, first.items[0].id);
    assert.deepEqual(Object.keys(first.items[0]).sort(), [
      "actionPath", "body", "createdAt", "eventId", "eventType", "id", "occurredAt", "revision", "status", "title", "topic",
    ].sort());
    assert.doesNotMatch(JSON.stringify(first), /eventKey|event_key|variables|template|recipientUser|audienceRole|tenantSchool|email/i);

    const second = (await (await f.client.send(`/api/v1/notifications?limit=1&cursor=${first.nextCursor}`)).json()).data;
    assert.equal(second.items.length, 1);
    assert.equal(second.items[0].eventId, f.records[0].eventId);
    assert.equal(second.nextCursor, null);
    const forged = (await (await f.client.send("/api/v1/notifications?userId=" + other.account.userId, {
      headers: { "x-user-id": other.account.userId, "x-role": "cuac_admin" },
    })).json()).error;
    assert.equal(forged.code, "BAD_REQUEST");
    const otherList = (await (await other.client.send("/api/v1/notifications")).json()).data;
    assert.deepEqual(otherList.items.map(item => item.eventId), [other.records[0].eventId]);
  });

  await t.test("network notification reads use optimistic revisions and preserve owner isolation", async () => {
    const f = await fixture(2), other = await fixture();
    const listed = (await (await f.client.send("/api/v1/notifications")).json()).data.items;
    const target = listed[0];
    const foreign = await other.client.send(`/api/v1/notifications/${target.id}/read`, {
      method: "PATCH", body: { expectedRevision: 0 }, headers: { "x-user-id": f.account.userId },
    });
    assert.equal(foreign.status, 404);
    const read = await f.client.send(`/api/v1/notifications/${target.id}/read`, { method: "PATCH", body: { expectedRevision: 0 } });
    assert.equal(read.status, 200, await read.clone().text());
    const readItem = (await read.json()).data;
    assert.deepEqual({ status: readItem.status, revision: readItem.revision }, { status: "read", revision: 1 });
    assert.equal((await f.client.send(`/api/v1/notifications/${target.id}/read`, { method: "PATCH", body: { expectedRevision: 0 } })).status, 409);
    const all = await f.client.send("/api/v1/notifications/read-all", { method: "PATCH", rawBody: "" });
    assert.equal(all.status, 200);
    assert.deepEqual((await all.json()).data, { changedCount: 1 });
    assert.equal((await f.client.send("/api/v1/notifications/read-all?userId=" + other.account.userId, {
      method: "PATCH", rawBody: "",
    })).status, 400);
  });

  await t.test("network notification preferences are role-bounded, versioned and atomic with audit", async () => {
    const f = await fixture();
    const defaultsResponse = await f.client.send("/api/v1/notifications/preferences");
    assert.equal(defaultsResponse.status, 200, await defaultsResponse.clone().text());
    const defaults = (await defaultsResponse.json()).data.preferences;
    assert.equal(defaults.length, 6);
    assert.deepEqual(defaults.find(item => item.topic === "application_updates"), {
      topic: "application_updates", inAppEnabled: true, emailEnabled: true, smsEnabled: false, revision: 0,
    });

    const body = { preferences: [{ topic: "application_updates", inAppEnabled: true,
      emailEnabled: false, smsEnabled: false, expectedRevision: 0 }] };
    const changed = await f.client.send("/api/v1/notifications/preferences", { method: "PUT", body });
    assert.equal(changed.status, 200, await changed.clone().text());
    assert.equal((await changed.json()).data.preferences[0].revision, 1);
    assert.equal((await f.client.send("/api/v1/notifications/preferences", { method: "PUT", body })).status, 409);
    assert.equal((await f.client.send("/api/v1/notifications/preferences", { method: "PUT", body: { preferences: [{
      topic: "account_security", inAppEnabled: false, emailEnabled: false, smsEnabled: false, expectedRevision: 0,
    }] } })).status, 400);
    assert.equal((await f.client.send("/api/v1/notifications/preferences", { method: "PUT", body: {
      ...body, userId: randomUUID(), role: "cuac_admin",
    } })).status, 400);
    assert.equal((await f.client.send("/api/v1/notifications/preferences", { method: "PUT", body, headers: {
      origin: "https://other.invalid",
    } })).status, 403);

    const faults = await createAuditFailureFixture(pool);
    try {
      const retry = { preferences: [{ ...body.preferences[0], emailEnabled: true, expectedRevision: 1 }] };
      const before = await snapshotAuditedBusinessTables(pool);
      await faults.during("notification.preference.update", async () => {
        const response = await f.client.send("/api/v1/notifications/preferences", { method: "PUT", body: retry });
        assert.equal(response.status, 500);
        assert.doesNotMatch(await response.text(), /Synthetic|notification_preferences|insert into|postgres/i);
      });
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      const retried = await f.client.send("/api/v1/notifications/preferences", { method: "PUT", body: retry });
      assert.equal(retried.status, 200);
      assert.equal((await retried.json()).data.preferences[0].revision, 2);
    } finally { await faults.close(); }
  });

  await t.test("network notification read rolls back when its audit cannot be stored", async () => {
    const f = await fixture(), item = (await (await f.client.send("/api/v1/notifications")).json()).data.items[0];
    const faults = await createAuditFailureFixture(pool);
    try {
      const before = await snapshotAuditedBusinessTables(pool);
      await faults.during("notification.read", async () => {
        const response = await f.client.send(`/api/v1/notifications/${item.id}/read`, { method: "PATCH", body: { expectedRevision: 0 } });
        assert.equal(response.status, 500);
        assert.doesNotMatch(await response.text(), /Synthetic|notification_deliveries|update |postgres/i);
      });
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      assert.equal((await f.client.send(`/api/v1/notifications/${item.id}/read`, {
        method: "PATCH", body: { expectedRevision: 0 },
      })).status, 200);
    } finally { await faults.close(); }
  });
}
