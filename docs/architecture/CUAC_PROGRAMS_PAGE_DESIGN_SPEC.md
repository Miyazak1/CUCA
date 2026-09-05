# CUAC Programs Page Design Spec

Date: 2026-08-13

Status: implemented in `design-lab/programs.html` and synchronized to `frontend/public/programs.html`. Do not publish or deploy unless explicitly requested.

Target page:

- Static prototype: `design-lab/programs.html`
- Static public copy: `frontend/public/programs.html`
- Future app route: `/programs`

## 1. Core Judgment

The Programs page is CUAC's main program discovery and decision surface, but it should not feel like a back-office filter console.

Home inspires and routes the student. Universities helps students understand institutions and cities. Programs helps students browse realistic China-study options, then use filters, comparison, details, and the Agent only when needed.

The current direction is:

- Browse-first.
- Card-based, close to the Universities page visual rhythm.
- Search and natural-language intent remain central.
- Full filters exist, but are hidden behind `All filters`.
- Program detail routing is represented by a lightweight selected-program focus area.
- Results stay friendly for young international students while preserving admissions-critical facts.

## 2. Audience And Student Mindset

Primary audience:

- International high school, undergraduate, or early-career students considering study in China.
- Often unfamiliar with Chinese university admissions, city differences, HSK/IELTS rules, scholarship routes, and document requirements.
- Younger users who need clarity and confidence, not government-portal density.

Likely goals:

- `I want an English-taught computer science master in Hangzhou.`
- `I need scholarship options under RMB 40k.`
- `I do not have HSK yet.`
- `I am late for Fall 2026 and need still-open options.`
- `I want to compare ZJU, Tongji, and UIBE by cost and requirements.`

Primary anxiety:

- Missing deadlines.
- Choosing a famous university but not meeting requirements.
- Not knowing whether English-taught routes really avoid HSK.
- Underestimating document work.
- Confusing scholarship availability with guaranteed funding.
- Trusting stale admissions pages.

The page must reduce that anxiety through scannable, honest signals without showing every possible filter upfront.

## 3. Relationship To Current Pages

Home V3:

- Broad discovery.
- Natural-language entry.
- Category and route exploration.
- Global Agent Composer.

Universities:

- Institution and city comparison.
- Image-led card browsing.
- Helps students understand Chinese university options before program choice.

Programs:

- Program-level discovery.
- Card grid for browsing.
- Search, suggested chips, sorting, comparison, saved states, and detail focus.
- Full filters available on demand.

Program focus:

- A lightweight in-page state for `programs.html?program=...`.
- Shows selected program overview, image, application snapshot, university link, and return-to-all link.
- Not a full final detail page yet.

## 4. What To Borrow From UCAS

Borrow:

- Clear page title.
- Search input close to the top.
- Result count.
- Sort control.
- `All filters` entry rather than always-visible filter overload.
- Favourite/save action.
- University/provider shown clearly inside each result.
- Pagination.
- Full footer separation.

Do not borrow:

- UCAS blue bands.
- UK-specific terms such as tariff points, UK region, resident status, or study mode priority.
- Advertising gaps.
- Exact layout, spacing, icon choices, or footer shape.
- A page that feels like UCAS visually.

CUAC should replace UCAS course facts with China-admissions facts: intake, deadline, tuition, scholarship signal, language route, HSK/IELTS, document burden, city, source status, and readiness.

## 5. Page Positioning

Primary job:

`Browse viable Chinese university programs by fit, deadline, budget, language route, and application readiness.`

Secondary jobs:

- Let students compare programs without opening every detail page.
- Let students identify blockers before they waste time applying.
- Let students save and return to interesting programs.
- Let the Agent apply filters or explain results without hiding the list.

This page must be more efficient than Home and more concrete than Universities, but visually closer to a polished browse page than a CRM dashboard.

## 6. Desktop Information Architecture

Current implemented order:

1. Shared header.
2. Compact page header with summary counters.
3. Search band.
4. Suggested filter chips.
5. Optional selected-program focus section for `?program=...`.
6. Result utility row:
   - result count
   - context line
   - `All filters`
   - sort select
   - `Cards / Dense` view toggle
7. Active chips.
8. Program card grid.
9. Pagination.
10. Footer.

Full filters:

- Do not appear as a permanent left rail.
- Open from `All filters`.
- Desktop: right-side drawer.
- Mobile: bottom drawer.

Avoid:

- Big hero.
- Marketing copy.
- Permanent left filter rail.
- Permanent right compare rail.
- Overloaded row/list UI.
- Dashboard-like action stacks.

## 7. Header And Search Band

Page label:

`Program Search`

H1:

`Find programs you can realistically apply to`

Subtitle:

`Compare language route, deadline, tuition, scholarship, city, and document effort before you add a choice.`

Search input:

- Placeholder: `Try "English-taught computer science in Hangzhou"`
- Accepts subject, university, city, degree level, language route, and natural-language phrases.
- Button: `Search`

Suggested chips:

- English-taught master
- No HSK first
- Scholarship available
- Late intake
- Under RMB 40k
- Light documents

The top search is page-level search UI. The global Agent Composer remains a separate all-site natural-language assistant.

## 8. Result Utility Row

Must include:

- Result count: `12 programs`
- Context line.
- `All filters` button.
- Sort select.
- View toggle: `Cards / Dense`.

Sort options:

- Relevance
- Deadline soonest
- Tuition low to high
- Scholarship signal
- Recently verified
- Document effort low to high

Default view:

- `Cards`, because the user explicitly preferred the Universities-style card browsing pattern.

## 9. Filters

Filters are still required, but they should not dominate the page.

Primary filters:

- Degree level.
- Subject.
- Teaching language.
- City.
- Intake.
- Deadline.
- Tuition.
- Scholarship available.
- Language requirements.
- Document burden.
- Source status.

Filter behavior:

- Applying filters updates result count and active chips.
- Active chips are removable.
- `Relax filters` appears in the empty state.
- Full filters open from `All filters`.
- Desktop drawer slides from the right.
- Mobile drawer slides from the bottom.
- Drawer supports close button, backdrop close, `Show programs`, and Escape close.
- Drawer uses `aria-hidden` and `inert` when closed.

Do not show every filter by default on desktop. That made the page feel like a management console and was rejected.

## 10. Program Card

Default results are image-led cards, not dense list rows.

Visible fields:

- Program image tied to school/city context.
- Deadline badge:
  - `Urgent: Sep 12`
  - `Closes Oct 15`
  - `Open until Nov 20`
  - `Late intake until Nov 10`
- Save action.
- Program name.
- University name as a link back to Universities.
- City and province.
- Degree level.
- Teaching language.
- Intake.
- Tuition.
- Scholarship signal.
- HSK / language-route signal.
- One readiness hint.
- Short fit line.
- Actions:
  - Compare
  - View program

Fields deliberately not always visible on cards:

- Full source freshness.
- Full document count.
- Full scholarship type.
- Full language requirement.
- Add-to-choices workflow.

These belong in the selected-program focus, future program detail page, filters, or Agent panel.

Card principles:

- Friendly browse rhythm.
- Similar visual family to Universities page.
- No nested cards.
- No heavy left/right rails.
- No excessive badges.
- No admission guarantee wording.

## 11. Selected Program Focus

When the URL includes `?program=<programId>`, show `programFocus` between search and result controls.

Purpose:

- Make `View program` feel like a meaningful route.
- Provide a lightweight detail preview before a future full detail page exists.
- Preserve the same image as the originating card for visual continuity.

Layout:

- Desktop:
  - left: image
  - middle: program name, deadline badge, university/city/degree/language, fit line, actions
  - right: `Application snapshot`
- Mobile:
  - stacked layout

Focus content:

- Program name.
- Deadline badge.
- University link.
- City and province.
- Degree level.
- Teaching language.
- Fit line.
- `View university`.
- `Back to all programs`.
- Application snapshot:
  - intake
  - tuition
  - scholarship signal/type
  - document count/burden
  - language requirement
  - source status

This is not the final full detail page. It is a route-quality bridge for the frontend prototype.

## 12. Readiness And Fit Signals

Readiness should be a small signal, not a fake admissions decision.

Suggested labels:

- `Likely fit`
- `Needs review`
- `Needs IELTS`
- `HSK blocker`
- `Deadline rescue`
- `Light documents`

Required wording discipline:

- Do not say `Eligible` unless the data is official and rule-based.
- Prefer `Likely fit` or `Needs review`.
- Never promise admission or scholarship.

## 13. Save And Compare

Save:

- Heart icon on image.
- Toggle state in prototype.

Compare:

- Secondary button on the card.
- Up to 3 compared programs.
- Compare logic remains in mock JS.

Right rail:

- Not shown by default in the current browse-first implementation.
- Earlier permanent shortlist/right rail made the page feel too tool-like.
- Future compare results should appear as inline content, modal, drawer, or Agent panel content rather than a permanent dashboard rail.

Add to choices:

- Removed from the default card surface.
- This action can return later inside program detail or application Hub, when the workflow is clearer.

## 14. Agent Interaction

The global Agent Composer remains available across the site.

On Programs page:

- Bottom composer can accept natural-language filters:
  - `show English-taught CS programs under RMB 40k`
  - `only scholarship options in Hangzhou or Shenzhen`
  - `hide heavy document programs`
- When sent, Agent Workspace opens.
- The composer docks inside the panel bottom while the panel is open.
- The panel content should show:
  - interpreted filters
  - what changed
  - result count
  - top matching programs
  - suggested next step

Agent panel should not replace the result list. It should help operate and explain it.

## 15. Mobile Layout

Mobile order:

1. Header.
2. Page title.
3. Search input.
4. Suggested chips.
5. Optional selected-program focus, stacked.
6. Compact controls:
   - All filters
   - Sort
   - Cards / Dense
7. One-column program cards.
8. Pagination.
9. Footer.

Mobile filter drawer:

- Opens from bottom.
- Max-height constrained.
- Sticky drawer actions.
- Does not permanently cover footer or global Agent Composer.

## 16. Visual Language

Use the Home V3 / Universities language:

- White page base.
- Deep teal CUAC identity.
- Green primary action.
- Amber for deadline warnings.
- Red only for hard blockers.
- 6px controls.
- 8px cards max.
- Image-led cards.
- Linear icons.
- Restrained hover lift.

Programs page density:

- Denser than Universities in content.
- Similar to Universities in browse rhythm.
- Much lighter than a CRM/dashboard.
- Keep filters available but not visually dominant.

Avoid:

- UCAS blue search band.
- Warm dirty background.
- Permanent filter wall.
- Permanent right rail.
- Too many visible badges.
- Nested cards.
- Hero-scale typography inside the work surface.
- Marketing language.

## 17. States

Required frontend states:

- Default results.
- Query results.
- Filtered results.
- Active chips.
- No results.
- Saved.
- Compared.
- Stale source warning in detail/snapshot.
- Pending source warning in detail/snapshot.
- Late intake result.
- Desktop right filter drawer.
- Mobile bottom filter drawer.
- Selected program focus from `?program=...`.
- Agent-applied filters.

No-results copy:

`No programs match these filters yet. Try relaxing deadline, city, scholarship, or document effort.`

Stale source copy:

`Admissions details need recheck before you apply.`

Deadline rescue copy:

`This program is close to deadline. Check documents before applying.`

## 18. Mock Data To Use First

Existing mock rows include:

- Zhejiang University: Computer Science MSc.
- Fudan University: Economics BA.
- Tongji University: Civil Engineering MSc.
- Beijing Language and Culture University: Chinese Language Non-degree.
- Harbin Institute of Technology Shenzhen: Artificial Intelligence MSc.
- University of International Business and Economics: International Trade MSc.
- Nanjing University: Data Science MSc.
- Sichuan University: Clinical Medicine MBBS.
- Xi'an Jiaotong University: Mechanical Engineering PhD.
- Wuhan University: International Relations BA.
- Sun Yat-sen University: Business Analytics MSc.
- Huazhong University of Science and Technology: Biomedical Engineering MSc.

Each program should have enough fields for cards, filters, and selected-program focus.

## 19. Implementation Notes

Current prototype:

- File: `design-lab/programs.html`.
- Public copy: `frontend/public/programs.html`.
- Reuses `shared-shell.css` and `shared-shell.js`.
- Uses static mock JS data.
- No backend or database.
- No deployment unless explicitly requested.

Important implementation choices:

- `pageSize: 12`.
- Default view label: `Cards`.
- Secondary view label: `Dense`.
- Full filter UI is rendered but hidden in drawer.
- `programs.html?university=<name>` filters by university.
- `programs.html?program=<id>` shows selected-program focus.
- Program card university names link back to `universities.html?q=<university>`.

## 20. Migration Preparation

Future React concepts:

- `ProgramSearchHeader`
- `ProgramSuggestedChips`
- `ProgramResultControls`
- `ProgramCardGrid`
- `ProgramCard`
- `ProgramFilterDrawer`
- `ProgramActiveChips`
- `ProgramFocus`
- `ProgramCompareState`

Do not migrate the old dense row / permanent rail version. The accepted direction is card grid + on-demand filters + selected-program focus.

## 21. Acceptance Criteria

Before implementation is considered successful:

- A student understands the page purpose within 5 seconds.
- The page feels like a polished browse surface, not a filter dashboard.
- The visual rhythm is compatible with the Universities page.
- Full filters exist but are not all shown by default.
- Results are scannable without opening detail pages.
- Each card answers the top-level questions: what program, which university/city, intake, tuition, language/scholarship/readiness signal.
- Program focus answers the deeper questions: documents, source, language requirement, scholarship type.
- The page does not look like UCAS, but meets UCAS-level clarity.
- Mobile is usable, not a squeezed desktop table.
- Agent behavior helps operate the page without hiding core results.
- No backend or database assumptions are required.
- No publishing or deployment occurs unless explicitly requested.
