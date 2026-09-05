# CUAC Notification Worker Runbook

Date: 2026-09-02

Status: deploy-time runbook for the reviewed Aliyun Direct Mail notification adapter. It is not staging acceptance or permission to send production mail.

## 1. Runtime Boundary

Run notification delivery as a separately supervised process:

```bash
npm run start:notification-worker
```

The process claims only committed `notification_deliveries` rows. It does not create domain events, accept HTTP traffic, read Agent context, send SMS, or modify application state. The API and in-app notification path remain available when this worker is stopped.

The worker uses a dedicated PostgreSQL pool with application name `cuac:notification-worker` and at most four connections. It handles `SIGINT` and `SIGTERM`, stops taking work, finishes the current invocation, closes the pool and exits. Start arguments are rejected; protected settings come only from the deployment environment.

## 2. Required Configuration

- `DATABASE_URL` and reviewed PostgreSQL TLS settings;
- `CUAC_PUBLIC_APP_URL`: exact HTTPS origin, with no path, query, fragment or credentials;
- `CUAC_NOTIFICATION_EMAIL_PROVIDER=aliyun-directmail-smtp`;
- `CUAC_NOTIFICATION_EMAIL_FROM`;
- `CUAC_NOTIFICATION_EMAIL_SMTP_REGION`: one reviewed regional endpoint key;
- `CUAC_NOTIFICATION_EMAIL_SMTP_USERNAME`: exactly the normalized verified sender;
- `CUAC_NOTIFICATION_EMAIL_SMTP_PASSWORD`: secret-manager value;
- `CUAC_NOTIFICATION_WORKER_POLL_MS`: 250..60000, default 1000;
- `CUAC_NOTIFICATION_WORKER_RECOVERY_MS`: 1000..300000, default 60000.

The adapter uses port 465, TLS 1.2 or newer, certificate verification, fixed region-to-host mapping, bounded network timeouts, and disabled file/URL attachment access. It does not accept an SMTP host from configuration.

Keep `CUAC_NOTIFICATION_WORKER_SUPERVISED=false` and `CUAC_NOTIFICATION_STAGING_ACCEPTED=false` until the corresponding evidence exists. These attestations affect only the offline gate; they do not enable or verify the service.

## 3. Pre-Start Gate

1. Apply and verify all migrations through `0042_notification_delivery` using the migration runbook.
2. Confirm the sender and Alibaba Cloud account belong to the target environment, and that staging and production credentials are distinct.
3. Run `npm run infra:production-check`. A configured but unaccepted worker must still fail the staging/production gate.
4. Confirm the supervisor restarts nonzero exits, forwards `SIGTERM`, caps restart rate, and retains structured stdout/stderr without environment capture.
5. Confirm database permissions are limited to the notification queue, user eligibility read, and metadata-only audit operations actually used by the worker.

## 4. Delivery Semantics

- A stable database delivery UUID produces a deterministic SMTP `Message-ID` and provider idempotency key.
- An explicitly rejected recipient is returned to the queue with bounded exponential delay, up to five attempts.
- A timeout, ambiguous response, provider exception, or expired `sending` lease becomes terminal `uncertain`; it is never automatically sent again.
- An expired `leased` row that never reached sending may return to the queue.
- Inactive authority or a missing verified email is suppressed before the provider call.
- Provider message identifiers are stored only as SHA-256 digests.

Do not manually change `uncertain` to `queued`. Reconciliation requires provider-side evidence and a separately reviewed repair procedure.

## 5. Staging Acceptance

Use synthetic staging identities and prove all of the following before setting both acceptance flags to `true`:

1. A school application status transition commits one status event, one notification event, one in-app delivery and one email delivery with the same intended recipient scope.
2. The email contains only reviewed title/body text and a same-origin action URL; school notes, closure reasons, other choices, payment data and materials are absent.
3. Provider acceptance reaches terminal `accepted`, while only a digest of its message identifier is stored.
4. A known rejected staging recipient follows bounded retry and terminal attempt-limit behavior.
5. A forced lost acknowledgement or timeout reaches `uncertain` and is not automatically retried.
6. Disabled preference, missing verified destination and revoked persona each suppress before any provider request.
7. Supervisor restart recovers an expired pre-send lease, and graceful termination closes without claiming new work.
8. Delivery, bounce/rejection, queue age, retry, uncertain and dead-letter alerts reach the staging operations channel.

Attach provider records, redacted structured logs, database outcome counts and alert evidence to release review. The offline readiness report always remains `runtimeVerified=false`.

## 6. Disable And Rollback

Stop the supervised worker and set `CUAC_NOTIFICATION_EMAIL_PROVIDER=disabled`. Do not roll back `0042` and do not delete queued, uncertain or terminal evidence. In-app delivery continues independently. If application code must roll back, first stop all notification workers and preserve the queue for the compatible forward fix.

Never place SMTP credentials in this repository, command arguments, logs or acceptance artifacts.
