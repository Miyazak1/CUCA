import { randomUUID } from "node:crypto";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { PostgresNotificationPublisher } from "../notifications/postgres-repository.ts";
import { materializeInactiveAccountWarning } from "../notifications/templates.ts";
import { serviceUnavailable } from "../shared/errors.ts";

export type RetentionBatchSummary = {
  guardianRegistrationsExpired: number;
  emailSecretsExpired: number;
  emailRowsDeleted: number;
  verificationChallengesDeleted: number;
  passwordResetChallengesDeleted: number;
  schoolInvitesDeleted: number;
  sessionsDeleted: number;
  sessionStepUpsCleared: number;
  continuationsDeleted: number;
  mfaChallengesDeleted: number;
  rateLimitBucketsDeleted: number;
  businessNotificationEventsDeleted: number;
  inactiveAccountWarningsCreated: number;
  processed: number;
};

type IdRow = { id: string };
type GuardianRow = { id: string; userId: string };
type InactiveStudentRow = {
  id: string;
  locale: string;
  inactiveSince: Date;
  reviewAt: Date;
  occurredAt: Date;
};

export class PostgresRetentionProcessor {
  private readonly client: TransactionalSqlClient;

  constructor(client: TransactionalSqlClient) {
    this.client = client;
  }

  async processBatch(limit: number): Promise<RetentionBatchSummary> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
      throw serviceUnavailable("Retention batch limit is invalid.");
    }

    return this.client.transaction(async tx => {
      const guardianRegistrationsExpired = await expireGuardianRegistrations(tx, limit);
      const emailSecretsExpired = await mutateCount(tx, `with candidates as (
        select id from auth_email_outbox
        where status in ('queued','leased','sending') and expires_at <= clock_timestamp()
        order by expires_at,id limit $1 for update skip locked
      ) update auth_email_outbox q set status='cancelled',outcome='expired',envelope_json=null,
        lease_id=null,lease_expires_at=null,completed_at=clock_timestamp(),updated_at=clock_timestamp()
        from candidates c where q.id=c.id returning q.id`, [limit]);
      const sessionStepUpsCleared = await mutateCount(tx, `with candidates as (
        select id from auth_sessions where step_up_expires_at is not null
          and step_up_expires_at <= clock_timestamp()
        order by step_up_expires_at,id limit $1 for update skip locked
      ) update auth_sessions s set step_up_expires_at=null
        from candidates c where s.id=c.id returning s.id`, [limit]);
      const emailRowsDeleted = await deleteCount(tx, `with candidates as (
        select id from auth_email_outbox where completed_at is not null
          and completed_at <= clock_timestamp() - interval '1 day'
        order by completed_at,id limit $1 for update skip locked
      ) delete from auth_email_outbox target using candidates c
        where target.id=c.id returning target.id`, limit);
      const verificationChallengesDeleted = await deleteCount(tx, `with candidates as (
        select id from email_verification_challenges
        where expires_at <= clock_timestamp() - interval '1 day'
        order by expires_at,id limit $1 for update skip locked
      ) delete from email_verification_challenges target using candidates c
        where target.id=c.id returning target.id`, limit);
      const passwordResetChallengesDeleted = await deleteCount(tx, `with candidates as (
        select id from password_reset_challenges
        where expires_at <= clock_timestamp() - interval '1 day'
        order by expires_at,id limit $1 for update skip locked
      ) delete from password_reset_challenges target using candidates c
        where target.id=c.id returning target.id`, limit);
      const continuationsDeleted = await deleteCount(tx, `with candidates as (
        select id from sign_in_continuations
        where coalesce(consumed_at,expires_at) <= clock_timestamp() - interval '1 day'
        order by coalesce(consumed_at,expires_at),id limit $1 for update skip locked
      ) delete from sign_in_continuations target using candidates c
        where target.id=c.id returning target.id`, limit);
      const mfaChallengesDeleted = await deleteCount(tx, `with candidates as (
        select id from auth_mfa_challenges
        where coalesce(consumed_at,expires_at) <= clock_timestamp() - interval '1 day'
        order by coalesce(consumed_at,expires_at),id limit $1 for update skip locked
      ) delete from auth_mfa_challenges target using candidates c
        where target.id=c.id returning target.id`, limit);
      const rateLimitBucketsDeleted = await deleteCount(tx, `with candidates as (
        select id from auth_rate_limit_buckets
        where expires_at <= clock_timestamp() - interval '1 day'
        order by expires_at,id limit $1 for update skip locked
      ) delete from auth_rate_limit_buckets target using candidates c
        where target.id=c.id returning target.id`, limit);
      const sessionsDeleted = await deleteCount(tx, `with candidates as (
        select id from auth_sessions where
          (case when revoked_at is not null and revoked_at < expires_at then revoked_at else expires_at end)
            <= clock_timestamp() - interval '30 days'
        order by (case when revoked_at is not null and revoked_at < expires_at then revoked_at else expires_at end),id
        limit $1 for update skip locked
      ) delete from auth_sessions target using candidates c
        where target.id=c.id returning target.id`, limit);
      const schoolInvitesDeleted = await deleteCount(tx, `with candidates as (
        select id from school_staff_invites where
          greatest(expires_at,coalesce(accepted_at,'-infinity'::timestamptz),
            coalesce(revoked_at,'-infinity'::timestamptz)) <= clock_timestamp() - interval '180 days'
        order by greatest(expires_at,coalesce(accepted_at,'-infinity'::timestamptz),
          coalesce(revoked_at,'-infinity'::timestamptz)),id limit $1 for update skip locked
      ) delete from school_staff_invites target using candidates c
        where target.id=c.id returning target.id`, limit);
      const businessNotificationEventsDeleted = await deleteCount(tx, `with candidates as (
        select e.id from notification_events e
        where e.created_at <= clock_timestamp() - interval '180 days'
          and e.topic not in ('account_security','privacy_requests')
          and not exists (
            select 1 from notification_deliveries d where d.event_id=e.id
              and d.channel in ('email','sms') and d.status in ('queued','leased','sending')
          )
        order by e.created_at,e.id limit $1 for update of e skip locked
      ) delete from notification_events target using candidates c
        where target.id=c.id returning target.id`, limit);
      const inactiveAccountWarningsCreated = await warnInactiveStudentAccounts(tx, limit);

      const partial = {
        guardianRegistrationsExpired,
        emailSecretsExpired,
        emailRowsDeleted,
        verificationChallengesDeleted,
        passwordResetChallengesDeleted,
        schoolInvitesDeleted,
        sessionsDeleted,
        sessionStepUpsCleared,
        continuationsDeleted,
        mfaChallengesDeleted,
        rateLimitBucketsDeleted,
        businessNotificationEventsDeleted,
        inactiveAccountWarningsCreated,
      };
      const processed = Object.values(partial).reduce((total, value) => total + value, 0);
      const result = { ...partial, processed };
      if (processed > 0) await recordBatchAudit(tx, result);
      return result;
    });
  }
}

async function warnInactiveStudentAccounts(tx: TransactionalSqlClient, limit: number): Promise<number> {
  const candidates = await tx.query<InactiveStudentRow>(`select u.id,
      case when u.locale='zh-CN' then 'zh-CN' else 'en' end as locale,
      coalesce(u.last_login_at,u.created_at) as "inactiveSince",
      coalesce(u.last_login_at,u.created_at) + interval '24 months' as "reviewAt",
      clock_timestamp() as "occurredAt"
    from users u
    where u.account_status='active'
      and coalesce(u.last_login_at,u.created_at) <= clock_timestamp() - interval '23 months'
      and coalesce(u.last_login_at,u.created_at) > clock_timestamp() - interval '24 months'
      and exists (select 1 from user_roles r where r.user_id=u.id and r.role='student' and r.revoked_at is null)
      and not exists (
        select 1 from notification_events e
        where e.recipient_user_id=u.id and e.audience_role='student'
          and e.event_type='account_inactivity_warning' and e.resource_type='account' and e.resource_id=u.id::text
          and e.occurred_at >= coalesce(u.last_login_at,u.created_at)
      )
    order by coalesce(u.last_login_at,u.created_at),u.id
    limit $1 for update of u skip locked`, [limit]);
  const publisher = new PostgresNotificationPublisher(tx);
  let created = 0;
  for (const candidate of candidates) {
    const result = await publisher.publish(materializeInactiveAccountWarning({
      recipientUserId: candidate.id,
      locale: candidate.locale === "zh-CN" ? "zh-CN" : "en",
      inactiveSince: candidate.inactiveSince,
      reviewAt: candidate.reviewAt,
      occurredAt: candidate.occurredAt,
    }));
    if (result.created) created += 1;
  }
  return created;
}

async function expireGuardianRegistrations(tx: TransactionalSqlClient, limit: number): Promise<number> {
  // Match auth-email lock order: user first, then guardian request/outbox. Locking only
  // the user rows here also lets concurrent retention workers skip the same account.
  const candidates = await tx.query<GuardianRow>(`select c.id,c.user_id as "userId"
    from guardian_consent_requests c join users u on u.id=c.user_id
    where c.status='pending' and c.expires_at <= clock_timestamp()
    order by c.expires_at,c.id limit $1 for update of u skip locked`, [limit]);
  let expired = 0;
  for (const candidate of candidates) {
    const rows = await tx.query<GuardianRow>(`update guardian_consent_requests set status='expired',
      guardian_email=null,consent_token_hash=null,responded_at=clock_timestamp(),updated_at=clock_timestamp()
      where id=$1 and user_id=$2 and status='pending' and expires_at <= clock_timestamp()
      returning id,user_id as "userId"`, [candidate.id, candidate.userId]);
    if (!rows[0]) continue;
    await tx.query(`update auth_identities set password_hash=null,updated_at=clock_timestamp()
      where user_id=$1 and provider='password'`, [candidate.userId]);
    await tx.query(`update users set account_status='guardian_expired',updated_at=clock_timestamp()
      where id=$1 and account_status='pending_guardian_consent'`, [candidate.userId]);
    await tx.query(`update auth_email_outbox set status='cancelled',outcome='expired',envelope_json=null,
      lease_id=null,lease_expires_at=null,completed_at=clock_timestamp(),updated_at=clock_timestamp()
      where guardian_consent_request_id=$1 and status in ('queued','leased','sending')`, [candidate.id]);
    await tx.query(`insert into audit_logs (request_id,actor_type,active_role,action,resource_type,
      resource_id,allowed,data_classes,redaction_applied,metadata_json)
      values ($1,'service','system','auth.guardian_consent.expired','guardian_consent_request',
        $2,true,'["account","minor"]'::jsonb,true,'{}'::jsonb)`, [randomUUID(), candidate.id]);
    expired += 1;
  }
  return expired;
}

async function deleteCount(
  tx: TransactionalSqlClient,
  statement: string,
  limit: number,
): Promise<number> {
  const rows = await tx.query<IdRow>(statement, [limit]);
  return rows.length;
}

async function mutateCount(tx: TransactionalSqlClient, statement: string, params: readonly unknown[]): Promise<number> {
  return (await tx.query<IdRow>(statement, params)).length;
}

async function recordBatchAudit(tx: TransactionalSqlClient, summary: RetentionBatchSummary): Promise<void> {
  await tx.query(`insert into audit_logs (request_id,actor_type,active_role,action,resource_type,
    resource_id,allowed,data_classes,redaction_applied,metadata_json)
    values ($1,'service','system','retention.batch.completed','retention_batch',null,true,
      '["audit_security"]'::jsonb,true,$2::jsonb)`, [randomUUID(), JSON.stringify(summary)]);
}
