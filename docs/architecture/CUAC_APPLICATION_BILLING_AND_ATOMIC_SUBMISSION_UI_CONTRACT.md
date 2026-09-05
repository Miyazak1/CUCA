# CUAC Application Billing and Atomic Submission UI Contract

## Scope

The student application UI uses server-owned billing and submission facts. Browser state may locate a pending invoice, but it never proves payment, entitlement, submission acceptance, or external delivery.

## Fee quote

- `POST /api/v1/billing/fee-preview` receives the current application set id and the complete, sorted application choice id list.
- The UI displays only the returned currency, minor-unit amounts, descriptions, and exact choice bindings.
- Adding, removing, or replacing a choice invalidates the visible quote and any pending browser invoice locator.
- The UI contains no fallback tariff and performs no client-side fee calculation.

## Hosted checkout

- `POST /api/v1/billing/checkout-intents` receives the same exact application scope and local success/cancel return paths.
- The UI accepts only an HTTPS checkout URL returned by the server.
- Card, bank, token, or other raw payment credentials are never collected or sent by the CUAC page.
- A checkout return query is only a navigation hint. It is not payment evidence.
- `GET /api/v1/billing/invoices/:invoiceId` is the only browser-visible payment status authority.
- A successful invoice is still insufficient for final submit until every current choice preflight exposes a current billing entitlement.

## Atomic submission

- The student enters the current account password immediately before submission.
- `POST /api/v1/auth/step-up` upgrades the existing authenticated session; the password input is cleared immediately after it is read.
- `POST /api/v1/student/application-sets/:applicationSetId/submit` sends the current set revision, the complete sorted choice list, explicit confirmation, and an idempotency key.
- The UI marks the set submitted only after receiving a matching `accepted` receipt with `acceptanceScope: cuac_internal` and one program application per exact choice.
- A successful receipt means CUAC accepted and locked the application set. It does not claim that an external school has received or reviewed it.
- Official submission group and school application statuses are displayed separately from the internal acceptance receipt.

## Local runtime

The canonical local app is `http://127.0.0.1:52118`. Local fee preview is available from PostgreSQL configuration. Hosted checkout is intentionally unavailable while `CUAC_PAYMENT_MODE=disabled`; the UI must show that closed state and must never simulate payment success.

## Regression guards

`frontend/tests/application-profile-public-contract.test.mjs` rejects browser-side payment simulations and requires the server fee, invoice, step-up, entitlement, version, idempotency, and internal acceptance boundaries above.

## Verification evidence

- `npm exec tsc -b --pretty false` passes after the billing runtime and local seed changes.
- The production `vinext build` passes and emits the fee preview, hosted checkout, invoice status, step-up, preflight, and atomic submission routes.
- The focused application, billing, entitlement, preflight, submission, and local-runtime suite passes `67/67` tests.
- A second `npm run local:up` applies `0` new migrations, keeps the same synthetic application-set and school-portal fixture identities, and keeps exactly three reviewed submission-policy targets.
- `npm run local:smoke` passes against `http://127.0.0.1:52118` and real PostgreSQL, including three application choices, an isolated school queue fixture, five Ops queues, material preflight, and a server fee preview of `CNY-240000` minor units.
- Read-only browser checks at `1280x720` and `390x844` report no horizontal overflow and no console warnings or errors. Authenticated payment and final-send browser actions remain intentionally unperformed without action-time approval to enter the local account password.
- `frontend/public/application.{html,js,css}` and `design-lab/application.{html,js,css}` have matching SHA-256 hashes after synchronization.
