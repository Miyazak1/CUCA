import { createHash } from "node:crypto";
import { badRequest } from "../shared/errors.ts";
import { inputInteger, inputRecord, inputText, inputUuid } from "../shared/input.ts";
import type { RequirementDocument } from "./requirements.ts";

export const MAX_REQUIREMENT_VERSION = 2_147_483_647;
export const REQUIREMENT_WITHDRAWAL_REASONS = ["source_superseded", "source_disputed", "scope_error", "content_correction", "intake_retired", "review_required"] as const;
export type RequirementSourceCheck = { sourceKey: string; contentSha256: string; officialSourceConfirmed: true };
export type RequirementReviewBinding = {
  versionId: string; programIntakeId: string; documentSha256: string;
  preparedByUserId: string; reviewedByUserId: string;
  reviewedAt: string; effectiveFrom: string; reviewDueAt: string;
};
export type RequirementReviewEvidence = RequirementReviewBinding & {
  schemaVersion: 1; scopeConfirmed: true; publicContentConfirmed: true;
  sourceChecks: RequirementSourceCheck[];
};

export function requirementSha256(value: unknown): string {
  const result = inputText(value, "SHA-256", 64);
  if (!/^[a-f0-9]{64}$/.test(result)) throw badRequest("A lowercase SHA-256 is required.");
  return result;
}

export function requirementTimestamp(value: unknown): string {
  const result = inputText(value, "UTC timestamp", 24), date = new Date(result);
  if (!Number.isFinite(date.valueOf()) || date.toISOString() !== result) throw badRequest("A canonical UTC timestamp is required.");
  return result;
}

export function confirmed(value: unknown): true {
  if (value !== true) throw badRequest("An explicit review confirmation is required.");
  return true;
}

export function parseRequirementSourceChecks(value: unknown): RequirementSourceCheck[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 12) throw badRequest("Review every included source.");
  const keys = new Set<string>();
  return value.map(item => {
    const fields = inputRecord(item, ["sourceKey", "contentSha256", "officialSourceConfirmed"]);
    const sourceKey = inputText(fields.sourceKey, "Source key", 64);
    if (!/^[a-z][a-z0-9_-]*$/.test(sourceKey) || keys.has(sourceKey)) throw badRequest("Review source keys must be unique.");
    keys.add(sourceKey);
    return { sourceKey, contentSha256: requirementSha256(fields.contentSha256), officialSourceConfirmed: confirmed(fields.officialSourceConfirmed) };
  });
}

export function bindRequirementSourceChecks(checks: RequirementSourceCheck[], document: RequirementDocument): RequirementSourceCheck[] {
  if (checks.length !== document.sources.length) throw badRequest("Review every included source.");
  return document.sources.map(source => {
    const found = checks.find(check => check.sourceKey === source.key && check.contentSha256 === source.contentSha256);
    if (!found) throw badRequest("Review evidence must match the exact document sources.");
    return found;
  });
}

// This is a recorded human attestation, not a fetch, signature or source-authenticity oracle.
export function parseRequirementReview(value: unknown, binding: RequirementReviewBinding, document: RequirementDocument): RequirementReviewEvidence {
  const fields = inputRecord(value, ["schemaVersion", "versionId", "programIntakeId", "documentSha256", "preparedByUserId", "reviewedByUserId",
    "reviewedAt", "effectiveFrom", "reviewDueAt", "scopeConfirmed", "publicContentConfirmed", "sourceChecks"]);
  inputInteger(fields.schemaVersion, "Review schemaVersion", 1, 1);
  const review: RequirementReviewEvidence = {
    schemaVersion: 1, versionId: inputUuid(fields.versionId, "Version id"), programIntakeId: inputUuid(fields.programIntakeId, "Intake id"),
    documentSha256: requirementSha256(fields.documentSha256), preparedByUserId: inputUuid(fields.preparedByUserId, "Preparer id"),
    reviewedByUserId: inputUuid(fields.reviewedByUserId, "Reviewer id"), reviewedAt: requirementTimestamp(fields.reviewedAt),
    effectiveFrom: requirementTimestamp(fields.effectiveFrom), reviewDueAt: requirementTimestamp(fields.reviewDueAt),
    scopeConfirmed: confirmed(fields.scopeConfirmed), publicContentConfirmed: confirmed(fields.publicContentConfirmed),
    sourceChecks: bindRequirementSourceChecks(parseRequirementSourceChecks(fields.sourceChecks), document),
  };
  for (const key of Object.keys(binding) as (keyof RequirementReviewBinding)[]) {
    if (review[key] !== binding[key]) throw badRequest("Review evidence does not match this version.");
  }
  if (review.preparedByUserId === review.reviewedByUserId || review.reviewedAt > review.effectiveFrom || review.effectiveFrom >= review.reviewDueAt
    || document.sources.some(source => source.capturedAt > review.reviewedAt)) throw badRequest("Review identity or time scope is invalid.");
  return review;
}

export function requirementReviewDigest(review: RequirementReviewEvidence): string {
  return createHash("sha256").update(JSON.stringify(review)).digest("hex");
}

export type RequirementApprovalRow = {
  versionId: string; programIntakeId: string; contentSha256: string; preparedByUserId: string | null;
  approvedByUserId: string | null; reviewedAt: Date | null; effectiveFrom: Date | null; reviewDueAt: Date | null; reviewEvidence: unknown;
};

export function approvedRequirementReview(row: RequirementApprovalRow, document: RequirementDocument): RequirementReviewEvidence {
  if (!row.preparedByUserId || !row.approvedByUserId || !row.reviewedAt || !row.effectiveFrom || !row.reviewDueAt) throw badRequest("Managed review evidence is required.");
  return parseRequirementReview(row.reviewEvidence, { versionId: row.versionId, programIntakeId: row.programIntakeId,
    documentSha256: row.contentSha256, preparedByUserId: row.preparedByUserId, reviewedByUserId: row.approvedByUserId,
    reviewedAt: row.reviewedAt.toISOString(), effectiveFrom: row.effectiveFrom.toISOString(), reviewDueAt: row.reviewDueAt.toISOString() }, document);
}
