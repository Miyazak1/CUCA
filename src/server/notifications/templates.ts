import { createHash } from "node:crypto";
import { serviceUnavailable } from "../shared/errors.ts";
import type { CuacRole } from "../shared/request-context.ts";

export type NotificationAudienceRole = Exclude<CuacRole, "guest">;
export type NotificationChannel = "in_app" | "email" | "sms";
export type NotificationTopic =
  | "application_updates"
  | "billing_updates"
  | "deadline_reminders"
  | "document_reminders"
  | "funding_updates"
  | "account_security"
  | "school_workflow"
  | "platform_operations";

export const NOTIFICATION_TOPICS_BY_ROLE: Readonly<Record<NotificationAudienceRole, readonly NotificationTopic[]>> = {
  student: ["application_updates", "billing_updates", "deadline_reminders", "document_reminders", "funding_updates", "account_security"],
  school_staff: ["school_workflow", "account_security"],
  cuac_ops: ["platform_operations", "account_security"],
  cuac_admin: ["platform_operations", "account_security"],
};

export type NotificationChannelPreference = {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
};

export type NotificationTemplate = {
  templateKey: string;
  audienceRole: NotificationAudienceRole;
  channel: NotificationChannel;
  locale: "en" | "zh-CN";
  version: number;
  titleTemplate: string;
  bodyTemplate: string;
  actionPathTemplate: string | null;
  variableKeys: readonly string[];
  contentSha256: string;
};

export type NotificationEventMaterialization = {
  recipientUserId: string;
  audienceRole: NotificationAudienceRole;
  tenantSchoolId: string | null;
  topic: NotificationTopic;
  eventType: string;
  resourceType: string;
  resourceId: string;
  eventKeySha256: string;
  variables: Record<string, string>;
  variablesSha256: string;
  occurredAt: Date;
  templates: readonly NotificationTemplate[];
};

type BuiltinDefinition = { topic: NotificationTopic; title: string; body: string };

const applicationSubmittedDefinition: BuiltinDefinition = {
  topic: "application_updates",
  title: "CUAC accepted your application for delivery",
  body: "Your application package is locked and queued for delivery. This does not mean each school has received it yet.",
};

const paymentDefinitions: Readonly<Record<"succeeded" | "canceled" | "refunded", BuiltinDefinition>> = {
  succeeded: {
    topic: "billing_updates",
    title: "Payment confirmed",
    body: "CUAC confirmed your payment. Review the invoice and application readiness in your account.",
  },
  canceled: {
    topic: "billing_updates",
    title: "Payment was not completed",
    body: "The payment session was canceled and no application fee entitlement was granted.",
  },
  refunded: {
    topic: "billing_updates",
    title: "Payment refunded",
    body: "CUAC recorded the refund. Any application fee entitlement from this payment is no longer current.",
  },
};

const applicationDefinitions: Readonly<Record<string, BuiltinDefinition>> = {
  school_marked_contacted: {
    topic: "application_updates",
    title: "A school has contacted you",
    body: "Review your messages and reply to the school directly when needed. CUAC routing updates are not an official admission decision.",
  },
  school_waiting_documents: {
    topic: "application_updates",
    title: "A school is waiting for documents",
    body: "Open your application record and confirm the next document step with the school. CUAC does not treat this routing update as an official decision.",
  },
  school_application_updated: {
    topic: "application_updates",
    title: "Your CUAC school record was updated",
    body: "Open the application record for the latest routing status. Official document requests and decisions still come directly from the school.",
  },
};

export function defaultNotificationPreference(role: NotificationAudienceRole, topic: NotificationTopic): NotificationChannelPreference {
  assertTopicAllowed(role, topic);
  if (topic === "account_security") return { inAppEnabled: true, emailEnabled: true, smsEnabled: false };
  if (role === "cuac_ops" || role === "cuac_admin") return { inAppEnabled: true, emailEnabled: false, smsEnabled: false };
  if (topic === "funding_updates") return { inAppEnabled: true, emailEnabled: false, smsEnabled: false };
  return { inAppEnabled: true, emailEnabled: true, smsEnabled: false };
}

export function assertTopicAllowed(role: NotificationAudienceRole, topic: string): asserts topic is NotificationTopic {
  if (!NOTIFICATION_TOPICS_BY_ROLE[role].includes(topic as NotificationTopic)) {
    throw serviceUnavailable("Notification topic is not allowed for this persona.");
  }
}

export function materializeSchoolApplicationStatusNotification(input: {
  recipientUserId: string;
  schoolApplicationId: string;
  applicationSetId: string;
  statusEventId: string;
  status: string;
  occurredAt: Date;
}): NotificationEventMaterialization {
  const eventType = input.status === "contacted" ? "school_marked_contacted"
    : input.status === "waiting_for_documents" ? "school_waiting_documents"
      : "school_application_updated";
  const definition = applicationDefinitions[eventType];
  const variables = { applicationSetId: input.applicationSetId };
  const templates = (["in_app", "email", "sms"] as const).map(channel => buildTemplate(
    eventType, definition, channel, "/application.html?applicationSet={{applicationSetId}}", ["applicationSetId"],
  ));
  return {
    recipientUserId: input.recipientUserId,
    audienceRole: "student",
    tenantSchoolId: null,
    topic: definition.topic,
    eventType,
    resourceType: "school_application",
    resourceId: input.schoolApplicationId,
    eventKeySha256: digest({ version: 1, source: "school_application_status_event", id: input.statusEventId, recipientUserId: input.recipientUserId }),
    variables,
    variablesSha256: digest(variables),
    occurredAt: input.occurredAt,
    templates,
  };
}

export function materializeApplicationSubmittedNotification(input: {
  recipientUserId: string;
  applicationSubmissionId: string;
  applicationSetId: string;
  occurredAt: Date;
}): NotificationEventMaterialization {
  const eventType = "application_submission_accepted";
  const variables = { applicationSetId: input.applicationSetId };
  const templates = (["in_app", "email", "sms"] as const).map(channel => buildTemplate(
    eventType, applicationSubmittedDefinition, channel,
    "/application.html?applicationSet={{applicationSetId}}", ["applicationSetId"],
  ));
  return {
    recipientUserId: input.recipientUserId,
    audienceRole: "student",
    tenantSchoolId: null,
    topic: applicationSubmittedDefinition.topic,
    eventType,
    resourceType: "application_submission",
    resourceId: input.applicationSubmissionId,
    eventKeySha256: digest({ version: 1, source: "application_submission", id: input.applicationSubmissionId,
      recipientUserId: input.recipientUserId }),
    variables,
    variablesSha256: digest(variables),
    occurredAt: input.occurredAt,
    templates,
  };
}

export function materializePaymentStatusNotification(input: {
  recipientUserId: string;
  paymentId: string;
  invoiceId: string;
  paymentStatusEventId: string;
  status: "succeeded" | "canceled" | "refunded";
  occurredAt: Date;
}): NotificationEventMaterialization {
  const definition = paymentDefinitions[input.status];
  const eventType = `payment_${input.status}`;
  const variables = { invoiceId: input.invoiceId };
  const templates = (["in_app", "email", "sms"] as const).map(channel => buildTemplate(
    eventType, definition, channel, "/application.html?invoiceId={{invoiceId}}#payment", ["invoiceId"],
  ));
  return {
    recipientUserId: input.recipientUserId,
    audienceRole: "student",
    tenantSchoolId: null,
    topic: definition.topic,
    eventType,
    resourceType: "payment",
    resourceId: input.paymentId,
    eventKeySha256: digest({ version: 1, source: "payment_status_event", id: input.paymentStatusEventId,
      recipientUserId: input.recipientUserId }),
    variables,
    variablesSha256: digest(variables),
    occurredAt: input.occurredAt,
    templates,
  };
}

export function renderNotificationTemplate(template: NotificationTemplate, variables: Record<string, string>) {
  const keys = Object.keys(variables).sort();
  const expected = [...template.variableKeys].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw serviceUnavailable("Notification template variables do not match the reviewed contract.");
  }
  for (const value of Object.values(variables)) {
    if (typeof value !== "string" || value.length < 1 || value.length > 128 || hasControlCharacter(value)) {
      throw serviceUnavailable("Notification template variable is invalid.");
    }
  }
  const replace = (value: string | null) => value?.replace(/\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g, (_, key: string) => {
    const replacement = variables[key];
    if (replacement === undefined) throw serviceUnavailable("Notification template contains an unsupported variable.");
    return encodeURIComponent(replacement);
  }) ?? null;
  const title = replace(template.titleTemplate)!;
  const body = replace(template.bodyTemplate)!;
  const actionPath = replace(template.actionPathTemplate);
  if (title.length > 160 || body.length > 2000 || (actionPath && actionPath.length > 512)) {
    throw serviceUnavailable("Rendered notification exceeds its bounded contract.");
  }
  return { title, body, actionPath, contentSha256: digest({ version: 1, title, body, actionPath }) };
}

function buildTemplate(eventType: string, definition: BuiltinDefinition, channel: NotificationChannel,
  actionPathTemplate: string, variableKeys: readonly string[]): NotificationTemplate {
  const base = {
    templateKey: `student.${eventType}`,
    audienceRole: "student" as const,
    channel,
    locale: "en" as const,
    version: 1,
    titleTemplate: definition.title,
    bodyTemplate: definition.body,
    actionPathTemplate,
    variableKeys,
  };
  return { ...base, contentSha256: digest(base) };
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}
