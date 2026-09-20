import assert from "node:assert/strict";
import test from "node:test";
import { createRequestContext, SchoolStaffInviteService } from "../../../src/server/index.ts";

const now = new Date("2026-08-28T00:00:00.000Z");

function createRepository(account, invite) {
  const calls = [];

  return {
    calls,
    repository: {
      async hasLiveCuacStaffAuthority(input) {
        calls.push({ method: "hasLiveCuacStaffAuthority", input });
        return true;
      },
      async findAccountByUserId(userId) {
        calls.push({ method: "findAccountByUserId", userId });
        return account;
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
        return invite;
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
      async activateInviteForNewAccount(input) {
        calls.push({ method: "activateInviteForNewAccount", input });
        return {
          inviteId: input.inviteId,
          schoolId: input.schoolId,
          userId: "school-user-1",
          role: input.role,
          membershipId: "membership-1",
          acceptedAt: input.activatedAt,
          schoolStaffRoleGranted: true,
          emailNormalized: invite?.emailNormalized ?? "teacher@example.edu",
          accountCreated: true,
          emailVerified: true,
        };
      },
      async revokePendingInvite(input) {
        calls.push({ method: "revokePendingInvite", input });
        return { revoked: true };
      },
    },
  };
}

test("school staff invite creation is limited to CUAC internal roles and returns no token", async () => {
  const { calls, repository } = createRepository(null, null);
  const deliveries = [];
  const auditEvents = [];
  const service = new SchoolStaffInviteService(repository, {
    now,
    inviteTtlMs: 1000,
    deliverySink: {
      async send(input) {
        deliveries.push(input);
      },
    },
    auditSink: {
      async record(event) {
        auditEvents.push(event);
      },
    },
  });

  const result = await service.createInvite(
    createRequestContext({ actorUserId: "ops-1", activeRole: "cuac_ops", selectedSurface: "ops" }),
    { schoolId: "b1111111-b111-4111-8111-b11111111111", email: "Teacher@Example.edu ", role: "viewer" },
  );

  assert.equal(result.inviteId, "a2222222-a222-4222-8222-a22222222222");
  assert.equal(result.emailNormalized, "teacher@example.edu");
  assert.equal(result.deliveryStatus, "queued");
  assert.equal(result.expiresAt.toISOString(), "2026-08-28T00:00:01.000Z");
  assert.equal("inviteToken" in result, false);
  assert.equal(calls[0].method, "hasLiveCuacStaffAuthority");
  assert.deepEqual(calls[0].input, { actorUserId: "ops-1", activeRole: "cuac_ops" });
  assert.equal(calls[1].method, "findSchoolById");
  assert.equal(calls[2].method, "createInvite");
  assert.match(calls[2].input.inviteTokenHash, /^sha256:/);
  assert.equal(calls[2].input.emailNormalized, "teacher@example.edu");
  assert.notEqual(calls[2].input.inviteTokenHash, deliveries[0].inviteToken);
  assert.equal(deliveries[0].emailNormalized, "teacher@example.edu");
  assert.equal(auditEvents[0].metadata.emailDomain, "example.edu");
  assert.equal(JSON.stringify(auditEvents[0]).includes(deliveries[0].inviteToken), false);
});

test("school staff invite creation rejects non-CUAC roles and invalid school or role", async () => {
  await assert.rejects(
    () =>
      new SchoolStaffInviteService(createRepository(null, null).repository, { now }).createInvite(
        createRequestContext({ actorUserId: "student-1", activeRole: "student" }),
        { schoolId: "b1111111-b111-4111-8111-b11111111111", email: "teacher@example.edu", role: "viewer" },
      ),
    /CUAC internal role/,
  );

  await assert.rejects(
    () =>
      new SchoolStaffInviteService(createRepository(null, null).repository, { now }).createInvite(
        createRequestContext({ actorUserId: "ops-1", activeRole: "cuac_ops" }),
        { schoolId: "b1111111-b111-4111-8111-b11111111111", email: "teacher@example.edu", role: "cuac_admin" },
      ),
    /role is not allowed/,
  );

  const { repository } = createRepository(null, null);
  repository.findSchoolById = async () => ({ id: "b1111111-b111-4111-8111-b11111111111", status: "draft" });
  await assert.rejects(
    () =>
      new SchoolStaffInviteService(repository, { now }).createInvite(
        createRequestContext({ actorUserId: "ops-1", activeRole: "cuac_ops" }),
        { schoolId: "b1111111-b111-4111-8111-b11111111111", email: "teacher@example.edu", role: "viewer" },
      ),
    /School is not available/,
  );

  const denied = createRepository(null, null);
  denied.repository.hasLiveCuacStaffAuthority = async (input) => {
    denied.calls.push({ method: "hasLiveCuacStaffAuthority", input });
    return false;
  };
  await assert.rejects(
    () => new SchoolStaffInviteService(denied.repository, { now }).createInvite(
      createRequestContext({ actorUserId: "ops-1", activeRole: "cuac_ops", selectedSurface: "ops" }),
      { schoolId: "b1111111-b111-4111-8111-b11111111111", email: "teacher@example.edu", role: "viewer" },
    ),
    /Active CUAC staff access grant/,
  );
  assert.deepEqual(denied.calls.map(call => call.method), ["hasLiveCuacStaffAuthority"]);
});

test("school staff invite acceptance matches authenticated account and hashes token", async () => {
  const { calls, repository } = createRepository(
    {
      userId: "user-1",
      emailNormalized: "teacher@example.edu",
      accountStatus: "active",
    },
    {
      id: "a2222222-a222-4222-8222-a22222222222",
      schoolId: "b1111111-b111-4111-8111-b11111111111",
      emailNormalized: "teacher@example.edu",
      role: "admissions",
      invitedByUserId: "ops-1",
      expiresAt: new Date("2026-08-29T00:00:00.000Z"),
    },
  );
  const auditEvents = [];
  const service = new SchoolStaffInviteService(repository, {
    now,
    auditSink: {
      async record(event) {
        auditEvents.push(event);
      },
    },
  });
  const result = await service.acceptInvite(
    createRequestContext({ actorUserId: "user-1", activeRole: "student", selectedSurface: "student" }),
    "a2222222-a222-4222-8222-a22222222222",
    "BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ",
  );

  assert.deepEqual(result, {
    inviteId: "a2222222-a222-4222-8222-a22222222222",
    schoolId: "b1111111-b111-4111-8111-b11111111111",
    userId: "user-1",
    role: "admissions",
    membershipId: "membership-1",
    acceptedAt: now,
    schoolStaffRoleGranted: true,
  });
  assert.equal(calls[0].method, "findAccountByUserId");
  assert.equal(calls[1].method, "findActiveInviteByIdAndTokenHash");
  assert.match(calls[1].input.inviteTokenHash, /^sha256:/);
  assert.notEqual(calls[1].input.inviteTokenHash, "BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ");
  assert.deepEqual(calls[2].input, {
    inviteId: "a2222222-a222-4222-8222-a22222222222",
    userId: "user-1",
    schoolId: "b1111111-b111-4111-8111-b11111111111",
    role: "admissions",
    acceptedAt: now,
    invitedByUserId: "ops-1",
  });
  assert.equal(auditEvents[0].action, "auth.school_staff_invite.accept");
  assert.equal(auditEvents[0].metadata.emailDomain, "example.edu");
  assert.equal(JSON.stringify(auditEvents[0]).includes("BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ"), false);
});

test("school staff invite acceptance rejects guests, wrong accounts, and disallowed roles", async () => {
  await assert.rejects(
    () => new SchoolStaffInviteService(createRepository(null, null).repository, { now }).acceptInvite(createRequestContext(), "a2222222-a222-4222-8222-a22222222222", "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE"),
    /authenticated session/,
  );

  await assert.rejects(
    () =>
      new SchoolStaffInviteService(
        createRepository(
          { userId: "user-1", emailNormalized: "other@example.edu", accountStatus: "active" },
          {
            id: "a2222222-a222-4222-8222-a22222222222",
            schoolId: "b1111111-b111-4111-8111-b11111111111",
            emailNormalized: "teacher@example.edu",
            role: "viewer",
            invitedByUserId: "ops-1",
            expiresAt: new Date("2026-08-29T00:00:00.000Z"),
          },
        ).repository,
        { now },
      ).acceptInvite(createRequestContext({ actorUserId: "user-1", activeRole: "student" }), "a2222222-a222-4222-8222-a22222222222", "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE"),
    /invited account/,
  );

  await assert.rejects(
    () =>
      new SchoolStaffInviteService(
        createRepository(
          { userId: "user-1", emailNormalized: "teacher@example.edu", accountStatus: "active" },
          {
            id: "a2222222-a222-4222-8222-a22222222222",
            schoolId: "b1111111-b111-4111-8111-b11111111111",
            emailNormalized: "teacher@example.edu",
            role: "cuac_admin",
            invitedByUserId: "ops-1",
            expiresAt: new Date("2026-08-29T00:00:00.000Z"),
          },
        ).repository,
        { now },
      ).acceptInvite(createRequestContext({ actorUserId: "user-1", activeRole: "student" }), "a2222222-a222-4222-8222-a22222222222", "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE"),
    /role is not allowed/,
  );
});

test("school staff invite activation creates only the invited school account authority", async () => {
  const { calls, repository } = createRepository(null, {
    id: "a2222222-a222-4222-8222-a22222222222",
    schoolId: "b1111111-b111-4111-8111-b11111111111",
    emailNormalized: "teacher@example.edu",
    role: "school_admin",
    invitedByUserId: "ops-1",
    expiresAt: new Date("2026-08-29T00:00:00.000Z"),
  });
  const auditEvents = [];
  const service = new SchoolStaffInviteService(repository, {
    now,
    passwordHasher: {
      async hash(value) { assert.equal(value, "correct horse battery staple"); return "scrypt:test"; },
      async verify() { return false; },
      async verifyForLogin() { return { valid: false, upgradedHash: null }; },
    },
    auditSink: { async record(event) { auditEvents.push(event); } },
  });

  const result = await service.activateInvite(
    createRequestContext(),
    "a2222222-a222-4222-8222-a22222222222",
    {
      inviteToken: "BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ",
      password: "correct horse battery staple",
      displayName: "Dr Teacher",
    },
  );

  assert.equal(result.userId, "school-user-1");
  assert.equal(result.role, "school_admin");
  assert.equal(result.accountCreated, true);
  assert.deepEqual(calls.map(call => call.method), ["findActiveInviteByIdAndTokenHash", "activateInviteForNewAccount"]);
  assert.equal(calls[1].input.passwordHash, "scrypt:test");
  assert.equal(calls[1].input.displayName, "Dr Teacher");
  assert.equal("student" in calls[1].input, false);
  assert.equal(auditEvents[0].action, "auth.school_staff_invite.activate");
  assert.equal(auditEvents[0].metadata.studentRoleGranted, false);
  assert.equal(JSON.stringify(auditEvents[0]).includes("correct horse battery staple"), false);
});

test("school staff invite activation rejects signed-in actors and existing-account races", async () => {
  const invite = {
    id: "a2222222-a222-4222-8222-a22222222222",
    schoolId: "b1111111-b111-4111-8111-b11111111111",
    emailNormalized: "teacher@example.edu",
    role: "viewer",
    invitedByUserId: "ops-1",
    expiresAt: new Date("2026-08-29T00:00:00.000Z"),
  };
  const signedIn = createRepository(null, invite);
  await assert.rejects(
    () => new SchoolStaffInviteService(signedIn.repository, { now }).activateInvite(
      createRequestContext({ actorUserId: "student-1", activeRole: "student" }),
      invite.id,
      { inviteToken: "BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ", password: "correct horse battery staple" },
    ),
    /Sign out before activating/,
  );
  assert.equal(signedIn.calls.length, 0);

  const raced = createRepository(null, invite);
  raced.repository.activateInviteForNewAccount = async (input) => {
    raced.calls.push({ method: "activateInviteForNewAccount", input });
    return null;
  };
  await assert.rejects(
    () => new SchoolStaffInviteService(raced.repository, {
      now,
      passwordHasher: { async hash() { return "scrypt:test"; }, async verify() { return false; }, async verifyForLogin() { return { valid: false, upgradedHash: null }; } },
    }).activateInvite(createRequestContext(), invite.id, {
      inviteToken: "BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ",
      password: "correct horse battery staple",
    }),
    /already has a CUAC account/,
  );
});

test("school staff invite revocation is limited to CUAC internal roles", async () => {
  const { calls, repository } = createRepository(null, null);
  const auditEvents = [];
  const service = new SchoolStaffInviteService(repository, {
    now,
    auditSink: {
      async record(event) {
        auditEvents.push(event);
      },
    },
  });

  const result = await service.revokeInvite(
    createRequestContext({ actorUserId: "ops-1", activeRole: "cuac_admin", selectedSurface: "ops" }),
    "a2222222-a222-4222-8222-a22222222222",
  );

  assert.deepEqual(result, { inviteId: "a2222222-a222-4222-8222-a22222222222", revoked: true, revokedAt: now });
  assert.equal(calls[0].method, "hasLiveCuacStaffAuthority");
  assert.equal(calls[1].method, "revokePendingInvite");
  assert.deepEqual(calls[1].input, { inviteId: "a2222222-a222-4222-8222-a22222222222", revokedByUserId: "ops-1", revokedAt: now });
  assert.equal(auditEvents[0].action, "auth.school_staff_invite.revoke");

  await assert.rejects(
    () =>
      service.revokeInvite(
        createRequestContext({ actorUserId: "teacher-1", activeRole: "school_staff", selectedSurface: "school" }),
        "a2222222-a222-4222-8222-a22222222222",
      ),
    /CUAC internal role/,
  );
});
