import assert from "node:assert/strict";
import test from "node:test";

import { createAuthRateLimiterFromEnv } from "../../../src/server/index.ts";

test("Auth rate limiter runtime uses upstream posture for production gateway enforcement", async () => {
  const limiter = createAuthRateLimiterFromEnv({
    env: {
      NODE_ENV: "production",
      CUAC_AUTH_RATE_LIMIT_ENFORCED: "true",
      CUAC_AUTH_RATE_LIMIT_BACKEND: "gateway",
    },
  });

  assert.ok(limiter);
  const decision = await limiter.assertAllowed({
    action: "auth.login",
    subject: { email: "student@example.com", ipHash: "sha256:ip" },
    now: new Date("2026-08-28T00:00:00.000Z"),
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.enforcement, "upstream");
  assert.match(decision.keyHash, /^sha256:[a-f0-9]{64}$/);
});

test("Auth rate limiter runtime rejects memory backend in production", () => {
  assert.throws(
    () =>
      createAuthRateLimiterFromEnv({
        env: {
          NODE_ENV: "production",
          CUAC_AUTH_RATE_LIMIT_ENFORCED: "true",
          CUAC_AUTH_RATE_LIMIT_BACKEND: "memory",
        },
      }),
    (error) => error instanceof Error && "status" in error && error.status === 503,
  );
});

test("Auth rate limiter runtime rejects Redis backend until an adapter exists", () => {
  assert.throws(
    () =>
      createAuthRateLimiterFromEnv({
        env: {
          NODE_ENV: "production",
          CUAC_AUTH_RATE_LIMIT_ENFORCED: "true",
          CUAC_AUTH_RATE_LIMIT_BACKEND: "redis",
        },
      }),
    /Redis Auth rate limiter adapter is not implemented/,
  );
});

test("Auth rate limiter runtime allows local memory limiter for tests only", async () => {
  const limiter = createAuthRateLimiterFromEnv({
    env: {
      NODE_ENV: "test",
      CUAC_AUTH_RATE_LIMIT_ENFORCED: "true",
      CUAC_AUTH_RATE_LIMIT_BACKEND: "memory",
    },
  });

  assert.ok(limiter);
  const decision = await limiter.assertAllowed({
    action: "auth.login",
    subject: { email: "student@example.com" },
    now: new Date("2026-08-28T00:00:00.000Z"),
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.enforcement, "application");
});

test("Auth rate limiter runtime allows local PostgreSQL limiter only with a client", async () => {
  const calls = [];
  const limiter = createAuthRateLimiterFromEnv({
    env: {
      NODE_ENV: "development",
      CUAC_AUTH_RATE_LIMIT_ENFORCED: "true",
      CUAC_AUTH_RATE_LIMIT_BACKEND: "postgres",
    },
    client: {
      async query(statement, params) {
        calls.push({ statement, params });
        return [{ attemptCount: 1, expiresAt: new Date("2026-08-28T00:05:00.000Z") }];
      },
    },
  });

  assert.ok(limiter);
  const decision = await limiter.assertAllowed({
    action: "auth.login",
    subject: { email: "student@example.com" },
    now: new Date("2026-08-28T00:00:00.000Z"),
  });

  assert.equal(decision.enforcement, "application");
  assert.match(calls[0].statement, /auth_rate_limit_buckets/);
});
