import assert from "node:assert/strict";
import test from "node:test";
import { createOpsApplicationSupportHttpHandlers, OpsApplicationSupportService, SESSION_COOKIE_NAME } from "../../../src/server/index.ts";

const cuacId = "CUAC-2026-004218";
const supportSessionId = "55555555-5555-4555-8555-555555555555";

function fixture(grant = true) {
  const calls = [];
  const session = { supportSessionId, cuacId, reasonCode: "student_inquiry", createdAt: new Date(1), expiresAt: new Date("2026-09-29T00:00:00Z") };
  const service = new OpsApplicationSupportService({
    async openApplicationSupportSession(input) { calls.push({ method: "open", input }); return { authorized: true, targetFound: true, session }; },
    async resolveApplicationSupportSession(input) { calls.push({ method: "resolve", input }); return { authorized: true, session: { ...session, applicationSetId: "set-1" } }; },
    async closeApplicationSupportSession(input) { calls.push({ method: "close", input }); return { authorized: true, closedAt: new Date(2) }; },
    async findApplicationSupportByCuacId(value) {
      calls.push({ method: "find", cuacId: value });
      return { cuacId: value, applicationSet: {}, submission: null, programApplications: [] };
    },
  }, { async record(event) { calls.push({ method: "audit", event }); } });
  const auth = {
    async findActiveSessionByTokenHash() {
      return { userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", selectedSurface: "ops", activeRole: "cuac_ops",
        tenantSchoolId: null, authStrength: "session", expiresAt: new Date("2026-09-29T00:00:00Z"),
        revokedAt: null, accountStatus: "active" };
    },
    async findActiveCuacStaffAccessGrantByUserAndRole(userId, role) {
      return grant ? { userId, role, status: "approved", expiresAt: new Date("2026-09-29T00:00:00Z") } : null;
    },
  };
  return { calls, handlers: createOpsApplicationSupportHttpHandlers(service, auth) };
}

function request(path, body) {
  return new Request(`https://cuac.test${path}`, { method: "POST",
    headers: { cookie: `${SESSION_COOKIE_NAME}=ops-token`, "content-type": "application/json" }, body: JSON.stringify(body) });
}

test("Ops support HTTP opens a bounded session then looks up by session id only", async () => {
  const { calls, handlers } = fixture();
  const opened = await handlers.openSupportSession(request("/api/v1/ops/support-sessions", { cuacId, reasonCode: "student_inquiry" }));
  assert.equal(opened.status, 200);
  assert.equal((await opened.json()).data.supportSessionId, supportSessionId);
  const lookup = await handlers.lookupApplication(request("/api/v1/ops/application-lookups", { supportSessionId }));
  assert.equal(lookup.status, 200);
  assert.equal((await lookup.json()).data.cuacId, cuacId);
  assert.deepEqual(calls.filter(call => call.method !== "audit").map(call => call.method), ["open", "resolve", "find"]);
});

test("Ops support HTTP rejects URL query, direct CUAC lookup and client authority before repository access", async () => {
  for (const [path, body] of [
    ["/api/v1/ops/support-sessions?userId=student-1", { cuacId, reasonCode: "student_inquiry" }],
    ["/api/v1/ops/application-lookups?cuacId=" + cuacId, { supportSessionId }],
    ["/api/v1/ops/application-lookups", { cuacId, reasonCode: "student_inquiry" }],
    ["/api/v1/ops/application-lookups", { supportSessionId, role: "cuac_admin" }],
  ]) {
    const { calls, handlers } = fixture();
    const handler = path.includes("support-sessions") ? handlers.openSupportSession : handlers.lookupApplication;
    const response = await handler(request(path, body));
    assert.equal(response.status, 400);
    assert.deepEqual(calls, []);
  }
});

test("Ops support HTTP closes an owned support session", async () => {
  const { calls, handlers } = fixture();
  const response = await handlers.closeSupportSession(new Request(
    `https://cuac.test/api/v1/ops/support-sessions/${supportSessionId}`,
    { method: "DELETE", headers: { cookie: `${SESSION_COOKIE_NAME}=ops-token` } },
  ), supportSessionId);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.closed, true);
  assert.deepEqual(calls.filter(call => call.method !== "audit").map(call => call.method), ["close"]);
});

test("Ops support HTTP degrades an Ops session without an active staff grant", async () => {
  const { calls, handlers } = fixture(false);
  const response = await handlers.openSupportSession(request("/api/v1/ops/support-sessions", { cuacId, reasonCode: "incident_response" }));
  assert.equal(response.status, 403);
  assert.deepEqual(calls, []);
});

test("Ops support HTTP rejects a guest before support session access", async () => {
  const { calls, handlers } = fixture();
  const response = await handlers.lookupApplication(new Request("https://cuac.test/api/v1/ops/application-lookups", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ supportSessionId }),
  }));
  assert.equal(response.status, 403);
  assert.deepEqual(calls, []);
});
