import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";
import { runPostgresMigrationPlan } from "../../../src/server/db/migration-runtime.ts";
import { readPublicSchemaCatalog } from "./pg-schema-catalog.mjs";
import { withDetachedMigrationRelease } from "./migration-release-fixture.mjs";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { createPostgresStudentService } from "../../../src/server/student/runtime/routes.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { PostgresCatalogRepository } from "../../../src/server/catalog/postgres-repository.ts";
import { requirementFixture, syntheticRequirementVersion, syntheticPublication } from "./requirements-fixture.mjs";
import { requirementDocument } from "../catalog/requirements-fixture.mjs";
import { requirementDigest } from "../../../src/server/catalog/requirements.ts";
import { PostgresRequirementGovernance } from "../../../src/server/catalog/postgres-requirement-governance.ts";
import { approveInput } from "./requirement-governance-fixture.mjs";
import { PostgresNoticeReader } from "../../../src/server/notices/public-reader.ts";
import { assessmentInput } from "../student/assessment-fixture.mjs";
import { capturePublicDataReader } from "./migration-data-fixture.mjs";
import { runSchoolTargetUpgradeRehearsal } from "./school-application-target-upgrade.mjs";
import { materialSelectionFixture } from "./material-selection-fixture.mjs";
import { createPostgresAgentMemoryManagementService } from "../../../src/server/agent/memory-runtime.ts";
import { applicationSubmissionAuthorizationFixture } from "./application-submission-authorization-fixture.mjs";
import { materialSnapshotCipher } from "./application-material-snapshot-fixture.mjs";
import { PostgresApplicationMaterialSnapshot } from "../../../src/server/student/postgres-application-material-snapshot.ts";
import { approvePolicy, officialSubmissionPolicyFixture, policyPublishInput, preparePolicy } from "./official-submission-policy-fixture.mjs";
import { insertHistoricalApplicationChoice } from "./historical-application-choice-fixture.mjs";
import { PostgresApplicationPreflight } from "../../../src/server/student/postgres-application-preflight.ts";
import { insertHistoricalApplicationMaterialSnapshot } from "./historical-application-material-snapshot-fixture.mjs";
import { PostgresBillingRepository } from "../../../src/server/billing/postgres-repository.ts";

export async function runMigrationReleaseRehearsal(t, admin, databaseUrl) {
  const target = new URL(databaseUrl);
  assert.equal(target.hostname, "127.0.0.1");
  assert.equal(target.username, "cuac_rehearsal");
  assert.match(target.pathname, /^\/cuac_rehearsal_[a-f0-9]{24}$/);
  assert.equal((await admin.query("select current_database() as name")).rows[0].name, target.pathname.slice(1));
  await withDetachedMigrationRelease(async ({ build, folder, run }) => {
    t.diagnostic(`Detached migration release: ${build.manifestSha256}; ${build.dependencies} pinned runtime dependencies.`);
    const plan = JSON.parse(await readFile(join(folder, "migration-plan.json"), "utf8"));
    async function withDatabase(work) {
      const name = `cuac_release_${randomBytes(12).toString("hex")}`;
      assert.match(name, /^cuac_release_[a-f0-9]{24}$/);
      let pool, oid;
      await admin.query(`create database "${name}"`);
      try {
        oid = (await admin.query("select oid from pg_database where datname = $1", [name])).rows[0].oid;
        const url = new URL(target); url.pathname = `/${name}`;
        pool = new pg.Pool({ connectionString: url.href, max: 2, connectionTimeoutMillis: 5000, statement_timeout: 10_000 });
        const env = { DATABASE_URL: url.href, CUAC_MIGRATION_TARGET_ENV: "development" };
        await work(pool, env);
      } finally {
        if (pool) await pool.end();
        assert.equal((await admin.query("select oid from pg_database where datname = $1", [name])).rows[0]?.oid, oid, "Owned release database changed");
        await admin.query(`drop database "${name}"`);
      }
    }

    await t.test("detached release applies the full migration chain with the same declared schema", () => withDatabase(async (pool, env) => {
      const result = JSON.parse((await run("--apply", env)).stdout);
      assert.equal(result.manifestSha256, build.manifestSha256);
      assert.equal(result.appliedBefore, 0);
      assert.equal(result.appliedNow, plan.length);
      assert.deepEqual(await readPublicSchemaCatalog(pool), await readPublicSchemaCatalog(admin));
      assert.equal((await pool.query("select count(*)::int as total from drizzle.__drizzle_migrations")).rows[0].total, plan.length);
    }));

    await t.test("detached release upgrades a nonempty prior schema and replays without changing history", () => withDatabase(async (pool, env) => {
      await runPostgresMigrationPlan({ databaseUrl: env.DATABASE_URL, migrationsFolder: folder, targetEnvironment: "development", productionMigrationAllowed: false, runbookAcknowledged: false }, plan.slice(0, -1));
      await pool.query("insert into users (email, email_normalized) values ('release@example.invalid', 'release@example.invalid')");
      const users = (await pool.query("select * from users order by id")).rows;
      const upgraded = JSON.parse((await run("--apply", env)).stdout);
      assert.equal(upgraded.appliedBefore, plan.length - 1);
      assert.equal(upgraded.appliedNow, 1);
      const ledger = (await pool.query("select * from drizzle.__drizzle_migrations order by id")).rows;
      const replay = JSON.parse((await run("--apply", env)).stdout);
      assert.equal(replay.appliedNow, 0);
      assert.deepEqual((await pool.query("select * from drizzle.__drizzle_migrations order by id")).rows, ledger);
      assert.deepEqual((await pool.query("select * from users order by id")).rows, users);
    }));

    await t.test("atomic submission migration preserves historical program applications as v1 and seals the old writer", () => withDatabase(async (pool, env) => {
      await runPostgresMigrationPlan({ databaseUrl: env.DATABASE_URL, migrationsFolder: folder,
        targetEnvironment: "development", productionMigrationAllowed: false, runbookAcknowledged: false }, plan.slice(0, 30));
      const user = (await pool.query("insert into users (email,email_normalized) values ('submission-upgrade@example.invalid','submission-upgrade@example.invalid') returning id")).rows[0];
      const school = (await pool.query("insert into schools (slug,name_en,status) values ('submission-upgrade','Submission upgrade','active') returning id")).rows[0];
      const program = (await pool.query("insert into programs (school_id,slug,name_en,degree_level,status) values ($1,'submission-upgrade','Submission upgrade','master','active') returning id", [school.id])).rows[0];
      const intake = (await pool.query("insert into program_intakes (program_id,intake_term,intake_year,status) values ($1,'fall',2099,'open') returning id", [program.id])).rows[0];
      const set = (await pool.query("insert into application_sets (user_id,name) values ($1,'Historical program application') returning id", [user.id])).rows[0];
      const choice = (await pool.query(`insert into application_choices
        (application_set_id,user_id,school_id,program_id,program_intake_id)
        values ($1,$2,$3,$4,$5) returning id`, [set.id, user.id, school.id, program.id, intake.id])).rows[0];
      const application = (await pool.query(`insert into school_applications
        (application_set_id,application_choice_id,student_user_id,school_id,program_id,program_intake_id,
         school_visible_profile_json,routing_metadata_json)
        values ($1,$2,$3,$4,$5,$6,'{"preserve":true}'::jsonb,'{"legacy":true}'::jsonb) returning id`,
      [set.id, choice.id, user.id, school.id, program.id, intake.id])).rows[0];
      const before = (await pool.query("select to_jsonb(sa) as data from school_applications sa where id = $1", [application.id])).rows[0].data;
      const result = JSON.parse((await run("--apply", env)).stdout);
      assert.equal(result.appliedBefore, 30); assert.equal(result.appliedNow, plan.length - 30);
      const after = (await pool.query("select to_jsonb(sa) as data from school_applications sa where id = $1", [application.id])).rows[0].data;
      for (const [field, value] of Object.entries(before)) assert.deepEqual(after[field], value);
      assert.equal(after.application_record_format, "cuac.program-application.v1");
      for (const field of ["application_submission_id", "admission_route_key", "authorization_id",
        "material_snapshot_id", "fee_entitlement_id", "requirement_version_id", "policy_version_id", "accepted_at"]) {
        assert.equal(after[field], null);
      }
      for (const table of ["application_submissions", "official_submission_groups",
        "official_submission_group_members", "official_submission_outbox"]) {
        assert.equal((await pool.query(`select count(*)::int as total from ${table}`)).rows[0].total, 0);
      }
      const secondSet = (await pool.query(`with reference_clock as materialized (
          select extract(year from clock_timestamp() at time zone 'UTC')::integer as reference_year
        ), allocated as (
          insert into application_reference_counters (reference_year,last_issued_sequence)
          select reference_year,1 from reference_clock
          on conflict (reference_year) do update set last_issued_sequence = application_reference_counters.last_issued_sequence + 1
          returning reference_year,last_issued_sequence
        )
        insert into application_sets (user_id,name,cuac_reference_year,cuac_reference_sequence)
        select $1,'Old writer must fail',reference_year,last_issued_sequence from allocated returning id`, [user.id])).rows[0];
      const secondChoice = (await pool.query(`insert into application_choices
        (application_set_id,user_id,school_id,program_id,program_intake_id)
        values ($1,$2,$3,$4,$5) returning id`, [secondSet.id, user.id, school.id, program.id, intake.id])).rows[0];
      await assert.rejects(pool.query(`insert into school_applications
        (application_set_id,application_choice_id,student_user_id,school_id,program_id,program_intake_id)
        values ($1,$2,$3,$4,$5,$6)`, [secondSet.id, secondChoice.id, user.id, school.id, program.id, intake.id]),
      error => error.code === "23514" && error.constraint === "school_applications_format_check");
      const defaultValue = (await pool.query(`select column_default from information_schema.columns
        where table_schema = 'public' and table_name = 'school_applications'
          and column_name = 'application_record_format'`)).rows[0].column_default;
      assert.match(defaultValue, /cuac\.program-application\.v2/);
    }));

    await t.test("detached release preserves a divergent ledger and returns only redacted failure", () => withDatabase(async (pool, env) => {
      await run("--apply", env);
      await pool.query("update drizzle.__drizzle_migrations set hash = $1 where id = (select min(id) from drizzle.__drizzle_migrations)", ["e".repeat(64)]);
      const ledger = (await pool.query("select * from drizzle.__drizzle_migrations order by id")).rows;
      const schema = await readPublicSchemaCatalog(pool);
      await assert.rejects(run("--apply", env), error => {
        assert.equal(error.code, 1);
        assert.doesNotMatch(error.stdout + error.stderr, /cuac_rehearsal|cuac_release_|postgresql:\/\/|select |update /i);
        return true;
      });
      assert.deepEqual((await pool.query("select * from drizzle.__drizzle_migrations order by id")).rows, ledger);
      assert.deepEqual(await readPublicSchemaCatalog(pool), schema);
    }));

    await t.test("draft revision migration preserves populated pre-revision application sets and choices", () => withDatabase(async (pool, env) => {
      await runPostgresMigrationPlan({ databaseUrl: env.DATABASE_URL, migrationsFolder: folder, targetEnvironment: "development", productionMigrationAllowed: false, runbookAcknowledged: false }, plan.slice(0, 12));
      const { rows: [user] } = await pool.query("insert into users (email, email_normalized) values ('draft-upgrade@example.invalid', 'draft-upgrade@example.invalid') returning id");
      const { rows: [school] } = await pool.query("insert into schools (slug, name_en) values ('revision-upgrade-school', 'Revision upgrade school') returning id");
      for (const status of ["draft", "submitted", "archived"]) {
        const { rows: [set] } = await pool.query("insert into application_sets (user_id, name, status, locked_at) values ($1, 'Existing application', $2, case when $2 = 'submitted' then now() end) returning id", [user.id, status]);
        await pool.query("insert into application_choices (application_set_id, user_id, school_id, student_notes) values ($1, $2, $3, 'Preserve draft note')", [set.id, user.id, school.id]);
      }
      const before = (await pool.query("select to_jsonb(a) as data from application_sets a order by id")).rows;
      const choices = (await pool.query("select to_jsonb(c) as data from application_choices c order by id")).rows;
      assert.ok(before.every(row => !("revision" in row.data)));
      await run("--apply", env);
      const after = (await pool.query("select to_jsonb(a) as data from application_sets a order by id")).rows;
      for (let i = 0; i < before.length; i++) {
        assert.equal(after[i].data.revision, 1);
        for (const [field, value] of Object.entries(before[i].data)) assert.deepEqual(after[i].data[field], value);
      }
      const upgradedChoices = (await pool.query("select to_jsonb(c) as data from application_choices c order by id")).rows;
      assert.deepEqual(upgradedChoices, choices.map(row => ({ data: { ...row.data, program_intake_id: null, admission_route_key: null, target_key: "/" } })));
      await assert.rejects(pool.query("update application_sets set revision = 0 where user_id = $1", [user.id]), e => e.code === "23514");
      assert.equal(JSON.parse((await run("--apply", env)).stdout).appliedNow, 0);
    }));

    await t.test("intake migration preserves pre-intake choices and replays an independently constructed historical v1 receipt", () => withDatabase(async (pool, env) => {
      await runPostgresMigrationPlan({ databaseUrl: env.DATABASE_URL, migrationsFolder: folder, targetEnvironment: "development", productionMigrationAllowed: false, runbookAcknowledged: false }, plan.slice(0, 13));
      const user = (await pool.query("insert into users (email, email_normalized) values ('intake-upgrade@example.invalid', 'intake-upgrade@example.invalid') returning id")).rows[0];
      await pool.query("insert into user_roles (user_id, role) values ($1, 'student')", [user.id]);
      const school = (await pool.query("insert into schools (slug, name_en, status) values ('intake-upgrade', 'Intake upgrade', 'active') returning id")).rows[0];
      const program = (await pool.query("insert into programs (school_id, slug, name_en, degree_level, status) values ($1, 'intake-upgrade', 'Intake upgrade', 'master', 'active') returning id", [school.id])).rows[0];
      const intake = (await pool.query("insert into program_intakes (program_id, intake_term, intake_year) values ($1, 'fall', 2090) returning id", [program.id])).rows[0];
      const records = [];
      for (const status of ["draft", "submitted", "archived"]) {
        const set = (await pool.query("insert into application_sets (user_id, name, target_intake, status, revision) values ($1, 'Legacy target', '2090-fall', $2, 7) returning id", [user.id, status])).rows[0];
        const choice = (await pool.query("insert into application_choices (application_set_id, user_id, school_id, program_id, student_notes) values ($1, $2, $3, $4, 'Legacy note') returning id", [set.id, user.id, school.id, program.id])).rows[0];
        records.push({ set, choice });
      }
      const original = records[0], key = randomUUID();
      const input = { applicationSetId: original.set.id, schoolId: school.id, programId: program.id, scholarshipId: null, rankOrder: 0, studentNotes: "Legacy note" };
      const keyHash = createHash("sha256").update(key).digest("hex");
      const requestHash = createHash("sha256").update(JSON.stringify({ version: 1, operation: "application_choice.add", input })).digest("hex");
      await pool.query(`insert into student_application_command_receipts (user_id, operation, key_hash, request_hash, resource_id, original_request_id, completed_at)
        values ($1, 'application_choice.add', $2, $3, $4, 'historical-v1', now())`, [user.id, keyHash, requestHash, original.choice.id]);
      const before = (await pool.query("select to_jsonb(c) as data from application_choices c order by id")).rows;
      const sets = (await pool.query("select to_jsonb(a) as data from application_sets a order by id")).rows;
      const receipts = (await pool.query("select to_jsonb(r) as data from student_application_command_receipts r order by id")).rows;
      const result = JSON.parse((await run("--apply", env)).stdout);
      assert.equal(result.appliedBefore, 13); assert.equal(result.appliedNow, plan.length - 13);
      assert.deepEqual((await pool.query("select to_jsonb(c) as data from application_choices c order by id")).rows, before.map(r => ({ data: { ...r.data, program_intake_id: null, admission_route_key: null, target_key: `${r.data.program_id}/` } })));
      const upgradedSets = (await pool.query("select to_jsonb(a) as data from application_sets a order by id")).rows;
      for (let index = 0; index < sets.length; index += 1) {
        for (const [field, value] of Object.entries(sets[index].data)) {
          assert.deepEqual(upgradedSets[index].data[field], value);
        }
        assert.match(upgradedSets[index].data.cuac_id, /^CUAC-[0-9]{4}-[0-9]{6}$/);
        assert.equal(upgradedSets[index].data.cuac_reference_year, Number(upgradedSets[index].data.cuac_id.slice(5, 9)));
        assert.equal(upgradedSets[index].data.cuac_reference_sequence, Number(upgradedSets[index].data.cuac_id.slice(10)));
      }
      assert.equal(new Set(upgradedSets.map(row => row.data.cuac_id)).size, upgradedSets.length);
      assert.deepEqual((await pool.query("select to_jsonb(r) as data from student_application_command_receipts r order by id")).rows, receipts);
      const service = createPostgresStudentService(createTransactionalSqlClient(pool));
      const context = createRequestContext({ actorUserId: user.id, activeRole: "student", selectedSurface: "student", purpose: "student_action" });
      const recovered = await service.addOwnApplicationChoice(context, { ...input, programIntakeId: null }, { idempotencyKey: key });
      assert.equal(recovered.id, original.choice.id); assert.equal(recovered.programIntakeId, null);
      await assert.rejects(service.addOwnApplicationChoice(context, { ...input, programIntakeId: intake.id }, { idempotencyKey: key }), e => e.status === 409);
      assert.equal((await service.getOwnApplicationSet(context, original.set.id)).revision, 7);
      assert.equal(JSON.parse((await run("--apply", env)).stdout).appliedNow, 0);
    }));

    await t.test("applicant migration preserves existing private data and receipts without automatic profile creation", () => withDatabase(async (pool, env) => {
      await runPostgresMigrationPlan({ databaseUrl: env.DATABASE_URL, migrationsFolder: folder, targetEnvironment: "development", productionMigrationAllowed: false, runbookAcknowledged: false }, plan.slice(0, 14));
      const user = (await pool.query("insert into users (email, email_normalized, display_name) values ('applicant-upgrade@example.invalid', 'applicant-upgrade@example.invalid', 'Do not infer full name') returning id")).rows[0];
      await pool.query("insert into user_roles (user_id, role) values ($1, 'student')", [user.id]);
      await pool.query("insert into student_profiles (user_id, display_name, citizenship_country, preferences_json, consent_summary_json) values ($1, 'Preference alias', 'US', '{\"legacy\":true}', '{\"legacy\":true}')", [user.id]);
      const context = createRequestContext({ actorUserId: user.id, activeRole: "student", selectedSurface: "student", purpose: "student_action" });
      const service = createPostgresStudentService(createTransactionalSqlClient(pool));
      const key = randomUUID(), input = { name: "Preserve receipt" };
      const set = await service.createOwnApplicationSet(context, input, { idempotencyKey: key });
      const snapshot = await capturePublicDataReader(pool);
      const before = await snapshot();
      const upgraded = JSON.parse((await run("--apply", env)).stdout);
      assert.equal(upgraded.appliedBefore, 14); assert.equal(upgraded.appliedNow, plan.length - 14);
      assert.deepEqual(await snapshot(), before);
      assert.equal((await pool.query("select count(*)::int as count from student_applicant_profiles")).rows[0].count, 0);
      assert.equal(await service.getOwnApplicantProfile(context), null);
      assert.equal((await service.createOwnApplicationSet(context, input, { idempotencyKey: key })).id, set.id);
      assert.equal(JSON.parse((await run("--apply", env)).stdout).appliedNow, 0);
    }));

    await t.test("requirements upgrade preserves existing catalog student data and receipts without approving legacy text", () => withDatabase(async (pool, env) => {
      await runPostgresMigrationPlan({ databaseUrl: env.DATABASE_URL, migrationsFolder: folder, targetEnvironment: "development", productionMigrationAllowed: false, runbookAcknowledged: false }, plan.slice(0, 16));
      const f = await requirementFixture(pool);
      await pool.query("insert into user_roles (user_id, role) values ($1, 'student')", [f.reviewerId]);
      const context = createRequestContext({ actorUserId: f.reviewerId, activeRole: "student", selectedSurface: "student", purpose: "student_action" });
      const client = createTransactionalSqlClient(pool), service = createPostgresStudentService(client);
      await service.updateOwnApplicantProfile(context, { expectedRevision: 0, fullName: "Existing applicant" });
      await service.addOwnEducationRecord(context, { expectedRevision: 0, institutionName: "Existing education", educationLevel: "bachelor" });
      const key = randomUUID(), input = { name: "Keep this receipt" }, set = await service.createOwnApplicationSet(context, input, { idempotencyKey: key });
      const snapshot = await capturePublicDataReader(pool);
      const before = await snapshot(), result = JSON.parse((await run("--apply", env)).stdout);
      assert.equal(result.appliedBefore, 16); assert.equal(result.appliedNow, plan.length - 16); assert.deepEqual(await snapshot(), before);
      for (const table of ["program_requirement_versions", "program_requirement_publications"]) assert.equal((await pool.query(`select count(*)::int as count from ${table}`)).rows[0].count, 0);
      assert.equal(await new PostgresCatalogRepository(client).getProgramRequirements(f.programId, f.intakeId), null);
      assert.equal((await service.createOwnApplicationSet(context, input, { idempotencyKey: key })).id, set.id);
      assert.equal(JSON.parse((await run("--apply", env)).stdout).appliedNow, 0);
    }));

    await t.test("review governance upgrade retains legacy content and receipts without inventing author or approval evidence", () => withDatabase(async (pool, env) => {
      await runPostgresMigrationPlan({ databaseUrl: env.DATABASE_URL, migrationsFolder: folder, targetEnvironment: "development", productionMigrationAllowed: false, runbookAcknowledged: false }, plan.slice(0, 17));
      const f = await requirementFixture(pool), document = requirementDocument();
      await pool.query("insert into user_roles (user_id, role) values ($1, 'cuac_admin'), ($2, 'student')", [f.reviewerId, f.preparerId]);
      const legacy = (await pool.query(`insert into program_requirement_versions
        (program_intake_id, version, content_json, content_sha256, review_status, approved_by_user_id, reviewed_at, effective_from, review_due_at)
        values ($1, 1, $2::jsonb, $3, 'approved', $4, now() - interval '1 minute', now() - interval '1 minute', now() + interval '1 day') returning id`,
        [f.intakeId, JSON.stringify(document), requirementDigest(document), f.reviewerId])).rows[0];
      await pool.query("insert into program_requirement_publications (program_intake_id, version_id, status) values ($1, $2, 'active')", [f.intakeId, legacy.id]);
      const client = createTransactionalSqlClient(pool), student = createPostgresStudentService(client);
      const context = createRequestContext({ actorUserId: f.preparerId, activeRole: "student", selectedSurface: "student", purpose: "student_action" });
      await student.addOwnEducationRecord(context, { expectedRevision: 0, institutionName: "Preserved private institution", educationLevel: "bachelor" });
      const key = randomUUID(), input = { name: "Keep prior command result" }, set = await student.createOwnApplicationSet(context, input, { idempotencyKey: key });
      const snapshot = await capturePublicDataReader(pool);
      const before = await snapshot(), result = JSON.parse((await run("--apply", env)).stdout);
      assert.equal(result.appliedBefore, 17); assert.equal(result.appliedNow, plan.length - 17); assert.deepEqual(await snapshot(), before);
      assert.deepEqual((await pool.query("select prepared_by_user_id, review_evidence_json from program_requirement_versions where id = $1", [legacy.id])).rows,
        [{ prepared_by_user_id: null, review_evidence_json: null }]);
      assert.equal(await new PostgresCatalogRepository(client).getProgramRequirements(f.programId, f.intakeId), null);
      const governance = new PostgresRequirementGovernance(client), reviewer = createRequestContext({ actorUserId: f.reviewerId,
        activeRole: "cuac_admin", selectedSurface: "ops", purpose: "catalog_management", authStrength: "step_up" });
      const old = await governance.getVersion(reviewer, f.programId, f.intakeId, legacy.id); assert.equal(old.governanceStatus, "legacy");
      await assert.rejects(governance.approve(reviewer, f.programId, f.intakeId, approveInput(old)), e => e.status === 409);
      assert.equal((await student.createOwnApplicationSet(context, input, { idempotencyKey: key })).id, set.id);
      assert.equal(JSON.parse((await run("--apply", env)).stdout).appliedNow, 0);
    }));

    await t.test("assessment migration preserves every prior public table without inferring scores from private or catalog data", () => withDatabase(async (pool, env) => {
      await runPostgresMigrationPlan({ databaseUrl: env.DATABASE_URL, migrationsFolder: folder, targetEnvironment: "development", productionMigrationAllowed: false, runbookAcknowledged: false }, plan.slice(0, 18));
      const f = await requirementFixture(pool), requirementId = await syntheticRequirementVersion(pool, f);
      await syntheticPublication(pool, f, requirementId);
      await pool.query("insert into user_roles (user_id, role) values ($1, 'student')", [f.preparerId]);
      await pool.query("insert into student_profiles (user_id, target_degree_level, preferences_json) values ($1, 'master', $2::jsonb)", [f.preparerId, JSON.stringify({ legacyClaim: "IELTS 7.5" })]);
      const context = createRequestContext({ actorUserId: f.preparerId, activeRole: "student", selectedSurface: "student", purpose: "student_action", authStrength: "session" });
      const client = createTransactionalSqlClient(pool), service = createPostgresStudentService(client);
      await service.updateOwnApplicantProfile(context, { expectedRevision: 0, fullName: "Preserved applicant" });
      await service.addOwnEducationRecord(context, { expectedRevision: 0, institutionName: "Existing institution", educationLevel: "bachelor" });
      const key = randomUUID(), input = { name: "Prior application result" }, set = await service.createOwnApplicationSet(context, input, { idempotencyKey: key });
      const choiceKey = randomUUID(), choiceInput = { applicationSetId: set.id, schoolId: f.schoolId, programId: f.programId, programIntakeId: f.intakeId };
      const choice = await insertHistoricalApplicationChoice(pool, context, choiceInput, choiceKey);
      const published = await new PostgresCatalogRepository(client).getProgramRequirements(f.programId, f.intakeId); assert.ok(published);
      const snapshot = await capturePublicDataReader(pool);
      const before = await snapshot(), result = JSON.parse((await run("--apply", env)).stdout);
      assert.equal(result.appliedBefore, 18); assert.equal(result.appliedNow, plan.length - 18); assert.deepEqual(await snapshot(), before);
      for (const table of ["student_assessment_histories", "student_assessment_records"]) assert.equal((await pool.query(`select count(*)::int as count from ${table}`)).rows[0].count, 0);
      assert.deepEqual(await service.getOwnAssessmentHistory(context), { revision: 0, records: [] });
      assert.deepEqual(await new PostgresCatalogRepository(client).getProgramRequirements(f.programId, f.intakeId), published);
      assert.equal((await service.createOwnApplicationSet(context, input, { idempotencyKey: key })).id, set.id);
      assert.equal((await service.addOwnApplicationChoice(context, choiceInput, { idempotencyKey: choiceKey })).id, choice.id);
      assert.equal(JSON.parse((await run("--apply", env)).stdout).appliedNow, 0);
    }));

    await t.test("notice migration preserves all private records receipts and requirement publications without inventing legal notices or consent", () => withDatabase(async (pool, env) => {
      await runPostgresMigrationPlan({ databaseUrl: env.DATABASE_URL, migrationsFolder: folder, targetEnvironment: "development", productionMigrationAllowed: false, runbookAcknowledged: false }, plan.slice(0, 19));
      const f = await requirementFixture(pool), requirementId = await syntheticRequirementVersion(pool, f); await syntheticPublication(pool, f, requirementId);
      await pool.query("insert into user_roles (user_id, role) values ($1, 'student')", [f.preparerId]);
      await pool.query("insert into student_profiles (user_id, consent_summary_json) values ($1, '{\"legacyAccepted\":true}')", [f.preparerId]);
      const context = createRequestContext({ actorUserId: f.preparerId, activeRole: "student", selectedSurface: "student", purpose: "student_action" });
      const client = createTransactionalSqlClient(pool), service = createPostgresStudentService(client);
      await service.updateOwnApplicantProfile(context, { expectedRevision: 0, fullName: "Preserved notice-upgrade applicant" });
      await service.addOwnEducationRecord(context, { expectedRevision: 0, institutionName: "Preserved prior education", educationLevel: "bachelor" });
      await service.addOwnAssessmentRecord(context, assessmentInput(0));
      const key = randomUUID(), input = { name: "Preserved notice-upgrade application" }, set = await service.createOwnApplicationSet(context, input, { idempotencyKey: key });
      const choiceKey = randomUUID(), choiceInput = { applicationSetId: set.id, schoolId: f.schoolId, programId: f.programId, programIntakeId: f.intakeId };
      const choice = await insertHistoricalApplicationChoice(pool, context, choiceInput, choiceKey);
      const published = await new PostgresCatalogRepository(client).getProgramRequirements(f.programId, f.intakeId); assert.ok(published);
      const snapshot = await capturePublicDataReader(pool);
      const before = await snapshot(), upgraded = JSON.parse((await run("--apply", env)).stdout);
      assert.equal(upgraded.appliedBefore, 19); assert.equal(upgraded.appliedNow, plan.length - 19); assert.deepEqual(await snapshot(), before);
      for (const table of ["privacy_notice_scopes", "privacy_notice_versions", "privacy_notice_publications"]) assert.equal((await pool.query(`select count(*)::int as count from ${table}`)).rows[0].count, 0);
      const reader = new PostgresNoticeReader(client), guest = createRequestContext({ purpose: "public_notice_read" });
      assert.equal(await reader.getPublished(guest, "application_disclosure", "en"), null);
      assert.equal(await reader.getPublished(guest, "application_disclosure", "zh-CN"), null);
      assert.deepEqual(await snapshot(), before, "reading an absent notice does not manufacture a consent or change private records");
      assert.deepEqual(await new PostgresCatalogRepository(client).getProgramRequirements(f.programId, f.intakeId), published);
      assert.equal((await service.createOwnApplicationSet(context, input, { idempotencyKey: key })).id, set.id);
      assert.equal((await service.addOwnApplicationChoice(context, choiceInput, { idempotencyKey: choiceKey })).id, choice.id);
      assert.equal(JSON.parse((await run("--apply", env)).stdout).appliedNow, 0);
    }));

    await t.test("education migration leaves all existing data intact and never infers academic attainment from preferences", () => withDatabase(async (pool, env) => {
      await runPostgresMigrationPlan({ databaseUrl: env.DATABASE_URL, migrationsFolder: folder, targetEnvironment: "development", productionMigrationAllowed: false, runbookAcknowledged: false }, plan.slice(0, 15));
      const user = (await pool.query("insert into users (email, email_normalized) values ('education-upgrade@example.invalid', 'education-upgrade@example.invalid') returning id")).rows[0];
      await pool.query("insert into user_roles (user_id, role) values ($1, 'student')", [user.id]);
      await pool.query("insert into student_profiles (user_id, target_degree_level) values ($1, 'master')", [user.id]);
      const context = createRequestContext({ actorUserId: user.id, activeRole: "student", selectedSurface: "student", purpose: "student_action" });
      const service = createPostgresStudentService(createTransactionalSqlClient(pool));
      await service.updateOwnApplicantProfile(context, { expectedRevision: 0, fullName: "Existing applicant" });
      const key = randomUUID(), input = { name: "Existing application" };
      const set = await service.createOwnApplicationSet(context, input, { idempotencyKey: key });
      const snapshot = await capturePublicDataReader(pool);
      const before = await snapshot(), result = JSON.parse((await run("--apply", env)).stdout);
      assert.equal(result.appliedBefore, 15); assert.equal(result.appliedNow, plan.length - 15);
      assert.deepEqual(await snapshot(), before);
      assert.deepEqual(await service.getOwnEducationHistory(context), { revision: 0, records: [] });
      for (const table of ["student_education_histories", "student_education_records"]) assert.equal((await pool.query(`select count(*)::int as count from ${table}`)).rows[0].count, 0);
      assert.equal((await service.createOwnApplicationSet(context, input, { idempotencyKey: key })).id, set.id);
      assert.equal(JSON.parse((await run("--apply", env)).stdout).appliedNow, 0);
    }));
    await t.test("memory control and retention upgrades preserve legacy content while bounding active student memory", () => withDatabase(async (pool, env) => {
      await runPostgresMigrationPlan({ databaseUrl: env.DATABASE_URL, migrationsFolder: folder, targetEnvironment: "development", productionMigrationAllowed: false, runbookAcknowledged: false }, plan.slice(0, 21));
      const ids = [randomUUID(), randomUUID(), randomUUID()];
      for (const id of ids) {
        await pool.query("insert into users (id,email,email_normalized) values ($1,$2,$2)", [id, `upgrade-${id}@example.invalid`]);
        await pool.query("insert into user_roles (user_id,role) values ($1,'student')", [id]);
      }
      for (let i = 0; i < 2; i++) await pool.query("insert into agent_student_memory_settings (user_id,enabled,reset_at,updated_at) values ($1,$2,'2026-08-30 10:00:00.000001+00','2026-08-30 10:00:00.000002+00')", [ids[i], i === 0]);
      await pool.query(`insert into agent_memory_entries (user_id,memory_type,context_scope,active_role,memory_namespace,data_class,confidence,summary,structured_json,source)
        select $1::uuid,'study_goal','student_account','student','user:' || $1::uuid::text || ':student','low_sensitive_preference','user_confirmed','LEGACY_SUMMARY','{"degreeLevel":"master"}','synthetic' from generate_series(1,101)`, [ids[0]]);
      const snapshot = await capturePublicDataReader(pool), before = await snapshot();
      const applied = JSON.parse((await run("--apply", env)).stdout);
      assert.equal(applied.appliedBefore, 21); assert.equal(applied.appliedNow, plan.length - 21);
      const withoutExpiry = data => ({ ...data, agent_memory_entries: data.agent_memory_entries.map(row => {
        const preserved = { ...row };
        delete preserved.expires_at;
        return preserved;
      }) });
      assert.deepEqual(withoutExpiry(await snapshot()), withoutExpiry(before));
      assert.equal((await pool.query(`select count(*)::int as count from agent_memory_entries
        where expires_at = created_at + interval '365 days'`)).rows[0].count, 101);
      assert.deepEqual((await pool.query("select revision from agent_student_memory_settings order by user_id")).rows, [{ revision: 1 }, { revision: 1 }]);
      assert.equal(JSON.parse((await run("--apply", env)).stdout).appliedNow, 0);
      assert.deepEqual(withoutExpiry(await snapshot()), withoutExpiry(before));
      const service = createPostgresAgentMemoryManagementService(createTransactionalSqlClient(pool));
      const ctx = id => createRequestContext({ actorUserId: id, activeRole: "student", selectedSurface: "student", purpose: "student_action" });
      const page = await service.list(ctx(ids[0]), { limit: 100 });
      assert.equal(page.storedCount, 101); assert.equal(page.items.length, 100);
      assert.equal((await service.list(ctx(ids[0]), { cursor: page.nextCursor })).items.length, 1);
      assert.equal((await service.list(ctx(ids[1]))).enabled, false);
      assert.equal((await service.list(ctx(ids[2]))).revision, 0);
      assert.equal((await pool.query("select count(*)::int as count from agent_student_memory_settings")).rows[0].count, 2);
      await assert.rejects(pool.query("update agent_student_memory_settings set revision = 0 where user_id = $1", [ids[0]]), e => e.code === "23514");
    }));
    await t.test("selection migration preserves nonempty through-0021 data and never infers a student's chosen materials", () => withDatabase(async (pool, env) => {
      await runPostgresMigrationPlan({ databaseUrl: env.DATABASE_URL, migrationsFolder: folder, targetEnvironment: "development", productionMigrationAllowed: false, runbookAcknowledged: false }, plan.slice(0, 22));
      const f = await materialSelectionFixture(pool, undefined, true, { readVersionsDirectly: true, legacyChoiceSchema: true });
      await pool.query("insert into agent_student_memory_settings (user_id,enabled,revision) values ($1,false,7)", [f.userId]);
      const snapshot = await capturePublicDataReader(pool), before = await snapshot();
      const applied = JSON.parse((await run("--apply", env)).stdout);
      assert.equal(applied.appliedBefore, 22); assert.equal(applied.appliedNow, plan.length - 22);
      assert.deepEqual(await snapshot(), before);
      const selection = await f.selectionGet(); assert.equal(selection.revision, 0); assert.equal(selection.selection, null);
      assert.equal((await pool.query("select count(*)::int as n from application_material_selections")).rows[0].n, 0);
      assert.deepEqual(await snapshot(), before);
      assert.equal(JSON.parse((await run("--apply", env)).stdout).appliedNow, 0);
      assert.deepEqual(await snapshot(), before);
      assert.equal((await f.selectionPut()).revision, 1);
      assert.deepEqual((await pool.query("select enabled,revision from agent_student_memory_settings where user_id = $1", [f.userId])).rows[0], { enabled: false, revision: 7 });
    }));
    await t.test("email outbox upgrade preserves legacy challenges private data and receipts without inventing raw tokens or deliveries", () => withDatabase(async (pool, env) => {
      await runPostgresMigrationPlan({ databaseUrl: env.DATABASE_URL, migrationsFolder: folder, targetEnvironment: "development", productionMigrationAllowed: false, runbookAcknowledged: false }, plan.slice(0, 23));
      const f = await materialSelectionFixture(pool, undefined, true, { readVersionsDirectly: true, legacyChoiceSchema: true }); await f.selectionPut();
      await pool.query("insert into email_verification_challenges (user_id,email_normalized,verification_token_hash,expires_at) values ($1,'legacy@example.invalid','sha256:legacy-verification',clock_timestamp() + interval '1 day')", [f.userId]);
      await pool.query("insert into password_reset_challenges (user_id,email_normalized,reset_token_hash,expires_at) values ($1,'legacy@example.invalid','sha256:legacy-reset',clock_timestamp() + interval '30 minutes')", [f.userId]);
      const snapshot = await capturePublicDataReader(pool), before = await snapshot();
      const applied = JSON.parse((await run("--apply", env)).stdout);
      assert.equal(applied.appliedBefore, 23); assert.equal(applied.appliedNow, plan.length - 23);
      assert.deepEqual(await snapshot(), before);
      assert.equal((await pool.query("select count(*)::int as n from auth_email_outbox")).rows[0].n, 0);
      assert.equal(JSON.parse((await run("--apply", env)).stdout).appliedNow, 0);
      assert.deepEqual(await snapshot(), before);
    }));
    await t.test("material snapshot migration preserves nonempty through-0024 authorization data and never invents snapshots", () => withDatabase(async (pool, env) => {
      await runPostgresMigrationPlan({ databaseUrl: env.DATABASE_URL, migrationsFolder: folder, targetEnvironment: "development", productionMigrationAllowed: false, runbookAcknowledged: false }, plan.slice(0, 25));
      const f = await applicationSubmissionAuthorizationFixture(pool, undefined, { readVersionsDirectly: true, legacyChoiceSchema: true });
      const authorization = await f.recordAuthorization();
      assert.equal((await pool.query("select to_regclass('public.application_material_snapshots') as name")).rows[0].name, null);
      const snapshot = await capturePublicDataReader(pool), before = await snapshot();
      const applied = JSON.parse((await run("--apply", env)).stdout);
      assert.equal(applied.appliedBefore, 25); assert.equal(applied.appliedNow, plan.length - 25);
      assert.deepEqual(await snapshot(), before);
      assert.equal((await pool.query("select count(*)::int as n from application_material_snapshots")).rows[0].n, 0);
      assert.deepEqual((await pool.query(`select id,user_id,application_set_id,application_choice_id,school_id,program_id,program_intake_id,
        scope_sha256,status,authorization_format,admission_route_key,policy_version_id,policy_publication_revision,
        policy_document_sha256,policy_target_set_sha256,policy_approval_sha256
        from application_submission_authorizations where id = $1`, [authorization.id])).rows[0], {
        id: authorization.id, user_id: f.userId, application_set_id: f.set.id, application_choice_id: f.choice.id,
        school_id: f.catalog.schoolId, program_id: f.catalog.programId, program_intake_id: f.catalog.intakeId,
        scope_sha256: authorization.confirmation.scopeSha256, status: "active",
        authorization_format: "cuac.application-submission-authorization.v1", admission_route_key: null,
        policy_version_id: null, policy_publication_revision: null, policy_document_sha256: null,
        policy_target_set_sha256: null, policy_approval_sha256: null,
      });
      const service = new PostgresApplicationMaterialSnapshot(f.client, materialSnapshotCipher());
      await assert.rejects(service.create(f.context, f.set.id, f.choice.id, {
        authorizationId: authorization.id,
        expectedAuthorizationScopeSha256: authorization.confirmation.scopeSha256,
        expectedMaterialContentSha256: authorization.material.contentSha256,
      }, randomUUID()), error => error.status === 409);
      const legacy = await f.service.get(f.context, f.set.id, f.choice.id);
      assert.equal(legacy.confirmation.format, "cuac.application-submission-authorization.v1");
      assert.equal(legacy.freshness.current, false);
      assert.ok(legacy.freshness.reasons.includes("AUTHORIZATION_FORMAT_LEGACY"));
      assert.equal((await pool.query("select count(*)::int as n from application_material_snapshots where authorization_id = $1", [authorization.id])).rows[0].n, 0);
      assert.equal(JSON.parse((await run("--apply", env)).stdout).appliedNow, 0);
      assert.equal((await pool.query("select count(*)::int as n from application_submission_authorizations where id = $1", [authorization.id])).rows[0].n, 1);
    }));
    await t.test("official policy migration preserves through-0025 data and never infers policy from catalog or applications", () => withDatabase(async (pool, env) => {
      await runPostgresMigrationPlan({ databaseUrl: env.DATABASE_URL, migrationsFolder: folder, targetEnvironment: "development", productionMigrationAllowed: false, runbookAcknowledged: false }, plan.slice(0, 26));
      const application = await applicationSubmissionAuthorizationFixture(pool, undefined, { readVersionsDirectly: true, legacyChoiceSchema: true });
      const authorization = await application.recordAuthorization();
      const material = await insertHistoricalApplicationMaterialSnapshot(pool, application, authorization);
      for (const table of ["official_submission_policy_versions", "official_submission_policy_version_targets", "official_submission_policy_publications"]) {
        assert.equal((await pool.query("select to_regclass($1) as name", [`public.${table}`])).rows[0].name, null);
      }
      const snapshot = await capturePublicDataReader(pool), before = await snapshot();
      const applied = JSON.parse((await run("--apply", env)).stdout);
      assert.equal(applied.appliedBefore, 26); assert.equal(applied.appliedNow, plan.length - 26);
      assert.deepEqual(await snapshot(), before);
      for (const table of ["official_submission_policy_versions", "official_submission_policy_version_targets", "official_submission_policy_publications"]) {
        assert.equal((await pool.query(`select count(*)::int as n from ${table}`)).rows[0].n, 0);
      }
      assert.equal((await pool.query("select count(*)::int as n from application_material_snapshots where id = $1", [material.id])).rows[0].n, 1);
      const retained = await new PostgresApplicationMaterialSnapshot(application.client, materialSnapshotCipher()).get(
        application.context, application.set.id, application.choice.id);
      assert.equal(retained.id, material.id); assert.equal(retained.freshness.current, false);
      assert.ok(retained.freshness.reasons.includes("AUTHORIZATION_FORMAT_LEGACY"));
      assert.equal(JSON.parse((await run("--apply", env)).stdout).appliedNow, 0);
      assert.deepEqual(await snapshot(), before);
      const policy = await officialSubmissionPolicyFixture(pool), draft = await preparePolicy(policy);
      assert.equal(draft.targets.length, 2);
      assert.equal((await pool.query("select count(*)::int as n from official_submission_policy_versions where id = $1", [draft.versionId])).rows[0].n, 1);
      assert.equal((await pool.query("select count(*)::int as n from official_submission_policy_publications")).rows[0].n, 0);
    }));

    await t.test("admission route migration preserves through-0026 data and never infers a route from policy or application state", () => withDatabase(async (pool, env) => {
      await runPostgresMigrationPlan({ databaseUrl: env.DATABASE_URL, migrationsFolder: folder, targetEnvironment: "development", productionMigrationAllowed: false, runbookAcknowledged: false }, plan.slice(0, 27));
      const application = await applicationSubmissionAuthorizationFixture(pool, undefined,
        { readVersionsDirectly: true, legacyChoiceSchema: true });
      const authorization = await application.recordAuthorization();
      const material = await insertHistoricalApplicationMaterialSnapshot(pool, application, authorization);
      const policy = await officialSubmissionPolicyFixture(pool), approved = await approvePolicy(policy, randomUUID());
      const publications = await policy.service.publish(policy.reviewer, policy.schoolId, policy.policyKey,
        policy.admissionRouteKey, policyPublishInput(approved));
      const routeSet = await application.student.createOwnApplicationSet(application.context,
        { name: "Explicit route after upgrade" }, { idempotencyKey: randomUUID() });
      const routeChoice = await insertHistoricalApplicationChoice(pool, application.context, {
        applicationSetId: routeSet.id,
        schoolId: policy.schoolId,
        programId: policy.targets[0].programId,
        programIntakeId: policy.targets[0].programIntakeId,
      });
      assert.equal((await pool.query("select to_regclass('public.application_choices') is not null and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'application_choices' and column_name = 'admission_route_key') as absent")).rows[0].absent, true);
      const snapshot = await capturePublicDataReader(pool), before = await snapshot();
      const applied = JSON.parse((await run("--apply", env)).stdout);
      assert.equal(applied.appliedBefore, 27); assert.equal(applied.appliedNow, plan.length - 27);
      assert.deepEqual(await snapshot(), before);
      assert.equal((await pool.query("select count(*)::int as n from application_choices where admission_route_key is not null")).rows[0].n, 0);
      assert.equal((await pool.query("select count(*)::int as n from application_material_snapshots where id = $1", [material.id])).rows[0].n, 1);
      const retained = await new PostgresApplicationMaterialSnapshot(application.client, materialSnapshotCipher()).get(
        application.context, application.set.id, application.choice.id);
      assert.equal(retained.id, material.id); assert.equal(retained.freshness.current, false);
      assert.equal((await pool.query("select count(*)::int as n from official_submission_policy_publications where version_id = $1", [approved.versionId])).rows[0].n, publications.length);
      const current = await application.student.getOwnApplicationSet(application.context, routeSet.id);
      const selected = await application.student.updateOwnApplicationChoice(application.context, routeSet.id, routeChoice.id,
        { expectedRevision: current.revision, admissionRouteKey: policy.admissionRouteKey });
      assert.equal(selected.choices[0].admissionRouteKey, policy.admissionRouteKey);
      const preflight = await new PostgresApplicationPreflight(application.client).get(application.context, routeSet.id, routeChoice.id, "en");
      assert.equal(preflight.officialSubmissionPolicy.versionId, approved.versionId);
      assert.equal(JSON.parse((await run("--apply", env)).stdout).appliedNow, 0);
      assert.equal((await application.student.getOwnApplicationSet(application.context, routeSet.id)).choices[0].admissionRouteKey, policy.admissionRouteKey);
    }));

    await t.test("policy-bound authorization upgrade preserves v1 evidence without inferring the already selected route or policy", () => withDatabase(async (pool, env) => {
      await runPostgresMigrationPlan({ databaseUrl: env.DATABASE_URL, migrationsFolder: folder,
        targetEnvironment: "development", productionMigrationAllowed: false, runbookAcknowledged: false }, plan.slice(0, 28));
      const application = await applicationSubmissionAuthorizationFixture(pool, undefined,
        { readVersionsDirectly: true, legacyChoiceSchema: true });
      const legacyAuthorization = await application.recordAuthorization();
      const legacySnapshot = await insertHistoricalApplicationMaterialSnapshot(pool, application, legacyAuthorization);
      const policy = await officialSubmissionPolicyFixture(pool, { schoolId: application.catalog.schoolId,
        targets: [{ programId: application.catalog.programId, programIntakeId: application.catalog.intakeId }] });
      const approved = await approvePolicy(policy, randomUUID());
      await policy.service.publish(policy.reviewer, policy.schoolId, policy.policyKey, policy.admissionRouteKey,
        policyPublishInput(approved));
      const currentSet = await application.student.getOwnApplicationSet(application.context, application.set.id);
      await application.student.updateOwnApplicationChoice(application.context, application.set.id, application.choice.id,
        { expectedRevision: currentSet.revision, admissionRouteKey: policy.admissionRouteKey });
      assert.equal((await pool.query("select admission_route_key from application_choices where id = $1",
        [application.choice.id])).rows[0].admission_route_key, policy.admissionRouteKey);
      assert.equal((await pool.query("select to_regclass('public.application_submission_authorizations') is not null and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'application_submission_authorizations' and column_name = 'authorization_format') as absent")).rows[0].absent, true);

      const applied = JSON.parse((await run("--apply", env)).stdout);
      assert.equal(applied.appliedBefore, 28); assert.equal(applied.appliedNow, plan.length - 28);
      const migrated = (await pool.query(`select authorization_format,admission_route_key,policy_version_id,
        policy_publication_revision,policy_document_sha256,policy_target_set_sha256,policy_approval_sha256
        from application_submission_authorizations where id = $1`, [legacyAuthorization.id])).rows[0];
      assert.deepEqual(migrated, { authorization_format: "cuac.application-submission-authorization.v1",
        admission_route_key: null, policy_version_id: null, policy_publication_revision: null,
        policy_document_sha256: null, policy_target_set_sha256: null, policy_approval_sha256: null });
      assert.equal((await pool.query("select admission_route_key from application_choices where id = $1",
        [application.choice.id])).rows[0].admission_route_key, policy.admissionRouteKey);
      const retained = await new PostgresApplicationMaterialSnapshot(application.client, materialSnapshotCipher()).get(
        application.context, application.set.id, application.choice.id);
      assert.equal(retained.id, legacySnapshot.id); assert.equal(retained.freshness.current, false);
      assert.ok(retained.freshness.reasons.includes("AUTHORIZATION_FORMAT_LEGACY"));

      await assert.rejects(pool.query(`insert into application_submission_authorizations
        (id,user_id,application_set_id,application_choice_id,school_id,program_id,program_intake_id,purpose,
         material_selection_revision,source_set_revision,source_applicant_revision,source_education_revision,
         source_assessment_revision,selection_json,selection_sha256,material_content_sha256,notice_scope_key,
         notice_locale,notice_version_id,notice_publication_revision,notice_content_sha256,confirmation_method,
         scope_sha256,confirmed_request_id,status,confirmed_at,ended_at,end_reason,created_at,updated_at)
        select $2,user_id,application_set_id,application_choice_id,school_id,program_id,program_intake_id,purpose,
         material_selection_revision,source_set_revision,source_applicant_revision,source_education_revision,
         source_assessment_revision,selection_json,selection_sha256,material_content_sha256,notice_scope_key,
         notice_locale,notice_version_id,notice_publication_revision,notice_content_sha256,confirmation_method,
         scope_sha256,'old-writer-after-0028','superseded',confirmed_at,confirmed_at,'reauthorized',created_at,updated_at
        from application_submission_authorizations where id = $1`, [legacyAuthorization.id, randomUUID()]),
      error => error.code === "23514" && error.constraint === "application_submission_authorization_policy_binding_check");

      const materialRequest = await application.request();
      const saved = await application.selectionService.put(application.context, application.set.id, application.choice.id,
        { expectedRevision: 1, ...materialRequest });
      const preview = await application.materialReader.preview(application.context, application.set.id,
        application.choice.id, materialRequest);
      const currentPolicy = await policy.getPublished({ programId: application.catalog.programId,
        programIntakeId: application.catalog.intakeId });
      const v2 = await application.service.record(application.context, application.set.id, application.choice.id,
        { locale: application.notice.locale, expectedMaterialSelectionRevision: saved.revision,
          expectedVersions: saved.savedVersions, expectedNotice: { versionId: application.notice.versionId,
            publicationRevision: application.notice.publicationRevision, contentSha256: application.notice.contentSha256 },
          expectedPolicy: { admissionRouteKey: currentPolicy.admissionRouteKey, versionId: currentPolicy.versionId,
            publicationRevision: currentPolicy.publicationRevision, documentSha256: currentPolicy.documentSha256 },
          materialContentSha256: preview.contentSha256, confirmation: application.authorizationInput.confirmation }, randomUUID());
      assert.equal(v2.confirmation.format, "cuac.application-submission-authorization.v2");
      assert.equal(v2.freshness.current, true); assert.equal(v2.officialSubmissionPolicy.versionId, approved.versionId);
      assert.deepEqual((await pool.query("select status,end_reason from application_submission_authorizations where id = $1",
        [legacyAuthorization.id])).rows[0], { status: "superseded", end_reason: "reauthorized" });
      const freshSnapshot = await new PostgresApplicationMaterialSnapshot(application.client, materialSnapshotCipher()).create(
        application.context, application.set.id, application.choice.id, { authorizationId: v2.id,
          expectedAuthorizationScopeSha256: v2.confirmation.scopeSha256,
          expectedMaterialContentSha256: v2.material.contentSha256 }, randomUUID());
      assert.notEqual(freshSnapshot.id, legacySnapshot.id); assert.equal(freshSnapshot.freshness.current, true);
      assert.equal(JSON.parse((await run("--apply", env)).stdout).appliedNow, 0);
    }));

    await t.test("fee entitlement upgrade preserves legacy lines without inferring project evidence", () => withDatabase(async (pool, env) => {
      await runPostgresMigrationPlan({ databaseUrl: env.DATABASE_URL, migrationsFolder: folder,
        targetEnvironment: "development", productionMigrationAllowed: false, runbookAcknowledged: false }, plan.slice(0, 29));
      const user = (await pool.query("insert into users (email, email_normalized) values ('billing-upgrade@example.invalid','billing-upgrade@example.invalid') returning id")).rows[0];
      const school = (await pool.query("insert into schools (slug,name_en,status) values ('billing-upgrade','Billing upgrade','active') returning id")).rows[0];
      const program = (await pool.query("insert into programs (school_id,slug,name_en,degree_level,status) values ($1,'billing-upgrade','Billing upgrade program','master','active') returning id", [school.id])).rows[0];
      const intake = (await pool.query("insert into program_intakes (program_id,intake_term,intake_year,status) values ($1,'fall',2099,'open') returning id", [program.id])).rows[0];
      const set = (await pool.query("insert into application_sets (user_id,name) values ($1,'Billing upgrade set') returning id", [user.id])).rows[0];
      const choice = (await pool.query(`insert into application_choices
        (application_set_id,user_id,school_id,program_id,program_intake_id,admission_route_key)
        values ($1,$2,$3,$4,$5,'direct_university') returning id`,
      [set.id, user.id, school.id, program.id, intake.id])).rows[0];
      const invoice = (await pool.query(`insert into invoices
        (user_id,application_set_id,status,currency,subtotal_minor,discount_minor,total_minor,idempotency_key,metadata_json)
        values ($1,$2,'draft','CNY',80000,0,80000,'billing-upgrade-v1','{"legacy":true}'::jsonb) returning id`,
      [user.id, set.id])).rows[0];
      const legacy = (await pool.query(`insert into invoice_lines
        (invoice_id,application_choice_id,line_type,description,amount_minor,currency,metadata_json)
        values ($1,$2,'application_fee','Legacy application fee',80000,'CNY','{"legacy":true}'::jsonb) returning id`,
      [invoice.id, choice.id])).rows[0];

      const applied = JSON.parse((await run("--apply", env)).stdout);
      assert.equal(applied.appliedBefore, 29); assert.equal(applied.appliedNow, plan.length - 29);
      assert.deepEqual((await pool.query(`select application_choice_id,line_type,description,amount_minor,currency,
        metadata_json,line_format,user_id,application_set_id,school_id,program_id,program_intake_id,
        admission_route_key,target_key,fee_code,pricing_basis_sha256 from invoice_lines where id = $1`,
      [legacy.id])).rows[0], { application_choice_id: choice.id, line_type: "application_fee",
        description: "Legacy application fee", amount_minor: 80000, currency: "CNY", metadata_json: { legacy: true },
        line_format: "cuac.invoice-line.v1", user_id: null, application_set_id: null, school_id: null,
        program_id: null, program_intake_id: null, admission_route_key: null, target_key: null,
        fee_code: null, pricing_basis_sha256: null });
      assert.equal((await pool.query("select count(*)::int as total from application_fee_entitlements")).rows[0].total, 0);
      await assert.rejects(pool.query(`insert into invoice_lines
        (invoice_id,application_choice_id,line_type,description,amount_minor,currency)
        values ($1,$2,'application_fee','Old writer after upgrade',80000,'CNY')`, [invoice.id, choice.id]),
      error => error.code === "23514" && error.constraint === "invoice_lines_format_check");

      const client = createTransactionalSqlClient(pool), providerSessionId = `upgrade-${randomUUID()}`;
      const billing = new PostgresBillingRepository(client,
        { currency: "CNY", applicationFeeMinor: 80000, serviceFeeMinor: 0 }, {
          provider: "rehearsal_hosted",
          async createCheckoutSession() { return { providerCheckoutSessionId: providerSessionId,
            checkoutUrl: `https://payments.example.invalid/checkout/${providerSessionId}` }; },
        });
      const checkout = await billing.createCheckoutIntent(user.id, { applicationSetId: set.id,
        applicationChoiceIds: [choice.id], successReturnPath: "/success", cancelReturnPath: "/cancel" });
      const v2 = (await pool.query(`select line_format,user_id,application_set_id,application_choice_id,
        school_id,program_id,program_intake_id,admission_route_key,fee_code,pricing_basis_sha256
        from invoice_lines where invoice_id = $1`, [checkout.invoiceId])).rows;
      assert.equal(v2.length, 1); assert.equal(v2[0].line_format, "cuac.invoice-line.v2");
      assert.deepEqual(v2[0], { line_format: "cuac.invoice-line.v2", user_id: user.id,
        application_set_id: set.id, application_choice_id: choice.id, school_id: school.id,
        program_id: program.id, program_intake_id: intake.id, admission_route_key: "direct_university",
        fee_code: "application_submission", pricing_basis_sha256: v2[0].pricing_basis_sha256 });
      assert.match(v2[0].pricing_basis_sha256, /^[a-f0-9]{64}$/);
      assert.equal((await pool.query("select count(*)::int as total from application_fee_entitlements")).rows[0].total, 0);
      assert.equal(JSON.parse((await run("--apply", env)).stdout).appliedNow, 0);
    }));
    await runSchoolTargetUpgradeRehearsal(t, { withDatabase, folder, plan, run });
  });
}
