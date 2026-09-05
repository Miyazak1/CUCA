import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { issueGuestSession } from "../../../src/server/auth/guest-session.ts";
import {
  createSignInContinuationHttpHandlers,
  GUEST_SESSION_COOKIE_NAME,
  hashSessionToken,
  SESSION_COOKIE_NAME,
  SignInContinuationService,
  tooManyRequests,
} from "../../../src/server/index.ts";

const now = new Date("2026-08-28T00:00:00.000Z");
const guest = issueGuestSession();

function createHandlers(seed = null, options = {}) {
  const calls = [];
  const continuationRepository = {
    async createContinuation(input) {
      calls.push({ method: "createContinuation", input });
      return { continuationId: "a1111111-a111-4111-8111-a11111111111" };
    },
    async findActiveContinuation(input) {
      calls.push({ method: "findActiveContinuation", input });
      return seed;
    },
    async markContinuationConsumed(input) {
      calls.push({ method: "markContinuationConsumed", input });
      return { consumed: true };
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
    handlers: createSignInContinuationHttpHandlers(
      new SignInContinuationService(continuationRepository, { now, continuationTtlMs: 1000 }),
      authRepository,
      options,
    ),
  };
}

test("sign-in continuation HTTP create uses guest cookie and does not trust body authority", async () => {
  const { calls, handlers } = createHandlers();
  const response = await handlers.create(
    new Request("https://cuac.test/api/v1/auth/sign-in-continuations", {
      method: "POST",
      headers: {
        cookie: `${GUEST_SESSION_COOKIE_NAME}=${guest.token}`,
        "x-request-id": "req-1",
      },
      body: JSON.stringify({
        userId: "attacker",
        activeRole: "cuac_admin",
        targetRoute: "/application.html#add-choice",
        actionKey: "application.add_choice",
        payloadPreview: { programId: "c1111111-c111-4111-8111-c11111111111" },
      }),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.continuationId, "a1111111-a111-4111-8111-a11111111111");
  assert.match(body.data.continuationToken, /^[A-Za-z0-9_-]+$/);
  assert.equal(calls[0].method, "createContinuation");
  assert.equal(calls[0].input.guestSessionId, guest.guestSessionId);
  assert.equal(calls[0].input.requiredRole, "student");
  assert.equal(JSON.stringify(body).includes("sha256:"), false);
});

test("sign-in continuation HTTP consume resolves authenticated actor from session cookie", async () => {
  const { calls, handlers } = createHandlers({
    id: "a1111111-a111-4111-8111-a11111111111",
    guestSessionId: guest.guestSessionId,
    targetRoute: "/application.html#add-choice",
    actionKey: "application.add_choice",
    requiredRole: "student",
    tenantSchoolId: null,
    payloadPreview: { programId: "c1111111-c111-4111-8111-c11111111111" },
    expiresAt: new Date("2026-08-28T00:15:00.000Z"),
    consumedAt: null,
  });
  const response = await handlers.consume(
    new Request("https://cuac.test/api/v1/auth/sign-in-continuations/a1111111-a111-4111-8111-a11111111111/consume", {
      method: "POST",
      headers: {
        cookie: `${GUEST_SESSION_COOKIE_NAME}=${guest.token}; ${SESSION_COOKIE_NAME}=student-session`,
      },
      body: JSON.stringify({
        continuationToken: "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE",
        userId: "attacker",
      }),
    }),
    "a1111111-a111-4111-8111-a11111111111",
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.continuationId, "a1111111-a111-4111-8111-a11111111111");
  assert.equal(body.data.targetRoute, "/application.html#add-choice");
  assert.deepEqual(body.data.payloadPreview, { programId: "c1111111-c111-4111-8111-c11111111111" });
  assert.equal(calls[0].method, "findActiveSessionByTokenHash");
  assert.equal(calls[1].method, "findActiveContinuation");
  assert.match(calls[1].input.continuationTokenHash, /^sha256:/);
  assert.equal(calls[2].input.consumedByUserId, "student-1");
});

test("sign-in continuation HTTP consume rejects guests before repository consume", async () => {
  const { calls, handlers } = createHandlers();
  const response = await handlers.consume(
    new Request("https://cuac.test/api/v1/auth/sign-in-continuations/a1111111-a111-4111-8111-a11111111111/consume", {
      method: "POST",
      body: JSON.stringify({ continuationToken: "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE" }),
    }),
    "a1111111-a111-4111-8111-a11111111111",
  );
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.error.code, "FORBIDDEN");
  assert.equal(calls.some((call) => call.method === "findActiveContinuation"), false);
});

test("sign-in continuation HTTP create is rate limited before continuation storage", async () => {
  const { calls, handlers } = createHandlers(null, {
    rateLimiter: {
      async assertAllowed(input) {
        calls.push({ method: "assertAllowed", input });
        throw tooManyRequests("Too many continuation attempts.");
      },
    },
  });
  const response = await handlers.create(
    new Request("https://cuac.test/api/v1/auth/sign-in-continuations", {
      method: "POST",
      headers: {
        cookie: `${GUEST_SESSION_COOKIE_NAME}=${guest.token}`,
        "x-forwarded-for": "203.0.113.13",
      },
      body: JSON.stringify({
        targetRoute: "/application.html#add-choice",
        actionKey: "application.add_choice",
      }),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 429);
  assert.equal(body.error.code, "TOO_MANY_REQUESTS");
  assert.equal(calls[0].method, "assertAllowed");
  assert.equal(calls[0].input.action, "auth.sign_in_continuation.create");
  assert.equal(calls[0].input.subject.guestSessionId, guest.guestSessionId);
  assert.equal(calls.some((call) => call.method === "createContinuation"), false);
});

test("sign-in continuation app route files stay thin and contain no token hashing or SQL logic", async () => {
  const routePaths = [
    "../../../app/api/v1/auth/sign-in-continuations/route.ts",
    "../../../app/api/v1/auth/sign-in-continuations/[continuationId]/consume/route.ts",
  ];
  const contents = await Promise.all(routePaths.map((routePath) => readFile(new URL(routePath, import.meta.url), "utf8")));

  contents.forEach((source) => {
    assert.match(source, /getSignInContinuationRouteHandlers/);
    assert.doesNotMatch(source, /sha256|password|select\s+|insert\s+|public\//i);
  });
});
