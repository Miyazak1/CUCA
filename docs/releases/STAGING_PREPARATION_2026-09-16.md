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
- Application container rehearsal passes with a pinned Node `v22.23.2` Bookworm Slim image, non-root UID/GID 1000, read-only root filesystem, explicit fail-closed start mode, PostgreSQL health `ok`, and graceful exit code 0.
- Local application image digest: `sha256:fb2581d917b2855859b2a3cc9df4e61e8c5e994321547bee098d0865e3be0fc4`; unpacked size 130,085,947 bytes. This local digest is evidence only and must be replaced by the immutable registry digest built from the final committed source.
- `npm audit --omit=dev` reports zero production dependency vulnerabilities after upgrading Vinext, Vite, React Server Components, Nodemailer and affected transitive packages.

All database rehearsals used randomly named, loopback-only, memory-backed PostgreSQL containers. Owned containers, networks, and transient runtime images were removed after each run. No cloud database or production data was used.

## Findings fixed locally

1. The schema comparison database did not install `pg_trgm`, so Drizzle-generated GIN indexes could not be created.
2. The schema comparison omitted the migration-owned catalog revision function and triggers because Drizzle cannot declare those objects.
3. The pinned Linux migration runtime was Node `v22.22.3`, while the release was built by Node `v22.23.2`.
4. The first application image inherited the full Node base and carried 12 production dependency advisories.

The rehearsal now installs the required extension, reuses the reviewed migration statements for non-declarative objects, detects trigger/function drift, pins exact Node image digests, uses the 80 MB Bookworm Slim base, and verifies a zero-advisory production dependency set inside the build.

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
   - Staff TOTP MFA is implemented locally for school staff, Ops, and Admin. Staging enrollment, login, recovery-code, replay, revocation, Admin step-up, log-redaction, and key-rotation evidence remains required.
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

- Staff TOTP MFA source and local PostgreSQL rehearsal are complete; deployed staging acceptance is not complete. Enterprise IdP federation remains a future option and is not required for `school-handoff-v1`.
- Cloud observability and backup/restore are acceptance work, not locally provable.
- Real Auth/notification email delivery is intentionally disabled until provider configuration and staging acceptance exist.
- A final application image must still be rebuilt from the reviewed commit, pushed to the selected immutable registry, and recorded by registry digest.

## Next execution step

Provision staging infrastructure, then rebuild and push the reviewed application image. Inject the exact commit, registry image digest, and migration manifest digest into the candidate environment before collecting staging evidence.
