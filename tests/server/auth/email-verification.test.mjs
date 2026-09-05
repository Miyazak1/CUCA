import assert from "node:assert/strict";
import test from "node:test";
import { EmailVerificationService, createRequestContext } from "../../../src/server/index.ts";

const now = new Date("2026-08-28T00:00:00.000Z");

function createRepository(target = null, challenge = null) {
  const calls = [];
  return {
    calls,
    repository: {
      async findVerificationTargetByUserId(userId) {
        calls.push({ method: "findVerificationTargetByUserId", userId });
        return target;
      },
      async createEmailVerificationChallenge(input) {
        calls.push({ method: "createEmailVerificationChallenge", input });
        return { challengeId: "a3333333-a333-4333-8333-a33333333333" };
      },
      async findActiveEmailVerificationChallenge(input) {
        calls.push({ method: "findActiveEmailVerificationChallenge", input });
        return challenge;
      },
      async markEmailVerified(input) {
        calls.push({ method: "markEmailVerified", input });
        return { verified: true };
      },
    },
  };
}

test("email verification request creates challenge with token hash and delivery sink only", async () => {
  const { calls, repository } = createRepository({
    userId: "student-1",
    emailNormalized: "student@example.com",
    emailVerifiedAt: null,
    accountStatus: "active",
  });
  const deliveries = [];
  const auditEvents = [];
  const service = new EmailVerificationService(repository, {
    now,
    challengeTtlMs: 1000,
    deliverySink: {
      async enqueue(input) {
        deliveries.push(input);
      },
    },
    auditSink: {
      async record(event) {
        auditEvents.push(event);
      },
    },
  });

  const result = await service.requestVerification(
    createRequestContext({ actorUserId: "student-1", activeRole: "student", selectedSurface: "student" }),
  );

  assert.equal(result.status, "pending");
  assert.equal(result.challengeId, "a3333333-a333-4333-8333-a33333333333");
  assert.equal(result.deliveryStatus, "queued");
  assert.equal(result.expiresAt.toISOString(), "2026-08-28T00:00:01.000Z");
  assert.equal("verificationToken" in result, false);
  assert.equal(calls[1].method, "createEmailVerificationChallenge");
  assert.match(calls[1].input.verificationTokenHash, /^sha256:/);
  assert.notEqual(calls[1].input.verificationTokenHash, deliveries[0].verificationToken);
  assert.equal(deliveries[0].emailNormalized, "student@example.com");
  assert.equal(auditEvents[0].metadata.emailDomain, "example.com");
  assert.equal(JSON.stringify(auditEvents[0]).includes(deliveries[0].verificationToken), false);
});

test("email verification request denies guests and does not recreate verified challenges", async () => {
  await assert.rejects(
    () => new EmailVerificationService(createRepository().repository, { now }).requestVerification(createRequestContext()),
    /authenticated session/,
  );

  const { calls, repository } = createRepository({
    userId: "student-1",
    emailNormalized: "student@example.com",
    emailVerifiedAt: now,
    accountStatus: "active",
  });
  const service = new EmailVerificationService(repository, { now });
  const result = await service.requestVerification(
    createRequestContext({ actorUserId: "student-1", activeRole: "student", selectedSurface: "student" }),
  );

  assert.deepEqual(result, { status: "already_verified", challengeId: null, expiresAt: null, deliveryStatus: "not_required" });
  assert.equal(calls.some((call) => call.method === "createEmailVerificationChallenge"), false);
});

test("email verification consumes active challenge by token hash only", async () => {
  const { calls, repository } = createRepository(null, {
    id: "a3333333-a333-4333-8333-a33333333333",
    userId: "student-1",
    emailNormalized: "student@example.com",
    status: "pending",
    expiresAt: new Date("2026-08-28T00:15:00.000Z"),
    verifiedAt: null,
  });
  const service = new EmailVerificationService(repository, { now });
  const result = await service.verifyEmail(createRequestContext(), "a3333333-a333-4333-8333-a33333333333", "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI");

  assert.deepEqual(result, { status: "verified", challengeId: "a3333333-a333-4333-8333-a33333333333" });
  assert.equal(calls[0].method, "findActiveEmailVerificationChallenge");
  assert.equal(calls[0].input.challengeId, "a3333333-a333-4333-8333-a33333333333");
  assert.match(calls[0].input.verificationTokenHash, /^sha256:/);
  assert.notEqual(calls[0].input.verificationTokenHash, "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI");
  assert.deepEqual(calls[1].input, { challengeId: "a3333333-a333-4333-8333-a33333333333", userId: "student-1", verificationTokenHash: calls[0].input.verificationTokenHash, now });
});
