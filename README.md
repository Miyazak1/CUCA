# CUAC Local Platform

This workspace contains the CUAC application backend and its current frontend shell. The supported local runtime uses a persistent loopback PostgreSQL container, synthetic catalog/application data, three primary generated password accounts (student, school staff, and CUAC Ops), and a separate CUAC Admin reviewer for dual-control acceptance checks.

For a new-machine setup, current verification evidence, safety boundaries, and unfinished work, begin with [the device handoff](docs/DEVICE_HANDOFF_2026-09-05.md). The complete design and architecture package is indexed in [docs/README.md](docs/README.md).

## Prerequisites

- Node.js `>=22.13.0`
- Docker Desktop with the local Docker engine running
- Dependencies installed with `npm install`

## Start Locally

On Windows, double-click `start-cuac-local.bat` (or the forwarding launcher one directory above). It validates the local prerequisites and starts the owned CUAC runtime on `http://127.0.0.1:53118` with PostgreSQL bound to its generated loopback port.

From this directory:

```powershell
npm run dev:local
```

For the pinned Windows setup, double-click `../start-cuac-local.bat`. It provisions or resumes the owned PostgreSQL container, applies all migrations, idempotently seeds local-only fixtures, and starts Vinext on application port `53118` with PostgreSQL on its generated loopback port. The launcher fails visibly if the pinned application port belongs to another service; it never selects a remote database or silently changes ports.

The npm command uses the saved local ports when a runtime already exists. Without the Windows launcher or explicit `CUAC_LOCAL_APP_PORT` and `CUAC_LOCAL_PG_PORT` values, a first-time runtime may select free loopback ports.

In another terminal:

```powershell
npm run local:credentials
npm run local:status
npm run local:smoke
```

`local:credentials` prints the generated local-only student, school-staff, Ops, and independent Admin reviewer accounts. `local:smoke` verifies public catalog access, student application and notification reads, notification security preferences, the school queue, the fixed five-queue Ops operations summary, an Ops catalog-requirements governance read, an Ops support-session open/lookup/close cycle, and the school-submit/Ops-claim/Admin-step-up/reject catalog-correction lifecycle through the real API. The rejection check also proves that the proposed value does not change the public school record.

On Windows, `../show-cuac-local-accounts.bat` displays the same generated accounts after a successful migration and seed receipt exists for this installation. It only reads the protected local runtime state and receipt; it does not start the server or sign in. A state file created by an interrupted first run is not treated as proof that the accounts exist.

To prepare the database without keeping the application server attached, run `npm run local:up`. To stop PostgreSQL while retaining its generated state and Docker volume, run `npm run local:stop`.

## Verification

```powershell
npm run quality:local
npm run security:audit
npm run db:pg:rehearse
npm run db:http:rehearse
```

`quality:local` is the zero-cost release-quality gate. It runs application linting, linting and TypeScript checks for the active catalog release path, the production-only TypeScript check, the complete server suite, frontend contracts, deployment release gates, and the production build without relying on GitHub Actions or another hosted CI service. Run `npm run quality:quick` during development for the shorter lint, production typecheck, and frontend-contract loop. The historical one-off catalog archive still has known lint and type debt; `catalog:debt:check` compares it with `config/catalog-tool-debt-baseline.json`, so every error category may only decrease and a new category blocks the local gate. `lint:catalog-tools` remains available when the complete raw report is needed.

To install the repository-owned pre-push hook on a workstation, run `npm run quality:install-hooks` once. The hook invokes `quality:local` and prevents a push when the local gate fails. `security:audit` remains a separate network-backed check because upstream advisories can change independently of the source tree. It permits only the exact reviewed, currently unpatched Vinext dependency chains recorded in `config/dependency-audit-baseline.json`; a new package, advisory, or severity increase fails the check. Use `security:audit:raw` for npm's unfiltered report, and do not apply `npm audit fix --force` automatically.

`npm test` continues to build the production frontend and run the API-specific frontend contract suites. The archived frontend-only demo assertions remain available as `npm run test:legacy-demo`; they are not a production gate because they require the retired `design-lab` mirror, browser-local business state, and demo Agent behavior.

The PostgreSQL rehearsals use disposable loopback-only databases. The HTTP rehearsal also builds and starts the production API adapter on a disposable loopback port.

## Local Boundary

The local runtime is suitable for development and synthetic end-to-end verification. Email delivery, object storage, malware scanning, official school delivery, hosted payment, and production schedulers remain disabled unless their separately reviewed configuration is supplied. Local credentials and fixtures are not production identities, and local success is not Alibaba Cloud staging approval.
