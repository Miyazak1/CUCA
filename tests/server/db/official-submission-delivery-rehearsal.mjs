import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import {
  ApplicationMaterialSnapshotCipher,
  PostgresOfficialSubmissionOutbox,
  PostgresSchoolPortalRepository,
  createTransactionalSqlClient,
} from "../../../src/server/index.ts";
import {
  applicationAtomicSubmissionFixture,
  clearApplicationAtomicSubmissions,
} from "./application-atomic-submission-fixture.mjs";
import { createAuditFailureFixture } from "./audit-failure-fixture.mjs";

const providerName = "cuac_handoff_gateway_v1";

export async function runOfficialSubmissionDeliveryRehearsal(t, pool) {
  await t.test("official submission delivery confirms one group atomically and quarantines uncertain work", async () => {
    await clearApplicationAtomicSubmissions(pool);
    const f = await applicationAtomicSubmissionFixture(pool, { formMode: "one_program_per_form" });
    const submission = await f.submit(), outbox = new PostgresOfficialSubmissionOutbox(f.client, f.cipher);
    try {
      const leases = await Promise.all([outbox.claim(), outbox.claim(), outbox.claim()]);
      const claimed = leases.filter(Boolean);
      assert.equal(claimed.length, 2);
      assert.equal(new Set(claimed.map(lease => lease.id)).size, 2);

      const acceptedLease = claimed[0], acceptedJob = await outbox.prepare(acceptedLease, providerName);
      assert.equal(acceptedJob.payload.members.length, 1);
      assert.equal(acceptedJob.payload.schoolId, acceptedLease.schoolId);
      assert.equal(acceptedJob.serialized.includes("provider_checkout"), false);
      assert.equal(acceptedJob.serialized.toLowerCase().includes("agent"), false);
      const acceptedApplicationId = acceptedJob.payload.members[0].schoolApplicationId;
      const acceptedResult = { status: "accepted", providerName, payloadSha256: acceptedJob.payloadSha256,
        receiptId: `receipt:${randomUUID()}`, receivedAt: new Date() };

      const fault = await createAuditFailureFixture(pool);
      try {
        await assert.rejects(fault.during("official_submission.delivery.dispatched",
          () => outbox.finish(acceptedLease, acceptedResult)), /Synthetic audit storage failure/);
        assert.equal((await pool.query("select status from official_submission_outbox where id = $1", [acceptedLease.id])).rows[0].status, "sending");
        assert.equal((await pool.query("select count(*)::int as total from official_submission_delivery_receipts where outbox_id = $1", [acceptedLease.id])).rows[0].total, 0);
        assert.deepEqual((await pool.query("select status,submitted_at from school_applications where id = $1", [acceptedApplicationId])).rows[0],
          { status: "pending_submission", submitted_at: null });
      } finally { await fault.close(); }

      assert.equal(await outbox.finish(acceptedLease, acceptedResult), true);
      assert.equal(await outbox.finish(acceptedLease, acceptedResult), false);
      const acceptedRow = (await pool.query(`select o.status,o.outcome,o.provider_name,o.provider_receipt_id,
        g.transport_status from official_submission_outbox o join official_submission_groups g on g.id = o.group_id
        where o.id = $1`, [acceptedLease.id])).rows[0];
      assert.deepEqual(acceptedRow, { status: "dispatched", outcome: "accepted", provider_name: providerName,
        provider_receipt_id: acceptedResult.receiptId, transport_status: "dispatched" });
      const receipt = (await pool.query("select * from official_submission_delivery_receipts where outbox_id = $1", [acceptedLease.id])).rows[0];
      assert.equal(receipt.provider_receipt_id, acceptedResult.receiptId);
      assert.equal(receipt.payload_sha256, acceptedJob.payloadSha256);
      const delivered = (await pool.query(`select status,school_revision,submitted_at from school_applications
        where id = $1`, [acceptedApplicationId])).rows[0];
      assert.equal(delivered.status, "new"); assert.equal(delivered.school_revision, 1); assert.ok(delivered.submitted_at instanceof Date);
      const deliveryEvent = (await pool.query(`select actor_user_id,from_status,to_status,application_revision,metadata_json
        from school_application_status_events where school_application_id = $1 and application_revision = 1`, [acceptedApplicationId])).rows;
      assert.deepEqual(deliveryEvent.map(event => ({ ...event, metadata_json: event.metadata_json.source })), [{
        actor_user_id: null, from_status: "pending_submission", to_status: "new", application_revision: 1,
        metadata_json: "official_submission_delivery",
      }]);
      const queue = await new PostgresSchoolPortalRepository(createTransactionalSqlClient(pool))
        .listApplicationQueueBySchoolId(acceptedLease.schoolId);
      assert.deepEqual(queue.filter(row => submission.programApplications.some(application => application.id === row.id)).map(row => row.id),
        [acceptedApplicationId]);
      const audits = (await pool.query(`select metadata_json from audit_logs where resource_id = $1
        and action like 'official_submission.delivery.%'`, [acceptedLease.id])).rows;
      assert.equal(JSON.stringify(audits).includes("PRIVATE_"), false);
      assert.equal(JSON.stringify(audits).includes(acceptedResult.receiptId), false);

      const rejectedLease = claimed[1], firstRejected = await outbox.prepare(rejectedLease, providerName);
      assert.equal(await outbox.finish(rejectedLease, { status: "not_accepted", providerName,
        payloadSha256: firstRejected.payloadSha256 }), true);
      const retryRow = (await pool.query("select status,outcome,attempt_count,provider_name,payload_sha256 from official_submission_outbox where id = $1", [rejectedLease.id])).rows[0];
      assert.deepEqual(retryRow, { status: "pending", outcome: "not_accepted", attempt_count: 1,
        provider_name: providerName, payload_sha256: firstRejected.payloadSha256 });
      await pool.query("update official_submission_outbox set available_at = clock_timestamp() where id = $1", [rejectedLease.id]);
      const retryLease = await outbox.claim(), secondRejected = await outbox.prepare(retryLease, providerName);
      assert.equal(secondRejected.payloadSha256, firstRejected.payloadSha256);
      assert.equal(await outbox.finish(retryLease, { status: "unknown", providerName,
        payloadSha256: secondRejected.payloadSha256 }), true);
      const quarantined = (await pool.query(`select o.status,o.outcome,g.transport_status from official_submission_outbox o
        join official_submission_groups g on g.id = o.group_id where o.id = $1`, [rejectedLease.id])).rows[0];
      assert.deepEqual(quarantined, { status: "quarantined", outcome: "unknown", transport_status: "quarantined" });
      const rejectedApplicationId = secondRejected.payload.members[0].schoolApplicationId;
      assert.deepEqual((await pool.query("select status,submitted_at from school_applications where id = $1", [rejectedApplicationId])).rows[0],
        { status: "pending_submission", submitted_at: null });
      assert.equal((await pool.query("select count(*)::int as total from official_submission_delivery_receipts where group_id = $1", [rejectedLease.groupId])).rows[0].total, 0);

      await assert.rejects(pool.query("update school_applications set status = 'new' where id = $1", [rejectedApplicationId]),
        error => error.code === "23514" && error.constraint === "school_applications_workflow_check");
      await assert.rejects(pool.query("update official_submission_outbox set status = 'dispatched' where id = $1", [rejectedLease.id]),
        error => error.code === "23514" && error.constraint === "official_submission_outbox_lifecycle_check");
    } finally { await clearApplicationAtomicSubmissions(pool); }
  });

  await t.test("official submission delivery recovers only pre-send leases and isolates sending or corrupt payloads", async () => {
    await clearApplicationAtomicSubmissions(pool);
    const f = await applicationAtomicSubmissionFixture(pool, { formMode: "multi_program_form" });
    await f.submit();
    const outbox = new PostgresOfficialSubmissionOutbox(f.client, f.cipher);
    try {
      const oldLease = await outbox.claim();
      await pool.query(`update official_submission_outbox set leased_at = clock_timestamp() - interval '3 seconds',
        lease_expires_at = clock_timestamp() - interval '1 second' where id = $1`, [oldLease.id]);
      assert.deepEqual(await outbox.recover(), { recovered: 1, quarantined: 0 });
      assert.equal(await outbox.prepare(oldLease, providerName), null);
      const lease = await outbox.claim();
      const wrongCipher = new ApplicationMaterialSnapshotCipher({ activeKeyId: "wrong-key",
        keys: new Map([["wrong-key", randomBytes(32)]]) });
      await assert.rejects(new PostgresOfficialSubmissionOutbox(f.client, wrongCipher).prepare(lease, providerName),
        error => error.reason === "key_unavailable");
      assert.equal((await pool.query("select status from official_submission_outbox where id = $1", [lease.id])).rows[0].status, "leased");
      const prepared = await outbox.prepare(lease, providerName);
      assert.equal(prepared.payload.members.length, 2);
      await pool.query(`update official_submission_outbox set leased_at = clock_timestamp() - interval '3 seconds',
        lease_expires_at = clock_timestamp() - interval '1 second' where id = $1`, [lease.id]);
      assert.deepEqual(await outbox.recover(), { recovered: 1, quarantined: 1 });
      assert.equal(await outbox.claim(), null);
      assert.equal((await pool.query("select count(*)::int as total from school_applications where application_submission_id = $1 and status = 'new'", [lease.applicationSubmissionId])).rows[0].total, 0);
    } finally { await clearApplicationAtomicSubmissions(pool); }

    const corrupt = await applicationAtomicSubmissionFixture(pool, { formMode: "multi_program_form" });
    await corrupt.submit();
    const corruptOutbox = new PostgresOfficialSubmissionOutbox(corrupt.client, corrupt.cipher);
    try {
      const lease = await corruptOutbox.claim();
      await pool.query(`update application_material_snapshots set envelope_json = jsonb_set(envelope_json,'{ciphertext}',
        to_jsonb(repeat('A',char_length(envelope_json->>'ciphertext'))))
        where id = (select material_snapshot_id from official_submission_group_members where group_id = $1 order by member_position limit 1)`, [lease.groupId]);
      assert.equal(await corruptOutbox.prepare(lease, providerName), null);
      assert.deepEqual((await pool.query("select status,outcome,last_error_code from official_submission_outbox where id = $1", [lease.id])).rows[0],
        { status: "quarantined", outcome: "invalid_payload", last_error_code: "INVALID_PAYLOAD" });
      assert.equal((await pool.query("select count(*)::int as total from official_submission_delivery_receipts where outbox_id = $1", [lease.id])).rows[0].total, 0);
    } finally { await clearApplicationAtomicSubmissions(pool); }
  });
}
