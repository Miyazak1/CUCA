import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createAuditFailureFixture, snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";
import {
  applicationSubmissionAuthorizationFixture,
  clearApplicationSubmissionAuthorizations,
} from "./application-submission-authorization-fixture.mjs";

export async function runApplicationSubmissionAuthorizationHttpRehearsal(t, pool,
  { send, browser, register, waitForBlockedApiQueries }) {
  async function fixture() {
    await clearApplicationSubmissionAuthorizations(pool);
    const api = browser(), account = await register(api);
    return { ...await applicationSubmissionAuthorizationFixture(pool, account.userId), api, account };
  }
  async function isolated(work) {
    const f = await fixture();
    try { return await work(f); }
    finally { await clearApplicationSubmissionAuthorizations(pool); }
  }
  async function body(response) {
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("set-cookie"), null);
    return (await response.json()).data;
  }
  const post = (f, value = f.authorizationInput, key = randomUUID(), headers = {}) => f.api.send(f.authorizationPath,
    { method: "POST", body: value, headers: { "idempotency-key": key, ...headers } });
  const withdraw = (f, authorizationId, headers = {}) => f.api.send(f.authorizationPath,
    { method: "DELETE", body: { authorizationId }, headers: { "content-type": "application/json", ...headers } });

  await t.test("network program authorization records, reads, replays and withdraws one exact project scope", async () => {
    await isolated(async f => {
      assert.equal(await body(await f.api.send(f.authorizationPath)), null);
      const key = randomUUID(), first = await body(await post(f, f.authorizationInput, key));
      assert.equal(first.status, "active"); assert.equal(first.canSubmit, false); assert.equal(first.freshness.current, true);
      assert.equal(first.confirmation.format, "cuac.application-submission-authorization.v2");
      assert.deepEqual(first.officialSubmissionPolicy, f.authorizationInput.expectedPolicy);
      assert.deepEqual(first.target, { applicationSetId: f.set.id, choiceId: f.choice.id, schoolId: f.catalog.schoolId,
        programId: f.catalog.programId, programIntakeId: f.catalog.intakeId });
      assert.deepEqual(await body(await f.api.send(f.authorizationPath)), first);
      assert.deepEqual(await body(await post(f, f.authorizationInput, key)), first);
      const text = JSON.stringify(first);
      assert.doesNotMatch(text, /PRIVATE_|private-applicant|7\.50|userId|selection_json|studentNotes|targetSetSha256|approvalSha256|reviewEvidence|sourceChecks/i);
      const ended = await body(await withdraw(f, first.id));
      assert.equal(ended.status, "withdrawn"); assert.equal(ended.endReason, "student_withdrawal");
      assert.deepEqual(await body(await withdraw(f, first.id)), ended);
      assert.deepEqual(await body(await f.api.send(f.authorizationPath)), ended);
      assert.equal((await pool.query("select count(*)::int as n from school_applications where application_choice_id = $1", [f.choice.id])).rows[0].n, 0);
    });
  });

  await t.test("network authorization rejects guest, foreign owner, forged authority, stale input and unsupported surface", async () => {
    await isolated(async f => {
      const other = browser(); await register(other);
      for (const caller of [{ send }, other]) {
        const get = await caller.send(f.authorizationPath, { headers: { "x-user-id": f.userId, "x-role": "student" } });
        assert.equal(get.status, 403); assert.doesNotMatch(await get.text(), /PRIVATE_|private-applicant|7\.50/i);
        const write = await caller.send(f.authorizationPath, { method: "POST", body: f.authorizationInput,
          headers: { "idempotency-key": randomUUID(), "x-role": "student" } });
        assert.equal(write.status, 403);
      }
      assert.equal((await post(f, { ...f.authorizationInput, userId: f.userId })).status, 400);
      assert.equal((await post(f, { ...f.authorizationInput, confirmation: "yes" })).status, 400);
      assert.equal((await post(f, { ...f.authorizationInput, expectedPolicy: {
        ...f.authorizationInput.expectedPolicy, approvalSha256: "a".repeat(64),
      } })).status, 400);
      assert.equal((await post(f, { ...f.authorizationInput, expectedPolicy: {
        ...f.authorizationInput.expectedPolicy, admissionRouteKey: "centralized_platform",
      } })).status, 409);
      assert.equal((await post(f, { ...f.authorizationInput, expectedPolicy: {
        ...f.authorizationInput.expectedPolicy, versionId: randomUUID(),
      } })).status, 409);
      assert.equal((await post(f, { ...f.authorizationInput, materialContentSha256: "c".repeat(64) })).status, 409);
      assert.equal((await f.api.send(f.authorizationPath, { method: "POST", body: f.authorizationInput })).status, 400);
      for (const method of ["GET", "POST", "DELETE"]) {
        const options = method === "GET" ? {} : method === "POST" ? { method, body: f.authorizationInput,
          headers: { "idempotency-key": randomUUID() } } : { method, body: { authorizationId: randomUUID() },
          headers: { "content-type": "application/json" } };
        assert.equal((await f.api.send(f.authorizationPath + "?userId=x", options)).status, 400);
        assert.equal((await f.api.send(f.authorizationPath, { ...options, headers: { ...options.headers,
          "sec-fetch-site": "same-site" } })).status, 403);
      }
      assert.equal((await f.api.send(f.authorizationPath.replace(f.choice.id, "invalid"))).status, 400);
      for (const method of ["PUT", "PATCH"]) assert.ok([404, 405].includes((await f.api.send(f.authorizationPath, { method, body: {} })).status));
      assert.equal((await f.api.send(f.authorizationPath, { method: "POST", rawBody: "{",
        headers: { "idempotency-key": randomUUID() } })).status, 400);
      assert.equal((await f.api.send(f.authorizationPath, { method: "POST", body: f.authorizationInput,
        headers: { "idempotency-key": randomUUID(), "content-type": "text/plain" } })).status, 415);
      assert.equal((await f.api.send(f.authorizationPath, { method: "POST", rawBody: JSON.stringify({ data: "x".repeat(200000) }),
        headers: { "idempotency-key": randomUUID() } })).status, 413);
      assert.equal((await pool.query("select count(*)::int as n from application_submission_authorizations where user_id = $1", [f.userId])).rows[0].n, 0);
    });
  });

  await t.test("network concurrent exact requests converge and audit failure leaves no evidence or receipt", async () => {
    await isolated(async f => {
      const blocker = await pool.connect(); let pending = [];
      try {
        await blocker.query("begin"); await blocker.query("select id from users where id = $1 for update", [f.userId]);
        pending = [post(f), post(f)]; await waitForBlockedApiQueries(2); await blocker.query("commit");
        const results = await Promise.all(pending); assert.deepEqual(results.map(response => response.status), [200, 200]);
        const values = await Promise.all(results.map(response => response.json())); assert.equal(values[0].data.id, values[1].data.id);
        assert.equal((await pool.query("select count(*)::int as n from application_submission_authorizations where user_id = $1", [f.userId])).rows[0].n, 1);
      } finally { await blocker.query("rollback"); blocker.release(); await Promise.allSettled(pending); }
    });
    await isolated(async f => {
      const faults = await createAuditFailureFixture(pool);
      try {
        const before = await snapshotAuditedBusinessTables(pool);
        await faults.during("student.application_submission_authorization.record", async () => {
          const response = await post(f); assert.equal(response.status, 500);
          assert.doesNotMatch(await response.text(), /Synthetic|PRIVATE_|postgres|application_submission/i);
        });
        assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
        assert.equal(await body(await f.api.send(f.authorizationPath)), null);
      } finally { await faults.close(); }
    });
  });
}
