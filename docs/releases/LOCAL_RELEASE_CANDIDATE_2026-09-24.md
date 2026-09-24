# CUAC Local Release Candidate — 2026-09-24

Status: local release candidate accepted; real staging infrastructure not yet configured.

Release scope: `school-handoff-v1`. Students can discover catalog data, save items, maintain application choices and send the bounded basic-information handoff to schools. Hosted payment, private-file submission and official application delivery remain disabled and fail closed until separate provider acceptance.

## Accepted local evidence

- Schema: 79 SQL migrations, 70 Drizzle snapshots and 97 declared PostgreSQL tables.
- Backend unit and contract suite: 726/726 passed.
- Disposable PostgreSQL rehearsal: 423/423 passed, including migration replay, HTTP boundaries, tenant isolation, audit atomicity and rollback cases.
- Production build: passed.
- Linux application image rehearsal: passed on `linux/amd64`, Node 22, non-root, read-only filesystem, PostgreSQL reachable, security headers verified and graceful shutdown verified.
- Persistent local runtime smoke: passed across student, school staff, Ops and admin sessions; MFA and step-up authentication; catalog; saved-item lifecycle; application/school handoff; notification preferences; school intake lifecycle; support and governance queues.
- Whole-site data interaction acceptance: 14/14 areas passed, including all released HTML surfaces, programs, schools, scholarships, cities, guides, search/ETag, anonymous denial, cross-role denial and internal projections.
- Student runtime acceptance: 7/7 passed. Existing application choices remain usable when their historical catalog records are no longer public; no unpublished record is made public to satisfy the fixture.
- Catalog integrity: 80 schools (33 public eligible), 10,013 programs (9,527 public eligible), 596 scholarships (227 active and verified) and 9,510 intakes audited. The 827 records with prohibited aggregator provenance remain quarantined; public exposure blocker count is zero.
- Directory remediation candidate: 4,704 deterministic changes rehearsed against a disposable actual-schema database, idempotency and rollback verified. It remains unexecuted until a real staging target is bound.
- City candidate: 26 cities generated and rehearsed against a disposable actual-schema database; hypothetical public projection and rollback passed. It remains non-public until executed against the reviewed staging target.

## Release gate interpretation

`infra:production-check` and `infra:release-gate` currently fail for the correct reason: there is no real staging/production environment, protected release record or production secret/provider configuration. This is the next external boundary, not a local application defect.

The old `qa:flows`, `qa:hub`, `qa:layout` and `qa:ops-clicks` scripts still bootstrap a retired localStorage demo identity and exercise the deferred Agent UI. Formal authentication correctly rejects that model. They are archived compatibility suites and are not release gates. Their still-relevant API and layout contracts are covered by the backend, public-contract, local-smoke, data-interaction and student-runtime suites above. They must be rewritten around real session cookies before being promoted back into CI.

## Configuration required for real Hong Kong staging

The following inputs must be supplied together; do not insert placeholders into a release record.

1. Runtime: Hong Kong host/container platform, immutable image registry reference, deployment service identity, health-check and drain configuration.
2. Network: final staging hostname, DNS ownership and HTTPS certificate; set the exact HTTPS public origin and trusted proxy policy.
3. PostgreSQL: Hong Kong RDS endpoint/database/user, TLS verification chain, least-privilege migration and application users, backup retention and a tested restore target.
4. Session and encryption: production session secret, MFA/envelope-encryption keys, KMS or approved secrets manager references and rotation owners.
5. Redis/queue: private endpoint, authentication/TLS and worker concurrency for enabled background jobs.
6. Email: a verified `cuca.com` sending domain, sender identities, provider/API credentials, SPF, DKIM and DMARC. Real verification/reset and notification delivery acceptance follows configuration.
7. Observability: centralized logs with redaction, metrics/alerts, uptime checks and incident destination.
8. Catalog target: a copy of `config/catalog-data-target.example.json` bound to the exact staging database identity plus reviewed release-manifest hashes. Run the release gate before any write.

Payment provider, OSS/private-file processing and official submission delivery are not required for `school-handoff-v1`; keep their capabilities disabled. Enabling any of them creates a separate provider, security and operational acceptance gate.

## Staging execution order

1. Provision network, RDS, secrets, Redis and application runtime.
2. Run production readiness without bypasses and record the immutable output.
3. Apply migrations with the dedicated migration identity; rerun schema and health gates.
4. Bind and rehearse the catalog/directory and city candidates against a restored staging copy.
5. Execute reviewed catalog manifests, verify public counts and retain rollback evidence.
6. Configure `cuca.com` email and complete verification/reset delivery tests.
7. Run real-cookie desktop/mobile browser acceptance and accessibility checks.
8. Capture backup/restore, alert delivery, restart and rollback evidence before production approval.
