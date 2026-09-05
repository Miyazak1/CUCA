import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const foundationMigrationPath = new URL("../../../drizzle/pg/0000_solid_oracle.sql", import.meta.url);
const studentCoreMigrationPath = new URL("../../../drizzle/pg/0001_fixed_tempest.sql", import.meta.url);
const agentContextMigrationPath = new URL("../../../drizzle/pg/0002_agent_context_foundation.sql", import.meta.url);
const billingBusinessMigrationPath = new URL("../../../drizzle/pg/0003_billing_business_foundation.sql", import.meta.url);
const emailVerificationMigrationPath = new URL("../../../drizzle/pg/0004_email_verification_foundation.sql", import.meta.url);
const passwordResetMigrationPath = new URL("../../../drizzle/pg/0005_password_reset_foundation.sql", import.meta.url);
const authRateLimitMigrationPath = new URL("../../../drizzle/pg/0006_auth_rate_limit_foundation.sql", import.meta.url);
const materialSnapshotMigrationPath = new URL("../../../drizzle/pg/0025_application_material_snapshot.sql", import.meta.url);
const officialSubmissionPolicyMigrationPath = new URL("../../../drizzle/pg/0026_official_submission_policy.sql", import.meta.url);
const applicationChoiceAdmissionRouteMigrationPath = new URL("../../../drizzle/pg/0027_application_choice_admission_route.sql", import.meta.url);
const applicationPolicyBoundAuthorizationMigrationPath = new URL("../../../drizzle/pg/0028_application_policy_bound_authorization.sql", import.meta.url);
const applicationFeeEntitlementMigrationPath = new URL("../../../drizzle/pg/0029_application_fee_entitlement.sql", import.meta.url);
const applicationAtomicSubmissionMigrationPath = new URL("../../../drizzle/pg/0030_application_atomic_submission.sql", import.meta.url);
const agentMemoryRetentionMigrationPath = new URL("../../../drizzle/pg/0031_agent_memory_retention.sql", import.meta.url);
const agentCandidateCapacityMigrationPath = new URL("../../../drizzle/pg/0032_agent_candidate_capacity.sql", import.meta.url);
const studentPrivateFilesMigrationPath = new URL("../../../drizzle/pg/0034_student_private_files.sql", import.meta.url);
const schoolApplicationWorkflowMigrationPath = new URL("../../../drizzle/pg/0035_school_application_workflow.sql", import.meta.url);
const officialSubmissionDeliveryMigrationPath = new URL("../../../drizzle/pg/0036_official_submission_delivery.sql", import.meta.url);
const paymentProviderReconciliationMigrationPath = new URL("../../../drizzle/pg/0037_payment_provider_reconciliation.sql", import.meta.url);
const authSessionStepUpMigrationPath = new URL("../../../drizzle/pg/0038_auth_session_step_up.sql", import.meta.url);
const cuacApplicationReferenceMigrationPath = new URL("../../../drizzle/pg/0039_cuac_application_reference.sql", import.meta.url);
const opsAccessAndApplicationSupportMigrationPath = new URL("../../../drizzle/pg/0040_ops_access_and_application_support.sql", import.meta.url);
const opsSupportAccessSessionMigrationPath = new URL("../../../drizzle/pg/0041_ops_support_access_session.sql", import.meta.url);
const notificationDeliveryMigrationPath = new URL("../../../drizzle/pg/0042_notification_delivery.sql", import.meta.url);
const opsPaymentEventReviewsMigrationPath = new URL("../../../drizzle/pg/0043_ops_payment_event_reviews.sql", import.meta.url);
const opsSubmissionDeliveryReviewsMigrationPath = new URL("../../../drizzle/pg/0044_ops_submission_delivery_reviews.sql", import.meta.url);
const opsCatalogQualityReviewsMigrationPath = new URL("../../../drizzle/pg/0045_ops_catalog_quality_reviews.sql", import.meta.url);
const schoolCatalogCorrectionsMigrationPath = new URL("../../../drizzle/pg/0046_school_catalog_corrections.sql", import.meta.url);
const schoolCatalogCorrectionUrlCheckMigrationPath = new URL("../../../drizzle/pg/0047_school_catalog_correction_url_check.sql", import.meta.url);
const journalPath = new URL("../../../drizzle/pg/meta/_journal.json", import.meta.url);

test("school catalog correction URL follow-up replaces only the invalid PostgreSQL repetition check", async () => {
  const [sql, journalText] = await Promise.all([
    readFile(schoolCatalogCorrectionUrlCheckMigrationPath, "utf8"), readFile(journalPath, "utf8"),
  ]);
  assert.match(sql, /DROP CONSTRAINT "school_catalog_correction_requests_request_check"/);
  assert.match(sql, /evidence_url" ~ '\^https:\/\/\[\^\[:space:\]\]\+\$'/);
  assert.match(sql, /char_length\([^;]+evidence_url[^;]+\) between 9 and 2048/s);
  assert.doesNotMatch(sql, /\{1,2039\}/);
  assert.doesNotMatch(sql, /^\s*(?:UPDATE|DELETE FROM|INSERT INTO)\b/im);
  const journal = JSON.parse(journalText);
  assert.equal(journal.entries.find(entry => entry.tag === "0047_school_catalog_correction_url_check")?.idx, 47);
});

test("school catalog correction migration binds tenant generations and dual-control publication", async () => {
  const [sql, journalText] = await Promise.all([
    readFile(schoolCatalogCorrectionsMigrationPath, "utf8"), readFile(journalPath, "utf8"),
  ]);
  assert.match(sql, /CREATE TABLE "school_catalog_correction_requests"/);
  assert.match(sql, /school_catalog_correction_requests_requester_membership_fk/);
  assert.match(sql, /school_catalog_correction_requests_claimed_grant_scope_fk/);
  assert.match(sql, /school_catalog_correction_requests_resolved_grant_scope_fk/);
  assert.match(sql, /school_catalog_correction_requests_active_generation_unique/);
  assert.ok(sql.indexOf("school_staff_memberships_id_user_school_role_unique")
    < sql.indexOf("school_catalog_correction_requests_requester_membership_fk"));
  assert.match(sql, /resolved_by_user_id" <> "school_catalog_correction_requests"\."claimed_by_user_id/);
  assert.match(sql, /applied_unverified/);
  assert.match(sql, /verification|unverified/i);
  assert.doesNotMatch(sql, /^\s*(?:UPDATE|DELETE FROM|INSERT INTO)\b/im);
  assert.doesNotMatch(sql, /agent_|student_|application_material|payment/i);
  const journal = JSON.parse(journalText);
  assert.equal(journal.entries.find(entry => entry.tag === "0046_school_catalog_corrections")?.idx, 46);
});

test("Ops catalog quality migration binds exact evidence generations and dual-control verification", async () => {
  const [sql, journalText] = await Promise.all([
    readFile(opsCatalogQualityReviewsMigrationPath, "utf8"), readFile(journalPath, "utf8"),
  ]);
  assert.match(sql, /CREATE TABLE "ops_catalog_quality_reviews"/);
  assert.match(sql, /UNIQUE NULLS NOT DISTINCT\("entity_type","entity_id","source_entity_updated_at","source_evidence_id"\)/);
  assert.match(sql, /ops_catalog_quality_reviews_source_evidence_fk/);
  assert.match(sql, /ops_catalog_quality_reviews_assigned_grant_scope_fk/);
  assert.match(sql, /ops_catalog_quality_reviews_resolved_grant_scope_fk/);
  assert.match(sql, /resolved_by_user_id" <> "ops_catalog_quality_reviews"\."assigned_user_id/);
  assert.match(sql, /review_due_at" >= [^;]+interval '30 days'/s);
  assert.match(sql, /review_due_at" <= [^;]+interval '366 days'/s);
  assert.ok(sql.indexOf("catalog_source_evidence_identity_unique")
    < sql.indexOf("ops_catalog_quality_reviews_source_evidence_fk"));
  for (const table of ["cities", "schools", "programs", "scholarships"]) {
    assert.match(sql, new RegExp(`ALTER TABLE "${table}" ADD COLUMN "verified_by_user_id" uuid`));
    assert.match(sql, new RegExp(`ALTER TABLE "${table}" ADD COLUMN "next_review_due_at" timestamp with time zone`));
  }
  assert.doesNotMatch(sql, /^\s*(?:UPDATE|DELETE FROM|INSERT INTO)\b/im);
  assert.doesNotMatch(sql, /agent_|student_|application_material|payment/i);
  const journal = JSON.parse(journalText);
  assert.equal(journal.entries.find(entry => entry.tag === "0045_ops_catalog_quality_reviews")?.idx, 45);
});

test("Ops submission routing review migration binds immutable quarantine evidence and dual-control retry", async () => {
  const [sql, journalText] = await Promise.all([
    readFile(opsSubmissionDeliveryReviewsMigrationPath, "utf8"), readFile(journalPath, "utf8"),
  ]);
  assert.match(sql, /CREATE TABLE "ops_submission_delivery_reviews"/);
  assert.match(sql, /ops_submission_delivery_reviews_source_check/);
  assert.match(sql, /ops_submission_delivery_reviews_lifecycle_check/);
  assert.match(sql, /ops_submission_delivery_reviews_assigned_grant_scope_fk/);
  assert.match(sql, /ops_submission_delivery_reviews_resolved_grant_scope_fk/);
  assert.match(sql, /ops_submission_delivery_reviews_outbox_generation_unique/);
  assert.match(sql, /ops_submission_delivery_reviews_retry_approval_unique/);
  assert.match(sql, /WHERE "ops_submission_delivery_reviews"\."status" = 'retry_approved'/);
  assert.match(sql, /source_outcome" = 'attempt_limit'[\s\S]*source_attempt_count" = 5/);
  assert.match(sql, /status" = 'retry_approved'[\s\S]*source_error_code" = 'ATTEMPT_LIMIT'/);
  assert.match(sql, /resolved_by_user_id" <> "ops_submission_delivery_reviews"\."assigned_user_id/);
  assert.doesNotMatch(sql, /(?:UPDATE|DELETE FROM) "?(?:official_submission_outbox|official_submission_groups|school_applications)"?/i);
  const journal = JSON.parse(journalText);
  const entry = journal.entries.find(candidate => candidate.tag === "0044_ops_submission_delivery_reviews");
  assert.equal(entry?.idx, 44);
});

test("Ops payment review migration adds dual-control workflow records without mutating payment facts", async () => {
  const [sql, journalText] = await Promise.all([readFile(opsPaymentEventReviewsMigrationPath, "utf8"), readFile(journalPath, "utf8")]);
  assert.match(sql, /CREATE TABLE "ops_payment_event_reviews"/);
  assert.match(sql, /ops_payment_event_reviews_lifecycle_check/);
  assert.match(sql, /ops_payment_event_reviews_assigned_grant_scope_fk/);
  assert.match(sql, /ops_payment_event_reviews_resolved_grant_scope_fk/);
  assert.match(sql, /resolved_by_user_id" <> "ops_payment_event_reviews"\."assigned_user_id/);
  assert.doesNotMatch(sql, /(?:UPDATE|DELETE FROM) "?(?:payments|invoices|application_fee_entitlements|payment_provider_events)"?/i);
  const journal = JSON.parse(journalText);
  const entry = journal.entries.find(candidate => candidate.tag === "0043_ops_payment_event_reviews");
  assert.equal(entry?.idx, 43);
});

test("notification migration creates persona-scoped event, template, preference and reliable delivery tables", async () => {
  const [sql, journalText] = await Promise.all([readFile(notificationDeliveryMigrationPath, "utf8"), readFile(journalPath, "utf8")]);
  for (const table of ["notification_preferences", "notification_templates", "notification_events", "notification_deliveries"]) {
    assert.match(sql, new RegExp(`CREATE TABLE "${table}"`));
  }
  assert.match(sql, /notification_deliveries_event_scope_fk/);
  assert.match(sql, /notification_deliveries_template_scope_fk/);
  assert.match(sql, /notification_deliveries_lifecycle_check/);
  assert.match(sql, /notification_preferences_security_check/);
  assert.doesNotMatch(sql, /provider_error|idempotency_key|password|passport|payment_method/i);
  const journal = JSON.parse(journalText);
  const entry = journal.entries.find(candidate => candidate.tag === "0042_notification_delivery");
  assert.equal(entry?.idx, 42);
});

test("Agent memory control migration adds account policy and payload cleanup metadata without deleting history", async () => {
  const sql = await readFile(new URL("../../../drizzle/pg/0010_agent_memory_controls.sql", import.meta.url), "utf8");
  const journal = JSON.parse(await readFile(journalPath, "utf8"));
  assert.match(sql, /CREATE TABLE "agent_student_memory_settings"/);
  assert.match(sql, /"user_id" uuid PRIMARY KEY REFERENCES "users"\("id"\) ON DELETE CASCADE/);
  assert.match(sql, /ADD COLUMN "payload_cleared_at" timestamptz/);
  assert.match(sql, /WHERE "payload_cleared_at" IS NULL/);
  assert.doesNotMatch(sql, /DELETE FROM|UPDATE "?agent_/i);
  assert.equal(journal.entries.find((entry) => entry.tag === "0010_agent_memory_controls").idx, 10);
});

test("Agent confirmation migration keeps one memory per source including cleared records", async () => {
  const sql = await readFile(new URL("../../../drizzle/pg/0009_agent_memory_confirmation_unique.sql", import.meta.url), "utf8");
  const journal = JSON.parse(await readFile(journalPath, "utf8"));
  assert.match(sql, /CREATE UNIQUE INDEX "agent_memory_entries_source_candidate_unique"/);
  assert.match(sql, /USING btree \("source_candidate_id"\)/);
  assert.doesNotMatch(sql, /\bWHERE\b|\bDELETE\s+FROM\b/i);
  assert.equal(journal.entries.find((entry) => entry.tag === "0009_agent_memory_confirmation_unique").idx, 9);
});

test("PostgreSQL migration 001 creates the Phase 1 foundation tables", async () => {
  const sql = await readFile(foundationMigrationPath, "utf8");

  [
    "users",
    "auth_identities",
    "auth_sessions",
    "user_roles",
    "school_staff_invites",
    "school_staff_memberships",
    "cuac_staff_access_grants",
    "sign_in_continuations",
    "audit_logs",
    "cities",
    "schools",
    "programs",
    "program_intakes",
    "scholarships",
    "program_scholarships",
    "catalog_source_evidence",
  ].forEach((tableName) => {
    assert.match(sql, new RegExp(`CREATE TABLE "${tableName}"`), `${tableName} should exist in migration 001`);
  });
});

test("PostgreSQL migration 001 uses PostgreSQL features instead of demo SQLite/D1", async () => {
  const [sql, journal] = await Promise.all([readFile(foundationMigrationPath, "utf8"), readFile(journalPath, "utf8")]);

  assert.match(sql, /uuid PRIMARY KEY DEFAULT gen_random_uuid\(\)/);
  assert.match(sql, /jsonb DEFAULT '\[\]'::jsonb NOT NULL/);
  assert.match(sql, /USING btree/);
  assert.match(journal, /"dialect": "postgresql"/);
  assert.doesNotMatch(sql, /AUTOINCREMENT|sqlite|WITHOUT ROWID/i);
});

test("PostgreSQL migration 001 defers later payment, application, and Agent runtime tables", async () => {
  const sql = await readFile(foundationMigrationPath, "utf8");

  [
    "student_profiles",
    "application_sets",
    "application_choices",
    "school_applications",
    "payments",
    "invoices",
    "agent_conversations",
    "agent_messages",
    "agent_memory_entries",
    "agent_tool_invocations",
  ].forEach((tableName) => {
    assert.doesNotMatch(sql, new RegExp(`CREATE TABLE "${tableName}"`), `${tableName} should be deferred`);
  });
});

test("PostgreSQL migration 002 creates stable student application core tables", async () => {
  const sql = await readFile(studentCoreMigrationPath, "utf8");

  [
    "student_profiles",
    "saved_items",
    "application_sets",
    "application_choices",
    "application_choice_status_events",
    "school_applications",
    "school_application_status_events",
  ].forEach((tableName) => {
    assert.match(sql, new RegExp(`CREATE TABLE "${tableName}"`), `${tableName} should exist in migration 002`);
  });

  assert.match(sql, /"school_visible_profile_json" jsonb DEFAULT '\{\}'::jsonb NOT NULL/);
  assert.match(sql, /"routing_metadata_json" jsonb DEFAULT '\{\}'::jsonb NOT NULL/);
  assert.match(sql, /"student_profiles_user_unique"/);
  assert.match(sql, /"school_applications_school_status_idx"/);
  assert.match(sql, /"application_choices_active_set_program_unique"/);
});

test("PostgreSQL migration 002 still defers payment and Agent runtime tables", async () => {
  const sql = await readFile(studentCoreMigrationPath, "utf8");

  [
    "payments",
    "invoices",
    "invoice_lines",
    "agent_conversations",
    "agent_messages",
    "agent_memory_entries",
    "agent_tool_invocations",
  ].forEach((tableName) => {
    assert.doesNotMatch(sql, new RegExp(`CREATE TABLE "${tableName}"`), `${tableName} should remain deferred`);
  });
});

test("PostgreSQL migration 003 creates Agent context foundation without raw transcript storage", async () => {
  const [sql, journal] = await Promise.all([readFile(agentContextMigrationPath, "utf8"), readFile(journalPath, "utf8")]);

  ["agent_persona_sessions", "agent_context_candidates", "agent_memory_entries"].forEach((tableName) => {
    assert.match(sql, new RegExp(`CREATE TABLE "${tableName}"`), `${tableName} should exist in migration 003`);
  });

  assert.match(sql, /"memory_namespace" text NOT NULL/);
  assert.match(sql, /"data_class" text NOT NULL/);
  assert.match(sql, /"structured_json" jsonb DEFAULT '\{\}'::jsonb NOT NULL/);
  assert.match(sql, /"source_entity_ids_json" jsonb DEFAULT '\[\]'::jsonb NOT NULL/);
  assert.match(sql, /"agent_memory_entries_namespace_active_idx"/);
  assert.match(journal, /"tag": "0002_agent_context_foundation"/);

  ["agent_conversations", "agent_messages", "agent_tool_invocations", "agent_action_previews"].forEach((tableName) => {
    assert.doesNotMatch(sql, new RegExp(`CREATE TABLE "${tableName}"`), `${tableName} should remain deferred`);
  });
});

test("PostgreSQL migration 004 creates billing business state without raw payment credentials", async () => {
  const [sql, journal] = await Promise.all([readFile(billingBusinessMigrationPath, "utf8"), readFile(journalPath, "utf8")]);

  ["billing_customers", "invoices", "invoice_lines", "payments", "payment_status_events"].forEach((tableName) => {
    assert.match(sql, new RegExp(`CREATE TABLE "${tableName}"`), `${tableName} should exist in migration 004`);
  });

  assert.match(sql, /"amount_minor" integer NOT NULL/);
  assert.match(sql, /"currency" text NOT NULL/);
  assert.match(sql, /"provider_payment_id" text/);
  assert.match(sql, /"provider_checkout_session_id" text/);
  assert.match(sql, /"invoices_idempotency_key_unique"/);
  assert.match(sql, /"payments_provider_checkout_idx"/);
  assert.match(journal, /"tag": "0003_billing_business_foundation"/);

  [
    "card_number",
    "cardNumber",
    "cvv",
    "cvc",
    "bank_account",
    "account_number",
    "routing_number",
    "payment_token",
    "raw_card",
  ].forEach((columnName) => {
    assert.doesNotMatch(sql, new RegExp(columnName, "i"), `${columnName} should not be stored in CUAC billing tables`);
  });

  ["agent_conversations", "agent_messages", "agent_tool_invocations", "agent_action_previews"].forEach((tableName) => {
    assert.doesNotMatch(sql, new RegExp(`CREATE TABLE "${tableName}"`), `${tableName} should remain deferred`);
  });
});

test("PostgreSQL migration 005 creates email verification challenges without raw token storage", async () => {
  const [sql, journal] = await Promise.all([readFile(emailVerificationMigrationPath, "utf8"), readFile(journalPath, "utf8")]);

  assert.match(sql, /CREATE TABLE "email_verification_challenges"/);
  assert.match(sql, /"verification_token_hash" text NOT NULL/);
  assert.match(sql, /"email_verification_challenges_token_hash_unique"/);
  assert.match(sql, /"email_verification_challenges_user_status_idx"/);
  assert.match(sql, /"email_verification_challenges_expires_idx"/);
  assert.match(journal, /"tag": "0004_email_verification_foundation"/);
  assert.doesNotMatch(sql, /raw_token|verification_token" text|password|session_token|card_number|cvv|payment_token/i);
});

test("PostgreSQL migration 006 creates password reset challenges without raw password or token storage", async () => {
  const [sql, journal] = await Promise.all([readFile(passwordResetMigrationPath, "utf8"), readFile(journalPath, "utf8")]);

  assert.match(sql, /CREATE TABLE "password_reset_challenges"/);
  assert.match(sql, /"reset_token_hash" text NOT NULL/);
  assert.match(sql, /"password_reset_challenges_token_hash_unique"/);
  assert.match(sql, /"password_reset_challenges_user_status_idx"/);
  assert.match(sql, /"password_reset_challenges_expires_idx"/);
  assert.match(journal, /"tag": "0005_password_reset_foundation"/);
  assert.doesNotMatch(sql, /raw_token|reset_token" text|password_hash|new_password|session_token|card_number|cvv|payment_token/i);
});

test("application command migration keeps scoped hashed receipts without resource cascade", async () => {
  const sql = await readFile(new URL("../../../drizzle/pg/0011_student_application_commands.sql", import.meta.url), "utf8");
  const journal = JSON.parse(await readFile(journalPath, "utf8"));
  assert.match(sql, /ON DELETE CASCADE/);
  assert.match(sql, /\("user_id", "operation", "key_hash"\)/);
  assert.match(sql, /"resource_id" uuid,/);
  assert.match(sql, /completion_check/);
  assert.doesNotMatch(sql, /student_notes|response_body|request_body|raw_key|DELETE FROM|ALTER TABLE|REFERENCES "application_/i);
  assert.equal(journal.entries.find(entry => entry.tag === "0011_student_application_commands").idx, 11);
});

test("PostgreSQL migration 007 creates Auth rate limit buckets without raw subject storage", async () => {
  const [sql, journal] = await Promise.all([readFile(authRateLimitMigrationPath, "utf8"), readFile(journalPath, "utf8")]);

  assert.match(sql, /CREATE TABLE "auth_rate_limit_buckets"/);
  assert.match(sql, /"key_hash" text NOT NULL/);
  assert.match(sql, /"attempt_count" integer DEFAULT 0 NOT NULL/);
  assert.match(sql, /"auth_rate_limit_buckets_action_key_window_unique"/);
  assert.match(sql, /"auth_rate_limit_buckets_key_expires_idx"/);
  assert.match(journal, /"tag": "0006_auth_rate_limit_foundation"/);
  assert.doesNotMatch(sql, /email|ip_address|user_agent|raw_subject|password|session_token|card_number|cvv|payment_token/i);
});

test("PostgreSQL migration 026 stores one encrypted material snapshot per exact authorization target", async () => {
  const [sql, journalText] = await Promise.all([
    readFile(materialSnapshotMigrationPath, "utf8"),
    readFile(journalPath, "utf8"),
  ]);
  const journal = JSON.parse(journalText);

  assert.match(sql, /CREATE TABLE "application_material_snapshots"/);
  for (const column of [
    "application_choice_id", "school_id", "program_id", "program_intake_id", "authorization_id",
    "authorization_scope_sha256", "material_content_sha256", "payload_sha256", "payload_bytes",
    "payload_format", "encryption_scheme", "encryption_key_id", "envelope_json", "captured_request_id",
  ]) assert.match(sql, new RegExp(`"${column}"`));
  assert.match(sql, /"target_key" text GENERATED ALWAYS AS \("program_id"::text \|\| '\/' \|\| "program_intake_id"::text\) STORED NOT NULL/);
  assert.match(sql, /application_material_snapshot_authorization_unique[^;]+\("authorization_id"\)/);
  assert.match(sql, /application_material_snapshot_choice_target_fk[^;]+FOREIGN KEY \("application_choice_id","target_key"\)/);
  assert.match(sql, /application_material_snapshot_authorization_scope_fk[^;]+FOREIGN KEY \("authorization_id","user_id","application_set_id","application_choice_id","school_id","program_id","program_intake_id"\)/);
  assert.match(sql, /application_material_snapshot_program_school_fk/);
  assert.match(sql, /application_material_snapshot_intake_program_fk/);
  assert.match(sql, /application_material_snapshot_envelope_check/);
  assert.match(sql, /'aes-256-gcm-v1'/);
  assert.match(sql, /'application_material_snapshot\.create'/);
  assert.ok(sql.indexOf('CREATE UNIQUE INDEX "application_submission_authorization_scope_unique"')
    < sql.indexOf('ADD CONSTRAINT "application_material_snapshot_authorization_scope_fk"'),
  "The authorization scope index must exist before PostgreSQL creates the composite foreign key");
  assert.doesNotMatch(sql, /"selection_json"|"full_name"|"contact_email"|"citizenship_country"|"score_json"|"student_notes"/i);
  assert.doesNotMatch(sql, /\b(?:UPDATE|DELETE FROM)\s+"?(?:application_submission_authorizations|application_material_selections)"?/i);
  assert.equal(journal.entries.find(entry => entry.tag === "0025_application_material_snapshot").idx, 25);
});

test("PostgreSQL migration 027 stores reviewed route policy without merging program applications", async () => {
  const [sql, journalText] = await Promise.all([
    readFile(officialSubmissionPolicyMigrationPath, "utf8"),
    readFile(journalPath, "utf8"),
  ]);
  const journal = JSON.parse(journalText);
  for (const table of [
    "official_submission_policy_versions",
    "official_submission_policy_version_targets",
    "official_submission_policy_publications",
  ]) assert.match(sql, new RegExp(`CREATE TABLE "${table}"`));
  assert.equal((sql.match(/CREATE TABLE/g) ?? []).length, 3);
  assert.match(sql, /official_submission_policy_scope_version_unique[^;]+\("school_id","policy_key","admission_route_key","version"\)/);
  assert.match(sql, /official_submission_policy_version_targets_pk[^;]+PRIMARY KEY\("policy_version_id","program_intake_id"\)/);
  assert.match(sql, /official_submission_policy_publications_pk[^;]+PRIMARY KEY\("program_intake_id","admission_route_key"\)/);
  assert.match(sql, /official_submission_policy_target_intake_program_fk[^;]+FOREIGN KEY \("program_intake_id","program_id"\)/);
  assert.match(sql, /official_submission_policy_target_program_school_fk[^;]+FOREIGN KEY \("program_id","school_id"\)/);
  assert.ok(sql.indexOf('CREATE UNIQUE INDEX "official_submission_policy_target_publication_unique"')
    < sql.indexOf('ADD CONSTRAINT "official_submission_policy_publication_target_fk"'),
  "The exact target index must exist before PostgreSQL creates the publication foreign key");
  assert.ok(sql.indexOf('CREATE UNIQUE INDEX "official_submission_policy_id_scope_unique"')
    < sql.indexOf('ADD CONSTRAINT "official_submission_policy_target_version_scope_fk"'),
  "The version scope index must exist before PostgreSQL creates the target foreign key");
  assert.doesNotMatch(sql, /official_submission_group|payment|billing|school_application|application_choice/i);
  assert.doesNotMatch(sql, /^\s*(?:INSERT INTO|UPDATE|DELETE FROM)\b/im);
  assert.equal(journal.entries.find(entry => entry.tag === "0026_official_submission_policy").idx, 26);
});

test("PostgreSQL migration 028 adds an explicit nullable choice route without inference or grouping", async () => {
  const [sql, journalText] = await Promise.all([
    readFile(applicationChoiceAdmissionRouteMigrationPath, "utf8"),
    readFile(journalPath, "utf8"),
  ]);
  const journal = JSON.parse(journalText);
  assert.match(sql, /ALTER TABLE "application_choices" ADD COLUMN "admission_route_key" text/);
  assert.match(sql, /application_choices_admission_route_check/);
  assert.match(sql, /\^\[a-z\]\[a-z0-9_-\]\{0,63\}\$/);
  assert.match(sql, /application_choices_intake_route_idx[^;]+\("program_intake_id","admission_route_key"\)/);
  assert.match(sql, /WHERE "application_choices"\."removed_at" is null and "application_choices"\."admission_route_key" is not null/);
  assert.doesNotMatch(sql, /admission_route_key" text (?:NOT NULL|DEFAULT)/i);
  assert.doesNotMatch(sql, /^\s*(?:INSERT INTO|UPDATE|DELETE FROM)\b/im);
  assert.doesNotMatch(sql, /official_submission_group|payment|billing|school_application/i);
  assert.equal(journal.entries.find(entry => entry.tag === "0027_application_choice_admission_route").idx, 27);
});

test("PostgreSQL migration 029 preserves v1 evidence and fences every new authorization into a complete v2 policy scope", async () => {
  const [sql, journalText] = await Promise.all([
    readFile(applicationPolicyBoundAuthorizationMigrationPath, "utf8"),
    readFile(journalPath, "utf8"),
  ]);
  const journal = JSON.parse(journalText);
  assert.match(sql, /ADD COLUMN "authorization_format" text DEFAULT 'cuac\.application-submission-authorization\.v1' NOT NULL/);
  assert.match(sql, /ALTER COLUMN "authorization_format" SET DEFAULT 'cuac\.application-submission-authorization\.v2'/);
  for (const column of ["admission_route_key", "policy_version_id", "policy_publication_revision",
    "policy_document_sha256", "policy_target_set_sha256", "policy_approval_sha256"]) {
    assert.match(sql, new RegExp(`ADD COLUMN "${column}"`));
  }
  assert.match(sql, /application_submission_authorization_policy_binding_check/);
  assert.match(sql, /application_submission_authorization_policy_target_fk[^;]+FOREIGN KEY \("policy_version_id","program_intake_id","program_id","school_id","admission_route_key"\)/);
  assert.match(sql, /official_submission_policy_version_targets"\("policy_version_id","program_intake_id","program_id","school_id","admission_route_key"\)/);
  assert.match(sql, /application_submission_authorization_policy_idx[^;]+\("policy_version_id","program_intake_id","admission_route_key"\)/);
  assert.doesNotMatch(sql, /^\s*(?:INSERT INTO|UPDATE|DELETE FROM)\b/im);
  assert.doesNotMatch(sql, /official_submission_group|payment|billing|school_application/i);
  assert.equal(journal.entries.find(entry => entry.tag === "0028_application_policy_bound_authorization").idx, 28);
});

test("PostgreSQL migration 030 preserves legacy billing lines and adds exact per-project fee entitlements", async () => {
  const [sql, journalText] = await Promise.all([
    readFile(applicationFeeEntitlementMigrationPath, "utf8"),
    readFile(journalPath, "utf8"),
  ]);
  const journal = JSON.parse(journalText);
  assert.match(sql, /CREATE TABLE "application_fee_entitlements"/);
  assert.match(sql, /ADD COLUMN "line_format" text DEFAULT 'cuac\.invoice-line\.v1' NOT NULL/);
  assert.match(sql, /ALTER COLUMN "line_format" SET DEFAULT 'cuac\.invoice-line\.v2'/);
  assert.ok(sql.indexOf("DEFAULT 'cuac.invoice-line.v1'") < sql.indexOf("SET DEFAULT 'cuac.invoice-line.v2'"));
  assert.match(sql, /invoice_lines_format_check/);
  assert.match(sql, /application_fee_entitlements_format_check/);
  assert.match(sql, /application_fee_entitlements_lifecycle_check/);
  assert.match(sql, /invoice_lines_entitlement_evidence_unique/);
  assert.match(sql, /application_fee_entitlements_line_evidence_fk[^;]+FOREIGN KEY \("invoice_line_id","invoice_id","user_id","application_set_id","application_choice_id","school_id","program_id","program_intake_id","admission_route_key","line_format","line_type","fee_code","amount_minor","currency","pricing_basis_sha256"\)/);
  assert.match(sql, /application_fee_entitlements_payment_event_fk[^;]+FOREIGN KEY \("payment_status_event_id","payment_id","source_payment_status"\)/);
  assert.ok(sql.indexOf('CREATE UNIQUE INDEX "invoice_lines_entitlement_evidence_unique"')
    < sql.indexOf('ADD CONSTRAINT "application_fee_entitlements_line_evidence_fk"'));
  assert.ok(sql.indexOf('CREATE UNIQUE INDEX "invoices_id_user_set_unique"')
    < sql.indexOf('ADD CONSTRAINT "application_fee_entitlements_invoice_scope_fk"'));
  assert.match(sql, /target_key" text GENERATED ALWAYS AS \(case when "program_id" is not null/);
  assert.doesNotMatch(sql, /^\s*(?:INSERT INTO|UPDATE|DELETE FROM)\b/im);
  assert.doesNotMatch(sql, /official_submission_group|school_application|card_number|\bcvv\b|\bcvc\b|bank_account|routing_number|payment_token|raw_source/i);
  assert.equal(journal.entries.find(entry => entry.tag === "0029_application_fee_entitlement").idx, 29);
});

test("PostgreSQL migration 031 adds atomic per-project receipt grouping and an inert dispatch outbox", async () => {
  const [sql, journalText] = await Promise.all([
    readFile(applicationAtomicSubmissionMigrationPath, "utf8"),
    readFile(journalPath, "utf8"),
  ]);
  const journal = JSON.parse(journalText);
  for (const table of ["application_submissions", "official_submission_groups",
    "official_submission_group_members", "official_submission_outbox"]) {
    assert.match(sql, new RegExp(`CREATE TABLE "${table}"`));
  }
  assert.equal((sql.match(/CREATE TABLE/g) ?? []).length, 4);
  assert.match(sql, /ADD COLUMN "application_record_format" text DEFAULT 'cuac\.program-application\.v1' NOT NULL/);
  assert.match(sql, /ALTER COLUMN "application_record_format" SET DEFAULT 'cuac\.program-application\.v2'/);
  assert.ok(sql.indexOf("DEFAULT 'cuac.program-application.v1'")
    < sql.indexOf("SET DEFAULT 'cuac.program-application.v2'"));
  assert.match(sql, /student_application_commands_operation_check[^;]+'application\.submit'/);
  assert.match(sql, /school_applications_authorization_scope_fk/);
  assert.match(sql, /school_applications_snapshot_scope_fk/);
  assert.match(sql, /school_applications_entitlement_scope_fk/);
  assert.match(sql, /school_applications_requirement_scope_fk/);
  assert.match(sql, /school_applications_policy_target_fk/);
  assert.match(sql, /official_submission_group_members_application_evidence_fk/);
  assert.match(sql, /official_submission_outbox_group_unique/);
  assert.ok(sql.indexOf('CREATE UNIQUE INDEX "application_submissions_scope_unique"')
    < sql.indexOf('ADD CONSTRAINT "official_submission_groups_submission_scope_fk"'));
  assert.ok(sql.indexOf('CREATE UNIQUE INDEX "school_applications_submission_evidence_unique"')
    < sql.indexOf('ADD CONSTRAINT "official_submission_group_members_application_evidence_fk"'));
  assert.ok(sql.indexOf('CREATE UNIQUE INDEX "application_material_snapshot_submission_scope_unique"')
    < sql.indexOf('ADD CONSTRAINT "school_applications_snapshot_scope_fk"'));
  assert.ok(sql.indexOf('CREATE UNIQUE INDEX "application_fee_entitlements_submission_scope_unique"')
    < sql.indexOf('ADD CONSTRAINT "school_applications_entitlement_scope_fk"'));
  assert.doesNotMatch(sql, /UNIQUE[^;]+\("application_set_id","school_id"\)/i);
  assert.doesNotMatch(sql, /^\s*(?:INSERT INTO|UPDATE|DELETE FROM)\b/im);
  assert.doesNotMatch(sql, /card_number|\bcvv\b|\bcvc\b|bank_account|routing_number|payment_token|access_token|cookie|plaintext/i);
  assert.equal(journal.entries.find(entry => entry.tag === "0030_application_atomic_submission").idx, 30);
});

test("PostgreSQL migration 0031 bounds active student Agent memory without changing its content", async () => {
  const [sql, journalText] = await Promise.all([
    readFile(agentMemoryRetentionMigrationPath, "utf8"),
    readFile(journalPath, "utf8"),
  ]);
  const journal = JSON.parse(journalText);
  assert.match(sql, /LOCK TABLE "agent_memory_entries" IN SHARE ROW EXCLUSIVE MODE/);
  assert.match(sql, /SET "expires_at" = CASE/);
  assert.match(sql, /"created_at" \+ interval '365 days'/);
  assert.match(sql, /agent_memory_entries_student_expiry_cleanup_idx/);
  assert.match(sql, /agent_memory_entries_student_retention_check/);
  assert.match(sql, /isfinite\("agent_memory_entries"\."created_at"\)/);
  assert.match(sql, /"expires_at" <= "agent_memory_entries"\."created_at" \+ interval '365 days'/);
  assert.doesNotMatch(sql, /SET\s+(?:"summary"|"structured_json"|"source")|DELETE FROM|payments|school_applications/i);
  assert.equal(journal.entries.find(entry => entry.tag === "0031_agent_memory_retention").idx, 31);
});

test("PostgreSQL migration 0032 adds only scoped pending-candidate capacity indexes", async () => {
  const [sql, journalText] = await Promise.all([
    readFile(agentCandidateCapacityMigrationPath, "utf8"),
    readFile(journalPath, "utf8"),
  ]);
  const journal = JSON.parse(journalText);
  assert.equal((sql.match(/CREATE INDEX/g) ?? []).length, 2);
  assert.match(sql, /agent_context_candidates_guest_pending_capacity_idx[^;]+\("anonymous_session_hash","expires_at"\)/);
  assert.match(sql, /agent_context_candidates_student_pending_capacity_idx[^;]+\("user_id","expires_at"\)/);
  assert.match(sql, /"status" = 'proposed'/);
  assert.match(sql, /"payload_cleared_at" is null/);
  assert.match(sql, /"context_scope" = 'guest_page'/);
  assert.match(sql, /"context_scope" = 'student_account'/);
  assert.doesNotMatch(sql, /CREATE TABLE|ALTER TABLE|DROP|UPDATE|DELETE|INSERT|payments|school_applications/i);
  assert.equal(journal.entries.find(entry => entry.tag === "0032_agent_candidate_capacity").idx, 32);
});

test("PostgreSQL migration 0034 adds private file metadata with a closed lifecycle and no binary payload", async () => {
  const [sql, journalText] = await Promise.all([
    readFile(studentPrivateFilesMigrationPath, "utf8"),
    readFile(journalPath, "utf8"),
  ]);
  const journal = JSON.parse(journalText);
  assert.equal((sql.match(/CREATE TABLE/g) ?? []).length, 1);
  assert.match(sql, /CREATE TABLE "student_file_assets"/);
  assert.match(sql, /ON DELETE restrict/);
  assert.match(sql, /student_file_assets_owner_command_unique[^;]+\("user_id","idempotency_key_hash"\)/);
  assert.match(sql, /right\("student_file_assets"\."object_key", 36\) = "student_file_assets"\."id"::text/);
  for (const status of ["pending_upload", "pending_scan", "scanning", "clean", "delete_pending", "deleting", "deleted"]) {
    assert.match(sql, new RegExp(`status" = '${status}'`));
  }
  assert.match(sql, /"actual_sha256" = "student_file_assets"\."expected_sha256"/);
  assert.match(sql, /"lease_kind" = 'scan'/);
  assert.match(sql, /"lease_kind" = 'delete'/);
  assert.match(sql, /student_file_assets_retention_idx/);
  assert.doesNotMatch(sql, /bytea|large object|signed_url|access_key|credential|file_content|binary_payload/i);
  assert.equal(journal.entries.find(entry => entry.tag === "0034_student_private_files").idx, 34);
});

test("PostgreSQL migration 0035 adds tenant-scoped school workflow receipts and contact records", async () => {
  const [sql, journalText] = await Promise.all([
    readFile(schoolApplicationWorkflowMigrationPath, "utf8"),
    readFile(journalPath, "utf8"),
  ]);
  const journal = JSON.parse(journalText);
  assert.match(sql, /CREATE TABLE "school_application_contact_logs"/);
  assert.match(sql, /school_application_contact_logs_application_scope_fk/);
  assert.match(sql, /school_applications_id_school_unique/);
  assert.match(sql, /school_application_status_events_command_unique/);
  assert.match(sql, /school_application_contact_logs_command_unique/);
  assert.match(sql, /school_revision = school_revision \+ 1|"school_revision" integer DEFAULT 1 NOT NULL/);
  assert.match(sql, /school_applications_workflow_check/);
  assert.match(sql, /status_changed_at.*coalesce/s);
  assert.ok(sql.indexOf("school_applications_id_school_unique") < sql.indexOf("school_application_contact_logs_application_scope_fk"));
  assert.doesNotMatch(sql, /payment_sensitive|agent_memory|agent_context|raw_card|credential|access_key/i);
  assert.equal(journal.entries.find(entry => entry.tag === "0035_school_application_workflow").idx, 35);
});

test("PostgreSQL migration 0036 binds official delivery receipts before school-visible submission", async () => {
  const [sql, journalText] = await Promise.all([
    readFile(officialSubmissionDeliveryMigrationPath, "utf8"),
    readFile(journalPath, "utf8"),
  ]);
  const journal = JSON.parse(journalText);
  assert.match(sql, /CREATE TABLE "official_submission_delivery_receipts"/);
  assert.match(sql, /ADD COLUMN "payload_sha256" text/);
  assert.match(sql, /ADD COLUMN "provider_name" text/);
  assert.match(sql, /ADD COLUMN "provider_receipt_id" text/);
  assert.match(sql, /"status" = 'sending'/);
  assert.match(sql, /"attempt_count" between 0 and 5/);
  assert.match(sql, /official_submission_delivery_receipts_provider_receipt_unique/);
  assert.match(sql, /official_submission_delivery_receipts_outbox_scope_fk/);
  assert.match(sql, /"from_status" = 'pending_submission' and "school_application_status_events"\."to_status" = 'new'/);
  assert.match(sql, /"status" = 'pending_submission' and "school_applications"\."submitted_at" is null/);
  assert.ok(sql.indexOf("official_submission_outbox_delivery_scope_unique")
    < sql.indexOf("official_submission_delivery_receipts_outbox_scope_fk"));
  assert.doesNotMatch(sql, /hmac_secret|access_key|credential|plaintext|snapshot_payload|delivery_package/i);
  assert.equal(journal.entries.find(entry => entry.tag === "0036_official_submission_delivery").idx, 36);
});

test("PostgreSQL migration 0037 adds a deduplicated payment inbox and closed settlement lifecycle", async () => {
  const [sql, journalText] = await Promise.all([
    readFile(paymentProviderReconciliationMigrationPath, "utf8"),
    readFile(journalPath, "utf8"),
  ]);
  const journal = JSON.parse(journalText);
  assert.match(sql, /CREATE TABLE "payment_provider_events"/);
  assert.match(sql, /payment_provider_events_provider_event_unique[^;]+\("provider","provider_event_id"\)/);
  assert.match(sql, /"event_type" in \('payment\.succeeded','payment\.canceled','payment\.refunded'\)/);
  assert.match(sql, /"state" = 'pending'/);
  assert.match(sql, /"state" = 'processed'/);
  assert.match(sql, /"state" = 'quarantined'/);
  assert.match(sql, /payments_provider_payment_unique/);
  assert.match(sql, /payments_invoice_unique[^;]+\("invoice_id"\)/);
  assert.match(sql, /payments_lifecycle_check/);
  assert.match(sql, /invoices_lifecycle_check/);
  assert.match(sql, /ADD COLUMN "refunded_at"/);
  assert.doesNotMatch(sql, /raw_payload|card_number|cvv|cvc|bank_account|payment_token|hmac_secret/i);
  assert.equal(journal.entries.find(entry => entry.tag === "0037_payment_provider_reconciliation").idx, 37);
});

test("PostgreSQL migration 0038 adds expiring session-bound step-up without persistent elevated strength", async () => {
  const [sql, journalText] = await Promise.all([
    readFile(authSessionStepUpMigrationPath, "utf8"),
    readFile(journalPath, "utf8"),
  ]);
  const journal = JSON.parse(journalText);
  assert.match(sql, /ADD COLUMN "step_up_expires_at" timestamp with time zone/);
  assert.match(sql, /auth_sessions_step_up_expires_idx[^;]+\("user_id","step_up_expires_at"\)/);
  assert.match(sql, /auth_sessions_strength_check/);
  assert.match(sql, /"auth_strength" = 'session'/);
  assert.match(sql, /"step_up_expires_at" > "auth_sessions"\."created_at"/);
  assert.match(sql, /"step_up_expires_at" <= "auth_sessions"\."expires_at"/);
  assert.doesNotMatch(sql, /UPDATE|DELETE|INSERT|password_hash|session_token_hash|payment|agent_/i);
  assert.equal(journal.entries.find(entry => entry.tag === "0038_auth_session_step_up").idx, 38);
});

test("PostgreSQL migration 0039 backfills stable annual CUAC references without deriving internal IDs", async () => {
  const [sql, journalText] = await Promise.all([
    readFile(cuacApplicationReferenceMigrationPath, "utf8"),
    readFile(journalPath, "utf8"),
  ]);
  const journal = JSON.parse(journalText);
  assert.match(sql, /CREATE TABLE "application_reference_counters"/);
  assert.match(sql, /row_number\(\) OVER/i);
  assert.match(sql, /PARTITION BY greatest\(2020, extract\(year from created_at at time zone 'UTC'\)/i);
  assert.match(sql, /ORDER BY created_at, id/i);
  assert.match(sql, /GENERATED ALWAYS AS \('CUAC-' \|\| lpad/);
  assert.match(sql, /UPDATE invoices invoice[\s\S]+SET cuac_id = application_set\.cuac_id/);
  assert.match(sql, /UPDATE school_applications school_application[\s\S]+SET cuac_id = application_set\.cuac_id/);
  assert.match(sql, /application_sets_cuac_id_unique/);
  assert.ok(sql.indexOf("application_sets_id_cuac_id_unique") < sql.indexOf("school_applications_cuac_scope_fk"));
  assert.match(sql, /FOREIGN KEY \("application_set_id","cuac_id"\)/);
  assert.match(sql, /REFERENCES "public"\."application_sets"\("id","cuac_id"\) ON DELETE cascade/);
  assert.match(sql, /school_applications_v2_cuac_id_required_check/);
  assert.match(sql, /application_record_format" = 'cuac\.program-application\.v1' or "school_applications"\."cuac_id" is not null/);
  assert.match(sql, /school_applications_cuac_id_check/);
  assert.doesNotMatch(sql, /substring\([^)]*\bid\b|replace\([^)]*\bid\b|CREATE TRIGGER|CREATE OR REPLACE FUNCTION/i);
  assert.equal(journal.entries.find(entry => entry.tag === "0039_cuac_application_reference").idx, 39);
});

test("PostgreSQL migration 0040 fail-closes CUAC staff authority without rewriting grants", async () => {
  const [sql, journalText] = await Promise.all([
    readFile(opsAccessAndApplicationSupportMigrationPath, "utf8"),
    readFile(journalPath, "utf8"),
  ]);
  const journal = JSON.parse(journalText);
  assert.match(sql, /LOCK TABLE "cuac_staff_access_grants" IN SHARE ROW EXCLUSIVE MODE/);
  assert.match(sql, /Existing CUAC staff access grants require reviewed lifecycle reconciliation/);
  assert.match(sql, /Existing CUAC staff access grants contain duplicate active role authority/);
  assert.match(sql, /cuac_staff_access_grants_authority_lookup_idx/);
  assert.match(sql, /cuac_staff_access_grants_active_user_role_unique[^;]+WHERE[^;]+"status" = 'approved'/s);
  assert.match(sql, /cuac_staff_access_grants_surface_check/);
  assert.match(sql, /cuac_staff_access_grants_role_check/);
  assert.match(sql, /cuac_staff_access_grants_status_check/);
  assert.match(sql, /cuac_staff_access_grants_email_check/);
  assert.match(sql, /cuac_staff_access_grants_token_hash_check/);
  assert.match(sql, /cuac_staff_access_grants_approved_lifecycle_check/);
  assert.match(sql, /"reason" is not null/i);
  assert.doesNotMatch(sql, /^\s*(?:INSERT INTO|UPDATE|DELETE FROM)\b/im);
  assert.doesNotMatch(sql, /password_hash|session_token_hash|payment|agent_/i);
  assert.equal(journal.entries.find(entry => entry.tag === "0040_ops_access_and_application_support").idx, 40);
});

test("PostgreSQL migration 0041 adds only grant-bound time-limited Ops support sessions", async () => {
  const [sql, journalText] = await Promise.all([
    readFile(opsSupportAccessSessionMigrationPath, "utf8"),
    readFile(journalPath, "utf8"),
  ]);
  const journal = JSON.parse(journalText);
  assert.match(sql, /CREATE TABLE "ops_support_access_sessions"/);
  assert.match(sql, /ops_support_access_sessions_grant_scope_fk/);
  assert.match(sql, /FOREIGN KEY \("staff_access_grant_id","actor_user_id","active_role"\)/);
  assert.match(sql, /ops_support_access_sessions_application_scope_fk/);
  assert.match(sql, /FOREIGN KEY \("application_set_id","cuac_id"\)/);
  assert.match(sql, /expires_at" > [^;]+created_at" \+ interval '15 minutes'/s);
  assert.match(sql, /reason_code" in \([\s\S]*'incident_response'/);
  assert.ok(sql.indexOf("cuac_staff_access_grants_id_user_role_unique")
    < sql.indexOf("ops_support_access_sessions_grant_scope_fk"));
  assert.doesNotMatch(sql, /^\s*(?:INSERT INTO|UPDATE|DELETE FROM)\b/im);
  assert.doesNotMatch(
    sql,
    /"(?:student_profiles|student_applicant_profiles|application_material_snapshots|invoices|payments|agent_[^"]*)"/i,
  );
  assert.equal(journal.entries.find(entry => entry.tag === "0041_ops_support_access_session").idx, 41);
});
