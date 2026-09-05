import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { createPostgresAgentContextService } from "../../../src/server/agent/http.ts";
import { GUEST_AGENT_CANDIDATE_CAPACITY, STUDENT_AGENT_CANDIDATE_CAPACITY } from "../../../src/server/agent/candidate-policy.ts";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { createAuditFailureFixture, snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";

const input = { candidateType: "study_goal", structured: { degreeLevel: "master", subjectAreas: ["computer_science"] } };
const unavailable = (error) => error.status === 400 && error.message === "Agent context candidate is not available for confirmation.";

export async function runAgentContextRehearsal(t, pool) {
  const service = createPostgresAgentContextService(createTransactionalSqlClient(pool));
  const faults = await createAuditFailureFixture(pool);
  const guest = () => createRequestContext({ guestSessionId: `sha256:${randomUUID()}`, purpose: "agent_tool" });
  async function student(guestSessionId = null) {
    const email = `agent-${randomUUID()}@example.invalid`;
    const { rows: [user] } = await pool.query("insert into users (email, email_normalized) values ($1, $1) returning id", [email]);
    await pool.query("insert into user_roles (user_id, role) values ($1, 'student')", [user.id]);
    return createRequestContext({ actorUserId: user.id, activeRole: "student", selectedSurface: "student", guestSessionId, purpose: "agent_tool" });
  }
  async function fixture(mode) {
    const visitor = guest();
    const context = await student(visitor.guestSessionId);
    const candidate = await service.proposeCandidate(mode === "guest" ? visitor : context, input);
    const confirm = (ctx = context, now) => mode === "guest"
      ? service.carryForwardGuestCandidateToStudentMemory(ctx, candidate.id, now)
      : service.acceptCandidateAsMemory(ctx, candidate.id, now);
    return { context, candidate, confirm };
  }
  async function auditRollbackThenRetry(action, context, work) {
    const before = await snapshotAuditedBusinessTables(pool);
    await faults.during(action, () => assert.rejects(work(), (error) => error.code === "P0001"));
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    const result = await work();
    const audits = (await pool.query("select * from audit_logs where action = $1 and request_id = $2", [action, context.requestId])).rows;
    assert.equal(audits.length, 1);
    assert.equal(audits[0].allowed, true);
    assert.equal(audits[0].resource_id, result.id);
    return result;
  }
  async function waitForLockWaiters(count) {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const { rows: [row] } = await pool.query("select count(*)::int as n from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock' and (query like '%agent_context_candidates%' or query like '%from users%' or query like '%pg_advisory_xact_lock%') and state = 'active'");
      if (row.n >= count) return;
      await delay(10);
    }
    assert.fail(`Expected ${count} actual PostgreSQL lock waiters.`);
  }
  async function race(candidate, contenders) {
    const blocker = await pool.connect();
    let settled;
    try {
      await blocker.query("begin");
      await blocker.query("select id from agent_context_candidates where id = $1 for update", [candidate.id]);
      settled = Promise.allSettled(contenders.map((work) => work()));
      await waitForLockWaiters(contenders.length);
      await blocker.query("commit");
      return await settled;
    } finally {
      await blocker.query("rollback");
      blocker.release();
      if (settled) await settled;
    }
  }
  try {
    await t.test("Agent creation uses database wall-clock timestamps and caps TTL despite application clock skew", async () => {
      for (const context of [guest(), await student()]) {
        const candidate = await service.proposeCandidate(context, input, new Date("2099-01-01"));
        const { rows: [stored] } = await pool.query("select created_at, expires_at, created_at <= clock_timestamp() as not_future from agent_context_candidates where id = $1", [candidate.id]);
        assert.equal(stored.not_future, true);
        const ttl = context.activeRole === "guest" ? 24 * 3600_000 : 7 * 24 * 3600_000;
        assert.equal(stored.expires_at.getTime() - stored.created_at.getTime(), ttl);
        assert.equal(candidate.expiresAt.getTime(), stored.expires_at.getTime());
      }
    });

    await t.test("Agent pending-candidate quotas are owner-scoped, expiry-aware and concurrency-safe", async () => {
      const propose = (context) => service.proposeCandidate({ ...context, requestId: randomUUID() }, input);
      const visitor = guest();
      const guestCandidates = [];
      for (let i = 0; i < GUEST_AGENT_CANDIDATE_CAPACITY; i += 1) guestCandidates.push(await propose(visitor));
      const deniedGuest = { ...visitor, requestId: randomUUID() };
      await assert.rejects(service.proposeCandidate(deniedGuest, input), (error) => error.status === 429 && error.code === "TOO_MANY_REQUESTS");
      assert.deepEqual((await pool.query("select allowed, metadata_json from audit_logs where request_id = $1", [deniedGuest.requestId])).rows,
        [{ allowed: false, metadata_json: { deniedCode: "TOO_MANY_REQUESTS" } }]);
      assert.ok((await propose(guest())).id, "A different verified guest binding has independent capacity.");
      await pool.query("update agent_context_candidates set expires_at = clock_timestamp() - interval '1 second' where id = $1", [guestCandidates[0].id]);
      assert.ok((await propose(visitor)).id, "An expired proposal no longer occupies active capacity.");

      const learner = await student();
      for (let i = 0; i < STUDENT_AGENT_CANDIDATE_CAPACITY; i += 1) await propose(learner);
      await assert.rejects(propose(learner), (error) => error.status === 429 && error.code === "TOO_MANY_REQUESTS");
      assert.ok((await propose(await student())).id, "A different student account has independent capacity.");

      const raceVisitor = guest();
      for (let i = 0; i < GUEST_AGENT_CANDIDATE_CAPACITY - 1; i += 1) await propose(raceVisitor);
      const blocker = await pool.connect();
      let settled;
      try {
        await blocker.query("begin");
        await blocker.query("select pg_advisory_xact_lock(hashtextextended('guest:' || $1, 0))", [raceVisitor.guestSessionId]);
        settled = Promise.allSettled([propose(raceVisitor), propose(raceVisitor)]);
        await waitForLockWaiters(2);
        await blocker.query("commit");
        const results = await settled;
        assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
        assert.equal(results.filter((result) => result.status === "rejected" && result.reason.status === 429).length, 1);
        const active = (await pool.query(`select count(*)::int as count from agent_context_candidates
          where anonymous_session_hash = $1 and context_scope = 'guest_page' and active_role = 'guest'
            and status = 'proposed' and payload_cleared_at is null and expires_at > clock_timestamp()`, [raceVisitor.guestSessionId])).rows[0].count;
        assert.equal(active, GUEST_AGENT_CANDIDATE_CAPACITY);
      } finally {
        await blocker.query("rollback");
        blocker.release();
        if (settled) await settled;
      }
    });

    await t.test("Agent guest and account candidate creation roll back on success audit failure", async () => {
      for (const context of [guest(), await student()]) {
        await auditRollbackThenRetry("agent.context_candidate.create", context, () => service.proposeCandidate(context, input));
      }
    });

    for (const mode of ["guest", "student"]) {
      const action = mode === "guest" ? "agent.memory.carry_forward" : "agent.memory.create";
      await t.test(`Agent ${mode} confirmation rolls back consumption and memory on audit failure`, async () => {
        const { context, candidate, confirm } = await fixture(mode);
        const memory = await auditRollbackThenRetry(action, context, confirm);
        assert.equal(memory.userId, context.actorUserId);
        assert.equal(memory.memoryNamespace, `user:${context.actorUserId}:student`);
        assert.equal(memory.confidence, "user_confirmed");
        const stored = (await pool.query("select status, accepted_at from agent_context_candidates where id = $1", [candidate.id])).rows[0];
        assert.equal(stored.status, "accepted");
        assert.ok(stored.accepted_at instanceof Date);
        await assert.rejects(confirm(), unavailable);
      });

      await t.test(`Agent ${mode} simultaneous confirmations create one memory and one success audit`, async () => {
        const { context, candidate, confirm } = await fixture(mode);
        const results = await race(candidate, [() => confirm(), () => confirm({ ...context, requestId: randomUUID() })]);
        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        assert.equal(results.filter((r) => r.status === "rejected" && unavailable(r.reason)).length, 1);
        assert.equal((await pool.query("select count(*)::int as n from agent_memory_entries where source_candidate_id = $1", [candidate.id])).rows[0].n, 1);
        assert.equal((await pool.query("select count(*)::int as n from audit_logs where action = $1 and metadata_json->>'sourceCandidateId' = $2", [action, candidate.id])).rows[0].n, 1);
      });

      await t.test(`Agent ${mode} expiry is checked again after a real lock wait using database time`, async () => {
        const { candidate, confirm } = await fixture(mode);
        await pool.query("update agent_context_candidates set expires_at = clock_timestamp() + interval '1.2 seconds' where id = $1", [candidate.id]);
        const before = await snapshotAuditedBusinessTables(pool);
        const blocker = await pool.connect();
        let settled;
        try {
          await blocker.query("begin");
          await blocker.query("select id from agent_context_candidates where id = $1 for update", [candidate.id]);
          // A stale application clock must not extend candidate validity.
          settled = Promise.allSettled([confirm(undefined, new Date("2000-01-01"))]);
          await waitForLockWaiters(1);
          let expired = false;
          for (let attempt = 0; attempt < 200; attempt += 1) {
            expired = (await pool.query("select expires_at <= clock_timestamp() as expired from agent_context_candidates where id = $1", [candidate.id])).rows[0].expired;
            if (expired) break;
            await delay(10);
          }
          assert.equal(expired, true, "The database deadline elapsed while the request was blocked.");
          await blocker.query("commit");
          const [result] = await settled;
          assert.equal(result.status, "rejected");
          assert.ok(unavailable(result.reason));
          assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
        } finally {
          await blocker.query("rollback");
          blocker.release();
          if (settled) await settled;
        }
      });
    }

    await t.test("Agent validation denial survives business rollback without content or a false success event", async () => {
      const context = guest();
      const marker = "PRIVATE_AGENT_DENIAL_MARKER";
      const before = await snapshotAuditedBusinessTables(pool);
      await assert.rejects(service.proposeCandidate(context, { ...input, summary: marker }), (error) => error.status === 400);
      const after = await snapshotAuditedBusinessTables(pool);
      const audits = after.audit_logs.filter((row) => row.request_id === context.requestId);
      assert.equal(audits.length, 1);
      assert.equal(audits[0].allowed, false);
      assert.deepEqual(audits[0].metadata_json, { deniedCode: "BAD_REQUEST" });
      assert.doesNotMatch(JSON.stringify(audits), /PRIVATE_AGENT_DENIAL_MARKER/);
      delete before.audit_logs; delete after.audit_logs;
      assert.deepEqual(after, before);
    });

    await t.test("Agent copied guest binding raced by two accounts can be consumed only once", async () => {
      const { context, candidate, confirm } = await fixture("guest");
      const other = await student(context.guestSessionId);
      const results = await race(candidate, [() => confirm(), () => confirm(other)]);
      const winner = results.find((r) => r.status === "fulfilled").value;
      assert.ok([context.actorUserId, other.actorUserId].includes(winner.userId));
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.ok(unavailable(results.find((r) => r.status === "rejected").reason));
      const memories = (await pool.query("select user_id from agent_memory_entries where source_candidate_id = $1", [candidate.id])).rows;
      assert.deepEqual(memories, [{ user_id: winner.userId }]);
    });

    await t.test("Agent SQL scopes candidate reads by account, guest binding, role, namespace and tenant", async () => {
      const own = await fixture("student");
      const visitor = await fixture("guest");
      const other = await student(`sha256:${randomUUID()}`);
      const before = await snapshotAuditedBusinessTables(pool);
      await assert.rejects(own.confirm(other), unavailable);
      await assert.rejects(visitor.confirm(other), unavailable);
      await assert.rejects(service.acceptCandidateAsMemory(own.context, visitor.candidate.id), unavailable);
      await assert.rejects(service.carryForwardGuestCandidateToStudentMemory(visitor.context, own.candidate.id), unavailable);
      await assert.rejects(service.acceptCandidateAsMemory(own.context, randomUUID()), unavailable);
      for (const changes of [{ activeRole: "guest" }, { activeRole: "school_staff" }, { activeRole: "cuac_admin" }, { tenantSchoolId: randomUUID() }, { dataClassAllowlist: ["public_catalog"] }]) {
        await assert.rejects(own.confirm({ ...own.context, ...changes }), (error) => error.status === 403);
        await assert.rejects(visitor.confirm({ ...visitor.context, ...changes }), (error) => error.status === 403);
      }
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      const variants = [
        "memory_namespace = 'wrong-namespace'", "active_role = 'cuac_ops'", "anonymous_session_hash = 'unexpected'",
        "tenant_school_id = (select id from schools limit 1)",
        "status = 'rejected'", "accepted_at = clock_timestamp()", "data_class = 'payment_sensitive'",
        "expires_at = '-infinity'", "expires_at = 'infinity'", "expires_at = clock_timestamp() - interval '1 second'",
      ];
      for (const change of variants) {
        const item = await fixture("student");
        await pool.query(`update agent_context_candidates set ${change} where id = $1`, [item.candidate.id]);
        const snapshot = await snapshotAuditedBusinessTables(pool);
        await assert.rejects(item.confirm(), unavailable);
        assert.deepEqual(await snapshotAuditedBusinessTables(pool), snapshot);
      }
    });

    await t.test("Agent legacy content is revalidated before consumption and summaries are regenerated", async () => {
      const bad = await fixture("guest");
      await pool.query("update agent_context_candidates set structured_json = $2::jsonb where id = $1", [bad.candidate.id, JSON.stringify({ passport: "PRIVATE_LEGACY_AGENT" })]);
      const before = await snapshotAuditedBusinessTables(pool);
      await assert.rejects(bad.confirm(), (error) => error.status === 400);
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      const good = await fixture("student");
      await pool.query("update agent_context_candidates set summary = 'PRIVATE_LEGACY_AGENT', source_entity_ids_json = '[\"PRIVATE_LEGACY_AGENT\"]'::jsonb where id = $1", [good.candidate.id]);
      const memory = await good.confirm();
      assert.equal(memory.summary, "Degree: master; Subjects: computer_science");
      assert.doesNotMatch(JSON.stringify(memory), /PRIVATE_LEGACY_AGENT/);
    });

    await t.test("Agent memory insertion failure rolls back a candidate already marked accepted", async () => {
      const { candidate, confirm } = await fixture("guest");
      const before = await snapshotAuditedBusinessTables(pool);
      await pool.query(`create function rehearsal_reject_memory() returns trigger language plpgsql as $$
        begin raise exception 'Synthetic memory write failure' using errcode = 'P0001'; end $$`);
      await pool.query("create trigger rehearsal_reject_memory before insert on agent_memory_entries for each row execute function rehearsal_reject_memory()");
      try {
        await assert.rejects(confirm(), (error) => error.code === "P0001");
        assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      } finally {
        await pool.query("drop trigger rehearsal_reject_memory on agent_memory_entries");
        await pool.query("drop function rehearsal_reject_memory()");
      }
      assert.equal((await confirm()).sourceCandidateId, candidate.id);
    });

    await t.test("Agent unique migration rejects bypassed duplicates including cleared entries and fails closed on historical duplicates", async () => {
      const { confirm } = await fixture("student");
      const memory = await confirm();
      await pool.query("update agent_memory_entries set cleared_at = clock_timestamp() where id = $1", [memory.id]);
      const duplicate = `insert into agent_memory_entries (user_id, memory_type, context_scope, active_role, memory_namespace, data_class, confidence, summary, source, source_candidate_id, expires_at, created_at)
        select user_id, memory_type, context_scope, active_role, memory_namespace, data_class, confidence, summary, source, source_candidate_id, expires_at, created_at from agent_memory_entries where id = $1`;
      await assert.rejects(pool.query(duplicate, [memory.id]), (error) => error.code === "23505" && error.constraint === "agent_memory_entries_source_candidate_unique");
      const migration = await readFile(new URL("../../../drizzle/pg/0009_agent_memory_confirmation_unique.sql", import.meta.url), "utf8");
      const connection = await pool.connect();
      try {
        await connection.query("begin");
        await connection.query("drop index agent_memory_entries_source_candidate_unique");
        await connection.query(duplicate, [memory.id]);
        await assert.rejects(connection.query(migration), (error) => error.code === "23505");
      } finally {
        await connection.query("rollback");
        connection.release();
      }
      await assert.rejects(pool.query(duplicate, [memory.id]), (error) => error.code === "23505");
    });
  } finally { await faults.close(); }
}
