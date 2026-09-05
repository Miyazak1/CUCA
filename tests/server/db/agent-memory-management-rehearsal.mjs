import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { createPostgresAgentContextService } from "../../../src/server/agent/http.ts";
import { createPostgresAgentMemoryManagementService, sweepAgentCandidates, sweepExpiredStudentMemories } from "../../../src/server/agent/memory-runtime.ts";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { createAuditFailureFixture, snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";

const input = { candidateType: "study_goal", structured: { degreeLevel: "master", teachingLanguage: "english" } };

export async function runAgentMemoryManagementRehearsal(t, pool) {
  const client = createTransactionalSqlClient(pool);
  const contextService = createPostgresAgentContextService(client);
  const management = createPostgresAgentMemoryManagementService(client);
  const faults = await createAuditFailureFixture(pool);
  async function student() {
    const email = `memory-${randomUUID()}@example.invalid`;
    const { rows: [user] } = await pool.query("insert into users (email, email_normalized) values ($1, $1) returning id", [email]);
    await pool.query("insert into user_roles (user_id, role) values ($1, 'student')", [user.id]);
    return createRequestContext({ actorUserId: user.id, activeRole: "student", selectedSurface: "student", guestSessionId: `sha256:${randomUUID()}`, purpose: "student_action" });
  }
  async function guestCandidate(context) {
    return contextService.proposeCandidate(createRequestContext({ guestSessionId: context.guestSessionId }), input);
  }
  async function memory(context) {
    const candidate = await contextService.proposeCandidate(context, input);
    return contextService.acceptCandidateAsMemory(context, candidate.id);
  }
  const forbidden = (e) => e.status === 403;
  const unavailable = (e) => e.status === 400;
  async function waitForWaiter() {
    for (let i = 0; i < 200; i += 1) {
      const rows = (await pool.query("select pid from pg_stat_activity where datname = current_database() and state = 'active' and wait_event_type = 'Lock'")).rows;
      if (rows.length) return;
      await delay(10);
    }
    assert.fail("Second request did not reach a database lock wait.");
  }
  function gatedClient(predicate) {
    let release, acquired, readyTimer;
    const gate = new Promise((resolve) => { release = resolve; });
    const ready = new Promise((resolve, reject) => {
      acquired = pid => { clearTimeout(readyTimer); resolve(pid); };
      readyTimer = setTimeout(() => reject(new Error("The first request did not acquire its expected database lock.")), 5000);
    });
    let paused = false;
    return { release: () => { clearTimeout(readyTimer); release(); }, ready, client: { ...client, transaction: (work) => client.transaction((tx) => work({ ...tx,
      async query(statement, params) {
        const rows = await tx.query(statement, params);
        if (!paused && predicate(statement)) { paused = true; acquired((await tx.query("select pg_backend_pid() as pid", []))[0].pid); await gate; }
        return rows;
      },
    })) } };
  }
  async function blockedBy(pid, pattern) {
    for (let i = 0; i < 200; i++) {
      const { rows } = await pool.query(`select pid from pg_stat_activity where datname = current_database()
        and state = 'active' and wait_event_type = 'Lock' and $1 = any(pg_blocking_pids(pid)) and query like $2`, [pid, pattern]);
      if (rows.length) return;
      await delay(10);
    }
    assert.fail("Memory request did not reach its expected lock barrier.");
  }
  try {
    await t.test("memory list stays owner-scoped, hides expired or corrupt content and regenerates summaries", async () => {
      const a = await student(), b = await student();
      const own = await memory(a), foreign = await memory(b);
      const expired = await memory(a), corrupt = await memory(a);
      await pool.query("update agent_memory_entries set summary = 'PRIVATE_OLD_SUMMARY' where id = $1", [own.id]);
      await pool.query("update agent_memory_entries set expires_at = clock_timestamp() - interval '1 second' where id = $1", [expired.id]);
      await pool.query("update agent_memory_entries set structured_json = '{\"passport\":\"PRIVATE_MEMORY_MARKER\"}'::jsonb where id = $1", [corrupt.id]);
      await assert.rejects(management.list(a, { userId: b.actorUserId }), e => e.status === 400);
      const result = await management.list(a);
      assert.deepEqual(result.items.map((m) => m.id), [own.id]);
      assert.equal(result.items[0].summary, "Degree: master; Language: english");
      assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|userId|memoryNamespace|sourceCandidateId/);
      assert.equal((await management.list(b)).items[0].id, foreign.id);
      for (const changes of [{ activeRole: "school_staff" }, { activeRole: "cuac_ops" }, { tenantSchoolId: randomUUID() }]) {
        await assert.rejects(management.list({ ...a, ...changes }), forbidden);
      }
    });

    await t.test("single memory clearing erases content but preserves source uniqueness and unrelated accounts", async () => {
      const a = await student(), b = await student();
      const own = await memory(a), foreign = await memory(b);
      const source = (await pool.query("select * from agent_context_candidates where id = $1", [own.sourceCandidateId])).rows[0];
      assert.equal(source.summary, "");
      assert.deepEqual(source.structured_json, {});
      assert.ok(source.payload_cleared_at);
      const before = await snapshotAuditedBusinessTables(pool);
      assert.deepEqual(await management.clearOne(a, foreign.id), { cleared: false });
      assert.deepEqual(await management.clearOne(a, randomUUID()), { cleared: false });
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      assert.deepEqual(await management.clearOne(a, own.id), { cleared: true });
      const cleared = (await pool.query("select * from agent_memory_entries where id = $1", [own.id])).rows[0];
      assert.ok(cleared.cleared_at);
      assert.equal(cleared.summary, "");
      assert.deepEqual(cleared.structured_json, {});
      assert.equal(cleared.source_candidate_id, own.sourceCandidateId);
      assert.deepEqual(await management.clearOne(a, own.id), { cleared: false });
      await assert.rejects(contextService.acceptCandidateAsMemory(a, own.sourceCandidateId), unavailable);
      assert.equal((await management.list(b)).items[0].id, foreign.id);
    });

    await t.test("clearing legacy memory scrubs its confirmed source without crossing source ownership", async () => {
      for (const mode of ["one", "all"]) {
        const a = await student(), b = await student();
        const visitor = await guestCandidate(a);
        const own = await contextService.carryForwardGuestCandidateToStudentMemory(a, visitor.id);
        const foreign = await memory(b);
        await pool.query("update agent_context_candidates set payload_cleared_at = null, summary = 'LEGACY_PRIVATE_BODY', structured_json = '{\"private\":\"LEGACY_PRIVATE_BODY\"}'::jsonb where id = any($1::uuid[])", [[visitor.id, foreign.sourceCandidateId]]);
        if (mode === "one") await management.clearOne(a, own.id); else await management.clearAll(a, { expectedRevision: 0 });
        const cleared = (await pool.query("select summary, structured_json, payload_cleared_at from agent_context_candidates where id = $1", [visitor.id])).rows[0];
        assert.equal(cleared.summary, "");
        assert.deepEqual(cleared.structured_json, {});
        assert.ok(cleared.payload_cleared_at);
        assert.equal((await pool.query("select summary from agent_context_candidates where id = $1", [foreign.sourceCandidateId])).rows[0].summary, "LEGACY_PRIVATE_BODY");
        const mislinked = await memory(a), foreignSource = await contextService.proposeCandidate(b, input);
        await pool.query("update agent_context_candidates set status = 'accepted', accepted_at = clock_timestamp(), summary = 'FOREIGN_SOURCE_MARKER' where id = $1", [foreignSource.id]);
        await pool.query("update agent_memory_entries set source_candidate_id = $2 where id = $1", [mislinked.id, foreignSource.id]);
        await management.clearOne(a, mislinked.id);
        assert.equal((await pool.query("select summary from agent_context_candidates where id = $1", [foreignSource.id])).rows[0].summary, "FOREIGN_SOURCE_MARKER");
      }
    });

    await t.test("clear-all resets only student memory and prevents older or exact-boundary guest candidates returning", async () => {
      const a = await student(), b = await student();
      const own = await memory(a), foreign = await memory(b);
      const pending = await contextService.proposeCandidate(a, input), visitor = await guestCandidate(a);
      const { rows: [otherPersona] } = await pool.query(`insert into agent_memory_entries (user_id, memory_type, context_scope, active_role, memory_namespace, data_class, confidence, summary, source)
        values ($1::uuid, 'work_summary', 'ops_audit', 'cuac_ops', 'ops:' || $1::uuid::text || ':audit', 'ops_confidential', 'user_confirmed', 'OTHER_PERSONA_MARKER', 'script') returning id`, [a.actorUserId]);
      assert.deepEqual(await management.clearAll(a, { expectedRevision: 0 }), { enabled: true, revision: 1, clearedCount: 1, clearedCandidateCount: 1 });
      assert.equal((await management.list(a)).items.length, 0);
      assert.equal((await pool.query("select summary from agent_memory_entries where id = $1", [otherPersona.id])).rows[0].summary, "OTHER_PERSONA_MARKER");
      assert.equal((await management.list(b)).items[0].id, foreign.id);
      await assert.rejects(contextService.acceptCandidateAsMemory(a, pending.id), unavailable);
      await assert.rejects(contextService.carryForwardGuestCandidateToStudentMemory(a, visitor.id), unavailable);
      await pool.query("update agent_context_candidates set created_at = (select reset_at from agent_student_memory_settings where user_id = $2) where id = $1", [visitor.id, a.actorUserId]);
      await assert.rejects(contextService.carryForwardGuestCandidateToStudentMemory(a, visitor.id), unavailable);
      const fresh = await guestCandidate(a);
      assert.equal((await contextService.carryForwardGuestCandidateToStudentMemory(a, fresh.id)).userId, a.actorUserId);
      assert.equal((await pool.query("select cleared_at from agent_memory_entries where id = $1", [own.id])).rows[0].cleared_at instanceof Date, true);
    });

    await t.test("opt-out blocks persistence and re-enabling does not resurrect old candidates", async () => {
      const a = await student();
      await memory(a);
      const old = await guestCandidate(a);
      assert.deepEqual(await management.setEnabled(a, { enabled: false, expectedRevision: 0 }), { enabled: false, revision: 1 });
      assert.deepEqual((await management.list(a)).items, []);
      assert.equal((await management.list(a)).enabled, false);
      await assert.rejects(contextService.proposeCandidate(a, input), forbidden);
      await assert.rejects(contextService.carryForwardGuestCandidateToStudentMemory(a, old.id), forbidden);
      const duringOptOut = await guestCandidate(a);
      await management.clearAll(a, { expectedRevision: 1 });
      assert.equal((await management.list(a)).enabled, false);
      await management.setEnabled(a, { enabled: true, expectedRevision: 2 });
      for (const candidate of [old, duringOptOut]) await assert.rejects(contextService.carryForwardGuestCandidateToStudentMemory(a, candidate.id), unavailable);
      assert.equal((await memory(a)).userId, a.actorUserId);
    });

    await t.test("memory policy rejects disabled accounts and revoked student roles at the database boundary", async () => {
      for (const change of ["account", "role"]) {
        const a = await student();
        const candidate = await contextService.proposeCandidate(a, input);
        if (change === "account") await pool.query("update users set account_status = 'disabled' where id = $1", [a.actorUserId]);
        else await pool.query("update user_roles set revoked_at = clock_timestamp() where user_id = $1", [a.actorUserId]);
        await assert.rejects(management.clearAll(a, { expectedRevision: 0 }), forbidden);
        await assert.rejects(management.list(a), forbidden);
        await assert.rejects(contextService.acceptCandidateAsMemory(a, candidate.id), forbidden);
      }
    });

    await t.test("memory management audit faults roll back clears, reset cutoffs and opt-out settings", async () => {
      for (const action of ["agent.memory.list", "agent.memory.clear", "agent.memory.clear_all", "agent.memory.preference.update"]) {
        const a = await student(), own = await memory(a);
        await contextService.proposeCandidate(a, input);
        const work = () => action === "agent.memory.list" ? management.list(a) : action === "agent.memory.clear" ? management.clearOne(a, own.id)
          : action === "agent.memory.clear_all" ? management.clearAll(a, { expectedRevision: 0 }) : management.setEnabled(a, { enabled: false, expectedRevision: 0 });
        const before = await snapshotAuditedBusinessTables(pool);
        await faults.during(action, () => assert.rejects(work(), (e) => e.code === "P0001"));
        assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
        await work();
      }
    });

    for (const operation of ["clear", "disable"]) {
      await t.test(`memory ${operation} and confirmation serialize safely in both account-lock orders`, async () => {
        for (const first of ["confirm", "control"]) {
          const a = await student();
          const candidate = await guestCandidate(a);
          const gate = gatedClient((sql) => sql.startsWith("select id from users"));
          const scopedContext = createPostgresAgentContextService(gate.client), scopedManagement = createPostgresAgentMemoryManagementService(gate.client);
          const control = (svc) => operation === "clear" ? svc.clearAll(a, { expectedRevision: 0 }) : svc.setEnabled(a, { enabled: false, expectedRevision: 0 });
          const firstRun = first === "confirm" ? scopedContext.carryForwardGuestCandidateToStudentMemory(a, candidate.id) : control(scopedManagement);
          const firstSettled = Promise.allSettled([firstRun]);
          let secondSettled;
          try {
            await gate.ready;
            secondSettled = Promise.allSettled([first === "confirm" ? control(management) : contextService.carryForwardGuestCandidateToStudentMemory(a, candidate.id)]);
            await waitForWaiter();
          } finally { gate.release(); }
          assert.equal((await firstSettled)[0].status, "fulfilled");
          const second = (await secondSettled)[0];
          assert.equal(second.status, first === "confirm" ? "fulfilled" : "rejected");
          if (second.status === "rejected") assert.equal(second.reason.status, operation === "clear" ? 400 : 403);
          assert.equal((await management.list(a)).items.length, 0);
          assert.equal((await pool.query("select count(*)::int as n from agent_memory_entries where user_id = $1 and cleared_at is null", [a.actorUserId])).rows[0].n, 0);
        }
      });
    }

    await t.test("candidate sweep is bounded, erases terminal payloads and rolls back when audit is unavailable", async () => {
      for (let i = 0; i < 20; i += 1) if (!(await sweepAgentCandidates(client, 500)).clearedCandidateCount) break;
      const a = await student();
      const expired = [];
      for (let i = 0; i < 5; i += 1) expired.push((await guestCandidate(a)).id);
      const live = await guestCandidate(a);
      await pool.query("update agent_context_candidates set expires_at = clock_timestamp() - interval '1 second' where id = any($1::uuid[])", [expired]);
      const before = await snapshotAuditedBusinessTables(pool);
      for (const size of [0, 501, 1.5]) await assert.rejects(sweepAgentCandidates(client, size), (e) => e.status === 400);
      await faults.during("agent.context_candidates.sweep", () => assert.rejects(sweepAgentCandidates(client, 2), (e) => e.code === "P0001"));
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      const counts = await Promise.all([sweepAgentCandidates(client, 2), sweepAgentCandidates(client, 2)]);
      assert.equal(counts.reduce((sum, row) => sum + row.clearedCandidateCount, 0), 4);
      assert.equal((await sweepAgentCandidates(client, 2)).clearedCandidateCount, 1);
      assert.equal((await sweepAgentCandidates(client, 2)).clearedCandidateCount, 0);
      const rows = (await pool.query("select * from agent_context_candidates where id = any($1::uuid[])", [expired])).rows;
      assert.ok(rows.every((r) => r.status === "expired" && r.summary === "" && r.anonymous_session_hash === null && r.payload_cleared_at));
      assert.ok(rows.every((r) => Object.keys(r.structured_json).length === 0 && r.source_entity_ids_json.length === 0));
      assert.equal((await pool.query("select payload_cleared_at from agent_context_candidates where id = $1", [live.id])).rows[0].payload_cleared_at, null);
      const audit = (await pool.query("select active_role, actor_user_id, metadata_json from audit_logs where action = 'agent.context_candidates.sweep' order by created_at desc limit 1")).rows[0];
      assert.equal(audit.active_role, "system");
      assert.equal(audit.actor_user_id, null);
      assert.deepEqual(Object.keys(audit.metadata_json), ["clearedCandidateCount"]);
    });

    await t.test("candidate sweep skips a confirming row and expiry still prevents a late memory write", async () => {
      const a = await student(), candidate = await guestCandidate(a);
      await pool.query("update agent_context_candidates set expires_at = clock_timestamp() + interval '1.2 seconds' where id = $1", [candidate.id]);
      const gate = gatedClient((sql) => sql.includes("from agent_context_candidates") && sql.includes("for update"));
      const work = Promise.allSettled([createPostgresAgentContextService(gate.client).carryForwardGuestCandidateToStudentMemory(a, candidate.id)]);
      try {
        await gate.ready;
        for (let i = 0; i < 200; i += 1) {
          if ((await pool.query("select expires_at <= clock_timestamp() as expired from agent_context_candidates where id = $1", [candidate.id])).rows[0].expired) break;
          await delay(10);
        }
        await sweepAgentCandidates(client, 500);
        assert.equal((await pool.query("select payload_cleared_at from agent_context_candidates where id = $1", [candidate.id])).rows[0].payload_cleared_at, null);
      } finally { gate.release(); }
      const result = (await work)[0];
      assert.equal(result.status, "rejected");
      assert.equal(result.reason.status, 400);
      await sweepAgentCandidates(client, 500);
      assert.ok((await pool.query("select payload_cleared_at from agent_context_candidates where id = $1", [candidate.id])).rows[0].payload_cleared_at);
      assert.equal((await pool.query("select count(*)::int as n from agent_memory_entries where source_candidate_id = $1", [candidate.id])).rows[0].n, 0);
    });

    await t.test("confirmed student memories receive a finite database-clock retention ceiling", async () => {
      const a = await student(), own = await memory(a);
      const row = (await pool.query(`select extract(epoch from (expires_at - created_at))::int as seconds
        from agent_memory_entries where id = $1`, [own.id])).rows[0];
      assert.equal(row.seconds, 365 * 24 * 60 * 60);
      for (const expression of ["null", "'infinity'::timestamptz", "created_at + interval '366 days'"]) {
        await assert.rejects(pool.query(`update agent_memory_entries set expires_at = ${expression} where id = $1`, [own.id]),
          error => error.code === "23514" && error.constraint === "agent_memory_entries_student_retention_check");
      }
      assert.equal((await pool.query("select expires_at is not null and isfinite(expires_at) as valid from agent_memory_entries where id = $1", [own.id])).rows[0].valid, true);
    });

    await t.test("expired-memory sweep is bounded, tenant-safe and atomic with its audit", async () => {
      for (let i = 0; i < 20; i += 1) if (!(await sweepExpiredStudentMemories(client, 500)).clearedMemoryCount) break;
      const a = await student(), b = await student();
      const expired = [await memory(a), await memory(b)], live = await memory(a);
      await pool.query("update agent_memory_entries set expires_at = clock_timestamp() - interval '1 second' where id = any($1::uuid[])", [expired.map(row => row.id)]);
      await pool.query(`update agent_context_candidates set payload_cleared_at = null, summary = 'LEGACY_RETENTION_MARKER',
        structured_json = '{"degreeLevel":"master"}'::jsonb where id = any($1::uuid[])`, [expired.map(row => row.sourceCandidateId)]);
      const otherPersona = (await pool.query(`insert into agent_memory_entries
        (user_id,memory_type,context_scope,active_role,memory_namespace,data_class,confidence,summary,source,expires_at)
        values ($1::uuid,'work_summary','ops_audit','cuac_ops','ops:' || ($1::uuid)::text || ':audit','ops_confidential',
          'user_confirmed','OPS_RETENTION_MARKER','script',clock_timestamp() - interval '1 second') returning id`, [a.actorUserId])).rows[0];
      const before = await snapshotAuditedBusinessTables(pool);
      for (const size of [0, 501, 1.5]) await assert.rejects(sweepExpiredStudentMemories(client, size), error => error.status === 400);
      await faults.during("agent.memories.retention_sweep", () => assert.rejects(sweepExpiredStudentMemories(client, 1), error => error.code === "P0001"));
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      const counts = await Promise.all([sweepExpiredStudentMemories(client, 1), sweepExpiredStudentMemories(client, 1)]);
      assert.equal(counts.reduce((sum, row) => sum + row.clearedMemoryCount, 0), 2);
      assert.equal(counts.reduce((sum, row) => sum + row.clearedCandidateCount, 0), 2);
      assert.equal((await sweepExpiredStudentMemories(client, 10)).clearedMemoryCount, 0);
      const rows = (await pool.query("select id,summary,structured_json,source,cleared_at from agent_memory_entries where id = any($1::uuid[])", [expired.map(row => row.id)])).rows;
      assert.ok(rows.every(row => row.summary === "" && Object.keys(row.structured_json).length === 0
        && row.source === "retention_expired" && row.cleared_at instanceof Date));
      const sources = (await pool.query("select summary,structured_json,payload_cleared_at from agent_context_candidates where id = any($1::uuid[])", [expired.map(row => row.sourceCandidateId)])).rows;
      assert.ok(sources.every(row => row.summary === "" && Object.keys(row.structured_json).length === 0 && row.payload_cleared_at instanceof Date));
      assert.equal((await pool.query("select cleared_at from agent_memory_entries where id = $1", [live.id])).rows[0].cleared_at, null);
      assert.equal((await pool.query("select summary from agent_memory_entries where id = $1", [otherPersona.id])).rows[0].summary, "OPS_RETENTION_MARKER");
      const audit = (await pool.query("select active_role,actor_user_id,metadata_json from audit_logs where action = 'agent.memories.retention_sweep' order by created_at desc limit 1")).rows[0];
      assert.equal(audit.active_role, "system"); assert.equal(audit.actor_user_id, null);
      assert.deepEqual(audit.metadata_json, { clearedMemoryCount: 1, clearedCandidateCount: 1, retentionDays: 365 });
    });

    await t.test("memory controls require a student action even when the Agent has student data authority", async () => {
      const a = await student(), own = await memory(a), before = await snapshotAuditedBusinessTables(pool);
      for (const changes of [{ purpose: "agent_tool" }, { selectedSurface: "public" }, { authStrength: "guest" }]) {
        const ctx = { ...a, ...changes };
        for (const run of [() => management.list(ctx), () => management.clearOne(ctx, own.id),
          () => management.clearAll(ctx, { expectedRevision: 0 }), () => management.setEnabled(ctx, { enabled: false, expectedRevision: 0 })]) {
          await assert.rejects(run(), forbidden);
        }
      }
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    });

    await t.test("concurrent memory controls accept one version and old retries cannot clear newly confirmed content", async () => {
      const a = await student(); await memory(a);
      const gate = gatedClient(sql => sql.startsWith("select id from users"));
      const first = createPostgresAgentMemoryManagementService(gate.client).clearAll(a, { expectedRevision: 0 });
      first.catch(() => {}); let second;
      try {
        const pid = await gate.ready;
        second = management.setEnabled(a, { enabled: false, expectedRevision: 0 }); second.catch(() => {});
        await blockedBy(pid, "select id from users%"); gate.release();
        assert.equal((await first).revision, 1);
        await assert.rejects(second, e => e.status === 409);
      } finally { gate.release(); await Promise.allSettled([first, second]); }
      const fresh = await memory(a), before = await snapshotAuditedBusinessTables(pool);
      await assert.rejects(management.clearAll(a, { expectedRevision: 0 }), e => e.status === 409);
      await assert.rejects(management.setEnabled(a, { enabled: true, expectedRevision: 0 }), e => e.status === 409);
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      const current = await management.list(a);
      assert.equal(current.revision, 1); assert.deepEqual(current.items.map(row => row.id), [fresh.id]);
      assert.deepEqual(await management.setEnabled(a, { enabled: false, expectedRevision: 1 }), { enabled: false, revision: 2 });
      await assert.rejects(management.setEnabled(a, { enabled: true, expectedRevision: 1 }), e => e.status === 409);
    });

    await t.test("memory keyset pages preserve microseconds, skip unsafe payloads, and accept a cleared owned cursor", async () => {
      const a = await student(), b = await student(), all = [];
      for (let i = 0; i < 5; i++) all.push(await memory(a));
      const foreign = await memory(b);
      for (let i = 0; i < all.length; i++) await pool.query("update agent_memory_entries set created_at = '2026-08-31 12:00:00+00'::timestamptz + ($2::int * interval '1 microsecond'), expires_at = '2026-08-31 12:00:00+00'::timestamptz + ($2::int * interval '1 microsecond') + interval '365 days' where id = $1", [all[i].id, i]);
      await pool.query("update agent_memory_entries set structured_json = '{\"private\":\"DO_NOT_RETURN\"}' where id = $1", [all[4].id]);
      const first = await management.list(a, { limit: 1 });
      assert.deepEqual(first.items, []); assert.equal(first.nextCursor, all[4].id);
      await management.clearOne(a, first.nextCursor);
      const seen = []; let cursor = first.nextCursor;
      while (cursor) {
        const page = await management.list(a, { limit: 1, cursor });
        seen.push(...page.items.map(row => row.id)); cursor = page.nextCursor;
        assert.ok(seen.length <= 4);
      }
      assert.deepEqual(seen, all.slice(0, 4).reverse().map(row => row.id));
      await assert.rejects(management.list(a, { cursor: foreign.id }), e => e.status === 400);
      await assert.rejects(management.list(a, { cursor: randomUUID() }), e => e.status === 400);
      await pool.query("update agent_memory_entries set created_at = '2026-08-31 12:00:00+00', expires_at = '2026-08-31 12:00:00+00'::timestamptz + interval '365 days' where user_id = $1", [a.actorUserId]);
      const tied = await management.list(a, { limit: 2 });
      const rest = await management.list(a, { limit: 2, cursor: tied.nextCursor });
      assert.deepEqual([...tied.items, ...rest.items].map(row => row.id), all.slice(0, 4).map(row => row.id).sort().reverse());
    });

    await t.test("confirmed-memory quota includes expired and unsafe entries and serializes the last slot", async () => {
      const a = await student();
      await pool.query(`insert into agent_memory_entries (user_id, memory_type, context_scope, active_role, memory_namespace, data_class, confidence, summary, structured_json, source, expires_at)
        select $1::uuid, 'study_goal', 'student_account', 'student', 'user:' || $1::uuid::text || ':student', 'low_sensitive_preference', 'user_confirmed', '', '{}', 'synthetic', clock_timestamp() - interval '1 second' from generate_series(1,99)`, [a.actorUserId]);
      const candidates = [await guestCandidate(a), await guestCandidate(a)];
      const gate = gatedClient(sql => sql.startsWith("select id from users"));
      const first = createPostgresAgentContextService(gate.client).carryForwardGuestCandidateToStudentMemory(a, candidates[0].id); first.catch(() => {});
      let second;
      try {
        const pid = await gate.ready;
        second = contextService.carryForwardGuestCandidateToStudentMemory(a, candidates[1].id); second.catch(() => {});
        await blockedBy(pid, "select id from users%"); gate.release();
        const accepted = await first;
        await assert.rejects(second, e => e.status === 409);
        const page = await management.list(a);
        assert.equal(page.storedCount, 100); assert.equal(page.items.length, 1);
        assert.equal((await pool.query("select status from agent_context_candidates where id = $1", [candidates[1].id])).rows[0].status, "proposed");
        await management.clearOne(a, accepted.id);
        assert.ok((await contextService.carryForwardGuestCandidateToStudentMemory(a, candidates[1].id)).id);
        assert.equal((await management.clearAll(a, { expectedRevision: 0 })).clearedCount, 100);
        assert.equal((await management.list(a)).storedCount, 0);
      } finally { gate.release(); await Promise.allSettled([first, second]); }
    });

    for (const commit of [true, false]) await t.test(`memory controls wait for role revocation ${commit ? "commit" : "rollback"}`, async () => {
      const a = await student(); await memory(a);
      const blocker = await pool.connect(); let pending;
      try {
        await blocker.query("begin");
        await blocker.query("update user_roles set revoked_at = clock_timestamp() where user_id = $1", [a.actorUserId]);
        pending = management.clearAll(a, { expectedRevision: 0 }); pending.catch(() => {});
        await blockedBy(blocker.processID, "select id from user_roles%");
        await blocker.query(commit ? "commit" : "rollback");
        if (commit) {
          await assert.rejects(pending, forbidden);
          assert.equal((await pool.query("select count(*)::int as n from agent_student_memory_settings where user_id = $1", [a.actorUserId])).rows[0].n, 0);
          assert.equal((await pool.query("select count(*)::int as n from agent_memory_entries where user_id = $1 and cleared_at is null", [a.actorUserId])).rows[0].n, 1);
        } else assert.equal((await pending).revision, 1);
      } finally { await blocker.query("rollback"); blocker.release(); await Promise.allSettled([pending]); }
    });

    await t.test("role revocation waits for an authorized memory transaction to commit or roll back", async () => {
      for (const fail of [false, true]) {
        const a = await student(); await memory(a);
        const gate = gatedClient(sql => sql.startsWith("select id from user_roles")), blocker = await pool.connect();
        let pending, revoke;
        const work = async () => {
          pending = createPostgresAgentMemoryManagementService(gate.client).clearAll(a, { expectedRevision: 0 }); pending.catch(() => {});
          const pid = await gate.ready;
          await blocker.query("begin");
          revoke = blocker.query("update user_roles set revoked_at = clock_timestamp() where user_id = $1", [a.actorUserId]); revoke.catch(() => {});
          await blockedBy(pid, "update user_roles%"); gate.release();
          if (fail) await assert.rejects(pending, e => e.code === "P0001"); else assert.equal((await pending).revision, 1);
          await revoke; await blocker.query("commit");
          assert.equal((await pool.query("select count(*)::int as n from agent_memory_entries where user_id = $1 and cleared_at is null", [a.actorUserId])).rows[0].n, fail ? 1 : 0);
        };
        try { if (fail) await faults.during("agent.memory.clear_all", work); else await work(); }
        finally { gate.release(); await Promise.allSettled([pending, revoke]); await blocker.query("rollback"); blocker.release(); }
      }
    });

    await t.test("lost memory-control commit acknowledgement never retries or clears a later confirmation", async () => {
      const a = await student(); await memory(a); let commits = 0, discarded = false;
      const uncertain = createTransactionalSqlClient({ query: pool.query.bind(pool), async connect() {
        const connection = await pool.connect();
        return { async query(sql, params) {
          const result = await connection.query(sql, params);
          if (sql === "commit") { commits++; throw new Error("Synthetic lost memory COMMIT acknowledgement"); }
          return result;
        }, release(destroy) { discarded = destroy; connection.release(destroy); } };
      } });
      await assert.rejects(createPostgresAgentMemoryManagementService(uncertain).clearAll(a, { expectedRevision: 0 }), /Synthetic lost memory COMMIT acknowledgement/);
      assert.equal(commits, 1); assert.equal(discarded, true);
      const fresh = await memory(a), before = await snapshotAuditedBusinessTables(pool);
      await assert.rejects(management.clearAll(a, { expectedRevision: 0 }), e => e.status === 409);
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      const current = await management.list(a);
      assert.equal(current.revision, 1); assert.deepEqual(current.items.map(row => row.id), [fresh.id]);
    });

    await t.test("account deletion cascades student memory settings without deleting another student's controls", async () => {
      const a = await student(), b = await student();
      await management.setEnabled(a, { enabled: false, expectedRevision: 0 });
      await management.setEnabled(b, { enabled: false, expectedRevision: 0 });
      await pool.query("delete from users where id = $1", [a.actorUserId]);
      assert.equal((await pool.query("select count(*)::int as n from agent_student_memory_settings where user_id = $1", [a.actorUserId])).rows[0].n, 0);
      assert.equal((await pool.query("select enabled from agent_student_memory_settings where user_id = $1", [b.actorUserId])).rows[0].enabled, false);
    });
  } finally { await faults.close(); }
}
