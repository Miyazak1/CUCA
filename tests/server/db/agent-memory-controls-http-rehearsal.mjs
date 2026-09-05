import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createPostgresAgentContextService } from "../../../src/server/agent/http.ts";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { createAuditFailureFixture, snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";

const listPath = "/api/v1/agent/memories", clearPath = listPath + "/clear", settingsPath = "/api/v1/agent/memory-settings";
const candidateInput = { candidateType: "study_goal", structured: { degreeLevel: "master" } };

export async function runAgentMemoryControlsHttpRehearsal(t, pool, { send, browser, register, waitForBlockedApiQueries }) {
  const contextService = createPostgresAgentContextService(createTransactionalSqlClient(pool));
  async function addMemory(account) {
    const context = createRequestContext({ actorUserId: account.userId, activeRole: "student", selectedSurface: "student", purpose: "agent_tool" });
    const candidate = await contextService.proposeCandidate(context, candidateInput);
    return contextService.acceptCandidateAsMemory(context, candidate.id);
  }
  async function fixture() {
    const client = browser(), account = await register(client), memory = await addMemory(account);
    return { client, account, memory };
  }
  async function body(response, status = 200) {
    assert.equal(response.status, status, await response.clone().text());
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    return (await response.json()).data;
  }

  await t.test("network memory controls list and erase only owned student memories using private session projections", async () => {
    const a = await fixture(), b = await fixture();
    const page = await body(await a.client.send(listPath, { headers: { "x-user-id": b.account.userId, "x-role": "cuac_admin", "x-purpose": "agent_tool" } }));
    assert.equal(page.revision, 0); assert.equal(page.capacity, 100); assert.equal(page.storedCount, 1);
    assert.deepEqual(page.items.map(row => row.id), [a.memory.id]);
    assert.doesNotMatch(JSON.stringify(page), /userId|sourceCandidateId|memoryNamespace|student_pii/);
    assert.deepEqual(await body(await a.client.send(`${listPath}/${b.memory.id}`, { method: "DELETE" })), { cleared: false });
    assert.deepEqual(await body(await a.client.send(`${listPath}/${randomUUID()}`, { method: "DELETE" })), { cleared: false });
    assert.deepEqual(await body(await a.client.send(`${listPath}/${a.memory.id}`, { method: "DELETE" })), { cleared: true });
    const replacement = await addMemory(a.account);
    assert.deepEqual(await body(await a.client.send(`${listPath}/${a.memory.id}`, { method: "DELETE" })), { cleared: false });
    assert.deepEqual((await body(await a.client.send(listPath))).items.map(row => row.id), [replacement.id]);
    assert.equal((await body(await b.client.send(listPath))).items[0].id, b.memory.id);
  });

  await t.test("network memory controls reject guest persona query body and browser-origin overrides", async () => {
    const a = await fixture(), before = await snapshotAuditedBusinessTables(pool);
    for (const [path, options] of [[listPath, {}], [clearPath, { method: "POST", body: { expectedRevision: 0 } }],
      [settingsPath, { method: "PATCH", body: { enabled: false, expectedRevision: 0 } }], [`${listPath}/${a.memory.id}`, { method: "DELETE" }]]) {
      assert.equal((await send(path, options)).status, 403);
    }
    for (const query of ["?userId=x", "?limit=2&limit=3", "?limit=101", "?cursor=bad", "?offset=0", "?limit=0x20"]) {
      assert.equal((await a.client.send(listPath + query)).status, 400);
    }
    for (const request of [{ path: clearPath, method: "POST", body: {} }, { path: clearPath, method: "POST", body: { expectedRevision: 0, userId: a.account.userId } },
      { path: settingsPath, method: "PATCH", body: { enabled: false } }, { path: settingsPath, method: "PATCH", body: { enabled: "false", expectedRevision: 0 } },
      { path: `${listPath}/${a.memory.id}`, method: "DELETE", body: {} }]) {
      assert.equal((await a.client.send(request.path, request)).status, 400);
    }
    for (const site of ["cross-site", "same-site"]) {
      assert.equal((await a.client.send(listPath, { headers: { "sec-fetch-site": site } })).status, 403);
      assert.equal((await a.client.send(clearPath, { method: "POST", body: { expectedRevision: 0 }, headers: { "sec-fetch-site": site } })).status, 403);
    }
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    for (const [role, surface] of [["school_staff", "school"], ["cuac_ops", "ops"], ["cuac_admin", "ops"]]) {
      await pool.query("update auth_sessions set active_role = $2, selected_surface = $3 where user_id = $1", [a.account.userId, role, surface]);
      assert.equal((await a.client.send(listPath)).status, 403);
    }
  });

  await t.test("network memory control version conflicts serialize and old decisions cannot undo an opt-out or clear fresh memories", async () => {
    const a = await fixture(), blocker = await pool.connect(); let pending;
    try {
      await blocker.query("begin"); await blocker.query("select id from users where id = $1 for update", [a.account.userId]);
      pending = Promise.all([a.client.send(clearPath, { method: "POST", body: { expectedRevision: 0 } }),
        a.client.send(clearPath, { method: "POST", body: { expectedRevision: 0 } })]);
      pending.catch(() => {});
      await waitForBlockedApiQueries(2); await blocker.query("commit");
      assert.deepEqual((await pending).map(r => r.status).sort(), [200, 409]);
    } finally { await blocker.query("rollback"); blocker.release(); await Promise.allSettled([pending]); }
    const fresh = await addMemory(a.account);
    assert.equal((await a.client.send(clearPath, { method: "POST", body: { expectedRevision: 0 } })).status, 409);
    assert.deepEqual((await body(await a.client.send(listPath))).items.map(row => row.id), [fresh.id]);
    assert.deepEqual(await body(await a.client.send(settingsPath, { method: "PATCH", body: { enabled: false, expectedRevision: 1 } })), { enabled: false, revision: 2 });
    assert.equal((await a.client.send(settingsPath, { method: "PATCH", body: { enabled: true, expectedRevision: 1 } })).status, 409);
    assert.deepEqual((await body(await a.client.send(listPath))).items, []);
    assert.deepEqual(await body(await a.client.send(settingsPath, { method: "PATCH", body: { enabled: true, expectedRevision: 2 } })), { enabled: true, revision: 3 });
    assert.deepEqual((await body(await a.client.send(listPath))).items, []);
    assert.equal((await pool.query("select count(*)::int as n from audit_logs where actor_user_id = $1 and action = 'agent.memory.clear_all'", [a.account.userId])).rows[0].n, 1);
  });

  await t.test("network memory audits fail closed with no erased content or changed reset revision", async () => {
    const faults = await createAuditFailureFixture(pool);
    try {
      for (const [action, method, path, input] of [["agent.memory.list", "GET", listPath, undefined],
        ["agent.memory.clear", "DELETE", null, undefined], ["agent.memory.clear_all", "POST", clearPath, { expectedRevision: 0 }],
        ["agent.memory.preference.update", "PATCH", settingsPath, { enabled: false, expectedRevision: 0 }]]) {
        const a = await fixture(), before = await snapshotAuditedBusinessTables(pool);
        await faults.during(action, async () => {
          const response = await a.client.send(path ?? `${listPath}/${a.memory.id}`, { method, body: input });
          assert.equal(response.status, 500); assert.doesNotMatch(await response.text(), /P0001|PRIVATE|insert |audit_logs/i);
        });
        assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
        assert.equal((await a.client.send(path ?? `${listPath}/${a.memory.id}`, { method, body: input })).status, 200);
      }
    } finally { await faults.close(); }
  });

  await t.test("network memory writes recheck student authority after waiting for role revocation", async () => {
    const a = await fixture(), blocker = await pool.connect(); let pending;
    try {
      await blocker.query("begin");
      await blocker.query("update user_roles set revoked_at = clock_timestamp() where user_id = $1", [a.account.userId]);
      pending = a.client.send(clearPath, { method: "POST", body: { expectedRevision: 0 } }); pending.catch(() => {});
      const waiting = await waitForBlockedApiQueries(1);
      assert.equal((await pool.query("select $1 = any(pg_blocking_pids($2)) as blocked", [blocker.processID, waiting[0].pid])).rows[0].blocked, true);
      await blocker.query("commit"); assert.equal((await pending).status, 403);
      assert.equal((await pool.query("select cleared_at from agent_memory_entries where id = $1", [a.memory.id])).rows[0].cleared_at, null);
    } finally { await blocker.query("rollback"); blocker.release(); await Promise.allSettled([pending]); }
  });

  await t.test("network guest carry-forward observes the confirmed-memory quota and can retry after one owned removal", async () => {
    const client = browser();
    assert.equal((await client.send("/api/v1/auth/guest-session", { method: "POST" })).status, 200);
    const candidate = await body(await client.send("/api/v1/agent/context/candidates", { method: "POST", body: candidateInput }));
    const account = await register(client);
    const rows = (await pool.query(`insert into agent_memory_entries (user_id,memory_type,context_scope,active_role,memory_namespace,data_class,confidence,summary,structured_json,source,created_at,expires_at)
      select $1::uuid,'study_goal','student_account','student','user:' || $1::uuid::text || ':student','low_sensitive_preference','user_confirmed','','{"degreeLevel":"master"}','synthetic',statement_timestamp(),statement_timestamp() + interval '365 days' from generate_series(1,100) returning id`, [account.userId])).rows;
    const carry = () => client.send("/api/v1/agent/context/carry-forward", { method: "POST", body: { candidateId: candidate.id, confirmed: true } });
    assert.equal((await carry()).status, 409);
    assert.equal((await pool.query("select status from agent_context_candidates where id = $1", [candidate.id])).rows[0].status, "proposed");
    assert.equal((await client.send(`${listPath}/${rows[0].id}`, { method: "DELETE" })).status, 200);
    assert.equal((await carry()).status, 200);
    assert.equal((await body(await client.send(listPath))).storedCount, 100);
  });
}
