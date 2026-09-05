import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createEmailVerificationHttpHandlers,
  EmailVerificationService,
  hashSessionToken,
  SESSION_COOKIE_NAME,
  tooManyRequests,
} from "../../../src/server/index.ts";

const now = new Date("2026-08-28T00:00:00.000Z");

test("email verification HTTP rejects client-selected email and malformed challenge proofs before storage", async () => {
  const { calls, handlers } = createHandlers();
  const request = (body) => new Request("https://cuac.test/api/v1/auth/email-verification", { method: "POST", headers: { cookie: `${SESSION_COOKIE_NAME}=student-session` }, body: JSON.stringify(body) });
  assert.equal((await handlers.requestVerification(request({ email: "attacker@example.com" }))).status, 400);
  for (const token of [null, {}, "", "x".repeat(1000)]) {
    assert.equal((await handlers.verifyEmail(request({ verificationToken: token }), "a3333333-a333-4333-8333-a33333333333")).status, 400);
  }
  assert.equal((await handlers.verifyEmail(request({ verificationToken: Buffer.alloc(32).toString("base64url") }), "bad-id")).status, 400);
  assert.ok(calls.every((call) => call.method === "findActiveSessionByTokenHash"));
});

function createHandlers(challenge = null, options = {}) {
  const calls = [];
  const repository = {
    async findVerificationTargetByUserId(userId) {
      calls.push({ method: "findVerificationTargetByUserId", userId });
      return {
        userId,
        emailNormalized: "student@example.com",
        emailVerifiedAt: null,
        accountStatus: "active",
      };
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
  };
  const authRepository = {
    async findActiveSessionByTokenHash(sessionTokenHash) {
      calls.push({ method: "findActiveSessionByTokenHash", sessionTokenHash });
      if (sessionTokenHash !== hashSessionToken("student-session")) {
        return null;
      }

      return {
        userId: "student-1",
        selectedSurface: "student",
        activeRole: "student",
        tenantSchoolId: null,
        authStrength: "session",
        expiresAt: new Date("2026-09-29T00:00:00.000Z"),
        revokedAt: null,
        accountStatus: "active",
      };
    },
  };

  return {
    calls,
    handlers: createEmailVerificationHttpHandlers(new EmailVerificationService(repository, { now }), authRepository, options),
  };
}

test("email verification HTTP request resolves actor from session and returns no token", async () => {
  const { calls, handlers } = createHandlers();
  const response = await handlers.requestVerification(
    new Request("https://cuac.test/api/v1/auth/email-verification", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=student-session` },
      body: JSON.stringify({ userId: "attacker" }),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.challengeId, "a3333333-a333-4333-8333-a33333333333");
  assert.equal(body.data.status, "pending");
  assert.equal(body.data.deliveryStatus, "deferred");
  assert.equal(JSON.stringify(body).includes("verificationToken"), false);
  assert.equal(calls[0].method, "findActiveSessionByTokenHash");
  assert.equal(calls[1].userId, "student-1");
});

test("email verification HTTP request rejects guests before challenge creation", async () => {
  const { calls, handlers } = createHandlers();
  const response = await handlers.requestVerification(
    new Request("https://cuac.test/api/v1/auth/email-verification", {
      method: "POST",
      body: JSON.stringify({}),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.error.code, "FORBIDDEN");
  assert.equal(calls.some((call) => call.method === "createEmailVerificationChallenge"), false);
});

test("email verification HTTP verify consumes token without returning secrets", async () => {
  const { calls, handlers } = createHandlers({
    id: "a3333333-a333-4333-8333-a33333333333",
    userId: "student-1",
    emailNormalized: "student@example.com",
    status: "pending",
    expiresAt: new Date("2026-08-28T00:15:00.000Z"),
    verifiedAt: null,
  });
  const response = await handlers.verifyEmail(
    new Request("https://cuac.test/api/v1/auth/email-verification/a3333333-a333-4333-8333-a33333333333/verify", {
      method: "POST",
      body: JSON.stringify({ verificationToken: "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI" }),
    }),
    "a3333333-a333-4333-8333-a33333333333",
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body.data, { status: "verified", challengeId: "a3333333-a333-4333-8333-a33333333333" });
  assert.equal(calls[0].method, "findActiveEmailVerificationChallenge");
  assert.match(calls[0].input.verificationTokenHash, /^sha256:/);
  assert.notEqual(calls[0].input.verificationTokenHash, "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI");
  assert.equal(JSON.stringify(body).includes("AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI"), false);
});

test("email verification HTTP request is rate limited before challenge creation", async () => {
  const { calls, handlers } = createHandlers(null, {
    rateLimiter: {
      async assertAllowed(input) {
        calls.push({ method: "assertAllowed", input });
        throw tooManyRequests("Too many email verification attempts.");
      },
    },
  });
  const response = await handlers.requestVerification(
    new Request("https://cuac.test/api/v1/auth/email-verification", {
      method: "POST",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=student-session`,
        "x-forwarded-for": "203.0.113.12",
      },
      body: JSON.stringify({}),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 429);
  assert.equal(body.error.code, "TOO_MANY_REQUESTS");
  assert.equal(calls[1].method, "assertAllowed");
  assert.equal(calls[1].input.action, "auth.email_verification.request");
  assert.equal(calls.some((call) => call.method === "createEmailVerificationChallenge"), false);
});

test("email verification app route files stay thin and contain no token hashing or SQL logic", async () => {
  const routePaths = [
    "../../../app/api/v1/auth/email-verification/route.ts",
    "../../../app/api/v1/auth/email-verification/[challengeId]/verify/route.ts",
  ];
  const contents = await Promise.all(routePaths.map((routePath) => readFile(new URL(routePath, import.meta.url), "utf8")));

  contents.forEach((source) => {
    assert.match(source, /getEmailVerificationRouteHandlers/);
    assert.doesNotMatch(source, /sha256|password|select\s+|insert\s+|public\//i);
  });
});
