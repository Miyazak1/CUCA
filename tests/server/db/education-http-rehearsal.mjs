import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createAuditFailureFixture, snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";

export async function runEducationHttpRehearsal(t, pool, { send, browser, register, waitForBlockedApiQueries }) {
  const path = "/api/v1/student/education-records";
  async function fixture() { const client = browser(); return { client, user: await register(client) }; }
  const add = (f, revision, extra = {}) => f.client.send(path, { method: "POST", body: { expectedRevision: revision, institutionName: "Private network school", educationLevel: "bachelor", ...extra } });
  const edit = (f, id, revision, extra) => f.client.send(`${path}/${id}`, { method: "PATCH", body: { expectedRevision: revision, ...extra } });
  const remove = (f, id, revision) => f.client.send(`${path}/${id}/remove`, { method: "POST", body: { expectedRevision: revision } });
  const get = async f => (await (await f.client.send(path)).json()).data;

  await t.test("network education CRUD preserves independent experiences and validates merged attendance data", async () => {
    const f = await fixture(), other = await fixture();
    assert.deepEqual(await get(f), { revision: 0, records: [] });
    const response = await add(f, 0, { attendanceStatus: "in_progress", startYear: 2022, expectedCompletionYear: 2026 });
    assert.equal(response.status, 200, await response.clone().text()); assert.equal(response.headers.get("cache-control"), "no-store");
    const first = (await response.json()).data, id = first.records[0].id;
    assert.equal(Object.keys(first.records[0]).length, 10);
    assert.equal((await add(f, 1, { educationLevel: "secondary" })).status, 200);
    assert.equal((await edit(f, id, 2, { attendanceStatus: "completed" })).status, 400);
    const completed = await edit(f, id, 2, { attendanceStatus: "completed", expectedCompletionYear: null, endYear: 2026 });
    assert.equal(completed.status, 200); assert.equal((await completed.json()).data.revision, 3);
    assert.equal((await edit(f, id, 2, { fieldOfStudy: null })).status, 409);
    assert.equal((await edit(other, id, 1, { fieldOfStudy: null })).status, 403);
    assert.equal((await remove(other, id, 1)).status, 403);
    assert.deepEqual(await get(other), { revision: 0, records: [] });
    const removed = await remove(f, id, 3); assert.equal(removed.status, 200);
    const remaining = (await removed.json()).data; assert.equal(remaining.records.length, 1); assert.equal(remaining.revision, 4);
    assert.equal((await remove(f, id, 3)).status, 409);
    assert.deepEqual((await (await remove(f, id, 4)).json()).data, remaining);
    assert.equal((await add(f, 4)).status, 200);
    assert.equal((await edit(f, id, 5, { institutionName: "Revive" })).status, 409);
    assert.equal((await (await remove(f, id, 5)).json()).data.records.length, 2);
    const tombstone = (await pool.query("select * from student_education_records where id = $1", [id])).rows[0];
    assert.equal(tombstone.institution_name, null); assert.equal(tombstone.expected_completion_year, null); assert.ok(tombstone.removed_at);
  });

  await t.test("network education input and request boundaries reject before any private write", async () => {
    const f = await fixture(), before = await snapshotAuditedBusinessTables(pool);
    assert.equal((await send(path)).status, 403);
    assert.equal((await send(path, { method: "POST", body: { expectedRevision: 0, institutionName: "Guest", educationLevel: "other" } })).status, 403);
    assert.equal((await f.client.send(path, { method: "POST", body: {}, headers: { origin: "https://other.invalid" } })).status, 403);
    for (const extra of [{ userId: randomUUID() }, { role: "cuac_admin" }, { tenantSchoolId: randomUUID() }, { verified: true },
      { consent: true }, { institutionName: {} }, { institutionName: "\ud800" }, { institutionName: "School\n" },
      { startYear: "2020" }, { startYear: 2200 }, { attendanceStatus: "in_progress", endYear: 2026 }, { expectedCompletionYear: 2026 }, { GPA: 4 }]) {
      const response = await add(f, 0, extra); assert.equal(response.status, 400, await response.clone().text());
    }
    assert.equal((await edit(f, "invalid", 1, { fieldOfStudy: null })).status, 400);
    assert.equal((await f.client.send(`${path}/${randomUUID()}/remove`, { method: "POST", body: { expectedRevision: 1, userId: randomUUID() } })).status, 400);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
  });

  await t.test("network education first adds and mixed edits/removals retain a single same-version winner", async () => {
    const f = await fixture();
    for (const revision of [0, 1]) {
      const blocker = await pool.connect(); let pending = [];
      try {
        await blocker.query("begin");
        if (revision === 0) await blocker.query("select id from users where id = $1 for update", [f.user.userId]);
        else await blocker.query("select user_id from student_education_histories where user_id = $1 for update", [f.user.userId]);
        const id = revision === 0 ? null : (await get(f)).records[0].id;
        pending = revision === 0 ? [add(f, 0, { institutionName: "First" }), add(f, 0, { institutionName: "Second" })]
          : [edit(f, id, 1, { fieldOfStudy: "Edited" }), remove(f, id, 1)];
        await waitForBlockedApiQueries(2); await blocker.query("commit");
        const responses = await Promise.all(pending); assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
        const winner = (await responses.find(r => r.status === 200).json()).data;
        assert.equal(winner.revision, revision + 1); assert.deepEqual(await get(f), winner);
      } finally { await blocker.query("rollback"); blocker.release(); await Promise.allSettled(pending); }
    }
  });

  await t.test("network education audit failures never leave a header, new revision or erased data behind", async () => {
    const f = await fixture(), faults = await createAuditFailureFixture(pool);
    try {
      let before = await snapshotAuditedBusinessTables(pool);
      await faults.during("student.education_record.add", async () => {
        const response = await add(f, 0); assert.equal(response.status, 500); assert.doesNotMatch(await response.text(), /Private network school|insert into|Synthetic/);
      });
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      const id = (await (await add(f, 0)).json()).data.records[0].id;
      for (const [action, command] of [["update", () => edit(f, id, 1, { fieldOfStudy: "Private study" })], ["remove", () => remove(f, id, 1)]]) {
        before = await snapshotAuditedBusinessTables(pool);
        await faults.during(`student.education_record.${action}`, async () => assert.equal((await command()).status, 500));
        assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      }
      assert.equal((await edit(f, id, 1, { fieldOfStudy: "Private study" })).status, 200);
      assert.equal((await remove(f, id, 2)).status, 200);
      assert.deepEqual(await get(f), { revision: 3, records: [] });
      assert.doesNotMatch(JSON.stringify((await pool.query("select * from audit_logs where actor_user_id = $1", [f.user.userId])).rows), /Private network school|Private study/);
    } finally { await faults.close(); }
  });

  await t.test("network education removal rechecks role revocation after the session has resolved", async () => {
    const f = await fixture(), first = (await (await add(f, 0)).json()).data, blocker = await pool.connect(); let pending;
    try {
      await blocker.query("begin");
      await blocker.query("update user_roles set revoked_at = now() where user_id = $1 and role = 'student'", [f.user.userId]);
      pending = remove(f, first.records[0].id, 1);
      await waitForBlockedApiQueries(1); await blocker.query("commit");
      assert.equal((await pending).status, 403); assert.equal((await f.client.send(path)).status, 403);
      assert.equal((await pool.query("select revision from student_education_histories where user_id = $1", [f.user.userId])).rows[0].revision, 1);
      assert.equal((await pool.query("select removed_at from student_education_records where id = $1", [first.records[0].id])).rows[0].removed_at, null);
    } finally { await blocker.query("rollback"); blocker.release(); if (pending) await Promise.allSettled([pending]); }
  });
}
