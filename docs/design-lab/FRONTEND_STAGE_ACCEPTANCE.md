# CUAC Frontend Stage Acceptance

Date: 2026-08-22

Purpose: one-page acceptance guide for closing the current frontend-only demo stage. This is not a backend plan and does not authorize deployment.

## Review Scope

Review only the current official demo routes listed in `README.md`:

- Home: `home-v3.html`
- Public discovery: `programs.html`, `universities.html`, `scholarships.html`, `cities.html`, `guides.html`
- Detail guides: `program-detail.html`, `university-detail.html`, `scholarship-detail.html`, `city-detail.html`, `guide-detail.html`
- Auth and student workspace: `auth.html`, `onboarding.html`, `hub.html`, `favourites.html`, `notifications.html`, `preferences.html`
- Application and receipt: `application.html`, `billing.html`
- School workspace: `school-portal.html`, `school-settings.html`
- CUAC internal workspace: `ops-admin.html`

Do not use `index.html` or `home-v5.html` as acceptance evidence. They are archived reference pages only.

## Acceptance Checks

Accept the frontend stage only if these are true:

- Public catalog pages feel coherent and help a student choose concrete school-program routes.
- Detail pages expose CSCAlite-aligned information through student-readable labels, not raw model keys.
- Sign-in and registration use the unified Auth page and resume protected actions after authentication.
- Application flow demonstrates add choice, remove choice, applicant information, fee calculation, payment simulation, payment issue state, paid/free send, Billing, Notifications, and school handoff.
- School portal is clearly for school staff, locked to one school tenant, and does not expose other-school choices.
- Agent behavior is visibly scoped across guest, signed-in student, school staff, and CUAC Ops contexts.
- Cards, buttons, forms, sidebars, loading/empty/error states, charts, and dense panels feel consistent enough to guide backend-backed screens.

## Manual Review Runbook

Use this pass for final human visual and experience acceptance after automated QA has passed:

1. Open `home-v3.html` on desktop and mobile. Confirm the first screen feels like a polished China-study product, not an internal prototype.
2. Open `programs.html`, `universities.html`, `scholarships.html`, and `cities.html`. Confirm cards use consistent primary/secondary actions, no text overflows, and no internal source-quality labels are visible to students.
3. Open one detail page from each catalog area. Confirm information reads as student-facing guidance with CSCAlite-aligned fields behind clear labels.
4. Open `auth.html`. Confirm sign-in and registration feel unified, role-neutral, and suitable for student, school, and CUAC staff accounts.
5. Open `hub.html`, `favourites.html`, `notifications.html`, and `preferences.html`. Confirm the signed-in student workspace feels connected and not like separate static pages.
6. Open `application.html`. Confirm add choice, remove choice, applicant info, fee, payment simulation, and send state are understandable without backend knowledge.
7. Open `billing.html`. Confirm payment/receipt state is clear and does not imply a real payment provider.
8. Open `school-portal.html` and `school-settings.html`. Confirm the workspace feels school-staff specific, tenant-scoped, and operationally useful.
9. Open `ops-admin.html`. Confirm it is clearly internal and separate from student or school staff flows.
10. Open the Agent panel on at least one public page, one student page, one school page, and one Ops page. Confirm it feels global but role-scoped.

Record any rejection as a targeted frontend polish item with page, component, issue, and expected behavior. Do not reopen archived pages or backend implementation as part of this review.

## Current Evidence

- `npm.cmd test -- --runInBand`: passed 12/12.
- `npm.cmd run qa:flows`: passed.
- `npm.cmd run qa:layout`: passed.
- `DESIGN_REVIEW_SCORECARD.md`: current review average is 4.1, with no score below 4.
- `CUAC_FRONTEND_COMPLETION_AUDIT.md`: records the frontend-only cutoff ledger, current route scope, and latest evidence snapshot.

## Decision

If the current visual and interaction quality is acceptable:

- close the frontend-only demo stage;
- stop adding static screens;
- create backend handoff tickets from the proven contracts: auth/session, catalog APIs, application/payment/school handoff, tenant permissions, notifications, analytics, and Agent action execution.

If something still feels wrong:

- name the specific page, component, or interaction;
- keep changes targeted to frontend polish;
- rerun static, flow, or layout QA after the change.

Do not implement a real database, backend API, auth provider, payment provider, file upload service, university integration, production Agent service, or deployment in this stage.
