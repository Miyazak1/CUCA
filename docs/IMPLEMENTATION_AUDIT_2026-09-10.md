# CUAC Implementation Audit

Audit date: 2026-09-10 (Asia/Shanghai)

Repository baseline: `main` at `098c8b3`, plus the uncommitted navigation-boundary changes described below.

## Executive Summary

CUAC has a substantial locally verified non-Agent core, but it is not a finished production product. The PostgreSQL schema, API surface, synthetic local runtime, and server-backed candidate pages cover the main student, school, and Ops domains. Production content, external providers, Alibaba Cloud acceptance, and the final operational controls remain open.

The most immediate local product defects found by this audit were navigation into legacy browser-demo pages and a pre-login role picker that asked users to claim Student, School staff, or CUAC staff before the account was known. This audit routes navigation to API-backed workspaces and replaces the role picker with server-derived workspace discovery.

## 1. Locally Implemented And Verified

### Runtime and database

- Windows local launcher with fixed loopback ports: application `52118`, PostgreSQL `62251`.
- Persistent CUAC-owned PostgreSQL Docker volume.
- 48 migrations applied successfully on a clean local installation.
- Idempotent synthetic fixtures and generated student, school staff, Ops, and Admin accounts.
- Local status and full synthetic smoke flow pass against the running API.

### Backend core

- Server-owned Auth sessions, registration, password reset and email-verification challenge flows.
- Role and tenant resolution for student, school staff, CUAC Ops, and CUAC Admin.
- Public city, school, program, intake, requirement, and scholarship reads.
- Student profile, applicant profile, education records, assessment records, saved items, application sets, ordered choices, material selection, preview, authorization, snapshot, preflight, and internal submission boundaries.
- Billing preview, checkout intent, invoice status, signed provider-event boundary, entitlement logic, and reconciliation foundations.
- School application queue, detail, status transition, contact logs, and catalog-correction submission.
- Ops support sessions, operations summary, requirement governance, billing review, delivery routing review, catalog data-quality review, and catalog-correction review.
- In and worker foundations for Auth email, notifications, private student files, official submission, and payment reconciliation.
- Agent context and memory policy boundaries exist but remain disabled in the normal local runtime.

### Frontend/API integration

- Public program, university, city, and scholarship lists and detail pages read published catalog APIs.
- Auth uses one email/password entry point and server sessions rather than browser-owned identity state. A single authorized workspace opens directly; multiple authorized workspaces are offered only after password verification and are revalidated before a session is created.
- API-backed onboarding, Hub, saved-items, preferences, notifications, application, billing, school portal/settings, and Ops workspaces exist.
- Application UI uses exact owned application sets and choice-bound server resources; it does not fall back to localStorage business state.
- Shared navigation and Auth now route to the API-backed workspaces rather than the retired demo pages.
- Public program, university, and scholarship save actions now write to the authenticated student saved-items API and restore their state from the server. The saved-items breadcrumb returns to the API-backed Hub.
- Application choice cards normalize nested catalog city records before rendering, so exact same-school program choices remain readable and independent.

### Verification observed during this audit

- Local smoke: passed.
- Frontend contract suite: 45/45 passed after adding navigation and authenticated saved-item regressions.
- TypeScript project build: passed.
- Vinext production build: passed.
- Updated JavaScript syntax checks and `git diff --check`: passed.
- Unified login browser acceptance: student entered Hub directly; a school account received Student + exact school choices and entered only its tenant portal; an Ops account received Student + CUAC staff choices and entered the internal console.
- Student browser acceptance: Onboarding preferences survived reload; a program saved from the public catalog appeared in Saved items and survived reload; applicant profile revision 1 survived reload and sign-out/sign-in; the fixture application preserved three exact choices, including two independent programs at North University; city labels rendered without object coercion.

## 2. Partially Complete

| Area | Implemented foundation | Remaining work |
| --- | --- | --- |
| Catalog | Schema, strict v1/v2 bundle validator, deterministic digest report, disposable-only atomic rehearsal, official-source registry and snapshot collector, public APIs, list/detail UI, provenance and quality-review contracts | Field extraction adapters, editorial verification, broader authoritative-source coverage, freshness operations |
| Student journey | Profile, records, saved items, application choices, materials, preflight, billing and internal-submit UI/API boundaries | Real notices, prices, provider configuration, accepted route rules, private-file production services, external receipt closure |
| Authentication | Unified password entry, server-derived workspace selection, session runtime, challenges, school invitations, role and tenant checks | Real email acceptance, staff IdP/MFA, breached-password screening, production capacity and side-channel acceptance |
| Private files | Upload-intent, integrity, scanning, owner actions, storage adapter and worker boundaries | Reviewed OSS bucket/KMS/ClamAV configuration and staging evidence |
| Payments | Hosted-checkout, webhook, refund-state and reconciliation foundations | Reviewed merchant/pricing configuration, real test-mode closed loop, operational refund/compensation approval |
| School delivery | Atomic internal acceptance, outbox, worker, school projection and routing review | Approved recipients/routes, real delivery adapter, receipt and recovery staging evidence |
| Notifications | In-app notifications, preferences, email adapter and worker foundations | Real credentials, delivery/bounce/complaint acceptance, supervised scheduling, optional SMS decision |
| Ops | Governed review queues and a server-backed operations workspace | Generic catalog editing, automatic freshness scheduling, controlled route/payload repair, alert escalation |
| Agent | Tool, context, memory, retention and policy contracts | Actual product conversation path, user control UX, abuse controls, schedulers and production authorization |
| Infrastructure | Local runtime, release/readiness checks, migration artifacts and rehearsal tooling | Alibaba Cloud ECS/RDS/KMS/OSS integration, CI trust, backup/restore, failover, monitoring and acceptance evidence |

## 3. External Or Approval-Blocked Work

The following items must not be filled with demo assumptions:

- Real school/program/scholarship/city content and its approved migration whitelist.
- Authoritative intake, requirement, recipient, route, retention, pricing and eligibility rules.
- Merchant, email, object-storage, malware-scanning and school-delivery credentials.
- Legal text and disclosure approval for real application submission.
- Alibaba Cloud account, network, identity, secrets, monitoring, backup and staging acceptance decisions.
- Production employee identity and MFA approach.

The legacy CSCAlite database must remain read-only and must not be imported wholesale. A cleaned export and explicit prohibited-data list are prerequisites.

## 4. Prioritized Execution Queue

1. **Close the local navigation and login boundary.** Completed in this audit: shared header, account menu, saved shortcut, registration, sign-in continuations, and role workspaces now select server-backed pages; pre-login role claims were replaced by server-derived workspace discovery.
2. **Finish the wider browser acceptance pass.** Completed in this audit: unified student/school/Ops login, logout, Hub, school queue, Ops overview, Onboarding persistence, server-backed saved items, applicant-profile editing, exact same-school program choices, and sign-out/sign-in persistence.
3. **Obtain and review the catalog migration handoff.** The executable whitelist, prohibited-field rejection, v2 handoff manifest, deterministic validation report, and disposable-only rehearsal are complete. The referenced cleanup task is unavailable on this host, so the real cleaned export, digests and review references remain externally blocked. See `docs/migration-intake/CATALOG_MIGRATION_HANDOFF.md`.
4. **Build a deterministic real-catalog import artifact.** The deterministic bundle/report and atomic disposable rehearsal path are complete; run them when the approved v2 bundle arrives, then review results before any persistent import.
5. **Resolve product decisions for notices, recipients, pricing, retention, and routes.** These unblock the real student consent/payment/submission loop.
6. **Connect and accept external services in Alibaba Cloud staging.** Email, OSS, scanning, payments, school delivery, workers, monitoring, backup/restore, and failover require separate evidence.
7. **Complete beta controls and operational approval.** Only then evaluate enabling the Agent product path.

## 5. Safety Boundaries

- Local success is not staging or production approval.
- Keep real payments, official delivery, production file handling, and the Agent disabled until their gates pass.
- Do not commit `.env*`, `.cuac-local/`, credentials, database dumps, private files, output captures, browser profiles, or generated release bundles.
- Preserve the approved public list/showcase visual language unless the product direction explicitly changes.
