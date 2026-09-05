import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createOpsBillingReviewHttpHandlers, OpsBillingReviewService, SESSION_COOKIE_NAME } from "../../../src/server/index.ts";

const eventId = "11111111-1111-4111-8111-111111111111";

function fixture({ grant = true, realService = false } = {}) {
  const calls = [];
  const stub = Object.fromEntries(["listQuarantinedEvents", "claimReview", "escalateReview", "resolveReview"].map(method => [method,
    async (...args) => { calls.push({ method, args }); return { method }; }]));
  const repository = {
    async listQuarantinedEvents(input) { calls.push({ method: "repository.list", input });
      return { authorized: true, cursorFound: true, rows: [] }; },
    async claimReview() { throw new Error("unexpected repository call"); },
    async escalateReview() { throw new Error("unexpected repository call"); },
    async resolveReview() { throw new Error("unexpected repository call"); },
  };
  const service = realService ? new OpsBillingReviewService(repository, { async record() {} }) : stub;
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
  return { calls, handlers: createOpsBillingReviewHttpHandlers(service, auth) };
}

function request(path, method = "GET", body) {
  return new Request(`https://cuac.test${path}`, { method,
    headers: { cookie: `${SESSION_COOKIE_NAME}=ops-token`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined });
}

test("billing review HTTP maps strict queue and route-bound workflow commands", async () => {
  const { calls, handlers } = fixture();
  assert.equal((await handlers.list(request(`/api/v1/ops/billing/provider-events?cursor=${eventId}&limit=5`))).status, 200);
  assert.equal((await handlers.claim(request("/claim", "POST", { expectedRevision: 0 }), eventId)).status, 200);
  assert.equal((await handlers.escalate(request("/escalate", "POST", { expectedRevision: 1,
    code: "provider_investigation_required", reference: "CASE:42" }), eventId)).status, 200);
  assert.equal((await handlers.resolve(request("/resolve", "POST", { expectedRevision: 2,
    code: "provider_confirmed_no_change", reference: "CASE:42" }), eventId)).status, 200);
  assert.deepEqual(calls.map(call => call.method), ["listQuarantinedEvents", "claimReview", "escalateReview", "resolveReview"]);
  assert.deepEqual(calls[0].args[1], { cursor: eventId, limit: 5 });
  assert.equal(calls.slice(1).every(call => call.args[1] === eventId), true);
  assert.equal(calls.every(call => call.args[0].purpose === "billing_review"), true);
});

test("billing review HTTP rejects query ambiguity and body authority before service access", async () => {
  for (const query of ["?limit=01", "?limit=2&limit=3", "?state=quarantined"]) {
    const { calls, handlers } = fixture();
    assert.equal((await handlers.list(request(`/api/v1/ops/billing/provider-events${query}`))).status, 400);
    assert.deepEqual(calls, []);
  }
  const malformedCursor = fixture({ realService: true });
  assert.equal((await malformedCursor.handlers.list(request("/api/v1/ops/billing/provider-events?cursor=not-a-uuid"))).status, 400);
  assert.deepEqual(malformedCursor.calls, []);
  const { calls, handlers } = fixture();
  assert.equal((await handlers.claim(request("/claim", "POST", { expectedRevision: 0, paymentStatus: "succeeded" }), eventId)).status, 400);
  assert.equal((await handlers.resolve(request("/resolve", "POST", { expectedRevision: 1,
    code: "invalid_event_no_change", reference: "CASE:1", activeRole: "cuac_admin" }), eventId)).status, 400);
  assert.deepEqual(calls, []);
});

test("billing review HTTP degrades absent live staff authority before service access", async () => {
  const { calls, handlers } = fixture({ grant: false, realService: true });
  assert.equal((await handlers.list(request("/api/v1/ops/billing/provider-events"))).status, 403);
  assert.deepEqual(calls, []);
});

test("billing review route files are thin secure adapters and Agent remains disconnected", async () => {
  const routes = [
    "../../../app/api/v1/ops/billing/provider-events/route.ts",
    "../../../app/api/v1/ops/billing/provider-events/[eventId]/review-claim/route.ts",
    "../../../app/api/v1/ops/billing/provider-events/[eventId]/review-escalation/route.ts",
    "../../../app/api/v1/ops/billing/provider-events/[eventId]/review-resolution/route.ts",
  ];
  for (const [index, path] of routes.entries()) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /secureApiRoute\(/);
    if (index > 0) assert.match(source, /requireRouteUuid\(/);
    assert.doesNotMatch(source, /select |insert |update |delete from|providerPaymentId|payloadSha256|Agent/i);
  }
});
