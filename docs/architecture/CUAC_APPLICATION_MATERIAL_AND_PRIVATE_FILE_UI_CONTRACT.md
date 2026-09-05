# CUAC application material and private file UI contract

Status: implemented in the public application workspace and verified against the canonical HTTP routes.

## Scope

The student application UI treats private files, record selection, material preview, disclosure authorization and immutable snapshots as separate evidence states. It never converts profile completion, browser storage, a preview action or a checked control into submission authorization.

Each material envelope is scoped to one server-owned tuple:

`student user + application set + application choice + school + program + program intake`

## Private files

The UI uses the owner-scoped `/api/v1/student/files` service.

1. `GET /api/v1/student/files` lists only server file records.
2. The browser computes a lowercase SHA-256 digest before requesting an upload intent.
3. `POST /api/v1/student/files` receives category, plain filename, content type, byte size and digest with an idempotency key.
4. The file bytes are sent only to the returned short-lived private object-storage URL.
5. `POST /api/v1/student/files/:fileId/complete` moves the record into scan processing using its exact revision.
6. Download is offered only when the server status is `clean`.
7. Delete and complete operations send the exact current revision.

If object storage is absent or uploads are disabled, the UI reports the service boundary and does not infer file readiness from applicant answers.

## Choice-specific material envelope

For every application choice, the UI follows this sequence:

1. Read `material-selection` and `preflight?locale=en`.
2. Read current authorization and snapshot evidence independently.
3. Save a minimal student-selected set of applicant fields, education record IDs and assessment record IDs with the exact selection revision and all four source revisions.
4. Generate a non-persisted `material-preview` and show its exact record counts, names and content SHA-256.
5. Display the current published `application_disclosure` notice and official submission policy metadata.
6. At the student's explicit action, re-read the selection, regenerate the preview and re-read preflight.
7. Abort if the selection revision, any source revision, preview digest, notice publication or policy publication differs from what was shown.
8. Record one `submission-authorization` using the canonical confirmation value.
9. Create one encrypted immutable `material-snapshot` bound to the returned authorization scope digest and material content digest.

Saving and previewing do not authorize disclosure. Authorization can be withdrawn before submission. A source edit invalidates locally cached evidence immediately; the server independently reports stale evidence through preflight.

## Readiness rule

The client reports material preparation ready only when every current application choice has both:

- `submissionAuthorization.current === true`
- `materialSnapshot.current === true`

Payment and submission remain locked otherwise. Billing entitlement and final atomic submission are separate later gates.

## Verification

- Public application contract tests cover the exact routes, version bindings, digest rechecks and absence of permanent account-level consent.
- Local smoke authenticates the synthetic student and performs read-only checks against material selection, preflight, authorization and snapshot routes on PostgreSQL.
- The full PostgreSQL/network rehearsal covers selection concurrency, authorization freshness, encrypted snapshot integrity and cross-owner denial.
