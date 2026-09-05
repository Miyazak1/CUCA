import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID, scryptSync } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { createPostgresAuthCredentialsService } from "../../../src/server/auth/runtime/routes.ts";
import { createPostgresStudentService } from "../../../src/server/student/runtime/routes.ts";
import { createPostgresEmailVerificationService } from "../../../src/server/auth/email-verification-http.ts";
import { createPostgresPasswordResetService } from "../../../src/server/auth/password-reset-http.ts";
import { createPostgresSchoolStaffInviteService } from "../../../src/server/auth/school-invites-http.ts";
import { createPostgresSignInContinuationService } from "../../../src/server/auth/continuations-http.ts";
import { verifyPassword } from "../../../src/server/auth/credentials.ts";
import { createAuditFailureFixture, snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";
import { grantCuacStaffAccess } from "./cuac-staff-access-fixture.mjs";

const password = "Synthetic-audited-password-826";
const digest = value => `sha256:${createHash("sha256").update(value).digest("hex")}`;
function legacyPasswordHash(value) {
  const salt = randomBytes(16).toString("base64url");
  return `scrypt$${salt}$${scryptSync(value, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 }).toString("base64url")}`;
}

export async function runAuditAtomicityRehearsal(t, pool) {
  const client = createTransactionalSqlClient(pool);
  const credentials = createPostgresAuthCredentialsService(client);
  const students = createPostgresStudentService(client);
  const verification = createPostgresEmailVerificationService(client);
  const resets = createPostgresPasswordResetService(client);
  const invites = createPostgresSchoolStaffInviteService(client);
  const continuations = createPostgresSignInContinuationService(client);
  const fault = await createAuditFailureFixture(pool);
  const email = () => `audit-${randomUUID()}@example.invalid`;
  const account = async () => { const address = email(); return { ...await credentials.registerStudent({ email: address, password }), email: address }; };
  const context = user => createRequestContext({ actorUserId: user.userId, activeRole: "student", selectedSurface: "student", purpose: "student_action" });
  async function countAudit(action, requestId) {
    return (await pool.query("select count(*)::int as n from audit_logs where action = $1 and request_id = $2", [action, requestId])).rows[0].n;
  }
  async function rollbackThenRetry(action, requestId, work) {
    const before = await snapshotAuditedBusinessTables(pool);
    await fault.during(action, () => assert.rejects(work(), (error) => error.code === "P0001"));
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before, `${action} left a partial mutation`);
    assert.equal(await countAudit(action, requestId), 0);
    const result = await work();
    assert.equal(await countAudit(action, requestId), 1);
    return result;
  }
  async function blockedBy(pid, count = 1) {
    for (let attempt = 0; attempt < 300; attempt += 1) {
      const rows = (await pool.query(`with recursive blocked(pid) as (
        select pid from pg_stat_activity where datname = current_database()
          and state = 'active' and wait_event_type = 'Lock' and $1 = any(pg_blocking_pids(pid))
        union select activity.pid from pg_stat_activity activity join blocked on blocked.pid = any(pg_blocking_pids(activity.pid))
          where activity.datname = current_database() and activity.state = 'active' and activity.wait_event_type = 'Lock'
      ) select pid from blocked`, [pid])).rows;
      if (rows.length >= count) return rows;
      await delay(10);
    }
    assert.fail("School invite operations did not reach the real database lock barrier.");
  }
  try {
    await t.test("audit failure rolls back registration, identity, role and initial session; explicit retry succeeds", async () => {
      const requestId = randomUUID(), address = email();
      const result = await rollbackThenRetry("auth.register", requestId, () => credentials.registerStudent({ email: address, password }, requestId));
      const audit = (await pool.query("select * from audit_logs where request_id = $1", [requestId])).rows[0];
      assert.equal(audit.actor_user_id, result.userId);
      assert.equal(audit.resource_id, result.userId);
      assert.deepEqual(audit.metadata_json, { sessionId: result.sessionId });
      assert.equal(JSON.stringify(audit).includes(password), false);
      assert.equal(JSON.stringify(audit).includes(result.sessionToken), false);
    });
    await t.test("audit failure rolls back both a legacy credential upgrade and its new login session", async () => {
      const user = await account(), requestId = randomUUID();
      await pool.query("update auth_identities set password_hash = $2 where user_id = $1 and provider = 'password'", [user.userId, legacyPasswordHash(password)]);
      await rollbackThenRetry("auth.login", requestId, () => credentials.createStudentSession({ email: user.email, password }, requestId));
      const identity = (await pool.query("select password_hash from auth_identities where user_id = $1 and provider = 'password'", [user.userId])).rows[0];
      assert.match(identity.password_hash, /^scrypt\$v2\$32768\$8\$3\$/);
      assert.deepEqual((await pool.query("select metadata_json from audit_logs where request_id = $1", [requestId])).rows[0].metadata_json, { selectedSurface: "student", credentialUpgrade: "scrypt_v2" });
    });
    await t.test("audit failure rolls back logout and successful audit uses stored actor and role", async () => {
      const user = await account(), requestId = randomUUID();
      await pool.query("insert into user_roles (user_id, role) values ($1, 'cuac_ops')", [user.userId]);
      await pool.query("update auth_sessions set active_role = 'cuac_ops', selected_surface = 'ops' where id = $1", [user.sessionId]);
      await rollbackThenRetry("auth.logout", requestId, () => credentials.revokeSession(user.sessionToken, requestId));
      const audit = (await pool.query("select actor_user_id, active_role, resource_id from audit_logs where request_id = $1", [requestId])).rows[0];
      assert.deepEqual(audit, { actor_user_id: user.userId, active_role: "cuac_ops", resource_id: user.sessionId });
      assert.deepEqual(await credentials.revokeSession(user.sessionToken, requestId), { revoked: false });
      assert.equal(await countAudit("auth.logout", requestId), 1);
    });

    const student = await account();
    const schoolId = (await pool.query("select id from schools where status = 'active' limit 1")).rows[0].id;
    const set = await students.createOwnApplicationSet(context(student), { name: "Audit fixture" });
    await students.updateOwnProfile(context(student), { displayName: "Before audit failure" });
    await students.saveOwnItem(context(student), { entityType: "school", entityId: schoolId, notes: "Original notes" });
    for (const [action, call] of [
      ["student.profile.update", ctx => students.updateOwnProfile(ctx, { displayName: "PRIVATE_CHANGED_NAME", preferences: { teachingLanguage: "english" } })],
      ["student.saved_item.save", ctx => students.saveOwnItem(ctx, { entityType: "school", entityId: schoolId, notes: "PRIVATE_CHANGED_NOTES" })],
      ["student.application_set.create", ctx => students.createOwnApplicationSet(ctx, { name: "PRIVATE_SET_NAME" })],
      ["student.application_choice.add", ctx => students.addOwnApplicationChoice(ctx, { applicationSetId: set.id, schoolId, studentNotes: "PRIVATE_CHOICE_NOTES" })],
    ]) {
      await t.test(`audit failure rolls back ${action} including existing-row updates`, async () => {
        const ctx = context(student);
        await rollbackThenRetry(action, ctx.requestId, () => call(ctx));
        const audit = (await pool.query("select metadata_json from audit_logs where request_id = $1", [ctx.requestId])).rows;
        assert.doesNotMatch(JSON.stringify(audit), /PRIVATE_/);
      });
    }

    await t.test("audit failure rolls back verification challenge issuance", async () => {
      const ctx = context(await account());
      await rollbackThenRetry("auth.email_verification.request", ctx.requestId, () => verification.requestVerification(ctx));
    });
    await t.test("audit failure rolls back verification consumption and user email status together", async () => {
      const user = await account(), token = randomBytes(32).toString("base64url"), ctx = createRequestContext();
      const challenge = (await pool.query("insert into email_verification_challenges (user_id, email_normalized, verification_token_hash, expires_at) values ($1, $2, $3, now() + interval '5 minutes') returning id", [user.userId, user.email, digest(token)])).rows[0];
      await rollbackThenRetry("auth.email_verification.verify", ctx.requestId, () => verification.verifyEmail(ctx, challenge.id, token));
    });
    await t.test("audit failure rolls back reset challenge issuance", async () => {
      const user = await account(), ctx = createRequestContext();
      await rollbackThenRetry("auth.password_reset.request", ctx.requestId, () => resets.requestReset(ctx, { email: user.email }));
    });
    await t.test("audit failure rolls back reset password, session revocation and all pending links", async () => {
      const user = await account(), token = randomBytes(32).toString("base64url"), ctx = createRequestContext();
      await credentials.createStudentSession({ email: user.email, password });
      await resets.requestReset(createRequestContext(), { email: user.email });
      const challenge = (await pool.query("insert into password_reset_challenges (user_id, email_normalized, reset_token_hash, expires_at) values ($1, $2, $3, now() + interval '5 minutes') returning id", [user.userId, user.email, digest(token)])).rows[0];
      const nextPassword = "  Synthetic audited reset password  ";
      await rollbackThenRetry("auth.password_reset.consume", ctx.requestId, () => resets.resetPassword(ctx, challenge.id, token, nextPassword));
      const identity = (await pool.query("select password_hash from auth_identities where user_id = $1", [user.userId])).rows[0];
      assert.equal(await verifyPassword(nextPassword, identity.password_hash), true);
      assert.equal((await pool.query("select count(*)::int as n from auth_sessions where user_id = $1 and revoked_at is null", [user.userId])).rows[0].n, 0);
    });

    const manager = await account();
    await pool.query("insert into user_roles (user_id, role) values ($1, 'cuac_ops')", [manager.userId]);
    await grantCuacStaffAccess(pool, manager.userId, "cuac_ops");
    const ops = () => createRequestContext({ actorUserId: manager.userId, activeRole: "cuac_ops", selectedSurface: "ops", purpose: "ops_support" });
    await t.test("audit failure rolls back invite replacement and restores the prior pending invitation", async () => {
      const address = email(), ctx = ops();
      const input = { schoolId, email: address, role: "viewer" };
      await invites.createInvite(ops(), input);
      await rollbackThenRetry("auth.school_staff_invite.create", ctx.requestId, () => invites.createInvite(ctx, input));
    });
    await t.test("audit failure rolls back invite revocation", async () => {
      const invite = await invites.createInvite(ops(), { schoolId, email: email(), role: "viewer" }), ctx = ops();
      await rollbackThenRetry("auth.school_staff_invite.revoke", ctx.requestId, () => invites.revokeInvite(ctx, invite.inviteId));
    });
    await t.test("audit failure rolls back invite acceptance, school membership and account role together", async () => {
      const teacher = await account(), token = randomBytes(32).toString("base64url"), ctx = context(teacher);
      const invite = await invites.createInvite(ops(), { schoolId, email: teacher.email, role: "viewer" });
      await pool.query("update school_staff_invites set token_hash = $2 where id = $1", [invite.inviteId, digest(token)]);
      const grant = await rollbackThenRetry("auth.school_staff_invite.accept", ctx.requestId, () => invites.acceptInvite(ctx, invite.inviteId, token));
      assert.equal(grant.role, "viewer");
      assert.equal(grant.userId, teacher.userId);
    });
    await t.test("school invite creation holds live CUAC authority through its successful audit and commit", async () => {
      const raceManager = await account();
      await pool.query("insert into user_roles (user_id, role) values ($1, 'cuac_ops')", [raceManager.userId]);
      const raceGrant = await grantCuacStaffAccess(pool, raceManager.userId, "cuac_ops");
      const raceContext = createRequestContext({ actorUserId: raceManager.userId, activeRole: "cuac_ops", selectedSurface: "ops", purpose: "ops_support" });
      const blocker = await pool.connect(); let invitation, revocation;
      try {
        await blocker.query("begin");
        await blocker.query("select id from schools where id = $1 for update", [schoolId]);
        const blockerPid = (await blocker.query("select pg_backend_pid() as pid")).rows[0].pid;
        invitation = invites.createInvite(raceContext, { schoolId, email: email(), role: "viewer" });
        invitation.catch(() => {});
        await blockedBy(blockerPid);
        revocation = pool.query(
          "update cuac_staff_access_grants set status = 'revoked', revoked_at = clock_timestamp() where id = $1",
          [raceGrant.grantId],
        );
        await blockedBy(blockerPid, 2);
        await blocker.query("commit");
        assert.ok((await invitation).inviteId);
        await revocation;
        await assert.rejects(
          invites.createInvite({ ...raceContext, requestId: randomUUID() }, { schoolId, email: email(), role: "viewer" }),
          error => error.status === 403,
        );
      } finally {
        await blocker.query("rollback");
        blocker.release();
        if (invitation || revocation) await Promise.allSettled([invitation, revocation].filter(Boolean));
      }
    });

    const guestSessionId = digest(randomUUID());
    const guest = createRequestContext({ guestSessionId });
    let continuation;
    await t.test("audit failure rolls back guest continuation creation", async () => {
      continuation = await rollbackThenRetry("auth.sign_in_continuation.create", guest.requestId, () => continuations.createGuestContinuation(guest, { targetRoute: "/application.html#add-choice", actionKey: "application.add_choice" }));
    });
    await t.test("audit failure rolls back continuation consumption and explicit retry consumes once", async () => {
      const ctx = createRequestContext({ actorUserId: student.userId, activeRole: "student", guestSessionId });
      await rollbackThenRetry("auth.sign_in_continuation.consume", ctx.requestId, () => continuations.consumeContinuation(ctx, continuation.continuationId, continuation.continuationToken));
      await assert.rejects(continuations.consumeContinuation(ctx, continuation.continuationId, continuation.continuationToken), (error) => error.status === 400);
      assert.equal(await countAudit("auth.sign_in_continuation.consume", ctx.requestId), 1);
    });
  } finally {
    await fault.close();
  }
}
