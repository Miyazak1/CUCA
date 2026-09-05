import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { ApplicationMaterialSnapshotCipher } from "../../../src/server/student/application-material-snapshot-envelope.ts";
import { PostgresApplicationMaterialSnapshot } from "../../../src/server/student/postgres-application-material-snapshot.ts";
import { PostgresApplicationMaterialPreview } from "../../../src/server/student/postgres-application-material-preview.ts";
import { PostgresMaterialSelection } from "../../../src/server/student/postgres-material-selection.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { createAuditFailureFixture, snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";
import { approvePolicy, policyPublishInput, policyWithdrawInput } from "./official-submission-policy-fixture.mjs";
import {
  applicationMaterialSnapshotFixture,
  clearApplicationMaterialSnapshots,
} from "./application-material-snapshot-fixture.mjs";

const rejected = status => error => error.status === status;

export async function runApplicationMaterialSnapshotRehearsal(t, pool) {
  async function isolated(work) {
    await clearApplicationMaterialSnapshots(pool);
    const f = await applicationMaterialSnapshotFixture(pool);
    try { return await work(f); }
    finally { await clearApplicationMaterialSnapshots(pool); }
  }

  await t.test("encrypted snapshot records one exact authorized project without creating a school application", async () => {
    await isolated(async f => {
      assert.equal(await f.getSnapshot(), null);
      const key = randomUUID(), snapshot = await f.createSnapshot(f.snapshotInput, key);
      assert.equal(snapshot.mode, "immutable_material_snapshot"); assert.equal(snapshot.persisted, true);
      assert.equal(snapshot.canSubmit, false); assert.equal(snapshot.freshness.current, true);
      assert.deepEqual(snapshot.target, { applicationSetId: f.set.id, choiceId: f.choice.id, schoolId: f.catalog.schoolId,
        programId: f.catalog.programId, programIntakeId: f.catalog.intakeId });
      assert.equal(snapshot.authorization.id, f.authorization.id);
      assert.deepEqual(await f.getSnapshot(), snapshot);
      assert.deepEqual(await f.createSnapshot(f.snapshotInput, key), snapshot);
      assert.deepEqual(await f.createSnapshot(f.snapshotInput, randomUUID()), snapshot);
      const preflight = await f.getSnapshotPreflight();
      assert.equal(preflight.materialSnapshot.id, snapshot.id); assert.equal(preflight.materialSnapshot.current, true);
      assert.ok(!preflight.platformBlockers.includes("SUBMISSION_AUTHORIZATION_UNAVAILABLE"));
      assert.ok(!preflight.platformBlockers.includes("MATERIAL_SNAPSHOT_UNAVAILABLE"));
      assert.deepEqual(preflight.platformBlockers, ["BILLING_ENTITLEMENT_UNAVAILABLE", "SUBMISSION_UNAVAILABLE"]);
      const rows = (await pool.query("select * from application_material_snapshots where id = $1", [snapshot.id])).rows;
      assert.equal(rows.length, 1); assert.equal(rows[0].authorization_id, f.authorization.id);
      assert.equal(rows[0].encryption_key_id, "synthetic-snapshot-key");
      assert.doesNotMatch(JSON.stringify(rows), /PRIVATE_|private-applicant|"7\.50"|student_notes|educationRecordIds/i);
      assert.equal((await pool.query("select count(*)::int as n from school_applications where application_choice_id = $1", [f.choice.id])).rows[0].n, 0);
      assert.equal((await pool.query("select count(*)::int as n from student_application_command_receipts where operation = 'application_material_snapshot.create' and resource_id = $1", [snapshot.id])).rows[0].n, 2);
      const audits = (await pool.query("select action,metadata_json from audit_logs where resource_id = $1 order by created_at,id", [snapshot.id])).rows;
      assert.deepEqual(audits.map(row => row.action), ["student.application_material_snapshot.create", "student.application_command.replay"]);
      assert.doesNotMatch(JSON.stringify(audits), /PRIVATE_|private-applicant|"7\.50"|scopeSha256|payloadSha256|materialContentSha256|selectionSha256|approvalSha256|ciphertext|encryptionKeyId/i);
    });
  });

  await t.test("same-school projects receive independent authorization and encrypted snapshot identities", async () => {
    await isolated(async f => {
      const first = await f.createSnapshot();
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
      const request = await f.snapshotRequest(), selectionService = new PostgresMaterialSelection(f.client);
      const saved = await selectionService.put(f.context, f.set.id, choice.id, { expectedRevision: 0, ...request });
      const preview = await new PostgresApplicationMaterialPreview(f.client).preview(f.context, f.set.id, choice.id, request);
      const secondPolicy = await f.policyFixture.getPublished({ programId: program.id, programIntakeId: intake.id });
      const authorization = await f.service.record(f.context, f.set.id, choice.id, { ...f.authorizationInput,
        expectedMaterialSelectionRevision: saved.revision, expectedVersions: saved.savedVersions,
        materialContentSha256: preview.contentSha256,
        expectedPolicy: { admissionRouteKey: secondPolicy.admissionRouteKey, versionId: secondPolicy.versionId,
          publicationRevision: secondPolicy.publicationRevision, documentSha256: secondPolicy.documentSha256 } }, randomUUID());
      const secondInput = { authorizationId: authorization.id, expectedAuthorizationScopeSha256: authorization.confirmation.scopeSha256,
        expectedMaterialContentSha256: authorization.material.contentSha256 };
      const second = await f.snapshotService.create(f.context, f.set.id, choice.id, secondInput, randomUUID());
      assert.equal(first.target.schoolId, second.target.schoolId);
      assert.notEqual(first.target.choiceId, second.target.choiceId);
      assert.notEqual(first.target.programId, second.target.programId);
      assert.notEqual(first.target.programIntakeId, second.target.programIntakeId);
      assert.notEqual(first.authorization.id, second.authorization.id);
      assert.notEqual(first.material.payloadSha256, second.material.payloadSha256);
      const rows = (await pool.query("select application_choice_id,program_id,program_intake_id,authorization_id from application_material_snapshots where application_set_id = $1 order by application_choice_id", [f.set.id])).rows;
      assert.equal(rows.length, 2); assert.equal(new Set(rows.map(row => row.authorization_id)).size, 2);
    });
  });

  await t.test("source changes stale the immutable snapshot and a new authorization produces a new row", async () => {
    await isolated(async f => {
      const first = await f.createSnapshot();
      await f.student.updateOwnApplicantProfile(f.context, { expectedRevision: 1, fullName: "CHANGED_PRIVATE_NAME" });
      const stale = await f.getSnapshot(); assert.equal(stale.id, first.id); assert.equal(stale.freshness.current, false);
      assert.ok(stale.freshness.reasons.includes("SOURCE_VERSIONS_CHANGED"));
      const preflight = await f.getSnapshotPreflight(); assert.equal(preflight.materialSnapshot.current, false);
      assert.ok(preflight.platformBlockers.includes("MATERIAL_SNAPSHOT_UNAVAILABLE"));
      await assert.rejects(f.createSnapshot(f.snapshotInput, randomUUID()), rejected(409));
      const nextRequest = await f.snapshotRequest();
      const saved = await f.selectionService.put(f.context, f.set.id, f.choice.id, { expectedRevision: 1, ...nextRequest });
      const preview = await f.materialReader.preview(f.context, f.set.id, f.choice.id, nextRequest);
      const authorization = await f.recordAuthorization({ ...f.authorizationInput,
        expectedMaterialSelectionRevision: saved.revision, expectedVersions: saved.savedVersions,
        materialContentSha256: preview.contentSha256 }, randomUUID());
      const second = await f.createSnapshot({ authorizationId: authorization.id,
        expectedAuthorizationScopeSha256: authorization.confirmation.scopeSha256,
        expectedMaterialContentSha256: authorization.material.contentSha256 }, randomUUID());
      assert.notEqual(second.id, first.id); assert.notEqual(second.authorization.id, first.authorization.id);
      assert.equal(second.freshness.current, true);
      assert.equal((await pool.query("select count(*)::int as n from application_material_snapshots where application_choice_id = $1", [f.choice.id])).rows[0].n, 2);
    });
  });

  await t.test("ciphertext tampering and missing old keys fail closed without plaintext fallback", async () => {
    await isolated(async f => {
      const snapshot = await f.createSnapshot();
      await pool.query(`update application_material_snapshots set envelope_json = jsonb_set(envelope_json,'{ciphertext}',
        to_jsonb(case when left(envelope_json->>'ciphertext',1) = 'A' then 'B' else 'A' end || substring(envelope_json->>'ciphertext' from 2))) where id = $1`, [snapshot.id]);
      await assert.rejects(f.getSnapshot(), rejected(503));
      assert.doesNotMatch(JSON.stringify((await pool.query("select envelope_json from application_material_snapshots where id = $1", [snapshot.id])).rows), /PRIVATE_|private-applicant|"7\.50"/i);
    });
    await isolated(async f => {
      await f.createSnapshot();
      const missingCipher = new ApplicationMaterialSnapshotCipher({ activeKeyId: "other",
        keys: new Map([["other", randomBytes(32)]]) });
      const service = new PostgresApplicationMaterialSnapshot(f.client, missingCipher);
      await assert.rejects(service.get(f.context, f.set.id, f.choice.id), rejected(503));
    });
  });

  await t.test("snapshot rejects stale or foreign authority and database constraints protect the envelope and target", async () => {
    await isolated(async f => {
      const otherUserId = (await pool.query("insert into users (email,email_normalized) values ($1,$1) returning id",
        [`snapshot-foreign-${randomUUID()}@example.invalid`])).rows[0].id;
      await pool.query("insert into user_roles (user_id,role) values ($1,'student')", [otherUserId]);
      const otherContext = createRequestContext({ actorUserId: otherUserId, activeRole: "student",
        selectedSurface: "student", purpose: "student_action" });
      try {
        await assert.rejects(f.snapshotService.get(otherContext, f.set.id, f.choice.id), rejected(403));
        await assert.rejects(f.snapshotService.create(otherContext, f.set.id, f.choice.id, f.snapshotInput, randomUUID()), rejected(403));
      } finally {
        await pool.query("delete from users where id = $1", [otherUserId]);
      }
      await f.withdrawAuthorization(f.authorization.id);
      await assert.rejects(f.createSnapshot(f.snapshotInput, randomUUID()), rejected(409));
    });
    await isolated(async f => {
      await f.policyFixture.service.withdraw(f.policyFixture.reviewer, f.policyFixture.schoolId,
        f.policyFixture.policyKey, f.policyFixture.admissionRouteKey,
        policyWithdrawInput(f.approvedPolicy, f.policyPublications));
      await assert.rejects(f.createSnapshot(f.snapshotInput, randomUUID()), rejected(409));
      assert.equal((await f.getAuthorization()).freshness.current, false);
      assert.equal((await pool.query("select count(*)::int as n from application_material_snapshots where authorization_id = $1",
        [f.authorization.id])).rows[0].n, 0);
    });
    await isolated(async f => {
      const snapshot = await f.createSnapshot();
      await assert.rejects(pool.query("update application_material_snapshots set payload_sha256 = 'bad' where id = $1", [snapshot.id]), error => error.code === "23514");
      await assert.rejects(pool.query("update application_material_snapshots set envelope_json = envelope_json || '{\"extra\":true}'::jsonb where id = $1", [snapshot.id]), error => error.code === "23514");
      await assert.rejects(pool.query("update application_material_snapshots set program_id = $2 where id = $1", [snapshot.id, randomUUID()]), error => error.code === "23503");
      await assert.rejects(pool.query(`insert into application_material_snapshots
        (user_id,application_set_id,application_choice_id,school_id,program_id,program_intake_id,authorization_id,
         authorization_scope_sha256,material_selection_revision,source_set_revision,source_applicant_revision,
         source_education_revision,source_assessment_revision,selection_sha256,material_content_sha256,payload_sha256,
         payload_bytes,encryption_key_id,envelope_json,captured_request_id)
        select user_id,application_set_id,application_choice_id,school_id,program_id,program_intake_id,authorization_id,
         authorization_scope_sha256,material_selection_revision,source_set_revision,source_applicant_revision,
         source_education_revision,source_assessment_revision,selection_sha256,material_content_sha256,payload_sha256,
         payload_bytes,encryption_key_id,envelope_json,'duplicate' from application_material_snapshots where id = $1`, [snapshot.id]),
      error => error.code === "23505" && error.constraint === "application_material_snapshot_authorization_unique");
    });
  });

  await t.test("concurrent snapshot commands converge and audit failure rolls back ciphertext and receipt", async () => {
    await isolated(async f => {
      const results = await Promise.all([f.createSnapshot(f.snapshotInput, randomUUID()), f.createSnapshot(f.snapshotInput, randomUUID())]);
      assert.equal(results[0].id, results[1].id);
      assert.equal((await pool.query("select count(*)::int as n from application_material_snapshots where authorization_id = $1", [f.authorization.id])).rows[0].n, 1);
      assert.equal((await pool.query("select count(*)::int as n from student_application_command_receipts where operation = 'application_material_snapshot.create' and resource_id = $1", [results[0].id])).rows[0].n, 2);
    });
    await isolated(async f => {
      const faults = await createAuditFailureFixture(pool);
      try {
        const before = await snapshotAuditedBusinessTables(pool);
        await faults.during("student.application_material_snapshot.create", () => assert.rejects(f.createSnapshot(), error => error.code === "P0001"));
        assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
        assert.equal(await f.getSnapshot(), null);
      } finally { await faults.close(); }
    });
  });
}
