# CUAC Backend Foundation Schema And API Contract

Date: 2026-08-26

Student-core update: 2026-09-01. Independent applicant basics and multiple education records and private exam reports now have separate tables and versioned owner-only APIs; full consent/submission is still gated. See [assessment contract](CUAC_ASSESSMENT_RECORDS_CONTRACT.md) and [applicant and consent contract](CUAC_APPLICANT_PROFILE_AND_CONSENT_CONTRACT.md).

Notice update: independent notice scopes, immutable versions and explicit publications now support internal prepare/review/publish/withdraw and one public read route. Stored governance data is ops_confidential; only a checked public_notice projection is exposed. No student consent or private-data disclosure is enabled. See [notice publication contract](CUAC_NOTICE_PUBLICATION_CONTRACT.md).

Status: Phase 0/1 foundation contract; stable enough for backend schema and public read API implementation.

Related documents:

- `CUAC_BACKEND_ADR_0001_PHASE0_1_FOUNDATION.md`
- `CUAC_BACKEND_PHASE0_1_EXECUTION_BACKLOG.md`
- `CUAC_DATABASE_ERD_SPEC.md`
- `CUAC_APPLICATION_API_CONTRACT.md`
- `CUAC_LEGACY_FIELD_MAPPING_SPEC.md`

## 1. Purpose

This document narrows the larger ERD and API contract to the objects that are stable enough for immediate Phase 0/1 implementation.

The admin panel is still being productized. Therefore, this contract deliberately avoids unstable Ops write APIs and page-specific admin payloads.

## 2. Stable Foundation Objects

Phase 0/1 stable objects:

- `users`
- `auth_identities`
- `auth_sessions`
- `user_roles`
- `school_staff_invites`
- `school_staff_memberships`
- `cuac_staff_access_grants`
- `sign_in_continuations`
- `audit_logs`
- `cities`
- `schools`
- `programs`
- `program_intakes`
- `program_requirement_versions`
- `program_requirement_publications`
- `privacy_notice_scopes`
- `privacy_notice_versions`
- `privacy_notice_publications`
- `scholarships`
- `program_scholarships`
- `catalog_source_evidence`
- `student_profiles`
- `student_applicant_profiles`
- `student_education_histories`
- `student_education_records`
- `student_assessment_histories`
- `student_assessment_records`
- `saved_items`
- `application_sets`
- `application_choices`
- `school_applications`

Implementation note:

- `student_profiles`, `saved_items`, `application_sets`, `application_choices`, and `school_applications` may be schema-defined in Phase 1 if the team wants the core relationship locked early.
- Only public catalog APIs and identity/policy/audit foundation should be actively exposed first.
- Do not expose full application submission, school portal writes, billing, or Agent execute until later gates pass.

## 3. Schema Invariants

### Identity

- `users` is the base account table for all human and service identities.
- `user_roles` stores global roles only.
- school authority is stored in `school_staff_memberships`.
- CUAC internal authority requires `cuac_staff_access_grants`.
- selected surface is stored on session for UX and routing context, not for permission by itself.

### Catalog

- `schools`, `programs`, `scholarships`, and `cities` preserve CSCAlite canonical fields.
- physical DB columns may use snake_case.
- API DTO fields must use camelCase and preserve CSCAlite names.
- aliases such as `name`, `deadline`, `university`, and `tuition` are additive display fields.
- every imported catalog row should have source metadata or explicit pending status.
- Requirements are versioned per program intake, with an explicit publication pointer and revision. Read only an approved, effective, unexpired version with bound independent-review evidence; never fall back to another version or legacy text. 0017 adds preparer identity and strict review evidence, leaving old values intact but hiding legacy approvals from public reads. Internal prepare/approve/publish/withdraw services enforce live roles, per-intake locks, content/time binding, CAS and atomic audits. No Ops/Agent write API is enabled. Hashes and human attestations do not independently establish official authenticity or DB immutability; real source governance, production ACLs and automated eligibility remain separate. See [requirements](CUAC_PROGRAM_REQUIREMENTS_CONTRACT.md) and [governance](CUAC_PROGRAM_REQUIREMENT_GOVERNANCE_CONTRACT.md) contracts.

### Student Core

- `student_profiles.user_id` is unique.
- `student_applicant_profiles.user_id` is unique; its positive revision is independent of preferences and application-set revision. Current basics are not an immutable submission version or consent.
- `student_education_histories.user_id` is the owner primary key; its positive collection revision is independent of applicant and application-set revisions. Records belong to this header, not to an application school. Removal clears all nine education fields and retains the ID/version; no inference from preferences, and no automatic sharing with schools or Agent tools. See [education contract](CUAC_EDUCATION_HISTORY_CONTRACT.md).
- `student_assessment_histories.user_id` owns an independent positive revision; records retain raw textual score components, explicit scales/report types and civil dates. No automatic score calculation or verification status promotion is allowed. The four owner-only API methods use student_action/session authority; three writes share account/role/collection locks with atomic metadata-only audit. Removal erases all eight content fields and retains fixed identity. No inference, school disclosure or Agent tool is enabled; see [assessment contract](CUAC_ASSESSMENT_RECORDS_CONTRACT.md).
- Active `saved_items` is unique by `user_id`, `entity_type`, `entity_id`; removed items do not occupy the active key.
- `application_sets.user_id` belongs to one student account, not a required student_profiles row.
- `application_choices` belongs to one owner-scoped set and school; a concrete target binds one program and intake. Legacy incomplete drafts remain incomplete and cannot become formal applications without validated targets.
- `school_applications` is the school-safe projection created later after paid/not-required submission.
- school staff reads `school_applications`, not raw `application_sets`.
- school staff and Agent tools do not read current applicant profiles education history or assessment records. Per-program snapshots and scoped consent must be implemented before disclosure.

### Audit

- `audit_logs` is append-only.
- audit captures policy decision ID and request ID.
- audit stores data classes disclosed.
- audit may store redacted snapshots or hashes, not raw secrets/payment credentials.

## 4. Foundation API Surface

Expose first:

```text
GET /api/v1/health
GET /api/v1/me
GET /api/v1/programs
GET /api/v1/programs/:programId
GET /api/v1/schools
GET /api/v1/schools/:schoolId
GET /api/v1/scholarships
GET /api/v1/scholarships/:scholarshipId
GET /api/v1/cities
GET /api/v1/cities/:citySlug
```

Implement after auth foundation:

```text
POST /api/v1/auth/register
POST /api/v1/auth/sessions
POST /api/v1/auth/sign-in-continuations
POST /api/v1/auth/sign-in-continuations/:continuationId/consume
GET /api/v1/student/profile
PATCH /api/v1/student/profile
GET /api/v1/saved-items
POST /api/v1/saved-items
DELETE /api/v1/saved-items/:savedItemId
```

Contract-only for now:

```text
POST /api/v1/application-sets
POST /api/v1/application-sets/:applicationSetId/choices
GET /api/v1/application-sets/:applicationSetId/fee-preview
POST /api/v1/application-sets/:applicationSetId/submit
POST /api/v1/payments
POST /api/v1/payment-webhooks/:provider
GET /api/v1/school/applications
POST /api/v1/school/applications/export
POST /api/v1/agent/actions/:actionKey/preview
POST /api/v1/agent/actions/:actionKey/execute
POST /api/v1/analytics/query
```

Do not expose the contract-only routes until their security gates are implemented.

## 5. Public Catalog DTO Requirements

### Program List Item

Must include:

- `id`
- `schoolId`
- `nameZh`
- `nameEn`
- `degreeLevel`
- `fieldCategory`
- `teachingLanguage`
- `tuitionAmount`
- `tuitionCurrency`
- `tuitionPeriod`
- `tuitionText`
- `deadlineDate`
- `deadlineLabel`
- `applicationRound`
- `applicationUrl`
- `applicationNote`
- `sourceUrl`
- `sourceLabel`
- `lastVerifiedAt`
- `sourceStatus`
- `status`
- `isVerified`
- `hasScholarship`
- `sourceFieldLineage`

May include display aliases:

- `name`
- `university`
- `deadline`
- `tuition`
- `displayTuition`
- `displaySubjects`

Must not include:

- student saved state unless authenticated and explicitly requested through student-scoped adapter;
- application set data;
- school tenant queue data;
- Ops private notes.

### School List Item

Must include:

- `id`
- `slug`
- `nameZh`
- `nameEn`
- `schoolType`
- `region`
- `city`
- `cityZh`
- `citySlug`
- `applicationLevel`
- `languageOfInstruction`
- `deadlineSummary`
- `tuitionSummary`
- `applicationFee`
- `officialWebsiteUrl` or `websiteUrl`
- `admissionsWebsiteUrl` or `admissionsUrl`
- `sourceUrl`
- `sourceLabel`
- `lastVerifiedAt`
- `verificationStatus`
- `sourceStatus`
- `status`
- `sourceFieldLineage`

May include aggregate fields:

- `programCount`
- `englishProgramCount`
- `scholarshipCount`
- `upcomingDeadlines`

Must not include:

- staff memberships;
- school application queue;
- private tenant settings;
- raw internal Ops notes.

### Scholarship List Item

Must include:

- `id`
- `slug`
- `title`
- `type`
- `typeLabel`
- `fundingLevel`
- `providerName`
- `providerNameEn`
- `providerLocation`
- `schoolId`
- `programId`
- `coverage`
- `amountText`
- `requirementText`
- `benefitItems`
- `eligibilityItems`
- `applicationMaterials`
- `applicationSteps`
- `actionLinks`
- `deadlineDate`
- `deadlineLabel`
- `applicationRound`
- `targetCountries`
- `targetRegions`
- `sourceUrl`
- `sourceLabel`
- `lastVerifiedAt`
- `sourceStatus`
- `summary`

Must distinguish:

- public scholarship catalog records;
- school-specific funding signals later used in school handoff.

### City List Item

Must include:

- `slug`
- `nameZh`
- `nameEn`
- `region`
- `province`
- `monthlyCost`
- `monthlyCostRmb`
- `costLevel`
- `density`
- `tags`
- `content`
- `nearby`
- `references`
- `actualSchoolCount`
- `actualProgramCount`
- `actualEnglishProgramCount`
- `actualScholarshipCount`
- `actualCscaRequiredSchoolCount`
- `status`
- `sortOrder`
- `version`
- `updatedAt`

Aggregate counts should be derived or clearly snapshotted.

## 6. Security Rules For Foundation APIs

- Public catalog endpoints may be accessed by guests.
- Public catalog endpoints must not return student, payment, school tenant, or Ops private data.
- Authenticated-only endpoints must ignore client-supplied `userId` as authority.
- Every request gets `requestId`.
- Every policy decision gets `policyDecisionId`.
- Errors follow the structured API contract.
- General logs are redacted.
- Sensitive denials are audit-ready.

## 7. Deferred API Decisions

These areas depend on frontend/admin productization or later security gates:

| Area | Why Deferred |
| --- | --- |
| Ops Admin write APIs | Admin panel information architecture is still being refined |
| School data publish workflows | Need final admin/editor UX and approval model |
| Student application admin actions | Need clear Ops action set before API design |
| Queue APIs | Need stable queue taxonomy: payment, routing, data review, tenant follow-up, Agent audit |
| Agent action execute | Manual domain APIs and Tool Gateway policy must exist first |
| Payment webhooks/refunds | Hosted payment provider and billing policy must be locked |
| File upload | Out of MVP and high-sensitive document service needs separate design |

## 8. Phase 1 Completion Evidence

Phase 1 foundation is complete only when:

- schema source of truth exists;
- first migration creates identity, tenant, audit, and catalog tables;
- public catalog APIs return CSCAlite-compatible DTOs;
- deny-by-default policy middleware is used by protected endpoints;
- object ownership and tenant helper tests exist;
- audit writer and log redaction tests exist;
- README and production index identify the foundation contract as the Phase 0/1 execution boundary.
