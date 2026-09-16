# CUAC staging preparation — 2026-09-16

Status: local pre-staging evidence for `school-handoff-v1`; not deployment approval.

## Release scope

Included: public catalog and search, student account and selection flow, basic-information school handoff, school follow-up workspace, and bounded Ops support.

Explicitly disabled: Agent, payment collection, student file upload, and official material submission. These capabilities must remain disabled in staging and production for this release.

## Local evidence completed

- Production build and production-source lint pass.
- Frontend contracts pass: 56/56.
- Backend suite passes.
- PostgreSQL snapshot check passes: 52 migrations, 43 snapshots, 77 tables.
- Disposable PostgreSQL rehearsal passes: 417/417.
- Schema parity covers 77 tables, 1,187 columns, 446 constraints, 297 indexes, plus the migration-owned catalog revision function and five triggers.
- Production-build HTTP plus PostgreSQL rehearsal passes: 527/527 on an isolated loopback port.
- Linux migration release rehearsal passes: 7/7 using Node `v22.23.2`, `linux/amd64`, non-root execution, no default egress route, read-only runtime, digest verification, interruption recovery, and redacted failures.
- Migration release manifest SHA-256: `48c6f509e335d93b92c333ffebc5b790ec50f5c02ca8db2d97503a5b63e3aa53`.

All database rehearsals used randomly named, loopback-only, memory-backed PostgreSQL containers. Owned containers, networks, and transient runtime images were removed after each run. No cloud database or production data was used.

## Findings fixed locally

1. The schema comparison database did not install `pg_trgm`, so Drizzle-generated GIN indexes could not be created.
2. The schema comparison omitted the migration-owned catalog revision function and triggers because Drizzle cannot declare those objects.
3. The pinned Linux migration runtime was Node `v22.22.3`, while the release was built by Node `v22.23.2`.

The rehearsal now installs the required extension, reuses the reviewed migration statements for non-declarative objects, detects trigger/function drift, and pins the exact Node `v22.23.2` image digest.

## Cloud inputs still required

Do not place any credential in Git or chat. Store secrets in Alibaba Cloud KMS/secret management and inject them at deployment time.

1. Deployment identity
   - Alibaba Cloud account/project and confirmed region.
   - Staging domain and DNS control.
   - Selected container runtime, currently assumed to be ECS container deployment.
2. PostgreSQL
   - Staging RDS PostgreSQL endpoint, database, application role, and separate migration role.
   - `PGSSLMODE=verify-full`, private-network placement, trusted CA path, backup policy, and restore target.
   - Permission to install/use `pg_trgm` during the reviewed migration window.
3. Secrets and identity
   - KMS key and secret-manager access for the runtime identity.
   - A generated session secret of at least 32 random characters.
   - Approved MFA/IdP design for school staff, Ops, and Admin. This remains a product/runtime blocker, not merely an environment variable.
4. Edge controls
   - HTTPS certificate and HTTP-to-HTTPS redirect.
   - WAF/API Gateway shared rate limits covering every Auth route and `/api/v1/search`.
5. Email
   - Approved sender domains/addresses and Aliyun Direct Mail SMTP credentials.
   - Supervised Auth email and notification workers.
   - Staging verification, reset, delivery, expiry, replay, preference, and bounce evidence.
6. Operations
   - Central logs and alerts for HTTP 5xx, database health, and queues.
   - Immutable image registry, deployment rollback target, and protected evidence storage.
   - RDS backup/restore rehearsal and reviewed RPO/RTO.

## Source gaps before staging deployment

- There is a reviewed migration-runtime container, but no complete immutable application container artifact yet.
- Staff MFA/IdP is required by staging acceptance and is not complete.
- Cloud observability and backup/restore are acceptance work, not locally provable.
- Real Auth/notification email delivery is intentionally disabled until provider configuration and staging acceptance exist.
- The exact release commit SHA and immutable application image digest cannot be recorded until the application image artifact is implemented and built.

## Next execution step

Build the immutable application container and its local runtime smoke test. After that artifact passes locally, provision staging infrastructure and inject the exact commit, application image digest, and migration manifest digest into the candidate environment.
