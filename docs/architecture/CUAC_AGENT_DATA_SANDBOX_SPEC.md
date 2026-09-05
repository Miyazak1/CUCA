# CUAC Agent Data Sandbox Spec

Date: 2026-08-27

Status: required data-isolation architecture for Agent MVP and backend implementation.

Related documents:

- `CUAC_SECURE_AGENT_BACKEND_ARCHITECTURE.md`
- `CUAC_AGENT_CONTEXT_LIFECYCLE_SPEC.md`
- `CUAC_AGENT_CANDIDATE_CAPACITY_CONTRACT.md`
- `CUAC_AGENT_MEMORY_MANAGEMENT_CONTRACT.md`
- `CUAC_AGENT_TOOL_REGISTRY_SPEC.md`
- `CUAC_DATA_CLASSIFICATION_REGISTER.md`
- `CUAC_ROLE_PERMISSION_MATRIX.md`
- `CUAC_BACKEND_SECURITY_TEST_PLAN.md`

## 1. Purpose

This document defines the Agent data sandbox for CUAC.

The Agent must be helpful without becoming a privileged data browser. It can organize, summarize, recommend, and explain, but it must receive only the data that the current role, persona, tenant, page, and purpose are allowed to use.

The data sandbox is mandatory for MVP because CUAC handles student data, school tenant records, payment status, Agent memory, and future operational data.

## 2. Core Rule

The Agent never accesses raw databases or raw sensitive records.

```text
Agent
  -> registered tool
  -> Tool Gateway
  -> Policy Engine
  -> data sandbox projection
  -> domain service / governed script / metric
```

Never:

```text
Agent
  -> SQL
  -> raw database table
  -> unrestricted record dump
```

The Agent gets prepared projections, not source-of-truth tables.

## 3. Sandbox Layers

CUAC should implement data isolation across six layers.

| Layer | Control | Purpose |
| --- | --- | --- |
| Persona sandbox | active Agent persona | Prevent student, school, and Ops context from mixing |
| Data-class sandbox | data classification allowlist | Prevent sensitive fields from entering prompts, memory, logs, and vectors |
| Tenant sandbox | tenant policy and school-safe views | Prevent cross-school leakage |
| Projection sandbox | role-specific DTOs | Return only prepared fields, not raw rows |
| Retrieval sandbox | retrieval lane and index ACL | Keep RAG scoped and source-approved |
| Memory/cache sandbox | namespace and TTL | Prevent stale, cross-role, guest, or sensitive memory leakage |

Runtime sandbox and Tool Gateway still matter, but this document focuses specifically on data and information access.

## 4. Persona Sandbox

Every Agent request must resolve exactly one active persona.

Required request attributes:

- `user_id` or guest session ID;
- `selected_surface`;
- `active_role`;
- `context_scope`;
- `tenant_school_id` when school-scoped;
- `memory_namespace`;
- `allowed_tool_groups`;
- `data_class_allowlist`;
- `purpose`.

Rules:

- guest persona can use only public catalog and current-page context;
- student persona can use public catalog plus the student's own summaries;
- school staff persona can use only one active school tenant context;
- CUAC Ops persona can use governed platform summaries and audited support context;
- switching role or tenant starts or resumes a separate Agent context;
- a multi-role account cannot merge roles into one Agent context.

## 5. Data-Class Sandbox

Each persona has a default data-class allowlist.

| Persona | Allowed By Default | Requires Extra Policy | Prohibited |
| --- | --- | --- | --- |
| Guest | `public_catalog` | short-lived `low_sensitive_preference` candidates | `student_pii`, `education_record`, `tenant_confidential`, `payment_sensitive`, `secret` |
| Student | `public_catalog`, own `low_sensitive_preference`, own summarized `education_record`, own `payment_business` through Billing Facade | confirmed `student_pii` for application preparation | `payment_sensitive`, `secret`, other students, school tenant private data |
| School staff | `public_catalog`, own `tenant_confidential`, school-visible applicant projection | student PII fields included in the school-visible snapshot after consent | `payment_sensitive`, `secret`, student private memory, other school tenants, other selected schools |
| CUAC Ops | governed summaries, `internal_catalog_metadata`, audited `ops_confidential` | cross-tenant support data with reason and audit | `payment_sensitive`, `secret`, arbitrary raw table dumps |
| Agent service | data returned by current registered tool only | none by default | direct DB data, secrets, payment credentials |

Field-level redaction must run after policy and before model context.

## 6. Projection Sandbox

The backend should create explicit Agent-facing projections.

Recommended projections:

- `PublicCatalogAgentProjection`
- `StudentPreferenceAgentProjection`
- `StudentApplicationSummaryProjection`
- `StudentBillingStatusProjection`
- `SchoolApplicantAgentProjection`
- `SchoolQueueSummaryProjection`
- `OpsDataQualitySummaryProjection`
- `OpsRoutingPaymentSummaryProjection`
- `OpsAgentAuditSummaryProjection`

Projection rules:

- projections are built by domain services or governed scripts;
- projections include data-class metadata;
- projections include source lineage when useful;
- projections do not expose raw database rows;
- projections are versioned;
- projections are tested like APIs.

Example school applicant projection:

```json
{
  "projectionType": "SchoolApplicantAgentProjection",
  "projectionVersion": "1.0",
  "tenantSchoolId": "school_123",
  "schoolApplicationId": "sch_app_456",
  "student": {
    "displayName": "Maya C.",
    "countryRegion": "Malaysia",
    "languageStatus": "IELTS / waiver noted"
  },
  "programInterests": [
    {
      "programId": "program_789",
      "programName": "Computer Science MSc",
      "intake": "Fall 2026"
    }
  ],
  "nextAction": "School should contact student for official documents.",
  "notCollectedByCuac": ["passport", "transcript", "recommendation letters"],
  "dataClasses": ["tenant_confidential", "education_record"],
  "redactionsApplied": ["student.fullName", "otherSchoolChoices"]
}
```

The school projection must never include other schools in the same student application set.

## 7. Retrieval Sandbox

Use separate retrieval lanes:

### Public Retrieval Lane

Allowed:

- schools;
- programs;
- scholarships;
- cities;
- guides;
- product FAQ;
- verified/stale source caveats.

Rules:

- no login required;
- no student records;
- no school tenant records;
- no payment records;
- no Ops private notes;
- safe for vector indexing.

### Student Retrieval Lane

Allowed:

- public catalog;
- own preferences;
- own saved item summary;
- own application summary;
- own checklist state;
- own payment business status through Billing Facade.

Rules:

- requires student persona;
- object ownership checked server-side;
- raw payment credentials prohibited;
- high-sensitive documents prohibited in MVP.

### School Tenant Retrieval Lane

Allowed:

- tenant queue summary;
- school-visible applicant projection;
- tenant templates;
- tenant governed metrics;
- tenant staff workflow summaries.

Rules:

- requires school staff persona;
- requires active `tenant_school_id`;
- uses school-safe projections;
- no direct `application_sets` reads for Agent;
- no other selected schools;
- no student private Agent memory.

### CUAC Ops Retrieval Lane

Allowed:

- governed platform metrics;
- data quality queues;
- routing/payment state summaries;
- Agent audit summaries;
- support case projections with reason.

Rules:

- requires CUAC Ops/Admin role;
- cross-tenant private retrieval requires support reason;
- arbitrary SQL prohibited;
- raw payment credentials and secrets prohibited.

## 8. Tool Sandbox And Data Sandbox Interaction

Every registered tool must declare:

- required persona;
- required role;
- required tenant scope;
- allowed data classes returned;
- projection type returned;
- whether output may enter memory;
- whether output may enter vector index;
- audit level;
- redaction rules.

The Tool Gateway rejects the call if:

- no active persona exists;
- persona does not match tool policy;
- tenant is missing or mismatched;
- requested data class exceeds the allowlist;
- tool output includes prohibited fields;
- the model supplies raw SQL, arbitrary URL, table name, or field list as authority.

## 9. Memory And Cache Sandbox

Memory and cache must be separated by namespace.

Namespace examples:

- guest: ephemeral only, no durable memory namespace;
- student: `user:{user_id}:student`;
- school: `school:{tenant_school_id}:staff`;
- Ops: `ops:{user_id}:audit` or `ops_task:{support_case_id}`.

Rules:

- raw guest working context is not stored as durable memory; closing a page is not a reliable server deletion signal;
- short-lived structured candidates expire by database time and are capped at 12 per verified guest browser binding or 24 per student account;
- guest-to-student carry-forward stores only confirmed structured candidates;
- student memory never enters school staff context;
- school memory never enters student context;
- tenant cache keys include `tenant_school_id`;
- Ops support memory is task/reason scoped;
- cache TTL must match data sensitivity;
- clearing Agent memory does not delete required security audit.

## 10. Logging And Audit Sandbox

General logs must not contain:

- raw prompt payloads with PII;
- payment-sensitive data;
- secrets;
- raw documents;
- unrestricted table dumps;
- tenant data outside redacted IDs.

Audit logs should record:

- active persona;
- role;
- tenant;
- tool key;
- projection type;
- data classes returned;
- redactions applied;
- policy decision;
- support reason when required;
- result status.

Audit stores evidence that the sandbox worked; it is not a place to store full sensitive payloads.

## 11. Prohibited Data Paths

The following paths must not exist:

- Agent to production database credentials;
- Agent to arbitrary SQL;
- Agent to raw payment provider dashboard;
- Agent to card number, CVV, or bank account;
- Agent to object-storage list;
- Agent to raw application set table in school context;
- school Agent to student private memory;
- student Agent to school tenant queues;
- guest Agent to durable account memory;
- vector index to payment, secret, document, or unrestricted application data;
- general logs to raw prompts with sensitive fields.

## 12. Implementation Requirements

Phase 0/1:

- document projection types;
- add data-class fields to tool registry;
- add persona/session contract;
- add security tests for prohibited paths;
- keep implementation contract-only until domain services exist.

Agent MVP:

- implement Tool Gateway;
- implement Retrieval Gateway;
- implement projection builders;
- implement field-level redaction;
- implement namespace-scoped memory;
- implement audit for tool access;
- implement prompt-injection and data-exfiltration tests.

Later:

- add PostgreSQL RLS for tenant-scoped tables;
- add DLP for future document service;
- add anomaly detection for cross-tenant access attempts;
- add periodic sandbox policy review.

## 13. Required Tests

Minimum tests:

- guest cannot read student profile or saved items;
- guest cannot create durable Agent memory;
- student cannot read another student's application summary;
- student cannot read school tenant queue;
- school staff cannot read another tenant;
- school staff cannot see student's other selected schools;
- school staff cannot read student private Agent memory;
- CUAC Ops private cross-tenant retrieval requires support reason;
- Agent cannot request arbitrary SQL;
- Agent cannot request raw table export;
- tool output redaction removes prohibited fields;
- vector index rejects prohibited data classes;
- cache keys include persona and tenant;
- memory namespaces do not mix across role switches;
- audit records projection type, data class, redaction, and policy decision.

## 14. Acceptance Rule

An Agent feature is not accepted unless it names:

- active persona;
- allowed data classes;
- projection type;
- registered tools;
- retrieval lane;
- memory namespace;
- redaction rules;
- audit behavior;
- prohibited paths and tests.

If any of these are missing, the feature remains architecture-incomplete.
