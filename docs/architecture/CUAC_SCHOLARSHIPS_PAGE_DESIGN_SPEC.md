# CUAC Scholarships Page Design Spec

Date: 2026-08-13

Status: planning document before implementation. Do not publish or deploy.

Target page:

- Static prototype: `design-lab/scholarships.html`
- Static public copy later: `frontend/public/scholarships.html`
- Future app route: `/scholarships`
- Related routes later: `/scholarships/:slug`, `/programs?scholarship=...`, `/universities?scholarship=...`

## 1. Core Judgment

The Scholarships page should help international students understand and compare funding routes for studying in China.

It should not be a dense filter console. It should also not be only an article explaining scholarships. CUAC needs a hybrid page:

- A clear entry point for funding intent.
- A short explanation of Chinese scholarship types.
- A browseable scholarship directory.
- Program and university jump paths.
- Honest signals about coverage, eligibility, deadline, source freshness, and uncertainty.

This page sits between Home, Programs, and Universities:

- Home introduces `Scholarship preferred` as a student intent.
- Programs shows scholarship signals at program level.
- Universities shows institution-level scholarship availability.
- Scholarships explains and compares funding routes, then lets the student continue into programs or universities.

The page should feel more editorial and helpful than Programs, but still more actionable than a guide article.

## 2. Research Summary

### 2.1 UCAS Reference

UCAS treats scholarships, bursaries, and grants as student money guidance rather than a pure course-search surface. The useful patterns for CUAC are:

- Explain funding types in plain language before asking users to filter.
- Keep money guidance connected to search and student-life decisions.
- Avoid overloading first view with every eligibility detail.
- Make routes discoverable from the main navigation and homepage category system.

CUAC should borrow the standard of clarity, not the visual design or UK funding model.

### 2.2 China Scholarship Context

China-study scholarships are more fragmented than UK student funding. A student may encounter:

- Chinese Government Scholarship / CSC routes.
- University scholarships.
- Provincial or municipal government scholarships.
- Subject, country, partnership, or language-teacher scholarships.
- Full funding, partial funding, tuition waiver, stipend, accommodation, insurance, or mixed benefits.

The current project already has scholarship-oriented source material and older implementation assets:

- `migration-intake/ScholarshipPages.tsx`
- `migration-intake/api-scholarships.ts`
- `migration-intake/csca-app-scholarships.seed.json`
- `migration-intake/schema.prisma`

Important existing data signals include:

- `type`
- `fundingLevel`
- `benefits`
- `targetCountries`
- `applicableDegree`
- `applicableProgram`
- `deadline`
- `schoolName`
- `schoolCount`
- `sourceUrl`
- `lastVerifiedAt`
- `status`

The seed file reports 275 scholarship records captured from the previous source pool. This is enough to justify a real directory-style page in the frontend prototype, even if we use curated mock data first.

## 3. Audience And Student Mindset

Primary audience:

- International high school students, transfer students, undergraduates, and early postgraduate applicants.
- Often unfamiliar with Chinese scholarship names and government/university application channels.
- Many are budget-sensitive and may treat scholarship availability as a go/no-go factor.
- Many need reassurance that a scholarship signal is not a guarantee.

Typical questions:

- `Can I study in China with a full scholarship?`
- `Which scholarships fit undergraduate computer science?`
- `Do I need to apply through CSC, the university, or both?`
- `Which universities in Hangzhou have scholarship routes?`
- `What does full funding actually cover?`
- `Is this scholarship still open for Fall 2026?`
- `Which documents do I need before applying?`

Primary anxieties:

- Confusing scholarship availability with guaranteed admission.
- Missing separate scholarship deadlines.
- Applying to a program without meeting scholarship eligibility.
- Not knowing whether tuition, accommodation, stipend, insurance, or living costs are covered.
- Trusting old or copied scholarship notices.
- Not knowing whether a scholarship applies to their nationality, degree level, or program.

The page must make uncertainty visible without making the experience scary.

## 4. Product Positioning

Primary job:

`Find funding routes that fit your China study plan.`

Supporting job:

`Compare scholarship type, coverage, eligibility, deadline, source freshness, and matching programs before you commit to an application.`

Core promise:

`We help you understand what the scholarship may cover and what you still need to verify.`

Do not imply:

- Guaranteed scholarship.
- Guaranteed admission.
- That CUAC is the official scholarship awarding body.
- That a missing official link is safe.
- That full funding always means every real-life cost is covered.

## 5. Relationship To Current Design Language

Use the same shared shell as Home, Universities, and Programs:

- `shared-shell.css`
- `shared-shell.js`
- Shared nav: Programs, Universities, Scholarships, Cities, Guides
- Shared footer
- Shared global bottom Agent Composer
- Shared right-side Agent Workspace

Visual language:

- White / cool soft-grey page base.
- Deep green CUAC identity.
- Bright blue only for high-value primary actions when needed.
- Small mint, yellow, rose, and cool-blue accents for status.
- 8px maximum radius for cards/images unless a chip needs capsule shape.
- Lucide-style linear icons.
- Wide content area aligned to Home and Universities.

Avoid:

- UCAS blue bands.
- Warm dirty beige backgrounds.
- Scholarship page dominated by gold/yellow.
- Permanent dashboard sidebars.
- Too many separate cards of equal weight.
- Long first-viewport copy.

## 6. Page Information Architecture

Recommended desktop order:

1. Shared header.
2. Compact page header.
3. Funding intent composer.
4. Route shortcut row.
5. Key explanation band: what counts as funding.
6. Featured funding routes.
7. Scholarship browser.
8. Deadline and source-confidence strip.
9. Related paths: Programs, Universities, City cost.
10. FAQ / common misunderstandings.
11. Footer.

The page should not start with a generic big hero image. Scholarships are abstract; the primary visual should be structured information and light iconography, not decorative photography.

## 7. First View Design

Eyebrow:

`Scholarships`

H1:

`Find funding routes for studying in China`

Subtitle:

`Compare CSC, university, city, and partial-award routes by coverage, deadline, eligibility, and source status.`

Primary input:

- A natural-language funding intent box, visually related to Home but slightly more compact.
- Placeholder: `Tell us your study goal and funding need`
- Example text: `Full scholarship for English-taught computer science master`
- Send button uses the same paper-plane icon language as the global Agent Composer.

Prompt chips:

- Full scholarship
- CSC route
- University scholarship
- Undergraduate
- Master
- No HSK first
- Fall 2026
- Lower-cost city

Interaction:

- Sending opens the shared Agent Workspace.
- Agent steps should be scholarship-specific:
  - Understand funding goal.
  - Match scholarship types.
  - Check degree, country, and language fit.
  - Compare coverage and deadline.
  - Suggest programs or universities to inspect.
- The page should also update visible route chips locally in the prototype.

## 8. Route Shortcut Row

Use icon-led shortcuts, not cards with heavy borders.

Suggested shortcuts:

- `All scholarships`
  - subtitle: `Browse verified routes`
  - icon: badge-dollar-sign
- `Full funding`
  - subtitle: `Tuition, stipend, and more`
  - icon: badge-check or medal
- `CSC / Government`
  - subtitle: `National and official routes`
  - icon: landmark
- `University awards`
  - subtitle: `School-level funding`
  - icon: school
- `Province / city`
  - subtitle: `Local government awards`
  - icon: map-pin
- `Deadline soon`
  - subtitle: `Check timing first`
  - icon: calendar-clock

This row should behave like Home category navigation: simple, light, wide, and fast.

## 9. Explanation Band

The page needs one concise educational section before the directory, because scholarship terms are easy to misunderstand.

Title:

`What funding can cover`

Layout:

- One horizontal band with 4 compact items.
- Not a grid of big cards.

Items:

- Tuition
- Accommodation
- Living stipend
- Medical insurance

Each item should include a one-line caveat:

- `May be full or partial`
- `Campus rules vary`
- `Monthly amount varies`
- `Usually follows notice`

Include a small honesty note:

`Coverage depends on the official notice. CUAC separates verified details from items still needing confirmation.`

## 10. Featured Funding Routes

This section is not a generic card dump. It should introduce major routes students can understand quickly.

Recommended structure:

- Left: a larger feature block for `Chinese Government Scholarship / CSC`.
- Right: a vertical list of 3 secondary route rows:
  - University scholarships
  - Provincial or city scholarships
  - Subject or partner scholarships

Each route row shows:

- Type name.
- Best for.
- Coverage signal.
- Application channel.
- Risk note.

Example:

`CSC / Government`

- Best for: `strong academic profile, full-funding goal`
- Coverage: `often tuition + accommodation + stipend + insurance`
- Channel: `CSC or university route`
- Risk: `separate eligibility and quota rules`

This section should feel like a decision guide, not a marketing banner.

## 11. Scholarship Browser

The browser should use the Programs and Universities browse-first pattern.

Top utility row:

- Result count: `275 scholarships`
- Context: `Funding routes with type, coverage, deadline, and source status.`
- `All filters` button
- Sort select
- Optional view toggle: `Cards / Dense`

Visible chips:

- Full funding
- CSC
- University award
- Undergraduate
- Master
- Deadline open
- Verified source

Filters must exist but stay on demand:

- Funding level: all, full, partial, unknown.
- Type: CSC/government, university, provincial/city, language, partner/other.
- Degree level.
- Country/region eligibility.
- City/province.
- Deadline status.
- Coverage: tuition, stipend, accommodation, insurance.
- Source status: verified, needs check.

Do not show all filters permanently. Use a right drawer on desktop and bottom drawer on mobile, consistent with Programs.

## 12. Scholarship Card Model

Cards should be closer to Programs than Universities because scholarship items need text and facts more than photos.

Recommended card anatomy:

1. Top row:
   - Type badge: `CSC`, `University`, `Province`, `City`, `Partner`
   - Save icon
2. Title:
   - Scholarship name
3. Linked institution:
   - Single school or `Multiple universities`
4. Short summary:
   - One or two lines maximum.
5. Coverage chips:
   - Tuition
   - Stipend
   - Accommodation
   - Insurance
6. Fact strip:
   - Funding level
   - Degree fit
   - Deadline
   - Source status
7. Footer actions:
   - `View details`
   - `See matching programs`

Card rules:

- Equal card height within grid rows.
- Keep card radius at 8px or less.
- Avoid image thumbnails for every scholarship card.
- Use icons sparingly, only for type, coverage, and source.
- Source status must be visible without opening detail.

## 13. Dense View

Dense view is useful for adviser-like comparison but should not be the default.

Columns:

- Scholarship
- Type
- Coverage
- Degree
- Deadline
- Source
- Action

The dense view should remain clean and mobile should fall back to stacked rows.

## 14. Detail Preview Or Detail Page

The list page may include an in-page preview state later, but the final product should support `/scholarships/:slug`.

Detail page sections:

1. Back to Scholarships.
2. Header with title, type, funding level, source status.
3. Coverage overview.
4. Eligibility.
5. Applicable degree/program/country.
6. Required materials.
7. Application steps.
8. Linked universities/programs.
9. Official source.
10. Similar scholarships.

Important detail rule:

The official source and last verified date must be prominent. If source is missing or stale, show `Needs check` instead of pretending certainty.

## 15. Agent Interaction

The shared global composer must exist on this page.

Scholarship-specific Agent examples:

- `Find full scholarships for medicine without HSK`
- `Do I qualify for CSC as an undergraduate?`
- `Scholarships in Hangzhou for computer science`
- `Show me scholarships with stipend and open deadlines`
- `Compare CSC and university scholarships`

On send:

- Right Agent Workspace opens.
- Composer docks inside the panel bottom.
- The panel shows scholarship-specific workflow:
  - Read funding goal.
  - Identify scholarship route types.
  - Check eligibility signals.
  - Compare coverage and deadlines.
  - Suggest next page: Programs, Universities, or Scholarship detail.

Panel results may include buttons inside content:

- `Open matching scholarships`
- `See programs with scholarship signal`
- `Compare universities`

Avoid separate bottom action buttons in the panel footer. Results belong in the panel content.

## 16. Mobile Design

Mobile order:

1. Shared compact header.
2. H1 and short subtitle.
3. Funding intent input.
4. Horizontal route shortcuts.
5. Explanation band as swipeable or stacked compact rows.
6. Featured route summary.
7. Browser utility row.
8. Scholarship cards.
9. Pagination or load more.
10. Footer.

Mobile constraints:

- No permanent sidebars.
- Filter drawer opens from `All filters`.
- Cards show only essential facts:
  - title
  - type
  - linked school
  - funding level
  - deadline
  - source status
  - one primary action
- Global bottom composer must hide at footer bottom, same as Home/Programs behavior.

## 17. Content And Copy Standards

Use short, practical English.

Good:

- `Full funding route`
- `Coverage varies by notice`
- `Official source verified Jul 14`
- `Open to master applicants`
- `Needs deadline check`
- `See matching programs`

Avoid:

- `Guaranteed scholarship`
- `Best scholarship for everyone`
- `Apply now and win funding`
- `No requirements`
- `100% success`

When uncertain, say:

- `Needs check`
- `Confirm with official notice`
- `Deadline pending`
- `Coverage varies`

## 18. Mock Data Needed For Prototype

Use 10-12 curated scholarships, enough to test layout:

- Chinese Government Scholarship / CSC
- Zhejiang University Scholarship for International Students
- Shanghai Government Scholarship
- Beijing Government Scholarship
- Jiangsu Jasmine Scholarship
- Tianjin Government Scholarship
- Confucius Institute / International Chinese Language Teachers Scholarship
- ASEAN-China Young Leaders Scholarship
- University freshman scholarship
- Subject-specific engineering scholarship
- Partial tuition waiver route
- Deadline-pending route

Each mock item needs:

- id
- slug
- title
- type
- fundingLevel
- schoolName or schoolCount
- city/province if school-linked
- summary
- coverage benefits
- applicableDegree
- applicableProgram
- targetCountries
- deadline
- sourceStatus
- lastVerifiedAt
- sourceUrl label
- tags

## 19. Implementation Guidance

First implementation should be static and high-fidelity:

- Create `design-lab/scholarships.html`.
- Reuse `shared-shell.css` and `shared-shell.js`.
- Align page width, typography, nav, footer, Agent Composer, and drawer behavior with Home/Programs/Universities.
- Use inline mock data and local state.
- Add routes from shared nav and homepage/category links where needed.
- Do not publish unless explicitly requested.

Suggested page-level CSS structure:

- `.scholarship-page`
- `.scholarship-hero`
- `.funding-intent`
- `.funding-shortcuts`
- `.coverage-band`
- `.route-feature`
- `.scholarship-browser`
- `.scholarship-card-grid`
- `.scholarship-card`
- `.scholarship-drawer`

Before implementation QA:

- Desktop width around 1440/1920.
- Mobile around 390/430.
- Filter drawer open and closed.
- Agent panel open and collapsed.
- Footer no overlap with bottom composer.
- Cards equal-height and no text overflow.

## 20. Open Design Decisions

1. Whether the first version needs a separate Scholarship Detail page or only list/detail preview.
2. Whether scholarship comparison should be saved for later or included as a small compare drawer.
3. Whether country eligibility should be prominent on first version; useful, but may require better data quality.
4. Whether `CSC` deserves a dedicated route page immediately or only a featured route block.
5. Whether funding route recommendations should be explained in the Agent panel only, or also as visible interpreted chips on the page.

## 21. Initial Recommendation

Build the first Scholarships page as:

- A polished route-finder page.
- Browse-first directory below.
- On-demand filters.
- No permanent sidebar.
- No heavy images.
- Strong source and uncertainty signals.
- Shared global Agent behavior.

This will make the page consistent with the current CUAC system while giving scholarships their own product role instead of copying Programs or UCAS.
