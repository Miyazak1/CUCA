# CUAC PostgreSQL Migration Runbook

Status: operational runbook for local, staging, and production PostgreSQL migrations.

Last updated: 2026-09-01

## 1. Purpose

This runbook defines how CUAC applies PostgreSQL schema migrations safely as the product moves from demo to production.

The production database is PostgreSQL. For Alibaba Cloud deployment, the expected production database is Alibaba Cloud RDS for PostgreSQL.

This runbook intentionally does not cover demo D1/SQLite schema files. Those are not authoritative for production data.

## 2. Core Rules

- Every schema change must be represented as a migration under `frontend/drizzle/pg`.
- Preserve reviewed historical SQL, journal entries and snapshots byte-for-byte. Generate new migrations with `db:pg:generate`, review them, then pass `db:pg:schema:check` and real PostgreSQL rehearsal.
- Serialize migration generation and deployment jobs. Database execution has a transaction-scoped advisory lock, ledger table lock and exact applied-prefix/hash checks. Local content-addressed packaging and non-root/read-only Linux runtime are verified; generation locking, trusted CI provenance, actual cloud runtime enforcement, production orchestration and RDS rehearsal remain gates.
- Migrations must run in staging before production.
- Production migrations require a reviewed runbook and explicit environment flags.
- Destructive migrations require a fresh backup, explicit approval, and a rollback/restore plan.
- Migrations must not read frontend demo/static data.
- Seed/import jobs are separate from schema migrations.
- Payment credential columns must never be added.
- Agent execution, raw transcripts, and private vector indexes must not be introduced by Phase 0/1 migrations.

## 3. Commands

Run from `frontend`.

Generate a new migration after editing the domain schema (does not connect or apply SQL):

```bash
npm run db:pg:generate -- --name=domain_change
```

Check schema, snapshots, journal, historical hashes and pinned tools without connecting or writing:

```bash
npm run db:pg:schema:check
```

Use the generation wrapper, not the native CLI directly: it preserves historical entries and ensures the next migration cursor strictly increases even when an existing journal timestamp is ahead of the clock. See [schema baseline contract](CUAC_POSTGRES_SCHEMA_BASELINE_CONTRACT.md) for the reviewed checkpoint, failure handling and limits.

Check migration environment without connecting:

```bash
npm run db:pg:check
```

Run migrations:

```bash
npm run db:pg:migrate
```

The source-workspace migration CLI runs artifact checks after environment validation and before connecting. That source CLI requires matching schema, SQL, snapshots, baseline and pinned Drizzle Kit/ORM. The packaged release below performs schema checks at build time and needs only its pinned runtime dependencies when applying. The API never needs the generator or migration credentials. `db:pg:check` is an environment check, not a schema check.

Build a migration release locally or in the reviewed build job:

```bash
npm run db:pg:release
```

This produces `releases/postgres/<manifest SHA-256>/` without connecting to a database. It uses an approved offline npm cache with install scripts disabled. The standalone entry supports `--verify-only` and `--apply`, each followed by `--manifest-sha256=<expected digest>`. Deployment must supply that digest from protected records, validate the bootstrap externally, and mount the exact artifact read-only; the artifact's own hash file is not a trusted signature. See [release artifact contract](CUAC_POSTGRES_RELEASE_ARTIFACT_CONTRACT.md) for invocation, Node version, environment and trust requirements. Never rebuild dependencies on the database host or substitute a different source checkout after staging approval.

The execution runner uses Drizzle's file parser but replaces the last-row-only execution decision with a full ledger prefix check. Lock acquisition, ledger checks, pending SQL, ledger inserts and final verification run on one connection in one transaction. The transaction fixes `search_path` to `public, pg_temp`, independent of role/URL defaults. It returns `appliedBefore`, `appliedNow` and `appliedTotal`; a verified replay reports zero newly applied migrations. No application instance should run this at startup.

Lock contention fails without automatic retry. The dedicated migration pool has one connection and a 10-second connection timeout; transaction-local statement, ordinary lock and idle-in-transaction limits are 60, 5 and 60 seconds respectively. Review large-table migration strategies rather than silently bypassing these bounds. See [the execution contract](CUAC_POSTGRES_SCHEMA_BASELINE_CONTRACT.md) for supported SQL, failure handling and limits.

Run the separate local Linux runtime gate with the reviewed Node base image already cached:

```bash
npm run db:linux:rehearse
```

This gate copies the release into a disposable image with an external trusted launcher. Six scenarios (seven tests including the parent) check non-root/read-only execution, isolated networking, offline verification, non-superuser migration/replay, SIGTERM while waiting for a lock, redacted failures and a replaced bootstrap. It does not target RDS, publish an image or approve production. BuildKit uses empty Docker configuration; runtime jobs have no repository/socket mounts. The database-only loopback control network is test infrastructure, not an Agent network design. See [Linux runtime contract](CUAC_POSTGRES_LINUX_RUNTIME_CONTRACT.md) for exact pins, trust assumptions, cleanup and cloud gates.

Run production readiness check:

```bash
npm run infra:production-check
```

Enable hard production readiness failure in CI/deployment:

```bash
CUAC_REQUIRE_PRODUCTION_READY=true npm run infra:production-check
```

## 4. Required Environment Variables

Database URL:

- `DATABASE_URL`, `POSTGRES_URL`, or `PG_DATABASE_URL`

Migration target:

- `CUAC_MIGRATION_TARGET_ENV=development`
- `CUAC_MIGRATION_TARGET_ENV=staging`
- `CUAC_MIGRATION_TARGET_ENV=production`

PostgreSQL SSL:

- `PGSSLMODE=verify-full` is mandatory for Alibaba Cloud staging and production so both the certificate chain and hostname are verified.
- `PGSSLMODE=require`, `verify-ca`, `prefer`, and `no-verify` are not accepted for staging or production migrations.
- `PGSSLMODE=disable` is limited to local development. A private network complements TLS but does not replace peer verification.
- Keep `DATABASE_URL`, `POSTGRES_URL`, and `PG_DATABASE_URL` free of query parameters and fragments. Driver-level URL options can override separately reviewed TLS, host, identity, and session configuration and are rejected before connection.

Production-only approval:

- `CUAC_ALLOW_PRODUCTION_MIGRATION=true`
- `CUAC_MIGRATION_RUNBOOK_ACK=true`

Production readiness variables are checked separately by `npm run infra:production-check`, including Alibaba Cloud region/runtime, session secret, Agent sandbox, Billing fee schedule, payment provider, KMS/secret manager, and OSS private bucket posture.

## 5. Local Development Migration

### Disposable Rehearsal

Run `npm run db:pg:rehearse` from `frontend` for a self-contained local PostgreSQL rehearsal. It requires a running local Docker engine and a cached `postgres:16-alpine` image, pins that run to its local image ID, creates a loopback-only disposable database with synthetic fixtures, and removes its container afterward. It never uses application `DATABASE_URL` or a remote Docker context.

The current rehearsal exercises all journal migrations twice, seed import replay, public catalog queries, invite replacement/revocation, concurrent invite creation/acceptance, failed-write rollback, and the pending-invite unique index. See [the 2026-08-31 rehearsal record](CUAC_POSTGRES_REHEARSAL_REPORT.md). This does not replace staging RDS rehearsal, a restore drill, or full API/tenant integration tests.

The extended rehearsal covers identity/tenant isolation, Auth/Agent transactions, owner-scoped pending-candidate capacity, memory controls and finite retention, application command recovery, versioned draft editing/ordering, intake binding, applicant/education/assessment data, governed requirements/notices, material selection/preview, exact per-program authorization/snapshots/policy/Billing evidence, and `0030` atomic Program Application acceptance plus policy-driven transport grouping. The current `db:http:rehearse` run passes 477/477 against 33 migrations and includes the complete PostgreSQL and built-network suites; the dedicated PostgreSQL entry passes 379/379 and overlaps. The ORM-derived shadow schema matches 58 tables, 864 columns, 310 constraints and 210 indexes. Preflight remains `canSubmit=false`; the internal accepted submission and pending outbox do not mean school delivery. See the [canonical rehearsal record](CUAC_POSTGRES_REHEARSAL_REPORT.md), [candidate capacity contract](CUAC_AGENT_CANDIDATE_CAPACITY_CONTRACT.md), [memory retention contract](CUAC_AGENT_MEMORY_RETENTION_CONTRACT.md) and [atomic submission contract](CUAC_ATOMIC_APPLICATION_SUBMISSION_CONTRACT.md). Real notices/legal approval, launch route/price publications, public submit, live payment/provider/refund, outbox worker, production memory scheduling/backup deletion, cloud/browser verification and remaining external integrations stay gated.

### Persistent Development Database

Use local migration only for disposable development data.

Steps:

1. Set `CUAC_MIGRATION_TARGET_ENV=development`.
2. Set a local `DATABASE_URL` pointing to a local PostgreSQL database.
3. Run `npm run db:pg:schema:check` and `npm run db:pg:check`.
4. Confirm warnings are acceptable for local development.
5. Run `npm run db:pg:migrate`.
6. Run `npm run test:server`.

Local development may use localhost. Staging and production may not.

## 6. Staging RDS Rehearsal

Staging is the required rehearsal environment before production.

Prerequisites:

- Alibaba Cloud RDS PostgreSQL staging instance exists.
- Staging credentials are stored in secret management, not in source files.
- `CUAC_MIGRATION_TARGET_ENV=staging` is set.
- Database URL points to the staging RDS endpoint, not localhost.
- `PGSSLMODE=verify-full` is set and the trusted CA path has been validated against the intended RDS endpoint.
- Current branch has passed server tests, lint, typecheck, and build.
- The reviewed build passes schema and disposable release rehearsal; the exact packaged digest and runtime dependencies are verified. Build tools are not required on the database host.
- Catalog seed/import plan has been reviewed separately if seed data will be imported.

Steps:

1. In the reviewed build environment, run `npm run db:pg:schema:check`, build the release and pass local release rehearsal. On the target, verify the protected digest and review the migration environment.
2. Resolve every blocker before connecting.
3. Review the migration files in `frontend/drizzle/pg`.
4. Confirm the migration order matches `frontend/drizzle/pg/meta/_journal.json`.
5. Run the approved release's `run.mjs --apply --manifest-sha256=<expected digest>` as a single restricted migration job.
6. Run health/API smoke checks against staging.
7. Run catalog seed dry-run if catalog import is part of the rehearsal.
8. Capture migration output and staging smoke-test evidence.

Exit criteria:

- Migrations complete without error.
- Staging health endpoint is OK.
- Public catalog APIs do not expose private data.
- Auth/session checks still ignore client-supplied authority.
- Student/school/Agent/Billing security tests remain green.
- Any seed/import operation is idempotent.

## 7. Production Migration

Production migrations are allowed only after staging rehearsal passes.

Prerequisites:

- Staging migration rehearsal has passed for the same migration set.
- A single deployment migration job is enforced and the locally verified execution locks/ledger checks have also passed against the intended RDS environment. Local tests do not close production orchestration, restricted-role, TLS or restore gates; approval flags do not replace them.
- Production backup or point-in-time recovery is confirmed.
- Rollback/restore owner is identified.
- Expected downtime is zero or explicitly approved.
- The migration is backward-compatible, or the release plan handles old and new app versions safely.
- `CUAC_MIGRATION_TARGET_ENV=production` is set.
- `CUAC_ALLOW_PRODUCTION_MIGRATION=true` is set.
- `CUAC_MIGRATION_RUNBOOK_ACK=true` is set after reviewing this document.
- Production database URL points to Alibaba Cloud RDS PostgreSQL, not localhost.
- Verified TLS is configured with `PGSSLMODE=verify-full`; private-network placement is an additional control, not a bypass.
- Production readiness check has no failures when run with `CUAC_REQUIRE_PRODUCTION_READY=true`.

Steps:

1. Announce the migration window to the project owner and operator.
2. Confirm the latest production backup or PITR restore point.
3. Run `npm run infra:production-check` with `CUAC_REQUIRE_PRODUCTION_READY=true`.
4. Verify the same packaged digest accepted in staging, its external provenance, Node version, read-only mount and migration environment. Schema checks must already have passed in the reviewed build job.
5. Confirm `blockers` is empty.
6. Run that exact release's `run.mjs --apply --manifest-sha256=<expected digest>` as the approved restricted job.
7. Run production health/API smoke checks.
8. Monitor errors, database health, and application logs.
9. Record the migration result, timestamp, release manifest digest, application/runbook versions, operator and recovery point.

Exit criteria:

- Migrations complete without error.
- Production health endpoint is OK.
- No spike in auth, catalog, student, school, Agent, or Billing errors.
- Audit logging remains available.
- Rollback/restore is not required, or if required, the incident process is opened immediately.

## 8. Rollback And Recovery

Preferred migration strategy is forward-only and backward-compatible.

Use rollback/restore only when a migration causes production-impacting failure.

Recovery options:

- deploy an application hotfix compatible with the migrated schema;
- apply a forward corrective migration;
- restore from RDS backup/PITR if data integrity is at risk.

Before destructive schema changes:

- capture backup/PITR evidence;
- document affected tables;
- document data loss risk;
- get explicit approval;
- rehearse in staging;
- verify restore time.

### Contention, Divergence And Uncertain Commit

If another migration owns the advisory lock, inspect that job before an explicit retry; do not kill an unknown database session. A conflicting ledger table lock also fails immediately. An altered, missing-middle, duplicate or unknown ledger row stops execution before pending SQL. Never repair the ledger automatically, change a stored hash to match modified SQL, or delete records to force re-execution.

If the connection disappears, the migration may or may not have committed. Preserve the exact release artifacts and retry only after inspection: the runner acquires its lock and verifies the entire recorded prefix again. A completed batch becomes a no-op; an uncommitted batch is applied again transactionally. The local tests include a real connection termination and a synthetic lost acknowledgement after real COMMIT. They do not establish RDS failover/restore behavior.

An empty/missing ledger with existing public relations is rejected, not adopted. A valid recorded prefix alone cannot reveal a completely deleted suffix or prove live schema/data integrity; compare protected deployment records and the intended recovery point before accepting a restored or manually changed database.

## 9. Must Not Do

Do not:

- run production migrations without staging rehearsal;
- run production migrations without `CUAC_ALLOW_PRODUCTION_MIGRATION=true`;
- run production migrations without `CUAC_MIGRATION_RUNBOOK_ACK=true`;
- point staging/production migrations at localhost;
- store database credentials in repo files;
- use frontend demo D1/SQLite schema as production authority;
- add raw card, CVV/CVC, bank account, routing number, or payment token columns;
- add Agent direct database execution tables in Phase 0/1;
- combine catalog seed import with schema migration unless explicitly planned and rehearsed.
- reformat historical migration files, rewrite historical timestamps, bypass failed baseline checks or regenerate the manifest merely to accept drift;
- run migration jobs concurrently or run them independently from every application instance at startup.
- put transaction-control statements, ledger edits, external effects or nontransactional operations such as `CREATE INDEX CONCURRENTLY` into this transactional runner; those require a separately designed and rehearsed workflow.

## 10. Current Migration Set

Current PostgreSQL migration folder:

```text
frontend/drizzle/pg
```

Current migration families:

- foundation identity, tenant, audit, and catalog;
- student application core;
- Agent context lifecycle foundation;
- Billing business-state foundation.
- Auth email verification, password reset, and rate-limit foundations;
- school invite pending-school/email uniqueness (`0007_school_invite_pending_unique.sql`).
- application ownership and school routing integrity (`0008_application_scope_integrity.sql`).
- Agent source-candidate uniqueness, including cleared memories (`0009_agent_memory_confirmation_unique.sql`).
- Student memory settings/reset cutoff and candidate payload-cleanup metadata (`0010_agent_memory_controls.sql`).
- Student application command receipts and account/operation/key uniqueness (`0011_student_application_commands.sql`).
- Positive application-set revision with default 1 (`0012_application_draft_revision.sql`).
- Nullable intake-bound draft target, composite scope and active-target uniqueness (`0013_application_choice_intake.sql`).
- Independent owner-scoped applicant basics and positive revision (`0014_student_applicant_profiles.sql`); no automatic copying from account/profile/memory.
- Multiple owner-only education records and a separate collection revision (`0015_student_education_history.sql`); add/edit/remove share the same lock/version protocol and metadata-only audit.
- Exact-intake requirement versions and explicit publication pointers (`0016_program_requirements.sql`); public reads are information-only and do not enable public writes or eligibility decisions.
- Content-bound requirement review governance (`0017_requirement_review_governance.sql`): preparer and structured review evidence, with independent approval and revision-guarded publish/withdraw in an internal service only.
- Private student assessment records (`0018_student_assessment_history.sql`): independent collection revision and owner-scoped raw self-reported score components; removal erases report content without reusing IDs or versions.
- Notice version registry (`0019_privacy_notice_versions.sql`): three initially empty scope/version/publication tables; independent internal approval, digest-bound CAS publication/withdrawal and exact-locale public read. No legacy flag becomes notice or consent.
- Exact school-application target identity (`0020_school_application_target_identity.sql`) and positive Agent memory-control revision (`0021_student_memory_control_revision.sql`).
- Owner-only material-selection metadata (`0022_application_material_selection.sql`) and encrypted Auth email outbox (`0023_auth_email_outbox.sql`).
- Per-program disclosure authorization evidence (`0024_application_submission_authorization.sql`) and one authenticated encrypted material snapshot per authorization (`0025_application_material_snapshot.sql`).
- Route-explicit reviewed official-submission policy versions, exact targets and CAS publication pointers (`0026_official_submission_policy.sql`); no default route, policy seed, group or submit record.
- Explicit nullable choice route, controlled value constraint and partial lookup index (`0027_application_choice_admission_route.sql`); no default, backfill, inference, group or submit record.
- Policy-bound authorization v2 (`0028_application_policy_bound_authorization.sql`): complete format/route/policy evidence, exact version-target FK and mixed-writer fence; no inferred v1 backfill, group, fee or submit record.

Before applying `0007` to an existing database, inspect duplicate pending invites under the approved data-access procedure. Duplicate `(school_id, email_normalized)` rows with `status = 'pending'`, `accepted_at is null`, and `revoked_at is null` block the unique index. Review and resolve them explicitly; this migration never deletes or silently revokes invitations. Rehearse the same migration set before production.

Before applying `0008`, review any mismatches between application choices and their set owner, program and school, or school applications and their source choice/set/student/school. The migration rejects inconsistent existing rows. It must not be bypassed or replaced with an automatic reassignment of student or tenant IDs. The composite constraints preserve the existing program `SET NULL` and student deletion cascade semantics, verified locally.

Before applying `0009`, inspect duplicate non-null `agent_memory_entries.source_candidate_id` values under the approved access procedure. The index intentionally includes cleared entries. Historical duplicates make migration fail; do not silently delete memory, ignore the error or change ownership. The existing source foreign key still uses SET NULL on candidate deletion, so future cleanup must review both source retention and deduplication. This migration does not enable production memory. The hand-written increments through `0011` are now reconciled with the latest snapshot; each future migration must pass the same artifact and real-schema checks.

Migration `0010` only adds settings and cleanup metadata/index; it does not erase historical content or enable a scheduler. Verify application/runtime and migration deployment order before enabling memory controls. Memory clear and maintenance functions must run with their same-connection audit transactions. Historical malformed ownership/namespace data requires an approved remediation procedure; routine user controls must not rewrite another person's rows. Confirm retention, backup/WAL obligations, quotas and worker operation before production. See [memory management contract](CUAC_AGENT_MEMORY_MANAGEMENT_CONTRACT.md).

Migration `0011` adds a new receipt table only. Apply it before the new keyed application endpoints are deployed; no historical application is automatically assigned a receipt. Resource deletion must not delete its receipt and allow a late retry to recreate it. Restore receipts and business tables from a consistent recovery point; do not roll back to a server that ignores keys while accepting unresolved requests. Retention/quotas and Alibaba Cloud failure/restore drills remain production gates. See [application idempotency contract](CUAC_APPLICATION_IDEMPOTENCY_CONTRACT.md).

Migration `0012` adds application_sets.revision; existing rows become version 1 without changing their status, lock markers or choices. Apply the migration before deploying version-aware writers. Drain every old instance and script that mutates drafts without advancing revision before enabling PATCH/PUT editing or ordering. Schema compatibility alone does not permit mixed old/new writers. All controlled add/remove/edit/order commands must lock the parent and advance revision on an actual change. Rollback requires pausing affected writes and retaining the new column; do not return to an old writer while the new endpoints are live or reset stored versions. The local nonempty-upgrade test covers draft/submitted/archived sets and choices; staging lock budgets, backup/restore and rollout approval are still required.

Migration `0013` adds nullable program_intake_id without guessing targets for old choices. It creates the referenced composite unique index before its foreign key, then distinguishes active bound and unbound program targets. Bound intake/program deletion or reassignment is restricted, including removed choices; retire catalog entries instead of losing identity. Deploy the schema and every intake-aware reader/writer before exposing the new field; drain old instances that would reject/drop it or use the old digest. After bound choices exist, do not reinstate the old program-only unique index or roll back writers while accepting traffic. Preserve columns, bindings and receipts, pause writes and review recovery. Local tests retain populated choices/sets/receipts and replay an independently constructed v1 receipt; production lock budgets, deletion/retention and actual rollback remain gates.

Migration `0014` creates student_applicant_profiles without copying account, preference or Agent values. Enable the new owner-only GET/PATCH only after migration. It does not change login identity, old application revisions or command receipts. Rollback disables these routes and retains the new table/data; do not drop it to silence an older deployment. New profile revision is not a submission snapshot or approved consent. See [applicant contract](CUAC_APPLICANT_PROFILE_AND_CONSENT_CONTRACT.md).

Migration `0015` creates student_education_histories and student_education_records without backfilling any academic attainment from preferences. The populated upgrade compares all old public tables and leaves both new tables empty. Deploy this migration before enabling the four education API exports. Every writer must use the collection lock/revision protocol; removal erases the nine content fields but retains the record identity and header version. Rollback disables the new endpoints and retains data/tables; never reset the revision or drop tables. No school/Agent disclosure or consent is implied. See [education contract](CUAC_EDUCATION_HISTORY_CONTRACT.md).

Migration `0016` creates program_requirement_versions and program_requirement_publications without inferring requirements, approval or publication from legacy catalog text/is_verified. Deploy it before the new public GET; absent/withdrawn/expired pointers return no requirement document, with no older-version fallback. The populated upgrade leaves both new tables empty and preserves all old public rows and receipt recovery. Approver references use ON DELETE RESTRICT: an account referenced as approval evidence cannot be hard-deleted without a separately approved retention/reconciliation workflow; ordinary student deletion behavior is unchanged. Rollback disables the read endpoint and preserves versions, pointers and revisions. Do not seed real approved rules by ad hoc SQL: the controlled internal workflow is now implemented under 0017, while real-source authority and production Ops identity/access remain gated. The content hash is not an authenticity proof or immutable-write control. See [requirements contract](CUAC_PROGRAM_REQUIREMENTS_CONTRACT.md).

Migration `0017` adds nullable prepared_by_user_id and review_evidence_json, a preparer RESTRICT reference and governance check. It does not fill in identities or endorse legacy approvals. The new reader excludes legacy rows lacking managed evidence; altered published evidence fails closed. Before upgrading an existing endpoint, pause requirement reads, apply the migration, deploy and drain all old readers/writers, then re-enable only the new gate. Old 0016 readers do not enforce evidence binding, so rolling back to them while serving reads is unsafe even though the added columns are nullable. Rollback pauses the endpoint and preserves schema/data. The internal service is not an Ops HTTP interface, source importer or permission to run direct SQL. See [governance contract](CUAC_PROGRAM_REQUIREMENT_GOVERNANCE_CONTRACT.md).

Migration `0018` creates student_assessment_histories and student_assessment_records. Both remain empty on upgrade; legacy preferences, education data and catalog text cannot establish exam identity, scores or official verification. Owner-scoped commands lock the live account/role and collection revision; audit failure rolls back the record, header and erasure together. Staging must rehearse the populated upgrade and new routes before activation. Application rollback disables the new assessment routes and retains their tables, revisions and removal markers; do not drop newly written private records or reuse revisions to simulate rollback. Existing requirement-reader and draft-writer rollout restrictions still apply. See [assessment contract](CUAC_ASSESSMENT_RECORDS_CONTRACT.md).

Migration `0019` creates privacy_notice_scopes, privacy_notice_versions and privacy_notice_publications. The populated-upgrade gate compares all prior public tables, including legacy consent_summary_json, assessment data and v1/v2 receipts; the three new tables stay empty, and GET cannot manufacture consent. Apply the migration before deploying the new read route. Only reviewed real text may later be published through authorized internal services; real employee/MFA admission, applicable applicant ages, recipients and retention still require approval. Application rollback disables the new notice route and retains the tables and historical review evidence. Do not drop versions or synthesize approvals to restore service. This does not implement student consent or formal submit. See [notice contract](CUAC_NOTICE_PUBLICATION_CONTRACT.md).

Migration `0020` first locks both application tables and rejects any existing school-application/choice program mismatch, including one-sided null, without automatic correction. It adds the school's intake reference, copies only the already linked choice intake, and enforces exact program/intake identity through non-null generated keys and a composite FK. All preexisting fields and receipts remain unchanged. Existing school applications now prevent deleting the referenced program. Pause/drain all affected writers before upgrade; old scripts that omit a known intake must not continue. Rehearse table-rewrite/index/WAL/lock budgets on actual staging data. Rollback disables affected routes and retains columns, keys and constraints; never remove the FK or repair legacy targets by guessing. See [target identity contract](CUAC_APPLICATION_TARGET_IDENTITY_CONTRACT.md). The subsequent owner-only material-preview API adds no schema change; its content digest is not part of the migration artifact or a consent token. That preview change did not alter migration history. The subsequent 0021 migration only adds a positive settings revision; preserve the sealed 0000..0020 bytes. Pause/drain old memory writers, apply 0021, deploy all version/quota/role-lock-aware control and confirmation services, then restore approved endpoints. Do not mix old writers or roll back to bypassing versions; retain the column and disable writes during rollback. See [memory management contract](CUAC_AGENT_MEMORY_MANAGEMENT_CONTRACT.md).

The current baseline has 33 SQL migrations and twenty-four snapshots (`0000`, `0001`, `0011` through `0032`). Existing journal entries and historical SQL bytes remain unchanged. The reviewed manifest now covers through index 32, appending only each reviewed journal entry and SQL/snapshot hash while preserving prior entries and tool versions. That offline manifest is separate from the lock-protected live-ledger prefix/hash check. Both are locally verified, not proof that an Alibaba Cloud database has passed acceptance. See [schema baseline contract](CUAC_POSTGRES_SCHEMA_BASELINE_CONTRACT.md).

Still deferred:

- full Agent execution;
- raw Agent transcript storage;
- live payment provider webhooks;
- refunds;
- file uploads;
- school portal full write workflows;
- Ops Admin write APIs.

### Per-Choice Material Selection Rollout (0022)

Owner-only per-choice material selection drafts are now locally verified: migration 0022 stores only explicit field/record references, four source versions and an independent CAS revision. Clearing preserves the revision; source changes/removal require explicit review; choice removal atomically deletes the associated selection. Six regular, fifteen business-database, one populated-upgrade and six real-network cases cover isolation, races, audit rollback and corruption rejection. This is not consent or a material snapshot and grants no Agent/school access. See [material selection contract](CUAC_APPLICATION_MATERIAL_SELECTION_CONTRACT.md).

Pause and drain old choice-removal writers before migrating, then switch selection/removal services together. Old removal code cannot clear the new dependent selection. Rollback disables affected writes and retains rows/revisions/constraints; do not drop the table or restore a writer that leaves stale selections. The upgrade from the nonempty 22-migration prefix preserves every previous column and receipt and creates no selections automatically. Retention, account deletion, frontend consent UX and production authorization remain separate gates.

### Auth Email Outbox Rollout (0023)

Auth verification/reset outbox is locally verified (BE-0718): migration 0023 adds encrypted short-lived token transport, owner-bound challenge FKs, committed-job leases, pre-send identity checks, bounded explicit-nonacceptance retries and uncertain-result quarantine. Challenge/enqueue/success audit share one transaction; terminal jobs erase ciphertext. Nineteen business-database cases, one nonempty upgrade and seven regular cases cover tampering, missing keys, rollback, concurrency, expiry and lost acknowledgements. This is not provider acceptance of real mail: the runtime remains deferred unless explicitly configured; no provider, scheduler, frontend action page or Agent access is enabled. See [auth email outbox contract](CUAC_AUTH_EMAIL_OUTBOX_CONTRACT.md).

### Per-Program Submission Authorization Rollout (0024)

Pause and drain application choice/material-selection/authorization writers before applying `0024`, then deploy the new authorization service, choice-removal integration and preflight reader together. The migration creates an empty evidence table and extends the command-receipt operation check; it never infers authorization for existing choices. Old code cannot end active evidence during choice removal and must not be mixed after the new table is in use. Rollback disables the new routes and affected writes while retaining rows, receipts and constraints. Do not drop evidence, rewrite history or treat a recorded authorization as a school receipt, billing entitlement or legal sufficiency. See [authorization contract](CUAC_APPLICATION_SUBMISSION_AUTHORIZATION_CONTRACT.md).

### Per-Program Material Snapshot Rollout (0025)

Pause and drain application choice/material-selection/authorization/snapshot writers before applying `0025`, then deploy the snapshot service, preflight snapshot reader and all sensitive application-command lock changes together. The migration creates an empty encrypted-evidence table and extends the command-receipt operation check; it never reconstructs material from existing authorizations. Composite target/authorization indexes are created before their foreign keys. Old code does not understand snapshot freshness or the new receipt operation and must not be mixed once snapshot creation begins.

Production must inject the active key and retained decryption keys from an approved KMS/secret path; never place key bytes in migration SQL, logs, shell history or repository env files. Rollback disables snapshot POST/GET and affected preflight readiness while retaining rows, receipts, key references and constraints; preserve all still-required old keys. Do not drop ciphertext, weaken authentication, expose plaintext to school/Agent/Ops, or treat a valid snapshot as payment, official submission or university receipt. See [snapshot contract](CUAC_APPLICATION_MATERIAL_SNAPSHOT_CONTRACT.md).

### Official Submission Policy Rollout (0026)

Pause any future internal policy writers before applying `0026`; none are currently exposed over HTTP. Apply the migration as an empty governance foundation, then deploy the internal prepare/approve/publish/withdraw service and minimal published-policy reader together. The upgrade must preserve all prior Auth, catalog, application, authorization and snapshot rows while leaving all three policy tables empty. Do not seed policy from catalog text, demo content, existing choices or school names, and do not invent a default `admission_route_key`.

Rollback of a 0026-only deployment disables the internal reader/governance wiring while retaining version, target, publication and audit evidence. Do not expose policy management/public HTTP, Agent access or create official-submission groups. The later reviewed `0027` deployment provides explicit choice-route and preflight integration; Billing, submit, payment and school writes remain separate later gates. See [official policy/group contract](CUAC_OFFICIAL_SUBMISSION_POLICY_AND_GROUP_CONTRACT.md).

### Application Choice Admission Route Rollout (0027)

Pause and drain application choice writers and preflight readers before applying `0027`, then deploy all route-aware choice create/edit/read code and the exact-policy preflight reader together. The migration adds only a nullable route column, CHECK and partial index. A populated through-0026 upgrade must preserve every old column, authorization, encrypted snapshot and policy publication while leaving all old route values null; never infer a route from school, catalog, scholarship, Agent content or demo state.

After route-aware writes begin, old writers/readers cannot share traffic: they may omit the new field, compute an older command digest or fail to invalidate revision-bound evidence. Rollback disables route writes and policy-aware preflight while retaining the new column and any explicit student choices; do not drop, default, mass-fill or silently reinterpret route values. At the `0027` checkpoint, formal submit remained closed pending grouping and Billing. The current `0030` baseline has internal atomic acceptance, while public submit and external school delivery remain closed. See [admission-route contract](CUAC_APPLICATION_ADMISSION_ROUTE_CONTRACT.md).

### Policy-Bound Authorization Rollout (0028)

Pause and drain application choice, authorization, snapshot and preflight writers/readers before applying `0028`, then deploy route/policy-aware authorization, snapshot and preflight code together. The migration first labels all existing authorization rows as `cuac.application-submission-authorization.v1`, adds nullable policy columns plus complete-shape CHECK/composite FK/index, then changes only the default for future rows to v2. It must not infer route or policy from current choices/publications and must not rewrite old scope digests or encrypted snapshot payloads.

This is also a mixed-version fence: an old authorization writer that omits policy fields after migration fails the v2 completeness CHECK. Do not run old and new writers concurrently. v1 authorization and snapshot evidence stays readable but is always non-current and cannot create a new snapshot. Students must explicitly review the current route/policy and create v2 evidence; only then may a new snapshot be created. The policy publication/version/selected-target rows are share-locked through authorization/snapshot commit so withdrawal cannot race between validation and evidence persistence.

Rollback disables new authorization/snapshot writes and policy-bound readiness while retaining every new column and all v1/v2 evidence. Do not drop policy fields/FKs, reset the default, reclassify v2 as v1, or backfill v1 from mutable current state. At the `0028` checkpoint, formal grouping, Billing entitlement and atomic submit were separate future gates; they are now implemented as internal-only foundations through `0030`, with public submit, provider payment and external delivery still disabled. See [policy-bound authorization contract](CUAC_APPLICATION_POLICY_BOUND_AUTHORIZATION_CONTRACT.md).

### Per-Project Billing Entitlement Rollout (0029)

Pause and drain Billing entitlement, application choice, authorization, snapshot and preflight writers/readers before applying `0029`, then deploy the entitlement service and Billing-aware preflight together. Existing authorizations and snapshots remain v1 evidence and are never upgraded from mutable application state. The migration changes only future evidence defaults and adds the project-scoped entitlement relation, constraints and indexes; an old writer that omits required v2 Billing fields is rejected by the completeness CHECK.

Rollback disables new entitlement writes and Billing-bound readiness while retaining every entitlement and evidence row. Do not reinterpret a fee quote, payment intent or provider event as entitlement. Real payment-provider APIs, webhooks, refunds and public submit remain separate disabled gates. See [Billing entitlement contract](CUAC_APPLICATION_BILLING_ENTITLEMENT_CONTRACT.md).

### Atomic Program Application Acceptance Rollout (0030)

Pause and drain application-set, choice, authorization, snapshot, Billing entitlement and school-application writers before applying `0030`, then deploy the internal submission service as one fleet change. The migration preserves through-`0029` rows as v1 evidence, creates empty submission/group/member/outbox tables and changes future Program Application evidence to v2. Old writers cannot satisfy the v2 completeness CHECK and must not share traffic after the switch.

Keep the public submit route and outbox worker disabled. An accepted submission and `pending` outbox row mean CUAC recorded one immutable student command; they do not mean payment-provider acceptance, school delivery or university receipt. Rollback disables the internal command while preserving receipts, Program Applications, grouping and outbox evidence. See [atomic submission contract](CUAC_ATOMIC_APPLICATION_SUBMISSION_CONTRACT.md).

### Auth Email Outbox Rollout (0023, Historical)

Apply the owner-unique challenge indexes before adding outbox composite FKs; the new reviewed SQL orders these dependencies explicitly. Existing challenges and all original table values remain unchanged, and the new table is empty: historical hash-only proofs are never reconstructed. Deploy the enqueue-only services with delivery disabled, then approve keys/provider/action pages and worker supervision separately. For rollback, stop the worker and new issuance configuration while preserving schema and queue evidence. Never blindly resend uncertain jobs or drop the encrypted queue to force a retry.
