# CUAC Payments and Billing Boundary

Date: 2026-09-02.

Status: hosted checkout, signed provider events, reconciliation, refund-driven entitlement revocation, owner-scoped status reads and dual-control no-change review of quarantined provider events are implemented and locally verified. Live charging remains disabled pending merchant/staging, pricing, finance, legal and operational approval. The former demo rule of “first school included and each additional school costs USD 20” is **superseded and not approved for production**.

## 1. Stable separation

The following units are independent:

| Unit | Meaning |
| --- | --- |
| Program application | One student choice for one program and intake; same-school programs remain independent |
| Official submission group | Future mapping to a university form that may contain one or several ordered program choices |
| CUAC service charge | A versioned commercial rule that may be per order, cycle, service, program or another approved unit |
| University official fee | A school-owned fee for a specific program/intake/submission route |
| Billing entitlement | Server-owned evidence that a specific submission batch may proceed without charge or after confirmed payment |

None can be derived from another. In particular, application granularity does not determine fee granularity, one hosted checkout does not merge program states, and a paid invoice does not prove that a university received an application.

## 2. Current runtime boundary

- CUAC never accepts card numbers, CVV/CVC, bank account credentials or provider payment tokens in application/Agent APIs.
- The fixed `cuac_hosted_gateway_v1` adapter uses a provider-controlled hosted checkout. CUAC stores only business references, amounts, currency, lifecycle state, payload digests and signed-event processing evidence.
- Server-side fee preview and exact invoice-line snapshots are authoritative for current code execution, but the configured fee formula is not an approved versioned commercial policy. `CUAC_APPLICATION_FEE_MINOR` is not production pricing approval.
- Checkout creation, webhook verification and reconciliation fail closed unless the complete reviewed configuration is present. Staging/production readiness also requires a supervised worker and signed staging acceptance attestations.
- Students can read only their own minimal invoice/payment lifecycle through `GET /api/v1/billing/invoices/{invoiceId}`; provider references and event evidence stay internal.
- Agent tools, school portal and Ops summaries cannot access payment credentials. School projections must not expose charges for other schools or projects.

## 3. Required production model

Before charging, add immutable versioned objects for:

1. fee policy and effective period;
2. quote bound to exact program choices, submission intent revision and currency;
3. invoice and line snapshots that identify whether each line is CUAC service or university official fee;
4. provider checkout attempt and signed webhook event inbox (implemented);
5. payment allocation and exact submission entitlement (implemented for application-fee lines);
6. provider refund result and reconciliation state (implemented); CUAC-initiated refund request/approval workflow remains pending.

All monetary arithmetic uses integer minor units and one explicit ISO currency per line/total. The server recalculates and validates every quote. Client IDs, displayed totals, `paid=true`, redirect success pages and Agent statements are never payment authority.

## 4. Submission relationship

Recording a [逐项目提交授权](CUAC_APPLICATION_SUBMISSION_AUTHORIZATION_CONTRACT.md) creates no invoice and grants no billing entitlement. Formal submission must bind an approved server quote and either a `not_required` entitlement or a confirmed allocation whose amount/currency/policy version exactly match. Payment confirmation and creation of school-facing records must be idempotent and recoverable from uncertain commits without duplicate charges or duplicate application records.

Pricing, free quotas, add-on programs, withdrawal, refunds, provider choice, Chinese tax/receipt requirements and university fee remittance remain product/legal/finance decisions. They must not be inferred from the V3 demo or the historical multi-school copy.

## 5. Mandatory gates

- signed webhook verification, replay protection and provider event inbox: locally implemented and tested;
- duplicate checkout/payment concurrency and exact entitlement tests: locally implemented and tested;
- stale quote and changed-choice rejection;
- amount/currency/allocation reconciliation: locally implemented; versioned commercial policy remains pending;
- refund result reconciliation and immutable audit: locally implemented; refund initiation dual control remains pending;
- quarantined provider-event review: locally implemented as claim/escalate/different-admin no-change closure; it cannot replay events or alter payment facts;
- provider timeout and unknown-result quarantine, never blind charge retry;
- hosted checkout browser validation, HTTPS, CSP and redirect allowlist;
- Alibaba Cloud secret/KMS, RDS TLS, backup/restore and incident runbook;
- legal/finance approval of pricing copy, receipts, refunds and retention.

The detailed technical boundaries are in [the hosted payment contract](CUAC_HOSTED_PAYMENT_AND_RECONCILIATION_CONTRACT.md) and [the Ops billing review contract](CUAC_OPS_BILLING_REVIEW_CONTRACT.md). Until all external gates pass, payment mode remains disabled even though local invoice/payment evidence is technically capable of granting exact submission entitlement.
