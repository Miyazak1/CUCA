import { createHash, randomUUID } from "node:crypto";
import { buildAuditEvent, type AuditSink } from "../audit/audit.ts";
import { evaluatePolicy } from "../policy/policy.ts";
import { badRequest, conflict, forbidden } from "../shared/errors.ts";
import { inputEnum, inputInteger, inputRecord, inputUuid } from "../shared/input.ts";
import type { RequestContext } from "../shared/request-context.ts";

export const DATA_RIGHTS_REQUEST_TYPES = ["access", "correction", "portable_export", "account_deletion"] as const;
export const DATA_RIGHTS_CORRECTION_SCOPES = ["account", "applicant_profile", "education", "assessment", "application", "other"] as const;
export const DATA_RIGHTS_LOCALES = ["en", "zh-CN"] as const;
export type DataRightsRequestType = typeof DATA_RIGHTS_REQUEST_TYPES[number];
export type DataRightsCorrectionScope = typeof DATA_RIGHTS_CORRECTION_SCOPES[number];

export type DataRightsRequestDto = {
  requestId: string; requestType: DataRightsRequestType; correctionScope: DataRightsCorrectionScope | null;
  preferredLocale: typeof DATA_RIGHTS_LOCALES[number]; status: string; revision: number;
  receivedAt: string; identityConfirmedAt: string | null; closedAt: string | null; updatedAt: string;
};

type StoredRequest = Omit<DataRightsRequestDto, "requestId" | "receivedAt" | "identityConfirmedAt" | "closedAt" | "updatedAt"> & {
  id: string; receivedAt: Date; identityConfirmedAt: Date | null; closedAt: Date | null; updatedAt: Date;
};

export type DataRightsRepository = {
  listOwn(userId: string): Promise<{ authorized: boolean; rows: StoredRequest[] }>;
  createOwn(input: { requestId: string; userId: string; subjectReferenceHash: string; requestType: DataRightsRequestType;
    correctionScope: DataRightsCorrectionScope | null; preferredLocale: typeof DATA_RIGHTS_LOCALES[number] }): Promise<{ authorized: boolean; row: StoredRequest | null }>;
  cancelOwn(input: { requestId: string; userId: string; expectedRevision: number }): Promise<{ authorized: boolean; row: StoredRequest | null }>;
  confirmOwn(input: { requestId: string; confirmationId: string; userId: string; expectedRevision: number;
    subjectReferenceHash: string; confirmationReferenceSha256: string }): Promise<{ authorized: boolean; row: StoredRequest | null }>;
};

export class DataRightsService {
  private readonly repository: DataRightsRepository;
  private readonly audit: AuditSink;
  constructor(repository: DataRightsRepository, audit: AuditSink) { this.repository = repository; this.audit = audit; }

  async listOwn(context: RequestContext): Promise<DataRightsRequestDto[]> {
    const { userId } = authorize(context, "student.read_data_rights");
    const result = await this.repository.listOwn(userId);
    if (!result.authorized) throw forbidden("Active student account is required.");
    return result.rows.map(project);
  }

  async createOwn(context: RequestContext, value: unknown): Promise<DataRightsRequestDto> {
    const { userId, decisionId } = authorize(context, "student.manage_data_rights");
    const fields = inputRecord(value, ["requestId", "requestType", "correctionScope", "preferredLocale"]);
    const requestId = inputUuid(fields.requestId, "Request id");
    const requestType = inputEnum(fields.requestType, "Request type", DATA_RIGHTS_REQUEST_TYPES);
    const preferredLocale = inputEnum(fields.preferredLocale, "Preferred locale", DATA_RIGHTS_LOCALES);
    const correctionScope = requestType === "correction"
      ? inputEnum(fields.correctionScope, "Correction scope", DATA_RIGHTS_CORRECTION_SCOPES)
      : fields.correctionScope === null ? null : (() => { throw badRequest("Correction scope is only allowed for correction requests."); })();
    if (["portable_export", "account_deletion"].includes(requestType) && context.authStrength !== "step_up") {
      throw forbidden("Fresh authentication is required for export or account deletion requests.");
    }
    const result = await this.repository.createOwn({ requestId, userId, subjectReferenceHash: subjectReference(userId),
      requestType, correctionScope, preferredLocale });
    if (!result.authorized) throw forbidden("Active student account is required.");
    if (!result.row) throw conflict("An active request of this type already exists.");
    let created = result.row;
    const sensitive = ["portable_export", "account_deletion"].includes(requestType);
    if (sensitive) {
      const confirmed = await this.repository.confirmOwn({ requestId, confirmationId: randomUUID(), userId, expectedRevision: created.revision,
        subjectReferenceHash: subjectReference(userId), confirmationReferenceSha256: confirmationReference(userId, requestId, context.requestId) });
      if (!confirmed.authorized) throw forbidden("Active student account is required.");
      if (!confirmed.row) throw conflict("The new request could not be identity-confirmed.");
      created = confirmed.row;
    }
    await this.audit.record(buildAuditEvent(context, { action: "data_rights.request.create", resourceType: "data_rights_request",
      resourceId: requestId, allowed: true, policyDecisionId: decisionId, dataClasses: ["student_pii"],
      metadata: { requestType, correctionScope, preferredLocale, identityConfirmed: sensitive } }));
    return project(created);
  }

  async confirmOwn(context: RequestContext, requestIdValue: unknown, value: unknown): Promise<DataRightsRequestDto> {
    const { userId, decisionId } = authorize(context, "student.manage_data_rights");
    if (context.authStrength !== "step_up") throw forbidden("Fresh authentication is required to confirm identity.");
    const requestId = inputUuid(requestIdValue, "Request id"), fields = inputRecord(value, ["confirmationId", "expectedRevision"]);
    const confirmationId = inputUuid(fields.confirmationId, "Confirmation id");
    const expectedRevision = inputInteger(fields.expectedRevision, "Expected revision", 1, 2_147_483_646);
    const result = await this.repository.confirmOwn({ requestId, confirmationId, userId, expectedRevision,
      subjectReferenceHash: subjectReference(userId), confirmationReferenceSha256: confirmationReference(userId, requestId, context.requestId) });
    if (!result.authorized) throw forbidden("Active student account is required.");
    if (!result.row) throw conflict("Only a current received request can be identity-confirmed.");
    await this.audit.record(buildAuditEvent(context, { action: "data_rights.request.identity_confirm", resourceType: "data_rights_request",
      resourceId: requestId, allowed: true, policyDecisionId: decisionId, dataClasses: ["student_pii"],
      metadata: { method: "password_step_up", revision: result.row.revision } }));
    return project(result.row);
  }

  async cancelOwn(context: RequestContext, requestIdValue: unknown, value: unknown): Promise<DataRightsRequestDto> {
    const { userId, decisionId } = authorize(context, "student.manage_data_rights");
    const requestId = inputUuid(requestIdValue, "Request id"), fields = inputRecord(value, ["expectedRevision"]);
    const expectedRevision = inputInteger(fields.expectedRevision, "Expected revision", 1, 2_147_483_647);
    const result = await this.repository.cancelOwn({ requestId, userId, expectedRevision });
    if (!result.authorized) throw forbidden("Active student account is required.");
    if (!result.row) throw conflict("Only a current unclaimed request can be cancelled.");
    await this.audit.record(buildAuditEvent(context, { action: "data_rights.request.cancel", resourceType: "data_rights_request",
      resourceId: requestId, allowed: true, policyDecisionId: decisionId, dataClasses: ["student_pii"],
      metadata: { expectedRevision } }));
    return project(result.row);
  }
}

function authorize(context: RequestContext, action: "student.read_data_rights" | "student.manage_data_rights"): { userId: string; decisionId: string } {
  if (!context.actorUserId) throw forbidden("Authenticated student account is required.");
  const decision = evaluatePolicy(context, action, { type: "data_rights_request", ownerUserId: context.actorUserId, dataClasses: ["student_pii"] });
  if (!decision.allowed) throw forbidden(decision.reason);
  return { userId: context.actorUserId, decisionId: decision.id };
}

function subjectReference(userId: string): string {
  return `sha256:${createHash("sha256").update(`cuac-data-rights:${userId}`).digest("hex")}`;
}

function confirmationReference(userId: string, requestId: string, auditRequestId: string): string {
  return `sha256:${createHash("sha256").update(`cuac-data-rights-confirmation:${userId}:${requestId}:${auditRequestId}`).digest("hex")}`;
}

function project(row: StoredRequest): DataRightsRequestDto {
  return { requestId: row.id, requestType: row.requestType, correctionScope: row.correctionScope,
    preferredLocale: row.preferredLocale, status: row.status, revision: row.revision,
    receivedAt: row.receivedAt.toISOString(), identityConfirmedAt: row.identityConfirmedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null, updatedAt: row.updatedAt.toISOString() };
}
