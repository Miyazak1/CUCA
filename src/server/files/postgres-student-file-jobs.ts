import { randomUUID } from "node:crypto";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { serviceUnavailable } from "../shared/errors.ts";
import type { PrivateFileScanResult, PrivateFileScanner } from "./clamav-scanner.ts";
import type { PrivateObjectStorage } from "./private-object-storage.ts";

export type StudentFileScanLease = {
  id: string;
  userId: string;
  objectKey: string;
  versionId: string;
  expectedBytes: number;
  expectedSha256: string;
  attemptCount: number;
  leaseToken: string;
};

export type StudentFileDeleteLease = {
  id: string;
  userId: string;
  objectKey: string;
  versionId: string | null;
  attemptCount: number;
  leaseToken: string;
};

type LockedScan = StudentFileScanLease & { leaseValid: boolean };
type LockedDelete = StudentFileDeleteLease & { leaseValid: boolean };

export class PostgresStudentFileJobs {
  private readonly client: TransactionalSqlClient;
  constructor(client: TransactionalSqlClient) { this.client = client; }

  async claimScan(): Promise<StudentFileScanLease | null> {
    const leaseToken = randomUUID();
    return this.client.transaction(async tx => {
      const rows = await tx.query<StudentFileScanLease>(`with candidate as (
        select id from student_file_assets where status = 'pending_scan' and available_at <= clock_timestamp()
          and scan_attempt_count < 5 order by available_at, id limit 1 for update skip locked
      ) update student_file_assets f set status = 'scanning', lease_kind = 'scan', lease_token = $1,
        lease_expires_at = clock_timestamp() + interval '180 seconds', scan_attempt_count = scan_attempt_count + 1,
        updated_at = clock_timestamp() from candidate c where f.id = c.id returning f.id, f.user_id as "userId",
        f.object_key as "objectKey", f.object_version_id as "versionId", f.expected_bytes as "expectedBytes",
        f.expected_sha256 as "expectedSha256", f.scan_attempt_count as "attemptCount", f.lease_token as "leaseToken"`, [leaseToken]);
      if (rows[0]) await workerAudit(tx, rows[0].id, "student.file.scan.claim", { attemptCount: rows[0].attemptCount });
      return rows[0] ?? null;
    });
  }

  async finishScan(lease: StudentFileScanLease, result: PrivateFileScanResult): Promise<boolean> {
    validateScanResult(result);
    return this.client.transaction(async tx => {
      const job = await lockedScan(tx, lease);
      if (!job) return false;
      const integrityMatches = result.actualSha256 === job.expectedSha256 && result.observedBytes === job.expectedBytes;
      const outcome = result.outcome === "clean" && !integrityMatches ? "integrity_mismatch" : result.outcome;
      if (outcome === "clean") {
        await tx.query(`update student_file_assets set status = 'clean', actual_sha256 = $2, scan_outcome = 'clean',
          scan_provider = $3, scan_completed_at = clock_timestamp(), lease_kind = null, lease_token = null,
          lease_expires_at = null, revision = revision + 1, updated_at = clock_timestamp() where id = $1`,
        [job.id, result.actualSha256, result.provider]);
      } else if (outcome === "scan_error" && job.attemptCount < 5) {
        const retrySeconds = Math.min(900, 30 * 2 ** (job.attemptCount - 1));
        await tx.query(`update student_file_assets set status = 'pending_scan', available_at = clock_timestamp() + $2 * interval '1 second',
          lease_kind = null, lease_token = null, lease_expires_at = null, revision = revision + 1,
          updated_at = clock_timestamp() where id = $1`, [job.id, retrySeconds]);
      } else {
        await tx.query(`update student_file_assets set status = 'delete_pending', actual_sha256 = $2,
          scan_outcome = $3, scan_provider = $4, scan_completed_at = clock_timestamp(),
          delete_requested_at = clock_timestamp(), available_at = clock_timestamp(), lease_kind = null,
          lease_token = null, lease_expires_at = null, revision = revision + 1, updated_at = clock_timestamp() where id = $1`,
        [job.id, result.actualSha256, outcome, result.provider]);
      }
      await workerAudit(tx, job.id, "student.file.scan.finish", { outcome, attemptCount: job.attemptCount });
      return true;
    });
  }

  async claimDelete(): Promise<StudentFileDeleteLease | null> {
    const leaseToken = randomUUID();
    return this.client.transaction(async tx => {
      const rows = await tx.query<StudentFileDeleteLease>(`with candidate as (
        select id from student_file_assets where status = 'delete_pending' and available_at <= clock_timestamp()
          order by available_at, id limit 1 for update skip locked
      ) update student_file_assets f set status = 'deleting', lease_kind = 'delete', lease_token = $1,
        lease_expires_at = clock_timestamp() + interval '60 seconds', delete_attempt_count = delete_attempt_count + 1,
        updated_at = clock_timestamp() from candidate c where f.id = c.id returning f.id, f.user_id as "userId",
        f.object_key as "objectKey", f.object_version_id as "versionId", f.delete_attempt_count as "attemptCount",
        f.lease_token as "leaseToken"`, [leaseToken]);
      if (rows[0]) await workerAudit(tx, rows[0].id, "student.file.delete.claim", { attemptCount: rows[0].attemptCount });
      return rows[0] ?? null;
    });
  }

  async finishDelete(lease: StudentFileDeleteLease, succeeded: boolean): Promise<boolean> {
    return this.client.transaction(async tx => {
      const job = await lockedDelete(tx, lease);
      if (!job) return false;
      if (succeeded) {
        await tx.query(`update student_file_assets set status = 'deleted', original_filename = 'deleted',
          expected_sha256 = repeat('0', 64), actual_sha256 = null, object_version_id = null, object_etag = null,
          observed_bytes = null, deleted_at = clock_timestamp(),
          lease_kind = null, lease_token = null, lease_expires_at = null, revision = revision + 1,
          updated_at = clock_timestamp() where id = $1`, [job.id]);
      } else {
        const retrySeconds = Math.min(86_400, 30 * 2 ** Math.min(job.attemptCount - 1, 12));
        await tx.query(`update student_file_assets set status = 'delete_pending', available_at = clock_timestamp() + $2 * interval '1 second',
          lease_kind = null, lease_token = null, lease_expires_at = null, revision = revision + 1,
          updated_at = clock_timestamp() where id = $1`, [job.id, retrySeconds]);
      }
      await workerAudit(tx, job.id, "student.file.delete.finish", { outcome: succeeded ? "deleted" : "retry", attemptCount: job.attemptCount });
      return true;
    });
  }

  async recover(limit = 100): Promise<{ recovered: number }> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw serviceUnavailable("Invalid student file recovery limit.");
    return this.client.transaction(async tx => {
      const rows = await tx.query<{ id: string; status: "scanning" | "deleting"; scanAttemptCount: number }>(`select id, status,
        scan_attempt_count as "scanAttemptCount" from student_file_assets where status in ('scanning','deleting')
        and lease_expires_at <= clock_timestamp() order by lease_expires_at, id limit $1 for update skip locked`, [limit]);
      for (const row of rows) {
        if (row.status === "deleting") {
          await tx.query(`update student_file_assets set status = 'delete_pending', available_at = clock_timestamp(),
            lease_kind = null, lease_token = null, lease_expires_at = null, revision = revision + 1,
            updated_at = clock_timestamp() where id = $1`, [row.id]);
        } else if (row.scanAttemptCount < 5) {
          await tx.query(`update student_file_assets set status = 'pending_scan', available_at = clock_timestamp(),
            lease_kind = null, lease_token = null, lease_expires_at = null, revision = revision + 1,
            updated_at = clock_timestamp() where id = $1`, [row.id]);
        } else {
          await tx.query(`update student_file_assets set status = 'delete_pending', scan_outcome = 'scan_error',
            scan_provider = 'worker_recovery', scan_completed_at = clock_timestamp(), delete_requested_at = clock_timestamp(),
            available_at = clock_timestamp(), lease_kind = null, lease_token = null, lease_expires_at = null,
            revision = revision + 1, updated_at = clock_timestamp() where id = $1`, [row.id]);
        }
        await workerAudit(tx, row.id, "student.file.worker.recover", { previousStatus: row.status, scanAttemptCount: row.scanAttemptCount });
      }
      return { recovered: rows.length };
    });
  }

  async enqueueExpiredRetention(limit = 100): Promise<{ enqueued: number }> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw serviceUnavailable("Invalid student file retention limit.");
    return this.client.transaction(async tx => {
      const rows = await tx.query<{ id: string }>(`with candidates as (
        select id from student_file_assets where status in ('pending_upload','pending_scan','scanning','clean')
          and retention_until <= clock_timestamp() order by retention_until, id limit $1 for update skip locked
      ) update student_file_assets f set status = 'delete_pending', delete_requested_at = clock_timestamp(),
        available_at = clock_timestamp(), lease_kind = null, lease_token = null, lease_expires_at = null,
        revision = revision + 1, updated_at = clock_timestamp() from candidates c where f.id = c.id returning f.id`, [limit]);
      for (const row of rows) await workerAudit(tx, row.id, "student.file.retention.enqueue_delete", {});
      return { enqueued: rows.length };
    });
  }

  async enqueueExpiredUploads(limit = 100): Promise<{ enqueued: number }> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw serviceUnavailable("Invalid student file expiry limit.");
    return this.client.transaction(async tx => {
      const rows = await tx.query<{ id: string }>(`with candidates as (
        select id from student_file_assets where status = 'pending_upload'
          and upload_expires_at + interval '24 hours' <= clock_timestamp()
          order by upload_expires_at, id limit $1 for update skip locked
      ) update student_file_assets f set status = 'delete_pending', delete_requested_at = clock_timestamp(),
        available_at = clock_timestamp(), revision = revision + 1, updated_at = clock_timestamp()
        from candidates c where f.id = c.id returning f.id`, [limit]);
      for (const row of rows) await workerAudit(tx, row.id, "student.file.upload_expiry.enqueue_delete", {});
      return { enqueued: rows.length };
    });
  }
}

type ProcessStatus = "idle" | "scanned" | "scan_unconfirmed" | "deleted" | "delete_retry" | "delete_unconfirmed";

export async function processOneStudentFileJob(
  jobs: PostgresStudentFileJobs,
  storage: PrivateObjectStorage,
  scanner: PrivateFileScanner,
  options: { preferDelete?: boolean } = {},
): Promise<{ status: ProcessStatus }> {
  if (options.preferDelete) {
    const deletion = await processDeletion(jobs, storage);
    if (deletion) return deletion;
  }
  const scan = await jobs.claimScan();
  if (scan) {
    let result: PrivateFileScanResult;
    try {
      const stream = await storage.openVersion(scan.objectKey, scan.versionId);
      result = await scanner.scan(stream, scan.expectedBytes);
    } catch {
      result = { outcome: "scan_error", actualSha256: null, observedBytes: 0, provider: "clamav" };
    }
    return { status: await jobs.finishScan(scan, result) ? "scanned" : "scan_unconfirmed" };
  }
  return await processDeletion(jobs, storage) ?? { status: "idle" };
}

async function processDeletion(jobs: PostgresStudentFileJobs, storage: PrivateObjectStorage): Promise<{ status: ProcessStatus } | null> {
  const deletion = await jobs.claimDelete();
  if (!deletion) return null;
  let succeeded = false;
  try { await storage.deleteVersion(deletion.objectKey, deletion.versionId); succeeded = true; }
  catch { succeeded = false; }
  const recorded = await jobs.finishDelete(deletion, succeeded);
  return { status: recorded ? (succeeded ? "deleted" : "delete_retry") : "delete_unconfirmed" };
}

async function lockedScan(tx: TransactionalSqlClient, lease: StudentFileScanLease): Promise<LockedScan | null> {
  const rows = await tx.query<LockedScan>(`select id, user_id as "userId", object_key as "objectKey",
    object_version_id as "versionId", expected_bytes as "expectedBytes", expected_sha256 as "expectedSha256",
    scan_attempt_count as "attemptCount", lease_token as "leaseToken", lease_expires_at > clock_timestamp() as "leaseValid"
    from student_file_assets where id = $1 and user_id = $2 and status = 'scanning' and lease_kind = 'scan'
      and lease_token = $3 for update`, [lease.id, lease.userId, lease.leaseToken]);
  return rows[0]?.leaseValid ? rows[0] : null;
}

async function lockedDelete(tx: TransactionalSqlClient, lease: StudentFileDeleteLease): Promise<LockedDelete | null> {
  const rows = await tx.query<LockedDelete>(`select id, user_id as "userId", object_key as "objectKey",
    object_version_id as "versionId", delete_attempt_count as "attemptCount", lease_token as "leaseToken",
    lease_expires_at > clock_timestamp() as "leaseValid" from student_file_assets where id = $1 and user_id = $2
      and status = 'deleting' and lease_kind = 'delete' and lease_token = $3 for update`, [lease.id, lease.userId, lease.leaseToken]);
  return rows[0]?.leaseValid ? rows[0] : null;
}

function validateScanResult(result: PrivateFileScanResult): void {
  if (!["clean", "malware", "scan_error"].includes(result.outcome)
    || !Number.isSafeInteger(result.observedBytes) || result.observedBytes < 0 || result.observedBytes > 100 * 1024 * 1024 + 65_536
    || (result.actualSha256 !== null && !/^[a-f0-9]{64}$/.test(result.actualSha256))
    || !/^[a-z][a-z0-9_-]{0,63}$/.test(result.provider)) throw serviceUnavailable("Malware scan result is invalid.");
}

async function workerAudit(tx: TransactionalSqlClient, resourceId: string, action: string, metadata: unknown): Promise<void> {
  await tx.query(`insert into audit_logs (request_id,actor_type,active_role,action,resource_type,resource_id,allowed,
    data_classes,redaction_applied,metadata_json) values ($1,'service','system',$2,'student_file',$3,true,
    '["student_pii"]'::jsonb,true,$4::jsonb)`, [randomUUID(), action, resourceId, JSON.stringify(metadata)]);
}
