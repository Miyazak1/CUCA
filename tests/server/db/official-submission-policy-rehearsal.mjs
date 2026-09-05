import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createAuditFailureFixture, snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";
import {
  approvePolicy,
  officialSubmissionPolicyFixture,
  policyApproveInput,
  policyPrepareInput,
  policyPublishInput,
  policyWithdrawInput,
  preparePolicy,
} from "./official-submission-policy-fixture.mjs";
import { policyDocument } from "../submission-policy/fixture.mjs";

export async function runOfficialSubmissionPolicyRehearsal(t, pool) {
  const logs = async fixture => (await pool.query(`select action,metadata_json,allowed from audit_logs
    where metadata_json->>'schoolId' = $1 and action like 'catalog.official_submission_policy.%' order by created_at,id`, [fixture.schoolId])).rows;

  await t.test("official policy prepares approves publishes and withdraws one reviewed rule across independent program targets", async () => {
    const f = await officialSubmissionPolicyFixture(pool), id = randomUUID();
    const draft = await preparePolicy(f, id);
    assert.equal(draft.status, "draft");
    assert.equal(draft.targets.length, 2);
    assert.equal((await pool.query("select count(*)::int as n from official_submission_policy_publications where school_id = $1", [f.schoolId])).rows[0].n, 0);
    const beforeReplay = await snapshotAuditedBusinessTables(pool);
    assert.deepEqual(await preparePolicy(f, id), draft);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), beforeReplay);
    const approved = await f.service.approve(f.reviewer, f.schoolId, f.policyKey, f.admissionRouteKey, policyApproveInput(draft));
    assert.equal(approved.status, "approved");
    assert.equal(approved.review.preparedByUserId, f.preparerId);
    assert.equal(approved.review.reviewedByUserId, f.reviewerId);
    const published = await f.service.publish(f.reviewer, f.schoolId, f.policyKey, f.admissionRouteKey, policyPublishInput(approved));
    assert.equal(published.length, 2);
    assert.ok(published.every(row => row.status === "active" && row.revision === 1 && row.versionId === id));
    for (const target of f.targets) {
      const dto = await f.getPublished(target);
      assert.deepEqual(dto.rule, { formMode: "one_program_per_form", maxProgramChoices: 2, orderingMode: "none", externalChannelType: "university_portal" });
      assert.equal(dto.programId, target.programId); assert.equal(dto.programIntakeId, target.programIntakeId);
      assert.equal(dto.versionId, id); assert.equal(dto.admissionRouteKey, f.admissionRouteKey);
      assert.doesNotMatch(JSON.stringify(dto), /sources|preparedBy|reviewedBy|officialSourceConfirmed/);
    }
    assert.equal(await f.getPublished(f.targets[0], "csc"), null);
    assert.equal((await pool.query("select count(*)::int as total from official_submission_groups where policy_version_id = $1",
      [id])).rows[0].total, 0);
    const afterPublish = await snapshotAuditedBusinessTables(pool);
    assert.deepEqual(await f.service.publish(f.reviewer, f.schoolId, f.policyKey, f.admissionRouteKey, policyPublishInput(approved)), published);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), afterPublish);
    const withdrawn = await f.service.withdraw(f.reviewer, f.schoolId, f.policyKey, f.admissionRouteKey, policyWithdrawInput(approved, published));
    assert.ok(withdrawn.every(row => row.status === "withdrawn" && row.revision === 2));
    assert.equal(await f.getPublished(f.targets[0]), null); assert.equal(await f.getPublished(f.targets[1]), null);
    assert.deepEqual((await logs(f)).map(row => row.action), ["prepare", "approve", "publish", "withdraw"].map(action => `catalog.official_submission_policy.${action}`));
    assert.doesNotMatch(JSON.stringify(await logs(f)), /admissions\.example|sourceChecks|reviewDueAt|programIntakeId/);
  });

  await t.test("policy scope rejects route guessing cross-school targets and target rebinding", async () => {
    const f = await officialSubmissionPolicyFixture(pool), document = policyDocument(f.admissionRouteKey);
    await assert.rejects(preparePolicy(f, randomUUID(), document, [f.otherTarget]), error => error.status === 403);
    await assert.rejects(f.service.createDraft(f.preparer, f.schoolId, f.policyKey, f.admissionRouteKey,
      policyPrepareInput(f, randomUUID(), policyDocument("csc"), f.targets)), error => error.status === 400);
    const version = await preparePolicy(f, randomUUID());
    await assert.rejects(f.service.getVersion(f.reviewer, f.otherSchoolId, f.policyKey, f.admissionRouteKey, version.versionId), error => error.status === 403);
    await assert.rejects(pool.query(`insert into official_submission_policy_version_targets
      (policy_version_id,school_id,program_id,program_intake_id,admission_route_key)
      values ($1,$2,$3,$4,$5)`, [version.versionId, f.schoolId, f.otherTarget.programId, f.otherTarget.programIntakeId, f.admissionRouteKey]),
    error => error.code === "23503");
    await assert.rejects(pool.query("update official_submission_policy_version_targets set admission_route_key = 'csc' where policy_version_id = $1", [version.versionId]),
      error => error.code === "23503");
    assert.equal((await pool.query("select count(*)::int as n from official_submission_policy_version_targets where policy_version_id = $1", [version.versionId])).rows[0].n, 2);
  });

  await t.test("per-target publication CAS requires explicit withdrawal before replacement and never resurrects an older rule", async () => {
    const f = await officialSubmissionPolicyFixture(pool);
    const first = await approvePolicy(f), second = await approvePolicy(f);
    const one = await f.service.publish(f.reviewer, f.schoolId, f.policyKey, f.admissionRouteKey, policyPublishInput(first));
    await assert.rejects(f.service.publish(f.reviewer, f.schoolId, f.policyKey, f.admissionRouteKey, policyPublishInput(second)), error => error.status === 409);
    const oneWithdrawn = await f.service.withdraw(f.reviewer, f.schoolId, f.policyKey, f.admissionRouteKey, policyWithdrawInput(first, one));
    const two = await f.service.publish(f.reviewer, f.schoolId, f.policyKey, f.admissionRouteKey, policyPublishInput(second, oneWithdrawn));
    assert.ok(two.every(row => row.revision === 3 && row.versionId === second.versionId));
    await assert.rejects(f.service.withdraw(f.reviewer, f.schoolId, f.policyKey, f.admissionRouteKey, policyWithdrawInput(first, one)), error => error.status === 409);
    await assert.rejects(f.service.publish(f.reviewer, f.schoolId, f.policyKey, f.admissionRouteKey, policyPublishInput(first, two)), error => error.status === 409);
    const twoWithdrawn = await f.service.withdraw(f.reviewer, f.schoolId, f.policyKey, f.admissionRouteKey, policyWithdrawInput(second, two));
    const third = await approvePolicy(f, undefined, undefined, [f.targets[0]]);
    const expected = twoWithdrawn.filter(row => row.programIntakeId === f.targets[0].programIntakeId);
    const three = await f.service.publish(f.reviewer, f.schoolId, f.policyKey, f.admissionRouteKey, policyPublishInput(third, expected));
    assert.equal(three.length, 1); assert.equal(three[0].revision, 5);
    assert.equal((await f.getPublished(f.targets[0])).versionId, third.versionId);
    assert.equal(await f.getPublished(f.targets[1]), null);
  });

  await t.test("published reader fails closed on digest tampering and never falls back to another route or version", async () => {
    const f = await officialSubmissionPolicyFixture(pool), approved = await approvePolicy(f);
    const published = await f.service.publish(f.reviewer, f.schoolId, f.policyKey, f.admissionRouteKey, policyPublishInput(approved));
    const target = f.targets[0], current = await f.getPublished(target);
    await pool.query(`update official_submission_policy_publications set approval_sha256 = $3
      where program_intake_id = $1 and admission_route_key = $2`, [target.programIntakeId, f.admissionRouteKey, "f".repeat(64)]);
    await assert.rejects(f.getPublished(target), error => error.status === 503);
    assert.equal(await f.getPublished(target, "csc"), null);
    await pool.query(`update official_submission_policy_publications set approval_sha256 = $3
      where program_intake_id = $1 and admission_route_key = $2`, [target.programIntakeId, f.admissionRouteKey, published[0].approvalSha256]);
    assert.deepEqual(await f.getPublished(target), current);
  });

  await t.test("policy governance rechecks live account role and distinct reviewer authority", async () => {
    const f = await officialSubmissionPolicyFixture(pool), draft = await preparePolicy(f);
    await assert.rejects(f.service.approve(f.preparer, f.schoolId, f.policyKey, f.admissionRouteKey, policyApproveInput(draft)), error => error.status === 403);
    await pool.query("insert into user_roles (user_id,role) values ($1,'cuac_admin')", [f.preparerId]);
    const forgedSelf = { ...f.preparer, activeRole: "cuac_admin", authStrength: "step_up" };
    await assert.rejects(f.service.approve(forgedSelf, f.schoolId, f.policyKey, f.admissionRouteKey, policyApproveInput(draft)), error => error.status === 409);
    await pool.query("update user_roles set revoked_at = clock_timestamp() where user_id = $1 and role = 'cuac_admin'", [f.reviewerId]);
    for (const operation of [
      () => f.service.getVersion(f.reviewer, f.schoolId, f.policyKey, f.admissionRouteKey, draft.versionId),
      () => f.service.listVersions(f.reviewer, f.schoolId, f.policyKey, f.admissionRouteKey),
      () => f.service.approve(f.reviewer, f.schoolId, f.policyKey, f.admissionRouteKey, policyApproveInput(draft)),
    ]) await assert.rejects(operation(), error => error.status === 403);
  });

  await t.test("policy audit failures roll back version target approval publication and withdrawal together", async () => {
    const f = await officialSubmissionPolicyFixture(pool), fault = await createAuditFailureFixture(pool);
    try {
      let before = await snapshotAuditedBusinessTables(pool);
      await fault.during("catalog.official_submission_policy.prepare", () => assert.rejects(preparePolicy(f), error => error.code === "P0001"));
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      const draft = await preparePolicy(f); before = await snapshotAuditedBusinessTables(pool);
      await fault.during("catalog.official_submission_policy.approve", () => assert.rejects(
        f.service.approve(f.reviewer, f.schoolId, f.policyKey, f.admissionRouteKey, policyApproveInput(draft)), error => error.code === "P0001"));
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      const approved = await f.service.approve(f.reviewer, f.schoolId, f.policyKey, f.admissionRouteKey, policyApproveInput(draft));
      before = await snapshotAuditedBusinessTables(pool);
      await fault.during("catalog.official_submission_policy.publish", () => assert.rejects(
        f.service.publish(f.reviewer, f.schoolId, f.policyKey, f.admissionRouteKey, policyPublishInput(approved)), error => error.code === "P0001"));
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      const published = await f.service.publish(f.reviewer, f.schoolId, f.policyKey, f.admissionRouteKey, policyPublishInput(approved));
      before = await snapshotAuditedBusinessTables(pool);
      await fault.during("catalog.official_submission_policy.withdraw", () => assert.rejects(
        f.service.withdraw(f.reviewer, f.schoolId, f.policyKey, f.admissionRouteKey, policyWithdrawInput(approved, published)), error => error.code === "P0001"));
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    } finally { await fault.close(); }
  });

  await t.test("concurrent drafts allocate serial versions and competing approvals or publications have one winner", async () => {
    const f = await officialSubmissionPolicyFixture(pool);
    const drafts = await Promise.all([preparePolicy(f), preparePolicy(f)]);
    assert.deepEqual(drafts.map(value => value.version).sort((a, b) => a - b), [1, 2]);
    const id = randomUUID(), repeated = await Promise.all([preparePolicy(f, id), preparePolicy(f, id)]);
    assert.deepEqual(repeated[0], repeated[1]);
    const approvalInput = policyApproveInput(drafts[0]);
    const approvals = await Promise.allSettled([
      f.service.approve(f.reviewer, f.schoolId, f.policyKey, f.admissionRouteKey, approvalInput),
      f.service.approve(f.otherReviewer, f.schoolId, f.policyKey, f.admissionRouteKey, approvalInput),
    ]);
    assert.equal(approvals.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(approvals.find(result => result.status === "rejected").reason.status, 409);
    const approvedOne = approvals.find(result => result.status === "fulfilled").value;
    const approvedTwo = await f.service.approve(f.reviewer, f.schoolId, f.policyKey, f.admissionRouteKey, policyApproveInput(drafts[1]));
    const publications = await Promise.allSettled([
      f.service.publish(f.reviewer, f.schoolId, f.policyKey, f.admissionRouteKey, policyPublishInput(approvedOne)),
      f.service.publish(f.reviewer, f.schoolId, f.policyKey, f.admissionRouteKey, policyPublishInput(approvedTwo)),
    ]);
    assert.equal(publications.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(publications.find(result => result.status === "rejected").reason.status, 409);
  });
}
