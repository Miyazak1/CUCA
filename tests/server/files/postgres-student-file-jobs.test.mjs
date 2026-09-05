import assert from "node:assert/strict";
import test from "node:test";
import { PostgresStudentFileJobs } from "../../../src/server/index.ts";

const lease = {
  id: "aa111111-1111-4111-8111-111111111111",
  userId: "bb111111-1111-4111-8111-111111111111",
  objectKey: "private/student-files/aa/aa111111-1111-4111-8111-111111111111",
  versionId: "version-1",
  expectedBytes: 3,
  expectedSha256: "a".repeat(64),
  attemptCount: 1,
  leaseToken: "cc111111-1111-4111-8111-111111111111",
};

function clientForLockedJob(overrides = {}) {
  const queries = [];
  const client = {
    async transaction(work) { return work(this); },
    async query(statement, params) {
      queries.push({ statement, params });
      if (statement.includes("from student_file_assets where id") && statement.includes("status = 'scanning'")) {
        return [{ ...lease, leaseValid: true, ...overrides }];
      }
      if (statement.includes("insert into audit_logs") || statement.includes("update student_file_assets")) return [];
      throw new Error(`Unexpected SQL: ${statement}`);
    },
  };
  return { client, queries };
}

test("file scan completion promotes only matching clean bytes", async () => {
  const { client, queries } = clientForLockedJob();
  assert.equal(await new PostgresStudentFileJobs(client).finishScan(lease, {
    outcome: "clean", actualSha256: "a".repeat(64), observedBytes: 3, provider: "clamav",
  }), true);
  const update = queries.find(query => query.statement.includes("status = 'clean'"));
  assert.ok(update);
  assert.equal(update.params[1], "a".repeat(64));
  const audit = queries.find(query => query.statement.includes("insert into audit_logs"));
  assert.doesNotMatch(JSON.stringify(audit.params), /private\/student-files|version-1|aaaaaaaaaaaaaaaa/);
});

test("file scan completion quarantines digest mismatch for asynchronous deletion", async () => {
  const { client, queries } = clientForLockedJob();
  await new PostgresStudentFileJobs(client).finishScan(lease, {
    outcome: "clean", actualSha256: "b".repeat(64), observedBytes: 3, provider: "clamav",
  });
  const update = queries.find(query => query.statement.includes("status = 'delete_pending'"));
  assert.ok(update);
  assert.equal(update.params[2], "integrity_mismatch");
});

test("transient scan errors return to pending scan before the fifth attempt", async () => {
  const { client, queries } = clientForLockedJob({ attemptCount: 2 });
  await new PostgresStudentFileJobs(client).finishScan({ ...lease, attemptCount: 2 }, {
    outcome: "scan_error", actualSha256: null, observedBytes: 0, provider: "clamav",
  });
  const update = queries.find(query => query.statement.includes("status = 'pending_scan'"));
  assert.ok(update);
  assert.equal(update.params[1], 60);
  assert.equal(queries.some(query => query.statement.includes("status = 'clean'")), false);
});

test("scan claims use skip-locked leases and increment attempts atomically", async () => {
  const queries = [];
  const client = {
    async transaction(work) { return work(this); },
    async query(statement, params) {
      queries.push({ statement, params });
      if (statement.includes("with candidate as")) return [{ ...lease, leaseToken: params[0] }];
      if (statement.includes("insert into audit_logs")) return [];
      throw new Error(`Unexpected SQL: ${statement}`);
    },
  };
  const claimed = await new PostgresStudentFileJobs(client).claimScan();
  assert.match(queries[0].statement, /for update skip locked/);
  assert.match(queries[0].statement, /scan_attempt_count = scan_attempt_count \+ 1/);
  assert.equal(claimed.leaseToken, queries[0].params[0]);
});

test("successful deletion scrubs private object metadata from the database tombstone", async () => {
  const queries = [];
  const deletion = { id: lease.id, userId: lease.userId, objectKey: lease.objectKey, versionId: lease.versionId,
    attemptCount: 1, leaseToken: lease.leaseToken, leaseValid: true };
  const client = {
    async transaction(work) { return work(this); },
    async query(statement, params) {
      queries.push({ statement, params });
      if (statement.includes("status = 'deleting'") && statement.includes("for update")) return [deletion];
      if (statement.includes("update student_file_assets") || statement.includes("insert into audit_logs")) return [];
      throw new Error(`Unexpected SQL: ${statement}`);
    },
  };
  assert.equal(await new PostgresStudentFileJobs(client).finishDelete(deletion, true), true);
  const update = queries.find(query => query.statement.includes("status = 'deleted'"));
  assert.match(update.statement, /original_filename = 'deleted'/);
  assert.match(update.statement, /object_version_id = null/);
  assert.match(update.statement, /expected_sha256 = repeat\('0', 64\)/);
});

test("abandoned upload intents enter deletion after a fixed completion grace", async () => {
  const queries = [];
  const client = {
    async transaction(work) { return work(this); },
    async query(statement, params) {
      queries.push({ statement, params });
      if (statement.includes("with candidates as")) return [{ id: lease.id }];
      if (statement.includes("insert into audit_logs")) return [];
      throw new Error(`Unexpected SQL: ${statement}`);
    },
  };
  assert.deepEqual(await new PostgresStudentFileJobs(client).enqueueExpiredUploads(10), { enqueued: 1 });
  assert.match(queries[0].statement, /upload_expires_at \+ interval '24 hours'/);
  assert.match(queries[0].statement, /status = 'pending_upload'/);
});
