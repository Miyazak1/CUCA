import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createOpsRoutingReviewHttpHandlers, OpsRoutingReviewService,
  SESSION_COOKIE_NAME } from "../../../src/server/index.ts";

const outboxId = "11111111-1111-4111-8111-111111111111";

function fixture({ grant = true, realService = false } = {}) {
  const calls = [];
  const methods = ["listQuarantinedDeliveries", "claimReview", "escalateReview", "closeReview", "approveRetry"];
  const stub = Object.fromEntries(methods.map(method => [method,
    async (...args) => { calls.push({ method, args }); return { method }; }]));
  const repository = {
    async listQuarantinedDeliveries(input) { calls.push({ method: "repository.list", input });
      return { authorized: true, cursorFound: true, rows: [] }; },
    async claimReview() { throw new Error("unexpected repository call"); },
    async escalateReview() { throw new Error("unexpected repository call"); },
    async closeReview() { throw new Error("unexpected repository call"); },
    async approveRetry() { throw new Error("unexpected repository call"); },
  };
  const service = realService ? new OpsRoutingReviewService(repository, { async record() {} }) : stub;
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
  return { calls, handlers: createOpsRoutingReviewHttpHandlers(service, auth) };
}

function request(path, method = "GET", body) {
  return new Request(`https://cuac.test${path}`, { method,
    headers: { cookie: `${SESSION_COOKIE_NAME}=ops-token`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined });
}

test("routing review HTTP maps strict queue and route-bound workflow commands", async () => {
  const { calls, handlers } = fixture();
  assert.equal((await handlers.list(request(`/api/v1/ops/routing/submissions?cursor=${outboxId}&limit=5`))).status, 200);
  assert.equal((await handlers.claim(request("/claim", "POST", { expectedRevision: 0 }), outboxId)).status, 200);
  assert.equal((await handlers.escalate(request("/escalate", "POST", { expectedRevision: 1,
    code: "delivery_attempts_exhausted", reference: "CASE:42" }), outboxId)).status, 200);
  assert.equal((await handlers.close(request("/close", "POST", { expectedRevision: 2,
    code: "duplicate_risk_unresolved_no_retry", reference: "CASE:42" }), outboxId)).status, 200);
  assert.equal((await handlers.retry(request("/retry", "POST", { expectedRevision: 1,
    code: "provider_not_accepted_retry_approved", reference: "CASE:43" }), outboxId)).status, 200);
  assert.deepEqual(calls.map(call => call.method), ["listQuarantinedDeliveries", "claimReview",
    "escalateReview", "closeReview", "approveRetry"]);
  assert.deepEqual(calls[0].args[1], { cursor: outboxId, limit: 5 });
  assert.equal(calls.every(call => call.args[0].purpose === "routing_review"), true);
});

test("routing review HTTP rejects query ambiguity and body authority before service access", async () => {
  for (const query of ["?limit=01", "?limit=2&limit=3", "?status=quarantined"]) {
    const { calls, handlers } = fixture();
    assert.equal((await handlers.list(request(`/api/v1/ops/routing/submissions${query}`))).status, 400);
    assert.deepEqual(calls, []);
  }
  const malformed = fixture({ realService: true });
  assert.equal((await malformed.handlers.list(request("/api/v1/ops/routing/submissions?cursor=bad"))).status, 400);
  assert.deepEqual(malformed.calls, []);
  const { calls, handlers } = fixture();
  assert.equal((await handlers.claim(request("/claim", "POST",
    { expectedRevision: 0, payloadSha256: "forged" }), outboxId)).status, 400);
  assert.equal((await handlers.retry(request("/retry", "POST", { expectedRevision: 1,
    code: "provider_not_accepted_retry_approved", reference: "CASE:1", activeRole: "cuac_admin" }), outboxId)).status, 400);
  assert.deepEqual(calls, []);
});

test("routing review HTTP degrades absent live staff authority before service access", async () => {
  const { calls, handlers } = fixture({ grant: false, realService: true });
  assert.equal((await handlers.list(request("/api/v1/ops/routing/submissions"))).status, 403);
  assert.deepEqual(calls, []);
});

test("routing review routes are thin secure adapters and Agent remains disconnected", async () => {
  const routes = [
    "../../../app/api/v1/ops/routing/submissions/route.ts",
    "../../../app/api/v1/ops/routing/submissions/[outboxId]/review-claim/route.ts",
    "../../../app/api/v1/ops/routing/submissions/[outboxId]/review-escalation/route.ts",
    "../../../app/api/v1/ops/routing/submissions/[outboxId]/review-close/route.ts",
    "../../../app/api/v1/ops/routing/submissions/[outboxId]/review-retry/route.ts",
  ];
  for (const [index, path] of routes.entries()) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /secureApiRoute\(/);
    if (index > 0) assert.match(source, /requireRouteUuid\(/);
    assert.doesNotMatch(source, /select |insert |update |delete from|payloadSha256|providerName|Agent/i);
  }
});
