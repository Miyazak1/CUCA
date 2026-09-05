import { buildAuditEvent, type AuditSink } from "../audit/audit.ts";
import { evaluatePolicy } from "../policy/policy.ts";
import { badRequest, forbidden } from "../shared/errors.ts";
import { inputEnum, inputRecord, inputUuid } from "../shared/input.ts";
import type { RequestContext } from "../shared/request-context.ts";

export const OPS_APPLICATION_SUPPORT_REASON_CODES = [
  "student_inquiry",
  "school_inquiry",
  "payment_inquiry",
  "delivery_investigation",
  "incident_response",
] as const;

export type OpsApplicationSupportReasonCode = (typeof OPS_APPLICATION_SUPPORT_REASON_CODES)[number];
export type OpsInternalRole = "cuac_ops" | "cuac_admin";
export const OPS_SUPPORT_ACCESS_SESSION_TTL_MS = 15 * 60 * 1000;

export type OpsSupportAccessSession = {
  supportSessionId: string;
  cuacId: string;
  reasonCode: OpsApplicationSupportReasonCode;
  createdAt: Date;
  expiresAt: Date;
};

export type ResolvedOpsSupportAccessSession = OpsSupportAccessSession & {
  applicationSetId: string;
};

export type OpenOpsSupportAccessSessionResult =
  | { authorized: false }
  | { authorized: true; targetFound: false }
  | { authorized: true; targetFound: true; session: OpsSupportAccessSession };

export type ResolveOpsSupportAccessSessionResult =
  | { authorized: false }
  | { authorized: true; session: ResolvedOpsSupportAccessSession | null };

export type CloseOpsSupportAccessSessionResult =
  | { authorized: false }
  | { authorized: true; closedAt: Date | null };

export type OpsProgramApplicationProjection = {
  applicationId: string;
  schoolId: string;
  schoolName: string;
  programId: string | null;
  programName: string | null;
  programIntakeId: string | null;
  intakeTerm: string | null;
  intakeYear: number | null;
  status: string;
  statusChangedAt: Date;
  submittedAt: Date | null;
  firstViewedAt: Date | null;
};

export type OpsApplicationSupportProjection = {
  cuacId: string;
  applicationSet: {
    status: string;
    targetIntake: string | null;
    revision: number;
    activeChoiceCount: number;
    createdAt: Date;
    updatedAt: Date;
    submittedAt: Date | null;
  };
  submission: {
    status: string;
    submittedAt: Date;
    groupCount: number;
    pendingGroupCount: number;
    dispatchedGroupCount: number;
    quarantinedGroupCount: number;
  } | null;
  programApplications: OpsProgramApplicationProjection[];
};

export type OpsApplicationSupportRepository = {
  openApplicationSupportSession(input: {
    actorUserId: string;
    activeRole: OpsInternalRole;
    cuacId: string;
    reasonCode: OpsApplicationSupportReasonCode;
    ttlMs: number;
  }): Promise<OpenOpsSupportAccessSessionResult>;
  resolveApplicationSupportSession(input: {
    actorUserId: string;
    activeRole: OpsInternalRole;
    supportSessionId: string;
  }): Promise<ResolveOpsSupportAccessSessionResult>;
  closeApplicationSupportSession(input: {
    actorUserId: string;
    activeRole: OpsInternalRole;
    supportSessionId: string;
  }): Promise<CloseOpsSupportAccessSessionResult>;
  findApplicationSupportByCuacId(cuacId: string): Promise<OpsApplicationSupportProjection | null>;
};

export class OpsApplicationSupportService {
  private readonly repository: OpsApplicationSupportRepository;
  private readonly auditSink: AuditSink;

  constructor(
    repository: OpsApplicationSupportRepository,
    auditSink: AuditSink,
  ) {
    this.repository = repository;
    this.auditSink = auditSink;
  }

  async openApplicationSupportSession(
    context: RequestContext,
    input: { cuacId: unknown; reasonCode: unknown },
  ): Promise<OpsSupportAccessSession | null> {
    const actor = requireOpsSupportContext(context);
    const value = inputRecord(input, ["cuacId", "reasonCode"]);
    const cuacId = parseCuacId(value.cuacId);
    const reasonCode = inputEnum(value.reasonCode, "Support reason code", OPS_APPLICATION_SUPPORT_REASON_CODES);
    const decision = evaluatePolicy(context, "ops.open_application_support_session", {
      type: "ops_application_support",
      dataClasses: ["ops_confidential", "public_catalog"],
    });
    if (!decision.allowed) throw forbidden(decision.reason);

    const result = await this.repository.openApplicationSupportSession({
      ...actor, cuacId, reasonCode, ttlMs: OPS_SUPPORT_ACCESS_SESSION_TTL_MS,
    });
    if (!result.authorized) {
      throw forbidden("Active CUAC staff access grant is required.");
    }
    await this.auditSink.record(buildAuditEvent(context, {
      action: "ops.application_support_session.open",
      resourceType: "application_set_reference",
      resourceId: cuacId,
      allowed: true,
      policyDecisionId: decision.id,
      dataClasses: ["ops_confidential", "public_catalog"],
      metadata: {
        reasonCode,
        found: result.targetFound,
        expiresAt: result.targetFound ? result.session.expiresAt.toISOString() : null,
      },
    }));
    return result.targetFound ? result.session : null;
  }

  async getApplicationBySupportSession(
    context: RequestContext,
    input: { supportSessionId: unknown },
  ): Promise<OpsApplicationSupportProjection> {
    const actor = requireOpsSupportContext(context);
    const value = inputRecord(input, ["supportSessionId"]);
    const supportSessionId = inputUuid(value.supportSessionId, "Support session id");
    const decision = evaluatePolicy(context, "ops.read_application_support", {
      type: "ops_application_support",
      dataClasses: ["ops_confidential", "public_catalog"],
    });
    if (!decision.allowed) throw forbidden(decision.reason);

    const resolved = await this.repository.resolveApplicationSupportSession({ ...actor, supportSessionId });
    if (!resolved.authorized) throw forbidden("Active CUAC staff access grant is required.");
    if (!resolved.session) throw forbidden("Active application support session is required.");
    const result = await this.repository.findApplicationSupportByCuacId(resolved.session.cuacId);
    if (!result) throw forbidden("Active application support session is required.");
    await this.auditSink.record(buildAuditEvent(context, {
      action: "ops.application_support.lookup",
      resourceType: "application_set_reference",
      resourceId: resolved.session.cuacId,
      allowed: true,
      policyDecisionId: decision.id,
      dataClasses: ["ops_confidential", "public_catalog"],
      metadata: {
        reasonCode: resolved.session.reasonCode,
        programApplicationCount: result.programApplications.length,
      },
    }));
    return result;
  }

  async closeApplicationSupportSession(
    context: RequestContext,
    supportSessionIdInput: unknown,
  ): Promise<{ supportSessionId: string; closed: boolean; closedAt: Date | null }> {
    const actor = requireOpsSupportContext(context);
    const supportSessionId = inputUuid(supportSessionIdInput, "Support session id");
    const decision = evaluatePolicy(context, "ops.close_application_support_session", {
      type: "ops_application_support",
      dataClasses: ["ops_confidential"],
    });
    if (!decision.allowed) throw forbidden(decision.reason);
    const result = await this.repository.closeApplicationSupportSession({ ...actor, supportSessionId });
    if (!result.authorized) throw forbidden("Active CUAC staff access grant is required.");
    await this.auditSink.record(buildAuditEvent(context, {
      action: "ops.application_support_session.close",
      resourceType: "ops_support_access_session",
      resourceId: supportSessionId,
      allowed: true,
      policyDecisionId: decision.id,
      dataClasses: ["ops_confidential"],
      metadata: { closed: result.closedAt !== null },
    }));
    return { supportSessionId, closed: result.closedAt !== null, closedAt: result.closedAt };
  }
}

function requireOpsSupportContext(context: RequestContext): { actorUserId: string; activeRole: OpsInternalRole } {
  if (!context.actorUserId || (context.activeRole !== "cuac_ops" && context.activeRole !== "cuac_admin")
    || context.selectedSurface !== "ops" || context.purpose !== "ops_support" || context.tenantSchoolId !== null
    || (context.authStrength !== "session" && context.authStrength !== "step_up")) {
    throw forbidden("Authenticated CUAC support context is required.");
  }
  return { actorUserId: context.actorUserId, activeRole: context.activeRole };
}

function parseCuacId(value: unknown): string {
  if (typeof value !== "string" || !/^CUAC-[0-9]{4}-[0-9]{6}$/.test(value)) {
    throw badRequest("CUAC ID must use the CUAC-YYYY-NNNNNN format.");
  }
  return value;
}
