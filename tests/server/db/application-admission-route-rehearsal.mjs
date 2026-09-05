import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { PostgresApplicationPreflight } from "../../../src/server/student/postgres-application-preflight.ts";
import { createPostgresStudentService } from "../../../src/server/student/runtime/routes.ts";
import { createAuditFailureFixture, snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";
import { approvePolicy, officialSubmissionPolicyFixture, policyPublishInput, policyWithdrawInput } from "./official-submission-policy-fixture.mjs";

async function studentFixture(pool, service, schoolId, target) {
  const email = `route-${randomUUID()}@example.invalid`;
  const user = (await pool.query("insert into users (email,email_normalized) values ($1,$1) returning id", [email])).rows[0];
  await pool.query("insert into user_roles (user_id,role) values ($1,'student')", [user.id]);
  const context = createRequestContext({ actorUserId: user.id, activeRole: "student", selectedSurface: "student", purpose: "student_action" });
  const set = await service.createOwnApplicationSet(context, { name: "Route fixture" }, { idempotencyKey: randomUUID() });
  const choice = await service.addOwnApplicationChoice(context, { applicationSetId: set.id, schoolId,
    programId: target.programId, programIntakeId: target.programIntakeId }, { idempotencyKey: randomUUID() });
  return { context, set: await service.getOwnApplicationSet(context, set.id), choice };
}

export async function runApplicationAdmissionRouteRehearsal(t, pool) {
  const client = createTransactionalSqlClient(pool), service = createPostgresStudentService(client);

  await t.test("existing and new choices have no inferred route and invalid route syntax is rejected by PostgreSQL", async () => {
    const policy = await officialSubmissionPolicyFixture(pool);
    const f = await studentFixture(pool, service, policy.schoolId, policy.targets[0]);
    assert.equal(f.choice.admissionRouteKey, null);
    assert.equal((await pool.query("select admission_route_key from application_choices where id = $1", [f.choice.id])).rows[0].admission_route_key, null);
    await assert.rejects(pool.query("update application_choices set admission_route_key = 'Direct University' where id = $1", [f.choice.id]),
      error => error.code === "23514" && error.constraint === "application_choices_admission_route_check");
  });

  await t.test("non-null route requires a current reviewed exact-target policy for create and edit", async () => {
    const policy = await officialSubmissionPolicyFixture(pool);
    const f = await studentFixture(pool, service, policy.schoolId, policy.targets[0]);
    await assert.rejects(service.updateOwnApplicationChoice(f.context, f.set.id, f.choice.id,
      { expectedRevision: f.set.revision, admissionRouteKey: policy.admissionRouteKey }), error => error.status === 409);
    await assert.rejects(service.addOwnApplicationChoice(f.context, { applicationSetId: f.set.id, schoolId: policy.schoolId,
      programId: policy.targets[1].programId, programIntakeId: policy.targets[1].programIntakeId,
      admissionRouteKey: policy.admissionRouteKey }, { idempotencyKey: randomUUID() }), error => error.status === 403);

    const approved = await approvePolicy(policy, randomUUID());
    await policy.service.publish(policy.reviewer, policy.schoolId, policy.policyKey, policy.admissionRouteKey, policyPublishInput(approved));
    const changed = await service.updateOwnApplicationChoice(f.context, f.set.id, f.choice.id,
      { expectedRevision: f.set.revision, admissionRouteKey: policy.admissionRouteKey });
    assert.equal(changed.revision, f.set.revision + 1);
    assert.equal(changed.choices[0].admissionRouteKey, policy.admissionRouteKey);
    const sibling = await service.addOwnApplicationChoice(f.context, { applicationSetId: f.set.id, schoolId: policy.schoolId,
      programId: policy.targets[1].programId, programIntakeId: policy.targets[1].programIntakeId,
      admissionRouteKey: policy.admissionRouteKey }, { idempotencyKey: randomUUID() });
    assert.equal(sibling.admissionRouteKey, policy.admissionRouteKey);
    await assert.rejects(service.updateOwnApplicationChoice(f.context, f.set.id, f.choice.id,
      { expectedRevision: changed.revision + 1, admissionRouteKey: "csc" }), error => error.status === 409);

    const other = await studentFixture(pool, service, policy.otherSchoolId, policy.otherTarget);
    await assert.rejects(service.updateOwnApplicationChoice(other.context, other.set.id, other.choice.id,
      { expectedRevision: other.set.revision, admissionRouteKey: policy.admissionRouteKey }), error => error.status === 409);
  });

  await t.test("route change advances the parent revision clears old preparation and leaves same-school siblings independent", async () => {
    const policy = await officialSubmissionPolicyFixture(pool), approved = await approvePolicy(policy, randomUUID());
    await policy.service.publish(policy.reviewer, policy.schoolId, policy.policyKey, policy.admissionRouteKey, policyPublishInput(approved));
    const f = await studentFixture(pool, service, policy.schoolId, policy.targets[0]);
    const sibling = await service.addOwnApplicationChoice(f.context, { applicationSetId: f.set.id, schoolId: policy.schoolId,
      programId: policy.targets[1].programId, programIntakeId: policy.targets[1].programIntakeId }, { idempotencyKey: randomUUID() });
    f.set = await service.getOwnApplicationSet(f.context, f.set.id);
    await pool.query("update application_choices set requirement_snapshot_json = '{\"old\":true}' where id = $1", [f.choice.id]);
    const result = await service.updateOwnApplicationChoice(f.context, f.set.id, f.choice.id,
      { expectedRevision: f.set.revision, admissionRouteKey: policy.admissionRouteKey });
    assert.equal(result.revision, f.set.revision + 1);
    assert.equal(result.choices.find(choice => choice.id === f.choice.id).admissionRouteKey, policy.admissionRouteKey);
    assert.equal(result.choices.find(choice => choice.id === sibling.id).admissionRouteKey, null);
    assert.deepEqual((await pool.query("select requirement_snapshot_json from application_choices where id = $1", [f.choice.id])).rows[0].requirement_snapshot_json, {});
    const cleared = await service.updateOwnApplicationChoice(f.context, f.set.id, f.choice.id,
      { expectedRevision: result.revision, admissionRouteKey: null });
    assert.equal(cleared.choices.find(choice => choice.id === f.choice.id).admissionRouteKey, null);
  });

  await t.test("route edits are CAS protected and audit failure rolls back route revision and metadata", async () => {
    const policy = await officialSubmissionPolicyFixture(pool), approved = await approvePolicy(policy, randomUUID());
    await policy.service.publish(policy.reviewer, policy.schoolId, policy.policyKey, policy.admissionRouteKey, policyPublishInput(approved));
    const f = await studentFixture(pool, service, policy.schoolId, policy.targets[0]);
    const attempts = await Promise.allSettled([1, 2].map(() => service.updateOwnApplicationChoice(f.context, f.set.id, f.choice.id,
      { expectedRevision: f.set.revision, admissionRouteKey: policy.admissionRouteKey })));
    assert.deepEqual(attempts.map(result => result.status).sort(), ["fulfilled", "rejected"]);
    assert.equal(attempts.find(result => result.status === "rejected").reason.status, 409);

    const next = await studentFixture(pool, service, policy.schoolId, policy.targets[0]);
    const before = await snapshotAuditedBusinessTables(pool), faults = await createAuditFailureFixture(pool);
    try {
      await faults.during("student.application_choice.update", async () => {
        await assert.rejects(service.updateOwnApplicationChoice(next.context, next.set.id, next.choice.id,
          { expectedRevision: next.set.revision, admissionRouteKey: policy.admissionRouteKey }), error => error.code === "P0001");
      });
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    } finally { await faults.close(); }
  });

  await t.test("preflight resolves policy from the stored route only and withdrawal restores the blocker", async () => {
    const policy = await officialSubmissionPolicyFixture(pool), approved = await approvePolicy(policy, randomUUID());
    const publications = await policy.service.publish(policy.reviewer, policy.schoolId, policy.policyKey,
      policy.admissionRouteKey, policyPublishInput(approved));
    const f = await studentFixture(pool, service, policy.schoolId, policy.targets[0]);
    f.set = await service.getOwnApplicationSet(f.context, f.set.id);
    let report = await new PostgresApplicationPreflight(client).get(f.context, f.set.id, f.choice.id, "en");
    assert.equal(report.target.admissionRouteKey, null); assert.ok(report.issues.includes("ADMISSION_ROUTE_REQUIRED"));
    assert.ok(report.platformBlockers.includes("OFFICIAL_SUBMISSION_POLICY_UNAVAILABLE"));

    const selected = await service.updateOwnApplicationChoice(f.context, f.set.id, f.choice.id,
      { expectedRevision: f.set.revision, admissionRouteKey: policy.admissionRouteKey });
    report = await new PostgresApplicationPreflight(client).get(f.context, selected.id, f.choice.id, "en");
    assert.equal(report.target.admissionRouteKey, policy.admissionRouteKey);
    assert.equal(report.officialSubmissionPolicy.versionId, approved.versionId);
    assert.ok(!report.platformBlockers.includes("OFFICIAL_SUBMISSION_POLICY_UNAVAILABLE"));
    assert.ok(report.platformBlockers.includes("BILLING_ENTITLEMENT_UNAVAILABLE"));
    assert.ok(report.platformBlockers.includes("SUBMISSION_UNAVAILABLE"));
    assert.equal(report.canSubmit, false);
    assert.doesNotMatch(JSON.stringify(report), /preparedByUserId|approvedByUserId|reviewEvidence|sources|sourceChecks/);

    await policy.service.withdraw(policy.reviewer, policy.schoolId, policy.policyKey, policy.admissionRouteKey,
      policyWithdrawInput(approved, publications));
    const withdrawn = await new PostgresApplicationPreflight(client).get(f.context, selected.id, f.choice.id, "en");
    assert.equal(withdrawn.target.admissionRouteKey, policy.admissionRouteKey);
    assert.equal(withdrawn.officialSubmissionPolicy, null);
    assert.ok(withdrawn.platformBlockers.includes("OFFICIAL_SUBMISSION_POLICY_UNAVAILABLE"));
  });
}
