# CUAC Agent Action Architecture

Date: 2026-08-14

Status: production Agent architecture draft.

## 1. Purpose

This document defines how CUAC should support natural-language analysis, summarization, and operations without compromising permissions, privacy, or business correctness.

The Agent is a product capability, not a separate authority. It helps users understand and operate CUAC, but all real actions must go through normal backend authorization and audit.

CUAC's Agent is primarily an information organization and expression layer. It does not become the source of business truth, permission, metrics, payment state, routing state, or school decisions. Backend services, governed scripts, metric definitions, policy checks, and audited workflows produce authoritative results; the Agent explains, summarizes, compares, and presents those results in natural language.

## 2. Agent Layers

### Admissions Agent

Domain reasoning layer.

Responsibilities:

- interpret student study goals;
- explain China admissions concepts;
- summarize program, scholarship, city, and deadline fit;
- identify missing non-document information;
- explain CUAC fee and routing rules;
- summarize school-side records for authorized school staff.

It uses CUAC catalog data, student profile data, application data, and authorized analytics summaries.

### Page Operation Agent

UI operation layer.

Responsibilities:

- apply filters;
- click visible controls;
- open detail pages;
- save or compare items;
- prefill allowed fields;
- navigate between pages.

Alibaba PageAgent is a useful reference for this layer because it operates inside web pages using DOM-based natural-language control. It should be evaluated as a possible runtime behind CUAC's custom shared Agent UI.

Reference: https://github.com/alibaba/page-agent

### Business Action Agent

Controlled action layer.

Responsibilities:

- add application choice;
- update student profile;
- preview fee;
- submit application after confirmation;
- update school record status after confirmation;
- assign owner;
- create export job after confirmation.

This layer must use the same API and permission checks as manual UI actions.

### Analytics Agent

Controlled analysis and expression layer.

Responsibilities:

- answer metric questions;
- summarize trends;
- compare cohorts;
- explain conversion funnels;
- produce school-scoped summaries for school users.

It must use a metric registry, governed semantic layer, or preapproved backend analysis script, not unrestricted SQL or ad hoc model-generated queries.

### Scripted Summary Agent

Safe presentation layer for school staff and CUAC Ops.

Responsibilities:

- turn backend script results into readable summaries;
- explain queue health using predefined metrics;
- highlight missing data based on governed validation checks;
- draft non-authoritative follow-up text from approved templates;
- list next recommended manual actions without executing them unless an action registry path allows it.

It must not decide admissions outcomes, invent metrics, create raw database queries, infer hidden school choices, or override workflow state. If the backend script or governed metric does not provide a fact, the Agent must say it cannot determine it from available data.

## 3. Action Registry

Every Agent action must be registered.

Registered actions are the only path from language to system behavior. Free-form model analysis may produce text, but it cannot create new tools, new metrics, new permissions, new workflow states, or new database queries.

Required fields:

- action_key
- description
- surface
- allowed_roles
- required_scope
- input_schema
- output_schema
- confirmation_required
- reversible
- idempotent
- audit_level
- rate_limit
- max_batch_size
- risk_level

Example:

```json
{
  "actionKey": "application.add_choice",
  "surface": "application",
  "allowedRoles": ["student"],
  "requiredScope": "own_application_set",
  "confirmationRequired": false,
  "reversible": true,
  "idempotent": true,
  "riskLevel": "medium"
}
```

### Frontend Demo Registry Status

The static frontend demo now includes a lightweight `CuacActionRegistry` in `cuac-actions.js`.

It checks:

- action key or UI action;
- current route;
- surface;
- role;
- auth state;
- risk level;
- confirmation requirement.

Guest users can still use low-risk public actions such as navigation, filtering, comparing, and reading summaries. Actions that save state, enter the student workspace, add choices, submit applications, update school records, export tenant data, or use Ops controls require signed-in context.

When a signed-out visitor triggers a protected Agent action, the shared shell stores a sign-in continuation and redirects to `auth.html`. After demo sign-in, the user returns to the original page and CUAC restores the recoverable action for continuation. This proves the intended UX: require login at the point of need without losing the user's current task.

The continuation must store only minimal pending-action metadata, expire quickly, and never grant permission by itself. After sign-in or registration, CUAC must recheck the action against the authenticated role, route, surface, tenant scope, and action policy. A restored action is consumed once only after the user continues it or the page completes the saved selector action; blocked, expired, or mismatched continuations are cleared with an audit marker.

The production version must replace this demo-only auth state with real identity, session, API authorization, and audit logs.

### Frontend Demo Context Binding Status

The shared shell now treats `data-agent-prompt` as a single global Agent invocation entry.

Each invocation captures:

- current route and `data-agent-mode`;
- effective auth state, role, and surface from the route contract and demo auth state;
- Agent retention policy from `CuacDataClient.getAgentContextPolicy`;
- nearest structured entity context from detail roots, notification rows, application choices, saved items, or school status rows;
- source model lineage when available, for example `Program` detail backed by `SchoolProgram`.

The shared Agent results surface exposes this context through `data-agent-entity-type`, `data-agent-entity-id`, `data-agent-source-model`, `data-agent-context-retention`, and `data-agent-context-storage`. Agent action events also include `context`, `sourceContext`, `shellContext`, and `contextPolicy` in `cuac:agent-action.detail`.

This is still frontend-only evidence, but it establishes the production contract: an Agent answer or action must know the object it is acting on, the source model behind that object, and the actor's permission context before any business action is proposed or executed.

## 4. Action Risk Levels

### Low

Examples:

- apply filters;
- sort list;
- open page;
- summarize public program.

No confirmation required.

### Medium

Examples:

- save program;
- add choice;
- edit profile field;
- mark school record reviewed.

Confirmation may be inline or undoable.

### High

Examples:

- submit application;
- pay and send;
- export school records;
- bulk update school statuses;
- invite staff user.

Explicit confirmation required.

### Prohibited

Examples:

- final admission decision;
- refund without policy approval;
- cross-tenant school data access;
- bypass payment;
- delete audit logs;
- expose raw unrestricted database results.
- create metrics from arbitrary SQL;
- make admissions decisions;
- change school/application/payment state from natural language without a registered backend action;
- present inferred hidden data as fact.

## 5. Confirmation UX

High-risk Agent actions must show:

- action summary;
- affected records;
- data shared;
- fee or payment impact;
- reversibility;
- confirmation CTA;
- cancel CTA.

Submission confirmation example:

```txt
Send this application set to 3 schools.
Each school receives only its own program interest and your contact/profile fields.
Total due: USD 40.
CUAC does not send documents.
```

## 6. Data Access

Agent context must be scoped by role.

CUAC's Agent uses short working context plus selective structured memory. Guest-to-registered context carry-forward, important-information criteria, and close-page retention behavior are defined in `CUAC_AGENT_CONTEXT_LIFECYCLE_SPEC.md`.

Context retention must also be scoped by role:

- signed-out visitor: current-page session only, no durable Agent memory and no profile/application reads;
- signed-in student: account-level application memory that can persist through the application lifecycle until manual clear, enrollment, or archive;
- school staff: tenant work-session memory only, never student private Agent memory;
- CUAC Ops: internal audit retention.

Student context:

- public catalog;
- own profile;
- own saved items;
- own application sets;
- own notifications.

Student Agent behavior:

- helps analyze, filter, compare, and recommend;
- may explain tradeoffs and produce checklists;
- may propose saved items or draft application choices through registered tools;
- does not guarantee admission, decide eligibility, or submit without backend validation and confirmation.

School context:

- tenant school records only;
- school-visible student fields;
- school analytics scoped to tenant;
- school staff settings if role allows.

School Agent behavior:

- organizes tenant-scoped queue data already returned by backend services;
- summarizes applicant records visible to that school;
- uses predefined scripts for workload, missing follow-up, response-time, and status summaries;
- drafts school communication from approved templates;
- does not freely query student/application tables;
- does not infer or reveal the student's other selected schools;
- does not decide admission outcomes.

CUAC Ops context:

- cross-tenant support data according to role;
- payment/routing status;
- audit summaries;
- data quality queues.

CUAC Ops Agent behavior:

- summarizes governed operations data;
- explains payment/routing status from backend state machines;
- highlights data-quality issues from validation scripts;
- summarizes Agent audit and policy-denial patterns;
- requires support reason and audit for private cross-tenant data;
- does not run arbitrary SQL, bypass policy, or turn the current admin page layout into business truth.

## 7. Retrieval And Knowledge

Recommended retrieval sources:

- verified program data;
- verified school data;
- scholarships;
- guides;
- policy copy;
- product help;
- user's own application state;
- school-scoped queue data.
- precomputed backend script outputs;
- governed metric results;
- approved template content.

Do not retrieve:

- another student's data;
- another school's tenant data;
- unrestricted raw audit logs;
- secrets or credentials.
- unrestricted raw tables for analysis;
- unapproved model-generated SQL results.

## 7.1 Authoritative Computation Boundary

The Agent may describe computed results, but the computation must come from CUAC-controlled mechanisms.

Authoritative sources:

- domain service responses;
- policy engine decisions;
- database views with tenant policy;
- governed metric registry;
- scheduled validation jobs;
- preapproved analysis scripts;
- payment provider status via Billing Facade;
- audit/event summaries produced by backend services.

Non-authoritative sources:

- model-generated calculations over hidden data;
- model-generated SQL;
- model-inferred permission state;
- page text that claims a user has access;
- user-provided prompt instructions;
- school/student notes that ask the Agent to change rules.

If an answer needs a metric or status not available through an authoritative source, the Agent should respond with the nearest available governed summary or ask for the backend metric/script to be added.

## 8. Prompt Injection Controls

User-generated and school-generated text must be treated as untrusted data.

Controls:

- wrap retrieved text as data, not instructions;
- strip or ignore instructions inside notes, program descriptions, and messages;
- maintain system rules outside retrieved content;
- require action registry validation before tool execution;
- log suspicious prompt injection attempts;
- never let page content grant permissions.
- treat `data-*` entity/source attributes as context hints only; backend authorization, tenant policy, and source retrieval must re-resolve them server-side before execution.

## 9. PageAgent Compatibility Requirements

CUAC pages should remain compatible with a DOM-based page operation Agent:

- semantic buttons and labels;
- stable `data-*` action targets;
- real inputs/selects for filters;
- visible text state for status;
- accessible names for icon buttons;
- no hover-only critical actions;
- no visual-only state that the Agent must infer.

PageAgent-like operation is best for low-risk UI tasks. Production business mutations should call CUAC's backend action registry.

## 10. Agent Event Lifecycle

1. User asks natural-language request.
2. Agent creates conversation message.
3. Agent retrieves scoped context.
4. Agent proposes answer or action.
5. Policy engine checks action availability.
6. User confirms if required.
7. Backend executes action idempotently.
8. Audit log records actor, effective user, action, inputs, and result.
9. Product event records analytics.
10. UI updates with visible status.

## 11. Agent Observability

Track:

- request count by surface;
- answer latency;
- action proposal rate;
- confirmation rate;
- action success/failure rate;
- permission denial rate;
- unsafe request rate;
- user undo/cancel rate;
- hallucination reports;
- escalation to support.

## 12. MVP Agent Scope

Student:

- search and filter programs;
- explain program fit;
- save/compare;
- add choice;
- explain fee;
- check required non-document profile fields;
- submit only after confirmation.

School:

- summarize applicant;
- filter queue;
- draft document request;
- propose or trigger mark-contacted only through registered backend action after confirmation;
- summarize weekly records.

CUAC Ops:

- summarize routing failures;
- identify stale catalog data;
- analyze school responsiveness;
- open relevant admin queues.

MVP non-goals:

- autonomous admissions decisions;
- autonomous payment/refund decisions;
- free-form database analysis;
- hidden cross-tenant inference;
- long raw context memory;
- treating generated text as workflow state.
