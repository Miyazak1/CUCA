import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { createPostgresStudentService } from "../../../src/server/student/runtime/routes.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { createAuditFailureFixture, snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

export async function runApplicantProfileRehearsal(t, pool) {
  const service = createPostgresStudentService(createTransactionalSqlClient(pool));
  async function fixture() {
    const email = `applicant-${randomUUID()}@example.invalid`;
    const user = (await pool.query("insert into users (email, email_normalized, display_name) values ($1, $1, 'Account nickname') returning id", [email])).rows[0];
    await pool.query("insert into user_roles (user_id, role) values ($1, 'student')", [user.id]);
    const context = createRequestContext({ actorUserId: user.id, activeRole: "student", selectedSurface: "student", purpose: "student_action" });
    return { userId: user.id, context, email };
  }
  const update = (f, input = { expectedRevision: 0, fullName: "Private Applicant" }, current = service) => current.updateOwnApplicantProfile(f.context, input);
  const get = f => service.getOwnApplicantProfile(f.context);
  const audits = async f => (await pool.query("select * from audit_logs where actor_user_id = $1 and action = 'student.applicant_profile.update' order by created_at, id", [f.userId])).rows;
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
    assert.fail("Applicant mutation did not reach the expected lock barrier.");
  }

  await t.test("applicant profile is explicit, owner-scoped and separate from preferences, account contact and application revision", async () => {
    const f = await fixture(), other = await fixture();
    await service.updateOwnProfile(f.context, { displayName: "Preference nickname", citizenshipCountry: "US", preferences: { subjectAreas: ["medicine"] } });
    const set = await service.createOwnApplicationSet(f.context, { name: "Separate application" }, { idempotencyKey: randomUUID() });
    assert.equal(await get(f), null);
    const profile = await update(f, { expectedRevision: 0, fullName: "\u738b\u660e", citizenshipCountry: "CN", contactEmail: "Contact@Example.invalid" });
    assert.equal(profile.revision, 1); assert.equal(profile.userId, f.userId);
    assert.deepEqual(Object.keys(profile).sort(), ["id", "userId", "revision", "fullName", "contactEmail", "citizenshipCountry"].sort());
    assert.deepEqual(await get(f), profile); assert.equal(await get(other), null);
    assert.equal((await service.getOwnProfile(f.context)).displayName, "Preference nickname");
    assert.equal((await service.getOwnProfile(f.context)).citizenshipCountry, "US");
    assert.equal((await service.getOwnApplicationSet(f.context, set.id)).revision, set.revision);
    assert.equal((await pool.query("select email from users where id = $1", [f.userId])).rows[0].email, f.email);
    const entries = await audits(f);
    assert.equal(entries.length, 1); assert.doesNotMatch(JSON.stringify(entries), /\u738b\u660e|Contact@Example.invalid/);
    assert.deepEqual(entries[0].metadata_json, { revision: 1, fields: ["fullName", "contactEmail", "citizenshipCountry"] });
  });

  await t.test("applicant PATCH preserves omitted fields, clears explicitly and rejects stale or ABA versions including no-op", async () => {
    const f = await fixture();
    const first = await update(f, { expectedRevision: 0, fullName: "First", contactEmail: "keep@example.invalid" });
    const second = await update(f, { expectedRevision: 1, fullName: "Second" });
    assert.equal(second.contactEmail, first.contactEmail); assert.equal(second.revision, 2);
    const third = await update(f, { expectedRevision: 2, fullName: "First", contactEmail: null });
    assert.equal(third.revision, 3); assert.equal(third.contactEmail, null);
    const before = await snapshotAuditedBusinessTables(pool);
    for (const expectedRevision of [0, 1, 2, 4]) await assert.rejects(update(f, { expectedRevision, fullName: "First" }), e => e.status === 409);
    assert.deepEqual(await update(f, { expectedRevision: 3, fullName: "First" }), third);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    const cleared = await update(f, { expectedRevision: 3, fullName: " " });
    assert.equal(cleared.id, first.id); assert.equal(cleared.fullName, null); assert.equal(cleared.revision, 4);
  });

  await t.test("applicant authority and strict input reject without touching private state", async () => {
    const f = await fixture(); await update(f);
    const before = await snapshotAuditedBusinessTables(pool);
    for (const overrides of [{ actorUserId: null }, { activeRole: "guest" }, { activeRole: "school_staff" },
      { activeRole: "cuac_admin" }, { tenantSchoolId: randomUUID() }, { dataClassAllowlist: ["education_record"] }]) {
      const context = { ...f.context, ...overrides };
      await assert.rejects(service.getOwnApplicantProfile(context), e => e.status === 403);
      await assert.rejects(service.updateOwnApplicantProfile(context, { expectedRevision: 1, fullName: "Forbidden" }), e => e.status === 403);
    }
    for (const extra of [{ userId: randomUUID() }, { consent: true }, { revision: 1 }, { passport: "private" }, { fullName: "x\u0000" }, { contactEmail: "invalid" }]) {
      await assert.rejects(update(f, { expectedRevision: 1, fullName: "Name", ...extra }), e => e.status === 400);
    }
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
  });

  await t.test("applicant reads and writes recheck current account and role instead of trusting an old context", async () => {
    for (const authority of ["account", "role"]) {
      const f = await fixture(); await update(f);
      if (authority === "account") await pool.query("update users set account_status = 'disabled' where id = $1", [f.userId]);
      else await pool.query("update user_roles set revoked_at = now() where user_id = $1 and role = 'student'", [f.userId]);
      const before = await snapshotAuditedBusinessTables(pool);
      await assert.rejects(get(f), e => e.status === 403);
      await assert.rejects(update(f, { expectedRevision: 1, fullName: "Denied" }), e => e.status === 403);
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    }
  });

  await t.test("concurrent first applicant saves reach an empty-row barrier and only one insert and audit survive", async () => {
    const f = await fixture(), release = deferred(), ready = deferred(); let arrivals = 0;
    const concurrent = createPostgresStudentService(createTransactionalSqlClient({ ...pool, connect: async () => {
      const connection = await pool.connect();
      return { async query(sql, params) {
        const result = await connection.query(sql, params);
        if (sql.includes("from student_applicant_profiles p where") && sql.includes("for update")) {
          assert.equal(result.rows.length, 0); if (++arrivals === 2) ready.resolve(); await release.promise;
        }
        return result;
      }, release: error => connection.release(error) };
    } }));
    const pending = [update(f, { expectedRevision: 0, fullName: "First tab" }, concurrent), update(f, { expectedRevision: 0, fullName: "Second tab" }, concurrent)];
    const settled = Promise.allSettled(pending);
    try { await Promise.race([ready.promise, delay(5000).then(() => { throw new Error("First-save barrier timed out"); })]); }
    finally { release.resolve(); await settled; }
    const results = await settled;
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    assert.equal(results.find(r => r.status === "rejected").reason.status, 409);
    assert.equal((await get(f)).revision, 1); assert.equal((await audits(f)).length, 1);
  });

  await t.test("concurrent applicant edits with one expected revision have a single winner after a real row-lock wait", async () => {
    const f = await fixture(); await update(f);
    const blocker = await pool.connect(); let settled;
    try {
      await blocker.query("begin");
      await blocker.query("select id from student_applicant_profiles where user_id = $1 for update", [f.userId]);
      const pid = (await blocker.query("select pg_backend_pid() as pid")).rows[0].pid;
      settled = Promise.allSettled([update(f, { expectedRevision: 1, fullName: "First" }), update(f, { expectedRevision: 1, fullName: "Second" })]);
      await blockedBy(pid, 2); await blocker.query("commit");
      const results = await settled;
      assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
      assert.equal(results.find(r => r.status === "rejected").reason.status, 409);
      assert.equal((await get(f)).revision, 2); assert.equal((await audits(f)).length, 2);
    } finally { await blocker.query("rollback"); blocker.release(); if (settled) await settled; }
  });

  await t.test("account disable or role revocation committed before a waiting applicant save prevents it", async () => {
    for (const authority of ["account", "role"]) {
      const f = await fixture(), blocker = await pool.connect(); let settled;
      try {
        await blocker.query("begin");
        if (authority === "account") await blocker.query("update users set account_status = 'disabled' where id = $1", [f.userId]);
        else await blocker.query("update user_roles set revoked_at = now() where user_id = $1 and role = 'student'", [f.userId]);
        const pid = (await blocker.query("select pg_backend_pid() as pid")).rows[0].pid;
        settled = Promise.allSettled([update(f)]); await blockedBy(pid); await blocker.query("commit");
        assert.equal((await settled)[0].reason.status, 403);
        assert.equal((await pool.query("select count(*)::int as count from student_applicant_profiles where user_id = $1", [f.userId])).rows[0].count, 0);
        assert.equal((await audits(f)).length, 0);
      } finally { await blocker.query("rollback"); blocker.release(); if (settled) await settled; }
    }
  });

  await t.test("an applicant save holds its real authority locks until its business and audit transaction completes", async () => {
    const f = await fixture(), ready = deferred(), release = deferred(); let pid;
    const gated = createPostgresStudentService(createTransactionalSqlClient({ ...pool, connect: async () => {
      const connection = await pool.connect();
      return { async query(sql, params) {
        const result = await connection.query(sql, params);
        if (sql.startsWith("insert into student_applicant_profiles")) {
          pid = (await connection.query("select pg_backend_pid() as pid")).rows[0].pid; ready.resolve(); await release.promise;
        }
        return result;
      }, release: error => connection.release(error) };
    } }));
    const pending = update(f, undefined, gated); const saved = Promise.allSettled([pending]); let revoked;
    try {
      await Promise.race([ready.promise, delay(5000).then(() => { throw new Error("Applicant transaction barrier timed out"); })]);
      revoked = pool.query("update user_roles set revoked_at = now() where user_id = $1 and role = 'student'", [f.userId]);
      await blockedBy(pid); release.resolve();
      assert.equal((await saved)[0].status, "fulfilled"); await revoked;
      assert.equal((await audits(f)).length, 1); await assert.rejects(get(f), e => e.status === 403);
    } finally { release.resolve(); await saved; if (revoked) await revoked; }
  });

  await t.test("applicant creation and editing roll back completely on an audit failure", async () => {
    const f = await fixture(), fault = await createAuditFailureFixture(pool);
    try {
      let before = await snapshotAuditedBusinessTables(pool);
      await fault.during("student.applicant_profile.update", () => assert.rejects(update(f)));
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      await update(f); before = await snapshotAuditedBusinessTables(pool);
      await fault.during("student.applicant_profile.update", () => assert.rejects(update(f, { expectedRevision: 1, contactEmail: "private@example.invalid" })));
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      const second = await update(f, { expectedRevision: 1, contactEmail: "private@example.invalid" });
      assert.equal(second.revision, 2); assert.equal((await audits(f)).length, 2);
      assert.doesNotMatch(JSON.stringify(await audits(f)), /private@example.invalid|Private Applicant/);
    } finally { await fault.close(); }
  });

  await t.test("lost applicant COMMIT acknowledgement requires a re-read and never silently reapplies an old version", async () => {
    const f = await fixture(); let commits = 0;
    const ambiguous = createPostgresStudentService(createTransactionalSqlClient({ ...pool, connect: async () => {
      const connection = await pool.connect();
      return { async query(sql, params) { const result = await connection.query(sql, params); if (sql === "commit") { commits++; throw new Error("Synthetic applicant COMMIT acknowledgement loss"); } return result; }, release: error => connection.release(error) };
    } }));
    await assert.rejects(update(f, undefined, ambiguous), /Synthetic applicant COMMIT/);
    assert.equal(commits, 1); assert.equal((await get(f)).revision, 1);
    await assert.rejects(update(f), e => e.status === 409);
    assert.equal((await audits(f)).length, 1);
  });

  await t.test("applicant database constraints reject duplicate owners, invalid versions and malformed fields", async () => {
    const f = await fixture(); await update(f);
    await assert.rejects(pool.query("insert into student_applicant_profiles (user_id) values ($1)", [f.userId]), e => e.code === "23505");
    await assert.rejects(pool.query("insert into student_applicant_profiles (user_id) values ($1)", [randomUUID()]), e => e.code === "23503");
    for (const change of ["revision = 0", "full_name = ''", "full_name = repeat('x', 201)", "contact_email = repeat('x', 255)", "citizenship_country = 'cn'"]) {
      await assert.rejects(pool.query(`update student_applicant_profiles set ${change} where user_id = $1`, [f.userId]), e => e.code === "23514");
    }
    await pool.query("delete from users where id = $1", [f.userId]);
    assert.equal((await pool.query("select count(*)::int as count from student_applicant_profiles where user_id = $1", [f.userId])).rows[0].count, 0);
  });

  await t.test("applicant revision exhaustion permits current no-op but never overflow or identity reuse", async () => {
    const f = await fixture(), first = await update(f);
    await pool.query("update student_applicant_profiles set revision = 2147483647 where user_id = $1", [f.userId]);
    const before = await snapshotAuditedBusinessTables(pool);
    assert.equal((await update(f, { expectedRevision: 2147483647, fullName: first.fullName })).revision, 2147483647);
    await assert.rejects(update(f, { expectedRevision: 2147483647, fullName: null }), e => e.status === 409);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
  });
}
