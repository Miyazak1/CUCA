import assert from "node:assert/strict";
import test from "node:test";
import { PostgresEmailVerificationRepository } from "../../../src/server/index.ts";

test("Postgres email verification repository reads target account with fixed SQL", async () => {
  const calls = [];
  const repository = new PostgresEmailVerificationRepository({
    async query(statement, params) {
      calls.push({ statement, params });
      return [
        {
          userId: "student-1",
          emailNormalized: "student@example.com",
          emailVerifiedAt: null,
          accountStatus: "active",
        },
      ];
    },
  });

  const target = await repository.findVerificationTargetByUserId("student-1");

  assert.equal(target.userId, "student-1");
  assert.match(calls[0].statement, /from users/);
  assert.match(calls[0].statement, /where id = \$1/);
  assert.doesNotMatch(calls[0].statement, /select \*|password|session_token/i);
  assert.deepEqual(calls[0].params, ["student-1"]);
});

test("Postgres email verification repository creates challenge with token hash only", async () => {
  const calls = [];
  const now = new Date("2026-08-28T00:00:00.000Z");
  const expiresAt = new Date("2026-08-29T00:00:00.000Z");
  const repository = new PostgresEmailVerificationRepository({
    async transaction(work) { return work(this); },
    async query(statement, params) {
      calls.push({ statement, params });
      return [{ challengeId: "email-challenge-1" }];
    },
  });

  const result = await repository.createEmailVerificationChallenge({
    userId: "student-1",
    emailNormalized: "student@example.com",
    verificationTokenHash: "sha256:abc",
    now,
    expiresAt,
  });

  assert.match(calls[0].statement, /from users.*for update/);
  assert.deepEqual(result, { challengeId: "email-challenge-1" });
  assert.match(calls[1].statement, /insert into email_verification_challenges/);
  assert.match(calls[1].statement, /verification_token_hash/);
  assert.doesNotMatch(calls[1].statement, /raw_token|verification_token[^_]|password|select \*/i);
  assert.deepEqual(calls[1].params, ["student-1", "student@example.com", "sha256:abc", now, expiresAt]);
});

test("Postgres email verification repository finds active challenge by id and token hash", async () => {
  const calls = [];
  const now = new Date("2026-08-28T00:00:00.000Z");
  const repository = new PostgresEmailVerificationRepository({
    async query(statement, params) {
      calls.push({ statement, params });
      return [
        {
          id: "email-challenge-1",
          userId: "student-1",
          emailNormalized: "student@example.com",
          status: "pending",
          expiresAt: new Date("2026-08-29T00:00:00.000Z"),
          verifiedAt: null,
        },
      ];
    },
  });

  const challenge = await repository.findActiveEmailVerificationChallenge({
    challengeId: "email-challenge-1",
    verificationTokenHash: "sha256:abc",
    now,
  });

  assert.equal(challenge.id, "email-challenge-1");
  assert.match(calls[0].statement, /from email_verification_challenges/);
  assert.match(calls[0].statement, /id = \$1/);
  assert.match(calls[0].statement, /verification_token_hash = \$2/);
  assert.match(calls[0].statement, /status = 'pending'/);
  assert.match(calls[0].statement, /expires_at > \$3/);
  assert.doesNotMatch(calls[0].statement, /select \*|raw_token|password/i);
  assert.deepEqual(calls[0].params, ["email-challenge-1", "sha256:abc", now]);
});

test("Postgres email verification repository marks challenge and user verified", async () => {
  const calls = [];
  const now = new Date("2026-08-28T00:00:00.000Z");
  const repository = new PostgresEmailVerificationRepository({
    async query() { throw new Error("Mutation must use a transaction."); },
    async transaction(work) {
      return work({ async query(statement, params) {
        calls.push({ statement, params });
        return [{ userId: "student-1" }];
      } });
    },
  });

  const result = await repository.markEmailVerified({
    challengeId: "email-challenge-1",
    userId: "student-1",
    verificationTokenHash: "sha256:abc",
    now,
  });

  assert.deepEqual(result, { verified: true });
  assert.equal(calls.length, 4);
  assert.match(calls[0].statement, /from users where id = \$1 for update/);
  assert.match(calls[1].statement, /update email_verification_challenges/);
  assert.match(calls[1].statement, /c\.verification_token_hash = \$4/);
  assert.match(calls[1].statement, /u\.email_normalized = c\.email_normalized/);
  assert.match(calls[1].statement, /clock_timestamp\(\)/);
  assert.match(calls[2].statement, /update users set email_verified_at = \$2/);
  assert.match(calls[3].statement, /set status = 'revoked'/);
  assert.doesNotMatch(calls.map((call) => call.statement).join("\n"), /select \*|raw_token|password/i);
  assert.deepEqual(calls[1].params, ["email-challenge-1", "student-1", now, "sha256:abc"]);
  assert.deepEqual(calls[2].params, ["student-1", now]);
});
