import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PostgresApplicationMaterialPreview } from "../../../src/server/student/postgres-application-material-preview.ts";
import { capturePublicDataReader } from "./migration-data-fixture.mjs";
import { materialPreviewFixture } from "./application-material-preview-fixture.mjs";
import { assessmentInput } from "../student/assessment-fixture.mjs";

function pausedReader(f) {
  let arrived, release;
  const reached = new Promise(resolve => { arrived = resolve; }), gate = new Promise(resolve => { release = resolve; });
  const reader = new PostgresApplicationMaterialPreview({ transaction: work => f.client.transaction(tx => work({
    transaction: tx.transaction,
    query: async (sql, params) => { const rows = await tx.query(sql, params); if (sql.includes('as "choiceId"')) { arrived(); await gate; } return rows; },
  })) });
  return { reader, reached, release };
}

export async function runApplicationMaterialPreviewRehearsal(t, pool) {
  await t.test("material preview empty selection leaves every public table untouched and never defaults to all data", async () => {
    const f = await materialPreviewFixture(pool, undefined, false), snapshot = await capturePublicDataReader(pool), before = await snapshot();
    f.input.selection = { applicantFields: [], educationRecordIds: [], assessmentRecordIds: [] };
    const result = await f.preview();
    assert.deepEqual(result.content.materials, { applicant: {}, education: [], assessments: [] });
    assert.equal(result.canSubmit, false); assert.equal(result.persisted, false); assert.equal(result.consentRecorded, false);
    assert.deepEqual(await snapshot(), before);
  });

  await t.test("material preview contains only chosen own fields and records with original reported marks and dates", async () => {
    const f = await materialPreviewFixture(pool);
    await f.student.addOwnEducationRecord(f.context, { expectedRevision: 1, institutionName: "UNSELECTED_EDUCATION", educationLevel: "master" });
    await f.student.addOwnAssessmentRecord(f.context, assessmentInput(1, { assessmentName: "UNSELECTED_ASSESSMENT" }));
    f.input.expectedVersions.education = 2; f.input.expectedVersions.assessments = 2; f.input.selection.applicantFields = ["fullName"];
    const snapshot = await capturePublicDataReader(pool), before = await snapshot(), result = await f.preview();
    assert.deepEqual(result.content.materials.applicant, { fullName: "PRIVATE_APPLICANT_NAME" });
    assert.equal(result.content.materials.education.length, 1); assert.equal(result.content.materials.education[0].institutionName, "PRIVATE_EDUCATION_NAME");
    assert.equal(result.content.materials.assessments.length, 1); assert.equal(result.content.materials.assessments[0].components[0].value, "7.50");
    assert.equal(result.content.materials.assessments[0].testDate, "2026-02-01"); assert.equal(result.content.materials.assessments[0].evidenceStatus, "unverified");
    assert.doesNotMatch(JSON.stringify(result), /UNSELECTED_|private-applicant|citizenshipCountry|PRIVATE_CHOICE_NOTE|IGNORED_LEGACY|school_visible|consent_summary|userId/);
    assert.equal((await f.preview()).contentSha256, result.contentSha256); assert.deepEqual(await snapshot(), before);
  });

  await t.test("material preview conceals wrong owner parent choice and foreign missing or removed record IDs", async () => {
    const f = await materialPreviewFixture(pool), other = await materialPreviewFixture(pool), snapshot = await capturePublicDataReader(pool);
    await f.student.removeOwnEducationRecord(f.context, f.input.selection.educationRecordIds[0], { expectedRevision: 1 });
    f.input.expectedVersions.education = 2;
    const before = await snapshot();
    for (const [actor, setId, choiceId, input] of [
      [other.context, f.set.id, f.choice.id, f.input], [f.context, other.set.id, f.choice.id, f.input], [f.context, f.set.id, randomUUID(), f.input],
      [f.context, f.set.id, f.choice.id, f.input],
      [f.context, f.set.id, f.choice.id, { ...f.input, selection: { ...f.input.selection, educationRecordIds: other.input.selection.educationRecordIds } }],
      [f.context, f.set.id, f.choice.id, { ...f.input, selection: { ...f.input.selection, educationRecordIds: [], assessmentRecordIds: [randomUUID()] } }],
    ]) await assert.rejects(f.materialReader.preview(actor, setId, choiceId, input), e => e.status === 403 && !/PRIVATE_|@/.test(e.message));
    assert.deepEqual(await snapshot(), before);
  });

  await t.test("material preview checks current account and student grant instead of retaining resolved session authority", async () => {
    for (const field of ["account", "role"]) {
      const f = await materialPreviewFixture(pool); await f.preview();
      if (field === "account") await pool.query("update users set account_status = 'disabled' where id = $1", [f.userId]);
      else await pool.query("update user_roles set revoked_at = now() where user_id = $1 and role = 'student'", [f.userId]);
      await assert.rejects(f.preview(), e => e.status === 403);
    }
  });

  await t.test("material preview pins all four source versions and new reads require explicit refreshed expectations", async () => {
    const f = await materialPreviewFixture(pool), first = await f.preview();
    await f.student.updateOwnApplicantProfile(f.context, { expectedRevision: 1, contactEmail: "changed@example.invalid" });
    await assert.rejects(f.preview(), e => e.status === 409);
    await f.student.updateOwnEducationRecord(f.context, f.input.selection.educationRecordIds[0], { expectedRevision: 1, fieldOfStudy: "Updated field" });
    await f.student.updateOwnAssessmentRecord(f.context, f.input.selection.assessmentRecordIds[0], { expectedRevision: 1, assessmentVariant: "Updated edition" });
    await f.student.updateOwnApplicationChoice(f.context, f.set.id, f.choice.id, { expectedRevision: 2, studentNotes: "PRIVATE_NEW_NOTE" });
    const current = await f.request();
    for (const key of Object.keys(current.expectedVersions)) {
      const stale = structuredClone(current); stale.expectedVersions[key] = f.input.expectedVersions[key];
      await assert.rejects(f.preview(stale), e => e.status === 409);
    }
    const second = await f.preview(current); assert.notEqual(second.contentSha256, first.contentSha256);
    assert.equal(first.content.materials.applicant.contactEmail, "private-applicant@example.invalid");
    assert.equal(second.content.materials.applicant.contactEmail, "changed@example.invalid");
  });

  await t.test("material preview rejects frozen unbound or already school-received targets without treating catalog status as eligibility", async () => {
    const f = await materialPreviewFixture(pool);
    await pool.query("update program_intakes set status = 'closed' where id = $1", [f.catalog.intakeId]);
    assert.equal((await f.preview()).canSubmit, false, "private review never claims the closed target is submittable");
    for (const change of ["locked_at = now()", "submitted_at = now()", "status = 'submitted'"]) {
      await pool.query(`update application_sets set ${change} where id = $1`, [f.set.id]); await assert.rejects(f.preview(), e => e.status === 409);
      await pool.query("update application_sets set locked_at = null, submitted_at = null, status = 'draft' where id = $1", [f.set.id]);
    }
    const legacy = await f.student.addOwnApplicationChoice(f.context, { applicationSetId: f.set.id, schoolId: f.catalog.schoolId }, { idempotencyKey: randomUUID() });
    const input = await f.request();
    await assert.rejects(f.materialReader.preview(f.context, f.set.id, legacy.id, input), e => e.status === 409);
    await pool.query("insert into school_applications (application_record_format, application_set_id, application_choice_id, student_user_id, school_id, program_id, program_intake_id) values ('cuac.program-application.v1',$1,$2,$3,$4,$5,$6)",
      [f.set.id, f.choice.id, f.userId, f.catalog.schoolId, f.catalog.programId, f.catalog.intakeId]);
    await assert.rejects(f.preview(input), e => e.status === 409);
  });

  await t.test("material previews keep same-school programs and intakes independently bound even with identical selected materials", async () => {
    const f = await materialPreviewFixture(pool);
    const program = (await pool.query("insert into programs (school_id, slug, name_en, degree_level, status) values ($1,$2,'Second project','master','active') returning id", [f.catalog.schoolId, randomUUID()])).rows[0];
    const intake = (await pool.query("insert into program_intakes (program_id, intake_term, intake_year) values ($1,'fall',2027) returning id", [program.id])).rows[0];
    const second = await f.student.addOwnApplicationChoice(f.context, { applicationSetId: f.set.id, schoolId: f.catalog.schoolId, programId: program.id, programIntakeId: intake.id }, { idempotencyKey: randomUUID() });
    const anotherIntake = (await pool.query("insert into program_intakes (program_id, intake_term, intake_year) values ($1,'spring',2028) returning id", [f.catalog.programId])).rows[0];
    const third = await f.student.addOwnApplicationChoice(f.context, { applicationSetId: f.set.id, schoolId: f.catalog.schoolId, programId: f.catalog.programId, programIntakeId: anotherIntake.id }, { idempotencyKey: randomUUID() });
    const input = await f.request(), results = [];
    for (const choice of [f.choice, second, third]) results.push(await f.materialReader.preview(f.context, f.set.id, choice.id, input));
    assert.equal(new Set(results.map(r => r.contentSha256)).size, 3);
    assert.deepEqual(results.map(r => r.content.programIntakeId), [f.catalog.intakeId, intake.id, anotherIntake.id]);
    assert.deepEqual(results[0].content.materials, results[1].content.materials);
  });

  await t.test("material reads observe one real snapshot when profile education and assessment changes commit between queries", async () => {
    const f = await materialPreviewFixture(pool), first = await f.preview(), paused = pausedReader(f); let pending;
    try {
      pending = f.preview(f.input, paused.reader); await paused.reached;
      await f.student.updateOwnApplicantProfile(f.context, { expectedRevision: 1, fullName: "CHANGED_NAME" });
      await f.student.updateOwnEducationRecord(f.context, f.input.selection.educationRecordIds[0], { expectedRevision: 1, institutionName: "CHANGED_EDUCATION" });
      await f.student.updateOwnAssessmentRecord(f.context, f.input.selection.assessmentRecordIds[0], { expectedRevision: 1, assessmentName: "CHANGED_ASSESSMENT" });
      paused.release(); const result = await pending; assert.equal(result.contentSha256, first.contentSha256);
      await assert.rejects(f.preview(), e => e.status === 409);
      const fresh = await f.preview(await f.request()); assert.equal(fresh.content.materials.education[0].institutionName, "CHANGED_EDUCATION");
      assert.notEqual(fresh.contentSha256, first.contentSha256);
    } finally { paused.release(); if (pending) await Promise.allSettled([pending]); }
  });

  await t.test("material deletion between snapshot queries cannot produce a partial packet or reconstruct removed records later", async () => {
    const f = await materialPreviewFixture(pool), paused = pausedReader(f); let pending;
    try {
      pending = f.preview(f.input, paused.reader); await paused.reached;
      await f.student.removeOwnAssessmentRecord(f.context, f.input.selection.assessmentRecordIds[0], { expectedRevision: 1 });
      paused.release(); const result = await pending; assert.equal(result.content.materials.assessments.length, 1);
      await assert.rejects(f.preview(), e => e.status === 409);
      await assert.rejects(f.preview({ ...f.input, expectedVersions: { ...f.input.expectedVersions, assessments: 2 } }), e => e.status === 403);
      assert.equal((await f.preview(await f.request())).content.materials.assessments.length, 0);
    } finally { paused.release(); if (pending) await Promise.allSettled([pending]); }
  });

  await t.test("material preview read-only transaction rejects real writes and restores normal mode afterward", async () => {
    const f = await materialPreviewFixture(pool), snapshot = await capturePublicDataReader(pool), before = await snapshot(); let mode;
    const reader = new PostgresApplicationMaterialPreview({ transaction: work => f.client.transaction(tx => work({ transaction: tx.transaction,
      query: async (sql, params) => { const rows = await tx.query(sql, params); if (sql.startsWith("set transaction")) {
        mode = (await tx.query("select current_setting('transaction_isolation') as isolation, current_setting('transaction_read_only') as readonly", []))[0];
        await tx.query("update application_sets set revision = revision + 1 where id = $1", [f.set.id]);
      } return rows; },
    })) });
    await assert.rejects(f.preview(f.input, reader), e => e.code === "25006");
    assert.deepEqual(mode, { isolation: "repeatable read", readonly: "on" }); assert.deepEqual(await snapshot(), before);
    await f.student.updateOwnApplicantProfile(f.context, { expectedRevision: 1, fullName: "After rollback" });
    assert.equal((await f.preview(await f.request())).content.materials.applicant.fullName, "After rollback");
  });

  await t.test("material preview fails closed on selected corrupt data while unselected data stays outside the projection", async () => {
    const f = await materialPreviewFixture(pool);
    await pool.query("update student_education_records set institution_name = $2 where id = $1", [f.input.selection.educationRecordIds[0], "PRIVATE\nCORRUPTION"]);
    await assert.rejects(f.preview(), e => e.status === 503 && !/PRIVATE/.test(e.message));
    f.input.selection.educationRecordIds = [];
    assert.equal((await f.preview()).content.materials.education.length, 0);
    await pool.query("update student_assessment_records set components_json = $2 where id = $1", [f.input.selection.assessmentRecordIds[0], JSON.stringify([{ name: "Overall", value: "PRIVATE".repeat(20) }])]);
    await assert.rejects(f.preview(), e => e.status === 503 && !/PRIVATE/.test(e.message));
    f.input.selection.assessmentRecordIds = []; assert.equal((await f.preview()).content.materials.assessments.length, 0);
  });

  await t.test("material record query refuses oversized stored payloads before passing content to the projection", async () => {
    const f = await materialPreviewFixture(pool, undefined, false);
    await pool.query("insert into student_assessment_histories (user_id) values ($1)", [f.userId]);
    const rows = (await pool.query(`insert into student_assessment_records (user_id, assessment_category, assessment_name, result_status, result_form, components_json)
      select $1, 'language', 'Oversized synthetic record', 'reported', 'unspecified', $2::jsonb from generate_series(1,40) returning id`,
    [f.userId, JSON.stringify([{ name: "Overall", value: "PRIVATE".repeat(1800) }])])).rows;
    f.input.expectedVersions.assessments = 1; f.input.selection.assessmentRecordIds = rows.map(r => r.id);
    await assert.rejects(f.preview(), e => e.status === 503 && /records require reconciliation/.test(e.message));
    assert.equal(rows.length, 40);
  });
}
