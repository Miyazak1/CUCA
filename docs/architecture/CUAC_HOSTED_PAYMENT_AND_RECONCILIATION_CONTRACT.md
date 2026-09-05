# CUAC Hosted Payment and Reconciliation Contract

Date: 2026-09-02.

Status: the fixed hosted-gateway adapter, signed webhook inbox, PostgreSQL settlement/reconciliation transaction, student-owned status read and supervised worker entry are implemented and locally verified. This is not merchant onboarding, pricing approval, PCI/legal approval, a staging acceptance record or permission to charge production users.

## 1. Authority Boundary

- The only accepted provider identifier is `cuac_hosted_gateway_v1`; runtime modes are `disabled`, `test` and `live`.
- CUAC sends only invoice identity, integer minor-unit amount, ISO currency, server-expanded return URLs and bounded business metadata to the hosted gateway.
- CUAC never accepts or stores card numbers, CVV/CVC, bank credentials, payment tokens or raw provider payloads.
- Browser redirect success is not payment authority. Only a verified provider event committed by PostgreSQL can settle, cancel or refund a payment.
- One invoice has exactly one CUAC payment row. Provider checkout and payment references are unique within their provider scopes.

## 2. Hosted Checkout

`POST /api/v1/billing/checkout-intents` is same-origin, session-authenticated and student-owned. The server recalculates the fee snapshot, persists the invoice and lines, and calls the fixed HTTPS gateway with `cuac.hosted-checkout-request.v1`.

The gateway request binds method, fixed path, timestamp, idempotency key, invoice id and payload SHA-256 with HMAC-SHA256. The response must be HTTP 200 JSON, at most 8 KiB, use `cuac.hosted-checkout-response.v1`, repeat the exact invoice/amount/currency, return an HTTPS checkout URL on the configured checkout host, and carry a valid response signature. Redirects, credentials in URLs, non-443 explicit ports, query-bearing gateway endpoints and unapproved hosts fail closed.

Return paths are local application paths supplied to CUAC; only the server expands them against `CUAC_PUBLIC_APP_URL`. Provider metadata, payment credentials and external return URLs are rejected.

## 3. Webhook Contract

The provider posts uncompressed UTF-8 JSON to `POST /api/v1/billing/provider-events` with:

- `x-cuac-payment-timestamp`: canonical ISO timestamp within the configured skew;
- `x-cuac-payment-signature`: `v1=` plus HMAC-SHA256 over the method/path/timestamp/payload-digest binding;
- `content-type: application/json` or `application/json; charset=utf-8`.

The body is limited to 16 KiB and must exactly match `cuac.payment-event.v1`: `eventId`, `eventType`, `invoiceId`, `providerCheckoutSessionId`, nullable `providerPaymentId`, `amountMinor`, `currency` and canonical `occurredAt`. Accepted events are `payment.succeeded`, `payment.canceled` and `payment.refunded`. Signature verification occurs on raw bytes before JSON parsing.

The inbox stores only the payload SHA-256 and normalized business references. `(provider, eventId)` is unique; an exact replay returns the stored result, while the same event identity with changed content is rejected.

## 4. Settlement and Recovery

Processing locks the inbox, invoice and payment. It verifies provider/session/invoice/payment identity plus exact amount and currency before mutation.

- Success marks the payment succeeded, finalizes the invoice, records a status event, grants each exact application-fee entitlement and writes service audit evidence in one transaction.
- Cancellation marks only an unpaid payment canceled and voids its draft invoice; it grants no entitlement.
- Refund marks the settled payment refunded, preserves the finalized invoice as evidence and revokes entitlements from that payment.
- Refund before success remains pending with bounded exponential backoff. Events are quarantined after 20 attempts or 24 hours, and identity/amount/currency mismatches quarantine immediately.
- Audit failure rolls back settlement, entitlement and inbox outcome together.

Run reconciliation as a separately supervised process:

```bash
npm run start:payment-reconciliation-worker
```

## 5. Student Status Projection

`GET /api/v1/billing/invoices/{invoiceId}` is session-authenticated and owner-scoped. It returns invoice/application-set identity, internal checkout row identity, invoice/payment status, amount/currency and lifecycle timestamps. It does not return gateway URLs, provider names, provider checkout/payment references, event ids, signatures or raw evidence. Missing and cross-student invoices fail with the same closed response.

## 6. Configuration and Release Gates

Gateway and webhook HMAC secrets must be independent canonical base64url values representing 32 to 64 random bytes. Required configuration is documented in `frontend/config/staging.env.example` and `production.env.example`. Production requires `live`; staging permits `test` or `live`. Offline readiness also requires both supervised-worker and staging-acceptance attestations, but always reports `runtimeVerified=false`.

Before enabling production charging, preserve evidence for a real merchant-controlled staging round trip covering checkout creation, signed success, cancellation, refund, exact replay, changed-content replay rejection, delayed refund reconciliation, quarantine alerting, worker restart recovery and status polling. Separately approve the provider/data-processing boundary, pricing and refund policy, receipts/tax handling, retention, monitoring, incident response and secret rotation. Until those approvals exist, templates stay `CUAC_PAYMENT_MODE=disabled`.
