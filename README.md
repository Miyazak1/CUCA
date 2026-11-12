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

With `npm run dev:local` running in another terminal, run `npm run qa:auth-application-local` for a real browser, HTTP, and PostgreSQL login/application acceptance check, and `npm run qa:editorial-local` for the English, Vietnamese, Thai, Indonesian, Malay, and Arabic editorial pages. Run `npm run qa:home-locale-local` to compare the actual homepage structure, images, catalog loading, footer navigation, mobile layout, and link/search language retention across all six languages, including the catalog-unavailable fallback. These commands use the owned loopback runtime, retain clearly named local test applications, and save results under `output/feedback-20261112/`; they do not deploy or send materials to external schools. The current release tests school-contact handoff, with official material submission and payment still disabled.

For final feedback acceptance, stop the dev server, run `npm run build`, then run `npm run preview:local` in another terminal. This uses the same owned local database through the managed application entry point, including the real security response headers. Run `npm run qa:application-ui-local` for five-language application creation, program choice, profile, education and submission entirely through forms; only fresh synthetic account setup and local email verification are prepared outside the UI. Run `npm run qa:public-locales-local` for all 19 six-language public HTML templates, mobile/desktop filters and authentication gates, and `npm run qa:feedback-evidence-local` for full paginated search result equality, XSS, iframe blocking, the rebuilt internal-link inventory, scholarship copy and original long-title examples. The original report did not include its 54-link manifest; the latter command records all current internal links discovered from the ten main page types instead of claiming the original URLs were available.

Run `npm run qa:home-redirect-local` to verify the actual root redirect response and follow footer Logo clicks through to the final homepage in six languages at mobile and desktop widths. It also checks explicit English against a Vietnamese browser preference, repeated query parameters, encoded values and the query-free root. A correct Logo href alone does not establish that the redirect chain retains the language.

Run `npm run qa:footer-width-local` to compare the actual Footer and grid width with the homepage and both header edges at 375, 768, 1280 and 1920 pixels. It covers every released HTML template with a shared Footer and all published editorial routes in their supported languages, including anonymous private-page gates. Detail content keeps its separate 1180-pixel desktop width. Use `--sample` with the script for the homepage and four detail templates at 1920 pixels in Vietnamese.

Run `npm run qa:site-layout-local` against the managed built preview for layout and language consistency at 320, 375, 768, 1024, 1280 and 1920 pixels. Routes are discovered from the release manifest, published guides and insights. The suite opens navigation and language menus, switches each multilingual page through all six languages and back to English, preserves path/query/hash, compares content container widths, checks header/Footer edges, wordmark size, heading overflow and viewport boundaries. Scrollable table columns are allowed inside their own containers. It also signs in with the owned local student, school and operations accounts to inspect workspace layouts, and runs the account-menu suite at 667px height to verify popover edges, every link and Escape closing. The separate `qa:account-menu-layout-local` command runs that part alone. Staff fixtures use normal MFA verification, including replay protection; the helper reads only the managed local synthetic factor and never prints its secret. Standalone account-action pages without a language selector are loaded directly in supported languages; school invitations and billing remain English. School and operations workspaces retain their declared Chinese interface and English public-catalog destinations. This does not perform guardian approvals, email verification, password resets or deployment, and Chromium viewports do not replace real iPhone Safari verification.

Run `npm run qa:site-navigation-local` against the managed built preview for the complete navigation regression: all seven server aliases, all 28 released HTML templates and published editorial routes, every discovered internal link, real sign-in continuations, exact application/program/intake return state, disabled legacy navigation actions, account-action SSR pages, and homepage Logo redirects. The individual `qa:site-redirects-local`, `qa:site-links-local`, `qa:signin-navigation-local`, `qa:navigation-actions-local` and `qa:account-action-navigation-local` commands expose each suite separately. Authentication tests create isolated `nav-*` accounts on the owned loopback database, verify only those synthetic emails locally and keep normal rate limiting enabled. The account-action navigation suite checks invalid-link terminal states and return links; it does not send real email or perform a real password reset. Disabled Agent and payment capabilities remain disabled.

The browser checks use an installed Playwright runtime and Chromium. Codex desktop's bundled runtime is detected by default; `CUAC_PLAYWRIGHT_MODULE` and `CUAC_CHROMIUM_EXECUTABLE` can select existing installations. The checks do not download browsers. Editorial translation coverage and stale-source fallback are also included in `npm run test:frontend-contracts`.

`quality:local` is the zero-cost release-quality gate. It runs application linting, linting and TypeScript checks for the active catalog release path, the production-only TypeScript check, the complete server suite, frontend contracts, deployment release gates, and the production build without relying on GitHub Actions or another hosted CI service. Run `npm run quality:quick` during development for the shorter lint, production typecheck, and frontend-contract loop. The historical one-off catalog archive still has known lint and type debt; `catalog:debt:check` compares it with `config/catalog-tool-debt-baseline.json`, so every error category may only decrease and a new category blocks the local gate. `lint:catalog-tools` remains available when the complete raw report is needed.

To install the repository-owned pre-push hook on a workstation, run `npm run quality:install-hooks` once. The hook invokes `quality:local` and prevents a push when the local gate fails. `security:audit` remains a separate network-backed check because upstream advisories can change independently of the source tree. It permits only the exact reviewed, currently unpatched Vinext dependency chains recorded in `config/dependency-audit-baseline.json`; a new package, advisory, or severity increase fails the check. Use `security:audit:raw` for npm's unfiltered report, and do not apply `npm audit fix --force` automatically.

`npm test` continues to build the production frontend and run the API-specific frontend contract suites. The archived frontend-only demo assertions remain available as `npm run test:legacy-demo`; they are not a production gate because they require the retired `design-lab` mirror, browser-local business state, and demo Agent behavior.

The PostgreSQL rehearsals use disposable loopback-only databases. The HTTP rehearsal also builds and starts the production API adapter on a disposable loopback port.

## Local Boundary

The local runtime is suitable for development and synthetic end-to-end verification. Email delivery, object storage, malware scanning, official school delivery, hosted payment, and production schedulers remain disabled unless their separately reviewed configuration is supplied. Local credentials and fixtures are not production identities, and local success is not Alibaba Cloud staging approval.
