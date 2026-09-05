import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createRequirementGovernanceHttpHandlers, SESSION_COOKIE_NAME } from "../../../src/server/index.ts";

const programId = randomUUID(), intakeId = randomUUID(), versionId = randomUUID();

function fixture({ role = "cuac_admin", authStrength = "step_up", grant = true } = {}) {
  const calls = [];
  const service = Object.fromEntries(["getVersion", "listVersions", "createDraft", "approve", "publish", "withdraw"].map(method => [method,
    async (...args) => { calls.push({ method, args }); return { method }; }]));
  const auth = {
    async findActiveSessionByTokenHash() {
      return { userId: randomUUID(), selectedSurface: "ops", activeRole: role, tenantSchoolId: null, authStrength,
        expiresAt: new Date("2026-09-29T00:00:00Z"), revokedAt: null, accountStatus: "active" };
    },
    async findActiveCuacStaffAccessGrantByUserAndRole(userId, activeRole) {
      return grant ? { userId, role: activeRole, status: "approved", expiresAt: new Date("2026-09-29T00:00:00Z") } : null;
    },
  };
  return { calls, handlers: createRequirementGovernanceHttpHandlers(service, auth) };
}

function request(path, { method = "GET", body } = {}) {
  return new Request(`https://cuac.test${path}`, {
    method,
    headers: { cookie: `${SESSION_COOKIE_NAME}=ops-token`, ...(method === "GET" ? {} : { "content-type": "application/json" }) },
    body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
  });
}

test("requirement governance HTTP binds scope to routes and exposes each reviewed lifecycle command", async () => {
  const { calls, handlers } = fixture();
  const base = `/api/v1/ops/catalog/programs/${programId}/intakes/${intakeId}/requirements`;
  assert.equal((await handlers.listVersions(request(`${base}?beforeVersion=12&limit=5`), programId, intakeId)).status, 200);
  assert.equal((await handlers.createDraft(request(base, { method: "POST", body: { versionId, document: {} } }), programId, intakeId)).status, 201);
  assert.equal((await handlers.getVersion(request(`${base}/${versionId}`), programId, intakeId, versionId)).status, 200);
  assert.equal((await handlers.approve(request(`${base}/${versionId}/approval`, { method: "POST", body: {
    expectedContentSha256: "a".repeat(64), effectiveFrom: null, reviewDueAt: "2027-01-01T00:00:00.000Z",
    sourceChecks: [], scopeConfirmed: true, publicContentConfirmed: true,
  } }), programId, intakeId, versionId)).status, 200);
  assert.equal((await handlers.publish(request(`${base}/${versionId}/publication`, { method: "PUT", body: {
    expectedContentSha256: "a".repeat(64), expectedApprovalSha256: "b".repeat(64), expectedPublicationRevision: 0,
  } }), programId, intakeId, versionId)).status, 200);
  assert.equal((await handlers.withdraw(request(`${base}/${versionId}/withdrawal`, { method: "POST", body: {
    expectedPublicationRevision: 1, reason: "review_required",
  } }), programId, intakeId, versionId)).status, 200);

  assert.deepEqual(calls.map(call => call.method), ["listVersions", "createDraft", "getVersion", "approve", "publish", "withdraw"]);
  assert.deepEqual(calls[0].args.slice(1), [programId, intakeId, { beforeVersion: 12, limit: 5 }]);
  assert.equal(calls[1].args[3].versionId, versionId);
  assert.equal(calls[3].args[3].versionId, versionId);
  assert.equal(calls[4].args[3].versionId, versionId);
  assert.equal(calls[5].args[3].expectedVersionId, versionId);
  assert.ok(calls.every(call => call.args[0].purpose === "catalog_management" && call.args[0].selectedSurface === "ops"));
});

test("requirement governance HTTP rejects query ambiguity and body authority before service access", async () => {
  const base = `/api/v1/ops/catalog/programs/${programId}/intakes/${intakeId}/requirements`;
  for (const query of ["?limit=01", "?limit=2&limit=3", "?offset=1", "?beforeVersion=0"]) {
    const { calls, handlers } = fixture();
    assert.equal((await handlers.listVersions(request(`${base}${query}`), programId, intakeId)).status, 400);
    assert.deepEqual(calls, []);
  }
  for (const [name, suffix, method, body] of [
    ["createDraft", "", "POST", { versionId, document: {}, actorUserId: randomUUID() }],
    ["approve", `/${versionId}/approval`, "POST", { versionId, expectedContentSha256: "a".repeat(64) }],
    ["publish", `/${versionId}/publication`, "PUT", { expectedVersionId: versionId }],
    ["withdraw", `/${versionId}/withdrawal`, "POST", { userId: randomUUID() }],
  ]) {
    const { calls, handlers } = fixture();
    const response = await handlers[name](request(`${base}${suffix}`, { method, body }), programId, intakeId, ...(name === "createDraft" ? [] : [versionId]));
    assert.equal(response.status, 400);
    assert.deepEqual(calls, []);
  }
  const { calls, handlers } = fixture();
  assert.equal((await handlers.getVersion(request(`${base}/${versionId}?include=private`), programId, intakeId, versionId)).status, 400);
  assert.deepEqual(calls, []);
});

test("requirement governance HTTP resolves missing staff grants as guest authority", async () => {
  const { calls, handlers } = fixture({ grant: false });
  const response = await handlers.listVersions(request(`/api/v1/ops/catalog/programs/${programId}/intakes/${intakeId}/requirements`),
    programId, intakeId);
  assert.equal(response.status, 200, "HTTP only resolves identity; domain policy owns authorization");
  assert.equal(calls[0].args[0].activeRole, "guest");
  assert.equal(calls[0].args[0].actorUserId, null);
});

test("requirement governance route files are thin secure adapters and Agent remains disconnected", async () => {
  const routes = [
    "../../../app/api/v1/ops/catalog/programs/[programId]/intakes/[intakeId]/requirements/route.ts",
    "../../../app/api/v1/ops/catalog/programs/[programId]/intakes/[intakeId]/requirements/[versionId]/route.ts",
    "../../../app/api/v1/ops/catalog/programs/[programId]/intakes/[intakeId]/requirements/[versionId]/approval/route.ts",
    "../../../app/api/v1/ops/catalog/programs/[programId]/intakes/[intakeId]/requirements/[versionId]/publication/route.ts",
    "../../../app/api/v1/ops/catalog/programs/[programId]/intakes/[intakeId]/requirements/[versionId]/withdrawal/route.ts",
  ];
  for (const path of routes) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /secureApiRoute\(/);
    assert.match(source, /requireRouteUuid\(/);
    assert.doesNotMatch(source, /select |insert |update |delete from|requirementDocument|Agent/i);
  }
});
