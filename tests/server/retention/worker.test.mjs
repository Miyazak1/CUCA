import assert from "node:assert/strict";
import test from "node:test";
import { retentionWorkerConfigFromEnv, runRetentionWorker } from "../../../src/server/retention/runtime/worker.ts";

const emptyResult = processed => ({
  guardianRegistrationsExpired: 0,
  emailSecretsExpired: 0,
  emailRowsDeleted: 0,
  verificationChallengesDeleted: 0,
  passwordResetChallengesDeleted: 0,
  schoolInvitesDeleted: 0,
  sessionsDeleted: 0,
  sessionStepUpsCleared: 0,
  continuationsDeleted: 0,
  mfaChallengesDeleted: 0,
  rateLimitBucketsDeleted: processed,
  processed,
});

test("retention worker configuration is bounded", () => {
  assert.deepEqual(retentionWorkerConfigFromEnv({}), { pollIntervalMs: 3_600_000, batchSize: 100 });
  assert.deepEqual(retentionWorkerConfigFromEnv({ CUAC_RETENTION_WORKER_POLL_MS: "60000",
    CUAC_RETENTION_WORKER_BATCH_SIZE: "500" }), { pollIntervalMs: 60_000, batchSize: 500 });
  for (const env of [{ CUAC_RETENTION_WORKER_POLL_MS: "59999" },
    { CUAC_RETENTION_WORKER_POLL_MS: "86400001" }, { CUAC_RETENTION_WORKER_BATCH_SIZE: "0" },
    { CUAC_RETENTION_WORKER_BATCH_SIZE: "501" }, { CUAC_RETENTION_WORKER_BATCH_SIZE: "x" }]) {
    assert.throws(() => retentionWorkerConfigFromEnv(env), /timing is invalid/);
  }
});

test("retention worker drains busy batches and stops through AbortSignal", async () => {
  const controller = new AbortController();
  const waits = [];
  const results = [emptyResult(2), emptyResult(0)];
  const summary = await runRetentionWorker({
    processor: { async processBatch(limit) { assert.equal(limit, 2); return results.shift(); } },
    config: { pollIntervalMs: 60_000, batchSize: 2 },
    signal: controller.signal,
  }, {
    async wait(milliseconds) {
      waits.push(milliseconds);
      if (waits.length === 2) controller.abort();
    },
  });
  assert.deepEqual(waits, [1_000, 60_000]);
  assert.deepEqual(summary, { passes: 2, processed: 2 });
});

test("retention worker propagates database failures", async () => {
  await assert.rejects(runRetentionWorker({
    processor: { async processBatch() { throw new Error("database unavailable"); } },
    config: { pollIntervalMs: 60_000, batchSize: 100 },
    signal: new AbortController().signal,
  }), /database unavailable/);
});
