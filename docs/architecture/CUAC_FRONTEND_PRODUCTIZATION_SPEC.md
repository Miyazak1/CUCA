# CUAC Frontend Productization Spec

Date: 2026-08-14

Status: frontend normalization and productization plan after completion-page pass.

## 1. Purpose

This document defines how the current CUAC static frontend demo should evolve into a production-ready frontend product. It bridges the working demo, the production architecture specs, and the future backend/API implementation.

The goal is not to redesign everything again. The goal is to make the frontend consistent, testable, data-ready, role-aware, and Agent-operable before deeper backend integration begins.

## 2. Productization Principle

CUAC should keep the demo's strongest idea:

- a student starts from real China study intent;
- the product pushes them toward concrete school + program choices;
- CUAC sends school-scoped application records;
- schools follow up directly;
- Agent helps analyze, summarize, navigate, and operate within clear permission boundaries.

The frontend should now move from page-by-page static composition to a governed product shell:

- shared page taxonomy;
- shared component patterns;
- shared state naming;
- shared mock data contract;
- explicit role boundaries;
- explicit Agent action registry;
- predictable loading, empty, error, disabled, success, and confirmation states.

## 3. Surface Taxonomy

### Public Student Surface

Pages:

- `home-v3.html`
- `programs.html`
- `program-detail.html`
- `universities.html`
- `university-detail.html`
- `scholarships.html`
- `scholarship-detail.html`
- `cities.html`
- `city-detail.html`
- `guides.html`
- `guide-detail.html`
- `auth.html`

Primary job:

- help an international student discover realistic China study routes and understand the next application step.

Design rules:

- prioritize program-first decisions;
- always expose source, deadline, cost, city, language, and document signals where relevant;
- avoid generic marketing surfaces when a decision workflow is available;
- every discovery page should lead to save, compare, detail, or add-choice.

### Authenticated Student Surface

Pages:

- `onboarding.html`
- `hub.html`
- `favourites.html`
- `application.html`
- `billing.html`
- `notifications.html`
- `preferences.html`

Primary job:

- turn student intent into application choices, payment/receipt state, and school follow-up tracking.

Design rules:

- application choices must be concrete school + program + intake + language routes;
- students can see their full application set and payment state;
- students should understand that CUAC does not collect official documents in the MVP flow;
- high-impact actions need confirmation, clear fee copy, and reversible or auditable status.

### School Staff Surface

Pages:

- `school-portal.html`
- `school-settings.html`

Primary job:

- allow school staff to view and operate only their own tenant's application records.

Design rules:

- no cross-school switcher in production;
- no visibility into the student's other school choices;
- school analytics are tenant-scoped;
- exports are tenant-scoped and audited;
- account copy must make clear this is not a student account.

### CUAC Internal Ops Surface

Pages:

- `ops-admin.html`

Primary job:

- preview internal tools for catalog quality, routing, payments, school tenant health, support, analytics, and Agent audit.

Design rules:

- never present Ops as a normal student or school page;
- every cross-tenant support action must be auditable;
- Ops views can summarize platform health but should avoid raw personal data unless required for support.

## 4. Route Inventory And Page Contracts

Every product page should have a page contract:

- route name;
- audience;
- role requirement;
- primary task;
- entry points;
- exit points;
- data source;
- empty state;
- loading state;
- error state;
- Agent mode;
- analytics events;
- permission risks.

Minimum route contracts:

| Page | Audience | Primary Task | Required Data |
| --- | --- | --- | --- |
| Home | visitor/student | understand CUAC and start discovery | featured programs, routes, trust copy |
| Programs | visitor/student | search and compare concrete programs | program catalog, filters, saved state |
| Program detail | visitor/student | inspect one concrete route | program, university, city, deadlines, documents |
| Universities | visitor/student | compare school profiles | university catalog, city, route counts |
| University detail | visitor/student | understand one school route | school profile, programs, source status |
| Scholarships | visitor/student | compare funding routes | scholarship catalog, eligibility signals |
| Scholarship detail | visitor/student | inspect coverage and risk | funding route, deadlines, document needs |
| Cities | visitor/student | compare city fit | city costs, schools, route counts |
| City detail | visitor/student | understand city implication | cost, schools, programs, arrival notes |
| Guides | visitor/student | answer application questions | guide library |
| Guide detail | visitor/student | complete focused checklist | guide content, related routes |
| Auth | visitor | sign in/register | auth state |
| Onboarding | student | collect initial study intent | profile draft |
| Hub | student | track next actions | profile, saved items, applications |
| Favourites | student | convert saved items to choices | saved items, readiness signals |
| Application | student | build and submit application set | choices, profile, fee preview |
| Billing | student | review payment/receipt | invoice, application set |
| Notifications | student | track messages and tasks | notifications |
| Preferences | student | manage account and Agent settings | account, preferences |
| School portal | school staff | triage school records | tenant-scoped applications |
| School settings | school owner/staff | manage tenant settings | tenant, staff, templates |
| Ops admin | CUAC Ops | monitor platform health | cross-domain summaries |

## 5. Component Inventory

### Shared Shell

Current:

- `shared-shell.css`
- `shared-shell.js`
- shared header;
- shared footer;
- shared Agent shell;
- account menu;
- page reveal/loading behavior.

Productization requirements:

- keep header/footer as single source of truth;
- role-aware header variants must be data-driven, not hand-built per page;
- account menu should support student, school, and ops account types;
- global Agent shell must respect `data-agent-mode` and role context;
- search entry should stay removed unless a real search pattern is reintroduced.

### Route Contracts

Current:

- `CuacDataClient.getRouteContracts()` exposes the page-level route contracts from the static demo data boundary;
- each contract defines route, surface, role, audience, primary task, data source, Agent mode, key exits, required states, permission risk, and productization status.

Productization requirements:

- keep route contracts in sync with every public, student, school, and internal page;
- tests should prevent new pages from shipping without a contract;
- Agent actions should eventually use these contracts to decide which actions are allowed on each surface;
- role-aware shell variants should read the same surface and role taxonomy.

### Agent Context Retention

Current:

- `CuacDataClient.getAgentContextPolicy()` distinguishes guest, signed-in student, school staff, and CUAC ops context.
- The shared Agent panel shows the active context policy with `data-agent-context-policy`, `data-agent-context-retention`, and `data-agent-context-storage`.

Productization requirements:

- signed-out visitors use only the current page/session context; closing or refreshing the page must clear it;
- signed-in students may keep long-cycle application memory: study goal, saved routes, application choices, receipt state, school follow-up, notifications, and preferences;
- student long-term Agent memory should be retained until the student manually clears it, enrolls, or the application cycle is archived;
- school staff Agent context must use only tenant-scoped records and must never inherit the student's private long-term memory;
- CUAC ops Agent context can summarize platform health and audit events, but raw cross-tenant access must be justified and logged.

Page binding requirements:

- public student routes must resolve to signed-out Agent context unless the page explicitly declares a signed-in account state;
- authenticated student routes must declare or resolve to signed-in context before using onboarding, Hub, application, notification, or preference memory;
- school staff routes must declare school portal role and use the school Agent mode so the shell cannot show student account shortcuts or student memory;
- route contract `agentMode` must match the page body's `data-agent-mode` declaration for every route where the Agent is enabled.

### Discovery Components

Required shared patterns:

- search field;
- filter drawer;
- filter chips;
- result card;
- result list mode;
- pagination;
- save/favourite action;
- compare action;
- detail link;
- source status;
- deadline status;
- empty result state.

### Detail Components

Required shared patterns:

- detail hero;
- status pill row;
- metric strip;
- snapshot card;
- linked routes;
- checklist;
- timeline;
- sticky action panel;
- detail toast;
- fallback detail state.

### Application Components

Required shared patterns:

- choice card;
- add choice modal;
- field completeness card;
- fee preview;
- payment modal;
- submission receipt;
- school handoff status;
- high-impact confirmation.

### School Components

Required shared patterns:

- tenant scope banner;
- school metric cards;
- school analytics charts;
- queue filters;
- applicant list item;
- applicant detail panel;
- bulk action bar;
- export action;
- owner/status controls;
- school settings cards.

### Ops Components

Required shared patterns:

- ops worklist;
- health metric;
- risk badge;
- audit row;
- retry action;
- internal-only warning;
- governed analytics card.

## 6. State Model

Every interactive component should express states consistently:

- `idle`
- `loading`
- `ready`
- `empty`
- `filtered-empty`
- `dirty`
- `saving`
- `saved`
- `error`
- `disabled`
- `requires-confirmation`
- `submitted`

State rules:

- loading states should be visible but calm;
- empty states should include a next action;
- disabled actions must explain what is missing;
- submitted states must show where data went;
- school submitted states must show only this school's record;
- high-risk states must show clear confirmation and cancel options.

## 7. Data Source Mapping

The frontend should stop treating page copy as the data model. Each major workflow should map fields to owners.

Catalog fields for schools, programs, scholarships, and cities should follow the CSCAlite legacy project at `D:\CODE\CSCAlite`. The detailed mapping is maintained in `CUAC_LEGACY_FIELD_MAPPING_SPEC.md`. Static CUAC pages may keep display aliases such as `name`, `university`, `degree`, `language`, `tuition`, and `deadline`, but shared data should preserve CSCAlite-compatible fields such as `SchoolRecord`, `SchoolProgramRecord`, `PublicScholarship`, `SchoolScholarshipRecord`, and `CityGuide`.

### Add Choice Field Map

Student selects:

- study level;
- university;
- program;
- intake;
- teaching language.

System derives:

- city;
- tuition;
- deadline;
- source status;
- scholarship signal;
- document effort;
- fee impact;
- distinct-school count.

Student profile contributes:

- name;
- email;
- country;
- intended degree;
- preferred language;
- funding intent;
- intake preference.

School receives:

- student contact fields required for follow-up;
- selected program for that school;
- intake;
- teaching language;
- funding intent;
- CUAC-visible readiness signals;
- no other-school choices;
- no uploaded files in MVP.

School does not receive:

- other selected schools;
- other school statuses;
- total CUAC fee unless school-specific;
- private student notes;
- CUAC Ops risk flags;
- raw Agent conversation unless explicitly school-visible.

### Billing Field Map

Student sees:

- first school included;
- extra school fee;
- invoice total;
- payment state;
- receipt;
- linked application set.

School sees:

- school application receipt state only if useful;
- no platform fee breakdown for other schools.

CUAC Ops sees:

- payment provider state;
- invoice;
- routing state;
- reconciliation status;
- support audit trail.

## 8. Agent Frontend Contract

The frontend Agent shell should expose only registered page actions.

Page operation actions:

- open page;
- apply filter;
- sort results;
- save item;
- compare items;
- open detail;
- fill low-risk draft field.

Business actions:

- add application choice;
- remove application choice;
- preview fee;
- submit application after confirmation;
- mark school record contacted;
- assign owner;
- create export job after confirmation.

Analytics actions:

- summarize school queue;
- compare program demand;
- explain conversion trend;
- identify stale catalog records;
- summarize student readiness.

Frontend requirements:

- every action needs an `action_key`;
- every action needs visible UI feedback;
- every high-risk action needs confirmation;
- every backend action should be idempotent;
- every sensitive action should produce audit events;
- Agent cannot bypass role boundaries.

PageAgent evaluation boundary:

- Alibaba PageAgent may be useful for DOM/page operation tasks;
- CUAC should not rely on DOM actions for business truth;
- Agent must call CUAC APIs for persisted operations;
- backend authorization remains authoritative.

## 9. Analytics And Event Requirements

Every key frontend action should emit structured events later:

- page viewed;
- search performed;
- filter applied;
- detail opened;
- item saved;
- comparison started;
- choice modal opened;
- choice added;
- fee preview viewed;
- payment started;
- application submitted;
- school queue viewed;
- school record opened;
- school status updated;
- export requested;
- Agent prompt submitted;
- Agent action confirmed;
- Agent action denied.

Event payload rules:

- include role and surface;
- include object type and object ID where allowed;
- avoid raw personal data;
- include tenant ID only server-side or in controlled internal events;
- include source of action: manual or Agent.

## 10. Accessibility And Responsive Requirements

Minimum requirements:

- all interactive controls keyboard accessible;
- buttons used for actions, links used for navigation;
- visible focus states;
- semantic headings;
- tables or table roles for tabular data;
- no text overlap at mobile widths;
- modals trap focus in production;
- `prefers-reduced-motion` respected;
- loading animations should not block reading;
- charts must include text equivalents.

## 11. Frontend Normalization Plan

### Phase A: Document And Freeze Contracts

Deliverables:

- this document;
- `CUAC_FRONTEND_ROUTE_CONTRACT_CHECKLIST.md`;
- route contract table;
- component inventory;
- Add Choice to School Portal field map;
- Agent action surface list.

### Phase B: Data Extraction

Move page-level fixtures into shared data modules:

- catalog data;
- city data;
- scholarship data;
- guide data;
- student mock data;
- application mock data;
- school portal mock data;
- billing mock data.

Static HTML can remain for the demo, but data definitions should become reusable and testable.

### Phase C: Component Consolidation

Normalize repeated patterns:

- card actions;
- status pills;
- metric cards;
- pagination;
- toasts;
- loading states;
- empty states;
- detail layouts;
- confirmation panels.

### Phase D: Interaction Registry

Create a frontend action registry:

- manual UI actions;
- Agent-triggerable actions;
- confirmation requirements;
- role/surface constraints;
- audit labels;
- mock handlers.

### Phase E: Backend-Ready Adapter

Introduce a frontend data client boundary:

- current implementation reads mock fixtures and local demo state through `CuacDataClient`;
- `CuacDataClient.getBackendAdapterContract()` documents the production replacement seams by domain;
- later implementation calls APIs from the same method boundary;
- page code should not care whether data is mock or remote.

Suggested name:

- `CuacDataClient`

Current adapter domains:

- catalog: programs, schools, scholarships, cities, guides, and detail pages;
- student profile: Hub, onboarding preview, preferences, and student memory context;
- applications/payments: Add Choice, fee review, payment simulation, billing, and school handoff;
- school portal: tenant-scoped records, analytics, exports, and status updates;
- school settings: staff seats, owner routing, templates, and response targets;
- notifications: account-scoped dynamic events and notification preferences;
- Agent actions: response, preview, execute, confirmation, and memory clearing;
- Ops admin: internal audit, support lookup, retry, and cross-tenant controls.

### Phase F: QA And Visual Review

Add checks for:

- all routes load;
- shared shell exists;
- student/school/ops boundaries;
- no cross-school leakage;
- Add Choice fields match school portal receipt;
- billing reachable;
- Agent controls contained;
- mobile layout for core pages.

## 12. Immediate Next Implementation Tasks

Recommended next engineering sequence:

1. Keep route contracts, `CuacDataClient`, and tests aligned whenever a page changes.
2. Finish the current frontend-only stage before backend implementation: close the student application/payment/handoff loop, keep school views tenant-scoped, align CSCAlite fields, unify card/detail/sidebar/button patterns, and keep Auth/Agent continuation rules demonstrable.
3. Use `CuacDataClient.getBackendAdapterContract()` as the frontend-to-backend replacement map.
4. Prepare production backend handoff tickets from the proven frontend contracts in this order:
   - auth/session and continuation replay;
   - catalog read APIs;
   - student profile/preferences APIs;
   - application/payment/school handoff APIs;
   - school portal/settings APIs;
   - notifications and Agent action APIs;
   - Ops internal APIs.
5. Continue removing user-visible implementation language while preserving CSCAlite-compatible data fields behind the adapter.
6. Tighten role-aware header/account menu behavior as real auth and tenant membership land.
7. Expand visual QA snapshots whenever Programs, Universities, Scholarships, Cities, Application, Billing, School portal, or School settings receive major layout changes.

For this frontend demo stage, do not implement a real database, backend API, auth provider, payment provider, file upload service, university integration, or production Agent service. Those belong to production build tickets after the frontend contract is stable.

Before creating those backend tickets, use the `Frontend-Only Cutoff Ledger` in `CUAC_FRONTEND_COMPLETION_AUDIT.md`. If the ledger still has a weak row, continue the frontend demo there. If all rows have current static, browser-flow, layout, and visual evidence, stop adding static frontend scope and ticket the backend handoff from the proven contracts.

## 13. Production Readiness Definition

The frontend is productized when:

- every page has a route contract;
- every critical interaction has loading, empty, error, and success states;
- student, school, and ops surfaces are visibly and technically separated;
- Add Choice, Application, Billing, and School Portal use the same field model;
- Agent actions are registry-backed;
- static mock data can be swapped for API data through `CuacDataClient` and its backend adapter contract;
- tests prevent public/demo regressions;
- mobile and desktop core flows have visual QA coverage.
