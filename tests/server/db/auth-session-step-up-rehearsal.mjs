import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { PostgresAuthSessionRepository } from "../../../src/server/auth/postgres-repository.ts";
import { createPostgresAuthCredentialsService } from "../../../src/server/auth/runtime/routes.ts";
import { createAuditFailureFixture } from "./audit-failure-fixture.mjs";
import { grantCuacStaffAccess } from "./cuac-staff-access-fixture.mjs";

export async function runAuthSessionStepUpRehearsal(t, pool) {
  await t.test("password reauthentication grants bounded step-up and expires back to session", async () => {
    const client = createTransactionalSqlClient(pool);
    const repository = new PostgresAuthSessionRepository(client);
    const suffix = randomUUID();
    const email = `step-up-${suffix}@example.invalid`;
    const passwordHash = `step-up-proof:${suffix}`;
    const token = randomBytes(32).toString("base64url");
    const tokenHash = `sha256:${createHash("sha256").update(token).digest("hex")}`;
    const createdAt = new Date(Date.now() - 60_000);
    const expiresAt = new Date(Date.now() + 60 * 60_000);
    const user = (await pool.query(`insert into users (email,email_normalized,account_status,created_at,updated_at)
      values ($1,$1,'active',$2,$2) returning id`, [email, createdAt])).rows[0];
    try {
      await pool.query(`insert into auth_identities
        (user_id,provider,provider_subject,password_hash,email_normalized,metadata_json,created_at,updated_at)
        values ($1,'password',$2,$3,$2,'{}'::jsonb,$4,$4)`, [user.id, email, passwordHash, createdAt]);
      await pool.query(`insert into user_roles (user_id,role,grant_source,created_at)
        values ($1,'student','step_up_rehearsal',$2)`, [user.id, createdAt]);
      const session = (await pool.query(`insert into auth_sessions
        (user_id,session_token_hash,selected_surface,active_role,auth_strength,created_at,last_seen_at,expires_at)
        values ($1,$2,'student','student','session',$3,$3,$4) returning id`,
      [user.id, tokenHash, createdAt, expiresAt])).rows[0];
      const service = createPostgresAuthCredentialsService(client, { passwordHasher: {
        async verifyForLogin(password, storedHash) {
          return { valid: password === "correct-password" && storedHash === passwordHash };
        },
      } });
      const result = await service.stepUpSession({ sessionToken: token, password: "correct-password" },
        `step-up-${randomUUID()}`);
      const databaseAfter = (await pool.query("select clock_timestamp() as now")).rows[0].now;
      assert.equal(result.userId, user.id);
      assert.equal(result.sessionId, session.id);
      assert.ok(result.stepUpExpiresAt > databaseAfter);
      assert.ok(result.stepUpExpiresAt.getTime() <= databaseAfter.getTime() + 600_000);
      assert.ok(result.stepUpExpiresAt <= expiresAt);
      assert.equal((await repository.findActiveSessionByTokenHash(tokenHash, new Date())).authStrength, "step_up");
      const stored = (await pool.query(`select auth_strength,step_up_expires_at from auth_sessions where id = $1`,
        [session.id])).rows[0];
      assert.equal(stored.auth_strength, "session");
      assert.equal(stored.step_up_expires_at.toISOString(), result.stepUpExpiresAt.toISOString());
      const audits = (await pool.query(`select action,metadata_json from audit_logs
        where action = 'auth.step_up' and resource_id = $1`, [session.id])).rows;
      assert.equal(audits.length, 1);
      assert.equal(audits[0].metadata_json.stepUpExpiresAt, result.stepUpExpiresAt.toISOString());
      assert.doesNotMatch(JSON.stringify(audits), /correct-password|step-up-proof/);

      await pool.query("update auth_sessions set step_up_expires_at = clock_timestamp() - interval '1 second' where id = $1",
        [session.id]);
      assert.equal((await repository.findActiveSessionByTokenHash(tokenHash, new Date())).authStrength, "session");
      const before = (await pool.query("select step_up_expires_at from auth_sessions where id = $1", [session.id])).rows[0];
      await assert.rejects(service.stepUpSession({ sessionToken: token, password: "wrong-password" }),
        error => error.status === 403);
      assert.deepEqual((await pool.query("select step_up_expires_at from auth_sessions where id = $1", [session.id])).rows[0], before);

      const fault = await createAuditFailureFixture(pool);
      try {
        await fault.during("auth.step_up", () => assert.rejects(
          service.stepUpSession({ sessionToken: token, password: "correct-password" }),
          error => error.code === "P0001",
        ));
        assert.deepEqual((await pool.query("select step_up_expires_at from auth_sessions where id = $1", [session.id])).rows[0], before);
      } finally {
        await fault.close();
      }
      await pool.query("update auth_sessions set revoked_at = clock_timestamp() where id = $1", [session.id]);
      await assert.rejects(service.stepUpSession({ sessionToken: token, password: "correct-password" }),
        error => error.status === 403);
      assert.equal(await repository.findActiveSessionByTokenHash(tokenHash, new Date()), null);
    } finally {
      await pool.query("delete from users where id = $1", [user.id]);
    }
  });

  await t.test("password reauthentication preserves an Ops persona and rejects a revoked live grant", async () => {
    const client = createTransactionalSqlClient(pool), repository = new PostgresAuthSessionRepository(client);
    const suffix = randomUUID(), email = `step-up-ops-${suffix}@example.invalid`;
    const passwordHash = `step-up-ops-proof:${suffix}`;
    const token = randomBytes(32).toString("base64url");
    const tokenHash = `sha256:${createHash("sha256").update(token).digest("hex")}`;
    const user = (await pool.query("insert into users (email,email_normalized) values ($1,$1) returning id", [email])).rows[0];
    let approverId;
    try {
      await pool.query(`insert into auth_identities
        (user_id,provider,provider_subject,password_hash,email_normalized,metadata_json)
        values ($1,'password',$2,$3,$2,'{}'::jsonb)`, [user.id, email, passwordHash]);
      await pool.query("insert into user_roles (user_id,role,grant_source) values ($1,'cuac_admin','step_up_rehearsal')", [user.id]);
      const grant = await grantCuacStaffAccess(pool, user.id, "cuac_admin");
      approverId = grant.approverId;
      const session = (await pool.query(`insert into auth_sessions
        (user_id,session_token_hash,selected_surface,active_role,auth_strength,expires_at)
        values ($1,$2,'ops','cuac_admin','session',clock_timestamp() + interval '1 hour') returning id`,
      [user.id, tokenHash])).rows[0];
      const service = createPostgresAuthCredentialsService(client, { passwordHasher: {
        async verifyForLogin(password, storedHash) {
          return { valid: password === "correct-password" && storedHash === passwordHash };
        },
      } });
      const result = await service.stepUpSession({ sessionToken: token, password: "correct-password" },
        `ops-step-up-${randomUUID()}`);
      assert.equal(result.activeRole, "cuac_admin");
      assert.equal(result.selectedSurface, "ops");
      assert.equal(result.tenantSchoolId, null);
      assert.equal((await repository.findActiveSessionByTokenHash(tokenHash, new Date())).authStrength, "step_up");
      const audit = (await pool.query("select active_role,tenant_school_id from audit_logs where action = 'auth.step_up' and resource_id = $1", [session.id])).rows[0];
      assert.deepEqual(audit, { active_role: "cuac_admin", tenant_school_id: null });

      await pool.query("update auth_sessions set step_up_expires_at = null where id = $1", [session.id]);
      await pool.query("update cuac_staff_access_grants set status = 'revoked', revoked_at = clock_timestamp() where id = $1", [grant.grantId]);
      await assert.rejects(service.stepUpSession({ sessionToken: token, password: "correct-password" }),
        error => error.status === 403);
      assert.equal((await repository.findActiveSessionByTokenHash(tokenHash, new Date())).authStrength, "session");
    } finally {
      await pool.query("delete from users where id = $1", [user.id]);
      if (approverId) await pool.query("delete from users where id = $1", [approverId]);
    }
  });

  await t.test("database rejects persistent or out-of-session step-up authority", async () => {
    const suffix = randomUUID(), email = `step-up-constraint-${suffix}@example.invalid`;
    const user = (await pool.query("insert into users (email,email_normalized) values ($1,$1) returning id", [email])).rows[0];
    try {
      await pool.query("insert into user_roles (user_id,role,grant_source) values ($1,'student','step_up_rehearsal')", [user.id]);
      await assert.rejects(pool.query(`insert into auth_sessions
        (user_id,session_token_hash,selected_surface,active_role,auth_strength,expires_at)
        values ($1,$2,'student','student','step_up',clock_timestamp() + interval '1 hour')`,
      [user.id, `sha256:${"1".repeat(64)}`]), error => error.code === "23514"
        && error.constraint === "auth_sessions_strength_check");
      await assert.rejects(pool.query(`insert into auth_sessions
        (user_id,session_token_hash,selected_surface,active_role,auth_strength,step_up_expires_at,expires_at)
        values ($1,$2,'student','student','session',clock_timestamp() + interval '2 hours',
          clock_timestamp() + interval '1 hour')`, [user.id, `sha256:${"2".repeat(64)}`]),
      error => error.code === "23514" && error.constraint === "auth_sessions_strength_check");
    } finally {
      await pool.query("delete from users where id = $1", [user.id]);
    }
  });
}
