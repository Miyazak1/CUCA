import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createSchoolCatalogCorrectionHttpHandlers, SESSION_COOKIE_NAME } from "../../../src/server/index.ts";

const schoolId = "11111111-1111-4111-8111-111111111111";
const actorId = "22222222-2222-4222-8222-222222222222";
const correctionId = "33333333-3333-4333-8333-333333333333";

function fixture(role = "school_staff") {
  const calls = [];
  const service = Object.fromEntries(["listForSchool", "submit", "listForOps", "claim", "resolve"].map(method =>
    [method, async (...args) => { calls.push({ method, args }); return { method }; }]));
  const auth = {
    async findActiveSessionByTokenHash() {
      return { userId: actorId, selectedSurface: role === "school_staff" ? "school" : "ops", activeRole: role,
        tenantSchoolId: role === "school_staff" ? schoolId : null, authStrength: role === "cuac_admin" ? "step_up" : "session",
        expiresAt: new Date("2027-01-01T00:00:00Z"), revokedAt: null, accountStatus: "active" };
    },
    async findActiveSchoolMembershipByUserAndSchoolId(userId, tenantSchoolId) {
      return { userId, schoolId: tenantSchoolId, role: "school_admin", status: "active" };
    },
    async findActiveCuacStaffAccessGrantByUserAndRole(userId, activeRole) {
      return { userId, role: activeRole, status: "approved", expiresAt: new Date("2027-01-01T00:00:00Z") };
    },
  };
  return { calls, handlers: createSchoolCatalogCorrectionHttpHandlers(service, auth, auth) };
}
function request(path, method = "GET", body) {
  return new Request(`https://cuac.test${path}`, { method,
    headers: { cookie: `${SESSION_COOKIE_NAME}=token`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined });
}

test("HTTP handlers bind school and Ops routes to distinct request purposes", async () => {
  const school = fixture();
  assert.equal((await school.handlers.listForSchool(request("/api/v1/school/catalog-corrections"))).status, 200);
  assert.equal((await school.handlers.submit(request("/api/v1/school/catalog-corrections", "POST", {
    sourceSchoolUpdatedAt: "2026-09-03T00:00:00.000Z", changes: { websiteUrl: "https://example.edu/" },
    evidenceUrl: "https://example.edu/notice", reasonCode: "official_website_changed",
  }))).status, 200);
  assert.equal(school.calls.every(call => call.args[0].purpose === "school_catalog_correction"), true);

  const ops = fixture("cuac_ops");
  assert.equal((await ops.handlers.listForOps(request("/api/v1/ops/catalog-corrections?status=submitted&limit=20"))).status, 200);
  assert.equal((await ops.handlers.claim(request("/claim", "POST", { expectedRevision: 1 }), correctionId)).status, 200);
  assert.equal(ops.calls.every(call => call.args[0].purpose === "catalog_correction_review"), true);
});

test("HTTP handlers reject ambiguous queries and invalid JSON before service access", async () => {
  for (const query of ["?limit=0", "?limit=01", "?limit=2&limit=3", "?unknown=x"]) {
    const current = fixture("cuac_ops");
    assert.equal((await current.handlers.listForOps(request(`/api/v1/ops/catalog-corrections${query}`))).status, 400);
    assert.deepEqual(current.calls, []);
  }
  const current = fixture();
  const bad = new Request("https://cuac.test/api/v1/school/catalog-corrections", {
    method: "POST", headers: { cookie: `${SESSION_COOKIE_NAME}=token`, "content-type": "application/json" }, body: "{" });
  assert.equal((await current.handlers.submit(bad)).status, 400);
  assert.deepEqual(current.calls, []);
});

test("catalog correction routes are secure thin adapters", async () => {
  const routes = [
    "../../../app/api/v1/school/catalog-corrections/route.ts",
    "../../../app/api/v1/ops/catalog-corrections/route.ts",
    "../../../app/api/v1/ops/catalog-corrections/[correctionId]/claim/route.ts",
    "../../../app/api/v1/ops/catalog-corrections/[correctionId]/resolution/route.ts",
  ];
  for (const [index, path] of routes.entries()) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /secureApiRoute\(/);
    if (index > 1) assert.match(source, /requireRouteUuid\(/);
    assert.doesNotMatch(source, /select |insert |update |delete from|Agent/i);
  }
});
