import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createAuditFailureFixture, snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";
import { emptySelection, materialSelectionFixture } from "./material-selection-fixture.mjs";

export async function runMaterialSelectionHttpRehearsal(t, pool, { send, browser, register, waitForBlockedApiQueries }) {
  async function fixture() { const student = browser(), account = await register(student); return { ...await materialSelectionFixture(pool, account.userId), api: student }; }
  async function body(response) { assert.equal(response.status, 200, await response.clone().text());
    assert.equal(response.headers.get("cache-control"), "no-store"); assert.equal(response.headers.get("set-cookie"), null);
    return (await response.json()).data; }

  await t.test("network selection GET PUT and clear preserve independent revisions without exposing material contents", async () => {
    const f = await fixture(); assert.equal((await body(await f.api.send(f.selectionPath))).revision, 0);
    const result = await body(await f.api.send(f.selectionPath, { method: "PUT", body: f.selectionInput }));
    assert.equal(result.revision, 1); assert.equal(result.target.choiceId, f.choice.id); assert.equal(result.canSubmit, false); assert.equal(result.consentRecorded, false);
    assert.deepEqual(result.selection, f.input.selection); assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|@example|7\.50|schoolVisible|userId/);
    assert.equal((await f.api.send(f.selectionPath, { method: "PUT", body: f.selectionInput })).status, 409);
    const cleared = await body(await f.api.send(f.selectionPath, { method: "PUT", body: { ...f.selectionInput, expectedRevision: 1, selection: emptySelection() } }));
    assert.equal(cleared.revision, 2); assert.deepEqual(cleared.selection, emptySelection());
    await body(await f.api.send(f.selectionPath.replace("/material-selection", ""), { method: "DELETE" }));
    assert.equal((await f.api.send(f.selectionPath)).status, 403);
    assert.equal((await f.api.send(f.selectionPath, { method: "PUT", body: { ...f.selectionInput, expectedRevision: 2 } })).status, 403);
    assert.equal((await pool.query("select count(*)::int as n from application_material_selections where choice_id = $1", [f.choice.id])).rows[0].n, 0);
  });

  await t.test("network selection rejects guests foreign owners and forged student identity for both verbs", async () => {
    const f = await fixture(), other = browser(); await register(other);
    for (const method of ["GET", "PUT"]) for (const caller of [{ send }, other]) {
      const response = await caller.send(f.selectionPath, { method, ...(method === "PUT" ? { body: f.selectionInput } : {}), headers: { "x-user-id": f.userId, "x-role": "student" } });
      assert.equal(response.status, 403); assert.doesNotMatch(await response.text(), /PRIVATE_|@example/);
    }
    await pool.query("insert into user_roles (user_id,role) values ($1,'cuac_admin')", [f.userId]);
    await pool.query("update auth_sessions set active_role = 'cuac_admin', selected_surface = 'ops' where user_id = $1", [f.userId]);
    assert.equal((await f.api.send(f.selectionPath, { headers: { "x-role": "student" } })).status, 403);
    assert.equal((await f.api.send(f.selectionPath, { method: "PUT", body: f.selectionInput })).status, 403);
  });

  await t.test("network selection enforces strict inputs origins body limits and its GET PUT method surface", async () => {
    const f = await fixture(), before = await snapshotAuditedBusinessTables(pool);
    for (const value of [{ ...f.selectionInput, expectedRevision: undefined }, { ...f.selectionInput, consent: true },
      { ...f.selectionInput, selection: { ...emptySelection(), applicantFields: ["passport"] } },
      { ...f.selectionInput, expectedVersions: { ...f.input.expectedVersions, userId: f.userId } }]) {
      assert.equal((await f.api.send(f.selectionPath, { method: "PUT", body: value })).status, 400);
    }
    for (const method of ["GET", "PUT"]) {
      assert.equal((await f.api.send(f.selectionPath + "?userId=x", { method, body: f.selectionInput })).status, 400);
      assert.equal((await f.api.send(f.selectionPath, { method, body: f.selectionInput, headers: { "sec-fetch-site": "same-site" } })).status, 403);
    }
    assert.equal((await f.api.send(f.selectionPath, { method: "PUT", rawBody: "{" })).status, 400);
    assert.equal((await f.api.send(f.selectionPath, { method: "PUT", body: f.selectionInput, headers: { origin: "https://foreign.invalid" } })).status, 403);
    assert.equal((await f.api.send(f.selectionPath, { method: "PUT", rawBody: JSON.stringify({ data: "x".repeat(200000) }) })).status, 413);
    assert.equal((await f.api.send(f.selectionPath, { method: "PUT", body: f.selectionInput, headers: { "content-type": "text/plain" } })).status, 415);
    assert.equal((await f.api.send(f.selectionPath.replace(f.choice.id, "invalid"))).status, 400);
    for (const method of ["POST", "PATCH", "DELETE"]) assert.ok([404, 405].includes((await f.api.send(f.selectionPath, { method })).status));
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
  });

  await t.test("network selection exposes source staleness and removed references but never silently updates the selection", async () => {
    const f = await fixture(); await body(await f.api.send(f.selectionPath, { method: "PUT", body: f.selectionInput }));
    await f.api.send("/api/v1/student/applicant-profile", { method: "PATCH", body: { expectedRevision: 1, fullName: "CHANGED_PRIVATE_NAME" } }).then(body);
    const result = await body(await f.api.send(f.selectionPath)); assert.deepEqual(result.changedSources, ["applicant"]); assert.equal(result.revision, 1);
    assert.equal((await f.api.send(f.selectionPath, { method: "PUT", body: { ...f.selectionInput, expectedRevision: 1 } })).status, 409);
    await f.student.removeOwnEducationRecord(f.context, f.input.selection.educationRecordIds[0], { expectedRevision: 1 });
    const removed = await body(await f.api.send(f.selectionPath));
    assert.deepEqual(removed.unavailable.educationRecordIds, f.input.selection.educationRecordIds);
    await f.selectionService.put(f.context, f.set.id, f.choice.id, { expectedRevision: 1, ...await f.request() });
    await pool.query("update user_roles set revoked_at = now() where user_id = $1 and role = 'student'", [f.userId]);
    assert.equal((await f.api.send(f.selectionPath)).status, 403);
    assert.equal((await f.api.send(f.selectionPath, { method: "PUT", body: f.selectionInput })).status, 403);
  });

  await t.test("network selection concurrent writes conflict after real database waits and audit errors leave no partial state", async () => {
    const f = await fixture(), blocker = await pool.connect(); let pending;
    try {
      await blocker.query("begin"); await blocker.query("select id from users where id = $1 for update", [f.userId]);
      pending = Promise.all([f.api.send(f.selectionPath, { method: "PUT", body: f.selectionInput }),
        f.api.send(f.selectionPath, { method: "PUT", body: { ...f.selectionInput, selection: emptySelection() } })]);
      await waitForBlockedApiQueries(2); await blocker.query("commit");
      assert.deepEqual((await pending).map(r => r.status).sort(), [200, 409]);
    } finally { await blocker.query("rollback"); blocker.release(); if (pending) await pending; }
    const faults = await createAuditFailureFixture(pool);
    try {
      const current = await f.selectionGet(), before = await snapshotAuditedBusinessTables(pool);
      const value = { ...f.selectionInput, expectedRevision: current.revision,
        selection: { ...emptySelection(), applicantFields: ["fullName"] } };
      await faults.during("student.material_selection.save", async () => {
        const response = await f.api.send(f.selectionPath, { method: "PUT", body: value }); assert.equal(response.status, 500);
        assert.doesNotMatch(await response.text(), /Synthetic|PRIVATE_|postgres|application_material/i);
      });
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    } finally { await faults.close(); }
  });

  await t.test("network selection corrupt stored references return a private error instead of leaking foreign inventory", async () => {
    const f = await fixture(); await f.selectionPut();
    await pool.query("update application_material_selections set selection_json = $2 where choice_id = $1", [f.choice.id, { ...emptySelection(), educationRecordIds: [randomUUID()] }]);
    const before = await snapshotAuditedBusinessTables(pool), response = await f.api.send(f.selectionPath);
    assert.equal(response.status, 503); assert.equal(response.headers.get("cache-control"), "no-store");
    assert.doesNotMatch(await response.text(), /PRIVATE_|selection_json|educationRecordIds|user_id/);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
  });
}
