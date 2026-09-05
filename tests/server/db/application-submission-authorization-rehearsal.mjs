import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PostgresApplicationMaterialPreview } from "../../../src/server/student/postgres-application-material-preview.ts";
import { PostgresApplicationSubmissionAuthorization } from "../../../src/server/student/postgres-application-submission-authorization.ts";
import { PostgresMaterialSelection } from "../../../src/server/student/postgres-material-selection.ts";
import { createAuditFailureFixture, snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";
import { gateSelectionClient, waitForSelectionBlock } from "./material-selection-fixture.mjs";
import { approvedNotice, publishNotice } from "./notices-fixture.mjs";
import { approvePolicy, policyPublishInput, policyWithdrawInput } from "./official-submission-policy-fixture.mjs";
import {
  applicationSubmissionAuthorizationFixture,
  clearApplicationSubmissionAuthorizations,
} from "./application-submission-authorization-fixture.mjs";

const rejected = status => error => error.status === status;

async function isolated(pool, work) {
  await clearApplicationSubmissionAuthorizations(pool);
  const fixture = await applicationSubmissionAuthorizationFixture(pool);
  try { return await work(fixture); }
  finally { await clearApplicationSubmissionAuthorizations(pool); }
}

export async function runApplicationSubmissionAuthorizationRehearsal(t, pool) {
  await t.test("program application authorization records exact evidence and idempotent replay without disclosure", async () => {
    await isolated(pool, async f => {
      const key = randomUUID(), first = await f.recordAuthorization(f.authorizationInput, key);
      assert.equal(first.status, "active"); assert.equal(first.canSubmit, false); assert.equal(first.freshness.current, true);
      assert.equal(first.confirmation.format, "cuac.application-submission-authorization.v2");
      assert.deepEqual(first.officialSubmissionPolicy, f.authorizationInput.expectedPolicy);
      assert.deepEqual(first.target, { applicationSetId: f.set.id, choiceId: f.choice.id, schoolId: f.catalog.schoolId,
        programId: f.catalog.programId, programIntakeId: f.catalog.intakeId });
      assert.equal(first.material.contentSha256, f.preview.contentSha256);
      assert.equal(first.notice.versionId, f.notice.versionId);
      assert.deepEqual(await f.getAuthorization(), first);
      const preflight = await f.get(); assert.equal(preflight.submissionAuthorization.id, first.id);
      assert.equal(preflight.submissionAuthorization.current, true);
      assert.ok(!preflight.platformBlockers.includes("SUBMISSION_AUTHORIZATION_UNAVAILABLE"));
      assert.equal(preflight.canSubmit, false);
      assert.deepEqual(await f.recordAuthorization(f.authorizationInput, key), first);
      assert.deepEqual(await f.recordAuthorization(f.authorizationInput, randomUUID()), first);
      await assert.rejects(f.recordAuthorization({ ...f.authorizationInput, materialContentSha256: "c".repeat(64) }, key), rejected(409));
      const rows = (await pool.query("select * from application_submission_authorizations where application_choice_id = $1", [f.choice.id])).rows;
      assert.equal(rows.length, 1); assert.deepEqual(rows[0].selection_json, f.savedSelection.selection);
      assert.equal(rows[0].authorization_format, "cuac.application-submission-authorization.v2");
      assert.equal(rows[0].admission_route_key, f.policy.admissionRouteKey);
      assert.equal(rows[0].policy_version_id, f.policy.versionId);
      assert.doesNotMatch(JSON.stringify(rows), /PRIVATE_|private-applicant|7\.50|student_notes/i);
      assert.equal((await pool.query("select count(*)::int as n from student_application_command_receipts where operation = 'application_authorization.record' and resource_id = $1", [first.id])).rows[0].n, 2);
      const audits = (await pool.query("select action, metadata_json from audit_logs where resource_id = $1 order by created_at, id", [first.id])).rows;
      assert.deepEqual(audits.map(row => row.action), ["student.application_submission_authorization.record", "student.application_command.replay"]);
      assert.doesNotMatch(JSON.stringify(audits), /PRIVATE_|private-applicant|7\.50/i);
      assert.equal((await pool.query("select count(*)::int as n from school_applications where application_choice_id = $1", [f.choice.id])).rows[0].n, 0);
    });
  });

  await t.test("same school programs remain independent program applications and authorization rows", async () => {
    await isolated(pool, async f => {
      const first = await f.recordAuthorization();
      const program = (await pool.query("insert into programs (school_id,slug,name_en,degree_level,status) values ($1,$2,'Second program','master','active') returning id",
        [f.catalog.schoolId, randomUUID()])).rows[0];
      const intake = (await pool.query("insert into program_intakes (program_id,intake_term,intake_year,status,open_date,deadline_date) values ($1,'fall',2028,'open',now()-interval '1 day',now()+interval '1 day') returning id",
        [program.id])).rows[0];
      const choice = await f.student.addOwnApplicationChoice(f.context, { applicationSetId: f.set.id, schoolId: f.catalog.schoolId,
        programId: program.id, programIntakeId: intake.id }, { idempotencyKey: randomUUID() });
      const secondPolicyVersion = await approvePolicy(f.policyFixture, randomUUID(), undefined,
        [{ programId: program.id, programIntakeId: intake.id }]);
      await f.policyFixture.service.publish(f.policyFixture.reviewer, f.policyFixture.schoolId, f.policyFixture.policyKey,
        f.policyFixture.admissionRouteKey, policyPublishInput(secondPolicyVersion));
      const currentSet = await f.student.getOwnApplicationSet(f.context, f.set.id);
      await f.student.updateOwnApplicationChoice(f.context, f.set.id, choice.id,
        { expectedRevision: currentSet.revision, admissionRouteKey: f.policyFixture.admissionRouteKey });
      const request = await f.request(), selectionService = new PostgresMaterialSelection(f.client);
      const saved = await selectionService.put(f.context, f.set.id, choice.id, { expectedRevision: 0, ...request });
      const preview = await new PostgresApplicationMaterialPreview(f.client).preview(f.context, f.set.id, choice.id, request);
      const secondPolicy = await f.policyFixture.getPublished({ programId: program.id, programIntakeId: intake.id });
      const value = { ...f.authorizationInput, expectedMaterialSelectionRevision: saved.revision,
        expectedVersions: saved.savedVersions, materialContentSha256: preview.contentSha256,
        expectedPolicy: { admissionRouteKey: secondPolicy.admissionRouteKey, versionId: secondPolicy.versionId,
          publicationRevision: secondPolicy.publicationRevision, documentSha256: secondPolicy.documentSha256 } };
      const second = await f.recordAuthorization(value, randomUUID(), { choiceId: choice.id });
      assert.equal(first.target.schoolId, second.target.schoolId);
      assert.notEqual(first.target.choiceId, second.target.choiceId);
      assert.notEqual(first.target.programId, second.target.programId);
      assert.notEqual(first.target.programIntakeId, second.target.programIntakeId);
      assert.notEqual(first.confirmation.scopeSha256, second.confirmation.scopeSha256);
      const rows = (await pool.query("select application_choice_id,program_id,program_intake_id,status from application_submission_authorizations where application_set_id = $1 order by application_choice_id", [f.set.id])).rows;
      assert.equal(rows.length, 2); assert.ok(rows.every(row => row.status === "active"));
    });
  });

  await t.test("source and notice changes stale old evidence; fresh authorization supersedes it and withdrawal is idempotent", async () => {
    await isolated(pool, async f => {
      const first = await f.recordAuthorization();
      await f.student.updateOwnApplicantProfile(f.context, { expectedRevision: 1, fullName: "CHANGED_PRIVATE_NAME" });
      const stale = await f.getAuthorization(); assert.equal(stale.freshness.current, false);
      assert.ok(stale.freshness.reasons.includes("SOURCE_VERSIONS_CHANGED"));
      await assert.rejects(f.recordAuthorization(f.authorizationInput, randomUUID()), rejected(409));
      const freshRequest = await f.request();
      const saved = await f.selectionService.put(f.context, f.set.id, f.choice.id, { expectedRevision: 1, ...freshRequest });
      const preview = await f.materialReader.preview(f.context, f.set.id, f.choice.id, freshRequest);
      const second = await f.recordAuthorization({ ...f.authorizationInput, expectedMaterialSelectionRevision: saved.revision,
        expectedVersions: saved.savedVersions, materialContentSha256: preview.contentSha256 }, randomUUID());
      assert.notEqual(second.id, first.id); assert.equal(second.status, "active");
      const prior = (await pool.query("select status,end_reason from application_submission_authorizations where id = $1", [first.id])).rows[0];
      assert.deepEqual(prior, { status: "superseded", end_reason: "reauthorized" });
      const withdrawn = await f.withdrawAuthorization(second.id); assert.equal(withdrawn.status, "withdrawn");
      assert.equal(withdrawn.endReason, "student_withdrawal"); assert.equal(withdrawn.freshness.current, false);
      assert.deepEqual(await f.withdrawAuthorization(second.id), withdrawn);
      assert.equal((await pool.query("select count(*)::int as n from audit_logs where resource_id = $1 and action = 'student.application_submission_authorization.withdraw'", [second.id])).rows[0].n, 1);
    });
  });

  await t.test("policy withdrawal and publication revision changes stale only the bound project authorization", async () => {
    await isolated(pool, async f => {
      const first = await f.recordAuthorization();
      const withdrawnPublications = await f.policyFixture.service.withdraw(f.policyFixture.reviewer,
        f.policyFixture.schoolId, f.policyFixture.policyKey, f.policyFixture.admissionRouteKey,
        policyWithdrawInput(f.approvedPolicy, f.policyPublications));
      const stale = await f.getAuthorization();
      assert.equal(stale.id, first.id); assert.equal(stale.freshness.current, false);
      assert.ok(stale.freshness.reasons.includes("OFFICIAL_SUBMISSION_POLICY_CHANGED"));
      const blocked = await f.get();
      assert.equal(blocked.submissionAuthorization.current, false);
      assert.ok(blocked.platformBlockers.includes("SUBMISSION_AUTHORIZATION_UNAVAILABLE"));
      assert.ok(blocked.platformBlockers.includes("OFFICIAL_SUBMISSION_POLICY_UNAVAILABLE"));
      await assert.rejects(f.recordAuthorization(f.authorizationInput, randomUUID()), rejected(409));

      await f.policyFixture.service.publish(f.policyFixture.reviewer, f.policyFixture.schoolId,
        f.policyFixture.policyKey, f.policyFixture.admissionRouteKey,
        policyPublishInput(f.approvedPolicy, withdrawnPublications));
      const currentPolicy = await f.policyFixture.getPublished({ programId: f.catalog.programId,
        programIntakeId: f.catalog.intakeId });
      const second = await f.recordAuthorization({ ...f.authorizationInput,
        expectedPolicy: { admissionRouteKey: currentPolicy.admissionRouteKey, versionId: currentPolicy.versionId,
          publicationRevision: currentPolicy.publicationRevision, documentSha256: currentPolicy.documentSha256 } }, randomUUID());
      assert.notEqual(second.id, first.id); assert.equal(second.freshness.current, true);
      assert.deepEqual((await pool.query("select status,end_reason from application_submission_authorizations where id = $1",
        [first.id])).rows[0], { status: "superseded", end_reason: "reauthorized" });
    });
  });

  await t.test("changing one project route invalidates only that program authorization", async () => {
    await isolated(pool, async f => {
      const recorded = await f.recordAuthorization();
      const currentSet = await f.student.getOwnApplicationSet(f.context, f.set.id);
      await f.student.updateOwnApplicationChoice(f.context, f.set.id, f.choice.id,
        { expectedRevision: currentSet.revision, admissionRouteKey: null });
      const stale = await f.getAuthorization();
      assert.equal(stale.id, recorded.id); assert.equal(stale.freshness.current, false);
      assert.ok(stale.freshness.reasons.includes("ADMISSION_ROUTE_CHANGED"));
      assert.ok(stale.freshness.reasons.includes("SOURCE_VERSIONS_CHANGED"));
      await assert.rejects(f.recordAuthorization(f.authorizationInput, randomUUID()), rejected(409));
    });
  });

  await t.test("policy publication stays share-locked until the authorization transaction commits", async () => {
    await isolated(pool, async f => {
      const gate = gateSelectionClient(f.client, sql => sql.includes("official_submission_policy_publications")
        && sql.includes("for share of pub, v, selected_target"));
      const service = new PostgresApplicationSubmissionAuthorization(gate.client);
      let authorization, withdrawal;
      try {
        authorization = service.record(f.context, f.set.id, f.choice.id, f.authorizationInput, randomUUID());
        const authorizationPid = await gate.ready;
        withdrawal = f.policyFixture.service.withdraw(f.policyFixture.reviewer, f.policyFixture.schoolId,
          f.policyFixture.policyKey, f.policyFixture.admissionRouteKey,
          policyWithdrawInput(f.approvedPolicy, f.policyPublications));
        await waitForSelectionBlock(pool, authorizationPid);
        gate.release();
        const [recorded, withdrawn] = await Promise.all([authorization, withdrawal]);
        assert.equal(recorded.confirmation.format, "cuac.application-submission-authorization.v2");
        assert.ok(withdrawn.every(publication => publication.status === "withdrawn"));
        const stale = await f.getAuthorization();
        assert.equal(stale.id, recorded.id); assert.equal(stale.freshness.current, false);
        assert.ok(stale.freshness.reasons.includes("OFFICIAL_SUBMISSION_POLICY_CHANGED"));
      } finally {
        gate.release();
        await Promise.allSettled([authorization, withdrawal].filter(Boolean));
      }
    });
  });

  await t.test("authorization rejects foreign owners, changed notice, closed window and existing school application", async () => {
    await isolated(pool, async f => {
      const other = await applicationSubmissionAuthorizationFixture(pool);
      try {
        await assert.rejects(f.service.get(other.context, f.set.id, f.choice.id), rejected(403));
        await assert.rejects(f.service.record(other.context, f.set.id, f.choice.id, f.authorizationInput, randomUUID()), rejected(403));
      } finally {
        await pool.query("delete from student_application_command_receipts where user_id = $1 and operation = 'application_authorization.record'", [other.userId]);
      }
      const nextNotice = await approvedNotice(f.notices);
      await publishNotice(f.notices, nextNotice, f.notice.publicationRevision);
      await assert.rejects(f.recordAuthorization(f.authorizationInput, randomUUID()), rejected(409));
      const currentNotice = await f.notices.get();
      const currentInput = { ...f.authorizationInput, expectedNotice: { versionId: currentNotice.versionId,
        publicationRevision: currentNotice.publicationRevision, contentSha256: currentNotice.contentSha256 } };
      await pool.query("update program_intakes set deadline_date = now() - interval '1 second' where id = $1", [f.catalog.intakeId]);
      await assert.rejects(f.recordAuthorization(currentInput, randomUUID()), rejected(409));
      await pool.query("update program_intakes set deadline_date = now() + interval '1 day' where id = $1", [f.catalog.intakeId]);
      await pool.query("insert into school_applications (application_record_format,application_set_id,application_choice_id,student_user_id,school_id,program_id,program_intake_id) values ('cuac.program-application.v1',$1,$2,$3,$4,$5,$6)",
        [f.set.id, f.choice.id, f.userId, f.catalog.schoolId, f.catalog.programId, f.catalog.intakeId]);
      await assert.rejects(f.recordAuthorization(currentInput, randomUUID()), rejected(409));
      assert.equal(await f.getAuthorization(), null);
    });
  });

  await t.test("concurrent exact authorizations converge and audit failure rolls back evidence and receipt", async () => {
    await isolated(pool, async f => {
      const results = await Promise.all([f.recordAuthorization(f.authorizationInput, randomUUID()),
        f.recordAuthorization(f.authorizationInput, randomUUID())]);
      assert.equal(results[0].id, results[1].id);
      assert.equal((await pool.query("select count(*)::int as n from application_submission_authorizations where application_choice_id = $1", [f.choice.id])).rows[0].n, 1);
      assert.equal((await pool.query("select count(*)::int as n from student_application_command_receipts where resource_id = $1", [results[0].id])).rows[0].n, 2);
    });
    await isolated(pool, async f => {
      const faults = await createAuditFailureFixture(pool);
      try {
        const before = await snapshotAuditedBusinessTables(pool);
        await faults.during("student.application_submission_authorization.record", () => assert.rejects(f.recordAuthorization(), error => error.code === "P0001"));
        assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
        assert.equal(await f.getAuthorization(), null);
      } finally { await faults.close(); }
    });
  });

  await t.test("choice removal ends active disclosure evidence and database constraints protect target scope", async () => {
    await isolated(pool, async f => {
      const authorization = await f.recordAuthorization();
      const removed = await f.student.removeOwnApplicationChoice(f.context, f.set.id, f.choice.id);
      assert.equal(removed.status, "removed");
      const row = (await pool.query("select status,end_reason,ended_at from application_submission_authorizations where id = $1", [authorization.id])).rows[0];
      assert.equal(row.status, "withdrawn"); assert.equal(row.end_reason, "choice_removed"); assert.ok(row.ended_at instanceof Date);
      const ended = await f.getAuthorization(); assert.equal(ended.id, authorization.id); assert.equal(ended.status, "withdrawn");
      assert.ok(ended.freshness.reasons.includes("CHOICE_CHANGED"));
      const audit = (await pool.query("select metadata_json from audit_logs where resource_id = $1 and action = 'student.application_choice.remove'", [f.choice.id])).rows[0];
      assert.equal(audit.metadata_json.disclosureEvidenceEnded, true);
    });
    await isolated(pool, async f => {
      const authorization = await f.recordAuthorization();
      await assert.rejects(pool.query("update application_submission_authorizations set program_id = $2 where id = $1", [authorization.id, randomUUID()]), error => error.code === "23503");
      await assert.rejects(pool.query("update application_submission_authorizations set scope_sha256 = 'bad' where id = $1", [authorization.id]), error => error.code === "23514");
      await assert.rejects(pool.query("update application_submission_authorizations set target_key = '/' where id = $1", [authorization.id]), error => error.code === "428C9");
      for (const column of ["admission_route_key", "policy_version_id", "policy_publication_revision",
        "policy_document_sha256", "policy_target_set_sha256", "policy_approval_sha256"]) {
        await assert.rejects(pool.query(`update application_submission_authorizations set ${column} = null where id = $1`,
          [authorization.id]), error => error.code === "23514"
            && error.constraint === "application_submission_authorization_policy_binding_check");
      }
    });
  });
}
