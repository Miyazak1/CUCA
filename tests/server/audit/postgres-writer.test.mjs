import assert from "node:assert/strict";
import test from "node:test";
import { buildAuditEvent, createRequestContext, PostgresAuditWriter } from "../../../src/server/index.ts";

test("Postgres audit writer inserts audit logs with fixed parameterized SQL", async () => {
  const calls = [];
  const writer = new PostgresAuditWriter({
    async query(statement, params) {
      calls.push({ statement, params });
      return [];
    },
  });
  const context = createRequestContext({
    requestId: "request-1",
    actorUserId: "student-1",
    activeRole: "student",
    policyDecisionId: "policy-1",
  });
  const event = buildAuditEvent(context, {
    action: "agent.memory.carry_forward",
    resourceType: "agent_memory_entry",
    resourceId: "memory-1",
    allowed: true,
    policyDecisionId: "policy-1",
    dataClasses: ["low_sensitive_preference"],
    metadata: {
      memoryNamespace: "user:student-1:student",
      token: "secret-token",
      cardNumber: "4111111111111111",
    },
  });

  await writer.record(event);

  assert.equal(calls.length, 1);
  assert.match(calls[0].statement, /insert into audit_logs/);
  assert.match(calls[0].statement, /request_id, actor_user_id, actor_type, active_role, tenant_school_id/);
  assert.match(calls[0].statement, /data_classes, redaction_applied, metadata_json/);
  assert.match(calls[0].statement, /\$11::jsonb/);
  assert.match(calls[0].statement, /\$13::jsonb/);
  assert.doesNotMatch(calls[0].statement, /select \*/i);
  assert.doesNotMatch(calls[0].statement, /agent_messages|agent_conversations|payments|student_profiles/i);
  assert.deepEqual(calls[0].params.slice(0, 10), [
    "request-1",
    "student-1",
    "user",
    "student",
    null,
    "agent.memory.carry_forward",
    "agent_memory_entry",
    "memory-1",
    true,
    "policy-1",
  ]);
  assert.equal(calls[0].params[10], JSON.stringify(["low_sensitive_preference"]));
  assert.equal(calls[0].params[11], true);
  assert.equal(calls[0].params[12], JSON.stringify(event.metadata));
  assert.doesNotMatch(calls[0].params[12], /secret-token|4111111111111111/);
});

test("Postgres audit writer marks unauthenticated events as guest actor type", async () => {
  const calls = [];
  const writer = new PostgresAuditWriter({
    async query(statement, params) {
      calls.push({ statement, params });
      return [];
    },
  });
  const event = buildAuditEvent(createRequestContext({ requestId: "request-guest" }), {
    action: "agent.context_candidate.create",
    resourceType: "agent_context_candidate",
    resourceId: null,
    allowed: false,
    policyDecisionId: null,
    dataClasses: ["payment_sensitive"],
    metadata: { deniedReason: "Sensitive data class rejected." },
  });

  await writer.record(event);

  assert.equal(calls[0].params[0], "request-guest");
  assert.equal(calls[0].params[1], null);
  assert.equal(calls[0].params[2], "guest");
  assert.equal(calls[0].params[8], false);
  assert.equal(calls[0].params[10], JSON.stringify(["payment_sensitive"]));
});
