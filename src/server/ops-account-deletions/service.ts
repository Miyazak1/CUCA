import { buildAuditEvent, type AuditSink } from "../audit/audit.ts";
import { evaluatePolicy, type PolicyAction } from "../policy/policy.ts";
import { badRequest, CuacError, forbidden, serviceUnavailable } from "../shared/errors.ts";
import { inputEnum, inputInteger, inputRecord, inputText, inputUuid } from "../shared/input.ts";
import type { RequestContext } from "../shared/request-context.ts";

export const ACCOUNT_DELETION_BLOCKERS = ["legal_hold_review_required", "backup_tombstone_required",
  "private_object_cleanup_required", "financial_record_review_required", "application_evidence_review_required",
  "school_handoff_review_required", "privileged_role_review_required", "minor_evidence_review_required"] as const;
export const LEGAL_HOLD_RESULTS = ["clear_candidate", "blocked"] as const;
export const LEGAL_HOLD_REASONS = ["no_hold_found", "legal_hold", "fraud_or_security", "financial_record"] as const;
type Role = "cuac_ops" | "cuac_admin";
type Actor = { actorUserId: string; activeRole: Role };
export type AccountDeletionBlocker = typeof ACCOUNT_DELETION_BLOCKERS[number];
export type LegalHoldReview = { reviewId: string; version: number; sourceExecutionRevision: number;
  result: typeof LEGAL_HOLD_RESULTS[number]; reasonCode: typeof LEGAL_HOLD_REASONS[number];
  caseReference: string; reviewedByUserId: string; reviewedAt: Date };
export type AccountDeletionExecution = { executionId: string; dataRightsRequestId: string;
  status: "review_required" | "blocked" | "quarantined" | "purge_ready" | "completed";
  blockerCodes: AccountDeletionBlocker[]; revision: number; preparedAt: Date; updatedAt: Date;
  latestLegalHoldReview: LegalHoldReview | null };
type Authorized<T> = { authorized: false } | { authorized: true; value: T };
export type AccountDeletionExecutionRepository = {
  list(input: Actor & { limit: number }): Promise<Authorized<AccountDeletionExecution[]>>;
  refresh(input: Actor & { executionId: string; expectedRevision: number }): Promise<Authorized<AccountDeletionExecution | null>>;
  recordLegalHoldReview(input: Actor & { executionId: string; reviewId: string; expectedRevision: number;
    result: LegalHoldReview["result"]; reasonCode: LegalHoldReview["reasonCode"];
    caseReference: string }): Promise<Authorized<AccountDeletionExecution | null>>;
};

const dataClasses = ["ops_confidential", "audit_security"] as const;

export class OpsAccountDeletionService {
  private readonly repository: AccountDeletionExecutionRepository;
  private readonly audit: AuditSink;
  constructor(repository: AccountDeletionExecutionRepository, audit: AuditSink) {
    this.repository = repository; this.audit = audit;
  }

  async list(context: RequestContext, value: unknown = {}) {
    const actor = requireActor(context), decisionId = authorize(context, "ops.read_account_deletion_execution");
    const fields = inputRecord(value, ["limit"]);
    const limit = fields.limit === undefined ? 50 : inputInteger(fields.limit, "Limit", 1, 100);
    const result = await this.repository.list({ ...actor, limit }); requireAuthority(result);
    const items = result.value.map(project);
    await this.audit.record(buildAuditEvent(context, { action: "ops.account_deletion.list",
      resourceType: "account_deletion_execution", resourceId: null, allowed: true,
      policyDecisionId: decisionId, dataClasses, metadata: { itemCount: items.length } }));
    return items;
  }

  async refresh(context: RequestContext, executionIdValue: unknown, value: unknown) {
    const actor = requireActor(context), decisionId = authorize(context, "ops.refresh_account_deletion_execution");
    const executionId = inputUuid(executionIdValue, "Execution id");
    const fields = inputRecord(value, ["expectedRevision"]);
    const expectedRevision = inputInteger(fields.expectedRevision, "Expected revision", 1, 2_147_483_646);
    const result = await this.repository.refresh({ ...actor, executionId, expectedRevision });
    requireAuthority(result); if (!result.value) throw changed();
    const execution = validate(result.value);
    await this.audit.record(buildAuditEvent(context, { action: "ops.account_deletion.refresh",
      resourceType: "account_deletion_execution", resourceId: executionId, allowed: true,
      policyDecisionId: decisionId, dataClasses,
      metadata: { revision: execution.revision, status: execution.status, blockerCodes: execution.blockerCodes } }));
    return project(execution);
  }

  async reviewLegalHold(context: RequestContext, executionIdValue: unknown, value: unknown) {
    const actor = requireActor(context), decisionId = authorize(context, "ops.review_account_deletion_legal_hold");
    if (actor.activeRole !== "cuac_admin" || context.authStrength !== "step_up") {
      throw forbidden("Step-up CUAC administrator authority is required for legal-hold review.");
    }
    const executionId = inputUuid(executionIdValue, "Execution id");
    const fields = inputRecord(value, ["reviewId", "expectedRevision", "result", "reasonCode", "caseReference"]);
    const reviewId = inputUuid(fields.reviewId, "Review id");
    const expectedRevision = inputInteger(fields.expectedRevision, "Expected revision", 1, 2_147_483_646);
    const resultCode = inputEnum(fields.result, "Legal-hold result", LEGAL_HOLD_RESULTS);
    const reasonCode = inputEnum(fields.reasonCode, "Legal-hold reason", LEGAL_HOLD_REASONS);
    if ((resultCode === "clear_candidate") !== (reasonCode === "no_hold_found")) {
      throw badRequest("Legal-hold result and reason do not match.");
    }
    const caseReference = reference(fields.caseReference);
    const result = await this.repository.recordLegalHoldReview({ ...actor, executionId, reviewId,
      expectedRevision, result: resultCode, reasonCode, caseReference });
    requireAuthority(result); if (!result.value) throw changed();
    const execution = validate(result.value);
    await this.audit.record(buildAuditEvent(context, { action: "ops.account_deletion.legal_hold.review",
      resourceType: "account_deletion_execution", resourceId: executionId, allowed: true,
      policyDecisionId: decisionId, dataClasses, metadata: { reviewId, result: resultCode,
        reasonCode, revision: execution.revision, status: execution.status } }));
    return project(execution);
  }
}

function requireActor(context: RequestContext): Actor {
  if (!context.actorUserId || !["cuac_ops", "cuac_admin"].includes(context.activeRole)
    || context.selectedSurface !== "ops" || context.purpose !== "account_deletion_execution"
    || context.tenantSchoolId !== null || !["session", "step_up"].includes(context.authStrength)) {
    throw forbidden("Authenticated account-deletion execution context is required.");
  }
  return { actorUserId: context.actorUserId, activeRole: context.activeRole as Role };
}
function authorize(context: RequestContext, action: PolicyAction) {
  const decision = evaluatePolicy(context, action, { type: "ops_account_deletion_execution", dataClasses });
  if (!decision.allowed) throw forbidden(decision.reason); return decision.id;
}
function requireAuthority<T>(result: Authorized<T>): asserts result is { authorized: true; value: T } {
  if (!result.authorized) throw forbidden("Active CUAC staff access grant is required.");
}
function reference(value: unknown) { const text = inputText(value, "Case reference", 128);
  if (!/^[A-Za-z0-9._:-]+$/.test(text)) throw badRequest("Case reference is invalid."); return text; }
function changed() { return new CuacError("CONFLICT", "Account-deletion execution changed; reload before retrying.", 409); }
function validate(row: AccountDeletionExecution) {
  if (!uuid(row.executionId) || !uuid(row.dataRightsRequestId) || !Number.isSafeInteger(row.revision) || row.revision < 1
    || !["review_required", "blocked", "quarantined", "purge_ready", "completed"].includes(row.status)
    || !Array.isArray(row.blockerCodes) || new Set(row.blockerCodes).size !== row.blockerCodes.length
    || row.blockerCodes.some(code => !ACCOUNT_DELETION_BLOCKERS.includes(code))
    || !date(row.preparedAt) || !date(row.updatedAt) || row.updatedAt < row.preparedAt) throw unavailable();
  const review = row.latestLegalHoldReview;
  if (review && (!uuid(review.reviewId) || !Number.isSafeInteger(review.version) || review.version < 1
    || !Number.isSafeInteger(review.sourceExecutionRevision) || review.sourceExecutionRevision < 1
    || !LEGAL_HOLD_RESULTS.includes(review.result) || !LEGAL_HOLD_REASONS.includes(review.reasonCode)
    || !uuid(review.reviewedByUserId) || !date(review.reviewedAt) || !/^[A-Za-z0-9._:-]{1,128}$/.test(review.caseReference)
    || ((review.result === "clear_candidate") !== (review.reasonCode === "no_hold_found")))) throw unavailable();
  return row;
}
function project(row: AccountDeletionExecution) { validate(row); return { ...row,
  preparedAt: row.preparedAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  latestLegalHoldReview: row.latestLegalHoldReview ? { ...row.latestLegalHoldReview,
    reviewedAt: row.latestLegalHoldReview.reviewedAt.toISOString() } : null }; }
function uuid(value: string) { return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value); }
function date(value: unknown): value is Date { return value instanceof Date && Number.isFinite(value.getTime()); }
function unavailable() { return serviceUnavailable("Account-deletion execution data is unavailable."); }
