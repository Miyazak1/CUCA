import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { createPostgresEmailVerificationService, createEmailVerificationHttpHandlers } from "../../../src/server/auth/email-verification-http.ts";
import { createPostgresPasswordResetService, createPasswordResetHttpHandlers } from "../../../src/server/auth/password-reset-http.ts";
import { PostgresEmailVerificationRepository } from "../../../src/server/auth/email-verification-postgres-repository.ts";
import { PostgresPasswordResetRepository } from "../../../src/server/auth/password-reset-postgres-repository.ts";
import { EmailTokenCipher } from "../../../src/server/auth/email-token-envelope.ts";
import { PostgresAuthEmailOutbox } from "../../../src/server/auth/postgres-email-outbox.ts";
import { processOneAuthEmail } from "../../../src/server/auth/email-outbox-worker.ts";
import { createAuditFailureFixture, snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";
import { gateSelectionClient, waitForSelectionBlock } from "./material-selection-fixture.mjs";

const key = randomBytes(32), cipher = () => new EmailTokenCipher({ activeKeyId: "synthetic", keys: new Map([["synthetic", key]]) });
const config = { from: "no-reply@example.invalid", publicAppUrl: "https://synthetic.example.invalid", verificationPath: "/auth/verify-email", passwordResetPath: "/auth/reset-password" };
const body = value => new Request("https://synthetic.example.invalid/api/v1/auth/password-reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value) });

export async function emailOutboxFixture(pool, kind = "verify") {
  const userId = randomUUID(), email = `outbox-${userId}@example.invalid`, client = createTransactionalSqlClient(pool);
  await pool.query("insert into users (id,email,email_normalized) values ($1,$2,$2)", [userId, email]);
  await pool.query("insert into auth_identities (user_id,provider,provider_subject,email_normalized,password_hash) values ($1,'password',$2,$2,'synthetic-hash-only')", [userId, email]);
  const context = createRequestContext({ actorUserId: userId, activeRole: "student", selectedSurface: "student", purpose: "student_action" });
  const verification = createPostgresEmailVerificationService(client, { emailCipher: cipher() });
  const reset = createPostgresPasswordResetService(client, { emailCipher: cipher() });
  const outbox = new PostgresAuthEmailOutbox(client, cipher());
  return { userId, email, client, context, kind, verification, reset, outbox,
    request: (sql = client) => kind === "verify"
      ? createPostgresEmailVerificationService(sql, { emailCipher: cipher() }).requestVerification(context)
      : createPostgresPasswordResetService(sql, { emailCipher: cipher() }).requestReset(context, { email }),
    async row() { return (await pool.query("select * from auth_email_outbox where user_id = $1 order by created_at desc,id desc", [userId])).rows[0]; },
  };
}

export async function runEmailOutboxRehearsal(t, pool) {
  let ids = [];
  async function fixture(kind) { const f = await emailOutboxFixture(pool, kind); ids.push(f.userId); return f; }
  async function check(name, work) {
    await t.test(name, async () => { ids = []; try { await work(); } finally { await pool.query("delete from auth_email_outbox where user_id = any($1::uuid[])", [ids]); } });
  }

  await check("email outbox production factory atomically queues encrypted verification and reset credentials", async () => {
    for (const kind of ["verify", "reset"]) {
      const f = await fixture(kind); assert.equal((await f.request()).deliveryStatus, "queued");
      const row = await f.row(); assert.equal(row.status, "queued"); assert.equal(row.attempt_count, 0);
      const lease = await f.outbox.claim(), prepared = await f.outbox.prepare(lease);
      assert.equal(prepared.userId, f.userId); assert.equal(prepared.emailNormalized, f.email);
      assert.equal(JSON.stringify(row).includes(prepared.token), false); assert.equal(JSON.stringify(row).includes(f.email), false);
      assert.equal(await f.outbox.finish(lease, "accepted"), true);
      const done = await f.row(); assert.equal(done.envelope_json, null); assert.equal(done.status, "accepted"); assert.ok(done.completed_at);
      const audits = (await pool.query("select actor_type,metadata_json from audit_logs where resource_id = $1", [row.id])).rows;
      assert.ok(audits.length >= 3); assert.ok(audits.every(a => a.actor_type === "service"));
      assert.equal(JSON.stringify(audits).includes(prepared.token), false); assert.equal(JSON.stringify(audits).includes(f.email), false);
      if (kind === "verify") assert.equal((await f.verification.verifyEmail(f.context, prepared.challengeId, prepared.token)).status, "verified");
      else assert.equal((await f.reset.resetPassword(f.context, prepared.challengeId, prepared.token, "Synthetic-reset-password-2026")).status, "reset");
    }
  });

  await check("email outbox queue and challenge both roll back when enqueue or request success audit fails", async () => {
    const fault = await createAuditFailureFixture(pool);
    try {
      for (const kind of ["verify", "reset"]) {
        const f = await fixture(kind);
        for (const action of ["auth.email_outbox.enqueued", kind === "verify" ? "auth.email_verification.request" : "auth.password_reset.request"]) {
          const before = await snapshotAuditedBusinessTables(pool);
          await fault.during(action, async () => { await assert.rejects(f.request(), /Synthetic audit storage failure/); });
          assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
        }
        await f.request(); assert.equal((await f.row()).status, "queued");
      }
    } finally { await fault.close(); }
  });

  await check("email outbox cannot expose an uncommitted job to a consumer", async () => {
    const f = await fixture(), gate = gateSelectionClient(f.client, sql => sql.startsWith("insert into audit_logs"));
    const work = Promise.allSettled([f.request(gate.client)]);
    try { await gate.ready; assert.equal(await f.outbox.claim(), null); assert.equal(await f.row(), undefined); }
    finally { gate.release(); }
    assert.equal((await work)[0].status, "fulfilled"); assert.ok(await f.outbox.claim());
  });

  await check("email outbox concurrent consumers claim separate committed jobs without duplicate ownership", async () => {
    const a = await fixture(), b = await fixture("reset"); await a.request(); await b.request();
    const leases = await Promise.all([a.outbox.claim(), b.outbox.claim(), a.outbox.claim()]);
    assert.equal(leases.filter(Boolean).length, 2); assert.equal(new Set(leases.filter(Boolean).map(l => l.id)).size, 2);
    for (const lease of leases.filter(Boolean)) { assert.ok(await a.outbox.prepare(lease)); assert.equal(await a.outbox.finish(lease, "accepted"), true); }
  });

  await check("email outbox expired unstarted lease is recoverable and old lease cannot prepare or finish replacement", async () => {
    const f = await fixture(); await f.request(); const old = await f.outbox.claim();
    await pool.query("update auth_email_outbox set lease_expires_at = clock_timestamp() - interval '1 second' where id = $1", [old.id]);
    assert.deepEqual(await f.outbox.recover(), { recovered: 1 });
    const fresh = await f.outbox.claim(); assert.notEqual(old.leaseId, fresh.leaseId);
    assert.equal(await f.outbox.prepare(old), null); assert.equal(await f.outbox.finish(old, "accepted"), false);
    assert.ok(await f.outbox.prepare(fresh)); assert.equal(await f.outbox.finish(fresh, "accepted"), true);
  });

  await check("email outbox a lost sending lease is uncertain and scrubbed, never automatically resent", async () => {
    const f = await fixture(); await f.request(); const lease = await f.outbox.claim(); await f.outbox.prepare(lease);
    await pool.query("update auth_email_outbox set lease_expires_at = clock_timestamp() - interval '1 second' where id = $1", [lease.id]);
    await f.outbox.recover(); const row = await f.row(); assert.equal(row.status, "uncertain"); assert.equal(row.envelope_json, null);
    assert.equal(await f.outbox.claim(), null); assert.equal(await f.outbox.finish(lease, "accepted"), false);
    assert.deepEqual(await f.outbox.recover(), { recovered: 0 });
  });

  await check("email outbox only explicit nonacceptance retries with bounded backoff and five-attempt maximum", async () => {
    const f = await fixture("reset"); await f.request();
    for (let attempt = 1; attempt <= 5; attempt++) {
      const lease = await f.outbox.claim(); assert.ok(lease); await f.outbox.prepare(lease); await f.outbox.finish(lease, "not_accepted");
      const row = await f.row(); assert.equal(row.attempt_count, attempt); assert.equal(row.status, attempt === 5 ? "failed" : "queued");
      assert.equal(await f.outbox.claim(), null);
      if (attempt < 5) { assert.ok(row.available_at.getTime() - Date.now() > 20_000); await pool.query("update auth_email_outbox set available_at = clock_timestamp() where id = $1", [row.id]); }
      else { assert.equal(row.envelope_json, null); assert.equal(row.outcome, "attempt_limit"); }
    }
  });

  await check("email outbox worker converts provider exceptions to unknown without leaking provider error or retrying", async () => {
    const f = await fixture(); await f.request(); let calls = 0;
    const provider = { async deliver() { calls++; throw new Error("SYNTHETIC_PRIVATE_RECIPIENT_TOKEN"); } };
    assert.deepEqual(await processOneAuthEmail(f.outbox, provider, config), { status: "unknown" });
    assert.deepEqual(await processOneAuthEmail(f.outbox, provider, config), { status: "idle" }); assert.equal(calls, 1);
    const row = await f.row(); assert.equal(row.status, "uncertain"); assert.equal(row.envelope_json, null);
    assert.equal(JSON.stringify(await snapshotAuditedBusinessTables(pool)).includes("SYNTHETIC_PRIVATE_RECIPIENT_TOKEN"), false);
  });

  await check("email outbox cancels changed disabled consumed revoked expired or identity-less destinations before sending", async () => {
    for (const kind of ["verify", "reset"]) for (const change of ["email", "disabled", "consumed", "revoked", "expired", "identity"]) {
      if (kind === "verify" && change === "identity") continue;
      const f = await fixture(kind); await f.request(); const row = await f.row(), lease = await f.outbox.claim();
      const table = kind === "verify" ? "email_verification_challenges" : "password_reset_challenges", id = row.verification_challenge_id ?? row.reset_challenge_id;
      if (change === "email") await pool.query("update users set email_normalized = $2 where id = $1", [f.userId, `changed-${f.email}`]);
      if (change === "disabled") await pool.query("update users set account_status = 'disabled' where id = $1", [f.userId]);
      if (change === "consumed") await pool.query(`update ${table} set status = $2 where id = $1`, [id, kind === "verify" ? "verified" : "consumed"]);
      if (change === "revoked") await pool.query(`update ${table} set status = 'revoked' where id = $1`, [id]);
      if (change === "expired") await pool.query(`update ${table} set expires_at = clock_timestamp() - interval '1 second' where id = $1`, [id]);
      if (change === "identity") await pool.query("delete from auth_identities where user_id = $1", [f.userId]);
      assert.equal(await f.outbox.prepare(lease), null, `${kind}:${change}`); assert.equal((await f.row()).status, "cancelled"); assert.equal((await f.row()).envelope_json, null);
    }
  });

  await check("email outbox missing decryption key pauses safely while malformed or swapped envelope fails closed", async () => {
    const a = await fixture(), b = await fixture(); await a.request(); await b.request();
    const lease = await a.outbox.claim(); const otherKey = new EmailTokenCipher({ activeKeyId: "other", keys: new Map([["other", randomBytes(32)]]) });
    await assert.rejects(new PostgresAuthEmailOutbox(a.client, otherKey).prepare(lease), e => e.status === 503);
    assert.equal((await pool.query("select status from auth_email_outbox where id = $1", [lease.id])).rows[0].status, "leased");
    const other = (await a.row()).id === lease.id ? await b.row() : await a.row();
    await pool.query("update auth_email_outbox set envelope_json = $2::jsonb where id = $1", [lease.id, JSON.stringify(other.envelope_json)]);
    assert.equal(await a.outbox.prepare(lease), null);
    const row = (await pool.query("select status,envelope_json from auth_email_outbox where id = $1", [lease.id])).rows[0]; assert.deepEqual(row, { status: "failed", envelope_json: null });
  });

  await check("email outbox expired queued credentials are scrubbed by bounded recovery with no provider invocation", async () => {
    const f = await fixture(); await f.request(); const row = await f.row();
    await pool.query("update auth_email_outbox set expires_at = clock_timestamp() - interval '1 second' where id = $1", [row.id]);
    assert.equal(await f.outbox.claim(), null); assert.deepEqual(await f.outbox.recover(1), { recovered: 1 });
    assert.equal((await f.row()).envelope_json, null); assert.equal((await f.row()).outcome, "expired");
    await assert.rejects(f.outbox.recover(101), e => e.status === 503);
  });

  await check("email outbox audit failure prevents sending intent and preserves uncertain accepted results for recovery", async () => {
    const f = await fixture(); await f.request(); const lease = await f.outbox.claim(), fault = await createAuditFailureFixture(pool);
    try {
      const before = await snapshotAuditedBusinessTables(pool);
      await fault.during("auth.email_outbox.sending", async () => { await assert.rejects(f.outbox.prepare(lease), /Synthetic audit storage failure/); });
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      await f.outbox.prepare(lease);
      await fault.during("auth.email_outbox.accepted", async () => { await assert.rejects(f.outbox.finish(lease, "accepted"), /Synthetic audit storage failure/); });
      assert.equal((await f.row()).status, "sending"); assert.equal(await f.outbox.claim(), null);
    } finally { await fault.close(); }
  });

  await check("email issuance rechecks active target after account lock and never queues stale-email requests", async () => {
    for (const kind of ["verify", "reset"]) {
      const f = await fixture(kind), gate = gateSelectionClient(f.client, sql => sql.startsWith("select id from users where id = $1 for update"));
      const blocker = await pool.connect(); await blocker.query("begin"); await blocker.query("update users set email_normalized = $2 where id = $1", [f.userId, `changed-${f.email}`]);
      const pending = Promise.allSettled([f.request(gate.client)]);
      try {
        const pid = (await blocker.query("select pg_backend_pid() as pid")).rows[0].pid;
        gate.release(); await waitForSelectionBlock(pool, pid); await blocker.query("commit");
        const result = (await pending)[0];
        if (kind === "verify") { assert.equal(result.status, "rejected"); assert.equal(result.reason.status, 403); }
        else { assert.equal(result.status, "fulfilled"); assert.equal(result.value.status, "accepted"); }
        assert.equal(await f.row(), undefined);
      } finally { gate.release(); await blocker.query("rollback"); blocker.release(); await pending; }
    }
  });

  await check("email outbox preparing waits for account revocation and rechecks state after the lock", async () => {
    const f = await fixture(); await f.request(); const lease = await f.outbox.claim(), blocker = await pool.connect();
    await blocker.query("begin"); await blocker.query("update users set account_status = 'disabled' where id = $1", [f.userId]);
    const work = Promise.allSettled([f.outbox.prepare(lease)]);
    try { const pid = (await blocker.query("select pg_backend_pid() as pid")).rows[0].pid; await waitForSelectionBlock(pool, pid); await blocker.query("commit"); assert.equal((await work)[0].value, null); }
    finally { await blocker.query("rollback"); blocker.release(); await work; }
    assert.equal((await f.row()).status, "cancelled");
  });

  await check("email outbox challenge owner uniqueness state and terminal erasure are database constraints", async () => {
    const a = await fixture(), b = await fixture("reset"); await a.request(); await b.request(); const row = await a.row();
    for (const [sql, params, code] of [
      ["update auth_email_outbox set user_id = $2 where id = $1", [row.id, b.userId], "23503"],
      ["update auth_email_outbox set status = 'accepted' where id = $1", [row.id], "23514"],
      ["update auth_email_outbox set message_type = 'auth.password_reset' where id = $1", [row.id], "23514"],
      ["update auth_email_outbox set attempt_count = 6 where id = $1", [row.id], "23514"],
      ["insert into auth_email_outbox select $2::uuid,user_id,message_type,verification_challenge_id,reset_challenge_id,expires_at,envelope_json,status,attempt_count,available_at,lease_id,lease_expires_at,outcome,completed_at,created_at,updated_at from auth_email_outbox where id = $1", [row.id, randomUUID()], "23505"],
    ]) await assert.rejects(pool.query(sql, params), e => e.code === code);
    await pool.query("delete from email_verification_challenges where id = $1", [row.verification_challenge_id]); assert.equal(await a.row(), undefined);
  });

  await check("email reset HTTP conceals delivery status and unknown accounts while runtime without cipher stays deferred", async () => {
    const f = await fixture("reset"), auth = { async findActiveSessionByTokenHash() { return null; } }, http = createPasswordResetHttpHandlers(f.reset, auth);
    const present = await http.requestReset(body({ email: f.email })), missing = await http.requestReset(body({ email: "missing@example.invalid" }));
    assert.equal(present.status, 200); assert.equal(missing.status, 200); assert.deepEqual(await present.json(), await missing.json());
    const deferred = await fixture(); assert.equal((await createPostgresEmailVerificationService(deferred.client).requestVerification(deferred.context)).deliveryStatus, "deferred"); assert.equal(await deferred.row(), undefined);
    const verificationHttp = createEmailVerificationHttpHandlers(deferred.verification, auth);
    assert.equal((await verificationHttp.requestVerification(body({}))).status, 403);
    assert.equal(await deferred.row(), undefined);
  });

  await check("email outbox committed request claim sending and accepted states survive lost acknowledgements without implicit retries", async () => {
    for (const phase of ["request", "claim", "prepare", "finish"]) {
      const f = await fixture(); let commits = 0;
      const uncertain = { ...f.client, async transaction(work) { await f.client.transaction(work); commits++; throw new Error("Synthetic committed acknowledgment lost"); } };
      const outbox = new PostgresAuthEmailOutbox(uncertain, cipher());
      if (phase === "request") {
        await assert.rejects(f.request(uncertain), /acknowledgment lost/); assert.equal((await f.row()).status, "queued");
      } else {
        await f.request();
        if (phase === "claim") { await assert.rejects(outbox.claim(), /acknowledgment lost/); assert.equal((await f.row()).status, "leased"); }
        else {
          const lease = await f.outbox.claim();
          if (phase === "prepare") { await assert.rejects(outbox.prepare(lease), /acknowledgment lost/); assert.equal((await f.row()).status, "sending"); }
          else { await f.outbox.prepare(lease); await assert.rejects(outbox.finish(lease, "accepted"), /acknowledgment lost/); assert.equal((await f.row()).status, "accepted"); }
        }
      }
      assert.equal(commits, 1);
      if (phase !== "request") assert.equal(await f.outbox.claim(), null);
      if (phase === "claim" || phase === "prepare") {
        await pool.query("update auth_email_outbox set lease_expires_at = clock_timestamp() - interval '1 second' where user_id = $1", [f.userId]);
        await f.outbox.recover(); assert.equal((await f.row()).status, phase === "claim" ? "queued" : "uncertain");
      }
      await pool.query("delete from auth_email_outbox where user_id = $1", [f.userId]);
    }
  });

  await check("email outbox concurrent issuance serializes before challenge foreign keys and creates one task per explicit request", async () => {
    for (const kind of ["verify", "reset"]) {
      const f = await fixture(kind), results = await Promise.all([f.request(), f.request()]);
      assert.ok(results.every(r => r.deliveryStatus === "queued"));
      const rows = (await pool.query("select id,verification_challenge_id,reset_challenge_id from auth_email_outbox where user_id = $1", [f.userId])).rows;
      assert.equal(rows.length, 2); assert.notEqual(rows[0].id, rows[1].id);
      const column = kind === "verify" ? "verification_challenge_id" : "reset_challenge_id";
      assert.notEqual(rows[0][column], rows[1][column]);
    }
  });

  await check("email repositories reject stale target expiry and missing password identity even without delivery configured", async () => {
    const f = await fixture(), now = new Date(), expiresAt = new Date(Date.now() + 60000);
    const verify = new PostgresEmailVerificationRepository(f.client), reset = new PostgresPasswordResetRepository(f.client);
    const input = { userId: f.userId, emailNormalized: `changed-${f.email}`, now, expiresAt };
    assert.equal(await verify.createEmailVerificationChallenge({ ...input, verificationTokenHash: randomUUID() }), null);
    assert.equal(await reset.createPasswordResetChallenge({ ...input, resetTokenHash: randomUUID() }), null);
    assert.equal(await verify.createEmailVerificationChallenge({ ...input, emailNormalized: f.email, expiresAt: now, verificationTokenHash: randomUUID() }), null);
    await pool.query("delete from auth_identities where user_id = $1", [f.userId]);
    assert.equal(await reset.createPasswordResetChallenge({ ...input, emailNormalized: f.email, resetTokenHash: randomUUID() }), null);
  });
}
