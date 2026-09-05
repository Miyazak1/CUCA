# CUAC Production Design Index

- [Catalog detail page data contract](CUAC_CATALOG_DETAIL_PAGE_DATA_CONTRACT.md): authoritative public fields, route identities, prohibited inferences, and information architecture for city, school, program, and scholarship details.

Date: 2026-08-14

Status: master index for mature-product design.

## 1. Purpose

This index organizes the production design documents needed to evolve the current CUAC frontend demo into a mature website and SaaS product.

The design set covers:

- product architecture;
- database and object model;
- permissions and school tenant isolation;
- API contracts;
- school portal backend;
- Agent action architecture;
- analytics and metrics;
- security and privacy;
- data governance;
- payments and billing;
- notifications and communication;
- CUAC operations/admin tooling;
- infrastructure, delivery, and quality gates.

## 2. Recommended Reading Order

Current execution evidence and private material preparation contracts (2026-09-01):

- [Production delivery plan](CUAC_PRODUCTION_DELIVERY_PLAN_CN.md)
- [Persistent local PostgreSQL and Node API development runbook](CUAC_LOCAL_DEVELOPMENT_RUNBOOK.md)
- [Bounded asynchronous password processing and remaining credential gates](CUAC_AUTH_PASSWORD_RUNTIME_CONTRACT.md)
- [Offline readiness gate and implementation limits](CUAC_PRODUCTION_READINESS_CONTRACT.md)
- [Staging acceptance evidence runbook](CUAC_STAGING_ACCEPTANCE_RUNBOOK.md)
- [Ops quarantined payment-event review and dual-control boundary](CUAC_OPS_BILLING_REVIEW_CONTRACT.md)
- [Ops quarantined official-delivery review and bounded retry boundary](CUAC_OPS_ROUTING_REVIEW_CONTRACT.md)
- [Auth email transactional outbox and live-delivery gates](CUAC_AUTH_EMAIL_OUTBOX_CONTRACT.md)
- [Per-choice material selection drafts](CUAC_APPLICATION_MATERIAL_SELECTION_CONTRACT.md)
- [Material self-review preview](CUAC_APPLICATION_MATERIAL_PREVIEW_CONTRACT.md)
- [Per-program disclosure authorization](CUAC_APPLICATION_SUBMISSION_AUTHORIZATION_CONTRACT.md)
- [Route/policy-bound authorization v2](CUAC_APPLICATION_POLICY_BOUND_AUTHORIZATION_CONTRACT.md)
- [Per-program immutable encrypted material snapshot](CUAC_APPLICATION_MATERIAL_SNAPSHOT_CONTRACT.md)
- [Atomic Program Application acceptance and official transport grouping](CUAC_ATOMIC_APPLICATION_SUBMISSION_CONTRACT.md)
- [Applicant data, consent and submission gates](CUAC_APPLICANT_PROFILE_AND_CONSENT_CONTRACT.md)
- [Agent student-memory finite retention and expiry scrubbing](CUAC_AGENT_MEMORY_RETENTION_CONTRACT.md)
- [Local rehearsal evidence](CUAC_POSTGRES_REHEARSAL_REPORT.md)

1. `CUAC_PRODUCT_PRODUCTION_ROADMAP.md`
2. `CUAC_PRODUCT_ARCHITECTURE_SPEC.md`
3. `CUAC_FRONTEND_PRODUCTIZATION_SPEC.md`
4. `CUAC_LEGACY_FIELD_MAPPING_SPEC.md`
5. `CUAC_DATABASE_ERD_SPEC.md`
6. `CUAC_ROLE_PERMISSION_MATRIX.md`
7. `CUAC_APPLICATION_API_CONTRACT.md`
8. `CUAC_SCHOOL_PORTAL_BACKEND_SPEC.md`
9. `CUAC_AGENT_ACTION_ARCHITECTURE.md`
10. `CUAC_SECURE_AGENT_BACKEND_ARCHITECTURE.md`
11. `CUAC_FULL_BACKEND_BLUEPRINT.md`
12. `CUAC_BACKEND_ADR_0001_PHASE0_1_FOUNDATION.md`
13. `CUAC_BACKEND_IMPLEMENTATION_PLAN.md`
14. `CUAC_BACKEND_PHASE0_1_EXECUTION_BACKLOG.md`
15. `CUAC_BACKEND_FOUNDATION_SCHEMA_API_CONTRACT.md`
16. `CUAC_AGENT_TOOL_REGISTRY_SPEC.md`
17. `CUAC_AGENT_CONTEXT_LIFECYCLE_SPEC.md`
18. `CUAC_AGENT_DATA_SANDBOX_SPEC.md`
19. `CUAC_DATA_CLASSIFICATION_REGISTER.md`
20. `CUAC_BACKEND_SECURITY_TEST_PLAN.md`
21. `CUAC_SECURITY_PRIVACY_THREAT_MODEL.md`
22. `CUAC_ANALYTICS_EVENT_TAXONOMY.md`
23. `CUAC_DATA_GOVERNANCE_SPEC.md`
24. `CUAC_PAYMENTS_BILLING_SPEC.md`
25. `CUAC_NOTIFICATIONS_COMMUNICATION_SPEC.md`
26. `CUAC_OPERATIONS_ADMIN_SPEC.md`
27. `CUAC_INFRASTRUCTURE_DELIVERY_SPEC.md`

Existing frontend specs remain valid for page-level design and should be treated as UX/product references:

- `CUAC_FRONTEND_ROUTE_CONTRACT_CHECKLIST.md`
- `CUAC_LEGACY_FIELD_MAPPING_SPEC.md`
- `CUAC_FRONTEND_ONLY_PRODUCTION_DESIGN_SPEC.md`
- `CUAC_FRONTEND_COMPONENT_STATE_SPEC.md`
- `CUAC_FRONTEND_MOCK_DATA_CONTRACT.md`
- `CUAC_APPLICATION_SUBMISSION_PAYMENT_SCHOOL_PORTAL_SPEC.md`
- `CUAC_SCHOOL_PORTAL_TEACHER_WORKSPACE_SPEC.md`
- page-specific specs for home, programs, universities, scholarships, cities, guides, hub, onboarding, favourites, notifications, and preferences.

## 3. Main Product Decisions

### CUAC Product Position

CUAC is a China admissions discovery and routing platform, not a universal official application system for all Chinese universities.

### Application Model

Student creates an `ApplicationSet` containing concrete `ApplicationChoice` records. Each `program + intake` is an independent Program Application even when choices share a school. Material selection, disclosure authorization, material snapshot and fee entitlement are also exact per choice. Billing price policy remains a separate dimension: it may calculate bundles or waivers, but must leave entitlement evidence for every covered project. `0030` implements Official Submission Groups as transport adapters for one or several Program Applications; a group cannot merge their identity, authorization, entitlement, status or decision state.

The adapter boundary is specified in [the official submission policy and group contract](CUAC_OFFICIAL_SUBMISSION_POLICY_AND_GROUP_CONTRACT.md). Slices A-D1 are implemented by `0026` through `0029`; Slice D2 is implemented internally by `0030`. D2 revalidates the exact route/policy/authorization/snapshot/entitlement evidence, creates one Program Application per choice, and only then groups transport according to the locked form rule. First-launch route publications and price rules remain reviewed product data. Public submit, external delivery and school receipt are still closed. See [the atomic submission contract](CUAC_ATOMIC_APPLICATION_SUBMISSION_CONTRACT.md) and [the Billing entitlement contract](CUAC_APPLICATION_BILLING_ENTITLEMENT_CONTRACT.md).

### School Isolation

School staff can see only their own `SchoolApplication` records. They cannot see the student's other selected schools.

### Document Boundary

MVP does not collect passport, transcript, IELTS, HSK, recommendation, or other files. Schools contact students directly for official documents.

### Agent Boundary

Agent can explain, summarize, analyze, and operate allowed workflows. It cannot exceed the user's permissions, bypass payment, leak tenant data, or make admissions decisions.

### Data Credibility

Catalog data needs source evidence, verification status, freshness windows, and Ops review workflows.

## 4. MVP Product Scope

MVP should include:

- public catalog search;
- student account and profile;
- onboarding;
- saved items;
- application choices;
- fee preview;
- payment or payment simulation;
- application submission;
- school-scoped records;
- school staff login and queue;
- school status updates;
- notifications;
- controlled Agent actions;
- audit logs;
- basic Ops console;
- analytics events.

MVP should not include:

- document upload;
- official school system integration;
- final admission decisions;
- visa/JW-form handling;
- unrestricted natural-language database access;
- autonomous high-risk Agent actions.

## 5. Implementation Sequence

### Current Frontend Demo Status

As of the current frontend phase, the static demo has already moved beyond a page-only prototype in several important areas:

- shared shell: header, footer, account menu, global Agent composer, Agent panel, and route contracts are centralized;
- route contracts: public student, authenticated student, school staff, and CUAC Ops surfaces are declared in `CuacDataClient`;
- legacy field mapping: school, program, scholarship, and city fields are mapped against `D:\CODE\CSCAlite`;
- application loop: student choices, fee preview, billing receipt, and school portal receipt are represented as frontend demo state;
- school scope: school portal and settings use school Agent mode and tenant-scoped copy;
- notifications: application submission and school first-contact actions write student-visible notification events in the frontend demo;
- Agent context: guest, signed-in student, school staff, and Ops context retention policies are explicit, and Agent prompt invocations now carry route, role, surface, retention policy, entity ID, and source model context from detail pages, notifications, choices, and saved items;
- sign-in continuation: guest users who trigger saved-item or application actions are redirected to `auth.html`, then the original page/action continues after demo sign-in;
- account recovery: Auth previews password reset while preserving the saved continuation, and registration records pending email verification state;
- action registry: Agent actions are checked against surface, role, route, auth state, risk, and confirmation requirements.

The approved reference remains a design demo, but a local PostgreSQL/Auth/policy/audit/application-preparation backend foundation now exists and is tested independently. There is still no production deployment, real payment provider, university integration, file upload or full Agent service.

### Current Stage Exit Boundary

The frontend demo stage is now mature enough to guide backend Phase 0/1 startup. The next backend work should preserve the proven frontend behavior while implementing stable domain, policy, audit, catalog, and Agent-sandbox foundations.

In scope for this stage:

- close the student demo loop across discovery, unified Auth continuation, saved choices, application choices, payment simulation, send state, Billing, Notifications, and school handoff;
- make school staff pages tenant-scoped and teacher-readable, with only this school's records visible;
- keep Program, University, Scholarship, and City fields aligned with CSCAlite while rendering them as user-facing decision information instead of raw model fields;
- unify visual patterns for catalog cards, detail sidebars, application steps, school dashboards, Auth forms, loading states, and buttons;
- document database, API, permission, analytics, security, payment, and Agent architecture enough to create later backend tickets.

Out of scope for this stage:

- implementing a real database, backend API, auth provider, payment provider, file upload service, university integration, or production Agent service;
- turning architecture documents into backend code before the frontend behavior and data contracts are proven;
- publishing or deploying the site unless explicitly requested.

Exit evidence for this frontend stage:

- student-facing catalog and detail pages are readable, visually unified, and mapped to CSCAlite-compatible fields without exposing raw model keys as the main UI;
- Auth supports sign-in and registration as one unified entry, and continuation resumes the original protected action after demo authentication;
- application payment is represented as a frontend simulation gate, so school-visible send state appears only after paid or free entitlement state;
- school staff workspaces stay locked to one school tenant and cannot reveal the student's other selected schools;
- Agent actions are only frontend-registered previews with role, auth, risk, confirmation, and tenant checks; production Agent storage/execution remains a later backend service;
- tests and QA prove the frontend contracts before backend tickets start.

Practical cutoff rule:

- continue frontend work while the public catalog, student application chain, school teacher chain, Agent context chain, or visual system still has obvious missing or inconsistent demo behavior;
- stop frontend-only expansion when those chains are demonstrable end to end and covered by static, browser-flow, and layout QA;
- then create backend tickets from the proven contracts instead of adding more static screens.

### Phase 0: Preserve Demo Contract

- keep static demo pages working;
- keep shared shell and Agent UI stable;
- keep school portal tenant copy clear;
- keep application handoff explicit.

Phase 0 frontend gates now also include:

- public routes default to guest Agent context unless a page explicitly becomes signed-in;
- guest memory/actions are current-page only;
- protected student actions must redirect to the unified auth page and continue the original action only after sign-in;
- school staff routes must not expose student account shortcuts, student private Agent memory, or other-school choices.
- application payment/send buttons must represent the true state: before submission they open fee/payment review, after successful send they open the sent-status panel instead of pretending to send again.

### Recommended Immediate Work

Backend Phase 0/1 is in active execution while frontend refinement continues in parallel. PostgreSQL/Auth/RBAC/audit/catalog/application preparation, per-program evidence, `0026` through `0029`, and the `0030` internal atomic acceptance/transport-grouping foundation are locally verified. Policy management/public submit HTTP, live payment, worker/provider delivery and Agent action access remain closed. The next stable slices are reviewed launch policy/price data, real-source/Ops gates and external delivery lifecycle:

1. Lock PostgreSQL hosting, ORM source of truth, auth/session strategy, and backend root structure.
2. Create the backend skeleton, request context, error envelope, and server test scaffold.
3. Implement identity, role, school membership, CUAC internal grant, policy, and audit foundations.
4. Implement catalog schema and public read APIs using CSCAlite-compatible fields and source lineage.
5. Define Agent Tool Gateway contracts and prohibited-tool tests before full Agent execution.

### Phase 1: Backend Foundation

- identity/auth;
- PostgreSQL schema;
- RBAC and tenant policy layer;
- catalog seed data;
- student profile;
- saved items;
- application set and choices.

### Phase 2: Application And School Handoff

- fee preview;
- payment state;
- submit action;
- school application creation;
- school queue and detail;
- notifications;
- audit logs.

### Phase 3: Agent Action Layer

- Agent conversation storage;
- action registry;
- low-risk page actions;
- business action previews;
- confirmation flow;
- Agent audit.

### Phase 4: Analytics And Ops

- event ingestion;
- metric registry;
- school dashboard;
- Ops dashboard;
- data quality queues;
- export jobs.

### Phase 5: Hardening

- security review;
- policy tests;
- payment reconciliation;
- monitoring and alerts;
- privacy workflows;
- scalability improvements.

## 6. Required Gates Before Production

- tenant isolation tests pass;
- application submission idempotency proven;
- payment webhook signature verification if real payments are live;
- Agent high-risk actions require confirmation;
- audit logs exist for sensitive operations;
- school export is scoped and audited;
- catalog source evidence exists for public verified records;
- privacy/consent copy approved;
- core dashboards show funnel, school queue, payment, and routing health.

## 7. Design Coverage Map

| Area | Primary Document |
| --- | --- |
| Full production roadmap | `CUAC_PRODUCT_PRODUCTION_ROADMAP.md` |
| Product architecture | `CUAC_PRODUCT_ARCHITECTURE_SPEC.md` |
| Frontend productization | `CUAC_FRONTEND_PRODUCTIZATION_SPEC.md` |
| Legacy catalog field mapping | `CUAC_LEGACY_FIELD_MAPPING_SPEC.md` |
| Database | `CUAC_DATABASE_ERD_SPEC.md` |
| Permissions | `CUAC_ROLE_PERMISSION_MATRIX.md` |
| APIs | `CUAC_APPLICATION_API_CONTRACT.md` |
| School backend | `CUAC_SCHOOL_PORTAL_BACKEND_SPEC.md` |
| Agent | `CUAC_AGENT_ACTION_ARCHITECTURE.md` |
| Secure Agent/backend architecture | `CUAC_SECURE_AGENT_BACKEND_ARCHITECTURE.md` |
| Full backend startup blueprint | `CUAC_FULL_BACKEND_BLUEPRINT.md` |
| Backend Phase 0/1 ADR | `CUAC_BACKEND_ADR_0001_PHASE0_1_FOUNDATION.md` |
| Backend implementation plan | `CUAC_BACKEND_IMPLEMENTATION_PLAN.md` |
| Backend Phase 0/1 backlog | `CUAC_BACKEND_PHASE0_1_EXECUTION_BACKLOG.md` |
| Backend foundation schema/API contract | `CUAC_BACKEND_FOUNDATION_SCHEMA_API_CONTRACT.md` |
| Agent tool registry | `CUAC_AGENT_TOOL_REGISTRY_SPEC.md` |
| Agent context lifecycle | `CUAC_AGENT_CONTEXT_LIFECYCLE_SPEC.md` |
| Agent pending-candidate capacity | `CUAC_AGENT_CANDIDATE_CAPACITY_CONTRACT.md` |
| Agent memory management | `CUAC_AGENT_MEMORY_MANAGEMENT_CONTRACT.md` |
| Agent memory retention | `CUAC_AGENT_MEMORY_RETENTION_CONTRACT.md` |
| Agent data sandbox | `CUAC_AGENT_DATA_SANDBOX_SPEC.md` |
| Data classification | `CUAC_DATA_CLASSIFICATION_REGISTER.md` |
| Per-program disclosure authorization | `CUAC_APPLICATION_SUBMISSION_AUTHORIZATION_CONTRACT.md` |
| Per-program immutable material snapshot | `CUAC_APPLICATION_MATERIAL_SNAPSHOT_CONTRACT.md` |
| Backend security tests | `CUAC_BACKEND_SECURITY_TEST_PLAN.md` |
| Analytics | `CUAC_ANALYTICS_EVENT_TAXONOMY.md` |
| Security/privacy | `CUAC_SECURITY_PRIVACY_THREAT_MODEL.md` |
| Data quality | `CUAC_DATA_GOVERNANCE_SPEC.md` |
| Ops catalog data-quality review | `CUAC_OPS_DATA_QUALITY_REVIEW_CONTRACT.md` |
| School catalog correction and dual-control publication | `CUAC_SCHOOL_CATALOG_CORRECTION_CONTRACT.md` |
| Payments | `CUAC_PAYMENTS_BILLING_SPEC.md` |
| Notifications | `CUAC_NOTIFICATIONS_COMMUNICATION_SPEC.md` |
| Ops/admin | `CUAC_OPERATIONS_ADMIN_SPEC.md` |
| Infrastructure/QA | `CUAC_INFRASTRUCTURE_DELIVERY_SPEC.md` |
