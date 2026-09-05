import assert from "node:assert/strict";
import test from "node:test";
import { PostgresPasswordResetRepository } from "../../../src/server/index.ts";

test("Postgres password reset repository finds active password target with fixed SQL", async () => {
  const calls = [];
  const repository = new PostgresPasswordResetRepository({
    async query(statement, params) {
      calls.push({ statement, params });
      return [{ userId: "student-1", emailNormalized: "student@example.com", accountStatus: "active", hasPasswordIdentity: true }];
    },
  });

  const target = await repository.findPasswordResetTargetByEmailNormalized("student@example.com");

  assert.equal(target.userId, "student-1");
  assert.match(calls[0].statement, /from users u/);
  assert.match(calls[0].statement, /left join auth_identities i/);
  assert.match(calls[0].statement, /i\.provider = 'password'/);
  assert.match(calls[0].statement, /u\.email_normalized = \$1/);
  assert.doesNotMatch(calls[0].statement, /select \*|session_token|reset_token/i);
  assert.deepEqual(calls[0].params, ["student@example.com"]);
});

test("Postgres password reset repository creates challenge with token hash only", async () => {
  const calls = [];
  const now = new Date("2026-08-28T00:00:00.000Z");
  const expiresAt = new Date("2026-08-28T00:30:00.000Z");
  const repository = new PostgresPasswordResetRepository({
    async transaction(work) { return work(this); },
    async query(statement, params) {
      calls.push({ statement, params });
      return [{ challengeId: "reset-challenge-1" }];
    },
  });

  const result = await repository.createPasswordResetChallenge({
    userId: "student-1",
    emailNormalized: "student@example.com",
    resetTokenHash: "sha256:abc",
    now,
    expiresAt,
  });

  assert.match(calls[0].statement, /from users.*for update/);
  assert.deepEqual(result, { challengeId: "reset-challenge-1" });
  assert.match(calls[1].statement, /insert into password_reset_challenges/);
  assert.match(calls[1].statement, /reset_token_hash/);
  assert.doesNotMatch(calls[1].statement, /raw_token|reset_token" text|select \*/i);
  assert.match(calls[1].statement, /i\.password_hash is not null/);
  assert.deepEqual(calls[1].params, ["student-1", "student@example.com", "sha256:abc", now, expiresAt]);
});

test("Postgres password reset repository finds active challenge by id and token hash", async () => {
  const calls = [];
  const now = new Date("2026-08-28T00:00:00.000Z");
  const repository = new PostgresPasswordResetRepository({
    async query(statement, params) {
      calls.push({ statement, params });
      return [
        {
          id: "reset-challenge-1",
          userId: "student-1",
          emailNormalized: "student@example.com",
          status: "pending",
          expiresAt: new Date("2026-08-28T00:30:00.000Z"),
          consumedAt: null,
        },
      ];
    },
  });

  const challenge = await repository.findActivePasswordResetChallenge({
    challengeId: "reset-challenge-1",
    resetTokenHash: "sha256:abc",
    now,
  });

  assert.equal(challenge.id, "reset-challenge-1");
  assert.match(calls[0].statement, /from password_reset_challenges/);
  assert.match(calls[0].statement, /id = \$1/);
  assert.match(calls[0].statement, /reset_token_hash = \$2/);
  assert.match(calls[0].statement, /status = 'pending'/);
  assert.match(calls[0].statement, /expires_at > \$3/);
  assert.doesNotMatch(calls[0].statement, /select \*|raw_token|password_hash/i);
  assert.deepEqual(calls[0].params, ["reset-challenge-1", "sha256:abc", now]);
});

test("Postgres password reset repository consumes, changes password and revokes sessions in one transaction", async () => {
  const calls = [];
  const now = new Date("2026-08-28T00:00:00.000Z");
  const repository = new PostgresPasswordResetRepository({
    async query() { throw new Error("Mutation must use a transaction."); },
    async transaction(work) {
      return work({ async query(statement, params) {
        calls.push({ statement, params });
        return [{ id: "updated" }];
      } });
    },
  });

  const result = await repository.consumePasswordReset({
    challengeId: "reset-challenge-1",
    userId: "student-1",
    resetTokenHash: "sha256:abc",
    passwordHash: "scrypt$salt$hash",
    now,
  });

  assert.deepEqual(result, { reset: true, revokedSessionCount: 1 });
  assert.equal(calls.length, 5);
  assert.match(calls[0].statement, /from users where id = \$1 for update/);
  assert.match(calls[1].statement, /update password_reset_challenges/);
  assert.match(calls[1].statement, /c\.reset_token_hash = \$4/);
  assert.match(calls[1].statement, /u\.email_normalized = c\.email_normalized/);
  assert.match(calls[1].statement, /clock_timestamp\(\)/);
  assert.match(calls[2].statement, /update auth_identities/);
  assert.match(calls[2].statement, /set password_hash = \$2/);
  assert.match(calls[2].statement, /provider = 'password'/);
  assert.match(calls[3].statement, /update auth_sessions set revoked_at = \$2/);
  assert.match(calls[4].statement, /set status = 'revoked'/);
  assert.doesNotMatch(calls.map((call) => call.statement).join("\n"), /select \*|raw_token|session_token/i);
  assert.deepEqual(calls[1].params, ["reset-challenge-1", "student-1", now, "sha256:abc"]);
  assert.deepEqual(calls[2].params, ["student-1", "scrypt$salt$hash", now]);
});

test("Postgres password reset repository leaves credentials and sessions untouched when the final challenge check fails", async () => {
  const calls = [];
  const now = new Date("2026-08-28T00:00:00.000Z");
  const repository = new PostgresPasswordResetRepository({
    async query() { throw new Error("Mutation must use a transaction."); },
    async transaction(work) {
      return work({ async query(statement, params) {
        calls.push({ statement, params });
        return [];
      } });
    },
  });

  const result = await repository.consumePasswordReset({ challengeId: "missing", resetTokenHash: "sha256:abc", passwordHash: "scrypt$salt$hash", userId: "student-1", now });

  assert.deepEqual(result, { reset: false, revokedSessionCount: 0 });
  assert.equal(calls.length, 2);
  assert.doesNotMatch(calls.map((call) => call.statement).join("\n"), /update auth_sessions|update auth_identities/);
});
