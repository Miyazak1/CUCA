import { buildAuditEvent, type AuditSink } from "../audit/audit.ts";
import { evaluatePolicy } from "../policy/policy.ts";
import { badRequest, CuacError, forbidden } from "../shared/errors.ts";
import { inputEnum, inputInteger, inputRecord, inputText, inputUuid } from "../shared/input.ts";
import type { RequestContext } from "../shared/request-context.ts";

export const OPS_DATA_RIGHTS_ESCALATION_CODES = ["identity_verification_required", "legal_review_required",
  "security_review_required", "retention_exception_review"] as const;
type Role = "cuac_ops" | "cuac_admin";
type Actor = { actorUserId: string; activeRole: Role };
export type OpsDataRightsReview = { reviewId: string; revision: number; status: "investigating" | "escalated";
  assignedUserId: string; assignedRole: Role; escalationCode: string | null; escalationReference: string | null;
  escalatedAt: Date | null; createdAt: Date; updatedAt: Date };
export type OpsDataRightsQueueRow = { requestId: string; requestType: string; correctionScope: string | null;
  preferredLocale: string; status: string; revision: number; receivedAt: Date; updatedAt: Date;
  review: OpsDataRightsReview | null };
type Authorized<T> = { authorized: false } | { authorized: true; value: T };
export type OpsDataRightsRepository = {
  list(input: Actor & { limit: number }): Promise<Authorized<OpsDataRightsQueueRow[]>>;
  claim(input: Actor & { requestId: string; expectedRevision: number }): Promise<Authorized<OpsDataRightsQueueRow | null>>;
  escalate(input: Actor & { requestId: string; expectedRevision: number; expectedReviewRevision: number;
    code: typeof OPS_DATA_RIGHTS_ESCALATION_CODES[number]; reference: string }): Promise<Authorized<OpsDataRightsQueueRow | null>>;
};

export class OpsDataRightsService {
  private readonly repository: OpsDataRightsRepository;
  private readonly audit: AuditSink;
  constructor(repository: OpsDataRightsRepository, audit: AuditSink) { this.repository = repository; this.audit = audit; }
  async list(context: RequestContext, value: unknown = {}) {
    const actor = requireActor(context), decisionId = authorize(context, "ops.read_data_rights_review");
    const fields = inputRecord(value, ["limit"]), limit = fields.limit === undefined ? 50 : inputInteger(fields.limit, "Limit", 1, 100);
    const result = await this.repository.list({ ...actor, limit }); requireAuthority(result);
    await this.audit.record(buildAuditEvent(context, { action: "ops.data_rights.list", resourceType: "data_rights_request",
      resourceId: null, allowed: true, policyDecisionId: decisionId, dataClasses, metadata: { itemCount: result.value.length } }));
    return result.value.map(project);
  }
  async claim(context: RequestContext, requestIdValue: unknown, value: unknown) {
    const actor = requireActor(context), decisionId = authorize(context, "ops.claim_data_rights_review");
    const requestId = inputUuid(requestIdValue, "Request id"), fields = inputRecord(value, ["expectedRevision"]);
    const expectedRevision = inputInteger(fields.expectedRevision, "Expected revision", 1, 2_147_483_646);
    const result = await this.repository.claim({ ...actor, requestId, expectedRevision }); requireAuthority(result);
    if (!result.value) throw changed();
    await this.audit.record(buildAuditEvent(context, { action: "ops.data_rights.claim", resourceType: "data_rights_request",
      resourceId: requestId, allowed: true, policyDecisionId: decisionId, dataClasses,
      metadata: { revision: result.value.revision, reviewId: result.value.review?.reviewId } }));
    return project(result.value);
  }
  async escalate(context: RequestContext, requestIdValue: unknown, value: unknown) {
    const actor = requireActor(context), decisionId = authorize(context, "ops.escalate_data_rights_review");
    const requestId = inputUuid(requestIdValue, "Request id"), fields = inputRecord(value,
      ["expectedRevision", "expectedReviewRevision", "code", "reference"]);
    const expectedRevision = inputInteger(fields.expectedRevision, "Expected revision", 1, 2_147_483_646);
    const expectedReviewRevision = inputInteger(fields.expectedReviewRevision, "Expected review revision", 1, 1);
    const code = inputEnum(fields.code, "Escalation code", OPS_DATA_RIGHTS_ESCALATION_CODES);
    const reference = inputText(fields.reference, "Escalation reference", 128);
    if (!/^[A-Za-z0-9._:-]+$/.test(reference)) throw badRequest("Escalation reference has an invalid format.");
    const result = await this.repository.escalate({ ...actor, requestId, expectedRevision, expectedReviewRevision, code, reference });
    requireAuthority(result); if (!result.value) throw changed();
    await this.audit.record(buildAuditEvent(context, { action: "ops.data_rights.escalate", resourceType: "data_rights_request",
      resourceId: requestId, allowed: true, policyDecisionId: decisionId, dataClasses,
      metadata: { revision: result.value.revision, reviewId: result.value.review?.reviewId, code } }));
    return project(result.value);
  }
}
const dataClasses = ["ops_confidential", "audit_security"] as const;
function requireActor(context: RequestContext): Actor {
  if (!context.actorUserId || !["cuac_ops", "cuac_admin"].includes(context.activeRole)
    || context.selectedSurface !== "ops" || context.purpose !== "data_rights_review" || context.tenantSchoolId !== null
    || !["session", "step_up"].includes(context.authStrength)) throw forbidden("Authenticated data-rights review context is required.");
  return { actorUserId: context.actorUserId, activeRole: context.activeRole as Role };
}
function authorize(context: RequestContext, action: "ops.read_data_rights_review" | "ops.claim_data_rights_review" | "ops.escalate_data_rights_review") {
  const decision = evaluatePolicy(context, action, { type: "ops_data_rights_review", dataClasses });
  if (!decision.allowed) throw forbidden(decision.reason); return decision.id;
}
function requireAuthority<T>(result: Authorized<T>): asserts result is { authorized: true; value: T } {
  if (!result.authorized) throw forbidden("Active CUAC staff access grant is required.");
}
function project(row: OpsDataRightsQueueRow) { return { ...row, receivedAt: row.receivedAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  review: row.review ? { ...row.review, escalatedAt: row.review.escalatedAt?.toISOString() ?? null,
    createdAt: row.review.createdAt.toISOString(), updatedAt: row.review.updatedAt.toISOString() } : null }; }
function changed() { return new CuacError("CONFLICT", "Data-rights review state changed; reload before retrying.", 409); }
