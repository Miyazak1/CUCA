import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createSchoolStaffInviteHttpHandlers,
  hashSessionToken,
  SchoolStaffInviteService,
  SESSION_COOKIE_NAME,
  tooManyRequests,
} from "../../../src/server/index.ts";

const now = new Date("2026-08-28T00:00:00.000Z");

test("school invite HTTP rejects unsupported commands and invalid data before invite storage", async () => {
  const { calls, handlers } = createHandlers({ sessionUserId: "ops-1", sessionRole: "cuac_ops", sessionSurface: "ops" });
  const request = (body) => new Request("https://cuac.test/api/v1/auth/school-invites", { method: "POST", headers: { cookie: `${SESSION_COOKIE_NAME}=teacher-session` }, body: JSON.stringify(body) });
  const base = { schoolId: "b1111111-b111-4111-8111-b11111111111", email: "teacher@example.edu", role: "viewer" };
  for (const body of [null, [], { ...base, schoolId: "bad-id" }, { ...base, email: {} }, { ...base, role: {} }, { ...base, inviteToken: "attacker-token" }, { ...base, expiresAt: "2099-01-01" }]) {
    assert.equal((await handlers.create(request(body))).status, 400);
  }
  const id = "a2222222-a222-4222-8222-a22222222222";
  assert.equal((await handlers.accept(request({ inviteToken: {} }), id)).status, 400);
  assert.equal((await handlers.revoke(request({ revoked: true }), id)).status, 400);
  assert.ok(calls.every((call) => ["findActiveSessionByTokenHash", "findActiveCuacStaffAccessGrantByUserAndRole"].includes(call.method)));
});

function createHandlers(options = {}) {
  const calls = [];
  const repository = {
    async hasLiveCuacStaffAuthority(input) {
      calls.push({ method: "hasLiveCuacStaffAuthority", input });
      return options.liveBusinessAuthority !== false;
    },
    async findAccountByUserId(userId) {
      calls.push({ method: "findAccountByUserId", userId });
      return {
        userId,
        emailNormalized: "teacher@example.edu",
        accountStatus: "active",
      };
    },
    async findSchoolById(schoolId) {
      calls.push({ method: "findSchoolById", schoolId });
      return { id: schoolId, status: "active" };
    },
    async createInvite(input) {
      calls.push({ method: "createInvite", input });
      return { inviteId: "a2222222-a222-4222-8222-a22222222222" };
    },
    async findActiveInviteByIdAndTokenHash(input) {
      calls.push({ method: "findActiveInviteByIdAndTokenHash", input });
      return {
        id: "a2222222-a222-4222-8222-a22222222222",
        schoolId: "b1111111-b111-4111-8111-b11111111111",
        emailNormalized: "teacher@example.edu",
        role: "school_admin",
        invitedByUserId: "ops-1",
        expiresAt: new Date("2026-09-29T00:00:00.000Z"),
      };
    },
    async acceptInvite(input) {
      calls.push({ method: "acceptInvite", input });
      return {
        inviteId: input.inviteId,
        schoolId: input.schoolId,
        userId: input.userId,
        role: input.role,
        membershipId: "membership-1",
        acceptedAt: input.acceptedAt,
        schoolStaffRoleGranted: true,
      };
    },
    async revokePendingInvite(input) {
      calls.push({ method: "revokePendingInvite", input });
      return { revoked: true };
    },
  };
  const authRepository = {
    async findActiveSessionByTokenHash(sessionTokenHash) {
      calls.push({ method: "findActiveSessionByTokenHash", sessionTokenHash });
      if (sessionTokenHash !== hashSessionToken("teacher-session")) {
        return null;
      }

      return {
        userId: options.sessionUserId ?? "teacher-1",
        selectedSurface: options.sessionSurface ?? "student",
        activeRole: options.sessionRole ?? "student",
        tenantSchoolId: null,
        authStrength: "session",
        expiresAt: new Date("2026-09-29T00:00:00.000Z"),
        revokedAt: null,
        accountStatus: "active",
      };
    },
    async findActiveCuacStaffAccessGrantByUserAndRole(userId, role) {
      calls.push({ method: "findActiveCuacStaffAccessGrantByUserAndRole", userId, role });
      if (options.activeGrant === false) return null;
      return { userId, role, status: "approved", expiresAt: new Date("2026-09-29T00:00:00.000Z") };
    },
  };

  return {
    calls,
    handlers: createSchoolStaffInviteHttpHandlers(new SchoolStaffInviteService(repository, { now }), authRepository, options),
  };
}

test("school staff invite HTTP create resolves Ops actor and returns no token", async () => {
  const { calls, handlers } = createHandlers({ sessionUserId: "ops-1", sessionRole: "cuac_ops", sessionSurface: "ops" });
  const response = await handlers.create(
    new Request("https://cuac.test/api/v1/auth/school-invites", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=teacher-session` },
      body: JSON.stringify({
        schoolId: "b1111111-b111-4111-8111-b11111111111",
        email: "teacher@example.edu",
        role: "viewer",
        invitedByUserId: "attacker",
      }),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.inviteId, "a2222222-a222-4222-8222-a22222222222");
  assert.equal(body.data.schoolId, "b1111111-b111-4111-8111-b11111111111");
  assert.equal(body.data.emailNormalized, "teacher@example.edu");
  assert.equal(body.data.role, "viewer");
  assert.equal(body.data.deliveryStatus, "deferred");
  assert.equal(JSON.stringify(body).includes("attacker-token"), false);
  assert.equal(JSON.stringify(body).includes("inviteToken"), false);
  assert.equal(calls[0].method, "findActiveSessionByTokenHash");
  assert.equal(calls[1].method, "findActiveCuacStaffAccessGrantByUserAndRole");
  assert.equal(calls[2].method, "hasLiveCuacStaffAuthority");
  assert.equal(calls[3].method, "findSchoolById");
  assert.equal(calls[4].method, "createInvite");
  assert.equal(calls[4].input.invitedByUserId, "ops-1");
  assert.match(calls[4].input.inviteTokenHash, /^sha256:/);
});

test("school staff invite HTTP create rejects students before invite creation", async () => {
  const { calls, handlers } = createHandlers();
  const response = await handlers.create(
    new Request("https://cuac.test/api/v1/auth/school-invites", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=teacher-session` },
      body: JSON.stringify({ schoolId: "b1111111-b111-4111-8111-b11111111111", email: "teacher@example.edu", role: "viewer" }),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.error.code, "FORBIDDEN");
  assert.equal(calls.some((call) => call.method === "createInvite"), false);
});

test("school staff invite HTTP accept resolves actor from session and ignores privilege fields", async () => {
  const { calls, handlers } = createHandlers();
  const response = await handlers.accept(
    new Request("https://cuac.test/api/v1/auth/school-invites/a2222222-a222-4222-8222-a22222222222/accept", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=teacher-session` },
      body: JSON.stringify({
        inviteToken: "BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ",
        userId: "attacker",
        schoolId: "other-school",
        role: "cuac_admin",
      }),
    }),
    "a2222222-a222-4222-8222-a22222222222",
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.inviteId, "a2222222-a222-4222-8222-a22222222222");
  assert.equal(body.data.schoolId, "b1111111-b111-4111-8111-b11111111111");
  assert.equal(body.data.userId, "teacher-1");
  assert.equal(body.data.role, "school_admin");
  assert.equal(JSON.stringify(body).includes("BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ"), false);
  assert.equal(calls[0].method, "findActiveSessionByTokenHash");
  assert.equal(calls[1].userId, "teacher-1");
  assert.equal(calls[2].input.inviteId, "a2222222-a222-4222-8222-a22222222222");
  assert.match(calls[2].input.inviteTokenHash, /^sha256:/);
  assert.deepEqual(calls[3].input, {
    inviteId: "a2222222-a222-4222-8222-a22222222222",
    userId: "teacher-1",
    schoolId: "b1111111-b111-4111-8111-b11111111111",
    role: "school_admin",
    acceptedAt: now,
    invitedByUserId: "ops-1",
  });
});

test("school staff invite HTTP accept rejects guests before grant creation", async () => {
  const { calls, handlers } = createHandlers();
  const response = await handlers.accept(
    new Request("https://cuac.test/api/v1/auth/school-invites/a2222222-a222-4222-8222-a22222222222/accept", {
      method: "POST",
      body: JSON.stringify({ inviteToken: "BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ" }),
    }),
    "a2222222-a222-4222-8222-a22222222222",
  );
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.error.code, "FORBIDDEN");
  assert.equal(calls.some((call) => call.method === "acceptInvite"), false);
});

test("school staff invite HTTP revoke resolves Ops actor and ignores body authority", async () => {
  const { calls, handlers } = createHandlers({ sessionUserId: "ops-1", sessionRole: "cuac_admin", sessionSurface: "ops" });
  const response = await handlers.revoke(
    new Request("https://cuac.test/api/v1/auth/school-invites/a2222222-a222-4222-8222-a22222222222/revoke", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=teacher-session` },
      body: JSON.stringify({ revokedByUserId: "attacker", schoolId: "other-school" }),
    }),
    "a2222222-a222-4222-8222-a22222222222",
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body.data, { inviteId: "a2222222-a222-4222-8222-a22222222222", revoked: true, revokedAt: now.toISOString() });
  assert.equal(calls[0].method, "findActiveSessionByTokenHash");
  assert.equal(calls[1].method, "findActiveCuacStaffAccessGrantByUserAndRole");
  assert.equal(calls[2].method, "hasLiveCuacStaffAuthority");
  assert.equal(calls[3].method, "revokePendingInvite");
  assert.deepEqual(calls[3].input, { inviteId: "a2222222-a222-4222-8222-a22222222222", revokedByUserId: "ops-1", revokedAt: now });
});

test("school staff invite HTTP accept is rate limited before grant creation", async () => {
  const { calls, handlers } = createHandlers({
    rateLimiter: {
      async assertAllowed(input) {
        calls.push({ method: "assertAllowed", input });
        throw tooManyRequests("Too many invite attempts.");
      },
    },
  });
  const response = await handlers.accept(
    new Request("https://cuac.test/api/v1/auth/school-invites/a2222222-a222-4222-8222-a22222222222/accept", {
      method: "POST",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=teacher-session`,
        "x-forwarded-for": "203.0.113.12",
      },
      body: JSON.stringify({ inviteToken: "BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ" }),
    }),
    "a2222222-a222-4222-8222-a22222222222",
  );
  const body = await response.json();

  assert.equal(response.status, 429);
  assert.equal(body.error.code, "TOO_MANY_REQUESTS");
  assert.equal(calls[1].method, "assertAllowed");
  assert.equal(calls[1].input.action, "auth.school_staff_invite.accept");
  assert.equal(calls.some((call) => call.method === "acceptInvite"), false);
});

test("school staff invite HTTP create is rate limited before invite creation", async () => {
  const { calls, handlers } = createHandlers({
    sessionUserId: "ops-1",
    sessionRole: "cuac_ops",
    sessionSurface: "ops",
    rateLimiter: {
      async assertAllowed(input) {
        calls.push({ method: "assertAllowed", input });
        throw tooManyRequests("Too many invite creation attempts.");
      },
    },
  });
  const response = await handlers.create(
    new Request("https://cuac.test/api/v1/auth/school-invites", {
      method: "POST",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=teacher-session`,
        "x-forwarded-for": "203.0.113.12",
      },
      body: JSON.stringify({ schoolId: "b1111111-b111-4111-8111-b11111111111", email: "teacher@example.edu", role: "viewer" }),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 429);
  assert.equal(body.error.code, "TOO_MANY_REQUESTS");
  assert.equal(calls[2].method, "assertAllowed");
  assert.equal(calls[2].input.action, "auth.school_staff_invite.create");
  assert.equal(calls.some((call) => call.method === "createInvite"), false);
});

test("school staff invite app routes stay thin and contain no token hashing or SQL logic", async () => {
  const routePaths = [
    "../../../app/api/v1/auth/school-invites/route.ts",
    "../../../app/api/v1/auth/school-invites/[inviteId]/accept/route.ts",
    "../../../app/api/v1/auth/school-invites/[inviteId]/revoke/route.ts",
  ];
  const contents = await Promise.all(routePaths.map((routePath) => readFile(new URL(routePath, import.meta.url), "utf8")));

  contents.forEach((source) => {
    assert.match(source, /getSchoolStaffInviteRouteHandlers/);
    assert.doesNotMatch(source, /sha256|token_hash|select\s+|insert\s+|update\s+|public\//i);
  });
});
