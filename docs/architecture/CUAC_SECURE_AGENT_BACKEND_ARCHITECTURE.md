# CUAC Secure Agent And Backend Architecture

Date: 2026-08-25

Status: security-first backend architecture baseline for Agent, data, payment, tenant isolation, and backend implementation.

## 1. Purpose

This document defines the secure architecture CUAC should use before implementing the production backend and Agent service.

The goal is to make the Agent useful for student discovery and guided navigation while keeping sensitive student records, payment data, school tenant data, and operational authority protected by mature backend controls.

This document consolidates and hardens the existing CUAC drafts:

- `CUAC_PRODUCT_ARCHITECTURE_SPEC.md`
- `CUAC_DATABASE_ERD_SPEC.md`
- `CUAC_APPLICATION_API_CONTRACT.md`
- `CUAC_AGENT_ACTION_ARCHITECTURE.md`
- `CUAC_AGENT_DATA_SANDBOX_SPEC.md`
- `CUAC_SECURITY_PRIVACY_THREAT_MODEL.md`
- `CUAC_PAYMENTS_BILLING_SPEC.md`
- `CUAC_DATA_GOVERNANCE_SPEC.md`

## 2. Reference Standards And Mature Patterns

CUAC should not invent a custom security model for Agentic AI. The architecture should borrow from mature web security, payment, data-governance, and AI-agent patterns.

Primary references:

- NIST AI Risk Management Framework: govern, map, measure, and manage AI risk across the lifecycle. Reference: https://www.nist.gov/itl/ai-risk-management-framework
- NIST AI RMF Generative AI Profile: identify generative-AI-specific risks and risk-management actions. Reference: https://airc.nist.gov/
- OWASP Top 10 for LLM and GenAI 2025: prompt injection, sensitive information disclosure, excessive agency, vector and embedding weaknesses, and related risks. Reference: https://genai.owasp.org/initiatives/top-10-for-llm-and-genai/
- OWASP ASVS 5.0: mature application security verification requirements for authentication, authorization, validation, logging, and data protection. Reference: https://owasp.org/www-project-application-security-verification-standard/
- FERPA student privacy concepts for education-record PII, disclosure records, and legitimate-interest controls where US student data is involved. Reference: https://studentprivacy.ed.gov/ferpa
- PCI DSS baseline for systems that store, process, or transmit cardholder data. Reference: https://www.pcisecuritystandards.org/standards/pci-dss/
- Stripe hosted payment/tokenization pattern: card data collection stays in provider-controlled hosted fields or checkout so raw card data does not touch CUAC servers. Reference: https://stripe.com/guides/pci-compliance and https://docs.stripe.com/api/tokens
- PostgreSQL Row-Level Security for tenant isolation where PostgreSQL is used. Reference: https://www.postgresql.org/docs/17/ddl-rowsecurity.html
- AWS agentic AI security reference pattern: session isolation, centralized tool gateway, distinct identities for user, agent, and tools, guardrails, observability, and least privilege. Reference: https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture-generative-ai/gen-auto-agents.html
- OpenAI business data controls: no training on API business data by default, encryption, retention controls, and zero-data-retention options for eligible use cases. Reference: https://openai.com/business-data/

These references do not replace CUAC's own legal review. They define the engineering baseline that backend implementation should follow.

## 3. Security Posture

CUAC should use a zero-trust product architecture:

- The Agent is not a trusted principal.
- The browser is not authoritative.
- Prompt instructions are not a security boundary.
- Page `data-*` attributes are context hints only.
- Every read and write is authorized server-side.
- Every school-facing query is tenant-scoped server-side.
- Every payment state transition is provider-verified and idempotent.
- Every high-risk Agent action is previewed, confirmed, executed through normal domain services, and audited.

The Agent should be treated as an untrusted planner that can request allowed tools. It never receives database credentials, payment-provider secrets, raw SQL authority, or unrestricted network access.

The Agent is not the computation authority. For school staff and CUAC Ops especially, backend scripts, governed metric definitions, school-safe projections, state machines, and policy checks produce the facts. The Agent organizes and expresses those facts so users can review them faster.

## 4. Target Architecture

Recommended production shape:

```text
Browser / Mobile Client
  -> CUAC Web API
    -> Auth And Session Layer
    -> Policy Engine
    -> Domain Services
       - Catalog Service
       - Student Profile Service
       - Application Service
       - School Portal Service
       - Billing Facade
       - Notification Service
       - Agent Orchestrator
       - Audit Service
       - Analytics Service
    -> Data Stores
       - PostgreSQL primary transactional database
       - Search index for catalog discovery
       - Vector index for approved knowledge retrieval
       - Object storage for future files and exports
       - Event warehouse for analytics

Agent Orchestrator
  -> Agent Policy Runtime
  -> Retrieval Gateway
  -> Tool Gateway
  -> Action Preview / Execute APIs
  -> Audit Log

Payment Provider
  -> Hosted checkout / hosted fields
  -> Provider webhook verification
  -> CUAC Billing Facade stores only status, invoice, and provider references
```

For the first production version, these services can live inside one modular monolith. The mature boundary is logical ownership and policy enforcement, not microservice count.

## 5. Data Classification

Every field should have a data classification before database implementation.

| Level | Examples | Agent Default | Storage / Logging Rule |
| --- | --- | --- | --- |
| Public catalog | Schools, programs, scholarships, cities, public guides | Allowed | Can be indexed and cited with source metadata |
| Internal catalog metadata | quality score, source review state, Ops notes | Restricted by role | Do not expose on student pages unless transformed into student-facing source status |
| Low-sensitive student preferences | degree level, target country, city preference, budget band, interest tags | Allowed after consent or account context | Store normally, do not place in URLs |
| Student PII | name, email, phone, nationality, date of birth, education background | Minimized and only when needed | Encrypt where appropriate, redact logs, audit disclosure |
| Education records / application snapshots | selected choices, school-visible applicant snapshot, status history | Student-owned or school-scoped | Tenant policy and disclosure audit required |
| High-sensitive documents | passport, transcript, medical, recommendation, visa/JW files | Prohibited in MVP Agent | Out of MVP; if added later, separate document service and DLP required |
| Payment-sensitive data | PAN, CVV, bank account, raw payment credentials | Prohibited | Must never touch CUAC servers, prompts, logs, vector stores, or Agent memory |
| Payment business data | payment status, invoice ID, provider payment ID, last4 if provider returns it | Allowed only through Billing Facade | Store minimal provider references and audited status history |
| Secrets | API keys, signing secrets, DB credentials, OAuth secrets | Prohibited | Secret manager only, never prompt/log/client |

## 6. Agent Scope

The MVP Agent should be limited to student discovery, explanation, comparison, guided application preparation, and safe navigation.

Allowed knowledge domains:

- school catalog
- program catalog
- scholarship catalog
- city and guide content
- deadline and tuition metadata
- product FAQ and policy copy
- route registry and page affordances
- low-sensitive student preference profile
- student-owned saved items and application state after authentication
- school tenant queue summaries for authorized school staff

Prohibited Agent domains:

- raw payment credentials
- direct payment-provider dashboard access
- passport, transcript, medical, recommendation, visa, or JW-form files
- unrestricted student records
- school records outside the staff member's tenant
- private CUAC Ops notes unless the user has explicit audited support access
- unrestricted SQL or arbitrary analytics queries
- secrets, environment variables, API keys, and internal prompts as retrievable knowledge

## 7. Agent Sandbox

CUAC should implement the Agent as a constrained runtime, not as code with general backend permissions.

Agent sandboxing has three parts: runtime sandbox, tool sandbox, and data sandbox. The detailed data-isolation contract is defined in `CUAC_AGENT_DATA_SANDBOX_SPEC.md`.

Sandbox requirements:

- no direct database connection;
- no shell access in production;
- no arbitrary outbound internet access;
- no arbitrary URL opening for users;
- no access to payment-provider secrets;
- no raw object-storage listing;
- no cross-tenant cache;
- no persistent guest memory;
- strict tool allowlist;
- per-tool input schema validation;
- per-tool output redaction;
- per-session rate limits and budget limits;
- request, action, and retrieval trace IDs.

The sandbox should expose only CUAC-owned tools through the Tool Gateway. If CUAC later embeds a DOM-operation layer such as PageAgent-style browser control, it must remain low-risk and UI-scoped. Business mutations still go through backend action APIs.

## 8. Tool Gateway

All Agent tools must be registered and invoked through a gateway.

Tool registration fields:

```json
{
  "toolKey": "catalog.search_programs",
  "description": "Search verified or stale program catalog records",
  "allowedSurfaces": ["home", "programs", "hub", "application"],
  "allowedRoles": ["guest", "student", "cuac_ops"],
  "requiredScope": "public_catalog",
  "inputSchema": "json_schema_ref",
  "outputSchema": "json_schema_ref",
  "dataClassesReturned": ["public_catalog", "internal_catalog_metadata_optional"],
  "riskLevel": "low",
  "confirmationRequired": false,
  "idempotent": true,
  "rateLimit": "60/min/user",
  "auditLevel": "metadata"
}
```

Gateway responsibilities:

- authenticate the user session and Agent service identity;
- resolve effective role and tenant;
- validate request schema;
- enforce allowed role, surface, scope, tenant, and risk policy;
- call the domain service with a short-lived service credential;
- redact forbidden fields from the response;
- write audit metadata for all proposed and executed actions;
- block tools whose output would exceed the requested data class.

The gateway must not accept model-generated URLs, SQL, table names, tenant IDs, user IDs, or field lists as authoritative. It re-resolves all object IDs and scopes server-side.

## 9. Retrieval Architecture

Agent retrieval should use two separate retrieval lanes.

All retrieval lanes must obey the Agent data sandbox: active persona, allowed data classes, tenant scope, projection type, memory namespace, redaction, and audit behavior must be resolved before data enters model context.

### Public Knowledge Lane

Sources:

- verified schools
- verified programs
- scholarships
- city guides
- product help
- application policy copy

Controls:

- source freshness labels;
- citation metadata;
- no student PII;
- no payment data;
- no secrets;
- no tenant records;
- human review before verified status;
- stale/pending data must be described with caveats.

### Scoped Private Lane

Sources:

- current student's profile summary;
- current student's saved items;
- current student's application set state;
- current school tenant queue summaries;
- CUAC Ops support summaries with reason and audit.

Controls:

- requires authenticated session except guest page context;
- row-level and object-level authorization before retrieval;
- field allowlist per role;
- data minimization before model context;
- no retrieval of another tenant's or another student's records;
- separate memory namespace per `context_scope`.

Vector index rule:

Do not put raw payment data, secrets, identity documents, transcripts, or unrestricted application records in the vector index. If future document retrieval is added, use a separate encrypted document pipeline with DLP, per-document ACLs, retention policy, and deletion support for both source files and embeddings.

## 10. Prompt Injection Controls

CUAC must assume that catalog descriptions, school notes, student notes, uploaded text, web pages, and emails can contain malicious instructions.

Controls:

- put system/developer instructions outside retrieved content;
- wrap retrieved content as quoted data with source labels;
- add retrieval metadata that marks content as untrusted;
- never execute a tool because retrieved text told the Agent to do so;
- require policy validation after model output and before every tool call;
- block requests that attempt to reveal prompts, secrets, other tenants, payment credentials, or raw database content;
- log suspicious prompt-injection indicators with redacted payloads;
- maintain regression tests for indirect prompt injection in catalog/program notes.

The core rule is: retrieved text can answer questions, but it cannot grant permissions.

## 11. Payment Isolation

Payment-sensitive data must be completely isolated from the Agent.

Hard rules:

- CUAC does not collect raw card number, CVV, bank account, or raw payment credentials.
- Agent does not see, store, transform, summarize, or retrieve payment credentials.
- Payment forms are hosted by the payment provider or use provider-hosted fields.
- CUAC stores only payment business data such as provider customer ID, payment intent ID, invoice ID, amount, currency, status, and timestamps.
- Payment webhooks are signature-verified.
- Submit after payment is idempotent.
- School-visible records are created only after payment is paid or not required.
- Refunds require role policy and audit.

Recommended payment boundary:

```text
Agent
  -> Billing Facade
     - get fee preview
     - create hosted checkout link
     - get payment status
     - explain invoice status
  -> Payment Provider
     - hosted payment UI
     - tokenization
     - webhooks
```

Agent-allowed payment tools:

- `billing.get_fee_preview`
- `billing.create_hosted_checkout_link`
- `billing.get_payment_status`
- `billing.explain_invoice_status`

Agent-prohibited payment tools:

- `billing.read_card_number`
- `billing.read_cvv`
- `billing.update_raw_payment_method`
- `billing.charge_without_provider_intent`
- `billing.refund_without_policy`

## 12. Student Data And Education Privacy

CUAC's MVP should collect only what is needed for discovery, school follow-up, and application routing.

MVP allowed student data:

- account identity;
- contact fields needed for school follow-up;
- education stage and target study level;
- country/region;
- language status;
- funding intent;
- selected school/program choices;
- school-visible non-document notes;
- consent record for sharing application information with selected schools.

MVP prohibited collection:

- passport scans;
- transcripts;
- recommendation letters;
- medical forms;
- visa/JW-form files;
- full payment credentials.

Where US student data or education-record concepts apply, the architecture should support FERPA-aligned principles:

- identify education-record PII;
- use legitimate-interest checks for disclosure;
- record disclosure of student PII to schools or support parties;
- prevent redisclosure beyond the stated purpose;
- support inspection, correction, deletion, and retention workflows where legally required.

## 13. Tenant Isolation

School tenant isolation is a primary security invariant.

Rules:

- school staff membership is granted by invite, school-email approval, SSO claim, or CUAC admin approval;
- school staff can query only `school_applications` scoped to their tenant;
- school staff must never query `application_sets` directly for inbox views;
- school portal responses must not include other schools selected by the student;
- school analytics are computed from tenant-scoped records;
- exports are tenant-scoped, short-lived, and audited;
- CUAC Ops cross-tenant access requires role, support reason, and audit.

For PostgreSQL, use defense in depth:

- application-layer tenant policy;
- PostgreSQL Row-Level Security for school-scoped tables;
- school-safe views for reporting;
- automated direct-ID access tests;
- audit records for denied cross-tenant attempts.

## 14. Identity Model

Use three distinct identities:

| Identity | Purpose | Credential Boundary |
| --- | --- | --- |
| User identity | The human signed into CUAC | session cookie, OAuth, SSO |
| Agent service identity | The CUAC-owned Agent runtime | short-lived service credential |
| Tool/downstream identity | Domain service, payment provider, email provider, storage | scoped service token or provider secret |

The Agent acts on behalf of a user, but it is not the user. Every Agent action must include:

- `actor_user_id`
- `actor_role`
- `selected_surface`
- `tenant_school_id` when school-scoped
- `agent_service_id`
- `conversation_id`
- `action_key`
- `policy_decision_id`
- `request_id`

School and CUAC internal roles must not be self-granted by registration. Registration creates an account; invitations, memberships, grants, or SSO claims create authority.

For logged-in Agent sessions, identity must be narrowed into one active Agent persona before retrieval or tools run. The active persona combines user, selected surface, active role, context scope, tenant school ID when needed, allowed tools, and memory namespace. Do not merge student, school staff, and CUAC Ops context in one conversation. Detailed persona switching rules are defined in `CUAC_AGENT_CONTEXT_LIFECYCLE_SPEC.md`.

## 15. Authorization Pattern

Use centralized policy checks for both manual UI and Agent-triggered actions.

Policy decision inputs:

- subject: user, role, session, school memberships, CUAC grants;
- action: tool/action key, risk level, mutability, batch size;
- resource: object ID, owner ID, tenant ID, application set ID, data classification;
- context: surface, route, IP/risk score, continuation token, confirmation state;
- purpose: support reason, school review, student application, billing reconciliation.

Policy outputs:

- allow;
- deny;
- require sign-in;
- require tenant selection;
- require confirmation;
- require stronger auth/MFA;
- require CUAC Ops approval;
- redact response fields.

Do not authorize from model text. The model can propose an action; the policy engine decides whether it can be previewed or executed.

## 16. Action Lifecycle

Every Agent business action follows this lifecycle:

```text
User request
  -> Agent message
  -> scoped retrieval
  -> model proposes answer/action
  -> Tool Gateway validates proposed tool
  -> Policy Engine decides preview permission
  -> Preview response shown to user
  -> user confirmation if needed
  -> Policy Engine rechecks execute permission
  -> Domain Service executes idempotently
  -> Audit Log records result
  -> Product Event records analytics
  -> UI updates from authoritative API response
```

High-risk actions:

- application submit;
- pay-and-send flow;
- school export;
- bulk school status update;
- staff invitation;
- CUAC Ops support lookup;
- refund request or approval;
- Agent memory clear.

These require explicit confirmation and audit.

Prohibited actions:

- final admissions decision;
- bypass payment;
- delete audit logs;
- reveal raw payment credentials;
- reveal system prompts or secrets;
- access another tenant's records;
- unrestricted SQL execution;
- autonomous external email sending with student PII unless explicitly approved by policy and confirmed by user.

## 17. Logging And Audit

Separate observability logs from immutable audit logs.

Observability logs:

- request ID;
- route;
- action key;
- latency;
- status code;
- error code;
- token/cost metrics;
- redacted user and tenant identifiers.

Do not put sensitive payloads, prompts with PII, payment details, tokens, or secrets in general logs.

Audit logs:

- actor user and role;
- Agent service identity if Agent-triggered;
- effective tenant;
- action key;
- resource ID;
- purpose/reason;
- policy decision;
- before/after hashes or snapshots where appropriate;
- data classes disclosed;
- confirmation timestamp;
- result and error code;
- immutable created timestamp.

Audit retention should be longer than conversation retention. Users should be able to clear student Agent memory, but this must not delete required security audit records.

## 18. Data Retention And Memory

Agent memory is not a dumping ground for raw conversations.

Detailed context lifecycle, guest-to-registered carry-forward, and importance rules are defined in `CUAC_AGENT_CONTEXT_LIFECYCLE_SPEC.md`.

Retention rules:

| Context | Retention | Allowed Memory |
| --- | --- | --- |
| Guest page | current page/session only | no durable memory |
| Signed-in student | application lifecycle until clear/archive | study goals, saved route summaries, application-state summaries |
| School staff | tenant work session or short operational window | queue filter preferences, tenant workflow summaries |
| CUAC Ops | audit retention | support/routing summaries with reason |

Memory entries must store summaries, not raw sensitive payloads, unless explicitly approved by data classification policy. Memory clear must be confirmable, scoped, and audited.

If using an AI provider API, configure retention controls appropriate to CUAC's risk level. For high-sensitivity flows, prefer endpoints and organization settings that do not retain content beyond request processing where available and contractually approved.

## 19. Backend Implementation Sequence

Backend implementation should start now, but only after this security baseline is accepted as the governing architecture.

### Phase 1: Foundation

Deliverables:

- choose production database: recommended PostgreSQL for transactional core;
- define Drizzle/Prisma schema source of truth;
- implement `users`, `auth_sessions`, `user_roles`, `school_staff_memberships`;
- implement `schools`, `programs`, `scholarships`, `cities`;
- implement centralized policy middleware;
- implement audit log table and audit writer;
- implement catalog read APIs.

Security gates:

- no Agent database access;
- no school tenant data in public catalog API;
- direct-ID authorization tests;
- log redaction tests.

### Phase 2: Student Application Core

Deliverables:

- student profile;
- saved items;
- application sets;
- application choices;
- fee preview;
- payment status records;
- school application creation after paid/not-required state;
- notifications.

Security gates:

- server-side fee calculation;
- idempotent submit;
- payment status cannot be faked by client;
- school records created only after entitlement;
- student consent stored before school disclosure.

### Phase 3: School Tenant Portal

Deliverables:

- school staff invites;
- tenant-scoped application queue;
- applicant detail projection;
- status events;
- contact logs;
- owner assignment;
- tenant export jobs.

Security gates:

- school staff cannot read other tenant records;
- school staff cannot infer other selected schools;
- export is scoped, short-lived, and audited;
- RLS policy tests pass if PostgreSQL is used.

### Phase 4: Agent MVP

Deliverables:

- Agent conversations and messages;
- Retrieval Gateway for public catalog and scoped private summaries;
- Tool Gateway;
- action registry;
- action preview endpoint;
- action execute endpoint;
- Agent audit events;
- prompt injection regression tests.

Security gates:

- Agent can search/explain/navigate without sensitive authority;
- Agent actions use same domain services as manual UI;
- no raw payment or high-sensitive document data in prompt, logs, memory, or vector index;
- high-risk actions require confirmation;
- model-generated tenant IDs, URLs, and SQL are ignored or rejected.

### Phase 5: Payments And Ops Hardening

Deliverables:

- hosted payment provider integration;
- webhook verification;
- reconciliation job;
- refunds with approval;
- Ops support access sessions;
- governed analytics metric registry;
- incident-response runbooks.

Security gates:

- PCI scope minimized through hosted payment fields/checkout;
- webhook signature tests;
- refund audit tests;
- Ops support reason required;
- analytics Agent cannot run arbitrary SQL.

## 20. Required Tests And Reviews

Before production launch:

- authorization tests for every API route;
- tenant isolation tests for school portal queries and exports;
- Agent action policy tests for low, medium, high, and prohibited actions;
- prompt injection tests with malicious catalog/student/school text;
- payment idempotency and webhook signature tests;
- log redaction tests;
- data classification review for every table and DTO;
- RAG index content review;
- privacy consent and disclosure-record review;
- incident-response tabletop for Agent overreach, tenant leak, payment issue, and account takeover.

Suggested verification baseline:

- OWASP ASVS Level 2 for the web application core;
- OWASP LLM Top 10 control mapping for Agent features;
- PCI SAQ A-style hosted payment integration where possible;
- PostgreSQL RLS tests for tenant-scoped tables if PostgreSQL is selected;
- NIST AI RMF-style risk register and lifecycle review for Agent features.

## 21. Architecture Decisions

These decisions should be treated as binding unless later changed through an explicit architecture decision record.

1. Agent has no direct database access.
2. Agent has no raw payment data access.
3. Agent has no high-sensitive document access in MVP.
4. Payment credentials are collected only by the payment provider through hosted checkout or hosted fields.
5. PostgreSQL is the recommended transactional primary store.
6. School portal reads from `school_applications`, not directly from `application_sets`.
7. All school staff data access is tenant-scoped server-side.
8. Agent retrieval has public and scoped-private lanes.
9. Vector stores exclude raw payment data, secrets, documents, and unrestricted application records.
10. Agent actions require action registry, policy decision, preview, confirmation when needed, domain-service execution, and audit.
11. Analytics Agent uses governed metrics, not arbitrary SQL.
12. CUAC Ops cross-tenant access requires role, support reason, and immutable audit.

## 22. Immediate Next Documents

After this baseline, create the following implementation artifacts:

- `CUAC_BACKEND_IMPLEMENTATION_PLAN.md`
- `CUAC_AGENT_TOOL_REGISTRY_SPEC.md`
- `CUAC_DATA_CLASSIFICATION_REGISTER.md`
- `CUAC_BACKEND_SECURITY_TEST_PLAN.md`
- first database migration or schema file for the selected backend stack.

Do not start broad backend implementation until the architecture decisions in this document are accepted or deliberately revised.
