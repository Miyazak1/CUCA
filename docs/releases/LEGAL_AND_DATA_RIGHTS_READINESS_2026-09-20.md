# CUAC Legal Publication and Data-Rights Readiness

Status: technical publication framework, authenticated student request intake, internal triage and outcome approval controls are implemented; approved legal wording and the operational fulfilment workflow remain release blockers.

This document is an engineering and operations control record. It is not legal advice and does not approve policy wording.

## Confirmed product decisions

- The operating entity and registered address are intentionally undecided and must not be fabricated in a publication.
- Planned public addresses are `privacy@cuca.com` for privacy/data-rights requests, `support@cuca.com` for customer support, and optionally `legal@cuca.com` for contracts, infringement and regulator correspondence. They must not be published until the `cuca.com` mail domain, inbound handling, access control and delivery tests are complete.
- Minors are an intended audience because CUAC primarily serves high-school students. Registration must remain blocked for production until the applicable age threshold, guardian authority evidence, consent/notice flow and withdrawal process are legally approved and technically tested.
- English and Simplified Chinese are required launch locales. They are independently prepared, reviewed, published, expired and withdrawn; neither locale falls back to the other.

## 1. Stable public policy surfaces

| Public route | Governed notice key | Required content owner |
| --- | --- | --- |
| `/privacy.html` | `privacy_notice` | Privacy/legal owner |
| `/terms.html` | `terms_of_service` | Legal/business owner |
| `/cookies.html` | `cookie_notice` | Privacy/legal owner |
| `/admissions-data-policy.html` | `admissions_data_policy` | Admissions data owner + legal reviewer |

The pages fetch only the exact locale and notice key from `GET /api/v1/notices/:noticeKey/:locale`. They show the published version, effective date and review-due date. Missing, expired, withdrawn, structurally invalid or unavailable content fails closed with an explicit unpublished state. There is no fallback to another locale, another policy or hard-coded legal copy.

Policy drafts use strict, purpose-specific section schemas. Publication retains the existing separation of duties: one internal actor prepares a digest-bound draft, a different stepped-up administrator reviews it, and an authorized administrator publishes the exact approved version. Public responses omit reviewer identities and internal evidence.

## 2. Current browser-storage inventory

Production authentication uses two necessary, first-party, `HttpOnly`, `SameSite=Lax` cookies:

- `cuac_session`: authenticated account session; `Secure` outside local development.
- `cuac_guest`: anonymous session continuity; `Secure` outside local development.

No third-party advertising, analytics, tag-manager, heat-map or cross-site tracking integration was found in the production source scan. This supports an essential-only launch posture, but the final Cookie Notice must be checked against the deployed edge, WAF, CDN and observability products before approval.

Several legacy/demo scripts still use `localStorage` or `sessionStorage`. Protected production pages have dedicated backend runtime clients and contract tests, but the legacy files remain in `public/`. Before release packaging, the public-asset allowlist must exclude obsolete demo entry points or those scripts must be removed after a route-by-route dependency proof. Until then, the Cookie Notice must not claim that browser storage is limited to the two cookies.

## 3. Required owner inputs

Do not put credentials, personal identity documents or private keys in this document, chat or Git. The owner must provide and legal review must confirm:

1. Legal operator/controller name, registration identifier, registered address and applicable jurisdiction.
2. Public privacy/data-rights contact and customer-support contact.
3. Launch audience and countries, including whether minors may create accounts and the required guardian process.
4. Processing purposes and legal bases for each data class and each account role.
5. Hosting region, subprocessors, recipients and any cross-border transfer mechanism.
6. Retention periods for active accounts, dormant accounts, PostgreSQL records, object storage, email delivery records, operational logs, security logs, backups and legally retained audit evidence.
7. Data-rights scope, identity-verification method, response owner, response target/SLA, exception handling and appeal/escalation route.
8. Terms: service provider, eligibility, acceptable use, admissions disclaimer, suspension rules, intellectual-property position, liability position, governing law and dispute route.
9. Admissions-data correction owner, evidence standard, freshness targets, expiry/archival rules and school self-service responsibility.
10. Named preparer and independent approver for each locale and policy, with approval reference and next review date.

## 4. Rights-request operating model

The production workflow must cover access, correction, portable export, account closure/deletion, processing objection/restriction where applicable, and consent withdrawal where consent is actually used.

Required lifecycle:

1. The signed-in user creates a request from the account area. The server derives the user identity from the session; it never accepts another user ID from the browser.
2. The server assigns an immutable reference, request type, received timestamp and status. The initial request contains no uploaded identity document.
3. Sensitive requests require a fresh authentication step. Staff cannot use ordinary support impersonation to approve a request.
4. A privacy-authorized operations queue records assignment, scoped notes, deadlines and every status transition in the audit log.
5. Export generation uses a short-lived encrypted artifact and one-time retrieval authorization. It excludes internal security signals, other tenants and legally protected third-party data.
6. Deletion is a staged, idempotent job with an explicit retention-exception ledger. It revokes sessions first, prevents new work, erases or anonymizes eligible data, and records only the minimum completion evidence.
7. Backups expire under the approved schedule; they are not selectively rewritten. Restore procedures must reapply completed deletion tombstones before restored data can serve traffic.
8. The user receives status and completion notices through the verified account email. No raw personal data or download token appears in operational logs.

### Implemented intake boundary

The signed-in student account area now supports structured access, correction, portable-export and account-deletion requests. Identity is derived only from the authenticated session; browser-supplied ownership is rejected. Correction requests capture a bounded data area rather than unrestricted sensitive text. Export and deletion require fresh password reauthentication. Students can list their own requests and cancel only a still-received request using its current revision.

The database enforces one active request of each type per account, explicit lifecycle states, terminal timestamps and bounded locale/type/scope values. Each create and cancel operation is transactionally coupled to a metadata-only audit event. Repository reads and mutations recheck the live active account and student role. If an account is later deleted, the direct user link is removed while a one-way subject reference and minimum request evidence remain available for the future legally approved retention rule.

Phase B adds an internal least-privilege triage queue. A currently authorized CUAC operator can list only minimal request metadata, claim a received request using its current revision, and escalate an assigned investigation with one of four fixed reason codes and an opaque internal case reference. The claim is bound to the exact live staff grant; stale revisions, revoked grants and a different assignee fail closed.

Phase C adds an immutable, digest-bound **outcome plan**, not an execution command. Access and ordinary correction plans may be confirmed by the authorized operator who owns the case. A portable-export plan requires a `cuac_admin` session with fresh step-up authentication. An account-deletion plan, denial or retention exception requires a second, different stepped-up administrator; the proposer cannot approve their own plan. Fixed outcome/reason codes, exact request/review revisions, the current live staff grant and an opaque case reference are enforced again at the database boundary. Approval deliberately leaves the request in its existing operational state and creates no export, deletion, denial, notification or closure side effect. A student's own profile edits remain direct owner-scoped changes and never enter this staff approval workflow.

This is intake and triage, not a completed rights operation. The following remain release blockers:

- approved privacy staff roster, SLA/deadline rules and a reviewed operating runbook for the implemented outcome controls;
- the actual scoped export generator, encrypted short-lived delivery and expiry evidence;
- staged account closure/deletion, session revocation, retention exceptions, tombstones and restore handling;
- completion/denial notifications, appeal/escalation handling and tested operations runbook;
- any additional objection, restriction or consent-withdrawal request types required by the approved launch jurisdictions;
- independently reviewed English and Simplified Chinese interface copy and legal publications.

A generic support email alone is not sufficient release evidence, and the new intake endpoint must not be presented as proof that a request was fulfilled.

## 5. Publication checklist

- Legal/business owner supplied all section decisions; no placeholder or synthetic wording remains.
- Chinese and English versions were reviewed independently, not auto-treated as equivalent.
- Deployed cookie/storage scan matches the Cookie Notice.
- Every public route returns the intended active publication and displays version/effective/review dates.
- Links work from public, student, school and CUAC operations footers.
- Application disclosure wording matches `school-handoff-v1`: students submit application materials directly through each school's official channel; CUAC does not collect or send those materials in this release.
- Rights-request happy path, denial path, identity recheck, export expiry, deletion retry and backup-restoration handling have staging evidence.
- Policy withdrawal fails closed and creates an operational alert.
- Release evidence binds policy publication revisions to the same application commit and deployment candidate.

## 6. Release decision

The new framework removes fake footer links, prevents draft text from masquerading as an approved policy and provides a controlled authenticated intake record. It does not make CUAC legally ready by itself. Production remains blocked until approved publications exist for both launch locales and the operational rights-request fulfilment workflow is implemented and tested end to end.
