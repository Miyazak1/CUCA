# CUAC Data Classification Register

Date: 2026-09-01

Status: initial data classification register for backend, Agent, logging, retrieval, and audit.

Primary architecture baseline: `CUAC_SECURE_AGENT_BACKEND_ARCHITECTURE.md`

## 1. Purpose

This register classifies CUAC data before backend implementation. It should be used when designing tables, DTOs, logs, Agent retrieval, vector indexes, exports, and analytics.

## 2. Classification Levels

| Class | Meaning | Agent Access | Log Policy | Vector Index Policy |
| --- | --- | --- | --- | --- |
| `public_catalog` | Published schools, programs, scholarships, cities, public guides | Allowed | OK with source metadata | Allowed |
| `public_notice` | Exact active, effective, reviewed notice projection | No notice tool registered; never an authorization to read student data | Prefer version/digest only | No notice index enabled |
| `internal_catalog_metadata` | quality score, review state, source workflow, Ops-only catalog notes | Role-restricted | Redact Ops notes from general logs | Usually excluded |
| `low_sensitive_preference` | target country, degree, subject interests, budget band, city preference | Student-scoped | Redact user ID or hash | Summary only |
| `student_pii` | name, email, phone, nationality, date of birth, address | Minimized, policy-gated | Redact or hash | Excluded unless separately approved |
| `education_record` | profile/application details tied to a student and school disclosure | Student-owned or tenant-scoped | Audit disclosure, redact general logs | Excluded from public index; scoped summaries only |
| `high_sensitive_document` | passport, transcript, recommendation, medical, visa/JW files | Prohibited in MVP | Do not log | Excluded |
| `payment_sensitive` | PAN, CVV, bank account, raw payment credential | Prohibited | Do not collect or log | Excluded |
| `payment_business` | invoice, amount, currency, status, provider payment ID | Billing Facade only | Redact provider details as needed | Excluded |
| `tenant_confidential` | school queue, applicant detail, templates, staff membership | Tenant-scoped | Audit exports and status changes | Scoped summaries only |
| `ops_confidential` | support notes, risk flags, internal routing/payment investigations | CUAC Ops only with reason | Audit access | Excluded |
| `secret` | API keys, signing secrets, DB credentials, OAuth secrets | Prohibited | Do not log | Excluded |
| `audit_security` | audit logs, policy decisions, incident evidence | Read through audited tools only | Immutable audit store | Excluded |

## 3. MVP Field Classification

### Identity

| Field | Class | Notes |
| --- | --- | --- |
| `users.id` | student_pii when linked to person | Use opaque UUIDs |
| `users.email` | student_pii | Redact in logs |
| `users.display_name` | student_pii | Optional |
| `auth_sessions.session_token_hash` | secret | Hash at rest |
| `user_roles.role` | tenant_confidential | Avoid exposing internal roles to public client |

### Catalog

| Field | Class | Notes |
| --- | --- | --- |
| `schools.name_en`, `schools.name_zh` | public_catalog | Public |
| `schools.application_fee` | public_catalog | Display cautiously as source-dependent |
| `schools.quality_score` | internal_catalog_metadata | Do not show raw score on student pages |
| `schools.source_url`, `source_label` | public_catalog | Useful for Agent citation |
| `programs.deadline_date`, `tuition_text` | public_catalog | Include freshness |
| `catalog_source_evidence.internal_note` | internal_catalog_metadata | Ops only |
| `program_requirement_versions.content_json`, `content_sha256`, `version` | internal_catalog_metadata until approved and explicitly published | Public only through the active, effective, unexpired intake projection; no automatic rule evaluation |
| `program_requirement_versions.prepared_by_user_id`, `approved_by_user_id`, `review_evidence_json`, `review_status` | internal_catalog_metadata; actor IDs also link to people | Internal role/purpose only; never expose identities or attestations in public DTO/Agent tools; referenced actor deletion/retention requires separate governance |
| Public requirement sources, rule text, stage, applicability and revision | public_catalog after the publication checks | Untrusted citation data, not instructions or a student eligibility result; no new Agent tool/index is enabled |
| `privacy_notice_scopes`, `privacy_notice_versions`, `privacy_notice_publications` stored content, actors and review evidence | ops_confidential | Internal notice_management authority; approval/publication/withdrawal additionally require admin step_up; retain actor references under separate governance |
| Published notice purpose/locale/version, explicit publication revision, effective times and plain-text document | public_notice only after full publication/digest/review checks | Public read does not create consent; draft bodies, internal reviewers and review references are never in this DTO; no language or version fallback |
| Per-choice preparation report: owned target/window, applicant field-presence flags, education/assessment revisions/counts, public publication references and minimal authorization/snapshot status | student_pii and education_record, combined with public_catalog/public_notice | Only active student persona with all four classes; authorization and snapshot projections are limited to IDs/time/current state, with no raw values, selected IDs, digests, ciphertext/key material, payment data or internal reviewers; no Agent tool/index |

Requirement URLs are never fetched by the reader or governance service. Syntax checks, hashes and stored human attestations do not independently establish official authenticity or remove PII embedded in prose. The internal service requires independent review and exact source/scope/public-content confirmation; real source preservation/review procedures and production access controls remain gates. Raw student values must not populate catalog requirement text. Mutation audit includes only IDs, hashes, revisions and enum reasons, not source URLs, prose or attestation payloads. See [requirements contract](CUAC_PROGRAM_REQUIREMENTS_CONTRACT.md) and [governance contract](CUAC_PROGRAM_REQUIREMENT_GOVERNANCE_CONTRACT.md).

### Student

The following student fields reflect the implemented 2026-08-31 schema. Other sections retain design-stage fields until their own module contracts replace them. See [applicant profile and consent contract](CUAC_APPLICANT_PROFILE_AND_CONSENT_CONTRACT.md).

| Field | Class | Notes |
| --- | --- | --- |
| `student_profiles.display_name`, `citizenship_country` | student_pii | Preferences/profile surface; not verified applicant identity |
| `student_profiles.target_degree_level`, `target_intake`, `preferences_json` | low_sensitive_preference | Only approved structured projections may reach Agent tools |
| `student_applicant_profiles.id`, `user_id`, `revision` | student_pii when linked to person | Owner-scoped; revision is concurrency control, not a content history |
| `student_applicant_profiles.full_name` | student_pii | Self-reported application name, not copied from nickname or Agent memory |
| `student_applicant_profiles.contact_email` | student_pii | Unverified application contact; never changes login or reset identity |
| `student_applicant_profiles.citizenship_country` | student_pii | Format validation only, not nationality verification |
| `student_education_histories.user_id`, `revision` | education_record | Owner-scoped collection version, independent of applicant and application-set versions |
| `student_education_records.id`, `user_id` | education_record | Stable owner-scoped identity; removed IDs cannot identify a replacement record |
| `student_education_records.institution_name`, `institution_country`, `education_level`, `qualification_name`, `field_of_study` | education_record | Self-reported education, not verified attainment; no inference from selection preferences |
| `student_education_records.attendance_status`, `start_year`, `end_year`, `expected_completion_year` | education_record | Unknown and expected values remain explicit; no automatic eligibility decisions |
| `student_assessment_histories.user_id`, `revision` | education_record | Independent owner-scoped exam collection version; not an application or consent version |
| `student_assessment_records` identity, report type/dates and components_json | education_record | Private self-reported exam data; no score conversion, verification claim, Agent index or current school projection |

The entire applicant profile is excluded from Agent tools, vector indexes, public catalog, Ops reads and live school-portal queries in this phase. General logs and audit metadata must not contain its values. The implemented owner-only encrypted snapshot is version-bound and field-limited per program, but it grants no school disclosure by itself; formal submission authority and a tenant-safe projection are still required. An account role alone is insufficient. Retention, backup access, erasure and minor/guardian handling must be approved before production use.

The same exclusion applies to current education history. Its owner-only API requires education_record authority; removal wipes all nine education fields but retains the ID, owner, timestamps and collection revision. Audit metadata contains only field names and the new revision. This is current-row erasure, not deletion of all audit, WAL or backup history. No new Agent tool or school projection is authorized. See [education history contract](CUAC_EDUCATION_HISTORY_CONTRACT.md).

Assessment records use the same exclusion and additionally require student_action, student surface and explicit session/step_up authority. The owner response always marks evidenceStatus=unverified; current grades, score scales, dates and exam names never enter mutation audit metadata. Removal clears all eight content fields while retaining version and fixed identity. No credential/report number is accepted. Approved subsets may enter the implemented per-program encrypted snapshot only after explicit selection and authorization; no school/Agent reader exists. See [assessment contract](CUAC_ASSESSMENT_RECORDS_CONTRACT.md).

### Applications

| Field | Class | Notes |
| --- | --- | --- |
| `application_sets.status` | education_record | Student-owned |
| `application_choices.school_id`, `program_id` | education_record | Student-owned until submission; school projection after submit |
| `application_choices.student_note` | education_record | Treat as untrusted text for Agent |
| `application_material_selections.selection_json`, source revisions | student_pii / education_record | Owner-only metadata; selected field/record references reveal application content intent. Excluded from logs, Agent, public and school reads |
| `application_submission_authorizations` target, selection/source revisions, digests, notice evidence and lifecycle | student_pii / education_record / audit_security | Owner-only evidence management and bounded preflight projection. No material bodies; no school, Agent, Billing, vector-index or public access. Retention/erasure requires explicit governance |
| `application_material_snapshots` target/version/digests plus authenticated encrypted envelope | student_pii / education_record / audit_security; encryption key is secret | Owner-only create/read evidence and bounded preflight projection. Plaintext is never stored as a second column or returned by API; no school, Ops, Agent, Billing, vector-index or public access. KMS, key rotation/recovery, retention, erasure and backup controls remain production gates |
| `school_applications.school_visible_student_snapshot_json` | education_record / tenant_confidential | Tenant-scoped |
| `school_application_status_events` | tenant_confidential | Student-visible subset only |
| `application_sets.cuac_id` | education_record when resolved to an application; external reference alone is not a secret | Exact owner, tenant, or governed Ops support-session lookup only; never treat possession as authorization |
| `ops_support_access_sessions` identity, grant/application binding, reason and lifecycle | ops_confidential / audit_security | CUAC Ops only; maximum 15 minutes, bound to exact actor/role/grant/Application Set/CUAC ID. Excluded from Agent, public, school and vector-index access |
| Ops application-support DTO | ops_confidential plus public_catalog | Support-session-bound exact application only; limited status/catalog projection with fixed reason and audit. Excludes applicant profile, education/assessment values, materials, files, payments, auth and internal evidence |

### Payments

| Field | Class | Notes |
| --- | --- | --- |
| `payments.provider_payment_id` | payment_business | Not a credential, but still restrict |
| `payments.amount_cents`, `currency`, `status` | payment_business | Agent can summarize through Billing Facade |
| `payments.fee_rule_snapshot_json` | payment_business | Useful for receipt and audit |
| raw card number / CVV / bank account | payment_sensitive | Must not exist in CUAC DB |

### Agent

| Field | Class | Notes |
| --- | --- | --- |
| `agent_conversations.context_scope` | audit_security | Drives memory policy |
| `agent_messages.content` | mixed | Classify at ingestion; avoid raw PII in durable messages where possible |
| `agent_memory_entries.summary` | mixed | Prefer low-sensitive summaries |
| `agent_context_candidates.summary` | mixed | Short-lived carry-forward candidate; expires quickly unless accepted |
| `agent_actions.input_snapshot_json` | audit_security / mixed | Redact forbidden fields |
| `agent_actions.output_snapshot_json` | audit_security / mixed | Redact forbidden fields |

## 4. Default Handling Rules

- URLs must not contain sensitive fields, payment references, tokens, or PII.
- Logs must default to redacted payloads.
- Agent prompts must receive minimized DTOs, not raw database rows.
- Vector indexes must store only approved public knowledge and scoped summaries.
- Exports must declare data classes and write audit logs.
- Support access must require purpose and record data classes disclosed.
- If classification is unclear, treat the field as more sensitive until reviewed.

## 5. Review Workflow

Before adding a table, field, API response, Agent tool, export, or analytics metric:

1. Assign a data class.
2. Define allowed roles.
3. Define allowed Agent access.
4. Define log behavior.
5. Define retention behavior.
6. Define whether it can be indexed for search or vector retrieval.
7. Define audit triggers.

This register should be updated with every schema migration.
