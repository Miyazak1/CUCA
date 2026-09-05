# CUAC Staging Acceptance Runbook

Status: operational evidence procedure. This document is not deployment permission. A passing preflight only admits the exact reviewed release to protected human review.

## 1. Preconditions

- Deploy one reviewed commit, immutable container image and migration manifest to staging.
- Use no production data. Use four distinct synthetic personas: student, school staff, CUAC Ops and CUAC Admin.
- Keep redacted evidence in a protected, immutable artifact store. Record all observations in UTC.
- Never place passwords, tokens, cookies, private keys, personal data, raw environment files or unredacted provider payloads in an evidence artifact.

Deploy the immutable candidate with `npm run start:staging-candidate`. This
candidate-only entry requires the exact three release identities, remote verified
PostgreSQL, the hard-gate staging environment, and Agent/direct database access
disabled before it opens a listener. It cannot start production and does not
replace the completed manifest or protected review required for promotion.

Start each supervised worker without a manifest while `CUAC_ENV=staging`; the
worker applies the same candidate identity/TLS/Agent checks before loading its
database or provider modules. For production, every worker command must receive
the completed protected manifest as its sole argument and pass the same combined
release gate as the application.

Bind the manifest to these exact release identities:

- `release.commitSha`: the reviewed 40-character Git commit SHA.
- `release.imageDigest`: the deployed immutable `sha256:<64 hex>` image digest.
- `release.migrationManifestSha256`: the SHA-256 of the exact migration release manifest.

## 2. Evidence Artifacts

Create one distinct redacted, immutable, regular-file artifact for each control. Do not reuse one artifact reference for multiple controls. An artifact must be non-empty and no larger than 16 MiB. It should contain the observed result, UTC time, actor role, release identity and negative-case result, but no secret or personal data.

Generate the only reference allowed in the acceptance manifest:

```powershell
npm run infra:evidence-artifact -- <protected-redacted-artifact>
```

Copy only the returned `artifact:sha256:<digest>` into `evidenceRef`. Do not use a path, URL, ticket number or free text as the reference. Set `status` from the actual observed run, never from a configuration flag or an intended architecture.

## 3. Fixed Controls

| Control | Required positive and negative evidence |
| --- | --- |
| `edge.https_waf_rate_limit` | Valid public TLS and HTTP-to-HTTPS redirect; an expected WAF block; anonymous and authenticated rate limits observed without bypass. |
| `app.health_and_lifecycle` | Health succeeds with PostgreSQL reachable; load-balancer drain, readiness withdrawal and bounded `SIGTERM` shutdown are observed. |
| `postgres.tls_and_acl` | Client uses certificate verification equivalent to `verify-full`; least-privilege application role succeeds; public or unauthorized access is refused. |
| `postgres.migration` | Exact manifest is bound to the release; clean migration and schema parity succeed; replay is a no-op and does not alter migration history. |
| `postgres.backup_restore` | A staging backup restores into a separate database; measured RPO/RTO and representative record/schema integrity meet the reviewed target. |
| `auth.staff_mfa` | Distinct school, Ops and Admin staff complete the approved MFA/IdP flow with live grants; Admin step-up succeeds; self-approval and stale/revoked grants are refused. |
| `auth.email_round_trip` | Verification and password-reset messages arrive through the real staging provider; expired and replayed actions are refused. |
| `notification.delivery_round_trip` | In-app and Aliyun Direct Mail delivery are observed; bounce handling and notification preferences are honored. |
| `payment.signed_round_trip` | Staging provider checkout, signed webhook and reconciliation complete without a real charge; replay, cancel/refund and invalid-signature behavior are observed. |
| `files.oss_round_trip` | Private OSS upload, exact version binding, malware scan, owner download and deletion complete; cross-owner access is denied. |
| `submission.signed_round_trip` | Fixed-host signed handoff and receipt complete with idempotency; invalid signatures fail and ambiguous delivery is quarantined without duplicate submission. |
| `workers.supervision_and_recovery` | All five production workers are supervised; kill/restart and lease recovery complete without duplicate business effects. |
| `observability.alert_delivery` | Queue, database and HTTP 5xx alerts reach the reviewed destination; emitted logs and alerts contain no secrets or personal data. |
| `security.secret_rotation` | KMS, HMAC and session-related secrets rotate; the reviewed grace window works and old material is rejected after it closes. |
| `product.core_role_e2e` | Four distinct personas complete the exact workflow: student selects program plus intake and completes application/payment; school reviews and submits a catalog correction; Ops claims it; a different stepped-up Admin resolves it. |
| `release.rollback` | Previous immutable image is available; drain and rollback are exercised; database forward compatibility or the reviewed restore decision is recorded. |

## 4. Closure Sequence

From `D:\CODE\CUAC\frontend`, validate the protected manifest first:

```powershell
npm run infra:staging-evidence-check -- <protected-manifest>
```

Inject the exact identities of the release under review, then run both gates:

```powershell
$env:CUAC_RELEASE_COMMIT_SHA = '<40-character-commit-sha>'
$env:CUAC_RELEASE_IMAGE_DIGEST = 'sha256:<64-hex-image-digest>'
$env:CUAC_MIGRATION_MANIFEST_SHA256 = '<64-hex-manifest-digest>'
npm run infra:production-check
npm run infra:release-gate -- <protected-manifest>
```

The manifest must retain all 16 controls in the fixed order, use a distinct evidence artifact for every completed control, remain within 30 days of its `generatedAt` time, and match all three release identities exactly. A successful result still reports `runtimeVerified=false`, `reviewRequired=true` and `deploymentAuthorized=false`; the protected human release review remains mandatory.
