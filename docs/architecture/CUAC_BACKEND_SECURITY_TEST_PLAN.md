# CUAC Backend Security Test Plan

Date: 2026-08-25

Status: initial security test plan for backend, Agent, payment, tenant isolation, and data governance.

Primary architecture baseline: `CUAC_SECURE_AGENT_BACKEND_ARCHITECTURE.md`

Agent data sandbox baseline: `CUAC_AGENT_DATA_SANDBOX_SPEC.md`

## 1. Purpose

This document defines the tests required before CUAC backend and Agent features can be considered production-ready.

Security tests are release gates, not optional QA.

## 2. Test Categories

### Authentication

Required tests:

- unauthenticated users cannot access student, school, Ops, payment, or Agent private endpoints;
- session cookies are secure, HTTP-only, same-site, and rotated after sign-in;
- school staff role cannot be obtained through self-registration alone;
- CUAC Ops/Admin role cannot be self-granted;
- expired sessions and revoked sessions are denied.

### Authorization And Object Ownership

Required tests:

- student A cannot read or mutate student B profile;
- student A cannot read or mutate student B saved items;
- student A cannot read or mutate student B application set;
- client-supplied `user_id` is ignored for ownership decisions;
- continuation tokens are single-use, expire, and re-run authorization after sign-in.
- one student's same-school program choices remain separate owner-scoped objects; direct IDs cannot merge, mutate or reuse evidence across projects or intakes.
- a school-level submission group, when introduced, cannot replace per-program ownership, authorization, snapshot, status or decision checks.

### School Tenant Isolation

Required tests:

- school staff can read only their own `school_applications`;
- school staff cannot access another tenant by direct ID;
- school staff queue never returns other schools selected by the student;
- school staff detail never returns full `application_set` data;
- school analytics are tenant-scoped;
- school export contains only tenant records;
- CUAC Ops cross-tenant access requires role and support reason.

### Payment Isolation

Required tests:

- billing unit, bundle, waiver and amount are resolved from a reviewed versioned server policy; tests must not assume one-school free or infer a price from the per-program application grain;
- fee preview and checkout require the authenticated student's exact complete active choice set; missing, duplicate, removed, foreign or incomplete choices fail as a whole rather than pricing a visible subset;
- client fee, coupon, provider metadata, return authority or paid flags cannot override server calculation/state;
- each v2 application-fee line binds exact user/set/choice/school/program/intake/route, amount, currency, fee code and pricing-basis digest;
- two projects at the same school receive separate application-fee lines and separate entitlements even if a later pricing policy bundles their amount;
- submission requires exact current entitlement for every project where policy requires it; a school-level paid flag, invoice status alone or client payment ID is insufficient;
- duplicate submit does not duplicate payment or school applications;
- payment webhook signature is verified;
- forged webhook is rejected;
- entitlement grant verifies and locks the exact settled invoice, v2 line, payment, success event and current choice; concurrent grants converge and audit failure rolls back;
- historical v1 lines are preserved without inferred target backfill and cannot grant entitlement; old writers fail after the migration fence;
- refund, expiry, revocation, target/route drift or invalid source evidence makes only the affected project's entitlement non-current;
- no public, school, Ops or Agent endpoint can grant/revoke entitlement;
- raw card, CVV, or bank fields are rejected if sent to CUAC APIs;
- payment payloads are redacted from logs;
- Agent cannot access payment credentials and can only query Billing Facade status tools.

### Agent Sandbox And Tool Gateway

Required tests:

- Agent cannot call unregistered tools;
- Agent cannot access database credentials;
- Agent cannot request arbitrary SQL;
- Agent cannot open arbitrary external URLs through navigation tools;
- Agent cannot pass model-generated tenant ID as authority;
- tool input schema validation rejects unknown fields and wrong types;
- tool output redaction removes prohibited fields;
- high-risk actions require confirmation;
- execute rechecks policy even after preview allowed;
- denied Agent actions write audit metadata.
- Agent cannot define metrics or scripts from natural language at runtime;
- school and Ops summaries must cite a registered tool, governed metric, or preapproved script source;
- Agent cannot change workflow state unless a registered backend action executes it.
- Agent cannot select or override `admission_route_key`, attach one project's policy/evidence to another project, or turn a school-level form into a merged application.

### Agent Data Sandbox

Required tests:

- every Agent request resolves active persona before retrieval;
- every Agent tool declares allowed data classes and projection type;
- tool output that exceeds persona data-class allowlist is rejected or redacted;
- guest retrieval cannot access student, tenant, payment, Ops, or memory data;
- student retrieval cannot access school tenant queue or other student records;
- school staff retrieval uses school-safe projections only;
- school staff retrieval cannot access raw `application_sets`;
- CUAC Ops retrieval over private cross-tenant data requires support reason and audit;
- cache keys include persona, context scope, user or tenant, and tool key;
- memory namespace changes on role or tenant switch;
- audit records active persona, projection type, data classes returned, and redactions applied.

### Prompt Injection

Required tests:

- malicious catalog text cannot change Agent system rules;
- malicious scholarship text cannot trigger a tool call;
- malicious student note cannot submit an application;
- malicious school note cannot export tenant data;
- retrieved text asking for secrets, prompts, or payment data is ignored;
- indirect prompt injection attempts are logged with redacted payloads.

### Retrieval And Vector Index

Required tests:

- public vector index contains only approved public catalog/help content;
- student PII is excluded from public index;
- payment data is excluded from all indexes;
- high-sensitive documents are excluded in MVP;
- scoped retrieval enforces user ownership;
- school retrieval enforces tenant membership;
- deletion or memory-clear removes scoped Agent memory where required.

### Agent Context Lifecycle

Required tests:

- logged-in users with multiple roles must select one active Agent persona;
- student persona cannot access school tenant tools or memory;
- school staff persona cannot access student private Agent memory;
- switching tenants starts or resumes a separate tenant-scoped context;
- CUAC Ops persona requires role/grant policy and support reason before private cross-tenant retrieval;
- guest page context is not stored as durable account memory;
- guest-to-registered carry-forward stores only selected candidates after sign-in;
- raw guest conversation text is not silently inherited after registration;
- candidate extraction rejects payment-sensitive, high-sensitive document, secret, and tenant-confidential fields;
- active pending candidates stop at 12 per verified guest browser binding and 24 per student account;
- two requests racing for one remaining owner-scoped candidate slot produce exactly one insert and one redacted 429;
- expired, accepted, cleared and other-owner candidates do not consume the current owner's active pending capacity;
- closing a guest page leaves no durable server-side memory;
- low-confidence inferred interests are not stored without confirmation;
- confirmed student memory stores structured summaries, not full raw transcripts;
- student memory is never available in school staff context;
- school tenant memory is never available in student context;
- memory clear removes or marks scoped memory as cleared while preserving required audit metadata.

### Per-Program Application And Route Isolation

Required tests:

- every formal target is identified by student + choice + school + program + intake; school alone is never an application key;
- two projects at the same school keep independent choice, route, requirement snapshot, disclosure authorization, material snapshot, application-fee line/entitlement, Program Application, timeline and outcome;
- changing one choice route advances only the owning set revision and cannot rewrite another choice or historical evidence;
- existing choices remain route-null after migration; no school, catalog, scholarship, Agent or demo data can backfill or infer a route;
- non-null route writes require the exact current active reviewed `program + intake + route` policy and fail closed after withdrawal or corruption;
- preflight ignores route headers, rejects route query parameters and reads only the persisted choice route;
- a valid exact policy removes only its policy blocker; a valid exact current entitlement removes only its Billing blocker; submit remains blocked and `canSubmit=false`;
- each `0030` Official Submission Group enforces policy member count/order while preserving every Program Application's own authorization, snapshot, status and result; pending transport never changes project outcomes.

### Agent Expression Boundary

Required tests:

- student Agent recommendations do not claim guaranteed admission or final eligibility;
- school Agent applicant summaries come only from school-safe projections;
- school Agent cannot summarize hidden other-school choices;
- school Agent cannot mark contacted unless the registered status action passes policy and confirmation;
- CUAC Ops Agent cannot run arbitrary SQL for "quick analysis";
- CUAC Ops Agent cannot override routing, payment, tenant, or account state from generated text;
- Agent answer for unavailable metrics says the metric is not available instead of inventing one;
- prompt-injected notes cannot convince Agent to create new metrics, bypass scripts, or treat model output as authoritative state.

### Logging And Audit

Required tests:

- general logs do not contain passwords, tokens, secrets, card data, CVV, raw provider payloads, or high-sensitive document data;
- audit logs are append-only from normal app paths;
- application submit writes audit;
- school export writes audit;
- status update writes audit;
- payment state transition writes audit;
- Ops support lookup writes audit with reason;
- Agent high-risk execute writes audit.

### Data Governance

Required tests:

- stale source records are marked stale by freshness job;
- pending catalog records are not presented as verified;
- Agent includes caveat for stale/pending data;
- source evidence is stored for verified catalog records;
- student-facing APIs do not expose internal quality score or Ops notes.

### Rate Limits And Abuse

Required tests:

- auth endpoints are rate-limited;
- Agent message endpoint is rate-limited by user/session/IP;
- search endpoint has reasonable abuse protection;
- export jobs have role and rate limits;
- payment intent creation has replay/idempotency controls.

## 3. Release Gates By Phase

### Phase 1 Gate

- authentication tests pass;
- catalog public/private separation tests pass;
- audit writer tests pass;
- log redaction tests pass.

### Phase 2 Gate

- student ownership tests pass;
- continuation-token tests pass;
- application draft mutation tests pass;
- consent tests pass.

### Phase 3 Gate

- payment isolation tests pass;
- submit idempotency tests pass;
- school application creation tests pass.

### Phase 4 Gate

- tenant isolation tests pass;
- school export tests pass;
- school status audit tests pass.

### Phase 5 Gate

- Agent sandbox tests pass;
- Tool Gateway tests pass;
- prompt injection tests pass;
- retrieval scope tests pass.

### Launch Gate

- all phase gates pass;
- dependency and secret scans pass;
- backup restore test passes;
- incident runbook tabletop completed;
- privacy/consent review completed;
- payment provider integration reviewed for PCI scope.

## 4. Test Data Requirements

Use fixtures that include:

- at least two students;
- at least two schools;
- at least two school staff users with separate tenants;
- one CUAC Ops user;
- application set with choices across multiple schools;
- paid, unpaid, failed, refunded payment states;
- malicious prompt-injection content in catalog, student note, and school note;
- stale, pending, verified, and disputed catalog records.

## 5. Completion Rule

Local PostgreSQL gate added on 2026-09-01: `npm run db:pg:rehearse`, separate from `test:server`, uses a disposable loopback-only database and synthetic data. Its current result is 379/379 across 33 migrations/replay, identity and tenant isolation, Auth/Agent transactions, pending-candidate concurrency, application drafts, governed requirements/notices, material preparation, exact per-program disclosure authorization, immutable encrypted snapshots, route-explicit official-submission policy governance and internal atomic acceptance. Same-school projects remain independent throughout. See [the executable rehearsal evidence](CUAC_POSTGRES_REHEARSAL_REPORT.md).

Local HTTP gate added: `npm run db:http:rehearse` builds the current API and passes 477/477, including 378 database subtests, 98 real-network/lifecycle subtests and the parent. It covers guarded Auth/student routes, cross-origin/malformed input rejection, private response headers, Agent browser-scoped candidate capacity and redacted 429 behavior, application/material workflows, authorization GET/POST/DELETE, encrypted material-snapshot GET/POST, real lock contention, concurrent exact requests and audit-failure rollback. Policy support intentionally adds no HTTP route. Current regular server coverage is 523/523. See the [HTTP security and guest-session contract](CUAC_HTTP_SECURITY_AND_GUEST_SESSION_CONTRACT.md), [candidate capacity contract](CUAC_AGENT_CANDIDATE_CAPACITY_CONTRACT.md), [authorization contract](CUAC_APPLICATION_SUBMISSION_AUTHORIZATION_CONTRACT.md), [material-snapshot contract](CUAC_APPLICATION_MATERIAL_SNAPSHOT_CONTRACT.md) and [application lifecycle contract](CUAC_APPLICATION_LIFECYCLE_CONTRACT.md).

Current Auth/student/context input contracts and transactional audit are locally verified. Agent memory management, opt-out, cutoff, source erasure, bounded candidate sweeping and owner-scoped pending-candidate capacity now have real PostgreSQL evidence, plus HTTP verification that persistence honors the setting and quota denial is redacted. See [management contract](CUAC_AGENT_MEMORY_MANAGEMENT_CONTRACT.md) and [candidate capacity contract](CUAC_AGENT_CANDIDATE_CAPACITY_CONTRACT.md). Open: public controls/UX, scheduling, Gateway/WAF abuse controls, remaining command idempotency, real-provider delivery and other external-effect outboxes, credential controls, browser/cloud and broader identity/revocation races. Stateless guest rotation cannot revoke copied tokens; closing a page is not deletion. Current-record erasure is not backup/WAL removal. Local passing tests are not production acceptance.

A backend feature is not complete unless its security tests are merged with it.

BE-0713 local gate verifies immutable history, generation, pre-connect rejection and SQL/ORM parity at the current 58 tables, 864 columns, 310 constraints and 210 indexes. Additional regular and database tests verify exact live-ledger prefix/hash checks, advisory/table locking, native-ledger nonempty sample upgrade, competing jobs, SQL/final-check rollback, first-run metadata rollback, real owned-connection termination and simulated lost acknowledgement after real COMMIT. See [schema baseline contract](CUAC_POSTGRES_SCHEMA_BASELINE_CONTRACT.md). Production ACLs, protected deployment records, domain-data upgrades and RDS backup/restore/failover remain release gates.

BE-0713 release gate: three regular tests verify the locked dependency closure, portable/script-free packages, reproducibility, detached execution and zero TCP connections for tampered code/dependencies/plan/manifest or invalid runtime/environment inputs. Nineteen database subtests run the same packaged digest outside the checkout for full migration, nonempty prior-schema upgrade/replay and divergent-ledger refusal, including populated revision, intake/old-v1-receipt, applicant, education, requirements, review-governance, assessment, notice, target, memory-control and through-0025 official-policy upgrades. Earlier upgrades compare every existing public table and confirm no identity/attainment or approved rules are inferred from account/preferences or legacy catalog text. The latest upgrade preserves Auth, catalog, application, authorization and encrypted snapshot data while leaving all three policy tables empty; it creates no default route or group. Self-verification does not authenticate a modified bootstrap; the external trusted launcher is separately exercised by the Linux gate below. See [release artifact contract](CUAC_POSTGRES_RELEASE_ARTIFACT_CONTRACT.md).

BE-0713 Linux gate: `npm run db:linux:rehearse` passes six scenarios plus the parent (7/7), separately from the other test counts. It checks actual UID/capabilities/no-new-privileges, denied rootfs/package/launcher writes, no mounts/socket/default IPv4 route, resource settings, internal/isolated network and database-only loopback control network. The same package verifies with no network, applies/replays under a non-superuser role, and exits 143 (not OOM) when stopped during real lock contention; ledger/table state proves no partial upgrade before explicit retry. A replaced package bootstrap is rejected by the trusted image launcher before its marker executes. CI/signatures, patch baseline, native Linux/cloud enforcement, protected digest/secret delivery, DNS/host escape assessment, RDS ACL/TLS/restore and full application process shutdown remain open. See [Linux runtime contract](CUAC_POSTGRES_LINUX_RUNTIME_CONTRACT.md); never treat a container as a substitute for Agent role/tenant/projection policy.

BE-0714 local gate now passes: eight database cases inject connection loss, exhaustion, timeouts, lost COMMIT acknowledgement and cooperative pool shutdown. Seven built-API network cases prove process survival/readiness recovery plus actual pool close, signal drain, post-disconnect work tracking and deadline rollback. A separate 3/3 Linux gate sends real SIGTERM. Client timeout is not immediate server cancellation; server deadlines and final database state are checked separately. Remaining: independent liveness, monitoring, trusted cloud process/LB behavior, actual TLS/limits and RDS/proxy/failover. See [application transport](CUAC_POSTGRES_APPLICATION_TRANSPORT_CONTRACT.md) and [lifecycle](CUAC_APPLICATION_LIFECYCLE_CONTRACT.md) contracts. Never infer that rollback or pool recovery authorizes automatic write retries.

BE-0715 initial freeze gate passed three regular, eight real PostgreSQL and two HTTP subtests: deny new writes to non-draft or timestamp-frozen sets; preserve owner isolation and original-key recovery; exercise both freeze/add lock orders, commit/rollback and audit failure. Same-school programs retain independent choice/receipt relationships. The school record shape is tested with synthetic SQL fixtures, not a live submit service. BE-0716 must test per-program consent/snapshots, intake availability, version changes, fee entitlements and atomic submit/outbox before enabling submission. See [per-program contract](CUAC_APPLICATION_SUBMISSION_BACKEND_CONTRACT.md).

BE-0712 partial gate: required application set/choice HTTP keys, account/operation-scoped digests, same-transaction receipts/business/audit, real unique-key lock waits, first-attempt rollback, simulated lost COMMIT acknowledgement and actual downstream HTTP disconnect pass locally. Replay reloads the owner's current resource and cannot recreate deleted resources. See [application idempotency contract](CUAC_APPLICATION_IDEMPOTENCY_CONTRACT.md). Auth/invitation/Agent recovery, receipt quotas/retention, broader session-revocation races, browser pending-intent handling and cloud failover/restore remain separate gates.

BE-0715 editing/ordering gate adds ten regular tests, sixteen real database cases, one populated-upgrade case and four real HTTP cases. Required expectedRevision protects notes/scholarship PATCH and complete-order PUT against stale/ABA changes and concurrent additions/removals. Tests verify exact active membership, owner/current-role/freeze/school-receipt checks, no-op behavior, metadata-only audit, all-row rollback, uncertain COMMIT and revision bounds. Actual add/remove/edit/order mutations advance the same parent revision; original POST receipt recovery and fixed-target DELETE confirmation do not. These versions do not cover catalog, billing, global applicant profile or consent changes, which submission must recheck separately. Migration 0012 must precede deployment; drain all non-revision writers before enabling the new endpoints. Mixed-version rollout and cloud rollback remain staging acceptance gates, not locally proven deployment behavior.

Domain-input evidence: partial/concurrent profile patches, catalog/scholarship scope, Auth DTOs and study_goal grammar pass locally. Agent confirmation and memory management now have transaction, concurrency and fault-injection coverage. Public management UX/API, retention/scheduling, broader revocation and full Agent rollout remain separate acceptance gates.

Manual QA can supplement these tests, but it cannot replace automated policy, tenant, payment, Agent, and log-redaction checks.

BE-0716 intake gate: nine new regular tests, eleven real-database cases, one pre-intake populated upgrade and four real-network cases pass. They cover public-only paginated discovery, active parent scope, strict input, composite intake/program constraints, distinct versus repeated targets, legacy null targets and independently constructed v1 receipt recovery, v2 same-key mismatch, actual concurrent creates, both intake-closure lock orders, audit/receipt/revision rollback and lost COMMIT acknowledgement. The initial HTTP whitelist omission was reproduced and fixed with a shared allowlist plus entry-level regression. Formal school limits, across-set submission duplicates, verified intake windows, consent, applicant snapshots and preflight remain separate requirements. See [intake contract](CUAC_APPLICATION_INTAKE_CONTRACT.md).

BE-0716 applicant gate: seven regular cases, twelve real-database cases, one nonempty-release upgrade and four actual HTTP cases verify explicit applicant basics, field/authority rejection, owner-only reads, current account/role locks, first-create and same-revision concurrency, no-op/ABA, revocation in both lock orders, audit rollback, ambiguous COMMIT re-read, database constraints and revision exhaustion. Shared rollback snapshots include the new table. The 14-migration upgrade compares every old public table and leaves the new table empty; no nickname/email/memory copying. Formal consent, per-program snapshots and submit remain pending. Multiple education records are now verified by the following separate gate. See [applicant contract](CUAC_APPLICANT_PROFILE_AND_CONSENT_CONTRACT.md).


BE-0716 education gate: seven regular tests, fourteen real-database cases, one 15-migration populated upgrade and five actual HTTP cases verify owner-only multiple experiences, independent collection revision, strict fields, merged chronology/attendance validation, active capacity and no automatic attainment inference. Real lock barriers prove first-create, cross-record mixed mutations and last-slot competition; account/role revocation is tested in both orders. Metadata-only audit failures roll back records/header/revision/erasure, uncertain COMMIT requires re-read, old IDs cannot mutate replacement records, removed fields are all null, no-op/stale/ABA and revision exhaustion behave explicitly. Upgrade compares every old public table and leaves both new tables empty. Shared rollback snapshots covered 22 tables at that stage; the later governance stage covered 24 and the assessment extension covered 26; the notice extension covered 29 and the current material-selection extension covers 30. No consent, score verification, school/Agent disclosure or submission is authorized. See [education contract](CUAC_EDUCATION_HISTORY_CONTRACT.md).

BE-0716 initial requirements read gate: seven regular tests, eight real-database cases, one 16-migration populated upgrade and three actual HTTP cases verified exact scope, explicit publication pointers, no fallback, database time windows, strict 11-field DTO/digest, consistent reads and schema constraints. The initial stage used synthetic SQL fixtures, not a governed writer; its historical evidence is retained. The current evidence gate and internal service are described below. Fixed information_only and coverage=complete still never assert eligibility.

BE-0716 internal requirements governance gate adds seven regular tests, sixteen real-database cases, one 17-migration populated upgrade and one real-network case. Tests enforce explicit session/step_up and catalog_management authority, current live user/role checks, distinct preparer/reviewer, exact source/content/time binding, strict payloads, bounded version reads, stable-ID draft recovery, publication CAS/no rollback/no resurrection, retired-scope emergency withdrawal and version exhaustion. Actual concurrent writers and account/role locks cover both revoke/write orders; publish checks database wall time after target-lock waits. All four audit-failure cases assert the deliberate PostgreSQL trigger error and unchanged state; shared rollback snapshots covered 24 tables at this stage. Actual COMMIT followed by lost acknowledgement is recovered by stable ID or reads, not automatic retries. The network case prepares/approves/publishes internally, checks the public GET, tampers review binding to force redacted 503, then withdraws; POST cannot activate an Ops writer. Source authenticity, real employee/MFA/transport admission, production DB ACLs and source-fetch SSRF controls remain gates. See [governance contract](CUAC_PROGRAM_REQUIREMENT_GOVERNANCE_CONTRACT.md).

BE-0716 assessment gate adds ten regular tests, seventeen real-database cases, one 18-migration populated upgrade and six actual HTTP cases. They verify independent collection versions, raw score text and explicit scales, report status/form, real civil dates, bounded payloads and merged updates; no numeric conversion, GPA or official verification is inferred. Only a live owner with explicit student_action and session/step_up authority can use the module. Database cases exercise both account/role revoke/write lock orders for all three mutations, exact deliberate P0001 audit failures, first-create/mixed-write/last-slot concurrency, canonical JSONB no-op, stale/ABA/exhausted versions, full field erasure and fixed target IDs, lost COMMIT acknowledgement, timezone-independent dates and fail-closed damaged reads. Shared rollback snapshots covered 26 tables at that stage. HTTP cases check real routes, strict origin/identity/input boundaries, concurrency, audit rollback, in-flight revocation and corrupt-read recovery through explicit removal. No school/Agent disclosure, consent or formal submission is authorized. See [assessment contract](CUAC_ASSESSMENT_RECORDS_CONTRACT.md).

BE-0716 notice gate adds twelve regular tests, nineteen real-database cases, one 19-migration populated upgrade and four actual HTTP cases. It enforces exact purpose/locale, strict plain-text documents, distinct preparer/reviewer, live account/role authority and admin step-up for approval/publication/withdrawal. Public reads bind both content and full review digests and never fall back across language, version, withdrawal or expiry. All four mutations have both revoke/write lock orders and deliberate P0001 audit failures with an unchanged 29-table snapshot; first-scope creation is included. Repeated real first-create races reproduced a secondary unique-index 23505: scope insertion now arbitrates all equivalent checked unique identities before scope locking; eight rounds per run cover first creation and repeated UUIDs, without automatic transaction retry. CAS competition, post-wait database time, actual COMMIT acknowledgement loss and distinct-body old/new snapshot reads pass. HTTP cases cover nine-field guest/account projection, no writes or query overrides, corrupt-review rejection and actual publish/withdraw rollback. No real legal text, student consent, employee MFA issuer, private-data Agent access or submission is enabled. See [notice contract](CUAC_NOTICE_PUBLICATION_CONTRACT.md).

BE-0716 single-choice preflight gate adds ten regular, twelve real-database and four real-network cases with no migration. Tests cover strict locale/UUID/query and persona/class boundaries, exact owner/parent/choice, same-school programs and separate intakes, absent/frozen/removed targets, actual window and scholarship scope/deadline changes, existing local application records, minimal profile presence and collection revisions/counts, and corrupt publication/oversized inventory failure. A real read-only transaction rejects a deliberate UPDATE with 25006; later writes still work, proving session defaults were not changed. Paused inter-query reads observe the complete old profile/requirement/notice state while actual writers commit successors; the next request sees new versions. Publication expiry is checked against the same database snapshot clock, never a client clock. HTTP exercises current role revocation, headers, no Cookie/write methods and redacted 503; 29-table snapshots remain unchanged on reads. Initial bad-data fixtures conflicted with existing cascade/CHECK constraints and were corrected without relaxing them. The report is not permission to submit or share material. See [preflight contract](CUAC_APPLICATION_PREFLIGHT_CONTRACT.md).

BE-0716 target-identity gate adds ten business database cases, four detached-release upgrade cases and three actual HTTP cases. An initial real insert reproduced same-school program mismatch. Non-null generated target keys now enforce the exact choice program/intake tuple, including null; direct generated-column writes, one-sided changes and referenced project deletion are rejected. Four real FK lock orders cover application-first/choice-first with commit/rollback. Populated 0019 upgrades preserve every preexisting column and receipt, copy only known choice intakes and reject three legacy mismatch shapes without schema/data/ledger changes. Frozen old-field readers preserve prior upgrade assertions while checking newly introduced columns separately. HTTP retains tenant/persona/membership enforcement, identical foreign/missing null responses and per-project state/events, and never exposes generated keys or student draft notes. No submit, school write method or Agent tool is added. See [target identity contract](CUAC_APPLICATION_TARGET_IDENTITY_CONTRACT.md).


BE-0716 material-preview gate adds nine regular, twelve database and five real-network cases. Explicit basic-field and record-ID selections are bounded, normalized and never default to all; four source versions must match. SQL checks live student authority, exact owner/parent/choice and selected record ownership, then projects only chosen contents in one READ ONLY / REPEATABLE READ snapshot. Tests prove original scores/dates, distinct project/intake digests, stale-version rejection, actual inter-query updates/deletion, deliberate 25006 write refusal, corrupt/oversized data rejection and unchanged public-table snapshots. HTTP covers no-store/no Cookie, Origin/Fetch Metadata/media/body/query/path guards, role revocation and no other explicit methods. No migration, preview persistence, consent, school receipt or Agent access is added. See [material preview contract](CUAC_APPLICATION_MATERIAL_PREVIEW_CONTRACT.md).

Per-choice selection gate (2026-09-01): Owner-only per-choice material selection drafts are now locally verified: migration 0022 stores only explicit field/record references, four source versions and an independent CAS revision. Clearing preserves the revision; source changes/removal require explicit review; choice removal atomically deletes the associated selection. Six regular, fifteen business-database, one populated-upgrade and six real-network cases cover isolation, races, audit rollback and corruption rejection. This is not consent or a material snapshot and grants no Agent/school access. See [material selection contract](CUAC_APPLICATION_MATERIAL_SELECTION_CONTRACT.md). Selection deletion is the only hard DELETE allowed within choice removal; the choice itself remains a scrubbed tombstone. Snapshot fault assertions now include all 31 audited business tables, including encrypted auth email jobs. Final evidence: [rehearsal](CUAC_POSTGRES_REHEARSAL_REPORT.md).

## Per-Program Disclosure Authorization Gate (BE-0716)

Migration `0024` and the owner-only authorization GET/POST/DELETE are locally verified. Tests bind one authorization to one user, choice, school, program and intake; compare the exact material selection revision, four source versions, canonical selection/content digests and current reviewed notice evidence; and prove same-school projects cannot share rows or freshness. Original-key replay, changed-input conflict, same-scope reuse, supersede, withdrawal, late withdrawal, role revocation, window/notice/source changes, existing school receipt, account-lock ordering, concurrent convergence, audit rollback and choice-removal cleanup all fail closed. Preflight exposes only `{id,status,confirmedAt,current}` and never removes the other four platform blockers. No Agent, school, Billing or public reader has authorization-table access. Current evidence is 476 regular, 341 PostgreSQL, 433 built HTTP and 7 Linux migration tests; these entry points overlap and are not cloud or legal acceptance.

## Per-Program Material Snapshot Gate (BE-0716)

Migration `0025` and the owner-only snapshot GET/POST are locally verified. Tests prove one authorization can create at most one immutable AES-256-GCM envelope bound through authenticated data and composite foreign keys to the exact user/set/choice/school/program/intake. No material/selection plaintext column exists. Wrong owner/parent/target, stale authorization/digests, removed/frozen choice, closed window, unsupported method/query/body/origin and missing idempotency key fail before persistence. Original-key replay and different-key concurrency converge to one snapshot; deliberate audit failure rolls back both ciphertext and receipt. Swapped/tampered envelope, missing key and malformed payload fail closed with no plaintext in error, log, API or preflight. Built-network rehearsal uses a real account lock barrier and confirms two overlapping POSTs return the same snapshot. Preflight exposes only `{id,authorizationId,capturedAt,current}` and retains official-policy, Billing and submit blockers. No school, Ops, Agent, Billing, vector-index or public snapshot reader exists. Current combined evidence is 493 regular, 356 PostgreSQL, 452 built HTTP and 7 Linux migration tests; these entry points overlap and are not KMS, RDS, cloud, browser or legal acceptance.

## Official Submission Policy And Choice Route Slice A/B Gate

Migration `0026`, internal governance and the minimal published-policy reader are locally verified. Tests require an explicit route, exact school/program/intake target, immutable canonical document and target digests, distinct preparer/reviewer, current role checks, admin step-up for approval/publication/withdrawal, revision CAS and atomic audit. Concurrent drafts, approvals and publications converge or conflict explicitly; malformed rule documents, cross-target references, stale revisions and tampered rule/target/review/publication digests fail closed. A populated through-0025 upgrade preserves all old rows, leaves policy tables empty and infers no policy from catalog/demo/application data.

Migration `0027`, route-aware choice writes and policy-aware preflight are also locally verified. Tests prove all through-0026 values survive upgrade while every old choice route remains null; no school/catalog/scholarship/Agent/demo inference occurs. Non-null create/edit requires the exact current active reviewed target policy, route changes advance the set revision and invalidate old preparation evidence, and clear restores the route blocker. Real HTTP proves route headers are ignored, route query parameters are rejected, failed policy checks do not mutate, and only the persisted route controls preflight. A valid policy removes only `OFFICIAL_SUBMISSION_POLICY_UNAVAILABLE`; Billing and submit blockers remain and `canSubmit=false`. The 0027 milestone evidence was 498/498 regular, 362/362 PostgreSQL, 459/459 built HTTP and 7/7 Linux migration tests.

## Policy-Bound Authorization v2 Gate

Migration `0028` and the route/policy-aware authorization, snapshot and preflight services are locally verified. New authorization digests bind exact student/set/choice/school/program/intake, stored route, current policy version/publication revision and server-only document/target-set/approval digests, plus existing material and notice evidence. Tests prove same-school sibling programs cannot share authorization; route changes, policy withdrawal/republication or digest changes make evidence stale; v1 is readable but never current; and v1/partial authorization cannot create a new snapshot. A real PostgreSQL lock race proves policy withdrawal waits while authorization holds publication/version/selected-target share locks through commit.

The populated through-0027 upgrade preserves v1 authorization and encrypted snapshot bytes without inferred backfill, rejects an old writer after the migration fence, and creates v2/new snapshot only after explicit reauthorization. Database negative tests reject null/partial v2 policy bindings and wrong targets. Built HTTP rejects forged approval fields, route/version mismatches, other users and unsupported surfaces, while excluding target-set/approval/review evidence from student DTOs and errors. Audit-failure and concurrent-idempotency paths remain atomic. At the sealed 0028 slice, full evidence was 499/499 regular, 366/366 PostgreSQL, 463/463 built HTTP and 7/7 Linux migration tests; there was no Billing entitlement at that historical checkpoint.

## Per-Project Billing Entitlement Gate

Migration `0029`, the hardened Billing repository/facade, internal entitlement service and preflight projection are locally verified. New v2 application-fee lines bind exact `user + set + choice + school + program + intake + route`, amount, currency, fee code and pricing-basis digest; service-fee lines cannot become application entitlements. The requested choice IDs must equal the complete current active set, so owner-visible subsets, duplicates, missing routes and cross-user choices fail closed. Same-school sibling programs create two distinct lines and two distinct entitlements.

The internal grant path requires step-up Billing authority and atomically locks/validates the exact settled invoice, line, payment, succeeded status event and current choice before writing entitlement plus audit. Concurrency converges on one record; audit failure rolls back. Route change invalidates only that project's currentness, refund invalidates payment-backed currentness, and the student preflight projection is limited to `{id,status,grantedAt,expiresAt,current}`. A current entitlement removes only `BILLING_ENTITLEMENT_UNAVAILABLE`; `SUBMISSION_UNAVAILABLE` remains and `canSubmit=false`. No invoice/payment/event/provider IDs, amounts, pricing digests or grant controls are exposed.

The populated through-0028 upgrade preserves historical invoice lines as v1 with all exact identity fields null, creates no entitlement, rejects the old implicit writer, supports explicit new v2 lines and replays as no-op. Database negative tests reject partial v2 and cross-project evidence. At the sealed D1 checkpoint, evidence was 508/508 regular, 370/370 PostgreSQL, 467/467 built HTTP and 7/7 Linux migration tests; schema was 30 migrations, 21 snapshots and 54 tables. There was no public/Ops entitlement grant or live provider/refund workflow. See [the entitlement contract](CUAC_APPLICATION_BILLING_ENTITLEMENT_CONTRACT.md).

## Atomic Program Application And Transport Group Gate

Migration `0030` and the internal-only `application.submit` service are locally verified. The command requires current active student authority, student action/surface, step-up, exact data classes, one owned draft set, its expected revision, its complete active choice IDs and explicit confirmation. Every project is revalidated against its exact program/intake/route, current requirements and notice, v2 policy-bound authorization, authenticated immutable snapshot and current fee entitlement before any accepted record is written.

Tests prove that two same-school projects under `one_program_per_form` create two Program Applications and two groups, while `multi_program_form` creates two Program Applications and one ordered group. One group member cannot borrow a sibling project's authorization, snapshot or entitlement. Same-key races create one complete submission and one replay; changed-input key reuse, a new-key repeat, missing members, stale revision, policy/requirements/notice/payment/snapshot changes and damaged evidence fail closed. Audit failure rolls back the submission, Program Applications, groups, members, inert outbox, status changes and receipt as one transaction.

The through-0029 populated upgrade preserves every historical Program Application as v1, infers no evidence and creates no submission/group/outbox; the old writer fails after the default changes to v2. Current full evidence is 523/523 regular, 477/477 PostgreSQL plus built HTTP and 7/7 Linux migration tests; schema is 33 migrations, 24 snapshots and 58 tables. The current chain enforces 365-day finite confirmed-student-memory retention, bounded tenant-safe scrubbing and 12/24 owner-scoped active pending-candidate capacity, but exposes no scheduler or Agent maintenance tool. There is no public submit route, outbox worker, provider adapter, live payment/refund, school write API or Ops repair API. The `pending` outbox is not delivery evidence. See [the atomic submission contract](CUAC_ATOMIC_APPLICATION_SUBMISSION_CONTRACT.md), [candidate capacity contract](CUAC_AGENT_CANDIDATE_CAPACITY_CONTRACT.md), [memory retention contract](CUAC_AGENT_MEMORY_RETENTION_CONTRACT.md) and [local development runbook](CUAC_LOCAL_DEVELOPMENT_RUNBOOK.md).

## Auth Email Outbox Gate (BE-0718)

Auth verification/reset outbox is locally verified (BE-0718): migration 0023 adds encrypted short-lived token transport, owner-bound challenge FKs, committed-job leases, pre-send identity checks, bounded explicit-nonacceptance retries and uncertain-result quarantine. Challenge/enqueue/success audit share one transaction; terminal jobs erase ciphertext. Nineteen business-database cases, one nonempty upgrade and seven regular cases cover tampering, missing keys, rollback, concurrency, expiry and lost acknowledgements. This is not provider acceptance of real mail: the runtime remains deferred unless explicitly configured; no provider, scheduler, frontend action page or Agent access is enabled. See [auth email outbox contract](CUAC_AUTH_EMAIL_OUTBOX_CONTRACT.md).

The existing 88 network/lifecycle cases remain regression coverage; no new public worker route was added. Credential factory/handler checks with an explicitly injected cipher run against real PostgreSQL. Synthetic provider acceptance is not evidence of real mailbox delivery. Production gate: approved keys/provider plus reviewed action pages, bounded worker supervision/recovery scheduling, queue capacity, bounce/complaint controls and independent transport tests.

## Offline Readiness Gate (BE-0719)

2026-09-01: 25 focused readiness/template cases pass and are included in the current 458 regular server tests (14 additions). Tests first reproduced arbitrary-provider false positives and success exit codes for a required failing gate. Coverage includes all three environments, unimplemented email/checkout/webhook/upload integrations despite plausible settings, malformed feature flags, unknown environments, development-as-deployment rejection, real bounded CLI subprocess exits and no secret/config-value echo. The report always declares offline scope and `runtimeVerified=false`; staging/production default to a hard gate, while explicit advisory output is never deployment approval.

Both Alibaba templates leave email/payments/uploads disabled and hard gates enabled. No new business API, database migration, frontend or real-provider effect was introduced. TypeScript, backend ESLint and offline schema checks pass; the prior 330 PG / 418 combined HTTP / 7 Linux migration results were not rerun in this batch. True runtime delivery, cloud controls, trusted CI wiring and full product acceptance remain open. See [readiness contract](CUAC_PRODUCTION_READINESS_CONTRACT.md).

## Password Runtime and Upgrade Gate (BE-0710, Partial)

2026-09-01: async native scrypt replaces synchronous password work in registration, login and reset. New writes use the exact `scrypt$v2$32768$8$3$...` profile; canonical legacy records remain readable. Every login holds one shared operation slot across legacy and v2 derivations, while unknown/inactive/hashless/malformed identities run both fixed profiles before generic denial. This reduces obvious work-factor timing differences but is not a full constant-time or enumeration guarantee. A valid legacy proof creates an upgrade candidate only after both phases.

Current evidence: 470/470 regular, 335/335 PG (334 subtests plus parent), 424/424 built HTTP joint (same 334 DB plus 89 network/lifecycle plus parent), TypeScript, backend ESLint and offline schema pass. Real PostgreSQL proves legacy upgrade/session/success-audit atomicity, reset winning against a pending upgrade, one winner between competing legacy proofs, and audit-failure rollback. Built HTTP proves storage upgrade and response secrecy. No schema/migration, public API or frontend changes. Native work remains bounded until completion even if a caller stops waiting; process limits do not replace shared gateway limits, memory/CPU budgeting or lifecycle deadlines. Temporary HTTP/PG resources are cleaned up. The migration artifact remains b0cb03ce60af3a56dc1f4d84e6d1d9315dafff327371a92bd50cfdf8dfce4455; independent Linux checks were not rerun in this batch.

Legacy N=16384/r=8/p=1 remains read-only compatibility; current writes use N=32768/r=8/p=3. Production still needs ECS capacity/latency/overload evidence, breached/common-password screening, MFA, broader side-channel assessment, cloud Gateway/WAF and a drained whole-fleet rollout because old binaries cannot read v2. Never mark all BE-0710 complete merely because this local gate passes. See [password runtime contract](CUAC_AUTH_PASSWORD_RUNTIME_CONTRACT.md).
