import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { createPostgresStudentService } from "../../../src/server/student/runtime/routes.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { createAuditFailureFixture, snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";

function gatedClient(client, failAudit = false) {
  let acquired, release, rejectReady, held = false;
  const ready = new Promise((resolve, reject) => { acquired = resolve; rejectReady = reject; });
  const timer = setTimeout(() => rejectReady(new Error("Receipt lock barrier timed out")), 5000);
  const released = new Promise(resolve => { release = () => { clearTimeout(timer); resolve(); }; });
  return {
    ready, release,
    client: { ...client, transaction: work => client.transaction(tx => work({
      ...tx,
      async query(sql, params) {
        const rows = await tx.query(sql, params);
        if (!held && /insert into student_application_command_receipts/.test(sql)) {
          held = true; clearTimeout(timer); acquired(); await released;
        }
        if (failAudit && /insert into audit_logs/.test(sql)) throw new Error("Synthetic first transaction failure");
        return rows;
      },
    })) },
  };
}

export async function runApplicationCommandsRehearsal(t, pool) {
  const client = createTransactionalSqlClient(pool), service = createPostgresStudentService(client);
  async function account() {
    const email = `command-${randomUUID()}@example.invalid`;
    const { rows: [user] } = await pool.query("insert into users (email, email_normalized) values ($1, $1) returning id", [email]);
    await pool.query("insert into user_roles (user_id, role) values ($1, 'student')", [user.id]);
    return createRequestContext({ actorUserId: user.id, activeRole: "student", selectedSurface: "student", purpose: "student_action" });
  }
  const options = () => ({ idempotencyKey: randomUUID() });
  const retry = ctx => ({ ...ctx, requestId: randomUUID() });
  const count = async (table, userId) => (await pool.query(`select count(*)::int as n from ${table} where user_id = $1`, [userId])).rows[0].n;
  const schoolId = (await pool.query("select id from schools where status = 'active' limit 1")).rows[0].id;
  async function waitForReceiptWaiter() {
    for (let i = 0; i < 200; i++) {
      const result = await pool.query("select count(*)::int as n from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock' and query like 'insert into student_application_command_receipts%'");
      if (result.rows[0].n > 0) return;
      await delay(10);
    }
    assert.fail("Retry did not reach receipt unique-key wait");
  }

  await t.test("application receipts replay normalized input and current owner projection without repeating creation audit", async () => {
    const ctx = await account(), key = options();
    const first = await service.createOwnApplicationSet(ctx, { name: " PRIVATE_SET " }, key);
    await pool.query("update application_sets set name = 'Current name' where id = $1", [first.id]);
    const again = await service.createOwnApplicationSet(retry(ctx), { targetIntake: null, name: "PRIVATE_SET", userId: randomUUID() }, key);
    assert.equal(again.id, first.id);
    assert.equal(again.name, "Current name");
    await assert.rejects(service.createOwnApplicationSet(retry(ctx), { name: "Changed request" }, key), e => e.status === 409);
    assert.equal(await count("application_sets", ctx.actorUserId), 1);
    const receipts = (await pool.query("select * from student_application_command_receipts where user_id = $1", [ctx.actorUserId])).rows;
    assert.equal(receipts.length, 1);
    assert.equal(receipts[0].resource_id, first.id);
    assert.ok(receipts[0].completed_at);
    assert.doesNotMatch(JSON.stringify(receipts), new RegExp(`PRIVATE_SET|${key.idempotencyKey}`));
    const audits = (await pool.query("select action, metadata_json from audit_logs where actor_user_id = $1 order by created_at, id", [ctx.actorUserId])).rows;
    assert.equal(audits.filter(a => a.action === "student.application_set.create").length, 1);
    assert.deepEqual(audits.find(a => a.action === "student.application_command.replay").metadata_json, { operation: "application_set.create", originalRequestId: ctx.requestId });
    assert.doesNotMatch(JSON.stringify(audits), /PRIVATE_SET|key_hash|request_hash/);
  });

  await t.test("receipt keys are account and operation scoped; choice input includes owner-checked route set", async () => {
    const a = await account(), b = await account(), key = options();
    const setA = await service.createOwnApplicationSet(a, { name: "Same" }, key);
    const setB = await service.createOwnApplicationSet(b, { name: "Same" }, key);
    assert.notEqual(setA.id, setB.id);
    const input = { applicationSetId: setA.id, schoolId, studentNotes: "PRIVATE_NOTES" };
    const choice = await service.addOwnApplicationChoice(retry(a), input, key);
    assert.equal((await service.addOwnApplicationChoice(retry(a), { ...input, rankOrder: 0, programId: null }, key)).id, choice.id);
    const otherSet = await service.createOwnApplicationSet(retry(a), { name: "Other" }, options());
    await assert.rejects(service.addOwnApplicationChoice(retry(a), { ...input, applicationSetId: otherSet.id }, key), e => e.status === 409);
    await assert.rejects(service.addOwnApplicationChoice(retry(b), input, key), e => e.status === 403);
    assert.equal(await count("application_choices", a.actorUserId), 1);
    const receipts = (await pool.query("select * from student_application_command_receipts where user_id = $1", [a.actorUserId])).rows;
    assert.equal(receipts.length, 3);
    assert.doesNotMatch(JSON.stringify(receipts), /PRIVATE_NOTES/);
  });

  for (const operation of ["set", "choice"]) {
    await t.test(`concurrent ${operation} retries wait on receipt uniqueness and return one resource`, async () => {
      const ctx = await account(), key = options();
      const set = operation === "choice" ? await service.createOwnApplicationSet(ctx, { name: "Parent" }, options()) : null;
      const call = s => operation === "set" ? s.createOwnApplicationSet(retry(ctx), { name: "Parallel" }, key)
        : s.addOwnApplicationChoice(retry(ctx), { applicationSetId: set.id, schoolId }, key);
      const gate = gatedClient(client);
      const first = call(createPostgresStudentService(gate.client));
      first.catch(() => {});
      let second;
      try {
        await gate.ready;
        second = call(service); second.catch(() => {});
        await waitForReceiptWaiter();
        gate.release();
        const results = await Promise.all([first, second]);
        assert.equal(results[0].id, results[1].id);
        assert.equal(await count(operation === "set" ? "application_sets" : "application_choices", ctx.actorUserId), 1);
      } finally { gate.release(); await Promise.allSettled([first, second]); }
    });
  }

  await t.test("a waiting retry can reserve after the first transaction rolls back", async () => {
    const ctx = await account(), key = options(), gate = gatedClient(client, true);
    const call = s => s.createOwnApplicationSet(retry(ctx), { name: "Rollback winner" }, key);
    const first = call(createPostgresStudentService(gate.client)); first.catch(() => {});
    let second;
    try {
      await gate.ready; second = call(service); second.catch(() => {});
      await waitForReceiptWaiter(); gate.release();
      const results = await Promise.allSettled([first, second]);
      assert.equal(results[0].status, "rejected");
      assert.match(results[0].reason.message, /Synthetic first transaction failure/);
      assert.equal(results[1].status, "fulfilled");
      assert.equal(await count("application_sets", ctx.actorUserId), 1);
      assert.equal(await count("student_application_command_receipts", ctx.actorUserId), 1);
    } finally { gate.release(); await Promise.allSettled([first, second]); }
  });

  await t.test("application receipts, business data and original/replay audits roll back together on audit failure", async () => {
    const ctx = await account(), key = options(), fault = await createAuditFailureFixture(pool);
    try {
      const before = await snapshotAuditedBusinessTables(pool);
      await fault.during("student.application_set.create", () => assert.rejects(service.createOwnApplicationSet(ctx, { name: "Atomic" }, key), e => e.code === "P0001"));
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      const result = await service.createOwnApplicationSet(ctx, { name: "Atomic" }, key);
      const after = await snapshotAuditedBusinessTables(pool);
      await fault.during("student.application_command.replay", () => assert.rejects(service.createOwnApplicationSet(retry(ctx), { name: "Atomic" }, key), e => e.code === "P0001"));
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), after);
      assert.equal((await service.createOwnApplicationSet(retry(ctx), { name: "Atomic" }, key)).id, result.id);
      const choiceKey = options(), choiceInput = { applicationSetId: result.id, schoolId };
      const beforeChoice = await snapshotAuditedBusinessTables(pool);
      await fault.during("student.application_choice.add", () => assert.rejects(service.addOwnApplicationChoice(retry(ctx), choiceInput, choiceKey), e => e.code === "P0001"));
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), beforeChoice);
      const choice = await service.addOwnApplicationChoice(retry(ctx), choiceInput, choiceKey);
      assert.equal((await service.addOwnApplicationChoice(retry(ctx), choiceInput, choiceKey)).id, choice.id);
      const receiptFailureClient = {
        ...client,
        transaction: work => client.transaction(tx => work({
          ...tx,
          async query(sql, params) {
            const rows = await tx.query(sql, params);
            if (/update student_application_command_receipts set resource_id/.test(sql)) throw new Error("Synthetic receipt completion failure");
            return rows;
          },
        })),
      };
      const beforeReceiptFailure = await snapshotAuditedBusinessTables(pool);
      const failedKey = options();
      await assert.rejects(createPostgresStudentService(receiptFailureClient).createOwnApplicationSet(retry(ctx), { name: "Receipt failure" }, failedKey), /Synthetic receipt completion failure/);
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), beforeReceiptFailure);
      assert.ok((await service.createOwnApplicationSet(retry(ctx), { name: "Receipt failure" }, failedKey)).id);
    } finally { await fault.close(); }
  });

  await t.test("committed resource and receipt recover from a simulated lost COMMIT acknowledgement", async () => {
    for (const operation of ["set", "choice"]) {
      const ctx = await account(), key = options();
      const set = operation === "choice" ? await service.createOwnApplicationSet(ctx, { name: "Ack parent" }, options()) : null;
      let discarded = false, commits = 0;
      const ambiguous = createTransactionalSqlClient({
        query: pool.query.bind(pool),
        async connect() {
          const connection = await pool.connect();
          return {
            async query(sql, params) {
              const result = await connection.query(sql, params);
              if (sql === "commit") { commits++; throw new Error("Synthetic lost COMMIT acknowledgement"); }
              return result;
            },
            release(destroy) { discarded = destroy; connection.release(destroy); },
          };
        },
      });
      const call = s => operation === "set" ? s.createOwnApplicationSet(retry(ctx), { name: "Ack lost" }, key)
        : s.addOwnApplicationChoice(retry(ctx), { applicationSetId: set.id, schoolId }, key);
      await assert.rejects(call(createPostgresStudentService(ambiguous)), /Synthetic lost COMMIT acknowledgement/);
      assert.equal(commits, 1); assert.equal(discarded, true);
      const replay = await call(service);
      const table = operation === "set" ? "application_sets" : "application_choices";
      const rows = (await pool.query(`select id from ${table} where user_id = $1`, [ctx.actorUserId])).rows;
      assert.deepEqual(rows, [{ id: replay.id }]);
      const action = operation === "set" ? "student.application_set.create" : "student.application_choice.add";
      assert.equal((await pool.query("select count(*)::int as n from audit_logs where actor_user_id = $1 and action = $2", [ctx.actorUserId, action])).rows[0].n, 1);
    }
  });

  await t.test("replay rejects disabled account, revoked role and wrong persona with no new writes", async () => {
    const ctx = await account(), key = options();
    await service.createOwnApplicationSet(ctx, { name: "Restricted" }, key);
    const call = context => service.createOwnApplicationSet(context, { name: "Restricted" }, key);
    await pool.query("update users set account_status = 'suspended' where id = $1", [ctx.actorUserId]);
    await assert.rejects(call(retry(ctx)), e => e.status === 403);
    await pool.query("update users set account_status = 'active' where id = $1", [ctx.actorUserId]);
    await pool.query("update user_roles set revoked_at = now() where user_id = $1", [ctx.actorUserId]);
    await assert.rejects(call(retry(ctx)), e => e.status === 403);
    for (const context of [{ ...ctx, activeRole: "cuac_ops" }, { ...ctx, tenantSchoolId: randomUUID() }, { ...ctx, dataClassAllowlist: [] }]) await assert.rejects(call(context), e => e.status === 403);
    assert.equal(await count("application_sets", ctx.actorUserId), 1);
  });

  await t.test("removed or deleted resources do not free their receipt keys; account deletion cascades receipts", async () => {
    const ctx = await account(), setKey = options(), choiceKey = options();
    const set = await service.createOwnApplicationSet(ctx, { name: "Deleted" }, setKey);
    const input = { applicationSetId: set.id, schoolId };
    const choice = await service.addOwnApplicationChoice(retry(ctx), input, choiceKey);
    await pool.query("update application_choices set removed_at = now() where id = $1", [choice.id]);
    await assert.rejects(service.addOwnApplicationChoice(retry(ctx), input, choiceKey), e => e.status === 409);
    await pool.query("delete from application_sets where id = $1", [set.id]);
    await assert.rejects(service.createOwnApplicationSet(retry(ctx), { name: "Deleted" }, setKey), e => e.status === 409);
    assert.equal(await count("student_application_command_receipts", ctx.actorUserId), 2);
    assert.equal(await count("application_sets", ctx.actorUserId), 0);
    await pool.query("delete from users where id = $1", [ctx.actorUserId]);
    assert.equal(await count("student_application_command_receipts", ctx.actorUserId), 0);
  });

  await t.test("unavailable catalog leaves no pending receipt and corrupt incomplete receipts fail closed", async () => {
    const ctx = await account(), setKey = options();
    const set = await service.createOwnApplicationSet(ctx, { name: "Invalid choice" }, setKey);
    const key = options();
    await assert.rejects(service.addOwnApplicationChoice(retry(ctx), { applicationSetId: set.id, schoolId: randomUUID() }, key), e => e.status === 403);
    assert.equal(await count("student_application_command_receipts", ctx.actorUserId), 1);
    const choice = await service.addOwnApplicationChoice(retry(ctx), { applicationSetId: set.id, schoolId }, key);
    assert.ok(choice.id);
    assert.equal((await pool.query("select count(*)::int as n from student_application_command_receipts where resource_id is null")).rows[0].n, 0);
    await pool.query("update student_application_command_receipts set resource_id = null, completed_at = null where user_id = $1 and operation = 'application_set.create'", [ctx.actorUserId]);
    try {
      const before = await snapshotAuditedBusinessTables(pool);
      await assert.rejects(service.createOwnApplicationSet(retry(ctx), { name: "Invalid choice" }, setKey), e => e.status === 503);
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    } finally {
      await pool.query("update student_application_command_receipts set resource_id = $2, completed_at = clock_timestamp() where user_id = $1 and operation = 'application_set.create'", [ctx.actorUserId, set.id]);
    }
  });
}
