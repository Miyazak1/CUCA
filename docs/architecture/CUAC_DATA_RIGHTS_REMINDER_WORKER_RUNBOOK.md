# CUAC data-rights reminder worker runbook

Status: implemented optional operational safeguard; it is not a legal prerequisite or a hard production-readiness gate. If enabled, production supervision, approved recipients and real email delivery still require staging acceptance.

## Purpose and boundary

The worker turns due data-rights milestones into mandatory in-app notification records and durable email-queue records. It does not send email, execute access/export/correction/deletion work, close a request or approve an outcome. External delivery remains the responsibility of the separately supervised notification worker after the `cuca.com` sender domain is approved.

## Reminder schedule

| Code | Recipient | Due time | Eligibility |
| --- | --- | --- | --- |
| `identity_24h` | requesting student | `receivedAt + 24 hours` | request remains received and identity is unconfirmed |
| `identity_day5` | requesting student | `receivedAt + 5 days` | request remains received and identity is unconfirmed |
| `internal_day12` | active assigned reviewer | `internalTargetAt - 3 days` | identity confirmed, active review and live CUAC grant |
| `response_due_soon` | active assigned reviewer | effective response deadline minus 6 days | non-terminal request, active review and live CUAC grant |
| `response_due_today` | active assigned reviewer | effective response deadline | non-terminal request, active review and live CUAC grant |

The effective response deadline is the approved extended date when one exists; otherwise it is the normal response deadline. Cancelled, fulfilled and denied requests are not eligible. Unassigned requests remain visible in the operations queue but have no personal staff recipient.

The day-25 unconfirmed-identity escalation is deliberately not generated. Production must first designate an approved privacy-lead roster and define who receives, owns and hands over that escalation.

## Safety and idempotency

- Due checks use the PostgreSQL UTC clock rather than a browser or application-host clock.
- Student reminders require a current active account and student role.
- Staff reminders require the current assignee, an active review, the required CUAC role and a live staff grant.
- Concurrent workers claim rows with transaction locks and skip already locked work.
- Target timestamps are normalized to milliseconds so PostgreSQL precision and JavaScript precision cannot create false duplicates.
- Reminder evidence and notification publication commit in one database transaction.
- A unique request/code/target ledger and stable event key make repeated scans safe.
- Notification copy is fixed separately for Simplified Chinese and English and excludes request payloads, identity evidence and internal case content.

Do not delete reminder-ledger or notification-event evidence during rollback or incident recovery. Stop the worker, preserve evidence and deploy a forward fix.

## Runtime

Start the worker only from a reviewed release:

```text
npm run start:data-rights-reminder-worker
```

Optional configuration:

| Variable | Default | Accepted range |
| --- | ---: | ---: |
| `CUAC_DATA_RIGHTS_REMINDER_POLL_MS` | `60000` | `1000`–`300000` |
| `CUAC_DATA_RIGHTS_REMINDER_BATCH_SIZE` | `100` | `1`–`100` |

The process must receive the same reviewed database, release-scope and runtime-authorization settings as other production workers. Startup fails closed before database initialization if the release is not authorized. Run one or more supervised instances; database locking and the immutable ledger protect concurrent execution.

## Monitoring and incident response

Monitor process restarts, failed polling cycles, notification delivery backlog, overdue unassigned requests and requests that passed a due milestone without a corresponding reminder ledger row. Alerting must not include email addresses, request payloads or case notes.

If the worker stops, restart the reviewed process after confirming database connectivity. The next scan catches past-due milestones and idempotently creates missing reminders. If a provider is unavailable, leave email deliveries queued and continue in-app publication; recover delivery through the notification-worker runbook.

## Production acceptance

Before enabling this optional worker in production:

1. deploy the worker under the platform supervisor with restart and failure alerts;
2. verify all five milestones in protected staging using both locales and an approved extension;
3. verify two concurrent instances create only one reminder per milestone;
4. prove revoked roles/grants and terminal requests fail closed;
5. designate the privacy staff and privacy-lead roster and approve the day-25 escalation path;
6. complete the separate real-domain notification delivery and bounce tests.
