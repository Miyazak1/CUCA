import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  applicationAtomicSubmissionFixture,
  clearApplicationAtomicSubmissions,
} from "./application-atomic-submission-fixture.mjs";
import { createAuditFailureFixture, snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";

export async function runApplicationAtomicSubmissionRehearsal(t, pool) {
  const isolated = async (options, work) => {
    await clearApplicationAtomicSubmissions(pool);
    const fixture = await applicationAtomicSubmissionFixture(pool, options);
    try { return await work(fixture); }
    finally { await clearApplicationAtomicSubmissions(pool); }
  };

  await t.test("same-school projects remain independent applications under one-program official forms", async () => {
    await isolated({}, async f => {
    await assert.rejects(pool.query(`insert into school_applications
      (application_set_id,cuac_id,application_choice_id,student_user_id,school_id,program_id,program_intake_id)
      values ($1,$2,$3,$4,$5,$6,$7)`, [f.set.id, f.set.cuacId, f.choice.id, f.userId, f.catalog.schoolId,
      f.catalog.programId, f.catalog.intakeId]), error => error.code === "23514"
        && error.constraint === "school_applications_format_check");
    const key = randomUUID();
    const first = await f.submit(f.input, key);
    const replay = await f.submit(f.input, key, { ...f.context, requestId: `replay-${randomUUID()}` });
    assert.deepEqual(replay, first);
    assert.equal(first.status, "accepted");
    assert.equal(first.acceptanceScope, "cuac_internal");
    assert.equal(first.cuacId, f.set.cuacId);
    assert.equal(first.programApplications.length, 2);
    assert.equal(first.officialSubmissionGroups.length, 2);
    assert.ok(first.officialSubmissionGroups.every(group => group.memberCount === 1
      && group.transportStatus === "pending" && group.formMode === "one_program_per_form"));
    assert.doesNotMatch(JSON.stringify(first), /authorization|snapshot|entitlement|invoice|payment|amount|currency|outbox|provider/i);

    const applications = (await pool.query(`select id,cuac_id,application_record_format,application_choice_id,school_id,
      program_id,program_intake_id,authorization_id,material_snapshot_id,fee_entitlement_id,status,submitted_at
      from school_applications where application_submission_id = $1 order by application_choice_id`, [first.id])).rows;
    assert.equal(applications.length, 2);
    assert.deepEqual(new Set(applications.map(row => row.school_id)), new Set([f.catalog.schoolId]));
    assert.deepEqual(new Set(applications.map(row => row.program_id)),
      new Set([f.catalog.programId, f.second.programId]));
    assert.ok(applications.every(row => row.application_record_format === "cuac.program-application.v2"
      && row.cuac_id === f.set.cuacId && row.status === "pending_submission" && row.submitted_at === null));
    const invoiceReferences = (await pool.query(
      "select cuac_id from invoices where application_set_id = $1",
      [f.set.id],
    )).rows;
    assert.ok(invoiceReferences.length > 0 && invoiceReferences.every(row => row.cuac_id === f.set.cuacId));
    await assert.rejects(
      pool.query("update school_applications set cuac_id = null where id = $1", [applications[0].id]),
      error => error.code === "23514" && error.constraint === "school_applications_v2_cuac_id_required_check",
    );
    const sequence = Number(f.set.cuacId.slice(-6));
    const mismatchedCuacId = `${f.set.cuacId.slice(0, -6)}${String(sequence === 999999 ? sequence - 1 : sequence + 1).padStart(6, "0")}`;
    await assert.rejects(
      pool.query("update school_applications set cuac_id = $2 where id = $1", [applications[0].id, mismatchedCuacId]),
      error => error.code === "23503" && error.constraint === "school_applications_cuac_scope_fk",
    );
    for (const field of ["application_choice_id", "authorization_id", "material_snapshot_id", "fee_entitlement_id"]) {
      assert.equal(new Set(applications.map(row => row[field])).size, 2);
    }
    const counts = await submissionCounts(pool, f.set.id);
    assert.deepEqual(counts, { submissions: 1, applications: 2, groups: 2, members: 2, outbox: 2, receipts: 1 });
    const states = await pool.query("select status,locked_at,submitted_at from application_sets where id = $1", [f.set.id]);
    assert.equal(states.rows[0].status, "submitted");
    assert.ok(states.rows[0].locked_at instanceof Date && states.rows[0].submitted_at instanceof Date);
    assert.ok((await pool.query("select status from application_choices where application_set_id = $1", [f.set.id])).rows
      .every(row => row.status === "submitted"));
    const audit = (await pool.query(`select metadata_json from audit_logs
      where action = 'student.application_submission.accept' and resource_id = $1`, [first.id])).rows;
    assert.equal(audit.length, 1);
    assert.deepEqual(audit[0].metadata_json.choiceCount, 2);
    assert.deepEqual(audit[0].metadata_json.groupCount, 2);
    assert.doesNotMatch(JSON.stringify(audit), /invoice|payment|provider|authorization|snapshot|entitlement|amount|currency/i);
    const notifications = (await pool.query(`select e.event_type,e.resource_id,d.channel,d.status,d.title,d.body
      from notification_events e join notification_deliveries d on d.event_id = e.id
      where e.resource_type = 'application_submission' and e.resource_id = $1 order by d.channel`, [first.id])).rows;
    assert.deepEqual(notifications.map(row => ({ channel: row.channel, status: row.status })), [
      { channel: "email", status: "queued" },
      { channel: "in_app", status: "unread" },
      { channel: "sms", status: "suppressed" },
    ]);
    assert.ok(notifications.every(row => row.event_type === "application_submission_accepted"
      && row.resource_id === first.id && /CUAC accepted/i.test(row.title)
      && /does not mean each school has received/i.test(row.body)));
    assert.doesNotMatch(JSON.stringify(notifications), /invoice|payment|provider|authorization|snapshot|entitlement|amount|currency/i);
    await assert.rejects(f.submit(f.input, randomUUID()), error => error.status === 409);
    assert.deepEqual(await submissionCounts(pool, f.set.id), counts);

    const members = (await pool.query(`select group_id,member_position,fee_entitlement_id
      from official_submission_group_members where application_submission_id = $1 order by group_id`, [first.id])).rows;
    await assert.rejects(pool.query(`update official_submission_group_members set fee_entitlement_id = $3
      where group_id = $1 and member_position = $2`, [members[0].group_id, members[0].member_position,
      members[1].fee_entitlement_id]), error => error.code === "23503"
        && error.constraint === "official_submission_group_members_application_evidence_fk");
    });
  });

  await t.test("multi-program official form groups transport without collapsing project identity", async () => {
    await isolated({ formMode: "multi_program_form", orderingMode: "ranked" }, async f => {
    const result = await f.submit();
    assert.equal(result.programApplications.length, 2);
    assert.equal(result.officialSubmissionGroups.length, 1);
    assert.equal(result.officialSubmissionGroups[0].memberCount, 2);
    const members = (await pool.query(`select school_application_id,application_choice_id,program_id,
      program_intake_id,member_position from official_submission_group_members
      where application_submission_id = $1 order by member_position`, [result.id])).rows;
    assert.deepEqual(members.map(row => row.member_position), [1, 2]);
    assert.deepEqual(new Set(members.map(row => row.program_id)), new Set([f.catalog.programId, f.second.programId]));
    assert.equal(new Set(members.map(row => row.school_application_id)).size, 2);
    assert.deepEqual(await submissionCounts(pool, f.set.id),
      { submissions: 1, applications: 2, groups: 1, members: 2, outbox: 1, receipts: 1 });
    });
  });

  await t.test("same idempotency key racing creates one complete submission and one replay", async () => {
    await isolated({ formMode: "multi_program_form" }, async f => {
    const key = randomUUID();
    const results = await Promise.all([
      f.submit(f.input, key, { ...f.context, requestId: `race-a-${randomUUID()}` }),
      f.submit(f.input, key, { ...f.context, requestId: `race-b-${randomUUID()}` }),
    ]);
    assert.equal(results[0].id, results[1].id);
    assert.deepEqual(await submissionCounts(pool, f.set.id),
      { submissions: 1, applications: 2, groups: 1, members: 2, outbox: 1, receipts: 1 });
    assert.equal((await pool.query(`select count(*)::int as total from audit_logs
      where action = 'student.application_command.replay' and resource_id = $1`, [results[0].id])).rows[0].total, 1);
    });
  });

  await t.test("stale membership policy requirements payment and encrypted snapshot fail the whole batch", async () => {
    await isolated({}, async f => {
    const empty = { submissions: 0, applications: 0, groups: 0, members: 0, outbox: 0, receipts: 0 };
    await assert.rejects(f.submit({ ...f.input, choiceIds: [f.choice.id] }), error => error.status === 409);
    await assert.rejects(f.submit({ ...f.input, expectedRevision: f.input.expectedRevision - 1 }), error => error.status === 409);
    assert.deepEqual(await submissionCounts(pool, f.set.id), empty);

    await pool.query("update payments set status = 'refunded', refunded_at = now() where id = $1", [f.paymentId]);
    await assert.rejects(f.submit(), error => error.status === 409);
    await pool.query("update payments set status = 'succeeded', refunded_at = null where id = $1", [f.paymentId]);
    assert.deepEqual(await submissionCounts(pool, f.set.id), empty);

    await pool.query("update program_requirement_publications set status = 'withdrawn' where program_intake_id = $1",
      [f.catalog.intakeId]);
    await assert.rejects(f.submit(), error => error.status === 409);
    await pool.query("update program_requirement_publications set status = 'active' where program_intake_id = $1",
      [f.catalog.intakeId]);

    await pool.query(`update official_submission_policy_publications set status = 'withdrawn'
      where program_intake_id = $1 and admission_route_key = 'direct_university'`, [f.catalog.intakeId]);
    await assert.rejects(f.submit(), error => error.status === 409);
    await pool.query(`update official_submission_policy_publications set status = 'active'
      where program_intake_id = $1 and admission_route_key = 'direct_university'`, [f.catalog.intakeId]);

    const stored = (await pool.query("select id,envelope_json from application_material_snapshots where application_choice_id = $1",
      [f.choice.id])).rows[0];
    await pool.query(`update application_material_snapshots set envelope_json = jsonb_set(envelope_json,'{ciphertext}',
      to_jsonb((case when left(envelope_json->>'ciphertext',1) = 'A' then 'B' else 'A' end)
        || substring(envelope_json->>'ciphertext' from 2))) where id = $1`, [stored.id]);
    await assert.rejects(f.submit(), error => error.status === 503);
    await pool.query("update application_material_snapshots set envelope_json = $2::jsonb where id = $1",
      [stored.id, JSON.stringify(stored.envelope_json)]);
    assert.deepEqual(await submissionCounts(pool, f.set.id), empty);
    assert.equal((await f.submit()).programApplications.length, 2);
    });
  });

  await t.test("audit failure rolls back submission applications groups outbox states and receipt", async () => {
    await isolated({ formMode: "multi_program_form" }, async f => {
    const fault = await createAuditFailureFixture(pool);
    try {
      const before = await snapshotAuditedBusinessTables(pool);
      await assert.rejects(fault.during("student.application_submission.accept", () => f.submit()),
        error => error.code === "P0001");
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      await assert.rejects(fault.during("notification.event.created", () => f.submit()),
        error => error.code === "P0001");
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    } finally {
      await fault.close();
    }
    assert.equal((await f.submit()).programApplications.length, 2);
    });
  });
}

async function submissionCounts(pool, setId) {
  const row = (await pool.query(`select
    (select count(*)::int from application_submissions where application_set_id = $1) as submissions,
    (select count(*)::int from school_applications where application_set_id = $1 and application_record_format = 'cuac.program-application.v2') as applications,
    (select count(*)::int from official_submission_groups where application_set_id = $1) as groups,
    (select count(*)::int from official_submission_group_members where application_set_id = $1) as members,
    (select count(*)::int from official_submission_outbox o join official_submission_groups g on g.id = o.group_id where g.application_set_id = $1) as outbox,
    (select count(*)::int from student_application_command_receipts r join application_sets a on a.user_id = r.user_id
      where a.id = $1 and r.operation = 'application.submit') as receipts`, [setId])).rows[0];
  return row;
}
