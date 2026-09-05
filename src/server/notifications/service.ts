import { buildAuditEvent, type AuditSink } from "../audit/audit.ts";
import { evaluatePolicy } from "../policy/policy.ts";
import { CuacError, badRequest, forbidden } from "../shared/errors.ts";
import { inputInteger, inputList, inputRecord, inputUuid } from "../shared/input.ts";
import type { RequestContext } from "../shared/request-context.ts";
import {
  NOTIFICATION_TOPICS_BY_ROLE,
  assertTopicAllowed,
  defaultNotificationPreference,
  type NotificationAudienceRole,
  type NotificationChannelPreference,
  type NotificationTopic,
} from "./templates.ts";

export type NotificationPersona = { userId: string; role: NotificationAudienceRole; tenantSchoolId: string | null };

export type NotificationItemDto = {
  id: string;
  eventId: string;
  topic: NotificationTopic;
  eventType: string;
  title: string;
  body: string;
  actionPath: string | null;
  status: "unread" | "read" | "actioned";
  revision: number;
  occurredAt: Date;
  createdAt: Date;
};

export type NotificationPreferenceDto = NotificationChannelPreference & { topic: NotificationTopic; revision: number };

export type NotificationRepository = {
  list(persona: NotificationPersona, limit: number, cursor: string | null): Promise<NotificationItemDto[]>;
  markRead(persona: NotificationPersona, notificationId: string, expectedRevision: number): Promise<{ item: NotificationItemDto; changed: boolean }>;
  markAllRead(persona: NotificationPersona): Promise<{ changedCount: number }>;
  getPreferences(persona: NotificationPersona): Promise<NotificationPreferenceDto[]>;
  updatePreferences(persona: NotificationPersona, preferences: readonly (NotificationPreferenceDto & { expectedRevision: number })[]): Promise<NotificationPreferenceDto[]>;
};

export class NotificationService {
  private readonly repository: NotificationRepository;
  private readonly audit: AuditSink;

  constructor(repository: NotificationRepository, audit: AuditSink) {
    this.repository = repository;
    this.audit = audit;
  }

  async list(context: RequestContext, input: unknown = {}) {
    const persona = requireNotificationPersona(context, "notification.read_own_scope");
    const fields = inputRecord(input, ["limit", "cursor"]);
    const limit = inputInteger(fields.limit ?? 20, "limit", 1, 100);
    const cursor = fields.cursor === undefined || fields.cursor === null ? null : inputUuid(fields.cursor, "cursor");
    const rows = await this.repository.list(persona, limit + 1, cursor);
    const items = rows.slice(0, limit);
    await this.record(context, "notification.list", null, { count: items.length });
    return { items, nextCursor: rows.length > limit ? items.at(-1)?.id ?? null : null };
  }

  async markRead(context: RequestContext, notificationId: string, input: unknown) {
    const persona = requireNotificationPersona(context, "notification.manage_own_scope");
    const fields = inputRecord(input, ["expectedRevision"]);
    const expectedRevision = inputInteger(fields.expectedRevision, "expectedRevision", 0, 2_147_483_647);
    const result = await this.repository.markRead(persona, inputUuid(notificationId, "notificationId"), expectedRevision);
    if (result.changed) await this.record(context, "notification.read", result.item.id, { revision: result.item.revision });
    return result.item;
  }

  async markAllRead(context: RequestContext) {
    const persona = requireNotificationPersona(context, "notification.manage_own_scope");
    const result = await this.repository.markAllRead(persona);
    if (result.changedCount > 0) await this.record(context, "notification.read_all", null, result);
    return result;
  }

  async getPreferences(context: RequestContext) {
    const persona = requireNotificationPersona(context, "notification.read_own_scope");
    const stored = new Map((await this.repository.getPreferences(persona)).map(item => [item.topic, item]));
    const preferences = NOTIFICATION_TOPICS_BY_ROLE[persona.role].map(topic => stored.get(topic) ?? {
      topic, revision: 0, ...defaultNotificationPreference(persona.role, topic),
    });
    await this.record(context, "notification.preference.list", null, { count: preferences.length });
    return { preferences };
  }

  async updatePreferences(context: RequestContext, input: unknown) {
    const persona = requireNotificationPersona(context, "notification.manage_own_scope");
    const fields = inputRecord(input, ["preferences"]);
    const preferences = inputList(fields.preferences, "preferences", NOTIFICATION_TOPICS_BY_ROLE[persona.role].length, entry => {
      const item = inputRecord(entry, ["topic", "inAppEnabled", "emailEnabled", "smsEnabled", "expectedRevision"]);
      if (typeof item.topic !== "string") throw badRequest("topic is required.");
      if (!NOTIFICATION_TOPICS_BY_ROLE[persona.role].includes(item.topic as NotificationTopic)) {
        throw badRequest("topic is not available for the current notification persona.");
      }
      assertTopicAllowed(persona.role, item.topic);
      for (const field of ["inAppEnabled", "emailEnabled", "smsEnabled"] as const) {
        if (typeof item[field] !== "boolean") throw badRequest(`${field} must be a boolean.`);
      }
      const inAppEnabled = item.inAppEnabled as boolean;
      const emailEnabled = item.emailEnabled as boolean;
      const smsEnabled = item.smsEnabled as boolean;
      if (item.topic === "account_security" && (!inAppEnabled || !emailEnabled)) {
        throw badRequest("Account security in-app and email notifications cannot be disabled.");
      }
      return {
        topic: item.topic,
        inAppEnabled,
        emailEnabled,
        smsEnabled,
        expectedRevision: inputInteger(item.expectedRevision, "expectedRevision", 0, 2_147_483_647),
        revision: 0,
      };
    });
    if (new Set(preferences.map(item => item.topic)).size !== preferences.length) throw badRequest("preferences contains duplicate topics.");
    const updated = await this.repository.updatePreferences(persona, preferences);
    await this.record(context, "notification.preference.update", null, {
      topics: updated.map(item => item.topic), revisions: updated.map(item => item.revision),
    });
    return { preferences: updated };
  }

  private record(context: RequestContext, action: string, resourceId: string | null, metadata: unknown) {
    return this.audit.record(buildAuditEvent(context, { action, resourceType: "notification", resourceId, allowed: true,
      policyDecisionId: context.policyDecisionId, dataClasses: ["account_notification"], metadata }));
  }
}

export function requireNotificationPersona(context: RequestContext, action: "notification.read_own_scope" | "notification.manage_own_scope"): NotificationPersona {
  if (!context.actorUserId || context.activeRole === "guest") throw forbidden("Authenticated notification persona is required.");
  const expectedSurface = context.activeRole === "student" ? "student" : context.activeRole === "school_staff" ? "school" : "ops";
  if (context.selectedSurface !== expectedSurface || context.purpose !== "notification_management"
    || !["session", "step_up"].includes(context.authStrength) || !context.dataClassAllowlist.includes("account_notification")) {
    throw forbidden("Current notification persona is not authorized.");
  }
  const tenantSchoolId = context.activeRole === "school_staff" ? context.tenantSchoolId : null;
  if (context.activeRole === "school_staff" && !tenantSchoolId) throw forbidden("Active school tenant is required.");
  const decision = evaluatePolicy(context, action, { type: "notification", ownerUserId: context.actorUserId,
    tenantSchoolId, dataClasses: ["account_notification"] });
  if (!decision.allowed) throw forbidden(decision.reason);
  return { userId: context.actorUserId, role: context.activeRole, tenantSchoolId };
}

export function notificationConflict(message = "Notification state changed. Reload before updating.") {
  return new CuacError("CONFLICT", message, 409);
}
