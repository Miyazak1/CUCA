# CUAC Frontend-Only Production Design Spec

Date: 2026-08-12

Status: revised after UCAS reference audit.

Purpose: define a production-quality frontend direction for CUAC before backend and database development. This phase is frontend-only, but the frontend itself must be mature, coherent, responsive, accessible, and suitable to become the real website frontend when APIs are connected.

Reference basis:

- `CUAC_FRONTEND_UCAS_REFERENCE_AUDIT.md`
- UCAS home: https://www.ucas.com/
- UCAS course search: https://www.ucas.com/explore/search/courses-beta?query=computer%20science
- UCAS dates and deadlines: https://www.ucas.com/applying/applying-to-university/dates-and-deadlines-for-uni-applications

## 1. Product Direction

CUAC should not be presented first as a dashboard. It should be presented first as a planning, search, and application-preparation tool.

Primary product promise:

`Find, compare, and prepare China university applications.`

Supporting promise:

`Describe your China study goal, compare programs, check deadlines and documents, then build a review-ready application packet.`

The frontend must help a student answer six questions quickly:

1. What can I study in China?
2. Which universities and cities fit me?
3. Can I apply in time?
4. What will it cost?
5. What documents or tests do I need?
6. What should I do next?

## 2. Audience And Tone

Primary audience:

- International high school students and recent graduates, roughly 16-20.
- Many use English as a second language.
- Many compare unfamiliar universities, cities, costs, deadlines, scholarships, HSK/IELTS rules, and document requirements.
- Parents and advisers may influence decisions, but the interface is student-first.

Tone:

- Young but not childish.
- Clear but not bureaucratic.
- Trustworthy but not cold.
- Energetic but not noisy.
- Practical before decorative.

Design consequence:

- Use short copy.
- Prefer fields, chips, timelines, filters, and checklists.
- Show exact dates and prices.
- Avoid vague motivational slogans.
- Avoid agency-sales pressure.
- Avoid fake certainty such as guaranteed admission.

## 3. Frontend-Only Scope

Build five production-quality student-facing surfaces:

- Home natural-language planning gateway
- Program Search
- Program Detail
- Student Hub
- Application Builder

Optional frontend-only surfaces:

- Compare drawer/page
- University preview card/page stub
- City guide preview
- Scholarship finder view or filtered search state
- Deadline timeline panel

Out of scope for this phase:

- Real authentication
- Real backend APIs
- Real database
- Real file upload
- Real payment
- Real adviser dashboard
- Real provider/admin dashboard
- Real application submission to a university

Important: frontend-only does not mean demo-quality. Mock actions must be realistic, typed, stateful, and replaceable by APIs later.

## 4. Product Information Architecture

Student nav should stay narrow:

- Search
- Universities
- Scholarships
- Deadlines
- China Guides
- Hub

Do not expose adviser/provider/admin links in the primary student shell.

Route map:

- `/`
- `/programs`
- `/programs/:programId`
- `/hub`
- `/hub/applications/:applicationId`

Optional:

- `/compare`
- `/universities`
- `/scholarships`
- `/deadlines`
- `/guides/cities`

## 5. Primary User Flow

1. Student lands on Home.
2. Describes a study goal in plain English or uses a browse category.
3. Opens Program Search with interpreted route chips or keyword filters.
4. Narrows results by degree, subject, language, city, tuition, scholarship, deadline, and document burden.
5. Saves programs, compares up to 3, and adds one or more to choices.
6. Opens Program Detail for a specific program.
7. Reviews deadline, tuition, teaching language, scholarships, eligibility, documents, source status, and readiness.
8. Adds program to choices.
9. Opens Hub.
10. Sees one next action, choices, missing documents, upcoming deadlines, and adviser review state.
11. Opens Application Builder.
12. Completes sections and mock document statuses.
13. Requests adviser review once hard blockers are cleared.
14. Returns to Hub with status updated to ready for adviser review.

## 6. Page Principles

### 6.1 Home

Primary job:

Get students into a planning prompt, search, or browse route within 5 seconds.

Required first viewport:

- Compact top nav.
- Large natural-language planning input with specific examples.
- Clear action label such as `Find routes`, not generic `Submit`.
- Example chips that act as prompt starters, not only filters:
  - English-taught
  - Scholarship preferred
  - Lower-cost city
  - No HSK
  - Fall 2026
- Category shortcuts:
  - Courses
  - Universities
  - Scholarships
  - Deadlines
  - City guides
  - English-taught
  - Late intake
- Deadline strip with exact cycle signal.
- Returning-student Hub continuation, visually secondary.
- Global bottom Agent Composer, available across all student-facing pages.

Home must not:

- Lead with a generic dashboard.
- Use large empty hero space.
- Use decorative cards before search is clear.
- Hide browse categories below the fold.
- Claim real AI matching in the frontend-only phase.

Natural-language planning behavior:

- Accept phrases such as `Computer science in Hangzhou`, `No HSK and scholarship preferred`, or `English-taught business master under RMB 40k`.
- On submit, show a short interpreting state, then expose mocked route chips such as subject, degree, city, budget, language, deadline, or document need.
- The interpreted chips route into Program Search and remain removable there.
- Empty submit keeps focus and shows a short hint.
- The global bottom composer is fixed at the bottom-center of the viewport, centered to the same content width, and must not cover primary content actions, pagination, or footer links.
- When the Agent Workspace opens, the same composer docks at the bottom of the right panel for continued questions.
- Mobile composer behavior uses a compact prompt or collapsed pill, hidden while the keyboard is open.

### 6.2 Program Search

Primary job:

Help students compare real options quickly.

Required:

- Query search.
- Result count.
- Sort.
- List/grid toggle.
- Filter rail/drawer.
- Active filter chips.
- Dense program rows.
- Save, compare, add-to-choices actions.
- Sticky compare/choice tray.
- Loading, empty, stale-source, and no-results states.

Search result row fields:

- Program name.
- University.
- City/province.
- Degree/qualification.
- Teaching language.
- Intake/start date.
- Deadline badge with exact date.
- Tuition in RMB.
- Scholarship badge.
- HSK/English/admission test chips.
- Required document count.
- Source status and last verified date.

### 6.3 Program Detail

Primary job:

Turn interest into an informed application choice.

Required:

- Program title and university.
- Key facts grid.
- Sticky readiness/actions panel.
- Eligibility.
- Required documents.
- Tuition and scholarship.
- Timeline.
- City/university context.
- Source verification.
- Similar or late-intake alternatives.

Readiness language:

- `Strong match`
- `Likely eligible`
- `Needs review`
- `Blocked by missing documents`

Never state or imply admission is guaranteed.

### 6.4 Student Hub

Primary job:

Tell the student what to do next.

Required:

- Next best action.
- Active choices.
- Missing documents.
- Upcoming deadlines.
- Readiness/progress.
- Messages/tasks.
- Adviser access summary.
- Late-intake suggestions when relevant.

Hub must not:

- Become a generic analytics dashboard.
- Prioritize charts over actions.
- Hide blockers behind stats.

### 6.5 Application Builder

Primary job:

Prepare a reviewable application packet.

Required sections:

- Personal details
- Nationality/passport
- Education
- Language tests
- Program choices
- Documents
- Study plan
- Recommendation/referee
- Scholarship intent
- Review

Required behavior:

- Autosave indicator.
- Section checklist.
- Contextual blockers.
- Document upload simulation.
- Mark section ready.
- Request adviser review.
- Success state and timeline event.

## 7. Visual Direction

CUAC should feel like a serious student tool with a bright, modern layer.

Use:

- White and soft grey base.
- Blue-green identity.
- Blue primary actions.
- Amber deadlines.
- Red/coral blockers.
- Green/mint ready states.
- Gold scholarship accents.
- Real campus/city imagery where it helps content.
- Icons for familiar actions.
- Dense but breathable spacing.

Avoid:

- Big marketing hero cards.
- Empty dashboard mockups.
- Nested cards.
- Decorative blobs/orbs.
- One-note teal or blue screens.
- Neon gradients.
- Cartoonish or mascot-heavy styling.
- Confetti for serious admissions actions.

## 8. Content Rules

Use concrete labels:

- `Search programs`
- `Save`
- `Compare`
- `Add to choices`
- `Open application`
- `Prepare documents`
- `Upload`
- `Mark section ready`
- `Request adviser review`
- `Find late alternatives`

Avoid vague labels:

- `Get started`
- `Learn more`
- `Explore your path`
- `Submit`
- `Guaranteed admission`

Status copy must pair problem with action:

- Good: `Transcript translation missing`
- Good: `Deadline in 9 days`
- Good: `IELTS certificate needed`
- Bad: `Pending`
- Bad: `Incomplete`

## 9. Frontend State Model

State should be centralized behind a data-client boundary and persisted to `localStorage` in frontend-only mode.

Core state:

- `savedProgramIds`
- `compareProgramIds`
- `choiceProgramIds`
- `activeApplicationId`
- `profileSectionStatus`
- `documentStatusByRequirementId`
- `applicationSectionStatus`
- `adviserReviewRequested`
- `dismissedAlerts`
- `stateVersion`
- `updatedAt`

Rules:

- Actions are idempotent by ID.
- Compare limit is enforced in reducer, not only button state.
- Add-to-choice called twice should create one choice.
- Upload simulation is per document.
- Multi-tab updates show a small banner.

## 10. Interaction Principles

Every action needs visible feedback:

- Natural-language planning input turns a prompt into visible route chips before or during navigation.
- Search updates result count and active chips.
- Save fills icon and shows short confirmation.
- Compare opens tray after first item.
- Add to choices shows `View Hub` and `Keep searching`.
- Upload changes through `uploading` to `uploaded`.
- Mark section ready updates checklist and blockers.
- Request adviser review creates success state.

Concurrency:

- Prompt interpretation uses request IDs or AbortController; latest prompt wins.
- Debounce keyword search by 250-350 ms.
- Use request IDs or AbortController for mock data client.
- Latest search result wins.
- Keep old results visible during pending search.
- Disable only the clicked resource while mutation is pending.
- `Request adviser review` is blocked while critical uploads or saves are pending.

Motion:

- Motion explains change.
- Motion confirms action.
- Motion never delays core work.
- Motion respects reduced-motion preferences.
- No looping decorative animation.

## 11. Mock Data Requirements

Minimum seed data:

- 10 programs.
- 6 universities.
- 5 scholarships.
- 4 cities.
- 1 preview student profile.
- 1 application packet.
- 8 document requirements.
- 8 student documents.
- 8 timeline/status events.
- 6 preview messages/tasks.

Program variety:

- Undergraduate, master, PhD, non-degree.
- English-taught, Chinese-taught, bilingual.
- Open, closes soon, urgent, closed, late intake.
- Low, medium, high tuition.
- Scholarship and no-scholarship.
- Light, medium, heavy document burden.
- Verified, stale, pending source.

## 12. Component Inventory

Navigation:

- `TopNav`
- `MobileNavDrawer`
- `DeadlineStrip`
- `SearchShortcut`

Search:

- `GlobalSearchBar`
- `NaturalLanguagePlannerInput`
- `GlobalAgentComposer`
- `BrowseCategoryGrid`
- `ProgramSearchBar`
- `FilterRail`
- `FilterDrawer`
- `ActiveFilterChips`
- `ProgramResultRow`
- `ProgramResultCard`
- `SortSelect`
- `ViewToggle`
- `CompareTray`

Program:

- `ProgramKeyFacts`
- `ReadinessPanel`
- `RequirementChips`
- `DocumentRequirementList`
- `TuitionScholarshipPanel`
- `TimelinePanel`
- `SourceFreshnessBlock`
- `SimilarPrograms`

Hub:

- `NextActionPanel`
- `ChoiceStatusList`
- `DocumentChecklist`
- `DeadlineTimeline`
- `MessagePreview`
- `AdviserAccessSummary`

Application:

- `ApplicationSectionNav`
- `AutosaveIndicator`
- `ApplicationSectionPanel`
- `DocumentUploadSlot`
- `BlockerList`
- `ReviewRequestPanel`
- `StatusTimeline`

## 13. Accessibility And Responsiveness

Minimum bar:

- Keyboard reachable controls.
- Visible focus states.
- Labels for all form fields.
- Accessible names for icon buttons.
- No color-only status.
- Reduced motion support.
- Mobile global composer does not cover active inputs or keyboard areas.
- Touch targets are large enough.
- Long English and Chinese names wrap without overlap.
- Result rows keep stable dimensions during state changes.

## 14. Frontend Acceptance Criteria

The frontend is acceptable when:

- A student understands the main planning/search action within 5 seconds.
- The home prompt feels like a helpful China admissions route finder, not a copied UCAS keyword box.
- Program Search feels like the core product surface.
- Results expose enough fields for comparison without opening detail.
- Filters are useful, visible, and URL-shareable.
- Deadlines are exact and action-oriented.
- Save, compare, and choices are obvious.
- Hub answers one question: `What should I do next?`
- Application Builder makes progress and blockers visible.
- The interface feels mature, not like a template demo.
- Desktop and mobile screenshots show no overlap or wasted first viewport.

## 15. Implementation Order

1. Rework design tokens and layout rhythm.
2. Rebuild Home as natural-language planning gateway.
3. Rebuild Program Search as dense decision workbench.
4. Rebuild Program Result rows/cards.
5. Rebuild Program Detail readiness and source sections.
6. Rebuild Hub as task cockpit.
7. Rebuild Application Builder.
8. Add restrained motion and state feedback.
9. Run desktop/mobile visual QA locally.
10. Only publish if explicitly requested by the user.

## 16. Explicit Publishing Rule

Do not publish, deploy, or update the live Sites version unless the user explicitly asks to publish, deploy, or go online.
