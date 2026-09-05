import assert from "node:assert/strict";
import test from "node:test";
import { PostgresOpsBillingReviewRepository } from "../../../src/server/index.ts";

const authority = { grantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", actorUserId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  activeRole: "cuac_ops", expiresAt: new Date("2026-09-04T00:00:00Z") };

function fakeClient(responder) {
  const calls = [];
  const client = { async transaction(work) { return work(client); },
    async query(statement, params) { calls.push({ statement, params }); return responder(statement, params); } };
  return { calls, client };
}

test("Postgres billing review rechecks live authority before a fixed quarantine projection", async () => {
  const { calls, client } = fakeClient(statement => /from users u/.test(statement) ? [authority] : []);
  const result = await new PostgresOpsBillingReviewRepository(client).listQuarantinedEvents({
    actorUserId: authority.actorUserId, activeRole: "cuac_ops", beforeEventId: null, limit: 21,
  });
  assert.deepEqual(result, { authorized: true, cursorFound: true, rows: [] });
  assert.equal(calls.length, 2);
  assert.match(calls[0].statement, /for share of u, r, g/);
  assert.match(calls[1].statement, /where e\.state = 'quarantined'/);
  assert.match(calls[1].statement, /left join ops_payment_event_reviews/);
  assert.doesNotMatch(calls[1].statement, /payload_sha256|provider_payment_id|provider_checkout_session_id/);
});

test("Postgres billing review claim binds the current grant and never updates payment facts", async () => {
  const review = { reviewId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", revision: 1, status: "investigating",
    assignedUserId: authority.actorUserId, assignedRole: "cuac_ops", escalationCode: null, escalationReference: null,
    escalatedAt: null, resolvedByUserId: null, resolutionCode: null, resolutionReference: null, resolvedAt: null,
    createdAt: new Date("2026-09-03T00:00:00Z"), updatedAt: new Date("2026-09-03T00:00:00Z") };
  const { calls, client } = fakeClient(statement => /from users u/.test(statement) ? [authority]
    : /insert into ops_payment_event_reviews/.test(statement) ? [review] : []);
  const result = await new PostgresOpsBillingReviewRepository(client).claimReview({
    actorUserId: authority.actorUserId, activeRole: "cuac_ops", eventId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  });
  assert.deepEqual(result, { authorized: true, value: review });
  assert.deepEqual(calls[1].params.slice(1), [authority.actorUserId, authority.grantId, "cuac_ops"]);
  assert.match(calls[1].statement, /on conflict \(payment_provider_event_id\) do nothing/);
  assert.doesNotMatch(calls[1].statement, /update\s+(payments|invoices|payment_provider_events|application_fee_entitlements)/i);
});

test("Postgres billing review does not inspect events or reviews after grant revocation", async () => {
  const { calls, client } = fakeClient(() => []);
  assert.deepEqual(await new PostgresOpsBillingReviewRepository(client).claimReview({
    actorUserId: authority.actorUserId, activeRole: "cuac_ops", eventId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  }), { authorized: false });
  assert.equal(calls.length, 1);
});
