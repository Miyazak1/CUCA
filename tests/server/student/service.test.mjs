import assert from "node:assert/strict";
import test from "node:test";
import { CuacError, createRequestContext, StudentCoreService } from "../../../src/server/index.ts";
import { parseApplicationChoiceOrder, parseApplicationChoiceUpdate } from "../../../src/server/student/input.ts";

test("student profile rejects malformed and arbitrary preference input before any repository call", async () => {
  const { repository, calls } = createRepository();
  const service = new StudentCoreService(repository);
  const context = createRequestContext({ activeRole: "student", actorUserId: "student-1" });
  const invalid = [null, [], {}, { userId: "attacker" }, { displayName: {} }, { displayName: "x".repeat(121) }, { displayName: "Name\u0000" },
    { citizenshipCountry: "China" }, { citizenshipCountry: "cn" }, { targetDegreeLevel: "Bachelor" }, { targetIntake: [] },
    { preferences: null }, { preferences: { passport: "sensitive-marker" } }, { preferences: { subjectAreas: ["raw free text"] } },
    { preferences: { subjectAreas: ["law", "law"] } }, { preferences: { preferredCityIds: ["city:beijing"] } }, { preferences: { preferredCityIds: Array(1) } },
    { preferences: { intakeYear: "2027" } }, { preferences: { intakeYear: 2101 } }, { preferences: { fundingIntent: true } },
    { profileCompletion: { approved: true } }, { preferences: { userId: "attacker" } }];
  for (const input of invalid) await assert.rejects(service.updateOwnProfile(context, input), (e) => e.status === 400);
  assert.deepEqual(calls, []);
});

test("draft editing accepts only a revision and the three mutable choice fields", () => {
  const id = "a1111111-a111-4111-8111-a11111111111";
  for (const value of [null, [], {}, { expectedRevision: 1 }, { expectedRevision: 0, studentNotes: "a" },
    { expectedRevision: 1.5, studentNotes: "a" }, { expectedRevision: "1", studentNotes: "a" },
    { expectedRevision: 2147483648, studentNotes: "a" }, { expectedRevision: 1, studentNotes: {} },
    { expectedRevision: 1, studentNotes: "x".repeat(2001) }, { expectedRevision: 1, studentNotes: "a\u0000" },
    { expectedRevision: 1, scholarshipId: "bad" }, { expectedRevision: 1, admissionRouteKey: "Direct University" },
    { expectedRevision: 1, admissionRouteKey: "x".repeat(65) },
    ...["userId", "schoolId", "programId", "status", "rankOrder", "applicationSetId"].map(field => ({ expectedRevision: 1, studentNotes: "a", [field]: id }))]) {
    assert.throws(() => parseApplicationChoiceUpdate(value), e => e.status === 400);
  }
  assert.deepEqual(parseApplicationChoiceUpdate({ expectedRevision: 2, studentNotes: "  A  " }), { expectedRevision: 2, studentNotes: "A" });
  assert.deepEqual(parseApplicationChoiceUpdate({ expectedRevision: 2, studentNotes: " ", scholarshipId: null }), { expectedRevision: 2, studentNotes: null, scholarshipId: null });
  assert.deepEqual(parseApplicationChoiceUpdate({ expectedRevision: 2, scholarshipId: id.toUpperCase() }), { expectedRevision: 2, scholarshipId: id });
  assert.deepEqual(parseApplicationChoiceUpdate({ expectedRevision: 2, admissionRouteKey: "direct_university" }),
    { expectedRevision: 2, admissionRouteKey: "direct_university" });
  assert.deepEqual(parseApplicationChoiceUpdate({ expectedRevision: 2, admissionRouteKey: null }),
    { expectedRevision: 2, admissionRouteKey: null });
});

test("draft order accepts a bounded unique list and never coerces revision or IDs", () => {
  const id = "a1111111-a111-4111-8111-a11111111111";
  for (const input of [{}, { expectedRevision: 1 }, { expectedRevision: 0, choiceIds: [] }, { expectedRevision: 1, choiceIds: "ids" },
    { expectedRevision: 1, choiceIds: [id, id.toUpperCase()] }, { expectedRevision: 1, choiceIds: Array(1) },
    { expectedRevision: 1, choiceIds: Array(1001).fill(id) }, { expectedRevision: 1, choiceIds: [], userId: id }]) {
    assert.throws(() => parseApplicationChoiceOrder(input), e => e.status === 400);
  }
  assert.deepEqual(parseApplicationChoiceOrder({ expectedRevision: 1, choiceIds: [] }), { expectedRevision: 1, choiceIds: [] });
  assert.deepEqual(parseApplicationChoiceOrder({ expectedRevision: 1, choiceIds: [id.toUpperCase()] }), { expectedRevision: 1, choiceIds: [id] });
});

test("draft edit and order reject unauthorized contexts and invalid paths before storage", async () => {
  const { repository, calls } = createRepository(), service = new StudentCoreService(repository);
  const id = "a1111111-a111-4111-8111-a11111111111", student = createRequestContext({ activeRole: "student", actorUserId: "student-1" });
  for (const context of [createRequestContext(), { ...student, activeRole: "school_staff" }, { ...student, tenantSchoolId: id }, { ...student, dataClassAllowlist: [] }]) {
    await assert.rejects(service.updateOwnApplicationChoice(context, id, id, { expectedRevision: 1, studentNotes: null }), e => e.status === 403);
    await assert.rejects(service.reorderOwnApplicationChoices(context, id, { expectedRevision: 1, choiceIds: [] }), e => e.status === 403);
  }
  await assert.rejects(service.updateOwnApplicationChoice(student, id, "invalid", { expectedRevision: 1, studentNotes: null }), e => e.status === 400);
  await assert.rejects(service.reorderOwnApplicationChoices(student, "invalid", { expectedRevision: 1, choiceIds: [] }), e => e.status === 400);
  assert.deepEqual(calls, []);
});

test("draft edit and order authorize, reload within the call and audit only changed fields without content", async () => {
  const id = "a1111111-a111-4111-8111-a11111111111", context = createRequestContext({ activeRole: "student", actorUserId: "student-1" });
  const events = [], calls = [];
  let changed = true;
  const current = { id, userId: context.actorUserId, revision: 3, choices: [], status: "draft" };
  const repository = {
    async updateApplicationChoice(...args) { calls.push(["update", ...args]); return { changed }; },
    async reorderApplicationChoices(...args) { calls.push(["reorder", ...args]); return { changed }; },
    async getApplicationSetById(...args) { calls.push(["reload", ...args]); return current; },
  };
  const service = new StudentCoreService(repository, { async record(event) { events.push(event); } }, {
    async authorizeMutation(ctx) { assert.equal(ctx, context); calls.push(["authorize"]); },
  });
  assert.equal(await service.updateOwnApplicationChoice(context, id, id, { expectedRevision: 2, studentNotes: " private-edit-marker " }), current);
  assert.deepEqual(calls.slice(0, 3), [["authorize"], ["update", context.actorUserId, id, id, { expectedRevision: 2, studentNotes: "private-edit-marker" }], ["reload", id, context.actorUserId]]);
  assert.equal(await service.reorderOwnApplicationChoices(context, id, { expectedRevision: 2, choiceIds: [] }), current);
  assert.deepEqual(events.map(e => e.action), ["student.application_choice.update", "student.application_choices.reorder"]);
  assert.deepEqual(events[0].metadata, { applicationSetId: id, revision: 3, fields: ["studentNotes"] });
  assert.deepEqual(events[1].metadata, { revision: 3, choiceCount: 0 });
  assert.doesNotMatch(JSON.stringify(events), /private-edit-marker/);
  changed = false;
  await service.updateOwnApplicationChoice(context, id, id, { expectedRevision: 3, studentNotes: null });
  await service.reorderOwnApplicationChoices(context, id, { expectedRevision: 3, choiceIds: [] });
  assert.equal(events.length, 2);
});

test("draft edit and order propagate authority, reload and audit errors", async () => {
  const id = "a1111111-a111-4111-8111-a11111111111", context = createRequestContext({ activeRole: "student", actorUserId: "student-1" });
  for (const operation of ["edit", "order"]) {
    const invoke = s => operation === "edit" ? s.updateOwnApplicationChoice(context, id, id, { expectedRevision: 1, studentNotes: null })
      : s.reorderOwnApplicationChoices(context, id, { expectedRevision: 1, choiceIds: [] });
    const failure = new Error("Injected audit failure");
    const repo = { async updateApplicationChoice() { return { changed: true }; }, async reorderApplicationChoices() { return { changed: true }; },
      async getApplicationSetById() { return { id, revision: 2 }; } };
    await assert.rejects(invoke(new StudentCoreService(repo, { async record() { throw failure; } })), e => e === failure);
    await assert.rejects(invoke(new StudentCoreService({ ...repo, async getApplicationSetById() { return null; } })), e => e.status === 503);
    await assert.rejects(invoke(new StudentCoreService({}, null, { async authorizeMutation() { throw failure; } })), e => e === failure);
  }
});

test("student profile patch distinguishes omitted fields from explicit clearing", async () => {
  const { repository, calls } = createRepository();
  const service = new StudentCoreService(repository);
  const context = createRequestContext({ activeRole: "student", actorUserId: "student-1" });
  await service.updateOwnProfile(context, { displayName: " Ada " });
  await service.updateOwnProfile(context, { displayName: null, preferences: {} });
  assert.deepEqual(calls.map(c => c.input), [{ displayName: "Ada" }, { displayName: null, preferences: {} }]);
});

test("student saved items and application writes validate fields before querying storage", async () => {
  const { repository, calls } = createRepository();
  const service = new StudentCoreService(repository);
  const context = createRequestContext({ activeRole: "student", actorUserId: "student-1" });
  const id = "a1111111-a111-4111-8111-a11111111111";
  for (const input of [null, {}, { entityType: "payment", entityId: id }, { entityType: "school", entityId: "x" }, { entityType: "school", entityId: id, notes: {} }]) {
    await assert.rejects(service.saveOwnItem(context, input), (e) => e.status === 400);
  }
  for (const input of [null, {}, { name: " " }, { name: 12 }, { name: "x".repeat(121) }, { name: "Valid", status: "submitted" }]) {
    await assert.rejects(service.createOwnApplicationSet(context, input), (e) => e.status === 400);
  }
  for (const extra of [{ rankOrder: -1 }, { rankOrder: 1.5 }, { rankOrder: "1" }, { rankOrder: 1001 }, { programId: [] }, { scholarshipId: "secret-marker" }, { studentNotes: "x".repeat(2001) }, { status: "submitted" }]) {
    await assert.rejects(service.addOwnApplicationChoice(context, { applicationSetId: id, schoolId: id, ...extra }), (e) => e.status === 400);
  }
  assert.deepEqual(calls, []);
});

function createRepository(overrides = {}) {
  const calls = [];
  return {
    calls,
    repository: {
      async getProfileByUserId(userId) {
        calls.push({ method: "getProfileByUserId", userId });
        return { id: "profile-1", userId, displayName: "Ada", citizenshipCountry: null, targetDegreeLevel: null, targetIntake: null, preferences: {}, profileCompletion: {} };
      },
      async upsertProfile(userId, input) {
        calls.push({ method: "upsertProfile", userId, input });
        return { id: "profile-1", userId, displayName: input.displayName ?? null, citizenshipCountry: input.citizenshipCountry ?? null, targetDegreeLevel: input.targetDegreeLevel ?? null, targetIntake: input.targetIntake ?? null, preferences: input.preferences ?? {}, profileCompletion: {} };
      },
      async listSavedItemsByUserId(userId) {
        calls.push({ method: "listSavedItemsByUserId", userId });
        return [];
      },
      async saveItem(userId, input) {
        calls.push({ method: "saveItem", userId, input });
        return { id: "saved-1", userId, entityType: input.entityType, entityId: input.entityId, notes: input.notes ?? null, createdAt: new Date("2026-08-28T00:00:00.000Z") };
      },
      async removeSavedItem(userId, savedItemId) {
        calls.push({ method: "removeSavedItem", userId, savedItemId });
        return { id: savedItemId, entityType: "program", entityId: "c1111111-c111-4111-8111-c11111111111", removedAt: new Date("2026-08-28T00:00:00.000Z") };
      },
      async listApplicationSetsByUserId(userId) {
        calls.push({ method: "listApplicationSetsByUserId", userId });
        return [];
      },
      async getApplicationSetById(applicationSetId) {
        calls.push({ method: "getApplicationSetById", applicationSetId });
        return { id: applicationSetId, userId: "student-1", name: "Main", status: "draft", targetIntake: null, choices: [] };
      },
      async createApplicationSet(userId, input) {
        calls.push({ method: "createApplicationSet", userId, input });
        return { id: "a1111111-a111-4111-8111-a11111111111", userId, name: input.name, status: "draft", targetIntake: input.targetIntake ?? null, choices: [] };
      },
      async addApplicationChoice(userId, input) {
        calls.push({ method: "addApplicationChoice", userId, input });
        return { id: "choice-1", applicationSetId: input.applicationSetId, userId, schoolId: input.schoolId, programId: input.programId ?? null, programIntakeId: input.programIntakeId ?? null, scholarshipId: input.scholarshipId ?? null, rankOrder: input.rankOrder ?? 0, status: "draft", studentNotes: input.studentNotes ?? null };
      },
      async removeApplicationChoice(userId, applicationSetId, choiceId) {
        calls.push({ method: "removeApplicationChoice", userId, applicationSetId, choiceId });
        return { id: choiceId, applicationSetId, status: "removed", changed: true };
      },
      ...overrides,
    },
  };
}

test("new choice commands cannot mutate a non-draft set even with a permissive repository", async () => {
  const id = "a1111111-a111-4111-8111-a11111111111";
  for (const status of ["submitted", "payment_pending", "archived", "unknown", "Draft", ""]) {
    const { repository, calls } = createRepository({
      async getApplicationSetById() { return { id, userId: "student-1", status, choices: [] }; },
    });
    const service = new StudentCoreService(repository);
    const context = createRequestContext({ activeRole: "student", actorUserId: "student-1" });
    await assert.rejects(service.addOwnApplicationChoice(context, { applicationSetId: id, schoolId: id }), e => e.code === "CONFLICT" && e.status === 409);
    assert.equal(calls.some(call => call.method === "addApplicationChoice"), false);
  }
});

test("choice removal validates student, tenant, data class and both IDs before storage", async () => {
  const { repository, calls } = createRepository(), service = new StudentCoreService(repository);
  const id = "a1111111-a111-4111-8111-a11111111111";
  const context = createRequestContext({ activeRole: "student", actorUserId: "student-1" });
  for (const ctx of [createRequestContext(), { ...context, activeRole: "school_admin" },
    { ...context, actorUserId: null }, { ...context, tenantSchoolId: id }, { ...context, dataClassAllowlist: [] }]) {
    await assert.rejects(service.removeOwnApplicationChoice(ctx, id, id), e => e.status === 403);
  }
  for (const ids of [["invalid", id], [id, "invalid"], [id, null]]) {
    await assert.rejects(service.removeOwnApplicationChoice(context, ...ids), e => e.status === 400);
  }
  assert.deepEqual(calls, []);
});

test("choice removal rechecks authority, emits only first transition audit and returns a minimal acknowledgement", async () => {
  const id = "a1111111-a111-4111-8111-a11111111111", choiceId = "c1111111-c111-4111-8111-c11111111111";
  const context = createRequestContext({ activeRole: "student", actorUserId: "student-1" });
  const events = [], order = [];
  let changed = true;
  const { repository } = createRepository({ async removeApplicationChoice(userId, setId, targetId) {
    order.push("remove"); assert.deepEqual([userId, setId, targetId], [context.actorUserId, id, choiceId]);
    return { id: choiceId, applicationSetId: id, status: "removed", changed, studentNotes: "private-marker" };
  } });
  const service = new StudentCoreService(repository, { async record(event) { order.push("audit"); events.push(event); } },
    { async authorizeMutation(ctx) { assert.equal(ctx, context); order.push("authorize"); } });
  assert.deepEqual(await service.removeOwnApplicationChoice(context, id, choiceId), { id: choiceId, applicationSetId: id, status: "removed" });
  changed = false;
  await service.removeOwnApplicationChoice(context, id, choiceId);
  assert.deepEqual(order, ["authorize", "remove", "audit", "authorize", "remove"]);
  assert.equal(events.length, 1);
  assert.equal(events[0].action, "student.application_choice.remove");
  assert.deepEqual(events[0].metadata, { applicationSetId: id, disclosureEvidenceEnded: false });
  assert.deepEqual(events[0].dataClasses, ["education_record"]);
  assert.doesNotMatch(JSON.stringify(events), /private-marker/);
});

test("choice removal does not continue after authority failure or mask audit failure", async () => {
  const id = "a1111111-a111-4111-8111-a11111111111";
  const context = createRequestContext({ activeRole: "student", actorUserId: "student-1" });
  const { repository, calls } = createRepository();
  const failure = new Error("injected failure");
  await assert.rejects(new StudentCoreService(repository, null, { async authorizeMutation() { throw failure; } })
    .removeOwnApplicationChoice(context, id, id), e => e === failure);
  assert.deepEqual(calls, []);
  await assert.rejects(new StudentCoreService(repository, { async record() { throw failure; } })
    .removeOwnApplicationChoice(context, id, id), e => e === failure);
});

test("an original receipt may reload its owned choice after the application set is frozen", async () => {
  const id = "a1111111-a111-4111-8111-a11111111111", choiceId = "c1111111-c111-4111-8111-c11111111111";
  const choice = { id: choiceId, userId: "student-1", applicationSetId: id, status: "submitted" };
  const { repository, calls } = createRepository({
    async getApplicationSetById() { return { id, userId: "student-1", status: "submitted", choices: [choice] }; },
  });
  const commands = { async execute(_ctx, _operation, _input, _key, _create, reload) { return reload(choiceId); } };
  const context = createRequestContext({ activeRole: "student", actorUserId: "student-1" });
  const result = await new StudentCoreService(repository, null, commands).addOwnApplicationChoice(context,
    { applicationSetId: id, schoolId: id }, { idempotencyKey: "original-command-key" });
  assert.equal(result.id, choiceId);
  assert.equal(calls.some(call => call.method === "addApplicationChoice"), false);
});

test("student service reads own profile using actorUserId from context", async () => {
  const { repository, calls } = createRepository();
  const service = new StudentCoreService(repository);
  const context = createRequestContext({ activeRole: "student", actorUserId: "student-1" });

  await service.getOwnProfile(context);

  assert.deepEqual(calls, [{ method: "getProfileByUserId", userId: "student-1" }]);
});

test("student service update normalizes profile input and ignores client userId authority", async () => {
  const { repository, calls } = createRepository();
  const service = new StudentCoreService(repository);
  const context = createRequestContext({ activeRole: "student", actorUserId: "student-1" });

  await service.updateOwnProfile(context, {
    displayName: "  Ada  ",
    citizenshipCountry: "  ",
    userId: "attacker",
    preferences: { subjectAreas: ["computer_science"] },
  });

  assert.equal(calls[0].method, "upsertProfile");
  assert.equal(calls[0].userId, "student-1");
  assert.deepEqual(calls[0].input, {
    displayName: "Ada",
    citizenshipCountry: null,
    preferences: { subjectAreas: ["computer_science"] },
  });
});

test("student service audits profile updates without raw profile or preference payloads", async () => {
  const { repository } = createRepository();
  const auditEvents = [];
  const service = new StudentCoreService(repository, {
    async record(event) {
      auditEvents.push(event);
    },
  });
  const context = createRequestContext({
    requestId: "req-student-audit-1",
    activeRole: "student",
    actorUserId: "student-1",
    policyDecisionId: "policy-1",
  });

  await service.updateOwnProfile(context, {
    displayName: "  Ada Lovelace  ",
    targetDegreeLevel: "bachelor",
    preferences: { fundingIntent: "scholarship_required" },
  });

  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0].action, "student.profile.update");
  assert.equal(auditEvents[0].resourceType, "student_profile");
  assert.equal(auditEvents[0].resourceId, "profile-1");
  assert.equal(auditEvents[0].allowed, true);
  assert.deepEqual(auditEvents[0].dataClasses, ["student_pii", "low_sensitive_preference"]);
  assert.deepEqual(auditEvents[0].metadata, {
    updatedFields: ["displayName", "targetDegreeLevel", "preferences"],
  });

  const serializedEvent = JSON.stringify(auditEvents[0]);
  assert.equal(serializedEvent.includes("Ada Lovelace"), false);
  assert.equal(serializedEvent.includes("scholarship_required"), false);
});

test("student service denies guest access to student-owned data", async () => {
  const { repository, calls } = createRepository();
  const service = new StudentCoreService(repository);

  await assert.rejects(() => service.listOwnSavedItems(createRequestContext()), CuacError);
  assert.deepEqual(calls, []);
});

test("student service removes only an owned saved item and audits no private notes", async () => {
  const { repository, calls } = createRepository();
  const auditEvents = [];
  const service = new StudentCoreService(repository, { async record(event) { auditEvents.push(event); } });
  const context = createRequestContext({ activeRole: "student", actorUserId: "student-1" });
  const savedItemId = "d1111111-d111-4111-8111-d11111111111";

  const result = await service.removeOwnSavedItem(context, savedItemId);

  assert.equal(result.id, savedItemId);
  assert.deepEqual(calls, [{ method: "removeSavedItem", userId: "student-1", savedItemId }]);
  assert.deepEqual(auditEvents.map(event => event.action), ["student.saved_item.remove"]);
  assert.deepEqual(auditEvents[0].metadata, {
    entityType: "program",
    entityId: "c1111111-c111-4111-8111-c11111111111",
  });
  assert.equal(JSON.stringify(auditEvents[0]).includes("notes"), false);
});

test("student service closes invalid and unavailable saved-item removals", async () => {
  const { repository, calls } = createRepository({ async removeSavedItem(userId, savedItemId) {
    calls.push({ method: "removeSavedItem", userId, savedItemId });
    return null;
  } });
  const service = new StudentCoreService(repository);
  const context = createRequestContext({ activeRole: "student", actorUserId: "student-1" });

  await assert.rejects(service.removeOwnSavedItem(context, "not-an-id"), error => error.status === 400);
  await assert.rejects(service.removeOwnSavedItem(context, "d1111111-d111-4111-8111-d11111111111"), error => error.status === 403);
  assert.equal(calls.length, 1);
});

test("student service denies direct-ID access to another student's application set", async () => {
  const { repository } = createRepository({
    async getApplicationSetById(applicationSetId) {
      return { id: applicationSetId, userId: "student-2", name: "Other", status: "draft", targetIntake: null, choices: [] };
    },
  });
  const service = new StudentCoreService(repository);
  const context = createRequestContext({ activeRole: "student", actorUserId: "student-1" });

  await assert.rejects(() => service.getOwnApplicationSet(context, "a2222222-a222-4222-8222-a22222222222"), (error) => error instanceof CuacError && error.code === "FORBIDDEN");
});

test("student service adds application choices only after owning the application set", async () => {
  const { repository, calls } = createRepository();
  const service = new StudentCoreService(repository);
  const context = createRequestContext({ activeRole: "student", actorUserId: "student-1" });

  const choice = await service.addOwnApplicationChoice(context, {
    applicationSetId: "a1111111-a111-4111-8111-a11111111111",
    schoolId: "b1111111-b111-4111-8111-b11111111111",
    programId: "c1111111-c111-4111-8111-c11111111111",
    rankOrder: 2,
  });

  assert.equal(choice.userId, "student-1");
  assert.deepEqual(calls.map((call) => call.method), ["getApplicationSetById", "addApplicationChoice"]);
  assert.equal(calls[1].userId, "student-1");
});

test("student service audits student write actions without raw notes", async () => {
  const { repository } = createRepository();
  const auditEvents = [];
  const service = new StudentCoreService(repository, {
    async record(event) {
      auditEvents.push(event);
    },
  });
  const context = createRequestContext({
    requestId: "req-student-audit-2",
    activeRole: "student",
    actorUserId: "student-1",
    policyDecisionId: "policy-2",
  });

  await service.saveOwnItem(context, {
    entityType: "school",
    entityId: "b1111111-b111-4111-8111-b11111111111",
    notes: "private saved school note",
  });
  await service.createOwnApplicationSet(context, {
    name: "Fall 2027",
    targetIntake: "2027 Fall",
  });
  await service.addOwnApplicationChoice(context, {
    applicationSetId: "a1111111-a111-4111-8111-a11111111111",
    schoolId: "b1111111-b111-4111-8111-b11111111111",
    programId: "c1111111-c111-4111-8111-c11111111111",
    studentNotes: "private application note",
  });

  assert.deepEqual(
    auditEvents.map((event) => event.action),
    ["student.saved_item.save", "student.application_set.create", "student.application_choice.add"],
  );
  assert.deepEqual(auditEvents[0].metadata, {
    entityType: "school",
    entityId: "b1111111-b111-4111-8111-b11111111111",
    hasNotes: true,
  });
  assert.deepEqual(auditEvents[1].metadata, {
    status: "draft",
    hasTargetIntake: true,
  });
  assert.deepEqual(auditEvents[2].metadata, {
    applicationSetId: "a1111111-a111-4111-8111-a11111111111",
    schoolId: "b1111111-b111-4111-8111-b11111111111",
    programId: "c1111111-c111-4111-8111-c11111111111",
    programIntakeId: null,
    scholarshipId: null,
    hasStudentNotes: true,
  });

  const serializedEvents = JSON.stringify(auditEvents);
  assert.equal(serializedEvents.includes("private saved school note"), false);
  assert.equal(serializedEvents.includes("private application note"), false);
});
