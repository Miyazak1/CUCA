import { createHash } from "node:crypto";
import { buildAuditEvent, type AuditSink } from "../audit/audit.ts";
import { materializeDataRightsNotification, type NotificationEventMaterialization } from "../notifications/templates.ts";
import { evaluatePolicy } from "../policy/policy.ts";
import { badRequest, CuacError, forbidden } from "../shared/errors.ts";
import { inputEnum, inputInteger, inputRecord, inputText, inputUuid } from "../shared/input.ts";
import type { RequestContext } from "../shared/request-context.ts";

export const OPS_DATA_RIGHTS_ESCALATION_CODES = ["identity_verification_required", "legal_review_required",
  "security_review_required", "retention_exception_review"] as const;
export const OPS_DATA_RIGHTS_OUTCOMES = ["access_ready","correction_ready","portable_export_ready",
  "account_deletion_ready","request_denied","retention_exception"] as const;
export const DATA_RIGHTS_EXTENSION_REASONS = ["request_complexity","exceptional_volume","legal_retention_review",
  "third_party_dependency","service_disruption_recovery"] as const;
const OUTCOME_REASONS = ["identity_not_proven","request_out_of_scope","legal_restriction",
  "legal_hold","fraud_or_security","financial_record"] as const;
type Role = "cuac_ops" | "cuac_admin";
type Actor = { actorUserId: string; activeRole: Role };
export type OpsDataRightsReview = { reviewId: string; revision: number; status: "investigating" | "escalated";
  assignedUserId: string; assignedRole: Role; escalationCode: string | null; escalationReference: string | null;
  escalatedAt: Date | null; createdAt: Date; updatedAt: Date };
export type OpsDataRightsQueueRow = { requestId: string; requestType: string; correctionScope: string | null;
  preferredLocale: string; status: string; revision: number; receivedAt: Date; updatedAt: Date;
  identityConfirmedAt: Date | null; deadlinePolicyVersion: "data_rights_response_v1";
  internalTargetAt: Date; responseDueAt: Date; extendedDueAt: Date | null; observedAt: Date;
  notificationRecipientUserId:string|null;
  review: OpsDataRightsReview | null; extension:OpsDataRightsExtension|null; outcome: OpsDataRightsOutcome | null };
export type OpsDataRightsExtension={extensionId:string;reasonCode:typeof DATA_RIGHTS_EXTENSION_REASONS[number];caseReference:string;
  originalResponseDueAt:Date;extendedDueAt:Date;approvedAt:Date;approvedByUserId:string};
export type OpsDataRightsOutcome = { outcomeId:string; outcomeCode:typeof OPS_DATA_RIGHTS_OUTCOMES[number];reasonCode:string|null;
  caseReference:string;proposalSha256:string;approvalMode:"single_operator"|"single_admin"|"dual_control";
  status:"proposed"|"approved";revision:number;proposedByUserId:string;proposedByRole:Role;
  approvedByUserId:string|null;approvedAt:Date|null;createdAt:Date;updatedAt:Date };
type Authorized<T> = { authorized: false } | { authorized: true; value: T };
export type OpsDataRightsRepository = {
  list(input: Actor & { limit: number }): Promise<Authorized<OpsDataRightsQueueRow[]>>;
  claim(input: Actor & { requestId: string; expectedRevision: number }): Promise<Authorized<OpsDataRightsQueueRow | null>>;
  escalate(input: Actor & { requestId: string; expectedRevision: number; expectedReviewRevision: number;
    code: typeof OPS_DATA_RIGHTS_ESCALATION_CODES[number]; reference: string }): Promise<Authorized<OpsDataRightsQueueRow | null>>;
  extend(input:Actor&{requestId:string;extensionId:string;expectedRevision:number;expectedReviewRevision:number;
    reasonCode:typeof DATA_RIGHTS_EXTENSION_REASONS[number];caseReference:string;extendedDueAt:Date}):Promise<Authorized<OpsDataRightsQueueRow|null>>;
  propose(input: Actor & { requestId:string;proposalId:string;expectedRevision:number;expectedReviewRevision:number;
    outcomeCode:typeof OPS_DATA_RIGHTS_OUTCOMES[number];reasonCode:string|null;caseReference:string;proposalSha256:string;
    approvalMode:OpsDataRightsOutcome["approvalMode"] }):Promise<Authorized<OpsDataRightsQueueRow|null>>;
  approve(input: Actor & { requestId:string;expectedOutcomeRevision:number;expectedProposalSha256:string }):Promise<Authorized<OpsDataRightsQueueRow|null>>;
};

export class OpsDataRightsService {
  private readonly repository: OpsDataRightsRepository;
  private readonly audit: AuditSink;
  private readonly notifications:{publish(input:NotificationEventMaterialization):Promise<unknown>};
  constructor(repository: OpsDataRightsRepository, audit: AuditSink,
    notifications:{publish(input:NotificationEventMaterialization):Promise<unknown>}={async publish(){}}) {
    this.repository = repository; this.audit = audit;this.notifications=notifications;
  }
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
    if(result.value.notificationRecipientUserId)await this.notifications.publish(materializeDataRightsNotification({
      recipientUserId:result.value.notificationRecipientUserId,requestId:result.value.requestId,
      eventType:"data_rights_review_started",locale:result.value.preferredLocale,
      transitionReference:result.value.review!.reviewId,occurredAt:result.value.review!.createdAt}));
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
  async extend(context:RequestContext,requestIdValue:unknown,value:unknown){
    const actor=requireActor(context),decisionId=authorize(context,"ops.extend_data_rights_deadline");
    if(actor.activeRole!=="cuac_admin"||context.authStrength!=="step_up")throw forbidden("Step-up CUAC administrator approval is required for an extension.");
    const requestId=inputUuid(requestIdValue,"Request id"),fields=inputRecord(value,
      ["extensionId","expectedRevision","expectedReviewRevision","reasonCode","caseReference","extendedDueAt"]);
    const extensionId=inputUuid(fields.extensionId,"Extension id");
    const expectedRevision=inputInteger(fields.expectedRevision,"Expected revision",1,2_147_483_646);
    const expectedReviewRevision=inputInteger(fields.expectedReviewRevision,"Expected review revision",1,2);
    const reasonCode=inputEnum(fields.reasonCode,"Extension reason",DATA_RIGHTS_EXTENSION_REASONS);
    const caseReference=reference(fields.caseReference),extendedDueAt=parseExtensionDate(fields.extendedDueAt);
    const result=await this.repository.extend({...actor,requestId,extensionId,expectedRevision,expectedReviewRevision,
      reasonCode,caseReference,extendedDueAt});requireAuthority(result);if(!result.value)throw changed();
    await this.audit.record(buildAuditEvent(context,{action:"ops.data_rights.deadline.extend",resourceType:"data_rights_request",
      resourceId:requestId,allowed:true,policyDecisionId:decisionId,dataClasses,metadata:{extensionId,reasonCode,
        extendedDueAt:result.value.extendedDueAt?.toISOString(),revision:result.value.revision}}));
    if(result.value.notificationRecipientUserId)await this.notifications.publish(materializeDataRightsNotification({
      recipientUserId:result.value.notificationRecipientUserId,requestId,eventType:"data_rights_deadline_extended",
      locale:result.value.preferredLocale,transitionReference:extensionId,occurredAt:result.value.extension!.approvedAt,
      extendedDueDate:result.value.extension!.extendedDueAt.toISOString().slice(0,10),extensionReasonCode:reasonCode}));
    return project(result.value);
  }
  async propose(context:RequestContext,requestIdValue:unknown,value:unknown){
    const actor=requireActor(context), fields=inputRecord(value,["proposalId","expectedRevision","expectedReviewRevision","outcomeCode","reasonCode","caseReference"]);
    const requestId=inputUuid(requestIdValue,"Request id"),proposalId=inputUuid(fields.proposalId,"Proposal id");
    const expectedRevision=inputInteger(fields.expectedRevision,"Expected revision",1,2_147_483_646);
    const expectedReviewRevision=inputInteger(fields.expectedReviewRevision,"Expected review revision",1,2);
    const outcomeCode=inputEnum(fields.outcomeCode,"Outcome code",OPS_DATA_RIGHTS_OUTCOMES);
    const reasonCode=parseReason(outcomeCode,fields.reasonCode),caseReference=reference(fields.caseReference);
    const approvalMode=mode(outcomeCode);
    const action=approvalMode==="single_admin"?"ops.approve_data_rights_outcome":"ops.propose_data_rights_outcome";
    const decisionId=authorize(context,action);
    if(approvalMode==="single_admin"&&(actor.activeRole!=="cuac_admin"||context.authStrength!=="step_up"))throw forbidden("Step-up CUAC administrator approval is required for an export.");
    const proposalSha256=digest({requestId,expectedRevision,expectedReviewRevision,outcomeCode,reasonCode,caseReference});
    const result=await this.repository.propose({...actor,requestId,proposalId,expectedRevision,expectedReviewRevision,outcomeCode,reasonCode,caseReference,proposalSha256,approvalMode});
    requireAuthority(result);if(!result.value)throw changed();
    await this.audit.record(buildAuditEvent(context,{action:"ops.data_rights.outcome.propose",resourceType:"data_rights_request",resourceId:requestId,
      allowed:true,policyDecisionId:decisionId,dataClasses,metadata:{outcomeId:proposalId,outcomeCode,approvalMode,proposalSha256}}));
    return project(result.value);
  }
  async approve(context:RequestContext,requestIdValue:unknown,value:unknown){
    const actor=requireActor(context),decisionId=authorize(context,"ops.approve_data_rights_outcome");
    if(actor.activeRole!=="cuac_admin"||context.authStrength!=="step_up")throw forbidden("Step-up CUAC administrator approval is required.");
    const requestId=inputUuid(requestIdValue,"Request id"),fields=inputRecord(value,["expectedOutcomeRevision","expectedProposalSha256"]);
    const expectedOutcomeRevision=inputInteger(fields.expectedOutcomeRevision,"Expected outcome revision",1,1);
    const expectedProposalSha256=inputText(fields.expectedProposalSha256,"Expected proposal digest",71);
    if(!/^sha256:[a-f0-9]{64}$/.test(expectedProposalSha256))throw badRequest("Expected proposal digest is invalid.");
    const result=await this.repository.approve({...actor,requestId,expectedOutcomeRevision,expectedProposalSha256});requireAuthority(result);
    if(!result.value)throw changed();
    await this.audit.record(buildAuditEvent(context,{action:"ops.data_rights.outcome.approve",resourceType:"data_rights_request",resourceId:requestId,
      allowed:true,policyDecisionId:decisionId,dataClasses,metadata:{outcomeId:result.value.outcome?.outcomeId,
        outcomeCode:result.value.outcome?.outcomeCode,proposalSha256:expectedProposalSha256}}));return project(result.value);
  }
}
const dataClasses = ["ops_confidential", "audit_security"] as const;
function requireActor(context: RequestContext): Actor {
  if (!context.actorUserId || !["cuac_ops", "cuac_admin"].includes(context.activeRole)
    || context.selectedSurface !== "ops" || context.purpose !== "data_rights_review" || context.tenantSchoolId !== null
    || !["session", "step_up"].includes(context.authStrength)) throw forbidden("Authenticated data-rights review context is required.");
  return { actorUserId: context.actorUserId, activeRole: context.activeRole as Role };
}
function authorize(context: RequestContext, action: "ops.read_data_rights_review" | "ops.claim_data_rights_review" | "ops.escalate_data_rights_review"|"ops.extend_data_rights_deadline"|"ops.propose_data_rights_outcome"|"ops.approve_data_rights_outcome") {
  const decision = evaluatePolicy(context, action, { type: "ops_data_rights_review", dataClasses });
  if (!decision.allowed) throw forbidden(decision.reason); return decision.id;
}
function requireAuthority<T>(result: Authorized<T>): asserts result is { authorized: true; value: T } {
  if (!result.authorized) throw forbidden("Active CUAC staff access grant is required.");
}
function project(row: OpsDataRightsQueueRow) { const {observedAt,notificationRecipientUserId,...safe}=row,effectiveDueAt=row.extendedDueAt??row.responseDueAt;
  void observedAt;void notificationRecipientUserId;return { ...safe,
  receivedAt: row.receivedAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  identityConfirmedAt: row.identityConfirmedAt?.toISOString() ?? null,
  internalTargetAt:row.internalTargetAt.toISOString(),responseDueAt:row.responseDueAt.toISOString(),
  extendedDueAt:row.extendedDueAt?.toISOString()??null,effectiveDueAt:effectiveDueAt.toISOString(),deadlineState:deadlineState(row),
  review: row.review ? { ...row.review, escalatedAt: row.review.escalatedAt?.toISOString() ?? null,
    createdAt: row.review.createdAt.toISOString(), updatedAt: row.review.updatedAt.toISOString() } : null,
  extension:row.extension?{...row.extension,originalResponseDueAt:row.extension.originalResponseDueAt.toISOString(),
    extendedDueAt:row.extension.extendedDueAt.toISOString(),approvedAt:row.extension.approvedAt.toISOString()}:null,
  outcome:row.outcome?{...row.outcome,approvedAt:row.outcome.approvedAt?.toISOString()??null,
    createdAt:row.outcome.createdAt.toISOString(),updatedAt:row.outcome.updatedAt.toISOString()}:null }; }
export function deadlineState(row: Pick<OpsDataRightsQueueRow,"internalTargetAt"|"responseDueAt"|"extendedDueAt"|"observedAt">) {
  const day=86_400_000,now=row.observedAt.getTime(),target=row.internalTargetAt.getTime();
  const due=(row.extendedDueAt??row.responseDueAt).getTime();
  if(now>due)return"overdue" as const;
  if(now>=due-6*day)return"response_due_soon" as const;
  if(now>=target)return"internal_target_missed" as const;
  if(now>=target-3*day)return"internal_due_soon" as const;
  return"on_track" as const;
}
function changed() { return new CuacError("CONFLICT", "Data-rights review state changed; reload before retrying.", 409); }
function mode(code:typeof OPS_DATA_RIGHTS_OUTCOMES[number]):OpsDataRightsOutcome["approvalMode"]{if(code==="portable_export_ready")return"single_admin";
  if(["account_deletion_ready","request_denied","retention_exception"].includes(code))return"dual_control";return"single_operator";}
function parseReason(code:typeof OPS_DATA_RIGHTS_OUTCOMES[number],value:unknown):string|null{const needs=["request_denied","retention_exception"].includes(code);
  if(!needs){if(value!==null)throw badRequest("Reason code is not allowed for this outcome.");return null;}
  const parsed=inputEnum(value,"Reason code",OUTCOME_REASONS);
  if(code==="request_denied"&&!OUTCOME_REASONS.slice(0,3).includes(parsed as never))throw badRequest("Denial reason is invalid.");
  if(code==="retention_exception"&&!OUTCOME_REASONS.slice(3).includes(parsed as never))throw badRequest("Retention reason is invalid.");return parsed;}
function reference(value:unknown){const v=inputText(value,"Case reference",128);if(!/^[A-Za-z0-9._:-]+$/.test(v))throw badRequest("Case reference is invalid.");return v;}
function parseExtensionDate(value:unknown){const text=inputText(value,"Extended due date",40),date=new Date(text);
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(text)||!Number.isFinite(date.getTime()))throw badRequest("Extended due date must be a UTC timestamp.");return date;}
function digest(value:unknown){return`sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;}
