import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { randomUUID } from "node:crypto";
import { forbidden, serviceUnavailable } from "../shared/errors.ts";
import type { GuardianConsentRepository, PendingGuardianRegistrationInput } from "./guardian-consent.ts";
import { PostgresAuthEmailOutbox } from "./postgres-email-outbox.ts";
import type { EmailTokenCipher } from "./email-token-envelope.ts";

type NoticeRow = { versionId: string; contentSha256: string; revision: number; scopeKey: string };

export class PostgresGuardianConsentRepository implements GuardianConsentRepository {
  private readonly client: TransactionalSqlClient;
  private readonly cipher: EmailTokenCipher;
  constructor(client: TransactionalSqlClient, cipher: EmailTokenCipher) { this.client = client; this.cipher = cipher; }

  async findIdentity(emailNormalized: string) {
    const rows = await this.client.query<{ userId: string }>(
      `select user_id as "userId" from auth_identities where provider = 'password' and email_normalized = $1 limit 1`,
      [emailNormalized],
    );
    return rows[0] ?? null;
  }

  async createPending(input: PendingGuardianRegistrationInput) {
    return this.client.transaction(async tx => {
      const scopeKey = `children_privacy_notice:${input.locale}`;
      const notices = await tx.query<NoticeRow>(`select p.version_id as "versionId",p.content_sha256 as "contentSha256",
        p.revision,p.scope_key as "scopeKey" from privacy_notice_publications p
        join privacy_notice_versions v on v.id = p.version_id and v.scope_key = p.scope_key
        where p.scope_key = $1 and p.status = 'active' and v.review_status = 'approved'
          and v.effective_from <= $2 and v.review_due_at > $2 limit 1 for share of p,v`, [scopeKey, input.requestedAt]);
      const notice = notices[0];
      if (!notice) throw serviceUnavailable("The children's privacy notice is not currently published for this language.");
      const users = await tx.query<{ userId: string }>(`with created_user as (
        insert into users (email,email_normalized,display_name,account_status,locale,created_at,updated_at)
        values ($1,$2,$3,'pending_guardian_consent',$4,$5,$5) returning id
      ), created_identity as (
        insert into auth_identities (user_id,provider,provider_subject,password_hash,email_normalized,metadata_json,created_at,updated_at)
        select id,'password',$2,$6,$2,'{}'::jsonb,$5,$5 from created_user returning user_id
      ) select user_id as "userId" from created_identity`,
      [input.email, input.emailNormalized, input.displayName, input.uiLocale, input.requestedAt, input.passwordHash]);
      const userId = users[0]?.userId;
      if (!userId) throw serviceUnavailable("The pending child account could not be created.");
      await tx.query(`insert into guardian_consent_requests (
        id,user_id,guardian_email,guardian_email_sha256,guardian_relationship,locale,notice_scope_key,
        notice_version_id,notice_content_sha256,notice_publication_revision,consent_token_hash,status,
        requested_at,expires_at,ip_hash,user_agent_hash,created_at,updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending',$12,$13,$14,$15,$12,$12)`,
      [input.id, userId, input.guardianEmailNormalized, input.guardianEmailSha256, input.guardianRelationship,
        input.locale, notice.scopeKey, notice.versionId, notice.contentSha256, notice.revision, input.consentTokenHash,
        input.requestedAt, input.expiresAt, input.ipHash, input.userAgentHash]);
      await new PostgresAuthEmailOutbox(tx, this.cipher).guardianConsentSink().enqueue({ requestId: input.id, userId,
        guardianEmailNormalized: input.guardianEmailNormalized, consentToken: input.consentToken, expiresAt: input.expiresAt });
      await audit(tx, "auth.guardian_consent.requested", input.id, {
        noticeLocale: input.locale, uiLocale: input.uiLocale, relationship: input.guardianRelationship,
      });
      return { requestId: input.id, expiresAt: input.expiresAt };
    });
  }

  async accept(input: { requestId: string; tokenHash: string; now: Date }) {
    return this.client.transaction(async tx => {
      const rows = await tx.query<{ userId: string; childEmail: string; guardianRelationship: string; guardianEmailSha256: string;
        noticeScopeKey: string; noticeVersionId: string; noticeContentSha256: string; noticePublicationRevision: number }>(`select
        c.user_id as "userId",u.email as "childEmail",c.guardian_relationship as "guardianRelationship",
        c.guardian_email_sha256 as "guardianEmailSha256",c.notice_scope_key as "noticeScopeKey",
        c.notice_version_id as "noticeVersionId",c.notice_content_sha256 as "noticeContentSha256",
        c.notice_publication_revision as "noticePublicationRevision"
        from guardian_consent_requests c join users u on u.id = c.user_id
        join privacy_notice_publications p on p.scope_key = c.notice_scope_key and p.version_id = c.notice_version_id
          and p.content_sha256 = c.notice_content_sha256 and p.revision = c.notice_publication_revision and p.status = 'active'
        join privacy_notice_versions v on v.id = p.version_id and v.scope_key = p.scope_key
          and v.review_status = 'approved' and v.effective_from <= $3 and v.review_due_at > $3
        where c.id = $1 and c.consent_token_hash = $2 and c.status = 'pending' and c.responded_at is null
          and c.expires_at > $3 and u.account_status = 'pending_guardian_consent' for update of c,u`,
      [input.requestId, input.tokenHash, input.now]);
      const row = rows[0];
      if (!row) {
        throw forbidden("Guardian consent link is invalid, expired, or no longer active.");
      }
      await tx.query(`update users set account_status = 'active',updated_at = $2 where id = $1`, [row.userId, input.now]);
      await tx.query(`insert into user_roles (user_id,role,grant_source,created_at) values ($1,'student','guardian_consent',$2)`, [row.userId, input.now]);
      await tx.query(`insert into student_age_assurances (
        user_id,age_band,assurance_method,guardian_relationship,guardian_email_sha256,notice_scope_key,
        notice_version_id,notice_content_sha256,notice_publication_revision,source_registration_id,assured_at,created_at
      ) values ($1,'under_14','guardian_consent',$2,$3,$4,$5,$6,$7,$8,$9,$9)`,
      [row.userId, row.guardianRelationship, row.guardianEmailSha256, row.noticeScopeKey, row.noticeVersionId,
        row.noticeContentSha256, row.noticePublicationRevision, input.requestId, input.now]);
      await tx.query(`update guardian_consent_requests set status = 'consented',guardian_email = null,
        consent_token_hash = null,responded_at = $2,updated_at = $2 where id = $1`, [input.requestId, input.now]);
      await tx.query(`update auth_email_outbox set status = 'cancelled',outcome = 'ineligible',envelope_json = null,
        lease_id = null,lease_expires_at = null,completed_at = $2,updated_at = $2
        where guardian_consent_request_id = $1 and status in ('queued','leased')`, [input.requestId, input.now]);
      await audit(tx, "auth.guardian_consent.accepted", input.requestId, { userId: row.userId });
      return { userId: row.userId, childEmail: row.childEmail };
    });
  }

  async decline(input: { requestId: string; tokenHash: string; now: Date }) {
    return this.client.transaction(async tx => {
      const rows = await tx.query<{ userId: string }>(`select c.user_id as "userId" from guardian_consent_requests c
        join users u on u.id = c.user_id where c.id = $1 and c.consent_token_hash = $2 and c.status = 'pending'
        and c.responded_at is null and c.expires_at > $3 and u.account_status = 'pending_guardian_consent' for update of c,u`,
      [input.requestId, input.tokenHash, input.now]);
      const row = rows[0];
      if (!row) throw forbidden("Guardian consent link is invalid, expired, or no longer active.");
      await terminate(tx, input.requestId, row.userId, "declined", input.now);
      await audit(tx, "auth.guardian_consent.declined", input.requestId, {});
      return { declined: true };
    });
  }
}

async function terminate(tx: TransactionalSqlClient, requestId: string, userId: string, status: "declined" | "expired", now: Date) {
  await tx.query(`update auth_identities set password_hash = null,updated_at = $2 where user_id = $1 and provider = 'password'`, [userId, now]);
  await tx.query(`update users set account_status = $2,updated_at = $3 where id = $1`, [userId, `guardian_${status}`, now]);
  await tx.query(`update guardian_consent_requests set status = $2,guardian_email = null,consent_token_hash = null,
    responded_at = $3,updated_at = $3 where id = $1`, [requestId, status, now]);
  await tx.query(`update auth_email_outbox set status = 'cancelled',outcome = 'expired',envelope_json = null,
    lease_id = null,lease_expires_at = null,completed_at = $2,updated_at = $2
    where guardian_consent_request_id = $1 and status in ('queued','leased')`, [requestId, now]);
}

async function audit(tx: TransactionalSqlClient, action: string, resourceId: string, metadata: Record<string, unknown>) {
  await tx.query(`insert into audit_logs (request_id,actor_type,active_role,action,resource_type,resource_id,
    allowed,data_classes,redaction_applied,metadata_json) values ($1,'service','system',$2,
    'guardian_consent_request',$3,true,'["account","minor"]'::jsonb,true,$4::jsonb)`,
  [randomUUID(), action, resourceId, JSON.stringify(metadata)]);
}
