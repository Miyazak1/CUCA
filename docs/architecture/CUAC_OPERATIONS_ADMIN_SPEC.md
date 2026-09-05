# CUAC Operations Admin Spec

Date: 2026-09-02

Status: governed Ops APIs and an independent real-API frontend candidate are locally verified; replacing the existing untracked `ops-admin.html` entry remains pending explicit approval, and the broader Ops/Admin surface remains incomplete.

## 1. Purpose

CUAC needs internal operations tools to keep the marketplace reliable. This document defines the admin and ops console required beyond the student and school surfaces.

## 2. Ops Users

### Data Ops

Maintains schools, programs, scholarships, deadlines, tuition, source evidence, and guides.

### School Success

Onboards school tenants, supports school staff, monitors responsiveness.

### Student Support

Handles student account, payment, and submission issues.

### Finance Ops

Monitors payment, invoices, refunds, and reconciliation.

### Platform Admin

Manages roles, system settings, security, and high-risk operations.

## 3. Core Admin Modules

### Catalog Admin

Capabilities:

- create/edit/archive schools;
- create/edit/archive programs;
- manage intakes and deadlines;
- link scholarships;
- attach source evidence;
- mark verified/stale/disputed;
- review school change requests;
- bulk import with validation.

### Application Routing Monitor

Capabilities:

- view application sets;
- inspect school record creation;
- retry failed routing;
- detect duplicate submissions;
- inspect idempotency keys;
- view event history.

### School Tenant Admin

Capabilities:

- create tenant;
- invite school owner;
- manage membership;
- suspend tenant;
- view tenant activity;
- configure school contact settings;
- view school export logs.

### Payment Admin

Capabilities:

- search payments;
- view fee snapshot;
- reconcile provider status;
- issue refund request;
- approve refund if permitted;
- export finance report.

### Support Console

Capabilities:

- search user by email;
- view limited profile;
- view application status;
- resend verification;
- reset safe account states;
- start audited support access session.

### Agent Audit Explorer

Capabilities:

- view Agent conversations metadata;
- view executed actions;
- filter failures;
- inspect permission denials;
- mark unsafe behavior for review;
- tune action policies.

### Analytics Admin

Capabilities:

- platform funnel;
- school responsiveness;
- payment revenue;
- catalog freshness;
- Agent success/failure;
- security anomalies.

## 4. Admin Permission Levels

- read_only_ops
- data_ops
- school_success
- student_support
- finance_ops
- security_admin
- super_admin

No single non-admin role should have all powers.

High-risk actions require:

- permission;
- reason;
- audit log;
- sometimes second approval.

## 5. Support Access

Support access to student or school data must be:

- purpose-limited;
- time-limited;
- audited;
- visible in admin logs;
- optionally visible to the affected user/school later.

Support should not use student passwords or impersonate without a separate audited mechanism.

## 6. Data Quality Workbench

Queues:

- stale programs;
- missing deadline;
- broken source URL;
- disputed school data;
- pending school change requests;
- expired scholarship;
- high-traffic stale records.

Each queue item should show:

- entity;
- problem;
- source evidence;
- suggested fix;
- owner;
- due date.

## 7. Operational Alerts

Alerts:

- payment webhook failure;
- routing job failure;
- school tenant access anomaly;
- export spike;
- stale critical deadline;
- Agent action failure spike;
- email delivery failure;
- high-priority school records unhandled.

## 8. Admin Audit

Always audit:

- role changes;
- tenant changes;
- catalog publish;
- cross-tenant data access;
- export;
- refund;
- support access;
- Agent policy changes;
- security setting changes.

## 9. MVP Scope

Must have:

- catalog CRUD and verification;
- school tenant and staff invites;
- application routing monitor;
- payment monitor;
- basic support console;
- audit log viewer.

Later:

- full BI;
- automated source crawling;
- workflow approvals;
- school self-service publishing;
- anomaly detection.

## 10. Current Frontend Boundary

The existing untracked `ops-admin.html` still loads the historical `completion.js` demo and has not been overwritten because it may contain another task's frontend work.

The independent candidate `public/ops-admin-api.html` and `public/ops-admin-runtime.js` now expose only backend capabilities that exist:

- the fixed five-queue operations summary;
- quarantined official-delivery review with claim, escalation, dual-control close, and the sole bounded retry command;
- quarantined payment-event review with claim, escalation, and dual-control no-change resolution;
- catalog source-quality review for city, school, program, and scholarship entities;
- application-scoped support lookup through a 15-minute audited session that is kept in memory and explicitly closed.

The candidate does not load `CuacDataClient`, `completion.js`, local or session storage, or an Agent surface. It does not display fabricated owner, priority, analytics, export, refund, arbitrary catalog-edit, user-search, file, or applicant-profile capabilities. Switching the canonical `ops-admin.html` entry to this implementation requires explicit approval because that file is currently an untracked frontend artifact.

Production still needs real staff IdP/MFA, school change requests and general catalog editing, automated freshness scheduling, external case integration, staging browser verification, and the approved canonical-entry switch.

Frontend candidate evidence on 2026-09-03:

- `npm run test:ops-admin-frontend`: 3/3, covering real endpoint use, revision/evidence-bound commands, no forged authority fields, in-memory support sessions, responsive layout, and absence of demo/Agent storage;
- focused Ops support, monitoring, routing, billing, and data-quality suites: 57/57;
- TypeScript project check and production build: passed;
- `npm run local:smoke` against `http://127.0.0.1:52118` and the persistent local PostgreSQL instance: passed, including five monitoring queues, eight data-quality items, empty but readable payment/routing queues, and an opened-looked-up-closed support session;
- guest browser access to `ops-admin-api.html` redirects to `auth.html?role=ops` without console warnings or errors.

Authenticated browser interaction and the canonical `ops-admin.html` switch remain unverified pending explicit authorization to use the local Ops credential and replace the existing untracked page.

## 11. Current Backend Milestone

The first production-shaped support flow opens `POST /api/v1/ops/support-sessions` with an exact CUAC ID and fixed reason, reads through `POST /api/v1/ops/application-lookups` using only the returned support-session UUID, and closes through `DELETE /api/v1/ops/support-sessions/:id`. The session is bound to the exact staff grant, actor, role, Application Set, and CUAC ID; it expires after at most 15 minutes or earlier with its grant. Each operation rechecks live authority and commits its metadata-only audit in the same transaction. The read response remains limited to Application Set, submission transport counts, and Program Application/catalog status fields.

It does not implement user/email search, applicant profile access, payment or material inspection, impersonation, support notes, bulk export, fine-grained permission levels, mandatory MFA, or Ops UI. It is not an Agent tool. See [CUAC Ops application support contract](CUAC_OPS_APPLICATION_SUPPORT_CONTRACT.md).

### Routing Review Milestone

`GET /api/v1/ops/routing/submissions` exposes a fixed minimal queue for currently quarantined official-submission outboxes. Staff with a live `cuac_ops` or `cuac_admin` grant can claim the exact quarantine generation and the assignee can escalate it. Only a different `cuac_admin` with password step-up can close without retry or approve the narrowly eligible retry.

Unknown provider results and invalid payload/binding outcomes can never be retried. Only an outbox that exhausted exactly five attempts with `ATTEMPT_LIMIT` and has no delivery receipt can receive one human-approved retry. That transition reuses the original outbox/group and preserves provider, payload, application and route binding; a database partial unique index prevents a second retry approval. No route reassignment, payload reconstruction, school receipt creation or free-text note API exists. See [CUAC Ops routing review contract](CUAC_OPS_ROUTING_REVIEW_CONTRACT.md).

### Catalog Data-Quality Review Milestone

`GET /api/v1/ops/data-quality/catalog` now exposes a fixed minimal queue for city, school, program and scholarship records with missing, invalid, unverified, stale, disputed or incomplete verification evidence. A live `cuac_ops` or `cuac_admin` grant may read and claim an exact entity/evidence generation; only its assignee may escalate, and only a different `cuac_admin` with password step-up may resolve it.

Resolution can confirm the stored source with a bounded next-review date, mark the entity disputed because its source conflicts or is invalid, or close an evidence-missing review without changing the entity. It cannot edit descriptive catalog fields, fetch a source URL, accept school corrections, or bypass requirements publication governance. See [CUAC Ops catalog data-quality review contract](CUAC_OPS_DATA_QUALITY_REVIEW_CONTRACT.md).
