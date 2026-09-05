# CUAC Agent Tool Registry Spec

Date: 2026-08-25

Status: initial production Agent tool registry design.

Primary architecture baseline: `CUAC_SECURE_AGENT_BACKEND_ARCHITECTURE.md`

Data sandbox baseline: `CUAC_AGENT_DATA_SANDBOX_SPEC.md`

## 1. Purpose

This document defines the tools the CUAC Agent may call in production and the policy metadata required for each tool.

The Agent may reason and propose. It may not directly read databases, call payment providers, run SQL, open arbitrary URLs, or mutate records outside the registered tool system.

The Agent is an information organization and expression layer. Tool outputs must come from CUAC domain services, governed metrics, or preapproved scripts. The Agent can summarize and explain those outputs, but it cannot invent authoritative data, metrics, permissions, or workflow state.

## 2. Registry Schema

Each tool must be registered with:

- `tool_key`
- `description`
- `owner_service`
- `allowed_roles`
- `allowed_surfaces`
- `required_scope`
- `input_schema`
- `output_schema`
- `data_classes_returned`
- `projection_type`
- `memory_write_allowed`
- `vector_index_allowed`
- `risk_level`
- `confirmation_required`
- `idempotent`
- `mutates_state`
- `rate_limit`
- `audit_level`
- `prohibited_fields`

Risk levels:

- `low`: navigation, filtering, public explanations.
- `medium`: saved state, application choice edits, profile field updates.
- `high`: submission, exports, staff invites, Ops support, refunds, memory clear.
- `prohibited`: raw credentials, secrets, cross-tenant access, unrestricted SQL.

## 3. Initial Allowed Tools

### `catalog.search_programs`

- Owner: Catalog Service
- Roles: guest, student, cuac_ops
- Scope: public catalog
- Risk: low
- Returns: public catalog fields, source freshness labels
- Never returns: student PII, tenant data, payment data, Ops notes

### `catalog.get_program_detail`

- Owner: Catalog Service
- Roles: guest, student, school_staff, cuac_ops
- Scope: public catalog
- Risk: low
- Returns: program detail, school summary, intakes, scholarship links, source evidence
- Never returns: unpublished Ops-only notes unless CUAC Ops role requests an Ops endpoint

### `catalog.search_scholarships`

- Owner: Catalog Service
- Roles: guest, student, cuac_ops
- Scope: public catalog
- Risk: low
- Returns: scholarship summary, eligibility text, deadlines, source labels

### `navigation.open_route`

- Owner: Web API
- Roles: guest, student, school_staff, cuac_ops
- Scope: current surface
- Risk: low
- Input: `route_id`, typed route params
- Never accepts: arbitrary external URL from model output

### `student.get_preference_summary`

- Owner: Student Service
- Roles: student
- Scope: own student account
- Risk: low
- Returns: low-sensitive preference summary
- Never returns: raw documents, payment data, other users

### `student.update_preference`

- Owner: Student Service
- Roles: student
- Scope: own student account
- Risk: medium
- Mutates: yes
- Confirmation: inline or undoable
- Audit: metadata

### `saved_items.add`

- Owner: Student Service
- Roles: student
- Scope: own student account
- Risk: medium
- Mutates: yes
- Idempotent: yes

### `application.add_choice`

- Owner: Application Service
- Roles: student
- Scope: own draft application set
- Risk: medium
- Mutates: yes
- Idempotent: yes
- Requires: selected program/school exists and is eligible for current application set state

### `application.get_fee_preview`

- Owner: Application Service / Billing Facade
- Roles: student
- Scope: own application set
- Risk: low
- Returns: server-calculated fee preview
- Never accepts: client-calculated total as authority

### `billing.create_hosted_checkout_link`

- Owner: Billing Facade
- Roles: student
- Scope: own application set
- Risk: high
- Confirmation: required if it starts a payable flow
- Returns: provider-hosted payment URL, expiry, amount, currency
- Never returns: card number, CVV, bank account, provider secret

### `billing.get_payment_status`

- Owner: Billing Facade
- Roles: student, cuac_ops
- Scope: own payment or audited Ops support scope
- Risk: low for own student, high for Ops support lookup
- Returns: payment status, invoice ID, provider reference
- Never returns: raw payment credentials

### `application.submit`

- Owner: Application Service
- Roles: student
- Scope: own application set
- Risk: high
- Confirmation: required
- Idempotent: yes
- Requires: consent, complete required fields, paid/not-required payment state
- Creates: school-scoped application records

### `school.queue_summary`

- Owner: School Portal Service
- Roles: school_staff
- Scope: own school tenant
- Risk: low
- Returns: tenant-scoped queue summary
- Never returns: other selected schools in a student's application set
- Source: School Portal Service script or governed tenant query, not Agent-generated SQL

### `school.applicant_summary`

- Owner: School Portal Service
- Roles: school_staff
- Scope: own school tenant
- Risk: low/medium depending on included fields
- Returns: school-visible applicant projection and missing-follow-up summary
- Source: school-safe projection plus predefined summarization script
- Never returns: other selected schools, student private Agent memory, raw application set, payment details for other schools

### `school.update_application_status`

- Owner: School Portal Service
- Roles: school_staff
- Scope: own school tenant
- Risk: high when external/student-visible, medium for internal review state
- Confirmation: required for student-visible or bulk change
- Audit: full action

### `school.export_applications`

- Owner: School Portal Service
- Roles: school_staff
- Scope: own school tenant
- Risk: high
- Confirmation: required
- Returns: short-lived export job reference
- Audit: full action with data classes exported

### `agent.clear_memory`

- Owner: Agent Service
- Roles: student, school_staff, cuac_ops
- Scope: current allowed memory namespace
- Risk: high
- Confirmation: required
- Audit: full action

### `analytics.query_governed_metric`

- Owner: Analytics Service
- Roles: school_staff, cuac_ops
- Scope: school tenant or Ops governed metric
- Risk: medium/high depending on scope
- Input: metric key, filters
- Never accepts: arbitrary SQL
- Source: metric registry, semantic layer, or preapproved analysis script

### `ops.data_quality_summary`

- Owner: Ops/Admin Service
- Roles: cuac_ops
- Scope: governed Ops queue
- Risk: medium
- Returns: stale, pending, disputed, missing-field, and broken-source summaries from validation jobs
- Never accepts: arbitrary SQL or page-shaped admin filters as authority

### `ops.agent_audit_summary`

- Owner: Audit Service
- Roles: cuac_ops
- Scope: governed audit summary with reason when private
- Risk: high if cross-tenant/private
- Returns: redacted Agent action/audit patterns
- Never returns: raw prompts with PII, secrets, raw payment data, unrestricted audit table dumps

## 4. Prohibited Tools

These tools must not exist in production:

- `database.run_sql`
- `database.export_table`
- `payment.read_card_number`
- `payment.read_cvv`
- `payment.charge_raw_card`
- `secrets.get`
- `env.read`
- `browser.open_arbitrary_url`
- `school.read_other_tenant`
- `student.read_any_profile`
- `audit.delete`
- `agent.define_metric_from_prompt`
- `agent.decide_admission`
- `agent.override_payment_state`
- `agent.override_application_state`

If a future requirement appears to need one of these, create a new domain-specific safe tool instead.

## 5. Execution Contract

Every tool call must include:

- authenticated user or guest context;
- resolved role;
- selected surface;
- context scope;
- active Agent persona;
- memory namespace;
- resolved tenant if applicable;
- conversation ID;
- action/tool key;
- request ID;
- policy decision ID;
- input hash;
- output data classes;
- audit level.

The Tool Gateway must re-run policy checks immediately before execution. Preview approval is not enough for execute approval.

## 6. Test Fixtures

Minimum test cases:

- guest can search catalog but cannot save or submit;
- student can add a choice only to their own draft application set;
- student cannot create payment link for another student's application set;
- school staff cannot query another school tenant;
- school staff export is audited and tenant-scoped;
- Agent cannot call a missing or unregistered tool;
- Agent cannot pass arbitrary SQL through analytics;
- Agent cannot define a new metric from a prompt;
- school summaries are based on scripted school-safe projections;
- Ops summaries are based on governed metric/script outputs;
- prompt-injected program text cannot trigger `application.submit`;
- model-generated external URL is rejected by `navigation.open_route`.
