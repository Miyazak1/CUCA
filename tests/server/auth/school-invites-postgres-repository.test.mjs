import assert from "node:assert/strict";
import test from "node:test";
import { PostgresSchoolStaffInviteRepository } from "../../../src/server/index.ts";

test("Postgres school staff invite repository locks current CUAC authority", async () => {
  const calls = [];
  const repository = new PostgresSchoolStaffInviteRepository({
    async query(statement, params) {
      calls.push({ statement, params });
      return [{ grantId: "grant-1", actorUserId: "ops-1", activeRole: "cuac_ops", expiresAt: new Date() }];
    },
  });
  assert.equal(await repository.hasLiveCuacStaffAuthority({ actorUserId: "ops-1", activeRole: "cuac_ops" }), true);
  assert.match(calls[0].statement, /join user_roles/);
  assert.match(calls[0].statement, /join cuac_staff_access_grants/);
  assert.match(calls[0].statement, /expires_at > clock_timestamp\(\)/);
  assert.match(calls[0].statement, /for share of u, r, g/);
  assert.deepEqual(calls[0].params, ["ops-1", "cuac_ops"]);
});

test("Postgres school staff invite repository reads account without secrets", async () => {
  const calls = [];
  const repository = new PostgresSchoolStaffInviteRepository({
    async query(statement, params) {
      calls.push({ statement, params });
      return [
        {
          userId: "teacher-1",
          emailNormalized: "teacher@example.edu",
          accountStatus: "active",
        },
      ];
    },
  });

  const account = await repository.findAccountByUserId("teacher-1");

  assert.equal(account.userId, "teacher-1");
  assert.match(calls[0].statement, /from users/);
  assert.match(calls[0].statement, /where id = \$1/);
  assert.doesNotMatch(calls[0].statement, /select \*|password|session_token|token_hash/i);
  assert.deepEqual(calls[0].params, ["teacher-1"]);
});

test("Postgres school staff invite repository reads active school before invitation", async () => {
  const calls = [];
  const repository = new PostgresSchoolStaffInviteRepository({
    async query(statement, params) {
      calls.push({ statement, params });
      return [{ id: "school-1", status: "active" }];
    },
  });

  const school = await repository.findSchoolById("school-1");

  assert.deepEqual(school, { id: "school-1", status: "active" });
  assert.match(calls[0].statement, /from schools/);
  assert.match(calls[0].statement, /where id = \$1/);
  assert.doesNotMatch(calls[0].statement, /select \*|staff|password|token/i);
  assert.deepEqual(calls[0].params, ["school-1"]);
});

test("Postgres school staff invite repository locks the school before replacing pending invites in one transaction", async () => {
  const calls = [];
  const now = new Date("2026-08-28T00:00:00.000Z");
  const expiresAt = new Date("2026-09-04T00:00:00.000Z");
  const repository = new PostgresSchoolStaffInviteRepository({
    async transaction(work) {
      return work(this);
    },
    async query(statement, params) {
      calls.push({ statement, params });
      return [{ inviteId: "invite-1" }];
    },
  });

  const result = await repository.createInvite({
    schoolId: "school-1",
    email: "teacher@example.edu",
    emailNormalized: "teacher@example.edu",
    role: "viewer",
    inviteTokenHash: "sha256:abc",
    invitedByUserId: "ops-1",
    now,
    expiresAt,
  });

  assert.deepEqual(result, { inviteId: "invite-1" });
  assert.equal(calls.length, 3);
  assert.match(calls[0].statement, /from schools.*status = 'active' for no key update/);
  assert.deepEqual(calls[0].params, ["school-1"]);
  assert.match(calls[1].statement, /update school_staff_invites/);
  assert.match(calls[1].statement, /status = 'revoked'/);
  assert.deepEqual(calls[1].params, ["school-1", "teacher@example.edu", now]);
  assert.match(calls[2].statement, /insert into school_staff_invites/);
  assert.match(calls[2].statement, /token_hash/);
  assert.doesNotMatch(calls.map((call) => call.statement).join("\n"), /raw_token|invite_token[^_]|password|session_token|cuac_admin|cuac_ops/i);
  assert.deepEqual(calls[2].params, [
    "school-1",
    "teacher@example.edu",
    "teacher@example.edu",
    "viewer",
    "sha256:abc",
    "ops-1",
    now,
    expiresAt,
  ]);
});

test("Postgres school staff invite repository finds active invite by id and token hash", async () => {
  const calls = [];
  const now = new Date("2026-08-28T00:00:00.000Z");
  const repository = new PostgresSchoolStaffInviteRepository({
    async query(statement, params) {
      calls.push({ statement, params });
      return [
        {
          id: "invite-1",
          schoolId: "school-1",
          emailNormalized: "teacher@example.edu",
          role: "viewer",
          invitedByUserId: "ops-1",
          expiresAt: new Date("2026-08-29T00:00:00.000Z"),
        },
      ];
    },
  });

  const invite = await repository.findActiveInviteByIdAndTokenHash({
    inviteId: "invite-1",
    inviteTokenHash: "sha256:abc",
    now,
  });

  assert.equal(invite.id, "invite-1");
  assert.match(calls[0].statement, /from school_staff_invites/);
  assert.match(calls[0].statement, /id = \$1/);
  assert.match(calls[0].statement, /token_hash = \$2/);
  assert.match(calls[0].statement, /status = 'pending'/);
  assert.match(calls[0].statement, /expires_at > \$3/);
  assert.doesNotMatch(calls[0].statement, /select \*|raw_token|password|session_token/i);
  assert.deepEqual(calls[0].params, ["invite-1", "sha256:abc", now]);
});

test("Postgres school staff invite repository accepts invite, creates membership, and grants only school_staff role", async () => {
  const calls = [];
  const acceptedAt = new Date("2026-08-28T00:00:00.000Z");
  const repository = new PostgresSchoolStaffInviteRepository({
    async query(statement, params) {
      calls.push({ statement, params });
      return [{ membershipId: "membership-1", schoolStaffRoleGranted: true }];
    },
  });

  const result = await repository.acceptInvite({
    inviteId: "invite-1",
    userId: "teacher-1",
    schoolId: "school-1",
    role: "admissions",
    acceptedAt,
    invitedByUserId: "ops-1",
  });

  assert.deepEqual(result, {
    inviteId: "invite-1",
    schoolId: "school-1",
    userId: "teacher-1",
    role: "admissions",
    membershipId: "membership-1",
    acceptedAt,
    schoolStaffRoleGranted: true,
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0].statement, /with accepted_invite as/);
  assert.match(calls[0].statement, /update school_staff_invites/);
  assert.match(calls[0].statement, /status = 'accepted'/);
  assert.match(calls[0].statement, /and school_id = \$3/);
  assert.match(calls[0].statement, /and role = \$4/);
  assert.match(calls[0].statement, /insert into school_staff_memberships/);
  assert.match(calls[0].statement, /on conflict \(school_id, user_id\) where removed_at is null/);
  assert.match(calls[0].statement, /insert into user_roles/);
  assert.match(calls[0].statement, /'school_staff'/);
  assert.doesNotMatch(calls[0].statement, /cuac_admin|cuac_ops/);
  assert.doesNotMatch(calls.map((call) => call.statement).join("\n"), /select \*|raw_token|password|session_token/i);
  assert.deepEqual(calls[0].params, ["invite-1", "teacher-1", "school-1", "admissions", "ops-1", acceptedAt]);
});

test("Postgres school staff invite repository revokes pending invite only", async () => {
  const calls = [];
  const revokedAt = new Date("2026-08-28T00:00:00.000Z");
  const repository = new PostgresSchoolStaffInviteRepository({
    async query(statement, params) {
      calls.push({ statement, params });
      return [{ inviteId: "invite-1" }];
    },
  });

  const result = await repository.revokePendingInvite({
    inviteId: "invite-1",
    revokedByUserId: "ops-1",
    revokedAt,
  });

  assert.deepEqual(result, { revoked: true });
  assert.match(calls[0].statement, /update school_staff_invites/);
  assert.match(calls[0].statement, /status = 'revoked'/);
  assert.match(calls[0].statement, /status = 'pending'/);
  assert.match(calls[0].statement, /accepted_at is null/);
  assert.match(calls[0].statement, /revoked_at is null/);
  assert.doesNotMatch(calls[0].statement, /select \*|raw_token|password|session_token/i);
  assert.deepEqual(calls[0].params, ["invite-1", revokedAt]);
});
