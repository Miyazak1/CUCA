# CUAC Application Container Runbook

Status: local application-image build and rehearsal procedure. A passing local rehearsal is not staging acceptance or deployment permission.

## Artifact contract

- Platform: `linux/amd64`.
- Node: exact version and digest from `config/application-runtime.linux.json`.
- Base: official Bookworm Slim image pinned by digest.
- Runtime user: UID/GID `1000:1000`.
- Root filesystem: read-only; mount a bounded writable `/tmp` tmpfs.
- HTTP: port `3000`; `/api/v1/health` must return 200 only when PostgreSQL is reachable.
- Startup is fail-closed unless `CUAC_START_MODE` is explicit.
- Real secrets are injected at runtime from KMS/secret management and never copied into the image.

The build context excludes environment files, Git metadata, tests, documentation, local catalog artifacts, local databases, release work directories and existing dependencies/build output through `.dockerignore`.

## Local rehearsal

With Docker Desktop running:

```powershell
npm run container:rehearse
```

The command builds `cuac-application:rehearsal`, verifies the image configuration, proves that an unspecified mode is rejected, creates an isolated memory-backed PostgreSQL container, applies the reviewed migration chain, starts the app with a read-only root filesystem, checks non-root identity and health, sends a bounded stop, and removes the owned database, application container, and network.

The local image tag is retained for inspection. Its digest is not a production identity: the release image must be rebuilt from the reviewed commit and pushed to the approved immutable registry.

## Startup modes

- `development`: local rehearsal only; the existing development-only startup policy still applies.
- `staging-candidate`: first immutable staging deployment used to collect acceptance evidence. Requires remote PostgreSQL with `PGSSLMODE=verify-full`, hard-gate staging configuration, Agent disabled, and exact release identities.
- `reviewed`: staging/production startup after mounting the protected evidence manifest and setting `CUAC_STAGING_EVIDENCE_MANIFEST` to its absolute container path.

Never override the entrypoint to bypass these modes in staging or production.

## Deployment runtime requirements

Run with a read-only root filesystem, a bounded `noexec,nosuid` `/tmp` tmpfs, dropped Linux capabilities, no privilege escalation, a termination grace period greater than `CUAC_HTTP_SHUTDOWN_TIMEOUT_MS`, and network access only to reviewed RDS/KMS/email/observability endpoints. Keep the platform health probe on `/api/v1/health`; do not treat a process-only liveness check as database readiness.

For `school-handoff-v1`, keep Agent, payment, student file upload and official material submission disabled. Staging and production must not use `development` mode.
