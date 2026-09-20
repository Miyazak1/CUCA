# CUAC Legal Publication and Data-Rights Readiness

Status: technical publication framework, authenticated student request intake, password-based identity confirmation evidence, internal triage and outcome approval controls are implemented; approved legal wording and the operational fulfilment workflow remain release blockers.

The initial low-volume fulfilment model is the reviewed manual procedure in [CUAC_DATA_RIGHTS_MANUAL_FULFILMENT_RUNBOOK](../architecture/CUAC_DATA_RIGHTS_MANUAL_FULFILMENT_RUNBOOK.md). Automation is not required, but real execution, secure result communication and staging rehearsal are required.

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
| `/children-privacy.html` | `children_privacy_notice` | Privacy/legal owner + child-safeguarding reviewer |

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
7. Data-rights scope, identity-verification method, response owner, final approval of the provisional response target in `DATA_RIGHTS_RESPONSE_TARGET_V1_2026-09-20.md`, exception handling and appeal/escalation route.
8. Terms: service provider, eligibility, acceptable use, admissions disclaimer, suspension rules, intellectual-property position, liability position, governing law and dispute route.
9. Admissions-data correction owner, evidence standard, freshness targets, expiry/archival rules and school self-service responsibility.
10. Named preparer and independent approver for each locale and policy, with approval reference and next review date.

## 4. Rights-request operating model

The production workflow must cover access, correction, portable export, account closure/deletion, processing objection/restriction where applicable, and consent withdrawal where consent is actually used.

Required lifecycle:

1. The signed-in user creates a request from the account area. The server derives the user identity from the session; it never accepts another user ID from the browser.
2. The server assigns an immutable reference, request type, received timestamp and status. The initial request contains no uploaded identity document.
3. Every request must have a bounded identity-confirmation record before staff can claim it or prepare an outcome. Sensitive requests require that fresh password step during creation; access and correction require it before triage. Staff cannot use ordinary support impersonation to confirm or approve a request.
4. A privacy-authorized operations queue records assignment, scoped notes, deadlines and every status transition in the audit log.
5. Export generation uses a short-lived encrypted artifact and one-time retrieval authorization. It excludes internal security signals, other tenants and legally protected third-party data.
6. Deletion is a staged, idempotent job with an explicit retention-exception ledger. It revokes sessions first, prevents new work, erases or anonymizes eligible data, and records only the minimum completion evidence.
7. Backups expire under the approved schedule; they are not selectively rewritten. Restore procedures must reapply completed deletion tombstones before restored data can serve traffic.
8. The user receives status and completion notices through the verified account email. No raw personal data or download token appears in operational logs.

### Implemented intake boundary

The signed-in student account area now supports structured access, correction, portable-export and account-deletion requests. Identity is derived only from the authenticated session; browser-supplied ownership is rejected. Correction requests capture a bounded data area rather than unrestricted sensitive text. Export and deletion require fresh password reauthentication during creation. Access and correction remain unclaimable until the student completes a separate password reauthentication from the request list. Students can list their own requests and cancel an unclaimed request using its current revision.

The database enforces one active request of each type per account, explicit lifecycle states, terminal timestamps and bounded locale/type/scope values. Each create, confirmation and cancel operation is transactionally coupled to a metadata-only audit event. Identity evidence stores only the fixed password-step-up method, request revision and one-way subject/confirmation references; it stores no password, session token or identity document. Repository reads and mutations recheck the live active account and student role. If an account is later deleted, the direct user link is removed while one-way subject and confirmation references remain available for the future legally approved retention rule.

Phase B adds an internal least-privilege triage queue. A currently authorized CUAC operator can list only minimal request metadata. An unconfirmed request is visibly queued but cannot be claimed or used to prepare an outcome. After confirmation, an operator may claim it using its current revision and escalate an assigned investigation with one of four fixed reason codes and an opaque internal case reference. Claim and proposal SQL independently require matching one-way subject evidence. The claim is bound to the exact live staff grant; stale revisions, revoked grants and a different assignee fail closed.

Phase C adds an immutable, digest-bound **outcome plan**, not an execution command. Access and ordinary correction plans may be confirmed by the authorized operator who owns the case. A portable-export plan requires a `cuac_admin` session with fresh step-up authentication. An account-deletion plan, denial or retention exception requires a second, different stepped-up administrator; the proposer cannot approve their own plan. Fixed outcome/reason codes, exact request/review revisions, the current live staff grant and an opaque case reference are enforced again at the database boundary. Approval deliberately leaves the request in its existing operational state and creates no export, deletion, denial, notification or closure side effect. A student's own profile edits remain direct owner-scoped changes and never enter this staff approval workflow.

Phase D adds mandatory transition notices for request receipt, identity required, identity confirmed, review started, deadline extension and cancellation. Each business transition, metadata-only audit event, notification event and its in-app/email delivery rows commit atomically. Copy is fixed and independently registered for English and Simplified Chinese using the request's stored locale; it contains no request payload, identity evidence or internal case content. Extension copy includes only the fixed localized reason and new date. The in-app record is immediately unread and the email record is durably queued. Actual email transmission remains disabled until the approved `cuca.com` sender domain and protected staging credentials exist. This phase does not add completion, denial or appeal notices.

Phase E implements one bounded deadline extension. A currently granted `cuac_admin` must complete fresh password step-up, the request must already have confirmed identity and an active review, no outcome plan may exist, and approval must occur before the original response deadline. The new date must be later than the original deadline and no more than 60 days after it. Only one extension record is permitted; its original deadline is composite-bound to the request, and the fixed reason, opaque case reference, review revisions, approving live grant and timestamps are retained. The request revision, audit record and bilingual notice are committed in the same transaction.

Phase F adds five optional automatic reminder milestones without enabling external mail transmission. Students may receive fixed bilingual reminders after 24 hours and five days while identity is still unconfirmed. The active assigned reviewer may receive reminders three days before the internal target, six days before the effective response deadline and when that effective deadline is reached. The scheduler uses the database UTC clock, follows a valid extension, rechecks the current student/staff role and live grant, locks due work safely across concurrent workers, and writes the immutable reminder ledger in the same transaction as notification publication. Re-running the scheduler cannot create duplicate reminders. These reminders are an operational safeguard, not a legal prerequisite or launch gate. The day-25 identity escalation is intentionally absent until CUAC chooses to designate an escalation owner.

This is intake and triage, not a completed rights operation. The following remain release blockers:

- a named internal owner and backup for requests, legal review of the response policy, identity-confirmation exception handling and a tested operating procedure; a dedicated privacy officer, the provisional 15/30-day target, day-25 escalation and the automatic reminder worker are not launch prerequisites unless later legal review or processing scale requires them;
- a tested way to provide an appropriately scoped copy when required; controlled manual generation and secure delivery are acceptable for the initial low-volume release;
- a tested controlled account closure/deletion procedure, including session revocation and documented retention exceptions; it need not be an automatic deletion engine;
- a way to communicate completion or a reasoned refusal and available review path; reviewed manual email is acceptable until automated notices are justified by volume;
- any additional objection, restriction or consent-withdrawal request types required by the approved launch jurisdictions;
- independently reviewed English and Simplified Chinese interface copy and legal publications.

Because minors are an intended audience, under-14 onboarding follows the separate [guardian-consent contract](../architecture/CUAC_UNDER14_GUARDIAN_CONSENT_CONTRACT.md). The design does not require all 14–17-year-old students to obtain guardian consent and does not collect identity documents by default. The pending-registration state machine, exact-version binding, one-time consent, decline and expiry cleanup are implemented and pass disposable PostgreSQL rehearsal. Production activation remains blocked until independently approved bilingual children's notices are published, the `cuca.com` guardian email path passes protected staging acceptance, and the withdrawal procedure is rehearsed.

Review drafts now exist for the [Simplified Chinese children's rules](../legal-drafts/CHILDREN_PRIVACY_NOTICE_ZH-CN_DRAFT.md) and [English children's rules](../legal-drafts/CHILDREN_PRIVACY_NOTICE_EN_DRAFT.md). They deliberately retain visible publication blockers for the legal entity, hosting and processor facts, retention schedule and approved contacts. The [guardian withdrawal runbook](../architecture/CUAC_GUARDIAN_CONSENT_WITHDRAWAL_RUNBOOK.md) and [owner input checklist](CHILDREN_PRIVACY_OWNER_INPUT_CHECKLIST.md) define the operating roles and evidence required before either draft can be published.

The project owner has confirmed that the principal application servers are deployed in Hong Kong. This resolves only one hosting fact. Database, storage, backup, logging and email regions still require inventory evidence, and Mainland-to-Hong Kong flows must be assessed as cross-border processing before production. Hong Kong hosting does not identify the legal operator or remove the need for an accountable entity and privacy contact.

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
