import { buildAuditEvent, type AuditSink } from "../audit/audit.ts";
import { evaluatePolicy } from "../policy/policy.ts";
import { CuacError, forbidden } from "../shared/errors.ts";
import { inputUuid } from "../shared/input.ts";
import type { DataClass } from "../shared/request-context.ts";
import type { RequestContext } from "../shared/request-context.ts";
import { materializeSchoolApplicationStatusNotification } from "../notifications/templates.ts";
import type { NotificationEventMaterialization } from "../notifications/templates.ts";
import {
  parseSchoolApplicationContactCommand,
  parseSchoolApplicationStatusCommand,
  schoolWorkflowCommandDigests,
  type SchoolApplicationContactCommand,
  type SchoolApplicationStatusCommand,
  type SchoolApplicationWorkflowStatus,
  type SchoolContactChannel,
  type SchoolContactDirection,
  type SchoolContactOutcome,
} from "./workflow.ts";

export type SchoolApplicationQueueItemDto = {
  id: string;
  applicationRecordFormat: string;
  cuacId: string | null;
  schoolId: string;
  studentUserId: string;
  programId: string | null;
  programIntakeId: string | null;
  status: string;
  schoolRevision: number;
  statusChangedAt: Date;
  submittedAt: Date | null;
  firstViewedAt: Date | null;
  schoolVisibleProfile: Record<string, unknown>;
  routingMetadata: Record<string, unknown>;
};

export type SchoolApplicationDetailDto = SchoolApplicationQueueItemDto & {
  statusEvents: SchoolApplicationStatusEventDto[];
  contactLogs: SchoolApplicationContactLogDto[];
};

export type SchoolApplicationStatusEventDto = {
  id: string;
  schoolApplicationId: string;
  actorUserId: string | null;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  applicationRevision: number | null;
  createdAt: Date;
};

export type SchoolApplicationContactLogDto = {
  id: string;
  schoolApplicationId: string;
  actorUserId: string;
  channel: SchoolContactChannel;
  direction: SchoolContactDirection;
  outcome: SchoolContactOutcome;
  note: string;
  createdAt: Date;
};

export type SchoolApplicationStatusMutationDto = {
  id: string;
  schoolId: string;
  status: SchoolApplicationWorkflowStatus;
  schoolRevision: number;
  statusChangedAt: Date;
  statusEventId: string;
};

export type SchoolWorkflowCommandOptions = { idempotencyKey?: string };

export type SchoolPortalRepository = {
  listApplicationQueueBySchoolId(schoolId: string, cuacId?: string): Promise<SchoolApplicationQueueItemDto[]>;
  getApplicationById(applicationId: string, schoolId: string): Promise<SchoolApplicationDetailDto | null>;
  updateApplicationStatus(input: {
    applicationId: string;
    schoolId: string;
    actorUserId: string;
    command: SchoolApplicationStatusCommand;
    keyHash: string;
    requestHash: string;
  }): Promise<{ result: SchoolApplicationStatusMutationDto; changed: boolean; fromStatus: string;
    recipientStudentUserId: string; recipientApplicationSetId: string }>;
  recordApplicationContact(input: {
    applicationId: string;
    schoolId: string;
    actorUserId: string;
    command: SchoolApplicationContactCommand;
    keyHash: string;
    requestHash: string;
  }): Promise<{ contact: SchoolApplicationContactLogDto; created: boolean }>;
};

export class SchoolPortalService {
  private readonly repository: SchoolPortalRepository;
  private readonly auditSink: AuditSink | null;
  private readonly notifications: { publish(input: NotificationEventMaterialization): Promise<{ eventId: string; created: boolean }> } | null;

  constructor(repository: SchoolPortalRepository, auditSink: AuditSink | null = null,
    notifications: { publish(input: NotificationEventMaterialization): Promise<{ eventId: string; created: boolean }> } | null = null) {
    this.repository = repository;
    this.auditSink = auditSink;
    this.notifications = notifications;
  }

  async listTenantApplicationQueue(context: RequestContext, options: { cuacId?: string } = {}): Promise<SchoolApplicationQueueItemDto[]> {
    const schoolId = requireSchoolTenant(context);
    authorizeTenantProjection(context, schoolId);
    const cuacId = options.cuacId === undefined ? undefined : parseCuacId(options.cuacId);
    const queue = await this.repository.listApplicationQueueBySchoolId(schoolId, cuacId);
    await this.recordAudit(context, {
      action: "school.application_queue.list",
      resourceType: "school_application_queue",
      resourceId: schoolId,
      dataClasses: ["tenant_confidential", "education_record"],
      metadata: {
        schoolId,
        filteredByCuacId: cuacId !== undefined,
        resultCount: queue.length,
      },
    });
    return queue;
  }

  async getTenantApplication(context: RequestContext, applicationId: string): Promise<SchoolApplicationDetailDto | null> {
    const schoolId = requireSchoolTenant(context);
    authorizeTenantProjection(context, schoolId);
    const application = await this.repository.getApplicationById(inputUuid(applicationId, "applicationId"), schoolId);

    if (!application) {
      return null;
    }

    authorizeTenantProjection(context, application.schoolId);

    if (application.schoolId !== schoolId) {
      throw forbidden("School tenant mismatch.");
    }

    await this.recordAudit(context, {
      action: "school.application.read_projection",
      resourceType: "school_application",
      resourceId: application.id,
      dataClasses: ["tenant_confidential", "education_record"],
      metadata: {
        schoolId: application.schoolId,
        status: application.status,
        hasProgramId: Boolean(application.programId),
        statusEventCount: application.statusEvents.length,
      },
    });
    return application;
  }

  async updateTenantApplicationStatus(
    context: RequestContext,
    applicationId: string,
    input: SchoolApplicationStatusCommand,
    options: SchoolWorkflowCommandOptions = {},
  ): Promise<SchoolApplicationStatusMutationDto> {
    const { schoolId, actorUserId } = authorizeTenantWorkflow(context);
    const normalizedId = inputUuid(applicationId, "applicationId");
    const command = parseSchoolApplicationStatusCommand(input);
    const digests = schoolWorkflowCommandDigests("status.change", command, options.idempotencyKey);
    const mutation = await this.repository.updateApplicationStatus({
      applicationId: normalizedId,
      schoolId,
      actorUserId,
      command,
      ...digests,
    });
    if (mutation.changed) {
      const notification = this.notifications ? await this.notifications.publish(materializeSchoolApplicationStatusNotification({
        recipientUserId: mutation.recipientStudentUserId,
        schoolApplicationId: mutation.result.id,
        applicationSetId: mutation.recipientApplicationSetId,
        statusEventId: mutation.result.statusEventId,
        status: mutation.result.status,
        occurredAt: mutation.result.statusChangedAt,
      })) : null;
      await this.recordAudit(context, {
        action: "school.application.status.change",
        resourceType: "school_application",
        resourceId: normalizedId,
        dataClasses: ["tenant_confidential", "education_record"],
        metadata: {
          schoolId,
          fromStatus: mutation.fromStatus,
          toStatus: mutation.result.status,
          schoolRevision: mutation.result.schoolRevision,
          hasReason: command.reason !== null,
          ...(notification ? { notificationCreated: notification.created } : {}),
        },
      });
    }
    return mutation.result;
  }

  async recordTenantApplicationContact(
    context: RequestContext,
    applicationId: string,
    input: SchoolApplicationContactCommand,
    options: SchoolWorkflowCommandOptions = {},
  ): Promise<SchoolApplicationContactLogDto> {
    const { schoolId, actorUserId } = authorizeTenantWorkflow(context);
    const normalizedId = inputUuid(applicationId, "applicationId");
    const command = parseSchoolApplicationContactCommand(input);
    const digests = schoolWorkflowCommandDigests("contact.record", command, options.idempotencyKey);
    const mutation = await this.repository.recordApplicationContact({
      applicationId: normalizedId,
      schoolId,
      actorUserId,
      command,
      ...digests,
    });
    if (mutation.created) {
      await this.recordAudit(context, {
        action: "school.application.contact.record",
        resourceType: "school_application_contact",
        resourceId: mutation.contact.id,
        dataClasses: ["tenant_confidential", "education_record"],
        metadata: {
          schoolId,
          schoolApplicationId: normalizedId,
          channel: command.channel,
          direction: command.direction,
          outcome: command.outcome,
        },
      });
    }
    return mutation.contact;
  }

  private async recordAudit(
    context: RequestContext,
    input: {
      action: string;
      resourceType: string;
      resourceId: string | null;
      dataClasses: readonly DataClass[];
      metadata?: unknown;
    },
  ) {
    if (!this.auditSink) {
      return;
    }

    await this.auditSink.record(
      buildAuditEvent(context, {
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        allowed: true,
        policyDecisionId: context.policyDecisionId,
        dataClasses: input.dataClasses,
        metadata: input.metadata,
      }),
    );
  }
}

function parseCuacId(value: unknown): string {
  if (typeof value !== "string" || !/^CUAC-[0-9]{4}-[0-9]{6}$/.test(value)) {
    throw new CuacError("BAD_REQUEST", "CUAC ID must use the CUAC-YYYY-NNNNNN format.", 400);
  }
  return value;
}

function requireSchoolTenant(context: RequestContext): string {
  if (context.activeRole !== "school_staff" || !context.actorUserId || !context.tenantSchoolId) {
    throw forbidden("Authenticated school staff tenant context is required.");
  }

  return context.tenantSchoolId;
}

function authorizeTenantProjection(context: RequestContext, schoolId: string) {
  const decision = evaluatePolicy(context, "school.read_tenant_projection", {
    type: "school_application",
    tenantSchoolId: schoolId,
    dataClasses: ["tenant_confidential", "education_record"],
  });

  if (!decision.allowed) {
    throw forbidden(decision.reason);
  }
}

function authorizeTenantWorkflow(context: RequestContext): { schoolId: string; actorUserId: string } {
  const schoolId = requireSchoolTenant(context);
  const decision = evaluatePolicy(context, "school.manage_tenant_workflow", {
    type: "school_application",
    tenantSchoolId: schoolId,
    dataClasses: ["tenant_confidential", "education_record"],
  });
  if (!decision.allowed || !context.actorUserId) throw forbidden(decision.reason);
  return { schoolId, actorUserId: context.actorUserId };
}
