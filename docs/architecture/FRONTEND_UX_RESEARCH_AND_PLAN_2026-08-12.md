# CUAC Frontend UX Research And Plan

Date: 2026-08-12

Goal: define the frontend direction for CUAC, a China admissions platform for international students, based on UCAS frontend patterns and the current CSCAlite migration intake.

## 1. Frontend Thesis

CUAC should feel like an admissions cockpit, not a content website.

The student's first emotional problem is uncertainty:

- Which China programs can I apply for?
- Am I eligible?
- What documents do I need?
- What will it cost?
- When is the deadline?
- What happens after I submit?
- If I fail or miss a deadline, what can I still do?

Every frontend page should reduce one of those uncertainties.

## 2. UCAS Frontend Patterns Worth Copying

### 2.1 Intent-Based Navigation

UCAS separates navigation by user intent:

- Discover
- Applying
- After applying
- International
- Money and student life
- Advisers
- Providers

CUAC should not lead with internal product modules. It should lead with student decisions:

- Find Programs
- Universities
- Scholarships
- China Guides
- Apply
- Hub

Admin/adviser/provider entry points should be present but visually secondary.

### 2.2 Hub As Home Base

UCAS Hub is positioned as the student's control center: options, favourites, application, tools.

CUAC Hub should be the logged-in first screen after registration. It should show:

- profile completeness
- next deadline
- document readiness
- shortlisted programs
- active application choices
- messages/tasks
- late-intake opportunities

This should not look like a marketing dashboard. It should be compact, task-oriented, and calm.

### 2.3 Search As A Work Surface

UCAS course search uses:

- keyword search
- large result count
- grid/list toggle
- sort control
- filter drawer/panel
- year/cycle filters
- study type
- vacancies
- start date
- study mode
- qualification
- university/provider
- subject
- favourites

CUAC program search should use a dense search workbench:

- keyword
- degree level
- intake year/term
- teaching language
- subject area
- city/province
- tuition band
- scholarship available
- deadline status
- HSK requirement
- English test requirement
- CSCA/admission test requirement
- document burden
- verified/partner status
- late-intake availability

The search page should default to list view because students compare details. Grid can be optional for discovery.

### 2.4 Application Sections With Completion State

UCAS application is broken into clear sections and can be saved over time.

CUAC should use a section checklist pattern:

- Personal details
- Nationality/passport
- Education history
- Language tests
- Program choices
- Documents
- Study plan
- Recommendation/referee
- Scholarship intent
- Review and submit

Each section needs an obvious state:

- Not started
- In progress
- Needs attention
- Ready
- Submitted/locked

### 2.5 Deadline-Driven Frontend

UCAS publishes key dates and ties them to application actions.

CUAC should make deadlines personal:

- "3 programs close within 14 days"
- "Your Zhejiang University packet is missing transcript translation"
- "This program accepts late intake applications"
- "Scholarship deadline is earlier than program deadline"

Use deadlines as an organizing layer across search, Hub, program pages, and application choices.

### 2.6 Recovery Paths

UCAS Extra and Clearing prevent dead ends.

CUAC equivalents need visible frontend entry points:

- Late Intake
- Still Accepting Applications
- Similar Programs
- Lower Document Burden
- English-Taught Alternatives
- Scholarship Still Open

These should appear when a student is rejected, misses a deadline, or has no active choice.

### 2.7 International Student Frontend

UCAS gives international students dedicated pathways for visas, English tests, finance, accommodation, student life, and adviser support.

CUAC should have China-specific support surfaces:

- visa and residence permit checklist
- JW202/admission notice explanation
- HSK and Chinese-taught path
- English-taught path
- cost of living by city
- scholarship guide
- arrival checklist
- under-18 guardian requirements

Do not bury these as blog content; they should connect to each student's chosen programs.

## 3. CUAC Information Architecture

### Public Routes

- `/`
- `/programs`
- `/programs/:id`
- `/universities`
- `/universities/:id`
- `/scholarships`
- `/scholarships/:slug`
- `/china/cities`
- `/china/cities/:slug`
- `/apply/guide`
- `/apply/timeline`
- `/late-intake`

### Student Hub Routes

- `/hub`
- `/hub/profile`
- `/hub/documents`
- `/hub/shortlist`
- `/hub/choices`
- `/hub/applications/:id`
- `/hub/messages`
- `/hub/settings/adviser-access`

### Adviser Routes

- `/adviser`
- `/adviser/students`
- `/adviser/applications`
- `/adviser/references`
- `/adviser/reports`

### Provider Routes

- `/provider`
- `/provider/profile`
- `/provider/programs`
- `/provider/applications`
- `/provider/vacancies`
- `/provider/messages`

### Admin Routes

- `/admin`
- `/admin/universities`
- `/admin/programs`
- `/admin/scholarships`
- `/admin/cities`
- `/admin/applications`
- `/admin/advisers`
- `/admin/providers`
- `/admin/audit`

## 4. Key Page Frontend Plans

### 4.1 Home

Home should not be a generic landing page. The first screen should function as a program finder.

Above the fold:

- CUAC identity and promise
- search input
- quick filters: Undergraduate, Master, English-taught, Scholarship, Late intake
- "Continue in Hub" if signed in
- small deadline strip

Below:

- recommended programs
- how CUAC application works
- China city guide preview
- scholarship openings

### 4.2 Program Search

Layout:

- desktop: left filter rail, result list, sticky compare/shortlist tray
- tablet/mobile: top search, filter drawer, result cards

Program result card should show:

- program name
- university
- city/province
- degree level
- teaching language
- intake
- deadline status
- tuition
- scholarships
- HSK/English requirement
- required document count
- verified source age
- save, compare, add to choices

Result states:

- loading skeleton
- empty state with "relax filters"
- stale data warning
- login-gated save/compare with return path

### 4.3 Program Detail

Program detail should be the primary conversion page.

Sections:

- summary header
- eligibility snapshot
- deadline and intake
- requirements
- required documents
- tuition and scholarships
- university/campus context
- source and verification
- similar programs
- actions: save, compare, add to application choice

Sticky side panel:

- readiness estimate
- next deadline
- missing profile/documents
- apply button

### 4.4 University Detail

University page should not compete with program page. It should answer trust and fit:

- overview
- international student support
- programs
- scholarships
- city/campus life
- admissions contacts
- source freshness
- provider verification status

Tabs should include:

- About
- Programs
- International students
- Scholarships
- Student life
- Requirements

This mirrors UCAS Provider Pages, especially their international student tab and student support tab.

### 4.5 Student Hub

Hub should be a task board.

Primary blocks:

- next best action
- application readiness score
- active choices
- document checklist
- upcoming deadlines
- messages
- adviser access status
- late-intake suggestions

Avoid a card-heavy marketing layout. Use dense panels, clear counters, and status chips.

### 4.6 Application Builder

Use a two-column layout:

- left: section checklist and completion status
- center: active form section
- right: contextual help, source explanation, program-specific requirements

Interaction rules:

- autosave every field section
- explicit "Mark section ready"
- show blockers before submit
- separate warning from hard blocker
- locked state after submission
- returned state when adviser/admin sends it back

### 4.7 Documents

Documents page must be requirement-led.

Views:

- required by current choices
- reusable documents
- uploaded
- needs translation
- expired/expiring
- rejected/needs reupload

Upload row states:

- missing
- uploading
- scanning
- uploaded
- review needed
- accepted
- rejected
- locked after submission

### 4.8 Adviser Access

Frontend needs consent clarity:

- who has access
- what they can see
- what they can edit
- whether they can submit
- expiry
- revoke button
- audit trail

Never hide adviser permissions in account settings only. Show them inside Hub when relevant.

### 4.9 Late Intake

Late Intake should be a first-class page.

Filters:

- intake
- open now
- closes soon
- English taught
- scholarship still open
- lower document burden
- accepts missing language result conditionally

Cards should say why a program is still viable.

## 5. Component System

### Navigation

- `TopNav`
- `MobileNavDrawer`
- `UserMenu`
- `RoleSwitcher`
- `DeadlineStrip`

### Search

- `ProgramSearchInput`
- `FilterRail`
- `FilterDrawer`
- `FilterChip`
- `SortControl`
- `ViewToggle`
- `ResultCount`
- `ProgramResultRow`
- `CompareTray`

### Status

- `StatusChip`
- `DeadlineBadge`
- `VerificationBadge`
- `RequirementBadge`
- `DocumentStatusPill`
- `ApplicationStageStepper`

### Hub

- `NextActionPanel`
- `ReadinessMeter`
- `ChoiceList`
- `DocumentChecklist`
- `DeadlineList`
- `MessagePreview`
- `AdviserAccessPanel`

### Forms

- `ApplicationSectionNav`
- `AutosaveIndicator`
- `FieldError`
- `RequirementHelp`
- `DocumentUploadSlot`
- `ReviewSubmitPanel`

### Data Display

- `ProgramRequirementTable`
- `TuitionScholarshipTable`
- `SourceFreshnessBlock`
- `CityCostBlock`
- `UniversitySupportTabs`

## 6. Visual Direction

CUAC should feel:

- trustworthy
- international
- calm under pressure
- official but not bureaucratic
- dense enough for serious comparison
- less brand/marketing-heavy than CSCAlite's current public pages

Recommended palette:

- base: white / soft grey
- primary: deep teal or blue-green
- action: clear blue
- deadline warning: amber
- critical: red
- success: green
- scholarship accent: restrained gold

Avoid:

- one-note blue/purple gradients
- oversized hero cards
- decorative illustrations that do not help decision-making
- vague CTA copy
- hiding important requirements below the fold

Typography:

- English-first layout.
- Support Chinese names without breaking line height.
- Use compact headings in dashboards.
- Use strong numeric hierarchy for deadlines, tuition, duration, and document count.

## 7. Responsive Behavior

Desktop:

- dense search/filter workbench
- sticky compare tray
- side readiness panel on detail pages

Tablet:

- collapsible filter drawer
- sticky bottom action bar

Mobile:

- search first
- filters as bottom sheet
- one primary action per card row
- compare tray becomes bottom drawer
- application section nav becomes progress drawer

Every button label must fit in English, Chinese, and likely longer translated languages.

## 8. Existing CSCAlite Frontend Migration Notes

Good intake:

- `PublicSchoolsPage.tsx` has search/filter/list behavior worth reusing.
- `SchoolDetailPage.tsx` has source/requirement/program sections worth refactoring.
- `ComparePage.tsx` is a starting point, but CUAC needs program comparison.
- `ScholarshipPages.tsx` is useful but should link scholarships to program choices and deadlines.
- `StudyChinaPages.tsx` contains useful city/timeline ideas.
- `PublicMePage.tsx` contains shortlist/profile pieces, but must be split away from CSCA learning dashboard.
- Admin pages are useful but visually too CSCAlite/admin-specific; convert to CUAC admin workbench primitives.

Must refactor:

- "School" as the main student action should become "Program".
- "CSCA required" should become one requirement dimension.
- Cart/checkout actions should become "Add to choices" or "Request adviser review".
- The current public nav is CSCA-learning heavy; CUAC nav must be admissions-first.

## 9. UX Validation Plan

Before implementation:

- Create low-fidelity wireframes for Home, Program Search, Program Detail, Hub, Application Builder.
- Test with 3 international-student personas:
  - English-taught undergraduate seeker
  - scholarship-first master applicant
  - late-intake applicant with incomplete documents

After implementation:

- Playwright screenshot checks for desktop/mobile.
- Empty/loading/error state review.
- Form completion state tests.
- Accessibility checks for keyboard navigation and visible focus.
- i18n text fit checks for English and Chinese.

UCAS account registration is useful later to validate:

- exact Hub dashboard layout
- favourites and "For you" interaction
- application section progress UI
- field validation
- reference request screen
- document upload scan states
- offer/reply page states

## 10. Implementation Sequence

1. Build CUAC frontend shell and route map.
2. Build design tokens and shared primitives.
3. Convert school search into program search.
4. Convert school detail into program detail and university detail.
5. Build Hub v0 with profile, shortlist, choices, documents, deadlines.
6. Build application builder v0.
7. Add adviser consent panel.
8. Add late-intake page.
9. Convert admin pages to CUAC data workbench.
10. Run responsive and i18n QA.

## 11. Source References

- UCAS Hub: https://www.ucas.com/hub
- UCAS course search: https://www.ucas.com/explore/search/courses-beta?query=undergraduate
- Filling in the UCAS application: https://www.ucas.com/applying/applying-to-university/filling-in-your-ucas-application
- Tracking application: https://www.ucas.com/applying/after-you-apply/tracking-your-ucas-application
- Dates and deadlines: https://www.ucas.com/applying/applying-to-university/dates-and-deadlines-for-uni-applications
- Uploading documents: https://www.ucas.com/applying/applying-to-university/uploading-documents-to-your-application
- Provider Pages: https://www.ucas.com/providers/our-products-and-services/student-recruitment-and-marketing/provider-pages
- Adviser application process: https://www.ucas.com/advisers/help-and-training/guides-resources-and-training/application-overview/navigating-the-application-process
