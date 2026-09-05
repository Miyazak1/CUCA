import assert from "node:assert/strict";
import test from "node:test";
import "./workflow.test.mjs";
import { CuacError, createRequestContext, SchoolPortalService } from "../../../src/server/index.ts";

const APP_1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const APP_2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function createRepository(overrides = {}) {
  const calls = [];
  return {
    calls,
    repository: {
      async listApplicationQueueBySchoolId(schoolId) {
        calls.push({ method: "listApplicationQueueBySchoolId", schoolId });
        return [{ id: "app-1", schoolId, studentUserId: "student-1", programId: "program-1", status: "submitted", submittedAt: null, firstViewedAt: null, schoolVisibleProfile: {}, routingMetadata: {} }];
      },
      async getApplicationById(applicationId) {
        calls.push({ method: "getApplicationById", applicationId });
        return { id: applicationId, schoolId: "school-1", studentUserId: "student-1", programId: "program-1", status: "submitted", submittedAt: null, firstViewedAt: null, schoolVisibleProfile: {}, routingMetadata: {}, statusEvents: [] };
      },
      ...overrides,
    },
  };
}

test("school portal service lists queue only for tenant from request context", async () => {
  const { repository, calls } = createRepository();
  const service = new SchoolPortalService(repository);
  const context = createRequestContext({ activeRole: "school_staff", actorUserId: "staff-1", tenantSchoolId: "school-1" });

  const queue = await service.listTenantApplicationQueue(context);

  assert.equal(queue[0].schoolId, "school-1");
  assert.deepEqual(calls, [{ method: "listApplicationQueueBySchoolId", schoolId: "school-1" }]);
});

test("school portal service audits queue reads without raw projection payloads", async () => {
  const { repository } = createRepository({
    async listApplicationQueueBySchoolId(schoolId) {
      return [
        {
          id: "app-1",
          schoolId,
          studentUserId: "student-1",
          programId: "program-1",
          status: "submitted",
          submittedAt: null,
          firstViewedAt: null,
          schoolVisibleProfile: { displayName: "Private Student Name", email: "student@example.test" },
          routingMetadata: { reviewerHint: "private routing note" },
        },
      ];
    },
  });
  const auditEvents = [];
  const service = new SchoolPortalService(repository, {
    async record(event) {
      auditEvents.push(event);
    },
  });
  const context = createRequestContext({
    requestId: "req-school-audit-1",
    activeRole: "school_staff",
    actorUserId: "staff-1",
    tenantSchoolId: "school-1",
    policyDecisionId: "policy-school-1",
  });

  await service.listTenantApplicationQueue(context);

  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0].action, "school.application_queue.list");
  assert.equal(auditEvents[0].resourceType, "school_application_queue");
  assert.equal(auditEvents[0].resourceId, "school-1");
  assert.equal(auditEvents[0].tenantSchoolId, "school-1");
  assert.deepEqual(auditEvents[0].dataClasses, ["tenant_confidential", "education_record"]);
  assert.deepEqual(auditEvents[0].metadata, {
    schoolId: "school-1",
    filteredByCuacId: false,
    resultCount: 1,
  });

  const serializedEvent = JSON.stringify(auditEvents[0]);
  assert.equal(serializedEvent.includes("Private Student Name"), false);
  assert.equal(serializedEvent.includes("student@example.test"), false);
  assert.equal(serializedEvent.includes("private routing note"), false);
});

test("school portal service denies guests and students before repository access", async () => {
  for (const context of [createRequestContext(), createRequestContext({ activeRole: "student", actorUserId: "student-1" }), createRequestContext({ activeRole: "school_staff", tenantSchoolId: "school-1" })]) {
    const { repository, calls } = createRepository();
    const service = new SchoolPortalService(repository);

    await assert.rejects(() => service.listTenantApplicationQueue(context), CuacError);
    assert.deepEqual(calls, []);
  }
});

test("school portal service denies cross-tenant application detail", async () => {
  const { repository } = createRepository({
    async getApplicationById(applicationId) {
      return { id: applicationId, schoolId: "school-2", studentUserId: "student-1", programId: null, status: "submitted", submittedAt: null, firstViewedAt: null, schoolVisibleProfile: {}, routingMetadata: {}, statusEvents: [] };
    },
  });
  const service = new SchoolPortalService(repository);
  const context = createRequestContext({ activeRole: "school_staff", actorUserId: "staff-1", tenantSchoolId: "school-1" });

  await assert.rejects(() => service.getTenantApplication(context, APP_2), (error) => error instanceof CuacError && error.code === "FORBIDDEN");
});

test("school portal service audits detail projection reads without raw applicant payloads", async () => {
  const { repository } = createRepository({
    async getApplicationById(applicationId) {
      return {
        id: applicationId,
        schoolId: "school-1",
        studentUserId: "student-1",
        programId: "program-1",
        status: "submitted",
        submittedAt: null,
        firstViewedAt: null,
        schoolVisibleProfile: { displayName: "Private Detail Name", phone: "+1 555 private" },
        routingMetadata: { internalFitNote: "private fit note" },
        statusEvents: [
          { id: "event-1", schoolApplicationId: applicationId, actorUserId: null, fromStatus: null, toStatus: "submitted", reason: "private reason", createdAt: new Date("2026-08-28T00:00:00.000Z") },
        ],
      };
    },
  });
  const auditEvents = [];
  const service = new SchoolPortalService(repository, {
    async record(event) {
      auditEvents.push(event);
    },
  });
  const context = createRequestContext({
    requestId: "req-school-audit-2",
    activeRole: "school_staff",
    actorUserId: "staff-1",
    tenantSchoolId: "school-1",
    policyDecisionId: "policy-school-2",
  });

  await service.getTenantApplication(context, APP_1);

  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0].action, "school.application.read_projection");
  assert.equal(auditEvents[0].resourceType, "school_application");
  assert.equal(auditEvents[0].resourceId, APP_1);
  assert.deepEqual(auditEvents[0].metadata, {
    schoolId: "school-1",
    status: "submitted",
    hasProgramId: true,
    statusEventCount: 1,
  });

  const serializedEvent = JSON.stringify(auditEvents[0]);
  assert.equal(serializedEvent.includes("Private Detail Name"), false);
  assert.equal(serializedEvent.includes("+1 555 private"), false);
  assert.equal(serializedEvent.includes("private fit note"), false);
  assert.equal(serializedEvent.includes("private reason"), false);
});

test("school portal service changes one tenant application with strict context and metadata-only audit", async () => {
  const calls = [];
  const auditEvents = [];
  const notificationEvents = [];
  const service = new SchoolPortalService({
    async listApplicationQueueBySchoolId() { return []; },
    async getApplicationById() { return null; },
    async updateApplicationStatus(input) {
      calls.push(input);
      return {
        changed: true,
        fromStatus: "new",
        recipientStudentUserId: "student-1",
        recipientApplicationSetId: "22222222-2222-4222-8222-222222222222",
        result: {
          id: input.applicationId,
          schoolId: input.schoolId,
          status: input.command.status,
          schoolRevision: 2,
          statusChangedAt: new Date("2026-09-02T00:00:00.000Z"),
          statusEventId: "33333333-3333-4333-8333-333333333333",
        },
      };
    },
    async recordApplicationContact() { throw new Error("not used"); },
  }, { async record(event) { auditEvents.push(event); } }, {
    async publish(event) {
      notificationEvents.push(event);
      return { eventId: "44444444-4444-4444-8444-444444444444", created: true };
    },
  });
  const context = createRequestContext({
    activeRole: "school_staff", actorUserId: "staff-1", tenantSchoolId: "school-1",
    selectedSurface: "school", purpose: "school_review", authStrength: "session",
  });

  const result = await service.updateTenantApplicationStatus(context, APP_1,
    { expectedRevision: 1, status: "not_a_fit", reason: "Program prerequisite was not met." },
    { idempotencyKey: "school-status-key-0001" });

  assert.equal(result.status, "not_a_fit");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].schoolId, "school-1");
  assert.equal(calls[0].actorUserId, "staff-1");
  assert.match(calls[0].keyHash, /^[a-f0-9]{64}$/);
  assert.match(calls[0].requestHash, /^[a-f0-9]{64}$/);
  assert.equal(auditEvents.length, 1);
  assert.equal(notificationEvents.length, 1);
  assert.deepEqual(notificationEvents[0].variables, { applicationSetId: "22222222-2222-4222-8222-222222222222" });
  assert.equal(notificationEvents[0].templates[0].actionPathTemplate, "/application.html?applicationSet={{applicationSetId}}");
  assert.deepEqual(auditEvents[0].metadata, {
    schoolId: "school-1", fromStatus: "new", toStatus: "not_a_fit", schoolRevision: 2, hasReason: true,
    notificationCreated: true,
  });
  assert.equal(JSON.stringify(auditEvents[0]).includes("Program prerequisite was not met."), false);
});

test("school portal service records tenant contact without putting the note in audit", async () => {
  const auditEvents = [];
  const service = new SchoolPortalService({
    async listApplicationQueueBySchoolId() { return []; },
    async getApplicationById() { return null; },
    async updateApplicationStatus() { throw new Error("not used"); },
    async recordApplicationContact(input) {
      return { created: true, contact: { id: "44444444-4444-4444-8444-444444444444",
        schoolApplicationId: input.applicationId, actorUserId: input.actorUserId,
        ...input.command, createdAt: new Date("2026-09-02T00:00:00.000Z") } };
    },
  }, { async record(event) { auditEvents.push(event); } });
  const context = createRequestContext({
    activeRole: "school_staff", actorUserId: "staff-1", tenantSchoolId: "school-1",
    selectedSurface: "school", purpose: "school_review", authStrength: "session",
  });

  const contact = await service.recordTenantApplicationContact(context, APP_1,
    { channel: "email", direction: "outbound", outcome: "follow_up_required", note: "Private document request details." },
    { idempotencyKey: "school-contact-key-001" });

  assert.equal(contact.outcome, "follow_up_required");
  assert.equal(auditEvents.length, 1);
  assert.deepEqual(auditEvents[0].metadata, {
    schoolId: "school-1", schoolApplicationId: APP_1, channel: "email",
    direction: "outbound", outcome: "follow_up_required",
  });
  assert.equal(JSON.stringify(auditEvents[0]).includes("Private document request details."), false);
});

test("school workflow service denies an inexact surface before repository mutation", async () => {
  let called = false;
  const service = new SchoolPortalService({
    async listApplicationQueueBySchoolId() { return []; },
    async getApplicationById() { return null; },
    async updateApplicationStatus() { called = true; throw new Error("unexpected"); },
    async recordApplicationContact() { called = true; throw new Error("unexpected"); },
  });
  const context = createRequestContext({
    activeRole: "school_staff", actorUserId: "staff-1", tenantSchoolId: "school-1",
    selectedSurface: "public", purpose: "school_review", authStrength: "session",
  });
  await assert.rejects(() => service.updateTenantApplicationStatus(context, APP_1,
    { expectedRevision: 1, status: "needs_review", reason: null }, { idempotencyKey: "school-status-key-0002" }),
  (error) => error instanceof CuacError && error.code === "FORBIDDEN");
  assert.equal(called, false);
});
