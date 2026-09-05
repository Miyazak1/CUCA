import assert from "node:assert/strict";
import test from "node:test";
import { buildAuditEvent, createRequestContext, redactSensitive } from "../../../src/server/index.ts";

test("redacts sensitive object keys and PAN-like strings", () => {
  const redacted = redactSensitive({
    email: "student@example.com",
    password: "secret-pass",
    headers: {
      authorization: "Bearer token",
    },
    note: "card 4242 4242 4242 4242 should not appear",
    nested: [{ cvv: "123", safe: "ok" }],
  });

  assert.equal(redacted.email, "student@example.com");
  assert.equal(redacted.password, "[REDACTED]");
  assert.equal(redacted.headers.authorization, "[REDACTED]");
  assert.equal(redacted.note, "card [REDACTED_PAN] should not appear");
  assert.equal(redacted.nested[0].cvv, "[REDACTED]");
  assert.equal(redacted.nested[0].safe, "ok");
});

test("preserves canonical UUID audit references even when their digits resemble a PAN", () => {
  const id = "12345678-1234-4234-8234-123456789012";
  assert.equal(redactSensitive(id), id);
  assert.equal(
    redactSensitive("card 4242 4242 4242 4242 should still disappear"),
    "card [REDACTED_PAN] should still disappear",
  );
});

test("audit event inherits request context and redacts metadata", () => {
  const context = createRequestContext({
    requestId: "req_1",
    activeRole: "student",
    actorUserId: "student_1",
    selectedSurface: "student",
  });

  const event = buildAuditEvent(context, {
    action: "application.update",
    resourceType: "application_set",
    resourceId: "app_1",
    allowed: true,
    policyDecisionId: "decision_1",
    dataClasses: ["education_record"],
    metadata: {
      token: "abc",
      comment: "safe",
    },
  });

  assert.equal(event.requestId, "req_1");
  assert.equal(event.actorUserId, "student_1");
  assert.equal(event.activeRole, "student");
  assert.deepEqual(event.metadata, {
    token: "[REDACTED]",
    comment: "safe",
  });
});
