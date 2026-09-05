import { createHash, randomUUID } from "node:crypto";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { CuacError, serviceUnavailable } from "../shared/errors.ts";
import { assertLivePersona, workerAudit } from "./postgres-repository.ts";
import type { NotificationAudienceRole } from "./templates.ts";

export type NotificationDeliveryLease = { id: string; recipientUserId: string; leaseId: string };
export type NotificationExternalChannel = "email" | "sms";
export type PreparedNotificationDelivery = {
  id: string;
  channel: NotificationExternalChannel;
  to: string;
  title: string;
  body: string;
  actionPath: string | null;
};
export type NotificationDeliveryResult = "accepted" | "not_accepted" | "unknown";

type Job = {
  id: string;
  recipientUserId: string;
  audienceRole: NotificationAudienceRole;
  tenantSchoolId: string | null;
  channel: NotificationExternalChannel;
  status: string;
  title: string;
  body: string;
  actionPath: string | null;
  attemptCount: number;
  leaseId: string | null;
  leaseValid: boolean;
};

const jobProjection = `id,recipient_user_id as "recipientUserId",audience_role as "audienceRole",
  tenant_school_id as "tenantSchoolId",channel,status,title,body,action_path as "actionPath",
  attempt_count as "attemptCount",lease_id as "leaseId",lease_expires_at > clock_timestamp() as "leaseValid"`;

export class PostgresNotificationDeliveryQueue {
  private readonly client: TransactionalSqlClient;

  constructor(client: TransactionalSqlClient) { this.client = client; }

  claim(): Promise<NotificationDeliveryLease | null> {
    const leaseId = randomUUID();
    return this.client.transaction(async tx => {
      const rows = await tx.query<NotificationDeliveryLease>(`with candidate as (
        select id from notification_deliveries where channel in ('email','sms') and status = 'queued'
          and available_at <= clock_timestamp() and attempt_count < 5
        order by available_at,id limit 1 for update skip locked
      ) update notification_deliveries d set status = 'leased',lease_id = $1,
        lease_expires_at = clock_timestamp() + interval '60 seconds',outcome = null,updated_at = clock_timestamp()
        from candidate c where d.id = c.id returning d.id,d.recipient_user_id as "recipientUserId",d.lease_id as "leaseId"`,
      [leaseId]);
      return rows[0] ?? null;
    });
  }

  prepare(lease: NotificationDeliveryLease): Promise<PreparedNotificationDelivery | null> {
    return this.client.transaction(async tx => {
      const job = await lockedJob(tx, lease, "leased");
      if (!job) return null;
      try {
        await assertLivePersona(tx, { userId: job.recipientUserId, role: job.audienceRole, tenantSchoolId: job.tenantSchoolId }, false);
      } catch (error) {
        if (error instanceof CuacError && error.status === 403) {
          await terminal(tx, job, "suppressed", "ineligible", null);
          return null;
        }
        throw error;
      }
      const destination = job.channel === "email" ? await verifiedEmail(tx, job.recipientUserId) : null;
      if (!destination) {
        await terminal(tx, job, "suppressed", "destination_unavailable", null);
        return null;
      }
      if (job.attemptCount >= 5) {
        await terminal(tx, job, "failed", "attempt_limit", null);
        return null;
      }
      const changed = await tx.query<{ id: string }>(`update notification_deliveries set status = 'sending',
        attempt_count = attempt_count + 1,updated_at = clock_timestamp()
        where id = $1 and status = 'leased' and lease_id = $2 and lease_expires_at > clock_timestamp() returning id`,
      [job.id, lease.leaseId]);
      if (!changed[0]) return null;
      await workerAudit(tx, "notification.delivery.sending", job.id, { channel: job.channel, attemptCount: job.attemptCount + 1 });
      return { id: job.id, channel: job.channel, to: destination, title: job.title, body: job.body, actionPath: job.actionPath };
    });
  }

  finish(lease: NotificationDeliveryLease, result: NotificationDeliveryResult, providerMessageId?: string): Promise<boolean> {
    if (!["accepted", "not_accepted", "unknown"].includes(result)) throw serviceUnavailable("Invalid notification delivery result.");
    return this.client.transaction(async tx => {
      const job = await lockedJob(tx, lease, "sending");
      if (!job) return false;
      if (result === "accepted") {
        const providerHash = hashProviderMessageId(providerMessageId);
        await terminal(tx, job, "accepted", "accepted", providerHash);
      } else if (result === "unknown") {
        await terminal(tx, job, "uncertain", "unknown", null);
      } else if (job.attemptCount >= 5) {
        await terminal(tx, job, "failed", "attempt_limit", null);
      } else {
        const delaySeconds = 30 * 2 ** (job.attemptCount - 1);
        await tx.query(`update notification_deliveries set status = 'queued',outcome = 'not_accepted',
          available_at = clock_timestamp() + $2 * interval '1 second',lease_id = null,lease_expires_at = null,
          updated_at = clock_timestamp() where id = $1`, [job.id, delaySeconds]);
        await workerAudit(tx, "notification.delivery.retry", job.id,
          { channel: job.channel, attemptCount: job.attemptCount, outcome: result });
      }
      return true;
    });
  }

  recover(limit = 100): Promise<{ recovered: number }> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw serviceUnavailable("Invalid notification recovery limit.");
    return this.client.transaction(async tx => {
      const jobs = await tx.query<Job>(`select ${jobProjection} from notification_deliveries
        where channel in ('email','sms') and ((status = 'queued' and attempt_count >= 5)
          or (status in ('leased','sending') and lease_expires_at <= clock_timestamp()))
        order by available_at,id limit $1 for update skip locked`, [limit]);
      for (const job of jobs) {
        if (job.status === "sending") await terminal(tx, job, "uncertain", "lease_expired", null);
        else if (job.status === "queued") await terminal(tx, job, "failed", "attempt_limit", null);
        else {
          await tx.query(`update notification_deliveries set status = 'queued',outcome = null,lease_id = null,
            lease_expires_at = null,available_at = clock_timestamp(),updated_at = clock_timestamp() where id = $1`, [job.id]);
          await workerAudit(tx, "notification.delivery.recovered", job.id,
            { channel: job.channel, attemptCount: job.attemptCount, outcome: "lease_expired_before_send" });
        }
      }
      return { recovered: jobs.length };
    });
  }
}

async function lockedJob(tx: TransactionalSqlClient, lease: NotificationDeliveryLease, status: "leased" | "sending") {
  await tx.query("select id from notification_deliveries where id = $1 and recipient_user_id = $2 for update",
    [lease.id, lease.recipientUserId]);
  const rows = await tx.query<Job>(`select ${jobProjection} from notification_deliveries
    where id = $1 and recipient_user_id = $2 and lease_id = $3 and status = $4
      and lease_expires_at > clock_timestamp()`, [lease.id, lease.recipientUserId, lease.leaseId, status]);
  return rows[0] ?? null;
}

async function verifiedEmail(tx: TransactionalSqlClient, userId: string): Promise<string | null> {
  const rows = await tx.query<{ emailNormalized: string }>(`select email_normalized as "emailNormalized" from users
    where id = $1 and account_status = 'active' and email_verified_at is not null for share`, [userId]);
  const email = rows[0]?.emailNormalized;
  return typeof email === "string" && email.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? email : null;
}

async function terminal(tx: TransactionalSqlClient, job: Job,
  status: "accepted" | "suppressed" | "failed" | "uncertain",
  outcome: "accepted" | "ineligible" | "destination_unavailable" | "attempt_limit" | "unknown" | "lease_expired",
  providerMessageIdHash: string | null,
) {
  await tx.query(`update notification_deliveries set status = $2,outcome = $3,provider_message_id_hash = $4,
    delivered_at = case when $2 = 'accepted' then clock_timestamp() else null end,completed_at = clock_timestamp(),
    lease_id = null,lease_expires_at = null,updated_at = clock_timestamp() where id = $1`,
  [job.id, status, outcome, providerMessageIdHash]);
  await workerAudit(tx, `notification.delivery.${status}`, job.id,
    { channel: job.channel, attemptCount: job.attemptCount, outcome });
}

function hashProviderMessageId(value?: string): string | null {
  if (value === undefined) return null;
  if (typeof value !== "string" || value.length < 1 || value.length > 512 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw serviceUnavailable("Provider message identifier is invalid.");
  }
  return createHash("sha256").update(value).digest("hex");
}
