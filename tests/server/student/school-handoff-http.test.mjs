import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createSchoolHandoffHttpHandlers } from "../../../src/server/student/school-handoff-http.ts";

const SET_ID = "11111111-1111-4111-8111-111111111111";
const studentSession = {
  userId: "22222222-2222-4222-8222-222222222222",
  selectedSurface: "student",
  activeRole: "student",
  tenantSchoolId: null,
  authStrength: "step_up",
  expiresAt: new Date("2026-09-30T00:00:00.000Z"),
  revokedAt: null,
  accountStatus: "active",
};

test("school handoff HTTP binds the authenticated student and returns a current-release receipt", async () => {
  const calls = [];
  const handlers = createSchoolHandoffHttpHandlers({
    async handoff(context, applicationSetId, input) {
      calls.push({ context, applicationSetId, input });
      return { applicationSetId, status: "accepted", handoffScope: "school_contact",
        materialsShared: false, paymentRequired: false, programApplications: [] };
    },
    async getProgress() { throw new Error("unused"); },
  }, { async findActiveSessionByTokenHash() { return studentSession; } });
  const response = await handlers.handoff(new Request(`https://cuac.test/api/v1/student/application-sets/${SET_ID}/school-handoff`, {
    method: "POST", headers: { cookie: "cuac_session=test-token", "content-type": "application/json" },
    body: JSON.stringify({ expectedRevision: 4, choiceIds: [], confirmHandoff: true }),
  }), SET_ID);
  assert.equal(response.status, 201);
  assert.equal((await response.json()).data.paymentRequired, false);
  assert.equal(calls[0].context.actorUserId, studentSession.userId);
  assert.equal(calls[0].applicationSetId, SET_ID);
});

test("school progress HTTP returns only the student's bounded progress projection", async () => {
  const handlers = createSchoolHandoffHttpHandlers({
    async handoff() { throw new Error("unused"); },
    async getProgress(context, applicationSetId) {
      return { applicationSetId, items: [{ schoolApplicationId: "app-1", applicationChoiceId: "choice-1",
        schoolId: "school-1", programId: "program-1", programIntakeId: "intake-1", status: "contacted",
        schoolRevision: 2, statusChangedAt: new Date("2026-09-14T00:00:00Z"), submittedAt: new Date("2026-09-13T00:00:00Z") }] };
    },
  }, { async findActiveSessionByTokenHash() { return { ...studentSession, authStrength: "session" }; } });
  const response = await handlers.getProgress(new Request(`https://cuac.test/api/v1/student/application-sets/${SET_ID}/school-progress`, {
    headers: { cookie: "cuac_session=test-token" },
  }), SET_ID);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.data.items[0].status, "contacted");
  assert.deepEqual(Object.keys(body.data.items[0]).sort(), ["applicationChoiceId", "programId", "programIntakeId",
    "schoolApplicationId", "schoolId", "schoolRevision", "status", "statusChangedAt", "submittedAt"].sort());
});

test("school handoff app routes stay thin and preserve the official submission route", async () => {
  const [handoff, progress, official] = await Promise.all([
    readFile(new URL("../../../app/api/v1/student/application-sets/[applicationSetId]/school-handoff/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../app/api/v1/student/application-sets/[applicationSetId]/school-progress/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../app/api/v1/student/application-sets/[applicationSetId]/submit/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(handoff, /getSchoolHandoffHttpHandlers/);
  assert.match(progress, /getSchoolHandoffHttpHandlers/);
  assert.match(official, /getApplicationSubmissionHttpHandler/);
  for (const source of [handoff, progress]) assert.doesNotMatch(source, /school_applications|application_sets|select\s|insert\s/i);
});
