import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID, scryptSync } from "node:crypto";
import { issueGuestSession } from "../../../src/server/auth/guest-session.ts";
import { setTimeout as delay } from "node:timers/promises";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { AuthCredentialsService, verifyPassword, verifyPasswordForLogin, hashPassword } from "../../../src/server/auth/credentials.ts";
import { PostgresAuthSessionRepository } from "../../../src/server/auth/postgres-repository.ts";
import { hashSessionToken } from "../../../src/server/auth/session.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { PostgresAuditWriter } from "../../../src/server/audit/postgres-writer.ts";
import { EmailVerificationService } from "../../../src/server/auth/email-verification.ts";
import { PostgresEmailVerificationRepository } from "../../../src/server/auth/email-verification-postgres-repository.ts";
import { createEmailVerificationHttpHandlers } from "../../../src/server/auth/email-verification-http.ts";
import { PasswordResetService } from "../../../src/server/auth/password-reset.ts";
import { PostgresPasswordResetRepository } from "../../../src/server/auth/password-reset-postgres-repository.ts";
import { createPasswordResetHttpHandlers } from "../../../src/server/auth/password-reset-http.ts";
import { SignInContinuationService } from "../../../src/server/auth/continuations.ts";
import { PostgresSignInContinuationRepository } from "../../../src/server/auth/continuations-postgres-repository.ts";
import { createSignInContinuationHttpHandlers } from "../../../src/server/auth/continuations-http.ts";
import { createPostgresAuthCredentialsService } from "../../../src/server/auth/runtime/routes.ts";
import { createPostgresPasswordResetService } from "../../../src/server/auth/password-reset-http.ts";

const password = "Synthetic-original-password-826";
const newPassword = "  Synthetic reset password  ";
const digest = (token) => `sha256:${createHash("sha256").update(token).digest("hex")}`;
function legacyPasswordHash(value) {
  const salt = randomBytes(16).toString("base64url");
  return `scrypt$${salt}$${scryptSync(value, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 }).toString("base64url")}`;
}
const guestCookies = new Map();
function guestCookie(alias) {
  if (!guestCookies.has(alias)) guestCookies.set(alias, issueGuestSession().token);
  return guestCookies.get(alias);
}
const request = (body, token, guest) => new Request("https://cuac.test/api/v1/auth/challenge", {
  method: "POST", headers: { "content-type": "application/json", cookie: [token && `cuac_session=${token}`, guest && `cuac_guest=${guestCookie(guest)}`].filter(Boolean).join("; ") }, body: JSON.stringify(body),
});

export async function runAuthChallengesRehearsal(t, pool) {
  const client = createTransactionalSqlClient(pool);
  const auth = new PostgresAuthSessionRepository(client);
  const credentials = new AuthCredentialsService(auth);
  const audit = new PostgresAuditWriter(client);
  const verificationRepository = new PostgresEmailVerificationRepository(client);
  const resetRepository = new PostgresPasswordResetRepository(client);
  const continuationRepository = new PostgresSignInContinuationRepository(client);
  const deliveries = [];
  const deliverySink = { async enqueue(input) { deliveries.push(input); } };
  const verification = new EmailVerificationService(verificationRepository, { deliverySink, auditSink: audit });
  const reset = new PasswordResetService(resetRepository, { deliverySink, auditSink: audit });
  const verificationHttp = createEmailVerificationHttpHandlers(verification, auth);
  const resetHttp = createPasswordResetHttpHandlers(reset, auth);
  const continuation = new SignInContinuationService(continuationRepository, { auditSink: audit });
  const continuationHttp = createSignInContinuationHttpHandlers(continuation, auth);
  async function user() {
    const email = `challenge-${randomUUID()}@example.invalid`;
    return { ...await credentials.registerStudent({ email, password }), email };
  }
  async function challenge(account, type) {
    const response = type === "verify"
      ? await verificationHttp.requestVerification(request({}, account.sessionToken))
      : await resetHttp.requestReset(request({ email: account.email }));
    assert.equal(response.status, 200);
    return deliveries.at(-1);
  }
  function observeTransaction() {
    let started;
    const pid = new Promise((resolve) => { started = resolve; });
    return { pid, client: { ...client, transaction(work) {
      return client.transaction(async (sql) => {
        started((await sql.query("select pg_backend_pid() as pid", []))[0].pid);
        return work(sql);
      });
    } } };
  }
  async function waitForLock(pid) {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const { rows } = await pool.query("select wait_event_type from pg_stat_activity where pid = $1", [pid]);
      if (rows[0]?.wait_event_type === "Lock") return;
      await delay(20);
    }
    assert.fail("request did not reach the expected database lock barrier");
  }

  function pausedHasher(method, parties = 1) {
    let enter, release;
    let arrived = 0;
    const entered = new Promise(resolve => { enter = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    const real = { hash: hashPassword, verify: verifyPassword, verifyForLogin: verifyPasswordForLogin };
    return { entered, release, hasher: { ...real, async [method](...input) {
      const result = await real[method](...input);
      arrived += 1;
      if (arrived === parties) enter();
      await gate;
      return result;
    } } };
  }

  await t.test("registration remains atomic when another account wins during async password work", async () => {
    const email = `hash-race-${randomUUID()}@example.invalid`;
    const requestId = randomUUID();
    const paused = pausedHasher("hash");
    const service = createPostgresAuthCredentialsService(client, { passwordHasher: paused.hasher });
    const attempt = Promise.allSettled([service.registerStudent({ email, password }, requestId)]);
    try {
      await Promise.race([paused.entered, attempt.then(() => assert.fail("registration did not await password work"))]);
      const winner = await createPostgresAuthCredentialsService(client).registerStudent({ email, password });
      paused.release();
      const result = (await attempt)[0];
      assert.equal(result.status, "rejected");
      assert.equal(result.reason.code, "23505");
      assert.deepEqual((await pool.query("select id from users where email_normalized = $1", [email])).rows, [{ id: winner.userId }]);
      assert.equal((await pool.query("select count(*)::int as n from auth_sessions where user_id = $1", [winner.userId])).rows[0].n, 1);
      assert.equal((await pool.query("select count(*)::int as n from audit_logs where request_id = $1", [requestId])).rows[0].n, 0);
    } finally {
      paused.release();
      await attempt;
    }
  });

  await t.test("successful legacy login upgrades one credential without revoking existing sessions", async () => {
    const a = await user();
    const oldHash = legacyPasswordHash(password);
    await pool.query("update auth_identities set password_hash = $2 where user_id = $1 and provider = 'password'", [a.userId, oldHash]);
    const before = (await pool.query("select count(*)::int as n from auth_sessions where user_id = $1 and revoked_at is null", [a.userId])).rows[0].n;
    const requestId = randomUUID();
    const login = await createPostgresAuthCredentialsService(client).createStudentSession({ email: a.email, password }, requestId);
    const identity = await auth.findPasswordIdentityByEmailNormalized(a.email);
    assert.match(identity.passwordHash, /^scrypt\$v2\$32768\$8\$3\$/);
    assert.notEqual(identity.passwordHash, oldHash);
    assert.equal(await verifyPassword(password, identity.passwordHash), true);
    assert.equal((await pool.query("select count(*)::int as n from auth_sessions where user_id = $1 and revoked_at is null", [a.userId])).rows[0].n, before + 1);
    assert.ok(await auth.findActiveSessionByTokenHash(hashSessionToken(a.sessionToken), new Date()));
    assert.ok(await auth.findActiveSessionByTokenHash(hashSessionToken(login.sessionToken), new Date()));
    assert.deepEqual((await pool.query("select metadata_json from audit_logs where request_id = $1", [requestId])).rows[0].metadata_json, { selectedSurface: "student", credentialUpgrade: "scrypt_v2" });
    const currentRequestId = randomUUID();
    await createPostgresAuthCredentialsService(client).createStudentSession({ email: a.email, password }, currentRequestId);
    assert.deepEqual((await pool.query("select metadata_json from audit_logs where request_id = $1", [currentRequestId])).rows[0].metadata_json, { selectedSurface: "student" });
  });

  await t.test("legacy login cannot overwrite a password reset committed while upgrade proof is pending", async () => {
    const a = await user();
    await pool.query("update auth_identities set password_hash = $2 where user_id = $1 and provider = 'password'", [a.userId, legacyPasswordHash(password)]);
    const sent = await challenge(a, "reset");
    const requestId = randomUUID();
    const paused = pausedHasher("verifyForLogin");
    const service = createPostgresAuthCredentialsService(client, { passwordHasher: paused.hasher });
    const attempt = Promise.allSettled([service.createStudentSession({ email: a.email, password }, requestId)]);
    try {
      await Promise.race([paused.entered, attempt.then(() => assert.fail("login did not await password work"))]);
      await createPostgresPasswordResetService(client).resetPassword(createRequestContext(), sent.challengeId, sent.resetToken, newPassword);
      paused.release();
      const result = (await attempt)[0];
      assert.equal(result.status, "rejected");
      assert.equal(result.reason.status, 403);
      assert.equal(await verifyPassword(newPassword, (await auth.findPasswordIdentityByEmailNormalized(a.email)).passwordHash), true);
      assert.equal((await pool.query("select count(*)::int as n from auth_sessions where user_id = $1 and revoked_at is null", [a.userId])).rows[0].n, 0);
      assert.equal((await pool.query("select count(*)::int as n from audit_logs where request_id = $1", [requestId])).rows[0].n, 0);
    } finally {
      paused.release();
      await attempt;
    }
  });

  await t.test("competing legacy logins serialize to one upgrade and require explicit reauthentication", async () => {
    const a = await user();
    const oldHash = legacyPasswordHash(password);
    await pool.query("update auth_identities set password_hash = $2 where user_id = $1 and provider = 'password'", [a.userId, oldHash]);
    const paused = pausedHasher("verifyForLogin", 2);
    const service = createPostgresAuthCredentialsService(client, { passwordHasher: paused.hasher });
    const requestIds = [randomUUID(), randomUUID()];
    const attempts = requestIds.map(requestId => service.createStudentSession({ email: a.email, password }, requestId));
    const settled = Promise.allSettled(attempts);
    try {
      await Promise.race([paused.entered, settled.then(() => assert.fail("both legacy proofs did not reach the transaction barrier"))]);
      paused.release();
      const results = await settled;
      assert.deepEqual(results.map(result => result.status).sort(), ["fulfilled", "rejected"]);
      assert.equal(results.find(result => result.status === "rejected").reason.status, 403);
      const identity = await auth.findPasswordIdentityByEmailNormalized(a.email);
      assert.match(identity.passwordHash, /^scrypt\$v2\$32768\$8\$3\$/);
      assert.equal(await verifyPassword(password, identity.passwordHash), true);
      assert.equal((await pool.query("select count(*)::int as n from audit_logs where request_id = any($1::text[])", [requestIds])).rows[0].n, 1);
      assert.equal((await pool.query("select count(*)::int as n from auth_sessions where user_id = $1 and revoked_at is null", [a.userId])).rows[0].n, 2);
      await createPostgresAuthCredentialsService(client).createStudentSession({ email: a.email, password }, randomUUID());
      assert.equal((await pool.query("select count(*)::int as n from auth_sessions where user_id = $1 and revoked_at is null", [a.userId])).rows[0].n, 3);
    } finally {
      paused.release();
      await settled;
    }
  });

  await t.test("reset rechecks database expiry after awaited password work without consuming the challenge", async () => {
    const a = await user();
    const sent = await challenge(a, "reset");
    const context = createRequestContext();
    const paused = pausedHasher("hash");
    const service = createPostgresPasswordResetService(client, { passwordHasher: paused.hasher });
    const attempt = Promise.allSettled([service.resetPassword(context, sent.challengeId, sent.resetToken, newPassword)]);
    try {
      await Promise.race([paused.entered, attempt.then(() => assert.fail("reset did not await password work"))]);
      await pool.query("update password_reset_challenges set expires_at = clock_timestamp() where id = $1", [sent.challengeId]);
      paused.release();
      const result = (await attempt)[0];
      assert.equal(result.status, "rejected");
      assert.equal(result.reason.status, 400);
      assert.equal(await verifyPassword(password, (await auth.findPasswordIdentityByEmailNormalized(a.email)).passwordHash), true);
      assert.equal((await pool.query("select status from password_reset_challenges where id = $1", [sent.challengeId])).rows[0].status, "pending");
      assert.ok(await auth.findActiveSessionByTokenHash(hashSessionToken(a.sessionToken), new Date()));
      assert.equal((await pool.query("select count(*)::int as n from audit_logs where request_id = $1", [context.requestId])).rows[0].n, 0);
    } finally {
      paused.release();
      await attempt;
    }
  });

  await t.test("verification HTTP proves only the challenged email and consumes its token once", async () => {
    const a = await user();
    const b = await user();
    const sent = await challenge(a, "verify");
    const row = (await pool.query("select verification_token_hash from email_verification_challenges where id = $1", [sent.challengeId])).rows[0];
    assert.equal(row.verification_token_hash, digest(sent.verificationToken));
    assert.equal((await verificationHttp.verifyEmail(request({ verificationToken: "wrong" }), sent.challengeId)).status, 400);
    const responses = await Promise.all([0, 1].map(() => verificationHttp.verifyEmail(request({ verificationToken: sent.verificationToken, userId: b.userId }), sent.challengeId)));
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 400]);
    assert.ok((await verificationRepository.findVerificationTargetByUserId(a.userId)).emailVerifiedAt);
    assert.equal((await verificationRepository.findVerificationTargetByUserId(b.userId)).emailVerifiedAt, null);
    const logs = await pool.query("select metadata_json from audit_logs where resource_id = $1", [sent.challengeId]);
    assert.ok(logs.rows.length >= 2);
    assert.equal(JSON.stringify(logs.rows).includes(sent.verificationToken), false);
  });

  await t.test("verification final mutation rejects changed email, disabled account, wrong token and expiry after preflight", async () => {
    for (const change of ["email", "disabled", "token", "expired"]) {
      const a = await user();
      const sent = await challenge(a, "verify");
      const now = new Date();
      assert.ok(await verificationRepository.findActiveEmailVerificationChallenge({ challengeId: sent.challengeId, verificationTokenHash: digest(sent.verificationToken), now }));
      if (change === "email") await pool.query("update users set email_normalized = $2 where id = $1", [a.userId, `changed-${randomUUID()}@example.invalid`]);
      if (change === "disabled") await pool.query("update users set account_status = 'disabled' where id = $1", [a.userId]);
      if (change === "expired") await pool.query("update email_verification_challenges set expires_at = now() - interval '1 second' where id = $1", [sent.challengeId]);
      const result = await verificationRepository.markEmailVerified({ challengeId: sent.challengeId, userId: a.userId, verificationTokenHash: digest(change === "token" ? "wrong" : sent.verificationToken), now });
      assert.equal(result.verified, false, change);
      assert.equal((await verificationRepository.findVerificationTargetByUserId(a.userId)).emailVerifiedAt, null);
    }
  });

  await t.test("verification failure rolls back challenge consumption", async () => {
    const a = await user();
    const sent = await challenge(a, "verify");
    const constraint = `rehearsal_verify_${a.userId.replaceAll("-", "")}`;
    await pool.query(`alter table users add constraint ${constraint} check (id <> '${a.userId}'::uuid or email_verified_at is null)`);
    try {
      assert.equal((await verificationHttp.verifyEmail(request({ verificationToken: sent.verificationToken }), sent.challengeId)).status, 500);
      assert.equal((await pool.query("select status from email_verification_challenges where id = $1", [sent.challengeId])).rows[0].status, "pending");
    } finally {
      await pool.query(`alter table users drop constraint ${constraint}`);
    }
  });

  await t.test("password reset HTTP returns the same public response for present and missing accounts", async () => {
    const a = await user();
    const existing = await resetHttp.requestReset(request({ email: a.email }));
    const missing = await resetHttp.requestReset(request({ email: `missing-${randomUUID()}@example.invalid` }));
    assert.equal(existing.status, missing.status);
    assert.deepEqual(await existing.json(), await missing.json());
  });

  await t.test("reset consumes once, preserves password bytes, revokes old sessions and invalidates other reset links", async () => {
    const a = await user();
    const b = await user();
    const first = await challenge(a, "reset");
    const second = await challenge(a, "reset");
    const responses = await Promise.all([0, 1].map(() => resetHttp.resetPassword(request({ resetToken: first.resetToken, newPassword, userId: b.userId }), first.challengeId)));
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 400]);
    const identity = await auth.findPasswordIdentityByEmailNormalized(a.email);
    assert.equal(await verifyPassword(newPassword, identity.passwordHash), true);
    assert.equal(await auth.findActiveSessionByTokenHash(hashSessionToken(a.sessionToken), new Date()), null);
    assert.ok(await auth.findActiveSessionByTokenHash(hashSessionToken(b.sessionToken), new Date()));
    assert.equal((await resetHttp.resetPassword(request({ resetToken: second.resetToken, newPassword: "Unwanted-replay-password" }), second.challengeId)).status, 400);
  });

  await t.test("reset failure rolls back password, token and session changes together", async () => {
    const a = await user();
    const sent = await challenge(a, "reset");
    const constraint = `rehearsal_reset_${a.userId.replaceAll("-", "")}`;
    await pool.query(`alter table auth_sessions add constraint ${constraint} check (user_id <> '${a.userId}'::uuid or revoked_at is null)`);
    try {
      assert.equal((await resetHttp.resetPassword(request({ resetToken: sent.resetToken, newPassword }), sent.challengeId)).status, 500);
      assert.equal(await verifyPassword(password, (await auth.findPasswordIdentityByEmailNormalized(a.email)).passwordHash), true);
      assert.equal((await pool.query("select status from password_reset_challenges where id = $1", [sent.challengeId])).rows[0].status, "pending");
      assert.ok(await auth.findActiveSessionByTokenHash(hashSessionToken(a.sessionToken), new Date()));
    } finally {
      await pool.query(`alter table auth_sessions drop constraint ${constraint}`);
    }
  });

  await t.test("reset mutation rejects changed email, disabled account, wrong token and expiry after preflight", async () => {
    for (const change of ["email", "disabled", "token", "expired"]) {
      const a = await user();
      const sent = await challenge(a, "reset");
      const now = new Date();
      if (change === "email") await pool.query("update users set email_normalized = $2 where id = $1", [a.userId, `changed-${randomUUID()}@example.invalid`]);
      if (change === "disabled") await pool.query("update users set account_status = 'disabled' where id = $1", [a.userId]);
      if (change === "expired") await pool.query("update password_reset_challenges set expires_at = now() - interval '1 second' where id = $1", [sent.challengeId]);
      const result = await resetRepository.consumePasswordReset({ challengeId: sent.challengeId, userId: a.userId, resetTokenHash: digest(change === "token" ? "wrong" : sent.resetToken), passwordHash: await hashPassword(newPassword), now });
      assert.equal(result.reset, false, change);
      const stored = (await pool.query("select password_hash from auth_identities where user_id = $1", [a.userId])).rows[0];
      assert.equal(await verifyPassword(password, stored.password_hash), true);
    }
  });

  await t.test("login cannot issue a session from password proof captured before a reset", async () => {
    const a = await user();
    const proof = await auth.findPasswordIdentityByEmailNormalized(a.email);
    const sent = await challenge(a, "reset");
    assert.equal((await resetHttp.resetPassword(request({ resetToken: sent.resetToken, newPassword }), sent.challengeId)).status, 200);
    const now = new Date();
    await assert.rejects(auth.createSession({ userId: a.userId, expectedPasswordHash: proof.passwordHash, sessionTokenHash: digest(randomUUID()), requestedSurface: "student", requestedSchoolId: null, authStrength: "session", expiresAt: new Date(now.getTime() + 60_000), ipHash: null, userAgentHash: null, now }), (error) => error.status === 403);
  });

  await t.test("password reset and login serialize in both lock orders without leaving an old-password session", async () => {
    for (const first of ["login", "reset"]) {
      const a = await user();
      const proof = await auth.findPasswordIdentityByEmailNormalized(a.email);
      const sent = await challenge(a, "reset");
      const now = new Date();
      const sessionTokenHash = digest(randomUUID());
      const loginInput = { userId: a.userId, expectedPasswordHash: proof.passwordHash, sessionTokenHash, requestedSurface: "student", requestedSchoolId: null, authStrength: "session", expiresAt: new Date(now.getTime() + 60_000), ipHash: null, userAgentHash: null, now };
      const resetInput = { challengeId: sent.challengeId, userId: a.userId, resetTokenHash: digest(sent.resetToken), passwordHash: await hashPassword(newPassword), now };
      let release;
      let locked;
      const gate = new Promise((resolve) => { release = resolve; });
      const atMutation = new Promise((resolve) => { locked = resolve; });
      const pausingClient = { ...client, transaction(work) {
        return client.transaction((sql) => work({ async query(statement, params) {
          const rows = await sql.query(statement, params);
          if (statement.includes(first === "login" ? "insert into auth_sessions" : "update auth_identities")) {
            locked();
            await gate;
          }
          return rows;
        } }));
      } };
      const firstAttempt = Promise.allSettled([first === "login"
        ? new PostgresAuthSessionRepository(pausingClient).createSession(loginInput)
        : new PostgresPasswordResetRepository(pausingClient).consumePasswordReset(resetInput)]);
      let secondAttempt;
      try {
        await Promise.race([atMutation, firstAttempt.then(() => { throw new Error("first transaction did not pause at mutation"); })]);
        const observed = observeTransaction();
        secondAttempt = Promise.allSettled([first === "login"
          ? new PostgresPasswordResetRepository(observed.client).consumePasswordReset(resetInput)
          : new PostgresAuthSessionRepository(observed.client).createSession(loginInput)]);
        await waitForLock(await observed.pid);
        release();
        assert.equal((await firstAttempt)[0].status, "fulfilled", first);
        const second = (await secondAttempt)[0];
        if (first === "login") {
          assert.equal(second.status, "fulfilled");
          assert.equal(second.value.reset, true);
          assert.equal(second.value.revokedSessionCount, 2);
        } else {
          assert.equal(second.status, "rejected");
          assert.equal(second.reason.status, 403);
        }
        assert.equal(await auth.findActiveSessionByTokenHash(sessionTokenHash, new Date()), null);
        assert.equal(await verifyPassword(newPassword, (await auth.findPasswordIdentityByEmailNormalized(a.email)).passwordHash), true);
      } finally {
        release();
        await firstAttempt;
        if (secondAttempt) await secondAttempt;
      }
    }
  });

  await t.test("challenge expiry while waiting for a user lock is checked against the database clock", async () => {
    for (const kind of ["verify", "reset"]) {
      const a = await user();
      const sent = await challenge(a, kind);
      const blocker = await pool.connect();
      let attempt;
      try {
        await blocker.query("begin");
        await blocker.query("select id from users where id = $1 for update", [a.userId]);
        const now = new Date();
        const observed = observeTransaction();
        attempt = Promise.allSettled([kind === "verify"
          ? new PostgresEmailVerificationRepository(observed.client).markEmailVerified({ challengeId: sent.challengeId, userId: a.userId, verificationTokenHash: digest(sent.verificationToken), now })
          : new PostgresPasswordResetRepository(observed.client).consumePasswordReset({ challengeId: sent.challengeId, userId: a.userId, resetTokenHash: digest(sent.resetToken), passwordHash: await hashPassword(newPassword), now })]);
        await waitForLock(await observed.pid);
        const table = kind === "verify" ? "email_verification_challenges" : "password_reset_challenges";
        await blocker.query(`update ${table} set expires_at = clock_timestamp() where id = $1`, [sent.challengeId]);
        await blocker.query("commit");
        const result = (await attempt)[0];
        assert.equal(result.status, "fulfilled");
        assert.equal(kind === "verify" ? result.value.verified : result.value.reset, false);
        assert.equal((await pool.query(`select status from ${table} where id = $1`, [sent.challengeId])).rows[0].status, "pending");
        assert.equal(await verifyPassword(password, (await auth.findPasswordIdentityByEmailNormalized(a.email)).passwordHash), true);
      } finally {
        await blocker.query("rollback");
        blocker.release();
        if (attempt) await attempt;
      }
    }
  });

  await t.test("continuation binds to its guest browser, returns preview once and never writes an application", async () => {
    const a = await user();
    const guest = randomUUID();
    const created = await continuationHttp.create(request({ targetRoute: "/application.html#add-choice", actionKey: "application.add_choice", payloadPreview: { programId: randomUUID() } }, null, guest));
    assert.equal(created.status, 200);
    const data = (await created.json()).data;
    const consume = (browser, token = data.continuationToken) => continuationHttp.consume(request({ continuationToken: token }, a.sessionToken, browser), data.continuationId);
    assert.equal((await consume(randomUUID())).status, 403);
    assert.equal((await consume(guest, "wrong")).status, 400);
    const responses = await Promise.all([consume(guest), consume(guest)]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 400]);
    assert.equal((await pool.query("select count(*)::int as total from application_sets where user_id = $1", [a.userId])).rows[0].total, 0);
  });

  await t.test("continuation rejects missing browser binding, unsafe redirects and secret preview aliases", async () => {
    const base = { targetRoute: "/application.html#add-choice", actionKey: "application.add_choice" };
    assert.equal((await continuationHttp.create(request(base))).status, 400);
    for (const targetRoute of ["/\\evil.invalid/path", "/%5cevil.invalid/path", "/%2f/evil.invalid", "/\n/evil.invalid"]) {
      assert.equal((await continuationHttp.create(request({ ...base, targetRoute }, null, randomUUID()))).status, 400, targetRoute);
    }
    assert.equal((await continuationHttp.create(request({ ...base, payloadPreview: { password_hash: "secret" } }, null, randomUUID()))).status, 403);
    assert.equal((await continuationHttp.create(request({ ...base, payloadPreview: { notes: "private data" } }, null, randomUUID()))).status, 400);
    assert.equal((await continuationHttp.create(request({ ...base, targetRoute: "/application.html?token=secret" }, null, randomUUID()))).status, 400);
  });

  await t.test("continuation final mutation rechecks expiry, token and browser before consuming", async () => {
    const a = await user();
    for (const change of ["expired", "token", "browser", "role", "tenant", "disabled", "revoked_role"]) {
      const guest = randomUUID();
      const created = await continuation.createGuestContinuation(createRequestContext({ guestSessionId: guest }), { targetRoute: "/application.html#add-choice", actionKey: "application.add_choice" });
      const now = new Date();
      if (change === "expired") await pool.query("update sign_in_continuations set expires_at = now() - interval '1 second' where id = $1", [created.continuationId]);
      if (change === "tenant") await pool.query("update sign_in_continuations set tenant_school_id = (select id from schools limit 1) where id = $1", [created.continuationId]);
      if (change === "disabled") await pool.query("update users set account_status = 'disabled' where id = $1", [a.userId]);
      if (change === "revoked_role") {
        await pool.query("update users set account_status = 'active' where id = $1", [a.userId]);
        await pool.query("update user_roles set revoked_at = now() where user_id = $1", [a.userId]);
      }
      const result = await continuationRepository.markContinuationConsumed({ continuationId: created.continuationId, continuationTokenHash: digest(change === "token" ? "wrong" : created.continuationToken), consumedByUserId: a.userId, guestSessionId: change === "browser" ? randomUUID() : guest, activeRole: change === "role" ? "cuac_admin" : "student", now });
      assert.equal(result.consumed, false, change);
      assert.equal((await pool.query("select consumed_at from sign_in_continuations where id = $1", [created.continuationId])).rows[0].consumed_at, null);
    }
  });
}
