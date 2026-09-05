import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { createPostgresStudentService } from "../../../src/server/student/runtime/routes.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { EDUCATION_FIELDS } from "../../../src/server/student/education.ts";
import { createAuditFailureFixture, snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

export async function runEducationHistoryRehearsal(t, pool) {
  const service = createPostgresStudentService(createTransactionalSqlClient(pool));
  async function fixture() {
    const email = `education-${randomUUID()}@example.invalid`;
    const user = (await pool.query("insert into users (email, email_normalized) values ($1, $1) returning id", [email])).rows[0];
    await pool.query("insert into user_roles (user_id, role) values ($1, 'student')", [user.id]);
    return { userId: user.id, context: createRequestContext({ actorUserId: user.id, activeRole: "student", selectedSurface: "student", purpose: "student_action" }) };
  }
  const get = f => service.getOwnEducationHistory(f.context);
  const add = (f, expectedRevision = 0, extra = {}, current = service) => current.addOwnEducationRecord(f.context, { expectedRevision, institutionName: "Private institution", educationLevel: "bachelor", ...extra });
  const edit = (f, id, expectedRevision, extra, current = service) => current.updateOwnEducationRecord(f.context, id, { expectedRevision, ...extra });
  const remove = (f, id, expectedRevision, current = service) => current.removeOwnEducationRecord(f.context, id, { expectedRevision });
  const audits = async f => (await pool.query("select * from audit_logs where actor_user_id = $1 and action like 'student.education_record.%' order by created_at, id", [f.userId])).rows;
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
    assert.fail("Education operations did not reach the lock barrier.");
  }

  await t.test("education history starts empty without inferred records and stores multiple independent experiences", async () => {
    const f = await fixture(), other = await fixture();
    await service.updateOwnApplicantProfile(f.context, { expectedRevision: 0, fullName: "Applicant" });
    await service.updateOwnProfile(f.context, { targetDegreeLevel: "master" });
    const set = await service.createOwnApplicationSet(f.context, { name: "Independent choice version" }, { idempotencyKey: randomUUID() });
    const before = await snapshotAuditedBusinessTables(pool);
    assert.deepEqual(await get(f), { revision: 0, records: [] });
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    const first = await add(f, 0, { institutionName: "\u5927\u5b66", institutionCountry: "CN", attendanceStatus: "in_progress", startYear: 2022, expectedCompletionYear: 2026 });
    const second = await add(f, 1, { educationLevel: "secondary", attendanceStatus: "completed", startYear: 2018, endYear: 2022 });
    assert.equal(second.revision, 2); assert.equal(second.records.length, 2);
    assert.deepEqual(second.records[0], first.records[0]); assert.notEqual(second.records[0].id, second.records[1].id);
    assert.deepEqual(Object.keys(second).sort(), ["records", "revision"]);
    assert.equal(Object.keys(second.records[0]).length, 10); assert.deepEqual(await get(other), { revision: 0, records: [] });
    assert.equal((await service.getOwnApplicantProfile(f.context)).revision, 1);
    assert.equal((await service.getOwnApplicationSet(f.context, set.id)).revision, set.revision);
    assert.equal((await service.getOwnProfile(f.context)).targetDegreeLevel, "master");
    const logs = await audits(f);
    assert.equal(logs.length, 2);
    for (const [index, row] of logs.entries()) {
      assert.deepEqual({ ...row.metadata_json, fields: [...row.metadata_json.fields].sort() },
        { fields: [...EDUCATION_FIELDS].sort(), revision: index + 1 });
    }
    assert.doesNotMatch(JSON.stringify(logs), /Private institution|\u5927\u5b66/);
  });

  await t.test("education partial edits preserve siblings, validate merged chronology and reject stale no-op or ABA versions", async () => {
    const f = await fixture();
    const first = await add(f, 0, { attendanceStatus: "in_progress", startYear: 2020, expectedCompletionYear: 2024 });
    const id = first.records[0].id, two = await add(f, 1);
    const before = await snapshotAuditedBusinessTables(pool);
    for (const fields of [{ attendanceStatus: "completed" }, { startYear: 2025 }, { endYear: 2024 }]) await assert.rejects(edit(f, id, 2, fields), e => e.status === 400);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    const done = await edit(f, id, 2, { attendanceStatus: "completed", expectedCompletionYear: null, endYear: 2024 });
    assert.equal(done.revision, 3); assert.deepEqual(done.records[1], two.records[1]);
    const changed = await edit(f, id, 3, { institutionName: "Changed" });
    assert.equal(changed.revision, 4);
    const restored = await edit(f, id, 4, { institutionName: "Private institution" });
    assert.equal(restored.revision, 5);
    await assert.rejects(edit(f, id, 3, { institutionName: "Private institution" }), e => e.status === 409);
    const snapshot = await snapshotAuditedBusinessTables(pool);
    assert.deepEqual(await edit(f, id, 5, { institutionName: "Private institution" }), restored);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), snapshot);
  });

  await t.test("education removal erases all fields, retains the collection version and cannot target a replacement ID", async () => {
    const f = await fixture(), first = await add(f, 0, { institutionCountry: "US", qualificationName: "Private degree", fieldOfStudy: "Private field", startYear: 2018, endYear: 2022 });
    const id = first.records[0].id;
    assert.deepEqual(await remove(f, id, 1), { revision: 2, records: [] });
    const row = (await pool.query("select * from student_education_records where id = $1", [id])).rows[0];
    assert.ok(row.removed_at);
    for (const field of ["institution_name", "institution_country", "education_level", "qualification_name", "field_of_study", "attendance_status", "start_year", "end_year", "expected_completion_year"]) assert.equal(row[field], null);
    await assert.rejects(remove(f, id, 1), e => e.status === 409);
    const before = await snapshotAuditedBusinessTables(pool);
    assert.deepEqual(await remove(f, id, 2), { revision: 2, records: [] });
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    const replacement = await add(f, 2); assert.notEqual(replacement.records[0].id, id);
    await assert.rejects(edit(f, id, 3, { institutionName: "Restore" }), e => e.status === 409);
    assert.deepEqual(await remove(f, id, 3), replacement);
    assert.equal((await audits(f)).filter(a => a.action.endsWith("remove")).length, 1);
  });

  await t.test("education commands reject foreign record IDs, role, tenant, data class and forged fields without writes", async () => {
    const f = await fixture(), other = await fixture(), own = await add(f), foreign = await add(other);
    const before = await snapshotAuditedBusinessTables(pool);
    for (const id of [foreign.records[0].id, randomUUID()]) {
      await assert.rejects(edit(f, id, 1, { fieldOfStudy: null }), e => e.status === 403);
      await assert.rejects(remove(f, id, 1), e => e.status === 403);
    }
    for (const override of [{ actorUserId: null }, { activeRole: "school_staff" }, { activeRole: "cuac_admin" }, { tenantSchoolId: randomUUID() }, { dataClassAllowlist: ["student_pii"] }]) {
      const context = { ...f.context, ...override };
      await assert.rejects(service.getOwnEducationHistory(context), e => e.status === 403);
      await assert.rejects(service.addOwnEducationRecord(context, { expectedRevision: 1, institutionName: "Denied", educationLevel: "bachelor" }), e => e.status === 403);
      await assert.rejects(service.updateOwnEducationRecord(context, own.records[0].id, { expectedRevision: 1, fieldOfStudy: null }), e => e.status === 403);
      await assert.rejects(service.removeOwnEducationRecord(context, own.records[0].id, { expectedRevision: 1 }), e => e.status === 403);
    }
    for (const fields of [{ userId: other.userId }, { verified: true }, { GPA: 4 }, { institutionName: "\ud800" }, { startYear: "2020" }]) await assert.rejects(add(f, 1, fields), e => e.status === 400);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
  });

  await t.test("education reads and all mutations recheck revoked roles and disabled accounts", async () => {
    for (const authority of ["account", "role"]) {
      const f = await fixture(), first = await add(f), id = first.records[0].id;
      if (authority === "account") await pool.query("update users set account_status = 'disabled' where id = $1", [f.userId]);
      else await pool.query("update user_roles set revoked_at = now() where user_id = $1 and role = 'student'", [f.userId]);
      const before = await snapshotAuditedBusinessTables(pool);
      for (const command of [() => get(f), () => add(f, 1), () => edit(f, id, 1, { fieldOfStudy: null }), () => remove(f, id, 1)]) await assert.rejects(command(), e => e.status === 403);
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    }
  });

  await t.test("simultaneous first education additions share an empty-header barrier and only one version and record survive", async () => {
    const f = await fixture(), ready = deferred(), release = deferred(); let arrivals = 0;
    const gated = createPostgresStudentService(createTransactionalSqlClient({ ...pool, connect: async () => {
      const connection = await pool.connect();
      return { async query(sql, params) { const result = await connection.query(sql, params);
        if (sql.startsWith("select revision from student_education_histories")) { assert.equal(result.rows.length, 0); if (++arrivals === 2) ready.resolve(); await release.promise; }
        return result;
      }, release: error => connection.release(error) };
    } }));
    const settled = Promise.allSettled([add(f, 0, { institutionName: "First" }, gated), add(f, 0, { institutionName: "Second" }, gated)]);
    try { await Promise.race([ready.promise, delay(5000).then(() => { throw new Error("Education first-save barrier timed out"); })]); }
    finally { release.resolve(); await settled; }
    const results = await settled;
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1); assert.equal(results.find(r => r.status === "rejected").reason.status, 409);
    assert.equal((await get(f)).revision, 1); assert.equal((await get(f)).records.length, 1); assert.equal((await audits(f)).length, 1);
  });

  await t.test("mixed education adds edits and removals serialize across different records under one revision", async () => {
    for (const pair of [["add", "edit"], ["edit", "remove"], ["remove", "add"]]) {
      const f = await fixture(); await add(f); const two = await add(f, 1), blocker = await pool.connect(); let settled;
      const command = kind => kind === "add" ? add(f, 2) : kind === "edit" ? edit(f, two.records[0].id, 2, { fieldOfStudy: "Updated" }) : remove(f, two.records[1].id, 2);
      try {
        await blocker.query("begin"); await blocker.query("select user_id from student_education_histories where user_id = $1 for update", [f.userId]);
        const pid = (await blocker.query("select pg_backend_pid() as pid")).rows[0].pid;
        settled = Promise.allSettled(pair.map(command)); await blockedBy(pid, 2); await blocker.query("commit");
        const results = await settled;
        assert.equal(results.filter(r => r.status === "fulfilled").length, 1); assert.equal(results.find(r => r.status === "rejected").reason.status, 409);
        const winner = results.find(r => r.status === "fulfilled").value;
        assert.equal(winner.revision, 3); assert.deepEqual(await get(f), winner); assert.equal((await audits(f)).length, 3);
      } finally { await blocker.query("rollback"); blocker.release(); if (settled) await settled; }
    }
  });

  await t.test("education capacity is checked under the collection lock and removals free only active capacity", async () => {
    const f = await fixture(); let history;
    for (let revision = 0; revision < 19; revision++) history = await add(f, revision);
    const blocker = await pool.connect(); let pending;
    try {
      await blocker.query("begin"); await blocker.query("select user_id from student_education_histories where user_id = $1 for update", [f.userId]);
      const pid = (await blocker.query("select pg_backend_pid() as pid")).rows[0].pid;
      pending = Promise.allSettled([add(f, 19), add(f, 19)]);
      await blockedBy(pid, 2); await blocker.query("commit");
      const results = await pending;
      assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
      assert.equal(results.find(r => r.status === "rejected").reason.status, 409);
      assert.equal((await audits(f)).length, 20);
    } finally { await blocker.query("rollback"); blocker.release(); if (pending) await pending; }
    assert.equal((await get(f)).records.length, 20); assert.equal((await get(f)).revision, 20);
    const before = await snapshotAuditedBusinessTables(pool);
    await assert.rejects(add(f, 20), e => e.status === 409); assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    await remove(f, history.records[0].id, 20); assert.equal((await add(f, 21)).records.length, 20);
    const extra = (await pool.query("insert into student_education_records (user_id, institution_name, education_level, attendance_status) values ($1, 'Unexpected direct writer', 'other', 'unknown') returning id", [f.userId])).rows[0];
    await assert.rejects(get(f), e => e.status === 503);
    await pool.query("delete from student_education_records where id = $1", [extra.id]);
  });

  await t.test("permission revocation that commits before a waiting education mutation prevents late writes", async () => {
    for (const authority of ["account", "role"]) {
      const f = await fixture(), blocker = await pool.connect(); let settled;
      try {
        await blocker.query("begin");
        if (authority === "account") await blocker.query("update users set account_status = 'disabled' where id = $1", [f.userId]);
        else await blocker.query("update user_roles set revoked_at = now() where user_id = $1 and role = 'student'", [f.userId]);
        const pid = (await blocker.query("select pg_backend_pid() as pid")).rows[0].pid;
        settled = Promise.allSettled([add(f)]); await blockedBy(pid); await blocker.query("commit");
        assert.equal((await settled)[0].reason.status, 403);
        assert.equal((await pool.query("select count(*)::int as count from student_education_histories where user_id = $1", [f.userId])).rows[0].count, 0);
        assert.equal((await audits(f)).length, 0);
      } finally { await blocker.query("rollback"); blocker.release(); if (settled) await settled; }
    }
  });

  await t.test("education writer holds actual permission locks until record revision and audit are committed", async () => {
    const f = await fixture(), ready = deferred(), release = deferred(); let pid, revoked;
    const gated = createPostgresStudentService(createTransactionalSqlClient({ ...pool, connect: async () => {
      const connection = await pool.connect();
      return { async query(sql, params) { const result = await connection.query(sql, params);
        if (sql.startsWith("insert into student_education_records")) { pid = (await connection.query("select pg_backend_pid() as pid")).rows[0].pid; ready.resolve(); await release.promise; }
        return result;
      }, release: error => connection.release(error) };
    } }));
    const settled = Promise.allSettled([add(f, 0, {}, gated)]);
    try {
      await Promise.race([ready.promise, delay(5000).then(() => { throw new Error("Education write barrier timed out"); })]);
      assert.deepEqual(await get(f), { revision: 0, records: [] });
      revoked = pool.query("update user_roles set revoked_at = now() where user_id = $1 and role = 'student'", [f.userId]);
      await blockedBy(pid); release.resolve();
      assert.equal((await settled)[0].status, "fulfilled"); await revoked;
      assert.equal((await audits(f)).length, 1); await assert.rejects(get(f), e => e.status === 403);
    } finally { release.resolve(); await settled; if (revoked) await revoked; }
  });

  await t.test("education add edit and remove fully roll back fields version and initial header when audit fails", async () => {
    const f = await fixture(), fault = await createAuditFailureFixture(pool);
    try {
      let before = await snapshotAuditedBusinessTables(pool);
      await fault.during("student.education_record.add", () => assert.rejects(add(f)));
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      const first = await add(f), id = first.records[0].id;
      before = await snapshotAuditedBusinessTables(pool);
      await fault.during("student.education_record.update", () => assert.rejects(edit(f, id, 1, { fieldOfStudy: "Private study" })));
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      await fault.during("student.education_record.remove", () => assert.rejects(remove(f, id, 1)));
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      await edit(f, id, 1, { fieldOfStudy: "Private study" }); await remove(f, id, 2);
      assert.equal((await audits(f)).length, 3); assert.doesNotMatch(JSON.stringify(await audits(f)), /Private study|Private institution/);
    } finally { await fault.close(); }
  });

  await t.test("lost education COMMIT acknowledgements recover through read and never accept an old mutation version", async () => {
    const f = await fixture(); let commits = 0;
    const ambiguous = createPostgresStudentService(createTransactionalSqlClient({ ...pool, connect: async () => {
      const connection = await pool.connect();
      return { async query(sql, params) { const result = await connection.query(sql, params); if (sql === "commit") { commits++; throw new Error("Synthetic education COMMIT acknowledgement loss"); } return result; }, release: error => connection.release(error) };
    } }));
    await assert.rejects(add(f, 0, {}, ambiguous), /Synthetic education COMMIT/);
    const first = await get(f), id = first.records[0].id; assert.equal(first.revision, 1);
    await assert.rejects(add(f), e => e.status === 409);
    await assert.rejects(edit(f, id, 1, { fieldOfStudy: "Updated" }, ambiguous), /Synthetic education COMMIT/);
    assert.equal((await get(f)).revision, 2); await assert.rejects(edit(f, id, 1, { fieldOfStudy: "Updated" }), e => e.status === 409);
    await assert.rejects(remove(f, id, 2, ambiguous), /Synthetic education COMMIT/);
    assert.deepEqual(await get(f), { revision: 3, records: [] }); await assert.rejects(remove(f, id, 2), e => e.status === 409);
    assert.equal(commits, 3); assert.equal((await audits(f)).length, 3);
  });

  await t.test("education database constraints enforce required fields chronology erasure and account ownership", async () => {
    const f = await fixture(), other = await fixture(), first = await add(f); await add(other); const id = first.records[0].id;
    for (const change of ["institution_name = null", "institution_name = ''", "institution_name = repeat('x', 201)", "education_level = 'invalid'", "attendance_status = null",
      "institution_country = 'cn'", "start_year = 1899", "start_year = 2025, end_year = 2024", "attendance_status = 'in_progress', end_year = 2024", "expected_completion_year = 2026", "removed_at = now()"])
      await assert.rejects(pool.query(`update student_education_records set ${change} where id = $1`, [id]), e => e.code === "23514");
    await assert.rejects(pool.query("update student_education_histories set revision = 0 where user_id = $1", [f.userId]), e => e.code === "23514");
    await assert.rejects(pool.query("update student_education_records set user_id = $2 where id = $1", [id, randomUUID()]), e => e.code === "23503");
    await pool.query("delete from users where id = $1", [f.userId]);
    assert.equal((await pool.query("select count(*)::int as count from student_education_records where user_id = $1", [f.userId])).rows[0].count, 0);
    assert.equal((await get(other)).records.length, 1);
  });

  await t.test("education collection revision exhaustion allows current no-op but blocks add edit and removal", async () => {
    const f = await fixture(), first = await add(f), id = first.records[0].id;
    await pool.query("update student_education_histories set revision = 2147483647 where user_id = $1", [f.userId]);
    const before = await snapshotAuditedBusinessTables(pool);
    assert.equal((await edit(f, id, 2147483647, { institutionName: "Private institution" })).revision, 2147483647);
    await assert.rejects(add(f, 2147483647), e => e.status === 409);
    await assert.rejects(edit(f, id, 2147483647, { institutionName: "Changed" }), e => e.status === 409);
    await assert.rejects(remove(f, id, 2147483647), e => e.status === 409);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
  });
}
