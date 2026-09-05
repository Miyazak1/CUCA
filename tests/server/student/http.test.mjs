import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createStudentHttpHandlers, hashSessionToken, SESSION_COOKIE_NAME, StudentCoreService } from "../../../src/server/index.ts";

const activeStudentSession = {
  userId: "student-1",
  selectedSurface: "student",
  activeRole: "student",
  tenantSchoolId: null,
  authStrength: "session",
  expiresAt: new Date("2026-09-29T00:00:00.000Z"),
  revokedAt: null,
  accountStatus: "active",
};

function createHandlers(repositoryOverrides = {}, authSession = activeStudentSession) {
  const calls = [];
  const repository = {
    async getProfileByUserId(userId) {
      calls.push({ method: "getProfileByUserId", userId });
      return { id: "profile-1", userId, displayName: "Ada", citizenshipCountry: null, targetDegreeLevel: null, targetIntake: null, preferences: {}, profileCompletion: {} };
    },
    async upsertProfile(userId, input) {
      calls.push({ method: "upsertProfile", userId, input });
      return { id: "profile-1", userId, displayName: input.displayName ?? null, citizenshipCountry: null, targetDegreeLevel: null, targetIntake: null, preferences: input.preferences ?? {}, profileCompletion: {} };
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
      return { id: "choice-1", applicationSetId: input.applicationSetId, userId, schoolId: input.schoolId, programId: input.programId ?? null, scholarshipId: input.scholarshipId ?? null, rankOrder: input.rankOrder ?? 0, status: "draft", studentNotes: input.studentNotes ?? null };
    },
    async removeApplicationChoice(userId, applicationSetId, choiceId) {
      calls.push({ method: "removeApplicationChoice", userId, applicationSetId, choiceId });
      return { id: choiceId, applicationSetId, status: "removed", changed: true };
    },
    ...repositoryOverrides,
  };
  const authRepository = {
    async findActiveSessionByTokenHash(sessionTokenHash) {
      calls.push({ method: "findActiveSessionByTokenHash", sessionTokenHash });
      return authSession;
    },
  };

  return {
    calls,
    handlers: createStudentHttpHandlers(new StudentCoreService(repository, null, {
      async authorizeMutation() { calls.push({ method: "authorizeMutation" }); },
      async execute(context, operation, input, key, create) { calls.push({ method: "command", key, operation }); return create(); },
    }), authRepository),
  };
}

test("student HTTP profile update resolves actor from session cookie and ignores body userId authority", async () => {
  const { handlers, calls } = createHandlers();
  const response = await handlers.updateProfile(
    new Request("https://cuac.test/api/v1/student/profile", {
      method: "PATCH",
      headers: { cookie: `${SESSION_COOKIE_NAME}=student-token` },
      body: JSON.stringify({ userId: "attacker", displayName: "  Ada  ", preferences: { subjectAreas: ["computer_science"] } }),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.userId, "student-1");
  assert.equal(body.data.displayName, "Ada");
  assert.match(calls[0].sessionTokenHash, /^sha256:/);
  assert.equal(calls[0].sessionTokenHash, hashSessionToken("student-token"));
  assert.equal(calls[1].method, "upsertProfile");
  assert.equal(calls[1].userId, "student-1");
});

test("student HTTP routes reject guest access before repository writes", async () => {
  const { handlers, calls } = createHandlers({}, null);
  const response = await handlers.saveItem(
    new Request("https://cuac.test/api/v1/student/saved-items", {
      method: "POST",
      body: JSON.stringify({ entityType: "program", entityId: "c1111111-c111-4111-8111-c11111111111" }),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.error.code, "FORBIDDEN");
  assert.deepEqual(calls, []);
});

test("student HTTP saved-item removal binds the path id and current session", async () => {
  const { handlers, calls } = createHandlers();
  const savedItemId = "d1111111-d111-4111-8111-d11111111111";
  const response = await handlers.removeSavedItem(new Request("https://cuac.test/api/v1/student/saved-items/ignored", {
    method: "DELETE",
    headers: { cookie: `${SESSION_COOKIE_NAME}=student-token` },
  }), savedItemId);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.id, savedItemId);
  assert.deepEqual(calls.at(-1), { method: "removeSavedItem", userId: "student-1", savedItemId });
});

test("student HTTP add choice uses route applicationSetId over request body", async () => {
  const { handlers, calls } = createHandlers();
  const response = await handlers.addApplicationChoice(
    new Request("https://cuac.test/api/v1/student/application-sets/a1111111-a111-4111-8111-a11111111111/choices", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=student-token`, "idempotency-key": "test-choice-key-123456" },
      body: JSON.stringify({ applicationSetId: "attacker-set", schoolId: "b1111111-b111-4111-8111-b11111111111", programId: "c1111111-c111-4111-8111-c11111111111" }),
    }),
    "a1111111-a111-4111-8111-a11111111111",
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.applicationSetId, "a1111111-a111-4111-8111-a11111111111");
  assert.equal(calls.at(-1).input.applicationSetId, "a1111111-a111-4111-8111-a11111111111");
  assert.equal(calls.find(call => call.method === "command").key, "test-choice-key-123456");
});

test("student HTTP intake binding reaches domain parsing without trusting body scope or extra fields", async () => {
  const { handlers, calls } = createHandlers({ async addApplicationChoice(userId, input) {
    calls.push({ method: "addApplicationChoice", userId, input }); return { id: "bound-choice", userId, ...input };
  } });
  const id = "a1111111-a111-4111-8111-a11111111111";
  const body = { applicationSetId: "ignored", schoolId: id, programId: id, programIntakeId: id.toUpperCase() };
  const send = input => handlers.addApplicationChoice(new Request("https://cuac.test/api", { method: "POST",
    headers: { cookie: `${SESSION_COOKIE_NAME}=student-token`, "idempotency-key": "intake-test-key-123456" }, body: JSON.stringify(input) }), id);
  const success = await send(body);
  assert.equal(success.status, 200);
  const data = (await success.json()).data;
  assert.equal(data.programIntakeId, id); assert.equal(data.applicationSetId, id);
  for (const bad of [{ ...body, programId: null }, { ...body, programIntakeId: "bad" }, { ...body, paid: true }]) {
    assert.equal((await send(bad)).status, 400);
  }
  assert.equal(calls.filter(c => c.method === "addApplicationChoice").length, 1);
});

test("student app route files stay thin and do not read demo data directly", async () => {
  const routePaths = [
    "../../../app/api/v1/student/profile/route.ts",
    "../../../app/api/v1/student/applicant-profile/route.ts",
    "../../../app/api/v1/student/education-records/route.ts",
    "../../../app/api/v1/student/education-records/[recordId]/route.ts",
    "../../../app/api/v1/student/education-records/[recordId]/remove/route.ts",
    "../../../app/api/v1/student/saved-items/route.ts",
    "../../../app/api/v1/student/saved-items/[savedItemId]/route.ts",
    "../../../app/api/v1/student/application-sets/route.ts",
    "../../../app/api/v1/student/application-sets/[applicationSetId]/route.ts",
    "../../../app/api/v1/student/application-sets/[applicationSetId]/choices/route.ts",
    "../../../app/api/v1/student/application-sets/[applicationSetId]/choices/[choiceId]/route.ts",
    "../../../app/api/v1/student/application-sets/[applicationSetId]/choice-order/route.ts",
  ];

  const contents = await Promise.all(routePaths.map((routePath) => readFile(new URL(routePath, import.meta.url), "utf8")));

  contents.forEach((source) => {
    assert.match(source, /getStudentRouteHandlers/);
    assert.doesNotMatch(source, /cuac-data|public\/|design-lab|db\/schema|select\s+\*/i);
  });
});

test("student HTTP edit and order use path scope and current session without POST command keys", async () => {
  const id = "a1111111-a111-4111-8111-a11111111111", seen = [];
  const { handlers } = createHandlers({
    async updateApplicationChoice(...args) { seen.push(["edit", ...args]); return { changed: true }; },
    async reorderApplicationChoices(...args) { seen.push(["order", ...args]); return { changed: true }; },
  });
  const request = (method, body) => new Request("https://cuac.test/api", { method, headers: { cookie: `${SESSION_COOKIE_NAME}=student-token` }, body: JSON.stringify(body) });
  assert.equal((await handlers.updateApplicationChoice(request("PATCH", { expectedRevision: 1, studentNotes: null }), id, id)).status, 200);
  assert.equal((await handlers.reorderApplicationChoices(request("PUT", { expectedRevision: 1, choiceIds: [id] }), id)).status, 200);
  assert.deepEqual(seen, [["edit", "student-1", id, id, { expectedRevision: 1, studentNotes: null }], ["order", "student-1", id, { expectedRevision: 1, choiceIds: [id] }]]);
});

test("student HTTP edit and order reject missing revisions, authority fields and guests", async () => {
  const id = "a1111111-a111-4111-8111-a11111111111";
  for (const session of [activeStudentSession, null]) {
    const { handlers, calls } = createHandlers({}, session);
    for (const [method, input] of [["PATCH", { studentNotes: "x" }], ["PATCH", { expectedRevision: 1, studentNotes: "x", programId: id }],
      ["PUT", { choiceIds: [id] }], ["PUT", { expectedRevision: 1, choiceIds: [id], userId: id }]]) {
      const req = new Request("https://cuac.test/api", { method, headers: { cookie: `${SESSION_COOKIE_NAME}=student-token` }, body: JSON.stringify(input) });
      const res = method === "PATCH" ? await handlers.updateApplicationChoice(req, id, id) : await handlers.reorderApplicationChoices(req, id);
      assert.equal(res.status, session ? 400 : 403);
    }
    assert.equal(calls.some(c => c.method === "authorizeMutation"), false);
  }
});

test("student DELETE resolves actor from session and uses only route target IDs without a command key", async () => {
  const { handlers, calls } = createHandlers();
  const applicationSetId = "a1111111-a111-4111-8111-a11111111111", choiceId = "c1111111-c111-4111-8111-c11111111111";
  const response = await handlers.removeApplicationChoice(new Request("https://cuac.test/api", {
    method: "DELETE", headers: { cookie: `${SESSION_COOKIE_NAME}=student-token` },
  }), applicationSetId, choiceId);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: { id: choiceId, applicationSetId, status: "removed" } });
  assert.deepEqual(calls.at(-1), { method: "removeApplicationChoice", userId: "student-1", applicationSetId, choiceId });
  assert.equal(calls.at(-2).method, "authorizeMutation");
  assert.equal(calls.some(call => call.method === "command"), false);
});

test("student DELETE rejects guest, body and malformed identifiers before any mutation", async () => {
  const id = "a1111111-a111-4111-8111-a11111111111";
  for (const [session, body, setId, choiceId, status] of [[null, undefined, id, id, 403],
    [activeStudentSession, '{}', id, id, 400], [activeStudentSession, undefined, "invalid", id, 400],
    [activeStudentSession, undefined, id, "invalid", 400]]) {
    const { handlers, calls } = createHandlers({}, session);
    const response = await handlers.removeApplicationChoice(new Request("https://cuac.test/api", {
      method: "DELETE", headers: { cookie: `${SESSION_COOKIE_NAME}=student-token` }, body,
    }), setId, choiceId);
    assert.equal(response.status, status);
    assert.equal(calls.some(call => call.method === "removeApplicationChoice" || call.method === "authorizeMutation"), false);
  }
});
