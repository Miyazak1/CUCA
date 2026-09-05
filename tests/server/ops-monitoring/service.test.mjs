import assert from "node:assert/strict";
import test from "node:test";
import {
  createRequestContext,
  OPS_OPERATIONS_METRIC_REGISTRY,
  OPS_OPERATIONS_REGISTRY_VERSION,
  OpsOperationsMonitoringService,
} from "../../../src/server/index.ts";

const generatedAt = new Date("2026-09-03T12:00:00.000Z");
const exceptionWindowStartedAt = new Date("2026-09-02T12:00:00.000Z");
const context = createRequestContext({
  actorUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  activeRole: "cuac_ops",
  selectedSurface: "ops",
  purpose: "ops_monitoring",
  authStrength: "session",
});

function rows() {
  return OPS_OPERATIONS_METRIC_REGISTRY.map(({ queueKey }, index) => ({
    queueKey,
    generatedAt,
    exceptionWindowStartedAt,
    dueCount: index === 0 ? 2 : 0,
    inFlightCount: index === 1 ? 1 : 0,
    expiredLeaseCount: index === 2 ? 1 : 0,
    exceptionsLast24Hours: index === 3 ? 3 : 0,
    oldestDueAt: index === 0 ? new Date("2026-09-03T11:55:00.000Z") : null,
  }));
}

function fixture(result = { authorized: true, rows: rows() }) {
  const calls = [], audits = [];
  const service = new OpsOperationsMonitoringService({
    async readOperationsSummary(input) { calls.push(input); return result; },
  }, { async record(event) { audits.push(event); } });
  return { service, calls, audits };
}

test("Ops monitoring returns only the fixed registry projection and records aggregate audit metadata", async () => {
  const { service, calls, audits } = fixture();
  const summary = await service.getOperationsSummary(context);
  assert.equal(summary.schemaVersion, 1);
  assert.equal(summary.registryVersion, OPS_OPERATIONS_REGISTRY_VERSION);
  assert.deepEqual(summary.queues.map(queue => queue.queueKey), OPS_OPERATIONS_METRIC_REGISTRY.map(metric => metric.queueKey));
  assert.deepEqual(summary.totals, {
    dueCount: 2, inFlightCount: 1, expiredLeaseCount: 1, exceptionsLast24Hours: 3,
  });
  assert.deepEqual(calls, [{ actorUserId: context.actorUserId, activeRole: "cuac_ops" }]);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, "ops.operations_summary.read");
  assert.equal(audits[0].resourceId, OPS_OPERATIONS_REGISTRY_VERSION);
  assert.deepEqual(audits[0].metadata, {
    registryVersion: OPS_OPERATIONS_REGISTRY_VERSION,
    queueCount: 5,
    dueCount: 2,
    inFlightCount: 1,
    expiredLeaseCount: 1,
    exceptionsLast24Hours: 3,
  });
  assert.doesNotMatch(JSON.stringify(summary), /userId|emailAddress|filename|objectKey|invoiceId|paymentId|applicationId/i);
});

test("Ops monitoring rejects invalid persona, surface, purpose and data-class contexts before repository access", async () => {
  for (const candidate of [
    { ...context, actorUserId: null },
    { ...context, activeRole: "student", selectedSurface: "student" },
    { ...context, selectedSurface: "public" },
    { ...context, purpose: "ops_support" },
    { ...context, purpose: "agent_tool" },
    { ...context, tenantSchoolId: "school-1" },
    { ...context, authStrength: "guest" },
    { ...context, dataClassAllowlist: ["ops_confidential"] },
  ]) {
    const { service, calls, audits } = fixture();
    await assert.rejects(service.getOperationsSummary(candidate), error => error.status === 403);
    assert.deepEqual(calls, []);
    assert.deepEqual(audits, []);
  }
});

test("Ops monitoring requires a current database grant and fails closed on malformed metric rows", async () => {
  const denied = fixture({ authorized: false });
  await assert.rejects(denied.service.getOperationsSummary(context), error => error.status === 403);
  assert.deepEqual(denied.audits, []);

  const corruptions = [
    rows().slice(0, 4),
    rows().map((row, index) => index === 1 ? { ...row, queueKey: "unregistered" } : row),
    rows().map((row, index) => index === 2 ? { ...row, dueCount: -1 } : row),
    rows().map((row, index) => index === 3 ? { ...row, oldestDueAt: generatedAt } : row),
    rows().map((row, index) => index === 4 ? { ...row, generatedAt: new Date(generatedAt.getTime() + 1) } : row),
  ];
  for (const candidateRows of corruptions) {
    const candidate = fixture({ authorized: true, rows: candidateRows });
    await assert.rejects(candidate.service.getOperationsSummary(context), error => error.status === 503);
    assert.deepEqual(candidate.audits, []);
  }
});
