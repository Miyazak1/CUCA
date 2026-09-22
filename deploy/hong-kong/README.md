# CUAC Hong Kong deployment template

This directory is the local deployment contract for the `school-handoff-v1` release. It is not evidence that a real Hong Kong environment exists.

## Topology

- One immutable CUAC application image, bound to `127.0.0.1:3000` behind the reviewed TLS/WAF reverse proxy.
- External PostgreSQL/RDS over `PGSSLMODE=verify-full`; the database is never included in Compose.
- Required first-release workers use the same image and protected release evidence: Auth email, account notifications, data-rights reminders and retention.
- Student file, payment reconciliation and official material submission workers are deliberately absent.
- Every container is non-root, read-only, drops Linux capabilities, uses `no-new-privileges` and has only a bounded `/tmp` tmpfs.

## Inputs intentionally not stored here

Set these only on the target host or deployment controller:

- `CUAC_IMAGE`: immutable registry reference with `@sha256:...`.
- `CUAC_ENV_FILE`: absolute path to the protected production environment file derived from `config/production.env.example`.
- `CUAC_EVIDENCE_FILE`: absolute path to the accepted staging evidence manifest.

The environment file must be readable only by the deployment account and must be sourced from the secret manager. Do not copy it into the repository or image.

## Deployment sequence

1. Verify the release commit, image digest, migration manifest digest and image signature/SBOM in CI.
2. Back up RDS and execute the separately reviewed migration job. The application stack never auto-migrates.
3. Run `docker compose -f deploy/hong-kong/compose.yaml config` with the three inputs above and review the fully rendered manifest without printing secret values.
4. Start `app`, verify `/api/v1/health`, `/api/v1/capabilities`, security headers and catalog latency through the private origin.
5. Start the four required workers, verify queue recovery and redacted logs, then attach the origin to the WAF/TLS endpoint.
6. Run staging acceptance and a rollback drill before shifting DNS traffic.

## External gates

Real deployment cannot proceed until the owner supplies the Hong Kong cloud account/resources, domain and DNS/TLS control, RDS endpoint and CA, registry digest, KMS/secrets, WAF limits, logging/alerts, approved Direct Mail sender/domain and real acceptance mailboxes.
