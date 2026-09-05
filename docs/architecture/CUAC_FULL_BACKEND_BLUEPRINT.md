# CUAC Full Backend Blueprint

Status: Phase 0/1 startup blueprint, ready for backend implementation planning.

Last updated: 2026-09-01

Execution status: Phase 0/1 backend foundation has started. Initial TypeScript server foundation modules and tests now exist under `frontend/src/server` and `frontend/tests/server`. PostgreSQL Drizzle schema and migrations now exist under `frontend/src/server/db/schema.ts`, `frontend/drizzle/pg/0000_solid_oracle.sql`, `frontend/drizzle/pg/0001_fixed_tempest.sql`, `frontend/drizzle/pg/0002_agent_context_foundation.sql`, `frontend/drizzle/pg/0003_billing_business_foundation.sql`, `frontend/drizzle/pg/0004_email_verification_foundation.sql`, `frontend/drizzle/pg/0005_password_reset_foundation.sql`, `frontend/drizzle/pg/0006_auth_rate_limit_foundation.sql`, `frontend/drizzle/pg/0007_school_invite_pending_unique.sql`, `frontend/drizzle/pg/0008_application_scope_integrity.sql`, `frontend/drizzle/pg/0009_agent_memory_confirmation_unique.sql`, `frontend/drizzle/pg/0010_agent_memory_controls.sql`, `frontend/drizzle/pg/0011_student_application_commands.sql`, `frontend/drizzle/pg/0012_application_draft_revision.sql`, `frontend/drizzle/pg/0013_application_choice_intake.sql`, `frontend/drizzle/pg/0014_student_applicant_profiles.sql`, `frontend/drizzle/pg/0015_student_education_history.sql`, `frontend/drizzle/pg/0016_program_requirements.sql`, `frontend/drizzle/pg/0017_requirement_review_governance.sql`, `frontend/drizzle/pg/0018_student_assessment_history.sql`, `frontend/drizzle/pg/0019_privacy_notice_versions.sql`, and `frontend/drizzle/pg/0020_school_application_target_identity.sql`. Health route, Auth session resolver, Auth credentials service/repository/HTTP contract, Auth logout/session revocation contract, Auth sign-in continuation service/repository/HTTP contract, Auth email verification challenge service/repository/HTTP contract, Auth password reset challenge service/repository/HTTP contract, school staff invite create/revoke/accept service/repository/HTTP contract, Auth email message composer, Auth email delivery readiness gate, Auth rate-limit action/key/service foundation, PostgreSQL Auth rate-limit store, Auth HTTP limiter injection points, Auth runtime limiter factory, active school membership resolver, `PostgresAuditWriter`, Agent context lifecycle service boundary, Agent context PostgreSQL repository boundary, Agent context audit sink integration, contract-only Agent context HTTP routes, `GET /api/v1/me`, `POST /api/v1/auth/register`, `POST /api/v1/auth/sessions`, `POST /api/v1/auth/logout`, `POST /api/v1/auth/sign-in-continuations`, `POST /api/v1/auth/sign-in-continuations/:continuationId/consume`, `POST /api/v1/auth/email-verification`, `POST /api/v1/auth/email-verification/:challengeId/verify`, `POST /api/v1/auth/password-reset`, `POST /api/v1/auth/password-reset/:challengeId/reset`, `POST /api/v1/auth/school-invites`, `POST /api/v1/auth/school-invites/:inviteId/revoke`, `POST /api/v1/auth/school-invites/:inviteId/accept`, student/application core schema, student ownership helper, student service boundary, student write-action audit integration, Billing Facade service contract, billing business-state schema, PostgreSQL Billing repository boundary, Billing runtime fee schedule gate, contract-only billing HTTP routes, PostgreSQL student repository, student HTTP route adapters, school portal projection service/repository, school portal read-projection audit integration, school portal HTTP route adapters, public catalog DTO mapper, service boundary, PostgreSQL repository boundary, thin HTTP handler factory, app API route files, PG runtime wiring, Alibaba Cloud env templates, migration runtime scripts, migration runbook, migration safety gate, production readiness check, catalog seed dry-run contract, ordered seed import plan generation, and idempotent seed writer now exist under `frontend/src/server`, `frontend/app/api/v1`, `frontend/scripts`, `frontend/config`, and `frontend/seeds`.

The current reviewed PostgreSQL chain now extends through `0032_agent_candidate_capacity`: 33 migrations, 24 snapshots and 58 tables. `0030` adds atomic internal acceptance and transport groups while preserving one `student + program + intake` application per choice. `0031` adds a 365-day database ceiling and bounded audited scrubber for confirmed low-sensitive student memory. `0032` adds owner-scoped active pending-candidate limits of 12 per verified guest browser and 24 per student account without enabling full Agent execution. Public submit, outbox delivery, live payment, school writes and full Agent execution remain closed.

Related documents:

- `CUAC_PRODUCTION_DELIVERY_PLAN_CN.md`
- [CUAC_ATOMIC_APPLICATION_SUBMISSION_CONTRACT.md](CUAC_ATOMIC_APPLICATION_SUBMISSION_CONTRACT.md): internal D2 acceptance, per-project Program Application identity, policy-driven groups, inert outbox and remaining public/provider/cloud gates.
- `CUAC_POSTGRES_REHEARSAL_REPORT.md`: current PostgreSQL 16.13 evidence covers 33 migrations, 24 snapshots, 58 tables, 523/523 regular tests, 477/477 PostgreSQL plus built HTTP and 7/7 Linux. It includes identity/tenant isolation, student application preparation and atomic internal acceptance, plus pending-candidate capacity, student-action memory controls, a 100-entry confirmed-memory cap and 365-day finite retention. Public submit, production scheduling, real providers, school/Ops writes, staging RDS, credentials, browser/cloud and restore drills remain open.
- `CUAC_APPLICATION_IDEMPOTENCY_CONTRACT.md`: migration `0011_student_application_commands.sql` and required keys on set/choice POSTs. Hashed account/operation-scoped receipts commit with business/audit, with current-resource replay, real concurrency and transport-loss tests. Auth/invitation recovery, frontend integration and receipt lifecycle/cloud gates remain open.
- `CUAC_HTTP_SECURITY_AND_GUEST_SESSION_CONTRACT.md`: shared Origin/JSON/cache boundary, signed guest bootstrap and rotation, logout, local evidence and explicit retention/revocation limitations. This is not full Agent enablement or production acceptance.
- `CUAC_STUDENT_AND_AGENT_INPUT_CONTRACT.md`: verified student PATCH/catalog/scholarship and study_goal field grammar. Auth DTOs, Agent atomic confirmation and memory control/sweep services are also locally verified; complete Agent/product lifecycle remains pending.
- `CUAC_POSTGRES_MIGRATION_RUNBOOK.md`
- [CUAC_POSTGRES_SCHEMA_BASELINE_CONTRACT.md](CUAC_POSTGRES_SCHEMA_BASELINE_CONTRACT.md): 33 migrations, twenty-four snapshots and 58 tables reconciled through 0032. Previous SQL/journal/hash entries are unchanged. Guarded generation/preflight, transactional locks, ledger checks, populated historical upgrades and transport recovery are locally verified.
- [CUAC_AGENT_CANDIDATE_CAPACITY_CONTRACT.md](CUAC_AGENT_CANDIDATE_CAPACITY_CONTRACT.md): defines exact active-pending counts, guest/student isolation, transaction-level concurrency, 429/audit behavior and remaining production abuse-control gates.
- [CUAC_AGENT_MEMORY_RETENTION_CONTRACT.md](CUAC_AGENT_MEMORY_RETENTION_CONTRACT.md): only confirmed structured low-sensitive student preferences receive finite memory, capped at 365 days by PostgreSQL; production scheduling and backup deletion remain closed.
- [CUAC_PROGRAM_REQUIREMENT_GOVERNANCE_CONTRACT.md](CUAC_PROGRAM_REQUIREMENT_GOVERNANCE_CONTRACT.md): internal prepare, independent approval, bounded management reads and CAS publish/withdraw are locally verified. Content-bound human attestations are not an authenticity oracle. No Ops write HTTP route, real rule importer or Agent tool is enabled.
- [CUAC_ASSESSMENT_RECORDS_CONTRACT.md](CUAC_ASSESSMENT_RECORDS_CONTRACT.md): private exam report collection, original textual components/scales, explicit report forms, civil dates, versioned owner-only API and audited erasure. No score conversion, official verification, school/Agent access or formal submission.
- [CUAC_NOTICE_PUBLICATION_CONTRACT.md](CUAC_NOTICE_PUBLICATION_CONTRACT.md): distinct notice scopes, immutable versions, independent internal review and CAS publication/withdrawal; public GET exposes only exact-locale approved content. No real text, student consent, management HTTP or Agent tool is enabled; recipient, age, retention and per-program material authorization remain gates.
- [CUAC_APPLICATION_PREFLIGHT_CONTRACT.md](CUAC_APPLICATION_PREFLIGHT_CONTRACT.md): owner-only single-choice GET, explicit locale, current student persona and data classes, repeatable read-only snapshot, database-clock window and publication checks, minimal inventory metadata and unassessed requirement references. No new migration or write; actual scoped consent, material snapshot, policy, billing entitlement and submit remain unavailable.
- [CUAC_POSTGRES_RELEASE_ARTIFACT_CONTRACT.md](CUAC_POSTGRES_RELEASE_ARTIFACT_CONTRACT.md): detached content-addressed migration packages pin runtime/plan/dependencies and pass reproducibility, pre-connect tamper rejection and real schema upgrade/replay. The separate [Linux runtime gate](CUAC_POSTGRES_LINUX_RUNTIME_CONTRACT.md) now passes 7/7 tests for non-root/read-only execution, isolated network, external verifier, non-superuser migration/replay and SIGTERM recovery. Trusted CI/signatures, patch review, cloud runtime/secret controls, domain backfills and RDS restore remain open.
- [CUAC_POSTGRES_APPLICATION_TRANSPORT_CONTRACT.md](CUAC_POSTGRES_APPLICATION_TRANSPORT_CONTRACT.md) and [CUAC_APPLICATION_LIFECYCLE_CONTRACT.md](CUAC_APPLICATION_LIFECYCLE_CONTRACT.md): BE-0714 local shared-pool, built-API fault, process drain/deadline and Linux OS-signal gates pass. Monitoring, independent liveness, trusted cloud runtime/LB drain and RDS failover remain open.
- [CUAC_APPLICATION_SUBMISSION_BACKEND_CONTRACT.md](CUAC_APPLICATION_SUBMISSION_BACKEND_CONTRACT.md): user confirmed one independent application per program, not a same-school merge. Current add/remove/edit/order commands enforce draft status and null freeze/submission timestamps under a parent row lock. Actual changes advance revision; editing and ordering require expectedRevision. Original POST recovery and repeated DELETE semantics are preserved. Intake binding, independent versioned applicant basics and multiple education records are locally verified. Requirement storage/public reads are locally verified; governed source review/approval/publication, score/language records, consent/snapshots, approved pricing and full submit remain pending; pricing unit is not implied by application unit.
- [CUAC_PROGRAM_REQUIREMENTS_CONTRACT.md](CUAC_PROGRAM_REQUIREMENTS_CONTRACT.md): exact program-intake version storage and explicit publication-pointer reads are locally verified. Guest/account responses expose the same strict public DTO with fixed information_only assessment, no raw PII and no fallback. Source authenticity, approved publishing/withdrawal writes, immutable production controls and eligibility decisions remain separate gates; fixtures are synthetic only.
- [CUAC_APPLICANT_PROFILE_AND_CONSENT_CONTRACT.md](CUAC_APPLICANT_PROFILE_AND_CONSENT_CONTRACT.md): separate owner-only applicant basics from preferences, Agent memory and future per-program snapshots. GET/PATCH use explicit fields, current authority and independent revisions; no automatic school disclosure or consent.
- `CUAC_BACKEND_ADR_0001_PHASE0_1_FOUNDATION.md`
- `CUAC_BACKEND_FOUNDATION_SCHEMA_API_CONTRACT.md`
- `CUAC_BACKEND_PHASE0_1_EXECUTION_BACKLOG.md`
- `CUAC_SECURE_AGENT_BACKEND_ARCHITECTURE.md`
- `CUAC_AGENT_DATA_SANDBOX_SPEC.md`
- `CUAC_AGENT_CONTEXT_LIFECYCLE_SPEC.md`
- `CUAC_AGENT_TOOL_REGISTRY_SPEC.md`
- `CUAC_BACKEND_SECURITY_TEST_PLAN.md`

Auth verification/reset outbox is locally verified (BE-0718): migration 0023 adds encrypted short-lived token transport, owner-bound challenge FKs, committed-job leases, pre-send identity checks, bounded explicit-nonacceptance retries and uncertain-result quarantine. Challenge/enqueue/success audit share one transaction; terminal jobs erase ciphertext. Nineteen business-database cases, one nonempty upgrade and seven regular cases cover tampering, missing keys, rollback, concurrency, expiry and lost acknowledgements. This is not provider acceptance of real mail: the runtime remains deferred unless explicitly configured; no provider, scheduler, frontend action page or Agent access is enabled. See [auth email outbox contract](CUAC_AUTH_EMAIL_OUTBOX_CONTRACT.md).

Owner-only per-choice material selection drafts are now locally verified: migration 0022 stores only explicit field/record references, four source versions and an independent CAS revision. Clearing preserves the revision; source changes/removal require explicit review; choice removal atomically deletes the associated selection. Six regular, fifteen business-database, one populated-upgrade and six real-network cases cover isolation, races, audit rollback and corruption rejection. This is not consent or a material snapshot and grants no Agent/school access. See [material selection contract](CUAC_APPLICATION_MATERIAL_SELECTION_CONTRACT.md).

## 1. Decision

CUAC can now move from frontend demo consolidation into backend Phase 0/1 implementation readiness.

The first backend work should not copy the current demo pages into tables and endpoints. The durable backend foundation is:

- stable domain objects;
- identity, role, tenant, and policy boundaries;
- data lifecycle and audit;
- catalog read foundation;
- student application core relationships;
- Agent data sandbox and Tool Gateway contract;
- payment isolation through a future Billing Facade.

The administrator panel, school portal, and Agent UI may continue to evolve without invalidating this foundation.

The frontend demo is not immutable. It is a design and validation artifact. Backend work should preserve proven product intent while replacing demo-shaped assumptions with stable domain models, safer API contracts, and mature workflows where needed.

Frontend reference constraint: when backend, API, or Agent work needs a product reference, inspect only `D:\CODE\CUAC\design-lab\home-v3.html`. Do not inspect other frontend pages or versions, and do not modify the user's Hub/Application work. The demo remains mutable; stable domain models must not mirror temporary page structure.

## 2. Backend Shape

Recommended startup shape:

```text
frontend/app or future web client
  -> API routes / backend service boundary
    -> request context
    -> auth/session
    -> policy engine
    -> domain modules
    -> audit writer
    -> PostgreSQL transactional database
    -> search/vector indexes through scoped gateways
    -> external providers through facades
```

Use a modular monolith first. Split services later only after the domain and policy seams are stable.

Recommended implementation direction:

- TypeScript backend.
- PostgreSQL as production transactional primary database.
- Alibaba Cloud deployment baseline: ECS or containerized app runtime for the backend, Alibaba Cloud RDS for PostgreSQL as the primary database, OSS for future files/exports, and Redis/queue service for async jobs.
- Drizzle is the current TypeScript schema/migration implementation, with the locally verified tool versions pinned by the migration baseline.
- Keep current D1/demo schema non-authoritative for production transactional data.

The PostgreSQL SQL chain and current Drizzle schema now have a verified local baseline. Alibaba Cloud runtime/environment selection and operational acceptance still need release evidence before production use; the baseline is not a deployment approval.

## 2.1 Alibaba Cloud Production Baseline

Because CUAC is expected to deploy on Alibaba Cloud servers later, backend planning should assume this production baseline:

| Layer | Recommended Alibaba Cloud Service | Notes |
| --- | --- | --- |
| App runtime | ECS, ACK, or containerized service | Start with one modular monolith backend. Containerize early if operationally practical. |
| Primary DB | ApsaraDB RDS for PostgreSQL | Authoritative transactional store for users, roles, tenant data, applications, audit, billing business state, and Agent tool records. |
| Object storage | OSS | Future transcripts, exports, generated files, and private school/application artifacts. Phase 0/1 should not implement sensitive file upload yet. |
| Cache / queue | Redis-compatible service or queue service | Sessions, rate limits, async jobs, notification dispatch, import jobs, and later Agent job orchestration. |
| Secrets | Alibaba Cloud KMS / secret management | DB credentials, payment provider secrets, AI provider keys, webhook secrets. Never expose to Agent, browser, logs, or database rows. |
| Observability | CloudMonitor / logs plus app-level audit | Operational logs are separate from immutable application audit records. |
| Search / RAG | Start with PostgreSQL/search service for public catalog; add vector index only behind Retrieval Gateway | Private indexes wait until Agent data sandbox tests pass. |

Environment layout:

- `dev`: local development and disposable test data;
- `staging`: production-like RDS schema, seeded catalog, safe fake users/payments;
- `production`: real users, strict backup, audit retention, secrets, and access controls.

D1 and Cloudflare-specific bindings may remain for the current frontend starter or public-edge optimization, but they are not part of the authoritative Alibaba Cloud backend.

## 3. Module Map

| Module | Purpose | Phase 0/1 Action | Deferred |
| --- | --- | --- | --- |
| Database schema | Authoritative domain storage | Create migration source of truth for identity, roles, tenant, audit, catalog, and application core relationships | Full file/document storage, advanced analytics marts |
| Auth / Account | Unified human account model | Users, identities, sessions, student credentials registration/login/logout, session revocation, sign-in continuation, email verification challenge foundation, password reset challenge foundation, school staff invite create/revoke/accept foundation with transactional replacement and pending-school/email uniqueness, Auth email message composer/readiness gate, Auth rate-limit foundation/readiness gate/runtime factory, account status | School/Ops self-registration, school invite list/resend/full management UI, approved external email provider adapter, SSO for schools, MFA enforcement rules beyond foundation, concrete Redis limiter wiring |
| Tenant / Role / Policy | Server-side authority | Deny-by-default policy engine, student ownership, school tenant membership, CUAC internal access grants | Fine-grained workflow approvals beyond foundation |
| Student Application | Student-owned application lifecycle | Define stable tables and service contracts for application sets, choices, school application records, status history | Complete submission workflow, document upload, final school sends |
| School Portal | School tenant review surface | Define tenant-safe projections and membership model | Full school write operations, exports, integrations |
| Ops Admin | CUAC operational review | Define grants, audit, governed summary projections | Broad write APIs tied to evolving admin UI |
| Catalog | Public discovery foundation | Schools, programs, intakes, scholarships, cities, source evidence, public read APIs | Ops catalog publishing workflow, bulk editorial tools |
| Payments / Billing | Business status without credentials | Model payment business state, exact per-project fee entitlement, Billing Facade contract, PostgreSQL repository boundary, runtime fee schedule gate, and contract routes only | Raw card data, direct card processing, refunds, live webhooks in Phase 0/1 |
| Agent Tool Gateway | Controlled Agent access | Tool registry schema/contract, prohibited tools, projections, audit metadata | Full natural-language execution and sensitive mutations |
| Audit / Logging | Security evidence and observability | Append-only audit table, audit writer, redaction utilities | Long-term SIEM pipeline and compliance dashboards |
| RAG / Knowledge | Scoped retrieval | Public catalog lane design and data sandbox rules | Private vector indexes before policy gates are proven |
| Notifications | User communication lifecycle | Define event taxonomy and notification preferences contract | Provider sending, templates, deliverability automation |
| Infrastructure Readiness | Alibaba Cloud deployment safety | Check PostgreSQL, SSL, runtime, secrets, Agent sandbox, Billing, payment provider, KMS, and OSS posture before staging/production | Real cloud provisioning and production release |
| Environment Templates | Deploy-time configuration | Provide staging/production examples for Alibaba Cloud RDS, SSL, migration, Agent sandbox, Billing, payment, KMS, and OSS posture | Real secrets and cloud provisioning |
| Migration Safety | Safe schema rollout | Require explicit target environment, migration runbook, production approval, runbook acknowledgement, and non-local staging/production database URL before migrations | Real staging/production migration execution |

## 4. Stable Domain Model First

The stable model should be built around domain ownership, not screens:

- `schools`, `programs`, `program_intakes`, `scholarships`, `cities`;
- `users`, `auth_identities`, `auth_sessions`;
- `user_roles`, `school_staff_memberships`, `cuac_staff_access_grants`;
- `student_profiles`, `saved_items`;
- `application_sets`, `application_choices`, `school_applications`;
- `audit_logs`;
- `agent_persona_sessions`, `agent_context_candidates`, `agent_memory_entries`;
- future `agent_tool_registry` and `agent_tool_invocations` persistence;
- billing tables storing only provider references and business status.

The current frontend pages are useful acceptance references, but they are not the backend source of truth.

## 5. Security Baseline

All backend modules must use the same request context:

```text
request_id
actor_user_id or guest_session_id
selected_surface
active_role
tenant_school_id if school-scoped
purpose
auth_strength
policy_decision_id
data_class_allowlist
```

Required invariants:

- Browser state is not authoritative.
- Client-supplied `userId`, `schoolId`, `role`, `tenantId`, field lists, and SQL are never trusted.
- Student ownership is resolved server-side.
- School staff access is resolved from active membership tables and must not rely only on session-carried tenant IDs.
- CUAC internal authority is resolved from explicit access grants.
- Sensitive denials are audit-ready.
- Logs and Agent memory never store payment credentials, secrets, raw documents, or raw sensitive payloads.

## 6. Agent Boundary

The Agent is an information organization and expression layer.

It may:

- search and explain public catalog information;
- help students filter, compare, and decide;
- prepare navigation or low-risk UI actions;
- summarize student-owned application state after login;
- summarize school-visible applicant projections for authorized school staff;
- summarize governed Ops metrics for authorized CUAC staff.

It must not:

- connect directly to the database;
- run SQL;
- choose arbitrary tables or fields;
- access raw payment data;
- access raw student documents;
- access other students, other school tenants, or private memories;
- mutate application, payment, school, or Ops state without normal backend service policy and audit.

Required Agent path:

```text
Agent
  -> registered tool
  -> Tool Gateway
  -> Policy Engine
  -> data sandbox projection
  -> domain service or governed script
  -> audit metadata
  -> model-safe response
```

Phase 0/1 may define the Tool Gateway contract and prohibited action tests. Full Agent execution should wait until identity, policy, audit, catalog, and application core services exist.

## 7. First Implementation Batch

### Directories

Create or reserve these backend module paths in the chosen backend root:

```text
src/server/db
src/server/auth
src/server/policy
src/server/audit
src/server/catalog
src/server/applications
src/server/tenancy
src/server/agent
src/server/billing
src/server/notifications
src/server/infra
src/server/shared
tests/server/auth
tests/server/policy
tests/server/audit
tests/server/catalog
tests/server/agent
tests/server/infra
```

If the project stays inside the current frontend package, use `frontend/src/server/...` or `frontend/app/api/...` only as thin route adapters over these modules.

### First Migration Set

Migration 001 should create:

- `users`;
- `auth_identities`;
- `auth_sessions`;
- `user_roles`;
- `school_staff_invites`;
- `school_staff_memberships`;
- `cuac_staff_access_grants`;
- `sign_in_continuations`;
- `audit_logs`;
- `cities`;
- `schools`;
- `programs`;
- `program_intakes`;
- `scholarships`;
- `program_scholarships`;
- `catalog_source_evidence`.

Migration 002 creates core application relationship tables while leaving payment, file upload, and Agent runtime tables deferred:

- `student_profiles`;
- `saved_items`;
- `application_sets`;
- `application_choices`;
- `school_applications`;
- `school_application_status_events`.

Migration 003 creates the first Agent context lifecycle foundation tables while keeping execution tables deferred:

- `agent_persona_sessions`;
- `agent_context_candidates`;
- `agent_memory_entries`.

Migration 004 creates billing business-state tables while keeping raw payment credentials and live provider execution out of CUAC:

- `billing_customers`;
- `invoices`;
- `invoice_lines`;
- `payments`;
- `payment_status_events`.

Migration `0029_application_fee_entitlement` upgrades new application-fee lines to exact v2 evidence and adds:

- `application_fee_entitlements`.

Each entitlement binds an exact student/set/choice/school/program/intake/route plus its invoice line, settled payment, success event and pricing digest. It is not school-level, cannot be shared by two projects at the same school, and is exposed to preflight only as a minimal status/currentness projection. Historical v1 lines are not inferred or backfilled. No public/Ops/Agent grant route or real provider execution is introduced.

Migration `0030_application_atomic_submission` adds:

- `application_submissions`;
- Program Application v2 evidence on `school_applications`;
- `official_submission_groups`;
- `official_submission_group_members`;
- `official_submission_outbox`.

The internal student service revalidates the complete owned Application Set and each project's exact route, policy, authorization, snapshot, requirements and entitlement. One transaction writes the submission, one Program Application per choice, policy-driven transport groups, one inert outbox row per group, statuses, receipt and audit. Same-school projects remain distinct under both form modes. There is no public submit HTTP route, Agent tool, worker, provider adapter or school write operation.

Still deferred:

- `agent_tool_registry`;
- `agent_tool_invocations`;
- `agent_action_previews`;
- raw Agent conversation/message transcript tables.
- real payment charging, signed webhooks, refunds, raw payment credentials, provider payment token storage, and production checkout provider execution.
- public application submit, official-submission outbox worker/provider adapters, external result reconciliation and school/Ops write workflows.

### First Services

Implement in this order:

1. `requestContext` parser and request ID generation.
2. Session resolver.
3. Policy engine interface with deny-by-default behavior.
4. Audit writer and redaction helper.
5. Catalog repository and public DTO mappers.
6. Public catalog query services.
7. Student ownership helpers.
8. School tenant membership helpers.
9. Agent tool registry validator with prohibited-tool tests.
10. Billing Facade contract with payment credential rejection and exact per-project entitlement tests.
11. Billing runtime composition with explicit minor-unit fee schedule validation, internal entitlement currentness and fail-closed behavior.
12. Production readiness check for Alibaba Cloud/PostgreSQL deployment posture.
13. Migration runbook and safety guard for staging/production PostgreSQL schema rollout.
14. Alibaba Cloud staging/production environment templates.
15. Student credentials registration/login service with salted password hashing and hashed session tokens.

### First APIs

Expose first:

```text
GET /api/v1/health
GET /api/v1/me
GET /api/v1/catalog/cities
GET /api/v1/catalog/schools
GET /api/v1/catalog/schools/:schoolId
GET /api/v1/catalog/programs
GET /api/v1/catalog/programs/:programId
GET /api/v1/catalog/scholarships
GET /api/v1/catalog/scholarships/:scholarshipId
```

Started after auth and student ownership foundation:

```text
GET /api/v1/student/profile
PATCH /api/v1/student/profile
GET /api/v1/student/saved-items
POST /api/v1/student/saved-items
GET /api/v1/student/application-sets
POST /api/v1/student/application-sets
GET /api/v1/student/application-sets/:applicationSetId
POST /api/v1/student/application-sets/:applicationSetId/choices
GET /api/v1/school/applications
GET /api/v1/school/applications/:applicationId
POST /api/v1/agent/context/candidates
POST /api/v1/agent/context/carry-forward
POST /api/v1/billing/fee-preview
POST /api/v1/billing/checkout-intents
```

Started for student credentials and login continuation:

```text
POST /api/v1/auth/register
POST /api/v1/auth/sessions
POST /api/v1/auth/logout
POST /api/v1/auth/sign-in-continuations
POST /api/v1/auth/sign-in-continuations/:continuationId/consume
POST /api/v1/auth/email-verification
POST /api/v1/auth/email-verification/:challengeId/verify
POST /api/v1/auth/password-reset
POST /api/v1/auth/password-reset/:challengeId/reset
```

Still deferred for auth:

```text
real email provider delivery
school/Ops self-registration
school SSO
MFA enforcement
```

Contract-only until policy and services are proven:

```text
POST /api/v1/application-sets
PATCH /api/v1/application-sets/:applicationSetId
POST /api/v1/application-sets/:applicationSetId/choices
POST /api/v1/agent/tool-invocations
GET /api/v1/ops/queues
```

## 8. Test Gates

Phase 0/1 is not complete unless these tests exist:

- schema migration can create and reset the database;
- student credential routes hash passwords, store only hashed session tokens, return safe session projections, and never grant school/Ops roles through self-registration;
- public catalog endpoints do not expose internal catalog metadata;
- unauthenticated guests can read only public catalog data;
- authenticated users cannot read another student's profile/application data;
- school staff cannot cross tenant boundaries;
- CUAC internal role cannot be self-granted;
- audit records redact secrets, tokens, cookies, PAN-like values, and CVV-like values;
- student write-action audit metadata excludes raw profile values, preference payloads, and student notes;
- school projection read audit metadata excludes raw applicant projection payloads, routing metadata, contact fields, and status reasons;
- billing migration, service, HTTP, repository, and runtime tests prove CUAC stores and exposes only payment business state plus exact project entitlement evidence, not raw card, CVV/CVC, bank account, routing number, payment token, provider checkout URL, raw provider metadata, unsafe fee configuration, or client-supplied user authority; same-school projects cannot share application-fee lines or entitlements;
- denied sensitive actions create audit metadata where appropriate;
- Agent prohibited tools are rejected;
- Agent tool calls cannot pass SQL, table names, arbitrary URLs, user IDs, tenant IDs, or field lists as authority;
- Agent projections record persona, data classes, projection type, retrieval lane, and audit level.
- production readiness tests reject demo databases, missing SSL, weak session secrets, disabled Agent sandbox enforcement, direct Agent database access, unsafe billing fees, weak live-payment webhooks, missing KMS/secret posture, and sensitive file upload without private OSS storage.
- migration safety tests reject production runs without explicit approval/runbook acknowledgement, reject staging/production runs pointed at localhost, and verify the migration runbook documents production approval gates.
- migration artifact tests reject historical byte changes, broken snapshot lineage and tool/schema mismatch before a database connection; real PostgreSQL tests compare the migrated and ORM-derived structures and detect deliberate drift. New migration generation must preserve history and advance the execution cursor.
- environment template tests ensure staging/production examples include the required readiness and migration variables, avoid localhost database URLs, keep Agent direct database access disabled, keep sensitive file upload disabled by default, and keep production migration approval off by default.

## 9. Must Defer

Do not implement these in Phase 0/1:

- full natural-language Agent execution;
- Agent direct database access;
- natural-language writes to application/payment/school/Ops records;
- real payment processing, refunds, or provider webhooks;
- storage and processing of raw card data;
- full school portal write operations;
- Ops Admin write APIs coupled to the current admin panel UI;
- file upload for transcripts, passports, visas, medical documents, or recommendations;
- school SIS/portal integrations;
- private vector indexes containing student or school tenant records before data sandbox tests pass.

## 10. Startup Milestones

### Milestone A: Architecture Lock

Evidence:

- final PostgreSQL hosting decision;
- final ORM decision;
- backend root and route adapter strategy chosen;
- Phase 0 ADR marked accepted.

### Milestone B: Foundation Skeleton

Evidence:

- backend directories created;
- health route exists and does not expose database URLs, hosts, credentials, or secrets;
- request context, safe current-actor projection, and error envelope exist;
- test runner can execute server tests.

### Milestone C: Identity, Policy, Audit

Evidence:

- identity and session schema migrated;
- deny-by-default policy tests pass;
- audit writer and redaction tests pass.

### Milestone D: Catalog Read Foundation

Evidence:

- catalog tables migrated;
- seed/import contract dry-run works with CSCAlite-like data, produces ordered idempotent import operations, and has a parameterized PostgreSQL writer ready for staging rehearsal;
- public catalog APIs return stable DTOs;
- public/private field boundary tests pass.

### Milestone E: Agent Foundation Contract

Evidence:

- Agent persona/session model is contract-tested;
- Tool Gateway registry schema exists;
- prohibited tool fixtures pass;
- Agent data sandbox acceptance checklist is enforceable in tests.

## 11. Current Recommendation

Start implementation with Milestone A and B immediately.

The first actual code change should be a backend skeleton plus test scaffold, not the full application workflow. The first schema migration should cover identity, tenant, audit, and catalog. Student application core tables can follow as Migration 002 once naming and status taxonomy are approved.

This lets CUAC move from demo to full website without locking the backend to temporary frontend layout decisions.
