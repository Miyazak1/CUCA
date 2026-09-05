# CUAC Universities Page Design Spec

Date: 2026-08-12

Status: planning document before implementation. Do not publish or deploy.

Target page:

- `/universities`
- Working prototype file later: `design-lab/universities.html`

## 1. Core Judgment

The Universities page should learn from UCAS's provider search discipline, not copy its visual identity.

UCAS does well because it gives students a stable search page: title, search bar, result count, filters, sort, grid/list toggle, favourites, and a large scannable provider grid. CUAC should keep that level of clarity, but adapt the page for international students choosing Chinese universities.

The CUAC Universities page is not a generic school directory. Its job is to help a student answer:

1. Which Chinese universities are relevant to my subject and degree level?
2. Which cities fit my budget and lifestyle?
3. Which universities have English-taught or international-friendly routes?
4. Which schools have scholarship or late-intake signals?
5. Which university pages have clear, verified admissions information?
6. Which universities should I save or compare before checking programs?

## 2. Relationship To Home V3

The page must share the same design language as `design-lab/home-v3.html`:

- Warm paper background.
- Deep green CUAC identity.
- 8px image/card radius.
- 6px control radius.
- Linear, no-background icons.
- Search-first page structure.
- Short practical copy.
- Restrained hover and focus motion.
- Wide desktop content area.
- Mobile 16px side padding.

It should not introduce a new color system, new rounded card style, or dashboard aesthetic.

## 3. Page Role

Primary role:

`Search and compare Chinese universities before choosing programs.`

Secondary role:

`Help students understand city, language, scholarship, and admissions clarity differences.`

This page sits between Home and Program Search:

- Home gets the student into discovery.
- Universities helps them shortlist institutions and cities.
- Program Search helps them compare actual programs.
- University Detail can later show full profile, campuses, programs, fees, deadlines, and source status.

## 4. What To Borrow From UCAS

Borrow:

- Clear page title and subtitle.
- Search bar directly under the title.
- Results count.
- Sort control.
- Grid/list toggle.
- Filter chips/dropdowns.
- Favourite/save action.
- Consistent repeated provider cards.
- Pagination or progressive loading.
- Full footer.

Do not borrow:

- UCAS blue search band.
- UK provider card content model.
- Large ad gaps.
- Exact spacing, navigation labels, or footer layout.
- UK-specific filters such as UK region/residence/tariff.

## 5. Information Architecture

Top shell:

- Same CUAC logo and nav language as Home V3.
- Nav: Programs, Universities, Scholarships, Cities, Guides.
- Right action: Saved list.

Page header:

- Small accent rule or label: `Universities & colleges`
- H1: `Find Chinese universities that fit`
- Subtitle: `Search by city, subject strength, language route, scholarship signal, and admissions clarity.`

Search band:

- Large search input: `Search universities, cities, or subjects`
- Button: `Search`
- Suggested chips:
  - English-taught routes
  - Scholarship signal
  - Affordable cities
  - Engineering
  - Medicine
  - Business

Results utility row:

- Back/search-all link if coming from filtered state.
- Result count: `128 universities`
- Active filters.
- Sort: Relevance, City cost, Scholarship signal, International routes, Recently verified.
- View toggle: Grid / List.

Filter row:

- All filters
- City / Province
- Degree level
- Subject area
- Teaching language
- Tuition range
- Scholarship
- Intake
- Source status

Results area:

- Featured university rail or first-row cards.
- Main grid of university cards.
- Optional list view for denser comparison.
- Pagination or `Load more`.

Footer:

- Same footer model as Home V3.

## 6. Desktop Layout

Recommended desktop structure:

1. Top note.
2. Header nav.
3. Page title block.
4. Search band.
5. Result summary and view controls.
6. Filter bar.
7. Optional selected filter chips.
8. Results grid.
9. Pagination.
10. Footer.

Content width:

- Use the same `--page-width` as Home V3.
- Keep inner horizontal padding using `--section-x`.
- Results grid should feel wide and open, similar in confidence to UCAS, but with CUAC colors and rhythm.

Grid:

- Desktop: 4 columns.
- Medium desktop/tablet: 3 or 2 columns.
- Mobile: 1 column.

Avoid making every surrounding section a card. The page should be a search result surface, not a collection of floating panels.

## 7. Mobile Layout

Mobile must not be a squeezed desktop grid.

Mobile order:

1. Compact top note.
2. Logo row. Hide desktop nav, keep Saved list hidden or in menu later.
3. H1 and subtitle.
4. Search input and Search button stacked.
5. Horizontal chips.
6. Sticky compact result controls:
   - Filter
   - Sort
   - View
7. One-column university cards.
8. Load more.
9. Footer.

Mobile card must show only the most decision-critical fields:

- Image.
- University name.
- City.
- Key tags: English routes, Scholarship, Verified, Affordable city.
- Two facts: `Programs`, `Tuition from`, or `International routes`.
- Save action.

Extra detail should open in a drawer or detail page later.

## 8. University Card Model

Grid card should include:

- Campus/city image.
- Save heart.
- Optional `Featured` or `Verified` badge.
- University name.
- City and province.
- Three compact signals:
  - `English routes`
  - `Scholarships`
  - `Verified admissions`
- Short practical note:
  - `Strong for engineering and computer science.`
  - `Lower living cost than Shanghai.`
  - `Scholarship route available for selected programs.`
- Footer row:
  - `View programs`
  - `Compare`

Do not overload the card with rankings, marketing slogans, or long descriptions.

List view should include denser comparison fields:

- University.
- City/province.
- Subject strengths.
- English-taught program count.
- Tuition range.
- Scholarship signal.
- Intake availability.
- Source status.
- Actions.

## 9. Filters

Filters must reflect China-study decisions, not UCAS UK categories.

Required filters:

- City / Province:
  - Beijing, Shanghai, Hangzhou, Nanjing, Guangzhou, Shenzhen, Chengdu, Wuhan, Xi'an.
- Subject area:
  - Engineering, Computer Science, Business, Economics, Medicine, Chinese Language, Design, International Relations.
- Degree level:
  - Undergraduate, Master, PhD, Language program.
- Teaching language:
  - English-taught, Chinese-taught, Bilingual.
- Tuition range:
  - Under RMB 25k, 25k-40k, 40k-60k, 60k+.
- Scholarship:
  - Any scholarship signal, CSC, provincial, university, partial award.
- Intake:
  - Fall 2026, Spring 2027, Late intake.
- Source status:
  - Verified, recently checked, estimate, pending confirmation.

Filter behavior:

- Applying a filter updates count and active chips.
- Active chips appear below filter row.
- Reset filters is visible but visually secondary.
- On mobile, filters open as a bottom sheet or full-screen drawer later.

## 10. Interactions

Search:

- Input focus uses Home V3 search focus shadow.
- Search can accept university name, city, or subject.
- Empty query shows all universities.

Card:

- Image scales subtly on hover.
- Save heart changes state.
- `View programs` leads to Program Search filtered by university.
- `Compare` adds the university to a compare tray later.

Controls:

- Grid/list toggle is segmented and icon-led.
- Sort is a compact select.
- Filters use dropdown buttons on desktop.
- Mobile uses one `Filters` button.

Motion:

- Keep motion restrained.
- Hover lift no more than 1-2px.
- No looping decorative animation.
- Results may fade in after filter changes, but no layout jumping.

## 11. States

Required front-end states:

- Default all universities.
- Search results.
- Filtered results.
- No results.
- Loading skeleton.
- Saved card.
- Featured card.
- Stale or unverified source.
- Mobile filter drawer placeholder.
- List view.

No-results copy:

`No universities match these filters yet. Try removing one filter or search by city.`

Stale-source copy:

`Admissions details need confirmation before applying.`

## 12. Visual Rules

Use:

- Warm page background from Home V3.
- White/paper search surface.
- Green primary action.
- Muted green-gray icons.
- Yellow only for deadline or warning signals.
- Minimal badges.
- Strong images, but not dark or overly blurred.

Avoid:

- UCAS blue bands.
- Too many badges on cards.
- Thick card borders.
- Large dashboard panels.
- Marketing copy.
- Over-rounded cards.
- Card inside card layouts.

## 13. Sample Content

Initial universities for prototype:

- Zhejiang University
  - Hangzhou
  - English routes, research city, verified admissions.
- Tsinghua University
  - Beijing
  - Engineering, high selectivity, scholarship signal.
- Fudan University
  - Shanghai
  - Business and sciences, scholarships, higher city cost.
- Tongji University
  - Shanghai
  - Architecture and engineering, English routes.
- Nanjing University
  - Nanjing
  - Science and humanities, lower cost than Shanghai.
- Wuhan University
  - Wuhan
  - Campus life, medicine and engineering.
- Xi'an Jiaotong University
  - Xi'an
  - Engineering, affordable city, strong research.
- Sun Yat-sen University
  - Guangzhou
  - Medicine, business, southern China.

## 14. Implementation Plan

Phase 1: static design prototype

- Create `design-lab/universities.html`.
- Reuse Home V3 tokens and nav/footer styling.
- Build desktop grid view first.
- Build mobile one-column view.
- Include mock filtering UI without real data logic.
- Include saved state examples.
- Generate desktop/mobile QA screenshots.

Phase 2: interaction prototype

- Add mock search filtering.
- Add active chips.
- Add grid/list toggle.
- Add save/unsave state.
- Add empty and loading states.

Phase 3: migration preparation

- Extract reusable components:
  - Shell/nav.
  - Search bar.
  - Filter bar.
  - University card.
  - Result controls.
  - Footer.
- Map mock data to `CUAC_FRONTEND_MOCK_DATA_CONTRACT.md`.

## 15. Acceptance Criteria

Before implementation is considered successful:

- The page feels clearly related to Home V3.
- It does not look like a UCAS copy.
- A student can understand the page purpose in 5 seconds.
- University cards help compare real choices, not just school branding.
- Desktop grid is scannable.
- Mobile layout is not cramped.
- Filters are China-study specific.
- No backend or database assumptions are required.
- No publishing or deployment occurs unless explicitly requested.
