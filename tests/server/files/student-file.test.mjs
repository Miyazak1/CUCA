import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizeStudentFile,
  createRequestContext,
  parseStudentFileUploadInput,
  privateStudentObjectKey,
  studentFileCommandDigests,
} from "../../../src/server/index.ts";

const valid = {
  category: "transcript",
  filename: "grade-12.pdf",
  contentType: "application/pdf",
  sizeBytes: 1024,
  sha256: "a".repeat(64),
};

test("student file input accepts only bounded reviewed metadata", () => {
  assert.deepEqual(parseStudentFileUploadInput(valid), valid);
  for (const input of [
    { ...valid, filename: "../grade-12.pdf" },
    { ...valid, filename: "folder\\grade-12.pdf" },
    { ...valid, filename: " grade-12.pdf" },
    { ...valid, contentType: "application/zip" },
    { ...valid, sha256: "A".repeat(64) },
    { ...valid, sizeBytes: 25 * 1024 * 1024 + 1 },
    { ...valid, ownerUserId: "attacker" },
  ]) assert.throws(() => parseStudentFileUploadInput(input), error => error?.code === "BAD_REQUEST");
});

test("student file keys are opaque and idempotency digests do not expose the key", () => {
  const id = "aa111111-1111-4111-8111-111111111111";
  assert.equal(privateStudentObjectKey(id), `private/student-files/aa/${id}`);
  const digests = studentFileCommandDigests(valid, "upload_command_123456");
  assert.match(digests.idempotencyKeyHash, /^[a-f0-9]{64}$/);
  assert.match(digests.requestSha256, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(digests), /upload_command/);
});

test("student file authority requires the exact student preparation context", () => {
  const allowed = createRequestContext({
    actorUserId: "aa111111-1111-4111-8111-111111111111",
    activeRole: "student",
    selectedSurface: "student",
    purpose: "student_action",
    tenantSchoolId: null,
    authStrength: "session",
  });
  assert.equal(authorizeStudentFile(allowed), allowed.actorUserId);
  for (const context of [
    { ...allowed, activeRole: "cuac_admin" },
    { ...allowed, purpose: "agent_tool" },
    { ...allowed, selectedSurface: "ops" },
    { ...allowed, tenantSchoolId: "bb111111-1111-4111-8111-111111111111" },
  ]) assert.throws(() => authorizeStudentFile(context), error => error?.code === "FORBIDDEN");
});
