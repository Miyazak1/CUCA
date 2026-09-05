# CUAC Frontend Completion Audit

Date: 2026-08-17

Status: updated frontend completion audit after route-contract, completion-page, school-portal, Agent context, and sign-in continuation passes.

## 1. Purpose

This audit identifies what the current CUAC frontend demo still lacks as a full product experience. The basic route inventory now exists, so the goal is to close the highest-value experience loops, keep CSCAlite-compatible fields readable for students and schools, and prepare the frontend contract for real backend/API integration.

## 2. Current Strengths

Already present:

- public discovery pages: Home, Programs, Universities, Scholarships, Cities, Guides;
- student workspace pages: Auth, Onboarding, Hub, Favourites, Application, Notifications, Preferences;
- completion/detail pages: Program detail, University detail, Scholarship detail, City detail, Guide detail, Billing, School settings, Ops admin;
- school staff pages: School Portal and School Settings;
- shared header/footer and global Agent shell;
- application handoff demo from student submission to school portal;
- school tenant scope copy and locked school view;
- pagination on Programs and Universities;
- school analytics cards and loading animation;
- school teacher operations summary with owner workload, next-action queue, export scope, and document-request template preview;
- school settings workspace with staff seats, owner routing, editable document-request template, response targets, and tenant-locked save feedback;
- Ops admin workspace with catalog quality, routing retry, payment reconciliation, support lookup, risk monitor, and local audit-trail feedback;
- route contracts and `data-agent-mode` alignment;
- CSCAlite-backed field mapping for schools, programs, scholarships, and cities;
- Agent action registry with surface, role, route, auth, risk, and confirmation checks;
- guest vs signed-in Agent context retention policy;
- shared Agent prompt handling now attaches structured context from the current page and source element, including route, agent mode, auth state, role, surface, retention policy, entity type, entity ID, school/program IDs, and source model;
- `auth.html` sign-in continuation for protected save/application actions, with continuation of the original page/action after demo sign-in;
- notification preference persistence between Preferences and Notifications through local demo state;
- notification event handoff from Application submission and School Portal contact actions into the student Notifications center;
- notification read/dismiss state persistence after reload in the frontend demo;
- payment issue and paid/free submission states persist into Billing and Notifications;
- application fee CTA now opens payment review before send and switches to a sent-status CTA after successful submission;
- high-risk Agent actions now require an in-panel confirmation before page state changes;
- Ops Admin now exposes internal Agent mode and confirmed Agent audit actions write local Ops audit state;
- student Agent submit action now uses the high-risk confirmation gate before opening the payment/send modal;
- role-aware Auth demo entry for student, school staff, and CUAC Ops accounts, with separate preview destinations;
- Auth recovery and email-verification preview states, including in-page password reset and pending verification after registration;
- completion detail loading, empty, and error states with browser QA coverage;
- executable browser-flow QA entry at `npm run qa:flows` for sign-in continuation, protected navigation, Agent add-choice continuation, Agent save-checklist continuation, Agent save-cost-estimate continuation, Add choice, application send, and school contact feedback;
- executable desktop/mobile layout QA entry at `npm run qa:layout` for Auth continuation page, Auth recovery, application modal, completion states, school portal, school settings, Ops admin, and Agent panel overflow/clickability checks;
- static tests enforcing core shell, route contracts, action registry, field mapping, and handoff assumptions.

## 3. Main Gaps

### P0: Frontend Product Hardening Gaps

The first completion audit identified missing P0/P1 pages. Those pages now exist, so the remaining P0 work is hardening and verification rather than creating the basic routes.

1. Browser-level interaction QA
   - `npm run qa:flows` now covers save -> auth page -> continued action, protected student link -> auth page -> continued navigation, Agent add-choice action -> auth page -> continued action, Agent save-checklist -> auth page -> continued page action, Agent save-cost-estimate -> auth page -> continued page action, Add choice selector, application send, school portal receipt, and school contact feedback.
   - `npm run qa:layout` now covers desktop/mobile horizontal overflow and key click-target obstruction for the Auth page, Auth recovery page, Add choice modal, completion states, school portal dashboard, school settings, Ops admin, and Agent panel.

2. Protected direct-action coverage
   - Public discovery save actions and protected student-workspace links now use the shared `auth.html` continuation flow.
   - Continue auditing new buttons so no save, add-choice, submit, preference, notification, or student workspace action bypasses `CUAC.requireSignedIn`.

3. Runtime state realism
   - Demo sign-in is in-memory and enough for UX proof.
   - Production needs real auth/session state, account ownership, API-backed saved items, and server-side authorization.

4. Visual QA
   - Automated desktop/mobile layout checks now guard the highest-risk overlap areas after major UI changes.
   - Human screenshot review is still useful for final visual polish, chart readability, and density judgment.

5. Documentation freshness
   - Page-specific specs written before completion pages existed should be treated as design references.
   - Current source of truth is `CuacDataClient`, route contracts, shared shell, and this updated audit.

### P1: Role And Operations Depth Gaps

These gaps are not strictly required for the student flow but are important for a mature product demo.

1. School staff depth
   - School portal now communicates tenant scope, queue, owner workload, next-action queue, export scope, analytics, applicant detail, and request templates.
   - School settings now previews staff seats, owner routing, editable document-request templates, response targets, and local save feedback.
   - Production still needs backend-enforced staff membership, real owner assignment APIs, template versioning, and response-time analytics from actual events.

2. CUAC Ops depth
   - Ops admin now previews catalog quality queues, routing retry, payment reconciliation, support lookup, school responsiveness, Agent audit, and local audit-trail feedback.
   - Production still needs backend permission levels, second approval for high-risk operations, real routing/payment APIs, support-access sessions, and immutable audit logs.

3. Role-aware account flows
   - Shared shell now differentiates student, school, and Ops account menus.
   - Auth demo now exposes student, school staff, and CUAC Ops account choices with separate preview destinations and local role state.
   - Production still needs real identity verification, account invitations, and server-side account type enforcement.

4. Agent production layer
   - Agent action registry exists in frontend demo code.
   - Agent prompt invocations now expose structured page/entity/source context in the shared shell.
   - Production still needs conversation storage, scoped retrieval, action preview/execute APIs, audit logs, and PageAgent-style operation evaluation.

### P2: Polish And Depth Gaps

- backend-backed detail loading/error states beyond the frontend demo query-state contract;
- production account verification, password reset delivery, MFA, and invitation enforcement beyond local preview state;
- production notification delivery channels beyond local demo event state;
- production payment provider, webhook verification, refunds, and reconciliation beyond local payment preview state;
- richer school-side staff actions;
- broader human screenshot review for final mobile polish beyond automated layout guards;
- future `CuacDataClient` normalization.

## 4. Recommended Completion Sequence

### Step 1: Stabilize The Student Core Chain

- discovery pages should help a student choose concrete school + program routes, not generic interests;
- Program, University, Scholarship, and City detail pages should present CSCAlite source fields as student-readable decision sections, not raw model keys;
- Favourites and Hub should make the next application action clear without duplicating floating Agent or nearby page controls;
- Application should keep Add choice, remove choice, applicant info, fee preview, payment simulation, consent, and send states in one coherent flow;
- Billing should reflect preview, failed payment, paid demo, and free-submitted states without implying school records exist before payment/free entitlement.

### Step 2: Stabilize The School Teacher Chain

- school users should land in a school-staff workspace, not a student browsing shell;
- school portal must show only this school's received records and must never reveal other school choices in the same student application set;
- teacher views should summarize queue health, owner workload, countries, programs, funding intent, source channel, deadlines, and next actions;
- school settings should cover staff seats, owner routing, response targets, request templates, and tenant-safe save feedback;
- exported or Agent-operated school actions must be tenant-scoped, confirmable when high risk, and auditable.

### Step 3: Stabilize Unified Auth And Continuation

- visitors should not be pre-classified as students, school staff, or CUAC staff before authentication;
- protected actions should redirect to the unified Auth page, where the user can sign in or create an account for the intended access context;
- after sign-in or registration, CUAC should resume the original page/action only after role, surface, tenant, and continuation-token checks pass;
- registration alone should not grant school or CUAC internal permissions; invites, memberships, or access grants decide those roles.

### Step 4: Stabilize Agent And Natural-Language Operations

- signed-out Agent use is current-page/session only and should clear on page close or refresh;
- signed-in student Agent memory may persist through the application lifecycle until the student clears it, enrolls, or the cycle is archived;
- school staff Agent context must be tenant-scoped and must not inherit student private Agent memory;
- PageAgent-style DOM operation can be evaluated for page navigation and control, but business actions must still use CUAC action registry, backend authorization, confirmation, and audit;
- Analytics Agent answers should come from governed metrics or scoped summaries, not unrestricted SQL.

### Step 5: Stabilize Data, Analytics, And Backend Adapter Seams

- keep mock catalog and handoff data behind `CuacDataClient` or the framework equivalent;
- keep `CuacDataClient.getBackendAdapterContract()` aligned with `CUAC_APPLICATION_API_CONTRACT.md`;
- preserve CSCAlite-compatible field families for schools, programs, scholarships, cities, application handoff records, and school portal analytics;
- prepare API adapters in this order: catalog detail/list data, student profile/saved state, applications/payments, school portal/settings, notifications, Agent actions, Ops admin;
- real payments must use provider intent/status/webhook verification before school records are materialized.

### Step 6: Stabilize Visual System And QA

- reduce text-heavy panels and repeated badges where the information is internal quality metadata rather than student-facing value;
- standardize catalog card actions, detail sidebars, dense dashboards, empty states, loading states, and confirmation modals;
- avoid duplicating buttons when the floating Agent input or nearby page section already provides the same action;
- run `npm run qa:layout` after visual changes and add human screenshot review before stakeholder demos.

## 5. Next Stage Delivery Map

### Student Core Chain

Target outcome:

- A student can discover routes, inspect CSCAlite-backed details, save/compare, sign in or register through unified Auth, continue the previous action, build an application set, remove choices, review fees, simulate payment, send records only after payment/free entitlement, and see billing/notification status.

Highest-priority missing or fragile items:

- finish student-readable detail rendering for all Program, University, Scholarship, and City fields that come from CSCAlite;
- remove internal source-quality badges from student cards unless framed as visible official-source information on detail pages;
- continue button polish across Programs, Scholarships, Favourites, Application, and detail pages;
- keep Add choice constrained to selected school/program/intake/language catalog records;
- make payment simulation states obvious: preview, processing, failed, paid, free-submitted, sent.

Verification:

- `npm run qa:flows`;
- `npm run qa:layout`;
- static tests for route contracts, CSCAlite field lineage, auth continuation, payment/send state, and school handoff.

### School Teacher Chain

Target outcome:

- A school staff user sees only their own school's CUAC records, understands what needs action today, can assign/contact/update/export within tenant scope, and can maintain school-side response templates/settings.

Highest-priority missing or fragile items:

- keep production design free of cross-school switchers; demo-only tenant switching must stay clearly marked or removed before production UX;
- add better visual grouping for queue, analytics, applicant detail, owner workload, and follow-up templates;
- define which analytics are school-visible and which are CUAC Ops only;
- ensure teacher-facing copy says CUAC did not collect official documents in the MVP handoff flow.

Verification:

- `npm run qa:flows` school send/contact/export checks;
- role matrix checks for tenant isolation;
- browser QA for dashboard overflow, chart loading, and applicant detail readability.

### CUAC Ops And Analytics Chain

Target outcome:

- CUAC Ops can monitor catalog quality, payment/routing health, school responsiveness, support lookup, and Agent audit with role-based, auditable controls.

Highest-priority missing or fragile items:

- turn Ops preview cards into governed metric definitions;
- define support access reasons, approval levels, retry limits, and immutable audit log fields;
- keep raw personal data behind purpose-limited support sessions.

Verification:

- role matrix, threat model, API contract, and Ops admin flow QA stay aligned.

### Agent And Natural-Language Operations Chain

Target outcome:

- Agent can summarize and operate inside the page for the current role, while all protected business actions go through normal auth, permission, confirmation, and audit paths.

Highest-priority missing or fragile items:

- evaluate Alibaba PageAgent or a similar DOM-operation layer for low-risk page controls;
- keep CUAC-owned action registry as the authority for business actions;
- design scoped retrieval/memory stores for guest, student, school tenant, and Ops contexts;
- add action preview APIs before action execute APIs.

Verification:

- static tests for action registry fields and sign-in continuation;
- flow QA for guest Agent protected actions, high-risk confirmations, school export confirmation, and memory clear confirmation.

### Design-System Cleanup Chain

Target outcome:

- The demo feels unified enough to guide backend development: catalog cards, detail sidebars, application steps, school dashboards, and auth forms use consistent controls, spacing, states, and typography.

Highest-priority missing or fragile items:

- define one catalog-card button pattern for compare/save/detail/application actions;
- define one detail-sidebar pattern for checklist, route fit, source/cost/deadline, and application entry;
- define one status-chip policy: student value only on public pages, operational quality metadata only in internal/school contexts;
- reduce dense prose into scan-first fields, tables, and progressive detail.

## 6. Completion Definition

This audit is complete when:

- P0/P1 pages exist in both `design-lab` and `frontend/public`;
- links from existing pages route into them;
- tests cover shared shell, route contracts, data contracts, auth/action boundaries, and handoff assumptions;
- guest protected actions redirect to the Auth page and continue after demo sign-in;
- no school page exposes other-school student choices;
- billing and school settings are visible from relevant flows;
- Ops admin is clearly internal and not student-facing;
- Program, University, Scholarship, and City cards use a unified primary/secondary action pattern without duplicate preview/detail clutter;
- public student pages do not show internal source-quality badges or raw CSCAlite/model keys as the primary reading experience;
- the current stage remains frontend-only: backend, database, real auth, real payment, file upload, university integration, and production Agent service are documented but not implemented here;
- the next-stage delivery map has current evidence for student, school teacher, Ops/analytics, Agent, data, and visual-system workstreams.

## 7. Current Stage Acceptance Boundary

This stage is finished when the static frontend demo can be used as the product blueprint for backend implementation. It is not finished merely because backend/database documents exist, and it must not continue into backend code before the frontend evidence is stable.

Acceptance evidence required before this stage can close:

- student discovery pages are visually consistent and lead to concrete school + program decisions;
- detail pages for programs, universities, scholarships, and cities use CSCAlite-aligned data fields while presenting student-readable labels, summaries, and progressive detail;
- protected saves, application entry, Agent actions, and workspace links redirect to unified Auth, then resume the saved action after demo sign-in or registration;
- the application flow supports add choice from catalog data, remove choice, applicant information, fee calculation, payment simulation, payment issue state, paid/free send state, Billing, Notifications, and school handoff;
- the school portal is a school-staff workspace, tenant-scoped to one school, and never exposes other-school choices, student private Agent memory, or cross-tenant records;
- Agent behavior is demonstrable for guest, student, school staff, and Ops contexts, with frontend action registry checks for auth, role, route, confirmation, and risk;
- cards, buttons, sidebars, forms, loading states, dashboard charts, and dense data panels follow one design language across public, student, school, and Ops surfaces;
- static tests, browser-flow QA, and layout QA cover the above frontend contracts.

## 8. Stage Cutoff Checklist

Use this checklist to decide whether the current frontend-demo goal can stop and backend tickets can begin. A backend task should not start simply because a database, API, permission, security, payment, or Agent architecture document exists.

The frontend-demo stage is ready to close only when all of these are true:

- every public catalog route has a student-readable list page and detail page, with CSCAlite-aligned fields hidden behind clear user labels rather than raw model keys;
- the student chain is demonstrable end to end: discover, save or compare, unified Auth, resume previous action, add/remove concrete choices, review applicant info, simulate payment, send after entitlement, then see Billing and Notifications;
- the school teacher chain is demonstrable end to end: receive only this school's paid/free-entitled record, triage queue, inspect applicant detail, mark contact status, use tenant-scoped template/export actions, and never see other schools in the student's application set;
- the Agent chain is demonstrable for guest, signed-in student, school staff, and CUAC Ops contexts, with guest memory scoped to the current page/session and signed-in memory explained as long-cycle application memory;
- visual patterns are consistent enough that new backend-backed pages can reuse the same card actions, detail sidebar, form, modal, dashboard, loading, empty, error, and confirmation states;
- QA evidence exists for static contracts, browser flows, and desktop/mobile layout after the latest meaningful visual or interaction change.

Stop the frontend-demo stage at that point. The next phase is not "more static screens"; it is backend ticketing against the proven frontend contracts: auth/session, catalog APIs, application/payment handoff, tenant permissions, notifications, analytics, and Agent action execution.

Backend implementation begins only after those frontend contracts are proven. The backend phase will then replace static state with real APIs for auth/session, catalog data, application/payment/school handoff, school staff permissions, notifications, analytics, and Agent action execution.

## 9. Frontend-Only Cutoff Ledger

Use this ledger as the practical answer to "when does this goal stop?" The current goal stops only when each frontend chain has demo evidence and a clear backend handoff. It does not stop because backend documents exist, and it must not grow into real backend implementation.

### Current Demo Route Scope

The cutoff decision should evaluate only the current official demo routes listed in `README.md`: Home v3, Programs, Universities, Scholarships, Cities, Guides, Auth, Onboarding, Hub, Favourites, Notifications, Preferences, Application, Billing, School Portal, School Settings, and Ops Admin, plus their detail routes.

Archived exploration pages such as `index.html` and `home-v5.html` are reference material only. They are not current UX evidence, must not be linked from current flows, and should not be used to reopen the frontend scope unless explicitly requested.

| Frontend chain | Close condition for this stage | Evidence to inspect now | Backend handoff after cutoff |
| --- | --- | --- | --- |
| Public catalog and details | Programs, Universities, Scholarships, Cities, and Guides help students compare real routes with CSCAlite-aligned fields shown as readable decision information. | Public HTML/JS/CSS, `CuacDataClient`, route contracts, static tests, layout QA, and final visual review. | Catalog read APIs, search/filter APIs, source freshness, and Ops data-quality workflows. |
| Student application loop | A student can discover, save/compare, authenticate through unified Auth, resume the prior action, add/remove concrete choices, review profile info, simulate payment, send after paid/free entitlement, and see Billing/Notifications. | `application.html/js/css`, `auth.html/js`, `billing.html`, `notifications.html/js`, `qa:flows`, `qa:layout`, and static payment/handoff assertions. | Auth/session, application set APIs, payment intents/webhooks, billing records, and notification delivery. |
| School teacher loop | School staff sees one tenant's received records only, triages applicants, views tenant-safe information sources, marks contact state, and uses scoped templates/export actions. | `school-portal.html/js/css`, `school-settings.html`, school tenant tests in `qa:flows`, and school layout QA. | School membership, RBAC, tenant policy, owner assignment, exports, templates, and audit logs. |
| Agent context and operations | Guest, student, school staff, and Ops contexts are separated; protected actions route through unified Auth; high-risk actions require confirmation; no Agent action bypasses role, tenant, payment, or consent state. | `shared-shell.js`, `cuac-actions.js`, `CuacDataClient.getAgentContextPolicy()`, Agent flow QA, and static action-registry checks. | Conversation storage, scoped retrieval, action preview/execute APIs, PageAgent-style control evaluation, and Agent audit. |
| Visual system | Catalog cards, detail sidebars, application steps, auth forms, school dashboards, loading/empty/error states, and buttons feel coherent enough to guide backend-backed screens. | CSS/HTML review, `qa:layout`, screenshot review, and static guards against raw model keys or internal source-quality badges on student pages. | Frontend component extraction, design tokens, real API loading/error states, and accessibility QA. |
| Production architecture docs | Database, API, permission, payment, analytics, security, and Agent documents describe future work without being mistaken for current implementation scope. | `CUAC_PRODUCTION_DESIGN_INDEX.md`, architecture specs, backend adapter contract, and this audit. | Backend tickets created from proven frontend contracts, not speculative screens or unverified data flows. |

### Current Evidence Snapshot - 2026-08-22

The latest frontend-only evidence after the card-action, public-label, Auth continuation, payment, and school-portal passes is:

- `npm.cmd test -- --runInBand` passed 12/12 static tests, including shared-shell parity, route contracts, `CuacDataClient` data-boundary checks, application payment/handoff assertions, and guards against student-visible internal source-quality labels.
- `npm.cmd run qa:flows` passed the core browser flow suite, including guest protected-action continuation through unified Auth, program pagination, Agent protected actions, add/remove choice, payment issue state, consent blocking, payment-gated school send, school-scoped portal receipt, school contact status update, tenant-scoped school export confirmation, Ops high-risk confirmation, notifications, preferences, and role-aware Auth routing.
- `npm.cmd run qa:layout` passed desktop/mobile layout QA, including catalog card buttons, application add-choice modal, completion/detail pages, school portal dashboard, school settings, Ops admin, and Agent panel clickability/overflow checks.
- `DESIGN_REVIEW_SCORECARD.md` records the current official demo review at 4.1 average, with no score below 4, and treats archived `index.html` and `home-v5.html` as non-current reference material.

This snapshot is frontend evidence, not backend completion. It supports moving toward the cutoff decision only while visual review and any remaining obvious demo inconsistencies stay inside the frontend-demo scope.

Current closure decision: automated frontend evidence is sufficient for backend handoff ticket preparation, but the goal should remain open until stakeholder visual review accepts the current look or names specific final frontend polish issues.

If any ledger row lacks current evidence, continue frontend demo work in that row. If every row is backed by current static, browser-flow, layout, and visual evidence, stop frontend expansion and create backend tickets from the handoff column.
