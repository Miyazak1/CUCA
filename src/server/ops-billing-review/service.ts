import { buildAuditEvent, type AuditSink } from "../audit/audit.ts";
import { CUAC_HOSTED_PAYMENT_PROVIDER } from "../billing/provider-contract.ts";
import { evaluatePolicy, type PolicyAction } from "../policy/policy.ts";
import { badRequest, CuacError, forbidden, serviceUnavailable } from "../shared/errors.ts";
import { inputEnum, inputInteger, inputRecord, inputText, inputUuid } from "../shared/input.ts";
import type { RequestContext } from "../shared/request-context.ts";

export const OPS_BILLING_ESCALATION_CODES = [
  "provider_investigation_required",
  "finance_approval_required",
  "security_investigation_required",
  "internal_data_repair_required",
] as const;

export const OPS_BILLING_RESOLUTION_CODES = [
  "provider_confirmed_no_change",
  "duplicate_event_no_change",
  "invalid_event_no_change",
  "superseded_by_provider_case",
] as const;

const OPS_BILLING_QUARANTINE_REASONS = [
  "payment_not_visible_expired",
  "payment_scope_mismatch",
  "provider_payment_reused",
  "provider_payment_mismatch",
  "invalid_success_transition",
  "invalid_cancel_transition",
  "invalid_refund_transition",
  "waiting_for_success_expired",
] as const;

export type OpsBillingRole = "cuac_ops" | "cuac_admin";
export type OpsBillingEscalationCode = (typeof OPS_BILLING_ESCALATION_CODES)[number];
export type OpsBillingResolutionCode = (typeof OPS_BILLING_RESOLUTION_CODES)[number];
export type OpsPaymentReviewStatus = "investigating" | "escalated" | "resolved_no_change";

export type OpsPaymentReview = {
  reviewId: string;
  revision: number;
  status: OpsPaymentReviewStatus;
  assignedUserId: string;
  assignedRole: OpsBillingRole;
  escalationCode: OpsBillingEscalationCode | null;
  escalationReference: string | null;
  escalatedAt: Date | null;
  resolvedByUserId: string | null;
  resolutionCode: OpsBillingResolutionCode | null;
  resolutionReference: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OpsBillingReviewQueueRow = {
  eventId: string;
  provider: string;
  providerEventId: string;
  eventType: "payment.succeeded" | "payment.canceled" | "payment.refunded";
  invoiceId: string;
  paymentId: string | null;
  amountMinor: number;
  currency: string;
  occurredAt: Date;
  receivedAt: Date;
  quarantineReason: string;
  quarantinedAt: Date;
  review: OpsPaymentReview | null;
};

type Actor = { actorUserId: string; activeRole: OpsBillingRole };
type Authorized<T> = { authorized: false } | { authorized: true; value: T };

export type OpsBillingReviewRepository = {
  listQuarantinedEvents(input: Actor & { beforeEventId: string | null; limit: number }): Promise<
    { authorized: false } | { authorized: true; cursorFound: boolean; rows: OpsBillingReviewQueueRow[] }
  >;
  claimReview(input: Actor & { eventId: string }): Promise<Authorized<OpsPaymentReview | null>>;
  escalateReview(input: Actor & { eventId: string; expectedRevision: number; code: OpsBillingEscalationCode;
    reference: string }): Promise<Authorized<OpsPaymentReview | null>>;
  resolveReview(input: Actor & { eventId: string; expectedRevision: number; code: OpsBillingResolutionCode;
    reference: string }): Promise<Authorized<OpsPaymentReview | null>>;
};

export class OpsBillingReviewService {
  private readonly repository: OpsBillingReviewRepository;
  private readonly auditSink: AuditSink;

  constructor(repository: OpsBillingReviewRepository, auditSink: AuditSink) {
    this.repository = repository;
    this.auditSink = auditSink;
  }

  async listQuarantinedEvents(context: RequestContext, input: unknown = {}) {
    const actor = requireContext(context);
    const decisionId = authorize(context, "ops.read_billing_review");
    const fields = inputRecord(input, ["cursor", "limit"]);
    const beforeEventId = fields.cursor === undefined ? null : inputUuid(fields.cursor, "Billing review cursor");
    const limit = fields.limit === undefined ? 20 : inputInteger(fields.limit, "Billing review limit", 1, 50);
    const result = await this.repository.listQuarantinedEvents({ ...actor, beforeEventId, limit: limit + 1 });
    requireAuthority(result);
    if (!result.cursorFound) throw badRequest("Billing review cursor is not available.");
    const rows = result.rows.map(validateQueueRow);
    const items = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? items.at(-1)!.eventId : null;
    await this.auditSink.record(buildAuditEvent(context, {
      action: "ops.billing_review.list", resourceType: "payment_provider_event", resourceId: null,
      allowed: true, policyDecisionId: decisionId, dataClasses,
      metadata: { itemCount: items.length, hasCursor: beforeEventId !== null, hasNextPage: nextCursor !== null },
    }));
    return { items, nextCursor };
  }

  async claimReview(context: RequestContext, eventIdInput: unknown, input: unknown) {
    const actor = requireContext(context);
    const decisionId = authorize(context, "ops.claim_billing_review");
    const eventId = inputUuid(eventIdInput, "Payment provider event id");
    const fields = inputRecord(input, ["expectedRevision"]);
    inputInteger(fields.expectedRevision, "Expected review revision", 0, 0);
    const review = requireReviewResult(await this.repository.claimReview({ ...actor, eventId }));
    await audit(this.auditSink, context, decisionId, "claim", eventId, review, {});
    return review;
  }

  async escalateReview(context: RequestContext, eventIdInput: unknown, input: unknown) {
    const actor = requireContext(context);
    const decisionId = authorize(context, "ops.escalate_billing_review");
    const eventId = inputUuid(eventIdInput, "Payment provider event id");
    const fields = inputRecord(input, ["expectedRevision", "code", "reference"]);
    const expectedRevision = inputInteger(fields.expectedRevision, "Expected review revision", 1, 2_147_483_646);
    const code = inputEnum(fields.code, "Billing escalation code", OPS_BILLING_ESCALATION_CODES);
    const reference = evidenceReference(fields.reference);
    const review = requireReviewResult(await this.repository.escalateReview({ ...actor, eventId, expectedRevision, code, reference }));
    await audit(this.auditSink, context, decisionId, "escalate", eventId, review, { code });
    return review;
  }

  async resolveReview(context: RequestContext, eventIdInput: unknown, input: unknown) {
    const actor = requireContext(context);
    const decisionId = authorize(context, "ops.resolve_billing_review");
    const eventId = inputUuid(eventIdInput, "Payment provider event id");
    const fields = inputRecord(input, ["expectedRevision", "code", "reference"]);
    const expectedRevision = inputInteger(fields.expectedRevision, "Expected review revision", 1, 2_147_483_646);
    const code = inputEnum(fields.code, "Billing resolution code", OPS_BILLING_RESOLUTION_CODES);
    const reference = evidenceReference(fields.reference);
    const review = requireReviewResult(await this.repository.resolveReview({ ...actor, eventId, expectedRevision, code, reference }));
    await audit(this.auditSink, context, decisionId, "resolve_no_change", eventId, review, { code });
    return review;
  }
}

const dataClasses = ["payment_business", "ops_confidential", "audit_security"] as const;

function requireContext(context: RequestContext): Actor {
  if (!context.actorUserId || (context.activeRole !== "cuac_ops" && context.activeRole !== "cuac_admin")
    || context.selectedSurface !== "ops" || context.purpose !== "billing_review" || context.tenantSchoolId !== null
    || (context.authStrength !== "session" && context.authStrength !== "step_up")) {
    throw forbidden("Authenticated CUAC billing review context is required.");
  }
  return { actorUserId: context.actorUserId, activeRole: context.activeRole };
}

function authorize(context: RequestContext, action: PolicyAction): string {
  const decision = evaluatePolicy(context, action, { type: "ops_billing_review", dataClasses });
  if (!decision.allowed) throw forbidden(decision.reason);
  return decision.id;
}

function evidenceReference(value: unknown): string {
  const reference = inputText(value, "Billing review evidence reference", 128);
  if (!/^[A-Za-z0-9._:-]+$/.test(reference)) throw badRequest("Billing review evidence reference has an invalid format.");
  return reference;
}

function requireAuthority<T extends { authorized: boolean }>(result: T): asserts result is T & { authorized: true } {
  if (!result.authorized) throw forbidden("Active CUAC staff access grant is required.");
}

function requireReviewResult(result: Authorized<OpsPaymentReview | null>): OpsPaymentReview {
  requireAuthority(result);
  if (!result.value) throw conflict();
  return validateReview(result.value);
}

function validateQueueRow(row: OpsBillingReviewQueueRow): OpsBillingReviewQueueRow {
  if (!uuid(row.eventId) || !uuid(row.invoiceId) || (row.paymentId !== null && !uuid(row.paymentId))
    || row.provider !== CUAC_HOSTED_PAYMENT_PROVIDER
    || typeof row.providerEventId !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(row.providerEventId)
    || !["payment.succeeded", "payment.canceled", "payment.refunded"].includes(row.eventType)
    || !Number.isSafeInteger(row.amountMinor) || row.amountMinor < 0 || !/^[A-Z]{3}$/.test(row.currency)
    || !date(row.occurredAt) || !date(row.receivedAt) || !date(row.quarantinedAt)
    || row.quarantinedAt < row.receivedAt
    || !OPS_BILLING_QUARANTINE_REASONS.includes(row.quarantineReason as typeof OPS_BILLING_QUARANTINE_REASONS[number])) {
    throw unavailable();
  }
  return { ...row, review: row.review === null ? null : validateReview(row.review) };
}

function validateReview(review: OpsPaymentReview): OpsPaymentReview {
  if (!uuid(review.reviewId) || !Number.isSafeInteger(review.revision) || review.revision < 1
    || !["investigating", "escalated", "resolved_no_change"].includes(review.status)
    || !uuid(review.assignedUserId) || !["cuac_ops", "cuac_admin"].includes(review.assignedRole)
    || !date(review.createdAt) || !date(review.updatedAt) || review.updatedAt < review.createdAt
    || !validReviewLifecycle(review)) throw unavailable();
  return review;
}

function validReviewLifecycle(review: OpsPaymentReview): boolean {
  const noEscalation = review.escalationCode === null && review.escalationReference === null && review.escalatedAt === null;
  const escalation = OPS_BILLING_ESCALATION_CODES.includes(review.escalationCode as OpsBillingEscalationCode)
    && typeof review.escalationReference === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(review.escalationReference)
    && date(review.escalatedAt) && review.escalatedAt >= review.createdAt && review.escalatedAt <= review.updatedAt;
  const noResolution = review.resolvedByUserId === null && review.resolutionCode === null
    && review.resolutionReference === null && review.resolvedAt === null;
  const resolution = uuid(review.resolvedByUserId ?? "") && review.resolvedByUserId !== review.assignedUserId
    && OPS_BILLING_RESOLUTION_CODES.includes(review.resolutionCode as OpsBillingResolutionCode)
    && typeof review.resolutionReference === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(review.resolutionReference)
    && date(review.resolvedAt) && review.resolvedAt >= review.createdAt && review.resolvedAt <= review.updatedAt;
  if (review.status === "investigating") return review.revision === 1 && noEscalation && noResolution;
  if (review.status === "escalated") return review.revision === 2 && escalation && noResolution;
  return resolution && (review.revision === 2 && noEscalation
    || review.revision === 3 && escalation && review.escalatedAt! <= review.resolvedAt!);
}

async function audit(sink: AuditSink, context: RequestContext, decisionId: string, action: string,
  eventId: string, review: OpsPaymentReview, metadata: Record<string, unknown>) {
  await sink.record(buildAuditEvent(context, {
    action: `ops.billing_review.${action}`, resourceType: "payment_provider_event", resourceId: eventId,
    allowed: true, policyDecisionId: decisionId, dataClasses,
    metadata: { reviewId: review.reviewId, revision: review.revision, status: review.status, ...metadata },
  }));
}

function uuid(value: string): boolean {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
}

function date(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function conflict() {
  return new CuacError("CONFLICT", "Billing review state changed; reload before retrying.", 409);
}

function unavailable() {
  return serviceUnavailable("Billing review data is unavailable.");
}
