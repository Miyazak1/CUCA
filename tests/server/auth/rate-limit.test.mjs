import assert from "node:assert/strict";
import test from "node:test";

import { AuthRateLimitService, InMemoryAuthRateLimitStore, createAuthRateLimitKey } from "../../../src/server/index.ts";

test("Auth rate limit keys hash normalized subjects without exposing raw identifiers", () => {
  const first = createAuthRateLimitKey({
    action: "auth.login",
    subject: { email: " Student@Example.COM ", ipHash: "sha256:ip" },
  });
  const second = createAuthRateLimitKey({
    action: "auth.login",
    subject: { email: "student@example.com", ipHash: "sha256:ip" },
  });

  assert.equal(first, second);
  assert.match(first, /^sha256:[a-f0-9]{64}$/);
  assert.doesNotMatch(first, /student|example|sha256:ip/i);
});

test("Auth rate limit service blocks after the configured window quota", async () => {
  const service = new AuthRateLimitService({
    store: new InMemoryAuthRateLimitStore(),
    rules: { "auth.password_reset.request": { maxAttempts: 2, windowSeconds: 60 } },
  });
  const subject = { email: "student@example.com", ipHash: "sha256:ip" };
  const now = new Date("2026-08-28T10:00:00.000Z");

  const first = await service.assertAllowed({ action: "auth.password_reset.request", subject, now });
  const second = await service.assertAllowed({ action: "auth.password_reset.request", subject, now });

  assert.equal(first.allowed, true);
  assert.equal(first.remaining, 1);
  assert.equal(second.allowed, true);
  assert.equal(second.remaining, 0);

  await assert.rejects(
    () => service.assertAllowed({ action: "auth.password_reset.request", subject, now }),
    (error) => error instanceof Error && "status" in error && error.status === 429 && "code" in error && error.code === "TOO_MANY_REQUESTS",
  );
});

test("Auth rate limit service opens a fresh bucket after reset", async () => {
  const service = new AuthRateLimitService({
    store: new InMemoryAuthRateLimitStore(),
    rules: { "auth.login": { maxAttempts: 1, windowSeconds: 60 } },
  });
  const subject = { email: "student@example.com" };

  await service.assertAllowed({ action: "auth.login", subject, now: new Date("2026-08-28T10:00:00.000Z") });
  const reset = await service.assertAllowed({ action: "auth.login", subject, now: new Date("2026-08-28T10:01:01.000Z") });

  assert.equal(reset.allowed, true);
  assert.equal(reset.remaining, 0);
});

test("Auth rate limit rejects checks without a stable subject", () => {
  assert.throws(
    () => createAuthRateLimitKey({ action: "auth.login", subject: {} }),
    (error) => error instanceof Error && "status" in error && error.status === 400,
  );
});
