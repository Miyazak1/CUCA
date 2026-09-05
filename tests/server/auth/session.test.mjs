import assert from "node:assert/strict";
import test from "node:test";
import { issueGuestSession } from "../../../src/server/auth/guest-session.ts";
import {
  createAuthHttpHandlers,
  hashSessionToken,
  parseCookieHeader,
  resolveRequestContextFromRequest,
  SESSION_COOKIE_NAME,
} from "../../../src/server/index.ts";

const now = new Date("2026-08-28T00:00:00.000Z");

test("cookie parser handles encoded session cookies", () => {
  assert.deepEqual(parseCookieHeader("cuac_session=token%3D1; cuac_guest=guest%201"), {
    cuac_session: "token=1",
    cuac_guest: "guest 1",
  });
});

test("session token hashing never returns the raw browser token", () => {
  const hash = hashSessionToken("raw-token");

  assert.match(hash, /^sha256:[a-f0-9]{64}$/);
  assert.doesNotMatch(hash, /raw-token/);
});

test("request context resolver uses server session repository instead of client authority headers", async () => {
  const seen = [];
  const context = await resolveRequestContextFromRequest(
    new Request("https://cuac.test/api/v1/me?userId=attacker&role=cuac_admin", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=student-token`,
        "x-cuac-role": "cuac_admin",
        "x-cuac-school-id": "school-b",
      },
    }),
    {
      async findActiveSessionByTokenHash(sessionTokenHash, lookupNow) {
        seen.push({ sessionTokenHash, lookupNow });
        return {
          userId: "student-1",
          selectedSurface: "student",
          activeRole: "student",
          tenantSchoolId: null,
          authStrength: "session",
          expiresAt: new Date("2026-08-29T00:00:00.000Z"),
          revokedAt: null,
          accountStatus: "active",
        };
      },
    },
    { now },
  );

  assert.equal(context.actorUserId, "student-1");
  assert.equal(context.activeRole, "student");
  assert.equal(context.tenantSchoolId, null);
  assert.match(seen[0].sessionTokenHash, /^sha256:/);
  assert.notEqual(seen[0].sessionTokenHash, "student-token");
});

test("request context resolver falls back to guest when session is expired", async () => {
  const guest = issueGuestSession(now);
  const context = await resolveRequestContextFromRequest(
    new Request("https://cuac.test/api/v1/me", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=expired-token; cuac_guest=${guest.token}` },
    }),
    {
      async findActiveSessionByTokenHash() {
        return {
          userId: "student-1",
          selectedSurface: "student",
          activeRole: "student",
          tenantSchoolId: null,
          authStrength: "session",
          expiresAt: new Date("2026-08-27T00:00:00.000Z"),
          revokedAt: null,
          accountStatus: "active",
        };
      },
    },
    { now },
  );

  assert.equal(context.actorUserId, null);
  assert.equal(context.guestSessionId, guest.guestSessionId);
  assert.equal(context.activeRole, "guest");
});

test("request context resolver falls back to guest when session is revoked or account inactive", async () => {
  for (const sessionPatch of [
    { revokedAt: new Date("2026-08-27T00:00:00.000Z"), accountStatus: "active" },
    { revokedAt: null, accountStatus: "suspended" },
  ]) {
    const context = await resolveRequestContextFromRequest(
      new Request("https://cuac.test/api/v1/me", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=bad-token` },
      }),
      {
        async findActiveSessionByTokenHash() {
          return {
            userId: "student-1",
            selectedSurface: "student",
            activeRole: "student",
            tenantSchoolId: null,
            authStrength: "session",
            expiresAt: new Date("2026-08-29T00:00:00.000Z"),
            ...sessionPatch,
          };
        },
      },
      { now },
    );

    assert.equal(context.actorUserId, null);
    assert.equal(context.activeRole, "guest");
  }
});

test("request context resolver verifies school tenant membership server-side", async () => {
  const lookups = [];
  const context = await resolveRequestContextFromRequest(
    new Request("https://cuac.test/api/v1/school/applications", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=school-token` },
    }),
    {
      async findActiveSessionByTokenHash() {
        return {
          userId: "staff-1",
          selectedSurface: "school",
          activeRole: "school_staff",
          tenantSchoolId: "school-1",
          authStrength: "session",
          expiresAt: new Date("2026-08-29T00:00:00.000Z"),
          revokedAt: null,
          accountStatus: "active",
        };
      },
    },
    {
      now,
      schoolTenantMembershipRepository: {
        async findActiveSchoolMembershipByUserAndSchoolId(userId, schoolId, lookupNow) {
          lookups.push({ userId, schoolId, lookupNow });
          return { userId, schoolId, role: "admissions", status: "active" };
        },
      },
    },
  );

  assert.equal(context.activeRole, "school_staff");
  assert.equal(context.tenantSchoolId, "school-1");
  assert.deepEqual(lookups, [{ userId: "staff-1", schoolId: "school-1", lookupNow: now }]);
});

test("request context resolver removes school tenant when membership is not active", async () => {
  const context = await resolveRequestContextFromRequest(
    new Request("https://cuac.test/api/v1/school/applications", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=school-token` },
    }),
    {
      async findActiveSessionByTokenHash() {
        return {
          userId: "staff-1",
          selectedSurface: "school",
          activeRole: "school_staff",
          tenantSchoolId: "school-1",
          authStrength: "session",
          expiresAt: new Date("2026-08-29T00:00:00.000Z"),
          revokedAt: null,
          accountStatus: "active",
        };
      },
    },
    {
      now,
      schoolTenantMembershipRepository: {
        async findActiveSchoolMembershipByUserAndSchoolId() {
          return null;
        },
      },
    },
  );

  assert.equal(context.activeRole, "school_staff");
  assert.equal(context.tenantSchoolId, null);
});

test("me HTTP handler hides an unverified school tenant and never returns the session token", async () => {
  const response = await createAuthHttpHandlers({
    async findActiveSessionByTokenHash() {
      return {
        userId: "school-user-1",
        selectedSurface: "school",
        activeRole: "school_staff",
        tenantSchoolId: "school-1",
        authStrength: "session",
        expiresAt: new Date("2026-09-29T00:00:00.000Z"),
        revokedAt: null,
        accountStatus: "active",
      };
    },
  }).getMe(
    new Request("https://cuac.test/api/v1/me", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=school-token` },
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.actorUserId, "school-user-1");
  assert.equal(body.data.activeRole, "school_staff");
  assert.equal(body.data.tenantSchoolId, null);
  assert.doesNotMatch(JSON.stringify(body), /school-token|sha256:/);
});

test("request context resolver requires a live role-matched CUAC staff access grant", async () => {
  const lookups = [];
  const repository = {
    async findActiveSessionByTokenHash() {
      return {
        userId: "ops-1", selectedSurface: "ops", activeRole: "cuac_ops", tenantSchoolId: null,
        authStrength: "session", expiresAt: new Date("2026-08-29T00:00:00.000Z"),
        revokedAt: null, accountStatus: "active",
      };
    },
    async findActiveCuacStaffAccessGrantByUserAndRole(userId, role, lookupNow) {
      lookups.push({ userId, role, lookupNow });
      return { userId, role, status: "approved", expiresAt: new Date("2026-08-29T00:00:00.000Z") };
    },
  };
  const context = await resolveRequestContextFromRequest(new Request("https://cuac.test/api/v1/me", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=ops-token` },
  }), repository, { now });
  assert.equal(context.actorUserId, "ops-1");
  assert.equal(context.activeRole, "cuac_ops");
  assert.equal(context.selectedSurface, "ops");
  assert.deepEqual(lookups, [{ userId: "ops-1", role: "cuac_ops", lookupNow: now }]);
});

test("request context resolver degrades CUAC roles when grant is missing expired or role-mismatched", async () => {
  for (const grant of [
    null,
    { userId: "ops-1", role: "cuac_ops", status: "approved", expiresAt: now },
    { userId: "ops-1", role: "cuac_admin", status: "approved", expiresAt: new Date("2026-08-29T00:00:00.000Z") },
  ]) {
    const context = await resolveRequestContextFromRequest(new Request("https://cuac.test/api/v1/me", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=ops-token` },
    }), {
      async findActiveSessionByTokenHash() {
        return {
          userId: "ops-1", selectedSurface: "ops", activeRole: "cuac_ops", tenantSchoolId: null,
          authStrength: "session", expiresAt: new Date("2026-08-29T00:00:00.000Z"),
          revokedAt: null, accountStatus: "active",
        };
      },
      async findActiveCuacStaffAccessGrantByUserAndRole() { return grant; },
    }, { now });
    assert.equal(context.actorUserId, null);
    assert.equal(context.activeRole, "guest");
  }
});
