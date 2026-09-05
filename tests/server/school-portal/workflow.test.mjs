import assert from "node:assert/strict";
import test from "node:test";
import {
  CuacError,
  canTransitionSchoolApplication,
  parseSchoolApplicationContactCommand,
  parseSchoolApplicationStatusCommand,
  schoolWorkflowCommandDigests,
} from "../../../src/server/index.ts";

test("school application workflow admits only reviewed forward transitions", () => {
  assert.equal(canTransitionSchoolApplication("new", "needs_review"), true);
  assert.equal(canTransitionSchoolApplication("new", "contacted"), true);
  assert.equal(canTransitionSchoolApplication("contacted", "waiting_for_documents"), true);
  assert.equal(canTransitionSchoolApplication("waiting_for_documents", "documents_received_by_school"), true);
  assert.equal(canTransitionSchoolApplication("documents_received_by_school", "converted_to_official_application"), true);
  assert.equal(canTransitionSchoolApplication("contacted", "new"), false);
  assert.equal(canTransitionSchoolApplication("not_a_fit", "needs_review"), false);
  assert.equal(canTransitionSchoolApplication("pending_submission", "needs_review"), false);
});

test("school status and contact commands reject authority fields, malformed values and unreasoned closure", () => {
  assert.deepEqual(parseSchoolApplicationStatusCommand({ expectedRevision: 1, status: "needs_review" }),
    { expectedRevision: 1, status: "needs_review", reason: null });
  assert.throws(() => parseSchoolApplicationStatusCommand({ expectedRevision: 1, status: "not_a_fit" }), CuacError);
  assert.throws(() => parseSchoolApplicationStatusCommand({ expectedRevision: 1, status: "new" }), CuacError);
  assert.throws(() => parseSchoolApplicationStatusCommand({ expectedRevision: 1, status: "contacted", schoolId: "forged" }), CuacError);
  assert.throws(() => parseSchoolApplicationContactCommand({ channel: "email", direction: "outbound", outcome: "reached", note: "" }), CuacError);
  assert.throws(() => parseSchoolApplicationContactCommand({ channel: "sms", direction: "outbound", outcome: "reached", note: "Sent" }), CuacError);
});

test("school workflow idempotency digests bind operation and normalized command without exposing the key", () => {
  const command = parseSchoolApplicationStatusCommand({ expectedRevision: 4, status: "contacted", reason: "Reached by phone" });
  const first = schoolWorkflowCommandDigests("status.change", command, "school-command-key-0001");
  const same = schoolWorkflowCommandDigests("status.change", command, "school-command-key-0001");
  const different = schoolWorkflowCommandDigests("status.change", { ...command, status: "not_a_fit" }, "school-command-key-0001");
  assert.deepEqual(first, same);
  assert.notEqual(first.requestHash, different.requestHash);
  assert.match(first.keyHash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(first).includes("school-command-key-0001"), false);
  assert.throws(() => schoolWorkflowCommandDigests("status.change", command, "short"), CuacError);
});
