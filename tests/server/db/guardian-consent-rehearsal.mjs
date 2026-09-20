import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { EmailTokenCipher } from "../../../src/server/auth/email-token-envelope.ts";
import { PostgresAuthEmailOutbox } from "../../../src/server/auth/postgres-email-outbox.ts";
import { PostgresGuardianConsentRepository } from "../../../src/server/auth/postgres-guardian-consent.ts";
import { GuardianConsentService } from "../../../src/server/auth/guardian-consent.ts";

const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export async function runGuardianConsentRehearsal(t, pool) {
  await t.test("under-14 guardian approval creates no role or session before one-time consent", async () => {
    const client = createTransactionalSqlClient(pool);
    const cipher = new EmailTokenCipher({ activeKeyId: "rehearsal", keys: new Map([["rehearsal", randomBytes(32)]]) });
    const outbox = new PostgresAuthEmailOutbox(client, cipher);
    const service = new GuardianConsentService(new PostgresGuardianConsentRepository(client, cipher));
    const preparedEmail = `notice-preparer-${randomUUID()}@example.invalid`;
    const reviewerEmail = `notice-reviewer-${randomUUID()}@example.invalid`;
    const prepared = (await pool.query("insert into users (email,email_normalized) values ($1,$1) returning id", [preparedEmail])).rows[0];
    const reviewer = (await pool.query("insert into users (email,email_normalized) values ($1,$1) returning id", [reviewerEmail])).rows[0];
    const scopeKey = "children_privacy_notice:en";
    const content = { schemaVersion: 2, noticeKey: "children_privacy_notice", locale: "en", title: "Children's Privacy Notice", sections: [] };
    const contentSha256 = digest(content);
    await pool.query("insert into privacy_notice_scopes (scope_key,notice_key,locale) values ($1,'children_privacy_notice','en')", [scopeKey]);
    const version = (await pool.query(`insert into privacy_notice_versions (
      scope_key,version,content_json,content_sha256,prepared_by_user_id,review_status,approved_by_user_id,
      reviewed_at,effective_from,review_due_at,review_evidence_json,created_at
    ) values ($1,1,$2::jsonb,$3,$4,'approved',$5,now()-interval '2 days',now()-interval '1 day',now()+interval '1 year','{}'::jsonb,now()-interval '3 days') returning id`,
    [scopeKey, JSON.stringify(content), contentSha256, prepared.id, reviewer.id])).rows[0];
    await pool.query(`insert into privacy_notice_publications (scope_key,version_id,content_sha256,approval_sha256,revision,status)
      values ($1,$2,$3,$4,1,'active')`, [scopeKey, version.id, contentSha256, digest({ approved: true })]);

    const childEmail = `child-${randomUUID()}@example.invalid`;
    const pending = await service.request({ email: childEmail, password: "Synthetic child password 826!", displayName: "Synthetic Child",
      guardianEmail: `guardian-${randomUUID()}@example.invalid`, guardianRelationship: "parent", locale: "en" });
    const before = (await pool.query(`select u.account_status,(select count(*)::int from user_roles r where r.user_id=u.id) roles,
      (select count(*)::int from auth_sessions s where s.user_id=u.id) sessions from users u where u.email_normalized=$1`, [childEmail])).rows[0];
    assert.deepEqual(before, { account_status: "pending_guardian_consent", roles: 0, sessions: 0 });

    const queued = (await pool.query(`select id,user_id as "userId",message_type as "messageType",
      guardian_consent_request_id as "challengeId",expires_at as "expiresAt",envelope_json as envelope
      from auth_email_outbox where guardian_consent_request_id=$1`, [pending.requestId])).rows[0];
    const token = cipher.open(queued, queued.envelope);
    const activated = await service.accept({ requestId: pending.requestId, token });
    assert.equal(activated.childEmail, childEmail);
    const after = (await pool.query(`select u.account_status,(select count(*)::int from user_roles r where r.user_id=u.id and r.role='student') roles,
      (select count(*)::int from student_age_assurances a where a.user_id=u.id and a.age_band='under_14') assurances,
      c.guardian_email,c.consent_token_hash from users u join guardian_consent_requests c on c.user_id=u.id where u.id=$1`, [activated.userId])).rows[0];
    assert.deepEqual(after, { account_status: "active", roles: 1, assurances: 1, guardian_email: null, consent_token_hash: null });
    assert.equal((await pool.query("select status from auth_email_outbox where id=$1", [queued.id])).rows[0].status, "cancelled");
    await assert.rejects(service.accept({ requestId: pending.requestId, token }), /invalid, expired, or no longer active/);

    const declined = await service.request({ email: `declined-child-${randomUUID()}@example.invalid`, password: "Synthetic child password 826!",
      guardianEmail: `declining-guardian-${randomUUID()}@example.invalid`, guardianRelationship: "other_legal_guardian", locale: "en" });
    const declinedQueue = (await pool.query(`select id,user_id as "userId",message_type as "messageType",
      guardian_consent_request_id as "challengeId",expires_at as "expiresAt",envelope_json as envelope
      from auth_email_outbox where guardian_consent_request_id=$1`, [declined.requestId])).rows[0];
    const declineToken = cipher.open(declinedQueue, declinedQueue.envelope);
    assert.deepEqual(await service.decline({ requestId: declined.requestId, token: declineToken }), { declined: true });
    const declinedState = (await pool.query(`select c.status,c.guardian_email,i.password_hash,u.account_status
      from guardian_consent_requests c join users u on u.id=c.user_id join auth_identities i on i.user_id=u.id
      where c.id=$1`, [declined.requestId])).rows[0];
    assert.deepEqual(declinedState, { status: "declined", guardian_email: null, password_hash: null, account_status: "guardian_declined" });

    const expired = await service.request({ email: `expired-child-${randomUUID()}@example.invalid`, password: "Synthetic child password 826!",
      guardianEmail: `expired-guardian-${randomUUID()}@example.invalid`, guardianRelationship: "parent", locale: "en" });
    await pool.query(`update guardian_consent_requests set requested_at=clock_timestamp()-interval '2 hours',
      expires_at=clock_timestamp()-interval '1 hour' where id=$1`, [expired.requestId]);
    await pool.query(`update auth_email_outbox set expires_at=clock_timestamp()-interval '1 hour' where guardian_consent_request_id=$1`, [expired.requestId]);
    await outbox.recover(100);
    const expiredState = (await pool.query(`select c.status,c.guardian_email,i.password_hash,u.account_status
      from guardian_consent_requests c join users u on u.id=c.user_id join auth_identities i on i.user_id=u.id
      where c.id=$1`, [expired.requestId])).rows[0];
    assert.deepEqual(expiredState, { status: "expired", guardian_email: null, password_hash: null, account_status: "guardian_expired" });
  });
}
