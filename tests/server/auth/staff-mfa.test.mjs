import assert from "node:assert/strict";
import test from "node:test";
import { StaffMfaService } from "../../../src/server/auth/staff-mfa.ts";
import { mfaKeyringFromEnv, recoveryCodeHash, totpCode } from "../../../src/server/auth/mfa-crypto.ts";

const keyring = mfaKeyringFromEnv({
  CUAC_AUTH_MFA_ACTIVE_KEY_ID: "test-v1",
  CUAC_AUTH_MFA_KEYS_JSON: JSON.stringify({ "test-v1": Buffer.alloc(32, 9).toString("base64url") }),
});
const baseTime = new Date("2026-09-16T00:00:00.000Z");

test("staff login stays sessionless until encrypted TOTP enrollment succeeds and returns recovery codes once", async () => {
  const fixture = createFixture(baseTime);
  const service = new StaffMfaService(fixture.repository, keyring, { now: baseTime });
  const challenge = await service.beginLogin({
    userId: "staff-1", passwordHash: "password-hash", selectedSurface: "school",
    activeRole: "school_staff", tenantSchoolId: "11111111-1111-4111-8111-111111111111",
    ip: "127.0.0.1", userAgent: "test",
  });
  assert.equal(challenge.mfaRequired, true);
  assert.equal(challenge.enrollmentRequired, true);
  assert.equal(fixture.sessions.length, 0);

  const enrollment = await service.startEnrollment({ challengeToken: challenge.challengeToken });
  assert.match(enrollment.secret, /^[A-Z2-7]{32}$/);
  assert.equal(fixture.factor.status, "pending");
  assert.equal(fixture.factor.ciphertext.includes(enrollment.secret), false);

  const result = await service.completeLogin({
    challengeToken: challenge.challengeToken,
    code: totpCode(enrollment.secret, baseTime).code,
  });
  assert.equal("mfaVerificationFailed" in result, false);
  assert.equal(result.activeRole, "school_staff");
  assert.equal(result.recoveryCodes.length, 10);
  assert.equal(fixture.factor.status, "active");
  assert.equal(fixture.sessions.length, 1);
  assert.equal(fixture.challenges[0].consumed, true);
  assert.equal(fixture.recoveryHashes.has(recoveryCodeHash(result.recoveryCodes[0], keyring)), true);
});

test("TOTP counters and recovery codes cannot be replayed", async () => {
  const fixture = createFixture(baseTime);
  const enrolling = new StaffMfaService(fixture.repository, keyring, { now: baseTime });
  const first = await enrolling.beginLogin({
    userId: "staff-1", passwordHash: "password-hash", selectedSurface: "ops",
    activeRole: "cuac_admin", tenantSchoolId: null,
  });
  const enrollment = await enrolling.startEnrollment({ challengeToken: first.challengeToken });
  const enrolled = await enrolling.completeLogin({ challengeToken: first.challengeToken, code: totpCode(enrollment.secret, baseTime).code });
  const recoveryCode = enrolled.recoveryCodes[0];

  const replayChallenge = await enrolling.beginLogin({
    userId: "staff-1", passwordHash: "password-hash", selectedSurface: "ops",
    activeRole: "cuac_admin", tenantSchoolId: null,
  });
  assert.deepEqual(await enrolling.completeLogin({
    challengeToken: replayChallenge.challengeToken,
    code: totpCode(enrollment.secret, baseTime).code,
  }), { mfaVerificationFailed: true });
  assert.equal(fixture.challenges.at(-1).failedAttempts, 1);

  const recoveryChallenge = await enrolling.beginLogin({
    userId: "staff-1", passwordHash: "password-hash", selectedSurface: "ops",
    activeRole: "cuac_admin", tenantSchoolId: null,
  });
  const recovered = await enrolling.completeLogin({ challengeToken: recoveryChallenge.challengeToken, recoveryCode });
  assert.equal("mfaVerificationFailed" in recovered, false);
  const secondRecoveryChallenge = await enrolling.beginLogin({
    userId: "staff-1", passwordHash: "password-hash", selectedSurface: "ops",
    activeRole: "cuac_admin", tenantSchoolId: null,
  });
  assert.deepEqual(await enrolling.completeLogin({ challengeToken: secondRecoveryChallenge.challengeToken, recoveryCode }),
    { mfaVerificationFailed: true });
});

function createFixture(now) {
  const challenges = [];
  const sessions = [];
  const recoveryHashes = new Set();
  let factor = null;
  const repository = {
    async findMfaFactor() { return factor ? { ...factor } : null; },
    async createMfaLoginChallenge(input) {
      challenges.push({ ...input, challengeId: `challenge-${challenges.length + 1}`, consumed: false, failedAttempts: 0 });
      return { challengeId: challenges.at(-1).challengeId };
    },
    async findUsableMfaChallengeForUpdate(tokenHash, at) {
      const row = challenges.find(item => item.challengeTokenHash === tokenHash && !item.consumed && item.expiresAt > at && item.failedAttempts < 8);
      return row ? { ...row, email: "staff@example.edu", passwordHash: "password-hash" } : null;
    },
    async upsertPendingMfaFactor(input) {
      factor = { ...input, factorId: "factor-1", status: "pending", lastUsedCounter: null };
      return { ...factor };
    },
    async activatePendingMfaFactor(input) {
      if (!factor || factor.status !== "pending") return false;
      factor.status = "active"; factor.lastUsedCounter = input.counter;
      input.recoveryCodeHashes.forEach(hash => recoveryHashes.add(hash));
      return true;
    },
    async consumeActiveMfaTotp(input) {
      if (!factor || factor.status !== "active" || factor.lastUsedCounter !== input.expectedLastUsedCounter || input.counter <= factor.lastUsedCounter) return false;
      factor.lastUsedCounter = input.counter;
      return true;
    },
    async consumeMfaRecoveryCode(input) {
      const hash = input.codeHashes.find(candidate => recoveryHashes.has(candidate));
      if (!hash) return false;
      recoveryHashes.delete(hash);
      return true;
    },
    async consumeMfaChallenge(challengeId) {
      const row = challenges.find(item => item.challengeId === challengeId && !item.consumed);
      if (!row) return false;
      row.consumed = true;
      return true;
    },
    async recordMfaChallengeFailure(challengeId) {
      const row = challenges.find(item => item.challengeId === challengeId);
      if (row) row.failedAttempts++;
    },
    async createSession(input) {
      sessions.push(input);
      return { sessionId: `session-${sessions.length}`,
        selectedSurface: input.requestedSurface === "school_staff" ? "school" : "ops",
        activeRole: challenges.find(item => item.userId === input.userId)?.activeRole ?? "cuac_admin",
        tenantSchoolId: input.requestedSchoolId };
    },
  };
  return {
    repository, challenges, sessions, recoveryHashes,
    get factor() { return factor; },
    now,
  };
}
