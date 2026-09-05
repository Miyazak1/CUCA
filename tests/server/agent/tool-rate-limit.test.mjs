import assert from "node:assert/strict";
import test from "node:test";
import {
  AgentToolRateLimitService,
  PostgresAgentToolRateLimitStore,
  createAgentToolRateLimitKey,
  createRequestContext,
  getPublicAgentToolDefinition,
} from "../../../src/server/index.ts";

const guest = createRequestContext({ guestSessionId: `sha256:${"a".repeat(64)}`, purpose: "agent_tool" });
const student = createRequestContext({ actorUserId: "a1111111-a111-4111-8111-a11111111111", activeRole: "student",
  selectedSurface: "student", purpose: "agent_tool" });

test("Agent tool rate keys isolate persona owner and tool without exposing identifiers", () => {
  const guestPrograms = createAgentToolRateLimitKey(guest, "catalog.search_programs");
  const guestSchools = createAgentToolRateLimitKey(guest, "catalog.search_schools");
  const studentPrograms = createAgentToolRateLimitKey(student, "catalog.search_programs");
  assert.match(guestPrograms, /^sha256:[a-f0-9]{64}$/);
  assert.notEqual(guestPrograms, guestSchools);
  assert.notEqual(guestPrograms, studentPrograms);
  assert.doesNotMatch(JSON.stringify([guestPrograms, guestSchools, studentPrograms]), /a1111111|sha256:aaaa/);
  assert.throws(() => createAgentToolRateLimitKey({ ...guest, guestSessionId: null }, "catalog.search_programs"), error => error.status === 400);
});

test("Agent tool limiter applies the registered rule and exposes only bounded retry metadata", async () => {
  const calls = [];
  const definition = getPublicAgentToolDefinition("catalog.search_programs");
  const limiter = new AgentToolRateLimitService({ async consume(input) {
    calls.push(input);
    return { allowed: false, attemptCount: 31, remaining: 0, resetAt: new Date("2026-09-01T12:01:00Z"), retryAfterSeconds: 22 };
  } });
  await assert.rejects(limiter.assertAllowed(guest, definition), error => error.status === 429
    && error.details.toolKey === "catalog.search_programs" && error.details.retryAfterSeconds === 22);
  assert.equal(calls[0].rule.maxCalls, 30);
  assert.match(calls[0].keyHash, /^sha256:[a-f0-9]{64}$/);
});

test("PostgreSQL Agent limiter uses database time and one atomic fixed-window upsert", async () => {
  const calls = [];
  const store = new PostgresAgentToolRateLimitStore({ async query(statement, params) {
    calls.push({ statement, params });
    return [{ attemptCount: 3, expiresAt: new Date("2026-09-01T12:01:00Z"), retryAfterSeconds: 17 }];
  } });
  const result = await store.consume({ toolKey: "catalog.search_programs", keyHash: `sha256:${"b".repeat(64)}`,
    rule: { maxCalls: 30, windowSeconds: 60 } });
  assert.deepEqual(result, { allowed: true, attemptCount: 3, remaining: 27,
    resetAt: new Date("2026-09-01T12:01:00Z"), retryAfterSeconds: 17 });
  assert.match(calls[0].statement, /clock_timestamp\(\)/);
  assert.match(calls[0].statement, /insert into agent_tool_rate_limit_buckets/);
  assert.match(calls[0].statement, /on conflict \(tool_key, key_hash, window_start\) do update/);
  assert.match(calls[0].statement, /least\(agent_tool_rate_limit_buckets\.attempt_count \+ 1, 2147483647\)/);
  assert.doesNotMatch(calls[0].statement, /select \*|user_id|guest_session|email|cookie|token|password|card_number|cvv/i);
  assert.deepEqual(calls[0].params, ["catalog.search_programs", `sha256:${"b".repeat(64)}`, 60]);
});
