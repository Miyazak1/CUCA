import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { PostgresApplicationPreflight } from "../../../src/server/student/postgres-application-preflight.ts";
import { snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";
import { preflightFixture } from "./application-preflight-fixture.mjs";
import { preparedRequirement, approveInput, publishInput } from "./requirement-governance-fixture.mjs";
import { approvedNotice, publishNotice, noticeApproveInput, preparedNotice } from "./notices-fixture.mjs";
import { requirementDocument } from "../catalog/requirements-fixture.mjs";

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function pausedReader(f) {
  const reached = deferred(), release = deferred();
  const reader = new PostgresApplicationPreflight({ transaction: work => f.client.transaction(tx => work({
    query: async (sql, params) => { const rows = await tx.query(sql, params); if (sql.includes('as "choiceId"')) { reached.resolve(); await release.promise; } return rows; },
    transaction: tx.transaction,
  })) });
  return { reader, reached, release };
}

export async function runApplicationPreflightRehearsal(t, pool) {
  await t.test("preflight empty preparation is owner-only read metadata and never creates consent or application state", async () => {
    const f = await preflightFixture(pool), before = await snapshotAuditedBusinessTables(pool), result = await f.get();
    assert.equal(result.choiceId, f.choice.id); assert.equal(result.revision, 2); assert.equal(result.canSubmit, false);
    assert.equal(result.platformBlockers.length, 5); assert.equal(result.target.window.status, "open");
    assert.equal(result.requirements, null); assert.equal(result.notice, null);
    assert.deepEqual(result.preparation.applicant, { revision: 0, missingFields: ["fullName", "contactEmail", "citizenshipCountry"] });
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_CHOICE_NOTE|IGNORED_LEGACY_LABEL/);
  });

  await t.test("populated preparation keeps scores private and complete publications remain unassessed references", async () => {
    const f = await preflightFixture(pool); await f.populate(); const document = requirementDocument(); document.coverage = "complete";
    const published = await f.publish(document), before = await snapshotAuditedBusinessTables(pool), result = await f.get();
    assert.deepEqual(result.preparation.applicant, { revision: 1, missingFields: [] });
    assert.deepEqual(result.preparation.education, { revision: 1, recordCount: 1 }); assert.deepEqual(result.preparation.assessments, { revision: 1, recordCount: 1 });
    assert.equal(result.requirements.versionId, published.requirements.versionId); assert.equal(result.notice.versionId, published.notice.versionId);
    assert.equal(result.requirements.items[0].result, "unassessed"); assert.equal(result.canSubmit, false);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|private-applicant|Private language exam|7\.50|ruleText|reviewReference|sourceChecks|reviewedByUserId/);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    assert.equal((await f.get("zh-CN")).notice, null);
  });

  await t.test("preflight distinguishes same-school programs and cycles and rejects cross-student or wrong-parent targets", async () => {
    const f = await preflightFixture(pool), other = await preflightFixture(pool);
    const program = (await pool.query("insert into programs (school_id, slug, name_en, degree_level, status) values ($1, $2, 'Second program', 'master', 'active') returning id", [f.catalog.schoolId, randomUUID()])).rows[0];
    const intake = (await pool.query("insert into program_intakes (program_id, intake_term, intake_year) values ($1, 'fall', 2027) returning id", [program.id])).rows[0];
    const second = await f.student.addOwnApplicationChoice(f.context, { applicationSetId: f.set.id, schoolId: f.catalog.schoolId, programId: program.id, programIntakeId: intake.id }, { idempotencyKey: randomUUID() });
    assert.equal((await f.get()).target.programId, f.catalog.programId);
    assert.equal((await f.reader.get(f.context, f.set.id, second.id, "en")).target.programId, program.id);
    const otherIntake = (await pool.query("insert into program_intakes (program_id, intake_term, intake_year) values ($1, 'spring', 2028) returning id", [f.catalog.programId])).rows[0];
    const third = await f.student.addOwnApplicationChoice(f.context, { applicationSetId: f.set.id, schoolId: f.catalog.schoolId, programId: f.catalog.programId, programIntakeId: otherIntake.id }, { idempotencyKey: randomUUID() });
    assert.equal((await f.reader.get(f.context, f.set.id, third.id, "en")).target.programIntakeId, otherIntake.id);
    assert.equal((await f.get()).target.programIntakeId, f.catalog.intakeId);
    const before = await snapshotAuditedBusinessTables(pool);
    for (const [context, setId, choiceId] of [[other.context, f.set.id, f.choice.id], [f.context, other.set.id, f.choice.id], [f.context, f.set.id, other.choice.id], [f.context, f.set.id, randomUUID()]]) {
      await assert.rejects(f.reader.get(context, setId, choiceId, "en"), e => e.status === 403);
    }
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
  });

  await t.test("preflight checks live account and student grant even when earlier session context still exists", async () => {
    for (const field of ["account", "role"]) {
      const f = await preflightFixture(pool); await f.get();
      if (field === "account") await pool.query("update users set account_status = 'disabled' where id = $1", [f.userId]);
      else await pool.query("update user_roles set revoked_at = now() where user_id = $1", [f.userId]);
      const before = await snapshotAuditedBusinessTables(pool); await assert.rejects(f.get(), e => e.status === 403);
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    }
  });

  await t.test("preflight distinguishes missing future expired invalid and unavailable intake windows", async () => {
    const f = await preflightFixture(pool);
    for (const [change, state] of [["open_date = null, deadline_date = null", "unconfirmed"],
      ["open_date = now() + interval '1 day', deadline_date = now() + interval '2 days'", "not_open"],
      ["open_date = now() - interval '2 days', deadline_date = now() - interval '1 day'", "closed"],
      ["open_date = now(), deadline_date = now()", "invalid"], ["status = 'closed'", "unavailable"]]) {
      await pool.query(`update program_intakes set ${change} where id = $1`, [f.catalog.intakeId]);
      assert.equal((await f.get()).target.window.status, state);
    }
    const legacy = await f.student.addOwnApplicationChoice(f.context, { applicationSetId: f.set.id, schoolId: f.catalog.schoolId }, { idempotencyKey: randomUUID() });
    const result = await f.reader.get(f.context, f.set.id, legacy.id, "en");
    assert.ok(result.issues.includes("PROGRAM_REQUIRED")); assert.ok(result.issues.includes("INTAKE_REQUIRED"));
  });

  await t.test("preflight freezes availability not ownership and removed choices are never reconstructed", async () => {
    const f = await preflightFixture(pool);
    for (const [sql, params, code] of [["update application_sets set locked_at = now() where id = $1", [f.set.id], "APPLICATION_SET_NOT_EDITABLE"],
      ["update application_choices set status = 'unknown' where id = $1", [f.choice.id], "CHOICE_NOT_EDITABLE"],
      ["update programs set status = 'draft' where id = $1", [f.catalog.programId], "PROGRAM_UNAVAILABLE"],
      ["update schools set status = 'inactive' where id = $1", [f.catalog.schoolId], "SCHOOL_UNAVAILABLE"]]) {
      await pool.query(sql, params); assert.ok((await f.get()).issues.includes(code));
    }
    await pool.query("update application_choices set removed_at = now() where id = $1", [f.choice.id]);
    await assert.rejects(f.get(), e => e.status === 403);
  });

  await t.test("preflight detects existing per-choice and cross-set records without claiming official school receipt", async () => {
    const f = await preflightFixture(pool);
    const secondSet = await f.student.createOwnApplicationSet(f.context, { name: "Second set" }, { idempotencyKey: randomUUID() });
    const second = await f.student.addOwnApplicationChoice(f.context, { applicationSetId: secondSet.id, schoolId: f.catalog.schoolId,
      programId: f.catalog.programId, programIntakeId: f.catalog.intakeId }, { idempotencyKey: randomUUID() });
    await pool.query("insert into school_applications (application_record_format, application_set_id, application_choice_id, student_user_id, school_id, program_id, program_intake_id) values ('cuac.program-application.v1',$1,$2,$3,$4,$5,$6)",
      [secondSet.id, second.id, f.userId, f.catalog.schoolId, f.catalog.programId, f.catalog.intakeId]);
    assert.ok((await f.get()).issues.includes("EXISTING_APPLICATION_REVIEW_REQUIRED"));
    assert.ok((await f.reader.get(f.context, secondSet.id, second.id, "en")).issues.includes("SCHOOL_APPLICATION_EXISTS"));
    assert.equal((await f.get()).canSubmit, false);
  });

  await t.test("preflight publication corruption and oversized education inventories fail closed without repair writes", async () => {
    const f = await preflightFixture(pool); const published = await f.publish();
    await pool.query("update program_requirement_versions set content_sha256 = $2 where id = $1", [published.requirements.versionId, "f".repeat(64)]);
    let before = await snapshotAuditedBusinessTables(pool); await assert.rejects(f.get(), e => e.status === 503); assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    await pool.query("update program_requirement_versions set content_sha256 = $2 where id = $1", [published.requirements.versionId, published.requirements.contentSha256]);
    await pool.query("update privacy_notice_versions set review_evidence_json = jsonb_set(review_evidence_json, '{reviewReference}', '\"PRIVATE_CHANGED_REFERENCE\"') where id = $1", [published.notice.versionId]);
    before = await snapshotAuditedBusinessTables(pool); await assert.rejects(f.get(), e => e.status === 503); assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    await f.notices.service.withdraw(f.notices.reviewer, f.notices.key, f.notices.locale, { expectedVersionId: published.notice.versionId, expectedPublicationRevision: 1, reason: "review_required" });
    await f.populate();
    await pool.query("insert into student_education_records (user_id, institution_name, education_level, attendance_status) select $1, 'Excess synthetic record', 'bachelor', 'unknown' from generate_series(1, 20)", [f.userId]);
    assert.equal((await pool.query("select count(*)::int as total from student_education_records where user_id = $1 and removed_at is null", [f.userId])).rows[0].total, 21);
    before = await snapshotAuditedBusinessTables(pool); await assert.rejects(f.get(), e => e.status === 503); assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
  });

  await t.test("preflight scholarship scope and known deadline changes do not become an implicit funding decision", async () => {
    const f = await preflightFixture(pool), other = await preflightFixture(pool);
    const scholarship = (await pool.query("insert into scholarships (slug, title, status) values ($1, 'Synthetic funding', 'active') returning id", [randomUUID()])).rows[0];
    await f.student.updateOwnApplicationChoice(f.context, f.set.id, f.choice.id, { expectedRevision: 2, scholarshipId: scholarship.id });
    assert.ok(!(await f.get()).issues.includes("SCHOLARSHIP_UNAVAILABLE"));
    for (const [sql, params] of [["update scholarships set school_id = $2 where id = $1", [scholarship.id, other.catalog.schoolId]],
      ["update scholarships set school_id = null, program_id = $2 where id = $1", [scholarship.id, other.catalog.programId]],
      ["update scholarships set program_id = null, status = 'draft' where id = $1", [scholarship.id]],
      ["update scholarships set status = 'active', deadline_date = now() - interval '1 second' where id = $1", [scholarship.id]]]) {
      await pool.query(sql, params); assert.ok((await f.get()).issues.includes("SCHOLARSHIP_UNAVAILABLE"));
    }
    assert.equal((await f.get()).canSubmit, false);
  });

  await t.test("preflight uses one repeatable snapshot across real profile and publication changes between queries", async () => {
    const f = await preflightFixture(pool), first = await f.publish(), paused = pausedReader(f); let pending;
    try {
      pending = f.get("en", paused.reader); await paused.reached.promise;
      await f.populate();
      const nextDraft = await preparedRequirement(f.catalog), next = await f.catalog.service.approve(f.catalog.reviewer, f.catalog.programId, f.catalog.intakeId, approveInput(nextDraft));
      await f.catalog.service.publish(f.catalog.reviewer, f.catalog.programId, f.catalog.intakeId, publishInput(next, 1));
      const notice = await approvedNotice(f.notices); await publishNotice(f.notices, notice, 1);
      await f.student.updateOwnApplicationChoice(f.context, f.set.id, f.choice.id, { expectedRevision: 2, studentNotes: "Changed privately" });
      paused.release.resolve(); const old = await pending;
      assert.equal(old.revision, 2); assert.equal(old.preparation.applicant.revision, 0); assert.equal(old.preparation.education.recordCount, 0);
      assert.equal(old.requirements.versionId, first.requirements.versionId); assert.equal(old.notice.versionId, first.notice.versionId);
      const current = await f.get(); assert.equal(current.revision, 3); assert.equal(current.preparation.applicant.revision, 1);
      assert.equal(current.requirements.versionId, next.versionId); assert.equal(current.notice.versionId, notice.versionId);
    } finally { paused.release.resolve(); if (pending) await Promise.allSettled([pending]); }
  });

  await t.test("preflight database read-only mode rejects an accidental write and does not leak session mode to later transactions", async () => {
    const f = await preflightFixture(pool); let mode;
    const reader = new PostgresApplicationPreflight({ transaction: work => f.client.transaction(tx => work({
      transaction: tx.transaction,
      query: async (sql, params) => {
        const rows = await tx.query(sql, params);
        if (sql.startsWith("set transaction")) {
          mode = (await tx.query("select current_setting('transaction_isolation') as isolation, current_setting('transaction_read_only') as readonly", []))[0];
          await tx.query("update application_sets set revision = revision + 1 where id = $1", [f.set.id]);
        }
        return rows;
      },
    })) });
    const before = await snapshotAuditedBusinessTables(pool); await assert.rejects(f.get("en", reader), e => e.code === "25006");
    assert.deepEqual(mode, { isolation: "repeatable read", readonly: "on" }); assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    await f.populate(); assert.equal((await f.get()).preparation.applicant.revision, 1);
  });

  await t.test("preflight publication time stays at the database snapshot and a fresh read observes expiry", async () => {
    const f = await preflightFixture(pool), draft = await preparedNotice(f.notices);
    const due = new Date(Date.now() + 1000);
    const notice = await f.notices.service.approve(f.notices.reviewer, f.notices.key, f.notices.locale, noticeApproveInput(draft, { reviewDueAt: due.toISOString() }));
    await publishNotice(f.notices, notice);
    const paused = pausedReader(f); let pending;
    try {
      pending = f.get("en", paused.reader); await paused.reached.promise;
      await delay(Math.max(0, due.getTime() - Date.now()) + 50); paused.release.resolve();
      assert.equal((await pending).notice.versionId, notice.versionId); assert.equal((await f.get()).notice, null);
    } finally { paused.release.resolve(); if (pending) await Promise.allSettled([pending]); }
  });
}
