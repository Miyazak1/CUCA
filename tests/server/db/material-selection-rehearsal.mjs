import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PostgresMaterialSelection } from "../../../src/server/student/postgres-material-selection.ts";
import { createPostgresStudentService } from "../../../src/server/student/runtime/routes.ts";
import { capturePublicDataReader } from "./migration-data-fixture.mjs";
import { createAuditFailureFixture, snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";
import { emptySelection, gateSelectionClient, materialSelectionFixture, waitForSelectionBlock } from "./material-selection-fixture.mjs";

const rows = async (pool, f) => (await pool.query("select * from application_material_selections where choice_id = $1", [f.choice.id])).rows;
const rejected = status => error => error.status === status;

export async function runMaterialSelectionRehearsal(t, pool) {
  await t.test("selection absent GET does not create state and first PUT stores only explicit references and source versions", async () => {
    const f = await materialSelectionFixture(pool), snapshot = await capturePublicDataReader(pool), before = await snapshot();
    assert.equal((await f.selectionGet()).selection, null); assert.deepEqual(await snapshot(), before);
    const result = await f.selectionPut(); assert.equal(result.revision, 1); assert.equal(result.canSubmit, false); assert.equal(result.consentRecorded, false);
    assert.deepEqual(result.selection, f.input.selection); assert.deepEqual(result.currentVersions, f.input.expectedVersions);
    assert.deepEqual(result.savedVersions, f.input.expectedVersions); assert.deepEqual(result.changedSources, []);
    const saved = (await rows(pool, f))[0]; assert.deepEqual(saved.selection_json, f.input.selection);
    assert.doesNotMatch(JSON.stringify(saved), /PRIVATE_|@example|7\.50|passport|contentSha256|consent|schoolVisible/);
    assert.equal((await pool.query("select revision from application_sets where id = $1", [f.set.id])).rows[0].revision, 2);
    const event = (await pool.query("select metadata_json from audit_logs where action = 'student.material_selection.save' and resource_id = $1", [f.choice.id])).rows[0];
    assert.deepEqual(event.metadata_json, { applicationSetId: f.set.id, revision: 1, applicantFieldCount: 3, educationRecordCount: 1, assessmentRecordCount: 1 });
    const current = await snapshot(); await f.selectionPut({ ...f.selectionInput, expectedRevision: 1 }); assert.deepEqual(await snapshot(), current);
    await assert.rejects(f.selectionPut(), rejected(409));
  });

  await t.test("selection clearing keeps its revision and stale requests cannot restore cleared choices", async () => {
    const f = await materialSelectionFixture(pool); await f.selectionPut();
    const clear = { ...f.selectionInput, expectedRevision: 1, selection: emptySelection() };
    assert.equal((await f.selectionPut(clear)).revision, 2); await assert.rejects(f.selectionPut(clear), rejected(409));
    await assert.rejects(f.selectionPut({ ...f.selectionInput, expectedRevision: 1 }), rejected(409));
    assert.deepEqual((await f.selectionGet()).selection, emptySelection());
    assert.equal((await f.selectionPut({ ...clear, expectedRevision: 2 })).revision, 2);
    const fresh = await materialSelectionFixture(pool, undefined, false);
    assert.equal((await fresh.selectionPut({ ...fresh.selectionInput, selection: emptySelection() })).revision, 1);
    assert.deepEqual((await fresh.selectionGet()).selection, emptySelection());
  });

  await t.test("selection keeps same-school projects and intakes separate without copying another choice's saved materials", async () => {
    const f = await materialSelectionFixture(pool);
    const programId = (await pool.query("insert into programs (school_id,slug,name_en,degree_level,status) values ($1,$2,'Second project','master','active') returning id", [f.catalog.schoolId, randomUUID()])).rows[0].id;
    const intakeId = (await pool.query("insert into program_intakes (program_id,intake_term,intake_year) values ($1,'fall',2027) returning id", [programId])).rows[0].id;
    const second = await f.student.addOwnApplicationChoice(f.context, { applicationSetId: f.set.id, schoolId: f.catalog.schoolId, programId, programIntakeId: intakeId }, { idempotencyKey: randomUUID() });
    const nextIntake = (await pool.query("insert into program_intakes (program_id,intake_term,intake_year) values ($1,'spring',2028) returning id", [f.catalog.programId])).rows[0].id;
    const third = await f.student.addOwnApplicationChoice(f.context, { applicationSetId: f.set.id, schoolId: f.catalog.schoolId, programId: f.catalog.programId, programIntakeId: nextIntake }, { idempotencyKey: randomUUID() });
    const input = { expectedRevision: 0, ...await f.request() }; await f.selectionPut(input);
    for (const choice of [second, third]) assert.equal((await f.selectionService.get(f.context, f.set.id, choice.id)).selection, null);
    await f.selectionService.put(f.context, f.set.id, second.id, { ...input, selection: emptySelection() });
    await f.selectionService.put(f.context, f.set.id, third.id, { ...input, selection: { ...emptySelection(), applicantFields: ["fullName"] } });
    await f.student.removeOwnApplicationChoice(f.context, f.set.id, f.choice.id);
    assert.deepEqual(await rows(pool, f), []);
    assert.deepEqual((await f.selectionService.get(f.context, f.set.id, second.id)).selection, emptySelection());
    assert.deepEqual((await f.selectionService.get(f.context, f.set.id, third.id)).selection.applicantFields, ["fullName"]);
    await assert.rejects(f.selectionGet(), rejected(403)); await assert.rejects(f.selectionPut(input), rejected(403));
  });

  await t.test("selection source changes and removed records are visible without silently refreshing saved expectations", async () => {
    const f = await materialSelectionFixture(pool); await f.selectionPut();
    await f.student.updateOwnApplicantProfile(f.context, { expectedRevision: 1, fullName: "CHANGED_PRIVATE_NAME" });
    await f.student.removeOwnEducationRecord(f.context, f.input.selection.educationRecordIds[0], { expectedRevision: 1 });
    await f.student.removeOwnAssessmentRecord(f.context, f.input.selection.assessmentRecordIds[0], { expectedRevision: 1 });
    await f.student.updateOwnApplicationChoice(f.context, f.set.id, f.choice.id, { expectedRevision: 2, studentNotes: "CHANGED_PRIVATE_NOTE" });
    const result = await f.selectionGet(); assert.deepEqual(result.changedSources, ["applicationSet", "applicant", "education", "assessments"]);
    assert.deepEqual(result.unavailable, { educationRecordIds: f.input.selection.educationRecordIds, assessmentRecordIds: f.input.selection.assessmentRecordIds });
    assert.deepEqual(result.savedVersions, f.input.expectedVersions); assert.equal(result.revision, 1);
    await assert.rejects(f.selectionPut({ ...f.selectionInput, expectedRevision: 1 }), rejected(409));
    const current = await f.request();
    await assert.rejects(f.selectionPut({ ...f.selectionInput, expectedRevision: 1, expectedVersions: current.expectedVersions }), rejected(403));
    const refreshed = await f.selectionPut({ expectedRevision: 1, ...current }); assert.equal(refreshed.revision, 2);
    assert.deepEqual(refreshed.changedSources, []); assert.deepEqual(refreshed.unavailable, { educationRecordIds: [], assessmentRecordIds: [] });
    assert.doesNotMatch(JSON.stringify(refreshed), /CHANGED_PRIVATE|institutionName|components/);
  });

  await t.test("selection rejects foreign ownership record IDs and revoked authority without changing any business table", async () => {
    const f = await materialSelectionFixture(pool), other = await materialSelectionFixture(pool), before = await snapshotAuditedBusinessTables(pool);
    for (const args of [[other.context, f.set.id, f.choice.id, f.selectionInput], [f.context, other.set.id, f.choice.id, f.selectionInput],
      [f.context, f.set.id, randomUUID(), f.selectionInput], [f.context, f.set.id, f.choice.id, { ...f.selectionInput,
        selection: { ...f.input.selection, educationRecordIds: other.input.selection.educationRecordIds } }],
      [f.context, f.set.id, f.choice.id, { ...f.selectionInput, selection: { ...f.input.selection, assessmentRecordIds: [randomUUID()] } }]]) {
      await assert.rejects(f.selectionService.put(...args), rejected(403));
    }
    await assert.rejects(f.selectionService.get(other.context, f.set.id, f.choice.id), rejected(403));
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    for (const sql of ["update users set account_status = 'disabled' where id = $1", "update user_roles set revoked_at = now() where user_id = $1 and role = 'student'"]) {
      const own = await materialSelectionFixture(pool); await pool.query(sql, [own.userId]);
      await assert.rejects(own.selectionGet(), rejected(403)); await assert.rejects(own.selectionPut(), rejected(403));
    }
  });

  await t.test("selection frozen received and unbound targets cannot be saved but owned frozen selections remain readable", async () => {
    const f = await materialSelectionFixture(pool); await f.selectionPut();
    for (const field of ["locked_at = now()", "submitted_at = now()", "status = 'submitted'"]) {
      await pool.query(`update application_sets set ${field} where id = $1`, [f.set.id]);
      assert.equal((await f.selectionGet()).editable, false);
      await assert.rejects(f.selectionPut({ ...f.selectionInput, expectedRevision: 1 }), rejected(409));
      await pool.query("update application_sets set locked_at = null, submitted_at = null, status = 'draft' where id = $1", [f.set.id]);
    }
    const unbound = await f.student.addOwnApplicationChoice(f.context, { applicationSetId: f.set.id, schoolId: f.catalog.schoolId }, { idempotencyKey: randomUUID() });
    assert.equal((await f.selectionService.get(f.context, f.set.id, unbound.id)).editable, false);
    await assert.rejects(f.selectionService.put(f.context, f.set.id, unbound.id, { expectedRevision: 0, ...await f.request() }), rejected(409));
    await pool.query("insert into school_applications (application_record_format,application_set_id,application_choice_id,student_user_id,school_id,program_id,program_intake_id) values ('cuac.program-application.v1',$1,$2,$3,$4,$5,$6)",
      [f.set.id, f.choice.id, f.userId, f.catalog.schoolId, f.catalog.programId, f.catalog.intakeId]);
    assert.equal((await f.selectionGet()).editable, false);
    await assert.rejects(f.selectionPut({ expectedRevision: 1, ...await f.request() }), rejected(409));
  });

  await t.test("selection concurrent initial creates and edits each have exactly one winner at a real account lock", async () => {
    for (const revision of [0, 1]) {
      const f = await materialSelectionFixture(pool); if (revision) await f.selectionPut();
      const gate = gateSelectionClient(f.client, sql => sql.startsWith("select id from users"));
      const value = { ...f.selectionInput, expectedRevision: revision, selection: emptySelection() };
      const first = Promise.allSettled([f.selectionPut(value, new PostgresMaterialSelection(gate.client))]); let second;
      try { const pid = await gate.ready; second = Promise.allSettled([f.selectionPut({ ...f.selectionInput, expectedRevision: revision })]);
        await waitForSelectionBlock(pool, pid);
      } finally { gate.release(); }
      assert.equal((await first)[0].status, "fulfilled"); const loser = (await second)[0];
      assert.equal(loser.status, "rejected"); assert.equal(loser.reason.status, 409);
      assert.equal((await f.selectionGet()).revision, revision + 1); assert.deepEqual((await f.selectionGet()).selection, emptySelection());
    }
  });

  for (const operation of ["profile", "remove"]) await t.test(`selection and ${operation} serialize in both service lock orders`, async () => {
    for (const firstWriter of ["selection", "other"]) {
      const f = await materialSelectionFixture(pool), gate = gateSelectionClient(f.client, sql => /from users[\s\S]*for (share|update)/.test(sql));
      const other = service => operation === "profile" ? service.updateOwnApplicantProfile(f.context, { expectedRevision: 1, fullName: "CHANGED_PRIVATE_NAME" })
        : service.removeOwnApplicationChoice(f.context, f.set.id, f.choice.id);
      const first = Promise.allSettled([firstWriter === "selection" ? f.selectionPut(f.selectionInput, new PostgresMaterialSelection(gate.client)) : other(createPostgresStudentService(gate.client))]);
      let second;
      try { const pid = await gate.ready; second = Promise.allSettled([firstWriter === "selection" ? other(f.student) : f.selectionPut()]);
        await waitForSelectionBlock(pool, pid);
      } finally { gate.release(); }
      assert.equal((await first)[0].status, "fulfilled"); const result = (await second)[0];
      assert.equal(result.status, firstWriter === "selection" ? "fulfilled" : "rejected");
      if (result.status === "rejected") assert.equal(result.reason.status, operation === "profile" ? 409 : 403);
      if (operation === "remove") assert.deepEqual(await rows(pool, f), []);
      else if (firstWriter === "selection") assert.deepEqual((await f.selectionGet()).changedSources, ["applicant"]);
      else assert.equal((await f.selectionGet()).revision, 0);
    }
  });

  await t.test("selection rechecks role revocation and freeze after waiting and respects blocker rollback", async () => {
    for (const kind of ["role", "freeze"]) for (const outcome of ["commit", "rollback"]) {
      const f = await materialSelectionFixture(pool), blocker = await pool.connect(); let pending;
      try {
        await blocker.query("begin"); const pid = (await blocker.query("select pg_backend_pid() as pid")).rows[0].pid;
        if (kind === "role") await blocker.query("update user_roles set revoked_at = now() where user_id = $1 and role = 'student'", [f.userId]);
        else await blocker.query("update application_sets set locked_at = now() where id = $1", [f.set.id]);
        pending = Promise.allSettled([f.selectionPut()]); await waitForSelectionBlock(pool, pid); await blocker.query(outcome);
        const result = (await pending)[0]; assert.equal(result.status, outcome === "commit" ? "rejected" : "fulfilled");
        if (result.status === "rejected") assert.equal(result.reason.status, kind === "role" ? 403 : 409);
        assert.equal((await rows(pool, f)).length, outcome === "commit" ? 0 : 1);
      } finally { await blocker.query("rollback"); blocker.release(); if (pending) await pending; }
    }
  });

  await t.test("selection GET sees one repeatable snapshot when sources change between its metadata queries", async () => {
    const f = await materialSelectionFixture(pool); await f.selectionPut();
    const gate = gateSelectionClient(f.client, sql => sql.includes('as "choiceId"'));
    const pending = Promise.allSettled([f.selectionGet(new PostgresMaterialSelection(gate.client))]);
    try { await gate.ready; await f.student.removeOwnEducationRecord(f.context, f.input.selection.educationRecordIds[0], { expectedRevision: 1 }); }
    finally { gate.release(); }
    const result = (await pending)[0]; assert.equal(result.status, "fulfilled"); assert.deepEqual(result.value.changedSources, []);
    assert.deepEqual(result.value.unavailable.educationRecordIds, []);
    const fresh = await f.selectionGet(); assert.deepEqual(fresh.changedSources, ["education"]);
    assert.deepEqual(fresh.unavailable.educationRecordIds, f.input.selection.educationRecordIds);
  });

  await t.test("selection save and associated choice removal roll back all business data when audit fails", async () => {
    const faults = await createAuditFailureFixture(pool);
    try {
      const f = await materialSelectionFixture(pool), before = await snapshotAuditedBusinessTables(pool);
      await faults.during("student.material_selection.save", () => assert.rejects(f.selectionPut(), e => e.code === "P0001"));
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before); await f.selectionPut();
      const saved = await snapshotAuditedBusinessTables(pool);
      await faults.during("student.material_selection.save", () => assert.rejects(f.selectionPut({ ...f.selectionInput, expectedRevision: 1, selection: emptySelection() }), e => e.code === "P0001"));
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), saved);
      await faults.during("student.application_choice.remove", () => assert.rejects(f.student.removeOwnApplicationChoice(f.context, f.set.id, f.choice.id), e => e.code === "P0001"));
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), saved);
      await f.student.removeOwnApplicationChoice(f.context, f.set.id, f.choice.id); assert.deepEqual(await rows(pool, f), []);
    } finally { await faults.close(); }
  });

  await t.test("selection lost commit acknowledgment is not retried and can be reconciled through a current GET", async () => {
    const f = await materialSelectionFixture(pool); let commits = 0;
    const uncertain = new PostgresMaterialSelection({ ...f.client, async transaction(work) { await f.client.transaction(work); commits++; throw new Error("Synthetic commit acknowledgment lost"); } });
    await assert.rejects(f.selectionPut(f.selectionInput, uncertain), /acknowledgment lost/);
    assert.equal(commits, 1); assert.equal((await f.selectionGet()).revision, 1);
    await assert.rejects(f.selectionPut(), rejected(409));
    assert.equal((await pool.query("select count(*)::int as n from audit_logs where resource_id = $1 and action = 'student.material_selection.save'", [f.choice.id])).rows[0].n, 1);
  });

  await t.test("selection database scope target shape and size constraints reject direct invalid writes and cascade choice deletion", async () => {
    const f = await materialSelectionFixture(pool), other = await materialSelectionFixture(pool); await f.selectionPut();
    for (const [field, value] of [["user_id", other.userId], ["application_set_id", other.set.id], ["school_id", other.catalog.schoolId],
      ["program_id", other.catalog.programId], ["program_intake_id", other.catalog.intakeId]]) {
      await assert.rejects(pool.query(`update application_material_selections set ${field} = $2 where choice_id = $1`, [f.choice.id, value]), e => e.code === "23503");
    }
    for (const value of [{}, [], null, { ...emptySelection(), rawName: "PRIVATE" }, { ...emptySelection(), applicantFields: ["passport"] },
      { ...emptySelection(), educationRecordIds: "PRIVATE" }, { ...emptySelection(), educationRecordIds: Array.from({ length: 21 }, randomUUID) },
      { ...emptySelection(), assessmentRecordIds: ["PRIVATE".repeat(1500)] }]) {
      await assert.rejects(pool.query("update application_material_selections set selection_json = $2::jsonb where choice_id = $1", [f.choice.id, JSON.stringify(value)]), e => e.code === "23514");
    }
    await assert.rejects(pool.query("update application_material_selections set revision = 0 where choice_id = $1", [f.choice.id]), e => e.code === "23514");
    await assert.rejects(pool.query("update application_material_selections set target_key = '/' where choice_id = $1", [f.choice.id]), e => e.code === "428C9");
    await assert.rejects(pool.query("update application_material_selections set program_intake_id = null where choice_id = $1", [f.choice.id]), e => e.code === "23502");
    await pool.query("delete from application_choices where id = $1", [f.choice.id]); assert.deepEqual(await rows(pool, f), []);
  });

  await t.test("selection invalid or foreign nested record references fail closed on reads and revision exhaustion cannot wrap", async () => {
    const f = await materialSelectionFixture(pool), other = await materialSelectionFixture(pool); await f.selectionPut();
    for (const educationRecordIds of [["PRIVATE_CORRUPTION"], other.input.selection.educationRecordIds, [randomUUID()]]) {
      await pool.query("update application_material_selections set selection_json = $2 where choice_id = $1", [f.choice.id, { ...emptySelection(), educationRecordIds }]);
      await assert.rejects(f.selectionGet(), error => error.status === 503 && !/PRIVATE|[0-9a-f]{8}-/.test(error.message));
    }
    await pool.query("update application_material_selections set selection_json = $2, revision = 2147483647 where choice_id = $1", [f.choice.id, f.input.selection]);
    assert.equal((await f.selectionPut({ ...f.selectionInput, expectedRevision: 2147483647 })).revision, 2147483647);
    await assert.rejects(f.selectionPut({ ...f.selectionInput, expectedRevision: 2147483647, selection: emptySelection() }), rejected(409));
  });
}
