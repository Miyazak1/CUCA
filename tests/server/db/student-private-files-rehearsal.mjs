import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import {
  createRequestContext,
  PostgresStudentFileJobs,
  PostgresStudentFiles,
} from "../../../src/server/index.ts";

export async function runStudentPrivateFilesRehearsal(t, pool, client) {
  await t.test("private student files enforce owner, scan, download and deletion state", async () => {
    const email = `student-files-${randomUUID()}@example.invalid`;
    const otherEmail = `student-files-other-${randomUUID()}@example.invalid`;
    const user = (await pool.query("insert into users (email,email_normalized) values ($1,$1) returning id", [email])).rows[0];
    const other = (await pool.query("insert into users (email,email_normalized) values ($1,$1) returning id", [otherEmail])).rows[0];
    await pool.query("insert into user_roles (user_id,role) values ($1,'student'),($2,'student')", [user.id, other.id]);
    const context = studentContext(user.id);
    const otherContext = studentContext(other.id);
    const bytes = Buffer.from("rehearsal private transcript");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const storageCalls = [];
    let metadata;
    const storage = {
      async createUploadAuthorization(input) {
        storageCalls.push({ operation: "upload", ...input });
        return { method: "PUT", url: "https://synthetic.invalid/upload", headers: { "content-type": input.contentType }, expiresAt: input.expiresAt };
      },
      async headCurrent(objectKey) {
        storageCalls.push({ operation: "head", objectKey });
        return metadata;
      },
      async createDownloadUrl(input) {
        storageCalls.push({ operation: "download", ...input });
        return `https://synthetic.invalid/download?versionId=${input.versionId}`;
      },
    };
    const files = new PostgresStudentFiles(client, storage, {
      uploadsEnabled: true,
      maximumBytes: 25 * 1024 * 1024,
      uploadTtlSeconds: 900,
      downloadTtlSeconds: 60,
      retentionDays: 365,
      kmsKeyId: "rehearsal-kms-key",
    });
    const input = { category: "transcript", filename: "private-transcript.pdf", contentType: "application/pdf", sizeBytes: bytes.length, sha256 };
    const first = await files.createUploadIntent(context, input, "private_file_rehearsal_0001");
    assert.equal(first.file.status, "pending_upload");
    const replay = await files.createUploadIntent(context, input, "private_file_rehearsal_0001");
    assert.equal(replay.file.id, first.file.id);
    await assert.rejects(files.createUploadIntent(context, { ...input, sizeBytes: bytes.length + 1 }, "private_file_rehearsal_0001"),
      error => error.code === "CONFLICT");

    metadata = {
      versionId: "rehearsal-version-1",
      etag: "rehearsal-etag-1",
      sizeBytes: bytes.length,
      contentType: input.contentType,
      fileId: first.file.id,
      expectedSha256: sha256,
      encryption: "KMS",
      kmsKeyId: "rehearsal-kms-key",
    };
    const pendingScan = await files.completeUpload(context, first.file.id, first.file.revision);
    assert.equal(pendingScan.status, "pending_scan");
    await assert.rejects(files.createDownload(context, first.file.id), error => error.code === "FORBIDDEN");

    const jobs = new PostgresStudentFileJobs(client);
    const scan = await jobs.claimScan();
    assert.equal(scan.id, first.file.id);
    assert.equal(scan.versionId, metadata.versionId);
    assert.equal(await jobs.finishScan(scan, { outcome: "clean", actualSha256: sha256, observedBytes: bytes.length, provider: "clamav" }), true);
    const clean = (await files.listOwn(context)).find(file => file.id === first.file.id);
    assert.equal(clean.status, "clean");
    const download = await files.createDownload(context, first.file.id);
    assert.equal(new URL(download.url).searchParams.get("versionId"), metadata.versionId);
    const downloadCount = storageCalls.filter(call => call.operation === "download").length;
    await assert.rejects(files.createDownload(otherContext, first.file.id), error => error.code === "FORBIDDEN");
    assert.equal(storageCalls.filter(call => call.operation === "download").length, downloadCount);

    const deletePending = await files.requestDelete(context, first.file.id, clean.revision);
    assert.equal(deletePending.status, "delete_pending");
    const deletion = await jobs.claimDelete();
    assert.equal(deletion.id, first.file.id);
    assert.equal(deletion.versionId, metadata.versionId);
    assert.equal(await jobs.finishDelete(deletion, true), true);
    assert.equal((await files.listOwn(context)).some(file => file.id === first.file.id), false);

    const audit = await pool.query(`select action, metadata_json::text as metadata from audit_logs
      where resource_type = 'student_file' and (resource_id = $1 or resource_id = $2)`, [first.file.id, user.id]);
    assert.ok(audit.rows.length >= 8);
    assert.doesNotMatch(JSON.stringify(audit.rows), /private-transcript|private\/student-files|rehearsal-version|rehearsal-etag|synthetic\.invalid|[a-f0-9]{64}/);

    await assert.rejects(pool.query("update student_file_assets set object_key = 'private/student-files/ff/' || id::text where id = $1", [first.file.id]),
      error => error.code === "23514" && error.constraint === "student_file_assets_input_check");
    await assert.rejects(pool.query("update student_file_assets set status = 'clean' where id = $1", [first.file.id]),
      error => error.code === "23514" && error.constraint === "student_file_assets_state_check");
  });
}

function studentContext(actorUserId) {
  return createRequestContext({
    actorUserId,
    activeRole: "student",
    selectedSurface: "student",
    purpose: "student_action",
    tenantSchoolId: null,
    authStrength: "session",
  });
}
