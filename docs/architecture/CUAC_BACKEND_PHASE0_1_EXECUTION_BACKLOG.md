# CUAC Backend Phase 0/1 Execution Backlog

Date: 2026-08-26

Status: actionable backlog for foundation execution only.

Latest execution update (2026-09-01): the reviewed chain now extends through `0032_agent_candidate_capacity`. Each application remains one `student + program + intake`; no school-level record merges same-school projects. `0030` atomically creates one Program Application per choice and adapts transport through policy-driven groups without sharing evidence, state or outcome. `0031` limits confirmed low-sensitive student memory to 365 days; `0032` caps active pending candidates at 12 per verified guest browser binding and 24 per student account with transaction-safe last-slot serialization. A persistent loopback PostgreSQL + Node API runtime now runs all 33 migrations and verifies a synthetic same-school/two-program application. Current gates pass 523/523 regular, 477/477 PostgreSQL plus built HTTP and 7/7 Linux migration tests; the dedicated PostgreSQL entry is 379/379 and overlaps the HTTP total. Schema is 33 migrations, 24 snapshots and 58 tables. Public submit, worker/provider delivery, live payment, school/Ops writes and full Agent execution remain closed. See [local development runbook](CUAC_LOCAL_DEVELOPMENT_RUNBOOK.md), [candidate capacity contract](CUAC_AGENT_CANDIDATE_CAPACITY_CONTRACT.md), [memory retention contract](CUAC_AGENT_MEMORY_RETENTION_CONTRACT.md), [atomic submission contract](CUAC_ATOMIC_APPLICATION_SUBMISSION_CONTRACT.md) and [rehearsal record](CUAC_POSTGRES_REHEARSAL_REPORT.md).

Historical execution update (password milestone, 2026-09-01): local PostgreSQL 16.13 rehearsal runs via `npm run db:pg:rehearse`. Twenty-four journal migrations and 335 database tests passed; catalog/invite bugs plus orphan registration, stale role authority and missing SQL/relational scope were reproduced and fixed. Regular server tests: 470/470 passed after BE-0710 added fixed scrypt v2 writes and atomic legacy-login upgrades; real PostgreSQL covers upgrade/session/audit rollback, reset races and competing legacy proofs. `npm run db:http:rehearse` passes 424 tests, including 334 database subtests, 89 real-network/lifecycle subtests through the built API and the parent. Choice removal, notes/scholarship editing and complete ordering are locally verified with revision conflicts, draft freeze and per-program application scope. Requirement version/public-read foundations also pass exact-scope, publication/time, corruption and upgrade gates; internal prepare, independent approval, CAS publish/withdraw and atomic audit are also verified; private assessment records and their independent revision, owner-only API, raw scales/forms, erasure and atomic audit are now verified; notice versions, independent approval, exact-locale public reads and CAS publish/withdraw are also verified without collecting consent; single-choice preflight is verified as a read-only preparation report, not a consent or submission decision; exact school-application/choice target identity is also verified, including null and per-intake isolation, database-generated keys that cannot be directly overridden, concurrent FK enforcement and rejected conflicting upgrades; real-source admission and Ops write transport remain pending. The managed application entry also passes real API/database drain and has prior independent 3/3 Linux OS-signal evidence (not rerun in this batch); see [application lifecycle contract](CUAC_APPLICATION_LIFECYCLE_CONTRACT.md). Current Auth/student/context input contracts, Origin/body/cache guards and signed guest initialization/rotation are locally verified. See [rehearsal record](CUAC_POSTGRES_REHEARSAL_REPORT.md), [HTTP contract](CUAC_HTTP_SECURITY_AND_GUEST_SESSION_CONTRACT.md) and [Auth input contract](CUAC_AUTH_INPUT_CONTRACT.md). Agent confirmation and student-only memory control APIs are locally verified, including reset-revision conflicts, precise keyset pagination, a 100-entry cap and role-lock races; sweep remains internal; control UX/retention/scheduling, real-provider delivery and other external-effect outboxes, ECS credential capacity, MFA, full browser/cloud route checks, broader permission-change/write coverage and staging RDS rehearsal remain open.

Migration baseline update: the SQL chain through `0032` matches the ORM-derived real PostgreSQL schema. The 33 migrations have a reviewed twenty-four-snapshot lineage, historical byte hashes, pinned tools, guarded generation and pre-connect artifact checks. Execution adds transaction-scoped mutual exclusion, exact live-ledger prefix/hash checks, populated historical upgrades and connection-failure evidence. Detached release `b881c770d1a830dd152cecd760cd8cdd983b634154786fd0dad4593e885b94ca` and the separate seven-test non-root/read-only Linux gate pass locally; see [Linux runtime contract](CUAC_POSTGRES_LINUX_RUNTIME_CONTRACT.md). BE-0713 remains open for trusted CI/signatures, patch review, actual cloud runtime enforcement, domain backfills and RDS restore evidence; application transport remains BE-0714.

Auth verification/reset outbox is locally verified (BE-0718): migration 0023 adds encrypted short-lived token transport, owner-bound challenge FKs, committed-job leases, pre-send identity checks, bounded explicit-nonacceptance retries and uncertain-result quarantine. Challenge/enqueue/success audit share one transaction; terminal jobs erase ciphertext. Nineteen business-database cases, one nonempty upgrade and seven regular cases cover tampering, missing keys, rollback, concurrency, expiry and lost acknowledgements. This is not provider acceptance of real mail: the runtime remains deferred unless explicitly configured; no provider, scheduler, frontend action page or Agent access is enabled. See [auth email outbox contract](CUAC_AUTH_EMAIL_OUTBOX_CONTRACT.md).

Primary ADR: `CUAC_BACKEND_ADR_0001_PHASE0_1_FOUNDATION.md`

Owner-only per-choice material selection drafts are now locally verified: migration 0022 stores only explicit field/record references, four source versions and an independent CAS revision. Clearing preserves the revision; source changes/removal require explicit review; choice removal atomically deletes the associated selection. Six regular, fifteen business-database, one populated-upgrade and six real-network cases cover isolation, races, audit rollback and corruption rejection. This is not consent or a material snapshot and grants no Agent/school access. See [material selection contract](CUAC_APPLICATION_MATERIAL_SELECTION_CONTRACT.md).

Owner-only per-program authorization is now locally verified: `0024` stores only bounded evidence and hashes, not material bodies. Recording, replay, supersede, withdrawal, staleness, concurrency, audit rollback, role revocation, choice removal and same-school project separation have real database and built-network evidence. Preflight remains read-only and `canSubmit=false`; no school/Agent/Billing reader is added.

Owner-only per-program material snapshots are now locally verified: `0025` stores one authenticated encrypted payload per authorization and no second plaintext body. Original-key replay, different-key concurrency, exact target FKs, tamper/missing-key rejection, audit rollback, nonempty historical upgrade and built-network lock overlap have evidence. Preflight remains read-only and `canSubmit=false`; no school/Ops/Agent/Billing reader is added.

Official-submission Slice A through D2 is now locally verified: `0026` governs exact route/target policy, `0027` stores the explicit choice route, `0028` binds v2 authorization/snapshot evidence, `0029` binds exact application-fee entitlement, and `0030` creates the atomic internal submission, Program Applications, transport groups/members and inert outbox. Existing choices and v1 evidence receive no inferred authority. Same-school programs remain independent under both one-program and multi-program official forms. Launch policy/price data, public submit, live payment, outbox worker/provider delivery and school writes remain deferred.

## 1. Scope

This backlog covers only Phase 0 and Phase 1.

In scope:

- architecture lock;
- database and ORM decision;
- backend module skeleton;
- unified account model;
- RBAC and tenant policy foundation;
- audit log foundation;
- CSCAlite catalog schema foundation;
- public catalog read APIs;
- payment business-state schema and Billing Facade contract only;
- billing runtime fee preview wiring with explicit safe fee configuration;
- Alibaba Cloud/PostgreSQL production readiness checks;
- security test scaffolding.
- frontend intent alignment only against `D:\CODE\CUAC\design-lab\home-v3.html` when a frontend reference is necessary.

Out of scope:

- full Agent execution;
- real payment charging, webhook reconciliation, or refunds;
- school portal complete write workflows;
- Ops Admin CRUD and internal write APIs;
- file upload and document management;
- school system integration;
- deployment or production launch.
- treating `frontend/public` pages, `home-v5.html`, or older design-lab variants as backend API/database contracts.

## 2. Epic A: Phase 0 Architecture Lock

### BE-0001: Approve Secure Backend Baseline

Description:

Review and approve `CUAC_SECURE_AGENT_BACKEND_ARCHITECTURE.md` as the governing security baseline.

Definition of Done:

- architecture owner accepts Agent no-direct-DB rule;
- payment-sensitive data isolation is accepted;
- tenant isolation invariant is accepted;
- Tool Gateway model is accepted;
- deferred surfaces are documented as out of scope.

### BE-0002: Decide PostgreSQL Hosting And Environment Strategy

Description:

Choose production PostgreSQL hosting and environment layout.

Definition of Done:

- dev, staging, production database strategy documented;
- migration execution path documented;
- backup/restore expectation documented;
- connection pooling decision captured;
- D1 is explicitly non-authoritative for transactional core.

### BE-0003: Decide ORM Source Of Truth

Description:

Choose Drizzle or Prisma as the single production schema source.

Definition of Done:

- one ORM selected;
- migration command selected;
- generated-client workflow selected if applicable;
- test database setup documented;
- old/demo schema locations marked as non-authoritative.

### BE-0004: Decide Auth Provider And Session Strategy

Status: started on 2026-08-28.

Current evidence:

- Session-cookie resolver exists at `frontend/src/server/auth/session.ts`.
- Browser session tokens are SHA-256 hashed before lookup.
- Resolver ignores client-supplied `userId`, `role`, and `schoolId` authority hints.
- Expired, revoked, and inactive sessions fall back to guest context.
- Student email/password registration, login, and logout/session revocation contract APIs exist at `POST /api/v1/auth/register`, `POST /api/v1/auth/sessions`, and `POST /api/v1/auth/logout`.
- Passwords use salted `scrypt` hashes.
- New browser session tokens are stored only as SHA-256 hashes.
- Student self-registration grants only the student role.
- Logout clears the HttpOnly session cookie and revokes sessions by hashed token only.
- Sign-in continuation contract APIs exist at `POST /api/v1/auth/sign-in-continuations` and `POST /api/v1/auth/sign-in-continuations/:continuationId/consume`.
- Continuations are consumed by id + one-time token + authenticated server session; continuation tokens are stored only as SHA-256 hashes and guest browser session binding is enforced before login state is carried forward.
- Email verification challenge contract APIs exist at `POST /api/v1/auth/email-verification` and `POST /api/v1/auth/email-verification/:challengeId/verify`.
- Email verification tokens are stored only as SHA-256 hashes and are sent only to an injectable delivery sink; HTTP responses do not return verification tokens.
- Password reset challenge contract APIs exist at `POST /api/v1/auth/password-reset` and `POST /api/v1/auth/password-reset/:challengeId/reset`.
- Password reset requests do not reveal whether an account exists; reset tokens are stored only as SHA-256 hashes, new passwords are stored only as salted `scrypt` hashes, and successful resets revoke the user's active sessions.
- Auth email message composer exists at `frontend/src/server/auth/email-delivery.ts`; it creates provider-neutral email verification and password reset messages with HTTPS action links.
- Production readiness now requires Auth email delivery posture before staging/production; external provider adapter implementation remains deferred until the provider and data-processing boundary are explicitly approved.
- Auth rate-limit foundation exists at `frontend/src/server/auth/rate-limit.ts`; it defines stable actions for registration, login, logout, email verification, password reset, school invite create/accept/revoke, and sign-in continuation, hashes normalized subject keys, includes a PostgreSQL store for fixed hash-key bucket upserts, and returns stable 429 errors when a quota is exceeded.
- Auth credentials, email verification, password reset, and sign-in continuation HTTP handlers accept an injectable rate limiter and return 429 before business repository writes or challenge creation when blocked.
- Production readiness now requires staging/production Auth endpoints to enforce shared rate limiting through API Gateway or WAF until Redis support is implemented; single-process memory and PostgreSQL-only limiting are not accepted for deployment.
- School staff invite create/revoke/accept service/repository/HTTP contract exists at `frontend/src/server/auth/school-invites.ts`, `frontend/src/server/auth/school-invites-postgres-repository.ts`, `frontend/src/server/auth/school-invites-http.ts`, and routes `POST /api/v1/auth/school-invites`, `POST /api/v1/auth/school-invites/:inviteId/revoke`, and `POST /api/v1/auth/school-invites/:inviteId/accept`.
- School invite creation/revocation requires CUAC Ops/Admin; creation locks the active school within a READ COMMITTED transaction before revoking and inserting, and a partial unique index enforces one pending invite per school/email. Acceptance requires authenticated server session, invited email match, active pending invite, and hashed invite token lookup; HTTP body authority fields such as `userId`, `schoolId`, and `role` are ignored.
- Route responses do not return password hashes, session token hashes, raw session tokens, or raw password data.
- Full OAuth/SSO/MFA, real email provider delivery, school invite list/resend/full management UI, school/Ops self-registration, concrete Alibaba Cloud Gateway/WAF rule provisioning, and optional Redis limiter adapter remain open/deferred.

Description:

Choose first auth/session implementation.

Definition of Done:

- password/OAuth/SSO MVP boundary documented;
- student email/password MVP boundary implemented for contract routes;
- session cookie attributes documented;
- MFA requirement for school and Ops documented;
- unified account model accepted;
- school staff and CUAC internal authority cannot be self-granted.

### BE-0005: Decide AI Provider Data Retention Setting

Description:

Choose AI provider configuration for future Agent MVP.

Definition of Done:

- provider selected or placeholder approved;
- retention posture documented;
- no-training/business-data terms reviewed;
- high-sensitivity flows excluded until policy is approved;
- logging/redaction requirements accepted.

## 3. Epic B: Backend Skeleton

### BE-0101: Create Modular Backend Structure

Status: started on 2026-08-28.

Current evidence:

- `frontend/src/server` exists with initial shared, policy, audit, Agent, and database modules.
- `frontend/tests/server` exists with policy, audit, Agent, and PostgreSQL migration guard tests.

Description:

Create source structure for foundation modules without implementing deferred business workflows.

Suggested modules:

```text
auth
policy
catalog
student
applications
billing
schoolPortal
agent
audit
common
```

Definition of Done:

- module folders created;
- dependency direction documented;
- `agent` cannot import DB repository modules directly;
- `billing` interface exposes business status only;
- common request context type includes `requestId`.

### BE-0102: Add Request Context And Error Contract

Status: started on 2026-08-28.

Current evidence:

- Shared error envelope exists at `frontend/src/server/shared/errors.ts`.
- Health HTTP route exists at `frontend/app/api/v1/health/route.ts`.
- Health service exists at `frontend/src/server/health/health.ts`.
- Runtime health now executes a shared-pool probe; configuration alone cannot return 200. Tests cover 503 under pool saturation, recovery, and no database URL, host, password or driver errors in responses.

Description:

Implement or specify shared request context and structured API error shape.

Definition of Done:

- `requestId` generated for every request;
- error shape matches `CUAC_APPLICATION_API_CONTRACT.md`;
- no sensitive payload is included in errors;
- policy denials return stable codes.

## 4. Epic C: Identity And Auth Schema

### BE-0201: Add User And Identity Tables

Status: started on 2026-08-28.

Current evidence:

- PostgreSQL migration creates `users`, `auth_identities`, `auth_sessions`, and `user_roles`.
- PostgreSQL Auth session repository exists at `frontend/src/server/auth/postgres-repository.ts`.
- Auth credentials service exists at `frontend/src/server/auth/credentials.ts`.
- Auth credentials HTTP handlers exist at `frontend/src/server/auth/credentials-http.ts`.
- Sign-in continuation service exists at `frontend/src/server/auth/continuations.ts`.
- Sign-in continuation PostgreSQL repository exists at `frontend/src/server/auth/continuations-postgres-repository.ts`.
- Sign-in continuation HTTP handlers exist at `frontend/src/server/auth/continuations-http.ts`.
- Email verification service exists at `frontend/src/server/auth/email-verification.ts`.
- Email verification PostgreSQL repository exists at `frontend/src/server/auth/email-verification-postgres-repository.ts`.
- Email verification HTTP handlers exist at `frontend/src/server/auth/email-verification-http.ts`.
- Auth email message composer exists at `frontend/src/server/auth/email-delivery.ts`.
- Password reset service exists at `frontend/src/server/auth/password-reset.ts`.
- Password reset PostgreSQL repository exists at `frontend/src/server/auth/password-reset-postgres-repository.ts`.
- Password reset HTTP handlers exist at `frontend/src/server/auth/password-reset-http.ts`.
- Auth rate-limit service exists at `frontend/src/server/auth/rate-limit.ts`.
- Auth runtime limiter factory exists at `frontend/src/server/auth/runtime/rate-limit.ts`.
- School staff invite create/revoke/accept service exists at `frontend/src/server/auth/school-invites.ts`.
- School staff invite create/revoke/accept PostgreSQL repository exists at `frontend/src/server/auth/school-invites-postgres-repository.ts`.
- School staff invite create/revoke/accept HTTP handlers exist at `frontend/src/server/auth/school-invites-http.ts`.
- Auth credentials runtime route composition exists at `frontend/src/server/auth/runtime/routes.ts`.
- `GET /api/v1/me` exists at `frontend/app/api/v1/me/route.ts` and returns a safe current-actor projection.
- `POST /api/v1/auth/register` exists at `frontend/app/api/v1/auth/register/route.ts`.
- `POST /api/v1/auth/sessions` exists at `frontend/app/api/v1/auth/sessions/route.ts`.
- `POST /api/v1/auth/logout` exists at `frontend/app/api/v1/auth/logout/route.ts`.
- `POST /api/v1/auth/sign-in-continuations` exists at `frontend/app/api/v1/auth/sign-in-continuations/route.ts`.
- `POST /api/v1/auth/sign-in-continuations/:continuationId/consume` exists at `frontend/app/api/v1/auth/sign-in-continuations/[continuationId]/consume/route.ts`.
- `POST /api/v1/auth/email-verification` exists at `frontend/app/api/v1/auth/email-verification/route.ts`.
- `POST /api/v1/auth/email-verification/:challengeId/verify` exists at `frontend/app/api/v1/auth/email-verification/[challengeId]/verify/route.ts`.
- `POST /api/v1/auth/password-reset` exists at `frontend/app/api/v1/auth/password-reset/route.ts`.
- `POST /api/v1/auth/password-reset/:challengeId/reset` exists at `frontend/app/api/v1/auth/password-reset/[challengeId]/reset/route.ts`.
- Tests assert fixed active-session SQL, hashed token lookup, hashed-token-only revocation, active account requirement, expiry/revocation checks, no session-token leakage in the current actor response, password identity lookup by normalized email, salted password hashing, hashed session storage, student-only self-registration authority, HTTP-only session cookies, logout cookie clearing, sign-in continuation token hashing, internal-route continuation targets, sensitive payload preview rejection, server-session-only continuation consume, email verification token hashing, verification token omission from HTTP responses, Auth email composer HTTPS link validation, password reset anti-enumeration responses, reset token hashing, reset password hashing, post-reset session revocation, Auth rate-limit hashed subject keys, PostgreSQL rate-limit fixed SQL, runtime limiter factory fail-closed behavior, stable 429 behavior before business repository writes, thin route adapters, and no demo/static auth fallback.

Tables:

- `users`
- `auth_identities`
- `auth_sessions`
- `email_verification_challenges`
- `password_reset_challenges`
- `auth_rate_limit_buckets`
- `user_roles`

Definition of Done:

- UUID primary keys;
- email uniqueness strategy defined;
- session token stored hashed if server-side token is used;
- rate-limit subject keys stored hashed only;
- password hash stored salted and never returned;
- student self-registration cannot grant school or CUAC internal roles;
- timestamps included;
- account status states constrained.

### BE-0202: Add School Staff Membership Tables

Tables:

- `school_staff_invites`
- `school_staff_memberships`

Definition of Done:

- memberships are scoped to one school;
- invite tokens stored hashed;
- invite expiry/status modeled;
- school staff registration alone grants no tenant access.

### BE-0203: Add Internal Access Grant Table

Table:

- `cuac_staff_access_grants`

Definition of Done:

- CUAC Ops/Admin roles require approved grant;
- grants include status, reason, source, approver, timestamps;
- approval/revocation is audit-ready.

### BE-0204: Add Sign-In Continuation Table

Table:

- `sign_in_continuations`

Definition of Done:

- token stored hashed;
- expiry and one-time consumption modeled;
- minimal action payload only;
- no student profile, payment data, school queue, or Agent memory payload.

## 5. Epic D: Policy And Tenant Foundation

### BE-0301: Implement Deny-By-Default Policy Interface

Description:

Create the central policy interface used by manual APIs and future Agent tools.

Definition of Done:

- default decision is deny;
- policy input includes subject, action, resource, context, purpose;
- decision includes allow/deny/reason/redaction/confirmation requirement;
- unit tests cover allow, deny, require sign-in, require tenant, require support reason.

### BE-0302: Implement Object Ownership Helpers

Status: started on 2026-08-28.

Current evidence:

- Student ownership helper exists at `frontend/src/server/student/ownership.ts`.
- Student service boundary exists at `frontend/src/server/student/service.ts`.
- PostgreSQL Student repository exists at `frontend/src/server/student/postgres-repository.ts`.
- Student HTTP handlers and routes exist under `frontend/src/server/student/http.ts`, `frontend/src/server/student/runtime/routes.ts`, and `frontend/app/api/v1/student/...`.
- Student profile update, saved item save, application set create, and application choice add emit audit events through an injectable audit sink; PostgreSQL runtime injects `PostgresAuditWriter`.
- Tests cover student own-resource allow, direct-ID access denial for another student, data-class denial, guest denial, profile normalization, own-list methods using `actorUserId`, application choice writes only after owning the application set, route `applicationSetId` overriding request body authority, fixed SQL, parameterized JSON, owner fields, thin route adapters, no `select *`, and audit metadata that excludes raw profile values, preference payloads, and student notes.

Description:

Add helpers for student-owned resources.

Definition of Done:

- own profile;
- own saved item;
- own application set;
- direct-ID attack tests for other student records.

Remaining work:

- run service and repository against real PostgreSQL in staging/local test DB.
- integrate frontend student flows with these APIs once UI contracts are reviewed.

### BE-0303: Implement School Tenant Helpers

Status: started on 2026-08-28.

Current evidence:

- School portal service exists at `frontend/src/server/school-portal/service.ts`.
- PostgreSQL projection repository exists at `frontend/src/server/school-portal/postgres-repository.ts`.
- Thin HTTP handler and runtime composition exist at `frontend/src/server/school-portal/http.ts` and `frontend/src/server/school-portal/runtime/routes.ts`.
- Queue/detail route adapters exist at `frontend/app/api/v1/school/applications/...`.
- Request context resolver now supports server-side active school membership verification before preserving `tenantSchoolId`.
- `PostgresAuthSessionRepository` verifies `school_staff_memberships` with fixed SQL requiring matching user, school, active status, and `removed_at is null`.
- Tests cover school tenant queue using `RequestContext.tenantSchoolId`, guest/student denial before repository access, and cross-tenant application detail denial.
- HTTP tests cover server-session tenant authority, active membership verification, inactive membership rejection before repository reads, client `schoolId` spoofing ignored, guest rejection before repository access, route `applicationId` authority, and thin route files with no demo data reads.
- Repository tests assert school projection SQL does not query `application_choices`, `application_sets`, `student_profiles`, payment tables, or Agent runtime tables.
- School queue and applicant detail projection reads emit audit events through an injectable audit sink; PostgreSQL runtime injects `PostgresAuditWriter`.
- Service tests assert audit metadata records tenant, action, resource, result/status counts, and data classes without raw applicant projection payloads, routing metadata, contact fields, or status reasons.

Description:

Add helpers for active school memberships and tenant scoping.

Definition of Done:

- active membership required;
- tenant school ID resolved server-side;
- direct-ID access to another school denied;
- tests use two schools and two staff users.

Remaining work:

- run against real PostgreSQL in staging/local test DB.
- add school status/contact write APIs only after workflow contracts and audit requirements are accepted.

## 6. Epic E: Audit And Logging

### BE-0401: Add Audit Log Table

Table:

- `audit_logs`

Definition of Done:

- append-only normal app path;
- fields include actor, action, entity, tenant, request, policy decision, reason, data classes, snapshots/hashes;
- indexes support actor, entity, tenant, action, created time;
- no delete/update API is created.

### BE-0402: Implement Audit Writer

Status: started on 2026-08-28.

Current evidence:

- PostgreSQL audit writer exists at `frontend/src/server/audit/postgres-writer.ts`.
- Agent context runtime injects `PostgresAuditWriter` for candidate creation, memory creation, guest carry-forward, and denied sensitive candidate attempts.
- Student runtime injects `PostgresAuditWriter` for profile update, saved item save, application set create, and application choice add.
- School portal runtime injects `PostgresAuditWriter` for tenant queue and applicant detail projection reads.
- Billing Facade emits checkout intent audit metadata for payment business state without provider checkout URLs, provider session IDs, or provider metadata payloads.
- Audit tests cover fixed parameterized `audit_logs` insertion, JSONB data class/metadata handling, guest actor typing, redaction preservation, and no raw transcript, payment, student profile, preference payload, or note storage in audit metadata.

Description:

Add audit writer used by foundation routes and future sensitive actions.

Definition of Done:

- writes request ID and policy decision ID;
- redacts sensitive payloads;
- can record denied sensitive action metadata;
- tested independently.

### BE-0403: Implement Log Redaction Utility

Description:

Prevent secrets, tokens, payment-sensitive data, and raw PII from entering general logs.

Definition of Done:

- redacts password, token, cookie, authorization header, PAN-like values, CVV-like fields;
- test fixtures include nested JSON;
- logging policy references `CUAC_DATA_CLASSIFICATION_REGISTER.md`.

## 7. Epic F: Catalog Schema

### BE-0501: Add Catalog Core Tables

Status: started on 2026-08-28.

Current evidence:

- PostgreSQL Drizzle schema exists at `frontend/src/server/db/schema.ts`.
- Initial PostgreSQL migration exists at `frontend/drizzle/pg/0000_solid_oracle.sql`.
- Migration guard tests assert PostgreSQL dialect, foundation tables, and deferred payment/application/Agent runtime tables.

Tables:

- `cities`
- `schools`
- `programs`
- `program_intakes`
- `scholarships`
- `program_scholarships`
- `catalog_source_evidence`

Definition of Done:

- CSCAlite canonical field families preserved;
- JSONB lineage/source fields included where required;
- source status and verification timestamps included;
- public/private metadata distinction documented;
- indexes cover public search/filter fields.

### BE-0502: Add Catalog Seed Import Contract

Status: started on 2026-08-28.

Current evidence:

- Catalog seed validation contract exists at `frontend/src/server/catalog/seed-contract.ts`.
- Sample catalog seed bundle exists at `frontend/seeds/catalog.sample.json`.
- Dry-run command exists as `npm run catalog:seed:dry-run`.
- Dry-run now emits ordered import operations with stable `entity:slug` idempotency keys and dependency keys.
- PostgreSQL seed writer exists at `frontend/src/server/catalog/seed-writer.ts`.
- Write command exists as `npm run catalog:seed:import` and requires a configured PostgreSQL URL before it can write.
- Tests assert source evidence requirements, broken reference rejection, invalid bundle no-op behavior, import ordering, dependency keys, source lineage preservation, fixed-order parameterized upserts, idempotent evidence insertion SQL, and no SQL issued for invalid bundles.

Description:

Define how `migration-intake` and CSCAlite-like data enters catalog tables.

Definition of Done:

- source file families named;
- required field mapping documented;
- empty defaults for sparse demo records documented;
- source lineage generated per entity;
- seed import is idempotent.

Remaining work:

- map approved source file families from `migration-intake`;
- run idempotent PostgreSQL upsert writer against staging RDS or local PostgreSQL test database;
- add import audit event plan;
- document empty defaults for sparse source records.

## 8. Epic G: Public Catalog Read APIs

### BE-0601: Implement `GET /api/v1/programs`

Status: started on 2026-08-28. Public DTO mapper, service boundary, fixed-SQL PostgreSQL repository boundary, HTTP handler factory, app route files, PG runtime wiring, PG environment check, and migration runner exist. Current route composition uses PostgreSQL when `DATABASE_URL` / `POSTGRES_URL` / `PG_DATABASE_URL` is configured and fails closed with `SERVICE_UNAVAILABLE` when absent.

Definition of Done:

- supports stable filters from API contract;
- returns canonical CSCAlite-compatible camelCase fields;
- includes source status/lineage;
- excludes internal Ops notes;
- public/guest access allowed.

### BE-0602: Implement `GET /api/v1/programs/:programId`

Definition of Done:

- returns program detail with parent school and intakes;
- includes scholarships linked to program/school where public;
- includes source evidence summary;
- does not include tenant or application data.

### BE-0603: Implement `GET /api/v1/schools`

Status: started on 2026-08-28. Public DTO mapper tests assert staff memberships, tenant settings, internal quality fields, contact notes, and source notes are excluded. Repository tests assert school list SQL does not query tenant staff/application tables. App route file and PG runtime wiring exist.

Definition of Done:

- returns `SchoolRecord`-compatible fields;
- includes public aggregate counts;
- hides raw internal catalog quality workflow fields from student-facing mode;
- source lineage preserved.

### BE-0604: Implement `GET /api/v1/schools/:schoolId`

Definition of Done:

- returns public school detail;
- includes public programs and public scholarships summary;
- does not expose staff memberships, tenant state beyond public status, or application queue.

### BE-0605: Implement `GET /api/v1/scholarships`

Status: started on 2026-08-28. Public DTO mapper, app route file, and PG runtime wiring exist.

Definition of Done:

- distinguishes public scholarships from school-scoped funding signals;
- returns `PublicScholarship`-compatible fields;
- supports source status and deadline filters.

### BE-0606: Implement `GET /api/v1/cities`

Status: started on 2026-08-28. Public DTO mapper, app route file, and PG runtime wiring exist.

Definition of Done:

- returns `CityGuide` and `CityGuideAggregate`-compatible fields;
- aggregate counts are derived or clearly snapshotted;
- public guide content is safe for Agent retrieval.

## 8.5 Epic G2: Billing Business-State Foundation

### BE-0621: Add Billing Business Tables Without Raw Credentials

Status: started on 2026-08-28.

Current evidence:

- PostgreSQL schema includes `billing_customers`, `invoices`, `invoice_lines`, `payments`, and `payment_status_events`.
- Migration exists at `frontend/drizzle/pg/0003_billing_business_foundation.sql`.
- Migration journal includes `0003_billing_business_foundation`.
- Migration tests assert amount, currency, invoice/payment status, idempotency key, hosted-provider reference, and payment status event fields exist.
- Migration tests assert raw card number, CVV/CVC, bank account, account number, routing number, payment token, and raw card/source fields are not stored in CUAC billing tables.

Description:

Create payment business-state tables while keeping raw payment credentials outside CUAC.

Definition of Done:

- invoice/payment business status is modeled;
- hosted provider references are modeled;
- idempotency keys are modeled;
- raw card, CVV/CVC, bank, and provider payment token fields are absent;
- migration guard tests cover the payment isolation invariant.

Remaining work:

- run migration against local PostgreSQL or Alibaba Cloud staging RDS;
- wire runtime to `PostgresBillingRepository` after fee rules and hosted provider strategy are accepted;
- connect signed provider webhooks only after provider choice and secret strategy are approved.

### BE-0622: Add Billing Facade Service Contract

Status: started on 2026-08-28.

Current evidence:

- Billing Facade service exists at `frontend/src/server/billing/facade.ts`.
- Server export includes the billing service boundary.
- Tests exist at `frontend/tests/server/billing/facade.test.mjs`.
- Test runner includes the billing facade suite.
- Tests cover student-owned fee preview, guest/cross-student denial before fee calculation, nested raw payment credential rejection, and checkout intent audit metadata without provider URLs, provider session IDs, or provider metadata payloads.

Description:

Create a service boundary for fee preview and hosted checkout intent creation without implementing live charging.

Definition of Done:

- billing uses `RequestContext` and policy, not client-supplied user authority;
- fee preview is limited to the student who owns the application set;
- raw payment credential payloads are rejected before repository access;
- checkout intent output contains only hosted-provider business references;
- audit metadata records business facts only.

Remaining work:

- connect HTTP route adapters to a real repository after application submission UX/API contract is stable;
- add idempotent submit/paid entitlement flow before creating school applications from paid application sets.

### BE-0622A: Add PostgreSQL Billing Repository Boundary

Status: started on 2026-08-28.

Current evidence:

- PostgreSQL Billing repository exists at `frontend/src/server/billing/postgres-repository.ts`.
- Server export includes the repository boundary.
- Tests exist at `frontend/tests/server/billing/postgres-repository.test.mjs`.
- Test runner includes the PostgreSQL Billing repository suite.
- Tests cover fixed SQL for application set ownership, billable choice reads scoped by application set and user, no checkout creation without a hosted provider adapter, invoice/payment record creation with provider references only, no `select *`, no raw payment credential SQL fields, and no provider metadata payload persistence.

Description:

Create a PostgreSQL billing persistence boundary without enabling live provider execution.

Definition of Done:

- application set ownership is read with fixed parameterized SQL;
- billable choices are scoped by application set and user;
- invoice and payment records store business status and hosted-provider references only;
- checkout creation fails closed unless a hosted checkout provider adapter is injected;
- repository tests cover payment isolation and SQL field boundaries.

Remaining work:

- wire runtime to `PostgresBillingRepository` after approved fee schedule and provider adapter are configured;
- add transaction wrapper before production charging is enabled;
- run against local PostgreSQL or Alibaba Cloud staging RDS.

### BE-0623: Add Billing Contract HTTP Routes

Status: started on 2026-08-28.

Current evidence:

- Billing HTTP handler exists at `frontend/src/server/billing/http.ts`.
- Billing runtime route composition exists at `frontend/src/server/billing/runtime/routes.ts`.
- Contract-only API route adapters exist at `frontend/app/api/v1/billing/fee-preview` and `frontend/app/api/v1/billing/checkout-intents`.
- Server export includes billing HTTP and runtime boundaries.
- Tests exist at `frontend/tests/server/billing/http.test.mjs`.
- Runtime tests exist at `frontend/tests/server/billing/runtime-routes.test.mjs`.
- Test runner includes the billing HTTP suite.
- Tests assert billing HTTP resolves actor authority from the server session cookie, ignores body `userId`, rejects raw payment fields before checkout repository creation, rejects guests before repository access, keeps app route files thin with no demo/static data reads, validates explicit minor-unit fee schedules, rejects unsafe billing fee configuration, and preserves authenticated `SERVICE_UNAVAILABLE` behavior when the billing repository is unavailable.

Description:

Expose billing contract routes without enabling live payment provider execution.

Definition of Done:

- routes use server session authority, not client-supplied user IDs;
- routes call Billing Facade rather than fee logic in route files;
- no route reads frontend demo/static data;
- raw payment credential fields are rejected before checkout intent creation;
- runtime uses `PostgresBillingRepository` only when PostgreSQL and safe fee configuration are available;
- runtime fails closed until a real billing repository/provider is configured.

Remaining work:

- run contract HTTP routes against real PostgreSQL or Alibaba Cloud staging RDS;
- add transaction/idempotency hardening before live checkout;
- add provider integration and signed webhook handling only after secret strategy is approved;
- add end-to-end billing API tests against local PostgreSQL or Alibaba Cloud staging RDS.

### BE-0624: Add Billing Runtime Fee Schedule Gate

Status: started on 2026-08-28.

Current evidence:

- Billing runtime composition now validates `CUAC_APPLICATION_FEE_MINOR`, optional `CUAC_SERVICE_FEE_MINOR`, and `CUAC_BILLING_CURRENCY`.
- Fee amounts must be non-negative integer minor units.
- Currency must be a three-letter ISO-style code.
- Runtime composition injects `PostgresBillingRepository` and `PostgresAuditWriter` when PostgreSQL and fee configuration are available.
- Runtime composition fails closed if billing persistence, fee configuration, or hosted provider execution is unavailable.
- Tests cover safe fee parsing, unsafe fee config rejection, PostgreSQL-only route composition, audit writer injection, and authenticated `SERVICE_UNAVAILABLE` behavior.

Description:

Protect billing startup from ambiguous demo fees, unsafe client-defined amounts, and missing production configuration.

Definition of Done:

- production fee schedule is explicit in environment configuration;
- minor-unit parsing rejects decimals, negative numbers, and non-numeric values;
- unsafe currency codes are rejected;
- route runtime never falls back to frontend demo/static fees;
- repository/provider unavailability returns controlled errors without exposing payment internals.

Remaining work:

- replace placeholder flat fee schedule with approved product fee rules;
- add transaction boundary before provider adapter is enabled;
- verify against local PostgreSQL or Alibaba Cloud staging RDS.

## 9. Epic H: Infrastructure Readiness

### BE-0641: Add Alibaba Cloud Production Readiness Check

Status: started on 2026-08-28.

Current evidence:

- Production readiness module exists at `frontend/src/server/infra/production-readiness.ts`.
- CLI script exists at `frontend/scripts/production-readiness-check.ts`.
- NPM command exists as `npm run infra:production-check`.
- Tests exist at `frontend/tests/server/infra/production-readiness.test.mjs`.
- Server test runner includes the production readiness suite.

Description:

Turn Alibaba Cloud/PostgreSQL deployment assumptions into a repeatable check before staging and production rollout.

Definition of Done:

- PostgreSQL URL must be configured for staging/production and must not point to SQLite/D1/demo databases.
- Staging/production PostgreSQL must use SSL unless a private network path is explicitly approved.
- Alibaba Cloud region and app runtime are configured.
- Session secret is present, strong, and not a placeholder.
- Agent Tool Gateway and sandbox enforcement are required in staging/production.
- Direct Agent database access is rejected.
- Billing fee schedule is explicitly configured with safe minor-unit values.
- Live payment mode requires provider name and strong webhook secret.
- Alibaba Cloud KMS or secret manager posture is checked.
- Sensitive file upload requires private OSS storage.
- CI/deployment can enforce hard failure with `CUAC_REQUIRE_PRODUCTION_READY=true`.

Remaining work:

- run the check with real Alibaba Cloud staging environment variables;
- connect the check to CI/CD release gates;
- add backup/restore drill evidence after staging RDS exists.

### BE-0642: Add PostgreSQL Migration Safety Gate

Status: started on 2026-08-28.

Current evidence:

- Migration runtime tracks `CUAC_MIGRATION_TARGET_ENV`.
- `npm run db:pg:check` reports database URL variable, SSL mode, migration target environment, production migration approval, runbook acknowledgement, warnings, and blockers.
- `npm run db:pg:migrate` prints the migration check before attempting to connect.
- Migration runbook exists at `CUAC_POSTGRES_MIGRATION_RUNBOOK.md`.
- Migration env check returns the runbook path in `runbookPath`.
- Production migration is blocked unless both `CUAC_ALLOW_PRODUCTION_MIGRATION=true` and `CUAC_MIGRATION_RUNBOOK_ACK=true` are set.
- Staging/production migration is blocked if the PostgreSQL URL points to localhost or `127.0.0.1`.
- Tests exist in `frontend/tests/server/db/migration-runtime.test.mjs`, including a runbook content check for production approval gates.

Description:

Prevent accidental production migration and make staging/RDS rehearsal preconditions explicit before any real database connection is attempted.

Definition of Done:

- migration target environment is explicit for staging/production;
- production migration requires a deliberate approval flag;
- production migration requires runbook acknowledgement;
- staging/production URLs cannot point to localhost;
- migration check output is visible before migration execution;
- migration runbook documents local, staging, production, rollback/restore, and prohibited operations;
- safety checks are covered by server tests.

Remaining work:

- write the migration runbook for staging and production;
- run `npm run db:pg:check` with real Alibaba Cloud staging RDS variables;
- run `npm run db:pg:migrate` against staging RDS after backups and credentials are configured.

### BE-0643: Add Alibaba Cloud Environment Templates

Status: started on 2026-08-28.

Current evidence:

- Staging template exists at `frontend/config/staging.env.example`.
- Production template exists at `frontend/config/production.env.example`.
- Configuration README exists at `frontend/config/README.md`.
- Template tests exist at `frontend/tests/server/config/env-templates.test.mjs`.
- Server test runner includes the env template suite.

Description:

Provide a safe, commit-friendly environment checklist for Alibaba Cloud staging and production without storing real secrets.

Definition of Done:

- staging template includes PostgreSQL/RDS, SSL, migration target, Alibaba Cloud runtime, KMS/secret manager, Agent sandbox, Billing fee schedule, payment test mode, and file-upload posture;
- production template includes PostgreSQL/RDS, SSL, production migration target, Alibaba Cloud runtime, KMS/secret manager, Agent sandbox, Billing fee schedule, hosted payment live mode placeholders, hard readiness gate, and file-upload posture;
- templates keep production migration approval off by default;
- templates keep Agent direct database access disabled;
- templates keep sensitive file upload disabled until private OSS/file policy is implemented;
- tests assert required keys and safe defaults.

Remaining work:

- fill real values in Alibaba Cloud secret management for staging;
- run `npm run infra:production-check` with staging variables;
- run `npm run db:pg:check` with staging variables;
- connect templates to deployment documentation and CI/CD.

## 10. Epic I: Security Test Scaffolding

### BE-0651: Add Agent Context Lifecycle Foundation

Status: started on 2026-08-28.

Current evidence:

- PostgreSQL schema includes `agent_persona_sessions`, `agent_context_candidates`, and `agent_memory_entries`.
- Migration exists at `frontend/drizzle/pg/0002_agent_context_foundation.sql`.
- Agent context service boundary exists at `frontend/src/server/agent/context.ts`.
- Contract-only Agent context HTTP handlers exist at `frontend/src/server/agent/http.ts`.
- Agent context runtime composition exists at `frontend/src/server/agent/runtime/routes.ts`.
- Thin route adapters exist at `frontend/app/api/v1/agent/context/candidates` and `frontend/app/api/v1/agent/context/carry-forward`.
- Agent context PostgreSQL repository boundary exists at `frontend/src/server/agent/postgres-context-repository.ts`.
- PostgreSQL audit writer exists at `frontend/src/server/audit/postgres-writer.ts`.
- Agent context runtime injects `PostgresAuditWriter` so context candidate and carry-forward events can be persisted to `audit_logs`.
- Tests exist at `frontend/tests/server/agent/context.test.mjs`.
- HTTP tests exist at `frontend/tests/server/agent/http.test.mjs`.
- PostgreSQL repository tests exist at `frontend/tests/server/agent/postgres-context-repository.test.mjs`.
- PostgreSQL audit writer tests exist at `frontend/tests/server/audit/postgres-writer.test.mjs`.
- Migration tests assert that Agent context foundation does not create raw conversation transcript, raw message, tool invocation, or action preview tables.
- Service tests cover ephemeral guest candidates, no direct guest durable memory, guest-to-student carry-forward after same-session confirmation, persona-separated namespaces, and prohibited sensitive data-class rejection.
- Repository tests assert fixed parameterized SQL, JSONB parameter handling, explicit namespace fields, proposed-only acceptance updates, and no reads/writes to raw transcript, payment, or student profile tables.
- HTTP tests assert guest candidate creation ignores client authority, sensitive candidates are rejected, carry-forward requires authenticated student context, missing candidate ID returns a stable bad request, and route files do not read demo data directly.
- Agent context service accepts an injectable audit sink for candidate creation, memory creation, guest carry-forward, and denied sensitive candidate attempts.
- Audit tests assert metadata excludes raw candidate summaries while recording action, allowed/denied status, resource, data class, namespace, source counts, and denial reason.
- Audit writer tests assert fixed parameterized `audit_logs` insertion, JSONB data class/metadata handling, guest actor typing, redaction preservation, and no access to raw transcript, payment, or student profile tables.

Description:

Create Agent context and memory lifecycle foundation without enabling full Agent execution.

Definition of Done:

- guest context candidates are short-lived and not durable memory;
- guest-to-student carry-forward requires authenticated student context and matching guest session binding;
- memory namespace is derived from active persona, role, user, and tenant;
- payment-sensitive, secret, audit-security, and cross-persona memory paths are rejected;
- raw transcript and tool invocation execution tables remain deferred.

Remaining work:

- connect additional billing status/webhook actions to `PostgresAuditWriter` when provider integration starts;
- Add the public memory management API only after UX and consent alignment. The service, audit and bounded candidate-sweep foundation are now implemented; see `CUAC_AGENT_MEMORY_MANAGEMENT_CONTRACT.md`.
- connect frontend carry-forward UX after Hub/Application edits settle;
- run migration against local PostgreSQL or Alibaba Cloud staging RDS.

### BE-0701: Add Auth And Ownership Fixture Set

Status: started on 2026-08-28.

Current evidence:

- Auth/session tests include guest, student, school staff, expired session, revoked session, inactive account, and client authority spoof attempts.
- Student ownership tests include own student resource and another-student direct-ID attempts.
- Real PostgreSQL fixtures now cover two students, two schools, two teachers, CUAC role grants and guests via `tests/server/db/identity-isolation-rehearsal.mjs`, including owner/tenant direct-ID attacks, role revocation, inactive membership/school, audit projection and relational mismatch cases.

Definition of Done:

- two students;
- two schools;
- two school staff users;
- one CUAC Ops user;
- one unauthenticated guest;
- direct-ID attack fixtures.

### BE-0702: Add Tenant Isolation Tests

Local evidence (2026-08-31): real PostgreSQL + school HTTP handler tests pass for two school tenants, cross-tenant ID probes, forged query tenant IDs, missing membership enforcement, suspended memberships and inactive schools. Detail/status-event queries now include the verified tenant in SQL. Deployed route smoke and concurrent permission-change tests remain separate follow-ups.

Definition of Done:

- school A staff cannot access school B records;
- tenant ID supplied by client is not authoritative;
- school membership status is enforced.

### BE-0703: Add Catalog Public Boundary Tests

Definition of Done:

- guest can read catalog;
- guest cannot read private student/school/Ops/payment fields;
- source lineage remains present;
- internal quality fields are hidden or transformed.

### BE-0704: Add Agent Prohibited Action Fixtures

Definition of Done:

- arbitrary SQL tool denied;
- raw payment credential tool denied;
- cross-tenant read tool denied;
- arbitrary URL navigation denied;
- prompt injection fixture cannot trigger execute.

## 11. First Sprint Recommendation

### Request And Context Hardening Tickets

| Ticket | Status | Acceptance evidence required |
| --- | --- | --- |
| BE-0705 HTTP boundary and guest bootstrap | Local verified | Shared protection on all explicit API exports; malformed/cross-origin requests stop before mutation; signed guest initialization/retention/rotation, one-time continuation and logout through the built HTTP server. Browser/cloud acceptance remains separate. |
| BE-0706 Domain input contracts | Current Student/context/Auth entries locally verified | Student/profile/saved/choice validation, server-derived study_goal candidates, Auth field/length/token contracts and registered continuation navigation pass unit and real HTTP/PG tests. See [student contract](CUAC_STUDENT_AND_AGENT_INPUT_CONTRACT.md) and [Auth contract](CUAC_AUTH_INPUT_CONTRACT.md). New domain workflows require their own contracts. |
| BE-0707 Atomic business audit | Student/Auth/Agent locally verified; broader external effects pending | All 27 Student/Auth and 3 Agent mutation methods use same-connection success-audit transactions. Agent candidate denial audits survive business rollback. Real PG and built-API fault injection verified; BE-0718 adds the verification/reset outbox, while school invitations, submission notifications and payment effects remain separate. See [audit contract](CUAC_TRANSACTIONAL_AUDIT_CONTRACT.md). |
| BE-0708 Agent context lifecycle | Confirmation, pending-candidate capacity, student controls and finite retention locally verified; production disabled | Strict student action/surface/session, reset revision conflicts, microsecond keyset pagination, 100-uncleared-memory capacity, 12-per-guest and 24-per-student active pending-candidate limits, role locks, erasure, database-enforced 365-day expiry and bounded atomic scrubbing verified in PostgreSQL and built HTTP. Control UX, production scheduling/monitoring, Gateway/WAF abuse controls, backup deletion and full identity lifecycle remain open. See [candidate capacity](CUAC_AGENT_CANDIDATE_CAPACITY_CONTRACT.md), [management](CUAC_AGENT_MEMORY_MANAGEMENT_CONTRACT.md) and [retention](CUAC_AGENT_MEMORY_RETENTION_CONTRACT.md) contracts. |
| BE-0709 Browser and Alibaba Cloud boundary | Pending | Same-origin HTTPS browser tests, proxy/header trust, cookie behavior and state clearing; real Gateway/WAF rules cover all Auth routes including bootstrap; RDS TLS/least privilege and restore drill evidence. |
| BE-0710 Auth production credential gates | Versioned hashing and atomic legacy upgrade locally verified; full gate open | Register/login/reset share two in-flight operations with no waiting queue, sanitized 503 and awaited native work. New writes use fixed `scrypt_v2`; login always evaluates legacy and v2 profiles, and a successful legacy proof upgrades only inside the user-locked session/audit transaction. Malformed or arbitrary profiles cannot authenticate. Current 470 regular / 335 DB / 424 combined HTTP gates pass. Remaining: breached/common-password screening, ECS resource/latency/overload review, MFA, broader enumeration/timing tests and identity lifecycle. Old/new auth instances cannot mix because old code cannot read v2; release requires drain and whole-fleet cutover. See [password runtime contract](CUAC_AUTH_PASSWORD_RUNTIME_CONTRACT.md). External delivery remains separately approved. |
| BE-0712 Request idempotency and uncertain commits | Two application commands locally verified; ticket remains open | Set/choice POSTs require keys; account/operation-scoped hashed receipts commit with business/audit. Real unique-key waits, rollback, simulated lost COMMIT acknowledgement and actual downstream HTTP disconnect recover one resource. See [contract](CUAC_APPLICATION_IDEMPOTENCY_CONTRACT.md). Still open: Auth/session/invitation recovery, frontend pending-intent handling, receipt retention/quotas and cloud failure/restore proof. Request IDs are correlation only; no blanket automatic retries. |
| BE-0713 Migration artifact and release integrity | Local baseline, release and isolated Linux runtime verified; CI/cloud gates open | Prior schema/ledger/lock/fault gates remain green. Content-addressed packaging fixes runtime, plan and 15 dependencies. The same package passes non-root/read-only Linux execution, external bootstrap verification, non-superuser migration/replay and SIGTERM recovery (7/7). See [Linux runtime contract](CUAC_POSTGRES_LINUX_RUNTIME_CONTRACT.md). Still open: trusted CI/signatures, patch review, cloud runtime/secret enforcement, protected history, domain backfills and RDS restricted-role/TLS/failover/restore. |
| BE-0714 Application PostgreSQL transport lifecycle | Local pool/API/process gate passed; cloud lifecycle open | Eight real DB subtests cover idle/checked-out/active loss, saturation, timeouts, ambiguous COMMIT and pool shutdown/recreation. Seven built-API network cases cover failure/recovery plus real pool close, admitted-work drain, client disconnect and deadline rollback. Independent Linux tests send real SIGTERM for drained/nonzero-deadline outcomes. No blanket write retries. Remaining: trusted application artifact, cloud signal/LB drain, monitoring, actual TLS/limits, independent liveness and RDS/proxy/failover. See [application transport](CUAC_POSTGRES_APPLICATION_TRANSPORT_CONTRACT.md) and [lifecycle](CUAC_APPLICATION_LIFECYCLE_CONTRACT.md) contracts. |

These tickets do not authorize full Agent execution, live payment, external email, file upload or general school/Ops write APIs. No changes to V3/Hub/Application frontend are needed for BE-0706 through BE-0708.

BE-0719 offline readiness gate: locally verified. Reports explicitly identify offline scope and no runtime verification. Arbitrary mail provider names, test/live payment settings and OSS bucket names cannot approve unimplemented integrations. Unknown environments, malformed flags and development-as-deployment checks fail; staging/production CLI defaults to required, explicit advisory is diagnostic-only. Both templates keep external services disabled. 25 focused tests are included in 458 regular tests; no schema, business API or frontend changes and no fresh PG/HTTP/Linux rehearsal in this batch. Runtime integration, trusted CI enforcement and actual launch acceptance remain open. See [readiness contract](CUAC_PRODUCTION_READINESS_CONTRACT.md).

### Application Workflow Follow-Up

User decision reconfirmed (2026-09-01): one concrete `program + intake` choice produces one independent Program Application. Same-school choices are not merged. `0030` now implements the Official Submission Group as a transport adapter only; it keeps choice-scoped identity/evidence/state and does not derive fee units from application units.

| Ticket | Status | Acceptance evidence required |
| --- | --- | --- |
| BE-0715 Draft mutation/freeze boundary | Add/remove/edit/order locally verified; frontend/cloud acceptance open | Migration 0012 adds parent revision, advanced by existing choice add/remove/edit/order mutations; material selection has its own independent revision. Notes/scholarship PATCH and complete-order PUT require expectedRevision; full owner membership, freeze and school-receipt guards, no-op, ABA/stale conflicts, concurrent add/remove/order detection and atomic audits pass. Ten regular, sixteen DB, one populated-upgrade and four network cases added this round. Existing POST receipts and fixed-target DELETE semantics preserved. Drain non-revision writers before enabling new routes; no freeze/submit endpoint exposed. |
| BE-0716 Per-program submission workflow | Internal atomic receive/grouping locally verified; public/external lifecycle open | Migrations 0013-0029 provide exact target, preparation, route/policy and Billing evidence. `0030` adds `application_submissions`, Program Application v2 evidence, official groups/members, one inert outbox row per group and the `application.submit` receipt. Same-school projects remain independent under both supported form modes; same-key races converge, stale evidence fails the batch and audit failure rolls everything back. Preflight remains `canSubmit=false`, because no student HTTP route is exposed. Next: reviewed launch policy/price data, public-route risk review, real payment, worker/provider fencing, school projection/writes and Alibaba Cloud staging. No Agent write tool, live payment or school adapter is enabled. See [atomic contract](CUAC_ATOMIC_APPLICATION_SUBMISSION_CONTRACT.md), [policy/group contract](CUAC_OFFICIAL_SUBMISSION_POLICY_AND_GROUP_CONTRACT.md) and [submission contract](CUAC_APPLICATION_SUBMISSION_BACKEND_CONTRACT.md). |
| BE-0717 Per-choice material selection draft | Backend locally verified; frontend and lifecycle/cloud gates open | 0022 adds an owner/target-bound metadata-only table and GET/PUT. Explicit selection and four current source versions plus its independent revision are required; stale writes, foreign IDs and Agent use are rejected. Choice removal and selection erasure share the event/audit transaction. 6 regular, 15 business DB, 1 populated upgrade and 6 network cases pass. Formal consent/submit must bind selection revision separately. See [contract](CUAC_APPLICATION_MATERIAL_SELECTION_CONTRACT.md). |
| BE-0718 Auth email transactional outbox | Backend locally verified; live delivery remains disabled | Encrypted transport, same-transaction enqueue, owner-bound challenges, leased one-shot worker, final identity checks, bounded nonacceptance retry and uncertain-result quarantine. 7 regular, 19 business DB and 1 populated-upgrade cases pass. Explicit action-page paths, KMS/provider approval, worker identity/scheduling, capacity and mailbox delivery gates remain. See [contract](CUAC_AUTH_EMAIL_OUTBOX_CONTRACT.md). |

Detailed implementation order and remaining product decisions: [per-program backend submission contract](CUAC_APPLICATION_SUBMISSION_BACKEND_CONTRACT.md). These tickets do not authorize touching the user's frontend, real payments or full school/Ops writes.

### Database Verification Follow-Up

The local migration-only and sample seed replay tasks above have now been exercised. Student owner-scope and school tenant read repositories also have real-database evidence; this does not close their full workflows or billing/Agent repository lifecycle verification.

Next backend tickets, in order:

1. BE-0701/BE-0702 basic local fixtures and direct-ID/role/tenant cases now pass, with student/Auth network smoke added; school/Ops network checks, cloud routes and concurrent permission-change/write scenarios remain.
2. BE-0705/0706/0707 current local gates pass. BE-0708 confirmation, owner-scoped pending-candidate limits, student controls, reset revisions, keyset pagination, confirmed-memory capacity and 365-day finite retention are verified. Next complete control UX, Gateway/WAF abuse and model-budget controls, production scheduling/monitoring, backup deletion and in-flight session revocation; keep production durable memory and full Agent disabled. Continue application consent/submission and BE-0710 production controls.
3. BE-0713 local reconciliation, execution locks, ledger checks, detached packaging and isolated Linux runtime are verified. Use `db:pg:generate`, `db:pg:schema:check`, `db:pg:release`, real release rehearsal and `db:linux:rehearse` for applicable changes. Next validate trusted CI provenance/signatures, patch baseline, cloud runtime/secret controls and domain upgrade/restore. BE-0714 local pool/API faults, process drain/deadline and real Linux signals pass; cloud application artifact/signal/LB drain, monitoring and RDS failover remain production gates.
4. Rehearse the same migration chain and seed import against Alibaba Cloud staging RDS with TLS, restricted credentials, API smoke checks, and restore evidence.

Already verified locally: full schema migration/replay; sample catalog upsert/evidence replay; public list/search/detail SQL; school invite create/revoke/accept concurrency, uniqueness, and rollback. The new partial unique index must fail on historical duplicates until those records receive an explicit review; migrations must not silently revoke invites.

### Original Sprint Scope

Sprint 1 should include:

1. BE-0001
2. BE-0002
3. BE-0003
4. BE-0004
5. BE-0101
6. BE-0102
7. BE-0201
8. BE-0301
9. BE-0401
10. BE-0501

Do not include Agent execution, payment provider charging, or Ops write APIs in Sprint 1.
