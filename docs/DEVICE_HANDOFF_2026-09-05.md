# CUAC Device Handoff

Snapshot date: 2026-09-05 (Asia/Shanghai)

Repository: `https://github.com/Miyazak1/CUCA`

Branch: `main`

## 1. Product Goal

CUAC is being built as a production-grade application platform that can run and ship without an AI Agent. The core scope includes authentication and permissions, public catalog, student profile and private files, an application lifecycle keyed by student + program + intake, billing and payment, school review, Ops administration, notifications, audit and monitoring, PostgreSQL governance, and Alibaba Cloud staging/release readiness.

The Agent is deliberately downstream of the stable core. In normal local and staging-candidate runtime it remains disabled. Any later Agent integration must use the Tool Gateway and must not receive arbitrary SQL access, database credentials, unrestricted sensitive data, or autonomous business-write authority.

## 2. Current State

The repository contains the active frontend, API routes, server modules, PostgreSQL schema and 48 migrations through `0047_school_catalog_correction_url_check`, local launch tooling, production/release checks, workers, and automated tests.

The supported Windows local runtime is fixed to:

- Application: `http://127.0.0.1:52118`
- PostgreSQL: `127.0.0.1:62251`

The local runtime uses generated local-only accounts and synthetic fixtures. It does not contain production identities or production catalog content.

As of this handoff, the real school, program, scholarship, and city content migration is not complete. The local seed is synthetic. A legacy CSCAlite database was inspected read-only, but its school-related data had been cleaned by another task and must not be copied or restored until that task provides an explicit migration whitelist, prohibited-data list, authoritative sources, and cleaned export paths. The coordinating task is `codex://threads/01a0614f-2ebf-70b0-8224-28cfce3b7f07`.

Do not treat `public/cuac-data.js`, `seeds/catalog.sample.json`, or `seeds/catalog.local.synthetic.json` as verified production catalog data. Do not import the legacy CSCAlite database wholesale.

## 3. Verified Evidence

The latest completed verification recorded before this handoff includes:

- Core server suite: 661 tests passed during the latest full backend run.
- Real PostgreSQL 16.13 rehearsal: 417 tests passed.
- Built production API plus disposable PostgreSQL and loopback HTTP rehearsal: 527 tests passed.
- Linux migration image rehearsal: 7 tests passed through migration `0047`.
- Linux lifecycle rehearsal: 3 tests passed.
- Schema parity: 73 tables, 1,145 columns, 424 constraints, and 283 indexes.
- Current migration release digest: `d4651eb89a5d6295f3aebaf059940614c671db5b4613bcdff408172af19a74c6`.

These results prove the tested local/rehearsal boundary. They do not prove Alibaba Cloud staging acceptance. The authoritative detail is in `docs/architecture/CUAC_POSTGRES_REHEARSAL_REPORT.md`.

## 4. New Device Setup

Install these prerequisites:

- Git
- Node.js `>=22.13.0`
- Docker Desktop using Linux containers

Clone and install:

```powershell
git clone https://github.com/Miyazak1/CUCA.git
cd CUCA
npm ci
```

Start the supported local runtime by double-clicking `start-cuac-local.bat`, or run:

```powershell
.\start-cuac-local.bat
```

The launcher provisions/resumes its owned loopback PostgreSQL container, applies migrations, creates synthetic local fixtures and generated accounts, and starts the app on port `52118`. It fails instead of silently changing ports when `52118` or `62251` is occupied.

After the first successful setup, display local accounts without signing in:

```powershell
.\show-cuac-local-accounts.bat
```

Generated account passwords are machine-local and are intentionally not committed. Never copy `.cuac-local/runtime.json` into Git or chat.

## 5. Validation Commands

Fast source checks:

```powershell
npm exec tsc -b --pretty false
npm run build
npm run test:backend
npm test
```

Disposable real-database gates:

```powershell
npm run db:pg:rehearse
npm run db:http:rehearse
npm run db:linux:rehearse
npm run test:linux:lifecycle
```

Local runtime checks after starting it:

```powershell
npm run local:status
npm run local:smoke
```

The database rehearsals create disposable resources. They are separate from the persistent local runtime. Do not point rehearsal or migration commands at an unreviewed remote database.

## 6. Important Boundaries

- Preserve user-authored frontend changes already in the worktree.
- Keep public list/showcase visuals unchanged for Home, Programs, Universities, Cities, and Scholarships unless the user explicitly changes that direction.
- Detail pages for program, university, city, and scholarship may be redesigned, but their UI must follow real API fields rather than invented demo fields.
- Do not start or sign into the user's persistent local app without explicit action-time approval. The user controls the `52118` runtime.
- Do not use port `53855`; it belongs to obsolete/parallel frontend work.
- Keep normal local and staging-candidate core runtime Agent-disabled.
- Never commit `.env*`, `.cuac-local/`, database dumps, credentials, private keys, output captures, generated release bundles, or browser profiles.
- The CSCAlite project and its database are external legacy sources, not dependencies of a clean CUAC clone.

## 7. Repository Map

- `app/`: Vinext application pages and API route adapters.
- `src/server/`: domain services, repositories, authorization, runtime composition, workers, audit, and infrastructure checks.
- `drizzle/pg/`: PostgreSQL migration history and schema snapshots.
- `scripts/`: local runtime, migration, rehearsal, staging, release, worker, and verification entry points.
- `tests/`: frontend contracts, server tests, real PostgreSQL rehearsals, HTTP rehearsals, and lifecycle gates.
- `public/`: current static frontend surfaces and API-backed runtime adapters.
- `seeds/`: synthetic/sample catalog bundles only.
- `config/`: non-secret staging and production environment templates.
- `docs/`: architecture, product, security, UX, runbooks, research, and this handoff.

## 8. Immediate Next Work

1. Obtain the explicit catalog-data cleanup handoff from `codex://threads/01a0614f-2ebf-70b0-8224-28cfce3b7f07`.
2. Turn that response into a reviewed migration whitelist and prohibited-data list.
3. Compare the cleaned source fields with the current CUAC catalog schema and public DTOs. Preserve provenance and avoid lossy field renaming.
4. Build a one-way, read-only source exporter and a deterministic CUAC import bundle. Do not write to the persistent local database during development.
5. Validate the bundle, source evidence, references, status rules, dates, URLs, and duplicate slugs.
6. Rehearse import against a disposable PostgreSQL instance and verify list/detail APIs.
7. Only after review, make the approved catalog bundle available to the user-controlled local runtime.
8. Complete Alibaba Cloud staging controls and evidence; local green tests are not a staging release approval.

## 9. Documentation Reading Order

Start with:

1. `docs/architecture/CUAC_PRODUCTION_DESIGN_INDEX.md`
2. `docs/architecture/CUAC_PRODUCT_PRODUCTION_ROADMAP.md`
3. `docs/architecture/CUAC_FULL_BACKEND_BLUEPRINT.md`
4. `docs/architecture/CUAC_PRODUCTION_READINESS_CONTRACT.md`
5. `docs/architecture/CUAC_POSTGRES_REHEARSAL_REPORT.md`
6. `docs/architecture/CUAC_LOCAL_DEVELOPMENT_RUNBOOK.md`
7. `docs/architecture/CUAC_STAGING_ACCEPTANCE_RUNBOOK.md`

Security-sensitive work should also read `CUAC_ROLE_PERMISSION_MATRIX.md`, `CUAC_DATA_CLASSIFICATION_REGISTER.md`, `CUAC_BACKEND_SECURITY_TEST_PLAN.md`, and `CUAC_SECURE_AGENT_BACKEND_ARCHITECTURE.md` in the same directory.

## 10. Not Yet Complete

- Real production catalog content migration and editorial verification.
- Alibaba Cloud staging deployment, managed-service credentials, and all required staging evidence controls.
- Production email, object storage, malware scanning, official school delivery, hosted payment, and schedulers with reviewed external configuration.
- Final operational approval for launch.
- Agent product completion, intentionally deferred until the non-Agent core reaches its launch gate.

This handoff describes the repository state and verified local boundaries. It is not a claim that the complete production objective has been achieved.
