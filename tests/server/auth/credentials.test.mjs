import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { AuthCredentialsService, hashPassword, verifyPassword } from "../../../src/server/index.ts";
import { authEmail, authPassword, authToken } from "../../../src/server/auth/input.ts";

const now = new Date("2026-08-28T00:00:00.000Z");

test("Auth email grammar bounds both address and domain labels without changing plus aliases", () => {
  assert.deepEqual(authEmail(" Student+News@Example.COM "), { original: "Student+News@Example.COM", normalized: "student+news@example.com" });
  const max = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}`;
  assert.equal(max.length, 254);
  assert.equal(authEmail(max).normalized, max);
  assert.equal(authEmail("student@xn--fiqs8s.example").normalized, "student@xn--fiqs8s.example");
  for (const email of [null, {}, [], true, "", "x".repeat(321), `${max}e`, `${"a".repeat(65)}@example.com`, "a..b@example.com", ".a@example.com", "a.@example.com", "a@-example.com", "a@example-.com", "a@example..com", `a@${"b".repeat(64)}.com`, "a\n@example.com", "a\u0000@example.com", "a@@example.com", "a@localhost", "\u5b66@example.com"]) {
    assert.throws(() => authEmail(email), (error) => error.status === 400);
  }
});

test("Auth password policy counts Unicode code points and preserves exact whitespace within its byte limit", () => {
  for (const password of ["  correct horse battery staple  ", "a".repeat(1024), "\u{1f600}".repeat(256)]) {
    assert.equal(authPassword(password, true), password);
  }
  for (const password of [null, {}, 123, "", "a".repeat(14), "\u{1f600}".repeat(14), "a".repeat(1025), "\u{1f600}".repeat(257), "a".repeat(15) + "\ud800"]) {
    assert.throws(() => authPassword(password, true), (error) => error.status === 400);
  }
  assert.equal(authPassword("legacy08", false), "legacy08");
});

test("Auth one-time tokens require exact canonical 32-byte base64url without trimming", () => {
  const token = Buffer.alloc(32, 0).toString("base64url");
  assert.equal(authToken(token), token);
  for (const value of [null, {}, "", "raw-token", "a".repeat(44), `${token}=`, ` ${token}`, `${token}\n`, token.slice(0, -1) + "B"]) {
    assert.throws(() => authToken(value), (error) => error.status === 400);
  }
});

test("credential services reject malformed inputs before identity reads or writes", async () => {
  const { calls, repository } = createRepository();
  const service = new AuthCredentialsService(repository, { now });
  const base = { email: "student@example.com", password: "strong-password" };
  for (const input of [null, [], {}, { ...base, email: {} }, { ...base, password: {} }, { ...base, password: "x".repeat(1025) }, { ...base, displayName: {} }, { ...base, displayName: "x".repeat(121) }, { ...base, displayName: " " }, { ...base, privatePayload: "NEVER_ECHO_AUTH_INPUT" }, { ...base, userAgent: {} }, { ...base, ip: "x".repeat(129) }]) {
    await assert.rejects(service.registerStudent(input), (error) => error.status === 400 && !error.message.includes("NEVER_ECHO_AUTH_INPUT"));
  }
  for (const input of [null, [], {}, { ...base, email: [] }, { ...base, password: [] }, { ...base, password: "x".repeat(1025) }, { ...base, userAgent: {} }]) {
    await assert.rejects(service.createStudentSession(input), (error) => error.status === 400);
  }
  assert.equal(calls.length, 0);
});

test("registration preserves password whitespace and accepts the display name limit without truncation", async () => {
  const { calls, repository } = createRepository();
  const password = "  correct horse battery staple  ";
  await new AuthCredentialsService(repository, { now }).registerStudent({ email: "student@example.com", password, displayName: "x".repeat(120), role: "cuac_admin", schoolId: "forged" });
  assert.equal(calls[1].input.displayName.length, 120);
  assert.equal(await verifyPassword(password, calls[1].input.passwordHash), true);
  assert.equal(await verifyPassword(password.trim(), calls[1].input.passwordHash), false);
  assert.equal(calls[2].input.requestedSurface, "student");
  assert.equal(calls[2].input.requestedSchoolId, null);
});

test("legacy eight-character passwords can log in but cannot be newly registered", async () => {
  const password = "legacy08";
  const { calls, repository } = createRepository({ userId: "student-1", emailNormalized: "student@example.com", passwordHash: await hashPassword(password), accountStatus: "active" });
  const service = new AuthCredentialsService(repository, { now });
  await service.createStudentSession({ email: "student@example.com", password });
  assert.equal(calls.at(-1).method, "createSession");
  const count = calls.length;
  await assert.rejects(service.registerStudent({ email: "student@example.com", password }), /at least 15/);
  assert.equal(calls.length, count);
});

function createRepository(existingIdentity = null) {
  const calls = [];
  const repository = {
    async findPasswordIdentityByEmailNormalized(emailNormalized) {
      calls.push({ method: "findPasswordIdentityByEmailNormalized", emailNormalized });
      return existingIdentity;
    },
    async createStudentAccount(input) {
      calls.push({ method: "createStudentAccount", input });
      return { userId: "student-1" };
    },
    async createSession(input) {
      calls.push({ method: "createSession", input });
      if (input.requestedSurface === "school_staff") return {
        sessionId: "session-1", selectedSurface: "school", activeRole: "school_staff",
        tenantSchoolId: input.requestedSchoolId,
      };
      if (input.requestedSurface === "cuac_internal") return {
        sessionId: "session-1", selectedSurface: "ops", activeRole: "cuac_ops", tenantSchoolId: null,
      };
      return { sessionId: "session-1", selectedSurface: "student", activeRole: "student", tenantSchoolId: null };
    },
    async revokeSessionByTokenHash(input) {
      calls.push({ method: "revokeSessionByTokenHash", input });
      return { revoked: true };
    },
    async findSessionReauthenticationTarget(sessionTokenHash) {
      calls.push({ method: "findSessionReauthenticationTarget", sessionTokenHash });
      return null;
    },
    async activateSessionStepUp(input) {
      calls.push({ method: "activateSessionStepUp", input });
      return { sessionId: input.sessionId, stepUpExpiresAt: new Date("2026-08-28T00:10:00.000Z") };
    },
  };

  return { calls, repository };
}

test("password hashing verifies valid passwords without storing plaintext", async () => {
  const storedHash = await hashPassword("correct horse battery staple");

  assert.match(storedHash, /^scrypt\$v2\$32768\$8\$3\$/);
  assert.doesNotMatch(storedHash, /correct horse battery staple/);
  assert.equal(await verifyPassword("correct horse battery staple", storedHash), true);
  assert.equal(await verifyPassword("wrong password", storedHash), false);
});

test("student registration creates only student account authority and hashed session storage", async () => {
  const { calls, repository } = createRepository();
  const service = new AuthCredentialsService(repository, { now, sessionTtlMs: 1000 });
  const result = await service.registerStudent({
    email: " Student@Example.COM ",
    password: "strong-password",
    displayName: " New Student ",
    userAgent: "browser",
    ip: "203.0.113.10",
  });

  assert.equal(result.userId, "student-1");
  assert.equal(result.sessionId, "session-1");
  assert.equal(result.expiresAt.toISOString(), "2026-08-28T00:00:01.000Z");
  assert.match(result.sessionToken, /^[A-Za-z0-9_-]+$/);
  assert.equal(calls[0].emailNormalized, "student@example.com");
  assert.equal(calls[1].input.email, "Student@Example.COM");
  assert.equal(calls[1].input.emailNormalized, "student@example.com");
  assert.equal(calls[1].input.displayName, "New Student");
  assert.match(calls[1].input.passwordHash, /^scrypt\$v2\$32768\$8\$3\$/);
  assert.doesNotMatch(calls[1].input.passwordHash, /strong-password/);
  assert.equal(calls[2].input.requestedSurface, "student");
  assert.equal(calls[2].input.requestedSchoolId, null);
  assert.match(calls[2].input.sessionTokenHash, /^sha256:/);
  assert.notEqual(calls[2].input.sessionTokenHash, result.sessionToken);
  assert.match(calls[2].input.ipHash, /^sha256:/);
  assert.match(calls[2].input.userAgentHash, /^sha256:/);
});

test("student registration rejects existing password identity before account creation", async () => {
  const { calls, repository } = createRepository({
    userId: "student-1",
    emailNormalized: "student@example.com",
    passwordHash: await hashPassword("strong-password"),
    accountStatus: "active",
  });
  const service = new AuthCredentialsService(repository, { now });

  await assert.rejects(
    () => service.registerStudent({ email: "student@example.com", password: "strong-password" }),
    /already exists/,
  );
  assert.equal(calls.some((call) => call.method === "createStudentAccount"), false);
});

test("student login creates session only for active account with valid password", async () => {
  const { calls, repository } = createRepository({
    userId: "student-1",
    emailNormalized: "student@example.com",
    passwordHash: await hashPassword("strong-password"),
    accountStatus: "active",
  });
  const service = new AuthCredentialsService(repository, { now });
  const result = await service.createStudentSession({ email: "student@example.com", password: "strong-password" });

  assert.equal(result.userId, "student-1");
  assert.equal(result.activeRole, "student");
  assert.equal(calls.at(-1).method, "createSession");
  assert.equal(Object.hasOwn(calls.at(-1).input, "upgradedPasswordHash"), false);
});

test("login requests an authorized school or CUAC internal context without accepting tenant authority implicitly", async () => {
  const schoolId = "11111111-1111-4111-8111-111111111111";
  const { calls, repository } = createRepository({
    userId: "staff-1", emailNormalized: "staff@example.com",
    passwordHash: await hashPassword("strong-password"), accountStatus: "active",
  });
  const service = new AuthCredentialsService(repository, { now });
  const school = await service.createStudentSession({
    email: "staff@example.com", password: "strong-password", selectedSurface: "school_staff", schoolId,
  });
  assert.deepEqual({ selectedSurface: school.selectedSurface, activeRole: school.activeRole, tenantSchoolId: school.tenantSchoolId },
    { selectedSurface: "school", activeRole: "school_staff", tenantSchoolId: schoolId });
  assert.equal(calls.at(-1).input.requestedSurface, "school_staff");
  assert.equal(calls.at(-1).input.requestedSchoolId, schoolId);

  const ops = await service.createStudentSession({
    email: "staff@example.com", password: "strong-password", selectedSurface: "cuac_internal",
  });
  assert.equal(ops.activeRole, "cuac_ops");
  assert.equal(calls.at(-1).input.requestedSurface, "cuac_internal");
  assert.equal(calls.at(-1).input.requestedSchoolId, null);

  const callCount = calls.length;
  for (const input of [
    { selectedSurface: "school_staff" },
    { selectedSurface: "school_staff", schoolId: "not-a-uuid" },
    { selectedSurface: "student", schoolId },
    { selectedSurface: "cuac_internal", schoolId },
    { selectedSurface: "unknown" },
  ]) {
    await assert.rejects(service.createStudentSession({ email: "staff@example.com", password: "strong-password", ...input }),
      error => error.status === 400);
  }
  assert.equal(calls.length, callCount);
});

test("step-up reauthenticates the current persona session for a bounded window", async () => {
  const sessionToken = Buffer.alloc(32, 7).toString("base64url");
  const target = { sessionId: "session-1", userId: "student-1", passwordHash: "current-hash",
    expiresAt: new Date("2026-08-28T00:30:00.000Z"), selectedSurface: "student", activeRole: "student", tenantSchoolId: null };
  const calls = [];
  const repository = {
    async findSessionReauthenticationTarget(sessionTokenHash) {
      calls.push({ method: "find", sessionTokenHash }); return target;
    },
    async activateSessionStepUp(value) { calls.push({ method: "activate", value }); return {
      sessionId: target.sessionId, stepUpExpiresAt: new Date("2026-08-28T00:10:00.000Z") };
    },
  };
  const audits = [];
  const service = new AuthCredentialsService(repository, { now,
    passwordHasher: { async verifyForLogin(password, hash) {
      calls.push({ method: "verify", password, hash }); return { valid: true };
    } },
    auditSink: { async record(event) { audits.push(event); } },
  });
  const result = await service.stepUpSession({ sessionToken, password: "strong-password" }, "step-up-request");
  assert.equal(result.stepUpExpiresAt.toISOString(), "2026-08-28T00:10:00.000Z");
  assert.match(calls[0].sessionTokenHash, /^sha256:/);
  assert.notEqual(calls[0].sessionTokenHash, sessionToken);
  assert.equal(calls[1].hash, target.passwordHash);
  assert.equal(calls[2].value.passwordHash, target.passwordHash);
  assert.equal(calls[2].value.stepUpTtlMs, 600_000);
  assert.deepEqual(audits.map(event => [event.action, event.resourceId, event.metadata]),
    [["auth.step_up", target.sessionId, { stepUpExpiresAt: result.stepUpExpiresAt.toISOString() }]]);
  assert.doesNotMatch(JSON.stringify(audits), /strong-password|current-hash/);
});

test("step-up performs fixed password verification but cannot elevate stale session evidence", async () => {
  const sessionToken = Buffer.alloc(32, 8).toString("base64url");
  let activations = 0, verifications = 0;
  const service = new AuthCredentialsService({
    async findSessionReauthenticationTarget() { return null; },
    async activateSessionStepUp() { activations += 1; },
  }, { now, passwordHasher: { async verifyForLogin(password, hash) {
    verifications += 1; assert.equal(password, "strong-password"); assert.equal(hash, null); return { valid: false };
  } } });
  await assert.rejects(service.stepUpSession({ sessionToken, password: "strong-password" }),
    error => error.status === 403 && error.message === "Session or password is invalid.");
  assert.equal(verifications, 1);
  assert.equal(activations, 0);
});

test("legacy login passes a one-way credential upgrade only after successful verification", async () => {
  const oldHash = "scrypt$legacy-proof";
  const upgradedHash = "scrypt$v2$fixed-upgrade";
  const { calls, repository } = createRepository({
    userId: "student-1", emailNormalized: "student@example.com", passwordHash: oldHash, accountStatus: "active",
  });
  const audits = [];
  const service = new AuthCredentialsService(repository, {
    now,
    passwordHasher: {
      async hash() { return upgradedHash; },
      async verify() { return true; },
      async verifyForLogin() { return { valid: true, upgradedHash }; },
    },
    auditSink: { async record(event) { audits.push(event); } },
  });

  await service.createStudentSession({ email: "student@example.com", password: "strong-password" }, "upgrade-request");
  const session = calls.find(call => call.method === "createSession").input;
  assert.equal(session.expectedPasswordHash, oldHash);
  assert.equal(session.upgradedPasswordHash, upgradedHash);
  assert.deepEqual(audits.map(event => [event.action, event.metadata]),
    [["auth.login", { selectedSurface: "student", credentialUpgrade: "scrypt_v2" }]]);
});

test("student login rejects invalid password and inactive accounts before session creation", async () => {
  for (const identity of [
    { userId: "student-1", emailNormalized: "student@example.com", passwordHash: await hashPassword("strong-password"), accountStatus: "active" },
    { userId: "student-1", emailNormalized: "student@example.com", passwordHash: await hashPassword("strong-password"), accountStatus: "suspended" },
  ]) {
    const { calls, repository } = createRepository(identity);
    const service = new AuthCredentialsService(repository, { now });

    await assert.rejects(
      () => service.createStudentSession({ email: "student@example.com", password: identity.accountStatus === "active" ? "wrong-password" : "strong-password" }),
      /Invalid email or password/,
    );
    assert.equal(calls.some((call) => call.method === "createSession"), false);
  }
});

test("student logout revokes sessions by token hash only", async () => {
  const { calls, repository } = createRepository();
  const service = new AuthCredentialsService(repository, { now });
  const result = await service.revokeSession("raw-session-token");

  assert.deepEqual(result, { revoked: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "revokeSessionByTokenHash");
  assert.equal(calls[0].input.now, now);
  assert.equal(calls[0].input.sessionTokenHash, `sha256:${createHash("sha256").update("raw-session-token").digest("hex")}`);
  assert.notEqual(calls[0].input.sessionTokenHash, "raw-session-token");
});

test("student logout without a session token is idempotent and does not call the repository", async () => {
  const { calls, repository } = createRepository();
  const service = new AuthCredentialsService(repository, { now });

  assert.deepEqual(await service.revokeSession(null), { revoked: false });
  assert.deepEqual(await service.revokeSession(""), { revoked: false });
  assert.equal(calls.length, 0);
});
