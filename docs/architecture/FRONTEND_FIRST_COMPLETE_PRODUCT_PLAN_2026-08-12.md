# CUAC Frontend-First Complete Product Plan

Date: 2026-08-12

Principle: design the complete student-facing frontend first, then derive backend modules, data models, admin workflows, and provider/adviser tools from that experience.

Product direction: Calm Application Workspace.

CUAC should be simple, direct, clear, visually friendly, and light to use. It should feel like a trustworthy international application workspace, not a government portal, university brochure, or agency sales site.

## 1. Product Positioning

CUAC is a program-first China university application platform for international students.

The student should always understand:

- what programs they can apply for
- whether they are eligible
- what documents they need
- when each deadline is
- what scholarships are available
- what stage each application is in
- who can help them
- what alternatives remain if plans change

The frontend should make uncertainty visible and manageable.

## 2. Core Frontend Rules

- First screen must be useful: search, continue application, or deadline reminder.
- Prefer program-level actions over university-level actions.
- Avoid marketing-heavy hero pages.
- Use calm visual hierarchy: white, light grey, deep teal/blue-green, clear blue actions, amber deadline warnings, green ready states, red blockers.
- Every important requirement must show source freshness or verification status.
- Every CTA must be concrete: `Search programs`, `Save`, `Compare`, `Add to choices`, `Upload document`, `Request review`.
- Do not hide key facts behind long prose.
- Mobile must support searching, saving, uploading, and checking status without friction.

## 3. Frontend Route Map

### Public Student Routes

- `/`
- `/programs`
- `/programs/:programId`
- `/universities`
- `/universities/:universityId`
- `/scholarships`
- `/scholarships/:scholarshipId`
- `/china/cities`
- `/china/cities/:citySlug`
- `/apply/guide`
- `/apply/timeline`
- `/late-intake`
- `/compare`
- `/auth`

### Student Hub Routes

- `/hub`
- `/hub/profile`
- `/hub/documents`
- `/hub/shortlist`
- `/hub/choices`
- `/hub/applications/:applicationId`
- `/hub/messages`
- `/hub/adviser-access`
- `/hub/settings`

### Adviser Routes

- `/adviser`
- `/adviser/students`
- `/adviser/students/:studentId`
- `/adviser/applications`
- `/adviser/applications/:applicationId`
- `/adviser/references`
- `/adviser/reports`

### Provider Routes

- `/provider`
- `/provider/profile`
- `/provider/programs`
- `/provider/programs/:programId`
- `/provider/applications`
- `/provider/applications/:applicationId`
- `/provider/vacancies`
- `/provider/messages`

### Platform Admin Routes

- `/admin`
- `/admin/universities`
- `/admin/programs`
- `/admin/scholarships`
- `/admin/cities`
- `/admin/applications`
- `/admin/advisers`
- `/admin/providers`
- `/admin/audit`

## 4. Page Plans

## 4.1 Home

Purpose: let a new student start finding China programs immediately.

Primary layout:

- Top nav: CUAC, Find Programs, Universities, Scholarships, China Guides, Apply, Hub.
- First viewport:
  - headline: direct China study application promise
  - large program search input
  - quick filters: Undergraduate, Master, English-taught, Scholarship, Late intake
  - current cycle/deadline strip
  - signed-in state: Continue application
- Below:
  - recommended open programs
  - application steps preview
  - scholarship openings
  - city guide preview
  - trust/source verification explanation

Primary data needed:

- public program search summary
- deadline/cycle summary
- featured programs
- featured scholarships
- featured cities
- current user application snapshot if signed in

Backend implications:

- `GET /api/v1/home`
- `GET /api/v1/programs/featured`
- `GET /api/v1/application-cycles/current`
- `GET /api/v1/me/hub-snapshot`

## 4.2 Program Search

Purpose: main decision workspace.

Layout:

- Desktop: left filter rail, center result list, right/ bottom compare tray.
- Mobile: search input, filter bottom sheet, list cards, sticky action drawer.

Filters:

- keyword
- degree level
- intake year/term
- teaching language
- subject category
- city/province
- tuition band
- scholarship available
- deadline status
- HSK requirement
- English test requirement
- CSCA/admission test requirement
- document burden
- verified/partner
- late-intake availability

Program result row:

- program name
- university
- city
- degree level
- teaching language
- intake
- deadline badge
- tuition
- scholarship badge
- HSK/English/CSCA requirement chips
- document count
- source freshness
- actions: Save, Compare, Add to choices

States:

- loading skeleton
- no results with Relax filters
- stale source warning
- login-required inline prompt
- offline/degraded search warning

Primary data needed:

- program result list
- facets
- pagination
- saved status
- compare status
- eligibility hints from profile if signed in

Backend implications:

- `GET /api/v1/programs`
- `GET /api/v1/programs/facets`
- `POST /api/v1/me/saved-programs`
- `POST /api/v1/me/compare-programs`
- `POST /api/v1/me/choices`
- search indexes on program, university, city, subject, requirements, deadlines

## 4.3 Program Detail

Purpose: turn interest into a saved/compared/application choice.

Layout:

- Header:
  - program name
  - university
  - city
  - intake
  - deadline
  - teaching language
  - tuition
  - verified source
- Sticky readiness panel:
  - profile match
  - missing requirements
  - missing documents
  - deadline countdown
  - Save / Compare / Add to choices
- Main sections:
  - Overview
  - Eligibility
  - Required documents
  - Tuition and scholarships
  - Application timeline
  - University and campus
  - Source and verification
  - Similar programs
  - Late alternatives

Primary data needed:

- program detail
- linked university
- requirement rules
- document requirements
- scholarship matches
- source records
- student readiness snapshot if signed in

Backend implications:

- `GET /api/v1/programs/:id`
- `GET /api/v1/programs/:id/readiness`
- `GET /api/v1/programs/:id/similar`
- `GET /api/v1/programs/:id/scholarships`

Data implications:

- `Program`
- `ProgramIntake`
- `AdmissionRequirement`
- `DocumentRequirement`
- `ProgramScholarship`
- `ProgramSource`

## 4.4 University Detail

Purpose: build trust and support school-level exploration.

Tabs:

- About
- Programs
- International students
- Scholarships
- Student life
- Requirements
- Contact and sources

Important: university detail is not the primary apply object. Program is.

Primary data needed:

- university profile
- international support content
- program list
- city/campus data
- scholarship list
- source freshness

Backend implications:

- `GET /api/v1/universities/:id`
- `GET /api/v1/universities/:id/programs`
- `GET /api/v1/universities/:id/scholarships`

## 4.5 Scholarships

Purpose: let scholarship-first students find viable programs.

Scholarship list card:

- scholarship name
- funding level
- eligible degree level
- country restrictions if any
- deadline
- linked universities/programs
- application route
- Save / View matching programs

Detail page:

- coverage
- eligibility
- required documents
- deadline
- eligible programs
- application process
- source verification

Backend implications:

- `GET /api/v1/scholarships`
- `GET /api/v1/scholarships/:id`
- `GET /api/v1/scholarships/:id/programs`

Data implications:

- scholarship must link to program/intake, not only university.

## 4.6 China City Guides

Purpose: help international students decide where they can realistically live and study.

City page sections:

- quick facts
- average monthly living cost
- climate
- student life
- transport
- international student support
- universities/programs in city
- scholarships in city
- arrival notes

Frontend tone: practical, not travel-magazine.

Backend implications:

- `GET /api/v1/cities`
- `GET /api/v1/cities/:slug`
- `GET /api/v1/cities/:slug/programs`

## 4.7 Apply Guide And Timeline

Purpose: explain the process without forcing students to read long articles.

Guide structure:

- Choose programs
- Check requirements
- Prepare documents
- Request review
- Submit application
- Track offer
- Prepare visa/arrival

Timeline:

- global cycle view
- personalized signed-in deadlines
- scholarship deadline overlay
- late-intake openings

Backend implications:

- `GET /api/v1/application-cycles`
- `GET /api/v1/me/deadlines`

## 4.8 Late Intake

Purpose: China version of UCAS Clearing.

Page content:

- programs still accepting applications
- close-soon programs
- English-taught open programs
- scholarship still open
- lower document burden options
- similar alternatives based on rejected/expired choices

Card should explain why it is viable:

- "Open until 30 June"
- "Accepts English certificate later"
- "No CSCA requirement"
- "Scholarship deadline still open"

Backend implications:

- `GET /api/v1/late-intake/programs`
- `GET /api/v1/me/late-intake-matches`

Data implications:

- program vacancy/open status
- conditional acceptance notes
- late-intake rules

## 4.9 Student Hub

Purpose: central application cockpit.

Hub blocks:

- Next best action
- Readiness meter
- Active choices
- Missing documents
- Upcoming deadlines
- Messages
- Adviser access
- Late intake suggestions

Example messages:

- "2 applications are ready for adviser review."
- "Your transcript translation is missing for Fudan University."
- "Shanghai Jiao Tong University closes in 9 days."
- "3 English-taught alternatives are still open."

Backend implications:

- `GET /api/v1/me/hub`
- `GET /api/v1/me/tasks`
- `GET /api/v1/me/deadlines`
- `GET /api/v1/me/messages`

Data implications:

- `StudentTask`
- `ApplicationChoice`
- `ApplicationStatusEvent`
- `StudentDocument`
- `AdvisorConsentGrant`

## 4.10 Profile

Purpose: collect reusable student data once.

Sections:

- basic identity
- nationality/passport
- current education
- academic history
- language tests
- target study plan
- budget/scholarship preference
- adviser/guardian info

Frontend rules:

- autosave by section
- show why each field matters
- do not force all fields upfront
- flag fields required by active choices

Backend implications:

- `GET /api/v1/me/profile`
- `PATCH /api/v1/me/profile`
- `GET /api/v1/me/profile/completeness`

## 4.11 Documents

Purpose: requirement-led document management.

Views:

- Required by current choices
- Reusable documents
- Needs translation
- Expiring soon
- Uploaded
- Rejected / needs reupload

Upload states:

- missing
- uploading
- scanning
- uploaded
- under review
- accepted
- rejected
- locked after submission

Backend implications:

- `GET /api/v1/me/documents`
- `POST /api/v1/me/documents`
- `PATCH /api/v1/me/documents/:id`
- `DELETE /api/v1/me/documents/:id`
- file scan service
- object storage

Data implications:

- `StudentDocument`
- `DocumentRequirement`
- `DocumentReview`
- `DocumentVisibilityGrant`

## 4.12 Choices And Application Builder

Purpose: let students prepare application packets.

Application builder layout:

- left: section nav with status
- center: current form section
- right: contextual requirements and blockers

Sections:

- Personal details
- Nationality/passport
- Education
- Language tests
- Program choices
- Documents
- Study plan
- Recommendation/referee
- Scholarship intent
- Review and submit

Status:

- not started
- in progress
- needs attention
- ready
- submitted
- returned
- locked

Backend implications:

- `GET /api/v1/me/applications/:id`
- `PATCH /api/v1/me/applications/:id/sections/:section`
- `POST /api/v1/me/applications/:id/submit`
- `POST /api/v1/me/applications/:id/request-review`

Data implications:

- `ApplicationPacket`
- `ApplicationSection`
- `ApplicationChoice`
- `ApplicationStatusEvent`
- `ApplicationBlocker`
- `ReferenceRequest`

## 4.13 Messages

Purpose: keep all application-related communication in context.

Message types:

- adviser message
- provider message
- system reminder
- document request
- interview invitation
- offer update

Backend implications:

- `GET /api/v1/me/messages`
- `POST /api/v1/me/messages`
- notification service

## 4.14 Adviser Access

Purpose: make agent/counsellor permissions transparent.

Student sees:

- adviser name
- organization
- permissions
- expiry
- recent actions
- revoke button

Permission scopes:

- profile read
- shortlist read
- document filenames read
- document view
- document upload
- application edit
- application submit
- message student
- offer reply assist

Backend implications:

- `GET /api/v1/me/adviser-access`
- `POST /api/v1/me/adviser-access`
- `DELETE /api/v1/me/adviser-access/:grantId`

Data implications:

- `Advisor`
- `AdvisorOrganization`
- `AdvisorConsentGrant`
- `AuditEvent`

## 5. Role-Based Frontend

## 5.1 Student

Primary tasks:

- search
- save
- compare
- add to choices
- upload documents
- request review
- track applications
- manage adviser access

## 5.2 Adviser

Primary tasks:

- view assigned students
- monitor completion
- review applications
- return to student
- upload/help with documents if allowed
- manage references
- submit if authorized
- track offers and deadlines

## 5.3 Provider

Primary tasks:

- maintain university profile
- maintain programs/intakes
- update vacancy/open status
- review partner applications
- request documents
- issue status/offer updates

## 5.4 Admin

Primary tasks:

- verify data
- manage universities/programs/scholarships/cities
- review source freshness
- manage applications and disputes
- manage providers/advisers
- audit actions

## 6. Design System

## 6.1 Visual Tokens

Colors:

- background: `#f7f9fb`
- surface: `#ffffff`
- border: `#d9e2e8`
- text primary: `#13252f`
- text secondary: `#536872`
- primary: `#006b68`
- action: `#1f6feb`
- success: `#168a4a`
- warning: `#b7791f`
- danger: `#c2412d`
- scholarship accent: `#b98a24`

Shape:

- cards: 8px radius max
- buttons: 6px radius
- inputs: 6px radius

Spacing:

- dense work surfaces
- generous internal padding
- no nested card stacks

## 6.2 Components

Navigation:

- `TopNav`
- `MobileNavDrawer`
- `RoleEntryMenu`
- `DeadlineStrip`
- `UserMenu`

Search:

- `ProgramSearchBar`
- `FilterRail`
- `FilterDrawer`
- `FilterChip`
- `SortSelect`
- `ViewToggle`
- `ProgramResultRow`
- `CompareTray`

Program:

- `ProgramHeader`
- `EligibilitySnapshot`
- `RequirementList`
- `DocumentRequirementTable`
- `TuitionScholarshipPanel`
- `SourceFreshnessBlock`
- `SimilarProgramList`

Hub:

- `NextActionPanel`
- `ReadinessMeter`
- `ChoiceStatusList`
- `DocumentChecklist`
- `DeadlineList`
- `AdviserAccessSummary`

Application:

- `ApplicationSectionNav`
- `AutosaveIndicator`
- `BlockerList`
- `DocumentUploadSlot`
- `ReviewSubmitPanel`
- `StatusTimeline`

Admin/provider:

- `DataWorkbenchShell`
- `RecordList`
- `RecordEditor`
- `SourceAuditPanel`
- `BulkImportPanel`

## 7. Backend Modules Derived From Frontend

Required backend modules:

- `auth`
- `users`
- `student-profile`
- `universities`
- `programs`
- `scholarships`
- `cities`
- `application-cycles`
- `requirements`
- `documents`
- `applications`
- `choices`
- `messages`
- `advisers`
- `providers`
- `search`
- `admin-audit`
- `notifications`

Optional later:

- payments
- direct provider application fees
- AI adviser assistant
- CRM integrations
- university API integrations

## 8. Data Model Derived From Frontend

Core:

- `User`
- `StudentProfile`
- `University`
- `Program`
- `ProgramIntake`
- `ApplicationCycle`
- `Scholarship`
- `CityGuide`

Requirements:

- `AdmissionRequirement`
- `LanguageRequirement`
- `DocumentRequirement`
- `RequirementRule`
- `ProgramRequirement`

Student actions:

- `SavedProgram`
- `SavedUniversity`
- `CompareProgram`
- `ApplicationChoice`
- `ApplicationPacket`
- `ApplicationSection`
- `ApplicationStatusEvent`
- `StudentTask`

Documents:

- `StudentDocument`
- `DocumentReview`
- `DocumentVisibilityGrant`

Collaboration:

- `Advisor`
- `AdvisorOrganization`
- `AdvisorConsentGrant`
- `ReferenceRequest`
- `ProviderProfile`
- `ProviderUser`
- `MessageThread`
- `Message`

Governance:

- `SourceRecord`
- `VerificationEvent`
- `AuditEvent`

## 9. MVP Build Order

MVP 0: clickable frontend prototype

- Home
- Program Search
- Program Detail
- Hub
- Application Builder

MVP 1: real data directory

- Programs
- Universities
- Scholarships
- Cities
- Save/compare

MVP 2: student application workspace

- Profile
- Documents
- Choices
- Readiness
- Deadlines

MVP 3: adviser/admin operations

- adviser review
- platform data admin
- source verification
- returned applications

MVP 4: provider participation

- provider profile
- provider program updates
- partner application review
- vacancy/late-intake status

## 10. Acceptance Criteria

Student can:

- find viable programs within 30 seconds
- understand eligibility from a result card
- save and compare programs
- add a program to choices
- see missing documents
- see next deadline
- understand application status
- revoke adviser access
- find late-intake alternatives

Admin can:

- maintain university/program/scholarship/city data
- see source freshness
- publish verified records
- audit changes

Adviser can:

- see authorized students only
- review application readiness
- return applications with comments
- track deadlines and statuses

Provider can eventually:

- update profile/program data
- manage vacancy status
- review partner applications

## 11. Immediate Design Deliverables

Next files/design artifacts to create:

- frontend wireframe spec for five core pages
- component inventory
- route-to-data contract table
- data model ERD
- API contract draft
- CSCAlite-to-CUAC frontend refactor map

