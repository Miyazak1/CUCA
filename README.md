# CUAC Local Platform

This workspace contains the CUAC application backend and its current frontend shell. The supported local runtime uses a persistent loopback PostgreSQL container, synthetic catalog/application data, three primary generated password accounts (student, school staff, and CUAC Ops), and a separate CUAC Admin reviewer for dual-control acceptance checks.

For a new-machine setup, current verification evidence, safety boundaries, and unfinished work, begin with [the device handoff](docs/DEVICE_HANDOFF_2026-09-05.md). The complete design and architecture package is indexed in [docs/README.md](docs/README.md).

## Prerequisites

- Node.js `>=22.13.0`
- Docker Desktop with the local Docker engine running
- Dependencies installed with `npm install`

## Start Locally

On Windows, double-click `start-cuac-local.bat` (or the forwarding launcher one directory above). It validates the local prerequisites and starts the owned CUAC runtime on `http://127.0.0.1:52118` with PostgreSQL bound to `127.0.0.1:62251`.

From this directory:

```powershell
npm run dev:local
```

For the pinned Windows setup, double-click `../start-cuac-local.bat`. It provisions or resumes the owned PostgreSQL container, applies all migrations, idempotently seeds local-only fixtures, and starts Vinext on application port `52118` with PostgreSQL on `62251`. The launcher fails visibly if either pinned port belongs to another service; it never selects a remote database or silently changes ports.

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
npm run test:backend
npm test
npm exec tsc -b --pretty false
npm run db:pg:rehearse
npm run db:http:rehearse
```

`npm test` builds the production frontend and runs the API-specific frontend contract suites. The archived frontend-only demo assertions remain available as `npm run test:legacy-demo`; they are not a production gate because they require the retired `design-lab` mirror, browser-local business state, and demo Agent behavior.

The PostgreSQL rehearsals use disposable loopback-only databases. The HTTP rehearsal also builds and starts the production API adapter on a disposable loopback port.

## Local Boundary

The local runtime is suitable for development and synthetic end-to-end verification. Email delivery, object storage, malware scanning, official school delivery, hosted payment, and production schedulers remain disabled unless their separately reviewed configuration is supplied. Local credentials and fixtures are not production identities, and local success is not Alibaba Cloud staging approval.
