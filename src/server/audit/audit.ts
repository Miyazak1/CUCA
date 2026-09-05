import { redactSensitive } from "./redaction.ts";
import type { DataClass, RequestContext } from "../shared/request-context.ts";

export type AuditEvent = {
  requestId: string;
  actorUserId: string | null;
  actorType?: "user" | "guest" | "service" | "system";
  activeRole: string;
  tenantSchoolId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  allowed: boolean;
  policyDecisionId: string | null;
  dataClasses: readonly DataClass[];
  metadata: unknown;
};

export type AuditSink = {
  record(event: AuditEvent): Promise<void>;
};

export function buildAuditEvent(
  context: RequestContext,
  input: Omit<AuditEvent, "requestId" | "actorUserId" | "actorType" | "activeRole" | "tenantSchoolId" | "metadata"> & {
    actorType?: AuditEvent["actorType"];
    metadata?: unknown;
  },
): AuditEvent {
  return {
    requestId: context.requestId,
    actorUserId: context.actorUserId,
    actorType: input.actorType ?? (context.actorUserId ? "user" : "guest"),
    activeRole: context.activeRole,
    tenantSchoolId: context.tenantSchoolId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    allowed: input.allowed,
    policyDecisionId: input.policyDecisionId,
    dataClasses: input.dataClasses,
    metadata: redactSensitive(input.metadata ?? {}),
  };
}
