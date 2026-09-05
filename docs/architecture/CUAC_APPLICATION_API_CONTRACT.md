# CUAC Application API Contract

Date: 2026-08-14

Status: production API design draft.

Decision update (2026-09-02): one concrete program choice produces one independent school application, including when several programs belong to the same school. This is not a school-level merge. The internal atomic submission boundary, manual school status/contact workflow, and account-scoped notification APIs are implemented. External school delivery, real payment-provider lifecycle, real notification providers and broader school operations remain unavailable unless separately marked implemented below. See [the backend submission contract](CUAC_APPLICATION_SUBMISSION_BACKEND_CONTRACT.md) and [notification delivery contract](CUAC_NOTIFICATION_DELIVERY_CONTRACT.md).

Frontend implementation update (2026-09-03): `public/application.html` and `public/application.js` now read the authenticated student's application sets and the published school/program/intake catalog from `/api/v1`. Creating a set, adding an exact `schoolId + programId + programIntakeId` choice, removing a choice, and saving choice order use the normal student APIs; create/add commands send independent `Idempotency-Key` values. The page no longer persists application identity or lifecycle state in browser demo storage and no longer boots with fabricated choices or intake options. This is a narrow frontend adapter milestone, not proof that profile editing, material selection, payment, authorization, snapshot, preflight, or atomic submission UI is production-complete; those remaining surfaces must not treat their current preview state as server evidence.

## 1. Purpose

This document defines the backend API needed for the CUAC application flow, catalog discovery, school portal, payments, notifications, analytics, and Agent actions.

The API follows stable domain decisions; the frontend demo is not an immutable business or billing contract:

- students choose concrete school and program routes;
- CUAC collects non-document application information;
- fees follow an explicitly approved, versioned Billing policy; the application unit does not determine the charging unit;
- each submitted concrete program/intake choice produces an independent school-scoped record;
- schools only see their own records.

## 2. Conventions

- Base path: `/api/v1`
- Auth: secure cookie session or OAuth token depending on client.
- Request and response JSON use camelCase.
- Catalog payloads preserve CSCAlite-compatible camelCase field names from `SchoolRecord`, `SchoolProgramRecord`, `PublicScholarship`, `SchoolScholarshipRecord`, `CityGuide`, and `CityGuideAggregate`. UI display aliases such as `name`, `university`, `tuition`, or `deadline` may be included, but they must not replace the canonical fields.
- Catalog and handoff payloads may include `sourceFieldLineage`. This is machine-readable metadata used for Agent citation, audit, data-quality review, and future API/database replacement. It is not a license to expose other-school choices or private student Agent memory.
- Dates use ISO 8601.
- Money uses integer cents and currency code.
- Idempotent mutation requests accept `Idempotency-Key`.
- Errors use structured format:

```json
{
  "error": {
    "code": "permission_denied",
    "message": "You do not have access to this record.",
    "requestId": "req_123"
  }
}
```

## 3. Catalog APIs

### Implemented: POST /api/v1/student/application-sets/:applicationSetId/choices/:choiceId/material-preview

Owner-only read computation for a concrete program/intake draft. Requires explicit expectedVersions for applicationSet/applicant/education/assessments and selection arrays for applicantFields/educationRecordIds/assessmentRecordIds. No query parameters, raw client material payload, implicit all-selection or Idempotency-Key. The server rechecks live student persona, owner and draft/target state, compares all four versions and reads only chosen material fields/records in one READ ONLY / REPEATABLE READ snapshot.

Returns mode=self_review, canSubmit=false, persisted=false, consentRecorded=false, checkedAt, contentSha256 and content. Content contains target IDs, source versions, canonical selections and bounded owner-only material DTOs; raw scores remain unverified. The account/target/content-bound hash is neither a signature nor consent/authorization. Nothing is sent to a school or Agent, persisted, or appended to a business audit. Unknown/removed/foreign selections are redacted 403; stale versions, frozen or unbound targets are 409; corrupt storage is redacted 503. See [material preview contract](CUAC_APPLICATION_MATERIAL_PREVIEW_CONTRACT.md). This POST is not a business write or formal submission.

### Implemented: GET /api/v1/student/application-sets/:applicationSetId/choices/:choiceId/preflight

Requires exactly one `locale=en` or `locale=zh-CN`; rejects extra/duplicate query fields. Returns an owner-only preparation report for one choice, not a whole-school application. Current account/student grant, parent/choice ownership and explicit student persona/data classes are required. Nonexistent, removed, wrong-parent and cross-owner choices share a redacted 403.

The report exposes application-set revision, database checkedAt, target/window status, the choice's persisted `admissionRouteKey`, basic-field presence and education/assessment revisions/counts, published requirement/notice references, minimal current authorization/snapshot state, a minimal exact-policy projection, `billingEntitlement: { id, status, grantedAt, expiresAt, current } | null`, unassessed requirement keys and explicit platform blockers. It contains no raw applicant values, marks, private notes, other choices, policy source text, internal review evidence, invoice/payment/event or provider evidence. The route cannot be supplied by query/header. All reads use one read-only repeatable snapshot and database clock. An exact current policy removes only `OFFICIAL_SUBMISSION_POLICY_UNAVAILABLE`; an exact current project entitlement removes only `BILLING_ENTITLEMENT_UNAVAILABLE`. `SUBMISSION_UNAVAILABLE` remains, so `assessmentMode=preparation_only` and `canSubmit=false`. No consent, material snapshot, payment, entitlement grant, reservation or submission is created. Corrupt/unconfigured storage is 503, invalid query/UUID is 400, and explicit cross-origin Fetch Metadata is rejected before session resolution. See [preflight contract](CUAC_APPLICATION_PREFLIGHT_CONTRACT.md) and [Billing entitlement contract](CUAC_APPLICATION_BILLING_ENTITLEMENT_CONTRACT.md).

### Implemented: GET/POST/DELETE /api/v1/student/application-sets/:applicationSetId/choices/:choiceId/submission-authorization

Owner-only evidence for one exact Program Application. GET returns the latest minimal authorization or null. POST requires `Idempotency-Key` and a strict body containing locale, material-selection/source versions, current notice identity, current public policy identity, material-content digest, and the fixed explicit-confirmation value. The server derives owner/target from the authenticated path, reads the route from the choice, locks the exact current reviewed policy through commit, recomputes material and notice evidence, and stores only `cuac.application-submission-authorization.v2` for new confirmations. DELETE accepts only the target authorization ID and withdraws current evidence; it is not a recall from a university.

The student may echo only policy `admissionRouteKey`, `versionId`, `publicationRevision`, and `documentSha256`. Target-set/approval digests and review evidence are server-only and rejected if forged into the request; they are not returned. v1 rows remain readable historical evidence but are always non-current. Same-school programs have different choices, targets, authorization rows and scope digests. No operation creates a school application, fee entitlement, payment, notification, Agent action or formal submission. See [policy-bound authorization contract](CUAC_APPLICATION_POLICY_BOUND_AUTHORIZATION_CONTRACT.md).

### Implemented: GET/POST /api/v1/student/application-sets/:applicationSetId/choices/:choiceId/material-snapshot

Owner-only immutable encrypted material evidence for one current v2 authorization. POST requires `Idempotency-Key`, authorization ID, expected authorization-scope digest and material-content digest. The server rejects v1, partial, stale, wrong-route or wrong-policy authorization, then revalidates the exact policy under database locks and rebuilds the selected material before AES-256-GCM encryption. GET/POST expose metadata only, never plaintext, selected record IDs, encryption envelope, key ID or policy approval evidence. This is not school access or formal submission; see [material snapshot contract](CUAC_APPLICATION_MATERIAL_SNAPSHOT_CONTRACT.md).

### Implemented: GET /api/v1/notices/:noticeKey/:locale

Public-only notice read, currently noticeKey=application_disclosure and locale=en or zh-CN. Returns `200 { data: PublishedNoticeDto | null }` with exactly noticeKey, locale, versionId, version, contentSha256, publicationRevision, effectiveFrom, reviewDueAt and document. Follows only the explicit active pointer and verifies exact scope, approved content and the complete review digest recorded at publication, plus effective/review windows. No locale/version fallback, query override, cookie issuance or consent write. Invalid scope is 400; corrupt published data or unconfigured storage is a redacted 503. Plain-text content is never executable HTML. No notice management or student-consent POST is implemented; see [notice contract](CUAC_NOTICE_PUBLICATION_CONTRACT.md).

### Implemented: GET /api/v1/catalog/programs/:programId/intakes/:intakeId/requirements

Guest-readable public_catalog endpoint. Returns `{ data: PublicProgramRequirementsDto | null }` using only the explicit publication pointer for that exact intake. Both path IDs are UUIDs; query parameters cannot select another target/version. Active school/program, open viable intake, active publication, approved version with bound independent-review evidence, effective date and review expiry are checked in one SQL snapshot. No matching public version means null, not fallback to older rules or legacy HSK/English strings. Legacy versions lacking the new evidence are not public. Invalid published content/digest/review binding returns a redacted 503.

The DTO includes version ID/number, content SHA-256, publication revision, review/effective/due timestamps and a strictly bounded document with source citations, applicability, evidence type and preparation/submission/enrollment stages. assessmentMode is always information_only, even for complete coverage. Preparer/reviewer identity and review attestations, student/application/payment data and internal notes are excluded. No write or approval API is exposed. See [requirements contract](CUAC_PROGRAM_REQUIREMENTS_CONTRACT.md); the internal governance service is now implemented, but no Ops/Agent write endpoint, source-verification pipeline or formal submission is enabled. See [governance contract](CUAC_PROGRAM_REQUIREMENT_GOVERNANCE_CONTRACT.md).

Catalog APIs are the production source for the public list pages and the application Add choice flow. Remaining pages that still use `CuacDataClient` static demo data must migrate without weakening the legacy field mapping in `CUAC_LEGACY_FIELD_MAPPING_SPEC.md`, so frontend details, school handoff, future Agent retrieval, and Ops data-quality tools read the same canonical field families.

### Frontend Adapter Alignment

The frontend static demo exposes `CuacDataClient.getBackendAdapterContract()` as the replacement map from mock/local-state methods to production APIs. Backend implementation should treat that contract as a client-facing adapter checklist, not as a separate API namespace.

Adapter domains map to this API contract as follows:

- `catalog`: `GET /programs`, `GET /schools`, `GET /scholarships`, `GET /cities`, and detail endpoints under the `/api/v1` base path.
- `student_profile`: `GET /student/profile`, `PATCH /student/profile`, saved items, preferences, and student-owned state under `/api/v1`.
- `applications_payments`: application set, choice, payment intent/status, billing, and send endpoints. Payment failure keeps choices saved and must not create school-visible records.
- `school_portal`: school application queue, status updates, owner assignment, exports, and tenant analytics. Every request resolves `tenantSchoolId` server-side.
- `school_settings`: staff invitations, staff role grants, templates, owner routing, and response targets for one school tenant.
- `notifications`: account-scoped notifications, read/dismiss state, and notification preferences.
- `agent_actions`: conversation, action preview, action execute, and memory clear endpoints. The backend must recheck `role`, `surface`, `tenantSchoolId`, `actionKey`, and `continuationToken` before executing a resumed or Agent-triggered action.
- `ops_admin`: internal dashboard, support lookup, retry, audit, and cross-tenant controls with CUAC Ops authorization and audit reasons.

Production frontend pages should continue calling `CuacDataClient`-style methods or their framework equivalent. Page components should not call arbitrary backend endpoints directly, because the adapter boundary is what preserves CSCAlite field compatibility, role context, tenant scope, and demo-to-production parity.

### GET /programs

Query:

- q
- schoolId
- cityId
- degreeLevel
- subjectArea
- teachingLanguage
- intakeTerm
- intakeYear
- deadlineStatus
- scholarshipAvailable
- tuitionMaxRmb
- sourceStatus
- page
- pageSize
- sort

Response:

```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Computer Science MSc",
      "nameZh": "计算机科学硕士",
      "nameEn": "Computer Science MSc",
      "schoolId": "uuid",
      "school": { "id": "uuid", "name": "Zhejiang University", "nameEn": "Zhejiang University", "cityZh": "Hangzhou", "region": "Zhejiang" },
      "city": { "id": "uuid", "name": "Hangzhou", "nameEn": "Hangzhou", "region": "Zhejiang" },
      "degreeLevel": "master",
      "durationYears": "2",
      "fieldCategory": "Computer Science",
      "teachingLanguage": "English-taught",
      "cscaSubjects": [],
      "cscaRequirement": "Confirm by school and program",
      "hskRequirement": "No HSK first",
      "englishRequirement": "IELTS 6.5 or equivalent",
      "tuitionAmount": 42000,
      "tuitionCurrency": "RMB",
      "tuitionPeriod": "year",
      "tuitionText": "RMB 42,000 / year",
      "scholarshipText": "CSC possible",
      "openDate": "2026-08-01",
      "deadlineDate": "2026-10-15",
      "deadlineLabel": "Oct 15",
      "deadlineStatus": "closes_soon",
      "applicationRound": "Fall 2026",
      "applicationUrl": "https://example.edu/admissions",
      "applicationNote": "Confirm current school notice",
      "sourceUrl": "https://example.edu/program",
      "sourceLabel": "School admissions notice",
      "lastVerifiedAt": "2026-08-01",
      "sourceStatus": "verified",
      "sortOrder": 1,
      "status": "published",
      "isVerified": true,
      "hasScholarship": true,
      "displayTuition": "RMB 42k",
      "displaySubjects": ["Computer Science"],
      "sourceFieldLineage": {
        "sourceModel": "SchoolProgram",
        "sourceFields": ["schoolId", "nameZh", "nameEn", "tuitionAmount", "deadlineDate", "applicationUrl", "sourceUrl", "lastVerifiedAt"],
        "displayAliases": { "name": "SchoolProgram.nameEn", "deadline": "SchoolProgram.deadlineDate" }
      }
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 128
}
```

### GET /programs/:programId

Returns program detail, intakes, scholarships, document guidance, source evidence, and school context. Detail payload must include the full `SchoolProgramRecord`-compatible field family plus parent `SchoolRecord` summary fields used by Add choice and school portal handoff.

### GET /schools

Search universities.

Response items must preserve `SchoolRecord` fields:

```json
{
  "items": [
    {
      "id": "uuid",
      "nameZh": "浙江大学",
      "nameEn": "Zhejiang University",
      "schoolType": "regular",
      "region": "Zhejiang",
      "city": "Hangzhou",
      "cityZh": "Hangzhou",
      "citySlug": "hangzhou",
      "regionLabel": "Zhejiang",
      "cscaRequired": false,
      "applicationLevel": "Bachelor / Master",
      "languageOfInstruction": ["English-taught"],
      "deadlineSummary": "Check program deadlines",
      "tuitionSummary": "RMB 32k-48k",
      "applicationFee": "Confirm by school",
      "officialWebsiteUrl": "https://example.edu",
      "admissionsWebsiteUrl": "https://example.edu/admissions",
      "sourceUrl": "https://example.edu/admissions",
      "sourceLabel": "School admissions notice",
      "sourceNote": "",
      "lastVerifiedAt": "2026-08-01",
      "verificationStatus": "verified",
      "qualityScore": 92,
      "subjectTags": ["Computer Science"],
      "fitNotes": [],
      "programSubjectTags": ["Computer Science"],
      "programTuitionBandLabel": "RMB 32k-48k",
      "programQualityIssues": [],
      "programCount": 12,
      "englishProgramCount": 6,
      "scholarshipCount": 3,
      "upcomingDeadlines": [],
      "quickFacts": {},
      "detailDisplay": {},
      "status": "published",
      "sourceFieldLineage": {
        "sourceModel": "School",
        "sourceFields": ["nameZh", "nameEn", "officialWebsiteUrl", "admissionsWebsiteUrl", "qualityScore"],
        "displayAliases": {}
      }
    }
  ]
}
```

### GET /schools/:schoolId

Returns public school detail.

### GET /scholarships

Search scholarship data.

Response items must preserve `PublicScholarship` fields and may include school/program links:

```json
{
  "items": [
    {
      "id": "uuid",
      "slug": "chinese-government-scholarship",
      "title": "Chinese Government Scholarship / CSC",
      "type": "government",
      "typeLabel": "CSC",
      "fundingLevel": "full",
      "providerName": "China Scholarship Council",
      "providerNameEn": "China Scholarship Council",
      "providerLocation": "China",
      "schoolId": "uuid_or_0",
      "schoolName": "Multiple universities",
      "schoolNameEn": "Multiple universities",
      "schools": [],
      "schoolCount": 0,
      "programId": null,
      "programName": "",
      "programNameEn": "",
      "programs": [],
      "coverage": "Tuition, stipend, accommodation, insurance",
      "applicableDegree": "Master / PhD",
      "applicableProgram": "Confirm by scholarship notice",
      "amountText": "Full or broad funding route",
      "requirementText": "Eligibility follows official notice.",
      "bodySections": [],
      "benefitItems": [],
      "eligibilityItems": [],
      "applicationMaterials": [],
      "applicationSteps": [],
      "contactInfo": null,
      "actionLinks": [],
      "deadlineDate": "2026-03-31",
      "deadlineLabel": "Mar 31",
      "applicationRound": "2026",
      "targetCountries": [],
      "targetRegions": [],
      "benefits": ["Tuition", "Stipend"],
      "sourceUrl": "https://example.cn/scholarship",
      "sourceLabel": "Official scholarship notice",
      "lastVerifiedAt": "2026-08-01",
      "sortOrder": 1,
      "tags": ["Full funding", "CSC"],
      "summary": "Full-funding route for strong applicants."
    }
  ]
}
```

### GET /cities

Search city guide data.

Response items must preserve `CityGuide` and lightweight `CityGuideAggregate` fields:

```json
{
  "items": [
    {
      "slug": "hangzhou",
      "nameZh": "杭州",
      "nameEn": "Hangzhou",
      "region": "Zhejiang",
      "monthlyCost": 4200,
      "costLevel": "medium",
      "density": "balanced",
      "tags": ["Digital economy", "Scenic", "English routes"],
      "content": {
        "summary": "Balanced city for tech and campus life.",
        "overview": "Student-friendly city with strong universities.",
        "quickFacts": [],
        "budgetSummary": {},
        "costProfiles": [],
        "why": [],
        "costBreakdown": [],
        "lifeSections": [],
        "transportNotes": [],
        "applicationTips": [],
        "applicationAdvice": [],
        "relatedProgramKeywords": [],
        "nextSteps": [],
        "faqs": [],
        "cityFaqs": []
      },
      "nearby": [],
      "references": {
        "schoolCount": 4,
        "programCount": 18,
        "englishProgramCount": 8,
        "scholarshipCount": 5,
        "cscaRequiredSchoolCount": 0
      },
      "actualSchoolCount": 4,
      "actualProgramCount": 18,
      "actualEnglishProgramCount": 8,
      "actualScholarshipCount": 5,
      "actualCscaRequiredSchoolCount": 0,
      "visibleSchools": [],
      "visiblePrograms": [],
      "visibleScholarships": [],
      "status": "published",
      "sortOrder": 1,
      "version": 1,
      "updatedAt": "2026-08-17"
    }
  ]
}
```

## 4. Identity And Auth APIs

The shared frontend auth page is a continuation shell, not a student-only form. Protected actions redirect to `auth.html`, then return to the saved page/action after authentication. It must support one account registration/sign-in pattern with different access contexts, roles, and organization grants:

- students, school staff, and CUAC staff can create or sign in to a CUAC account through the same credential/session system;
- school staff may receive invitations, but the invited person still creates or signs in to their own account before a `school_staff_memberships` grant is attached;
- CUAC staff may create or sign in to an account, but Ops/Admin permissions are granted only by CUAC approval, team invitation, SSO claim, or admin assignment;
- unauthenticated identity is `unknown`; the Auth page shows access context choices and the user selects the intended access context when submitting credentials, invitation acceptance, or approval request;
- any default access context shown by the page is only a UI hint for the action, not an identity decision or authorization grant;
- every protected action started by a visitor must be revalidated after authentication before execution.

### GET /me

Returns authenticated user, roles, school memberships, account type, and available surfaces.

Response:

```json
{
  "user": {
    "id": "uuid",
    "email": "maya@example.com",
    "displayName": "Maya Chen",
    "selectedSurface": "student",
    "roles": ["student"],
    "schoolMemberships": [],
    "surfaces": ["authenticated-student"]
  }
}
```

### POST /auth/register

Current implementation creates only a student account and student session. The longer-term contract uses the same base account system for `student`, `school_staff`, and `cuac_internal`, but staff authority is attached only after an invite, active school membership, approved CUAC staff grant, SSO claim, or admin assignment. Public self-registration must never mint school or CUAC authority.

Deprecated compatibility: `POST /auth/student/register` may exist as a temporary alias for legacy clients, but production UI and new clients must call `POST /auth/register` with `selectedSurface = student`.

Response for staff paths must distinguish account creation from permission grant:

```json
{
  "user": { "id": "uuid", "email": "staff@cuac.example" },
  "selectedSurface": "cuac_internal",
  "accessStatus": "pending",
  "nextRequiredGrant": "cuac_staff_access_grant"
}
```

### POST /auth/sessions

Implemented password sign-in accepts `email`, `password`, and optional `selectedSurface` (`student`, `school_staff`, `cuac_internal`). `student` is the default. A school login also requires `schoolId`; the repository locks and verifies the current `school_staff` role, exact active membership, and active school. A CUAC internal login locks and verifies a current approved, unrevoked, unexpired grant matching `cuac_ops` or `cuac_admin`. The request cannot supply the resulting active role or tenant.

The current response is:

```json
{
  "data": {
    "userId": "uuid",
    "sessionId": "uuid",
    "selectedSurface": "school",
    "activeRole": "school_staff",
    "tenantSchoolId": "uuid",
    "expiresAt": "2026-10-02T00:00:00.000Z"
  }
}
```

Student and CUAC internal sessions return `tenantSchoolId: null`; requested `school_staff` maps to the resolved session surface `school`, and requested `cuac_internal` maps to `ops`. Password proof, session creation, optional legacy credential upgrade, and success audit remain one transaction. Provider-token and inline continuation handling remain future extensions rather than implemented behavior.

### POST /auth/school/invitations/accept

Accepts a school staff invitation or approved school-email access request after the staff member creates or signs in to their own account. The endpoint links the user to an active `school_staff_memberships` row and starts a school-staff session scoped to that tenant. It must not grant access to any other school.

### POST /auth/internal/access/accept

Accepts a CUAC team invitation, approval, SSO claim, or admin assignment for a signed-in account. The account may exist before the grant; Ops/Admin permissions start only after this access record is approved and audited.

Creates or activates a `cuac_staff_access_grants` row, then materializes approved roles into `user_roles`.

### POST /auth/sign-in-continuations

Creates a short-lived protected-action continuation before sign-in or registration.

Rules:

- continuation stores only minimal action metadata, not full student profile, school queue, payment data, or Agent memory;
- continuation may store `allowedAccountTypes` or an action-required account type, but this describes the pending action policy, not the unauthenticated visitor's identity;
- it expires quickly and is bound to device/session fingerprint where possible;
- it must be consumed once;
- after authentication, the backend rechecks the action against the authenticated account type, role, tenant, and action policy.

### POST /auth/sign-in-continuations/:continuationId/consume

Consumes a continuation after sign-in/register and returns either an executable action preview or a denial reason.

## 5. Student APIs

### Implemented: Owner-Only Education History

- `GET /api/v1/student/education-records` returns `{ data: { revision, records } }`; an absent collection is revision 0 with an empty list, without a write.
- `POST /api/v1/student/education-records` adds one experience; `PATCH /api/v1/student/education-records/:recordId` edits one; `POST /api/v1/student/education-records/:recordId/remove` removes one using a JSON expectedRevision, not DELETE.
- All mutations return the complete bounded collection. First add expects revision 0; subsequent mutations require the current positive collection revision. Stale requests return 409; reread and compare, never automatically advance the expected version to retry.
- Up to 20 active records; partial patches preserve omitted fields and validate the merged record. Removed IDs cannot revive or target a replacement. Removal clears the nine education fields while retaining identity/version; audit failure rolls back the entire operation.
- Owner student and education_record authority only, with current account/role checks, strict fields and same-origin JSON boundary. No school/Ops/Agent access or formal submission permission is added. See [education contract](CUAC_EDUCATION_HISTORY_CONTRACT.md) for fields, erasure and recovery semantics.

### Implemented: Private Assessment Records

- `GET /api/v1/student/assessment-records` returns `{ data: { revision, records } }`; absent data is revision 0 and an empty list without insertion.
- `POST /assessment-records`, `PATCH /assessment-records/:recordId` and `POST /assessment-records/:recordId/remove` under the same student prefix require expectedRevision. Removal accepts only that version JSON, not DELETE; no separate idempotency receipt is introduced.
- Up to 40 active reports, with at most 20 original textual score components per report. Preserve exam category/name/variant, planned/pending/reported status, explicit report form, civil dates and component scales; no conversion or automatic superscore. The 10-field record DTO always reports evidenceStatus=unverified.
- Only current active student-owner, student surface, student_action purpose, session/step_up and education_record policy may access it. Unknown sensitive/authority fields, contradictory merged dates/statuses and malformed nested scores are rejected. School/Ops/Agent access is not added.
- Actual changes advance only the assessment revision with atomic metadata-only audit. JSONB key-order differences are no-op; stale versions conflict. Removal erases eight content fields, retains fixed IDs and cannot affect a replacement. Corrupt stored reports fail closed with redacted 503; a known owned target can be explicitly removed.
- These are preparation records, not official verification, course transcripts/GPA, consent or submission. Fields, input bounds and recovery rules are defined in [assessment contract](CUAC_ASSESSMENT_RECORDS_CONTRACT.md).

### Implemented: GET/PATCH /api/v1/student/applicant-profile

Separate owner-only application basics, not the preference profile or a school submission. GET returns null before explicit creation; PATCH accepts expectedRevision and at least one of fullName/contactEmail/citizenshipCountry. Revision 0 creates only if absent; later edits require the current revision. Unknown/authority fields are rejected. Omitted values stay unchanged, null clears; same-version no-op does not advance revision or audit. Changed values and metadata-only success audit share a transaction. A 409 or ambiguous response requires re-read, not automatic version replacement. No inferred values, email verification, consent or school disclosure. See [applicant and consent contract](CUAC_APPLICANT_PROFILE_AND_CONSENT_CONTRACT.md).

### Existing Preference Profile: GET /student/profile

Returns current student's profile.

### PATCH /student/profile

Updates non-document profile fields.

Body:

```json
{
  "fullName": "Maya Chen",
  "phone": "+60 12 000 0000",
  "countryRegion": "Malaysia",
  "educationStage": "Final-year undergraduate",
  "fundingIntent": "Scholarship possible",
  "languageStatus": "IELTS / waiver noted",
  "readinessNote": "Transcript translation may need follow-up."
}
```

### GET /saved-items

Returns saved programs, schools, scholarships, cities, and guides.

### POST /saved-items

Idempotently saves an item.

### DELETE /saved-items/:savedItemId

Removes a saved item.

## 6. Application APIs

### POST /application-sets

Creates a draft set.

### GET /application-sets/:applicationSetId

Returns the full student-visible application set.

Authorization:

- owner student;
- CUAC Ops with audit.

### PATCH /application-sets/:applicationSetId

Updates title, target intake, and draft-level metadata.

### POST /application-sets/:applicationSetId/choices

Implemented route: `POST /api/v1/student/application-sets/:applicationSetId/choices`, with required `Idempotency-Key`. Adds one draft target; optional programIntakeId requires programId. Optional `admissionRouteKey` requires both program and intake plus an exact current active reviewed policy publication for that target and route. Success returns `200 { data: ApplicationChoiceDto }`, including nullable `programIntakeId` and `admissionRouteKey`. This is not formal submission.

Body:

```json
{
  "schoolId": "uuid",
  "programId": "uuid",
  "programIntakeId": "uuid",
  "admissionRouteKey": "direct_university",
  "studentNotes": "Strong English-taught CS route."
}
```

Validation:

- Current student ownership, role, education-record policy and unfrozen draft state are required.
- Program belongs to the active school; a supplied intake belongs to that active program and is open, unexpired and has no contradictory date window.
- A non-null admission route is a controlled ASCII key and must resolve to the exact target's current active reviewed policy in the same business transaction. Omitted/null route means unselected; there is no default, backfill or inference from school, catalog, scholarship, Agent or demo data.
- One active exact program/intake target per set; different intake drafts may coexist, with formal school limits still pending. Legacy unbound program drafts retain their separate uniqueness rule.
- Omitted/null intake preserves historical v1 request hashes; non-null intake without route uses v2, and non-null route uses v3 under the same receipt key scope. Existing v1/v2 receipts remain recoverable; a key cannot silently switch targets or routes. See [intake contract](CUAC_APPLICATION_INTAKE_CONTRACT.md) and [admission-route contract](CUAC_APPLICATION_ADMISSION_ROUTE_CONTRACT.md).

### GET /api/v1/catalog/programs/:programId/intakes

Implemented public, paginated discovery for a valid program UUID. Returns `200 { data: PublicProgramIntakeDto[] }`; default limit 20, maximum 100, offset supported. Only available batches under active programs and schools appear. Missing/unpublished targets return an empty array. Future opening dates and unknown deadlines may be displayed for draft planning; this does not approve immediate submission. No private application, student or billing fields are returned.

### PATCH /application-sets/:applicationSetId/choices/:choiceId

Implemented backend route: `PATCH /api/v1/student/application-sets/:applicationSetId/choices/:choiceId`. JSON requires `expectedRevision` and at least one of `studentNotes` / `scholarshipId` / `admissionRouteKey`; omitted fields are preserved and explicit null clears them. A non-null route requires a bound program/intake and exact current active reviewed policy. Route changes advance the application-set revision and clear the old requirement snapshot, making revision-bound preparation evidence stale without rewriting history. Other fields, including program, school, role, rank and intake, are rejected. Returns `200 { data: ApplicationSetDto }` with the current revision and choices. Ownership denial is 403; stale revision, unavailable policy or a non-editable target is 409. No POST command key is used. See [versioned draft contract](CUAC_APPLICATION_SUBMISSION_BACKEND_CONTRACT.md) and [admission-route contract](CUAC_APPLICATION_ADMISSION_ROUTE_CONTRACT.md).

### PUT /application-sets/:applicationSetId/choice-order

Implemented backend route: `PUT /api/v1/student/application-sets/:applicationSetId/choice-order`. JSON requires `expectedRevision` and a complete ordered `choiceIds` array (up to 1000 unique IDs). Only the owner's active editable choices may appear, exactly once each; saves ranks 0..n-1 atomically and returns the same ApplicationSetDto envelope. No-op with the current revision does not create another success audit. A stale revision or changed membership returns 409; reread and reconcile instead of automatically replacing the expected revision.

### DELETE /application-sets/:applicationSetId/choices/:choiceId

Implemented backend route: `DELETE /api/v1/student/application-sets/:applicationSetId/choices/:choiceId`. Empty body (not `{}`), same-origin session required. No Idempotency-Key needed for this fixed target operation. First and repeated success return `200 { data: { id, applicationSetId, status: "removed" } }`; unavailable ownership is 403, owned non-editable draft is 409. Soft removal and first transition/audit are atomic. Retrying an old target never deletes a newly added replacement. This is not withdrawal of a submitted application. See [current backend contract](CUAC_APPLICATION_SUBMISSION_BACKEND_CONTRACT.md); neighboring edit/intake/submit endpoints remain proposals unless separately marked implemented.

### Implemented foundation: POST /api/v1/billing/fee-preview

Strict JSON body contains `applicationSetId` and 1..20 distinct `applicationChoiceIds`. The requested IDs must equal the complete active choice set returned for that authenticated student's Application Set; the backend rejects missing, duplicate, removed, foreign or incomplete `program + intake + route` choices rather than silently pricing a visible subset. The response contains currency, subtotal/discount/total minor units and project-aware application-fee/service-fee lines. It is a preview only: it does not lock a production price, charge money, create an entitlement or authorize submission. Current local fee configuration is not an approved production pricing policy.

### Implemented foundation: POST /api/v1/billing/checkout-intents

Uses the same exact complete choice set plus local same-origin success/cancel return paths. Identity comes only from the server session; raw card/bank fields, client provider metadata and external return URLs are rejected before repository access. When an explicitly injected hosted provider is unavailable, runtime fails closed. A successful foundation call creates exact v2 invoice lines and payment business state with stable idempotency keys; it never accepts or stores raw payment credentials. Real provider charging, signed webhooks, refunds and reconciliation are not enabled.

### Public route closed; internal D2 application.submit implemented

There is no `POST /api/v1/student/application-sets/:applicationSetId/submit` route. Migration `0030` and the internal step-up student service implement only the database acceptance boundary. The exact normalized internal command is:

```json
{
  "applicationSetId": "uuid",
  "expectedRevision": 7,
  "choiceIds": ["uuid"],
  "confirmSubmission": true
}
```

The command requires a separately scoped `Idempotency-Key`. `choiceIds` must exactly equal the complete active choice set; array order does not override locked `rank_order`. The service:

1. Revalidates current student authority, step-up, ownership, draft revision and the exact complete choice set.
2. Revalidates every concrete `school + program + intake + route`, current requirements/notices/policy, current v2 disclosure authorization, authenticated material snapshot and exact fee entitlement.
3. Creates one independent Program Application per choice. Same-school projects never share application identity, evidence, state or outcome.
4. Creates one or more immutable Official Submission Groups from the locked policy. `one_program_per_form` creates one group per project; `multi_program_form` may group ordered members without merging them.
5. Writes the application submission, Program Applications, groups/members, one inert pending outbox row per group, command receipt, status events and success audit in one transaction, then freezes the set and choices.
6. Returns only minimal internal identifiers, target identities and local `accepted`/`pending` states. It does not return material content, payment evidence, policy-review evidence, provider data or credentials.

The same key and same normalized input recover the same database result; key reuse with changed input conflicts, and a new key cannot submit an already frozen set. An accepted internal submission means CUAC stored an atomic batch. It does not mean a university received it. There is no worker, school adapter, public/Ops/Agent submit surface, `canSubmit=true` response or external delivery status in the current API. See [the atomic submission contract](CUAC_ATOMIC_APPLICATION_SUBMISSION_CONTRACT.md).

## 7. Payment APIs

The routes below are future provider-lifecycle proposals, not implemented endpoints. Current implemented contract routes are only `POST /api/v1/billing/fee-preview` and `POST /api/v1/billing/checkout-intents`, with runtime fail-closed unless the hosted provider is explicitly injected. `application_fee_entitlements` are granted only through the internal Billing authority after exact settled evidence; there is no public, Ops or Agent grant route.

### POST /payments

Creates a payment intent for an application set.

### GET /payments/:paymentId

Returns payment status.

### POST /payments/:paymentId/cancel

Cancels pending payment if allowed.

### POST /payment-webhooks/:provider

Provider callback. Must be idempotent and signature verified.

## 8. School Portal APIs

Implemented now: `GET /api/v1/school/applications` and `GET /api/v1/school/applications/:applicationId` read the current server-resolved school tenant after active membership checks. `PATCH /api/v1/school/applications/:applicationId/status` and `POST /api/v1/school/applications/:applicationId/contact-logs` implement the manual tenant workflow described below. Queue/detail items include nullable `programIntakeId`, `schoolRevision`, and `statusChangedAt`; detail also includes status events and tenant contact logs. Each record is constrained to the linked choice's exact target. Generated `target_key` is internal and never returned. The repository reads only school application projections, not student draft notes or other choices. See [target identity contract](CUAC_APPLICATION_TARGET_IDENTITY_CONTRACT.md) and [school backend spec](CUAC_SCHOOL_PORTAL_BACKEND_SPEC.md).

`pending_submission` is an internal accepted-but-undelivered state. It is hidden from school list/detail and cannot be mutated. Only a confirmed received v2 row with finite `submittedAt` and a school workflow status can use the write endpoints. A later approved delivery worker/provider must establish that boundary; no such worker/provider is currently enabled.

Filters, pagination, lineage expansions, owner assignment, bulk actions, exports, school-recipient notification rules, analytics and Agent school writes remain planned contracts. Account-scoped notification reads/preferences and student notifications created by school status changes are implemented separately. A `schoolId` query parameter never switches tenant or grants membership.

### GET /school/applications

Returns only records in schools the current user can access.

Planned query fields, not implemented by the current unfiltered tenant queue:

- schoolId optional if user has multiple memberships
- q
- status
- programId
- intake
- country
- source
- ownerUserId
- priority
- page
- pageSize
- sort

Response must not include other selected schools.

Response items should include only tenant-safe `sourceFieldLineage` and `informationSources` for this school's own received record. These fields explain whether visible values came from the student-selected route, the program catalog, the school catalog, or the student profile; they must not include other schools in the application set.

### GET /school/applications/:schoolApplicationId

Returns school-visible detail.

Authorization:

- current user must belong to `tenantSchoolId`.

Detail response should include:

- `informationSources.selectedByStudent`
- `informationSources.fromProgramRecord`
- `informationSources.fromSchoolRecord`
- `informationSources.fromStudentProfile`
- `sourceFieldLineage`
- `notCollectedByCuac`

These are the API-backed version of the current frontend demo handoff metadata.

### PATCH /school/applications/:schoolApplicationId/status

Implemented route: `PATCH /api/v1/school/applications/:applicationId/status`.

Requires an active authenticated `school_staff` context for the exact server-resolved tenant, purpose `school_review`, session or step-up authentication, and an active `admissions`, `counselor`, or `school_admin` membership. `viewer` is denied. The request must carry an `Idempotency-Key` of 16..128 ASCII letters, digits, `_`, or `-`.

Body:

```json
{
  "expectedRevision": 3,
  "status": "contacted",
  "reason": null
}
```

The controlled forward transition must be legal from the locked current status. A stale revision returns 409. `not_a_fit` and `archived` require a nonempty reason of at most 500 characters. The status row, incremented revision, status event, metadata-only audit and one idempotent student notification event commit atomically; the reason is not copied into audit or notification variables. Same-key/same-input replay returns the original receipt without another event, delivery or audit; reusing the same key with changed input returns 409.

### PATCH /school/applications/:schoolApplicationId/owner

Planned; no route is implemented.

### POST /school/applications/:schoolApplicationId/contact-logs

Implemented route: `POST /api/v1/school/applications/:applicationId/contact-logs`, with the same tenant authority and `Idempotency-Key` rules as status changes.

```json
{
  "channel": "email",
  "direction": "outbound",
  "outcome": "follow_up_required",
  "note": "Requested the remaining school documents."
}
```

`channel` is one of `email`, `phone`, `whatsapp`, `in_person`, or `other`; `direction` is `outbound` or `inbound`; `outcome` is `attempted`, `reached`, `replied`, or `follow_up_required`. The private note is required and limited to 2000 characters. Contact can be recorded only while the received application is active. The record and metadata-only audit commit atomically, and the note is never copied into audit metadata. Idempotent replay never duplicates the contact or audit.

### POST /school/applications/export

Planned; no route is implemented. It must create a tenant-scoped CSV export job with confirmation and audit.

## 9. Agent APIs

Agent APIs must preserve the frontend demo's context boundary:

- signed-out visitor: current page context only; no durable conversation or account memory;
- signed-in student: account-scoped application memory until the student clears it, enrolls, or the cycle is archived;
- school staff: tenant-scoped context only, never student private Agent memory or other-school choices;
- CUAC Ops: internal audited context, with reasoned access for sensitive cross-tenant analysis.

### POST /agent/conversations

Creates a conversation for a surface.

Body:

```json
{
  "surface": "programs",
  "contextScope": "student_account",
  "route": "programs.html",
  "applicationSetId": "uuid_or_null",
  "tenantSchoolId": "uuid_or_null"
}
```

Rules:

- Signed-out public use may return an ephemeral `pageSessionId` for current-tab context, but must not create durable account memory.
- `contextScope = student_account` requires a signed-in student.
- `contextScope = school_tenant` requires school staff membership in `tenantSchoolId`.
- `contextScope = ops_audit` requires CUAC Ops role and audit policy.
- The response must include the resolved context policy so the UI can show guest page context, student application memory, school tenant context, or internal audited context.

### POST /agent/conversations/:conversationId/messages

Adds a user message and returns assistant response.

Body:

```json
{
  "message": "Compare my saved routes",
  "visiblePageContext": {
    "route": "programs.html",
    "filters": {},
    "visibleRecordIds": []
  }
}
```

Rules:

- Signed-out messages may use `visiblePageContext`, but must not read profile, saved items, previous chats, application sets, notifications, or long-term memory.
- Signed-in student messages may retrieve account-owned profile, saved items, applications, notifications, preferences, and student-visible Agent memory.
- School messages may retrieve only tenant-scoped school applications, visible filters, templates, and staff action history.
- Ops messages may retrieve governed platform summaries and audited support data according to role.

### GET /agent/actions

Returns allowlisted actions available on current surface for current user.

### POST /agent/actions/:actionKey/preview

Validates params and returns planned changes.

Rules:

- Preview must run the same authorization policy as execute.
- Preview for school actions must be tenant-scoped.
- Preview must return whether confirmation is required and why.

### POST /agent/actions/:actionKey/execute

Executes allowed action after confirmation when required.

Headers:

- `Idempotency-Key` for state-changing actions.

Body:

```json
{
  "confirmed": true,
  "params": {},
  "pendingActionId": "client_or_server_id"
}
```

Rules:

- If the user is unauthenticated, return `unauthenticated` with `signInContinuationAllowed: true`; the frontend should create a continuation, redirect to `auth.html`, and retry or resume after authentication.
- Medium/high risk actions must not execute before confirmation when confirmation is required.
- School exports, school bulk updates, application submit, payment/send, and Ops audit actions must write audit logs.
- Agent execution must call normal domain services and must not bypass manual UI authorization.

### DELETE /agent/memory

Clears scoped long-term Agent memory.

Rules:

- Signed-in students can clear their own `student_account` memory after confirmation.
- School staff can clear or expire only tenant-scoped staff Agent session memory if their tenant role allows it.
- Guest users have no durable memory to clear.
- The clear operation writes an audit log for signed-in contexts.

## 10. Analytics APIs

### POST /events

Client event ingestion.

### GET /analytics/student-summary

Student-scoped summary.

### GET /analytics/school-summary

Tenant-scoped school dashboard.

### POST /analytics/query

Controlled natural-language analytics endpoint for Agent. It must use a metric registry, not arbitrary unrestricted SQL.

## 11. Notification APIs

Implemented routes are account/persona scoped. Student and CUAC staff scopes have no school tenant; school staff scope is fixed to the active school tenant. Requests cannot supply authority fields. Mutations and metadata-only audit commit atomically. See [notification delivery contract](CUAC_NOTIFICATION_DELIVERY_CONTRACT.md).

### GET /api/v1/notifications?limit=&cursor=

Returns a bounded page of in-app items for the current authenticated persona.

### PATCH /api/v1/notifications/:notificationId/read

Requires `expectedRevision`; a stale revision returns 409 and a foreign-scope identifier returns 404.

### PATCH /api/v1/notifications/read-all

Marks all unread in-app items in the current persona scope as read.

### GET /api/v1/notifications/preferences

Returns role-bound effective topic defaults and stored revisions.

### PUT /api/v1/notifications/preferences

Replaces the supplied topic settings with per-topic expected revisions in one transaction. Account-security in-app and email channels cannot be disabled. Email/SMS worker and provider contracts exist, but no real external provider or scheduler is enabled by default.

## 12. Required Error Codes

- unauthenticated
- permission_denied
- validation_failed
- resource_not_found
- application_already_submitted
- payment_required
- payment_not_paid
- duplicate_choice
- school_tenant_required
- surface_or_role_mismatch
- invalid_invitation
- access_grant_required
- continuation_expired
- continuation_already_consumed
- idempotency_conflict
- rate_limited
- agent_action_not_allowed
- confirmation_required
