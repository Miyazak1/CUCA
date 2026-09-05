import { randomUUID } from "node:crypto";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { CuacError, forbidden, serviceUnavailable } from "../shared/errors.ts";
import {
  assertTopicAllowed,
  defaultNotificationPreference,
  renderNotificationTemplate,
  type NotificationAudienceRole,
  type NotificationChannel,
  type NotificationEventMaterialization,
  type NotificationTemplate,
  type NotificationTopic,
} from "./templates.ts";
import {
  notificationConflict,
  type NotificationItemDto,
  type NotificationPersona,
  type NotificationPreferenceDto,
  type NotificationRepository,
} from "./service.ts";

type ItemRow = NotificationItemDto & { storedTopic: string; storedStatus: string };
type PreferenceRow = NotificationPreferenceDto & { storedTopic: string };
type StoredPreference = NotificationPreferenceDto & { id: string };

const itemProjection = `d.id, d.event_id as "eventId", e.topic as "storedTopic", e.event_type as "eventType",
  d.title, d.body, d.action_path as "actionPath", d.status as "storedStatus", d.revision,
  e.occurred_at as "occurredAt", d.created_at as "createdAt"`;

export class PostgresNotificationRepository implements NotificationRepository {
  private readonly client: TransactionalSqlClient;

  constructor(client: TransactionalSqlClient) { this.client = client; }

  async list(persona: NotificationPersona, limit: number, cursor: string | null): Promise<NotificationItemDto[]> {
    const rows = await this.client.query<ItemRow>(`select ${itemProjection}
      from notification_deliveries d join notification_events e on e.id = d.event_id
      where d.recipient_user_id = $1 and d.audience_role = $2 and d.tenant_school_id is not distinct from $3
        and d.channel = 'in_app' and d.status in ('unread','read','actioned')
        and ($4::uuid is null or (d.created_at,d.id) < (
          select c.created_at,c.id from notification_deliveries c
          where c.id = $4 and c.recipient_user_id = $1 and c.audience_role = $2
            and c.tenant_school_id is not distinct from $3 and c.channel = 'in_app'
        ))
      order by d.created_at desc,d.id desc limit $5`,
    [persona.userId, persona.role, persona.tenantSchoolId, cursor, limit]);
    for (const row of rows) assertTopicAllowed(persona.role, row.storedTopic);
    return rows.map(toItemDto);
  }

  async markRead(persona: NotificationPersona, notificationId: string, expectedRevision: number) {
    await assertLivePersona(this.client, persona, true);
    const rows = await this.client.query<ItemRow>(`select ${itemProjection}
      from notification_deliveries d join notification_events e on e.id = d.event_id
      where d.id = $1 and d.recipient_user_id = $2 and d.audience_role = $3
        and d.tenant_school_id is not distinct from $4 and d.channel = 'in_app' for update of d`,
    [notificationId, persona.userId, persona.role, persona.tenantSchoolId]);
    if (rows[0]) assertTopicAllowed(persona.role, rows[0].storedTopic);
    const current = rows[0] ? toItemDto(rows[0]) : null;
    if (!current) throw new CuacError("NOT_FOUND", "Notification was not found in the current persona scope.", 404);
    if (current.revision !== expectedRevision) throw notificationConflict();
    if (current.status === "read") return { item: current, changed: false };
    if (current.status !== "unread" || current.revision >= 2_147_483_647) throw notificationConflict();
    const changed = await this.client.query<{ revision: number; viewedAt: Date }>(`update notification_deliveries
      set status = 'read', revision = revision + 1, viewed_at = clock_timestamp(), updated_at = clock_timestamp()
      where id = $1 and revision = $2 and status = 'unread' returning revision,viewed_at as "viewedAt"`,
    [notificationId, expectedRevision]);
    if (!changed[0]) throw notificationConflict();
    return { item: { ...current, status: "read" as const, revision: changed[0].revision }, changed: true };
  }

  async markAllRead(persona: NotificationPersona) {
    await assertLivePersona(this.client, persona, true);
    const rows = await this.client.query<{ id: string }>(`update notification_deliveries
      set status = 'read', revision = revision + 1, viewed_at = clock_timestamp(), updated_at = clock_timestamp()
      where recipient_user_id = $1 and audience_role = $2 and tenant_school_id is not distinct from $3
        and channel = 'in_app' and status = 'unread' and revision < 2147483647 returning id`,
    [persona.userId, persona.role, persona.tenantSchoolId]);
    return { changedCount: rows.length };
  }

  async getPreferences(persona: NotificationPersona): Promise<NotificationPreferenceDto[]> {
    const rows = await this.client.query<PreferenceRow>(`select topic as "storedTopic",in_app_enabled as "inAppEnabled",
      email_enabled as "emailEnabled",sms_enabled as "smsEnabled",revision
      from notification_preferences where user_id = $1 and audience_role = $2
        and tenant_school_id is not distinct from $3 order by topic`,
    [persona.userId, persona.role, persona.tenantSchoolId]);
    return rows.map(row => ({ topic: row.storedTopic as NotificationTopic, inAppEnabled: row.inAppEnabled,
      emailEnabled: row.emailEnabled, smsEnabled: row.smsEnabled, revision: row.revision }));
  }

  async updatePreferences(persona: NotificationPersona,
    preferences: readonly (NotificationPreferenceDto & { expectedRevision: number })[]): Promise<NotificationPreferenceDto[]> {
    await assertLivePersona(this.client, persona, true);
    const updated: NotificationPreferenceDto[] = [];
    for (const preference of preferences) {
      const rows = await this.client.query<StoredPreference>(`select id,topic,in_app_enabled as "inAppEnabled",
        email_enabled as "emailEnabled",sms_enabled as "smsEnabled",revision from notification_preferences
        where user_id = $1 and audience_role = $2 and tenant_school_id is not distinct from $3 and topic = $4 for update`,
      [persona.userId, persona.role, persona.tenantSchoolId, preference.topic]);
      const current = rows[0];
      const defaults = defaultNotificationPreference(persona.role, preference.topic);
      if ((current?.revision ?? 0) !== preference.expectedRevision) throw notificationConflict("Notification preferences changed. Reload before updating.");
      const same = ["inAppEnabled", "emailEnabled", "smsEnabled"].every(key =>
        (current ?? defaults)[key as keyof NotificationChannelPreferenceShape] === preference[key as keyof NotificationChannelPreferenceShape]);
      if (same) {
        updated.push(current ? preferenceDto(current) : { topic: preference.topic, ...defaults, revision: 0 });
        continue;
      }
      if (current) {
        if (current.revision >= 2_147_483_647) throw serviceUnavailable("Notification preference revision is exhausted.");
        const changed = await this.client.query<PreferenceRow>(`update notification_preferences set
          in_app_enabled = $5,email_enabled = $6,sms_enabled = $7,revision = revision + 1,updated_at = clock_timestamp()
          where id = $1 and user_id = $2 and audience_role = $3 and tenant_school_id is not distinct from $4
            and revision = $8 returning topic as "storedTopic",in_app_enabled as "inAppEnabled",
            email_enabled as "emailEnabled",sms_enabled as "smsEnabled",revision`,
        [current.id, persona.userId, persona.role, persona.tenantSchoolId, preference.inAppEnabled,
          preference.emailEnabled, preference.smsEnabled, preference.expectedRevision]);
        if (!changed[0]) throw notificationConflict("Notification preferences changed. Reload before updating.");
        updated.push(preferenceDto(changed[0]));
      } else {
        const inserted = await this.client.query<PreferenceRow>(`insert into notification_preferences
          (user_id,audience_role,tenant_school_id,topic,in_app_enabled,email_enabled,sms_enabled,revision)
          values ($1,$2,$3,$4,$5,$6,$7,1) on conflict do nothing returning topic as "storedTopic",
          in_app_enabled as "inAppEnabled",email_enabled as "emailEnabled",sms_enabled as "smsEnabled",revision`,
        [persona.userId, persona.role, persona.tenantSchoolId, preference.topic, preference.inAppEnabled,
          preference.emailEnabled, preference.smsEnabled]);
        if (!inserted[0]) throw notificationConflict("Notification preferences changed. Reload before updating.");
        updated.push(preferenceDto(inserted[0]));
      }
    }
    return updated;
  }
}

type NotificationChannelPreferenceShape = Pick<NotificationPreferenceDto, "inAppEnabled" | "emailEnabled" | "smsEnabled">;

function preferenceDto(row: PreferenceRow | StoredPreference): NotificationPreferenceDto {
  const topic = "storedTopic" in row ? row.storedTopic : row.topic;
  return { topic: topic as NotificationTopic, inAppEnabled: row.inAppEnabled,
    emailEnabled: row.emailEnabled, smsEnabled: row.smsEnabled, revision: row.revision };
}

export class PostgresNotificationPublisher {
  private readonly client: TransactionalSqlClient;

  constructor(client: TransactionalSqlClient) { this.client = client; }

  publish(input: NotificationEventMaterialization): Promise<{ eventId: string; created: boolean }> {
    return this.client.transaction(async tx => {
      await assertLivePersona(tx, { userId: input.recipientUserId, role: input.audienceRole, tenantSchoolId: input.tenantSchoolId }, false);
      const prior = await tx.query<{ id: string }>("select id from notification_events where event_key_sha256 = $1", [input.eventKeySha256]);
      if (prior[0]) return { eventId: prior[0].id, created: false };
      const inserted = await tx.query<{ id: string }>(`insert into notification_events
        (recipient_user_id,audience_role,tenant_school_id,topic,event_type,resource_type,resource_id,
         event_key_sha256,variables_json,variables_sha256,occurred_at)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11) on conflict (event_key_sha256) do nothing returning id`,
      [input.recipientUserId, input.audienceRole, input.tenantSchoolId, input.topic, input.eventType,
        input.resourceType, input.resourceId, input.eventKeySha256, JSON.stringify(input.variables), input.variablesSha256, input.occurredAt]);
      if (!inserted[0]) {
        const raced = await tx.query<{ id: string }>("select id from notification_events where event_key_sha256 = $1", [input.eventKeySha256]);
        if (!raced[0]) throw serviceUnavailable("Notification event idempotency result is unavailable.");
        return { eventId: raced[0].id, created: false };
      }
      const eventId = inserted[0].id;
      const storedPreferences = await tx.query<PreferenceRow>(`select topic as "storedTopic",in_app_enabled as "inAppEnabled",
        email_enabled as "emailEnabled",sms_enabled as "smsEnabled",revision from notification_preferences
        where user_id = $1 and audience_role = $2 and tenant_school_id is not distinct from $3 and topic = $4`,
      [input.recipientUserId, input.audienceRole, input.tenantSchoolId, input.topic]);
      const preference = storedPreferences[0] ?? { storedTopic: input.topic, revision: 0,
        ...defaultNotificationPreference(input.audienceRole, input.topic) };
      for (const template of input.templates) {
        const templateId = await ensureTemplate(tx, template);
        const enabled = template.channel === "in_app" ? preference.inAppEnabled
          : template.channel === "email" ? preference.emailEnabled : preference.smsEnabled;
        if (template.channel === "in_app" && !enabled) continue;
        const rendered = renderNotificationTemplate(template, input.variables);
        const status = template.channel === "in_app" ? "unread" : enabled ? "queued" : "suppressed";
        await tx.query(`insert into notification_deliveries
          (event_id,template_id,recipient_user_id,audience_role,tenant_school_id,channel,status,title,body,action_path,
           content_sha256,outcome,delivered_at,completed_at)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
            case when $7 = 'suppressed' then 'preference_disabled' else null end,
            case when $7 = 'unread' then clock_timestamp() else null end,
            case when $7 = 'suppressed' then clock_timestamp() else null end)`,
        [eventId, templateId, input.recipientUserId, input.audienceRole, input.tenantSchoolId, template.channel,
          status, rendered.title, rendered.body, rendered.actionPath, rendered.contentSha256]);
      }
      await workerAudit(tx, "notification.event.created", eventId, { eventType: input.eventType, topic: input.topic,
        audienceRole: input.audienceRole, hasTenant: input.tenantSchoolId !== null });
      return { eventId, created: true };
    });
  }
}

async function ensureTemplate(tx: TransactionalSqlClient, template: NotificationTemplate): Promise<string> {
  await tx.query(`insert into notification_templates
    (template_key,audience_role,channel,locale,version,title_template,body_template,action_path_template,
     variable_keys_json,content_sha256,status)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,'active')
    on conflict (template_key,audience_role,channel,locale,version) do nothing`,
  [template.templateKey, template.audienceRole, template.channel, template.locale, template.version,
    template.titleTemplate, template.bodyTemplate, template.actionPathTemplate, JSON.stringify(template.variableKeys), template.contentSha256]);
  const rows = await tx.query<{ id: string; contentSha256: string; status: string }>(`select id,content_sha256 as "contentSha256",status
    from notification_templates where template_key = $1 and audience_role = $2 and channel = $3 and locale = $4 and version = $5`,
  [template.templateKey, template.audienceRole, template.channel, template.locale, template.version]);
  if (!rows[0] || rows[0].contentSha256 !== template.contentSha256 || rows[0].status !== "active") {
    throw serviceUnavailable("Stored notification template does not match the reviewed registry.");
  }
  return rows[0].id;
}

export async function assertLivePersona(client: TransactionalSqlClient, persona: NotificationPersona, write: boolean): Promise<void> {
  const lock = write ? "no key update" : "share";
  const users = await client.query(`select id from users where id = $1 and account_status = 'active' for ${lock}`, [persona.userId]);
  if (!users[0]) throw forbidden("Active notification recipient is required.");
  const roles = await client.query(`select id from user_roles where user_id = $1 and role = $2 and revoked_at is null for ${lock}`,
    [persona.userId, persona.role]);
  if (!roles[0]) throw forbidden("Active notification role is required.");
  if (persona.role === "school_staff") {
    if (!persona.tenantSchoolId) throw forbidden("School notification tenant is required.");
    const membership = await client.query(`select m.id from school_staff_memberships m join schools s on s.id = m.school_id
      where m.user_id = $1 and m.school_id = $2 and m.status = 'active' and m.removed_at is null and s.status = 'active'
      for ${lock} of m,s`, [persona.userId, persona.tenantSchoolId]);
    if (!membership[0]) throw forbidden("Active school notification membership is required.");
  } else if (persona.tenantSchoolId !== null) {
    throw forbidden("This notification role cannot carry a school tenant.");
  }
  if (persona.role === "cuac_ops" || persona.role === "cuac_admin") {
    const grants = await client.query(`select id from cuac_staff_access_grants where user_id = $1 and requested_role = $2
      and status = 'approved' and approved_at is not null and revoked_at is null and expires_at > clock_timestamp()
      for ${lock}`, [persona.userId, persona.role]);
    if (!grants[0]) throw forbidden("Current CUAC staff notification grant is required.");
  }
}

function toItemDto(row: ItemRow): NotificationItemDto {
  if (!["unread", "read", "actioned"].includes(row.storedStatus) || !Number.isSafeInteger(row.revision)
    || row.revision < 0 || !(row.occurredAt instanceof Date) || !(row.createdAt instanceof Date)) {
    throw serviceUnavailable("Stored notification is invalid.");
  }
  return { id: row.id, eventId: row.eventId, topic: row.storedTopic as NotificationTopic, eventType: row.eventType,
    title: row.title, body: row.body, actionPath: row.actionPath, status: row.storedStatus as NotificationItemDto["status"],
    revision: row.revision, occurredAt: row.occurredAt, createdAt: row.createdAt };
}

export async function workerAudit(tx: TransactionalSqlClient, action: string, resourceId: string, metadata: unknown) {
  await tx.query(`insert into audit_logs
    (request_id,actor_type,active_role,action,resource_type,resource_id,allowed,data_classes,redaction_applied,metadata_json)
    values ($1,'service','system',$2,'notification',$3,true,'["account_notification"]'::jsonb,true,$4::jsonb)`,
  [randomUUID(), action, resourceId, JSON.stringify(metadata)]);
}

export type { NotificationChannel };
