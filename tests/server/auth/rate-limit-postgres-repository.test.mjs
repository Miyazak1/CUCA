import assert from "node:assert/strict";
import test from "node:test";

import { PostgresAuthRateLimitStore } from "../../../src/server/index.ts";

test("Postgres Auth rate limit store upserts fixed hash-key buckets", async () => {
  const calls = [];
  const now = new Date("2026-08-28T10:02:15.000Z");
  const store = new PostgresAuthRateLimitStore({
    async query(statement, params) {
      calls.push({ statement, params });
      return [{ attemptCount: 3, expiresAt: new Date("2026-08-28T10:05:00.000Z") }];
    },
  });

  const result = await store.consume({
    action: "auth.login",
    keyHash: "sha256:key",
    rule: { maxAttempts: 10, windowSeconds: 300 },
    now,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 7);
  assert.equal(result.retryAfterSeconds, 165);
  assert.match(calls[0].statement, /insert into auth_rate_limit_buckets/);
  assert.match(calls[0].statement, /on conflict \(action, key_hash, window_start\) do update/);
  assert.match(calls[0].statement, /attempt_count = auth_rate_limit_buckets\.attempt_count \+ 1/);
  assert.match(calls[0].statement, /returning\s+attempt_count as "attemptCount"/);
  assert.doesNotMatch(calls[0].statement, /select \*|email|ip_address|user_agent|raw_subject|session_token|password|card_number|cvv/i);
  assert.deepEqual(calls[0].params, [
    "auth.login",
    "sha256:key",
    new Date("2026-08-28T10:00:00.000Z"),
    300,
    new Date("2026-08-28T10:05:00.000Z"),
    now,
  ]);
});

test("Postgres Auth rate limit store returns blocked decisions after the limit", async () => {
  const store = new PostgresAuthRateLimitStore({
    async query() {
      return [{ attemptCount: 11, expiresAt: new Date("2026-08-28T10:05:00.000Z") }];
    },
  });

  const result = await store.consume({
    action: "auth.password_reset.request",
    keyHash: "sha256:key",
    rule: { maxAttempts: 10, windowSeconds: 300 },
    now: new Date("2026-08-28T10:04:30.000Z"),
  });

  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
  assert.equal(result.retryAfterSeconds, 30);
});
