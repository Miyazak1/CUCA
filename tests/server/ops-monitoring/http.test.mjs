import assert from "node:assert/strict";
import test from "node:test";
import {
  createOpsOperationsMonitoringHttpHandlers,
  OPS_OPERATIONS_METRIC_REGISTRY,
  OpsOperationsMonitoringService,
  SESSION_COOKIE_NAME,
} from "../../../src/server/index.ts";

function fixture({ activeGrant = true } = {}) {
  const calls = [];
  const generatedAt = new Date("2026-09-03T00:00:00Z");
  const rows = OPS_OPERATIONS_METRIC_REGISTRY.map(({ queueKey }) => ({
    queueKey,
    generatedAt,
    exceptionWindowStartedAt: new Date("2026-09-02T00:00:00Z"),
    dueCount: 0,
    inFlightCount: 0,
    expiredLeaseCount: 0,
    exceptionsLast24Hours: 0,
    oldestDueAt: null,
  }));
  const service = new OpsOperationsMonitoringService({
    async readOperationsSummary(input) { calls.push({ method: "summary", input }); return { authorized: true, rows }; },
  }, { async record(event) { calls.push({ method: "audit", event }); } });
  const auth = {
    async findActiveSessionByTokenHash() {
      return { userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", selectedSurface: "ops", activeRole: "cuac_ops",
        tenantSchoolId: null, authStrength: "session", expiresAt: new Date("2026-09-29T00:00:00Z"),
        revokedAt: null, accountStatus: "active" };
    },
    async findActiveCuacStaffAccessGrantByUserAndRole(userId, role) {
      return activeGrant ? { userId, role, status: "approved", expiresAt: new Date("2026-09-29T00:00:00Z") } : null;
    },
  };
  return { calls, handlers: createOpsOperationsMonitoringHttpHandlers(service, auth) };
}

function request(path = "/api/v1/ops/operations/summary") {
  return new Request(`https://cuac.test${path}`, { headers: { cookie: `${SESSION_COOKIE_NAME}=ops-token` } });
}

test("Ops monitoring HTTP resolves an exact monitoring context and returns the fixed summary", async () => {
  const { calls, handlers } = fixture();
  const response = await handlers.getOperationsSummary(request());
  assert.equal(response.status, 200);
  const data = (await response.json()).data;
  assert.deepEqual(data.queues.map(queue => queue.queueKey), OPS_OPERATIONS_METRIC_REGISTRY.map(metric => metric.queueKey));
  assert.equal(data.generatedAt, "2026-09-03T00:00:00.000Z");
  assert.equal(calls[0].input.activeRole, "cuac_ops");
  assert.equal(calls[0].input.actorUserId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.equal(calls[1].method, "audit");
});

test("Ops monitoring HTTP rejects query-controlled metrics before repository access", async () => {
  for (const query of ["?metric=payment_reconciliation", "?windowHours=720", "?userId=student-1"]) {
    const { calls, handlers } = fixture();
    const response = await handlers.getOperationsSummary(request(`/api/v1/ops/operations/summary${query}`));
    assert.equal(response.status, 400);
    assert.deepEqual(calls, []);
  }
});

test("Ops monitoring HTTP degrades missing or revoked staff authority to a guest denial", async () => {
  for (const [activeGrant, includeCookie] of [[false, true], [true, false]]) {
    const { calls, handlers } = fixture({ activeGrant });
    const response = await handlers.getOperationsSummary(includeCookie
      ? request()
      : new Request("https://cuac.test/api/v1/ops/operations/summary"));
    assert.equal(response.status, 403);
    assert.deepEqual(calls, []);
  }
});
