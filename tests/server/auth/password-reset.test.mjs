import assert from "node:assert/strict";
import test from "node:test";
import { PasswordResetService, createRequestContext } from "../../../src/server/index.ts";

const now = new Date("2026-08-28T00:00:00.000Z");

function createRepository(target = null, challenge = null) {
  const calls = [];
  return {
    calls,
    repository: {
      async findPasswordResetTargetByEmailNormalized(emailNormalized) {
        calls.push({ method: "findPasswordResetTargetByEmailNormalized", emailNormalized });
        return target;
      },
      async createPasswordResetChallenge(input) {
        calls.push({ method: "createPasswordResetChallenge", input });
        return { challengeId: "a4444444-a444-4444-8444-a44444444444" };
      },
      async findActivePasswordResetChallenge(input) {
        calls.push({ method: "findActivePasswordResetChallenge", input });
        return challenge;
      },
      async consumePasswordReset(input) {
        calls.push({ method: "consumePasswordReset", input });
        return { reset: true, revokedSessionCount: 3 };
      },
    },
  };
}

test("password reset request creates challenge with token hash and returns no token", async () => {
  const { calls, repository } = createRepository({
    userId: "student-1",
    emailNormalized: "student@example.com",
    accountStatus: "active",
    hasPasswordIdentity: true,
  });
  const deliveries = [];
  const service = new PasswordResetService(repository, {
    now,
    challengeTtlMs: 1000,
    deliverySink: {
      async enqueue(input) {
        deliveries.push(input);
      },
    },
  });

  const result = await service.requestReset(createRequestContext(), { email: " Student@Example.COM " });

  assert.deepEqual(result, { status: "accepted", deliveryStatus: "queued" });
  assert.equal(calls[0].emailNormalized, "student@example.com");
  assert.match(calls[1].input.resetTokenHash, /^sha256:/);
  assert.notEqual(calls[1].input.resetTokenHash, deliveries[0].resetToken);
  assert.equal(calls[1].input.expiresAt.toISOString(), "2026-08-28T00:00:01.000Z");
  assert.equal("resetToken" in result, false);
});

test("password reset request skips internal delivery for a missing account", async () => {
  const { calls, repository } = createRepository(null);
  const service = new PasswordResetService(repository, { now });
  const result = await service.requestReset(createRequestContext(), { email: "missing@example.com" });

  assert.deepEqual(result, { status: "accepted", deliveryStatus: "not_applicable" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "findPasswordResetTargetByEmailNormalized");
});

test("password reset consumes challenge, hashes new password, and revokes sessions", async () => {
  const { calls, repository } = createRepository(null, {
    id: "a4444444-a444-4444-8444-a44444444444",
    userId: "student-1",
    emailNormalized: "student@example.com",
    status: "pending",
    expiresAt: new Date("2026-08-28T00:15:00.000Z"),
    consumedAt: null,
  });
  const service = new PasswordResetService(repository, { now });
  const result = await service.resetPassword(createRequestContext(), "a4444444-a444-4444-8444-a44444444444", "AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM", "new-strong-password");

  assert.deepEqual(result, { status: "reset", challengeId: "a4444444-a444-4444-8444-a44444444444", revokedSessionCount: 3 });
  assert.equal(calls[0].method, "findActivePasswordResetChallenge");
  assert.match(calls[0].input.resetTokenHash, /^sha256:/);
  assert.notEqual(calls[0].input.resetTokenHash, "AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM");
  assert.equal(calls[1].method, "consumePasswordReset");
  assert.match(calls[1].input.passwordHash, /^scrypt\$/);
  assert.doesNotMatch(calls[1].input.passwordHash, /new-strong-password/);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].input.resetTokenHash, calls[0].input.resetTokenHash);
  assert.equal(calls[1].input.userId, "student-1");
});

test("password reset validates token and new password before updates", async () => {
  const { calls, repository } = createRepository();
  const service = new PasswordResetService(repository, { now });

  await assert.rejects(
    () => service.resetPassword(createRequestContext(), "a4444444-a444-4444-8444-a44444444444", "AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM", "short"),
    /at least 15/,
  );

  assert.equal(calls.length, 0);
});
