import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { createPostgresStudentService } from "../../../src/server/student/runtime/routes.ts";
import { PostgresCatalogRepository } from "../../../src/server/catalog/postgres-repository.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { createAuditFailureFixture, snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

export async function runApplicationIntakeRehearsal(t, pool) {
  const client = createTransactionalSqlClient(pool), service = createPostgresStudentService(client);
  const catalog = new PostgresCatalogRepository(client), key = () => ({ idempotencyKey: randomUUID() });
  async function fixture() {
    const email = `intake-${randomUUID()}@example.invalid`;
    const user = (await pool.query("insert into users (email, email_normalized) values ($1, $1) returning id", [email])).rows[0];
    await pool.query("insert into user_roles (user_id, role) values ($1, 'student')", [user.id]);
    const context = createRequestContext({ actorUserId: user.id, activeRole: "student", selectedSurface: "student", purpose: "student_action" });
    const school = (await pool.query("insert into schools (slug, name_en, status) values ($1, 'Intake school', 'active') returning id", [`intake-${randomUUID()}`])).rows[0];
    const program = (await pool.query("insert into programs (school_id, slug, name_en, degree_level, status) values ($1, $2, 'Intake program', 'master', 'active') returning id", [school.id, `intake-${randomUUID()}`])).rows[0];
    const intakes = (await pool.query(`insert into program_intakes (program_id, intake_term, intake_year, open_date, deadline_date, status)
      values ($1, 'fall', 2090, now() + interval '1 year', now() + interval '2 years', 'open'),
        ($1, 'spring', 2091, null, null, 'open') returning id`, [program.id])).rows;
    const set = await service.createOwnApplicationSet(context, { name: "Intake choices", targetIntake: "untrusted label" }, key());
    return { context, set, program, school, intakes, input: { applicationSetId: set.id, schoolId: school.id, programId: program.id, programIntakeId: intakes[0].id } };
  }
  const add = (f, input = {}, options = key(), s = service) => s.addOwnApplicationChoice(f.context, { ...f.input, ...input }, options);
  const current = f => service.getOwnApplicationSet(f.context, f.set.id);
  async function blockedBy(pid) {
    for (let i = 0; i < 200; i++) {
      const rows = (await pool.query("select pid from pg_stat_activity where datname = current_database() and state = 'active' and wait_event_type = 'Lock' and $1 = any(pg_blocking_pids(pid))", [pid])).rows;
      if (rows.length) return;
      await delay(10);
    }
    assert.fail("Intake command did not reach the expected lock barrier.");
  }

  await t.test("intake identity preserves legacy drafts and permits distinct cycles but rejects repeated exact targets", async () => {
    const f = await fixture();
    const legacy = await add(f, { programIntakeId: null });
    const first = await add(f), second = await add(f, { programIntakeId: f.intakes[1].id });
    assert.equal(legacy.programIntakeId, null);
    assert.notEqual(first.id, second.id);
    let state = await current(f);
    assert.equal(state.revision, 4);
    assert.deepEqual(new Set(state.choices.map(c => c.programIntakeId)), new Set([null, ...f.intakes.map(i => i.id)]));
    assert.equal((await service.listOwnApplicationSets(f.context))[0].choices.length, 3);
    const before = await snapshotAuditedBusinessTables(pool);
    await assert.rejects(add(f), e => e.status === 409);
    await assert.rejects(add(f, { programIntakeId: null }), e => e.status === 409);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    state = await service.updateOwnApplicationChoice(f.context, f.set.id, first.id, { expectedRevision: state.revision, studentNotes: "Only one cycle" });
    assert.equal(state.choices.find(c => c.id === second.id).studentNotes, null);
    assert.equal(state.choices.find(c => c.id === first.id).programIntakeId, f.intakes[0].id);
  });

  await t.test("public intakes are scoped, paged, available and contain no private application fields", async () => {
    const f = await fixture();
    const first = await catalog.listProgramIntakes(f.program.id, { limit: 1, offset: 0 });
    const second = await catalog.listProgramIntakes(f.program.id, { limit: 1, offset: 1 });
    assert.deepEqual([first[0].id, second[0].id], f.intakes.map(i => i.id));
    assert.deepEqual(await catalog.listProgramIntakes(f.program.id, { offset: 2 }), []);
    assert.deepEqual(Object.keys(first[0]).sort(), ["id", "programId", "intakeTerm", "intakeYear", "openDate", "deadlineDate", "deadlineLabel", "applicationRound", "status"].sort());
    await pool.query("update program_intakes set status = 'draft' where id = $1", [f.intakes[0].id]);
    assert.deepEqual((await catalog.listProgramIntakes(f.program.id, {})).map(i => i.id), [f.intakes[1].id]);
    for (const table of ["programs", "schools"]) {
      const id = table === "programs" ? f.program.id : f.school.id;
      await pool.query(`update ${table} set status = 'draft' where id = $1`, [id]);
      assert.deepEqual(await catalog.listProgramIntakes(f.program.id, {}), []);
      await pool.query(`update ${table} set status = 'active' where id = $1`, [id]);
    }
    assert.deepEqual(await catalog.listProgramIntakes(randomUUID(), {}), []);
  });

  await t.test("invalid scope, hidden or expired intakes cannot write a choice, revision, receipt or success audit", async () => {
    const f = await fixture(), other = await fixture();
    let before = await snapshotAuditedBusinessTables(pool);
    for (const input of [{ programIntakeId: randomUUID() }, { programIntakeId: other.intakes[0].id }, { schoolId: other.school.id }]) {
      await assert.rejects(add(f, input), e => e.status === 403);
    }
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    for (const change of ["status = 'draft'", "status = 'closed'", "deadline_date = now() - interval '1 second'",
      "open_date = now() + interval '3 years', deadline_date = now() + interval '2 years'"]) {
      await pool.query(`update program_intakes set ${change} where id = $1`, [f.intakes[0].id]);
      before = await snapshotAuditedBusinessTables(pool);
      await assert.rejects(add(f), e => e.status === 403);
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      assert.ok(!(await catalog.listProgramIntakes(f.program.id, {})).some(i => i.id === f.intakes[0].id));
      await pool.query("update program_intakes set status = 'open', open_date = null, deadline_date = null where id = $1", [f.intakes[0].id]);
    }
  });

  await t.test("database intake constraints reject mismatched targets and prevent loss of bound catalog identity", async () => {
    const f = await fixture(), other = await fixture();
    const sql = "insert into application_choices (application_set_id, user_id, school_id, program_id, program_intake_id) values ($1, $2, $3, $4, $5)";
    await assert.rejects(pool.query(sql, [f.set.id, f.context.actorUserId, f.school.id, null, f.intakes[0].id]), e => e.code === "23514");
    await assert.rejects(pool.query(sql, [f.set.id, f.context.actorUserId, f.school.id, f.program.id, other.intakes[0].id]), e => e.code === "23503");
    const choice = await add(f);
    await assert.rejects(pool.query(sql, [f.set.id, f.context.actorUserId, f.school.id, f.program.id, f.intakes[0].id]), e => e.code === "23505");
    for (const [command, params] of [["delete from program_intakes where id = $1", [f.intakes[0].id]],
      ["update program_intakes set program_id = $2, intake_term = 'transferred' where id = $1", [f.intakes[0].id, other.program.id]]]) {
      await assert.rejects(pool.query(command, params), e => e.code === "23503");
    }
    await assert.rejects(pool.query("delete from programs where id = $1", [f.program.id]), e => ["23503", "23514"].includes(e.code));
    await service.removeOwnApplicationChoice(f.context, f.set.id, choice.id);
    await assert.rejects(pool.query("delete from program_intakes where id = $1", [f.intakes[0].id]), e => e.code === "23503");
    const replacement = await add(f);
    assert.notEqual(replacement.id, choice.id);
    await service.removeOwnApplicationChoice(f.context, f.set.id, choice.id);
    assert.equal((await current(f)).choices[0].id, replacement.id);
  });

  await t.test("v1 receipts stay usable and v2 key reuse cannot silently switch or remove an intake", async () => {
    const f = await fixture(), oldKey = key(), newKey = key();
    const legacy = await add(f, { programIntakeId: null }, oldKey);
    const originalInput = { applicationSetId: f.set.id, schoolId: f.school.id, programId: f.program.id, scholarshipId: null, rankOrder: 0, studentNotes: null };
    const oldHash = createHash("sha256").update(JSON.stringify({ version: 1, operation: "application_choice.add", input: originalInput })).digest("hex");
    assert.equal((await pool.query("select request_hash from student_application_command_receipts where resource_id = $1", [legacy.id])).rows[0].request_hash, oldHash);
    assert.equal((await add(f, { programIntakeId: undefined }, oldKey)).id, legacy.id);
    await assert.rejects(add(f, {}, oldKey), e => e.status === 409);
    const bound = await add(f, {}, newKey);
    assert.equal((await add(f, { programIntakeId: f.intakes[0].id.toUpperCase() }, newKey)).id, bound.id);
    await assert.rejects(add(f, { programIntakeId: f.intakes[1].id }, newKey), e => e.status === 409);
    await assert.rejects(add(f, { programIntakeId: null }, newKey), e => e.status === 409);
    await pool.query("update program_intakes set status = 'closed' where id = $1", [f.intakes[0].id]);
    await pool.query("update application_sets set locked_at = now() where id = $1", [f.set.id]);
    assert.equal((await add(f, {}, newKey)).id, bound.id);
    assert.equal((await current(f)).revision, 3);
  });

  await t.test("same-target different keys serialize to one choice while distinct intake targets both survive", async () => {
    for (const same of [true, false]) {
      const f = await fixture(), blocker = await pool.connect(); let requests = [];
      try {
        await blocker.query("begin");
        await blocker.query("select id from application_sets where id = $1 for update", [f.set.id]);
        requests = [add(f), add(f, { programIntakeId: same ? f.intakes[0].id : f.intakes[1].id })];
        const settled = Promise.allSettled(requests);
        await blockedBy((await blocker.query("select pg_backend_pid() as pid")).rows[0].pid);
        await blocker.query("commit");
        const result = await settled;
        assert.equal(result.filter(r => r.status === "fulfilled").length, same ? 1 : 2);
        for (const r of result.filter(r => r.status === "rejected")) assert.equal(r.reason.status, 409);
        const state = await current(f);
        assert.equal(state.choices.length, same ? 1 : 2); assert.equal(state.revision, same ? 2 : 3);
      } finally { await blocker.query("rollback"); blocker.release(); await Promise.allSettled(requests); }
    }
  });

  await t.test("a closing intake wins over a waiting draft selection without leaving partial writes", async () => {
    const f = await fixture(), blocker = await pool.connect(); let pending;
    try {
      await blocker.query("begin");
      await blocker.query("update program_intakes set status = 'closed' where id = $1", [f.intakes[0].id]);
      pending = add(f); const failed = assert.rejects(pending, e => e.status === 403);
      await blockedBy((await blocker.query("select pg_backend_pid() as pid")).rows[0].pid);
      await blocker.query("commit");
      await failed;
      assert.equal((await current(f)).revision, 1);
      assert.equal((await current(f)).choices.length, 0);
      assert.equal((await pool.query("select count(*)::int as n from student_application_command_receipts where user_id = $1", [f.context.actorUserId])).rows[0].n, 1);
    } finally { await blocker.query("rollback"); blocker.release(); if (pending) await Promise.allSettled([pending]); }
  });

  await t.test("a completed intake check holds a share lock until the choice transaction ends", async () => {
    const f = await fixture(), arrived = deferred(), proceed = deferred(); let update;
    const gated = { ...client, transaction: work => client.transaction(tx => work({ ...tx, async query(sql, params) {
      const rows = await tx.query(sql, params);
      if (sql.startsWith("with owned_application_set")) {
        arrived.resolve((await tx.query("select pg_backend_pid() as pid", []))[0].pid);
        await proceed.promise;
      }
      return rows;
    } })) };
    const pending = add(f, {}, key(), createPostgresStudentService(gated));
    const settled = Promise.allSettled([pending]);
    try {
      const pid = await Promise.race([arrived.promise, delay(5000, null, { ref: false })]);
      assert.ok(pid, "Production choice SQL did not finish its intake check.");
      update = pool.query("update program_intakes set status = 'closed' where id = $1", [f.intakes[0].id]);
      await blockedBy(pid);
      proceed.resolve(); await pending; await update;
      assert.equal((await current(f)).choices[0].programIntakeId, f.intakes[0].id);
    } finally { proceed.resolve(); await settled; if (update) await Promise.allSettled([update]); }
  });

  await t.test("intake-bound choice audit failure rolls back target, revision and receipt before explicit retry", async () => {
    const f = await fixture(), commandKey = key(), fault = await createAuditFailureFixture(pool);
    try {
      const before = await snapshotAuditedBusinessTables(pool);
      await fault.during("student.application_choice.add", () => assert.rejects(add(f, { studentNotes: "private-intake-note" }, commandKey)));
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      const choice = await add(f, { studentNotes: "private-intake-note" }, commandKey);
      const audits = (await pool.query("select metadata_json from audit_logs where resource_id = $1 and action = 'student.application_choice.add'", [choice.id])).rows;
      assert.equal(audits[0].metadata_json.programIntakeId, f.intakes[0].id);
      assert.doesNotMatch(JSON.stringify(audits), /private-intake-note/);
    } finally { await fault.close(); }
  });

  await t.test("lost COMMIT confirmation for intake-bound creation recovers the exact target with the original key", async () => {
    const f = await fixture(), commandKey = key(); let commits = 0;
    const ambiguous = createTransactionalSqlClient({ query: pool.query.bind(pool), async connect() {
      const connection = await pool.connect();
      return { async query(sql, params) { const result = await connection.query(sql, params); if (sql === "commit") { commits++; throw new Error("Synthetic intake COMMIT acknowledgement loss"); } return result; },
        release(destroy) { connection.release(destroy); } };
    } });
    await assert.rejects(add(f, {}, commandKey, createPostgresStudentService(ambiguous)), /Synthetic intake COMMIT/);
    const replay = await add(f, {}, commandKey);
    assert.equal(commits, 1); assert.equal(replay.programIntakeId, f.intakes[0].id);
    assert.equal((await current(f)).choices.length, 1); assert.equal((await current(f)).revision, 2);
  });

  await t.test("intake parameters never bypass owner, role, tenant or frozen-set authority", async () => {
    const f = await fixture(), other = await fixture();
    const before = await snapshotAuditedBusinessTables(pool);
    for (const context of [other.context, { ...f.context, activeRole: "guest" }, { ...f.context, activeRole: "school_admin" },
      { ...f.context, tenantSchoolId: f.school.id }, { ...f.context, dataClassAllowlist: [] }]) {
      await assert.rejects(service.addOwnApplicationChoice(context, f.input, key()), e => e.status === 403);
    }
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    await pool.query("update user_roles set revoked_at = now() where user_id = $1", [f.context.actorUserId]);
    await assert.rejects(add(f), e => e.status === 403);
    await pool.query("update user_roles set revoked_at = null where user_id = $1", [f.context.actorUserId]);
    await pool.query("update application_sets set locked_at = now() where id = $1", [f.set.id]);
    await assert.rejects(add(f), e => e.status === 409);
    assert.equal((await current(f)).revision, 1);
  });
}
