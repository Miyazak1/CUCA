import { createHash } from "node:crypto";
import type { RequirementReleaseCandidate } from "./catalog-requirement-candidate-runtime.ts";

export const SINGLE_HOST_REQUIREMENT_PUBLISH_CONFIRMATION = "publish-reviewed-requirements-to-cuac-single-host";

export type RequirementReviewRecord = {
  version: 1;
  status: "human_review_completed";
  reviewReference: string;
  reviewedAt: string;
  reviewDueAt: string;
  candidateFile: string;
  candidateFileSha256: string;
  templatesSha256: string;
  operationsSha256: string;
  scope: {
    schoolCount: number;
    programCount: number;
    operationCount: number;
    publishResolvableOnly: true;
    leaveUnavailableDataEmpty: true;
  };
  confirmations: {
    contentReviewed: true;
    officialSourcesReviewed: true;
    publicContentConfirmed: true;
    prohibitedDataConfirmedExcluded: true;
  };
};

function canonicalTimestamp(value: unknown, name: string): string {
  if (typeof value !== "string") throw new Error(`${name} must be a canonical UTC timestamp.`);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString() !== value) throw new Error(`${name} must be a canonical UTC timestamp.`);
  return value;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function validateRequirementReviewRecord(
  value: unknown,
  candidate: RequirementReleaseCandidate,
  candidateBytes: Buffer,
): RequirementReviewRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Requirement review record must be an object.");
  const review = value as RequirementReviewRecord;
  if (review.version !== 1 || review.status !== "human_review_completed") throw new Error("Requirement review is not complete.");
  if (!/^[a-z0-9][a-z0-9._:/-]{7,199}$/i.test(review.reviewReference)) throw new Error("Requirement review reference is invalid.");
  const reviewedAt = canonicalTimestamp(review.reviewedAt, "reviewedAt");
  const reviewDueAt = canonicalTimestamp(review.reviewDueAt, "reviewDueAt");
  if (reviewedAt >= reviewDueAt) throw new Error("Requirement review period is invalid.");
  if (review.candidateFile !== "seeds/application-requirements-release-candidate.unreviewed.json"
    || review.candidateFileSha256 !== sha256(candidateBytes)
    || review.templatesSha256 !== candidate.hashes.templatesSha256
    || review.operationsSha256 !== candidate.hashes.operationsSha256) {
    throw new Error("Requirement review does not match the exact candidate bytes and hashes.");
  }
  const expectedScope = {
    schoolCount: candidate.summary.schoolCount,
    programCount: candidate.summary.programCount,
    operationCount: candidate.summary.operationCount,
    publishResolvableOnly: true,
    leaveUnavailableDataEmpty: true,
  };
  if (JSON.stringify(review.scope) !== JSON.stringify(expectedScope)) throw new Error("Requirement review scope does not match the candidate.");
  if (review.confirmations?.contentReviewed !== true || review.confirmations.officialSourcesReviewed !== true
    || review.confirmations.publicContentConfirmed !== true || review.confirmations.prohibitedDataConfirmedExcluded !== true) {
    throw new Error("Requirement review confirmations are incomplete.");
  }
  return review;
}

export function assertSingleHostRequirementPublishTarget(env: Record<string, string | undefined>) {
  if (env.CUAC_REQUIREMENT_PUBLISH_CONFIRMATION !== SINGLE_HOST_REQUIREMENT_PUBLISH_CONFIRMATION) {
    throw new Error("Requirement publication requires the exact confirmation token.");
  }
  if (env.CUAC_ENV !== "development" || env.CUAC_LOCAL_RUNTIME !== "1") {
    throw new Error("Requirement publication is restricted to the owner-controlled single-host runtime.");
  }
  const rawUrl = env.DATABASE_URL || env.POSTGRES_URL || env.PG_DATABASE_URL;
  if (!rawUrl) throw new Error("Requirement publication requires a PostgreSQL URL.");
  const target = new URL(rawUrl);
  if (!["postgres:", "postgresql:"].includes(target.protocol) || target.search || target.hash
    || !["127.0.0.1", "[::1]"].includes(target.hostname)
    || decodeURIComponent(target.username) !== "cuac_local"
    || decodeURIComponent(target.pathname.replace(/^\//, "")) !== "cuac_local") {
    throw new Error("Requirement publication is restricted to the loopback cuac_local database.");
  }
  const preparerEmail = env.CUAC_REQUIREMENT_PREPARER_EMAIL?.trim().toLowerCase();
  const reviewerEmail = env.CUAC_REQUIREMENT_REVIEWER_EMAIL?.trim().toLowerCase();
  const reviewReference = env.CUAC_REQUIREMENT_REVIEW_REFERENCE?.trim();
  if (!preparerEmail || !reviewerEmail || preparerEmail === reviewerEmail) throw new Error("Distinct preparer and reviewer account emails are required.");
  if (!reviewReference) throw new Error("A completed review reference is required.");
  return { databaseUrl: rawUrl, preparerEmail, reviewerEmail, reviewReference };
}
