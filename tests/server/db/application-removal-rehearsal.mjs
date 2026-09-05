import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { createPostgresStudentService } from "../../../src/server/student/runtime/routes.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { createAuditFailureFixture, snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

export async function runApplicationRemovalRehearsal(t, pool) {
  const client = createTransactionalSqlClient(pool), service = createPostgresStudentService(client);
  const schoolId = (await pool.query("select id from schools where status = 'active' limit 1")).rows[0].id;
  const key = () => ({ idempotencyKey: randomUUID() });
  async function fixture() {
    const email = `remove-${randomUUID()}@example.invalid`;
    const { rows: [user] } = await pool.query("insert into users (email, email_normalized) values ($1, $1) returning id", [email]);
    await pool.query("insert into user_roles (user_id, role) values ($1, 'student')", [user.id]);
    const context = createRequestContext({ actorUserId: user.id, activeRole: "student", selectedSurface: "student", purpose: "student_action" });
    const set = await service.createOwnApplicationSet(context, { name: "Removal fixture" }, key());
    const { rows: [program] } = await pool.query("insert into programs (school_id, slug, name_en, degree_level, status) values ($1, $2, 'Synthetic route', 'master', 'active') returning id", [schoolId, `remove-${randomUUID()}`]);
    const input = { applicationSetId: set.id, schoolId, programId: program.id, studentNotes: "private-removal-marker" }, originalKey = key();
    const choice = await service.addOwnApplicationChoice(context, input, originalKey);
    await pool.query("update application_choices set requirement_snapshot_json = $2::jsonb, metadata_json = $2::jsonb where id = $1", [choice.id, JSON.stringify({ note: "private-removal-marker" })]);
    return { context, set, choice, input, originalKey };
  }
  const remove = (f, s = service) => s.removeOwnApplicationChoice(f.context, f.set.id, f.choice.id);
  const ack = f => ({ id: f.choice.id, applicationSetId: f.set.id, status: "removed" });
  async function row(id) {
    return (await pool.query("select to_jsonb(c) as data from application_choices c where id = $1", [id])).rows[0].data;
  }
  async function evidence(f) {
    const events = (await pool.query("select actor_user_id, from_status, to_status, reason, metadata_json from application_choice_status_events where application_choice_id = $1", [f.choice.id])).rows;
    const audits = (await pool.query("select action, metadata_json from audit_logs where resource_id = $1 and action = 'student.application_choice.remove'", [f.choice.id])).rows;
    assert.deepEqual(events, [{ actor_user_id: f.context.actorUserId, from_status: "draft", to_status: "removed", reason: null, metadata_json: {} }]);
    assert.deepEqual(audits, [{ action: "student.application_choice.remove",
      metadata_json: { applicationSetId: f.set.id, disclosureEvidenceEnded: false } }]);
  }
  async function blockedBy(pid, pattern = "with owned_application_set%") {
    for (let i = 0; i < 200; i++) {
      const { rows } = await pool.query(`select pid from pg_stat_activity where datname = current_database()
        and state = 'active' and wait_event_type = 'Lock' and $1 = any(pg_blocking_pids(pid)) and query like $2`, [pid, pattern]);
      if (rows.length) return;
      await delay(10);
    }
    assert.fail("Removal did not reach the expected lock barrier.");
  }
  function gatedService() {
    const reached = deferred(), proceed = deferred();
    const gated = { ...client, transaction: work => client.transaction(tx => work({ ...tx, async query(sql, params) {
      const rows = await tx.query(sql, params);
      if (sql.startsWith("with owned_application_set") && sql.includes("removed_choice as")) {
        reached.resolve((await tx.query("select pg_backend_pid() as pid", []))[0].pid);
        await proceed.promise;
      }
      return rows;
    } })) };
    return { service: createPostgresStudentService(gated), proceed,
      wait: () => Promise.race([reached.promise, delay(5000, null, { ref: false })]).then(pid => { assert.ok(pid, "Removal must hold parent lock."); return pid; }) };
  }

  await t.test("removal scrubs one draft choice while preserving same-school choices, receipts and a single transition", async () => {
    const f = await fixture();
    const other = await service.addOwnApplicationChoice(f.context, { applicationSetId: f.set.id, schoolId }, key());
    const otherBefore = await row(other.id), before = await row(f.choice.id);
    const receipts = (await pool.query("select to_jsonb(r) as data from student_application_command_receipts r where user_id = $1 order by id", [f.context.actorUserId])).rows;
    assert.deepEqual(await remove(f), ack(f));
    const removed = await row(f.choice.id);
    for (const name of ["id", "user_id", "application_set_id", "school_id", "program_id", "created_at"]) assert.equal(removed[name], before[name]);
    assert.equal(removed.status, "removed"); assert.ok(removed.removed_at);
    assert.equal(removed.student_notes, null);
    assert.deepEqual(removed.requirement_snapshot_json, {}); assert.deepEqual(removed.metadata_json, {});
    assert.deepEqual(await row(other.id), otherBefore);
    assert.deepEqual((await service.getOwnApplicationSet(f.context, f.set.id)).choices.map(c => c.id), [other.id]);
    assert.deepEqual((await service.listOwnApplicationSets(f.context)).find(s => s.id === f.set.id).choices.map(c => c.id), [other.id]);
    assert.deepEqual((await pool.query("select to_jsonb(r) as data from student_application_command_receipts r where user_id = $1 order by id", [f.context.actorUserId])).rows, receipts);
    await evidence(f);
    const after = await snapshotAuditedBusinessTables(pool);
    assert.deepEqual(await remove(f), ack(f));
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), after);
    await pool.query("update application_sets set status = 'submitted', locked_at = now(), submitted_at = now() where id = $1", [f.set.id]);
    const frozen = await snapshotAuditedBusinessTables(pool);
    assert.deepEqual(await remove(f), ack(f));
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), frozen);
  });

  await t.test("retrying an old removal never removes a replacement and its original add key cannot resurrect it", async () => {
    const f = await fixture(); await remove(f);
    const replacement = await service.addOwnApplicationChoice(f.context, f.input, key());
    assert.notEqual(replacement.id, f.choice.id);
    const before = await snapshotAuditedBusinessTables(pool);
    await assert.rejects(service.addOwnApplicationChoice(f.context, f.input, f.originalKey), e => e.status === 409);
    assert.deepEqual(await remove(f), ack(f));
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    assert.deepEqual((await service.getOwnApplicationSet(f.context, f.set.id)).choices.map(c => c.id), [replacement.id]);
    await evidence(f);
  });

  await t.test("removal hides missing, foreign and mismatched parent targets, including tombstones", async () => {
    const a = await fixture(), b = await fixture();
    for (const removed of [false, true]) {
      if (removed) await remove(a);
      const before = await snapshotAuditedBusinessTables(pool), messages = [];
      for (const [context, setId, choiceId] of [[b.context, a.set.id, a.choice.id], [a.context, b.set.id, a.choice.id],
        [a.context, randomUUID(), a.choice.id], [a.context, a.set.id, randomUUID()], [a.context, a.set.id, b.choice.id]]) {
        await assert.rejects(service.removeOwnApplicationChoice(context, setId, choiceId), e => { messages.push(e.message); return e.status === 403; });
      }
      assert.equal(new Set(messages).size, 1);
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    }
  });

  await t.test("removal rejects frozen parents, non-draft choices and pre-existing school receipts without mutation", async () => {
    const f = await fixture();
    for (const [status, locked, submitted] of [["submitted", false, false], ["unknown", false, false], ["draft", true, false], ["draft", false, true]]) {
      await pool.query("update application_sets set status = $2, locked_at = case when $3 then now() end, submitted_at = case when $4 then now() end where id = $1", [f.set.id, status, locked, submitted]);
      const before = await snapshotAuditedBusinessTables(pool);
      await assert.rejects(remove(f), e => e.status === 409);
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    }
    await pool.query("update application_sets set status = 'draft', locked_at = null, submitted_at = null where id = $1", [f.set.id]);
    for (const status of ["submitted", "removed", "unknown"]) {
      await pool.query("update application_choices set status = $2 where id = $1", [f.choice.id, status]);
      const before = await snapshotAuditedBusinessTables(pool);
      await assert.rejects(remove(f), e => e.status === 409);
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    }
    await pool.query("update application_choices set status = 'draft' where id = $1", [f.choice.id]);
    await pool.query("insert into school_applications (application_record_format, application_set_id, application_choice_id, student_user_id, school_id, program_id) values ('cuac.program-application.v1', $1, $2, $3, $4, $5)",
      [f.set.id, f.choice.id, f.context.actorUserId, schoolId, f.choice.programId]);
    const before = await snapshotAuditedBusinessTables(pool);
    await assert.rejects(remove(f), e => e.status === 409);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
  });

  await t.test("removal rechecks active account and role even for stale context or an already removed choice", async () => {
    const f = await fixture();
    for (const removed of [false, true]) {
      if (removed) await remove(f);
      await pool.query("update users set account_status = 'suspended' where id = $1", [f.context.actorUserId]);
      let before = await snapshotAuditedBusinessTables(pool);
      await assert.rejects(remove(f), e => e.status === 403);
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      await pool.query("update users set account_status = 'active' where id = $1", [f.context.actorUserId]);
      await pool.query("update user_roles set revoked_at = now() where user_id = $1", [f.context.actorUserId]);
      before = await snapshotAuditedBusinessTables(pool);
      await assert.rejects(remove(f), e => e.status === 403);
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      await pool.query("update user_roles set revoked_at = null where user_id = $1", [f.context.actorUserId]);
    }
  });

  await t.test("concurrent duplicate removals serialize to one transition and identical acknowledgements", async () => {
    const f = await fixture(), gate = gatedService(); let first, second;
    try {
      first = remove(f, gate.service); first.catch(() => {});
      const pid = await gate.wait();
      second = remove(f); second.catch(() => {});
      await blockedBy(pid);
      gate.proceed.resolve();
      assert.deepEqual(await first, ack(f)); assert.deepEqual(await second, ack(f));
      await evidence(f);
    } finally { gate.proceed.resolve(); await Promise.allSettled([first, second]); }
  });

  for (const commit of [true, false]) await t.test(`removal waits for freeze ${commit ? "commit and rejects" : "rollback and proceeds"}`, async () => {
    const f = await fixture(), freezer = await pool.connect(); let attempt;
    try {
      await freezer.query("begin");
      await freezer.query("update application_sets set locked_at = now() where id = $1", [f.set.id]);
      const before = await snapshotAuditedBusinessTables(pool);
      attempt = remove(f); attempt.catch(() => {});
      await blockedBy(freezer.processID);
      await freezer.query(commit ? "commit" : "rollback");
      if (commit) {
        await assert.rejects(attempt, e => e.status === 409);
        const after = await snapshotAuditedBusinessTables(pool);
        delete before.application_sets; delete after.application_sets;
        assert.deepEqual(after, before);
      } else { assert.deepEqual(await attempt, ack(f)); await evidence(f); }
    } finally { await freezer.query("rollback"); freezer.release(); if (attempt) await Promise.allSettled([attempt]); }
  });

  for (const failAudit of [false, true]) await t.test(`freeze waits for removal and its ${failAudit ? "audit failure rollback" : "audit commit"}`, async () => {
    const f = await fixture(), gate = gatedService(), freezer = await pool.connect();
    const fault = failAudit ? await createAuditFailureFixture(pool) : null;
    let attempt, freeze;
    const run = async () => {
      const before = await snapshotAuditedBusinessTables(pool);
      attempt = remove(f, gate.service); attempt.catch(() => {});
      const pid = await gate.wait();
      await freezer.query("begin");
      freeze = freezer.query("update application_sets set locked_at = now() where id = $1", [f.set.id]); freeze.catch(() => {});
      await blockedBy(pid, "update application_sets set locked_at%");
      gate.proceed.resolve();
      if (failAudit) await assert.rejects(attempt, e => e.code === "P0001"); else assert.deepEqual(await attempt, ack(f));
      await freeze;
      const seen = (await freezer.query("select removed_at is not null as removed from application_choices where id = $1", [f.choice.id])).rows[0];
      assert.equal(seen.removed, !failAudit);
      await freezer.query("rollback");
      if (failAudit) assert.deepEqual(await snapshotAuditedBusinessTables(pool), before); else await evidence(f);
    };
    try { if (fault) await fault.during("student.application_choice.remove", run); else await run(); }
    finally {
      gate.proceed.resolve();
      if (attempt) await Promise.allSettled([attempt]);
      if (freeze) await Promise.allSettled([freeze]);
      await freezer.query("rollback"); freezer.release(); if (fault) await fault.close();
    }
  });

  await t.test("a status event write failure rolls back the soft deletion and allows a later retry", async () => {
    const f = await fixture();
    await pool.query("create function rehearsal_reject_removal_event() returns trigger language plpgsql as $$ begin raise exception 'Synthetic event storage failure' using errcode = 'P0001'; end $$");
    await pool.query("create trigger rehearsal_reject_removal_event before insert on application_choice_status_events for each row execute function rehearsal_reject_removal_event()");
    try {
      const before = await snapshotAuditedBusinessTables(pool);
      await assert.rejects(remove(f), e => e.code === "P0001");
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    } finally {
      await pool.query("drop trigger rehearsal_reject_removal_event on application_choice_status_events");
      await pool.query("drop function rehearsal_reject_removal_event()");
    }
    assert.deepEqual(await remove(f), ack(f)); await evidence(f);
  });

  await t.test("lost COMMIT acknowledgement is recovered by repeating the same removal without duplicate history", async () => {
    const f = await fixture(); let commits = 0, discarded = false;
    const ambiguous = createTransactionalSqlClient({ query: pool.query.bind(pool), async connect() {
      const connection = await pool.connect();
      return { async query(sql, params) {
        const result = await connection.query(sql, params);
        if (sql === "commit") { commits++; throw new Error("Synthetic lost COMMIT acknowledgement"); }
        return result;
      }, release(destroy) { discarded = destroy; connection.release(destroy); } };
    } });
    await assert.rejects(remove(f, createPostgresStudentService(ambiguous)), /Synthetic lost COMMIT acknowledgement/);
    assert.equal(commits, 1); assert.equal(discarded, true);
    const before = await snapshotAuditedBusinessTables(pool);
    assert.deepEqual(await remove(f), ack(f)); await evidence(f);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
  });
}
