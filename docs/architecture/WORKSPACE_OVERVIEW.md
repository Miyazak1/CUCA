# CUAC

CUAC is planned as a China-focused admissions platform for international students, inspired by UCAS but designed around China-specific program search, application readiness, documents, deadlines, scholarships, advisers, providers, and late-intake alternatives.

## Current Materials

### Product And Research

- `MIGRATION_AND_RESEARCH_PLAN.md`  
  Overall project split: migration scope, UCAS research plan, CUAC product translation, and immediate decisions.

- `UCAS_DEEP_RESEARCH_2026-08-12.md`  
  Deep UCAS research covering Hub, application flow, course search, choices, references, documents, offers, Extra/Clearing, adviser access, provider data operations, trust, and data model implications.

- `FRONTEND_UX_RESEARCH_AND_PLAN_2026-08-12.md`  
  Frontend UX teardown and CUAC frontend direction: calm application workspace, page plans, component system, visual direction, responsive behavior, and validation plan.

- `FRONTEND_FIRST_COMPLETE_PRODUCT_PLAN_2026-08-12.md`  
  Full frontend-first product plan. This is the main planning document for designing the website from student-facing pages first, then deriving backend modules, APIs, data models, and admin/adviser/provider tools.

### Migration Intake

- `migration-intake/`  
  First copied intake from CSCAlite. This is not yet a runnable CUAC app. It is a source pool for refactoring.

Included domains:

- public school/program discovery
- school detail
- comparison
- scholarships
- Study China city/timeline content
- student profile, saved schools, compare state
- admin school/scholarship/city/timeline management
- backend school/study-china/search/content/me/commerce/consulting modules
- Prisma schema and relevant migrations
- scholarship seed data and import examples

## Design Direction

CUAC should be:

- simple
- direct
- clear
- visually friendly
- light to use
- trustworthy
- program-first
- deadline-driven
- document-aware
- international-student focused

Working design phrase:

**Calm Application Workspace**

## Recommended Next Step

Create wireframe specifications for the five core pages:

1. Home
2. Program Search
3. Program Detail
4. Student Hub
5. Application Builder

After these five pages are settled, derive:

- route map
- component inventory
- API contracts
- data model ERD
- CSCAlite-to-CUAC refactor map
- runnable app scaffold

## Production Design Package

The project now includes a production design document set for turning the frontend demo into a mature product:

- `CUAC_PRODUCTION_DESIGN_INDEX.md`  
  Master index, reading order, MVP boundary, implementation phases, and coverage map.

- `CUAC_PRODUCT_PRODUCTION_ROADMAP.md`  
  Full production roadmap from the current demo to complete MVP launch and post-launch expansion. It defines stages, deliverables, gates, infrastructure assumptions, Agent/payment boundaries, and the practical build order.

- `CUAC_PRODUCT_ARCHITECTURE_SPEC.md`  
  Product surfaces, service layers, domain flow, Agent position, quality requirements, and MVP boundary.

- `CUAC_FRONTEND_PRODUCTIZATION_SPEC.md`  
  Frontend route contracts, role surfaces, component inventory, state model, data field mapping, Agent frontend contract, and normalization plan.

- `CUAC_LEGACY_FIELD_MAPPING_SPEC.md`  
  CSCAlite-based field contract for CUAC schools, programs, scholarships, cities, search metadata, and static demo aliases.

- `CUAC_FRONTEND_ROUTE_CONTRACT_CHECKLIST.md`  
  Page-level route contract checklist for public, student, school, and CUAC Ops surfaces.

- `CUAC_DATABASE_ERD_SPEC.md`  
  PostgreSQL-oriented schema for identity, catalog, student profiles, application sets, school applications, payments, notifications, Agent, audit, and analytics.

- `CUAC_ROLE_PERMISSION_MATRIX.md`  
  Role model and permission matrix for students, school tenants, CUAC Ops/Admin, and Agent Service.

- `CUAC_APPLICATION_API_CONTRACT.md`  
  API contract for catalog, student profile, applications, payments, school portal, Agent, analytics, and notifications.

- `CUAC_SCHOOL_PORTAL_BACKEND_SPEC.md`  
  Backend model for school tenant isolation, queue operations, statuses, metrics, exports, and school Agent behavior.

- `design-lab/SCHOOL_PORTAL_PRODUCT_SPEC.md`  
  Current frontend demo boundary for the school-facing admissions workspace, including teacher jobs, tenant scope, document handling, analytics, Agent limits, and backend handoff notes.

- `CUAC_AGENT_ACTION_ARCHITECTURE.md`  
  Natural-language Agent layers, action registry, confirmation model, PageAgent reference boundary, prompt-injection controls, and observability.

- `CUAC_SECURE_AGENT_BACKEND_ARCHITECTURE.md`  
  Security-first backend and Agent architecture baseline. It maps mature security references to CUAC's Agent sandbox, Tool Gateway, retrieval boundaries, payment isolation, tenant isolation, policy engine, audit, retention, and backend implementation gates.

- `CUAC_FULL_BACKEND_BLUEPRINT.md`  
  Full website backend startup blueprint for moving from the frontend demo into Phase 0/1 backend work. It maps database schema, Auth/Account, tenant/role/policy, student applications, school portal, Ops Admin, catalog, payments, Agent Tool Gateway, audit, RAG, notifications, first migrations, first APIs, test gates, and deferred surfaces.

- `CUAC_BACKEND_ADR_0001_PHASE0_1_FOUNDATION.md`  
  Phase 0 architecture decision record for PostgreSQL, ORM source of truth, unified auth, policy, audit, catalog foundation, Agent boundary, and deferred backend surfaces.

- `CUAC_BACKEND_IMPLEMENTATION_PLAN.md`  
  Phased backend implementation plan from architecture lock through catalog, student core, billing, school portal, Agent MVP, Ops, analytics, and hardening.

- `CUAC_BACKEND_PHASE0_1_EXECUTION_BACKLOG.md`  
  Actionable Phase 0/1 ticket backlog for architecture lock, backend skeleton, identity, tenant policy, audit, catalog schema, public catalog APIs, and security test scaffolding.

- `CUAC_BACKEND_FOUNDATION_SCHEMA_API_CONTRACT.md`  
  Narrow foundation schema and API contract for stable objects that can be implemented before administrator-panel productization finishes.

- `CUAC_AGENT_TOOL_REGISTRY_SPEC.md`  
  Production Agent tool registry model, allowed tools, prohibited tools, execution contract, and minimum test fixtures.

- `CUAC_AGENT_CONTEXT_LIFECYCLE_SPEC.md`  
  Agent context lifecycle design for guest use, registration carry-forward, important-information criteria, short working context, structured memory, retention, and user controls.

- `CUAC_AGENT_DATA_SANDBOX_SPEC.md`  
  Mandatory Agent data sandbox specification for persona isolation, data-class allowlists, tenant boundaries, role-specific projections, retrieval lanes, memory/cache namespaces, audit, prohibited paths, and acceptance tests.

- `CUAC_DATA_CLASSIFICATION_REGISTER.md`  
  Data classification register for catalog, student, application, payment, tenant, Ops, Agent, logs, vector indexes, and audit handling.

- `CUAC_BACKEND_SECURITY_TEST_PLAN.md`  
  Required security test gates for authentication, object ownership, tenant isolation, payment isolation, Agent sandbox, prompt injection, retrieval, logging, and data governance.

- `CUAC_ANALYTICS_EVENT_TAXONOMY.md`  
  Product, school, Ops, payment, and Agent events plus metric registry and governed natural-language analytics.

- `CUAC_SECURITY_PRIVACY_THREAT_MODEL.md`  
  Threat model for tenant leakage, Agent overreach, prompt injection, payment fraud, exports, privacy, and incident response.

- `CUAC_DATA_GOVERNANCE_SPEC.md`  
  Source status, verification workflow, school change requests, data quality checks, and catalog ownership.

- `CUAC_PAYMENTS_BILLING_SPEC.md`  
  Fee rule, payment states, invoices, refunds, failure handling, and tests.

- `CUAC_HOSTED_PAYMENT_AND_RECONCILIATION_CONTRACT.md`  
  Fixed hosted gateway, signed webhook, reconciliation, settlement, refund revocation, status projection, configuration and staging acceptance boundary.

- `CUAC_OPS_BILLING_REVIEW_CONTRACT.md`  
  Grant-bound quarantined provider-event review, dual-control no-change closure, metadata-only audit, and explicit prohibition of replay or payment mutation.

- `CUAC_OPS_ROUTING_REVIEW_CONTRACT.md`  
  Grant-bound quarantined submission-delivery review, generation-safe dual control, no-retry closure, and one narrowly approved retry after confirmed attempt exhaustion.

- `CUAC_OPS_DATA_QUALITY_REVIEW_CONTRACT.md`  
  Grant-bound city, school, program, and scholarship source-quality queue with generation-safe claim, escalation, dual-control resolution, and bounded re-verification dates.

- `CUAC_AUTH_STEP_UP_AND_PUBLIC_SUBMISSION_CONTRACT.md`  
  Password reauthentication, bounded session step-up, public whole-set submit API, atomic acceptance, idempotent recovery, and the distinction between CUAC acceptance and school receipt.

- `CUAC_APPLICATION_REFERENCE_CONTRACT.md`  
  Stable server-issued CUAC application reference, annual allocation, student/payment/school propagation, tenant-scoped lookup, migration and compatibility boundaries.

- `CUAC_NOTIFICATIONS_COMMUNICATION_SPEC.md`  
  Student, school, and CUAC Ops notification rules, templates, channels, and Agent communication boundaries.

- `CUAC_OPERATIONS_ADMIN_SPEC.md`  
  CUAC internal tools for catalog, routing, school tenant, payment, support, Agent audit, analytics, and alerts.

- `CUAC_INFRASTRUCTURE_DELIVERY_SPEC.md`  
  Environments, CI/CD gates, migrations, jobs, observability, backups, feature flags, testing, accessibility, and release policy.
