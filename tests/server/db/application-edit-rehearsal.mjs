import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { createPostgresStudentService } from "../../../src/server/student/runtime/routes.ts";
import { PostgresStudentCoreRepository } from "../../../src/server/student/postgres-repository.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { createAuditFailureFixture, snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

export async function runApplicationEditRehearsal(t, pool) {
  const client = createTransactionalSqlClient(pool), service = createPostgresStudentService(client);
  const schoolId = (await pool.query("select id from schools where status = 'active' limit 1")).rows[0].id;
  const key = () => ({ idempotencyKey: randomUUID() });
  async function fixture(count = 2) {
    const email = `edit-${randomUUID()}@example.invalid`;
    const { rows: [user] } = await pool.query("insert into users (email, email_normalized) values ($1, $1) returning id", [email]);
    await pool.query("insert into user_roles (user_id, role) values ($1, 'student')", [user.id]);
    const context = createRequestContext({ actorUserId: user.id, activeRole: "student", selectedSurface: "student", purpose: "student_action" });
    const originalSet = await service.createOwnApplicationSet(context, { name: "Edit fixture" }, key()), choices = [];
    for (let i = 0; i < count; i++) {
      const { rows: [program] } = await pool.query("insert into programs (school_id, slug, name_en, degree_level, status) values ($1, $2, 'Synthetic route', 'master', 'active') returning id", [schoolId, `edit-${randomUUID()}`]);
      choices.push(await service.addOwnApplicationChoice(context, { applicationSetId: originalSet.id, schoolId, programId: program.id, rankOrder: i, studentNotes: "Original note" }, key()));
    }
    const set = await service.getOwnApplicationSet(context, originalSet.id);
    return { context, set, choices, choice: choices[0] };
  }
  const current = f => service.getOwnApplicationSet(f.context, f.set.id);
  const edit = (f, s = service, input = {}) => s.updateOwnApplicationChoice(f.context, f.set.id, f.choice.id,
    { expectedRevision: f.set.revision, studentNotes: "private-edit-marker", ...input });
  const order = (f, s = service, input = {}) => s.reorderOwnApplicationChoices(f.context, f.set.id,
    { expectedRevision: f.set.revision, choiceIds: f.choices.map(c => c.id).reverse(), ...input });
  async function blockedBy(pid) {
    for (let i = 0; i < 200; i++) {
      const { rows } = await pool.query(`select pid from pg_stat_activity where datname = current_database()
        and state = 'active' and wait_event_type = 'Lock' and $1 = any(pg_blocking_pids(pid)) and query like 'with owned_application_set%'`, [pid]);
      if (rows.length) return;
      await delay(10);
    }
    assert.fail("Draft command did not reach the expected parent lock.");
  }
  function gate() {
    const reached = deferred(), proceed = deferred();
    const gated = { ...client, transaction: work => client.transaction(tx => work({ ...tx, async query(sql, params) {
      const rows = await tx.query(sql, params);
      if (sql.startsWith("with owned_application_set")) {
        reached.resolve((await tx.query("select pg_backend_pid() as pid", []))[0].pid); await proceed.promise;
      }
      return rows;
    } })) };
    return { service: createPostgresStudentService(gated), proceed,
      wait: () => Promise.race([reached.promise, delay(5000, null, { ref: false })]).then(pid => { assert.ok(pid); return pid; }) };
  }

  await t.test("all actual draft changes advance one parent revision while receipts and repeat removal do not", async () => {
    const f = await fixture(0); assert.equal(f.set.revision, 1);
    const input = { applicationSetId: f.set.id, schoolId }, commandKey = key();
    const choice = await service.addOwnApplicationChoice(f.context, input, commandKey);
    assert.equal((await current(f)).revision, 2);
    await service.addOwnApplicationChoice(f.context, input, commandKey);
    assert.equal((await current(f)).revision, 2);
    await service.removeOwnApplicationChoice(f.context, f.set.id, choice.id);
    assert.equal((await current(f)).revision, 3);
    await service.removeOwnApplicationChoice(f.context, f.set.id, choice.id);
    assert.equal((await current(f)).revision, 3);
    assert.equal((await service.listOwnApplicationSets(f.context))[0].revision, 3);
  });

  await t.test("choice PATCH preserves omitted fields, clears explicit nulls and never changes same-school siblings", async () => {
    const f = await fixture(), sibling = f.choices[1];
    const scholarshipId = (await pool.query("insert into scholarships (slug, title, school_id, program_id, status) values ($1, 'Synthetic scholarship', $2, $3, 'active') returning id", [`edit-${randomUUID()}`, schoolId, f.choice.programId])).rows[0].id;
    const first = await edit(f, service, { scholarshipId });
    assert.equal(first.revision, f.set.revision + 1);
    assert.equal(first.choices[0].scholarshipId, scholarshipId);
    assert.equal(first.choices[0].studentNotes, "private-edit-marker");
    assert.deepEqual(first.choices[1], sibling);
    const second = await service.updateOwnApplicationChoice(f.context, f.set.id, f.choice.id, { expectedRevision: first.revision, studentNotes: null });
    assert.equal(second.choices[0].scholarshipId, scholarshipId);
    assert.equal(second.choices[0].studentNotes, null);
    await pool.query("update application_choices set requirement_snapshot_json = '{\"old\":true}' where id = $1", [f.choice.id]);
    const third = await service.updateOwnApplicationChoice(f.context, f.set.id, f.choice.id, { expectedRevision: second.revision, scholarshipId: null });
    assert.equal(third.revision, second.revision + 1);
    assert.deepEqual((await pool.query("select requirement_snapshot_json from application_choices where id = $1", [f.choice.id])).rows[0].requirement_snapshot_json, {});
    const before = await snapshotAuditedBusinessTables(pool);
    assert.deepEqual(await service.updateOwnApplicationChoice(f.context, f.set.id, f.choice.id, { expectedRevision: third.revision, studentNotes: null, scholarshipId: null }), third);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    const audits = (await pool.query("select metadata_json from audit_logs where resource_id = $1 and action = 'student.application_choice.update'", [f.choice.id])).rows;
    assert.equal(audits.length, 3); assert.doesNotMatch(JSON.stringify(audits), /private-edit-marker|Original note/);
  });

  await t.test("editing rejects unavailable, other-school and other-program scholarships without changing the draft", async () => {
    const f = await fixture();
    const otherSchool = (await pool.query("insert into schools (slug, name_en) values ($1, 'Other scholarship school') returning id", [`edit-${randomUUID()}`])).rows[0].id;
    const ids = [randomUUID()];
    for (const [school, program, status] of [[schoolId, null, "draft"], [otherSchool, null, "active"], [schoolId, f.choices[1].programId, "active"]]) {
      ids.push((await pool.query("insert into scholarships (slug, title, school_id, program_id, status) values ($1, 'Not available', $2, $3, $4) returning id", [`edit-${randomUUID()}`, school, program, status])).rows[0].id);
    }
    const before = await snapshotAuditedBusinessTables(pool);
    for (const scholarshipId of ids) await assert.rejects(edit(f, service, { scholarshipId }), e => e.status === 403);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
  });

  await t.test("revision rejects stale edits even when values have changed back to their original state", async () => {
    const f = await fixture(); const changed = await edit(f);
    const back = await service.updateOwnApplicationChoice(f.context, f.set.id, f.choice.id, { expectedRevision: changed.revision, studentNotes: "Original note" });
    assert.equal(back.revision, f.set.revision + 2);
    const before = await snapshotAuditedBusinessTables(pool);
    await assert.rejects(edit(f), e => e.status === 409);
    await assert.rejects(edit(f, service, { studentNotes: "Original note" }), e => e.status === 409);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
  });

  await t.test("order is a complete owner-scoped permutation, normalizes ranks and preserves removed choices", async () => {
    const f = await fixture(3), other = await fixture();
    await service.removeOwnApplicationChoice(f.context, f.set.id, f.choices[2].id);
    f.set = await current(f);
    const before = await snapshotAuditedBusinessTables(pool);
    for (const ids of [[f.choice.id], [f.choice.id, other.choice.id], [f.choice.id, randomUUID()], f.choices.map(c => c.id), [f.choice.id, f.choice.id]]) {
      await assert.rejects(service.reorderOwnApplicationChoices(f.context, f.set.id, { expectedRevision: f.set.revision, choiceIds: ids }), e => [400, 409].includes(e.status));
    }
    await assert.rejects(new PostgresStudentCoreRepository(client).reorderApplicationChoices(f.context.actorUserId, f.set.id,
      { expectedRevision: f.set.revision, choiceIds: [f.choice.id, f.choice.id] }), e => e.status === 409);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    const result = await order(f, service, { choiceIds: [f.choices[1].id, f.choice.id] });
    assert.deepEqual(result.choices.map(c => [c.id, c.rankOrder]), [[f.choices[1].id, 0], [f.choice.id, 1]]);
    assert.equal(result.revision, f.set.revision + 1);
    const after = await snapshotAuditedBusinessTables(pool);
    assert.deepEqual(await order(f, service, { expectedRevision: result.revision, choiceIds: result.choices.map(c => c.id) }), result);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), after);
    const empty = await fixture(0);
    assert.equal((await order(empty)).revision, empty.set.revision);
  });

  await t.test("edit and order deny foreign scope, frozen sets, terminal choices and existing school receipts", async () => {
    const f = await fixture(), other = await fixture();
    let before = await snapshotAuditedBusinessTables(pool);
    for (const setId of [other.set.id, randomUUID()]) {
      await assert.rejects(service.updateOwnApplicationChoice(f.context, setId, f.choice.id, { expectedRevision: f.set.revision, studentNotes: null }), e => e.status === 403);
      await assert.rejects(service.reorderOwnApplicationChoices(f.context, setId, { expectedRevision: f.set.revision, choiceIds: [] }), e => e.status === 403);
    }
    await assert.rejects(service.updateOwnApplicationChoice(other.context, f.set.id, f.choice.id, { expectedRevision: f.set.revision, studentNotes: null }), e => e.status === 403);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    for (const [status, locked, submitted] of [["submitted", false, false], ["unknown", false, false], ["draft", true, false], ["draft", false, true]]) {
      await pool.query("update application_sets set status = $2, locked_at = case when $3 then now() end, submitted_at = case when $4 then now() end where id = $1", [f.set.id, status, locked, submitted]);
      before = await snapshotAuditedBusinessTables(pool);
      await assert.rejects(edit(f), e => e.status === 409); await assert.rejects(order(f), e => e.status === 409);
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    }
    await pool.query("update application_sets set status = 'draft', locked_at = null, submitted_at = null where id = $1", [f.set.id]);
    await pool.query("update application_choices set status = 'submitted' where id = $1", [f.choice.id]);
    await assert.rejects(edit(f), e => e.status === 409); await assert.rejects(order(f), e => e.status === 409);
    await pool.query("update application_choices set status = 'draft' where id = $1", [f.choice.id]);
    await pool.query("insert into school_applications (application_record_format, application_set_id, application_choice_id, student_user_id, school_id, program_id) values ('cuac.program-application.v1', $1, $2, $3, $4, $5)",
      [f.set.id, f.choice.id, f.context.actorUserId, schoolId, f.choice.programId]);
    before = await snapshotAuditedBusinessTables(pool);
    await assert.rejects(edit(f), e => e.status === 409); await assert.rejects(order(f), e => e.status === 409);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
  });

  await t.test("draft mutations recheck active account and role against stale request context", async () => {
    const f = await fixture();
    for (const sql of ["update users set account_status = 'suspended' where id = $1", "update user_roles set revoked_at = now() where user_id = $1"]) {
      await pool.query(sql, [f.context.actorUserId]); const before = await snapshotAuditedBusinessTables(pool);
      await assert.rejects(edit(f), e => e.status === 403); await assert.rejects(order(f), e => e.status === 403);
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      await pool.query("update users set account_status = 'active' where id = $1", [f.context.actorUserId]);
    }
  });

  for (const firstOperation of ["edit", "order"]) await t.test(`concurrent ${firstOperation} wins one revision and the other draft mutation cannot overwrite it`, async () => {
    const f = await fixture(), g = gate(); let first, second;
    try {
      first = firstOperation === "edit" ? edit(f, g.service) : order(f, g.service); first.catch(() => {});
      const pid = await g.wait(); second = firstOperation === "edit" ? order(f) : edit(f); second.catch(() => {});
      await blockedBy(pid); g.proceed.resolve();
      const result = await first; assert.equal(result.revision, f.set.revision + 1);
      await assert.rejects(second, e => e.status === 409);
      assert.deepEqual(await current(f), result);
    } finally { g.proceed.resolve(); await Promise.allSettled([first, second]); }
  });

  for (const mutation of ["add", "remove"]) await t.test(`order sees a concurrent ${mutation} through the locked revision despite an older statement snapshot`, async () => {
    const f = await fixture(), g = gate(); let first, second;
    try {
      first = mutation === "add" ? g.service.addOwnApplicationChoice(f.context, { applicationSetId: f.set.id, schoolId }, key())
        : g.service.removeOwnApplicationChoice(f.context, f.set.id, f.choice.id); first.catch(() => {});
      const pid = await g.wait(); second = order(f); second.catch(() => {});
      await blockedBy(pid); g.proceed.resolve(); await first;
      await assert.rejects(second, e => e.status === 409);
      const result = await current(f);
      assert.equal(result.revision, f.set.revision + 1);
      assert.equal(result.choices.length, mutation === "add" ? 3 : 1);
    } finally { g.proceed.resolve(); await Promise.allSettled([first, second]); }
  });

  await t.test("rolled-back edit leaves its revision available for a waiting reorder", async () => {
    const f = await fixture(), g = gate(), faults = await createAuditFailureFixture(pool); let first, second;
    try {
      await faults.during("student.application_choice.update", async () => {
        first = edit(f, g.service); first.catch(() => {}); const pid = await g.wait();
        second = order(f); second.catch(() => {}); await blockedBy(pid); g.proceed.resolve();
        await assert.rejects(first, e => e.code === "P0001");
        const result = await second;
        assert.equal(result.revision, f.set.revision + 1);
        assert.equal(result.choices.find(c => c.id === f.choice.id).studentNotes, "Original note");
      });
    } finally { g.proceed.resolve(); await Promise.allSettled([first, second]); await faults.close(); }
  });

  await t.test("freeze or removal committed while edit waits prevents a late mutation", async () => {
    for (const mutation of ["freeze", "remove"]) {
      const f = await fixture(), blocker = await pool.connect(); let attempt;
      try {
        await blocker.query("begin");
        if (mutation === "freeze") await blocker.query("update application_sets set locked_at = now() where id = $1", [f.set.id]);
        else await new PostgresStudentCoreRepository({ query: async (sql, params) => (await blocker.query(sql, params)).rows })
          .removeApplicationChoice(f.context.actorUserId, f.set.id, f.choice.id);
        attempt = edit(f); attempt.catch(() => {}); await blockedBy(blocker.processID);
        await blocker.query("commit"); await assert.rejects(attempt, e => e.status === 409);
        const result = await current(f);
        if (mutation === "freeze") assert.equal(result.choices[0].studentNotes, "Original note");
        else assert.equal(result.choices.some(c => c.id === f.choice.id), false);
      } finally { await blocker.query("rollback"); blocker.release(); if (attempt) await Promise.allSettled([attempt]); }
    }
  });

  await t.test("edit and multi-row order roll back choices, revision and audit as one transaction", async () => {
    const faults = await createAuditFailureFixture(pool);
    try {
      for (const [action, invoke] of [["student.application_choice.update", edit], ["student.application_choices.reorder", order]]) {
        const f = await fixture(3), before = await snapshotAuditedBusinessTables(pool);
        await faults.during(action, async () => {
          await assert.rejects(invoke(f), e => e.code === "P0001");
          assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
        });
        assert.equal((await invoke(f)).revision, f.set.revision + 1);
      }
    } finally { await faults.close(); }
  });

  await t.test("lost edit/order COMMIT acknowledgements require reload and never blindly repeat with a stale revision", async () => {
    for (const invoke of [edit, order]) {
      const f = await fixture(); let discarded = false;
      const ambiguous = createTransactionalSqlClient({ query: pool.query.bind(pool), async connect() {
        const c = await pool.connect(); return {
          async query(sql, params) { const result = await c.query(sql, params); if (sql === "commit") throw new Error("Synthetic lost draft acknowledgement"); return result; },
          release(destroy) { discarded = destroy; c.release(destroy); },
        };
      } });
      await assert.rejects(invoke(f, createPostgresStudentService(ambiguous)), /Synthetic lost draft acknowledgement/);
      assert.equal(discarded, true);
      const before = await snapshotAuditedBusinessTables(pool);
      await assert.rejects(invoke(f), e => e.status === 409);
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      assert.equal((await current(f)).revision, f.set.revision + 1);
    }
  });

  await t.test("revision cannot be zero and capacity exhaustion fails closed without integer overflow", async () => {
    const f = await fixture();
    await assert.rejects(pool.query("update application_sets set revision = 0 where id = $1", [f.set.id]), e => e.code === "23514");
    await pool.query("update application_sets set revision = 2147483647 where id = $1", [f.set.id]);
    f.set = await current(f); const before = await snapshotAuditedBusinessTables(pool);
    await assert.rejects(edit(f), e => e.status === 409); await assert.rejects(order(f), e => e.status === 409);
    await assert.rejects(service.addOwnApplicationChoice(f.context, { applicationSetId: f.set.id, schoolId }, key()), e => e.status === 409);
    await assert.rejects(service.removeOwnApplicationChoice(f.context, f.set.id, f.choice.id), e => e.status === 409);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
  });
}
