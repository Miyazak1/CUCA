import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createSchoolPortalHttpHandlers, hashSessionToken, SchoolPortalService, SESSION_COOKIE_NAME } from "../../../src/server/index.ts";

const APP_1 = "11111111-1111-4111-8111-111111111111";
const APP_2 = "22222222-2222-4222-8222-222222222222";

const schoolSession = {
  userId: "staff-1",
  selectedSurface: "school",
  activeRole: "school_staff",
  tenantSchoolId: "school-1",
  authStrength: "session",
  expiresAt: new Date("2026-09-29T00:00:00.000Z"),
  revokedAt: null,
  accountStatus: "active",
};

function createHandlers(authSession = schoolSession) {
  const calls = [];
  const repository = {
    async listApplicationQueueBySchoolId(schoolId, cuacId) {
      calls.push({ method: "listApplicationQueueBySchoolId", schoolId, cuacId });
      return [{ id: APP_1, schoolId, studentUserId: "student-1", programId: "program-1", status: "submitted", submittedAt: null, firstViewedAt: null, schoolVisibleProfile: {}, routingMetadata: {} }];
    },
    async getApplicationById(applicationId) {
      calls.push({ method: "getApplicationById", applicationId });
      return { id: applicationId, schoolId: "school-1", studentUserId: "student-1", programId: "program-1", status: "submitted", submittedAt: null, firstViewedAt: null, schoolVisibleProfile: {}, routingMetadata: {}, statusEvents: [], contactLogs: [] };
    },
    async updateApplicationStatus(input) {
      calls.push({ method: "updateApplicationStatus", input });
      return { changed: true, fromStatus: "new", recipientStudentUserId: "student-1",
        recipientApplicationSetId: "22222222-2222-4222-8222-222222222222", result: { id: input.applicationId, schoolId: input.schoolId,
        status: input.command.status, schoolRevision: 2, statusChangedAt: new Date("2026-09-02T00:00:00.000Z"), statusEventId: "event-1" } };
    },
    async recordApplicationContact(input) {
      calls.push({ method: "recordApplicationContact", input });
      return { created: true, contact: { id: "contact-1", schoolApplicationId: input.applicationId,
        actorUserId: input.actorUserId, ...input.command, createdAt: new Date("2026-09-02T00:00:00.000Z") } };
    },
  };
  const authRepository = {
    async findActiveSessionByTokenHash(sessionTokenHash) {
      calls.push({ method: "findActiveSessionByTokenHash", sessionTokenHash });
      return authSession;
    },
    async findActiveSchoolMembershipByUserAndSchoolId(userId, schoolId) {
      calls.push({ method: "findActiveSchoolMembershipByUserAndSchoolId", userId, schoolId });
      return authSession ? { userId, schoolId, role: "admissions", status: "active" } : null;
    },
  };

  return {
    calls,
    handlers: createSchoolPortalHttpHandlers(new SchoolPortalService(repository), authRepository, authRepository),
  };
}

test("school portal HTTP queue uses tenant from session and ignores query schoolId", async () => {
  const { handlers, calls } = createHandlers();
  const response = await handlers.listApplications(
    new Request("https://cuac.test/api/v1/school/applications?schoolId=school-2", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=school-token` },
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data[0].schoolId, "school-1");
  assert.equal(calls[0].sessionTokenHash, hashSessionToken("school-token"));
  assert.deepEqual(calls[1], { method: "findActiveSchoolMembershipByUserAndSchoolId", userId: "staff-1", schoolId: "school-1" });
  assert.deepEqual(calls[2], { method: "listApplicationQueueBySchoolId", schoolId: "school-1", cuacId: undefined });
});

test("school portal HTTP forwards an exact CUAC ID inside the authenticated tenant", async () => {
  const { handlers, calls } = createHandlers();
  const response = await handlers.listApplications(
    new Request("https://cuac.test/api/v1/school/applications?cuacId=CUAC-2026-004218", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=school-token` },
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls[2], {
    method: "listApplicationQueueBySchoolId",
    schoolId: "school-1",
    cuacId: "CUAC-2026-004218",
  });
});

test("school portal HTTP rejects malformed CUAC ID before application repository access", async () => {
  const { handlers, calls } = createHandlers();
  const response = await handlers.listApplications(
    new Request("https://cuac.test/api/v1/school/applications?cuacId=cuac-2026-4218", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=school-token` },
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error.code, "BAD_REQUEST");
  assert.equal(calls.some((call) => call.method === "listApplicationQueueBySchoolId"), false);
});

test("school portal HTTP rejects guest before repository access", async () => {
  const { handlers, calls } = createHandlers(null);
  const response = await handlers.listApplications(new Request("https://cuac.test/api/v1/school/applications"));
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.error.code, "FORBIDDEN");
  assert.deepEqual(calls, []);
});

test("school portal HTTP rejects school session when active membership is missing", async () => {
  const calls = [];
  const authRepository = {
    async findActiveSessionByTokenHash(sessionTokenHash) {
      calls.push({ method: "findActiveSessionByTokenHash", sessionTokenHash });
      return schoolSession;
    },
    async findActiveSchoolMembershipByUserAndSchoolId(userId, schoolId) {
      calls.push({ method: "findActiveSchoolMembershipByUserAndSchoolId", userId, schoolId });
      return null;
    },
  };
  const guardedHandlers = createSchoolPortalHttpHandlers(
    new SchoolPortalService({
      async listApplicationQueueBySchoolId(schoolId) {
        calls.push({ method: "listApplicationQueueBySchoolId", schoolId });
        return [];
      },
      async getApplicationById(applicationId) {
        calls.push({ method: "getApplicationById", applicationId });
        return null;
      },
    }),
    authRepository,
    authRepository,
  );

  const response = await guardedHandlers.listApplications(
    new Request("https://cuac.test/api/v1/school/applications", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=school-token` },
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.error.code, "FORBIDDEN");
  assert.equal(calls.some((call) => call.method === "listApplicationQueueBySchoolId"), false);
});

test("school portal HTTP detail uses route application id only", async () => {
  const { handlers, calls } = createHandlers();
  const response = await handlers.getApplication(
    new Request(`https://cuac.test/api/v1/school/applications/${APP_1}?applicationId=${APP_2}`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=school-token` },
    }),
    APP_1,
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.id, APP_1);
  assert.deepEqual(calls[2], { method: "getApplicationById", applicationId: APP_1 });
});

test("school portal HTTP status route derives tenant and actor while requiring idempotency", async () => {
  const { handlers, calls } = createHandlers();
  const response = await handlers.updateApplicationStatus(new Request(`https://cuac.test/api/v1/school/applications/${APP_1}/status`, {
    method: "PATCH",
    headers: { cookie: `${SESSION_COOKIE_NAME}=school-token`, "content-type": "application/json",
      "idempotency-key": "school-http-status-0001" },
    body: JSON.stringify({ expectedRevision: 1, status: "needs_review" }),
  }), APP_1);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.data.status, "needs_review");
  const call = calls.find((entry) => entry.method === "updateApplicationStatus");
  assert.equal(call.input.applicationId, APP_1);
  assert.equal(call.input.schoolId, "school-1");
  assert.equal(call.input.actorUserId, "staff-1");
  assert.match(call.input.keyHash, /^[a-f0-9]{64}$/);

  const missingKey = await handlers.updateApplicationStatus(new Request(`https://cuac.test/api/v1/school/applications/${APP_1}/status`, {
    method: "PATCH", headers: { cookie: `${SESSION_COOKIE_NAME}=school-token`, "content-type": "application/json" },
    body: JSON.stringify({ expectedRevision: 1, status: "needs_review" }),
  }), APP_1);
  assert.equal(missingKey.status, 400);
});

test("school portal HTTP contact route rejects forged authority fields before repository write", async () => {
  const { handlers, calls } = createHandlers();
  const response = await handlers.recordApplicationContact(new Request(`https://cuac.test/api/v1/school/applications/${APP_1}/contact-logs`, {
    method: "POST",
    headers: { cookie: `${SESSION_COOKIE_NAME}=school-token`, "content-type": "application/json",
      "idempotency-key": "school-http-contact-001" },
    body: JSON.stringify({ channel: "email", direction: "outbound", outcome: "reached", note: "Sent",
      tenantSchoolId: "school-2" }),
  }), APP_1);
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error.code, "BAD_REQUEST");
  assert.equal(calls.some((entry) => entry.method === "recordApplicationContact"), false);
});

test("school portal app route files stay thin and do not read demo data directly", async () => {
  const routePaths = [
    "../../../app/api/v1/school/applications/route.ts",
    "../../../app/api/v1/school/applications/[applicationId]/route.ts",
    "../../../app/api/v1/school/applications/[applicationId]/status/route.ts",
    "../../../app/api/v1/school/applications/[applicationId]/contact-logs/route.ts",
  ];

  const contents = await Promise.all(routePaths.map((routePath) => readFile(new URL(routePath, import.meta.url), "utf8")));

  contents.forEach((source) => {
    assert.match(source, /getSchoolPortalRouteHandlers/);
    assert.doesNotMatch(source, /cuac-data|public\/|design-lab|db\/schema|select\s+\*/i);
  });
});
