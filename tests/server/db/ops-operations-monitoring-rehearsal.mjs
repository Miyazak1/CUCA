import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PostgresAuditWriter } from "../../../src/server/audit/postgres-writer.ts";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { transactionalMethod } from "../../../src/server/db/transactional-method.ts";
import { PostgresOpsOperationsMonitoringRepository } from "../../../src/server/ops-monitoring/postgres-repository.ts";
import { OPS_OPERATIONS_METRIC_REGISTRY, OpsOperationsMonitoringService } from "../../../src/server/ops-monitoring/service.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { grantCuacStaffAccess } from "./cuac-staff-access-fixture.mjs";

export async function runOpsOperationsMonitoringRehearsal(t, pool) {
  const client = createTransactionalSqlClient(pool);
  const readSummary = transactionalMethod(client, transaction => new OpsOperationsMonitoringService(
    new PostgresOpsOperationsMonitoringRepository(transaction),
    new PostgresAuditWriter(transaction),
  ), "getOperationsSummary");

  await t.test("Ops operations summary uses database time, fixed queue metrics and metadata-only audit", async () => {
    const staff = await createStaff(pool, "cuac_ops");
    const requestId = randomUUID();
    const context = monitoringContext(staff.userId, "cuac_ops", requestId);
    const baseline = await readSummary(context);
    const before = baseline.queues.find(queue => queue.queueKey === "auth_email_delivery");
    assert.ok(before);
    const challengeId = randomUUID(), outboxId = randomUUID();
    try {
      await pool.query(
        `insert into email_verification_challenges
          (id,user_id,email_normalized,verification_token_hash,status,requested_at,expires_at,metadata_json)
         values ($1,$2,$3,$4,'pending',clock_timestamp(),clock_timestamp() + interval '1 hour','{}'::jsonb)`,
        [challengeId, staff.userId, staff.email, `sha256:${randomUUID().replaceAll("-", "")}`],
      );
      await pool.query(
        `insert into auth_email_outbox
          (id,user_id,message_type,verification_challenge_id,expires_at,envelope_json,status,available_at)
         values ($1,$2,'auth.email_verification',$3,clock_timestamp() + interval '1 hour',$4::jsonb,'queued',clock_timestamp() - interval '5 minutes')`,
        [outboxId, staff.userId, challengeId, JSON.stringify({ scheme: "synthetic-rehearsal" })],
      );
      const observedRequestId = randomUUID();
      const observed = await readSummary({ ...context, requestId: observedRequestId });
      assert.deepEqual(observed.queues.map(queue => queue.queueKey), OPS_OPERATIONS_METRIC_REGISTRY.map(metric => metric.queueKey));
      const authEmail = observed.queues.find(queue => queue.queueKey === "auth_email_delivery");
      assert.equal(authEmail.dueCount, before.dueCount + 1);
      assert.ok(Date.parse(authEmail.oldestDueAt.toISOString()) <= observed.generatedAt.getTime());
      assert.deepEqual(Object.keys(authEmail).sort(), [
        "dueCount", "exceptionsLast24Hours", "expiredLeaseCount", "inFlightCount", "oldestDueAt", "queueKey",
      ]);
      assert.doesNotMatch(JSON.stringify(observed), new RegExp(staff.userId + "|" + staff.email + "|" + challengeId + "|" + outboxId, "i"));
      const audit = (await pool.query(
        "select action,resource_type,resource_id,data_classes,metadata_json from audit_logs where request_id = $1",
        [observedRequestId],
      )).rows;
      assert.equal(audit.length, 1);
      assert.equal(audit[0].action, "ops.operations_summary.read");
      assert.equal(audit[0].resource_type, "ops_operations_registry");
      assert.equal(audit[0].metadata_json.queueCount, 5);
      assert.equal(audit[0].metadata_json.dueCount, observed.totals.dueCount);
      assert.doesNotMatch(JSON.stringify(audit[0]), /email_normalized|object_key|invoice_id|payment_id|application_set_id/i);
    } finally {
      await pool.query("delete from auth_email_outbox where id = $1", [outboxId]);
      await pool.query("delete from email_verification_challenges where id = $1", [challengeId]);
    }
  });

  await t.test("Ops operations summary rejects a revoked live staff grant without recording a read", async () => {
    const staff = await createStaff(pool, "cuac_admin");
    await pool.query(
      "update cuac_staff_access_grants set status = 'revoked', revoked_at = clock_timestamp() where id = $1",
      [staff.grantId],
    );
    const requestId = randomUUID();
    await assert.rejects(readSummary(monitoringContext(staff.userId, "cuac_admin", requestId)), error => error.status === 403);
    assert.equal((await pool.query(
      "select count(*)::integer as total from audit_logs where request_id = $1 and action = 'ops.operations_summary.read'",
      [requestId],
    )).rows[0].total, 0);
  });
}

async function createStaff(pool, role) {
  const email = `ops-monitoring-${randomUUID()}@example.invalid`;
  const user = (await pool.query(
    "insert into users (email,email_normalized) values ($1,$1) returning id",
    [email],
  )).rows[0];
  await pool.query("insert into user_roles (user_id,role) values ($1,$2)", [user.id, role]);
  const grant = await grantCuacStaffAccess(pool, user.id, role);
  return { userId: user.id, email, grantId: grant.grantId };
}

function monitoringContext(actorUserId, activeRole, requestId) {
  return createRequestContext({ actorUserId, activeRole, requestId,
    selectedSurface: "ops", purpose: "ops_monitoring", authStrength: "session" });
}
