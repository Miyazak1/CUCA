import assert from "node:assert/strict";
import test from "node:test";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { NotificationService } from "../../../src/server/notifications/service.ts";

const userId = "11111111-1111-4111-8111-111111111111";
const notificationId = "22222222-2222-4222-8222-222222222222";
const eventId = "33333333-3333-4333-8333-333333333333";
const context = createRequestContext({ actorUserId: userId, activeRole: "student", selectedSurface: "student", purpose: "notification_management", authStrength: "session" });

function fixture(rows = []) {
  const calls = [], audits = [];
  const repository = {
    async list(...args) { calls.push(["list", ...args]); return rows; },
    async markRead(...args) { calls.push(["markRead", ...args]); return { changed: true, item: { ...rows[0], status: "read", revision: 1 } }; },
    async markAllRead(...args) { calls.push(["markAllRead", ...args]); return { changedCount: 2 }; },
    async getPreferences(...args) { calls.push(["getPreferences", ...args]); return []; },
    async updatePreferences(...args) { calls.push(["updatePreferences", ...args]); return args[1].map(x => ({ ...x, revision: 1 })); },
  };
  return { calls, audits, service: new NotificationService(repository, { async record(event) { audits.push(event); } }) };
}

const row = { id: notificationId, eventId, topic: "application_updates", eventType: "school_application_updated", title: "Updated",
  body: "Safe body", actionPath: "/application.html", status: "unread", revision: 0,
  occurredAt: new Date("2026-09-02T00:00:00.000Z"), createdAt: new Date("2026-09-02T00:00:01.000Z") };

test("notification service isolates current persona before repository access", async () => {
  const { service, calls } = fixture([row]);
  for (const change of [{ actorUserId: null }, { activeRole: "guest" }, { activeRole: "school_staff" }, { selectedSurface: "public" },
    { selectedSurface: "ops" }, { purpose: "student_action" }, { tenantSchoolId: userId }, { authStrength: "guest" }, { dataClassAllowlist: [] }]) {
    await assert.rejects(service.list({ ...context, ...change }), error => error.status === 403);
  }
  assert.deepEqual(calls, []);
});

test("notification listing is bounded, cursor based and metadata-only audited", async () => {
  const { service, calls, audits } = fixture([row, { ...row, id: eventId }]);
  const result = await service.list(context, { limit: 1, cursor: notificationId.toUpperCase() });
  assert.deepEqual(result, { items: [row], nextCursor: notificationId });
  assert.deepEqual(calls[0], ["list", { userId, role: "student", tenantSchoolId: null }, 2, notificationId]);
  assert.deepEqual(audits[0].metadata, { count: 1 });
  assert.doesNotMatch(JSON.stringify(audits), /Safe body|Updated/);
  for (const input of [null, [], { userId }, { limit: 0 }, { limit: 101 }, { cursor: "bad" }, { offset: 1 }]) {
    await assert.rejects(service.list(context, input), error => error.status === 400);
  }
});

test("read and read-all use only the authenticated persona and record changed metadata", async () => {
  const { service, calls, audits } = fixture([row]);
  assert.equal((await service.markRead(context, notificationId, { expectedRevision: 0 })).status, "read");
  assert.deepEqual(await service.markAllRead(context), { changedCount: 2 });
  assert.equal(calls[0][1].userId, userId);
  assert.equal(calls[0][2], notificationId);
  assert.deepEqual(audits.map(event => event.action), ["notification.read", "notification.read_all"]);
  for (const input of [{}, { expectedRevision: "0" }, { expectedRevision: -1 }, { expectedRevision: 0, actorUserId: userId }]) {
    await assert.rejects(service.markRead(context, notificationId, input), error => error.status === 400);
  }
});

test("preference API returns role defaults and enforces topic and security boundaries", async () => {
  const { service, calls, audits } = fixture();
  const defaults = await service.getPreferences(context);
  assert.equal(defaults.preferences.length, 6);
  assert.deepEqual(defaults.preferences.find(x => x.topic === "account_security"), {
    topic: "account_security", revision: 0, inAppEnabled: true, emailEnabled: true, smsEnabled: false,
  });
  const input = { preferences: [{ topic: "application_updates", inAppEnabled: true, emailEnabled: false, smsEnabled: false, expectedRevision: 0 }] };
  const result = await service.updatePreferences(context, input);
  assert.equal(result.preferences[0].revision, 1);
  assert.equal(calls.at(-1)[1].role, "student");
  assert.deepEqual(audits.map(event => event.action), ["notification.preference.list", "notification.preference.update"]);
  for (const invalid of [
    { preferences: [{ ...input.preferences[0], topic: "platform_operations" }] },
    { preferences: [{ topic: "account_security", inAppEnabled: false, emailEnabled: true, smsEnabled: false, expectedRevision: 0 }] },
    { preferences: [input.preferences[0], input.preferences[0]] },
    { preferences: [{ ...input.preferences[0], tenantSchoolId: userId }] },
  ]) await assert.rejects(service.updatePreferences(context, invalid), error => [400, 503].includes(error.status));
});
