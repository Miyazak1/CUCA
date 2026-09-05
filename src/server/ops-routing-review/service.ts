import { buildAuditEvent, type AuditSink } from "../audit/audit.ts";
import { evaluatePolicy, type PolicyAction } from "../policy/policy.ts";
import { badRequest, CuacError, forbidden, serviceUnavailable } from "../shared/errors.ts";
import { inputEnum, inputInteger, inputRecord, inputText, inputUuid } from "../shared/input.ts";
import type { RequestContext } from "../shared/request-context.ts";

export const OPS_ROUTING_ESCALATION_CODES = [
  "provider_receipt_investigation",
  "payload_integrity_investigation",
  "delivery_attempts_exhausted",
  "security_investigation_required",
] as const;

export const OPS_ROUTING_CLOSE_CODES = [
  "provider_acceptance_uncertain_no_retry",
  "payload_rebuild_required_no_retry",
  "policy_evidence_invalid_no_retry",
  "duplicate_risk_unresolved_no_retry",
] as const;

export const OPS_ROUTING_RETRY_CODE = "provider_not_accepted_retry_approved" as const;

const ROUTING_OUTCOMES = ["unknown", "invalid_payload", "attempt_limit"] as const;
const ROUTING_ERROR_CODES = [
  "PROVIDER_RESULT_UNKNOWN",
  "PROVIDER_RECEIPT_TIME_INVALID",
  "SENDING_LEASE_EXPIRED",
  "INVALID_PAYLOAD",
  "DELIVERY_BINDING_CHANGED",
  "ATTEMPT_LIMIT",
] as const;

export type OpsRoutingRole = "cuac_ops" | "cuac_admin";
export type OpsRoutingEscalationCode = (typeof OPS_ROUTING_ESCALATION_CODES)[number];
export type OpsRoutingCloseCode = (typeof OPS_ROUTING_CLOSE_CODES)[number];
export type OpsRoutingOutcome = (typeof ROUTING_OUTCOMES)[number];
export type OpsRoutingErrorCode = (typeof ROUTING_ERROR_CODES)[number];
export type OpsRoutingReviewStatus = "investigating" | "escalated" | "closed_no_retry" | "retry_approved";

export type OpsRoutingReview = {
  reviewId: string;
  sourceOutcome: OpsRoutingOutcome;
  sourceErrorCode: OpsRoutingErrorCode;
  sourceAttemptCount: number;
  sourceQuarantinedAt: Date;
  revision: number;
  status: OpsRoutingReviewStatus;
  assignedUserId: string;
  assignedRole: OpsRoutingRole;
  escalationCode: OpsRoutingEscalationCode | null;
  escalationReference: string | null;
  escalatedAt: Date | null;
  resolvedByUserId: string | null;
  resolutionCode: OpsRoutingCloseCode | typeof OPS_ROUTING_RETRY_CODE | null;
  resolutionReference: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OpsRoutingQueueRow = {
  outboxId: string;
  groupId: string;
  schoolId: string;
  schoolNameEn: string;
  admissionRouteKey: string;
  externalChannelType: "university_portal" | "approved_manual_handoff";
  memberCount: number;
  attemptCount: number;
  outcome: OpsRoutingOutcome;
  errorCode: OpsRoutingErrorCode;
  quarantinedAt: Date;
  retryEligible: boolean;
  review: OpsRoutingReview | null;
};

type Actor = { actorUserId: string; activeRole: OpsRoutingRole };
type Authorized<T> = { authorized: false } | { authorized: true; value: T };

export type OpsRoutingReviewRepository = {
  listQuarantinedDeliveries(input: Actor & { beforeOutboxId: string | null; limit: number }): Promise<
    { authorized: false } | { authorized: true; cursorFound: boolean; rows: OpsRoutingQueueRow[] }
  >;
  claimReview(input: Actor & { outboxId: string }): Promise<Authorized<OpsRoutingReview | null>>;
  escalateReview(input: Actor & { outboxId: string; expectedRevision: number; code: OpsRoutingEscalationCode;
    reference: string }): Promise<Authorized<OpsRoutingReview | null>>;
  closeReview(input: Actor & { outboxId: string; expectedRevision: number; code: OpsRoutingCloseCode;
    reference: string }): Promise<Authorized<OpsRoutingReview | null>>;
  approveRetry(input: Actor & { outboxId: string; expectedRevision: number; code: typeof OPS_ROUTING_RETRY_CODE;
    reference: string }): Promise<Authorized<OpsRoutingReview | null>>;
};

export class OpsRoutingReviewService {
  private readonly repository: OpsRoutingReviewRepository;
  private readonly auditSink: AuditSink;

  constructor(repository: OpsRoutingReviewRepository, auditSink: AuditSink) {
    this.repository = repository;
    this.auditSink = auditSink;
  }

  async listQuarantinedDeliveries(context: RequestContext, input: unknown = {}) {
    const actor = requireContext(context);
    const decisionId = authorize(context, "ops.read_routing_review");
    const fields = inputRecord(input, ["cursor", "limit"]);
    const beforeOutboxId = fields.cursor === undefined ? null : inputUuid(fields.cursor, "Routing review cursor");
    const limit = fields.limit === undefined ? 20 : inputInteger(fields.limit, "Routing review limit", 1, 50);
    const result = await this.repository.listQuarantinedDeliveries({ ...actor, beforeOutboxId, limit: limit + 1 });
    requireAuthority(result);
    if (!result.cursorFound) throw badRequest("Routing review cursor is not available.");
    const rows = result.rows.map(validateQueueRow);
    const items = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? items.at(-1)!.outboxId : null;
    await this.auditSink.record(buildAuditEvent(context, {
      action: "ops.routing_review.list", resourceType: "official_submission_outbox", resourceId: null,
      allowed: true, policyDecisionId: decisionId, dataClasses,
      metadata: { itemCount: items.length, hasCursor: beforeOutboxId !== null, hasNextPage: nextCursor !== null },
    }));
    return { items, nextCursor };
  }

  async claimReview(context: RequestContext, outboxIdInput: unknown, input: unknown) {
    const actor = requireContext(context);
    const decisionId = authorize(context, "ops.claim_routing_review");
    const outboxId = inputUuid(outboxIdInput, "Official submission outbox id");
    const fields = inputRecord(input, ["expectedRevision"]);
    inputInteger(fields.expectedRevision, "Expected routing review revision", 0, 0);
    const review = requireReviewResult(await this.repository.claimReview({ ...actor, outboxId }));
    await audit(this.auditSink, context, decisionId, "claim", outboxId, review, {});
    return review;
  }

  async escalateReview(context: RequestContext, outboxIdInput: unknown, input: unknown) {
    const actor = requireContext(context);
    const decisionId = authorize(context, "ops.escalate_routing_review");
    const outboxId = inputUuid(outboxIdInput, "Official submission outbox id");
    const fields = inputRecord(input, ["expectedRevision", "code", "reference"]);
    const expectedRevision = inputInteger(fields.expectedRevision, "Expected routing review revision", 1, 2_147_483_646);
    const code = inputEnum(fields.code, "Routing escalation code", OPS_ROUTING_ESCALATION_CODES);
    const reference = evidenceReference(fields.reference);
    const review = requireReviewResult(await this.repository.escalateReview({ ...actor, outboxId,
      expectedRevision, code, reference }));
    await audit(this.auditSink, context, decisionId, "escalate", outboxId, review, { code });
    return review;
  }

  async closeReview(context: RequestContext, outboxIdInput: unknown, input: unknown) {
    const actor = requireContext(context);
    const decisionId = authorize(context, "ops.close_routing_review");
    const outboxId = inputUuid(outboxIdInput, "Official submission outbox id");
    const fields = inputRecord(input, ["expectedRevision", "code", "reference"]);
    const expectedRevision = inputInteger(fields.expectedRevision, "Expected routing review revision", 1, 2_147_483_646);
    const code = inputEnum(fields.code, "Routing close code", OPS_ROUTING_CLOSE_CODES);
    const reference = evidenceReference(fields.reference);
    const review = requireReviewResult(await this.repository.closeReview({ ...actor, outboxId,
      expectedRevision, code, reference }));
    await audit(this.auditSink, context, decisionId, "close_no_retry", outboxId, review, { code });
    return review;
  }

  async approveRetry(context: RequestContext, outboxIdInput: unknown, input: unknown) {
    const actor = requireContext(context);
    const decisionId = authorize(context, "ops.retry_routing_delivery");
    const outboxId = inputUuid(outboxIdInput, "Official submission outbox id");
    const fields = inputRecord(input, ["expectedRevision", "code", "reference"]);
    const expectedRevision = inputInteger(fields.expectedRevision, "Expected routing review revision", 1, 2_147_483_646);
    const code = inputEnum(fields.code, "Routing retry code", [OPS_ROUTING_RETRY_CODE] as const);
    const reference = evidenceReference(fields.reference);
    const review = requireReviewResult(await this.repository.approveRetry({ ...actor, outboxId,
      expectedRevision, code, reference }));
    await audit(this.auditSink, context, decisionId, "retry_approved", outboxId, review, { code });
    return review;
  }
}

const dataClasses = ["ops_confidential", "audit_security"] as const;

function requireContext(context: RequestContext): Actor {
  if (!context.actorUserId || (context.activeRole !== "cuac_ops" && context.activeRole !== "cuac_admin")
    || context.selectedSurface !== "ops" || context.purpose !== "routing_review" || context.tenantSchoolId !== null
    || (context.authStrength !== "session" && context.authStrength !== "step_up")) {
    throw forbidden("Authenticated CUAC routing review context is required.");
  }
  return { actorUserId: context.actorUserId, activeRole: context.activeRole };
}

function authorize(context: RequestContext, action: PolicyAction): string {
  const decision = evaluatePolicy(context, action, { type: "ops_routing_review", dataClasses });
  if (!decision.allowed) throw forbidden(decision.reason);
  return decision.id;
}

function evidenceReference(value: unknown): string {
  const reference = inputText(value, "Routing review evidence reference", 128);
  if (!/^[A-Za-z0-9._:-]+$/.test(reference)) throw badRequest("Routing review evidence reference has an invalid format.");
  return reference;
}

function requireAuthority<T extends { authorized: boolean }>(result: T): asserts result is T & { authorized: true } {
  if (!result.authorized) throw forbidden("Active CUAC staff access grant is required.");
}

function requireReviewResult(result: Authorized<OpsRoutingReview | null>): OpsRoutingReview {
  requireAuthority(result);
  if (!result.value) throw conflict();
  return validateReview(result.value);
}

function validateQueueRow(row: OpsRoutingQueueRow): OpsRoutingQueueRow {
  if (!uuid(row.outboxId) || !uuid(row.groupId) || !uuid(row.schoolId)
    || typeof row.schoolNameEn !== "string" || row.schoolNameEn.length < 1 || row.schoolNameEn.length > 200
    || !/^[a-z][a-z0-9_-]{0,63}$/.test(row.admissionRouteKey)
    || !["university_portal", "approved_manual_handoff"].includes(row.externalChannelType)
    || !Number.isSafeInteger(row.memberCount) || row.memberCount < 1 || row.memberCount > 20
    || !validSource(row.outcome, row.errorCode, row.attemptCount) || !date(row.quarantinedAt)
    || typeof row.retryEligible !== "boolean") throw unavailable();
  const review = row.review === null ? null : validateReview(row.review);
  const retryEligible = row.outcome === "attempt_limit" && row.errorCode === "ATTEMPT_LIMIT"
    && row.attemptCount === 5 && (review === null || review.status === "investigating" || review.status === "escalated");
  if (row.retryEligible !== retryEligible) throw unavailable();
  return { ...row, review };
}

function validateReview(review: OpsRoutingReview): OpsRoutingReview {
  if (!uuid(review.reviewId) || !validSource(review.sourceOutcome, review.sourceErrorCode, review.sourceAttemptCount)
    || !date(review.sourceQuarantinedAt) || !Number.isSafeInteger(review.revision) || review.revision < 1
    || !["investigating", "escalated", "closed_no_retry", "retry_approved"].includes(review.status)
    || !uuid(review.assignedUserId) || !["cuac_ops", "cuac_admin"].includes(review.assignedRole)
    || !date(review.createdAt) || !date(review.updatedAt) || review.createdAt < review.sourceQuarantinedAt
    || review.updatedAt < review.createdAt || !validReviewLifecycle(review)) throw unavailable();
  return review;
}

function validReviewLifecycle(review: OpsRoutingReview): boolean {
  const noEscalation = review.escalationCode === null && review.escalationReference === null && review.escalatedAt === null;
  const escalation = OPS_ROUTING_ESCALATION_CODES.includes(review.escalationCode as OpsRoutingEscalationCode)
    && validReference(review.escalationReference) && date(review.escalatedAt)
    && review.escalatedAt >= review.createdAt && review.escalatedAt <= review.updatedAt;
  const noResolution = review.resolvedByUserId === null && review.resolutionCode === null
    && review.resolutionReference === null && review.resolvedAt === null;
  const resolution = uuid(review.resolvedByUserId ?? "") && review.resolvedByUserId !== review.assignedUserId
    && validReference(review.resolutionReference) && date(review.resolvedAt)
    && review.resolvedAt >= review.createdAt && review.resolvedAt <= review.updatedAt;
  if (review.status === "investigating") return review.revision === 1 && noEscalation && noResolution;
  if (review.status === "escalated") return review.revision === 2 && escalation && noResolution;
  const transition = review.revision === 2 && noEscalation
    || review.revision === 3 && escalation && review.escalatedAt! <= review.resolvedAt!;
  if (!resolution || !transition) return false;
  if (review.status === "retry_approved") return review.resolutionCode === OPS_ROUTING_RETRY_CODE
    && review.sourceOutcome === "attempt_limit" && review.sourceErrorCode === "ATTEMPT_LIMIT"
    && review.sourceAttemptCount === 5;
  return OPS_ROUTING_CLOSE_CODES.includes(review.resolutionCode as OpsRoutingCloseCode);
}

function validSource(outcome: OpsRoutingOutcome, errorCode: OpsRoutingErrorCode, attemptCount: number): boolean {
  if (!ROUTING_OUTCOMES.includes(outcome) || !ROUTING_ERROR_CODES.includes(errorCode)
    || !Number.isSafeInteger(attemptCount) || attemptCount < 0 || attemptCount > 5) return false;
  if (outcome === "attempt_limit") return errorCode === "ATTEMPT_LIMIT" && attemptCount === 5;
  if (outcome === "invalid_payload") return errorCode === "INVALID_PAYLOAD" || errorCode === "DELIVERY_BINDING_CHANGED";
  return errorCode === "PROVIDER_RESULT_UNKNOWN" || errorCode === "PROVIDER_RECEIPT_TIME_INVALID"
    || errorCode === "SENDING_LEASE_EXPIRED";
}

function validReference(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(value);
}

async function audit(sink: AuditSink, context: RequestContext, decisionId: string, action: string,
  outboxId: string, review: OpsRoutingReview, metadata: Record<string, unknown>) {
  await sink.record(buildAuditEvent(context, {
    action: `ops.routing_review.${action}`, resourceType: "official_submission_outbox", resourceId: outboxId,
    allowed: true, policyDecisionId: decisionId, dataClasses,
    metadata: { reviewId: review.reviewId, revision: review.revision, status: review.status,
      sourceOutcome: review.sourceOutcome, sourceAttemptCount: review.sourceAttemptCount, ...metadata },
  }));
}

function uuid(value: string): boolean {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
}

function date(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function conflict() {
  return new CuacError("CONFLICT", "Routing review state changed; reload before retrying.", 409);
}

function unavailable() {
  return serviceUnavailable("Routing review data is unavailable.");
}
