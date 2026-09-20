# CUAC production readiness audit — 2026-09-20

Status: **not ready for public production traffic**. The application has a substantial server, database, policy and release-gate foundation, but it is not yet one reviewed, reproducible and operationally accepted release.

This document is the launch authority for the current release. Older design documents remain implementation history; when they conflict with this audit or the checked-in release-scope code, this audit and the `school-handoff-v1` scope win.

## 1. Launch decision and scope

The first production release is `school-handoff-v1`.

Included:

- public university, program, scholarship, city and guide discovery;
- deterministic site search and authenticated favourites;
- student registration, sign-in, verification, password reset and account workspace;
- applicant profile, education and assessment records;
- exact school + program + published intake choices;
- student-confirmed handoff of name, contact email, citizenship and education only;
- school-tenant follow-up and intake publication;
- bounded CUAC support, catalog governance and audit workflows;
- in-app notifications and the operational email needed for account security.

Excluded and required to remain inaccessible:

- Agent UI and Agent runtime;
- payment collection;
- student file upload or document storage;
- official application-material submission;
- claims that CUAC submitted a complete university application.

The product wording must consistently say **“send basic information for school follow-up”**. A `school_applications` row in this release is a school-contact record, not proof that the university received an official application.

## 2. Target architecture

```text
Browser
  -> HTTPS edge / WAF / shared rate limits
    -> one immutable CUAC Node image
      -> server-rendered/static public surfaces
      -> same-origin /api/v1 boundary
        -> identity and policy layer
        -> domain services and transaction/audit layer
          -> PostgreSQL (private network, verify-full TLS, PITR)
          -> Auth email outbox -> supervised mail worker
          -> Notification outbox -> supervised notification worker

Release control plane
  reviewed commit
    + immutable image digest
    + immutable migration manifest digest
    + protected staging evidence
    -> human production approval
```

Deferred payment, private-file and official-material workers are not deployed for this scope. Their routes must fail closed under the server-owned release configuration even if a hidden page or direct API request is attempted.

## 3. Evidence collected in this audit

| Area | Result | Interpretation |
| --- | --- | --- |
| Production build | Pass | The current source compiles. |
| Production-source lint | Pass after removing one stale icon declaration | The lint gate is green. |
| Frontend contracts | 58/58 pass | Active static workspaces remain server-backed, invitation activation is separated from account binding, legal routes fail closed, and release boundaries are visible. |
| Intake governance tests | 7/7 pass | Future annual intake drafts, publication, withdrawal, tenant scope and official evidence are covered. |
| Local full-site data interaction | 14/14 pass | Twelve released surfaces, five public catalogs, search/ETag, anonymous and cross-role denial, student choices, school queue, Ops/Admin projections and malformed-input rejection passed against the persistent local PostgreSQL runtime. |
| Local role smoke | Pass | Student, school staff, Ops and stepped-up Admin flows pass, including staff MFA and the school intake lifecycle. |
| Invitation-first identity check | Pass | A real local PostgreSQL transaction created a verified staff-only account, denied replay, isolated all four local fixture roles, and invalidated an existing school session immediately after membership removal. Test data was rolled back. |
| Main server suite | 700/700 pass | The complete server suite, including the detached reproducible migration package, Auth-email invitation templates, legal policy schemas and tamper rejection, is green. |
| Real PostgreSQL rehearsal | 421 tests pass | PostgreSQL 16.15 applied and replayed the complete migration chain, matched 82 tables/1,249 columns/470 constraints/315 indexes, exercised historical upgrades, concurrency and authorization, and removed the disposable database afterward. |
| Migration release | Pass | The detached release was reproduced as `08568f8d306f98a0ca9d61561995f00fe33a94500c2d72cc6b6a8d321c9c3353` with 15 pinned runtime dependencies. |
| Release and staging contract tests | 25/25 pass | Release identity binding, reviewed startup, worker boundaries and protected staging-evidence rules are green; real cloud evidence is still intentionally absent. |
| Production readiness preflight | Expected fail without deployment environment | No RDS URL, production origin, KMS, mail credentials, MFA keyring, WAF attestations or cloud runtime were supplied locally. |
| Legacy demo suite | Not a release gate and currently stale | It references files outside this repository and historical titles. It must not be presented as production evidence. |
| Release-candidate source | Locally frozen | The reviewed application, Auth, catalog and migration changes are frozen together as the tested `codex/release-baseline` candidate. Remote CI and immutable image binding remain required. |

## 4. P0 blockers — no public launch before closure

### P0-1 Identity lifecycle and role separation

Implementation status: **core invitation-first path and local fixture isolation implemented and verified; production email delivery, live-record review and full browser acceptance remain open.**

The dedicated `/auth/school-invite` action now consumes one-time credentials from the URL fragment and removes them from browser history. A guest activation atomically creates the invited, email-verified account, password identity, `school_staff` role and exact school membership without granting `student`. If that email already has an account, activation fails with 409; the account must sign in and explicitly accept the same invitation. Both paths derive school and role from the server-side invitation, are rate limited, and are audited. No session is issued by activation, so staff must sign in and complete the existing MFA flow.

Required design:

1. Student self-registration creates only a student identity.
2. A school invitation opens a dedicated invitation activation flow.
3. A new invitee sets credentials and verifies the invited email without receiving the student role.
4. An existing account may link a school role only after explicit confirmation; cross-role accounts are exceptional, visible and auditable.
5. School, Ops and Admin sessions always require MFA and an explicit workspace.
6. Existing synthetic dual-role fixtures are replaced; existing real dual-role records require a reviewed migration report, not silent deletion.

Local acceptance now includes the atomic activation SQL against persistent local PostgreSQL (inside a rolled-back test transaction), one-time replay rejection, role-isolated student/school/Ops/Admin fixtures, immediate rejection of an existing school session after membership or CUAC staff-grant removal, an encrypted reliable invitation-email outbox, and the full disposable PostgreSQL rehearsal. Remaining acceptance: add real-browser coverage, generate and review any real dual-role report, and complete the real sender-domain staging round trip.

### P0-2 Reproducible release baseline

Implementation status: **local technical gates, source review and Git freeze are complete; remote CI and immutable application-image binding remain open.**

The reviewed source is frozen as one atomic release-candidate baseline because its identity, invitation, intake, UI and migration changes were exercised together. Migrations `0053`–`0055`, the journal and generated snapshots pass schema parity and real PostgreSQL replay as one migration chain. The detached migration release is reproducible and identified by digest. The resulting commit must now be rebuilt by remote CI and bound to an immutable application-image digest before staging approval.

Acceptance: clean checkout; no untracked release files; lint, build, active frontend contracts, complete backend suite, schema snapshot, migration rehearsal, container rehearsal and release gate all green in the controlled builder.

### P0-3 Real account email

Implementation status: **all three Auth email purposes now share one encrypted, recoverable and audited local outbox; cloud sender configuration and staging acceptance remain open.**

Verification, password reset and staff invitation now use the same fixed-template Aliyun Direct Mail adapter and supervised-worker contract. School invitation creation and queue insertion commit atomically. The worker rechecks the pending invite, active school, active inviter account and live CUAC staff grant before releasing the encrypted one-time token; a revoked invite or inviter authority cancels and scrubs the queued credential. The database binds each invitation task to the exact invite and inviter with composite foreign keys and one-task uniqueness. Real PostgreSQL tests prove queue encryption, authority invalidation, audit rollback, terminal credential erasure and complete migration replay. Production and staging templates intentionally keep the provider disabled until protected credentials and acceptance evidence exist.

Acceptance: approved sender domain, KMS-held credentials and outbox keyring; supervised Auth mail worker; staging delivery, expiry, replay and reset tests; bounce/incident owner; no token or address leakage in logs.

### P0-4 Legal and user-rights surfaces

Implementation status: **stable fail-closed policy routes and governed publication scopes are implemented; approved wording and the authenticated rights-request workflow remain open release blockers.**

Privacy, Terms, Cookie and admissions-data/source links now resolve to dedicated public routes. Each route reads its exact locale and purpose-specific document from the existing digest-bound, independently reviewed publication system and displays version, effective date and review due date. Missing, expired, withdrawn or corrupt content is shown as unpublished and cannot silently fall back to a draft, another locale or the application disclosure. The database scope constraint and real migration now admit the four legal policy keys. See `LEGAL_AND_DATA_RIGHTS_READINESS_2026-09-20.md` for the browser-storage inventory, required owner decisions, rights workflow and release checklist.

Required:

- approved Privacy Notice, Terms, Cookie Notice and admissions-data/source policy at stable routes;
- locale/version/effective-date display;
- consent and disclosure wording that matches `school-handoff-v1`;
- support process for access, correction, export and account deletion requests;
- retention and deletion schedule covering PostgreSQL, logs, backups and audit exceptions.

Acceptance: legal owner approval, published version evidence, link checker, withdrawal/request runbook and a tested support workflow.

### P0-5 Cloud staging and operations

Local evidence cannot approve production. Required staging controls are: HTTPS redirect, WAF/shared Auth and search rate limits, RDS `verify-full`, least-privilege roles, migration replay, backup restore, staff MFA, email round trips, scoped worker recovery, alert delivery, secret rotation, three-role E2E and image rollback.

For `school-handoff-v1`, only Auth-email and notification workers are in scope. Payment, file and official-material workers must be absent/disabled and their acceptance controls recorded as `not_applicable`.

Acceptance: all protected staging evidence is bound to the same commit, image, migration digest and release scope, followed by human approval.

### P0-6 Security headers and public edge contract

The API boundary already enforces same-origin writes, body limits, no-store responses, request IDs and conservative CORS. Page-level CSP, HSTS, clickjacking protection and permissions policy are not established by repository evidence and must be supplied and verified at the edge/runtime.

Acceptance: automated header probe on every public/auth/workspace route, CSP report review, TLS scan, dependency/security scan, redacted logging check and negative cross-origin tests.

## 5. P1 production-hardening work

### P1-1 One frontend architecture

The active product is primarily the static `public/*.html + runtime.js` application served by Vinext, while several App Router pages redirect to it and `app/cuac-app.tsx` remains as a parallel implementation. This raises drift, accessibility and test cost.

Decision: do not rewrite before the first launch. Freeze the static server-backed UI as Launch v1, mark the unused React prototype non-authoritative, and prohibit new business behavior there. After launch, migrate route-by-route behind unchanged API contracts and remove redirects only after parity.

### P1-2 Server-owned capability manifest

Frontend booleans are useful for presentation but cannot define release authority. Add one read-only server capability response derived from `CUAC_RELEASE_SCOPE`; all pages consume it, while every deferred API independently rejects use. Keep launch scope immutable for the process lifetime and include it in health/build metadata without exposing secrets.

### P1-3 Availability and observability

Split liveness from database readiness, define latency/error SLOs, add structured redacted logs, request correlation, queue-age/error metrics and alerts. Establish dashboards for catalog latency, Auth failures, handoff conflicts, school queue age and database pool saturation.

Initial targets:

- public catalog/search p95 server response under 500 ms at reviewed staging load;
- authenticated read p95 under 750 ms;
- write p95 under 1.5 s excluding email delivery;
- 5xx below 0.5% over 15 minutes;
- RPO at most 15 minutes and reviewed RTO at most 2 hours, confirmed by restore drill.

### P1-4 Performance and browser quality

Run indexed-query plans against production-scale catalog data, concurrent list/search/load tests, cache-behavior checks, and browser acceptance on current Chrome, Edge, Safari and mobile breakpoints. Add WCAG 2.2 AA keyboard, focus, label, contrast and reduced-motion checks to release evidence.

### P1-5 Data and account lifecycle

Add supported account export, correction and deletion-request orchestration. Use tombstones or retained audit identifiers only where the approved policy requires them. Never cascade-delete security/audit evidence without a reviewed legal basis.

## 6. P2 after launch

- payment, only after signed provider, refund and reconciliation acceptance;
- student materials, only after private OSS/KMS/malware-scan/retention acceptance;
- official application delivery, only after signed receipt and school/legal agreement;
- Agent, only after separate sandbox, tool gateway, privacy and abuse review;
- replacement of the static UI with a single component application;
- enterprise identity federation for staff.

## 7. Execution order

1. **Freeze scope and baseline:** keep `school-handoff-v1`, clean the test gates, review migrations, form a clean release candidate.
2. **Rebuild identity:** implement invitation-first school activation and migrate fixtures/tests.
3. **Close public trust gaps:** real legal pages, user-rights runbook, exact product wording and server capability manifest.
4. **Provision staging:** RDS, KMS, domain/TLS, WAF, mail, MFA and observability.
5. **Exercise resilience:** backup restore, migration replay, worker recovery, load, browser, accessibility and rollback.
6. **Release review:** bind evidence to immutable identities; human approval; canary deployment; monitored rollback window.

## 8. Inputs required from the owner

No credentials belong in Git or chat. Before step 4, the owner must choose/provide through the cloud secret channel:

- production and staging domains;
- Alibaba Cloud account/project, region and runtime;
- RDS and KMS ownership;
- approved email sender domain;
- legal/business owner for Privacy and Terms;
- support contact and incident owner;
- reviewed RPO/RTO and launch traffic expectation.

Until those inputs exist, local work can complete P0-1, P0-2, the public legal-page scaffolding, capability enforcement, test cleanup and deployment manifests, but it cannot honestly declare the system production-ready.
