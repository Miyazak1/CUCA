import assert from "node:assert/strict";
import test from "node:test";
import { createStudentFileHttpHandlers, SESSION_COOKIE_NAME } from "../../../src/server/index.ts";

const session = {
  userId: "aa111111-1111-4111-8111-111111111111",
  selectedSurface: "student",
  activeRole: "student",
  tenantSchoolId: null,
  authStrength: "session",
  expiresAt: new Date("2026-09-29T00:00:00.000Z"),
  revokedAt: null,
  accountStatus: "active",
};

test("student file HTTP upload intent derives authority from session and forwards idempotency", async () => {
  const calls = [];
  const service = {
    async createUploadIntent(context, input, key) { calls.push({ context, input, key }); return { file: { id: "file-1" }, upload: null }; },
    async listOwn() { return []; }, async completeUpload() {}, async createDownload() {}, async requestDelete() {},
  };
  const handlers = createStudentFileHttpHandlers(service, { async findActiveSessionByTokenHash() { return session; } });
  const response = await handlers.createUploadIntent(new Request("https://cuac.test/api/v1/student/files", {
    method: "POST",
    headers: { cookie: `${SESSION_COOKIE_NAME}=student-token`, "idempotency-key": "file_upload_123456" },
    body: JSON.stringify({ category: "transcript" }),
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(calls[0].context.actorUserId, session.userId);
  assert.equal(calls[0].context.purpose, "student_action");
  assert.equal(calls[0].key, "file_upload_123456");
  assert.deepEqual(calls[0].input, { category: "transcript" });
});

test("student file HTTP boundary rejects malformed JSON before service execution", async () => {
  let called = false;
  const service = {
    async createUploadIntent() { called = true; }, async listOwn() {}, async completeUpload() {}, async createDownload() {}, async requestDelete() {},
  };
  const handlers = createStudentFileHttpHandlers(service, { async findActiveSessionByTokenHash() { return session; } });
  const response = await handlers.createUploadIntent(new Request("https://cuac.test/api/v1/student/files", {
    method: "POST", headers: { cookie: `${SESSION_COOKIE_NAME}=student-token` }, body: "{",
  }));
  assert.equal(response.status, 400);
  assert.equal(called, false);
  assert.equal((await response.json()).error.code, "BAD_REQUEST");
});
