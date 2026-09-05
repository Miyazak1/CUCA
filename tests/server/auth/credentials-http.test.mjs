import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { AuthCredentialsService, createAuthCredentialsHttpHandlers, SESSION_COOKIE_NAME, tooManyRequests } from "../../../src/server/index.ts";
import { createAuthRateLimitKey } from "../../../src/server/auth/rate-limit.ts";

test("credential HTTP handlers reject malformed bodies and unsupported fields without touching account storage", async () => {
  const { calls, handlers } = createHandlers();
  for (const handler of [handlers.registerStudent, handlers.createSession, handlers.logout]) {
    for (const raw of ["{", "null", "[]", "true", JSON.stringify({ NEVER_ECHO_AUTH_KEY: "NEVER_ECHO_AUTH_VALUE" })]) {
      const response = await handler(new Request("https://cuac.test/api/v1/auth/test", { method: "POST", body: raw }));
      assert.equal(response.status, 400);
      assert.doesNotMatch(await response.text(), /NEVER_ECHO_AUTH/);
      assert.equal(response.headers.get("set-cookie"), null);
    }
  }
  assert.equal(calls.length, 0);
});

test("malformed email never reaches the Auth rate limiter as an object or causes a 500", async () => {
  const subjects = [];
  const { calls, handlers } = createHandlers({}, { rateLimiter: { async assertAllowed(input) {
    subjects.push(input.subject.email);
    assert.match(createAuthRateLimitKey(input), /^sha256:/);
  } } });
  for (const handler of [handlers.registerStudent, handlers.createSession]) {
    for (const email of [{ nested: true }, [], 123, null, "x".repeat(321)]) {
      const response = await handler(new Request("https://cuac.test/api/v1/auth/test", { method: "POST", body: JSON.stringify({ email, password: "strong-password" }) }));
      assert.equal(response.status, 400, await response.clone().text());
    }
  }
  assert.deepEqual(subjects, Array(10).fill(null));
  assert.equal(calls.length, 0);
});

function createHandlers(overrides = {}, options = {}) {
  const calls = [];
  const repository = {
    async findPasswordIdentityByEmailNormalized() {
      calls.push({ method: "findPasswordIdentityByEmailNormalized" });
      return null;
    },
    async createStudentAccount() {
      calls.push({ method: "createStudentAccount" });
      return { userId: "student-1" };
    },
    async createSession(input) {
      calls.push({ method: "createSession", input });
      return { sessionId: "session-1", selectedSurface: "student", activeRole: "student", tenantSchoolId: null };
    },
    async revokeSessionByTokenHash(input) {
      calls.push({ method: "revokeSessionByTokenHash", input });
      return { revoked: true };
    },
    async findSessionReauthenticationTarget() {
      calls.push({ method: "findSessionReauthenticationTarget" });
      return null;
    },
    async activateSessionStepUp(input) {
      calls.push({ method: "activateSessionStepUp", input });
      return { sessionId: input.sessionId, stepUpExpiresAt: new Date("2026-08-28T00:10:00.000Z") };
    },
    ...overrides,
  };
  const handlers = createAuthCredentialsHttpHandlers(
    new AuthCredentialsService(repository, {
      now: new Date("2026-08-28T00:00:00.000Z"),
      sessionTtlMs: 1000 * 60,
    }),
    { secureCookies: true, ...options },
  );

  return { calls, handlers };
}

test("auth credentials HTTP registration sets session cookie without returning secrets", async () => {
  const { handlers } = createHandlers();
  const response = await handlers.registerStudent(
    new Request("https://cuac.test/api/v1/auth/register", {
      method: "POST",
      headers: { "user-agent": "browser", "x-forwarded-for": "203.0.113.10" },
      body: JSON.stringify({ email: "student@example.com", password: "strong-password", displayName: "Student" }),
    }),
  );
  const body = await response.json();
  const cookie = response.headers.get("set-cookie") ?? "";

  assert.equal(response.status, 201);
  assert.equal(body.data.userId, "student-1");
  assert.equal(body.data.activeRole, "student");
  assert.match(cookie, new RegExp(`${SESSION_COOKIE_NAME}=`));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Secure/);
  assert.doesNotMatch(JSON.stringify(body), /strong-password|sha256:|scrypt|cuac_session/);
});

test("auth credentials HTTP login returns stable forbidden error without revealing account state", async () => {
  const repository = {
    async findPasswordIdentityByEmailNormalized() {
      return null;
    },
    async createStudentAccount() {
      throw new Error("should not create account");
    },
    async createSession() {
      throw new Error("should not create session");
    },
    async revokeSessionByTokenHash() {
      throw new Error("should not revoke session");
    },
  };
  const handlers = createAuthCredentialsHttpHandlers(new AuthCredentialsService(repository));
  const response = await handlers.createSession(
    new Request("https://cuac.test/api/v1/auth/sessions", {
      method: "POST",
      body: JSON.stringify({ email: "missing@example.com", password: "strong-password" }),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.error.code, "FORBIDDEN");
  assert.equal(body.error.message, "Invalid email or password.");
});

test("auth login accepts a selected access context and returns only the repository-verified session persona", async () => {
  const calls = [];
  const schoolId = "11111111-1111-4111-8111-111111111111";
  const handlers = createAuthCredentialsHttpHandlers({
    async createStudentSession(input, requestId) {
      calls.push({ input, requestId });
      return {
        userId: "staff-1", sessionId: "session-1", sessionToken: Buffer.alloc(32, 4).toString("base64url"),
        expiresAt: new Date("2026-08-29T00:00:00.000Z"), selectedSurface: "school",
        activeRole: "school_staff", tenantSchoolId: schoolId,
      };
    },
  }, { secureCookies: true });
  const response = await handlers.createSession(new Request("https://cuac.test/api/v1/auth/sessions", {
    method: "POST", headers: { "x-request-id": "school-login" },
    body: JSON.stringify({ email: "staff@example.com", password: "strong-password",
      selectedSurface: "school_staff", schoolId, activeRole: "cuac_admin" }),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, {
    userId: "staff-1", sessionId: "session-1", activeRole: "school_staff",
    selectedSurface: "school", tenantSchoolId: schoolId, expiresAt: "2026-08-29T00:00:00.000Z",
  });
  assert.equal(calls[0].input.selectedSurface, "school_staff");
  assert.equal(calls[0].input.schoolId, schoolId);
  assert.equal(Object.hasOwn(calls[0].input, "activeRole"), false);
  assert.match(response.headers.get("set-cookie") ?? "", new RegExp(`${SESSION_COOKIE_NAME}=`));
});

test("auth credentials HTTP registration is rate limited before account creation", async () => {
  const { calls, handlers } = createHandlers(
    {},
    {
      rateLimiter: {
        async assertAllowed(input) {
          calls.push({ method: "assertAllowed", input });
          throw tooManyRequests("Too many authentication attempts. Please try again later.");
        },
      },
    },
  );
  const response = await handlers.registerStudent(
    new Request("https://cuac.test/api/v1/auth/register", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.10" },
      body: JSON.stringify({ email: "student@example.com", password: "strong-password" }),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 429);
  assert.equal(body.error.code, "TOO_MANY_REQUESTS");
  assert.equal(calls[0].method, "assertAllowed");
  assert.equal(calls[0].input.action, "auth.register");
  assert.match(calls[0].input.subject.ipHash, /^sha256:/);
  assert.equal(calls.some((call) => call.method === "createStudentAccount"), false);
});

test("auth credentials HTTP logout clears the session cookie without returning secrets", async () => {
  const { calls, handlers } = createHandlers();
  const response = await handlers.logout(
    new Request("https://cuac.test/api/v1/auth/logout", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=raw-session-token`, "x-request-id": "req-logout" },
    }),
  );
  const body = await response.json();
  const cookie = response.headers.get("set-cookie") ?? "";

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-request-id"), "req-logout");
  assert.deepEqual(body, { data: { revoked: true } });
  assert.match(cookie, new RegExp(`^${SESSION_COOKIE_NAME}=`));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /Max-Age=0/);
  assert.match(cookie, /Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
  assert.ok(response.headers.getSetCookie().some((value) => value.startsWith("cuac_guest=") && value.includes("Max-Age=0")));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "revokeSessionByTokenHash");
  assert.match(calls[0].input.sessionTokenHash, /^sha256:/);
  assert.notEqual(calls[0].input.sessionTokenHash, "raw-session-token");
  assert.doesNotMatch(JSON.stringify(body), /raw-session-token|sha256:|cuac_session/);
});

test("auth credentials HTTP logout without a session cookie is idempotent", async () => {
  const { calls, handlers } = createHandlers();
  const response = await handlers.logout(new Request("https://cuac.test/api/v1/auth/logout", { method: "POST" }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { data: { revoked: false } });
  assert.equal(calls.length, 0);
});

test("auth step-up is session-bound, rate-limited and returns no credential material", async () => {
  const calls = [];
  const expiresAt = new Date("2026-08-28T00:10:00.000Z");
  const handlers = createAuthCredentialsHttpHandlers({
    async stepUpSession(input, requestId) {
      calls.push({ method: "stepUpSession", input, requestId });
      return { userId: "student-1", sessionId: "session-1", stepUpExpiresAt: expiresAt };
    },
  }, { rateLimiter: { async assertAllowed(input) { calls.push({ method: "rate", input }); } }, secureCookies: true });
  const token = Buffer.alloc(32, 9).toString("base64url");
  const response = await handlers.stepUpSession(new Request("https://cuac.test/api/v1/auth/step-up", {
    method: "POST",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${token}`, "x-request-id": "step-up-request",
      "x-forwarded-for": "203.0.113.10" },
    body: JSON.stringify({ password: "strong-password" }),
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("set-cookie"), null);
  const responseBody = await response.json();
  assert.deepEqual(responseBody, { data: { userId: "student-1", sessionId: "session-1",
    authStrength: "step_up", stepUpExpiresAt: expiresAt.toISOString() } });
  assert.equal(calls[0].input.action, "auth.step_up");
  assert.match(calls[0].input.subject.sessionTokenHash, /^sha256:/);
  assert.doesNotMatch(calls[0].input.subject.sessionTokenHash, new RegExp(token));
  assert.equal(calls[1].input.sessionToken, token);
  assert.equal(calls[1].input.password, "strong-password");
  assert.doesNotMatch(JSON.stringify(responseBody), /strong-password|cuac_session/);
});

test("auth credentials app route files stay thin and do not contain password or SQL logic", async () => {
  const routePaths = [
    "../../../app/api/v1/auth/register/route.ts",
    "../../../app/api/v1/auth/sessions/route.ts",
    "../../../app/api/v1/auth/logout/route.ts",
    "../../../app/api/v1/auth/step-up/route.ts",
  ];
  const contents = await Promise.all(routePaths.map((routePath) => readFile(new URL(routePath, import.meta.url), "utf8")));

  contents.forEach((source) => {
    assert.match(source, /getAuthCredentialsRouteHandlers/);
    assert.doesNotMatch(source, /password_hash|scrypt|select\s+|insert\s+|cuac-data|public\//i);
  });
});
