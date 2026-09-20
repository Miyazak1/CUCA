import assert from "node:assert/strict";
import test from "node:test";
import { PostgresRetentionProcessor } from "../../../src/server/retention/postgres-retention.ts";

function fakeClient(handler) {
  const calls = [];
  const scoped = {
    async query(statement, params) {
      const normalized = statement.replace(/\s+/g, " ").trim();
      calls.push({ statement: normalized, params });
      return handler(normalized, params, calls);
    },
    async transaction(work) { return work(scoped); },
  };
  return { client: scoped, calls };
}

test("retention processor rejects unsafe batch sizes", async () => {
  const { client } = fakeClient(() => []);
  const processor = new PostgresRetentionProcessor(client);
  for (const value of [0, 501, 1.5, Number.NaN]) {
    await assert.rejects(processor.processBatch(value), /batch limit is invalid/);
  }
});

test("retention processor uses bounded skip-locked deletes and records aggregate audit", async () => {
  const { client, calls } = fakeClient(statement => {
    if (statement.startsWith("select c.id,c.user_id") && statement.includes("guardian_consent_requests")) {
      return [{ id: "guardian-1", userId: "user-1" }];
    }
    if (statement.startsWith("update guardian_consent_requests")) {
      return [{ id: "guardian-1", userId: "user-1" }];
    }
    if (statement.startsWith("with candidates") && (statement.includes("returning q.id")
      || statement.includes("returning s.id") || statement.includes("returning target.id"))) {
      return [{ id: "row-1" }];
    }
    return [];
  });
  const result = await new PostgresRetentionProcessor(client).processBatch(25);
  assert.equal(result.guardianRegistrationsExpired, 1);
  assert.equal(result.processed, 11);
  const sql = calls.map(call => call.statement).join("\n");
  for (const table of ["auth_email_outbox", "email_verification_challenges", "password_reset_challenges",
    "school_staff_invites", "auth_sessions", "sign_in_continuations", "auth_mfa_challenges",
    "auth_rate_limit_buckets"]) assert.match(sql, new RegExp(table));
  assert.match(sql, /for update skip locked/);
  assert.match(sql, /interval '1 day'/);
  assert.match(sql, /interval '30 days'/);
  assert.match(sql, /interval '180 days'/);
  assert.match(sql, /retention\.batch\.completed/);
  assert.ok(calls.filter(call => call.statement.startsWith("with candidates")).every(call => call.params[0] === 25));
});

test("empty retention pass does not create a misleading audit event", async () => {
  const { client, calls } = fakeClient(() => []);
  const result = await new PostgresRetentionProcessor(client).processBatch(100);
  assert.equal(result.processed, 0);
  assert.doesNotMatch(calls.map(call => call.statement).join("\n"), /retention\.batch\.completed/);
});
