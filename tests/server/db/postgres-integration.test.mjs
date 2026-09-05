import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import pg from "pg";
import { runPostgresMigrations } from "../../../src/server/db/migration-runtime.ts";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { CatalogSeedWriter } from "../../../src/server/catalog/seed-writer.ts";
import { PostgresCatalogRepository } from "../../../src/server/catalog/postgres-repository.ts";
import { PostgresSchoolStaffInviteRepository } from "../../../src/server/auth/school-invites-postgres-repository.ts";
import { hashSchoolStaffInviteToken } from "../../../src/server/auth/school-invites.ts";
import { runIdentityIsolationRehearsal } from "./identity-isolation-rehearsal.mjs";
import { runAuthChallengesRehearsal } from "./auth-challenges-rehearsal.mjs";
import { runHttpNetworkRehearsal } from "./http-network-rehearsal.mjs";
import { runAuditAtomicityRehearsal } from "./audit-atomicity-rehearsal.mjs";
import { runAgentContextRehearsal } from "./agent-context-rehearsal.mjs";
import { runAgentMemoryManagementRehearsal } from "./agent-memory-management-rehearsal.mjs";
import { runAgentToolGatewayRehearsal } from "./agent-tool-gateway-rehearsal.mjs";
import { runApplicationCommandsRehearsal } from "./application-commands-rehearsal.mjs";
import { runApplicationDraftRehearsal } from "./application-draft-rehearsal.mjs";
import { runApplicationRemovalRehearsal } from "./application-removal-rehearsal.mjs";
import { runApplicationEditRehearsal } from "./application-edit-rehearsal.mjs";
import { runApplicationIntakeRehearsal } from "./application-intake-rehearsal.mjs";
import { runApplicantProfileRehearsal } from "./applicant-profile-rehearsal.mjs";
import { runEducationHistoryRehearsal } from "./education-history-rehearsal.mjs";
import { runAssessmentHistoryRehearsal } from "./assessment-history-rehearsal.mjs";
import { runProgramRequirementsRehearsal } from "./program-requirements-rehearsal.mjs";
import { runRequirementGovernanceRehearsal } from "./requirement-governance-rehearsal.mjs";
import { runNoticesRehearsal } from "./notices-rehearsal.mjs";
import { runApplicationPreflightRehearsal } from "./application-preflight-rehearsal.mjs";
import { runMaterialSelectionRehearsal } from "./material-selection-rehearsal.mjs";
import { runEmailOutboxRehearsal } from "./email-outbox-rehearsal.mjs";
import { runApplicationMaterialPreviewRehearsal } from "./application-material-preview-rehearsal.mjs";
import { runApplicationSubmissionAuthorizationRehearsal } from "./application-submission-authorization-rehearsal.mjs";
import { runApplicationMaterialSnapshotRehearsal } from "./application-material-snapshot-rehearsal.mjs";
import { runOfficialSubmissionPolicyRehearsal } from "./official-submission-policy-rehearsal.mjs";
import { runApplicationAdmissionRouteRehearsal } from "./application-admission-route-rehearsal.mjs";
import { runSchoolApplicationTargetRehearsal } from "./school-application-target-rehearsal.mjs";
import { runSchemaConsistencyRehearsal } from "./schema-consistency-rehearsal.mjs";
import { runMigrationGuardRehearsal } from "./migration-guard-rehearsal.mjs";
import { runPostgresTransportRehearsal } from "./postgres-transport-rehearsal.mjs";
import { runMigrationReleaseRehearsal } from "./migration-release-rehearsal.mjs";
import { runApplicationFeeEntitlementRehearsal } from "./application-fee-entitlement-rehearsal.mjs";
import { runApplicationAtomicSubmissionRehearsal } from "./application-atomic-submission-rehearsal.mjs";
import { runStudentPrivateFilesRehearsal } from "./student-private-files-rehearsal.mjs";
import { runSchoolApplicationWorkflowRehearsal } from "./school-application-workflow-rehearsal.mjs";
import { runOfficialSubmissionDeliveryRehearsal } from "./official-submission-delivery-rehearsal.mjs";
import { runPaymentProviderReconciliationRehearsal } from "./payment-provider-reconciliation-rehearsal.mjs";
import { runAuthSessionStepUpRehearsal } from "./auth-session-step-up-rehearsal.mjs";
import { runCuacApplicationReferenceRehearsal } from "./cuac-application-reference-rehearsal.mjs";
import { runOpsApplicationSupportRehearsal } from "./ops-application-support-rehearsal.mjs";
import { runNotificationDeliveryRehearsal } from "./notification-delivery-rehearsal.mjs";
import { runOpsOperationsMonitoringRehearsal } from "./ops-operations-monitoring-rehearsal.mjs";
import { runOpsBillingReviewRehearsal } from "./ops-billing-review-rehearsal.mjs";
import { runOpsRoutingReviewRehearsal } from "./ops-routing-review-rehearsal.mjs";
import { runOpsDataQualityRehearsal } from "./ops-data-quality-rehearsal.mjs";
import { runSchoolCatalogCorrectionRehearsal } from "./school-catalog-correction-rehearsal.mjs";

const databaseUrl = process.env.CUAC_PG_REHEARSAL_URL;
assert.ok(databaseUrl, "Run npm run db:pg:rehearse; this test never uses DATABASE_URL.");
const target = new URL(databaseUrl);
assert.equal(target.protocol, "postgresql:");
assert.equal(target.hostname, "127.0.0.1");
assert.equal(target.username, "cuac_rehearsal");
assert.match(target.pathname, /^\/cuac_rehearsal_[a-f0-9]{24}$/);
assert.equal(target.search, "");
const pool = new pg.Pool({ connectionString: databaseUrl, max: 8, connectionTimeoutMillis: 5000, statement_timeout: 10_000 });
const client = createTransactionalSqlClient(pool);
const invites = new PostgresSchoolStaffInviteRepository(client);
const migrationConfig = {
  databaseUrl,
  migrationsFolder: fileURLToPath(new URL("../../../drizzle/pg", import.meta.url)),
  targetEnvironment: "development",
  productionMigrationAllowed: false,
  runbookAcknowledged: false,
};

const rehearsalTimeoutMs = process.env.CUAC_PG_HTTP_REHEARSAL === "1" ? 720_000 : 300_000;

test("real PostgreSQL migration and repository rehearsal", { timeout: rehearsalTimeoutMs }, async (t) => {
  t.after(() => pool.end());
  t.diagnostic(`PostgreSQL ${(await pool.query("show server_version")).rows[0].server_version}`);
  await t.test("all journal migrations execute and a second run is a no-op", async () => {
    await runPostgresMigrations(migrationConfig);
    const journal = JSON.parse(await readFile(new URL("../../../drizzle/pg/meta/_journal.json", import.meta.url), "utf8"));
    const first = await pool.query("select hash, created_at from drizzle.__drizzle_migrations order by id");
    assert.equal(first.rows.length, journal.entries.length);
    await runPostgresMigrations(migrationConfig);
    const second = await pool.query("select hash, created_at from drizzle.__drizzle_migrations order by id");
    assert.deepEqual(second.rows, first.rows);
  });

  await runSchemaConsistencyRehearsal(t, pool, databaseUrl);
  await runMigrationGuardRehearsal(t, pool, databaseUrl);
  await runMigrationReleaseRehearsal(t, pool, databaseUrl);
  await runPostgresTransportRehearsal(t, pool, databaseUrl);
  await runOpsApplicationSupportRehearsal(t, pool);
  await runNotificationDeliveryRehearsal(t, pool);
  await runOpsOperationsMonitoringRehearsal(t, pool);

  await t.test("catalog seed replay preserves IDs/evidence and public queries exclude drafts", async () => {
    const bundle = JSON.parse(await readFile(new URL("../../../seeds/catalog.sample.json", import.meta.url), "utf8"));
    const writer = new CatalogSeedWriter(client);
    const first = await writer.writeBundle(bundle);
    const second = await writer.writeBundle(bundle);
    assert.equal(first.ok, true);
    assert.deepEqual(second.written, first.written);
    assert.equal((await pool.query("select count(*)::int as total from catalog_source_evidence")).rows[0].total, 4);
    const catalog = new PostgresCatalogRepository(client);
    for (const method of ["listCities", "listSchools", "listPrograms", "listScholarships"]) {
      assert.deepEqual(await catalog[method]({}), []);
    }
    for (const table of ["cities", "schools", "programs", "scholarships"]) {
      await pool.query(`update ${table} set status = 'active'`);
    }
    for (const method of ["listCities", "listSchools", "listPrograms", "listScholarships"]) {
      assert.equal((await catalog[method]({})).length, 1);
    }
    const schools = await catalog.listSchools({ query: "Sample", limit: 1, offset: 0 });
    assert.equal(schools.length, 1);
    assert.equal((await catalog.getSchool(schools[0].id)).id, schools[0].id);
    assert.deepEqual(await catalog.listSchools({ query: "no-such-school" }), []);
  });

  await runAgentToolGatewayRehearsal(t, pool);

  async function fixture() {
    const suffix = randomUUID();
    const email = `teacher-${suffix}@example.invalid`;
    const { rows: [school] } = await pool.query("insert into schools (slug, name_en, status) values ($1, 'Rehearsal School', 'active') returning id", [suffix]);
    const { rows: [teacher] } = await pool.query("insert into users (email, email_normalized) values ($1, $1) returning id", [email]);
    const now = new Date();
    return {
      schoolId: school.id, userId: teacher.id,
      create: { schoolId: school.id, email, emailNormalized: email, role: "viewer", inviteTokenHash: hashSchoolStaffInviteToken(randomUUID()), invitedByUserId: teacher.id, now, expiresAt: new Date(now.getTime() + 60_000) },
    };
  }

  await t.test("replacing an invite invalidates the old token; revoke prevents acceptance", async () => {
    const { create } = await fixture();
    const first = await invites.createInvite(create);
    const replacement = await invites.createInvite({ ...create, inviteTokenHash: hashSchoolStaffInviteToken(randomUUID()) });
    assert.equal(await invites.findActiveInviteByIdAndTokenHash({ inviteId: first.inviteId, inviteTokenHash: create.inviteTokenHash, now: new Date() }), null);
    assert.equal((await invites.revokePendingInvite({ inviteId: replacement.inviteId, revokedByUserId: create.invitedByUserId, revokedAt: new Date() })).revoked, true);
    assert.equal(await invites.acceptInvite({ inviteId: replacement.inviteId, userId: create.invitedByUserId, schoolId: create.schoolId, role: create.role, acceptedAt: new Date(), invitedByUserId: create.invitedByUserId }), null);
    const rows = await pool.query("select status from school_staff_invites where school_id = $1", [create.schoolId]);
    assert.deepEqual(rows.rows.map((row) => row.status), ["revoked", "revoked"]);
  });

  await t.test("simultaneous replacements leave exactly one pending invite", async () => {
    const { create } = await fixture();
    const blocker = await pool.connect();
    let attempts = [];
    try {
      await blocker.query("begin");
      await blocker.query("select id from schools where id = $1 for update", [create.schoolId]);
      attempts = [0, 1].map(() => invites.createInvite({ ...create, inviteTokenHash: hashSchoolStaffInviteToken(randomUUID()) }));
      const settled = Promise.allSettled(attempts);
      let waiting = 0;
      for (let attempt = 0; attempt < 200; attempt += 1) {
        const result = await pool.query("select count(*)::int as total from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock' and state = 'active'");
        waiting = result.rows[0].total;
        if (waiting >= 2) break;
        await delay(20);
      }
      assert.ok(waiting >= 2, "both requests reached the database lock barrier");
      await blocker.query("commit");
      const results = await settled;
      assert.ok(results.every((result) => result.status === "fulfilled"), "both requests should succeed sequentially");
      const pending = await pool.query("select count(*)::int as total from school_staff_invites where school_id = $1 and status = 'pending'", [create.schoolId]);
      assert.equal(pending.rows[0].total, 1);
    } finally {
      await blocker.query("rollback");
      blocker.release();
      await Promise.allSettled(attempts);
    }
  });

  await t.test("simultaneous accept consumes once and grants only school_staff", async () => {
    const { create, userId } = await fixture();
    const { inviteId } = await invites.createInvite(create);
    const input = { inviteId, userId, schoolId: create.schoolId, role: create.role, acceptedAt: new Date(), invitedByUserId: create.invitedByUserId };
    const results = await Promise.all([invites.acceptInvite(input), invites.acceptInvite(input)]);
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal((await pool.query("select count(*)::int as total from school_staff_memberships where user_id = $1 and school_id = $2", [userId, create.schoolId])).rows[0].total, 1);
    const roles = await pool.query("select role from user_roles where user_id = $1 and revoked_at is null", [userId]);
    assert.deepEqual(roles.rows, [{ role: "school_staff" }]);
  });

  await t.test("failed replacement rolls back revocation of the prior invite", async () => {
    const { create } = await fixture();
    const first = await invites.createInvite(create);
    await assert.rejects(invites.createInvite(create), (error) => error.code === "23505");
    const active = await invites.findActiveInviteByIdAndTokenHash({ inviteId: first.inviteId, inviteTokenHash: create.inviteTokenHash, now: new Date() });
    assert.equal(active.id, first.inviteId);
  });

  await t.test("database constraint rejects bypassed duplicate pending invites", async () => {
    const { create } = await fixture();
    await invites.createInvite(create);
    await assert.rejects(
      pool.query("insert into school_staff_invites (school_id, email, email_normalized, role, token_hash, expires_at) values ($1, $2, $2, 'viewer', $3, $4)", [create.schoolId, create.emailNormalized, hashSchoolStaffInviteToken(randomUUID()), create.expiresAt]),
      (error) => error.code === "23505" && error.constraint === "school_staff_invites_pending_school_email_unique",
    );
  });

  await t.test("school deactivation between preflight and write leaves existing invitations unchanged", async () => {
    const { create } = await fixture();
    const first = await invites.createInvite(create);
    assert.equal((await invites.findSchoolById(create.schoolId)).status, "active");
    await pool.query("update schools set status = 'inactive' where id = $1", [create.schoolId]);
    await assert.rejects(invites.createInvite({ ...create, inviteTokenHash: hashSchoolStaffInviteToken(randomUUID()) }), /School is not available/);
    const prior = await pool.query("select status from school_staff_invites where id = $1", [first.inviteId]);
    assert.equal(prior.rows[0].status, "pending");
  });

  await runIdentityIsolationRehearsal(t, pool);
  await runCuacApplicationReferenceRehearsal(t, pool);
  await runAuthSessionStepUpRehearsal(t, pool);
  await runAuthChallengesRehearsal(t, pool);
  await runAuditAtomicityRehearsal(t, pool);
  await runAgentContextRehearsal(t, pool);
  await runAgentMemoryManagementRehearsal(t, pool);
  await runApplicationCommandsRehearsal(t, pool);
  await runApplicationDraftRehearsal(t, pool);
  await runApplicationRemovalRehearsal(t, pool);
  await runApplicationEditRehearsal(t, pool);
  await runApplicationIntakeRehearsal(t, pool);
  await runApplicantProfileRehearsal(t, pool);
  await runEducationHistoryRehearsal(t, pool);
  await runAssessmentHistoryRehearsal(t, pool);
  await runProgramRequirementsRehearsal(t, pool);
  await runRequirementGovernanceRehearsal(t, pool);
  await runNoticesRehearsal(t, pool);
  await runApplicationPreflightRehearsal(t, pool);
  await runSchoolApplicationTargetRehearsal(t, pool);
  await runApplicationMaterialPreviewRehearsal(t, pool);
  await runMaterialSelectionRehearsal(t, pool);
  await runApplicationSubmissionAuthorizationRehearsal(t, pool);
  await runApplicationMaterialSnapshotRehearsal(t, pool);
  await runOfficialSubmissionPolicyRehearsal(t, pool);
  await runApplicationAdmissionRouteRehearsal(t, pool);
  await runApplicationFeeEntitlementRehearsal(t, pool);
  await runPaymentProviderReconciliationRehearsal(t, pool);
  await runOpsBillingReviewRehearsal(t, pool);
  await runApplicationAtomicSubmissionRehearsal(t, pool);
  await runOfficialSubmissionDeliveryRehearsal(t, pool);
  await runSchoolApplicationWorkflowRehearsal(t, pool);
  await runOpsRoutingReviewRehearsal(t, pool);
  await runOpsDataQualityRehearsal(t, pool);
  await runSchoolCatalogCorrectionRehearsal(t, pool);
  await runStudentPrivateFilesRehearsal(t, pool, client);
  await runEmailOutboxRehearsal(t, pool);
  if (process.env.CUAC_PG_HTTP_REHEARSAL === "1") {
    await runHttpNetworkRehearsal(t, pool, databaseUrl);
    const { runHttpLifecycleRehearsal } = await import("./http-lifecycle-rehearsal.mjs");
    await runHttpLifecycleRehearsal(t, pool, databaseUrl);
  }
});
