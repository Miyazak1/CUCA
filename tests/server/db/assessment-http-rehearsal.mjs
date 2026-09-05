import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { assessmentInput } from "../student/assessment-fixture.mjs";
import { createAuditFailureFixture, snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";

export async function runAssessmentHttpRehearsal(t, pool, { send, browser, register, waitForBlockedApiQueries }) {
  const path = "/api/v1/student/assessment-records";
  async function fixture() { const client = browser(); return { client, user: await register(client) }; }
  const add = (f, revision, extra = {}) => f.client.send(path, { method: "POST", body: assessmentInput(revision, extra) });
  const edit = (f, id, revision, extra) => f.client.send(`${path}/${id}`, { method: "PATCH", body: { expectedRevision: revision, ...extra } });
  const remove = (f, id, revision) => f.client.send(`${path}/${id}/remove`, { method: "POST", body: { expectedRevision: revision } });
  const get = async f => (await (await f.client.send(path)).json()).data;

  await t.test("network assessment CRUD keeps reports independent self-reported and versioned through erasure", async () => {
    const f = await fixture(), other = await fixture(); assert.deepEqual(await get(f), { revision: 0, records: [] });
    const response = await add(f, 0); assert.equal(response.status, 200, await response.clone().text());
    assert.equal(response.headers.get("cache-control"), "no-store"); assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    const first = (await response.json()).data, id = first.records[0].id;
    assert.equal(Object.keys(first.records[0]).length, 10); assert.equal(first.records[0].evidenceStatus, "unverified");
    assert.equal(first.records[0].components[0].value, "7.50"); assert.equal(first.records[0].testDate, "2026-02-01");
    assert.equal((await add(f, 1, { assessmentName: "Another attempt" })).status, 200);
    assert.equal((await edit(f, id, 2, { resultStatus: "awaiting_result" })).status, 400);
    const before = await snapshotAuditedBusinessTables(pool);
    assert.equal((await (await edit(f, id, 2, { components: [{ scale: "0-9", name: "Overall", testDate: "2026-02-01", value: "7.50" }] })).json()).data.revision, 2);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    const updated = await edit(f, id, 2, { resultForm: "partial_retake", components: [{ name: "Writing", value: "8.0", scale: "0-9", testDate: "2026-02-02" }] });
    assert.equal(updated.status, 200); assert.equal((await updated.json()).data.revision, 3);
    assert.equal((await edit(f, id, 2, { assessmentVariant: null })).status, 409);
    assert.equal((await edit(other, id, 1, { assessmentVariant: null })).status, 403); assert.equal((await remove(other, id, 1)).status, 403);
    assert.deepEqual(await get(other), { revision: 0, records: [] });
    const removed = await remove(f, id, 3); assert.equal(removed.status, 200); const remaining = (await removed.json()).data;
    assert.equal(remaining.records.length, 1); assert.equal(remaining.revision, 4);
    assert.equal((await remove(f, id, 3)).status, 409); assert.deepEqual((await (await remove(f, id, 4)).json()).data, remaining);
    assert.equal((await add(f, 4)).status, 200); assert.equal((await edit(f, id, 5, { assessmentName: "Revive" })).status, 409);
    assert.equal((await (await remove(f, id, 5)).json()).data.records.length, 2);
    const row = (await pool.query("select * from student_assessment_records where id = $1", [id])).rows[0];
    assert.equal(row.assessment_name, null); assert.equal(row.components_json, null); assert.equal(row.test_date, null); assert.ok(row.removed_at);
  });

  await t.test("network assessment input origin and identity boundaries reject before storing private data", async () => {
    const f = await fixture(), before = await snapshotAuditedBusinessTables(pool);
    assert.equal((await send(path)).status, 403); assert.equal((await send(path, { method: "POST", body: assessmentInput() })).status, 403);
    assert.equal((await f.client.send(path, { method: "POST", body: {}, headers: { origin: "https://other.invalid" } })).status, 403);
    for (const extra of [{ userId: randomUUID() }, { role: "cuac_admin" }, { tenantSchoolId: randomUUID() }, { evidenceStatus: "verified" }, { consent: true },
      { assessmentName: {} }, { assessmentName: "\ud800" }, { assessmentVariant: "Edition\n" }, { reportNumber: "private-number" },
      { testDate: "2026-02-29" }, { testDate: "2026-02-02" }, { resultStatus: "passed" }, { components: [{ name: "Score", value: 99 }] },
      { components: [{ name: "Score", value: "99", metadata: "private" }] }, { resultStatus: "awaiting_result" }]) {
      const response = await add(f, 0, extra); assert.equal(response.status, 400, await response.clone().text());
    }
    assert.equal((await edit(f, "invalid", 1, { assessmentVariant: null })).status, 400);
    assert.equal((await f.client.send(`${path}/${randomUUID()}/remove`, { method: "POST", body: { expectedRevision: 1, userId: randomUUID() } })).status, 400);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
  });

  await t.test("network assessment initial saves and mixed mutations have exactly one same-version winner", async () => {
    const f = await fixture();
    for (const revision of [0, 1]) {
      const blocker = await pool.connect(); let pending = [];
      try {
        await blocker.query("begin");
        if (revision === 0) await blocker.query("select id from users where id = $1 for update", [f.user.userId]);
        else await blocker.query("select user_id from student_assessment_histories where user_id = $1 for update", [f.user.userId]);
        const id = revision === 0 ? null : (await get(f)).records[0].id;
        pending = revision === 0 ? [add(f, 0, { assessmentName: "First" }), add(f, 0, { assessmentName: "Second" })]
          : [edit(f, id, 1, { assessmentVariant: "Edited" }), remove(f, id, 1)];
        await waitForBlockedApiQueries(2); await blocker.query("commit");
        const responses = await Promise.all(pending); assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
        const winner = (await responses.find(r => r.status === 200).json()).data;
        assert.equal(winner.revision, revision + 1); assert.deepEqual(await get(f), winner);
      } finally { await blocker.query("rollback"); blocker.release(); await Promise.allSettled(pending); }
    }
  });

  await t.test("network assessment audit faults never leave an initial header altered results or erased body behind", async () => {
    const f = await fixture(), faults = await createAuditFailureFixture(pool);
    try {
      let before = await snapshotAuditedBusinessTables(pool);
      await faults.during("student.assessment_record.add", async () => {
        const response = await add(f, 0); assert.equal(response.status, 500); assert.doesNotMatch(await response.text(), /Private language|7\.50|insert into|Synthetic/);
      });
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      const id = (await (await add(f, 0)).json()).data.records[0].id;
      for (const [action, command] of [["update", () => edit(f, id, 1, { assessmentVariant: "Private edition" })], ["remove", () => remove(f, id, 1)]]) {
        before = await snapshotAuditedBusinessTables(pool);
        await faults.during(`student.assessment_record.${action}`, async () => {
          const response = await command(); assert.equal(response.status, 500); assert.doesNotMatch(await response.text(), /Private edition|7\.50|insert into|Synthetic/);
        });
        assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      }
      assert.equal((await edit(f, id, 1, { assessmentVariant: "Private edition" })).status, 200); assert.equal((await remove(f, id, 2)).status, 200);
      assert.deepEqual(await get(f), { revision: 3, records: [] });
      assert.doesNotMatch(JSON.stringify((await pool.query("select * from audit_logs where actor_user_id = $1", [f.user.userId])).rows), /Private language|Private edition|7\.50|2026-02/);
    } finally { await faults.close(); }
  });

  await t.test("network assessment removal rechecks role revocation committed after session resolution", async () => {
    const f = await fixture(), first = (await (await add(f, 0)).json()).data, blocker = await pool.connect(); let pending;
    try {
      await blocker.query("begin"); await blocker.query("update user_roles set revoked_at = now() where user_id = $1 and role = 'student'", [f.user.userId]);
      pending = remove(f, first.records[0].id, 1); await waitForBlockedApiQueries(1); await blocker.query("commit");
      assert.equal((await pending).status, 403); assert.equal((await f.client.send(path)).status, 403);
      assert.equal((await pool.query("select revision from student_assessment_histories where user_id = $1", [f.user.userId])).rows[0].revision, 1);
      assert.equal((await pool.query("select removed_at from student_assessment_records where id = $1", [first.records[0].id])).rows[0].removed_at, null);
    } finally { await blocker.query("rollback"); blocker.release(); if (pending) await Promise.allSettled([pending]); }
  });

  await t.test("network corrupt assessment reports fail with redacted unavailability and can be explicitly erased", async () => {
    const f = await fixture(), first = (await (await add(f, 0)).json()).data, id = first.records[0].id;
    await pool.query("update student_assessment_records set components_json = $2::jsonb where id = $1", [id, JSON.stringify([{ name: "Score", value: "1", internal: "Secret injected payload" }])]);
    const response = await f.client.send(path); assert.equal(response.status, 503); assert.equal(response.headers.get("cache-control"), "no-store");
    assert.doesNotMatch(await response.text(), /Secret injected|Private language|components_json|select /);
    assert.equal((await remove(f, id, 1)).status, 200); assert.deepEqual(await get(f), { revision: 2, records: [] });
  });
}
