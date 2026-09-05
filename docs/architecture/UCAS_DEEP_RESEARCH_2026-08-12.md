# UCAS Deep Research For CUAC

Date: 2026-08-12

Purpose: turn UCAS research into CUAC product, data, workflow, and UX decisions for a China-focused admissions platform for international students.

## 1. Executive Takeaways

UCAS is not only a course directory. Its advantage is an integrated admissions operating system:

- A neutral discovery layer for students before they know what to study.
- A central Hub where research, favourites, application progress, choices, documents, offers, and recovery paths live together.
- A multi-sided permission model across students, advisers/centres, and providers.
- A cycle-based admissions timeline with clear deadlines and fallbacks.
- Provider-owned course data that feeds public search and application choices.

For CUAC, this means the core product should be program-level admissions, not just school pages. The MVP should make students feel, at every step, "I know what I can apply for, what evidence I need, when I must act, and who can help."

## 2. UCAS Product Architecture

### Student Public Journey

UCAS public navigation is divided around intent:

- Discover: where to start, courses, subject guides, city guides, careers.
- Applying: before applying, application steps, deadlines, personal statement, references, after applying.
- International: visas, English tests, entry requirements, finance, accommodation, student life, after graduation.
- Money and student life: budgeting, scholarships, accommodation, wellbeing.

CUAC should mirror the intent model, not the exact labels:

- Explore China
- Find Programs
- Scholarships
- Application Guide
- Student Hub
- Advisers
- Universities

### Student Hub

UCAS Hub does four jobs:

- Discovery: course search, course tasters, careers tools, city guides.
- Personalisation: interests, favourites, suggested options.
- Application: register, start application, complete sections, submit.
- Tools: shortlisting and personal-statement support.

CUAC Hub should do:

- Student profile: nationality, current education, target degree, target intake, teaching language, budget, city preference.
- Application readiness: passport, transcript, language proof, recommendation, study plan, medical form, financial proof, guardian if under 18.
- Program shortlist and choices.
- Timeline and reminders.
- Adviser/university messages.
- Status tracking.

## 3. UCAS Application Model

UCAS undergraduate application sections include:

- Personal details
- Nationality details
- Where you live
- Contact details
- Supporting information
- Finance and funding
- Diversity and inclusion
- More about you
- Education
- Employment
- Extra activities
- Personal statement
- References
- Choices

Important UX principles:

- The application can be saved and completed over time.
- Students cannot submit until mandatory sections and reference are complete.
- UCAS separates entered structured data from uploaded supporting documents.
- Choices are course/program-level, not only institution-level.
- For UCAS, students can add up to five choices in the main application.

CUAC translation:

- Build a reusable `ApplicationProfile` first.
- Choices should be `ProgramChoice`, not `SchoolChoice`.
- Support China-specific fields: passport, highest education, transcript, graduation certificate, HSK, IELTS/TOEFL/PTE/Duolingo if accepted, CSCA if required, study plan, recommendation letters, physical examination, non-criminal record if required, financial proof, guardian material, scholarship intent.
- Submission should support two modes:
  - `managed_packet`: CUAC/adviser prepares packet and guides submission to university portals.
  - `provider_direct`: partner universities receive and review inside CUAC.

## 4. Course Search And Decision UX

UCAS search exposes a dense decision surface:

- keyword search
- year/cycle
- study type
- vacancies
- start date
- study mode
- qualification
- university/provider
- subject
- grid/list views
- favourites
- course cards with provider, location, qualification, duration, mode, start date, entry tariff/requirements, related courses

CUAC should search programs first and schools second:

- query
- degree level: undergraduate, master, PhD, non-degree, language/preparatory
- intake: Spring/Fall and exact year
- teaching language: Chinese, English, bilingual
- subject category
- city/province
- tuition band
- scholarship availability
- application deadline/open status
- HSK requirement
- English test requirement
- CSCA/admission test requirement
- provider status: verified, partner, official-source pending
- late-intake/open-seat availability

School pages should aggregate programs, scholarships, city/life data, and source freshness, but the student decision object should be the program.

## 5. References, Advisers, And Consent

UCAS has two related but separate concepts:

- Hub activity sharing: a student can allow a school/centre to see research activity such as preferences and favourites.
- Buzzword/application linking: a centre can view/manage the application, add references, submit it, and track offers/decisions depending on the linking mode.

Notable mechanisms:

- A centre sets a buzzword each cycle.
- Students use the buzzword to link to the centre.
- Former students can request reference-only or full application support.
- Centres can accept or reject linking requests.
- Adviser portal can track applications and statuses after submission.
- Some sensitive/protected answers are not shared with centres.

CUAC translation:

- Do not use a single broad "agent has access" permission.
- Add explicit scopes:
  - profile_read
  - shortlist_read
  - document_filename_read
  - document_view
  - document_upload
  - application_edit
  - application_submit
  - message_student
  - offer_reply_assist
- Add `AdvisorConsentGrant` with cycle, scope, expiry, actor, and revocation log.
- Add `ReferenceRequest` as a first-class workflow with referee identity, relationship, due date, status, and document visibility rules.

## 6. Documents

UCAS document upload is contextual, optional, security-scanned, and tied to application sections. It does not replace structured answers.

Document categories relevant to international applicants include:

- qualification certificates
- translated qualification certificates
- transcripts
- English-language certificates
- passport photo page
- visa/immigration status if already held
- name-change evidence when relevant

Design implications for CUAC:

- Documents should be requested by requirement rules, not dumped into a generic upload folder.
- CUAC should support per-program document checklists because Chinese universities vary widely.
- Every document should have:
  - type
  - owner
  - issuing country/institution
  - language
  - translation status
  - expiry date if applicable
  - target choices that need it
  - review status
  - file security scan status
  - visibility permissions
- CUAC should show "missing for this choice" and "reusable across choices" separately.

## 7. Tracking, Offers, And Recovery Paths

UCAS after-apply flow:

- Student signs in to Hub to track progress.
- UCAS passes application to chosen providers.
- Providers may invite interviews/auditions, make conditional/unconditional offers, reject, or withdraw.
- Students reply to offers by deadlines.
- Extra allows another chance if all five choices were used and the student holds no offer.
- Clearing supports late applications or students without a confirmed place.

UCAS adviser status examples include:

- ready to send to university/college
- waiting for university/college to respond
- waiting for applicant's reply
- conditional offer
- unconditional offer
- interview
- rejection
- eligible for Extra
- eligible for Clearing
- placed
- unplaced

CUAC status model should be explicit:

- draft
- profile_incomplete
- documents_missing
- ready_for_review
- adviser_reviewing
- returned_to_student
- ready_to_submit
- submitted_to_university
- university_acknowledged
- additional_material_requested
- interview_invited
- conditional_offer
- unconditional_offer
- scholarship_offer
- rejected
- waitlisted
- withdrawn
- accepted
- visa_documents_pending
- jw202_or_admission_notice_pending
- placed
- not_placed
- late_intake_eligible

## 8. Extra And Clearing As CUAC Features

UCAS Extra and Clearing are critical because they reduce dead ends.

CUAC equivalents:

- `Additional Choice`: if a student has no active/accepted offer, recommend verified programs still open.
- `Late Intake`: open-seat or still-accepting applications board for China programs.
- `Similar Programs`: if rejected or missing requirements, show adjacent programs with lower or different requirements.
- `Deadline Rescue`: if a choice is near closing, show document gaps and alternatives.

Important: China admissions often lack a single national application deadline. CUAC should model deadlines per program/intake/scholarship, then derive student-specific urgency.

## 9. Provider Data Operations

UCAS provider/course data is not only scraped content. Providers use collection tools to manage course details, availability, vacancies, aliases, contact routes, and bulk updates. This feeds UCAS Search and applications.

CUAC should eventually give universities a provider console:

- provider profile
- campus/contact details
- program catalog
- intake/deadline management
- tuition and scholarship metadata
- document requirements
- eligibility rules
- open/paused/full status
- source verification and change history
- bulk upload/export
- lead/application reports

For MVP, CUAC can start with platform-operated data entry plus provider verification links.

## 10. Trust, Privacy, And Governance

UCAS trust mechanisms:

- clear statement that UCAS processes applications but does not make admissions decisions
- provider decisions remain provider-owned
- documents are used for admissions context
- adviser access is permissioned
- course/provider data is maintained through provider tools
- timelines and statuses are cycle-based

CUAC must be very explicit:

- CUAC does not guarantee admission unless a specific partner agreement says so.
- CUAC does not replace university official portals in non-partner cases.
- Every requirement should show source URL and last verified date.
- Every application status should identify who changed it: student, adviser, CUAC admin, university provider, system.
- Agent/adviser conflicts of interest must be visible.

## 11. Proposed CUAC MVP Route Map

Public:

- `/`
- `/programs`
- `/programs/:id`
- `/universities`
- `/universities/:id`
- `/scholarships`
- `/scholarships/:slug`
- `/china/cities`
- `/china/cities/:slug`
- `/apply/timeline`
- `/apply/guide`
- `/late-intake`

Student Hub:

- `/hub`
- `/hub/profile`
- `/hub/documents`
- `/hub/shortlist`
- `/hub/choices`
- `/hub/applications/:id`
- `/hub/messages`

Adviser:

- `/adviser`
- `/adviser/students`
- `/adviser/applications`
- `/adviser/references`

Provider:

- `/provider`
- `/provider/programs`
- `/provider/applications`
- `/provider/vacancies`

Admin:

- `/admin/data/universities`
- `/admin/data/programs`
- `/admin/data/scholarships`
- `/admin/data/cities`
- `/admin/applications`
- `/admin/advisers`
- `/admin/providers`
- `/admin/audit`

## 12. Data Model Delta From CSCAlite

Keep or adapt:

- `School` -> `University`
- `SchoolProgram` -> `Program`
- `SchoolScholarship` and `Scholarship` -> keep, but link to programs and intakes more strongly.
- `CityGuide` -> keep.
- `ApplicationTimelineWindow` -> replace with cycle/intake/deadline rules plus editorial timeline windows.
- `SavedSchool` -> split into `SavedUniversity` and `SavedProgram`.
- `SchoolCompareItem` -> split into program comparison and university comparison.
- `StudentProfile` -> expand into admissions profile.

Add:

- `ApplicationCycle`
- `ProgramIntake`
- `ProgramVacancyStatus`
- `AdmissionRequirement`
- `RequirementRule`
- `DocumentRequirement`
- `StudentDocument`
- `ApplicationPacket`
- `ApplicationChoice`
- `ApplicationStatusEvent`
- `Offer`
- `AdvisorConsentGrant`
- `ReferenceRequest`
- `ProviderProfile`
- `ProviderUser`

## 13. Research Sources

- UCAS International: https://www.ucas.com/international
- What is UCAS: https://www.ucas.com/about-us/what-is-ucas
- UCAS Hub: https://www.ucas.com/hub
- How do I apply: https://www.ucas.com/faqs/how-do-i-apply
- Filling in your UCAS application: https://www.ucas.com/applying/applying-to-university/filling-in-your-ucas-application
- Search courses: https://www.ucas.com/explore/search/courses-beta?query=undergraduate
- Dates and deadlines: https://www.ucas.com/applying/applying-to-university/dates-and-deadlines-for-uni-applications
- Tracking your application: https://www.ucas.com/applying/after-you-apply/tracking-your-ucas-application
- Types of offers: https://www.ucas.com/applying/after-you-apply/types-of-offers
- Extra choices: https://www.ucas.com/applying/after-you-apply/types-undergraduate-offers/extra-choices
- Clearing for international students: https://www.ucas.com/applying/after-you-apply/clearing-and-results-day/what-is-clearing/clearing-guide-for-international-students
- Uploading documents: https://www.ucas.com/applying/applying-to-university/uploading-documents-to-your-application
- References: https://www.ucas.com/applying/applying-university/how-get-ucas-reference
- International advisers: https://www.ucas.com/international/international-advisers
- Linking applications to adviser centre: https://www.ucas.com/advisers/help-and-training/guides-resources-and-training/application-overview/our-adviser-portal/linking-applications-to-your-centre-in-the-adviser-portal
- Adviser tracking after submission: https://www.ucas.com/advisers/help-and-training/guides-resources-and-training/application-overview/our-adviser-portal/tracking-your-students-applications-post-submission
- What can my centre see: https://www.ucas.com/faqs/what-can-my-school-college-or-centre-see
- Provider collection tool: https://www.ucas.com/providers/our-products-and-services/student-recruitment-and-marketing/collection-tool

## 14. When We Should Register For UCAS Hub

Public research is enough for architecture and MVP requirements. Registration becomes useful when we need to inspect:

- exact Hub onboarding questions
- actual dashboard cards and progress states
- how favourites and "For you" are presented
- application section completion UI
- field validation and save-draft behavior
- how choices are searched and added inside the application
- reference request screens
- document upload UI and scan states
- offer/reply status screens, if reachable in a test account

Suggested next step before registration: build a CUAC v0 product spec from this research, then use a UCAS test account only to validate interaction details against the spec.
