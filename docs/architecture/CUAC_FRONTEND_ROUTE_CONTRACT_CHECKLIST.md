# CUAC Frontend Route Contract Checklist

Date: 2026-08-14

Status: working checklist for frontend productization.

## 1. Purpose

This checklist turns the current static demo pages into explicit route contracts. It is the page-level companion to `CUAC_FRONTEND_PRODUCTIZATION_SPEC.md`.

Every route should have a clear audience, role boundary, data source, primary task, entry/exit path, state coverage, Agent mode, and production risk note.

## 2. Completion Keys

State coverage:

- L: loading
- E: empty
- R: error
- S: success/submitted/saved
- C: confirmation

Data source:

- static-html: fixed page markup
- page-fixture: data embedded in page JS
- shared-client: data from `CuacDataClient`
- local-state: browser demo state
- future-api: needs API later

Agent/auth binding:

- public student routes default to signed-out Agent context and must not use long-term student memory;
- authenticated student routes resolve to signed-in student memory and must keep add/remove/send/clear actions confirmable;
- school staff routes must use tenant-scoped school Agent context and must not show student account shortcuts or student private memory;
- each enabled route's body `data-agent-mode` must match its `CuacDataClient` route contract.

## 3. Current Route Contracts

| Route | Surface | Role | Primary Task | Current Data Source | Agent Mode | Key Exit | Required States | Productization Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `home-v3.html` | Public student | Visitor/student | Start China route discovery | shared-client + static-html | home | Programs, Hub, Onboarding | L, S | Started: home categories, featured routes, intakes, cities, and schools read shared discovery summary data |
| `programs.html` | Public student | Visitor/student | Search and compare programs | shared-client + fallback | programs | Program detail, Favourites, Application | L, E, S | Catalog list uses `CuacDataClient`, pagination, filters, compare state, and protected choice entry |
| `program-detail.html` | Public student | Visitor/student | Inspect one program route | shared-client via completion + dynamic catalog detail | programs | Application, university detail | L, E, S | Detail shell resolves non-default discovery programs before fallback |
| `universities.html` | Public student | Visitor/student | Compare schools | shared-client | universities | University detail, filtered programs | L, E, S | Catalog list uses `CuacDataClient`, pagination, filters, favourites, and filtered program exits |
| `university-detail.html` | Public student | Visitor/student | Inspect one school profile | shared-client via completion + dynamic catalog detail | universities | Program detail, application | L, E, S | Detail shell resolves non-default discovery schools with student-readable field labels |
| `scholarships.html` | Public student | Visitor/student | Compare funding routes | shared-client | scholarships | Scholarship detail, matching programs | L, E, S | Discovery scholarships use `CuacDataClient` with funding filters, student-readable actions, pagination, and matching-program exits |
| `scholarship-detail.html` | Public student | Visitor/student | Inspect coverage and eligibility | shared-client via completion + dynamic catalog detail | scholarships | Programs, scholarships | L, E, S | Detail shell resolves non-default discovery scholarships with student-readable funding fields |
| `cities.html` | Public student | Visitor/student | Compare city fit | shared-client | cities | City detail, filtered programs | L, E, S | Discovery cities use `CuacDataClient` with city-detail exits and saved context |
| `city-detail.html` | Public student | Visitor/student | Inspect city implications | shared-client via completion + dynamic catalog detail | cities | Programs, universities | L, E, S | Detail shell resolves non-default discovery cities with student-readable city fields and route exits |
| `guides.html` | Public student | Visitor/student | Understand China application steps | static-html + shared-client | guides | Guide detail, programs, scholarships | L, S | Guide search references use `CuacDataClient` with page-context Agent prompts and detail exits |
| `guide-detail.html` | Public student | Visitor/student | Follow a focused checklist | shared-client via completion + dynamic catalog detail | guides | Application, Guides | L, E, S | Detail shell resolves discovery guides with checklist-style recovery states |
| `auth.html` | Account | Visitor | Sign in/register | static-html | off/signed-out | Onboarding, Hub | E, R, S | Needs real auth states |
| `onboarding.html` | Student | Student | Capture first study intent | local-state | onboarding | Hub | L, S | Needs profile API adapter |
| `hub.html` | Student | Student | Track next actions | shared-client + local-state | hub | Application, Favourites, Notifications | L, E, S | Hub profile, onboarding override, routes, documents, application entry, and school follow-up state read shared student summary data |
| `favourites.html` | Student | Student | Turn saved items into choices | shared-client + local-state | favourites | Application, Programs | E, S | Saved items, collections, route groups, compare defaults, and choice defaults read shared saved-items summary data |
| `application.html` | Student | Student | Build, pay, and submit application set | shared-client + local-state | application | Billing, School portal demo, Hub | L, E, R, S, C | Fee calculation, payment state, consent, selected choices, and school records use `CuacDataClient`/local state |
| `billing.html` | Student | Student | Review receipt and payment boundary | shared-client | application | Application, School portal demo | L, E, S | Billing snapshot uses `CuacDataClient` and reflects payment failure, preview, paid, or free-submitted state |
| `notifications.html` | Student | Student | Review messages and tasks | shared-client + local-state | notifications | Application, Hub | E, S | Base notification items, dynamic school/payment events, default preferences, and group ordering read shared notification summary data |
| `preferences.html` | Student | Student | Manage account and Agent preferences | shared-client + local-state | preferences | Billing, Hub | R, S | Section copy, profile summary, workspace health, notification preferences, and Agent memory controls read shared preference summary data |
| `school-portal.html` | School staff | School staff | Triage tenant-scoped records | shared-client + local-state | school | School settings, mailto | L, E, S, C | Tenant records, analytics loading, owner workload, export confirmation, and student feedback loop use `CuacDataClient`/local state |
| `school-settings.html` | School staff | School owner/staff | Manage staff/templates/tenant settings | shared-client via completion | school | School portal | L, S, C | Frontend settings preview covers staff seats, owner routing, templates, response targets, and local save; needs production settings API shape |
| `ops-admin.html` | CUAC internal | CUAC Ops | Monitor internal operations | shared-client via completion | off | Home | L, E, S, C | Frontend Ops preview covers audit actions, support lookup, and high-risk confirmation; needs production ops data and internal auth boundary |

## 4. Contract Requirements For Every Route

Each route must eventually define:

- `data-agent-mode`;
- audience and allowed role;
- primary CTA;
- secondary exits;
- source of catalog/student/school/payment data;
- loading state;
- empty state where list-like;
- error or blocked state;
- success/confirmation state where actions mutate state;
- analytics events;
- Agent action keys if Agent-operable.

## 5. Immediate Follow-Up

Next implementation targets:

1. Keep `CuacDataClient.getRouteContracts()` aligned with this checklist so tests validate route contracts from data and documentation together.
2. Continue normalizing student-facing detail labels and dense-page controls so catalog data remains CSCAlite-compatible but user-readable.
3. Tighten role-aware shell behavior as production auth becomes real:
   - student account menu;
   - school account menu;
   - ops/internal mode;
   - continuation replay after sign-in or registration.
4. Add or expand visual QA screenshots when new pages or major layouts change:
   - Programs;
   - Universities;
   - Scholarships;
   - Cities;
   - Application;
   - Billing;
   - School portal;
   - School settings.
5. Prepare backend adapter seams for:
   - profile API;
   - school settings API;
   - ops data API;
   - real auth and tenant membership checks.
