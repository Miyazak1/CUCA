# CUAC Notification Delivery Contract

Date: 2026-09-02

Status: implementation contract for the non-Agent notification core.

## 1. Boundary

Notifications are owned by one authenticated persona scope: `recipient user + audience role + optional school tenant`.
Student and CUAC staff scopes never carry a school tenant. School staff notifications always carry the exact active school tenant.
A multi-role account cannot read or mutate another role or tenant's notifications by changing request fields.

The Agent has no notification write or delivery authority. A later read-only Tool Gateway projection may summarize already-authorized items.

## 2. Persistence

- `notification_preferences` stores per-topic channel choices with optimistic revisions.
- `notification_templates` stores bounded, locale- and channel-specific reviewed template versions and content digests.
- `notification_events` stores one idempotent domain event, a bounded variable object and its digest.
- `notification_deliveries` stores one materialized delivery per channel, its in-app state or external delivery lifecycle, lease, attempts and terminal outcome.

Event and delivery scope are tied by a composite foreign key. Template role and channel are tied to each delivery by a second composite foreign key. Raw idempotency keys, provider errors, credentials, payment data, school-only notes and application materials are never stored in notification records.

## 3. Current Events

The implemented production event sources are:

- a committed school application workflow change, which creates a student `application_updates` event atomically with the status event and metadata-only audit;
- CUAC acceptance of an atomic application-set submission, which creates `application_submission_accepted` in the same transaction and explicitly states that school receipt has not occurred;
- committed payment success, cancellation or refund transitions, which create `payment_succeeded`, `payment_canceled` or `payment_refunded` in the same transaction as billing state and audit.

Contacted and waiting-for-documents use dedicated safe copy; other school workflow changes use neutral CUAC-routing copy and do not claim an official university decision. Built-in templates accept only server-derived identifiers. Their action paths are same-origin and generated from those identifiers. School closure reasons, contact notes, amounts, provider references and payment credentials are not template variables.

## 4. APIs

- `GET /api/v1/notifications?limit=&cursor=` returns bounded in-app items for the current persona scope.
- `PATCH /api/v1/notifications/:notificationId/read` requires `expectedRevision` and changes only the caller's unread item to read.
- `PATCH /api/v1/notifications/read-all` marks current-scope unread items read in one transaction.
- `GET /api/v1/notifications/preferences` returns effective topic defaults and stored revisions for the current persona scope.
- `PUT /api/v1/notifications/preferences` replaces the supplied topic settings with per-topic expected revisions in one transaction.

Authority fields in bodies or queries are rejected. Account-security in-app and email delivery cannot be disabled. Mutations and metadata-only audit commit together.

## 5. External Delivery

Email and SMS use a one-shot provider facade outside database transactions. Workers claim a committed row with `FOR UPDATE SKIP LOCKED`, persist sending intent, call the provider with a stable delivery ID, then record an enum result.

- accepted: terminal success;
- explicit not accepted: bounded exponential retry;
- unknown result or expired sending lease: terminal uncertain, never automatic duplicate delivery;
- attempt limit: failed/dead-letter;
- disabled preference, inactive authority or missing verified destination: suppressed.

SMS is represented and observable, but remains suppressed until a verified phone destination exists. A fixed-host Aliyun Direct Mail SMTP adapter, bounded continuous worker runtime and supervised process entry are implemented for email. Environment templates keep the provider disabled by default; real credentials, provider acceptance, bounce/complaint evidence and worker supervision remain staging gates. See [the notification worker runbook](CUAC_NOTIFICATION_WORKER_RUNBOOK.md).

## 6. Verification Gate

Completion requires unit/API tests, schema and immutable migration checks, real PostgreSQL constraint/concurrency/rollback tests, built-production HTTP rehearsal, TypeScript, backend suite and updated release hashes. The current local gate passes 693/693 backend tests and 510/510 real PostgreSQL plus built-production HTTP tests. Real email/SMS acceptance remains a staging gate and must not be inferred from local provider doubles.

## 7. Frontend Runtime

`public/notifications.html` now loads `public/notifications-runtime.js` as its notification authority. The runtime:

- reads only `GET /api/v1/notifications` and `GET /api/v1/notifications/preferences` for the active authenticated persona;
- follows the server cursor and never merges demo or browser-stored notification records;
- marks an item read with its exact server revision, marks the current persona scope read through the bulk endpoint, and does not invent an unsupported unread or dismiss action;
- updates only the selected server topic while preserving its returned email/SMS choices and exact expected revision;
- exposes the six implemented student topics, keeps account-security in-app delivery locked on, and contains no Agent-only notification category;
- accepts an action link only when it resolves to the current origin and escapes all server-rendered text.

`frontend/tests/notifications-public-contract.test.mjs` rejects local/session storage, demo state, unsupported actions, topic drift and unsafe action-path handling. The focused frontend contract passes `2/2`; the local PostgreSQL smoke reads all six effective student preferences, and the production build succeeds. External email and SMS remain disabled until the staging gates in section 5 are satisfied.
