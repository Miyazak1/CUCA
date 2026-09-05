import assert from "node:assert/strict";
import test from "node:test";
import { createRequestContext, PostgresStudentFiles } from "../../../src/server/index.ts";

const userId = "aa111111-1111-4111-8111-111111111111";
const now = new Date("2026-09-01T00:00:00.000Z");
const context = createRequestContext({
  requestId: "request-file-1",
  actorUserId: userId,
  activeRole: "student",
  selectedSurface: "student",
  purpose: "student_action",
  authStrength: "session",
  tenantSchoolId: null,
});

function service(client, storage, overrides = {}) {
  return new PostgresStudentFiles(client, storage, {
    uploadsEnabled: true,
    maximumBytes: 25 * 1024 * 1024,
    uploadTtlSeconds: 900,
    downloadTtlSeconds: 60,
    retentionDays: 365,
    kmsKeyId: "kms-key-1",
    now: () => now,
    ...overrides,
  });
}

test("student file upload intent authorizes first, serializes owner quota and audits no file secrets", async () => {
  const queries = [];
  const storageCalls = [];
  const client = {
    async transaction(work) { return work(this); },
    async query(statement, params) {
      queries.push({ statement, params });
      if (statement.includes("from users where")) return [{ id: userId }];
      if (statement.includes("from user_roles")) return [{ id: "role-1" }];
      if (statement.includes("idempotency_key_hash") && statement.includes("for update")) return [];
      if (statement.includes("count(*)::int")) return [{ count: 0 }];
      if (statement.includes("insert into student_file_assets")) {
        const [id, owner, category, originalFilename, contentType, expectedBytes, expectedSha256, objectKey] = params;
        const uploadExpiresAt = params[10];
        const retentionUntil = params[11];
        return [{
          id, userId: owner, category, originalFilename, contentType, expectedBytes, expectedSha256, objectKey,
          objectVersionId: null, objectEtag: null, observedBytes: null, status: "pending_upload", scanOutcome: null,
          revision: 1, uploadExpiresAt, retentionUntil, uploadedAt: null, scanCompletedAt: null, deleteRequestedAt: null,
          createdAt: now, updatedAt: now,
        }];
      }
      if (statement.includes("insert into audit_logs")) return [];
      throw new Error(`Unexpected SQL: ${statement}`);
    },
  };
  const storage = {
    async createUploadAuthorization(input) {
      storageCalls.push(input);
      return { method: "PUT", url: "https://private.example.test/upload", headers: { "content-type": input.contentType }, expiresAt: input.expiresAt };
    },
  };
  const input = {
    category: "transcript", filename: "secret-name.pdf", contentType: "application/pdf", sizeBytes: 1234, sha256: "b".repeat(64),
  };
  const result = await service(client, storage).createUploadIntent(context, input, "student_file_key_123456");
  assert.equal(result.file.status, "pending_upload");
  assert.equal(result.upload.method, "PUT");
  assert.equal(storageCalls[0].fileId, result.file.id);
  assert.match(storageCalls[0].objectKey, new RegExp(`/[a-f0-9]{2}/${result.file.id}$`));
  assert.match(queries[0].statement, /for update/);
  assert.equal(queries.find(query => query.statement.includes("count\(\*\)::int"))?.params[0], userId);
  const audit = queries.find(query => query.statement.includes("insert into audit_logs"));
  assert.ok(audit);
  assert.doesNotMatch(JSON.stringify(audit.params), /secret-name|bbbbbbbb|private\/student-files/);
});

test("student file service denies wrong context before database or object storage", async () => {
  let calls = 0;
  const client = { async query() { calls += 1; throw new Error(); }, async transaction() { calls += 1; throw new Error(); } };
  const storage = { async createUploadAuthorization() { calls += 1; throw new Error(); } };
  const wrong = { ...context, purpose: "agent_tool" };
  await assert.rejects(service(client, storage).createUploadIntent(wrong, {}, "student_file_key_123456"),
    error => error?.code === "FORBIDDEN");
  assert.equal(calls, 0);
});

test("student file upload feature flag fails before database or object storage", async () => {
  let calls = 0;
  const client = { async query() { calls += 1; }, async transaction() { calls += 1; } };
  const storage = { async createUploadAuthorization() { calls += 1; } };
  const input = { category: "transcript", filename: "record.pdf", contentType: "application/pdf", sizeBytes: 1, sha256: "a".repeat(64) };
  await assert.rejects(service(client, storage, { uploadsEnabled: false }).createUploadIntent(context, input, "student_file_key_123456"),
    error => error?.code === "SERVICE_UNAVAILABLE");
  assert.equal(calls, 0);
});

test("student file service never creates a download authorization before clean", async () => {
  let storageCalls = 0;
  const pending = {
    id: "bb111111-1111-4111-8111-111111111111", userId, category: "transcript", originalFilename: "record.pdf",
    contentType: "application/pdf", expectedBytes: 12, expectedSha256: "c".repeat(64),
    objectKey: "private/student-files/bb/bb111111-1111-4111-8111-111111111111", objectVersionId: "version-1",
    objectEtag: "etag", observedBytes: 12, status: "pending_scan", scanOutcome: null, revision: 2,
    uploadExpiresAt: now, retentionUntil: new Date("2027-09-01T00:00:00.000Z"), uploadedAt: now,
    scanCompletedAt: null, deleteRequestedAt: null, createdAt: now, updatedAt: now,
  };
  const client = {
    async transaction(work) { return work(this); },
    async query(statement) {
      if (statement.includes("select u.id from users u")) return [{ id: userId }];
      if (statement.includes("from student_file_assets f")) return [pending];
      throw new Error(`Unexpected SQL: ${statement}`);
    },
  };
  const storage = { async createDownloadUrl() { storageCalls += 1; return "https://should-not-exist"; } };
  await assert.rejects(service(client, storage).createDownload(context, pending.id), error => error?.code === "FORBIDDEN");
  assert.equal(storageCalls, 0);
});
