# CUAC Migration And UCAS Research Plan

## 1. Goal

CUAC will become a standalone China admissions platform for international students, inspired by the strongest student-experience patterns in UCAS: discover, decide, apply, track, and recover alternatives when plans change.

The migration should not be a blind copy of CSCAlite. The new boundary is:

- Keep: China school discovery, program search, scholarships, city/life guidance, application timeline, shortlist, comparison, student profile, adviser/admin operations, data import and verification.
- Refactor: current CSCA requirement fields into one admission-test/requirement layer, because CUAC should support CSCA, HSK, IELTS/TOEFL, passport/visa documents, portfolio, interviews, and university-specific materials.
- Defer or externalize: CSCA subject learning, mock exams, past papers, AI question bank, existing service checkout, organization learning console.

## 2. Current CSCAlite Intake

The first migration intake has been copied to `D:\CODE\CUAC\migration-intake`.

Important frontend files:

- `PublicSchoolsPage.tsx`: public school/program discovery, filters, shortlist, compare, add-to-cart actions.
- `SchoolDetailPage.tsx`: school profile, requirements, programs, costs, scholarship and source links.
- `ComparePage.tsx`: student-side school comparison.
- `ScholarshipPages.tsx`: scholarship discovery and detail pages.
- `StudyChinaPages.tsx`: city guides and application timeline.
- `PublicMePage.tsx`: includes saved schools, compare list and student application profile, but also contains CSCA learning modules that must be split.
- `AdminSchoolsPage.tsx`, `AdminScholarshipsPage.tsx`, `AdminCityGuidesPage.tsx`, `AdminTimelineWindowsPage.tsx`: operating console for school/scholarship/city/timeline data.

Important backend modules:

- `schools`: school, program, admission rule, school scholarship, admin CRUD, import and audit.
- `study-china`: city guides and application timeline windows.
- `search`: site-wide search.
- `content`: public CMS blocks.
- `me`: saved schools, compare list and student profile, but must be reduced to application/account functions.
- `commerce` and `consulting`: useful as reference only; CUAC should redesign application submission and adviser workflow before inheriting checkout.

Important data model anchors:

- `School`, `SchoolProgram`, `SchoolCscaRule`, `SchoolScholarship`, `Scholarship`, `CityGuide`, `ApplicationTimelineWindow`, `SavedSchool`, `SchoolCompareItem`, `StudentProfile`.
- Current payment/order tables are optional for CUAC v0 and should not be part of the first student application MVP.

## 3. Migration Phases

Phase 0: Intake audit

- Convert the copied intake into a clean inventory.
- Mark every file as `keep`, `refactor`, `reference`, or `drop`.
- Identify shared dependencies: auth, i18n, request helpers, icons, layout primitives, admin shell, Prisma service, validation, audit logging.

Phase 1: Standalone shell

- Create CUAC's own frontend/backend packages.
- Build a CUAC navigation model: Find courses, Universities, Scholarships, China guides, Apply, Hub.
- Remove CSCA learning-first navigation from the first screen.
- Keep multilingual support from day one: English first, then Chinese, Vietnamese, Russian/Arabic/French based on target markets.

Phase 2: Admissions data model

- Rename CSCA-specific rule concepts into `AdmissionRequirement`.
- Add first-class models for `ApplicationCycle`, `ProgramIntake`, `DocumentRequirement`, `LanguageRequirement`, `VisaRequirement`, `ApplicationChoice`, `ApplicationStatusEvent`.
- Keep source verification and versioning.

Phase 3: Student Hub

- Build the UCAS-like path: profile completeness, shortlist, comparison, selected choices, required documents, deadlines, application status.
- Let students save programs, not only schools.
- Add reminders and document checklist before adding actual submission.

Phase 4: Admin/provider workflow

- Split admin into: data ops, provider profile, application review, scholarship ops, adviser support.
- Add role boundaries for platform admin, university provider, adviser/agent, student.

Phase 5: Application submission MVP

- Start with managed application packets: student completes profile and documents, CUAC generates structured packets, adviser/admin submits or routes to partner universities.
- Later evolve into direct provider review inside CUAC.

## 4. UCAS Research Plan

Research questions:

- How does UCAS reduce uncertainty for students before they apply?
- What makes course search, favourites, application choices, deadlines, offers, Clearing and adviser access feel trustworthy?
- Which UCAS patterns transfer directly to China, and which must change because Chinese universities often use separate international admission portals?

Streams:

- IA and journey: top navigation, discover/apply/after-apply/international/adviser/provider segmentation.
- Search and decision: course filters, favourites, compare-worthy data, entry requirements, vacancies, start dates, study mode.
- Application flow: Hub onboarding, application sections, reference, payment/submission, status tracking.
- International student support: visa, English tests, finance, accommodation, student life, adviser permissions.
- Recovery paths: Clearing, Extra, decline/change offer equivalents for China.
- Trust and governance: official data, source freshness, provider participation, fraud/verification, data dashboards.

Deliverables:

- UCAS feature teardown matrix.
- CUAC student journey map.
- CUAC MVP scope and route map.
- Data model delta from CSCAlite.
- Prototype requirements for student Hub and program search.
- Content model for international student guidance.

## 5. CUAC Product Translation

UCAS pattern -> CUAC adaptation:

- UCAS course search -> China program search by degree level, teaching language, city, tuition, scholarship, deadline, HSK/English requirement, intake.
- UCAS Hub -> CUAC Hub with profile, documents, shortlist, choices, deadlines, adviser/university messages.
- UCAS choices -> CUAC application choices, probably program-level rather than school-level.
- UCAS Clearing -> CUAC late-intake/open-seat board for programs still accepting international students.
- UCAS adviser access -> CUAC counsellor/agent permission model with explicit student consent.
- UCAS international guidance -> CUAC visa, JW202/CAS-equivalent, residence permit, HSK, scholarship, accommodation and arrival checklist.

## 6. Immediate Next Decisions

- Decide whether CUAC v0 should be a monorepo cloned from CSCAlite or a fresh repo that imports only modules from `migration-intake`.
- Decide the MVP application mode: informational directory plus adviser service, or true in-platform application packet submission.
- Decide the brand language: English-first for international students, with Chinese admin/provider back office.
- Decide whether `CSCA` remains a requirement dimension or becomes only one of many admission-test tags.
