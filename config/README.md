# CUAC Environment Configuration

Status: deploy-time environment templates for Alibaba Cloud staging and production.

These files are examples only. Store real values in Alibaba Cloud KMS / secret management, CI/CD secrets, or the deployment platform environment.

## Templates

- `staging.env.example`: staging configuration using Alibaba Cloud RDS PostgreSQL, with external services disabled until cloud acceptance.
- `production.env.example`: production checklist with email, payments, uploads and migration approval disabled; the hard offline gate remains enabled.

Both templates intentionally fail readiness while required integrations and real
credentials are missing. A provider name or OSS bucket name cannot enable a service.

## Validation Commands

Run from `frontend`.

Check PostgreSQL migration posture without connecting:

```bash
npm run db:pg:check
```

Check offline configuration and implementation readiness:

```bash
npm run infra:production-check
```

Staging/production and unknown environments default to a hard gate. Local
development defaults to advisory reporting. Make the deployment gate explicit
(with the target environment and approved configuration already injected):

```bash
CUAC_REQUIRE_PRODUCTION_READY=true npm run infra:production-check
```

In PowerShell, set `$env:CUAC_REQUIRE_PRODUCTION_READY = 'true'` before running the
command. A required gate rejects development or unknown targets. Invalid/empty
boolean values fail; explicit `false` is diagnostic-only and must not authorize a
deployment. Reports always declare `scope=offline_preflight` and
`runtimeVerified=false`. Passing checks never substitutes for runtime acceptance
or release approval. See [the readiness contract](../../CUAC_PRODUCTION_READINESS_CONTRACT.md).

After a concrete staging release has been deployed, create a protected copy of
`staging-acceptance.example.json`, bind it to the reviewed commit, immutable
container digest and migration manifest digest, and attach one hashed evidence
artifact to every fixed control. Follow the
[staging acceptance runbook](../../CUAC_STAGING_ACCEPTANCE_RUNBOOK.md) for the
positive and negative cases. Create a reference from each protected, redacted
regular file with:

```bash
npm run infra:evidence-artifact -- /protected/path/redacted-artifact
```

Then check the manifest structure with:

```bash
npm run infra:staging-evidence-check -- /protected/path/staging-acceptance.json
```

The example intentionally exits 1. The evidence preflight rejects omitted,
reordered or extra controls, placeholder digests, pending/failed controls,
noncanonical timestamps, evidence older than 30 days, and mutable/free-text
evidence references. It outputs no evidence locations and always reports
`runtimeVerified=false` plus `reviewRequired=true`. Even
`readyForReview=true` means only that the protected evidence pack is complete
enough for human release review; it is never deployment permission by itself.

Before a staging or production promotion, inject the exact commit, immutable image
and migration-manifest identities from the protected release record as
`CUAC_RELEASE_COMMIT_SHA`, `CUAC_RELEASE_IMAGE_DIGEST`, and
`CUAC_MIGRATION_MANIFEST_SHA256`. Then run the combined gate against the protected
staging evidence pack:

```bash
npm run infra:release-gate -- /protected/path/staging-acceptance.json
```

This command requires a hard staging/production readiness result, a complete
staging evidence report, and exact equality between all three expected identities
and the evidence manifest. Its successful result still declares
`deploymentAuthorized=false`; it only admits the release to protected human review.

Run migrations only after `db:pg:check` has no blockers:

```bash
npm run db:pg:migrate
```

## Managed Application Entry

After a reviewed build produces `dist`, `npm start` and `npm run start:managed`
start the application with bounded shutdown only when `CUAC_ENV` explicitly names
a development environment. They do not build or migrate. They reject staging,
production, unknown environments and unsafe Node.js runtime overrides before the
server module is loaded.

For a staging or production deployment that must enforce the combined release gate
before opening the HTTP listener, use the protected evidence manifest with:

```bash
npm run start:reviewed -- /protected/path/staging-acceptance.json
```

`start:reviewed` validates the hard readiness result, complete staging evidence and
exact release identities before it dynamically loads the same managed server. It
does not migrate the database or authorize deployment; the platform must still
restrict its entry command and evidence mount through the reviewed release policy.
Staging and production must use this entry. `NODE_OPTIONS`, `NODE_PATH`, and
`NODE_TLS_REJECT_UNAUTHORIZED=0` are rejected by both the gate and startup policy.

The first deployment of an immutable staging candidate necessarily precedes its
acceptance manifest. Use the separate candidate-only entry to collect the 16
controls without weakening production startup:

```bash
npm run start:staging-candidate
```

This entry requires `CUAC_ENV=staging`, the hard-gate flag, remote PostgreSQL with
`PGSSLMODE=verify-full`, an explicitly disabled Agent/direct-DB posture, and exact
non-placeholder commit, image and migration-manifest identities. It cannot run in
production and does not claim acceptance or deployment authorization.

- `CUAC_HTTP_HOST`: numeric bind IP, default `127.0.0.1`; cloud templates use `0.0.0.0`, protected by deployment network policy.
- `PORT`: integer 1-65535, default 3000.
- `CUAC_HTTP_SHUTDOWN_TIMEOUT_MS`: integer 1000-120000, default 30000; one budget for HTTP drain, admitted API work and resource closure.

SIGTERM/SIGINT stop admission, wait for admitted API work even after client
disconnect, then close the actual shared PostgreSQL pool. Normal signal shutdown
exits 0; timeout or failure exits 1. Set the supervisor termination grace above
the application budget with margin. Event-loop stalls and SIGKILL require an
external supervisor; cloud signal forwarding and load-balancer draining still
need acceptance. See `../../CUAC_APPLICATION_LIFECYCLE_CONTRACT.md` for the local
test evidence and limits. This entry uses a pinned internal Vinext API and must
be revalidated when the framework changes.

## Important Rules

- Do not commit real secrets.
- Do not use frontend demo D1/SQLite data as production authority.
- Staging and production must use PostgreSQL / Alibaba Cloud RDS.
- Staging and production database URLs must not point to localhost.
- Database URLs must not contain query parameters or fragments; they can override reviewed TLS, host, identity and session options in the PostgreSQL driver.
- Staging and production must set `PGSSLMODE=verify-full`; private-network placement does not replace certificate-chain and hostname verification.
- Production migrations require `CUAC_ALLOW_PRODUCTION_MIGRATION=true` and `CUAC_MIGRATION_RUNBOOK_ACK=true` during the reviewed migration window.
- Auth email delivery remains disabled by default: the encrypted outbox is not a runtime provider. The verification and password-reset action pages are implemented, but the reviewed adapter, supervised worker, sender, exact HTTPS origin and a real staging delivery/expiry/replay round trip must be accepted before staging/production delivery is enabled.
- Business notification email remains disabled in both templates. The reviewed Aliyun Direct Mail adapter and worker are implemented, but enable them only after the sender, supervised process, delivery/bounce behavior and data-processing boundary pass staging acceptance. In-app notifications do not require this provider.
- Official application delivery remains disabled in the templates. Enable only the reviewed fixed-host HTTPS handoff gateway after material snapshot keyring configuration, supervised worker deployment, and a signed staging receipt round trip. A school application becomes visible as `new` only after that receipt is committed atomically.
- External Auth email provider adapters can send email addresses and one-time action links to a third party or gateway; implement them only after the provider and data-processing boundary are explicitly approved.
- Agent is explicitly disabled in the staging and production templates so the core platform can ship independently. Enabling it later requires the enforced Tool Gateway and sandbox modes; `CUAC_AGENT_DIRECT_DB_ACCESS` must remain explicitly `false` or `disabled` in every staging/production release.
- The fixed hosted payment adapter, signed webhook inbox and reconciliation worker are implemented locally. Keep payment `disabled` until the reviewed merchant gateway is configured and a signed staging checkout/success/cancel/refund/replay/recovery round trip is accepted; local tests and offline readiness are not permission to charge.
- Private student file code uses fixed-region OSS V4 PUT/GET signatures, KMS headers, exact object versions, owner-scoped PostgreSQL records, ClamAV streaming scans and leased asynchronous deletion. It remains disabled in both templates until the cloud controls below are accepted.

## External Worker Acceptance

Run Auth verification and password-reset delivery as a separately supervised
process after Aliyun Direct Mail is approved:

```bash
npm run start:auth-email-worker
```

Run the file worker as a separately supervised process:

```bash
npm run start:student-file-worker
```

Run official submission delivery as a separately supervised process after its gateway is approved:

```bash
npm run start:official-submission-worker
```

Run payment reconciliation as a separately supervised process after the hosted gateway is approved:

```bash
npm run start:payment-reconciliation-worker
```

Run external notification delivery as a separately supervised process after Aliyun Direct Mail is approved:

```bash
npm run start:notification-worker
```

These direct commands accept no manifest in development or during a bound staging
candidate acceptance run. In production, append the same protected staging
manifest used by `start:reviewed`, for example
`npm run start:notification-worker -- /protected/path/staging-acceptance.json`.
Every worker validates its release mode before loading PostgreSQL or an external
provider. Production refuses missing, incomplete, or mismatched evidence.

Configuration, failure semantics, staging evidence and rollback steps are fixed in
`../../CUAC_NOTIFICATION_WORKER_RUNBOOK.md`.

The API must use a dedicated least-privilege RAM identity. The private bucket must
have versioning, Block Public Access/private ACL posture, KMS encryption, exact
origin CORS for `PUT`, and lifecycle cleanup for noncurrent versions, expired
delete markers and incomplete multipart uploads. The worker host must reach the
same fixed OSS region and a supervised `clamd` service; never expose `clamd` to a
public network.

Acceptance must prove the full sequence with a real staging bucket and PostgreSQL:
authorized PUT, metadata/version capture, clean scan, exact-version GET, malware
and digest-mismatch quarantine, retry/recovery, deletion after URL expiry, and
noncurrent-version lifecycle cleanup. Only then set the five
`CUAC_FILE_*`/`CUAC_OSS_*_CONFIRMED` attestations to `true`. Offline readiness
still reports `runtimeVerified=false` and cannot replace the evidence.

See [the migration runbook](../../CUAC_POSTGRES_MIGRATION_RUNBOOK.md) for migration operation steps.
