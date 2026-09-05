import assert from "node:assert/strict";
import test from "node:test";
import { AgentContextService, CuacError, createRequestContext, deriveMemoryNamespace } from "../../../src/server/index.ts";

const now = new Date("2026-08-28T00:00:00.000Z");

test("Agent confirmation validates student persona and UUID before candidate access", async () => {
  const { repository, calls } = createRepository();
  const service = new AgentContextService(repository);
  const candidateId = "a1111111-a111-4111-8111-a11111111111";
  for (const method of ["acceptCandidateAsMemory", "carryForwardGuestCandidateToStudentMemory"]) {
    for (const changes of [{ activeRole: "guest" }, { activeRole: "school_staff" }, { activeRole: "cuac_ops" }, { tenantSchoolId: "school-1" }, { dataClassAllowlist: [] }]) {
      const context = createRequestContext({ actorUserId: "student-1", activeRole: "student", guestSessionId: "guest-1", ...changes });
      await assert.rejects(service[method](context, candidateId, now), (error) => error.status === 403);
    }
    const context = createRequestContext({ actorUserId: "student-1", activeRole: "student", guestSessionId: "guest-1" });
    await assert.rejects(service[method](context, "malformed", now), (error) => error.status === 400);
  }
  assert.deepEqual(calls, []);
});

test("Agent confirmation must consume an eligible candidate before inserting memory", async () => {
  const candidate = { id: "a1111111-a111-4111-8111-a11111111111", anonymousSessionHash: "guest-1", userId: null, memoryNamespace: null,
    candidateType: "study_goal", contextScope: "guest_page", activeRole: "guest", tenantSchoolId: null, dataClass: "low_sensitive_preference",
    structured: { degreeLevel: "master" }, status: "proposed", expiresAt: new Date("2026-08-29T00:00:00Z") };
  const { repository, calls } = createRepository([candidate]);
  repository.markCandidateAccepted = async () => false;
  const service = new AgentContextService(repository);
  const context = createRequestContext({ actorUserId: "student-1", activeRole: "student", guestSessionId: "guest-1" });
  await assert.rejects(service.carryForwardGuestCandidateToStudentMemory(context, candidate.id, now), (error) => error.status === 400);
  assert.deepEqual(calls.map((call) => call.method), ["findCandidateForConfirmation"]);
  assert.deepEqual(calls[0].owner, { destinationUserId: "student-1", contextScope: "guest_page", anonymousSessionHash: "guest-1" });
});

test("Agent candidates reject disguised private data and caller-controlled content metadata before storage", async () => {
  const { repository, calls } = createRepository();
  const audits = [];
  const service = new AgentContextService(repository, { async record(event) { audits.push(event); } });
  const context = createRequestContext({ guestSessionId: "guest-session-1", purpose: "agent_tool" });
  const valid = { candidateType: "study_goal", structured: { fundingIntent: "scholarship_possible" } };
  const marker = "PRIVATE_MARKER_NEVER_PERSIST";
  const invalid = [null, [], { ...valid, summary: marker }, { ...valid, dataClass: "low_sensitive_preference" },
    { ...valid, contextScope: "student_account" }, { ...valid, confidence: "user_confirmed" }, { ...valid, expiresAt: new Date("2099-01-01") },
    { ...valid, sourceEntityIds: [marker] }, { ...valid, candidateType: marker }, { ...valid, structured: { passport: marker } },
    { ...valid, structured: { subjectAreas: [marker] } }, { ...valid, structured: { preferredCityIds: [marker] } },
    { ...valid, structured: { intakeYear: 2027.5 } }, { ...valid, structured: { preferredCityIds: Array(11).fill("a1111111-a111-4111-8111-a11111111111") } },
    { ...valid, structured: {} }, { ...valid, structured: { subjectAreas: [] } }];
  for (const input of invalid) await assert.rejects(service.proposeCandidate(context, input, now), (e) => e.status === 400);
  assert.deepEqual(calls, []);
  assert.equal(audits.length, invalid.length);
  assert.doesNotMatch(JSON.stringify(audits), /PRIVATE_MARKER_NEVER_PERSIST/);
});

test("Agent study candidates derive student scope and cannot be reused as staff or Ops memory", async () => {
  const { repository } = createRepository();
  const service = new AgentContextService(repository);
  const input = { candidateType: "study_goal", structured: { degreeLevel: "master" } };
  const candidate = await service.proposeCandidate(createRequestContext({ actorUserId: "student-1", activeRole: "student" }), input, now);
  assert.equal(candidate.contextScope, "student_account");
  assert.equal(candidate.dataClass, "low_sensitive_preference");
  assert.equal(candidate.summary, "Degree: master");
  assert.equal(candidate.confidence, "inferred");
  assert.equal(candidate.expiresAt.toISOString(), "2026-09-04T00:00:00.000Z");
  for (const activeRole of ["school_staff", "cuac_ops", "cuac_admin"]) {
    await assert.rejects(service.proposeCandidate(createRequestContext({ actorUserId: "staff-1", activeRole }), input, now), (e) => e.status === 403);
  }
});

test("legacy guest candidates with unknown structured content cannot be promoted", async () => {
  const candidate = { id: "a1111111-a111-4111-8111-a11111111111", anonymousSessionHash: "guest-1", userId: null, memoryNamespace: null, candidateType: "study_goal", contextScope: "guest_page",
    activeRole: "guest", tenantSchoolId: null, dataClass: "low_sensitive_preference", structured: { accountNumber: "PRIVATE_LEGACY_MARKER" },
    summary: "PRIVATE_LEGACY_MARKER", status: "proposed", expiresAt: new Date("2026-08-29T00:00:00Z") };
  const { repository, calls } = createRepository([candidate]);
  const service = new AgentContextService(repository);
  await assert.rejects(service.carryForwardGuestCandidateToStudentMemory(createRequestContext({ actorUserId: "student-1", activeRole: "student", guestSessionId: "guest-1" }), candidate.id, now), (e) => e.status === 400);
  assert.deepEqual(calls.map(c => c.method), ["findCandidateForConfirmation"]);
});

function createRepository(seedCandidates = []) {
  const calls = [];
  const candidates = new Map(seedCandidates.map((candidate) => [candidate.id, candidate]));

  return {
    calls,
    repository: {
      async assertMemoryAllowed() {},
      async createCandidate(input) {
        calls.push({ method: "createCandidate", input });
        const candidate = {
          id: "a1111111-a111-4111-8111-a11111111111",
          createdAt: now,
          acceptedAt: null,
          ...input,
        };
        candidates.set(candidate.id, candidate);
        return candidate;
      },
      async findCandidateForConfirmation(candidateId, owner) {
        calls.push({ method: "findCandidateForConfirmation", candidateId, owner });
        return candidates.get(candidateId) ?? null;
      },
      async markCandidateAccepted(candidateId, owner) {
        calls.push({ method: "markCandidateAccepted", candidateId, owner });
        const candidate = candidates.get(candidateId);
        if (candidate?.status === "proposed") {
          candidate.status = "accepted";
          candidate.acceptedAt = now;
          return true;
        }
        return false;
      },
      async createMemoryEntry(input) {
        calls.push({ method: "createMemoryEntry", input });
        return {
          id: `memory-${calls.length}`,
          createdAt: now,
          expiresAt: new Date("2027-08-28T00:00:00.000Z"),
          clearedAt: null,
          ...input,
        };
      },
    },
  };
}

test("Agent context creates short-lived guest preference candidates without durable namespace", async () => {
  const { repository, calls } = createRepository();
  const auditEvents = [];
  const service = new AgentContextService(repository, {
    async record(event) {
      auditEvents.push(event);
    },
  });
  const context = createRequestContext({
    guestSessionId: "guest-session-1",
    purpose: "agent_tool",
  });

  const candidate = await service.proposeCandidate(
    context,
    {
      candidateType: "study_goal",
      structured: { subjectAreas: ["computer_science"], fundingIntent: "scholarship_possible" },
    },
    now,
  );

  assert.equal(candidate.userId, null);
  assert.equal(candidate.anonymousSessionHash, "guest-session-1");
  assert.equal(candidate.memoryNamespace, null);
  assert.equal(candidate.contextScope, "guest_page");
  assert.equal(candidate.expiresAt.toISOString(), "2026-08-29T00:00:00.000Z");
  assert.equal(calls[0].method, "createCandidate");
  assert.equal(auditEvents[0].action, "agent.context_candidate.create");
  assert.equal(auditEvents[0].allowed, true);
  assert.equal(auditEvents[0].resourceId, "a1111111-a111-4111-8111-a11111111111");
  assert.equal(auditEvents[0].metadata.summary, undefined);
  assert.equal(auditEvents[0].metadata.sourceEntityCount, 0);
});

test("Agent context does not allow guest candidates to become durable memory directly", async () => {
  const guestCandidate = {
    id: "a1111111-a111-4111-8111-a11111111111",
    anonymousSessionHash: "guest-session-1",
    userId: null,
    continuationId: null,
    candidateType: "study_goal",
    contextScope: "guest_page",
    activeRole: "guest",
    tenantSchoolId: null,
    memoryNamespace: null,
    dataClass: "low_sensitive_preference",
    confidence: "user_stated",
    summary: "Interested in scholarships.",
    structured: {},
    sourceEntityIds: [],
    status: "proposed",
    expiresAt: new Date("2026-08-29T00:00:00.000Z"),
    createdAt: now,
    acceptedAt: null,
  };
  const { repository } = createRepository([guestCandidate]);
  const service = new AgentContextService(repository);
  const context = createRequestContext({ activeRole: "guest", guestSessionId: "guest-session-1" });

  await assert.rejects(
    () => service.acceptCandidateAsMemory(context, "a1111111-a111-4111-8111-a11111111111", now),
    (error) => error instanceof CuacError && error.status === 403,
  );
});

test("Agent context carries guest candidates forward only after student confirmation", async () => {
  const guestCandidate = {
    id: "a1111111-a111-4111-8111-a11111111111",
    anonymousSessionHash: "guest-session-1",
    userId: null,
    continuationId: null,
    candidateType: "study_goal",
    contextScope: "guest_page",
    activeRole: "guest",
    tenantSchoolId: null,
    memoryNamespace: null,
    dataClass: "low_sensitive_preference",
    confidence: "user_stated",
    summary: "Interested in CS programs in Hangzhou.",
    structured: { subjectAreas: ["computer_science"] },
    sourceEntityIds: ["city:hangzhou"],
    status: "proposed",
    expiresAt: new Date("2026-08-29T00:00:00.000Z"),
    createdAt: now,
    acceptedAt: null,
  };
  const { repository, calls } = createRepository([guestCandidate]);
  const auditEvents = [];
  const service = new AgentContextService(repository, {
    async record(event) {
      auditEvents.push(event);
    },
  });
  const context = createRequestContext({
    actorUserId: "student-1",
    guestSessionId: "guest-session-1",
    selectedSurface: "student",
    activeRole: "student",
    purpose: "agent_tool",
  });

  const memory = await service.carryForwardGuestCandidateToStudentMemory(context, "a1111111-a111-4111-8111-a11111111111", now);

  assert.equal(memory.userId, "student-1");
  assert.equal(memory.contextScope, "student_account");
  assert.equal(memory.memoryNamespace, "user:student-1:student");
  assert.equal(memory.source, "guest_context_carry_forward");
  assert.equal(memory.confidence, "user_confirmed");
  assert.equal(memory.expiresAt.toISOString(), "2027-08-28T00:00:00.000Z");
  assert.equal(memory.summary, "Subjects: computer_science");
  assert.equal(memory.summary.includes("Hangzhou"), false);
  assert.equal(calls.some((call) => call.method === "markCandidateAccepted"), true);
  assert.equal(auditEvents[0].action, "agent.memory.carry_forward");
  assert.equal(auditEvents[0].allowed, true);
  assert.equal(auditEvents[0].metadata.memoryNamespace, "user:student-1:student");
  assert.equal(auditEvents[0].metadata.summary, undefined);
});

test("Agent context rejects guest carry-forward when session binding does not match", async () => {
  const { repository } = createRepository([
    {
      id: "a1111111-a111-4111-8111-a11111111111",
      anonymousSessionHash: "guest-session-1",
      userId: null,
      continuationId: null,
      candidateType: "study_goal",
      contextScope: "guest_page",
      activeRole: "guest",
      tenantSchoolId: null,
      memoryNamespace: null,
      dataClass: "low_sensitive_preference",
      confidence: "user_stated",
      summary: "Interested in scholarships.",
      structured: {},
      sourceEntityIds: [],
      status: "proposed",
      expiresAt: new Date("2026-08-29T00:00:00.000Z"),
      createdAt: now,
      acceptedAt: null,
    },
  ]);
  const service = new AgentContextService(repository);
  const context = createRequestContext({
    actorUserId: "student-1",
    guestSessionId: "different-guest-session",
    selectedSurface: "student",
    activeRole: "student",
  });

  await assert.rejects(
    () => service.carryForwardGuestCandidateToStudentMemory(context, "a1111111-a111-4111-8111-a11111111111", now),
    (error) => error instanceof CuacError && error.status === 403,
  );
});

test("Agent memory namespaces stay separated by active persona", () => {
  assert.equal(
    deriveMemoryNamespace(createRequestContext({ actorUserId: "student-1", activeRole: "student" }), "student_account"),
    "user:student-1:student",
  );
  assert.equal(
    deriveMemoryNamespace(
      createRequestContext({
        actorUserId: "staff-1",
        activeRole: "school_staff",
        selectedSurface: "school",
        tenantSchoolId: "school-1",
      }),
      "school_tenant",
    ),
    "school:school-1:staff",
  );
});

test("Agent context rejects client data-class and free-text fields without logging their values", async () => {
  const { repository } = createRepository();
  const auditEvents = [];
  const service = new AgentContextService(repository, {
    async record(event) {
      auditEvents.push(event);
    },
  });
  const context = createRequestContext({ activeRole: "student", actorUserId: "student-1" });

  await assert.rejects(
    () =>
      service.proposeCandidate(context, {
        candidateType: "payment_detail",
        contextScope: "student_account",
        dataClass: "payment_sensitive",
        confidence: "user_stated",
        summary: "My card number is 4111111111111111.",
      }),
    (error) => error instanceof CuacError && error.status === 400,
  );
  assert.equal(auditEvents[0].action, "agent.context_candidate.create");
  assert.equal(auditEvents[0].allowed, false);
  assert.deepEqual(auditEvents[0].dataClasses, []);
  assert.deepEqual(auditEvents[0].metadata, { deniedCode: "BAD_REQUEST" });
  assert.doesNotMatch(JSON.stringify(auditEvents), /4111111111111111|payment_detail/);
  assert.equal(auditEvents[0].metadata.summary, undefined);
});
