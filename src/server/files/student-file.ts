import { createHash } from "node:crypto";
import { evaluatePolicy } from "../policy/policy.ts";
import { badRequest, forbidden } from "../shared/errors.ts";
import { inputEnum, inputInteger, inputRecord } from "../shared/input.ts";
import type { RequestContext } from "../shared/request-context.ts";
import { parseApplicationIdempotencyKey } from "../student/application-commands.ts";

export const STUDENT_FILE_CATEGORIES = [
  "identity_document",
  "transcript",
  "test_score",
  "recommendation",
  "supporting_document",
] as const;

export const STUDENT_FILE_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const DEFAULT_STUDENT_FILE_MAX_BYTES = 25 * 1024 * 1024;
export const ABSOLUTE_STUDENT_FILE_MAX_BYTES = 100 * 1024 * 1024;
export const MAX_ACTIVE_STUDENT_FILES = 200;

export const STUDENT_FILE_STATUSES = [
  "pending_upload", "pending_scan", "scanning", "clean", "delete_pending", "deleting", "deleted",
] as const;

export const STUDENT_FILE_SCAN_OUTCOMES = ["clean", "malware", "integrity_mismatch", "scan_error"] as const;

export type StudentFileCategory = typeof STUDENT_FILE_CATEGORIES[number];
export type StudentFileContentType = typeof STUDENT_FILE_CONTENT_TYPES[number];
export type StudentFileStatus = typeof STUDENT_FILE_STATUSES[number];

export type StudentFileUploadInput = {
  category: StudentFileCategory;
  filename: string;
  contentType: StudentFileContentType;
  sizeBytes: number;
  sha256: string;
};

export type StudentFileDto = {
  id: string;
  category: StudentFileCategory;
  filename: string;
  contentType: StudentFileContentType;
  sizeBytes: number;
  status: StudentFileStatus;
  scanOutcome: typeof STUDENT_FILE_SCAN_OUTCOMES[number] | null;
  revision: number;
  uploadExpiresAt: string;
  retentionUntil: string;
  uploadedAt: string | null;
  scanCompletedAt: string | null;
  deleteRequestedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StudentFileUploadIntentDto = {
  file: StudentFileDto;
  upload: {
    method: "PUT";
    url: string;
    headers: Readonly<Record<string, string>>;
    expiresAt: string;
  } | null;
};

export type StudentFileDownloadDto = {
  url: string;
  expiresAt: string;
};

export function parseStudentFileUploadInput(value: unknown, maximumBytes = DEFAULT_STUDENT_FILE_MAX_BYTES): StudentFileUploadInput {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1 || maximumBytes > ABSOLUTE_STUDENT_FILE_MAX_BYTES) {
    throw badRequest("Student file size policy is unavailable.");
  }
  const input = inputRecord(value, ["category", "filename", "contentType", "sizeBytes", "sha256"], true);
  const filename = parseFilename(input.filename);
  const sha256 = parseSha256(input.sha256);
  return {
    category: inputEnum(input.category, "File category", STUDENT_FILE_CATEGORIES),
    filename,
    contentType: inputEnum(input.contentType, "File content type", STUDENT_FILE_CONTENT_TYPES),
    sizeBytes: inputInteger(input.sizeBytes, "File size", 1, maximumBytes),
    sha256,
  };
}

export function studentFileCommandDigests(input: StudentFileUploadInput, idempotencyKey: unknown) {
  const key = parseApplicationIdempotencyKey(idempotencyKey);
  return {
    idempotencyKeyHash: createHash("sha256").update(key, "utf8").digest("hex"),
    requestSha256: createHash("sha256").update(JSON.stringify({ version: 1, ...input }), "utf8").digest("hex"),
  };
}

export function authorizeStudentFile(context: RequestContext): string {
  const ownerUserId = context.actorUserId;
  const decision = evaluatePolicy(context, "student.manage_private_files", {
    type: "student",
    ownerUserId,
    dataClasses: ["student_pii"],
  });
  if (!ownerUserId || !decision.allowed) throw forbidden("Student private file authority is required.");
  return ownerUserId;
}

export function privateStudentObjectKey(fileId: string): string {
  parseStudentFileId(fileId);
  return `private/student-files/${fileId.slice(0, 2)}/${fileId}`;
}

export function parseStudentFileId(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value)) {
    throw badRequest("Student file id must be a UUID.");
  }
  return value;
}

export function parseStudentFileRevision(value: unknown): number {
  return inputInteger(value, "File revision", 1, 2_147_483_647);
}

function parseFilename(value: unknown): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 255 || Buffer.byteLength(value, "utf8") > 255
    || value !== value.trim() || /[\/\\]/.test(value) || hasControlCharacter(value) || [".", ".."].includes(value)) {
    throw badRequest("Filename must be a plain bounded file name without a path.");
  }
  return value;
}

function parseSha256(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw badRequest("File SHA-256 must be lowercase hexadecimal.");
  return value;
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}
