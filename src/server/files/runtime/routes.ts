import { PostgresAuthSessionRepository } from "../../auth/postgres-repository.ts";
import { createTransactionalSqlClient, getSharedPostgresPool } from "../../db/postgres-client.ts";
import { serviceUnavailable } from "../../shared/errors.ts";
import { createStudentFileHttpHandlers, type StudentFileService } from "../http.ts";
import { createPrivateOssStorageFromEnv } from "../private-object-storage.ts";
import { PostgresStudentFiles } from "../postgres-student-files.ts";

const unavailableService: StudentFileService = {
  async listOwn() { throw serviceUnavailable("Student file service is not configured."); },
  async createUploadIntent() { throw serviceUnavailable("Student file service is not configured."); },
  async completeUpload() { throw serviceUnavailable("Student file service is not configured."); },
  async createDownload() { throw serviceUnavailable("Student file service is not configured."); },
  async requestDelete() { throw serviceUnavailable("Student file service is not configured."); },
};

const guestOnlyAuthRepository = { async findActiveSessionByTokenHash() { return null; } };

export function createStudentFileRouteHandlers(service: StudentFileService = unavailableService, authRepository = guestOnlyAuthRepository) {
  return createStudentFileHttpHandlers(service, authRepository);
}

export function getStudentFileRouteHandlers(env: Record<string, string | undefined> = process.env) {
  try {
    const client = createTransactionalSqlClient(getSharedPostgresPool());
    const { storage, config } = createPrivateOssStorageFromEnv(env);
    const retentionDays = parseStudentFileRetentionDays(env.CUAC_FILE_RETENTION_DAYS);
    const service = new PostgresStudentFiles(client, storage, {
      uploadsEnabled: parseUploadEnabled(env.CUAC_FILE_UPLOAD_ENABLED),
      maximumBytes: config.maximumBytes,
      uploadTtlSeconds: config.uploadTtlSeconds,
      downloadTtlSeconds: config.downloadTtlSeconds,
      retentionDays,
      kmsKeyId: config.kmsKeyId,
    });
    return createStudentFileHttpHandlers(service, new PostgresAuthSessionRepository(client));
  } catch {
    return createStudentFileRouteHandlers();
  }
}

function parseUploadEnabled(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false" || normalized === undefined) return false;
  throw serviceUnavailable("Student file upload configuration is unavailable.");
}

export function parseStudentFileRetentionDays(value: string | undefined): number {
  if (value === undefined || value === "") return 365;
  if (!/^\d+$/.test(value)) throw serviceUnavailable("Student file retention configuration is unavailable.");
  const days = Number(value);
  if (!Number.isSafeInteger(days) || days < 1 || days > 2_555) throw serviceUnavailable("Student file retention configuration is unavailable.");
  return days;
}
