import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { processOneStudentFileJob, runStudentFileWorker } from "../../../src/server/index.ts";

const scanLease = {
  id: "aa111111-1111-4111-8111-111111111111",
  userId: "bb111111-1111-4111-8111-111111111111",
  objectKey: "private/student-files/aa/aa111111-1111-4111-8111-111111111111",
  versionId: "version-1",
  expectedBytes: 3,
  expectedSha256: "a".repeat(64),
  attemptCount: 1,
  leaseToken: "cc111111-1111-4111-8111-111111111111",
};

test("student file worker scans the exact captured object version before considering deletion", async () => {
  const calls = [];
  const jobs = {
    async claimScan() { calls.push("claimScan"); return scanLease; },
    async finishScan(lease, result) { calls.push({ lease, result }); return true; },
    async claimDelete() { calls.push("claimDelete"); throw new Error("must not claim delete"); },
  };
  const storage = {
    async openVersion(key, version) { calls.push({ key, version }); return Readable.from([Buffer.from("abc")]); },
  };
  const scanner = {
    async scan(stream, maximumBytes) {
      for await (const _chunk of stream) {}
      calls.push({ maximumBytes });
      return { outcome: "clean", actualSha256: "a".repeat(64), observedBytes: 3, provider: "clamav" };
    },
  };
  assert.deepEqual(await processOneStudentFileJob(jobs, storage, scanner), { status: "scanned" });
  assert.deepEqual(calls[1], { key: scanLease.objectKey, version: "version-1" });
  assert.deepEqual(calls[2], { maximumBytes: 3 });
  assert.equal(calls.at(-1).lease, scanLease);
});

test("student file worker treats missing scan jobs as delete work and records retry", async () => {
  const deletion = { ...scanLease, versionId: null };
  const calls = [];
  const jobs = {
    async claimScan() { return null; },
    async claimDelete() { return deletion; },
    async finishDelete(lease, succeeded) { calls.push({ lease, succeeded }); return true; },
  };
  const storage = { async deleteVersion(key, versionId) { calls.push({ key, versionId }); throw new Error("provider unavailable"); } };
  assert.deepEqual(await processOneStudentFileJob(jobs, storage, {}), { status: "delete_retry" });
  assert.deepEqual(calls[0], { key: deletion.objectKey, versionId: null });
  assert.equal(calls[1].succeeded, false);
});

test("student file worker can prefer deletion so a continuous scan queue cannot starve cleanup", async () => {
  const deletion = { ...scanLease, versionId: "version-1" };
  let scanClaims = 0;
  const jobs = {
    async claimScan() { scanClaims += 1; throw new Error("delete preference was ignored"); },
    async claimDelete() { return deletion; },
    async finishDelete(_lease, succeeded) { assert.equal(succeeded, true); return true; },
  };
  const storage = { async deleteVersion() {} };
  assert.deepEqual(await processOneStudentFileJob(jobs, storage, {}, { preferDelete: true }), { status: "deleted" });
  assert.equal(scanClaims, 0);
});

test("student file worker runs recovery and expiry maintenance and alternates queue preference", async () => {
  const controller = new AbortController();
  const preferences = [];
  const jobs = {
    async recover() { return { recovered: 2 }; },
    async enqueueExpiredRetention() { return { enqueued: 3 }; },
    async enqueueExpiredUploads() { return { enqueued: 4 }; },
  };
  const summary = await runStudentFileWorker({
    jobs,
    storage: {},
    scanner: {},
    config: { pollIntervalMs: 1_000, recoveryIntervalMs: 60_000, retentionIntervalMs: 3_600_000 },
    signal: controller.signal,
  }, {
    now: () => 1,
    async processOne(_jobs, _storage, _scanner, options) {
      preferences.push(options.preferDelete);
      if (preferences.length === 2) controller.abort();
      return { status: preferences.length === 1 ? "scanned" : "deleted" };
    },
    async wait() { throw new Error("aborted workers must not wait"); },
  });
  assert.deepEqual(preferences, [false, true]);
  assert.deepEqual(summary, {
    recovered: 2, retentionEnqueued: 3, expiredUploadsEnqueued: 4,
    scanned: 1, scanUnconfirmed: 0, deleted: 1, deleteRetries: 0, deleteUnconfirmed: 0,
  });
});
