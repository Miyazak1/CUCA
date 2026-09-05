import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createPasswordResetHttpHandlers, PasswordResetService, tooManyRequests } from "../../../src/server/index.ts";

const now = new Date("2026-08-28T00:00:00.000Z");

test("password reset rejects unknown fields, invalid email, IDs, proofs and passwords before repository access", async () => {
  const { calls, handlers } = createHandlers();
  const request = (body) => new Request("https://cuac.test/api/v1/auth/password-reset", { method: "POST", body: JSON.stringify(body) });
  for (const body of [null, [], { email: {} }, { email: "a..b@example.com" }, { email: "student@example.com", newPassword: "NEVER_ACCEPT_AT_REQUEST" }]) {
    assert.equal((await handlers.requestReset(request(body))).status, 400);
  }
  const base = { resetToken: Buffer.alloc(32).toString("base64url"), newPassword: "Synthetic reset password" };
  for (const body of [{ ...base, resetToken: {} }, { ...base, resetToken: "wrong" }, { ...base, newPassword: "short" }, { ...base, newPassword: "x".repeat(1025) }, { ...base, passwordHash: "forged" }]) {
    assert.equal((await handlers.resetPassword(request(body), "a4444444-a444-4444-8444-a44444444444")).status, 400);
  }
  assert.equal((await handlers.resetPassword(request(base), "bad-id")).status, 400);
  assert.equal(calls.length, 0);
});

function createHandlers(challenge = null, options = {}) {
  const calls = [];
  const repository = {
    async findPasswordResetTargetByEmailNormalized(emailNormalized) {
      calls.push({ method: "findPasswordResetTargetByEmailNormalized", emailNormalized });
      return {
        userId: "student-1",
        emailNormalized,
        accountStatus: "active",
        hasPasswordIdentity: true,
      };
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
      return { reset: true, revokedSessionCount: 2 };
    },
  };
  const authRepository = {
    async findActiveSessionByTokenHash() {
      throw new Error("password reset should not require active session");
    },
  };

  return {
    calls,
    handlers: createPasswordResetHttpHandlers(new PasswordResetService(repository, { now }), authRepository, options),
  };
}

test("password reset HTTP request accepts email without returning reset token", async () => {
  const { calls, handlers } = createHandlers();
  const response = await handlers.requestReset(
    new Request("https://cuac.test/api/v1/auth/password-reset", {
      method: "POST",
      body: JSON.stringify({ email: "student@example.com", userId: "attacker" }),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body.data, { status: "accepted" });
  assert.equal(JSON.stringify(body).includes("resetToken"), false);
  assert.equal(calls[0].emailNormalized, "student@example.com");
  assert.match(calls[1].input.resetTokenHash, /^sha256:/);
});

test("password reset HTTP consumes reset token and returns no secrets", async () => {
  const { calls, handlers } = createHandlers({
    id: "a4444444-a444-4444-8444-a44444444444",
    userId: "student-1",
    emailNormalized: "student@example.com",
    status: "pending",
    expiresAt: new Date("2026-08-28T00:15:00.000Z"),
    consumedAt: null,
  });
  const response = await handlers.resetPassword(
    new Request("https://cuac.test/api/v1/auth/password-reset/a4444444-a444-4444-8444-a44444444444/reset", {
      method: "POST",
      body: JSON.stringify({ resetToken: "AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM", newPassword: "new-strong-password" }),
    }),
    "a4444444-a444-4444-8444-a44444444444",
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body.data, { status: "reset", challengeId: "a4444444-a444-4444-8444-a44444444444", revokedSessionCount: 2 });
  assert.match(calls[0].input.resetTokenHash, /^sha256:/);
  assert.equal(JSON.stringify(body).includes("AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM"), false);
  assert.equal(JSON.stringify(body).includes("new-strong-password"), false);
});

test("password reset HTTP request is rate limited before challenge creation", async () => {
  const rateLimitCalls = [];
  const { calls, handlers } = createHandlers(null, {
    rateLimiter: {
      async assertAllowed(input) {
        rateLimitCalls.push({ method: "assertAllowed", input });
        throw tooManyRequests("Too many reset attempts.");
      },
    },
  });
  const response = await handlers.requestReset(
    new Request("https://cuac.test/api/v1/auth/password-reset", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.11" },
      body: JSON.stringify({ email: "student@example.com" }),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 429);
  assert.equal(body.error.code, "TOO_MANY_REQUESTS");
  assert.equal(rateLimitCalls[0].input.action, "auth.password_reset.request");
  assert.match(rateLimitCalls[0].input.subject.ipHash, /^sha256:/);
  assert.equal(calls.some((call) => call.method === "createPasswordResetChallenge"), false);
});

test("password reset app route files stay thin and contain no hashing or SQL logic", async () => {
  const routePaths = [
    "../../../app/api/v1/auth/password-reset/route.ts",
    "../../../app/api/v1/auth/password-reset/[challengeId]/reset/route.ts",
  ];
  const contents = await Promise.all(routePaths.map((routePath) => readFile(new URL(routePath, import.meta.url), "utf8")));

  contents.forEach((source) => {
    assert.match(source, /getPasswordResetRouteHandlers/);
    assert.doesNotMatch(source, /sha256|password_hash|scrypt|select\s+|insert\s+|public\//i);
  });
});
