import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { processOneOfficialSubmission } from "../../../src/server/submission-delivery/worker.ts";
import {
  createOfficialSubmissionWorkerConfigurationFromEnv,
  runOfficialSubmissionWorker,
} from "../../../src/server/submission-delivery/runtime.ts";

const providerName = "cuac_handoff_gateway_v1";

function fixture() {
  const lease = { id: randomUUID(), groupId: randomUUID(), applicationSubmissionId: randomUUID(),
    schoolId: randomUUID(), leaseToken: randomUUID() };
  const job = { ...lease, serialized: '{"safe":true}', payload: {}, payloadSha256: "a".repeat(64) };
  const calls = [];
  const outbox = {
    async claim() { calls.push("claim"); return lease; },
    async prepare(value, provider) { calls.push(["prepare", value, provider]); return job; },
    async finish(value, result) { calls.push(["finish", value, result]); return true; },
  };
  return { lease, job, calls, outbox };
}

test("official submission worker sends one prepared package with a stable group idempotency key", async () => {
  const f = fixture(), provider = {
    name: providerName,
    async deliver(serialized, options) {
      assert.equal(serialized, f.job.serialized);
      assert.equal(options.idempotencyKey, `official-submission:${f.job.groupId}`);
      return { status: "accepted", providerName, payloadSha256: f.job.payloadSha256,
        receiptId: "receipt:1", receivedAt: new Date() };
    },
  };
  assert.deepEqual(await processOneOfficialSubmission(f.outbox, provider), { status: "accepted" });
  assert.equal(f.calls.filter(call => Array.isArray(call) && call[0] === "finish").length, 1);
});

test("provider exceptions and malformed responses become unknown and are never exposed", async () => {
  for (const deliver of [
    async () => { throw new Error("PRIVATE_STUDENT_PAYLOAD"); },
    async () => ({ status: "accepted", providerName, payloadSha256: "b".repeat(64), receiptId: "bad", receivedAt: new Date() }),
  ]) {
    const f = fixture();
    assert.deepEqual(await processOneOfficialSubmission(f.outbox, { name: providerName, deliver }), { status: "unknown" });
    const result = f.calls.find(call => Array.isArray(call) && call[0] === "finish")[2];
    assert.deepEqual(result, { status: "unknown", providerName, payloadSha256: f.job.payloadSha256 });
    assert.equal(JSON.stringify(f.calls).includes("PRIVATE_STUDENT_PAYLOAD"), false);
  }
});

test("worker stops before provider when no claim or preparation survives validation", async () => {
  let delivered = 0;
  const provider = { name: providerName, async deliver() { delivered++; } };
  const idle = { async claim() { return null; } };
  assert.deepEqual(await processOneOfficialSubmission(idle, provider), { status: "idle" });
  const skipped = { async claim() { return fixture().lease; }, async prepare() { return null; } };
  assert.deepEqual(await processOneOfficialSubmission(skipped, provider), { status: "skipped" });
  assert.equal(delivered, 0);
});

test("official submission runtime is fail-closed and aggregates bounded worker outcomes", async () => {
  assert.throws(() => createOfficialSubmissionWorkerConfigurationFromEnv({}), error => error.status === 503);
  const controller = new AbortController(), results = ["accepted", "not_accepted", "unknown", "skipped", "unconfirmed", "idle"];
  const config = { providerName, pollIntervalMs: 250, recoveryIntervalMs: 1000, timeoutMs: 30000 };
  const summary = await runOfficialSubmissionWorker({
    outbox: { async recover() { return { recovered: 2, quarantined: 1 }; } },
    provider: { name: providerName, async deliver() {} },
    config,
    signal: controller.signal,
  }, {
    now: () => 0,
    async processOne() { return { status: results.shift() }; },
    async wait() { controller.abort(); },
  });
  assert.deepEqual(summary, { recovered: 2, quarantined: 1, accepted: 1, notAccepted: 1,
    unknown: 1, skipped: 1, unconfirmed: 1 });
});
