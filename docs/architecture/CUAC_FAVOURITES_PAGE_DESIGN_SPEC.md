# CUAC Favourites Page Design Spec

Date: 2026-08-14

Status: planning document before implementation. Do not publish or deploy unless explicitly requested.

Target page:

- Static prototype: `design-lab/favourites.html`
- Static public copy later: `frontend/public/favourites.html`
- Future app route: `/favourites`
- Related routes: `/hub`, `/application`, `/programs`, `/universities`, `/scholarships`, `/cities`, `/guides`

## 1. Core Judgment

CUAC should build a dedicated Favourites page, but it should not be a generic bookmark page.

For international students applying to Chinese universities, a saved item is not just something they liked. It is a possible route, evidence source, funding path, city assumption, document checklist, or future application choice. The page should help students move from casual browsing to a more realistic China application set.

The page should answer:

`What have I saved, what is actually application-ready, and what should I do next?`

## 2. UCAS Reference Assessment

The supplied UCAS Favourites page has useful product structure:

- It separates `Shortlist` from `All Favourites`.
- It shows counts, so the student understands whether the saved set is empty or useful.
- It groups saved items by type.
- It treats favourites as part of the signed-in Hub ecosystem.
- Empty states clearly invite the user to select from favourites.
- The layout is simple enough that a young student can understand it quickly.

What CUAC should not copy:

- The bright magenta band and UCAS visual identity.
- UK-specific categories such as careers, employers, and UCAS course shortlist semantics.
- A passive empty shortlist area that does not help the student decide.
- A structure where collection counts are the main experience.
- A course-only shortlist model. CUAC needs a concrete `university + program + intake + language route` model.
- Lack of China-specific readiness signals: source status, HSK/IELTS, tuition, scholarship deadline, document burden, city cost, visa/JW timing.
- Lack of Agent assistance on saved-item interpretation.

The borrowing principle:

`Use UCAS's clarity around saved collections and shortlist, but make CUAC's page a China-study decision workspace.`

## 3. Product Positioning

Primary role:

`Review saved China study options before building an application set.`

Secondary roles:

- Summarize saved programs, universities, scholarships, cities, and guides.
- Promote concrete program routes into application choices.
- Compare saved routes by deadline, tuition, city, language, scholarship, source, and documents.
- Help students notice blockers early.
- Let Agent organize saved items into a safer, clearer plan.

This page sits between discovery and action:

- Public pages create saved items.
- Favourites organizes saved items.
- Hub summarizes progress.
- Application turns selected program routes into choices.

## 4. Target Users And Mindset

Primary users:

- International high school students exploring undergraduate study in China.
- Undergraduate graduates planning master study in China.
- Scholarship-sensitive students.
- Students who saved many items but do not know which are realistic.
- Students comparing famous universities against practical route fit.

Common student questions:

- `Which saved program should be my first choice?`
- `Can I apply to this university, or do I need a specific program?`
- `Which saved options are English-taught?`
- `Which saved route is cheapest?`
- `Which saved scholarship actually matches my programs?`
- `What documents are missing for my saved choices?`
- `Which saved items are only interesting, and which are ready to apply?`

Design implication:

The page must reduce saved-item chaos. It should not reward collecting too many cards without helping the student narrow them.

## 5. Information Architecture

Recommended page order:

1. Shared header with signed-in state.
2. Page masthead.
3. Saved route summary band.
4. Application shortlist section.
5. Saved collections section.
6. Route review section.
7. Agent review module.
8. Recent saved items or activity.
9. Empty and low-data guidance states.
10. Shared footer.

The first viewport should not be a huge dashboard. It should combine a simple page title with one useful status summary.

## 6. Page Masthead

Eyebrow:

`Favourites`

H1:

`Review your saved China study routes`

Subtitle:

`Keep programs, universities, scholarships, cities, and guides together before you build your application choices.`

Primary action:

- `Ask Agent to review`

Secondary action:

- `Browse programs`

Masthead status facts:

- `4 saved programs`
- `2 universities`
- `3 deadlines soon`
- `1 route ready`

Visual direction:

- White page base.
- Deep jade identity.
- One slim accent rule, not a bright UCAS-like block.
- Compact status chips rather than large metric cards.

## 7. Saved Route Summary Band

Purpose:

Give the student a quick read before scrolling.

Recommended metrics:

- `Saved routes`
  - Program-level saved options.
- `Application-ready`
  - Saved program routes with enough known fields to become choices.
- `Needs check`
  - Source, deadline, language, or scholarship uncertainty.
- `Deadline soon`
  - Saved routes with near deadlines.

Example copy:

`You have 4 saved program routes. 1 looks ready for application review, 2 need document checks, and 1 scholarship deadline may come earlier than the program deadline.`

Design:

- Horizontal status strip on desktop.
- Two-by-two compact grid on mobile.
- No heavy dashboard charts.
- Use small icons and clear status color.

## 8. Application Shortlist Section

This is the most important section.

Purpose:

Show saved program routes that are close to becoming application choices.

Important rule:

`Only a concrete program route can become an application choice. A saved university alone cannot.`

A valid shortlist candidate contains:

- University.
- Program.
- Degree level.
- Intake.
- Teaching language.
- City.
- Deadline.
- Tuition.
- Source status.
- Document effort.

Recommended section title:

`Application shortlist`

Subtitle:

`Choose concrete program routes before adding them to your application set.`

Card/list fields:

- Program name.
- University and city.
- Deadline and intake.
- Tuition estimate.
- Language route.
- Scholarship signal.
- Document status.
- Source status.
- Role suggestion:
  - `Main route`
  - `Backup`
  - `Funding-sensitive`
  - `Needs review`

Actions:

- `Add to application set`
- `Compare`
- `Ask Agent`
- `Open program`

Layout:

- Desktop: compact route cards in a two-column grid or a strong list.
- Mobile: stacked cards.
- Avoid too many equal cards. Highlight 1 recommended route, then show the rest as compact rows.

## 9. Saved Collections Section

Purpose:

Let users see all saved item types without turning the page into a card wall.

Recommended collections:

- Programs
- Universities
- Scholarships
- Cities
- Guides

Do not include UCAS categories that are not central to our business, such as employers or career pathways.

Collection tile fields:

- Count.
- Short practical purpose.
- One next action.

Examples:

- `Programs`
  - `4 saved`
  - `Compare deadline, tuition, documents, and language route.`
  - Action: `View saved programs`

- `Universities`
  - `2 saved`
  - `Check which saved schools have programs you can apply to.`
  - Action: `Find matching programs`

- `Scholarships`
  - `3 saved`
  - `Check coverage, eligibility, source, and earlier deadlines.`
  - Action: `Review funding routes`

- `Cities`
  - `2 saved`
  - `Compare living cost and student-life fit.`
  - Action: `Compare cities`

- `Guides`
  - `5 saved`
  - `Turn useful guides into document or deadline tasks.`
  - Action: `Open guide list`

Visual design:

- Keep tiles compact.
- Use icons, count circles, and one-line explanations.
- Do not use UCAS's large empty grey area.
- Do not make every collection tile look equally urgent.

## 10. Route Review Section

Purpose:

Show saved items organized by actual student decision, not only by object type.

Recommended route groups:

- `English-taught computer science`
- `Lower-cost cities`
- `Scholarship-first options`
- `Late intake backup`
- `Needs document check`

Each group can include:

- saved programs;
- saved universities with matching programs;
- saved scholarships that might apply;
- saved city context;
- relevant saved guides.

Example group:

`English-taught Computer Science in Hangzhou`

- Main program: `ZJU Computer Science MSc`
- Backup: `Nanjing Software Engineering MSc`
- City note: `Hangzhou lower cost than Shanghai`
- Funding note: `University scholarship possible, CSC needs confirmation`
- Document note: `IELTS and transcript translation still need review`

Actions:

- `Compare route`
- `Build checklist`
- `Add best route to application`
- `Ask Agent to explain`

This section is where CUAC can be better than UCAS: it interprets saved items into route logic, not just collections.

## 11. Agent Review Module

The Favourites page should be one of the strongest Agent entry points.

Recommended prompt chips:

- `Summarize my saved routes`
- `Which saved route is safest?`
- `Build my application shortlist`
- `Check deadline risks`
- `Find missing documents`
- `Which choice is cheapest?`
- `Which scholarship fits my saved programs?`

Agent output should be able to show:

- ranked saved routes;
- why a route is strong or risky;
- deadline conflict summary;
- reusable documents vs program-specific documents;
- city cost comparison;
- scholarship route warnings;
- recommended next page action.

Allowed front-end demo actions:

- Open Programs filtered by saved university or subject.
- Open Universities with saved-state context.
- Open Scholarships with matching saved programs.
- Open Application with add-choice modal prefilled.
- Save a generated checklist to Hub.
- Mark a saved route as `Needs review`.

Do not:

- Claim admission or scholarship guarantee.
- Submit an application.
- Ask for sensitive documents in this prototype.
- Hide the saved item list behind the Agent.

## 12. Item Type Design

### 12.1 Saved Program

Primary saved entity.

Fields:

- `programId`
- `universityId`
- program name
- university name
- city and province
- degree level
- intake
- teaching language
- tuition
- deadline
- source status
- language requirement
- document effort
- scholarship signal

Primary action:

- `Add to application set`

Secondary actions:

- `Compare`
- `Open program`
- `Ask Agent`

### 12.2 Saved University

Saved universities are interest objects, not application choices.

Fields:

- university name
- city
- subject strengths
- saved program count
- English-taught route count
- scholarship signal
- source status

Primary action:

- `View matching programs`

Secondary actions:

- `Compare university`
- `Open university`

### 12.3 Saved Scholarship

Scholarships must be linked back to programs when possible.

Fields:

- scholarship name
- type: CSC, university, city/province, partner
- funding level
- coverage
- deadline
- source status
- linked saved programs

Primary action:

- `See matching programs`

Secondary actions:

- `Check eligibility`
- `Ask Agent`

### 12.4 Saved City

Cities help with route choice, not just travel curiosity.

Fields:

- city name
- monthly cost estimate
- saved universities
- saved programs
- internship or industry signal
- student-life note

Primary action:

- `Compare city routes`

Secondary action:

- `Open city guide`

### 12.5 Saved Guide

Guides should convert into tasks.

Fields:

- guide title
- category: documents, language, visa/JW, funding, city, application
- linked saved route if relevant

Primary action:

- `Turn into checklist`

Secondary action:

- `Open guide`

## 13. States

Required states:

- No favourites.
- Some favourites, no concrete program route.
- Saved programs but no shortlist.
- Shortlist exists.
- Application choices already include some saved routes.
- Deadline risk.
- Source needs check.
- Saved scholarship without linked program.
- Saved university without saved program.
- Mobile Agent panel open.
- Agent scenario dropdown closed by default.

No favourites copy:

`Start by saving programs, universities, scholarships, or cities. CUAC will help you turn them into realistic application routes.`

No program route copy:

`You have saved universities and guides, but no concrete program route yet. Choose a specific program before adding an application choice.`

Deadline risk copy:

`One saved route has an earlier scholarship deadline than its program deadline. Check funding timing first.`

## 14. Interaction Design

Save and unsave:

- Hearts across the site update this page.
- Saved state should be visually obvious but not loud.
- Unsave requires no modal in the demo, but should allow quick undo later.

Shortlist:

- A student can mark up to a limited number of program routes as shortlist candidates.
- Recommended initial demo limit: 5 shortlist candidates, matching the mental model UCAS users understand.
- CUAC may later support more saved routes but fewer final application choices.

Compare:

- Compare up to 3 routes in frontend demo.
- Comparison should focus on:
  - deadline;
  - tuition and city cost;
  - language route;
  - scholarship signal;
  - document effort;
  - source status.

Promote to application:

- `Add to application set` opens or routes to Application with the selected concrete program route.
- If the saved item is only a university, the CTA should be `Choose a program first`.
- If the saved scholarship is not linked to a program, the CTA should be `Find programs for this scholarship`.

Agent:

- The global bottom composer is present.
- Sending opens the right Agent Workspace.
- The composer docks inside the workspace when open.
- Favourites-specific scenario menu should be available but hidden until the user clicks `Scenarios`.

## 15. Visual Direction

Use the current CUAC design language:

- white page base;
- deep jade identity;
- mint for ready/saved;
- amber for deadline/funding warning;
- coral only for blockers;
- blue only if needed for secondary information;
- 6px controls;
- cards at 8px radius or less;
- clean line icons;
- short copy.

Avoid:

- UCAS magenta band;
- a card wall of equal repeated tiles;
- oversized empty states;
- heavy grey backgrounds;
- too much text in every tile;
- dashboard-style charts;
- generic motivational copy.

Recommended rhythm:

- First screen: calm summary and one useful action.
- Middle: shortlist and collections.
- Lower: route review and Agent prompts.
- Footer separated with a thin line.

## 16. Desktop Layout

Suggested desktop structure:

```text
Shared header

Favourites masthead
  H1 + subtitle
  Ask Agent to review / Browse programs

Saved route summary band
  saved routes | application-ready | needs check | deadline soon

Main workspace
  Left: Application shortlist
  Right: Agent review / route health summary

Saved collections
  Programs | Universities | Scholarships | Cities | Guides

Route review
  grouped saved routes with next actions

Recent saved activity

Footer
```

Width:

- Use the same shared `--page-width` as Home, Programs, Universities, and Scholarships.
- Avoid making this page narrower than other main pages.

## 17. Mobile Layout

Mobile order:

1. Compact shared header.
2. Masthead.
3. Summary chips.
4. Application shortlist.
5. Collections as horizontal tabs or compact stacked rows.
6. Route review cards.
7. Agent prompts.
8. Footer.

Mobile rules:

- Do not show more than one major card per row.
- Hide noncritical facts behind expandable detail.
- Keep `Add to application set` visible on concrete program routes.
- Bottom Agent composer should hide at footer bottom, consistent with other pages.

## 18. Frontend-Only Demo Scope

Build as a high-fidelity static interaction prototype.

In scope:

- Static mock favourites data.
- Tabs by saved type.
- Save/unsave local state.
- Promote a saved program to application.
- Compare selected saved routes.
- Agent prompt scenarios for saved routes.
- Empty and low-data states.
- Links to existing pages.

Out of scope:

- Backend persistence.
- Real authentication.
- Real application submission.
- Real document upload.
- Real scholarship eligibility calculation.
- Real adviser review.

## 19. Routing Requirements

Shared header:

- Heart icon should route to `favourites.html`, not `programs.html`.
- Account dropdown `Favourites` should route to `favourites.html`.

Public pages:

- Program cards save into Favourites.
- University cards save into Favourites.
- Scholarship cards save into Favourites.
- City and guide pages can save relevant items later.

Favourites page:

- `Open program` routes to `programs.html?program=<id>`.
- `View matching programs` routes to `programs.html?university=<name>`.
- `Review funding routes` routes to `scholarships.html`.
- `Compare cities` routes to `cities.html`.
- `Add to application set` routes to `application.html` or opens a future add-choice flow.

Hub:

- Hub should link to Favourites for full shortlist management.
- Favourites should link back to Hub for progress overview.

## 20. Data Model For Future Build

```ts
type FavouriteItem =
  | FavouriteProgram
  | FavouriteUniversity
  | FavouriteScholarship
  | FavouriteCity
  | FavouriteGuide;

type FavouriteProgram = {
  type: 'program';
  id: string;
  programId: string;
  universityId: string;
  title: string;
  universityName: string;
  city: string;
  degreeLevel: string;
  intake: string;
  teachingLanguage: string;
  tuitionRmb?: number;
  deadline?: string;
  sourceStatus: 'verified' | 'needs_check' | 'estimate';
  documentEffort: 'light' | 'medium' | 'heavy';
  scholarshipSignal?: 'possible' | 'strong' | 'none' | 'needs_check';
  readiness: 'ready' | 'needs_review' | 'blocked';
  savedAt: string;
};

type FavouriteUniversity = {
  type: 'university';
  id: string;
  universityId: string;
  name: string;
  city: string;
  subjectSignals: string[];
  savedProgramCount: number;
  englishRouteCount?: number;
  scholarshipSignal?: string;
  sourceStatus: 'verified' | 'needs_check' | 'estimate';
  savedAt: string;
};

type FavouriteScholarship = {
  type: 'scholarship';
  id: string;
  scholarshipId: string;
  title: string;
  fundingType: 'csc' | 'university' | 'city' | 'province' | 'partner';
  fundingLevel: 'full' | 'partial' | 'tuition_waiver' | 'unknown';
  coverage: string[];
  deadline?: string;
  sourceStatus: 'verified' | 'needs_check' | 'estimate';
  linkedProgramIds: string[];
  savedAt: string;
};

type FavouriteRouteGroup = {
  id: string;
  title: string;
  goal: string;
  programIds: string[];
  universityIds: string[];
  scholarshipIds: string[];
  cityIds: string[];
  guideIds: string[];
  recommendation: 'main' | 'backup' | 'funding_sensitive' | 'needs_review';
  nextAction: string;
};
```

## 21. Implementation Guidance

First implementation should create:

- `design-lab/favourites.html`
- `design-lab/favourites.css`
- `design-lab/favourites.js`
- synchronized public copies under `frontend/public`

Reuse:

- `shared-shell.css`
- `shared-shell.js`
- shared header, footer, account dropdown, Agent composer, Agent panel.

Page-level CSS structure:

- `.favourites-page`
- `.favourites-hero`
- `.favourites-summary`
- `.shortlist-section`
- `.shortlist-route`
- `.collections-grid`
- `.collection-tile`
- `.route-review`
- `.route-group`
- `.favourites-empty`

Before implementation QA:

- Desktop at 1440px and 1920px.
- Mobile at 390px and 430px.
- Account dropdown does not overlap page title.
- Agent panel open, collapsed, and wide states.
- Scenario menu hidden until clicked.
- Bottom composer hidden at footer bottom.
- No card height mismatch.
- No text overflow in long university/program names.

## 22. Success Criteria

The Favourites page is successful when:

- It feels like a natural signed-in page, not a public search page.
- It does not copy UCAS visual identity.
- A student understands the difference between saved item, shortlist, and application choice.
- Saved universities and scholarships do not pretend to be application choices.
- Concrete program routes can move toward Application.
- Deadlines, source status, language route, tuition, scholarship signal, and document effort are visible.
- Agent can summarize and organize saved items without replacing the page.
- Empty states help students continue browsing.
- The page links cleanly to Home, Programs, Universities, Scholarships, Cities, Guides, Hub, and Application.
- The frontend demo can simulate realistic saved-item scenarios without backend or database.

## 23. Implementation Status - Static Frontend Demo

Implemented files:

- `design-lab/favourites.html`
- `design-lab/favourites.css`
- `design-lab/favourites.js`
- `frontend/public/favourites.html`
- `frontend/public/favourites.css`
- `frontend/public/favourites.js`

Shared shell integration completed:

- Header heart icon routes to `favourites.html`.
- Signed-in account dropdown includes `Favourites`.
- Favourites page uses `data-agent-mode="favourites"`.
- Favourites has its own Agent workspace copy and workflow steps.
- Favourites-specific Agent scenario prompts are available through the shared scenario picker.

Hub integration completed:

- Hub `Saved routes` module routes to `favourites.html` through `Manage favourites`.
- Hub route details use concrete program query links such as `programs.html?program=zju-cs-msc`.
- Favourites links back to Hub through `Back to Hub`.

Source-page save feedback completed:

- Programs save action shows `Saved ... to Favourites` and links to `Review saved items`.
- Universities save action shows `Saved ... to Favourites` and links to `Find matching programs`.
- Scholarships save action shows `Saved ... to Favourites` and links to `Review funding context`.
- Removing a saved item shows a clear removed-from-Favourites message.

Favourites page interactions completed:

- Saved item tabs by type.
- Saved item tabs use `role="tab"` and `aria-selected`.
- Saved item tabs support mouse click plus keyboard `ArrowLeft`, `ArrowRight`, `Home`, and `End`.
- Local save/unsave state.
- Unsave shows an inline `Undo` action in the Agent review note.
- Undo restores the saved item, summary counts, compare tray state, and saved grid state in the static demo.
- Summary counts update from local saved state.
- Concrete program routes can be marked for the application set.
- Non-program saved items route to the correct next action:
  - University -> `Choose a program first`, routed to matching programs for that saved university.
  - Unlinked scholarship -> `Find programs for this scholarship`, routed to matching program search.
  - Linked university award -> funding route details.
  - City -> city comparison.
  - Guide -> guide detail.
- Compare supports up to three saved items.
- Compare tray summarizes selected items, concrete-route count, and risk signal.
- Compare tray can trigger Agent comparison or clear selected items.
- Empty-state UI appears when the active saved-type view has no items.
- Route review cards link to related program or funding context, not directly to Application, because they are decision summaries rather than concrete application choices.
- Regression tests now explicitly protect the distinction between saved item, shortlist, and concrete application choice.

Static demo boundaries:

- Save state is local to the static page session and is not persisted.
- Saved items are mock data, not connected to program, university, scholarship, city, or guide stores.
- `Add to application set` marks demo state and exposes an `Open application` link; it does not write to a real application record.
- Agent responses and actions are simulated front-end states.
- Real shortlist persistence, authentication, adviser review, eligibility checks, and document upload remain future backend work.

## 24. QA Evidence - Static Frontend Demo

Automated checks run:

- `node --check design-lab/favourites.js`
- `node --check frontend/public/favourites.js`
- `node --check design-lab/shared-shell.js`
- `node --check frontend/public/shared-shell.js`
- `npm test` in `frontend`

Current `frontend` rendered HTML test coverage:

- Static route wiring and shared shell assets.
- Favourites page asset wiring.
- Favourites-specific decision logic:
  - saved item tabs;
  - saved item tab accessibility state and keyboard navigation;
  - saved item tab mouse filtering and keyboard focus movement;
  - local saved state;
  - undo after unsave;
  - summary health calculation;
  - program-only application choice guard;
  - non-program next actions;
  - route review cards avoiding premature Application routing;
  - compare limit of three items;
  - empty-state visibility;
  - Agent `compare-routes` and `save-checklist` demo actions.
- Shared Agent scenario picker containment and wide panel behavior.

Rendered QA artifacts:

- `design-lab/qa-favourites-shot.cjs`
- `design-lab/qa-favourites-desktop.png`
- `design-lab/qa-favourites-wide.png`
- `design-lab/qa-favourites-mobile.png`
- `design-lab/qa-favourites-mobile-tall.png`

Latest rendered QA result:

- Desktop viewport checked at `1440 x 1000`.
- Wide desktop viewport checked at `1920 x 1040`.
- Mobile viewports checked at `390 x 900` and `430 x 932`.
- `documentWidth` equals `viewportWidth` in all rendered checks.
- `visibleOverflow: []`.
- `textOverflow: []`.
- Compare tray rendered.
- 11 saved cards rendered.
- 5 collection tiles rendered.
- Saved item tabs default to `All`, expose exactly one selected tab state, and filter saved cards by type.
- Clicking the `Programs` tab shows the program subset.
- Keyboard `End` navigation moves focus to the `Guides` tab and shows the guide subset.
- Unsave removes one saved card and shows an `Undo` action.
- Undo restores the saved card count.
- Agent composer rendered.
- Agent scenario menu opens only after the user clicks the scenario trigger.
- Selecting a scenario populates the composer.
- Submitting the composer opens the Agent panel and moves the composer into the panel bottom.
- Desktop Agent panel wide mode stays at or below half of the viewport.
- Fixed bottom composer hides at page bottom and does not overlap the footer.

Observed and fixed during QA:

- The bottom Agent composer initially overlapped the first content block on the Favourites page.
- The Favourites default Agent prompt was too long and made the composer taller than needed.
- The prompt was shortened to `Review my saved routes`.
- Favourites vertical spacing was adjusted so the fixed composer rests in a breathing area rather than covering core content.

Known QA nuance:

- Hidden Agent panel content and intentional horizontal tab scrolling are ignored by `qa-favourites-shot.cjs` overflow detection because they are not visible-page layout defects.
- On narrow mobile QA, the Agent panel is intentionally full width, so the desktop half-width assertion is skipped.

## 25. Favourites V2 Polish Direction

The first implementation proved the page logic, but the visual density still felt unfinished. The next pass should treat Favourites as a decision page, not as a database grid.

Design corrections:

- Keep `Application shortlist` as the first decision module.
- Treat saved `Programs` as the most important saved content because only concrete programs can become application choices.
- Move universities, scholarships, cities, and guides into lighter context rows instead of showing every item as an equal large card.
- Reduce repeated action buttons inside each card; each item should expose one primary next action and one lightweight compare/action affordance.
- Keep compare as a compact tray, not another large section.
- Do not let the bottom Agent composer cover dense saved-item content. On Favourites, the fixed composer should step back earlier and let the page itself breathe.
- Preserve the bottom composer as a global entry point, but the page must add enough final spacing and visibility rules so it never hides item actions.

Acceptance additions:

- The saved browser must show a clear hierarchy between concrete application routes and saved context.
- Cards/rows in the same visual group should align consistently and avoid clipped or hidden actions.
- A screenshot around the saved browser middle should not show the fixed Agent composer covering saved-item copy or buttons.
- The page should still pass the existing Agent, compare, undo, tab, and route-decision regression checks.

Implemented in V2 polish:

- `All favourites` now separates 4 concrete saved program cards from 7 lighter saved context rows.
- Non-program filters such as `Guides` render as lightweight context rows instead of duplicating large cards.
- Program cards were tightened with lower height, lighter button treatment, and clearer application-route emphasis.
- Saved context rows now carry the secondary decision material: universities, scholarships, cities, and guides.
- `Saved browser` and `Route review` are marked as Agent composer avoidance zones.
- The shared Agent composer hides while the user is inside dense saved-item decision zones, then remains available again outside those zones.
- QA now checks saved program card count, saved context row count, and composer hidden state in the middle of the saved browser.

## 26. Favourites V3 Visual Direction

The V2 information hierarchy is correct, but the visual model is still too close to an admin list. The next version should move toward a UCAS-like card browsing experience without copying UCAS styling.

Design corrections:

- Use visual cards, soft color blocks, and compact collection tiles instead of white text-heavy records.
- Program cards should be scannable in under two seconds: title, university/city, deadline/fee/status, and one primary next action.
- Detailed explanation text should move out of the card face. It can appear in Agent responses, route detail pages, comparison, or future drawers.
- Context items should feel like saved collections: university interest, scholarship route, city note, guide. They should use colored cards and icons, not table-like rows.
- The page should feel lighter and younger: more visual rhythm, fewer paragraphs, less repeated button chrome.
- Agent remains an assistant for organizing saved items, not the main visual object on the page.

Acceptance additions:

- A mid-page screenshot should show mostly cards, color fields, and short labels rather than paragraphs.
- Saved programs should look more important than saved context, but not more text-heavy.
- Each saved item should expose one obvious primary action and at most one secondary inline action.
- The page must still preserve the business distinction between saved item, concrete program route, and application choice.

Implemented in V3 polish:

- Saved program cards now use colored visual headers instead of plain white text blocks.
- Program card copy was reduced to route role, status, title, short university/city metadata, and three key facts.
- Long explanatory paragraphs were removed from the card face.
- Collection tiles now use distinct soft color backgrounds by type.
- Context items now render as colorful compact cards instead of table-like rows.
- Context cards show icon, type, title, short metadata, two key facts, and one next action.
- Route review cards were shortened and given a lighter visual background.
- The static demo still keeps the underlying route/action semantics for Agent, compare, saved state, and application-choice simulation.
