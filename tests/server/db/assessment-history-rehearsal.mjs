import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { createPostgresStudentService } from "../../../src/server/student/runtime/routes.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { ASSESSMENT_FIELDS, MAX_ASSESSMENT_RECORDS } from "../../../src/server/student/assessments.ts";
import { assessmentInput } from "../student/assessment-fixture.mjs";
import { createAuditFailureFixture, snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

export async function runAssessmentHistoryRehearsal(t, pool) {
  const service = createPostgresStudentService(createTransactionalSqlClient(pool));
  async function fixture() {
    const email = "assessment-" + randomUUID() + "@example.invalid";
    const user = (await pool.query("insert into users (email, email_normalized) values ($1, $1) returning id", [email])).rows[0];
    await pool.query("insert into user_roles (user_id, role) values ($1, 'student')", [user.id]);
    return { userId: user.id, context: createRequestContext({ actorUserId: user.id, activeRole: "student", selectedSurface: "student", purpose: "student_action", authStrength: "session" }) };
  }
  const get = f => service.getOwnAssessmentHistory(f.context);
  const add = (f, revision = 0, extra = {}, current = service) => current.addOwnAssessmentRecord(f.context, assessmentInput(revision, extra));
  const edit = (f, id, expectedRevision, extra, current = service) => current.updateOwnAssessmentRecord(f.context, id, { expectedRevision, ...extra });
  const remove = (f, id, expectedRevision, current = service) => current.removeOwnAssessmentRecord(f.context, id, { expectedRevision });
  const audits = async f => (await pool.query("select * from audit_logs where actor_user_id = $1 and action like 'student.assessment_record.%' order by created_at, id", [f.userId])).rows;
  async function blockedBy(pid, count = 1) {
    for (let i = 0; i < 300; i++) {
      const rows = (await pool.query(`with recursive blocked(pid) as (
        select pid from pg_stat_activity where datname = current_database() and state = 'active' and wait_event_type = 'Lock' and $1 = any(pg_blocking_pids(pid))
        union select a.pid from pg_stat_activity a join blocked b on b.pid = any(pg_blocking_pids(a.pid))
          where a.datname = current_database() and a.state = 'active' and a.wait_event_type = 'Lock'
      ) select pid from blocked`, [pid])).rows;
      if (rows.length >= count) return;
      await delay(10);
    }
    assert.fail("Assessment operations did not reach the lock barrier.");
  }

  await t.test("assessment history starts empty and changes independently of applicant education and application versions", async () => {
    const f = await fixture(), other = await fixture();
    await service.updateOwnApplicantProfile(f.context, { expectedRevision: 0, fullName: "Applicant" });
    await service.addOwnEducationRecord(f.context, { expectedRevision: 0, institutionName: "School", educationLevel: "bachelor" });
    const set = await service.createOwnApplicationSet(f.context, { name: "Separate application" }, { idempotencyKey: randomUUID() });
    const before = await snapshotAuditedBusinessTables(pool);
    assert.deepEqual(await get(f), { revision: 0, records: [] }); assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    const first = await add(f), two = await add(f, 1, { assessmentCategory: "admissions", assessmentName: "Entrance exam", resultStatus: "planned", reportDate: null, components: [] });
    assert.equal(two.revision, 2); assert.equal(two.records.length, 2); assert.deepEqual(two.records[0], first.records[0]);
    assert.equal(Object.keys(two.records[0]).length, 10); assert.equal(two.records[0].evidenceStatus, "unverified");
    assert.deepEqual(await get(other), { revision: 0, records: [] });
    assert.equal((await service.getOwnApplicantProfile(f.context)).revision, 1);
    assert.equal((await service.getOwnEducationHistory(f.context)).revision, 1);
    assert.equal((await service.getOwnApplicationSet(f.context, set.id)).revision, set.revision);
    const logs = await audits(f); assert.equal(logs.length, 2);
    for (const [index, row] of logs.entries()) assert.deepEqual({ ...row.metadata_json, fields: [...row.metadata_json.fields].sort() }, { fields: [...ASSESSMENT_FIELDS].sort(), revision: index + 1 });
    assert.doesNotMatch(JSON.stringify(logs.map(row => row.metadata_json)), /Private language|Entrance exam|7\.50|2026-02/);
  });

  await t.test("assessment partial updates validate merged results preserve siblings and recognize JSONB no-op without stale ABA writes", async () => {
    const f = await fixture(), first = await add(f), id = first.records[0].id, two = await add(f, 1);
    let before = await snapshotAuditedBusinessTables(pool);
    for (const fields of [{ resultStatus: "awaiting_result" }, { testDate: "2026-02-02" }, { reportDate: "2026-01-01" }]) await assert.rejects(edit(f, id, 2, fields), e => e.status === 400);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    assert.deepEqual(await edit(f, id, 2, { components: [{ scale: "0-9", testDate: "2026-02-01", value: "7.50", name: "Overall" }] }), two);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    const pending = await edit(f, id, 2, { resultStatus: "awaiting_result", reportDate: null, components: [] });
    assert.equal(pending.revision, 3); assert.deepEqual(pending.records[1], two.records[1]);
    const restored = await edit(f, id, 3, { resultStatus: "reported", reportDate: "2026-02-03", components: first.records[0].components });
    assert.equal(restored.revision, 4);
    await assert.rejects(edit(f, id, 2, { components: first.records[0].components }), e => e.status === 409);
    before = await snapshotAuditedBusinessTables(pool);
    assert.deepEqual(await edit(f, id, 4, { components: first.records[0].components }), restored);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
  });

  await t.test("assessment reports preserve multiple scales grades and retake dates without mixing attempts or computing totals", async () => {
    const f = await fixture();
    const input = { resultForm: "partial_retake", components: [{ name: "Overall", value: "5.5", scale: "1-6", testDate: "2026-02-01" },
      { name: "Overall", value: "100", scale: "0-120", testDate: "2026-02-01" }, { name: "Writing", value: "A*", scale: null, testDate: "2026-02-02" }] };
    const first = await add(f, 0, input); assert.deepEqual(first.records[0].components, input.components);
    assert.equal(first.records[0].evidenceStatus, "unverified");
    await assert.rejects(edit(f, first.records[0].id, 1, { resultForm: "single_sitting" }), e => e.status === 400);
    assert.deepEqual(await get(f), first);
    const second = await add(f, 1); assert.notEqual(second.records[0].id, second.records[1].id);
    assert.deepEqual(second.records[0].components, input.components);
  });

  await t.test("assessment removal erases all content preserves revision and cannot remove or revive a replacement ID", async () => {
    const f = await fixture(), first = await add(f), id = first.records[0].id;
    assert.deepEqual(await remove(f, id, 1), { revision: 2, records: [] });
    const row = (await pool.query("select * from student_assessment_records where id = $1", [id])).rows[0]; assert.ok(row.removed_at);
    for (const field of ["assessment_category", "assessment_name", "assessment_variant", "result_status", "result_form", "test_date", "report_date", "components_json"]) assert.equal(row[field], null);
    await assert.rejects(remove(f, id, 1), e => e.status === 409);
    const before = await snapshotAuditedBusinessTables(pool); assert.deepEqual(await remove(f, id, 2), { revision: 2, records: [] });
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    const replacement = await add(f, 2); assert.notEqual(replacement.records[0].id, id);
    await assert.rejects(edit(f, id, 3, { assessmentName: "Restore" }), e => e.status === 409);
    assert.deepEqual(await remove(f, id, 3), replacement); assert.equal((await audits(f)).filter(a => a.action.endsWith("remove")).length, 1);
  });

  await t.test("assessment commands reject foreign targets forged fields and non-student authority before writing", async () => {
    const f = await fixture(), other = await fixture(), own = await add(f), foreign = await add(other), id = own.records[0].id;
    const before = await snapshotAuditedBusinessTables(pool);
    for (const target of [foreign.records[0].id, randomUUID()]) {
      await assert.rejects(edit(f, target, 1, { assessmentVariant: null }), e => e.status === 403);
      await assert.rejects(remove(f, target, 1), e => e.status === 403);
    }
    for (const override of [{ actorUserId: null }, { activeRole: "school_staff" }, { activeRole: "cuac_admin" }, { selectedSurface: "ops" },
      { purpose: "agent_chat" }, { authStrength: "guest" }, { tenantSchoolId: randomUUID() }, { dataClassAllowlist: ["student_pii"] }]) {
      const denied = { ...f, context: { ...f.context, ...override } };
      for (const command of [() => get(denied), () => add(denied, 1), () => edit(denied, id, 1, { assessmentVariant: null }), () => remove(denied, id, 1)]) await assert.rejects(command(), e => e.status === 403);
    }
    for (const extra of [{ userId: other.userId }, { verified: true }, { resultStatus: "passed" }, { components: [{ name: "Score", value: 100 }] }]) await assert.rejects(add(f, 1, extra), e => e.status === 400);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
  });

  await t.test("assessment reads and every mutation recheck current active account and student role", async () => {
    for (const authority of ["account", "role"]) {
      const f = await fixture(), first = await add(f), id = first.records[0].id;
      if (authority === "account") await pool.query("update users set account_status = 'disabled' where id = $1", [f.userId]);
      else await pool.query("update user_roles set revoked_at = now() where user_id = $1 and role = 'student'", [f.userId]);
      const before = await snapshotAuditedBusinessTables(pool);
      for (const command of [() => get(f), () => add(f, 1), () => edit(f, id, 1, { assessmentVariant: null }), () => remove(f, id, 1)]) await assert.rejects(command(), e => e.status === 403);
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    }
  });

  await t.test("concurrent first assessment saves reach the empty header together and create only one collection revision", async () => {
    const f = await fixture(), ready = deferred(), release = deferred(); let arrivals = 0;
    const gated = createPostgresStudentService(createTransactionalSqlClient({ ...pool, connect: async () => {
      const connection = await pool.connect();
      return { async query(sql, params) { const result = await connection.query(sql, params);
        if (sql.startsWith("select revision from student_assessment_histories")) { assert.equal(result.rows.length, 0); if (++arrivals === 2) ready.resolve(); await release.promise; }
        return result;
      }, release: error => connection.release(error) };
    } }));
    const settled = Promise.allSettled([add(f, 0, { assessmentName: "First" }, gated), add(f, 0, { assessmentName: "Second" }, gated)]);
    try { await Promise.race([ready.promise, delay(5000).then(() => { throw new Error("Assessment initial-save barrier timed out"); })]); }
    finally { release.resolve(); await settled; }
    const results = await settled; assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    assert.equal(results.find(r => r.status === "rejected").reason.status, 409);
    assert.equal((await get(f)).revision, 1); assert.equal((await get(f)).records.length, 1); assert.equal((await audits(f)).length, 1);
  });

  await t.test("mixed assessment add edit and removal share one version lock across different records", async () => {
    for (const pair of [["add", "edit"], ["edit", "remove"], ["remove", "add"]]) {
      const f = await fixture(); await add(f); const two = await add(f, 1), blocker = await pool.connect(); let settled;
      const command = kind => kind === "add" ? add(f, 2) : kind === "edit" ? edit(f, two.records[0].id, 2, { assessmentVariant: "Updated" }) : remove(f, two.records[1].id, 2);
      try {
        await blocker.query("begin"); await blocker.query("select user_id from student_assessment_histories where user_id = $1 for update", [f.userId]);
        const pid = (await blocker.query("select pg_backend_pid() as pid")).rows[0].pid;
        settled = Promise.allSettled(pair.map(command)); await blockedBy(pid, 2); await blocker.query("commit");
        const results = await settled; assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
        assert.equal(results.find(r => r.status === "rejected").reason.status, 409);
        const winner = results.find(r => r.status === "fulfilled").value;
        assert.equal(winner.revision, 3); assert.deepEqual(await get(f), winner); assert.equal((await audits(f)).length, 3);
      } finally { await blocker.query("rollback"); blocker.release(); if (settled) await settled; }
    }
  });

  await t.test("assessment capacity is enforced under the collection lock and removed records free only active slots", async () => {
    const f = await fixture(); let history;
    for (let revision = 0; revision < MAX_ASSESSMENT_RECORDS - 1; revision++) history = await add(f, revision);
    const blocker = await pool.connect(); let pending;
    try {
      await blocker.query("begin"); await blocker.query("select user_id from student_assessment_histories where user_id = $1 for update", [f.userId]);
      const pid = (await blocker.query("select pg_backend_pid() as pid")).rows[0].pid;
      pending = Promise.allSettled([add(f, 39), add(f, 39)]); await blockedBy(pid, 2); await blocker.query("commit");
      const results = await pending; assert.equal(results.filter(r => r.status === "fulfilled").length, 1); assert.equal(results.find(r => r.status === "rejected").reason.status, 409);
    } finally { await blocker.query("rollback"); blocker.release(); if (pending) await pending; }
    assert.equal((await get(f)).records.length, 40); const before = await snapshotAuditedBusinessTables(pool);
    await assert.rejects(add(f, 40), e => e.status === 409); assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    await remove(f, history.records[0].id, 40); assert.equal((await add(f, 41)).records.length, 40);
    const extra = (await pool.query("insert into student_assessment_records (user_id, assessment_category, assessment_name, result_status, result_form, components_json) values ($1, 'other', 'Unexpected direct writer', 'planned', 'unspecified', '[]') returning id", [f.userId])).rows[0];
    await assert.rejects(get(f), e => e.status === 503); await pool.query("delete from student_assessment_records where id = $1", [extra.id]);
  });

  await t.test("revocation committed before waiting assessment add edit or removal prevents all late mutations", async () => {
    for (const authority of ["account", "role"]) for (const operation of ["add", "edit", "remove"]) {
      const f = await fixture(), initial = operation === "add" ? null : await add(f), blocker = await pool.connect(); let settled;
      try {
        await blocker.query("begin");
        if (authority === "account") await blocker.query("update users set account_status = 'disabled' where id = $1", [f.userId]);
        else await blocker.query("update user_roles set revoked_at = now() where user_id = $1 and role = 'student'", [f.userId]);
        const pid = (await blocker.query("select pg_backend_pid() as pid")).rows[0].pid;
        const command = operation === "add" ? add(f) : operation === "edit" ? edit(f, initial.records[0].id, 1, { assessmentVariant: null }) : remove(f, initial.records[0].id, 1);
        settled = Promise.allSettled([command]); await blockedBy(pid); await blocker.query("commit");
        assert.equal((await settled)[0].reason.status, 403);
        const rows = (await pool.query("select revision from student_assessment_histories where user_id = $1", [f.userId])).rows;
        assert.deepEqual(rows, initial ? [{ revision: 1 }] : []); assert.equal((await audits(f)).length, initial ? 1 : 0);
      } finally { await blocker.query("rollback"); blocker.release(); if (settled) await settled; }
    }
  });

  await t.test("assessment authority locks remain held through actual successful audit and commit", async () => {
    for (const authority of ["account", "role"]) {
      const f = await fixture(), ready = deferred(), release = deferred(); let pid, revoked;
      const gated = createPostgresStudentService(createTransactionalSqlClient({ ...pool, connect: async () => {
        const connection = await pool.connect();
        return { async query(sql, params) { const result = await connection.query(sql, params);
          if (sql.trimStart().startsWith("insert into audit_logs")) { pid = (await connection.query("select pg_backend_pid() as pid")).rows[0].pid; ready.resolve(); await release.promise; }
          return result;
        }, release: error => connection.release(error) };
      } }));
      const settled = Promise.allSettled([add(f, 0, {}, gated)]);
      try {
        await Promise.race([ready.promise, delay(5000).then(() => { throw new Error("Assessment audit barrier timed out"); })]);
        assert.deepEqual(await get(f), { revision: 0, records: [] }); assert.equal((await audits(f)).length, 0);
        revoked = authority === "account" ? pool.query("update users set account_status = 'disabled' where id = $1", [f.userId])
          : pool.query("update user_roles set revoked_at = now() where user_id = $1 and role = 'student'", [f.userId]);
        await blockedBy(pid); release.resolve(); assert.equal((await settled)[0].status, "fulfilled"); await revoked;
        assert.equal((await audits(f)).length, 1); await assert.rejects(get(f), e => e.status === 403);
      } finally { release.resolve(); await settled; if (revoked) await revoked; }
    }
  });

  await t.test("assessment add edit and remove audit failures roll back every field header and revision", async () => {
    const f = await fixture(), fault = await createAuditFailureFixture(pool);
    try {
      let before = await snapshotAuditedBusinessTables(pool);
      await fault.during("student.assessment_record.add", () => assert.rejects(add(f), e => e.code === "P0001"));
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      const first = await add(f), id = first.records[0].id; before = await snapshotAuditedBusinessTables(pool);
      await fault.during("student.assessment_record.update", () => assert.rejects(edit(f, id, 1, { assessmentVariant: "Private update" }), e => e.code === "P0001"));
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      await fault.during("student.assessment_record.remove", () => assert.rejects(remove(f, id, 1), e => e.code === "P0001"));
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      await edit(f, id, 1, { assessmentVariant: "Private update" }); await remove(f, id, 2);
      assert.equal((await audits(f)).length, 3); assert.doesNotMatch(JSON.stringify(await audits(f)), /Private update|7\.50|2026-02/);
    } finally { await fault.close(); }
  });

  await t.test("lost assessment commit acknowledgements require reads and never permit stale automatic retries", async () => {
    const f = await fixture(); let commits = 0;
    const ambiguous = createPostgresStudentService(createTransactionalSqlClient({ ...pool, connect: async () => {
      const connection = await pool.connect();
      return { async query(sql, params) { const result = await connection.query(sql, params); if (sql === "commit") { commits++; throw new Error("Synthetic assessment COMMIT acknowledgement loss"); } return result; }, release: error => connection.release(error) };
    } }));
    await assert.rejects(add(f, 0, {}, ambiguous), /Synthetic assessment COMMIT/);
    const first = await get(f), id = first.records[0].id; assert.equal(first.revision, 1); await assert.rejects(add(f), e => e.status === 409);
    await assert.rejects(edit(f, id, 1, { assessmentVariant: "Updated" }, ambiguous), /Synthetic assessment COMMIT/);
    assert.equal((await get(f)).revision, 2); await assert.rejects(edit(f, id, 1, { assessmentVariant: "Updated" }), e => e.status === 409);
    await assert.rejects(remove(f, id, 2, ambiguous), /Synthetic assessment COMMIT/);
    assert.deepEqual(await get(f), { revision: 3, records: [] }); await assert.rejects(remove(f, id, 2), e => e.status === 409);
    assert.equal(commits, 3); assert.equal((await audits(f)).length, 3);
  });

  await t.test("assessment SQL constraints enforce required identity status dates report shape erasure and ownership", async () => {
    const f = await fixture(), other = await fixture(), first = await add(f); await add(other); const id = first.records[0].id;
    for (const change of ["assessment_name = null", "assessment_name = ''", "assessment_name = repeat('x', 121)", "assessment_category = 'invalid'", "result_status = null",
      "result_form = 'best_guess'", "test_date = '1899-01-01'", "report_date = '2200-01-01'", "test_date = 'infinity'", "test_date = '2026-03-01'",
      "components_json = '{}'", "components_json = '[]'", "result_status = 'planned'", "removed_at = now()"])
      await assert.rejects(pool.query(`update student_assessment_records set ${change} where id = $1`, [id]), e => e.code === "23514");
    await assert.rejects(pool.query("update student_assessment_histories set revision = 0 where user_id = $1", [f.userId]), e => e.code === "23514");
    await assert.rejects(pool.query("update student_assessment_records set user_id = $2 where id = $1", [id, randomUUID()]), e => e.code === "23503");
    await pool.query("delete from users where id = $1", [f.userId]);
    assert.equal((await pool.query("select count(*)::int as count from student_assessment_records where user_id = $1", [f.userId])).rows[0].count, 0);
    assert.equal((await get(other)).records.length, 1);
  });

  await t.test("corrupt nested assessment data fails closed but the owner can explicitly erase the damaged record", async () => {
    const f = await fixture(), first = await add(f), id = first.records[0].id;
    await pool.query("update student_assessment_records set components_json = $2::jsonb where id = $1", [id, JSON.stringify([{ name: "Overall", value: "7.50", privateInjectedField: "Do not expose" }])]);
    await assert.rejects(get(f), e => e.status === 503 && !e.message.includes("Do not expose"));
    assert.deepEqual(await remove(f, id, 1), { revision: 2, records: [] });
    assert.equal((await pool.query("select components_json from student_assessment_records where id = $1", [id])).rows[0].components_json, null);
  });

  await t.test("assessment revision exhaustion permits canonical current no-op but denies all actual mutations", async () => {
    const f = await fixture(), first = await add(f), id = first.records[0].id;
    await pool.query("update student_assessment_histories set revision = 2147483647 where user_id = $1", [f.userId]);
    const before = await snapshotAuditedBusinessTables(pool);
    assert.equal((await edit(f, id, 2147483647, { components: first.records[0].components })).revision, 2147483647);
    await assert.rejects(add(f, 2147483647), e => e.status === 409);
    await assert.rejects(edit(f, id, 2147483647, { assessmentVariant: "Changed" }), e => e.status === 409);
    await assert.rejects(remove(f, id, 2147483647), e => e.status === 409);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
  });

  await t.test("assessment calendar dates do not shift with PostgreSQL connection timezone", async () => {
    const f = await fixture(), first = await add(f), client = createTransactionalSqlClient(pool);
    for (const zone of ["Pacific/Honolulu", "Pacific/Kiritimati"]) await client.transaction(async tx => {
      await tx.query("select set_config('TimeZone', $1, true)", [zone]);
      assert.deepEqual(await createPostgresStudentService(tx).getOwnAssessmentHistory(f.context), first);
    });
  });
}
