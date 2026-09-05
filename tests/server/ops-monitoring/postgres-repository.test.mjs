import assert from "node:assert/strict";
import test from "node:test";
import { PostgresOpsOperationsMonitoringRepository } from "../../../src/server/index.ts";

function fakeClient(responder) {
  const calls = [];
  const client = {
    async transaction(work) { return work(client); },
    async query(statement, params) { calls.push({ statement, params }); return responder(statement, params); },
  };
  return { calls, client };
}

const authority = {
  grantId: "grant-1",
  actorUserId: "ops-1",
  activeRole: "cuac_ops",
  expiresAt: new Date("2026-09-04T00:00:00Z"),
};
const metricRows = [{
  queueKey: "auth_email_delivery",
  generatedAt: new Date("2026-09-03T00:00:00Z"),
  exceptionWindowStartedAt: new Date("2026-09-02T00:00:00Z"),
  dueCount: 0,
  inFlightCount: 0,
  expiredLeaseCount: 0,
  exceptionsLast24Hours: 0,
  oldestDueAt: null,
}];

test("Postgres Ops monitoring rechecks live staff authority before one fixed cross-queue query", async () => {
  const { calls, client } = fakeClient(statement => /from users u/.test(statement) ? [authority] : metricRows);
  const result = await new PostgresOpsOperationsMonitoringRepository(client).readOperationsSummary({
    actorUserId: "ops-1", activeRole: "cuac_ops",
  });
  assert.deepEqual(result, { authorized: true, rows: metricRows });
  assert.equal(calls.length, 2);
  assert.match(calls[0].statement, /for share of u, r, g/);
  assert.deepEqual(calls[0].params, ["ops-1", "cuac_ops"]);
  assert.deepEqual(calls[1].params, []);
  for (const source of ["auth_email_outbox", "notification_deliveries", "student_file_assets",
    "official_submission_outbox", "payment_provider_events"]) assert.match(calls[1].statement, new RegExp(source));
  assert.match(calls[1].statement, /with clock as materialized/);
  assert.match(calls[1].statement, /interval '24 hours'/);
  assert.match(calls[1].statement, /order by m\.ordinal/);
  assert.doesNotMatch(calls[1].statement, /select[^;]*(user_id|email_normalized|object_key|provider_payment_id|application_set_id)/i);
});

test("Postgres Ops monitoring does not inspect queues without current staff authority", async () => {
  const { calls, client } = fakeClient(() => []);
  assert.deepEqual(await new PostgresOpsOperationsMonitoringRepository(client).readOperationsSummary({
    actorUserId: "ops-1", activeRole: "cuac_admin",
  }), { authorized: false });
  assert.equal(calls.length, 1);
});
