import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { SignInContinuationService, createRequestContext } from "../../../src/server/index.ts";

const now = new Date("2026-08-28T00:00:00.000Z");

test("continuations only admit registered navigation, bounded metadata and UUID catalog references", async () => {
  const { calls, repository } = createRepository();
  const service = new SignInContinuationService(repository, { now });
  const guest = createRequestContext({ guestSessionId: "guest-1" });
  const base = { targetRoute: "/application.html#add-choice", actionKey: "application.add_choice" };
  const cyclic = {}; cyclic.self = cyclic;
  for (const input of [null, [], { ...base, private: "secret" }, { ...base, actionKey: "payment.refund" }, { ...base, actionKey: "a".repeat(81) }, { ...base, targetRoute: "/private/path" }, { ...base, requiredRole: "cuac_admin" }, { ...base, deviceFingerprint: {} }, { ...base, deviceFingerprint: "a".repeat(257) }, { ...base, payloadPreview: { programId: "old-slug" } }, { ...base, payloadPreview: cyclic }]) {
    await assert.rejects(service.createGuestContinuation(guest, input), (error) => error.status === 400);
  }
  assert.equal(calls.length, 0);
});

function createRepository(seed = null) {
  const calls = [];
  return {
    calls,
    repository: {
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
    },
  };
}

test("sign-in continuation creates short-lived guest continuation with hashed token storage", async () => {
  const { calls, repository } = createRepository();
  const auditEvents = [];
  const service = new SignInContinuationService(repository, {
    now,
    continuationTtlMs: 1000,
    auditSink: {
      async record(event) {
        auditEvents.push(event);
      },
    },
  });
  const context = createRequestContext({ guestSessionId: "guest-session-1" });
  const result = await service.createGuestContinuation(context, {
    targetRoute: "/application.html#add-choice",
    actionKey: "application.add_choice",
    payloadPreview: { programId: "c1111111-c111-4111-8111-c11111111111", schoolId: "b1111111-b111-4111-8111-b11111111111" },
    deviceFingerprint: "browser-fingerprint",
  });

  assert.equal(result.continuationId, "a1111111-a111-4111-8111-a11111111111");
  assert.match(result.continuationToken, /^[A-Za-z0-9_-]+$/);
  assert.equal(result.requiredRole, "student");
  assert.equal(result.expiresAt.toISOString(), "2026-08-28T00:00:01.000Z");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input.guestSessionId, "guest-session-1");
  assert.equal(calls[0].input.targetRoute, "/application.html#add-choice");
  assert.equal(calls[0].input.actionKey, "application.add_choice");
  assert.match(calls[0].input.continuationTokenHash, /^sha256:/);
  assert.notEqual(calls[0].input.continuationTokenHash, result.continuationToken);
  assert.equal(calls[0].input.deviceFingerprintHash, `sha256:${createHash("sha256").update("browser-fingerprint").digest("hex")}`);
  assert.equal(auditEvents[0].metadata.payloadPreviewKeys.includes("programId"), true);
  assert.equal(JSON.stringify(auditEvents[0].metadata).includes("c1111111-c111-4111-8111-c11111111111"), false);
});

test("sign-in continuation admits only role-bound protected workspace routes", async () => {
  const guest = createRequestContext({ guestSessionId: "guest-session-1" });
  const allowed = [
    ["/hub.html", "navigation.open_student_workspace", "student"],
    ["/school-portal.html", "navigation.open_school_workspace", "school_staff"],
    ["/ops-admin.html", "navigation.open_ops_workspace", "cuac_ops"],
  ];

  for (const [targetRoute, actionKey, requiredRole] of allowed) {
    const { calls, repository } = createRepository();
    await new SignInContinuationService(repository, { now }).createGuestContinuation(guest, { targetRoute, actionKey, requiredRole });
    assert.equal(calls[0].input.targetRoute, targetRoute);
    assert.equal(calls[0].input.requiredRole, requiredRole);
  }

  for (const input of [
    { targetRoute: "/ops-admin.html", actionKey: "navigation.open_student_workspace", requiredRole: "student" },
    { targetRoute: "/school-portal.html", actionKey: "navigation.open_school_workspace", requiredRole: "student" },
    { targetRoute: "/hub.html", actionKey: "navigation.open_ops_workspace", requiredRole: "cuac_ops" },
  ]) {
    await assert.rejects(new SignInContinuationService(createRepository().repository, { now }).createGuestContinuation(guest, input), /not registered/);
  }
});

test("CUAC administrators may consume an Ops continuation without weakening its stored role", async () => {
  const { calls, repository } = createRepository({
    id: "a1111111-a111-4111-8111-a11111111111",
    guestSessionId: "guest-session-1",
    targetRoute: "/ops-admin.html",
    actionKey: "navigation.open_ops_workspace",
    requiredRole: "cuac_ops",
    tenantSchoolId: null,
    payloadPreview: {},
    expiresAt: new Date("2026-08-28T00:15:00.000Z"),
    consumedAt: null,
  });
  const context = createRequestContext({ actorUserId: "admin-1", guestSessionId: "guest-session-1", activeRole: "cuac_admin", selectedSurface: "ops" });

  const result = await new SignInContinuationService(repository, { now }).consumeContinuation(
    context,
    "a1111111-a111-4111-8111-a11111111111",
    "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE",
  );

  assert.equal(result.targetRoute, "/ops-admin.html");
  assert.equal(calls[1].input.requiredRole, "cuac_ops");
  assert.equal(calls[1].input.activeRole, "cuac_admin");
});

test("sign-in continuation rejects external routes and sensitive payload previews", async () => {
  const { repository } = createRepository();
  const service = new SignInContinuationService(repository, { now });
  const context = createRequestContext({ guestSessionId: "guest-session-1" });

  await assert.rejects(
    () =>
      service.createGuestContinuation(context, {
        targetRoute: "https://evil.test/application",
        actionKey: "application.add_choice",
      }),
    /internal path/,
  );

  await assert.rejects(
    () =>
      service.createGuestContinuation(context, {
        targetRoute: "/application.html#add-choice",
        actionKey: "application.add_choice",
        payloadPreview: { nested: { paymentToken: "tok_secret" } },
      }),
    /sensitive fields/,
  );
});

test("sign-in continuation consume requires matching authenticated role and browser session", async () => {
  const { calls, repository } = createRepository({
    id: "a1111111-a111-4111-8111-a11111111111",
    guestSessionId: "guest-session-1",
    targetRoute: "/application.html#add-choice",
    actionKey: "application.add_choice",
    requiredRole: "student",
    tenantSchoolId: null,
    payloadPreview: { programId: "c1111111-c111-4111-8111-c11111111111" },
    expiresAt: new Date("2026-08-28T00:15:00.000Z"),
    consumedAt: null,
  });
  const service = new SignInContinuationService(repository, { now });
  const context = createRequestContext({
    actorUserId: "student-1",
    guestSessionId: "guest-session-1",
    activeRole: "student",
    selectedSurface: "student",
    purpose: "student_action",
  });

  const result = await service.consumeContinuation(context, "a1111111-a111-4111-8111-a11111111111", "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE");

  assert.equal(result.targetRoute, "/application.html#add-choice");
  assert.equal(result.actionKey, "application.add_choice");
  assert.deepEqual(result.payloadPreview, { programId: "c1111111-c111-4111-8111-c11111111111" });
  assert.equal(calls[0].method, "findActiveContinuation");
  assert.equal(calls[0].input.continuationId, "a1111111-a111-4111-8111-a11111111111");
  assert.equal(calls[0].input.continuationTokenHash, `sha256:${createHash("sha256").update("AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE").digest("hex")}`);
  assert.equal(calls[1].method, "markContinuationConsumed");
  assert.equal(calls[1].input.consumedByUserId, "student-1");
});

test("sign-in continuation consume denies guest users, browser mismatch, and role mismatch", async () => {
  const record = {
    id: "a1111111-a111-4111-8111-a11111111111",
    guestSessionId: "guest-session-1",
    targetRoute: "/application.html#add-choice",
    actionKey: "application.add_choice",
    requiredRole: "student",
    tenantSchoolId: null,
    payloadPreview: {},
    expiresAt: new Date("2026-08-28T00:15:00.000Z"),
    consumedAt: null,
  };

  await assert.rejects(
    () => new SignInContinuationService(createRepository(record).repository, { now }).consumeContinuation(createRequestContext(), "a1111111-a111-4111-8111-a11111111111", "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE"),
    /authenticated session/,
  );

  await assert.rejects(
    () =>
      new SignInContinuationService(createRepository(record).repository, { now }).consumeContinuation(
        createRequestContext({ actorUserId: "student-1", guestSessionId: "other", activeRole: "student" }),
        "a1111111-a111-4111-8111-a11111111111",
        "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE",
      ),
    /current browser session/,
  );

  await assert.rejects(
    () =>
      new SignInContinuationService(createRepository(record).repository, { now }).consumeContinuation(
        createRequestContext({ actorUserId: "staff-1", guestSessionId: "guest-session-1", activeRole: "school_staff" }),
        "a1111111-a111-4111-8111-a11111111111",
        "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE",
      ),
    /role does not match/,
  );
});

test("sign-in continuation rejects unbound guests and restricts preview data to catalog references", async () => {
  const { calls, repository } = createRepository();
  const service = new SignInContinuationService(repository, { now });
  const input = { targetRoute: "/application.html#add-choice", actionKey: "application.add_choice" };
  await assert.rejects(service.createGuestContinuation(createRequestContext(), input), /guest browser session/);
  const guest = createRequestContext({ guestSessionId: "guest-1" });
  for (const payloadPreview of [{ notes: "private text" }, { userId: "someone" }, { programId: { notes: "private" } }, { programId: "private text" }]) {
    await assert.rejects(service.createGuestContinuation(guest, { ...input, payloadPreview }), /catalog object references/);
  }
  assert.equal(calls.length, 0);
  await service.createGuestContinuation(guest, { ...input, payloadPreview: { schoolId: "b1111111-b111-4111-8111-b11111111111", programId: "c1111111-c111-4111-8111-c11111111111", scholarshipId: "d1111111-d111-4111-8111-d11111111111", cityId: "e1111111-e111-4111-8111-e11111111111" } });
  assert.equal(calls.length, 1);
});

test("sign-in continuation rejects redirect normalization tricks and data-bearing URLs", async () => {
  const { calls, repository } = createRepository();
  const service = new SignInContinuationService(repository, { now });
  const guest = createRequestContext({ guestSessionId: "guest-1" });
  for (const targetRoute of ["//evil.test", "/\\evil.test", "/%5cevil.test", "/%255cevil.test", "/%2f/evil.test", "/\n/evil.test", "/a/..//evil.test", "/application.html?email=private@example.invalid", "/application.html#token=secret"]) {
    await assert.rejects(service.createGuestContinuation(guest, { targetRoute, actionKey: "application.add_choice" }), (error) => error.status === 400, targetRoute);
  }
  for (const key of ["password_hash", "PASSWORD-HASH", "payment_token", "PassportNumber"]) {
    await assert.rejects(service.createGuestContinuation(guest, { targetRoute: "/application.html", actionKey: "application.add_choice", payloadPreview: { [key]: "secret" } }), (error) => error.status === 403);
  }
  assert.equal(calls.length, 0);
});

test("sign-in continuation revalidates stored navigation and rejects legacy unbound or tenant records", async () => {
  const record = { id: "a1111111-a111-4111-8111-a11111111111", guestSessionId: "guest-1", targetRoute: "/application.html#add-choice", actionKey: "application.add_choice", requiredRole: "student", tenantSchoolId: null, payloadPreview: {}, expiresAt: new Date(now.getTime() + 60_000), consumedAt: null };
  const context = createRequestContext({ actorUserId: "student-1", activeRole: "student", guestSessionId: "guest-1" });
  for (const change of [{ guestSessionId: null }, { tenantSchoolId: "b1111111-b111-4111-8111-b11111111111" }, { targetRoute: "/\\evil.test" }, { targetRoute: "/private/path" }, { actionKey: "payment.refund" }, { payloadPreview: { notes: "private" } }, { requiredRole: null }]) {
    const { calls, repository } = createRepository({ ...record, ...change });
    await assert.rejects(new SignInContinuationService(repository, { now }).consumeContinuation(context, "a1111111-a111-4111-8111-a11111111111", "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE"));
    assert.equal(calls.some((call) => call.method === "markContinuationConsumed"), false);
  }
});
