# CUAC Frontend Mock Data Contract

Date: 2026-08-12

Purpose: define the frontend-only data contract for production-quality implementation before backend/database work.

Mock data must be realistic, typed, and accessed only through `CuacDataClient`. Pages should not import seed arrays directly.

CSCAlite compatibility rule: school, program, scholarship, and city mock data must preserve source-field lineage from `D:\CODE\CSCAlite`. CUAC pages may render friendly aliases, but `CuacDataClient` must keep enough `School`, `SchoolProgram`, `Scholarship`, and `CityGuide` source fields for future API/database replacement and Agent citation.

Use `CUAC_LEGACY_FIELD_MAPPING_SPEC.md` as the canonical field audit. In particular, do not copy only the early `0007_school_programs` shape from CSCAlite; the current baseline includes later program timing/application fields, scholarship detail/provider fields, city guide content/aggregate fields, and version/source-governance metadata.

## 1. Data Principles

- Use stable string IDs.
- Use ISO date strings.
- Use RMB for China-facing tuition values, with display formatting in UI helpers.
- Keep source and verification data visible.
- Model programs as the primary application object.
- Keep university data separate from program data.
- Keep documents requirement-led, not as a generic file bucket.
- Keep all user actions idempotent by ID.

## 2. Required Mock Volume

Create:

- 10 programs
- 6 universities
- 5 scholarships
- 4 cities
- 1 preview student profile
- 1 application packet
- 8 document requirements
- 8 student documents
- 8 timeline/status events
- 4 adviser permission scopes enabled by default
- 6 preview messages/tasks

Programs should include:

- at least 3 English-taught master programs
- at least 2 undergraduate programs
- at least 1 Chinese-taught program requiring HSK
- at least 1 late-intake program
- at least 1 closed program
- at least 2 stale-source programs
- at least 3 scholarship-available programs

## 3. Enums

```ts
export type DegreeLevel = 'undergraduate' | 'master' | 'phd' | 'non_degree';
export type TeachingLanguage = 'english' | 'chinese' | 'bilingual';
export type DeadlineStatus = 'open' | 'closes_soon' | 'urgent' | 'closed' | 'late_intake';
export type SourceStatus = 'verified' | 'stale' | 'pending';
export type ReadinessLevel = 'strong_match' | 'likely_eligible' | 'needs_review' | 'blocked';
export type ChoiceStatus = 'draft' | 'documents_missing' | 'ready_for_review' | 'adviser_reviewing' | 'returned';
export type DocumentStatus = 'missing' | 'uploading' | 'uploaded' | 'under_review' | 'accepted' | 'rejected' | 'expired' | 'locked';
export type SectionStatus = 'not_started' | 'in_progress' | 'needs_attention' | 'ready' | 'submitted' | 'returned' | 'locked';
export type MessageType = 'system' | 'adviser' | 'deadline' | 'document' | 'offer' | 'source';
```

## 4. Core Types

### University

```ts
export type University = {
  id: string;
  name: string;
  nameZh?: string;
  cityId: string;
  province: string;
  logoUrl?: string;
  type: 'partner' | 'verified' | 'public_source';
  internationalOfficeEmail?: string;
  websiteUrl?: string;
  admissionsUrl?: string;
  sourceStatus: SourceStatus;
  lastVerifiedAt?: string;
};
```

When backed by CSCAlite data, this type is a display projection of `School`. Preserve raw lineage for `officialWebsite -> officialWebsiteUrl`, `applicationSystemUrl -> admissionsUrl`, `dataQualityScore -> sourceStatus/quality display`, `citySlug/cityZh -> cityId/province display`, and the admissions/language/cost fields used by detail pages.

Used by:

- Program Search rows
- Program Detail header/context
- Future University Detail

### City

```ts
export type City = {
  id: string;
  slug: string;
  name: string;
  province: string;
  monthlyCostRmb: number;
  costLevel: 'low' | 'medium' | 'high';
  climateSummary: string;
  studentLifeSummary: string;
  safetyNote?: string;
};
```

When backed by CSCAlite data, this type is a display projection of `CityGuide` plus `CityGuideAggregate`. Preserve `slug`, `nameZh`, `nameEn`, `region`, `monthlyCost`, `costLevel`, `density`, `contentJson`, `nearby`, and the reference counts for schools, programs, English programs, scholarships, and CSCA-required schools.

Used by:

- Home city preview
- Program Search filters
- Program Detail university context

### Program

```ts
export type Program = {
  id: string;
  name: string;
  universityId: string;
  cityId: string;
  degreeLevel: DegreeLevel;
  subjectArea: string;
  teachingLanguage: TeachingLanguage;
  intake: string;
  intakeTerm: 'spring' | 'fall';
  intakeYear: number;
  durationYears: number;
  deadlineDate: string;
  deadlineStatus: DeadlineStatus;
  tuitionRmb: number;
  tuitionPeriod: 'year' | 'program';
  scholarshipAvailable: boolean;
  scholarshipIds: string[];
  hskRequirement?: string;
  englishRequirement?: string;
  admissionTestRequirement?: string;
  documentRequirementIds: string[];
  documentBurden: 'light' | 'medium' | 'heavy';
  vacancyStatus: 'open' | 'limited' | 'full' | 'unknown';
  lateIntakeAvailable: boolean;
  sourceUrl?: string;
  sourceLabel?: string;
  sourceStatus: SourceStatus;
  lastVerifiedAt?: string;
  summary: string;
  fitTags: string[];
};
```

When backed by CSCAlite data, this type is a display projection of `SchoolProgram`. Preserve `schoolId`, `nameZh`, `nameEn`, `degreeLevel`, `durationYears`, `fieldCategory`, `teachingLanguage`, `cscaSubjects`, language requirements, tuition fields, open/deadline fields, application link/note, source fields, verification, status, and version. Add choice and school handoff must use these source fields rather than free text.

Application handoff records should carry `sourceFieldLineage` both inside `informationSources` and at the top level of the school-visible record. This is internal metadata for traceability and Agent explanation, not extra long-form teacher UI copy.

When a selected `SchoolProgram` has school-specific funding records, the handoff should include `scholarshipSignals` on the school-visible record and `informationSources.fromSchoolScholarshipRecords` inside the source snapshot. These records must be linked by `schoolId` and optional `programId`, and must remain distinct from public `Scholarship` search records.

Used by:

- Home featured programs
- Program Search
- Program Detail
- Hub choices
- Application Builder choices
- Compare

### Scholarship

```ts
export type Scholarship = {
  id: string;
  name: string;
  type: 'government' | 'university' | 'city' | 'external';
  coverage: 'full' | 'partial' | 'tuition_waiver' | 'stipend' | 'unknown';
  amountText: string;
  eligibleDegreeLevels: DegreeLevel[];
  deadlineDate?: string;
  deadlineStatus?: DeadlineStatus;
  programIds: string[];
  universityIds: string[];
  sourceUrl?: string;
  sourceStatus: SourceStatus;
  lastVerifiedAt?: string;
};
```

When backed by CSCAlite data, public scholarships are projections of `Scholarship` plus `ScholarshipSchool`/`ScholarshipProgram` links, while school-specific funding signals are projections of `SchoolScholarship`. Keep this split explicit so public funding search does not get confused with the school tenant's own received application records.

Used by:

- Home scholarship openings
- Program Search badges
- Program Detail tuition/scholarship section

### DocumentRequirement

```ts
export type DocumentRequirement = {
  id: string;
  type: string;
  label: string;
  description: string;
  requiredForProgramIds: string[];
  reusable: boolean;
  translationRequired: boolean;
  expiryRelevant: boolean;
  sourceStatus: SourceStatus;
};
```

Examples:

- Passport photo page
- High school transcript
- Transcript translation
- Graduation certificate
- IELTS or TOEFL certificate
- HSK certificate
- Study plan
- Recommendation letter

### StudentDocument

```ts
export type StudentDocument = {
  id: string;
  requirementId: string;
  status: DocumentStatus;
  fileName?: string;
  uploadedAt?: string;
  expiresAt?: string;
  reviewNote?: string;
  requiredByProgramIds: string[];
};
```

Used by:

- Hub missing documents
- Application Builder document section
- Program Detail readiness panel

### StudentProfile

```ts
export type StudentProfile = {
  id: string;
  displayName: string;
  nationality: string;
  currentEducationLevel: 'high_school' | 'undergraduate' | 'master' | 'other';
  targetDegreeLevel: DegreeLevel;
  targetIntakeYear: number;
  preferredTeachingLanguage: TeachingLanguage;
  budgetMaxRmbPerYear?: number;
  preferredCityIds: string[];
  hasPassport: boolean;
  hasEnglishTest: boolean;
  hasHsk: boolean;
  profileCompleteness: number;
};
```

Used by:

- Home returning state
- Program readiness
- Hub readiness
- Application Builder profile sections

### ApplicationChoice

```ts
export type ApplicationChoice = {
  id: string;
  programId: string;
  status: ChoiceStatus;
  addedAt: string;
  blockers: ApplicationBlocker[];
  warnings: ApplicationWarning[];
};
```

### ApplicationBlocker

```ts
export type ApplicationBlocker = {
  id: string;
  type: 'profile' | 'document' | 'deadline' | 'section';
  label: string;
  actionLabel: string;
  targetRoute: string;
  severity: 'hard' | 'warning';
};
```

### ApplicationWarning

```ts
export type ApplicationWarning = {
  id: string;
  label: string;
  actionLabel?: string;
  targetRoute?: string;
};
```

### ApplicationPacket

```ts
export type ApplicationPacket = {
  id: string;
  studentProfileId: string;
  choiceIds: string[];
  status: 'draft' | 'documents_missing' | 'ready_for_review' | 'adviser_reviewing' | 'returned';
  sectionStatuses: Record<ApplicationSectionKey, SectionStatus>;
  adviserReviewRequested: boolean;
  updatedAt: string;
};

export type ApplicationSectionKey =
  | 'personal'
  | 'passport'
  | 'education'
  | 'language_tests'
  | 'choices'
  | 'documents'
  | 'study_plan'
  | 'recommendation'
  | 'scholarship'
  | 'review';
```

Used by:

- Hub active application state
- Application Builder
- Review request success

### HubSnapshot

```ts
export type HubSnapshot = {
  student: StudentProfile;
  application: ApplicationPacket;
  choices: ApplicationChoice[];
  documents: StudentDocument[];
  nextAction: NextAction;
  deadlines: DeadlineItem[];
  messages: Message[];
  adviserAccess: AdviserAccess;
  lateIntakeSuggestions: string[];
};
```

### NextAction

```ts
export type NextAction = {
  id: string;
  label: string;
  body: string;
  actionLabel: string;
  targetRoute: string;
  priority: number;
};
```

### DeadlineItem

```ts
export type DeadlineItem = {
  id: string;
  programId?: string;
  scholarshipId?: string;
  label: string;
  date: string;
  status: DeadlineStatus;
  daysRemaining: number;
};
```

### Message

```ts
export type Message = {
  id: string;
  type: MessageType;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  targetRoute?: string;
};
```

### AdviserAccess

```ts
export type AdviserAccess = {
  adviserName: string;
  organizationName: string;
  expiresAt: string;
  scopes: AdviserScope[];
  recentEvents: AuditEvent[];
};

export type AdviserScope = {
  id: string;
  label: string;
  enabled: boolean;
  highRisk: boolean;
};
```

### AuditEvent

```ts
export type AuditEvent = {
  id: string;
  actorLabel: string;
  action: string;
  createdAt: string;
};
```

## 5. Search Types

```ts
export type ProgramSearchInput = {
  q?: string;
  degreeLevel?: DegreeLevel;
  intakeYear?: number;
  intakeTerm?: 'spring' | 'fall';
  teachingLanguage?: TeachingLanguage;
  subjectArea?: string;
  cityId?: string;
  tuitionMaxRmb?: number;
  scholarshipAvailable?: boolean;
  deadlineStatus?: DeadlineStatus;
  hskRequired?: boolean;
  englishRequired?: boolean;
  admissionTestRequired?: boolean;
  documentBurden?: 'light' | 'medium' | 'heavy';
  sourceStatus?: SourceStatus;
  lateIntakeAvailable?: boolean;
  sort?: 'deadline' | 'tuition' | 'readiness' | 'source';
  page?: number;
  pageSize?: number;
};

export type ProgramSearchResult = {
  items: ProgramSearchItem[];
  total: number;
  page: number;
  pageSize: number;
  facets: ProgramSearchFacets;
};

export type ProgramSearchItem = Program & {
  universityName: string;
  cityName: string;
  readinessLevel: ReadinessLevel;
  missingDocumentCount: number;
};

export type ProgramSearchFacets = {
  degreeLevels: DegreeLevel[];
  teachingLanguages: TeachingLanguage[];
  subjectAreas: string[];
  cityIds: string[];
  deadlineStatuses: DeadlineStatus[];
  documentBurdens: Array<'light' | 'medium' | 'heavy'>;
};
```

## 6. Mutation Types

```ts
export type ChoiceMutation = {
  programId: string;
  operation: 'add' | 'remove';
};

export type DocumentMutation = {
  documentId: string;
  operation: 'upload' | 'replace' | 'remove' | 'markAccepted' | 'markRejected';
};

export type SectionMutation = {
  applicationId: string;
  section: ApplicationSectionKey;
  status: SectionStatus;
  values?: Record<string, unknown>;
};
```

Rules:

- Mutations are idempotent.
- Duplicate add choice for the same program returns one choice.
- Duplicate upload while status is `uploading` is ignored.
- Review request rechecks blockers.

## 7. URL Parameter Contract

Program Search should support:

```txt
/programs?q=&degreeLevel=&teachingLanguage=&intakeYear=&intakeTerm=&cityId=&subjectArea=&scholarshipAvailable=&deadlineStatus=&documentBurden=&lateIntakeAvailable=&sort=&page=
```

Application Builder should support:

```txt
/hub/applications/:applicationId?section=documents
```

Rules:

- URLs should be shareable for search states.
- Unknown params are ignored.
- Invalid enum values fall back to default.

## 8. Derived Selectors

Implement pure selector functions:

- `getProgramDeadlineStatus(program, today)`
- `getMissingDocumentsForChoice(choice, documents, requirements)`
- `getReadinessForProgram(program, profile, documents)`
- `getHubNextAction(snapshot)`
- `getApplicationHardBlockers(packet, choices, documents)`
- `getApplicationWarnings(packet, choices, documents)`
- `getSearchResults(input, programs, universities, profile)`

These should have Vitest coverage.

## 9. Seed Data Tone

Mock content should feel real:

- Use real-looking China university/program names.
- Use realistic deadlines and tuition values.
- Use realistic document requirements.
- Use source labels and verification dates.
- Avoid exaggerated promises.
- Avoid fake guaranteed admission.

Suggested sample programs:

- Computer Science MSc, Zhejiang University, English-taught
- International Business BBA, Shanghai University, English-taught
- Clinical Medicine MBBS, Xi'an Jiaotong University, English-taught
- Civil Engineering MSc, Tongji University, English-taught
- Chinese Language Non-degree, Beijing Language and Culture University, Chinese-taught
- Economics BA, Fudan University, Chinese-taught
- Artificial Intelligence MSc, Harbin Institute of Technology Shenzhen, English-taught
- Environmental Engineering PhD, Tsinghua University, English-taught
- Software Engineering BEng, Southeast University, bilingual
- International Trade MSc, University of International Business and Economics, late intake

## 10. Contract Acceptance

This data contract is ready when:

- All core pages can be built without inventing new fields.
- All fields have clear ownership and page usage.
- Mock data can drive the full primary product flow.
- The data client can later call backend APIs without changing page-level components.
- Search filters and URL params map directly to `ProgramSearchInput`.
- Application and document blockers can be computed from selectors.
