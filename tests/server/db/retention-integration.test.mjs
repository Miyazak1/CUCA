import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import test from "node:test";
import pg from "pg";
import { runPostgresMigrations } from "../../../src/server/db/migration-runtime.ts";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { PostgresNotificationPublisher } from "../../../src/server/notifications/postgres-repository.ts";
import { materializeApplicationSubmittedNotification } from "../../../src/server/notifications/templates.ts";
import { PostgresRetentionProcessor } from "../../../src/server/retention/postgres-retention.ts";

const databaseUrl = process.env.CUAC_PG_REHEARSAL_URL;
assert.ok(databaseUrl, "Run npm run db:pg:rehearse:retention; this test never uses DATABASE_URL.");
const target = new URL(databaseUrl);
assert.equal(target.protocol, "postgresql:");
assert.equal(target.hostname, "127.0.0.1");
assert.equal(target.username, "cuac_rehearsal");
assert.match(target.pathname, /^\/cuac_rehearsal_[a-f0-9]{24}$/);
assert.equal(target.search, "");

const pool = new pg.Pool({ connectionString: databaseUrl, max: 4,
  connectionTimeoutMillis: 5_000, statement_timeout: 10_000 });

test("real PostgreSQL retention boundaries and aggregate audit", { timeout: 120_000 }, async t => {
  t.after(() => pool.end());
  await runPostgresMigrations({
    databaseUrl,
    migrationsFolder: fileURLToPath(new URL("../../../drizzle/pg", import.meta.url)),
    targetEnvironment: "development",
    productionMigrationAllowed: false,
    runbookAcknowledged: false,
  });

  const userId = randomUUID();
  await pool.query(`insert into users(id,email,email_normalized,account_status)
    values($1,'retention@example.invalid','retention@example.invalid','active')`, [userId]);
  await pool.query("insert into user_roles(user_id,role) values($1,'student')", [userId]);
  const oldSession = randomUUID(), recentSession = randomUUID();
  await pool.query(`insert into auth_sessions(id,user_id,session_token_hash,selected_surface,active_role,expires_at)
    values($1,$3,$4,'student','student',clock_timestamp()-interval '31 days'),
      ($2,$3,$5,'student','student',clock_timestamp()-interval '29 days')`,
  [oldSession, recentSession, userId, `sha256:${"1".repeat(64)}`, `sha256:${"2".repeat(64)}`]);

  const oldVerification = randomUUID(), freshVerification = randomUUID();
  await pool.query(`insert into email_verification_challenges
    (id,user_id,email_normalized,verification_token_hash,status,requested_at,expires_at)
    values($1,$3,'retention@example.invalid',$4,'expired',clock_timestamp()-interval '3 days',clock_timestamp()-interval '2 days'),
      ($2,$3,'retention@example.invalid',$5,'pending',clock_timestamp(),clock_timestamp()+interval '1 day')`,
  [oldVerification, freshVerification, userId, `sha256:${"3".repeat(64)}`, `sha256:${"4".repeat(64)}`]);
  await pool.query(`insert into auth_email_outbox
    (id,user_id,message_type,verification_challenge_id,expires_at,envelope_json,status,attempt_count,
      available_at,outcome,completed_at,created_at,updated_at)
    values($1,$2,'auth.email_verification',$3,clock_timestamp()-interval '2 days',null,'cancelled',0,
      clock_timestamp()-interval '2 days','expired',clock_timestamp()-interval '2 days',
      clock_timestamp()-interval '3 days',clock_timestamp()-interval '2 days')`,
  [randomUUID(), userId, oldVerification]);

  const continuation = randomUUID();
  await pool.query(`insert into sign_in_continuations
    (id,continuation_token_hash,target_route,action_key,created_at,expires_at)
    values($1,$2,'/student-hub-v2.html','open',clock_timestamp()-interval '3 days',clock_timestamp()-interval '2 days')`,
  [continuation, `sha256:${"5".repeat(64)}`]);
  const mfa = randomUUID();
  await pool.query(`insert into auth_mfa_challenges
    (id,user_id,challenge_token_hash,purpose,selected_surface,active_role,password_hash_fingerprint,
      created_at,expires_at)
    values($1,$2,$3,'login','ops','cuac_ops',$4,clock_timestamp()-interval '3 days',clock_timestamp()-interval '2 days')`,
  [mfa, userId, `sha256:${"6".repeat(64)}`, `sha256:${"7".repeat(64)}`]);
  const bucket = randomUUID();
  await pool.query(`insert into auth_rate_limit_buckets
    (id,action,key_hash,window_start,window_seconds,attempt_count,expires_at,last_attempt_at)
    values($1,'login',$2,clock_timestamp()-interval '3 days',60,1,
      clock_timestamp()-interval '2 days',clock_timestamp()-interval '3 days')`,
  [bucket, `sha256:${"8".repeat(64)}`]);

  const notificationPublisher = new PostgresNotificationPublisher(createTransactionalSqlClient(pool));
  const removableEvent = await notificationPublisher.publish(materializeApplicationSubmittedNotification({
    recipientUserId: userId, applicationSubmissionId: randomUUID(), applicationSetId: randomUUID(),
    occurredAt: new Date("2025-01-01T00:00:00.000Z"),
  }));
  const queuedEvent = await notificationPublisher.publish(materializeApplicationSubmittedNotification({
    recipientUserId: userId, applicationSubmissionId: randomUUID(), applicationSetId: randomUUID(),
    occurredAt: new Date("2025-01-02T00:00:00.000Z"),
  }));
  await pool.query("update notification_events set created_at=clock_timestamp()-interval '181 days' where id=any($1::uuid[])",
    [[removableEvent.eventId, queuedEvent.eventId]]);
  await pool.query(`update notification_deliveries set status='suppressed',outcome='preference_disabled',
    completed_at=clock_timestamp()-interval '181 days' where event_id=$1 and channel in ('email','sms')`,
  [removableEvent.eventId]);

  const dormantUserId = randomUUID();
  await pool.query(`insert into users(id,email,email_normalized,account_status,locale,created_at,updated_at)
    values($1,'dormant@example.invalid','dormant@example.invalid','active','zh-CN',
      clock_timestamp()-interval '23 months 15 days',clock_timestamp()-interval '23 months 15 days')`, [dormantUserId]);
  await pool.query("insert into user_roles(user_id,role) values($1,'student')", [dormantUserId]);

  const result = await new PostgresRetentionProcessor(createTransactionalSqlClient(pool)).processBatch(100);
  assert.equal(result.sessionsDeleted, 1);
  assert.equal(result.verificationChallengesDeleted, 1);
  assert.equal(result.continuationsDeleted, 1);
  assert.equal(result.mfaChallengesDeleted, 1);
  assert.equal(result.rateLimitBucketsDeleted, 1);
  assert.equal(result.businessNotificationEventsDeleted, 1);
  assert.equal(result.inactiveAccountWarningsCreated, 1);
  assert.equal((await pool.query("select count(*)::int n from auth_sessions where id=$1", [oldSession])).rows[0].n, 0);
  assert.equal((await pool.query("select count(*)::int n from auth_sessions where id=$1", [recentSession])).rows[0].n, 1);
  assert.equal((await pool.query("select count(*)::int n from email_verification_challenges where id=$1", [freshVerification])).rows[0].n, 1);
  assert.equal((await pool.query("select count(*)::int n from notification_events where id=$1", [removableEvent.eventId])).rows[0].n, 0);
  assert.equal((await pool.query("select count(*)::int n from notification_events where id=$1", [queuedEvent.eventId])).rows[0].n, 1);
  const warning = await pool.query(`select e.topic,e.event_type,t.locale,count(*) over()::int as deliveries
    from notification_events e join notification_deliveries d on d.event_id=e.id
    join notification_templates t on t.id=d.template_id
    where e.recipient_user_id=$1 and e.event_type='account_inactivity_warning' order by d.channel`, [dormantUserId]);
  assert.equal(warning.rows.length, 2);
  assert.ok(warning.rows.every(row => row.topic === "account_security" && row.locale === "zh-CN" && row.deliveries === 2));
  const replay = await new PostgresRetentionProcessor(createTransactionalSqlClient(pool)).processBatch(100);
  assert.equal(replay.inactiveAccountWarningsCreated, 0);
  const audits = await pool.query(`select metadata_json from audit_logs
    where action='retention.batch.completed' order by created_at desc limit 1`);
  assert.equal(audits.rows.length, 1);
  assert.equal(audits.rows[0].metadata_json.processed, result.processed);
  assert.equal(JSON.stringify(audits.rows[0].metadata_json).includes("retention@example.invalid"), false);
});
