import { randomUUID } from "node:crypto";
import { buildAuditEvent } from "../audit/audit.ts";
import { PostgresAuditWriter } from "../audit/postgres-writer.ts";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { CuacError, forbidden, serviceUnavailable, tooManyRequests } from "../shared/errors.ts";
import type { RequestContext } from "../shared/request-context.ts";
import type { PrivateObjectMetadata, PrivateObjectStorage } from "./private-object-storage.ts";
import {
  authorizeStudentFile,
  ABSOLUTE_STUDENT_FILE_MAX_BYTES,
  MAX_ACTIVE_STUDENT_FILES,
  parseStudentFileId,
  parseStudentFileRevision,
  parseStudentFileUploadInput,
  privateStudentObjectKey,
  STUDENT_FILE_SCAN_OUTCOMES,
  STUDENT_FILE_STATUSES,
  studentFileCommandDigests,
  type StudentFileContentType,
  type StudentFileDto,
  type StudentFileStatus,
  type StudentFileUploadIntentDto,
  type StudentFileDownloadDto,
} from "./student-file.ts";

export type StudentFileServiceOptions = {
  uploadsEnabled: boolean;
  maximumBytes: number;
  uploadTtlSeconds: number;
  downloadTtlSeconds: number;
  retentionDays: number;
  kmsKeyId: string;
  now?: () => Date;
};

type StoredFile = {
  id: string;
  userId: string;
  category: StudentFileDto["category"];
  originalFilename: string;
  contentType: StudentFileContentType;
  expectedBytes: number;
  expectedSha256: string;
  objectKey: string;
  objectVersionId: string | null;
  objectEtag: string | null;
  observedBytes: number | null;
  status: StudentFileStatus;
  scanOutcome: StudentFileDto["scanOutcome"];
  revision: number;
  uploadExpiresAt: Date;
  retentionUntil: Date;
  uploadedAt: Date | null;
  scanCompletedAt: Date | null;
  deleteRequestedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  requestSha256?: string;
};

const projection = `f.id, f.user_id as "userId", f.category, f.original_filename as "originalFilename",
  f.content_type as "contentType", f.expected_bytes as "expectedBytes", f.expected_sha256 as "expectedSha256",
  f.object_key as "objectKey", f.object_version_id as "objectVersionId", f.object_etag as "objectEtag",
  f.observed_bytes as "observedBytes", f.status, f.scan_outcome as "scanOutcome", f.revision,
  f.upload_expires_at as "uploadExpiresAt", f.retention_until as "retentionUntil", f.uploaded_at as "uploadedAt",
  f.scan_completed_at as "scanCompletedAt", f.delete_requested_at as "deleteRequestedAt",
  f.created_at as "createdAt", f.updated_at as "updatedAt"`;

const changed = () => new CuacError("CONFLICT", "Student file changed or cannot accept this operation. Reload its current version.", 409);
const unavailable = () => forbidden("Student file is not available to this student.");

export class PostgresStudentFiles {
  private readonly client: TransactionalSqlClient;
  private readonly storage: PrivateObjectStorage;
  private readonly options: StudentFileServiceOptions;
  private readonly now: () => Date;

  constructor(client: TransactionalSqlClient, storage: PrivateObjectStorage, options: StudentFileServiceOptions) {
    if (typeof options.uploadsEnabled !== "boolean"
      || !Number.isSafeInteger(options.retentionDays) || options.retentionDays < 1 || options.retentionDays > 2_555
      || !Number.isSafeInteger(options.maximumBytes) || options.maximumBytes < 1 || options.maximumBytes > 100 * 1024 * 1024
      || !Number.isSafeInteger(options.uploadTtlSeconds) || options.uploadTtlSeconds < 60 || options.uploadTtlSeconds > 900
      || !Number.isSafeInteger(options.downloadTtlSeconds) || options.downloadTtlSeconds < 30 || options.downloadTtlSeconds > 300
      || !options.kmsKeyId) throw serviceUnavailable("Student file service configuration is unavailable.");
    this.client = client;
    this.storage = storage;
    this.options = options;
    this.now = options.now ?? (() => new Date());
  }

  async listOwn(context: RequestContext): Promise<StudentFileDto[]> {
    const userId = authorizeStudentFile(context);
    return this.client.transaction(async tx => {
      await lockActiveStudent(tx, userId);
      const rows = await tx.query<StoredFile>(`select ${projection} from student_file_assets f
        where f.user_id = $1 and f.status <> 'deleted' order by f.created_at desc, f.id desc limit $2`,
      [userId, MAX_ACTIVE_STUDENT_FILES]);
      await audit(tx, context, "student.file.list", userId, { resultCount: rows.length });
      return rows.map(toStudentFileDto);
    });
  }

  async createUploadIntent(context: RequestContext, value: unknown, idempotencyKey: unknown): Promise<StudentFileUploadIntentDto> {
    const userId = authorizeStudentFile(context);
    if (!this.options.uploadsEnabled) throw serviceUnavailable("Student file uploads are disabled.");
    const input = parseStudentFileUploadInput(value, this.options.maximumBytes);
    const digests = studentFileCommandDigests(input, idempotencyKey);
    const issuedAt = this.now();
    const uploadExpiresAt = afterSeconds(issuedAt, this.options.uploadTtlSeconds);
    const retentionUntil = afterDays(issuedAt, this.options.retentionDays);
    const candidateId = randomUUID();
    const row = await this.client.transaction(async tx => {
      await lockActiveStudent(tx, userId, true);
      const prior = await tx.query<StoredFile & { requestSha256: string }>(`select ${projection}, f.request_sha256 as "requestSha256"
        from student_file_assets f where f.user_id = $1 and f.idempotency_key_hash = $2 for update`, [userId, digests.idempotencyKeyHash]);
      if (prior[0]) return replayUploadIntent(tx, context, prior[0], digests.requestSha256, issuedAt, uploadExpiresAt);
      const counts = await tx.query<{ count: number }>(`select count(*)::int as count from student_file_assets
        where user_id = $1 and status <> 'deleted'`, [userId]);
      if (!counts[0] || counts[0].count >= MAX_ACTIVE_STUDENT_FILES) {
        throw tooManyRequests("Student file limit reached. Delete an existing file before uploading another.");
      }
      const inserted = await tx.query<StoredFile>(`insert into student_file_assets
        (id,user_id,category,original_filename,content_type,expected_bytes,expected_sha256,object_key,
         idempotency_key_hash,request_sha256,upload_expires_at,retention_until)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        on conflict (user_id,idempotency_key_hash) do nothing returning ${projection.replaceAll("f.", "")}`,
      [candidateId, userId, input.category, input.filename, input.contentType, input.sizeBytes, input.sha256,
        privateStudentObjectKey(candidateId), digests.idempotencyKeyHash, digests.requestSha256, uploadExpiresAt, retentionUntil]);
      if (inserted[0]) {
        await audit(tx, context, "student.file.upload_intent.create", inserted[0].id, { category: input.category, sizeBytes: input.sizeBytes });
        return inserted[0];
      }
      const existing = await tx.query<StoredFile & { requestSha256: string }>(`select ${projection}, f.request_sha256 as "requestSha256"
        from student_file_assets f where f.user_id = $1 and f.idempotency_key_hash = $2 for update`, [userId, digests.idempotencyKeyHash]);
      const current = existing[0];
      if (!current) throw serviceUnavailable("Student file command outcome requires reconciliation.");
      return replayUploadIntent(tx, context, current, digests.requestSha256, issuedAt, uploadExpiresAt);
    });

    const file = toStudentFileDto(row);
    if (row.status !== "pending_upload") return { file, upload: null };
    const upload = await this.storage.createUploadAuthorization({
      objectKey: row.objectKey,
      fileId: row.id,
      contentType: row.contentType,
      expectedSha256: row.expectedSha256,
      expiresAt: row.uploadExpiresAt,
    });
    return { file, upload: { ...upload, expiresAt: upload.expiresAt.toISOString() } };
  }

  async completeUpload(context: RequestContext, fileIdValue: unknown, revisionValue: unknown): Promise<StudentFileDto> {
    const userId = authorizeStudentFile(context);
    const fileId = parseStudentFileId(fileIdValue);
    const expectedRevision = parseStudentFileRevision(revisionValue);
    await verifyActiveStudent(this.client, userId);
    const initial = await findOwned(this.client, userId, fileId);
    if (!initial) throw unavailable();
    if (["pending_scan", "scanning", "clean"].includes(initial.status)) return toStudentFileDto(initial);
    if (initial.status !== "pending_upload" || initial.revision !== expectedRevision) throw changed();

    const metadata = await this.storage.headCurrent(initial.objectKey);
    const valid = validUploadMetadata(initial, metadata, this.options.kmsKeyId);
    const result = await this.client.transaction(async tx => {
      await lockActiveStudent(tx, userId);
      const locked = await findOwned(tx, userId, fileId, true);
      if (!locked) throw unavailable();
      if (locked.status !== "pending_upload") return locked;
      if (locked.revision !== expectedRevision) throw changed();
      const rows = valid
        ? await tx.query<StoredFile>(`update student_file_assets f set status = 'pending_scan', object_version_id = $3,
            object_etag = $4, observed_bytes = $5, uploaded_at = clock_timestamp(), available_at = clock_timestamp(),
            revision = revision + 1, updated_at = clock_timestamp() where f.id = $1 and f.user_id = $2 returning ${projection}`,
          [fileId, userId, metadata.versionId, metadata.etag, metadata.sizeBytes])
        : await tx.query<StoredFile>(`update student_file_assets f set status = 'delete_pending', object_version_id = $3,
            object_etag = $4, observed_bytes = $5, scan_outcome = 'integrity_mismatch', scan_provider = 'oss_head',
            uploaded_at = case when $3::text is null then uploaded_at else clock_timestamp() end,
            scan_completed_at = clock_timestamp(), delete_requested_at = clock_timestamp(),
            available_at = greatest(clock_timestamp(), upload_expires_at + interval '5 seconds'),
            revision = revision + 1, updated_at = clock_timestamp() where f.id = $1 and f.user_id = $2 returning ${projection}`,
          [fileId, userId, metadata.versionId, metadata.etag, metadata.sizeBytes]);
      if (!rows[0]) throw serviceUnavailable("Student file upload could not be completed.");
      await audit(tx, context, valid ? "student.file.upload.complete" : "student.file.upload.reject", fileId,
        { outcome: valid ? "pending_scan" : "integrity_mismatch", revision: rows[0].revision });
      return rows[0];
    });
    if (!valid && result.status === "delete_pending") throw new CuacError("CONFLICT", "Uploaded object metadata did not match the authorized file.", 409);
    return toStudentFileDto(result);
  }

  async createDownload(context: RequestContext, fileIdValue: unknown): Promise<StudentFileDownloadDto> {
    const userId = authorizeStudentFile(context);
    const fileId = parseStudentFileId(fileIdValue);
    await verifyActiveStudent(this.client, userId);
    const row = await findOwned(this.client, userId, fileId);
    if (!row || row.status !== "clean" || !row.objectVersionId) throw unavailable();
    const expiresAt = afterSeconds(this.now(), this.options.downloadTtlSeconds);
    const url = await this.storage.createDownloadUrl({
      objectKey: row.objectKey, versionId: row.objectVersionId, filename: row.originalFilename, expiresAt,
    });
    await this.client.transaction(tx => audit(tx, context, "student.file.download_authorization.create", row.id,
      { expiresInSeconds: this.options.downloadTtlSeconds }));
    return { url, expiresAt: expiresAt.toISOString() };
  }

  async requestDelete(context: RequestContext, fileIdValue: unknown, revisionValue: unknown): Promise<StudentFileDto> {
    const userId = authorizeStudentFile(context);
    const fileId = parseStudentFileId(fileIdValue);
    const expectedRevision = parseStudentFileRevision(revisionValue);
    return this.client.transaction(async tx => {
      await lockActiveStudent(tx, userId);
      const row = await findOwned(tx, userId, fileId, true);
      if (!row) throw unavailable();
      if (["delete_pending", "deleting", "deleted"].includes(row.status)) return toStudentFileDto(row);
      if (row.revision !== expectedRevision || row.revision === 2_147_483_647) throw changed();
      const rows = await tx.query<StoredFile>(`update student_file_assets f set status = 'delete_pending',
        delete_requested_at = clock_timestamp(), available_at = case when status = 'pending_upload'
          then greatest(clock_timestamp(), upload_expires_at + interval '5 seconds') else clock_timestamp() end,
        lease_kind = null, lease_token = null, lease_expires_at = null,
        revision = revision + 1, updated_at = clock_timestamp() where f.id = $1 and f.user_id = $2 returning ${projection}`,
      [fileId, userId]);
      if (!rows[0]) throw serviceUnavailable("Student file deletion could not be requested.");
      await audit(tx, context, "student.file.delete.request", fileId, { previousStatus: row.status, revision: rows[0].revision });
      return toStudentFileDto(rows[0]);
    });
  }
}

async function lockActiveStudent(tx: TransactionalSqlClient, userId: string, exclusive = false): Promise<void> {
  const users = await tx.query(exclusive
    ? "select id from users where id = $1 and account_status = 'active' for update"
    : "select id from users where id = $1 and account_status = 'active' for share", [userId]);
  if (!users[0]) throw forbidden("Active student account is required.");
  const roles = await tx.query("select id from user_roles where user_id = $1 and role = 'student' and revoked_at is null for share", [userId]);
  if (!roles[0]) throw forbidden("Active student role is required.");
}

async function replayUploadIntent(
  tx: TransactionalSqlClient,
  context: RequestContext,
  current: StoredFile & { requestSha256: string },
  requestSha256: string,
  issuedAt: Date,
  uploadExpiresAt: Date,
): Promise<StoredFile> {
  if (current.requestSha256 !== requestSha256) {
    throw new CuacError("CONFLICT", "Idempotency-Key was already used with different student file input.", 409);
  }
  if (current.status !== "pending_upload" || current.uploadExpiresAt.getTime() - issuedAt.getTime() >= 30_000) return current;
  const refreshed = await tx.query<StoredFile>(`update student_file_assets f set upload_expires_at = $3,
    revision = revision + 1, updated_at = clock_timestamp() where f.id = $1 and f.user_id = $2
    and f.status = 'pending_upload' and f.revision < 2147483647 returning ${projection}`,
  [current.id, current.userId, uploadExpiresAt]);
  if (!refreshed[0]) throw changed();
  await audit(tx, context, "student.file.upload_intent.refresh", current.id, { revision: refreshed[0].revision });
  return refreshed[0];
}

async function verifyActiveStudent(client: TransactionalSqlClient, userId: string): Promise<void> {
  const rows = await client.query(`select u.id from users u where u.id = $1 and u.account_status = 'active'
    and exists (select 1 from user_roles r where r.user_id = u.id and r.role = 'student' and r.revoked_at is null)`, [userId]);
  if (!rows[0]) throw forbidden("Active student account and role are required.");
}

async function findOwned(client: TransactionalSqlClient, userId: string, fileId: string, lock = false): Promise<StoredFile | null> {
  const rows = await client.query<StoredFile>(`select ${projection} from student_file_assets f
    where f.id = $1 and f.user_id = $2${lock ? " for update" : ""}`, [fileId, userId]);
  return rows[0] ?? null;
}

function validUploadMetadata(file: StoredFile, metadata: PrivateObjectMetadata, kmsKeyId: string): boolean {
  return metadata.versionId !== null && metadata.etag !== null && metadata.sizeBytes === file.expectedBytes
    && metadata.contentType?.toLowerCase() === file.contentType && metadata.fileId === file.id
    && metadata.expectedSha256 === file.expectedSha256 && metadata.encryption?.toUpperCase() === "KMS"
    && metadata.kmsKeyId === kmsKeyId;
}

function toStudentFileDto(row: StoredFile): StudentFileDto {
  const dates = [row.uploadExpiresAt, row.retentionUntil, row.createdAt, row.updatedAt];
  let validatedId: string;
  try {
    validatedId = parseStudentFileId(row.id);
    parseStudentFileUploadInput({
      category: row.category, filename: row.originalFilename, contentType: row.contentType,
      sizeBytes: row.expectedBytes, sha256: row.expectedSha256,
    }, ABSOLUTE_STUDENT_FILE_MAX_BYTES);
  } catch { throw serviceUnavailable("Student file record requires reconciliation."); }
  if (privateStudentObjectKey(validatedId) !== row.objectKey || !STUDENT_FILE_STATUSES.includes(row.status)
    || (row.scanOutcome !== null && !STUDENT_FILE_SCAN_OUTCOMES.includes(row.scanOutcome))
    || !Number.isSafeInteger(row.expectedBytes) || row.expectedBytes < 1
    || !Number.isSafeInteger(row.revision) || row.revision < 1 || dates.some(value => !(value instanceof Date) || !Number.isFinite(value.getTime()))) {
    throw serviceUnavailable("Student file record requires reconciliation.");
  }
  return {
    id: row.id,
    category: row.category,
    filename: row.originalFilename,
    contentType: row.contentType,
    sizeBytes: row.expectedBytes,
    status: row.status,
    scanOutcome: row.scanOutcome,
    revision: row.revision,
    uploadExpiresAt: row.uploadExpiresAt.toISOString(),
    retentionUntil: row.retentionUntil.toISOString(),
    uploadedAt: optionalIso(row.uploadedAt),
    scanCompletedAt: optionalIso(row.scanCompletedAt),
    deleteRequestedAt: optionalIso(row.deleteRequestedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function audit(tx: TransactionalSqlClient, context: RequestContext, action: string, resourceId: string, metadata: unknown): Promise<void> {
  await new PostgresAuditWriter(tx).record(buildAuditEvent(context, {
    action, resourceType: "student_file", resourceId, allowed: true, policyDecisionId: context.policyDecisionId,
    dataClasses: ["student_pii"], metadata,
  }));
}

function afterSeconds(now: Date, seconds: number): Date {
  const result = new Date(now.getTime() + seconds * 1000);
  if (!Number.isFinite(now.getTime()) || !Number.isFinite(result.getTime())) throw serviceUnavailable("Student file clock is unavailable.");
  return result;
}

function afterDays(now: Date, days: number): Date {
  return afterSeconds(now, days * 86_400);
}

function optionalIso(value: Date | null): string | null {
  if (value === null) return null;
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw serviceUnavailable("Student file record requires reconciliation.");
  return value.toISOString();
}
