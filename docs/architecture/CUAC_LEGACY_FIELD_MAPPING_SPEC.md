# CUAC Legacy Field Mapping Spec

Date: 2026-08-17

Status: source-of-truth field contract for the CUAC frontend demo.

## 1. Source Of Truth

CUAC discovery fields should be based on the CSCAlite legacy project at:

- `D:\CODE\CSCAlite\backend\prisma\schema.prisma`
- `D:\CODE\CSCAlite\backend\src\schools\schools.types.ts`
- `D:\CODE\CSCAlite\backend\src\schools\schools.service.ts`
- `D:\CODE\CSCAlite\backend\src\schools\scholarships.service.ts`
- `D:\CODE\CSCAlite\frontend\src\lib\api-types.ts`
- `D:\CODE\CSCAlite\frontend\src\lib\api-schools.ts`
- `D:\CODE\CSCAlite\frontend\src\lib\api-study-china.ts`
- `D:\CODE\CSCAlite\frontend\src\lib\api-scholarships.ts`

The current static CUAC demo can keep compact display aliases, but those aliases must map back to the CSCAlite contracts. For example, `program.name` is a display alias for `SchoolProgram.nameEn`, and `program.university` is a display alias for the parent `School.nameEn`.

Field governance rule: CUAC should preserve two layers. The source layer keeps current CSCAlite/Prisma-compatible field names such as `School.officialWebsiteUrl`, `School.admissionsWebsiteUrl`, `School.qualityScore`, `SchoolProgram.deadlineDate`, `Scholarship.fundingLevel`, and `CityGuide.contentJson`. The display/API layer may expose clearer CUAC aliases such as `program.name`, `program.university`, and `city.name`, but every alias must be traceable to one source field or an explicitly named derived field.

## 2. Entity Boundaries

CUAC should treat these as separate but related entities:

| Entity | Legacy model/type | CUAC usage |
| --- | --- | --- |
| School | `School`, `SchoolRecord` | University listing/detail, school tenant scope, parent for programs and school scholarships |
| Program | `SchoolProgram`, `SchoolProgramRecord` | Program discovery, Add choice, application school handoff |
| School scholarship | `SchoolScholarship`, `SchoolScholarshipRecord` | Funding attached to one school and optionally one program |
| Public scholarship | `Scholarship`, `PublicScholarship` | Scholarship listing/detail across schools/programs/countries |
| City | `CityGuide`, `CityGuideAggregate` | City listing/detail and city-based discovery facets |
| Search item | `SearchItem`, `SearchResult` | Future global search or Agent retrieval result |

## 3. Required Field Families

### School

Use CSCAlite naming for persisted/API-compatible data:

- identity: `id`, `nameZh`, `nameEn`, `schoolType`, `rank`
- location: `region`, `city`, `cityZh`, `citySlug`, `regionLabel`
- admissions: `cscaRequired`, `cscaRequirement`, `cscaSubjects`, `applicationLevel`, `languageOfInstruction`
- language: `languageRequirement`, `hskRequirement`, `englishRequirement`
- cost and deadlines: `deadlineSummary`, `tuitionSummary`, `applicationFee`
- links and source: `officialWebsiteUrl`, `admissionsWebsiteUrl`, `sourceUrl`, `sourceLabel`, `sourceNote`, `lastVerifiedAt`, `verificationStatus`, `qualityScore`
- source governance: `source`, `sourceId`, `missingFields`, `completenessLabel`, `status`, `version`, `createdAt`, `updatedAt`
- derived display: `featuredPrograms`, `scholarships`, `fitNotes`, `derivedTags`, `subjectTags`, `languageTags`, `tuitionBandLabel`, `hasEnglishPrograms`, `hasScholarships`, `decisionSummary`
- aggregates: `programCount`, `undergraduateProgramCount`, `postgraduateProgramCount`, `englishProgramCount`, `programSubjectTags`, `programTuitionBandLabel`, `programQualityIssues`, `scholarshipCount`, `cscScholarshipCount`
- relations: `programs`, `cscaRules`, `scholarshipsDetailed`, `upcomingDeadlines`, `requiredSubjectTags`, `quickFacts`, `detailDisplay`

CUAC aliases allowed in static pages:

- `university` or `schoolName` -> `nameEn`
- `city` -> `cityZh` or derived English city label
- `type` -> `schoolType`

### Program

Use CSCAlite `SchoolProgramRecord` as the Add choice and program listing base:

- identity: `id`, `schoolId`, `nameZh`, `nameEn`
- program profile: `degreeLevel`, `durationYears`, `fieldCategory`, `teachingLanguage`
- entrance requirements: `cscaSubjects`, `cscaRequirement`, `hskRequirement`, `englishRequirement`
- cost and funding: `tuitionAmount`, `tuitionCurrency`, `tuitionPeriod`, `tuitionText`, `scholarshipText`
- timing: `openDate`, `deadlineDate`, `deadlineLabel`, `applicationRound`
- links and source: `applicationUrl`, `applicationNote`, `sourceUrl`, `sourceLabel`, `lastVerifiedAt`
- governance/display: `sortOrder`, `status`, `isVerified`, `hasScholarship`, `badgeText`, `displayTuition`, `displaySubjects`, `displayGroup`, `displayGroupLabel`

CUAC aliases allowed in static pages:

- `name` -> `nameEn`
- `university` -> parent `School.nameEn`
- `degree` -> `degreeLevel`
- `duration` -> `durationYears`
- `subject` -> `fieldCategory`
- `language` -> `teachingLanguage`
- `tuition` -> `tuitionAmount`
- `deadline` -> `deadlineDate`
- `scholarship` -> `hasScholarship`

### Scholarship

Use CSCAlite `PublicScholarship` for the public scholarship catalog:

- identity: `id`, `slug`, `title`
- provider: `type`, `typeLabel`, `providerName`, `providerNameEn`, `providerLocation`
- funding: `fundingLevel`, `coverage`, `amountText`, `benefits`, `benefitItems`
- scope: `schoolId`, `schoolName`, `schools`, `programId`, `programName`, `programs`, `applicableDegree`, `applicableProgram`
- requirements: `requirementText`, `eligibilityItems`, `applicationMaterials`, `applicationSteps`
- content: `summary`, `bodySections`, `contactInfo`, `actionLinks`
- timing/source: `deadlineDate`, `deadlineLabel`, `applicationRound`, `sourceUrl`, `sourceLabel`, `lastVerifiedAt`
- governance/display: `sortOrder`
- targeting: `targetCountries`, `targetRegions`, `tags`

School-specific funding should use `SchoolScholarshipRecord` fields: `id`, `schoolId`, optional `programId`, `name`, `type`, `coverage`, `applicableDegree`, `applicableProgram`, `amountText`, `requirementText`, `deadlineDate`, `deadlineLabel`, `applicationRound`, `scholarshipSlug`, `sourceUrl`, `sourceLabel`, `lastVerifiedAt`, `sortOrder`, `status`, `isCsc`, `isVerified`.

### City

Use CSCAlite `CityGuide` and `CityGuideAggregate`:

- identity/location: `slug`, `nameZh`, `nameEn`, `region`
- cost/density: `monthlyCost`, `costLevel`, `density`
- content: `tags`, `content.summary`, `content.overview`, `content.quickFacts`, `content.budgetSummary`, `content.costProfiles`, `content.why`, `content.costBreakdown`, `content.lifeSections`, `content.transportNotes`, `content.applicationTips`, `content.applicationAdvice`, `content.relatedProgramKeywords`, `content.nextSteps`, `content.faqs`, `content.cityFaqs`
- relationships: `nearby`, `references.schoolCount`, `references.programCount`, `references.englishProgramCount`, `references.scholarshipCount`, `references.cscaRequiredSchoolCount`
- aggregate: `actualSchoolCount`, `actualProgramCount`, `actualEnglishProgramCount`, `actualScholarshipCount`, `actualCscaRequiredSchoolCount`, `visibleSchools`, `visiblePrograms`, `visibleScholarships`
- governance: `status`, `sortOrder`, `version`, `updatedAt`

## 4. Add Choice Information Sources

The Add choice modal should not ask the student to type every field that later appears in the school portal. It should select only the fields that define the route, then enrich the school-visible record from program, school, and student-profile sources.

| School-visible information | Source |
| --- | --- |
| Selected school/program | Student chooses `schoolId` and `programId` from `School` + `SchoolProgram` data |
| Study level, intake, teaching language | Student confirms values constrained by the selected `SchoolProgramRecord` |
| Program name, tuition, deadline, application round, verification | `SchoolProgramRecord` fields such as `nameEn`, `tuitionAmount`, `deadlineDate`, `applicationRound`, `sourceUrl`, `lastVerifiedAt` |
| School-specific scholarship or funding signal | `SchoolScholarshipRecord` fields linked by `schoolId` and optional `programId`; this is enrichment from the selected route, not a student-entered field |
| School name, city, region, admissions link, fee notes | Parent `SchoolRecord` fields such as `nameEn`, `citySlug`, `cityZh`, `region`, `admissionsWebsiteUrl`, `applicationFee` |
| Applicant name, email, nationality/country, education background, language test summary, consent | Student profile and application info step, not the Add choice selector |
| Transcript, passport scan, certificates, recommendation letters, physical exam form | Not collected by CUAC in this demo flow; the school requests these directly after receiving the record |

This means the school portal should show only that school's received record. It can show the selected program, student contact/profile summary, status, funding intent, source, and next-action fields, but it must not reveal other school choices or student private Agent memory.

Current demo implementation:

- `CuacDataClient.getProgramCatalog()` returns Add choice options enriched with CSCAlite-compatible `SchoolProgramRecord` fields, not just display labels.
- `CuacDataClient.buildSubmittedRecords()` builds a tenant-scoped school handoff record with `schoolId`, `programId`, `programFullName`, `deadlineDate`, `tuition`, `applicationRound`, `sourceLabel`, `lastVerifiedAt`, `scholarshipSignals`, `informationSources`, and `notCollectedByCuac`.
- `informationSources.selectedByStudent` contains only the route-defining selector fields.
- `informationSources.fromProgramRecord` and `informationSources.fromSchoolRecord` explain fields that were derived from the catalog.
- `informationSources.fromSchoolScholarshipRecords` carries only scholarship/funding records linked to this selected school and program; it must stay separate from public `Scholarship` records.
- `informationSources.fromStudentProfile` explains profile/contact fields that came from the student info step.
- `informationSources.sourceFieldLineage` and the top-level school handoff `sourceFieldLineage` preserve machine-readable lineage for Agent citation and future API/database replacement.
- `informationSources.notCollectedByCuac` preserves the rule that transcript, passport scan, certificates, recommendation letters, and physical exam forms are requested by the school, not uploaded to CUAC in this demo.

## 5. Frontend Demo Rule

`design-lab/cuac-data.js` is the static demo boundary. New static catalog data should go there first, with CSCAlite-compatible field names preserved. Page scripts may use display aliases, but the shared data object should expose enough legacy fields for future API replacement.

Current first pass:

- `CuacDataClient.legacyFieldContracts` documents expected CSCAlite-compatible fields.
- `CuacDataClient.legacyFieldContracts.sourceModelFields` lists the raw CSCAlite source fields that must not be lost when the demo becomes API-backed.
- `CuacDataClient.legacyFieldContracts.displayAliases` lists the allowed CUAC display aliases and the source field each alias represents.
- `CuacDataClient.getDiscoveryPrograms()` returns current demo programs with both CUAC display aliases and `SchoolProgramRecord`-compatible fields.
- `CuacDataClient.getDiscoverySchools()`, `getDiscoveryScholarships()`, and `getDiscoveryCities()` now own the static demo arrays for universities, scholarships, and cities.
- `CuacDataClient.getDiscoveryGuides()` exposes guide/search references using `SearchItem`-style fields for future global search and Agent retrieval.
- `CuacDataClient.getCompletionDetail()` owns the static detail-page catalog used by program, university, scholarship, city, and guide completion/detail pages.
- `CuacDataClient.buildSubmittedRecords()` is the current field-source bridge from student application choices to tenant-scoped school portal records.
- Existing `programs.js` reads from `CuacDataClient.getDiscoveryPrograms()` and keeps `fallbackPrograms` only as a local safety fallback; universities, scholarships, cities, guides, and completion details now use thin page calls with no local catalog array.

## 6. Next Data Extraction Order

1. Programs: keep `SchoolProgramRecord` compatibility because Add choice and school handoff depend on it.
2. Universities: convert to `SchoolRecord` compatibility.
3. Scholarships: split public `PublicScholarship` fields from school-scoped `SchoolScholarshipRecord` fields.
4. Cities: convert to `CityGuide` plus lightweight aggregate fields.
5. Guides/search: use `SearchItem.metadata` for Agent-readable references when global search returns. Initial `getDiscoveryGuides()` wiring is in place; a later UI pass can make the guide library fully dynamic.

## 7. Agent Implication

Agent actions and natural-language analysis should read the same entity contracts:

- program recommendation uses `SchoolProgramRecord` fields plus parent school/city fields;
- school staff analysis uses only tenant-scoped application records and school-owned program fields;
- scholarship summaries distinguish full public scholarships from school-specific funding signals;
- city analysis uses cost, references, and aggregate counts;
- operations/admin views can summarize cross-tenant quality but must audit any raw record access.

## 8. Runtime Contract Surface

The frontend demo should expose the legacy mapping as a runtime contract, not only as prose in this document.

Current rule:

- `CuacDataClient.legacyFieldContracts.auditEvidence` records the CSCAlite files and models checked for this field baseline.
- `CuacDataClient.legacyFieldContracts.auditEvidence.currentBaseline` records the current CSCAlite model/type baseline checked from `D:\CODE\CSCAlite`, including must-preserve field groups for `School`, `SchoolProgram`, `SchoolScholarship`, public `Scholarship`, `CityGuide`, and `CityGuideAggregate`.
- `CuacDataClient.legacyFieldContracts.entityContracts` defines the runtime entity boundary for `School`, `Program`, `SchoolScholarship`, `PublicScholarship`, and `City`.
- `CuacDataClient.getLegacyEntityContract(entityName)` returns a single entity contract by common CUAC or CSCAlite name. For example, `Program` and `SchoolProgram` resolve to the same `SchoolProgramRecord` boundary; `Scholarship` resolves to public scholarship, while `SchoolScholarship` remains school-scoped funding context.
- `CuacDataClient.getLegacySourceCoverageAudit()` checks that each current-baseline must-preserve field is present in the runtime source field family or entity contract. This catches accidental drift such as dropping `SchoolProgram.applicationUrl`, scholarship rich-content fields, granular school language fields, or `CityGuideAggregate` counts from the frontend demo contract.
- `CuacDataClient.getLegacyContractReadiness()` scans the runtime demo records for `Program`, `School`, `PublicScholarship`, `City`, and tenant-scoped `SchoolHandoff` records. It returns `passed`, `issueCount`, per-entity record counts, required fields, and field-level issues so tests can prove that the current demo data still exposes CSCAlite-compatible canonical fields, not only display aliases.
- Page code may still use display aliases, but Agent actions, Add choice, school handoff, analytics, and future API/database replacements should cite this runtime contract when deciding which fields can be used and which fields are derived.

This matters most for natural-language Agent work. When the Agent summarizes "scholarships", it must know whether it is analyzing public scholarship records or school-scoped funding signals attached to a selected program. When it summarizes city cost, it must know whether it is using `CityGuide.contentJson` or aggregate fields. When it sends a school handoff, it must know that the school receives only its own `schoolId`/`programId` application record.

## 9. Current Audit Against CSCAlite

Verified against the current `D:\CODE\CSCAlite` worktree on 2026-08-20. Use the current Prisma schema and public/backend types as the baseline, not a single early migration file.

Authoritative evidence checked:

- `backend/prisma/schema.prisma`: `CityGuide`, `School`, `SchoolProgram`, `SchoolCscaRule`, `SchoolScholarship`, `Scholarship`, `ScholarshipSchool`, and `ScholarshipProgram`.
- `backend/src/schools/schools.types.ts`: `SchoolRecord`, `SchoolProgramRecord`, `SchoolScholarshipRecord`, school search/filter types, and display helper types.
- `backend/src/study-china/study-china.types.ts`: `CityGuideRecord`, `CityGuideAggregate`, `CityGuideInput`, and application timeline city/program projection types.
- `frontend/src/lib/api-types.ts`: frontend-facing `School`, `SchoolProgram`, `SchoolScholarship`, `PublicScholarship`, `CityGuide`, and `CityGuideAggregate`.
- `backend/prisma/migrations/0008_school_decision_enhancements/migration.sql`: adds the program timing and application fields that `0007_school_programs` does not contain.
- `backend/prisma/migrations/0016_scholarship_deadlines/migration.sql`: adds public scholarship timing fields.
- `backend/prisma/migrations/0021_school_scholarship_versioning/migration.sql`: adds `version` to school, program, rule, scholarship, and public scholarship records.
- `backend/prisma/migrations/0026_scholarship_detail_content/migration.sql`: adds scholarship content arrays and action/contact fields.
- `backend/prisma/migrations/0027_scholarship_provider_fields/migration.sql`: adds provider name and location fields.
- `backend/prisma/migrations/0037_school_city_dimension/migration.sql`: adds `citySlug` and `cityZh` to schools.

Audit result:

| Area | CSCAlite final baseline | CUAC rule |
| --- | --- | --- |
| Program deadline/application fields | `SchoolProgram.openDate`, `deadlineDate`, `deadlineLabel`, `applicationRound`, `applicationUrl`, `applicationNote` exist in current schema and were introduced after `0007_school_programs` | Add choice, program pages, application handoff, and school portal must keep these fields even if a compact seed record omits them. |
| Program versioning | `SchoolProgram.version`, `createdAt`, and `updatedAt` exist through school scholarship versioning/current schema and frontend API type | Catalog replacement should treat these as source-governance metadata, not UI copy. |
| School language detail | Current `School` exposes summarized HSK/English requirement fields such as `hskRequirement` and `englishRequirement` | CUAC filters and Agent eligibility reasoning should cite these summarized fields unless a later CSCAlite schema reintroduces granular language scoring. |
| School scholarship source model | `SchoolScholarship` is a separate source model from public `Scholarship` and links optionally to `SchoolProgram` | CUAC source lineage must keep `SchoolScholarship` distinct so school-specific funding signals do not become public-scholarship records or cross-tenant application data. |
| School city fields | `School.citySlug` and `School.cityZh` exist in current schema through city dimension migration | University and city pages should use these as the canonical city link, with CUAC aliases only for display. |
| Scholarship content | `Scholarship.bodySections`, `benefitItems`, `eligibilityItems`, `applicationMaterials`, `applicationSteps`, `contactInfo`, and `actionLinks` exist | Scholarship pages must not flatten rich scholarship content into a single paragraph-only card model. |
| Public scholarship targeting | `targetCountries`, `targetRegions`, `benefits`, `ScholarshipSchool`, and `ScholarshipProgram` are part of the final public scholarship shape | Scholarship search and Agent summaries must distinguish global public scholarship eligibility from school-specific funding attached to one received application. |
| City content | Prisma stores `CityGuide.contentJson`; API/types expose `content` with structured sections and `CityGuideAggregate` | CUAC may render `city.content`, but source lineage must cite `CityGuide.contentJson`; aggregate counts should be derived or snapshotted, not handwritten per page. |

Runtime guard added on 2026-08-20:

- `legacyFieldContracts.auditEvidence.currentBaseline.School.mustPreserveFields` includes the city, website/admissions, summarized HSK/English requirement, deadline summary, tuition summary, scholarship relation, and source-quality fields verified from CSCAlite.
- `legacyFieldContracts.auditEvidence.currentBaseline.SchoolProgram.mustPreserveFields` includes `applicationUrl`, `applicationNote`, timing, tuition, and source-governance fields from the current `SchoolProgram` model and `SchoolProgramRecord` type.
- `legacyFieldContracts.auditEvidence.currentBaseline.PublicScholarship.mustPreserveFields` includes provider, rich content, material, action link, targeting, school-link, and program-link fields from the current `Scholarship` and `PublicScholarship` shapes.
- `legacyFieldContracts.auditEvidence.currentBaseline.City.mustPreserveFields` spans both `CityGuide` and `CityGuideAggregate`, so the demo preserves editorial content and derived aggregate counts separately.

Implementation guardrails:

- Do not treat `migration-intake/0007_school_programs/migration.sql` as the complete program model by itself. The CUAC intake sequence also needs `0008_school_decision_enhancements`, `0021_school_scholarship_versioning`, and later scholarship/city migrations.
- Demo records may be sparse, but `CuacDataClient` normalizers must always expose the final canonical field family or explicit empty defaults.
- Page scripts can consume aliases such as `program.deadline`, `city.name`, or `scholarship.name`; Agent actions, Add choice, school handoff, API design, and database design must keep canonical fields such as `deadlineDate`, `nameEn`, `title`, and `contentJson` traceable through `sourceFieldLineage`.
- School portal analytics should read tenant-scoped `schoolId`, `programId`, `degreeLevel`, `teachingLanguage`, `deadlineDate`, `applicationRound`, funding fields, and student profile fields from the handoff snapshot; it must not infer hidden choices from other schools.
