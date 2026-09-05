import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createOpsDataQualityHttpHandlers, OpsDataQualityService,
  SESSION_COOKIE_NAME } from "../../../src/server/index.ts";

const entityId = "11111111-1111-4111-8111-111111111111";

function fixture({ grant = true, realService = false } = {}) {
  const calls = [], methods = ["listCandidates", "claimReview", "escalateReview", "resolveReview"];
  const stub = Object.fromEntries(methods.map(method => [method,
    async (...args) => { calls.push({ method, args }); return { method }; }]));
  const repository = {
    async listCandidates(input) { calls.push({ method: "repository.list", input });
      return { authorized: true, cursorFound: true, rows: [] }; },
    async claimReview() { throw new Error("unexpected repository call"); },
    async escalateReview() { throw new Error("unexpected repository call"); },
    async resolveReview() { throw new Error("unexpected repository call"); },
  };
  const service = realService ? new OpsDataQualityService(repository, { async record() {} }) : stub;
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
  return { calls, handlers: createOpsDataQualityHttpHandlers(service, auth) };
}

function request(path, method = "GET", body) {
  return new Request(`https://cuac.test${path}`, { method,
    headers: { cookie: `${SESSION_COOKIE_NAME}=ops-token`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined });
}

test("data-quality HTTP maps strict cursor and route-bound workflow commands", async () => {
  const { calls, handlers } = fixture();
  assert.equal((await handlers.list(request(
    `/api/v1/ops/data-quality/catalog?cursorType=program&cursor=${entityId}&limit=5`))).status, 200);
  assert.equal((await handlers.claim(request("/claim", "POST", { expectedRevision: 0 }), "program", entityId)).status, 200);
  assert.equal((await handlers.escalate(request("/escalate", "POST", { expectedRevision: 1,
    code: "conflicting_official_sources", reference: "CASE:42" }), "program", entityId)).status, 200);
  assert.equal((await handlers.resolve(request("/resolve", "POST", { expectedRevision: 2,
    code: "source_invalid", reference: "CASE:42" }), "program", entityId)).status, 200);
  assert.deepEqual(calls.map(call => call.method), ["listCandidates", "claimReview", "escalateReview", "resolveReview"]);
  assert.deepEqual(calls[0].args[1], { cursorType: "program", cursor: entityId, limit: 5 });
  assert.equal(calls.every(call => call.args[0].purpose === "data_quality_review"), true);
});

test("data-quality HTTP rejects cursor ambiguity and body authority before service access", async () => {
  for (const query of ["?limit=01", "?limit=2&limit=3", "?cursorType=program", `?cursor=${entityId}`,
    "?status=stale"]) {
    const current = fixture({ realService: query.includes("cursor") });
    assert.equal((await current.handlers.list(request(`/api/v1/ops/data-quality/catalog${query}`))).status, 400);
    assert.deepEqual(current.calls, []);
  }
  const { calls, handlers } = fixture();
  assert.equal((await handlers.claim(request("/claim", "POST",
    { expectedRevision: 0, actorUserId: "forged" }), "program", entityId)).status, 400);
  assert.equal((await handlers.resolve(request("/resolve", "POST", { expectedRevision: 1,
    code: "source_invalid", reference: "CASE:1", activeRole: "cuac_admin" }), "program", entityId)).status, 400);
  assert.deepEqual(calls, []);
});

test("data-quality HTTP degrades absent live staff authority before service access", async () => {
  const { calls, handlers } = fixture({ grant: false, realService: true });
  assert.equal((await handlers.list(request("/api/v1/ops/data-quality/catalog"))).status, 403);
  assert.deepEqual(calls, []);
});

test("data-quality routes are secure thin adapters and Agent remains disconnected", async () => {
  const routes = [
    "../../../app/api/v1/ops/data-quality/catalog/route.ts",
    "../../../app/api/v1/ops/data-quality/catalog/[entityType]/[entityId]/review-claim/route.ts",
    "../../../app/api/v1/ops/data-quality/catalog/[entityType]/[entityId]/review-escalation/route.ts",
    "../../../app/api/v1/ops/data-quality/catalog/[entityType]/[entityId]/review-resolution/route.ts",
  ];
  for (const [index, path] of routes.entries()) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /secureApiRoute\(/);
    if (index > 0) assert.match(source, /requireRouteUuid\(/);
    assert.doesNotMatch(source, /select |insert |update |delete from|sourceNote|metadataJson|Agent/i);
  }
});
