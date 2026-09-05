import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createNotificationHttpHandler } from "../../../src/server/notifications/http.ts";
import { secureApiRoute } from "../../../src/server/shared/http-boundary.ts";

const userId = "11111111-1111-4111-8111-111111111111";
const notificationId = "22222222-2222-4222-8222-222222222222";
const auth = { async findActiveSessionByTokenHash() { return { userId, selectedSurface: "student", activeRole: "student", tenantSchoolId: null,
  authStrength: "session", expiresAt: new Date(Date.now() + 60_000), revokedAt: null, accountStatus: "active" }; } };

test("notification HTTP derives persona and validates list query", async () => {
  let captured;
  const handler = createNotificationHttpHandler({ async list(context, input) { captured = { context, input }; return { items: [] }; } }, auth);
  const route = secureApiRoute("GET", request => handler(request, "list"));
  const request = query => new Request(`https://cuac.test/api/v1/notifications${query}`, { headers: {
    cookie: "cuac_session=synthetic", "x-user-id": "attacker", "x-role": "cuac_admin",
  } });
  const response = await route(request(`?limit=20&cursor=${notificationId}`));
  assert.equal(response.status, 200);
  assert.equal(captured.context.actorUserId, userId);
  assert.equal(captured.context.purpose, "notification_management");
  assert.deepEqual(captured.input, { limit: 20, cursor: notificationId });
  for (const query of ["?userId=x", "?limit=0", "?limit=1&limit=2", "?offset=1"]) assert.equal((await route(request(query))).status, 400);
});

test("notification HTTP mutations parse bodies and fail closed without service", async () => {
  const calls = [];
  const service = {
    async markRead(context, id, body) { calls.push(["read", context, id, body]); return { id }; },
    async markAllRead(context) { calls.push(["all", context]); return { changedCount: 1 }; },
    async getPreferences(context) { calls.push(["get", context]); return { preferences: [] }; },
    async updatePreferences(context, body) { calls.push(["put", context, body]); return { preferences: [] }; },
  };
  const handler = createNotificationHttpHandler(service, auth);
  const req = (path, method = "GET", body) => new Request(`https://cuac.test${path}`, { method, headers: {
    cookie: "cuac_session=synthetic", ...(body ? { "content-type": "application/json" } : {}),
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.equal((await handler(req(`/api/v1/notifications/${notificationId}/read`, "PATCH", { expectedRevision: 0 }), "markRead", notificationId)).status, 200);
  assert.equal((await handler(req("/api/v1/notifications/read-all", "PATCH"), "markAllRead")).status, 200);
  assert.equal((await handler(req("/api/v1/notifications/preferences"), "getPreferences")).status, 200);
  assert.equal((await handler(req("/api/v1/notifications/preferences", "PUT", { preferences: [] }), "updatePreferences")).status, 200);
  assert.deepEqual(calls.map(x => x[0]), ["read", "all", "get", "put"]);
  assert.equal((await createNotificationHttpHandler(undefined, auth)(req("/api/v1/notifications"), "list")).status, 503);
  assert.equal((await createNotificationHttpHandler()(req("/api/v1/notifications"), "list")).status, 403);
});

test("notification app routes stay thin and independent from static demo state", async () => {
  const paths = ["../../../app/api/v1/notifications/route.ts", "../../../app/api/v1/notifications/preferences/route.ts",
    "../../../app/api/v1/notifications/read-all/route.ts", "../../../app/api/v1/notifications/[notificationId]/read/route.ts"];
  const contents = await Promise.all(paths.map(path => readFile(new URL(path, import.meta.url), "utf8")));
  for (const source of contents) {
    assert.match(source, /getNotificationRouteHandler/);
    assert.doesNotMatch(source, /notifications\.js|localStorage|public\/|design-lab|select\s+\*/i);
  }
});
