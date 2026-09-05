# CUAC Agent Context Lifecycle Spec

Date: 2026-09-01

Status: lifecycle contract with locally verified guest-to-student confirmation, owner-scoped candidate capacity, student controls and finite retention; production Agent remains disabled.

Implementation update (2026-09-01): executable input, confirmation, capacity, control and finite-retention contracts supersede free-form examples below. Guest and student active pending candidates are capped at 12 per verified browser binding and 24 per student account, with transaction-safe last-slot enforcement. Scoped memory list/clear/opt-out, reset cutoff, bounded candidate sweep, a database-enforced 365-day student-memory ceiling and an internal expiry scrubber are also locally verified; see [candidate capacity](CUAC_AGENT_CANDIDATE_CAPACITY_CONTRACT.md), [memory management](CUAC_AGENT_MEMORY_MANAGEMENT_CONTRACT.md) and [retention](CUAC_AGENT_MEMORY_RETENTION_CONTRACT.md). Public management UX, production scheduling, Gateway/WAF abuse controls, backup deletion and full identity lifecycle remain open; production durable memory stays disabled. Closing a page is not server deletion; stateless rotation cannot revoke copied tokens.

Related documents:

- `CUAC_SECURE_AGENT_BACKEND_ARCHITECTURE.md`
- `CUAC_AGENT_ACTION_ARCHITECTURE.md`
- `CUAC_AGENT_TOOL_REGISTRY_SPEC.md`
- `CUAC_AGENT_DATA_SANDBOX_SPEC.md`
- `CUAC_DATA_CLASSIFICATION_REGISTER.md`
- `CUAC_AGENT_MEMORY_RETENTION_CONTRACT.md`
- `CUAC_AGENT_CANDIDATE_CAPACITY_CONTRACT.md`
- `CUAC_BACKEND_FOUNDATION_SCHEMA_API_CONTRACT.md`

## 1. Purpose

This document defines how CUAC should manage Agent context before and after registration.

CUAC's Agent is not a coding Agent. It does not need extremely long context windows or full conversation replay. It mainly helps students:

- combine school, program, scholarship, city, and guide information;
- compare routes;
- remember near-term search intent;
- recommend next steps;
- open relevant pages;
- prepare low-sensitive application choices and checklists.

Therefore, the Agent should use short working context plus selective structured memory, not durable raw chat history.

## 2. Core Principle

The Agent may preserve user intent, not raw conversation by default.

```text
Short-lived conversation text
  -> extracted structured preference candidates
  -> user-visible confirmation
  -> account memory after sign-in
```

Registration or sign-in can inherit context, but it inherits only approved summaries and pending actions. It does not automatically inherit every prior message.

## 3. Context Layers

CUAC should separate Agent context into four layers.

| Layer | Lifetime | Storage | Purpose |
| --- | --- | --- | --- |
| Page context | current page view | browser/session only | visible filters, selected card, current route, active comparison |
| Conversation working context | current chat session | ephemeral server/session cache | recent turns used to answer the current question |
| Preference candidates | until sign-in, close, or expiry | browser/session and optional short-lived server continuation | extracted possible interests the user may want to keep |
| Account memory | after sign-in and confirmation | database summary rows | durable low-sensitive preferences and application-cycle summaries |

## 4. Guest Context

Guest users may use the Agent on public catalog pages.

Allowed guest context:

- current route;
- visible filters;
- viewed school/program/scholarship/city IDs;
- comparison candidates;
- typed interests;
- rough preference candidates such as country, degree level, subject, city, budget band, language preference, intake timing;
- pending low-risk navigation actions.

Guest context must not include:

- durable user ID;
- full student profile;
- saved item database state;
- application set reads;
- payment status;
- school tenant data;
- documents;
- long-term Agent memory.

Guest context should normally live in browser/session storage and expire quickly. If a protected action requires sign-in continuation, the backend may store a short-lived continuation record containing minimal metadata, not the full conversation.

## 5. Guest-To-Registered Inheritance

When a guest signs in or registers, CUAC should offer to carry forward useful context.

Inheritance flow:

1. Guest chats with Agent on public pages.
2. Agent extracts preference candidates and pending route/action candidates.
3. User clicks save, add choice, compare later, or create account.
4. CUAC creates a short-lived continuation token.
5. User signs in or registers.
6. Backend rechecks the continuation against the authenticated user, role, route, and policy.
7. UI shows a "carry forward" review step.
8. User confirms which items become account memory, saved items, or application draft fields.
9. Confirmed items are stored as structured summaries.
10. Raw guest chat is discarded or allowed to expire.

The review step is important. The user may have explored options casually before registration. CUAC should not silently convert every exploration into durable profile memory.

## 6. What Counts As Important

Important information is information that improves future guidance, is stable enough to reuse, is low-sensitive, and fits an approved structured schema. Product importance alone never makes a field suitable for Agent memory.

### Important By Default

These can be proposed as memory candidates:

- target country or region of study;
- target degree level;
- broad subject interests;
- preferred teaching language;
- preferred city or climate/lifestyle preference;
- budget band, not exact financial details;
- scholarship interest;
- preferred intake year or term;
- disliked constraints, such as "avoid very expensive cities";
- stated application urgency, such as "needs late intake";
- a stable combined preference, such as "needs English-taught programs with scholarship options".

### Important To Product, But Not Agent Memory

These require explicit user action in their authoritative domain forms and tables. They must not be copied into Agent durable memory even when the user confirms them in a conversation:

- full name;
- phone, WhatsApp, or email beyond account identity;
- nationality or citizenship;
- current school;
- exact GPA/test score;
- language test result;
- education background;
- family budget details;
- application note intended for schools;
- any information to be shared with a school;
- saved item, Application Choice, material selection, authorization, snapshot, payment, submission, or school status.

### Not Important For Durable Memory

These should usually stay ephemeral:

- casual greetings;
- one-off wording preferences;
- temporary page navigation;
- "show me more" style requests;
- rejected options unless the rejection is a durable constraint;
- raw chain of recommendations;
- exact prompt text;
- duplicated facts available from catalog;
- low-confidence inferred interests.

### Never Store In Agent Memory

- card number, CVV, bank account, payment credentials;
- passport, transcript, recommendation, medical, visa, or JW-form data;
- secrets, API keys, tokens;
- private school tenant data in student memory;
- other students' information;
- raw Ops support notes;
- prompt injection payloads except redacted security metadata.

## 7. Memory Object Model

Recommended memory entries:

```json
{
  "memoryType": "study_goal",
  "contextScope": "student_account",
  "confidence": "user_confirmed",
  "source": "guest_context_carry_forward",
  "summary": "Interested in English-taught Computer Science master's programs in Hangzhou or Shanghai, prefers scholarship options, Fall 2026 intake.",
  "structured": {
    "degreeLevel": "master",
    "subjectAreas": ["Computer Science"],
    "teachingLanguage": "english",
    "preferredCities": ["Hangzhou", "Shanghai"],
    "fundingIntent": "scholarship_possible",
    "targetIntake": "Fall 2026"
  },
  "expiresAt": null,
  "createdAt": "2026-08-26T00:00:00Z"
}
```

Use structured data wherever possible. Free-text memory should be short and derived from user-visible facts, not copied from the raw conversation.

Suggested memory types:

- `study_goal`
- `subject_interest`
- `location_preference`
- `budget_band`
- `language_preference`
- `funding_preference`
- `intake_preference`
- `saved_route_summary`
- `application_state_summary`
- `negative_preference`
- `checklist_state`

## 8. Logged-In Role And Persona Context

Signing in identifies the user. It does not decide which Agent context the user is currently using.

Persona context is the first gate of the Agent data sandbox. The selected persona determines which data classes, projections, tools, retrieval lanes, and memory namespaces are allowed.

CUAC should resolve an active Agent persona for every logged-in Agent session:

```text
active_agent_persona =
  authenticated_user
  + selected_surface
  + active_role
  + tenant_school_id if school-scoped
  + context_scope
  + allowed_tools
  + memory_namespace
```

The same human account may have multiple roles, but one Agent conversation should run in one active persona at a time.

### Student Persona

Purpose:

- discover programs and schools;
- compare scholarships and cities;
- manage saved routes;
- prepare application choices;
- understand fees and next steps.
- organize information for decision support.

Context scope:

- `student_account`

Allowed context:

- public catalog;
- own preference memory;
- own saved items;
- own application set summaries;
- own notifications;
- own payment business status through Billing Facade only.

Disallowed context:

- school tenant queues;
- other students;
- CUAC Ops support notes;
- raw payment credentials;
- high-sensitive documents.

Behavior boundary:

- analysis, filtering, comparison, recommendation, checklist creation, and explanation are allowed;
- decisions remain with the student and backend validation;
- application submission, payment, and school disclosure require normal backend workflow and confirmation.

Memory namespace:

- `user:{user_id}:student`

### School Staff Persona

Purpose:

- triage school applications;
- understand applicant summaries visible to the school;
- draft contact templates;
- update tenant-scoped statuses when allowed;
- summarize tenant queue health.
- turn backend script outputs into teacher-readable summaries.

Context scope:

- `school_tenant`

Allowed context:

- current school tenant;
- school-visible applicant snapshots;
- program interests for that school;
- tenant status events;
- tenant templates and queue summaries;
- tenant analytics summaries.

Disallowed context:

- student's private Agent memory;
- student's other selected schools;
- payment amounts for other schools;
- CUAC internal notes unless explicitly school-visible;
- other school tenants.

Behavior boundary:

- the Agent summarizes and explains data returned by school-safe services, governed metrics, or preapproved scripts;
- it does not freely explore the database;
- it does not make admissions decisions;
- it does not infer hidden student choices;
- it does not change workflow state except through registered actions and confirmation.

Memory namespace:

- `school:{tenant_school_id}:staff`

If a user belongs to multiple schools, the session must select one active `tenant_school_id`. The Agent cannot merge tenant contexts in one conversation unless a later CUAC Admin/Ops policy explicitly allows an audited cross-tenant workflow.

### CUAC Ops Persona

Purpose:

- inspect data quality queues;
- monitor routing and payment status;
- support users and schools;
- audit Agent and tenant activity;
- analyze governed metrics.
- organize operational information for faster review.

Context scope:

- `ops_audit`

Allowed context:

- governed platform summaries;
- data quality queues;
- routing/payment business status;
- audit summaries;
- support records when a reason is provided and policy allows it.

Disallowed context:

- unrestricted SQL;
- raw payment credentials;
- high-sensitive documents unless a later document service grants explicit audited access;
- unaudited cross-tenant raw data browsing;
- student or school memory outside a support reason.

Behavior boundary:

- the Agent summarizes governed backend results, validation queues, audit summaries, and metric outputs;
- it does not run arbitrary SQL;
- it does not create new metrics by prompt;
- it does not override routing, payment, tenant, or account state;
- it does not turn an admin page layout into an API contract.

Memory namespace:

- `ops:{user_id}:audit` or task-scoped `ops_task:{support_case_id}`

### Persona Switching

Role switching must be explicit.

Rules:

- switching from student to school staff starts or resumes a separate Agent conversation;
- switching school tenants starts or resumes a tenant-specific conversation;
- student memory is not injected into school staff context;
- school tenant memory is not injected into student context;
- CUAC Ops support access requires purpose and audit before private context is retrieved;
- the UI should show the active persona in plain language, such as "Student assistant" or "Zhejiang University staff assistant".

Do not let the Agent silently combine all roles attached to the account. Combined context is how leaks happen.

### Persona-Specific Tool Availability

Tool availability must be resolved after persona selection.

Examples:

| Tool | Student | School Staff | CUAC Ops |
| --- | --- | --- | --- |
| `catalog.search_programs` | yes | yes | yes |
| `saved_items.add` | own account | no | support only later |
| `application.add_choice` | own draft | no | support only later |
| `billing.get_payment_status` | own payment business status | no | audited support |
| `school.queue_summary` | no | own tenant | audited support |
| `school.export_applications` | no | own tenant with confirmation | audited support |
| `analytics.query_governed_metric` | own/student summary later | tenant metrics | governed platform metrics |

This tool matrix supplements `CUAC_AGENT_TOOL_REGISTRY_SPEC.md`; the registry remains the executable source of truth.

### Scripted Results Over Free Exploration

School and Ops personas should usually receive script or metric outputs, not raw tables.

Allowed patterns:

- `school.queue_summary` returns a tenant-scoped summary generated by School Portal Service;
- `school.applicant_summary` returns a school-visible applicant projection;
- `analytics.query_governed_metric` returns a named metric from the registry;
- `ops.data_quality_summary` returns results from validation jobs;
- `ops.agent_audit_summary` returns a redacted audit summary.

Disallowed patterns:

- Agent asks for arbitrary SQL;
- Agent asks for "all rows" and decides what to analyze;
- Agent joins student memory with school tenant data;
- Agent infers permissions from page text;
- Agent creates a new metric definition without review.

## 9. Context Compression

Because CUAC does not need long coding-style context, use aggressive compression.

Working context should include:

- last few relevant turns;
- current page context;
- selected entity IDs;
- confirmed memory summaries;
- retrieved catalog snippets;
- action candidates.

Working context should not include:

- full multi-session transcript;
- full catalog records when a filtered projection is enough;
- payment or document data;
- all saved items when top relevant saved routes are enough;
- school tenant data outside school-staff context.

Suggested working context budget:

- guest: last 5 to 8 turns or current page task;
- signed-in student: last 8 to 12 relevant turns plus memory summaries;
- school staff: current tenant work session plus queue summary;
- CUAC Ops: current audited support task plus governed summaries.

## 10. Expiry And Retention

Recommended defaults:

| Context | Default Retention | Notes |
| --- | --- | --- |
| Guest page context | until tab/session closes | browser/session only |
| Guest server continuation | 30 to 120 minutes | minimal metadata, one-time consumption |
| Guest preference candidates | until browser session closes or 24 hours maximum | not durable account memory |
| Raw signed-in conversation | disabled for durable storage by default | working context only; no long-term transcript table is implemented |
| Confirmed student account memory | no later than database creation time + 365 days | structured low-sensitive summary only; no access-based renewal |
| Application state summary | not Agent memory | derived on demand from authoritative application state through approved projections |
| Audit metadata | security retention policy | not deleted by memory clear |

Closing the webpage:

- discard working context;
- keep no guest durable memory;
- optionally keep local preference candidates only if the user has not opted out and retention is short;
- preserve only unexpired, explicitly confirmed account memory for signed-in users; closing the page neither renews nor immediately scrubs it.

## 11. User Controls

Users should be able to:

- see what the Agent remembered;
- approve guest context carry-forward during registration;
- remove individual memory items;
- clear all student Agent memory;
- see and switch the active Agent persona when the account has more than one role;
- clear persona-specific memory separately;
- opt out of durable memory;
- continue using the Agent ephemerally.

Memory UI should show plain labels:

- study goal;
- preferred subjects;
- preferred cities;
- budget band;
- scholarship interest;
- saved route summary;
- application checklist.

Do not expose raw technical labels such as `agent_memory_entries` in user-facing UI.

## 12. Safety Controls

Controls:

- memory extraction uses a schema and confidence field;
- low-confidence inferences are not stored;
- sensitive fields require confirmation;
- every memory item has data classification;
- every logged-in Agent session resolves one active persona;
- persona switching creates or resumes a separate context;
- school staff memory is tenant-scoped and cannot enter student memory;
- student memory cannot enter school staff context;
- memory clear writes audit metadata but deletes or marks memory as cleared;
- prompt injection payloads are not preserved as normal memory.

## 13. API Contract

Phase 0/1 should define contract-only endpoints. Implementation can wait until Agent MVP.

```text
GET /api/v1/agent/personas
POST /api/v1/agent/personas/select
POST /api/v1/agent/context/candidates
POST /api/v1/agent/context/continuations
POST /api/v1/agent/context/carry-forward
GET /api/v1/agent/memory
DELETE /api/v1/agent/memory/:memoryId
DELETE /api/v1/agent/memory
```

### `GET /agent/personas`

Returns available Agent personas for the current authenticated user.

Rules:

- guest receives only guest/public persona;
- student receives student persona;
- school staff receives one persona per active school tenant membership;
- CUAC Ops receives Ops persona only after role/grant policy passes;
- response includes available surfaces, memory namespace label, and allowed tool groups, not secrets.

### `POST /agent/personas/select`

Selects the active Agent persona for a conversation.

Rules:

- requires authentication except guest persona;
- rechecks role and tenant membership;
- starts or resumes a separate conversation namespace;
- never merges student, school, and Ops memory.

### `POST /agent/context/candidates`

Extracts memory candidates from current guest or signed-in context.

Rules:

- returns candidates for UI review;
- does not persist durable memory by itself;
- redacts prohibited data;
- marks confidence and data class.

### `POST /agent/context/carry-forward`

After sign-in, stores selected candidates as account memory or saved items.

Rules:

- requires authenticated user;
- requires continuation token or current session context;
- rechecks policy;
- stores only selected candidates;
- writes audit metadata for memory creation.

### `GET /agent/memory`

Returns current user's memory summaries.

Rules:

- student sees own memory;
- school staff sees only tenant memory if later enabled;
- guest returns empty durable memory.

## 14. Database Additions

The existing ERD has `agent_conversations`, `agent_messages`, and `agent_memory_entries`. Add or confirm support for:

### `agent_persona_sessions`

Active role/surface context for a logged-in or guest Agent session.

Fields:

- id uuid pk
- user_id uuid nullable
- anonymous_session_hash text nullable
- conversation_id uuid nullable
- selected_surface text
- active_role text
- context_scope text: guest_page, student_account, school_tenant, ops_audit
- tenant_school_id uuid nullable
- memory_namespace text
- status text: active, switched, expired, cleared
- created_at timestamptz
- last_seen_at timestamptz
- expires_at timestamptz nullable

Rules:

- `student_account` requires `user_id`;
- `school_tenant` requires `user_id` and `tenant_school_id`;
- `ops_audit` requires `user_id` and support/audit policy when private data is accessed;
- guest sessions cannot have durable memory namespaces.

### `agent_context_candidates`

Short-lived candidate table for carry-forward review.

Fields:

- id uuid pk
- anonymous_session_hash text nullable
- user_id uuid nullable
- continuation_id uuid nullable
- candidate_type text
- context_scope text: guest_page, student_account, school_tenant, ops_audit
- active_role text nullable
- tenant_school_id uuid nullable
- memory_namespace text nullable
- data_class text
- confidence text: inferred, repeated_signal, user_stated, user_confirmed
- summary text
- structured_json jsonb default '{}'
- source_entity_ids_json jsonb default '[]'
- status text: proposed, accepted, rejected, expired
- expires_at timestamptz
- created_at timestamptz
- accepted_at timestamptz nullable

Rules:

- guest candidates expire quickly;
- accepted candidates become `agent_memory_entries`, `saved_items`, or student profile draft fields;
- candidates cannot contain payment-sensitive, high-sensitive document, secret, or tenant-confidential data.
- student carry-forward candidates cannot contain school tenant data.
- school tenant candidates require active tenant membership before acceptance.

### `agent_memory_entries`

Existing memory table should include or support:

- memory_type;
- context_scope;
- active_role;
- tenant_school_id when tenant scoped;
- data_class;
- confidence;
- summary;
- structured_json;
- source;
- expires_at;
- cleared_at.

Do not create durable `guest_page` memory rows.

## 15. Product Behavior Examples

### Guest Uses Agent, Then Registers

User says:

```text
I want English-taught CS master's programs in Hangzhou, preferably with scholarships.
```

Agent may propose:

- subject: Computer Science;
- degree: master's;
- teaching language: English;
- city: Hangzhou;
- funding: scholarship possible.

After registration, CUAC asks:

```text
Carry these preferences into your account?
```

Only selected preferences become memory.

### Guest Closes Page

If the user closes the page before registering:

- conversation text is discarded;
- no durable account memory exists;
- optional local candidates expire;
- no student profile is created.

### Signed-In Student Returns Later

Agent receives:

- confirmed memory summary;
- saved route IDs;
- current application set summary;
- current page context.

Agent does not receive:

- full previous transcript;
- payment details;
- raw documents;
- irrelevant old recommendations.

### User Has Student And School Staff Roles

The user signs in and can choose:

- Student assistant;
- Zhejiang University staff assistant.

If they choose Student assistant:

- the Agent may use their saved routes and student application summaries;
- it cannot read school queue records.

If they choose Zhejiang University staff assistant:

- the Agent may summarize that school's application queue;
- it cannot read the user's private student memory or other school choices.

## 16. Phase Decision

Phase 0/1 has implemented the narrow student lifecycle foundation and keeps the production feature disabled.

Implemented locally:

- strict `study_goal` candidate extraction and confirmation;
- guest/student candidate expiry and guest-to-student carry-forward binding;
- owner-scoped active pending-candidate limits of 12 for a verified guest browser and 24 for a student account, including real PostgreSQL last-slot serialization;
- student list, individual/all clear, opt-out, reset revision and capacity controls;
- database-enforced 365-day confirmed-memory ceiling and bounded expiry scrubbing;
- security tests for no guest durable memory, prohibited fields, role/tenant isolation and audit rollback.

Still do not enable:

- long-term raw conversation storage;
- autonomous Agent actions;
- Agent retrieval over private application tables;
- memory-based school disclosure;
- any memory involving payment credentials or documents.

Before production, complete control UX, scheduled maintenance and monitoring, Gateway/WAF abuse and model-budget controls, persona/session in-flight revocation, backup/log/model-provider deletion policy, Alibaba Cloud staging and privacy approval.
