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

    const opsUserId=randomUUID(), approverId=randomUUID();
    for(const [id,label] of [[opsUserId,"ops"],[approverId,"approver"]]){const email=`rights-${label}-${id}@example.invalid`;
      await pool.query("insert into users (id,email,email_normalized) values ($1,$2,$2)",[id,email]);}
    await pool.query("insert into user_roles (user_id,role) values ($1,'cuac_ops')",[opsUserId]);
    const grant=(await pool.query(`insert into cuac_staff_access_grants
      (user_id,email,email_normalized,requested_role,status,approved_by_user_id,reason,approved_at,expires_at)
      values ($1,$2,$2,'cuac_ops','approved',$3,'privacy triage rehearsal',clock_timestamp(),clock_timestamp()+interval '1 day') returning id`,
    [opsUserId,`rights-ops-${opsUserId}@example.invalid`,approverId])).rows[0];
    assert.ok(grant.id);
    const ops=new PostgresOpsDataRightsRepository(client), actor={actorUserId:opsUserId,activeRole:"cuac_ops"};
    assert.ok((await ops.list({...actor,limit:100})).value.some(item=>item.requestId===activeRequestId));
    const claimed=(await ops.claim({...actor,requestId:activeRequestId,expectedRevision:1})).value;
    assert.equal(claimed.status,"in_progress"); assert.equal(claimed.review.status,"investigating");
    const escalated=(await ops.escalate({...actor,requestId:activeRequestId,expectedRevision:2,expectedReviewRevision:1,
      code:"legal_review_required",reference:"case:rehearsal"})).value;
    assert.equal(escalated.status,"escalated"); assert.equal(escalated.review.status,"escalated");

    await pool.query("update user_roles set revoked_at = clock_timestamp() where user_id = $1 and role = 'student'", [firstUserId]);
    assert.equal((await repository.listOwn(firstUserId)).authorized, false);
    await pool.query("delete from users where id = $1", [firstUserId]);
    const retained = await pool.query("select user_id, subject_reference_hash from data_rights_requests where id = $1", [firstRequestId]);
    assert.equal(retained.rows[0].user_id, null);
    assert.match(retained.rows[0].subject_reference_hash, /^sha256:[a-f0-9]{64}$/);
  });
}
