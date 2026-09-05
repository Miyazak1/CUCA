import { buildAuditEvent, type AuditSink } from "../audit/audit.ts";
import { evaluatePolicy, type PolicyAction } from "../policy/policy.ts";
import { badRequest, CuacError, forbidden, serviceUnavailable } from "../shared/errors.ts";
import { inputEnum, inputInteger, inputRecord, inputText, inputUuid } from "../shared/input.ts";
import type { RequestContext } from "../shared/request-context.ts";

export const OPS_DATA_QUALITY_ENTITY_TYPES = ["city", "school", "program", "scholarship"] as const;
export const OPS_DATA_QUALITY_ISSUE_CODES = [
  "missing_source_evidence", "invalid_source_url", "unverified", "stale", "disputed",
  "verification_metadata_missing",
] as const;
export const OPS_DATA_QUALITY_ESCALATION_CODES = [
  "source_owner_confirmation_required", "conflicting_official_sources", "legal_or_policy_review_required",
  "suspected_source_tampering",
] as const;
export const OPS_DATA_QUALITY_RESOLUTION_CODES = [
  "source_confirmed", "source_conflict_confirmed", "source_invalid", "source_evidence_required_no_change",
] as const;

export type OpsDataQualityEntityType = (typeof OPS_DATA_QUALITY_ENTITY_TYPES)[number];
export type OpsDataQualityIssueCode = (typeof OPS_DATA_QUALITY_ISSUE_CODES)[number];
export type OpsDataQualityEscalationCode = (typeof OPS_DATA_QUALITY_ESCALATION_CODES)[number];
export type OpsDataQualityResolutionCode = (typeof OPS_DATA_QUALITY_RESOLUTION_CODES)[number];
export type OpsDataQualityRole = "cuac_ops" | "cuac_admin";
export type OpsDataQualityReviewStatus = "investigating" | "escalated" | "verified" | "disputed" | "closed_no_change";

export type OpsDataQualityEvidence = {
  evidenceId: string; sourceUrl: string | null; sourceLabel: string | null; capturedAt: Date;
};

export type OpsDataQualityReview = {
  reviewId: string;
  sourceEntityUpdatedAt: Date;
  sourceEvidenceId: string | null;
  sourceEvidenceCapturedAt: Date | null;
  sourceIssueCode: OpsDataQualityIssueCode;
  revision: number;
  status: OpsDataQualityReviewStatus;
  assignedUserId: string;
  assignedRole: OpsDataQualityRole;
  escalationCode: OpsDataQualityEscalationCode | null;
  escalationReference: string | null;
  escalatedAt: Date | null;
  resolvedByUserId: string | null;
  resolutionCode: OpsDataQualityResolutionCode | null;
  resolutionReference: string | null;
  resolvedAt: Date | null;
  reviewDueAt: Date | null;
  resultEntityUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OpsDataQualityQueueRow = {
  entityType: OpsDataQualityEntityType;
  entityId: string;
  label: string;
  verificationStatus: "unverified" | "verified" | "stale" | "disputed" | "invalid";
  lastVerifiedAt: Date | null;
  nextReviewDueAt: Date | null;
  entityUpdatedAt: Date;
  issueCode: OpsDataQualityIssueCode;
  evidence: OpsDataQualityEvidence | null;
  review: OpsDataQualityReview | null;
};

type Actor = { actorUserId: string; activeRole: OpsDataQualityRole };
type Authorized<T> = { authorized: false } | { authorized: true; value: T };
export type OpsDataQualityCursor = { entityType: OpsDataQualityEntityType; entityId: string };

export type OpsDataQualityRepository = {
  listCandidates(input: Actor & { cursor: OpsDataQualityCursor | null; limit: number }): Promise<
    { authorized: false } | { authorized: true; cursorFound: boolean; rows: OpsDataQualityQueueRow[] }
  >;
  claimReview(input: Actor & OpsDataQualityCursor): Promise<Authorized<OpsDataQualityReview | null>>;
  escalateReview(input: Actor & OpsDataQualityCursor & { expectedRevision: number;
    code: OpsDataQualityEscalationCode; reference: string }): Promise<Authorized<OpsDataQualityReview | null>>;
  resolveReview(input: Actor & OpsDataQualityCursor & { expectedRevision: number;
    code: OpsDataQualityResolutionCode; reference: string; reviewDueAt: Date | null }): Promise<Authorized<OpsDataQualityReview | null>>;
};

export class OpsDataQualityService {
  private readonly repository: OpsDataQualityRepository;
  private readonly auditSink: AuditSink;

  constructor(repository: OpsDataQualityRepository, auditSink: AuditSink) {
    this.repository = repository;
    this.auditSink = auditSink;
  }

  async listCandidates(context: RequestContext, input: unknown = {}) {
    const actor = requireContext(context), decisionId = authorize(context, "ops.read_data_quality_review");
    const fields = inputRecord(input, ["cursorType", "cursor", "limit"]);
    const hasType = fields.cursorType !== undefined, hasId = fields.cursor !== undefined;
    if (hasType !== hasId) throw badRequest("Data-quality cursor type and id must be provided together.");
    const cursor = hasType ? {
      entityType: inputEnum(fields.cursorType, "Data-quality cursor type", OPS_DATA_QUALITY_ENTITY_TYPES),
      entityId: inputUuid(fields.cursor, "Data-quality cursor id"),
    } : null;
    const limit = fields.limit === undefined ? 20 : inputInteger(fields.limit, "Data-quality limit", 1, 50);
    const result = await this.repository.listCandidates({ ...actor, cursor, limit: limit + 1 });
    requireAuthority(result);
    if (!result.cursorFound) throw badRequest("Data-quality cursor is not available.");
    const rows = result.rows.map(validateQueueRow), items = rows.slice(0, limit);
    const tail = rows.length > limit ? items.at(-1)! : null;
    const nextCursor = tail ? { entityType: tail.entityType, entityId: tail.entityId } : null;
    await this.auditSink.record(buildAuditEvent(context, {
      action: "ops.data_quality.list", resourceType: "catalog_entity", resourceId: null,
      allowed: true, policyDecisionId: decisionId, dataClasses,
      metadata: { itemCount: items.length, hasCursor: cursor !== null, hasNextPage: nextCursor !== null },
    }));
    return { items, nextCursor };
  }

  async claimReview(context: RequestContext, entityTypeInput: unknown, entityIdInput: unknown, input: unknown) {
    const actor = requireContext(context), decisionId = authorize(context, "ops.claim_data_quality_review");
    const target = parseTarget(entityTypeInput, entityIdInput), fields = inputRecord(input, ["expectedRevision"]);
    inputInteger(fields.expectedRevision, "Expected data-quality revision", 0, 0);
    const review = requireReviewResult(await this.repository.claimReview({ ...actor, ...target }));
    await audit(this.auditSink, context, decisionId, "claim", target, review, {});
    return review;
  }

  async escalateReview(context: RequestContext, entityTypeInput: unknown, entityIdInput: unknown, input: unknown) {
    const actor = requireContext(context), decisionId = authorize(context, "ops.escalate_data_quality_review");
    const target = parseTarget(entityTypeInput, entityIdInput);
    const fields = inputRecord(input, ["expectedRevision", "code", "reference"]);
    const expectedRevision = inputInteger(fields.expectedRevision, "Expected data-quality revision", 1, 2_147_483_646);
    const code = inputEnum(fields.code, "Data-quality escalation code", OPS_DATA_QUALITY_ESCALATION_CODES);
    const reference = evidenceReference(fields.reference);
    const review = requireReviewResult(await this.repository.escalateReview({ ...actor, ...target,
      expectedRevision, code, reference }));
    await audit(this.auditSink, context, decisionId, "escalate", target, review, { code });
    return review;
  }

  async resolveReview(context: RequestContext, entityTypeInput: unknown, entityIdInput: unknown, input: unknown) {
    const actor = requireContext(context), decisionId = authorize(context, "ops.resolve_data_quality_review");
    const target = parseTarget(entityTypeInput, entityIdInput);
    const fields = inputRecord(input, ["expectedRevision", "code", "reference", "reviewDueAt"]);
    const expectedRevision = inputInteger(fields.expectedRevision, "Expected data-quality revision", 1, 2_147_483_646);
    const code = inputEnum(fields.code, "Data-quality resolution code", OPS_DATA_QUALITY_RESOLUTION_CODES);
    const reference = evidenceReference(fields.reference);
    const reviewDueAt = code === "source_confirmed" ? canonicalTimestamp(fields.reviewDueAt) : null;
    if (code !== "source_confirmed" && fields.reviewDueAt !== undefined && fields.reviewDueAt !== null) {
      throw badRequest("Review due date is only accepted for confirmed source evidence.");
    }
    const review = requireReviewResult(await this.repository.resolveReview({ ...actor, ...target,
      expectedRevision, code, reference, reviewDueAt }));
    await audit(this.auditSink, context, decisionId, "resolve", target, review, { code });
    return review;
  }
}

const dataClasses = ["public_catalog", "internal_catalog_metadata", "ops_confidential", "audit_security"] as const;

function requireContext(context: RequestContext): Actor {
  if (!context.actorUserId || (context.activeRole !== "cuac_ops" && context.activeRole !== "cuac_admin")
    || context.selectedSurface !== "ops" || context.purpose !== "data_quality_review"
    || context.tenantSchoolId !== null || (context.authStrength !== "session" && context.authStrength !== "step_up")) {
    throw forbidden("Authenticated CUAC data-quality review context is required.");
  }
  return { actorUserId: context.actorUserId, activeRole: context.activeRole };
}

function authorize(context: RequestContext, action: PolicyAction): string {
  const decision = evaluatePolicy(context, action, { type: "ops_data_quality_review", dataClasses });
  if (!decision.allowed) throw forbidden(decision.reason);
  return decision.id;
}

function parseTarget(entityType: unknown, entityId: unknown): OpsDataQualityCursor {
  return { entityType: inputEnum(entityType, "Catalog entity type", OPS_DATA_QUALITY_ENTITY_TYPES),
    entityId: inputUuid(entityId, "Catalog entity id") };
}

function evidenceReference(value: unknown): string {
  const reference = inputText(value, "Data-quality evidence reference", 128);
  if (!/^[A-Za-z0-9._:-]+$/.test(reference)) throw badRequest("Data-quality evidence reference has an invalid format.");
  return reference;
}

function canonicalTimestamp(value: unknown): Date {
  const input = inputText(value, "Review due at", 24), parsed = new Date(input);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString() !== input) {
    throw badRequest("Review due at must be a canonical UTC timestamp.");
  }
  return parsed;
}

function requireAuthority<T extends { authorized: boolean }>(result: T): asserts result is T & { authorized: true } {
  if (!result.authorized) throw forbidden("Active CUAC staff access grant is required.");
}

function requireReviewResult(result: Authorized<OpsDataQualityReview | null>): OpsDataQualityReview {
  requireAuthority(result);
  if (!result.value) throw conflict();
  return validateReview(result.value);
}

function validateQueueRow(row: OpsDataQualityQueueRow): OpsDataQualityQueueRow {
  if (!OPS_DATA_QUALITY_ENTITY_TYPES.includes(row.entityType) || !uuid(row.entityId)
    || typeof row.label !== "string" || row.label.length < 1 || row.label.length > 200
    || !["unverified", "verified", "stale", "disputed", "invalid"].includes(row.verificationStatus)
    || !dateOrNull(row.lastVerifiedAt) || !dateOrNull(row.nextReviewDueAt) || !date(row.entityUpdatedAt)
    || !OPS_DATA_QUALITY_ISSUE_CODES.includes(row.issueCode)) throw unavailable();
  const evidence = row.evidence === null ? null : validateEvidence(row.evidence);
  if ((row.issueCode === "missing_source_evidence") !== (evidence === null)) throw unavailable();
  return { ...row, evidence, review: row.review === null ? null : validateReview(row.review) };
}

function validateEvidence(value: OpsDataQualityEvidence): OpsDataQualityEvidence {
  if (!uuid(value.evidenceId) || !date(value.capturedAt)
    || (value.sourceLabel !== null && (typeof value.sourceLabel !== "string" || value.sourceLabel.length < 1
      || value.sourceLabel.length > 200))
    || (value.sourceUrl !== null && !safeHttpsUrl(value.sourceUrl))) throw unavailable();
  return value;
}

function validateReview(review: OpsDataQualityReview): OpsDataQualityReview {
  const hasEvidence = review.sourceEvidenceId !== null && review.sourceEvidenceCapturedAt !== null;
  if (!uuid(review.reviewId) || !date(review.sourceEntityUpdatedAt)
    || (review.sourceEvidenceId !== null && !uuid(review.sourceEvidenceId))
    || !dateOrNull(review.sourceEvidenceCapturedAt) || hasEvidence !== (review.sourceIssueCode !== "missing_source_evidence")
    || !OPS_DATA_QUALITY_ISSUE_CODES.includes(review.sourceIssueCode)
    || !Number.isSafeInteger(review.revision) || review.revision < 1
    || !["investigating", "escalated", "verified", "disputed", "closed_no_change"].includes(review.status)
    || !uuid(review.assignedUserId) || !["cuac_ops", "cuac_admin"].includes(review.assignedRole)
    || !date(review.createdAt) || !date(review.updatedAt) || review.createdAt < review.sourceEntityUpdatedAt
    || review.updatedAt < review.createdAt || !validReviewLifecycle(review)) throw unavailable();
  return review;
}

function validReviewLifecycle(review: OpsDataQualityReview): boolean {
  const noEscalation = review.escalationCode === null && review.escalationReference === null && review.escalatedAt === null;
  const escalation = OPS_DATA_QUALITY_ESCALATION_CODES.includes(review.escalationCode as OpsDataQualityEscalationCode)
    && validReference(review.escalationReference) && date(review.escalatedAt)
    && review.escalatedAt >= review.createdAt && review.escalatedAt <= review.updatedAt;
  const noResolution = review.resolvedByUserId === null && review.resolutionCode === null
    && review.resolutionReference === null && review.resolvedAt === null && review.reviewDueAt === null
    && review.resultEntityUpdatedAt === null;
  if (review.status === "investigating") return review.revision === 1 && noEscalation && noResolution;
  if (review.status === "escalated") return review.revision === 2 && escalation && noResolution;
  const resolution = uuid(review.resolvedByUserId ?? "") && review.resolvedByUserId !== review.assignedUserId
    && OPS_DATA_QUALITY_RESOLUTION_CODES.includes(review.resolutionCode as OpsDataQualityResolutionCode)
    && validReference(review.resolutionReference) && date(review.resolvedAt) && date(review.resultEntityUpdatedAt)
    && review.resolvedAt >= review.createdAt && review.resultEntityUpdatedAt >= review.sourceEntityUpdatedAt;
  const transition = review.revision === 2 && noEscalation
    || review.revision === 3 && escalation && review.escalatedAt! <= review.resolvedAt!;
  if (!resolution || !transition) return false;
  if (review.status === "verified") return review.resolutionCode === "source_confirmed" && date(review.reviewDueAt)
    && review.reviewDueAt > review.resolvedAt! && review.resultEntityUpdatedAt!.getTime() === review.resolvedAt!.getTime();
  if (review.status === "disputed") return ["source_conflict_confirmed", "source_invalid"].includes(review.resolutionCode!)
    && review.reviewDueAt === null && review.resultEntityUpdatedAt!.getTime() === review.resolvedAt!.getTime();
  return review.resolutionCode === "source_evidence_required_no_change" && review.reviewDueAt === null
    && review.sourceEvidenceId === null
    && review.resultEntityUpdatedAt!.getTime() === review.sourceEntityUpdatedAt.getTime();
}

async function audit(sink: AuditSink, context: RequestContext, decisionId: string, action: string,
  target: OpsDataQualityCursor, review: OpsDataQualityReview, metadata: Record<string, unknown>) {
  await sink.record(buildAuditEvent(context, {
    action: `ops.data_quality.${action}`, resourceType: `catalog_${target.entityType}`, resourceId: target.entityId,
    allowed: true, policyDecisionId: decisionId, dataClasses,
    metadata: { reviewId: review.reviewId, revision: review.revision, status: review.status,
      sourceIssueCode: review.sourceIssueCode, ...metadata },
  }));
}

function safeHttpsUrl(value: string): boolean {
  if (value.length > 2048 || !value.startsWith("https://")) return false;
  try { return new URL(value).protocol === "https:" && new URL(value).hostname.length > 0; } catch { return false; }
}

function validReference(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(value);
}

function uuid(value: string): boolean {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
}

function date(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function dateOrNull(value: unknown): value is Date | null {
  return value === null || date(value);
}

function conflict() {
  return new CuacError("CONFLICT", "Catalog data-quality review state changed; reload before retrying.", 409);
}

function unavailable() {
  return serviceUnavailable("Catalog data-quality review data is unavailable.");
}
