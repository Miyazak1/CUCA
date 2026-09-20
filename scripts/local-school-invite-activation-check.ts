import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";

import { PostgresAuthSessionRepository } from "../src/server/auth/postgres-repository.ts";
import { PostgresSchoolStaffInviteRepository } from "../src/server/auth/school-invites-postgres-repository.ts";
import { assertLocalDevelopmentState, localSyntheticAccounts, type LocalDevelopmentState } from "./lib/local-development.ts";

const runtimeValue = JSON.parse(await readFile(new URL("../.cuac-local/runtime.json", import.meta.url), "utf8")) as unknown;
assertLocalDevelopmentState(runtimeValue);
const runtime: LocalDevelopmentState = runtimeValue;
assert.ok(Number.isInteger(runtime.postgresPort) && runtime.postgresPort > 0);
assert.ok(runtime.databaseUser && runtime.databaseName && runtime.databasePassword);

const pool = new pg.Pool({
  host: "127.0.0.1",
  port: runtime.postgresPort,
  user: runtime.databaseUser,
  database: runtime.databaseName,
  password: runtime.databasePassword,
  max: 1,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 10_000,
});
const connection = await pool.connect();

try {
  const accounts = localSyntheticAccounts(runtime);
  for (const [account, expectedRole] of [
    [accounts.student, "student"],
    [accounts.school, "school_staff"],
    [accounts.ops, "cuac_ops"],
    [accounts.admin, "cuac_admin"],
  ] as const) {
    const roles = await connection.query<{ role: string }>(
      `select r.role from users u
       join user_roles r on r.user_id = u.id and r.revoked_at is null
       where u.email_normalized = $1 order by r.role`,
      [account.email.toLowerCase()],
    );
    assert.deepEqual(roles.rows, [{ role: expectedRole }]);
  }
  await connection.query("begin");
  const suffix = randomUUID();
  const invitedEmail = `activation-check-${suffix}@example.invalid`;
  const inviterEmail = `activation-manager-${suffix}@example.invalid`;
  const tokenHash = `sha256:${createHash("sha256").update(randomUUID()).digest("hex")}`;
  const { rows: [school] } = await connection.query<{ id: string }>(
    "insert into schools (slug, name_en, status) values ($1, 'Activation Check School', 'active') returning id",
    [`activation-check-${suffix}`],
  );
  const { rows: [inviter] } = await connection.query<{ id: string }>(
    "insert into users (email, email_normalized) values ($1, $1) returning id",
    [inviterEmail],
  );
  const now = new Date();
  const { rows: [invite] } = await connection.query<{ id: string }>(
    `insert into school_staff_invites (
       school_id, email, email_normalized, role, token_hash, status,
       invited_by_user_id, expires_at, created_at, updated_at
     ) values ($1, $2, $2, 'school_admin', $3, 'pending', $4, $5, $6, $6)
     returning id`,
    [school.id, invitedEmail, tokenHash, inviter.id, new Date(now.getTime() + 60_000), now],
  );
  const repository = new PostgresSchoolStaffInviteRepository({
    async query<T extends Record<string, unknown>>(statement: string, params: readonly unknown[]) {
      return (await connection.query(statement, [...params])).rows as T[];
    },
    async transaction<T>(work: (client: never) => Promise<T>) {
      return work(this as never);
    },
  });

  const activated = await repository.activateInviteForNewAccount({
    inviteId: invite.id,
    inviteTokenHash: tokenHash,
    schoolId: school.id,
    role: "school_admin",
    invitedByUserId: inviter.id,
    passwordHash: "scrypt$local-transaction-check",
    displayName: "Activation Check",
    activatedAt: new Date(),
  });
  assert.ok(activated);
  assert.equal(activated.emailNormalized, invitedEmail);
  const roles = await connection.query<{ role: string }>("select role from user_roles where user_id = $1 and revoked_at is null", [activated.userId]);
  assert.deepEqual(roles.rows, [{ role: "school_staff" }]);
  const account = await connection.query<{ email_verified_at: Date | null }>("select email_verified_at from users where id = $1", [activated.userId]);
  assert.ok(account.rows[0]?.email_verified_at);
  assert.equal(await repository.activateInviteForNewAccount({
    inviteId: invite.id,
    inviteTokenHash: tokenHash,
    schoolId: school.id,
    role: "school_admin",
    invitedByUserId: inviter.id,
    passwordHash: "scrypt$local-transaction-check",
    displayName: null,
    activatedAt: new Date(),
  }), null);
  const sessionRepository = new PostgresAuthSessionRepository({
    async query<T extends Record<string, unknown>>(statement: string, params: readonly unknown[]) {
      return (await connection.query(statement, [...params])).rows as T[];
    },
    async transaction<T>(work: (client: never) => Promise<T>) {
      return work(this as never);
    },
  });
  const sessionTokenHash = `sha256:${createHash("sha256").update(randomUUID()).digest("hex")}`;
  await connection.query(
    `insert into auth_sessions (
       user_id, session_token_hash, selected_surface, active_role,
       tenant_school_id, auth_strength, created_at, expires_at
     ) values ($1, $2, 'school', 'school_staff', $3, 'session', now(), now() + interval '1 hour')`,
    [activated.userId, sessionTokenHash, school.id],
  );
  assert.equal((await sessionRepository.findActiveSessionByTokenHash(sessionTokenHash, new Date()))?.activeRole, "school_staff");
  await connection.query(
    "update school_staff_memberships set status = 'removed', removed_at = now() where user_id = $1 and school_id = $2",
    [activated.userId, school.id],
  );
  assert.equal(await sessionRepository.findActiveSessionByTokenHash(sessionTokenHash, new Date()), null);
  console.log(JSON.stringify({
    ok: true,
    fixtureRolesIsolated: true,
    studentRoleGranted: false,
    replayConsumed: true,
    membershipRevokesSession: true,
  }));
} finally {
  await connection.query("rollback").catch(() => undefined);
  connection.release();
  await pool.end();
}
