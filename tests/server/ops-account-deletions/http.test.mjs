import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createOpsAccountDeletionHttpHandlers, SESSION_COOKIE_NAME } from "../../../src/server/index.ts";

const executionId = "11111111-1111-4111-8111-111111111111";
function fixture() { const calls = [], service = Object.fromEntries(["list", "refresh", "reviewLegalHold", "quarantine"].map(method =>
  [method, async (...args) => { calls.push({ method, args }); return { method }; }]));
  const auth = { async findActiveSessionByTokenHash() { return { userId: "22222222-2222-4222-8222-222222222222",
    selectedSurface: "ops", activeRole: "cuac_admin", tenantSchoolId: null, authStrength: "step_up",
    expiresAt: new Date("2027-01-01T00:00:00Z"), revokedAt: null, accountStatus: "active" }; },
    async findActiveCuacStaffAccessGrantByUserAndRole(userId, role) { return { userId, role, status: "approved",
      expiresAt: new Date("2027-01-01T00:00:00Z") }; } };
  return { calls, handlers: createOpsAccountDeletionHttpHandlers(service, auth) }; }
function request(path, method = "GET", body) { return new Request(`https://cuac.test${path}`, { method,
  headers: { cookie: `${SESSION_COOKIE_NAME}=token`, ...(body ? { "content-type": "application/json" } : {}) },
  body: body ? JSON.stringify(body) : undefined }); }

test("account-deletion HTTP binds purpose, route id and strict command bodies", async () => {
  const { calls, handlers } = fixture();
  assert.equal((await handlers.list(request("/api/v1/ops/account-deletions?limit=20"))).status, 200);
  assert.equal((await handlers.refresh(request("/refresh", "POST", { expectedRevision: 1 }), executionId)).status, 200);
  assert.equal((await handlers.reviewLegalHold(request("/review", "POST", { reviewId: executionId,
    expectedRevision: 1, result: "blocked", reasonCode: "legal_hold", caseReference: "LEGAL:1" }), executionId)).status, 200);
  assert.equal((await handlers.quarantine(request("/quarantine", "POST", { quarantineId: executionId,
    expectedRevision: 2 }), executionId)).status, 200);
  assert.deepEqual(calls.map(call => call.method), ["list", "refresh", "reviewLegalHold", "quarantine"]);
  assert.equal(calls.every(call => call.args[0].purpose === "account_deletion_execution"), true);
  const invalid = fixture();
  assert.equal((await invalid.handlers.refresh(request("/refresh", "POST", { expectedRevision: 1, actorUserId: "forged" }), executionId)).status, 400);
  assert.deepEqual(invalid.calls, []);
});

test("account-deletion routes are secure thin adapters", async () => {
  const routes = ["../../../app/api/v1/ops/account-deletions/route.ts",
    "../../../app/api/v1/ops/account-deletions/[executionId]/refresh/route.ts",
    "../../../app/api/v1/ops/account-deletions/[executionId]/legal-hold-review/route.ts",
    "../../../app/api/v1/ops/account-deletions/[executionId]/quarantine/route.ts"];
  for (const [index, path] of routes.entries()) { const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /secureApiRoute\(/); if (index) assert.match(source, /requireRouteUuid\(/);
    assert.doesNotMatch(source, /select |insert |update |delete from/i); }
});
