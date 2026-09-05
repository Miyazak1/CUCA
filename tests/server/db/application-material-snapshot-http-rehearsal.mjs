import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createAuditFailureFixture, snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";
import {
  applicationMaterialSnapshotFixture,
  clearApplicationMaterialSnapshots,
} from "./application-material-snapshot-fixture.mjs";

export async function runApplicationMaterialSnapshotHttpRehearsal(t, pool,
  { send, browser, register, waitForBlockedApiQueries }) {
  async function fixture() {
    await clearApplicationMaterialSnapshots(pool);
    const api = browser(), account = await register(api);
    return { ...await applicationMaterialSnapshotFixture(pool, account.userId), api, account };
  }
  async function isolated(work) {
    const f = await fixture();
    try { return await work(f); }
    finally { await clearApplicationMaterialSnapshots(pool); }
  }
  async function body(response) {
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("set-cookie"), null);
    return (await response.json()).data;
  }
  async function status(responsePromise) {
    const response = await responsePromise;
    const value = response.status;
    await response.arrayBuffer();
    return value;
  }
  const post = (f, value = f.snapshotInput, key = randomUUID(), headers = {}) => f.api.send(f.snapshotPath,
    { method: "POST", body: value, headers: { "idempotency-key": key, ...headers } });

  await t.test("network material snapshot creates, reads and replays one encrypted program package", async () => {
    await isolated(async f => {
      assert.equal(await body(await f.api.send(f.snapshotPath)), null);
      const key = randomUUID(), snapshot = await body(await post(f, f.snapshotInput, key));
      assert.equal(snapshot.mode, "immutable_material_snapshot"); assert.equal(snapshot.persisted, true);
      assert.equal(snapshot.freshness.current, true); assert.equal(snapshot.canSubmit, false);
      assert.equal(snapshot.target.choiceId, f.choice.id); assert.equal(snapshot.target.programId, f.catalog.programId);
      assert.equal(snapshot.target.programIntakeId, f.catalog.intakeId); assert.equal(snapshot.authorization.id, f.authorization.id);
      assert.deepEqual(await body(await f.api.send(f.snapshotPath)), snapshot);
      assert.deepEqual(await body(await post(f, f.snapshotInput, key)), snapshot);
      const text = JSON.stringify(snapshot);
      assert.doesNotMatch(text, /PRIVATE_|private-applicant|7\.50|envelope|cipher|keyId|selection_json|studentNotes/i);
      const preflight = await body(await f.api.send(f.path));
      assert.equal(preflight.materialSnapshot.id, snapshot.id); assert.equal(preflight.materialSnapshot.current, true);
      assert.doesNotMatch(JSON.stringify(preflight.materialSnapshot), /sha256|payload|envelope|selection/i);
      assert.ok(!preflight.platformBlockers.includes("MATERIAL_SNAPSHOT_UNAVAILABLE")); assert.equal(preflight.canSubmit, false);
      assert.equal((await pool.query("select count(*)::int as n from school_applications where application_choice_id = $1", [f.choice.id])).rows[0].n, 0);
    });
  });

  await t.test("network snapshot rejects guest, foreign owner, forged body, stale digest and unsupported surface", async () => {
    await isolated(async f => {
      const other = browser(); await register(other);
      for (const caller of [{ send }, other]) {
        const get = await caller.send(f.snapshotPath, { headers: { "x-user-id": f.userId, "x-role": "student" } });
        assert.equal(get.status, 403); assert.doesNotMatch(await get.text(), /PRIVATE_|private-applicant|7\.50/i);
        assert.equal(await status(caller.send(f.snapshotPath, { method: "POST", body: f.snapshotInput,
          headers: { "idempotency-key": randomUUID(), "x-role": "student" } })), 403);
      }
      assert.equal(await status(post(f, { ...f.snapshotInput, userId: f.userId })), 400);
      assert.equal(await status(post(f, { ...f.snapshotInput, paid: true })), 400);
      assert.equal(await status(post(f, { ...f.snapshotInput, expectedMaterialContentSha256: "c".repeat(64) })), 409);
      assert.equal(await status(f.api.send(f.snapshotPath, { method: "POST", body: f.snapshotInput })), 400);
      for (const method of ["GET", "POST"]) {
        const options = method === "GET" ? {} : { method, body: f.snapshotInput, headers: { "idempotency-key": randomUUID() } };
        assert.equal(await status(f.api.send(f.snapshotPath + "?decrypt=true", options)), 400);
        assert.equal(await status(f.api.send(f.snapshotPath, { ...options, headers: { ...options.headers,
          "sec-fetch-site": "same-site" } })), 403);
      }
      assert.equal(await status(f.api.send(f.snapshotPath.replace(f.choice.id, "invalid"))), 400);
      for (const method of ["PUT", "PATCH", "DELETE"]) assert.ok([404, 405].includes(await status(f.api.send(f.snapshotPath, { method, body: {} }))));
      assert.equal(await status(f.api.send(f.snapshotPath, { method: "POST", rawBody: "{",
        headers: { "idempotency-key": randomUUID() } })), 400);
      assert.equal(await status(f.api.send(f.snapshotPath, { method: "POST", body: f.snapshotInput,
        headers: { "idempotency-key": randomUUID(), "content-type": "text/plain" } })), 415);
      assert.equal(await status(f.api.send(f.snapshotPath, { method: "POST", rawBody: JSON.stringify({ data: "x".repeat(500000) }),
        headers: { "idempotency-key": randomUUID(), connection: "close" } })), 413);
      assert.equal((await pool.query("select count(*)::int as n from application_material_snapshots where user_id = $1", [f.userId])).rows[0].n, 0);
    });
  });

  await t.test("network concurrent snapshot requests converge and audit failure leaves no ciphertext or receipt", async () => {
    await isolated(async f => {
      const blocker = await pool.connect(); let pending = [];
      try {
        await blocker.query("begin");
        const locked = await blocker.query("select id from users where id = $1 for update", [f.userId]);
        assert.equal(locked.rows.length, 1);
        pending = [post(f), post(f)]; const settled = Promise.allSettled(pending);
        try { await waitForBlockedApiQueries(2); }
        catch (error) {
          const outcomes = await settled;
          const statuses = outcomes.map(outcome => outcome.status === "fulfilled" ? String(outcome.value.status)
            : `${outcome.reason?.name ?? "Error"}:${outcome.reason?.message ?? "fetch rejected"}`);
          const activity = (await pool.query(`select application_name as application, state,
            coalesce(wait_event_type, 'none') as "waitType", coalesce(wait_event, 'none') as "waitEvent", count(*)::int as count
            from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid()
            group by application_name, state, wait_event_type, wait_event order by application_name, state`)).rows;
          assert.fail(`${error instanceof Error ? error.message : "Lock barrier failed."} HTTP outcomes: ${statuses.join(",")}. Database activity: ${JSON.stringify(activity)}.`);
        }
        await blocker.query("commit");
        const outcomes = await settled; assert.ok(outcomes.every(outcome => outcome.status === "fulfilled"));
        const results = outcomes.map(outcome => outcome.value); assert.deepEqual(results.map(response => response.status), [200, 200]);
        const values = await Promise.all(results.map(response => response.json())); assert.equal(values[0].data.id, values[1].data.id);
        assert.equal((await pool.query("select count(*)::int as n from application_material_snapshots where user_id = $1", [f.userId])).rows[0].n, 1);
      } finally { await blocker.query("rollback"); blocker.release(); await Promise.allSettled(pending); }
    });
    await isolated(async f => {
      const faults = await createAuditFailureFixture(pool);
      try {
        const before = await snapshotAuditedBusinessTables(pool);
        await faults.during("student.application_material_snapshot.create", async () => {
          const response = await post(f); assert.equal(response.status, 500);
          assert.doesNotMatch(await response.text(), /Synthetic|PRIVATE_|postgres|cipher|snapshot-key/i);
        });
        assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
        assert.equal(await body(await f.api.send(f.snapshotPath)), null);
      } finally { await faults.close(); }
    });
  });

  await t.test("network preflight and owner GET fail closed after authenticated ciphertext tampering", async () => {
    await isolated(async f => {
      const snapshot = await body(await post(f));
      await pool.query(`update application_material_snapshots set envelope_json = jsonb_set(envelope_json,'{ciphertext}',
        to_jsonb(case when left(envelope_json->>'ciphertext',1) = 'A' then 'B' else 'A' end || substring(envelope_json->>'ciphertext' from 2))) where id = $1`, [snapshot.id]);
      for (const path of [f.snapshotPath, f.path]) {
        const response = await f.api.send(path); assert.equal(response.status, 503);
        assert.doesNotMatch(await response.text(), /PRIVATE_|cipher|key|postgres|envelope/i);
      }
    });
  });
}
