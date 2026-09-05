import assert from "node:assert/strict";
import test from "node:test";
import { PostgresAuthSessionRepository } from "../../../src/server/index.ts";

const passwordSalt = Buffer.alloc(16).toString("base64url");
const passwordKey = Buffer.alloc(64).toString("base64url");
const legacyPasswordHash = `scrypt$${passwordSalt}$${passwordKey}`;
const currentPasswordHash = `scrypt$v2$32768$8$3$${passwordSalt}$${passwordKey}`;

test("Postgres auth session repository uses fixed active-session SQL", async () => {
  const calls = [];
  const repository = new PostgresAuthSessionRepository({
    async query(statement, params) {
      calls.push({ statement, params });
      return [
        {
          userId: "user-1",
          selectedSurface: "student",
          activeRole: "student",
          tenantSchoolId: null,
          authStrength: "session",
          expiresAt: new Date("2026-08-29T00:00:00.000Z"),
          revokedAt: null,
          accountStatus: "active",
        },
      ];
    },
  });

  const now = new Date("2026-08-28T00:00:00.000Z");
  const session = await repository.findActiveSessionByTokenHash("sha256:abc", now);

  assert.equal(session.userId, "user-1");
  assert.equal(calls.length, 1);
  assert.match(calls[0].statement, /from auth_sessions s/);
  assert.match(calls[0].statement, /join users u on u\.id = s\.user_id/);
  assert.match(calls[0].statement, /s\.session_token_hash = \$1/);
  assert.match(calls[0].statement, /s\.expires_at > \$2/);
  assert.match(calls[0].statement, /case when s\.step_up_expires_at > \$2 then 'step_up' else 'session' end/);
  assert.match(calls[0].statement, /s\.revoked_at is null/);
  assert.match(calls[0].statement, /u\.account_status = 'active'/);
  assert.match(calls[0].statement, /r\.user_id = s\.user_id and r\.role = s\.active_role and r\.revoked_at is null/);
  assert.doesNotMatch(calls[0].statement, /select \*/i);
  assert.deepEqual(calls[0].params, ["sha256:abc", now]);
});

test("Postgres auth repository verifies active school staff membership with fixed SQL", async () => {
  const calls = [];
  const repository = new PostgresAuthSessionRepository({
    async query(statement, params) {
      calls.push({ statement, params });
      return [
        {
          userId: "staff-1",
          schoolId: "school-1",
          role: "admissions",
          status: "active",
        },
      ];
    },
  });

  const now = new Date("2026-08-28T00:00:00.000Z");
  const membership = await repository.findActiveSchoolMembershipByUserAndSchoolId("staff-1", "school-1", now);

  assert.equal(membership.schoolId, "school-1");
  assert.equal(calls.length, 1);
  assert.match(calls[0].statement, /from school_staff_memberships m/);
  assert.match(calls[0].statement, /m\.user_id = \$1/);
  assert.match(calls[0].statement, /m\.school_id = \$2/);
  assert.match(calls[0].statement, /m\.status = 'active'/);
  assert.match(calls[0].statement, /m\.removed_at is null/);
  assert.match(calls[0].statement, /join schools s on s\.id = m\.school_id and s\.status = 'active'/);
  assert.doesNotMatch(calls[0].statement, /select \*/i);
  assert.deepEqual(calls[0].params, ["staff-1", "school-1"]);
});

test("Postgres auth repository verifies a current approved CUAC staff access grant", async () => {
  const calls = [];
  const now = new Date("2026-08-28T00:00:00.000Z");
  const expiresAt = new Date("2026-09-28T00:00:00.000Z");
  const repository = new PostgresAuthSessionRepository({
    async query(statement, params) {
      calls.push({ statement, params });
      return [{ userId: "ops-1", role: "cuac_ops", status: "approved", expiresAt }];
    },
  });
  const grant = await repository.findActiveCuacStaffAccessGrantByUserAndRole("ops-1", "cuac_ops", now);
  assert.equal(grant.role, "cuac_ops");
  assert.match(calls[0].statement, /from cuac_staff_access_grants g/);
  assert.match(calls[0].statement, /g\.requested_role = \$2/);
  assert.match(calls[0].statement, /g\.requested_surface = 'cuac_internal'/);
  assert.match(calls[0].statement, /g\.status = 'approved'/);
  assert.match(calls[0].statement, /g\.expires_at > \$3/);
  assert.match(calls[0].statement, /g\.revoked_at is null/);
  assert.deepEqual(calls[0].params, ["ops-1", "cuac_ops", now]);
});

test("Postgres auth repository finds password identity by normalized email with fixed SQL", async () => {
  const calls = [];
  const repository = new PostgresAuthSessionRepository({
    async query(statement, params) {
      calls.push({ statement, params });
      return [
        {
          userId: "student-1",
          emailNormalized: "student@example.com",
          passwordHash: "scrypt$salt$hash",
          accountStatus: "active",
        },
      ];
    },
  });

  const identity = await repository.findPasswordIdentityByEmailNormalized("student@example.com");

  assert.equal(identity.userId, "student-1");
  assert.match(calls[0].statement, /from auth_identities i/);
  assert.match(calls[0].statement, /join users u on u\.id = i\.user_id/);
  assert.match(calls[0].statement, /i\.provider = 'password'/);
  assert.match(calls[0].statement, /i\.email_normalized = \$1/);
  assert.doesNotMatch(calls[0].statement, /select \*/i);
  assert.deepEqual(calls[0].params, ["student@example.com"]);
});

test("Postgres auth repository creates student account identity and role without school or Ops grants", async () => {
  const calls = [];
  const now = new Date("2026-08-28T00:00:00.000Z");
  const repository = new PostgresAuthSessionRepository({
    async query(statement, params) {
      calls.push({ statement, params });
      if (/select user_id as "userId" from created_role/.test(statement)) {
        return [{ userId: "student-1" }];
      }
      return [];
    },
  });

  const account = await repository.createStudentAccount({
    email: "student@example.com",
    emailNormalized: "student@example.com",
    displayName: "Student",
    passwordHash: "scrypt$salt$hash",
    now,
  });

  assert.equal(account.userId, "student-1");
  assert.equal(calls.length, 1);
  assert.match(calls[0].statement, /insert into users/);
  assert.match(calls[0].statement, /insert into auth_identities/);
  assert.match(calls[0].statement, /'password'/);
  assert.match(calls[0].statement, /insert into user_roles/);
  assert.match(calls[0].statement, /'student'/);
  assert.match(calls[0].statement, /'self_registration'/);
  assert.deepEqual(calls[0].params, ["student@example.com", "student@example.com", "Student", now, "scrypt$salt$hash"]);
  assert.doesNotMatch(calls.map((call) => call.statement).join("\n"), /school_staff_memberships|cuac_staff_access_grants/i);
});

test("Postgres auth repository creates student session with hashed token only", async () => {
  const calls = [];
  const now = new Date("2026-08-28T00:00:00.000Z");
  const expiresAt = new Date("2026-09-27T00:00:00.000Z");
  const repository = new PostgresAuthSessionRepository({
    async transaction(work) { return work(this); },
    async query(statement, params) {
      calls.push({ statement, params });
      if (/from user_roles r/.test(statement)) return [{ selectedSurface: "student", activeRole: "student", tenantSchoolId: null }];
      if (/insert into auth_sessions/.test(statement)) return [{ sessionId: "session-1" }];
      return [{ id: "student-1" }];
    },
  });

  const session = await repository.createSession({
    userId: "student-1",
    expectedPasswordHash: "scrypt$salt$hash",
    sessionTokenHash: "sha256:abc",
    requestedSurface: "student",
    requestedSchoolId: null,
    authStrength: "session",
    expiresAt,
    ipHash: "sha256:ip",
    userAgentHash: "sha256:ua",
    now,
  });

  assert.equal(session.sessionId, "session-1");
  assert.deepEqual(session, { sessionId: "session-1", selectedSurface: "student", activeRole: "student", tenantSchoolId: null });
  assert.equal(calls.length, 3);
  assert.match(calls[0].statement, /select id from users where id = \$1 for update/);
  assert.match(calls[1].statement, /from user_roles r/);
  assert.match(calls[1].statement, /for share of r/);
  assert.match(calls[2].statement, /insert into auth_sessions/);
  assert.match(calls[2].statement, /session_token_hash/);
  assert.match(calls[2].statement, /i\.password_hash = \$11/);
  assert.match(calls[2].statement, /i\.email_normalized = u\.email_normalized/);
  assert.doesNotMatch(calls[2].statement, /session_token[^_]|raw_token/i);
  assert.deepEqual(calls[2].params, ["student-1", "sha256:abc", "student", "student", null,
    "session", "sha256:ip", "sha256:ua", now, expiresAt, "scrypt$salt$hash"]);
});

test("Postgres auth repository creates school and CUAC sessions only from locked live authority", async () => {
  const now = new Date("2026-08-28T00:00:00.000Z");
  const expiresAt = new Date("2026-09-27T00:00:00.000Z");
  const schoolId = "11111111-1111-4111-8111-111111111111";
  for (const expected of [
    { requestedSurface: "school_staff", requestedSchoolId: schoolId, selectedSurface: "school",
      activeRole: "school_staff", tenantSchoolId: schoolId, authorityPattern: /school_staff_memberships/ },
    { requestedSurface: "cuac_internal", requestedSchoolId: null, selectedSurface: "ops",
      activeRole: "cuac_ops", tenantSchoolId: null, authorityPattern: /cuac_staff_access_grants/ },
  ]) {
    const calls = [];
    const repository = new PostgresAuthSessionRepository({
      async transaction(work) { return work(this); },
      async query(statement, params) {
        calls.push({ statement, params });
        if (expected.authorityPattern.test(statement)) return [{
          selectedSurface: expected.selectedSurface, activeRole: expected.activeRole,
          tenantSchoolId: expected.tenantSchoolId,
        }];
        if (/insert into auth_sessions/.test(statement)) return [{ sessionId: "session-1" }];
        return [{ id: "staff-1" }];
      },
    });
    const session = await repository.createSession({
      userId: "staff-1", expectedPasswordHash: currentPasswordHash, sessionTokenHash: "sha256:abc",
      requestedSurface: expected.requestedSurface, requestedSchoolId: expected.requestedSchoolId,
      authStrength: "session", expiresAt, ipHash: null, userAgentHash: null, now,
    });
    assert.deepEqual(session, { sessionId: "session-1", selectedSurface: expected.selectedSurface,
      activeRole: expected.activeRole, tenantSchoolId: expected.tenantSchoolId });
    assert.match(calls[1].statement, expected.authorityPattern);
    assert.match(calls[1].statement, /for share of r,/);
    assert.match(calls[2].statement, /insert into auth_sessions/);
    assert.equal(calls[2].params[2], expected.selectedSurface);
    assert.equal(calls[2].params[3], expected.activeRole);
    assert.equal(calls[2].params[4], expected.tenantSchoolId);
    if (expected.requestedSurface === "school_staff") {
      assert.match(calls[1].statement, /m\.school_id = \$2/);
      assert.match(calls[1].statement, /s\.status = 'active'/);
      assert.deepEqual(calls[1].params, ["staff-1", schoolId]);
    } else {
      assert.match(calls[1].statement, /g\.expires_at > clock_timestamp\(\)/);
      assert.match(calls[1].statement, /case when r\.role = 'cuac_ops' then 0 else 1 end/);
    }
  }
});

test("Postgres auth repository refuses a selected context before writing a session when authority is absent", async () => {
  const calls = [];
  const repository = new PostgresAuthSessionRepository({
    async transaction(work) { return work(this); },
    async query(statement, params) {
      calls.push({ statement, params });
      return /select id from users/.test(statement) ? [{ id: "staff-1" }] : [];
    },
  });
  await assert.rejects(repository.createSession({
    userId: "staff-1", expectedPasswordHash: currentPasswordHash, sessionTokenHash: "sha256:abc",
    requestedSurface: "cuac_internal", requestedSchoolId: null, authStrength: "session",
    expiresAt: new Date("2026-09-27T00:00:00.000Z"), ipHash: null, userAgentHash: null,
    now: new Date("2026-08-28T00:00:00.000Z"),
  }), error => error.status === 403 && error.message === "Selected access context is not available.");
  assert.equal(calls.some(call => /insert into auth_sessions/.test(call.statement)), false);
});

test("Postgres auth repository upgrades only a canonical legacy proof in the session transaction", async () => {
  const calls = [];
  const now = new Date("2026-08-28T00:00:00.000Z");
  const repository = new PostgresAuthSessionRepository({
    async transaction(work) { return work(this); },
    async query(statement, params) {
      calls.push({ statement, params });
      if (/from user_roles r/.test(statement)) return [{ selectedSurface: "student", activeRole: "student", tenantSchoolId: null }];
      if (/insert into auth_sessions/.test(statement)) return [{ sessionId: "session-1" }];
      if (/update auth_identities/.test(statement)) return [{ userId: "student-1" }];
      return [{ id: "student-1" }];
    },
  });

  await repository.createSession({
    userId: "student-1", expectedPasswordHash: legacyPasswordHash, upgradedPasswordHash: currentPasswordHash,
    sessionTokenHash: "sha256:abc", requestedSurface: "student", requestedSchoolId: null, authStrength: "session",
    expiresAt: new Date("2026-09-27T00:00:00.000Z"), ipHash: null, userAgentHash: null, now,
  });

  assert.equal(calls.length, 4);
  assert.match(calls[3].statement, /update auth_identities/);
  assert.match(calls[3].statement, /provider = 'password'/);
  assert.match(calls[3].statement, /password_hash = \$2/);
  assert.deepEqual(calls[3].params, ["student-1", legacyPasswordHash, currentPasswordHash, now]);
});

test("Postgres auth repository rejects malformed, downgrade and stale credential upgrades", async () => {
  for (const [expectedPasswordHash, upgradedPasswordHash] of [
    ["malformed", currentPasswordHash], [currentPasswordHash, currentPasswordHash], [legacyPasswordHash, legacyPasswordHash],
  ]) {
    let transactions = 0;
    const repository = new PostgresAuthSessionRepository({
      async transaction(work) { transactions += 1; return work(this); },
      async query() { return []; },
    });
    await assert.rejects(repository.createSession({
      userId: "student-1", expectedPasswordHash, upgradedPasswordHash, sessionTokenHash: "sha256:abc",
      requestedSurface: "student", requestedSchoolId: null, authStrength: "session", expiresAt: new Date(),
      ipHash: null, userAgentHash: null, now: new Date(),
    }), error => error.status === 403);
    assert.equal(transactions, 0);
  }

  const repository = new PostgresAuthSessionRepository({
    async transaction(work) { return work(this); },
    async query(statement) {
      if (/from user_roles r/.test(statement)) return [{ selectedSurface: "student", activeRole: "student", tenantSchoolId: null }];
      if (/insert into auth_sessions/.test(statement)) return [{ sessionId: "session-1" }];
      if (/update auth_identities/.test(statement)) return [];
      return [{ id: "student-1" }];
    },
  });
  await assert.rejects(repository.createSession({
    userId: "student-1", expectedPasswordHash: legacyPasswordHash, upgradedPasswordHash: currentPasswordHash,
    sessionTokenHash: "sha256:abc", requestedSurface: "student", requestedSchoolId: null, authStrength: "session",
    expiresAt: new Date(), ipHash: null, userAgentHash: null, now: new Date(),
  }), error => error.status === 403);
});

test("Postgres auth repository revokes sessions by hashed token only", async () => {
  const calls = [];
  const now = new Date("2026-08-28T00:00:00.000Z");
  const repository = new PostgresAuthSessionRepository({
    async query(statement, params) {
      calls.push({ statement, params });
      return [{ sessionId: "session-1", userId: "student-1", activeRole: "student", tenantSchoolId: null }];
    },
  });

  const result = await repository.revokeSessionByTokenHash({ sessionTokenHash: "sha256:abc", now });

  assert.deepEqual(result, { revoked: true, sessionId: "session-1", userId: "student-1", activeRole: "student", tenantSchoolId: null });
  assert.match(calls[0].statement, /update auth_sessions/);
  assert.match(calls[0].statement, /set revoked_at = \$2/);
  assert.match(calls[0].statement, /session_token_hash = \$1/);
  assert.match(calls[0].statement, /revoked_at is null/);
  assert.match(calls[0].statement, /returning id as "sessionId"/);
  assert.doesNotMatch(calls[0].statement, /select \*|raw_token|password/i);
  assert.deepEqual(calls[0].params, ["sha256:abc", now]);
});

test("Postgres auth repository reports already-revoked or missing sessions as not revoked", async () => {
  const repository = new PostgresAuthSessionRepository({
    async query() {
      return [];
    },
  });

  const result = await repository.revokeSessionByTokenHash({
    sessionTokenHash: "sha256:missing",
    now: new Date("2026-08-28T00:00:00.000Z"),
  });

  assert.deepEqual(result, { revoked: false });
});

test("Postgres auth repository binds step-up to the current persona session, authority and password proof", async () => {
  const calls = [];
  const stepUpExpiresAt = new Date("2026-08-28T00:10:00.000Z");
  const target = { sessionId: "session-1", userId: "student-1", passwordHash: currentPasswordHash,
    expiresAt: new Date("2026-08-29T00:00:00.000Z"), selectedSurface: "student", activeRole: "student", tenantSchoolId: null };
  const repository = new PostgresAuthSessionRepository({
    async transaction(work) { return work(this); },
    async query(statement, params) {
      calls.push({ statement, params });
      if (/from auth_sessions s/.test(statement)) return [target];
      if (/update auth_sessions s/.test(statement)) return [{ sessionId: target.sessionId, stepUpExpiresAt }];
      return [{ id: target.userId }];
    },
  });
  assert.deepEqual(await repository.findSessionReauthenticationTarget("sha256:session"), target);
  const result = await repository.activateSessionStepUp({ ...target, sessionTokenHash: "sha256:session",
    stepUpTtlMs: 600_000 });
  assert.deepEqual(result, { sessionId: target.sessionId, stepUpExpiresAt });
  assert.match(calls[0].statement, /i\.provider = 'password'/);
  assert.match(calls[0].statement, /s\.selected_surface as "selectedSurface"/);
  assert.match(calls[2].statement, /role = 'student'/);
  assert.match(calls[3].statement, /s\.auth_strength = 'session'/);
  assert.match(calls[3].statement, /clock_timestamp\(\)/);
  assert.match(calls[3].statement, /i\.password_hash = \$5/);
  assert.deepEqual(calls[3].params, [target.sessionId, target.userId, "sha256:session", 600_000,
    currentPasswordHash, "student", "student", null]);
  assert.doesNotMatch(calls.map(call => call.statement).join("\n"), /select \*|raw-session|strong-password/i);
});
