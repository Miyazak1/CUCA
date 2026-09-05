# CUAC Product Production Roadmap

Status: full production plan for moving from the current demo to a complete product.

Last updated: 2026-09-01

Execution status: started. Stage 0 architecture lock is accepted for Phase 0/1 backend execution, and the first backend foundation code has been added under `frontend/src/server`.

Current local evidence (2026-09-01): the reviewed chain is through `0032_agent_candidate_capacity`, with 33 migrations, 24 snapshots and 58 tables. The current suite passes 523/523 regular tests, 477/477 PostgreSQL plus built HTTP and 7/7 isolated Linux migration tests; the dedicated PostgreSQL entry passes 379/379 and overlaps the HTTP suite. `0031` enforces a finite database-clock ceiling of 365 days for confirmed low-sensitive student memory. `0032` caps active pending candidates at 12 per verified guest browser binding and 24 per student account with concurrent last-slot enforcement. The internal application grain remains one student + program + intake; same-school projects stay independent, while `0030` transport groups never merge identity, evidence, status or outcome. No public submit, external school delivery, live payment, production Agent memory/tool execution or cloud approval is implied.

A persistent local-development runtime is now implemented separately from disposable rehearsals: a loopback-only PostgreSQL container and named volume, generated ignored secrets, automatic migration, idempotent synthetic catalog/application fixtures, Node API mode and health/catalog/Auth/per-program application smoke. See [local development runbook](CUAC_LOCAL_DEVELOPMENT_RUNBOOK.md). This enables staged V3 API integration without treating Demo layout as schema authority.

The next two evidence paragraphs preserve an earlier 0023 milestone for chronology; they are not current totals.

Local database evidence (2026-09-01): `npm run db:pg:rehearse` passed 330 tests (329 database subtests and the parent) using disposable PostgreSQL 16.13. All 24 migrations run/replay successfully; catalog seed replay, public reads, invite concurrency, atomic registration, session role revocation, student ownership, school tenant scope, audit projections, relationship constraints, verification/reset/continuation lifecycles, rollback and both login/reset lock orders are verified through real repositories and HTTP handlers. Draft freeze, project-level removal, notes/scholarship editing and whole-set ordering now also have revision, concurrency, isolation and rollback evidence. Independent applicant basics and multiple education records have owner-only CRUD, revision, audit-failure and actual lock-race evidence. Exact-intake requirement pointers, publication/time scope, strict documents/digests, consistent reads, internal maker/reviewer governance, CAS publish/withdraw, atomic audit, concurrency and populated legacy-requirements upgrade are also locally verified. Private assessment records now have independent revision, raw score/scale preservation, real permission/concurrency/audit/erasure tests and a populated upgrade. Notice version governance adds nineteen database cases and a populated upgrade: independent review, exact-locale publication, live permission locks, atomic audit and corruption rejection without manufacturing legal text or student consent. Single-choice preflight adds twelve cases for exact ownership, target/window/funding scope, current authority, minimal inventories, snapshot consistency, actual READ ONLY enforcement and corrupt-data rejection; it never authorizes submission. Ten target-identity cases and four populated-upgrade cases now enforce exact school-application/choice programs and intakes, including null; protect referenced projects from deletion; preserve old fields/receipts; and reject conflicting legacy data without repair. See [target identity contract](CUAC_APPLICATION_TARGET_IDENTITY_CONTRACT.md) and [rehearsal record](CUAC_POSTGRES_REHEARSAL_REPORT.md). Per-choice material preview now adds twelve database cases for explicit selected fields/records, four source versions, account/program/intake-bound digests, no persistence and consistent reads across actual changes/deletions. It is self-review, never consent or school disclosure; see [material preview contract](CUAC_APPLICATION_MATERIAL_PREVIEW_CONTRACT.md). This is not staging RDS or full product acceptance. Memory controls add eight business cases and one populated-upgrade case for purpose isolation, revision conflicts, exact keyset pagination, quota/role races and uncertain commits; old settings and over-cap legacy content are preserved.

Local network evidence (2026-09-01): `npm run db:http:rehearse` builds the API and passes 418 tests, including the database suite and 88 real-network/lifecycle subtests. Shared Origin/body/cache controls and signed guest bootstrap/rotation are locally verified. Four lifecycle cases cover actual pool close, signal drain, disconnected clients and deadline rollback; four removal cases cover fixed-target DELETE, isolation, freeze and audit rollback; four editing/ordering cases cover actual routes, rejects, same-version concurrency and audit rollback. Six assessment cases add actual CRUD, strict nested inputs, version competition, audit rollback, role revocation and redacted corrupt-data handling. Five education cases add actual CRUD, strict input/owner checks, version competition, audit rollback and revoke-during-wait coverage. Four requirements cases add guest/account projection parity, no-fallback scope, redacted corrupt-publication failures and an internal prepare/approve/publish/withdraw flow observed through the real public GET. Four notice cases add public projection/locale isolation, no write route, corrupt evidence rejection and publish/withdraw audit rollback. Four preflight cases add owner-only projection, strict query/fetch metadata, no write route, fresh version/window/role changes and corrupt-publication rejection. Three school-target cases now verify exact intake projections, private headers, distinct per-project state, tenant/persona isolation and membership suspension; foreign and nonexistent records retain identical null results for a valid teacher. Five material-preview network cases also verify private selected content, strict nested inputs and transport limits, persona/owner isolation, stale versions, current role revocation and corrupt-data rejection. No Ops write route is exposed. See [HTTP and guest-session contract](CUAC_HTTP_SECURITY_AND_GUEST_SESSION_CONTRACT.md) and [application lifecycle contract](CUAC_APPLICATION_LIFECYCLE_CONTRACT.md) for behavior and remaining browser/cloud gates. Six memory-control network cases verify owner-only projections, strict requests, reset conflicts, atomic audit, revoke-during-wait and guest confirmation capacity.

Primary technical baseline:

Migration artifact baseline is locally verified through `0032`: 33 SQL migrations, twenty-four snapshots and 58 tables; SQL-chain and ORM shadow schemas match at 864 columns, 310 constraints and 210 indexes. Generation/preflight, migration execution locks, exact recorded-prefix/hash checks, transactional rollback, populated historical upgrades and disconnect recovery pass. Detached packaging digest `b881c770d1a830dd152cecd760cd8cdd983b634154786fd0dad4593e885b94ca` and a separate 7/7 Linux runtime gate also pass: non-root/read-only execution, isolated networking, external bootstrap verification, non-superuser migration/replay and SIGTERM recovery. See [Linux runtime contract](CUAC_POSTGRES_LINUX_RUNTIME_CONTRACT.md). Trusted CI/signatures, patch review, actual cloud runtime/secret controls, domain backfills and RDS restore/failover remain open under BE-0713.

Internal requirement/notice/policy governance, private assessment records, per-program route/policy-bound authorization v2 and encrypted snapshots, exact application-fee entitlement, policy-aware preflight, and the D2 atomic database acceptance/grouping boundary are implemented locally. Real-source admission, employee/MFA transport, controlled exam definitions/scales, necessary course transcript/GPA models, production legal/price data, public submit, live payment, outbox delivery and official school-system submission remain separate gates. See [atomic submission contract](CUAC_ATOMIC_APPLICATION_SUBMISSION_CONTRACT.md), [governance contract](CUAC_PROGRAM_REQUIREMENT_GOVERNANCE_CONTRACT.md), [policy-bound authorization contract](CUAC_APPLICATION_POLICY_BOUND_AUTHORIZATION_CONTRACT.md) and [Billing entitlement contract](CUAC_APPLICATION_BILLING_ENTITLEMENT_CONTRACT.md).

BE-0714 now has local application-pool and built-API evidence: idle/active loss, timeouts, no automatic transaction replay, redacted failure, readiness recovery, managed process drain/deadline and actual shared-pool closure. A separate 3/3 Linux gate sends real OS SIGTERM. See [application transport](CUAC_POSTGRES_APPLICATION_TRANSPORT_CONTRACT.md) and [application lifecycle](CUAC_APPLICATION_LIFECYCLE_CONTRACT.md) contracts. Trusted cloud runtime/LB drain, monitoring, independent liveness and RDS failover remain production gates.

Application decision reconfirmed (2026-09-01): one concrete program + intake choice is one independent Program Application, even within the same school. BE-0715 draft controls and BE-0716 preparation/evidence plus internal atomic receive/grouping are locally verified. A school-level form is represented only by an Official Submission Group; `0030` proves one-program and multi-program forms cannot merge project identity, evidence, status or outcome. Reviewed launch policy/price data, public submit, live payment, worker/provider delivery and full school lifecycle remain pending. See [atomic submission contract](CUAC_ATOMIC_APPLICATION_SUBMISSION_CONTRACT.md), [per-program submission contract](CUAC_APPLICATION_SUBMISSION_BACKEND_CONTRACT.md) and [official policy/group contract](CUAC_OFFICIAL_SUBMISSION_POLICY_AND_GROUP_CONTRACT.md).

Current input and transaction hardening covers Student/Auth and structured study_goal candidates. Active pending-candidate capacity is now 12 per verified guest browser binding and 24 per student account, with database-clock expiry and real concurrent last-slot evidence; see [candidate capacity](CUAC_AGENT_CANDIDATE_CAPACITY_CONTRACT.md). Scoped memory list/clear/opt-out, candidate source erasure, reset cutoffs, bounded candidate sweeping, reset revisions, keyset pagination, a 100-uncleared-entry cap and database-enforced 365-day retention also pass local tests; see [memory management](CUAC_AGENT_MEMORY_MANAGEMENT_CONTRACT.md) and [retention](CUAC_AGENT_MEMORY_RETENTION_CONTRACT.md) contracts. Set/choice POSTs require keys and have local concurrency/transport-loss recovery evidence; see [application idempotency contract](CUAC_APPLICATION_IDEMPOTENCY_CONTRACT.md). Control UX, Gateway/WAF abuse controls, production scheduling/monitoring, backup deletion, broader revocation and remaining command recovery remain open; full Agent and production durable memory stay disabled.

- Production deployment target: Alibaba Cloud.
- Production database: Alibaba Cloud RDS for PostgreSQL.
- Backend shape: TypeScript-first modular monolith, split later only if needed.
- Agent boundary: Agent is an information organization and expression layer. It never connects directly to the database, never runs free SQL, and never accesses raw sensitive data.
- Payment boundary: CUAC never stores raw card, CVV, or bank credentials. Payments go through hosted provider flows and a Billing Facade.

Related documents:

- `CUAC_FULL_BACKEND_BLUEPRINT.md`
- `CUAC_BACKEND_IMPLEMENTATION_PLAN.md`
- `CUAC_BACKEND_PHASE0_1_EXECUTION_BACKLOG.md`
- `CUAC_BACKEND_FOUNDATION_SCHEMA_API_CONTRACT.md`
- `CUAC_SECURE_AGENT_BACKEND_ARCHITECTURE.md`
- `CUAC_AGENT_DATA_SANDBOX_SPEC.md`
- `CUAC_AGENT_MEMORY_RETENTION_CONTRACT.md`
- `CUAC_INFRASTRUCTURE_DELIVERY_SPEC.md`
- `CUAC_PRODUCTION_DELIVERY_PLAN_CN.md`
- `CUAC_POSTGRES_MIGRATION_RUNBOOK.md`

Auth verification/reset outbox is locally verified (BE-0718): migration 0023 adds encrypted short-lived token transport, owner-bound challenge FKs, committed-job leases, pre-send identity checks, bounded explicit-nonacceptance retries and uncertain-result quarantine. Challenge/enqueue/success audit share one transaction; terminal jobs erase ciphertext. Nineteen business-database cases, one nonempty upgrade and seven regular cases cover tampering, missing keys, rollback, concurrency, expiry and lost acknowledgements. This is not provider acceptance of real mail: the runtime remains deferred unless explicitly configured; no provider, scheduler, frontend action page or Agent access is enabled. See [auth email outbox contract](CUAC_AUTH_EMAIL_OUTBOX_CONTRACT.md).

Owner-only per-choice material selection drafts are now locally verified: migration 0022 stores only explicit field/record references, four source versions and an independent CAS revision. Clearing preserves the revision; source changes/removal require explicit review; choice removal atomically deletes the associated selection. Six regular, fifteen business-database, one populated-upgrade and six real-network cases cover isolation, races, audit rollback and corruption rejection. This is not consent or a material snapshot and grants no Agent/school access. See [material selection contract](CUAC_APPLICATION_MATERIAL_SELECTION_CONTRACT.md).

## 1. Goal

Turn the current CUAC frontend demo into a production admissions discovery, application-routing, school-tenant, Ops, billing, and Agent-assisted platform.

The roadmap is organized by release gates, not by pages. Each phase should ship only after its security, data, and product acceptance gates pass.

## 2. Stage Overview

| Stage | Name | Primary Outcome | Can Start Now |
| --- | --- | --- | --- |
| 0 | Product and Architecture Lock | Finalize production choices and freeze backend boundaries | Yes |
| 1 | Backend Foundation | PostgreSQL schema, auth, roles, tenant policy, audit, catalog read APIs | Yes |
| 2 | Student Core | Accounts, profiles, saved items, application choices, guest-to-login continuation | After Stage 1 foundation |
| 3 | Application Submission and Billing | Fee preview, hosted checkout, payment status, submission, school application creation | After Student Core |
| 4 | School Portal | Tenant-safe school queue, applicant projection, status/contact workflows | After submission model |
| 5 | Agent MVP | Tool Gateway, controlled retrieval, context memory, low-risk actions, audited summaries | After policy/audit/catalog/student core |
| 6 | Ops Admin and Analytics | Data quality queues, governed metrics, support workflows, dashboards | After foundation and core event model |
| 7 | Notifications and Lifecycle Automation | Email/SMS/in-app notification flows and background jobs | Can begin contract work earlier; production send later |
| 8 | Infrastructure Hardening | Alibaba Cloud staging/production, CI/CD, backup, monitoring, security gates | Begins during Stage 1, required before launch |
| 9 | Beta Launch | Controlled users, real school pilot, limited payment/Agent scope | After Stages 1-8 launch gates |
| 10 | Production Launch | Public launch with operational runbooks and support process | After beta exit |
| 11 | Post-Launch Expansion | File upload, deeper school integrations, stronger Agent workflows, advanced analytics | After production stability |

## 3. Stage 0: Product And Architecture Lock

Purpose: make the core decisions that should not change casually once schema and APIs are implemented.

Current status:

- PostgreSQL is accepted as the authoritative production database.
- Alibaba Cloud is accepted as the production deployment baseline.
- The frontend demo is treated as a design reference that can change when a more mature product or domain model requires it.
- The only frontend product reference is `D:\CODE\CUAC\design-lab\home-v3.html`. Do not inspect other frontend pages or versions, or change the user's Hub/Application frontend. Treat the demo as mutable, not a database or API schema.
- Agent Data Sandbox and Tool Gateway are accepted as mandatory Agent boundaries.
- Phase 0/1 backend foundation implementation has started.

Deliverables:

- Accept PostgreSQL as production authoritative database.
- Accept Alibaba Cloud production baseline: ECS/container runtime, RDS PostgreSQL, OSS, Redis/queue, KMS/secret management.
- Choose ORM source of truth: recommended Drizzle if TypeScript-first backend remains the plan.
- Choose backend root strategy: keep backend modules under current app or create a dedicated backend package.
- Confirm unified account model for students, school staff, and CUAC staff.
- Confirm Agent Data Sandbox and Tool Gateway model.
- Confirm payment isolation and hosted checkout pattern.
- Mark Phase 0 ADR as accepted.

Exit gates:

- No ambiguity on PGSQL versus D1/SQLite for production data.
- No ambiguity on Agent direct database access. It is prohibited.
- No ambiguity on raw payment data. CUAC does not store or process it.
- First implementation tickets can be created without depending on temporary demo page layout.

## 4. Stage 1: Backend Foundation

Purpose: build the safe backend base that every later feature depends on.

Current status:

- Initial TypeScript server foundation modules exist under `frontend/src/server`.
- Request context, error envelope, deny-by-default policy, audit event building, redaction, and Agent tool validation have initial tests.
- PostgreSQL Drizzle schema now exists at `frontend/src/server/db/schema.ts`.
- PostgreSQL initial migration now exists at `frontend/drizzle/pg/0000_solid_oracle.sql` with 16 foundation tables: identity, roles, school invitations/memberships, CUAC grants, sign-in continuations, audit, cities, schools, programs, intakes, scholarships, program-scholarships, and catalog source evidence.
- Public catalog DTO mapper and service boundary now exist under `frontend/src/server/catalog`.
- Catalog mapper tests assert that public DTOs do not leak internal quality, tenant, source-note, staff membership, student, payment, or Ops-only fields.
- PostgreSQL catalog repository boundary now exists at `frontend/src/server/catalog/postgres-repository.ts` using fixed parameterized SQL and explicit public SELECT lists.
- Thin catalog HTTP handler factory now exists at `frontend/src/server/catalog/http.ts`; it returns public JSON only and does not expose audit metadata to the browser.
- Catalog API route files now exist under `frontend/app/api/v1/catalog/...` for programs, schools, scholarships, and cities list/detail routes.
- PostgreSQL runtime wiring now exists at `frontend/src/server/db/postgres-client.ts` using `pg`, `DATABASE_URL` / `POSTGRES_URL` / `PG_DATABASE_URL`, shared pool management, and a query adapter for `PostgresCatalogRepository`.
- Route composition now uses `PostgresCatalogRepository` when PostgreSQL is configured and fails closed with `SERVICE_UNAVAILABLE` when the database URL is absent; it does not fall back to frontend demo/static data.
- Health foundation now exists:
  - `frontend/src/server/health/health.ts`
  - `frontend/src/server/health/http.ts`
  - `frontend/app/api/v1/health/route.ts`
  Health reports service status and PostgreSQL configuration posture without exposing database URLs, hosts, credentials, or secrets. Deep database readiness is intentionally deferred until local PostgreSQL or Alibaba Cloud staging RDS is configured.
- Auth/session foundation now exists:
  - `frontend/src/server/auth/session.ts`
  - `frontend/src/server/auth/postgres-repository.ts`
  - `frontend/src/server/auth/credentials.ts`
  - `frontend/src/server/auth/credentials-http.ts`
  - `frontend/src/server/auth/runtime/routes.ts`
  - `frontend/src/server/auth/http.ts`
  - `frontend/app/api/v1/me/route.ts`
  - `frontend/app/api/v1/auth/register`
  - `frontend/app/api/v1/auth/sessions`
  - `frontend/app/api/v1/auth/logout`
  - `frontend/app/api/v1/auth/sign-in-continuations`
  - `frontend/app/api/v1/auth/email-verification`
  The resolver reads server-owned session cookies, hashes browser tokens before lookup, ignores client-supplied `userId`, `role`, and `schoolId` authority hints, rejects expired/revoked/inactive sessions, and returns a safe current-actor projection. Student email/password registration, sign-in, logout/session revocation, sign-in continuation, email verification challenge, password reset challenge, and school staff invite create/revoke/accept contract APIs now exist; passwords use salted `scrypt` hashes, browser session tokens are stored and revoked only as SHA-256 hashes, registration grants only the student role, logout clears the HttpOnly session cookie, continuation/email verification/password reset/invite tokens are stored or queried only as SHA-256 hashes, continuation consume requires id + token + authenticated server session, school staff invite creation/revocation requires CUAC Ops/Admin and concurrent creation is serialized in a transaction with a pending-school/email unique index; acceptance requires the authenticated account email to match the invited email and ignores client-supplied authority fields, normal password reset HTTP responses have the same status/body for present and missing accounts (timing and external-delivery failure behavior remain unverified), password reset atomically rechecks/consumes the token, updates the password hash, revokes existing sessions and invalidates other pending reset links; session issuance rechecks the password proof under the same user lock, and route responses do not return password hashes, raw session tokens, verification tokens, reset tokens, invite tokens, or session hashes. Auth email message composer now creates provider-neutral verification/reset messages with HTTPS action links and production readiness requires Auth email delivery posture before staging/production. Auth rate-limit foundation now exists for registration, login, logout, email verification, password reset, school invite create/revoke/accept, and sign-in continuation actions; rate-limit keys hash normalized subjects, the PostgreSQL store upserts fixed hash-key buckets, Auth HTTP handlers accept an injectable limiter and return 429 before business repository access when blocked, runtime composition now creates a configured limiter posture from env, and production readiness currently accepts API Gateway/WAF enforcement while rejecting memory/postgres/redis as deployable production backends until a Redis adapter is implemented. Real external email delivery provider adapter, School/Ops self-registration, invite list/resend/full management UI, OAuth/SSO, MFA, and concrete Redis limiter wiring remain deferred.
- Student/application core schema foundation now exists:
  - `frontend/drizzle/pg/0001_fixed_tempest.sql`
  - `student_profiles`, `saved_items`, `application_sets`, `application_choices`, `application_choice_status_events`, `school_applications`, `school_application_status_events`
  - `frontend/src/server/student/ownership.ts`
  - `frontend/src/server/student/service.ts`
  - `frontend/src/server/student/postgres-repository.ts`
  - `frontend/src/server/student/http.ts`
  - `frontend/app/api/v1/student/...`
  The migration stores stable ownership and routing relationships without adding payment tables, Agent runtime tables, file uploads, or UI-shaped temporary workflow state. Student ownership, service, repository, and HTTP tests cover own-resource allow, direct-ID denial, data-class denial, guest denial, profile update normalization, using `actorUserId` instead of client-supplied user authority, route `applicationSetId` overriding request body authority, fixed SQL, parameterized JSON, no `select *`, and thin app route adapters. Student profile update, saved item save, application set create, and application choice add now emit audit events through an injectable audit sink; production PostgreSQL runtime injects `PostgresAuditWriter`, and tests assert raw profile values, preference payloads, and student notes are not stored in audit metadata.
- Agent context lifecycle foundation now exists:
  - `frontend/drizzle/pg/0002_agent_context_foundation.sql`
  - `frontend/src/server/agent/context.ts`
  - `frontend/src/server/agent/http.ts`
  - `frontend/src/server/agent/postgres-context-repository.ts`
  - `frontend/src/server/agent/runtime/routes.ts`
  - `frontend/app/api/v1/agent/context/candidates`
  - `frontend/app/api/v1/agent/context/carry-forward`
  - `frontend/tests/server/agent/context.test.mjs`
  - `frontend/tests/server/agent/http.test.mjs`
  - `frontend/tests/server/agent/postgres-context-repository.test.mjs`
  The migration adds `agent_persona_sessions`, `agent_context_candidates`, and `agent_memory_entries` for structured persona context, short-lived context candidates, and confirmed memory summaries. It intentionally does not add raw conversation transcript storage, raw Agent messages, tool invocation execution, or action preview tables. The service enforces ephemeral guest candidates, guest-to-student carry-forward only after session-bound confirmation, persona-separated memory namespaces, and prohibited sensitive data-class rejection.
  The PostgreSQL repository uses fixed parameterized SQL for candidate creation, candidate lookup, accepted-state marking, and memory entry creation. Tests assert JSON fields are parameterized, namespace fields are explicit, and the repository does not touch raw transcript, message, payment, or student profile tables.
  Contract-only HTTP handlers now exist for context candidate creation and guest-to-student carry-forward confirmation. They ignore client-supplied identity or tenant authority, reject sensitive memory candidates, and do not expose full Agent execution.
  The service now accepts an audit sink for candidate creation, memory creation, carry-forward, and denied sensitive candidate attempts. `PostgresAuditWriter` persists these events to `audit_logs` with fixed parameterized SQL. Audit metadata records action, resource, role, tenant, data class, namespace, source counts, and denial reasons without storing the raw candidate summary.
- Billing business and exact application-fee entitlement foundation now exists:
  - `frontend/drizzle/pg/0003_billing_business_foundation.sql`
  - `frontend/drizzle/pg/0029_application_fee_entitlement.sql`
  - `billing_customers`, `invoices`, `invoice_lines`, `payments`, `payment_status_events`, `application_fee_entitlements`
  - `frontend/src/server/billing/facade.ts`
  - `frontend/src/server/billing/http.ts`
  - `frontend/src/server/billing/postgres-repository.ts`
  - `frontend/src/server/billing/application-fee-entitlement.ts`
  - `frontend/src/server/billing/postgres-application-fee-entitlement.ts`
  - `frontend/src/server/billing/runtime/routes.ts`
  - `frontend/app/api/v1/billing/fee-preview`
  - `frontend/app/api/v1/billing/checkout-intents`
  - `frontend/tests/server/billing/facade.test.mjs`
  - `frontend/tests/server/billing/http.test.mjs`
  - `frontend/tests/server/billing/postgres-repository.test.mjs`
  - `frontend/tests/server/billing/runtime-routes.test.mjs`
  - `frontend/tests/server/db/application-fee-entitlement-rehearsal.mjs`
  The migration stores only payment business state: amount, currency, invoice/payment status, idempotency keys, and hosted-provider references. It intentionally does not store raw card numbers, CVV/CVC, bank account numbers, routing numbers, payment tokens, or raw payment source payloads. The service boundary previews student-owned application fees and creates hosted checkout intents through a repository abstraction; it rejects raw payment credential fields at any nested payload depth and emits audit metadata without provider session URLs or provider metadata payloads. Contract-only HTTP handlers and API route adapters now exist for `POST /api/v1/billing/fee-preview` and `POST /api/v1/billing/checkout-intents`; routes resolve identity from server sessions, ignore client-supplied user authority, reject raw payment fields before checkout repository calls, and use `PostgresBillingRepository` when PostgreSQL and explicit minor-unit fee configuration are available. Runtime composition fails closed when billing repository, fee configuration, or hosted provider execution is unavailable. Real provider integration, signed webhooks, refunds, and live payment charging remain deferred.
  The PostgreSQL repository boundary now reads application set ownership and billable choices with fixed parameterized SQL, creates invoices, invoice lines, and payments only when a hosted checkout provider adapter is injected, and fails closed without a provider. Runtime tests assert explicit fee schedule parsing, unsafe fee config rejection, PostgreSQL-only composition, audit writer injection, and authenticated `SERVICE_UNAVAILABLE` behavior when billing is not configured. Repository tests assert no `select *`, no auth/session/school-staff/Agent table reads, no raw payment credential SQL fields, and no provider metadata payload persistence.
  Migration `0029` fences new v2 application-fee lines to exact `user + set + choice + school + program + intake + route`, amount/currency/fee code and pricing-basis digest. The internal entitlement service locks and verifies the exact settled invoice, payment, success event and current choice before atomically granting one project-scoped entitlement with audit. Same-school projects cannot share evidence; historical v1 lines remain unchanged and cannot grant. Preflight receives only `{id,status,grantedAt,expiresAt,current}`. There is no public/Ops/Agent grant route, and live payment/provider/refund execution remains deferred. See [the entitlement contract](CUAC_APPLICATION_BILLING_ENTITLEMENT_CONTRACT.md).
- Internal atomic application acceptance foundation now exists:
  - `frontend/drizzle/pg/0030_application_atomic_submission.sql`
  - `application_submissions`, `official_submission_groups`, `official_submission_group_members`, `official_submission_outbox`
  - `frontend/src/server/student/application-submission.ts`
  - `frontend/src/server/student/postgres-application-submission.ts`
  `0030` creates one Program Application v2 per exact project/intake choice and then applies the reviewed form policy to transport grouping. The service writes submission, applications, groups, members, inert outbox, status changes, command receipt and audit atomically. It is internal only; no public HTTP route, Agent tool, worker, provider adapter or school write path exists. See [the atomic submission contract](CUAC_ATOMIC_APPLICATION_SUBMISSION_CONTRACT.md).
- School portal projection foundation now exists:
  - `frontend/src/server/school-portal/service.ts`
  - `frontend/src/server/school-portal/postgres-repository.ts`
  - `frontend/src/server/school-portal/http.ts`
  - `frontend/src/server/school-portal/runtime/routes.ts`
  - `frontend/app/api/v1/school/applications/...`
  The service reads tenant authority from `RequestContext.tenantSchoolId`; guests/students are rejected before repository access, and cross-tenant application detail is denied. The repository reads only `school_applications` projection plus `school_application_status_events`; tests assert it does not query `application_choices`, `application_sets`, `student_profiles`, payment tables, or Agent runtime tables.
  Thin school portal HTTP routes expose only tenant-scoped read projections for queue and detail. They resolve role/tenant from the server session, verify active `school_staff_memberships` server-side before setting tenant context, ignore client-supplied `schoolId` or alternate application IDs, and fail closed before repository access for guests or inactive memberships.
  School queue and applicant detail projection reads now emit audit events through an injectable audit sink; production PostgreSQL runtime injects `PostgresAuditWriter`, and tests assert raw applicant projection payloads, routing metadata, contact fields, and status reasons are not stored in audit metadata.
- PostgreSQL migration runtime and operational scripts now exist:
  - `npm run db:pg:check` inspects production database URL, SSL posture, migration target environment, production migration approval, and runbook acknowledgement without connecting.
  - `npm run db:pg:generate` generates reviewed PostgreSQL increments with history and cursor guards; it does not apply them.
  - `npm run db:pg:schema:check` verifies current schema/snapshots, historical byte hashes, lineage, journal and pinned tools without connecting or writing.
  - `npm run db:pg:migrate` requires environment and artifact checks before connecting, then runs the reviewed PostgreSQL migrations. The separate migration job must include the pinned Drizzle Kit dependency.
  - `CUAC_POSTGRES_MIGRATION_RUNBOOK.md` defines local, staging RDS rehearsal, production migration, rollback/restore, and prohibited-operation steps.
  Migration runtime refuses production migrations unless `CUAC_ALLOW_PRODUCTION_MIGRATION=true` and `CUAC_MIGRATION_RUNBOOK_ACK=true` are set after reviewing the runbook. It also refuses staging/production migrations that point to localhost or `127.0.0.1`.
- Alibaba Cloud environment templates now exist:
  - `frontend/config/staging.env.example`
  - `frontend/config/production.env.example`
  - `frontend/config/README.md`
  These templates cover PostgreSQL/RDS, SSL, migration target, Alibaba Cloud runtime, KMS/secret posture, Agent sandbox enforcement, Billing fee configuration, payment provider mode, webhook secret posture, and private OSS bucket posture. They are examples only and must not contain real secrets.
- Production readiness foundation now exists:
  - `frontend/src/server/infra/production-readiness.ts`
  - `frontend/scripts/production-readiness-check.ts`
  - `npm run infra:production-check`
  The check validates deployment posture for PostgreSQL URL/dialect, staging/production SSL, Alibaba Cloud region/runtime, session secret strength, Agent Tool Gateway and sandbox enforcement, direct Agent database access prohibition, explicit billing fee configuration, live payment provider webhook secret strength, Alibaba Cloud KMS/secret management, and private OSS bucket requirements before sensitive file upload. It reports warnings by default and can become a hard CI/deployment gate with `CUAC_REQUIRE_PRODUCTION_READY=true`.
- Catalog seed/import contract and dry-run validation now exist:
  - `frontend/src/server/catalog/seed-contract.ts`
  - `frontend/src/server/catalog/seed-writer.ts`
  - `frontend/seeds/catalog.sample.json`
  - `npm run catalog:seed:dry-run`
  - `npm run catalog:seed:import`
  The contract requires source URL/label, validates city, school, program, and scholarship references, and generates an ordered import plan with stable `entity:slug` idempotency keys before any production import path is allowed. The writer uses fixed parameterized PostgreSQL upserts and idempotent `catalog_source_evidence` insertion. Synthetic import/replay now passes on real local PostgreSQL; staging RDS import remains unverified.
- Verification updated on 2026-08-31:
- `npm run test:server` passes 431 server foundation, migration/configuration, policy, audit/redaction, Agent context/tool contracts, Auth/session/challenge/rate-limit, billing, student ownership, school tenant projection, catalog/seed, HTTP boundary, signed guest-session and application-lifecycle tests. These include mock repositories and contract checks; they do not establish complete business workflows or production readiness.
  - `npm exec tsc -b --pretty false` passes.
  - `npx eslint src/server tests/server scripts app/api` passes.
  - `npm run db:pg:check` passes and correctly reports that no local PostgreSQL URL or migration target environment is configured yet.
  - `npm run infra:production-check` is available for Alibaba Cloud/PostgreSQL deployment readiness checks and can fail CI/deployment with `CUAC_REQUIRE_PRODUCTION_READY=true`.
  - `npm run catalog:seed:dry-run` passes against the sample catalog seed bundle and prints ordered import operations.
  - `npm run build` passes and detects the catalog API routes, Agent context routes, auth register/session/logout/sign-in-continuation/email-verification/password-reset routes, billing contract routes, `GET /api/v1/health`, `GET /api/v1/me`, first student API routes, `GET /api/v1/school/applications`, and `GET /api/v1/school/applications/:applicationId`.
  - full `npm run lint` still fails on pre-existing demo/public and QA lint issues outside the new backend foundation.
- Dependency note: installing `pg` and `@types/pg` completed, but `npm install` reported 20 audit issues in the current dependency tree. Do not run breaking `npm audit fix --force` without a separate dependency hardening pass.
- Current `frontend/db/schema.ts` remains a D1/SQLite demo placeholder and is not authoritative for production PostgreSQL.

Modules:

- Database schema and migrations.
- Auth / Account.
- Tenant / Role / Policy.
- Audit / Logging.
- Catalog.
- Server test gates.

First tables:

- `users`
- `auth_identities`
- `auth_sessions`
- `user_roles`
- `school_staff_memberships`
- `cuac_staff_access_grants`
- `sign_in_continuations`
- `audit_logs`
- `cities`
- `schools`
- `programs`
- `program_intakes`
- `scholarships`
- `program_scholarships`
- `catalog_source_evidence`

First services:

- request context;
- session resolver;
- deny-by-default policy engine;
- audit writer;
- log redaction helper;
- catalog repository;
- public catalog DTO mappers.

First APIs:

- `GET /api/v1/health`
- `GET /api/v1/me`
- `GET /api/v1/school/applications`
- `GET /api/v1/school/applications/:applicationId`
- `GET /api/v1/catalog/cities`
- `GET /api/v1/catalog/schools`
- `GET /api/v1/catalog/schools/:schoolId`
- `GET /api/v1/catalog/programs`
- `GET /api/v1/catalog/programs/:programId`
- `GET /api/v1/catalog/scholarships`
- `GET /api/v1/catalog/scholarships/:scholarshipId`

Exit gates:

- Migrations run cleanly in dev and staging.
- Public catalog APIs return no student, payment, school tenant, or Ops private data.
- Authenticated endpoints ignore client-supplied `userId` as authority.
- School staff roles cannot be self-granted.
- CUAC internal roles cannot be self-granted.
- Audit writer and redaction tests pass.

## 5. Stage 2: Student Core

Purpose: make the student account and application preparation experience real.

Modules:

- Student Profile.
- Saved Items.
- Application Sets.
- Application Choices.
- Guest continuation.
- Consent.

Tables:

- `student_profiles`
- `saved_items`
- `application_sets`
- `application_choices`
- `application_choice_status_events`
- `consent_records`

APIs:

- register and sign in;
- profile read/update; started as `GET/PATCH /api/v1/student/profile`;
- saved school/program/scholarship read/write; started as `GET/POST /api/v1/student/saved-items`;
- application set create/read/update; started as `GET/POST /api/v1/student/application-sets` and `GET /api/v1/student/application-sets/:applicationSetId`;
- choice add/remove/reorder/update: add POST, fixed-target DELETE, revision-checked notes/scholarship PATCH and atomic full-order PUT locally verified; program/intake binding is implemented; full submission remains pending.
- sign-in continuation consume;
- consent record capture.

Agent scope:

- guest can use public catalog and temporary page context;
- after login, selected context candidates can be confirmed into profile/preferences;
- Agent may help compare and prepare choices, but it does not submit or mutate high-risk state without normal APIs.

Exit gates:

- Student can access only their own profile, saved items, and applications.
- Guest continuation does not become authority.
- Closing the page does not persist raw guest conversation.
- Important Agent memory is structured, scoped, and user-confirmed.
- No sensitive document upload is accepted.

## 6. Stage 3: Application Submission And Billing

Purpose: turn application preparation into a controlled submission and payment flow.

Current status:

- Billing business schema and exact per-project entitlement foundation are locally verified with `billing_customers`, `invoices`, `invoice_lines`, `payments`, `payment_status_events`, and `application_fee_entitlements`.
- Billing Facade service boundary has started for student-owned fee previews and hosted checkout intent creation.
- Contract-only billing HTTP routes have started for `POST /api/v1/billing/fee-preview` and `POST /api/v1/billing/checkout-intents`; runtime fails closed until real repository/provider wiring is added.
- PostgreSQL Billing repository boundary has started for owner lookup, billable choice reads, invoice creation, invoice line creation, and payment business-state creation; checkout creation still requires an injected hosted provider adapter.
- New v2 application-fee lines and entitlements bind one exact program/intake choice; same-school projects stay independent. Internal grant/currentness, concurrent convergence, refund invalidation, audit rollback, populated upgrade and minimal preflight projection pass local PostgreSQL and HTTP gates.
- Raw payment credentials are rejected before repository access; migration tests assert no raw card, CVV/CVC, bank account, routing number, payment token, or raw source columns exist.
- Checkout intent audit metadata records business facts only and does not store provider checkout URLs, provider session IDs, or provider metadata payloads.
- Real hosted payment provider integration, signed webhooks, refunds, and live charging remain deferred.

Modules:

- Fee engine.
- Billing Facade.
- Hosted checkout.
- Payment status.
- Application submission.
- School application creation.

Tables:

- `billing_customers`
- `invoices`
- `invoice_lines`
- `payments`
- `payment_status_events`
- `application_fee_entitlements`
- `application_submissions`
- `school_applications`
- `school_application_status_events`

APIs:

- fee preview;
- hosted checkout session create;
- payment status read;
- payment provider webhook;
- submit application set;
- school application records read through safe projections.

Rules:

- Fee calculation is server-side.
- Payment provider webhooks require signature verification.
- Submit action is idempotent.
- No school application is created before paid or not-required entitlement state.
- CUAC stores provider IDs, invoice state, amount, currency, and status only.

Exit gates:

- Repeated submit cannot duplicate school applications.
- Client cannot override payment amount, discount, or paid status.
- Raw card/CVV/bank data never enters CUAC database, logs, Agent memory, or prompts.
- Payment and submission events are audited.

## 7. Stage 4: School Portal

Purpose: give school staff a tenant-safe admissions workspace.

Current status:

- School portal service/repository projection foundation has started.
- Thin tenant-scoped school application queue/detail HTTP routes have started.
- School staff tenant context is now verified through active membership lookup before school portal reads.
- School queue and applicant detail projection reads now write audit metadata without raw applicant projection payloads.
- No full school write APIs, exports, integrations, or Agent execution have been enabled.
- School-facing reads are designed around `school_applications.school_visible_profile_json` and `routing_metadata_json`, not raw student profiles or all student application choices.

Modules:

- School tenant queue.
- Applicant projection.
- Status workflow.
- Owner assignment.
- Contact logs.
- Tenant exports.
- School dashboard.

Tables:

- `school_application_assignments`
- `school_application_contact_logs`
- `school_application_exports`
- `school_staff_activity_events`

APIs:

- school queue list;
- applicant detail projection;
- status update;
- owner assignment;
- contact log create;
- export job create/download;
- school dashboard summary.

Agent scope:

- school Agent can summarize tenant-safe school data;
- school Agent uses scripts/projections, not raw tables;
- school Agent cannot see other schools selected by the student;
- school Agent cannot access student private memory.

Exit gates:

- School staff sees only own tenant records.
- Applicant detail never reveals other selected schools.
- Exports are tenant-scoped, short-lived, and audited.
- Cross-tenant attempts are denied and audit-ready.

## 8. Stage 5: Agent MVP

Purpose: make Agent useful without making it a privileged bypass.

Modules:

- Agent persona sessions.
- Agent context candidates.
- Agent memory entries.
- Tool Gateway.
- Retrieval Gateway.
- Tool registry.
- Action preview and confirmation.
- Agent audit.

Tables:

- `agent_persona_sessions`
- `agent_context_candidates`
- `agent_memory_entries`
- `agent_tool_registry`
- `agent_tool_invocations`
- `agent_action_previews`
- `agent_audit_events`

Current status:

- Agent context lifecycle schema and service boundary have started.
- Agent context PostgreSQL repository boundary has started.
- Contract-only Agent context HTTP routes have started for candidate creation and guest-to-student carry-forward.
- Agent context audit metadata has started through an injectable audit sink that avoids raw summary storage.
- Guest context can produce only short-lived public/low-sensitive candidates.
- Guest-to-student carry-forward requires an authenticated student context, the same guest session binding, and user confirmation.
- Durable memory is namespace-scoped by persona, such as `user:{user_id}:student` or `school:{tenant_school_id}:staff`.
- Payment-sensitive, secret, and audit-security data classes are rejected from Agent context/memory.
- Student memory list/clear/opt-out, revision/capacity controls and the 365-day database retention ceiling are locally verified; school/Ops durable memory is not implemented.
- Expiry scrubbing exists only as an internal bounded transaction with metadata-only audit; no public route, Agent tool or production scheduler is enabled.
- Full Agent tool invocation execution, raw transcript storage, private retrieval, and natural-language mutations remain deferred.

Allowed first tools:

- catalog search/detail;
- navigation;
- student preference summary;
- student application summary;
- school queue summary;
- school applicant projection summary;
- Ops governed metric summary.

Prohibited:

- SQL execution;
- arbitrary database export;
- raw payment access;
- secrets access;
- other-student reads;
- cross-school reads;
- admissions decisions;
- payment/application state overrides.

Exit gates:

- Agent has no database credentials.
- Tool Gateway rejects unregistered tools.
- Retrieval lanes obey persona, role, tenant, data class, projection, memory namespace, redaction, and audit rules.
- Prompt injection tests pass.
- High-risk actions require preview, user confirmation, policy decision, domain service execution, and audit.

## 9. Stage 6: Ops Admin And Analytics

Purpose: make CUAC operations manageable without creating unsafe admin superpowers.

Modules:

- Ops access grants.
- Support access sessions.
- Data quality queues.
- Routing queues.
- Payment review queues.
- Governed metric registry.
- Dashboard APIs.
- Analytics events.

Tables:

- `ops_support_sessions`
- `ops_queue_items`
- `catalog_review_tasks`
- `routing_jobs`
- `routing_job_events`
- `analytics_events`
- `metric_definitions`
- `metric_snapshots`

Rules:

- Ops cross-tenant access requires role, purpose, and audit.
- Analytics Agent cannot run arbitrary SQL.
- Metrics are defined in code or governed registry, not invented from prompts.
- Admin panel UI changes must not define raw data access.

Exit gates:

- Support lookup requires a reason.
- Ops actions write audit records.
- Metric definitions are reproducible.
- Dashboards use governed APIs, not ad hoc database queries.

## 10. Stage 7: Notifications And Lifecycle Automation

Purpose: keep students, schools, and Ops informed through reliable event-driven communication.

Modules:

- Notification preferences.
- In-app notifications.
- Email/SMS provider facade.
- Template registry.
- Delivery jobs.
- Retry/dead-letter handling.

Tables:

- `notification_preferences`
- `notification_templates`
- `notification_events`
- `notification_deliveries`

Events:

- account verification;
- application choice changed;
- payment required;
- payment completed;
- application submitted;
- school first contact;
- school status changed;
- missing information;
- Ops review required.

Exit gates:

- Users can manage notification preferences where legally and product-wise appropriate.
- Delivery jobs are idempotent.
- Sensitive fields are not leaked into message templates.
- Failed delivery has retry and operational visibility.

## 11. Stage 8: Infrastructure Hardening

Purpose: make the product operable on Alibaba Cloud.

Deliverables:

- Alibaba Cloud dev/staging/production environment layout.
- RDS PostgreSQL backup and restore policy.
- Migration procedure.
- Secrets and environment variable management.
- CI/CD pipeline.
- Error monitoring and request logging.
- Audit retention policy.
- Rate limiting.
- Security scan and secret scan.
- Incident runbooks.

Required checks:

- type check;
- lint;
- unit tests;
- API contract tests;
- migration tests;
- authorization tests;
- tenant isolation tests;
- payment idempotency tests;
- Agent sandbox tests;
- prompt injection tests;
- log redaction tests;
- backup restore drill.

Exit gates:

- Staging matches production architecture.
- Production deploy can roll forward safely.
- Restore drill completed.
- Critical secrets are not in repo, database rows, logs, prompts, or frontend bundles.

## 12. Stage 9: Beta Launch

Purpose: launch with limited real users while keeping scope controlled.

Beta scope:

- selected student users;
- limited catalog;
- selected school partners;
- hosted payment in test or limited live mode;
- Agent restricted to catalog, navigation, and low-risk summaries;
- Ops workflows monitored closely.

Beta exit gates:

- No known high-severity auth, tenant, payment, or Agent sandbox issues.
- Application submission and school handoff work end to end.
- Support process handles failed payments and school follow-up.
- Audit logs are useful during real support review.
- Product analytics show core funnel health.

## 13. Stage 10: Production Launch

Purpose: public launch of the complete MVP.

Launch checklist:

- Production RDS PostgreSQL ready with backups.
- Production backend deployed on Alibaba Cloud.
- Production frontend configured for real APIs.
- Auth live.
- Hosted payment live if payment is part of launch.
- Email/in-app notifications live.
- School tenant onboarding process ready.
- Ops Admin read and essential workflow surfaces ready.
- Agent MVP enabled behind feature flags.
- Incident response and rollback plan ready.

Definition of launch-complete:

- public catalog is database-backed;
- students can register, save, prepare, pay if required, and submit;
- school staff can review only their tenant applications;
- CUAC Ops can monitor routing, data quality, billing status, and support cases;
- Agent can assist within strict sandbox limits;
- audit and security tests pass;
- production monitoring and backup are operating.

## 14. Stage 11: Post-Launch Expansion

Do after stable MVP launch:

- sensitive document upload with malware scanning, retention, access policy, and OSS isolation;
- deeper school system integrations;
- school self-service catalog edits;
- advanced scholarship matching;
- advanced Agent workflow execution;
- multilingual support expansion;
- richer analytics warehouse;
- refund automation;
- mobile app or mini-program surfaces;
- additional payment providers.

Do not add these until the foundation is stable:

- Agent access to private vector indexes;
- autonomous external email sending;
- raw document summarization;
- school cross-tenant reporting;
- natural-language Ops write operations.

## 15. Practical Build Order

Recommended immediate execution order:

1. Accept this roadmap and mark `CUAC_BACKEND_ADR_0001_PHASE0_1_FOUNDATION.md` as accepted. Done on 2026-08-28.
2. Choose Drizzle versus Prisma. Current recommendation: Drizzle with PostgreSQL for TypeScript-first backend.
3. Choose backend root: dedicated backend package or `frontend/src/server` plus thin API adapters. Initial foundation now uses `frontend/src/server`.
4. Create backend skeleton and test scaffold. Started on 2026-08-28.
5. Create PostgreSQL migration 001 for identity, role, tenant, audit, and catalog. Done as `frontend/drizzle/pg/0000_solid_oracle.sql`.
6. Implement request context, session resolver, policy engine, audit writer, and redaction helper. Request context, policy, audit event building, and redaction have started.
7. Implement health, current actor, auth credentials, and public catalog APIs. Their service/repository/route foundations, Auth challenge/invite/email-composer/rate-limit contracts, migration runner and catalog seed writer exist. Local PostgreSQL and built-API HTTP rehearsals now verify identity/challenge lifecycles, owner/tenant boundaries, shared request controls, signed guest bootstrap and the narrow Agent candidate/control/retention lifecycle, including owner-scoped active pending limits. Next complete control UX, scheduled maintenance monitoring, broader permission-change races and real browser/cloud routes; then staging RDS migration/restore, approved external email delivery, school invite full management, Gateway/WAF abuse rules and deep DB readiness. See `CUAC_POSTGRES_REHEARSAL_REPORT.md` and `CUAC_HTTP_SECURITY_AND_GUEST_SESSION_CONTRACT.md`; none of this closes live service acceptance.
8. Add student profile, saved items, and application choice APIs. Service/repository/HTTP and audit foundations exist; local PostgreSQL owner-scope tests and student profile/application network smoke pass. Current field contracts and transactional success audits pass fault-injection tests. Two application POSTs now require idempotency keys with receipt/audit atomicity and disconnect recovery tests. Receipt lifecycle/quotas and workflow completion remain; integrate the frontend only after the user-controlled Hub/Application contract settles.
9. Add school portal APIs after submission creates school-scoped records. Tenant-filtered queue/detail projections and active membership verification pass real PostgreSQL/handler tests using synthetic applications. School network workflows and real submission routing remain unverified; status/contact write APIs follow accepted workflow contracts.
10. Add Billing Facade and hosted checkout only after student core works.
    Billing Facade business-state schema, service boundary, PostgreSQL repository boundary, runtime route composition, fee schedule validation, contract-only API adapters and exact per-project entitlement/currentness have passed local PostgreSQL/HTTP/Linux gates. Next work is reviewed production pricing, signed webhook/refund/reconciliation state machines and later hosted-provider integration behind explicit production gates; no live provider is enabled.
11. Add Agent Tool Gateway after policy, audit, catalog, and student core are proven. Candidate confirmation, student controls and finite retention are locally proven, but full tool execution, private retrieval, school/Ops memory and production scheduling remain closed.
12. Add Ops dashboards and governed analytics after core events exist.
13. Harden infrastructure and run staging launch rehearsal.
    Production readiness, environment templates, and migration safety checks have started. Next work is real Alibaba Cloud staging variables, RDS migration rehearsal, backup/restore drill, and deployment pipeline integration.
14. Run beta.
15. Launch production.

## 16. Master Completion Criteria

CUAC is product-complete for MVP when all of the following are true:

- PostgreSQL is the authoritative source for production data.
- The frontend no longer depends on static demo state for core workflows.
- Students can complete the full path from discovery to submitted application.
- Payment state is authoritative, server-side, and isolated from raw credentials.
- School staff can process only their own tenant applications.
- Ops can manage catalog quality, routing, support, and billing status through governed APIs.
- Agent can help students, school staff, and Ops within persona, role, tenant, data-class, projection, retrieval, memory, and audit boundaries.
- Notifications and background jobs are reliable and observable.
- Security tests pass for auth, ownership, tenant isolation, Agent sandbox, prompt injection, payment isolation, log redaction, and audit.
- Alibaba Cloud production environment has backups, monitoring, secrets, CI/CD, and rollback procedures.
