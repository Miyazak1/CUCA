# CUAC School Portal Backend Spec

Date: 2026-08-14

Status: tenant-safe manual school workflow and real API-backed school workspace implemented and verified; delivery, approved school-visible profile projection, assignment, notification, export, analytics, and Agent extensions remain planned.

Decision update (2026-09-02): one program choice is one independent school application. Same-school programs do not share a merged application/status. The internal atomic submission boundary and manual tenant workflow are implemented, but no public submit endpoint or external school delivery worker/provider is enabled. See [the backend submission contract](CUAC_APPLICATION_SUBMISSION_BACKEND_CONTRACT.md) and [the atomic submission contract](CUAC_ATOMIC_APPLICATION_SUBMISSION_CONTRACT.md).

## 0. Current Implemented Boundary

The current backend implements:

- `GET /api/v1/school/applications` and `GET /api/v1/school/applications/:applicationId` for the server-resolved school tenant;
- `PATCH /api/v1/school/applications/:applicationId/status` with `expectedRevision`, a controlled target status, optional bounded reason, and a required `Idempotency-Key`;
- `POST /api/v1/school/applications/:applicationId/contact-logs` with controlled channel, direction and outcome values, a bounded private note, and a required `Idempotency-Key`;
- tenant-scoped status history and contact records, optimistic concurrency, idempotent command replay, metadata-only audit, and atomic rollback when audit fails;
- live account, role, active school and active membership rechecks. `admissions`, `counselor`, and `school_admin` may write; `viewer` cannot;
- a production-entry school workspace that reads only these tenant-scoped APIs, verifies every returned row against the authenticated tenant, and sends revision-checked, idempotent status/contact commands;
- an explicit legacy boundary: `cuac.program-application.v1` records are visible as historical records but rendered read-only, while confirmed `cuac.program-application.v2` records expose only the workflow actions allowed by the backend state machine.

`pending_submission` means CUAC accepted an internal application batch but has no confirmed school delivery. Such rows are hidden from school list/detail and cannot enter the manual workflow. A mutable record must be a confirmed received `cuac.program-application.v2` row with a finite `submitted_at` and a workflow status beginning at `new`. Legacy v1 records remain readable historical data when visible but cannot use the new mutation commands.

Not implemented in this slice: the approved delivery worker/provider that advances outbox work to confirmed receipt, the privacy-approved student profile projection, server-side queue filtering/pagination, owner assignment, bulk actions, exports, metrics, notifications, school settings, CUAC Ops cross-tenant workflow actions, and any Agent school write capability. The frontend therefore does not fabricate these controls or fields.

## 1. Purpose

This document defines the backend design for the school portal. The school portal is a separate account area for university teachers, admissions officers, and international office staff.

The central rule:

```txt
School staff can only access records for their own school tenant.
```

They must not see whether a student applied to other schools.

## 2. Tenant Model

Each school is a tenant represented by `schools.id`.

School staff access is granted through `school_staff_memberships`.

Every school-visible application row uses:

```txt
school_applications.school_id
```

No school portal list, detail, export, metric, or Agent action may omit tenant filtering.

## 3. School Application Creation

When the internal student submission boundary accepts an application set:

1. Application Service validates each concrete program choice and its owning school.
2. For each submitted choice, it creates one `school_applications` row, keyed by `application_choice_id` and scoped by `school_id`.
3. Two choices under the same school create two independent applications; no merged `school_application_program_interests` table is used.
4. It reserves a school-scoped profile projection. Writing applicant, education, assessment, source-lineage, or contact fields into that projection requires an explicit product/privacy approval and is not implemented yet.
5. Until that approval and implementation exist, the school API returns the stored projection as-is and the workspace reports that no defined profile fields were included; it does not derive missing values from student or cross-tenant tables.
6. It creates inert pending dispatch outbox work and keeps the school record at `pending_submission`.
7. A future approved delivery worker/provider must atomically record confirmed delivery, set finite `submitted_at`, and move the row to `new` before school staff can see or mutate it.
8. School and student notifications remain future work.

The school application must not include:

- other schools in the application set;
- other school choices;
- other school statuses;
- fee paid for other schools;
- private CUAC Ops notes.
- `sourceFieldLineage` or `informationSources` for other schools.

## 4. Planned School-Safe Projection

This section defines the proposed maximum projection, not fields currently disclosed by the implementation. The exact approved subset and disclosure event must be recorded before the delivery transaction may populate it.

Candidate school-visible fields:

- student full name;
- email;
- phone/WhatsApp;
- country/passport region;
- education stage;
- the concrete program for this application; other same-school applications remain separate authorized records;
- intake;
- teaching language;
- funding intent;
- language status;
- student note or CUAC readiness note marked school-visible;
- status and timeline for this school record;
- owner and internal school notes for this tenant.
- tenant-safe information sources explaining whether visible fields came from student choice, program catalog, school catalog, or student profile;
- tenant-safe `sourceFieldLineage` metadata for Agent citation, audit, and data-quality review.

School detail must not show:

- other school choices;
- student favourites;
- unrelated profile preferences;
- payment amount except optional `CUAC routing paid/free` badge if needed;
- private support tickets;
- Agent conversation history unless explicitly shared.

## 4.1 Source Lineage Projection

After explicit approval and implementation, school detail APIs may expose machine-readable lineage for the current tenant record:

- `informationSources.selectedByStudent`
- `informationSources.fromProgramRecord`
- `informationSources.fromSchoolRecord`
- `informationSources.fromStudentProfile`
- `sourceFieldLineage.fromProgramRecord`
- `sourceFieldLineage.fromSchoolRecord`
- `sourceFieldLineage.fromStudentProfile`
- `notCollectedByCuac`

Lineage metadata is not a cross-tenant audit bypass. It must be generated from the already school-scoped application row and program-interest rows. School staff and school Agent tools may use it to explain visible values, but not to infer or query the student's other school choices.

## 5. Queue Operations

Required queue filters:

- search
- status
- program
- intake
- country
- teaching language
- funding intent
- priority
- owner
- source
- received date

Required sort modes:

- priority first
- newest received
- deadline risk
- owner
- status

Bulk actions:

- mark selected contacted;
- assign owner;
- move to waiting for documents;
- export selected;
- copy document request template.

Bulk actions must enforce max batch size and audit.

## 6. Status Model

School statuses:

- new
- needs_review
- contact_queued
- contacted
- waiting_for_documents
- documents_received_by_school
- not_a_fit
- converted_to_official_application
- archived

Status transitions:

| From | To | Actor |
| --- | --- | --- |
| new | needs_review | school staff |
| new | contact_queued | school staff |
| new | contacted | school staff |
| needs_review | contact_queued | school staff |
| contact_queued | contacted | school staff |
| contacted | waiting_for_documents | school staff |
| waiting_for_documents | documents_received_by_school | school staff |
| any active | not_a_fit | school staff |
| any active | converted_to_official_application | school staff |
| any non-final | archived | school staff |

Every transition creates `school_application_status_events`.

The implemented write path is manual and requires an active `admissions`, `counselor`, or `school_admin` membership in the exact tenant. It does not register an Agent tool or CUAC Ops cross-tenant mutation path. `not_a_fit` and `archived` require a reason. The status command uses compare-and-swap on `school_revision`; a stale revision returns conflict and must be re-read.

Student-visible mapping:

| School Status | Student Display |
| --- | --- |
| new | Sent to school |
| needs_review | School reviewing |
| contact_queued | School preparing contact |
| contacted | School contacted you |
| waiting_for_documents | School waiting for your documents |
| documents_received_by_school | School received documents |
| not_a_fit | Closed by school |
| converted_to_official_application | Official application started |
| archived | Closed |

## 7. Metrics

School dashboard metrics must be tenant-scoped.

Required:

- new records today;
- need first contact;
- waiting for documents;
- contacted this week;
- records by program;
- records by country;
- records by intake;
- funding intent split;
- source split;
- average time to first contact;
- conversion to official application.

Metric queries must use school-safe views.

## 8. Notifications

Events that notify school users:

- new school application received;
- high-priority record received;
- assigned as owner;
- due action approaching;
- export ready;
- CUAC Ops comment on school-visible record.

Events that notify student:

- school viewed application;
- school marked contacted;
- school waiting for documents;
- school started official application.

## 9. Exports

Export rules:

- only tenant-scoped rows;
- require explicit action;
- include actor, filter, row count, and generated file in audit log;
- expire export URLs;
- mask fields based on role if needed;
- rate limit exports.

## 10. School Program Management

School owners may eventually manage:

- program availability;
- intake dates;
- contact email;
- document request templates;
- faculty owner mappings.

MVP can restrict catalog publication to CUAC Ops while allowing schools to submit change requests.

## 11. School Agent

School Agent can:

- summarize a student record;
- explain missing info;
- draft document request copy;
- filter queue;
- create a status-change preview;
- mark contacted after confirmation;
- summarize weekly intake.

School Agent cannot:

- see other tenants;
- infer other school choices;
- make admission decisions;
- send final offers;
- bypass role limits;
- export data without confirmation.

## 12. Backend Tests

Required policy tests:

- school A user cannot list school B records;
- school A user cannot access school B detail by direct ID;
- school A export contains only school A rows;
- school Agent action cannot update school B row;
- CUAC Ops cross-tenant access creates audit log;
- student submission creates one school application per concrete program choice;
- two choices under the same school create two independent school applications, with separate IDs and status histories;
- changing one project's status does not implicitly change another project's application.

## 13. Verification Evidence

Run from `frontend/`:

```powershell
npm run db:pg:schema:check
npm run db:pg:rehearse
npm run test:backend
npm exec tsc -b --pretty false
npm run build
```

Verified on 2026-09-02 against the current worktree:

- immutable migration baseline through `0035_school_application_workflow`, 36 migrations, 27 snapshots, and 61 declared PostgreSQL tables;
- disposable PostgreSQL 16 rehearsal: 387/387 tests, including tenant isolation, hidden undelivered rows, status/contact idempotency, revision races, viewer denial, database constraints, and audit rollback;
- backend unit/contract tests: 576/576; Agent Gateway boundary tests: 17/17;
- TypeScript project check and production build passed, including both new school mutation routes.

Additional frontend verification on 2026-09-03:

- `public/school-portal.html` loads `school-portal-runtime.js` and no longer loads the mock data client or legacy demo portal runtime;
- the public contract tests verify tenant matching, authenticated school role enforcement, real API routes, revision checks, idempotency keys, v1 read-only behavior, and absence of fabricated owner, priority, analytics, bulk, or export features;
- the focused school portal backend suite, TypeScript check, local PostgreSQL startup, and local smoke test passed after adding `applicationRecordFormat` to the queue/detail DTO.

This evidence proves the implemented manual workflow and real frontend workspace slice. It does not prove external delivery, the proposed profile projection, notification, export, analytics, full school operations, or platform production readiness.
