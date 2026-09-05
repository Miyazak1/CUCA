# CUAC Backend Implementation Plan

Date: 2026-08-25

Status: backend implementation plan derived from the secure Agent/backend architecture baseline.

Primary architecture baseline: `CUAC_SECURE_AGENT_BACKEND_ARCHITECTURE.md`

Execution boundary:

- Phase 0/1 may begin now for architecture lock, PostgreSQL/ORM selection, unified auth, policy, audit, and catalog read foundation.
- Do not implement full Agent execution, real payment charging/refunds, Ops Admin write APIs, file upload, school system integrations, or page-shaped admin APIs until later gates pass.
- Administrator panel productization may continue in parallel, but current rough admin page layouts must not be frozen into backend API shape.

## 1. Goal

Move CUAC from frontend-only product blueprint to a secure production backend without breaking the product boundaries already proven in the demo.

The backend must support:

- public catalog search and detail pages;
- account/session foundation;
- student profile, saved items, and application choices;
- payment status and school handoff;
- school tenant portal;
- notifications;
- audit;
- controlled Agent retrieval and actions.

The backend must not introduce:

- Agent direct database access;
- raw payment data in CUAC systems;
- school visibility into other selected schools;
- document upload in MVP;
- unrestricted natural-language SQL;
- unaudited cross-tenant Ops access.

## 2. Recommended Stack Decision

Use PostgreSQL as the production transactional database.

Reasoning:

- CUAC has tenant-scoped school records, transactional application submission, payment state, audit logs, and future row-level security needs.
- PostgreSQL supports mature relational constraints, transactions, indexes, JSONB snapshots, and Row-Level Security.
- Alibaba Cloud RDS for PostgreSQL should be the production/staging default because the later deployment target is Alibaba Cloud servers.
- Cloudflare D1 can remain useful for public-edge cache or lightweight demo data, but it should not be the authoritative store for payments, application routing, school tenant isolation, or audit.

Open implementation choice:

- Use Drizzle if the backend remains TypeScript-first.
- Use Prisma if a separate Node/Nest/Express backend is introduced from `migration-intake`.

The first engineering decision should be: one deployed modular monolith on Alibaba Cloud with PostgreSQL, or a split `frontend` + backend service. In both cases, PostgreSQL remains authoritative.

## 3. Implementation Phases

### Phase 0: Architecture Lock

Deliverables:

- accept or revise `CUAC_SECURE_AGENT_BACKEND_ARCHITECTURE.md`;
- select production database and ORM;
- choose auth provider/session strategy;
- choose payment provider and hosted payment pattern;
- choose initial AI provider and data-retention setting;
- create a backend repo/module layout.

Exit gates:

- no unresolved decision on payment isolation;
- no unresolved decision on school tenant isolation;
- no unresolved decision on whether the Agent can access private data directly. It cannot.

### Phase 1: Foundation

Deliverables:

- identity tables: `users`, `auth_identities`, `auth_sessions`, `user_roles`;
- tenant tables: `school_staff_invites`, `school_staff_memberships`;
- catalog tables: `schools`, `programs`, `program_intakes`, `scholarships`, `cities`, `catalog_source_evidence`;
- `audit_logs`;
- policy middleware;
- public catalog read APIs.

Exit gates:

- direct-ID access tests pass;
- public catalog APIs do not return student, payment, school tenant, or private Ops data;
- audit writer works and cannot be modified through normal admin APIs;
- logs are redacted.

### Phase 2: Student Core

Deliverables:

- `student_profiles`;
- `saved_items`;
- `application_sets`;
- `application_choices`;
- student-owned application read/write APIs;
- consent capture;
- notification table and student notification APIs.

Exit gates:

- a student can only access their own profile, saved items, and application sets;
- continuation tokens do not grant authority;
- consent is required before school disclosure;
- no high-sensitive documents are accepted.

### Phase 3: Billing Facade And Submission

Deliverables:

- `payments`;
- `invoices`;
- fee preview endpoint;
- hosted checkout link endpoint;
- payment status endpoint;
- provider webhook endpoint;
- idempotent application submit endpoint;
- `school_applications`;
- `school_application_program_interests`;
- `school_application_status_events`.

Exit gates:

- server-side fee calculation cannot be overridden by client;
- payment webhooks verify provider signature;
- repeated submit does not duplicate school applications;
- no school application is created before paid or not-required state;
- raw card, CVV, or bank data never enters CUAC logs, prompts, DB, or Agent memory.

### Phase 4: School Portal

Deliverables:

- school queue API;
- school applicant detail projection;
- status update API;
- owner assignment API;
- contact log API;
- export job API;
- school dashboard summary API.

Exit gates:

- school staff sees only tenant records;
- school detail does not reveal other schools selected by the student;
- exports are tenant-scoped and audited;
- school analytics are tenant-scoped;
- CUAC Ops access requires support reason and audit.

### Phase 5: Agent MVP

Deliverables:

- `agent_conversations`;
- `agent_messages`;
- `agent_actions`;
- `agent_memory_entries`;
- Retrieval Gateway;
- Tool Gateway;
- action registry endpoint;
- action preview endpoint;
- action execute endpoint;
- Agent audit integration.

Exit gates:

- Agent has no DB credentials;
- Agent cannot call unregistered tools;
- Agent can retrieve public catalog data and scoped student/school summaries only after policy checks;
- high-risk actions require confirmation;
- prohibited actions are blocked;
- prompt injection regression suite passes.

### Phase 6: Ops, Analytics, And Hardening

Deliverables:

- governed metric registry;
- product event ingestion;
- school and Ops dashboard APIs;
- routing retry queue;
- refund request/approval flow;
- support access session;
- incident runbooks;
- backup and restore procedure.

Exit gates:

- analytics Agent cannot run arbitrary SQL;
- support lookup requires purpose and audit;
- refund action is policy-gated and audited;
- backup restore test completed;
- security review completed before launch.

## 4. Module Boundary

Recommended modular monolith modules:

```text
src/auth
src/policy
src/catalog
src/student
src/applications
src/billing
src/school-portal
src/notifications
src/agent
src/analytics
src/ops
src/audit
src/common
```

Rules:

- `agent` calls `tool-gateway`, not domain repositories directly.
- `school-portal` reads school-safe projections, not raw application sets.
- `billing` stores provider references and status, not payment credentials.
- `policy` is used by both manual APIs and Agent action APIs.
- `audit` is append-only from normal application paths.

## 5. First Ticket Batch

1. Decide backend runtime and ORM.
2. Create backend module skeleton.
3. Add initial PostgreSQL schema for identity, catalog, student profile, applications, school applications, payments, Agent, audit.
4. Implement policy middleware with explicit deny-by-default behavior.
5. Implement catalog read APIs.
6. Implement student profile and saved items APIs.
7. Implement tests for object ownership and tenant isolation.
8. Implement audit writer and log redaction helpers.

## 6. Do Not Start Yet

Do not implement these until the foundation is secure:

- document upload;
- direct school system integration;
- autonomous external email sending;
- production refunds;
- arbitrary analytics questions;
- long-term Agent memory over raw messages;
- Agent access to raw application tables.

## 7. Definition Of Backend MVP

Backend MVP is complete when:

- public catalog is database-backed;
- students can register/sign in and manage profile, saved items, application choices;
- payment status gates application submission;
- submitted records create school-scoped school applications;
- school staff can view and update only their own tenant records;
- notifications are persisted;
- Agent can answer from catalog and perform allowed preview/execute actions through the Tool Gateway;
- audit logs exist for sensitive operations;
- security tests pass for authorization, tenant isolation, payment idempotency, prompt injection, log redaction, and Agent prohibited actions.
