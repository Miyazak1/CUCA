# CUAC Persistent Local Development Runbook

Status: implemented and locally verified on 2026-09-03. This runtime is for backend development and V3 product integration. It is not a production deployment, and it does not make the current frontend Demo a fixed database contract.

## 1. What This Starts

`npm run dev:local` performs one controlled sequence:

1. Uses the already-cached PostgreSQL 16 image by immutable local image ID.
2. Creates or starts one CUAC-owned Docker container and persistent named volume.
3. Publishes PostgreSQL only on `127.0.0.1`; the Windows launcher pins port `62251`, while a first direct npm run may select an available loopback port.
4. Applies the reviewed 48-migration chain through `0047_school_catalog_corrections`.
5. Idempotently loads synthetic local-only catalog, student, school staff, school application, CUAC Ops and separate CUAC Admin reviewer fixtures.
6. Starts the Node/Vinext API on loopback; the Windows launcher pins port `52118`, while a first direct npm run may select an available loopback port.

The normal `npm run dev` path retains the existing Sites/Cloudflare frontend-preview configuration. Only the generated `CUAC_LOCAL_RUNTIME=1` process uses the Node backend path that matches the future Alibaba Cloud application runtime more closely.

## 2. Start And Verify

From `D:\CODE\CUAC\frontend`:

```powershell
npm run dev:local
```

For the supported fixed-port Windows entry, double-click
`D:\CODE\CUAC\start-cuac-local.bat`. It always uses application port `52118`
and PostgreSQL port `62251`. If either port is owned by another service, startup
fails visibly instead of changing ports or connecting to a different database.

Keep that terminal running. In another terminal:

```powershell
npm run local:status
npm run local:smoke
```

If `npm run dev:local` reports `Another vinext dev server is already running`, the existing service already owns the reported loopback URL. Do not start a duplicate; use `npm run local:status` and open the existing URL. Stop the foreground owner with `Ctrl+C` only when intentionally restarting it.

`local:status` reports the actual application URL and database state without printing credentials or the database URL. `local:smoke` verifies:

- PostgreSQL-backed health is `ok`;
- public catalog reads return the synthetic programs;
- the synthetic student can sign in and sign out;
- the student can read the seeded application set;
- the synthetic school staff account signs in through the production password endpoint for its exact active tenant and reads one school-application queue item;
- the synthetic CUAC Ops account signs in from its current approved grant, opens an application-scoped support session, performs a minimal lookup and explicitly closes the session;
- the same CUAC Ops session reads the fixed five-queue operations summary plus the minimal billing and official-delivery review queues;
- school staff submits a bounded catalog correction, Ops claims it, and a different stepped-up CUAC Admin rejects unverifiable evidence without changing the published school field;
- three projects remain three choices, including two independent projects at the same school.

To display the generated synthetic login intentionally:

```powershell
npm run local:credentials
```

The command intentionally displays three primary workflow accounts plus a separate CUAC Admin reviewer. It succeeds only when `.cuac-local/seeded.json` proves that migrations and the idempotent seed completed for the same generated installation. An interrupted first run cannot expose accounts that may not exist yet. The hidden approval identity remains distinct so the generated Ops and Admin grants do not self-approve.

On Windows, `D:\CODE\CUAC\show-cuac-local-accounts.bat` performs the same
receipt-gated display without starting the server or signing in.

## 3. Stop And Resume

Stop the foreground application with `Ctrl+C`. To stop PostgreSQL as well:

```powershell
npm run local:stop
```

The named volume and generated local state remain. The next `npm run dev:local` starts the same database, verifies migration history, applies only new migrations, and seeds missing fixtures without resetting student edits.

There is deliberately no automated reset/delete command in this slice. A future reset workflow must require explicit confirmation, verify Docker ownership labels, and distinguish fixture cleanup from database destruction.

## 4. Local State And Data Rules

- Generated state lives at `frontend/.cuac-local/runtime.json` and is excluded by `.gitignore`.
- Database, session, material-encryption and synthetic-account secrets are random per installation.
- Credentials are passed through child-process environment, not Docker command arguments.
- Docker container and volume access requires matching runtime and installation labels.
- A direct first npm run may select another loopback port when its default is occupied. The Windows launcher never changes its pinned `52118/62251` ports; a conflict stops startup and retains the persistent volume.
- Seed records use the `.invalid` domain and explicit `Local Fixture` labels. They are not verified catalog facts and must never be promoted to staging or production.
- Real student, school, payment, document or provider data is prohibited in this local fixture database.

## 5. Boundaries That Remain Closed

The local runtime does not enable:

- real payment-provider checkout, webhook, refund or card data;
- running Official Submission Outbox workers or real school delivery adapters;
- school or Ops workflows beyond the already reviewed invite, school status/contact, grant-bound support, governed summaries, requirement governance, billing review, routing review and catalog data-quality review boundaries;
- Agent direct database access, free SQL or natural-language database writes;
- file upload or cloud object storage;
- Alibaba Cloud RDS, KMS, backup, restore, failover or production acceptance.

`application.submit` remains an internal service only. A pending local outbox row is not evidence that a university received an application.

## 6. Frontend Integration Rule

The only product-design reference remains `D:\CODE\CUAC\design-lab\home-v3.html`. It may continue to change as Hub and Application Center mature. API integration should follow stable domain resources and tasks, not copy temporary cards, buttons or page sections into tables.

The first frontend integrations should be incremental:

1. Health and public catalog reads.
2. Guest session and student Auth.
3. Student profile and saved items.
4. Application sets and per-program choices.
5. Applicant, education, assessment, material and preflight flows.

Payment and official submission UI remain disabled until their external providers, legal text, prices and operational recovery paths pass separate gates.

## 7. Current Evidence

Current persistent-runtime verification on 2026-09-03:

- PostgreSQL persisted in `cuac-pg-local-data-v1` and bound only to IPv4 loopback.
- The existing 45-migration persistent database upgraded in place to 46 migrations without resetting rows.
- Synthetic fixture: 2 cities, 2 schools, 3 programs, 1 scholarship, 1 student application set with 3 program choices, 1 exact school application, 1 active school membership and 1 approved Ops grant.
- HTTP smoke: health, catalog, student Auth/application/notification/preferences, school Auth/queue, Ops Auth/support, five operations queues, catalog governance, billing review, routing review and 8-item catalog data-quality queue passed.
- Full backend command set: 746/746; focused data-quality tests: 12/12.
- Focused data-quality PostgreSQL rehearsal: 3/3; PostgreSQL plus production-build HTTP rehearsal: 525/525.
- PostgreSQL 16.13 schema parity: 72 tables, 1121 columns, 416 constraints and 278 indexes. TypeScript, focused ESLint and the production build passed.

The authoritative migration and broader backend evidence remain in [the PostgreSQL rehearsal report](CUAC_POSTGRES_REHEARSAL_REPORT.md) and [the production delivery plan](CUAC_PRODUCTION_DELIVERY_PLAN_CN.md).
