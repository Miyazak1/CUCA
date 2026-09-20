import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { PostgresDataRightsRepository } from "../../../src/server/data-rights/postgres-repository.ts";
import { PostgresOpsDataRightsRepository } from "../../../src/server/ops-data-rights/postgres-repository.ts";

export async function runDataRightsRehearsal(t, pool) {
  await t.test("data-rights requests stay owner-scoped, revision-safe and retained after account deletion", async () => {
    const client = createTransactionalSqlClient(pool);
    const repository = new PostgresDataRightsRepository(client);
    const firstUserId = randomUUID(), secondUserId = randomUUID();
    for (const [id, label] of [[firstUserId, "first"], [secondUserId, "second"]]) {
      const email = `rights-${label}-${id}@example.invalid`;
      await pool.query("insert into users (id,email,email_normalized) values ($1,$2,$2)", [id, email]);
      await pool.query("insert into user_roles (user_id,role) values ($1,'student')", [id]);
    }

    const firstRequestId = randomUUID();
    const input = { requestId: firstRequestId, userId: firstUserId,
      subjectReferenceHash: `sha256:${"a".repeat(64)}`, requestType: "access", correctionScope: null, preferredLocale: "en" };
    assert.equal((await repository.createOwn(input)).row.id, firstRequestId);
    assert.deepEqual((await repository.listOwn(firstUserId)).rows.map(row => row.id), [firstRequestId]);
    assert.deepEqual((await repository.listOwn(secondUserId)).rows, []);
    assert.equal((await repository.cancelOwn({ requestId: firstRequestId, userId: secondUserId, expectedRevision: 1 })).row, null);
    assert.equal((await repository.createOwn({ ...input, requestId: randomUUID() })).row, null, "only one active request of a type is allowed");
    assert.equal((await repository.cancelOwn({ requestId: firstRequestId, userId: firstUserId, expectedRevision: 2 })).row, null);
    const cancelled = (await repository.cancelOwn({ requestId: firstRequestId, userId: firstUserId, expectedRevision: 1 })).row;
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.revision, 2);
    const activeRequestId=randomUUID();
    assert.ok((await repository.createOwn({ ...input, requestId: activeRequestId })).row, "a terminal request frees the active-type slot");

    const opsUserId=randomUUID(), adminUserId=randomUUID(), approverId=randomUUID();
    for(const [id,label] of [[opsUserId,"ops"],[adminUserId,"admin"],[approverId,"approver"]]){const email=`rights-${label}-${id}@example.invalid`;
      await pool.query("insert into users (id,email,email_normalized) values ($1,$2,$2)",[id,email]);}
    await pool.query("insert into user_roles (user_id,role) values ($1,'cuac_ops')",[opsUserId]);
    await pool.query("insert into user_roles (user_id,role) values ($1,'cuac_admin')",[adminUserId]);
    const grant=(await pool.query(`insert into cuac_staff_access_grants
      (user_id,email,email_normalized,requested_role,status,approved_by_user_id,reason,approved_at,expires_at)
      values ($1,$2,$2,'cuac_ops','approved',$3,'privacy triage rehearsal',clock_timestamp(),clock_timestamp()+interval '1 day') returning id`,
    [opsUserId,`rights-ops-${opsUserId}@example.invalid`,approverId])).rows[0];
    assert.ok(grant.id);
    const adminGrant=(await pool.query(`insert into cuac_staff_access_grants
      (user_id,email,email_normalized,requested_role,status,approved_by_user_id,reason,approved_at,expires_at)
      values ($1,$2,$2,'cuac_admin','approved',$3,'privacy outcome approval rehearsal',clock_timestamp(),clock_timestamp()+interval '1 day') returning id`,
    [adminUserId,`rights-admin-${adminUserId}@example.invalid`,approverId])).rows[0];
    assert.ok(adminGrant.id);
    const ops=new PostgresOpsDataRightsRepository(client), actor={actorUserId:opsUserId,activeRole:"cuac_ops"};
    assert.equal((await ops.claim({...actor,requestId:activeRequestId,expectedRevision:1})).value,null,
      "an unconfirmed request cannot be claimed by Ops");
    const identityConfirmed=(await repository.confirmOwn({requestId:activeRequestId,confirmationId:randomUUID(),userId:firstUserId,
      expectedRevision:1,subjectReferenceHash:input.subjectReferenceHash,confirmationReferenceSha256:`sha256:${"c".repeat(64)}`})).row;
    assert.equal(identityConfirmed.status,"identity_confirmed");assert.equal(identityConfirmed.revision,2);

    assert.ok((await ops.list({...actor,limit:100})).value.some(item=>item.requestId===activeRequestId));
    const claimed=(await ops.claim({...actor,requestId:activeRequestId,expectedRevision:2})).value;
    assert.equal(claimed.status,"in_progress"); assert.equal(claimed.review.status,"investigating");
    const escalated=(await ops.escalate({...actor,requestId:activeRequestId,expectedRevision:3,expectedReviewRevision:1,
      code:"legal_review_required",reference:"case:rehearsal"})).value;
    assert.equal(escalated.status,"escalated"); assert.equal(escalated.review.status,"escalated");
    const proposalSha256=`sha256:${"b".repeat(64)}`;
    const proposed=(await ops.propose({...actor,requestId:activeRequestId,proposalId:randomUUID(),expectedRevision:4,
      expectedReviewRevision:2,outcomeCode:"request_denied",reasonCode:"legal_restriction",caseReference:"case:rights-denial",
      proposalSha256,approvalMode:"dual_control"})).value;
    assert.equal(proposed.outcome.status,"proposed");
    assert.equal((await ops.approve({...actor,requestId:activeRequestId,expectedOutcomeRevision:1,expectedProposalSha256:proposalSha256})).authorized,false,
      "an Ops grant cannot approve a destructive outcome");
    const approved=(await ops.approve({actorUserId:adminUserId,activeRole:"cuac_admin",requestId:activeRequestId,
      expectedOutcomeRevision:1,expectedProposalSha256:proposalSha256})).value;
    assert.equal(approved.outcome.status,"approved");
    assert.equal(approved.outcome.approvedByUserId,adminUserId);
    assert.equal(approved.status,"escalated","approving a plan must not execute or close the request");

    await pool.query("update user_roles set revoked_at = clock_timestamp() where user_id = $1 and role = 'student'", [firstUserId]);
    assert.equal((await repository.listOwn(firstUserId)).authorized, false);
    await pool.query("delete from users where id = $1", [firstUserId]);
    const retained = await pool.query("select user_id, subject_reference_hash from data_rights_requests where id = $1", [firstRequestId]);
    assert.equal(retained.rows[0].user_id, null);
    assert.match(retained.rows[0].subject_reference_hash, /^sha256:[a-f0-9]{64}$/);
    const retainedConfirmation = await pool.query(`select c.method,c.subject_reference_hash,c.confirmation_reference_sha256
      from data_rights_identity_confirmations c where c.data_rights_request_id = $1`, [activeRequestId]);
    assert.equal(retainedConfirmation.rowCount, 1);
    assert.equal(retainedConfirmation.rows[0].method, "password_step_up");
    assert.match(retainedConfirmation.rows[0].subject_reference_hash, /^sha256:[a-f0-9]{64}$/);
    assert.match(retainedConfirmation.rows[0].confirmation_reference_sha256, /^sha256:[a-f0-9]{64}$/);
  });
}
