# CUAC Notifications Communication Spec

Date: 2026-08-14

Status: account-scoped in-app notification core implemented and locally verified; external provider delivery remains a staging gate.

## 1. Purpose

This document defines how CUAC communicates status changes, reminders, school follow-up, payment results, and Agent activity to students, school staff, and CUAC Ops.

## 2. Channels

MVP:

- in-app notifications;
- email for critical events.

Later:

- WhatsApp;
- SMS;
- school webhook;
- digest emails;
- browser push.

## 3. Notification Principles

- Status changes should be clear and short.
- Do not over-notify students.
- Do not reveal other school choices to school users.
- Use exact dates for deadlines.
- Separate CUAC routing updates from official school decisions.
- Every notification links to the relevant scoped page.

## 4. Student Notifications

| Trigger | Title | Link |
| --- | --- | --- |
| application_submission_accepted | CUAC accepted the application for delivery | application status |
| payment_succeeded | Payment completed | payment review |
| payment_canceled | Payment canceled | payment review |
| payment_refunded | Payment refunded | payment review |
| school_viewed_application | A school viewed your CUAC record | Hub/application |
| school_marked_contacted | A school has contacted you | Hub/application |
| school_waiting_documents | School is waiting for your documents | application |
| profile_missing_info | Finish your contact info | profile/application |
| deadline_approaching | Deadline approaching | program/application |

Student copy must say schools contact directly for official documents.

## 5. School Notifications

| Trigger | Title | Link |
| --- | --- | --- |
| school_application_created | New CUAC student record | school application detail |
| high_priority_record_created | High-priority CUAC record | school queue |
| record_assigned | You were assigned a record | detail |
| due_action_soon | Follow-up due soon | queue |
| export_ready | Export ready | export download |

School notifications must be tenant scoped.

## 6. CUAC Ops Notifications

| Trigger | Title |
| --- | --- |
| routing_failed | School routing failed |
| payment_reconciliation_failed | Payment reconciliation issue |
| catalog_stale_threshold_hit | Catalog review needed |
| school_inactive_on_new_records | School has unhandled records |
| agent_action_failure_spike | Agent action failures increased |
| security_anomaly_detected | Access anomaly detected |

## 7. Message Templates

Templates should support:

- locale;
- role;
- channel;
- entity type;
- version;
- preview text;
- variables;
- legal footer.

Example variables:

- studentFirstName;
- schoolName;
- programName;
- deadlineDate;
- applicationSetId;
- schoolApplicationId.

## 8. Email Rules

Email is required for:

- account verification;
- password reset;
- school staff invite;
- payment receipt;
- application submitted;
- critical school notification if in-app unseen.

Email should not include excessive personal data.

## 9. In-App Notification States

- unread
- read
- archived
- actioned

## 10. Agent Communication

Agent may:

- summarize notifications;
- explain what changed;
- open relevant page;
- draft school-side contact text;
- remind user of next step.

Agent may not:

- send external messages without confirmation;
- claim a school decision;
- invent contact from a school.

## 11. Delivery Observability

Track:

- notification created;
- notification viewed;
- email sent;
- email bounced;
- email clicked;
- digest opened;
- action completed from notification.

## 12. Current Frontend Demo Coverage

The static demo now stores notification preferences in `cuacPreferencesDemoState`.

Covered in the frontend:

- Preferences can save deadline, document, funding, Agent-result, and general-update reminder categories;
- Preferences can save reminder timing;
- Notifications reads those preferences and hides disabled categories;
- Notifications quiet settings can update the same local preference state;
- browser QA verifies that disabling Agent-result reminders in Preferences removes Agent notifications from the Notifications center.

The production backend now persists persona-scoped notification events/deliveries, read state and role-bound account preferences. School application workflow changes, CUAC acceptance of an application-set submission, and committed payment success/cancellation/refund transitions atomically create idempotent student notifications. Submission copy states that school receipt has not occurred; notification records exclude closure reasons, contact notes, amounts, provider references and payment credentials. The implemented API surface is `GET /api/v1/notifications`, `PATCH /api/v1/notifications/:notificationId/read`, `PATCH /api/v1/notifications/read-all`, and `GET`/`PUT /api/v1/notifications/preferences`. The static demo remains separate and is not evidence that its pages are wired to these APIs.

## Auth Delivery Foundation (2026-09-01)

Auth verification/reset outbox is locally verified (BE-0718): migration 0023 adds encrypted short-lived token transport, owner-bound challenge FKs, committed-job leases, pre-send identity checks, bounded explicit-nonacceptance retries and uncertain-result quarantine. Challenge/enqueue/success audit share one transaction; terminal jobs erase ciphertext. Nineteen business-database cases, one nonempty upgrade and seven regular cases cover tampering, missing keys, rollback, concurrency, expiry and lost acknowledgements. This is not provider acceptance of real mail: the runtime remains deferred unless explicitly configured; no provider, scheduler, frontend action page or Agent access is enabled. See [auth email outbox contract](CUAC_AUTH_EMAIL_OUTBOX_CONTRACT.md).

Email action links require an explicitly configured same-origin action page and carry proof in the fragment, not a GET query to the POST mutation API. Those pages are not implemented by this backend batch; they must clear fragments, avoid third-party capture and require explicit POST confirmation. The general notification queue has bounded leases, idempotent delivery identity, explicit-nonacceptance retry and uncertain-result quarantine. A fixed-host Aliyun Direct Mail adapter and supervised worker entry are implemented, while environment templates keep them disabled until real staging delivery/bounce acceptance. SMS remains suppressed until a verified phone destination and reviewed adapter exist. Auth, invitation, application, payment and general notification jobs retain separate purpose-specific contracts; one queue must not be treated as authority for another. See [the worker runbook](CUAC_NOTIFICATION_WORKER_RUNBOOK.md).

## Notification Core Verification (2026-09-02)

Migration `0042_notification_delivery` adds notification preferences, reviewed templates, events and deliveries. The complete business rollback snapshot includes all four tables. Unit/API tests, a real PostgreSQL rehearsal and a production-built network HTTP rehearsal cover owner/role/tenant isolation, cursor pagination, read and preference revision conflicts, mandatory account-security channels, cross-origin/forged-authority rejection, idempotent school-status/submission/payment publication, audit rollback, worker leasing/retry/dead-letter and uncertain outcomes. The backend suite passes 693/693. The final HTTP rehearsal passed 510/510 on PostgreSQL 16.13 with 69 tables, 1048 columns, 386 constraints and 264 indexes; detached release hash `161acf06e323e3b9f554cba56f1e2c134651414b8dc6a6eb027364fa3266abf8`. This is local implementation evidence, not external email/SMS provider acceptance.
