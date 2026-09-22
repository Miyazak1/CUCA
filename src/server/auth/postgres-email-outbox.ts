import { createHash, randomUUID } from "node:crypto";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { serviceUnavailable } from "../shared/errors.ts";
import type { AuthEmailMessageType } from "./email-delivery.ts";
import { EmailTokenCipher, EmailTokenEnvelopeError, type EmailTokenBinding } from "./email-token-envelope.ts";
import type { EmailVerificationDeliverySink } from "./email-verification.ts";
import type { PasswordResetDeliverySink } from "./password-reset.ts";
import type { SchoolStaffInviteDeliverySink } from "./school-invites.ts";
import { normalizeAuthEmailLocale } from "./email-copy.ts";
import type { PublicUiLocale } from "../i18n/locales.ts";

export type EmailOutboxLease = { id: string; userId: string; leaseId: string };
export type EmailDeliveryResult = "accepted" | "not_accepted" | "unknown";
type Outcome = EmailDeliveryResult | "expired" | "ineligible" | "invalid_envelope" | "attempt_limit" | "lease_expired";
type Job = EmailTokenBinding & {
  status: string; attemptCount: number; envelope: unknown; leaseId: string | null; leaseValid: boolean; unexpired: boolean;
};
export type PreparedAuthEmail = EmailTokenBinding & { emailNormalized: string; token: string; locale: PublicUiLocale };

const projection = `id, user_id as "userId", message_type as "messageType",
  coalesce(verification_challenge_id, reset_challenge_id, school_staff_invite_id, guardian_consent_request_id) as "challengeId", expires_at as "expiresAt",
  status, attempt_count as "attemptCount", envelope_json as envelope, lease_id as "leaseId",
  lease_expires_at > clock_timestamp() as "leaseValid", expires_at > clock_timestamp() as unexpired`;
const hash = (token: string) => `sha256:${createHash("sha256").update(token).digest("hex")}`;

export class PostgresAuthEmailOutbox {
  private readonly client: TransactionalSqlClient;
  private readonly cipher: EmailTokenCipher;

  constructor(client: TransactionalSqlClient, cipher: EmailTokenCipher) {
    this.client = client;
    this.cipher = cipher;
  }

  verificationSink(): EmailVerificationDeliverySink {
    return { enqueue: input => this.enqueue("auth.email_verification", input, input.verificationToken) };
  }

  resetSink(): PasswordResetDeliverySink {
    return { enqueue: input => this.enqueue("auth.password_reset", input, input.resetToken) };
  }

  schoolInviteSink(): SchoolStaffInviteDeliverySink {
    return {
      send: input => this.enqueue("auth.school_staff_invite", {
        challengeId: input.inviteId,
        userId: input.invitedByUserId,
        emailNormalized: input.emailNormalized,
        expiresAt: input.expiresAt,
      }, input.inviteToken),
    };
  }

  guardianConsentSink() {
    return {
      enqueue: (input: { requestId: string; userId: string; guardianEmailNormalized: string; consentToken: string; expiresAt: Date }) =>
        this.enqueue("auth.guardian_consent", {
          challengeId: input.requestId,
          userId: input.userId,
          emailNormalized: input.guardianEmailNormalized,
          expiresAt: input.expiresAt,
        }, input.consentToken),
    };
  }

  private async enqueue(messageType: AuthEmailMessageType, input: { challengeId: string; userId: string; emailNormalized: string; expiresAt: Date }, token: string): Promise<void> {
    const binding = { id: randomUUID(), userId: input.userId, challengeId: input.challengeId, messageType, expiresAt: input.expiresAt };
    const envelope = this.cipher.seal(binding, token);
    await this.client.transaction(async tx => {
      await tx.query("select id from users where id = $1 for update", [input.userId]);
      const challenge = await eligibleChallenge(tx, binding);
      if (!challenge) throw serviceUnavailable("Auth email request became ineligible before enqueue.");
      if (challenge.emailNormalized !== input.emailNormalized) throw serviceUnavailable("Auth email recipient changed before enqueue.");
      if (challenge.tokenHash !== hash(token)) throw serviceUnavailable("Auth email credential changed before enqueue.");
      if (challenge.expiresAt.getTime() !== input.expiresAt.getTime()) throw serviceUnavailable("Auth email expiry changed before enqueue.");
      await tx.query(`insert into auth_email_outbox (id,user_id,message_type,verification_challenge_id,reset_challenge_id,school_staff_invite_id,guardian_consent_request_id,expires_at,envelope_json)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`, [binding.id, binding.userId, messageType,
        messageType === "auth.email_verification" ? binding.challengeId : null,
        messageType === "auth.password_reset" ? binding.challengeId : null,
        messageType === "auth.school_staff_invite" ? binding.challengeId : null,
        messageType === "auth.guardian_consent" ? binding.challengeId : null,
        binding.expiresAt, JSON.stringify(envelope)]);
      await audit(tx, binding.id, "enqueued", messageType, 0, null);
    });
  }

  async claim(): Promise<EmailOutboxLease | null> {
    const leaseId = randomUUID();
    return this.client.transaction(async tx => {
      const rows = await tx.query<EmailOutboxLease>(`with candidate as (
        select id from auth_email_outbox where status = 'queued' and available_at <= clock_timestamp()
          and expires_at > clock_timestamp() and attempt_count < 5
        order by available_at, id limit 1 for update skip locked
      ) update auth_email_outbox q set status = 'leased', lease_id = $1,
        lease_expires_at = clock_timestamp() + interval '60 seconds', updated_at = clock_timestamp()
        from candidate c where q.id = c.id returning q.id, q.user_id as "userId", q.lease_id as "leaseId"`, [leaseId]);
      return rows[0] ?? null;
    });
  }

  async prepare(lease: EmailOutboxLease): Promise<PreparedAuthEmail | null> {
    return this.client.transaction(async tx => {
      // Account mutation/credential consumption uses the same first lock. No network work holds it.
      await tx.query("select id from users where id = $1 for update", [lease.userId]);
      const job = await lockedJob(tx, lease, "leased");
      if (!job) return null;
      if (!job.unexpired) {
        if (job.messageType === "auth.guardian_consent") await expireGuardianRegistration(tx, job.challengeId);
        await terminal(tx, job, "cancelled", "expired"); return null;
      }
      const challenge = await eligibleChallenge(tx, job);
      if (!challenge || challenge.expiresAt.getTime() !== job.expiresAt.getTime()) {
        await terminal(tx, job, "cancelled", "ineligible"); return null;
      }
      let token: string;
      try { token = this.cipher.open(job, job.envelope); }
      catch (error) {
        if (error instanceof EmailTokenEnvelopeError && error.reason === "invalid_envelope") {
          await terminal(tx, job, "failed", "invalid_envelope"); return null;
        }
        throw serviceUnavailable("Auth email encryption key is unavailable.");
      }
      if (hash(token) !== challenge.tokenHash) { await terminal(tx, job, "failed", "invalid_envelope"); return null; }
      if (job.attemptCount >= 5) { await terminal(tx, job, "failed", "attempt_limit"); return null; }
      const rows = await tx.query<{ id: string }>(`update auth_email_outbox set status = 'sending', attempt_count = attempt_count + 1,
        updated_at = clock_timestamp() where id = $1 and lease_expires_at > clock_timestamp() and expires_at > clock_timestamp() returning id`, [job.id]);
      if (!rows[0]) return null;
      await audit(tx, job.id, "sending", job.messageType, job.attemptCount + 1, null);
      return { id: job.id, userId: job.userId, challengeId: job.challengeId, messageType: job.messageType,
        expiresAt: job.expiresAt, emailNormalized: challenge.emailNormalized, token,
        locale: job.messageType === "auth.school_staff_invite" ? "en" : normalizeAuthEmailLocale(challenge.locale) };
    });
  }

  async finish(lease: EmailOutboxLease, result: EmailDeliveryResult): Promise<boolean> {
    if (!["accepted", "not_accepted", "unknown"].includes(result)) throw serviceUnavailable("Invalid auth email delivery outcome.");
    return this.client.transaction(async tx => {
      const job = await lockedJob(tx, lease, "sending");
      if (!job) return false;
      if (result === "accepted") await terminal(tx, job, "accepted", result);
      else if (result === "unknown") await terminal(tx, job, "uncertain", result);
      else if (!job.unexpired) await terminal(tx, job, "cancelled", "expired");
      else if (job.attemptCount >= 5) await terminal(tx, job, "failed", "attempt_limit");
      else {
        const delaySeconds = 30 * 2 ** (job.attemptCount - 1);
        await tx.query(`update auth_email_outbox set status = 'queued', lease_id = null, lease_expires_at = null,
          outcome = 'not_accepted', available_at = clock_timestamp() + $2 * interval '1 second', updated_at = clock_timestamp() where id = $1`, [job.id, delaySeconds]);
        await audit(tx, job.id, "retry", job.messageType, job.attemptCount, result);
      }
      return true;
    });
  }

  async recover(limit = 100): Promise<{ recovered: number }> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw serviceUnavailable("Invalid auth email recovery limit.");
    return this.client.transaction(async tx => {
      const jobs = await tx.query<Job>(`select ${projection} from auth_email_outbox
        where status in ('queued','leased','sending') and (expires_at <= clock_timestamp()
          or (status in ('leased','sending') and lease_expires_at <= clock_timestamp())
          or (status = 'queued' and attempt_count >= 5))
        order by expires_at, id limit $1 for update skip locked`, [limit]);
      for (const job of jobs) {
        if (job.status === "sending") await terminal(tx, job, "uncertain", "lease_expired");
        else if (!job.unexpired) {
          if (job.messageType === "auth.guardian_consent") await expireGuardianRegistration(tx, job.challengeId);
          await terminal(tx, job, "cancelled", "expired");
        }
        else if (job.attemptCount >= 5) await terminal(tx, job, "failed", "attempt_limit");
        else {
          await tx.query(`update auth_email_outbox set status = 'queued', lease_id = null, lease_expires_at = null,
            outcome = 'lease_expired', available_at = clock_timestamp(), updated_at = clock_timestamp() where id = $1`, [job.id]);
          await audit(tx, job.id, "recovered", job.messageType, job.attemptCount, "lease_expired");
        }
      }
      return { recovered: jobs.length };
    });
  }
}

async function lockedJob(tx: TransactionalSqlClient, lease: EmailOutboxLease, status: "leased" | "sending"): Promise<Job | null> {
  await tx.query(`select id from auth_email_outbox where id = $1 and user_id = $2 for update`, [lease.id, lease.userId]);
  // A separate statement observes time and committed state after any lock wait.
  const rows = await tx.query<Job>(`select ${projection} from auth_email_outbox
    where id = $1 and user_id = $2 and lease_id = $3 and status = $4 and lease_expires_at > clock_timestamp()`, [lease.id, lease.userId, lease.leaseId, status]);
  return rows[0] ?? null;
}

async function eligibleChallenge(tx: TransactionalSqlClient, binding: EmailTokenBinding) {
  if (binding.messageType === "auth.guardian_consent") {
    const rows = await tx.query<{ emailNormalized: string; tokenHash: string; expiresAt: Date; locale: string }>(`select
      c.guardian_email as "emailNormalized", c.consent_token_hash as "tokenHash", c.expires_at as "expiresAt", u.locale
      from guardian_consent_requests c join users u on u.id = c.user_id
      where c.id = $1 and c.user_id = $2 and c.status = 'pending' and c.responded_at is null
        and c.expires_at > clock_timestamp() and u.account_status = 'pending_guardian_consent'
        and c.guardian_email is not null and c.consent_token_hash is not null for share of c`,
    [binding.challengeId, binding.userId]);
    return rows[0] ?? null;
  }
  if (binding.messageType === "auth.school_staff_invite") {
    const rows = await tx.query<{ emailNormalized: string; tokenHash: string; expiresAt: Date; locale: string }>(`select c.email_normalized as "emailNormalized",
      c.token_hash as "tokenHash", c.expires_at as "expiresAt", 'en'::text as locale from school_staff_invites c
      join users u on u.id = c.invited_by_user_id join schools s on s.id = c.school_id
      where c.id = $1 and c.invited_by_user_id = $2 and c.status = 'pending' and c.revoked_at is null
        and c.accepted_at is null and c.expires_at > clock_timestamp() and u.account_status = 'active' and s.status = 'active'
        and exists (select 1 from user_roles r join cuac_staff_access_grants g
          on g.user_id = u.id and g.requested_role = r.role
          where r.user_id = u.id and r.role in ('cuac_ops','cuac_admin') and r.revoked_at is null
            and g.status = 'approved' and g.approved_at is not null and g.approved_by_user_id is not null
            and g.revoked_at is null and g.expires_at > clock_timestamp()) for share of c`,
    [binding.challengeId, binding.userId]);
    return rows[0] ?? null;
  }
  const verification = binding.messageType === "auth.email_verification";
  const table = verification ? "email_verification_challenges" : "password_reset_challenges";
  const hashColumn = verification ? "verification_token_hash" : "reset_token_hash";
  const available = verification ? "c.verified_at is null and u.email_verified_at is null"
    : "c.consumed_at is null and exists (select 1 from auth_identities i where i.user_id = u.id and i.provider = 'password' and i.email_normalized = u.email_normalized and i.password_hash is not null)";
  const rows = await tx.query<{ emailNormalized: string; tokenHash: string; expiresAt: Date; locale: string }>(`select c.email_normalized as "emailNormalized",
    c.${hashColumn} as "tokenHash", c.expires_at as "expiresAt", u.locale from ${table} c join users u on u.id = c.user_id
    where c.id = $1 and c.user_id = $2 and c.status = 'pending' and c.expires_at > clock_timestamp()
      and u.account_status = 'active' and u.email_normalized = c.email_normalized and ${available} for share of c`, [binding.challengeId, binding.userId]);
  return rows[0] ?? null;
}

async function terminal(tx: TransactionalSqlClient, job: Job, status: "accepted" | "cancelled" | "failed" | "uncertain", outcome: Outcome) {
  await tx.query(`update auth_email_outbox set status = $2, outcome = $3, envelope_json = null, lease_id = null,
    lease_expires_at = null, completed_at = clock_timestamp(), updated_at = clock_timestamp() where id = $1`, [job.id, status, outcome]);
  await audit(tx, job.id, status, job.messageType, job.attemptCount, outcome);
}

async function expireGuardianRegistration(tx: TransactionalSqlClient, requestId: string) {
  const rows = await tx.query<{ userId: string }>(`update guardian_consent_requests set status = 'expired',
    guardian_email = null,consent_token_hash = null,responded_at = clock_timestamp(),updated_at = clock_timestamp()
    where id = $1 and status = 'pending' and expires_at <= clock_timestamp() returning user_id as "userId"`, [requestId]);
  if (!rows[0]) return;
  await tx.query(`update auth_identities set password_hash = null,updated_at = clock_timestamp()
    where user_id = $1 and provider = 'password'`, [rows[0].userId]);
  await tx.query(`update users set account_status = 'guardian_expired',updated_at = clock_timestamp()
    where id = $1 and account_status = 'pending_guardian_consent'`, [rows[0].userId]);
  await tx.query(`insert into audit_logs (request_id,actor_type,active_role,action,resource_type,resource_id,
    allowed,data_classes,redaction_applied,metadata_json) values ($1,'service','system','auth.guardian_consent.expired',
    'guardian_consent_request',$2,true,'["account","minor"]'::jsonb,true,'{}'::jsonb)`, [randomUUID(), requestId]);
}

async function audit(tx: TransactionalSqlClient, id: string, transition: string, messageType: AuthEmailMessageType, attemptCount: number, outcome: Outcome | null) {
  await tx.query(`insert into audit_logs (request_id,actor_type,active_role,action,resource_type,resource_id,allowed,data_classes,redaction_applied,metadata_json)
    values ($1,'service','system',$2,'auth_email_outbox',$3,true,'["secret"]'::jsonb,true,$4::jsonb)`,
  [randomUUID(), `auth.email_outbox.${transition}`, id, JSON.stringify({ messageType, attemptCount, outcome })]);
}
