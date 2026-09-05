# CUAC Frontend Demo

Date: 2026-08-12

Purpose: high-fidelity static frontend demo for the current CUAC product experience. This stage proves the student, school, Ops, Auth, Agent, payment-simulation, and handoff flows before backend implementation begins.

## Current Official Demo Routes

These are the routes to review as the current demo:

- `home-v3.html`: public homepage and root redirect target.
- `programs.html`, `program-detail.html`: program discovery and program route guide.
- `universities.html`, `university-detail.html`: university discovery and university guide.
- `scholarships.html`, `scholarship-detail.html`: funding route discovery and scholarship guide.
- `cities.html`, `city-detail.html`: city discovery and city guide.
- `guides.html`, `guide-detail.html`: application guidance.
- `auth.html`, `onboarding.html`: unified sign-in, registration, continuation, and account setup.
- `hub.html`, `favourites.html`, `notifications.html`, `preferences.html`: student workspace.
- `application.html`, `billing.html`: application basket, payment simulation, and receipt.
- `school-portal.html`, `school-settings.html`: school admissions workspace and tenant settings.
- `ops-admin.html`: CUAC internal operations workspace.

## Shared Infrastructure

- `shared-shell.css`: shared header, navigation, footer, social icon, global Agent Composer, and Agent Workspace styling for current pages.
- `shared-shell.js`: shared header, footer, global bottom Agent Composer, and Agent Workspace renderer. Update global shell behavior here instead of editing each page.
- `cuac-data.js`: frontend data boundary and backend handoff contract for replacing static state later.
- `cuac-actions.js`: frontend Agent/page action registry.

## Archived Reference Only

- `index.html`: static prototype with Home Search Gateway, Program Search desktop, and Program Search mobile.
- `home-v5.html`: archived exploration for a simpler direction. Do not continue from this version unless explicitly requested.

Do not treat archived pages as current UX evidence, do not link them from current demo flows, and do not continue from them unless explicitly requested.

## Product Specs

- `AGENT_SIDEBAR_INTERACTION_SPEC.md`: front-end interaction plan for the global Agent sidebar, including modes, result components, actions, and future data contracts.
- `SCHOOL_PORTAL_PRODUCT_SPEC.md`: school-facing admissions workspace spec, including tenant scope, staff permissions, analytics, document boundaries, Agent boundaries, and backend contracts.
- `DESIGN_REVIEW_SCORECARD.md`: review rubric for deciding whether a design is ready to migrate.
- `FRONTEND_STAGE_ACCEPTANCE.md`: one-page acceptance guide for deciding whether this frontend-only stage can close.

## How To Review

Open:

```txt
D:\CODE\CUAC\design-lab\home-v3.html
```

Review in this order:

1. Home v3 desktop.
2. Home v3 mobile.
3. Public catalog pages and detail pages.
4. Student Hub, Application basket, Billing, Notifications, and Preferences.
5. School admissions workspace and school settings.
6. Ops workspace.
7. Archived `index.html` and `home-v5.html` only as reference if needed.
8. Score with `DESIGN_REVIEW_SCORECARD.md`.

## Design Intent

This prototype follows the revised CUAC direction:

- Search-first, not dashboard-first.
- Program Search as the core product surface.
- Browse-first cards, not a permanent filter dashboard.
- On-demand filters, selected-program focus, and clear deadline, tuition, scholarship, language, document, and source signals.
- Young but restrained visual style.

## Migration Rule

Do not migrate this into backend implementation until:

- The scorecard average is at least 4.
- No score is below 3.
- public catalog and detail pages use student-readable CSCAlite-aligned fields.
- the student application/payment/school handoff loop is demonstrable.
- the school workspace remains tenant-scoped.
- Auth and Agent continuation rules are demonstrable.
- static, browser-flow, and layout QA have passed after the latest meaningful change.

Do not publish or deploy unless explicitly requested.
