import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PostgresAuditWriter } from "../../../src/server/audit/postgres-writer.ts";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { PostgresDataRightsRepository } from "../../../src/server/data-rights/postgres-repository.ts";
import { DataRightsService } from "../../../src/server/data-rights/service.ts";
import { PostgresNotificationPublisher } from "../../../src/server/notifications/postgres-repository.ts";
import { PostgresOpsDataRightsRepository } from "../../../src/server/ops-data-rights/postgres-repository.ts";
import { OpsDataRightsService } from "../../../src/server/ops-data-rights/service.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";

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
    const deadlines = (await pool.query(`select deadline_policy_version,extended_due_at,
      extract(epoch from internal_target_at-received_at) as internal_seconds,
      extract(epoch from response_due_at-received_at) as response_seconds
      from data_rights_requests where id=$1`, [firstRequestId])).rows[0];
    assert.equal(deadlines.deadline_policy_version,"data_rights_response_v1");
    assert.equal(deadlines.extended_due_at,null);
    assert.equal(Number(deadlines.internal_seconds),15*86_400);
    assert.equal(Number(deadlines.response_seconds),30*86_400);
    await assert.rejects(pool.query(`update data_rights_requests set extended_due_at=response_due_at+interval '61 days' where id=$1`,
      [firstRequestId]),/data_rights_requests_deadline_check/);
    assert.deepEqual((await repository.listOwn(firstUserId)).rows.map(row => row.id), [firstRequestId]);
    assert.deepEqual((await repository.listOwn(secondUserId)).rows, []);
    assert.equal((await repository.cancelOwn({ requestId: firstRequestId, userId: secondUserId, expectedRevision: 1 })).row, null);
    assert.equal((await repository.createOwn({ ...input, requestId: randomUUID() })).row, null, "only one active request of a type is allowed");
    assert.equal((await repository.cancelOwn({ requestId: firstRequestId, userId: firstUserId, expectedRevision: 2 })).row, null);
    const cancelled = (await repository.cancelOwn({ requestId: firstRequestId, userId: firstUserId, expectedRevision: 1 })).row;
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.revision, 2);
    const activeRequestId=randomUUID();
    const studentContext=createRequestContext({actorUserId:firstUserId,activeRole:"student",selectedSurface:"student",
      purpose:"data_rights",authStrength:"session"});
    const created=await client.transaction(async tx=>new DataRightsService(new PostgresDataRightsRepository(tx),
      new PostgresAuditWriter(tx),new PostgresNotificationPublisher(tx)).createOwn(studentContext,
      {requestId:activeRequestId,requestType:"access",correctionScope:null,preferredLocale:"zh-CN"}));
    assert.equal(created.requestId,activeRequestId,"a terminal request frees the active-type slot");

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
    const identityConfirmed=await client.transaction(async tx=>new DataRightsService(new PostgresDataRightsRepository(tx),
      new PostgresAuditWriter(tx),new PostgresNotificationPublisher(tx)).confirmOwn(
      {...studentContext,authStrength:"step_up"},activeRequestId,{confirmationId:randomUUID(),expectedRevision:1}));
    assert.equal(identityConfirmed.status,"identity_confirmed");assert.equal(identityConfirmed.revision,2);

    const studentNotifications=(await pool.query(`select e.event_type,t.locale,d.channel,d.status,d.title,d.action_path
      from notification_events e join notification_deliveries d on d.event_id=e.id
      join notification_templates t on t.id=d.template_id
      where e.resource_type='data_rights_request' and e.resource_id=$1
      order by e.occurred_at,e.event_type,d.channel`,[activeRequestId])).rows;
    assert.equal(studentNotifications.length,6,"three student-visible transitions create in-app and email deliveries");
    assert.deepEqual([...new Set(studentNotifications.map(row=>row.event_type))].sort(),
      ["data_rights_identity_confirmed","data_rights_identity_required","data_rights_received"]);
    assert.ok(studentNotifications.every(row=>row.locale==="zh-CN"));
    assert.ok(studentNotifications.every(row=>row.action_path==="/preferences-api.html#privacy-requests"));
    assert.ok(studentNotifications.filter(row=>row.channel==="in_app").every(row=>row.status==="unread"&&/[\u3400-\u9fff]/u.test(row.title)));
    assert.ok(studentNotifications.filter(row=>row.channel==="email").every(row=>row.status==="queued"));

    assert.ok((await ops.list({...actor,limit:100})).value.some(item=>item.requestId===activeRequestId));
    const opsContext=createRequestContext({actorUserId:opsUserId,activeRole:"cuac_ops",selectedSurface:"ops",
      purpose:"data_rights_review",authStrength:"session"});
    const claimed=await client.transaction(async tx=>new OpsDataRightsService(new PostgresOpsDataRightsRepository(tx),
      new PostgresAuditWriter(tx),new PostgresNotificationPublisher(tx)).claim(opsContext,activeRequestId,{expectedRevision:2}));
    assert.equal(claimed.status,"in_progress"); assert.equal(claimed.review.status,"investigating");
    const reviewStarted=(await pool.query(`select e.event_type,t.locale,d.channel,d.status
      from notification_events e join notification_deliveries d on d.event_id=e.id
      join notification_templates t on t.id=d.template_id
      where e.resource_type='data_rights_request' and e.resource_id=$1 and e.event_type='data_rights_review_started'
      order by d.channel`,[activeRequestId])).rows;
    assert.equal(reviewStarted.length,2);
    assert.ok(reviewStarted.every(row=>row.locale==="zh-CN"));
    assert.deepEqual(reviewStarted.map(row=>[row.channel,row.status]),[["email","queued"],["in_app","unread"]]);
    const extensionId=randomUUID(),extendedDueAt=new Date(new Date(claimed.responseDueAt).getTime()+30*86_400_000).toISOString();
    const adminContext=createRequestContext({actorUserId:adminUserId,activeRole:"cuac_admin",selectedSurface:"ops",
      purpose:"data_rights_review",authStrength:"step_up"});
    const extended=await client.transaction(async tx=>new OpsDataRightsService(new PostgresOpsDataRightsRepository(tx),
      new PostgresAuditWriter(tx),new PostgresNotificationPublisher(tx)).extend(adminContext,activeRequestId,{extensionId,
      expectedRevision:3,expectedReviewRevision:1,reasonCode:"request_complexity",caseReference:"case:extension-rehearsal",extendedDueAt}));
    assert.equal(extended.revision,4);assert.equal(extended.extension.extensionId,extensionId);
    assert.equal(extended.effectiveDueAt,extendedDueAt);
    const extensionEvidence=(await pool.query(`select reason_code,original_response_due_at,extended_due_at,approved_by_user_id
      from data_rights_deadline_extensions where data_rights_request_id=$1`,[activeRequestId])).rows[0];
    assert.equal(extensionEvidence.reason_code,"request_complexity");assert.equal(extensionEvidence.approved_by_user_id,adminUserId);
    assert.equal(extensionEvidence.extended_due_at.toISOString(),extendedDueAt);
    const extensionNotices=(await pool.query(`select t.locale,d.channel,d.status,d.body from notification_events e
      join notification_deliveries d on d.event_id=e.id join notification_templates t on t.id=d.template_id
      where e.resource_id=$1 and e.event_type='data_rights_deadline_extended' order by d.channel`,[activeRequestId])).rows;
    assert.equal(extensionNotices.length,2);assert.ok(extensionNotices.every(row=>row.locale==="zh-CN"&&row.body.includes(extendedDueAt.slice(0,10))));
    assert.equal((await ops.extend({actorUserId:adminUserId,activeRole:"cuac_admin",requestId:activeRequestId,
      extensionId:randomUUID(),expectedRevision:4,expectedReviewRevision:1,reasonCode:"request_complexity",
      caseReference:"case:duplicate-extension",extendedDueAt:new Date(extendedDueAt)})).value,null,"a request can be extended only once");
    const escalated=(await ops.escalate({...actor,requestId:activeRequestId,expectedRevision:4,expectedReviewRevision:1,
      code:"legal_review_required",reference:"case:rehearsal"})).value;
    assert.equal(escalated.status,"escalated"); assert.equal(escalated.review.status,"escalated");
    const proposalSha256=`sha256:${"b".repeat(64)}`;
    const proposed=(await ops.propose({...actor,requestId:activeRequestId,proposalId:randomUUID(),expectedRevision:5,
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

    const plannedRequestId=randomUUID();
    await client.transaction(async tx=>new DataRightsService(new PostgresDataRightsRepository(tx),
      new PostgresAuditWriter(tx),new PostgresNotificationPublisher(tx)).createOwn(studentContext,
      {requestId:plannedRequestId,requestType:"correction",correctionScope:"applicant_profile",preferredLocale:"zh-CN"}));
    await client.transaction(async tx=>new DataRightsService(new PostgresDataRightsRepository(tx),
      new PostgresAuditWriter(tx),new PostgresNotificationPublisher(tx)).confirmOwn(
      {...studentContext,authStrength:"step_up"},plannedRequestId,{confirmationId:randomUUID(),expectedRevision:1}));
    await ops.claim({...actor,requestId:plannedRequestId,expectedRevision:2});
    const planned=await ops.propose({...actor,requestId:plannedRequestId,proposalId:randomUUID(),expectedRevision:3,
      expectedReviewRevision:1,outcomeCode:"correction_ready",reasonCode:null,caseReference:"case:planned-correction",
      proposalSha256:`sha256:${"c".repeat(64)}`,approvalMode:"single_operator"});
    assert.equal(planned.value.outcome.status,"approved");
    assert.equal((await ops.extend({actorUserId:adminUserId,activeRole:"cuac_admin",requestId:plannedRequestId,
      extensionId:randomUUID(),expectedRevision:3,expectedReviewRevision:1,reasonCode:"request_complexity",
      caseReference:"case:late-extension",extendedDueAt:new Date(new Date(planned.value.responseDueAt).getTime()+30*86_400_000)})).value,null,
    "a request with an existing outcome cannot be extended");

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
