import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { createPostgresStudentService } from "../../../src/server/student/runtime/routes.ts";
import { PostgresStudentCoreRepository } from "../../../src/server/student/postgres-repository.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { createAuditFailureFixture, snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

export async function runApplicationDraftRehearsal(t, pool) {
  const client = createTransactionalSqlClient(pool), service = createPostgresStudentService(client);
  const repository = new PostgresStudentCoreRepository(client);
  const schoolId = (await pool.query("select id from schools where status = 'active' limit 1")).rows[0].id;
  const key = () => ({ idempotencyKey: randomUUID() });
  async function fixture() {
    const email = `draft-${randomUUID()}@example.invalid`;
    const { rows: [user] } = await pool.query("insert into users (email, email_normalized) values ($1, $1) returning id", [email]);
    await pool.query("insert into user_roles (user_id, role) values ($1, 'student')", [user.id]);
    const context = createRequestContext({ actorUserId: user.id, activeRole: "student", selectedSurface: "student", purpose: "student_action" });
    const set = await service.createOwnApplicationSet(context, { name: "Draft freeze fixture" }, key());
    return { context, set, input: { applicationSetId: set.id, schoolId } };
  }
  async function counts(userId) {
    return (await pool.query(`select
      (select count(*)::int from application_choices where user_id = $1) as choices,
      (select count(*)::int from student_application_command_receipts where user_id = $1) as receipts,
      (select count(*)::int from audit_logs where actor_user_id = $1) as audits`, [userId])).rows[0];
  }
  async function blockedBy(pid, queryPattern) {
    for (let i = 0; i < 200; i++) {
      const { rows } = await pool.query(`select pid from pg_stat_activity where datname = current_database()
        and state = 'active' and wait_event_type = 'Lock' and $1 = any(pg_blocking_pids(pid)) and query like $2`, [pid, queryPattern]);
      if (rows.length) return;
      await delay(10);
    }
    assert.fail("Application write did not reach the expected parent row lock.");
  }

  await t.test("new choice writes reject non-draft or timestamp-frozen sets without business, receipt or audit changes", async () => {
    const { context, set, input } = await fixture();
    for (const [status, locked, submitted] of [["submitted", false, false], ["payment_pending", false, false], ["archived", false, false],
      ["unknown", false, false], ["draft", true, false], ["draft", false, true]]) {
      await pool.query(`update application_sets set status = $2, locked_at = case when $3 then now() end,
        submitted_at = case when $4 then now() end where id = $1`, [set.id, status, locked, submitted]);
      const before = await snapshotAuditedBusinessTables(pool);
      await assert.rejects(service.addOwnApplicationChoice(context, input, key()), e => e.status === 409 && e.code === "CONFLICT");
      await assert.rejects(repository.addApplicationChoice(context.actorUserId, input), e => e.status === 409);
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    }
  });

  await t.test("frozen parent state is not disclosed to another student or a missing owner", async () => {
    const a = await fixture(), b = await fixture();
    await pool.query("update application_sets set status = 'submitted', locked_at = now() where id = $1", [a.set.id]);
    const before = await snapshotAuditedBusinessTables(pool);
    for (const applicationSetId of [a.set.id, randomUUID()]) {
      await assert.rejects(service.addOwnApplicationChoice(b.context, { ...a.input, applicationSetId }, key()), e => e.status === 403);
      await assert.rejects(repository.addApplicationChoice(b.context.actorUserId, { ...a.input, applicationSetId }), e => e.status === 403);
    }
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
  });

  await t.test("a committed choice receipt remains recoverable after freeze while new or changed commands cannot create", async () => {
    const { context, set, input } = await fixture(), originalKey = key();
    const first = await service.addOwnApplicationChoice(context, input, originalKey);
    await pool.query("update application_sets set status = 'submitted', locked_at = now(), submitted_at = now() where id = $1", [set.id]);
    const again = await service.addOwnApplicationChoice({ ...context, requestId: randomUUID() }, input, originalKey);
    assert.equal(again.id, first.id);
    const before = await counts(context.actorUserId);
    await assert.rejects(service.addOwnApplicationChoice(context, input, key()), e => e.status === 409);
    await assert.rejects(service.addOwnApplicationChoice(context, { ...input, studentNotes: "Changed" }, originalKey), e => e.status === 409);
    assert.deepEqual(await counts(context.actorUserId), before);
    assert.equal(before.choices, 1);
    assert.equal((await pool.query("select count(*)::int as n from audit_logs where actor_user_id = $1 and action = 'student.application_choice.add'", [context.actorUserId])).rows[0].n, 1);
  });

  for (const commit of [true, false]) await t.test(`choice waits for a concurrent freeze and uses its ${commit ? "committed" : "rolled back"} state`, async () => {
    const { context, set, input } = await fixture(), freezer = await pool.connect();
    const before = await counts(context.actorUserId);
    let attempt;
    try {
      await freezer.query("begin");
      await freezer.query("update application_sets set locked_at = clock_timestamp() where id = $1", [set.id]);
      attempt = service.addOwnApplicationChoice(context, input, key()); attempt.catch(() => {});
      await blockedBy(freezer.processID, "with owned_application_set%");
      await freezer.query(commit ? "commit" : "rollback");
      if (commit) {
        await assert.rejects(attempt, e => e.status === 409);
        assert.deepEqual(await counts(context.actorUserId), before);
      } else {
        assert.ok((await attempt).id);
        assert.deepEqual(await counts(context.actorUserId), { choices: before.choices + 1, receipts: before.receipts + 1, audits: before.audits + 1 });
      }
    } finally { await freezer.query("rollback"); freezer.release(); if (attempt) await Promise.allSettled([attempt]); }
  });

  for (const failAudit of [false, true]) await t.test(`freeze waits until the choice transaction ${failAudit ? "rolls back its audit failure" : "commits business, receipt and audit"}`, async () => {
    const { context, set, input } = await fixture(), inserted = deferred(), proceed = deferred();
    const faults = failAudit ? await createAuditFailureFixture(pool) : null;
    const gated = { ...client, transaction: work => client.transaction(tx => work({ ...tx, async query(sql, params) {
      const rows = await tx.query(sql, params);
      if (sql.startsWith("with owned_application_set")) { inserted.resolve((await tx.query("select pg_backend_pid() as pid", []))[0].pid); await proceed.promise; }
      return rows;
    } })) };
    const freezer = await pool.connect(), before = await counts(context.actorUserId);
    let attempt, freeze;
    const run = async () => {
      attempt = createPostgresStudentService(gated).addOwnApplicationChoice(context, input, key()); attempt.catch(() => {});
      const pid = await Promise.race([inserted.promise, delay(5000, null, { ref: false })]);
      assert.ok(pid, "Choice must hold the parent lock before the freeze starts.");
      await freezer.query("begin");
      freeze = freezer.query("update application_sets set locked_at = clock_timestamp() where id = $1", [set.id]); freeze.catch(() => {});
      await blockedBy(pid, "update application_sets set locked_at%");
      proceed.resolve();
      if (failAudit) await assert.rejects(attempt, e => e.code === "P0001"); else assert.ok((await attempt).id);
      await freeze;
      const visible = (await freezer.query("select count(*)::int as n from application_choices where application_set_id = $1", [set.id])).rows[0].n;
      assert.equal(visible, failAudit ? 0 : 1);
      await freezer.query("commit");
      assert.deepEqual(await counts(context.actorUserId), failAudit ? before : { choices: before.choices + 1, receipts: before.receipts + 1, audits: before.audits + 1 });
    };
    try { if (faults) await faults.during("student.application_choice.add", run); else await run(); }
    finally {
      proceed.resolve();
      if (attempt) await Promise.allSettled([attempt]);
      if (freeze) await Promise.allSettled([freeze]);
      await freezer.query("rollback"); freezer.release();
      if (faults) await faults.close();
    }
  });

  await t.test("same-school programs retain independent choices and school records, never a school-level merge", async () => {
    const { context, set, input } = await fixture(), programIds = [], choiceIds = [];
    for (let i = 0; i < 2; i++) {
      const { rows: [program] } = await pool.query("insert into programs (school_id, slug, name_en, degree_level, status) values ($1, $2, 'Synthetic route', 'master', 'active') returning id", [schoolId, `draft-${randomUUID()}`]);
      programIds.push(program.id);
      const choice = await service.addOwnApplicationChoice(context, { ...input, programId: program.id }, key());
      choiceIds.push(choice.id);
      await pool.query(`insert into school_applications (application_record_format, application_set_id, application_choice_id, student_user_id, school_id, program_id)
        values ('cuac.program-application.v1', $1, $2, $3, $4, $5)`, [set.id, choice.id, context.actorUserId, schoolId, program.id]);
    }
    assert.equal(new Set(choiceIds).size, 2);
    const records = (await pool.query("select application_choice_id, program_id from school_applications where application_set_id = $1", [set.id])).rows;
    assert.equal(records.length, 2);
    assert.deepEqual(records.map(row => row.program_id).sort(), programIds.sort());
    await assert.rejects(service.addOwnApplicationChoice(context, { ...input, programId: programIds[0] }, key()), e => e.status === 409);
    assert.equal((await service.getOwnApplicationSet(context, set.id)).choices.length, 2);
  });
}
