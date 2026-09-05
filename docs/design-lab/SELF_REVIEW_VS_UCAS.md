# CUAC Design Lab Self Review Against UCAS

Date: 2026-08-12

Reviewed artifact:

- `design-lab/index.html`
- `design-lab/qa-home-v2.png`
- `design-lab/qa-search-v2.png`
- `design-lab/qa-mobile-v2.png`
- `design-lab/qa-states-v2.png`

UCAS references checked:

- UCAS home: https://www.ucas.com/
- UCAS course search: https://www.ucas.com/explore/search/courses-beta?query=computer%20science
- UCAS dates and deadlines: https://www.ucas.com/applying/applying-to-university/dates-and-deadlines-for-uni-applications

## 1. Brutal Self Assessment Of v1

The first Design Lab version was better than the deployed frontend, but it was still not mature enough.

Main failures:

- It had search and fields, but still felt like a composed demo screen rather than a real admissions product.
- Home was cleaner than before, but the search gateway did not have enough UCAS-like hierarchy.
- Program Search had comparable fields, but it lacked the strong course-search operating rhythm: tabs, result count, page count, active filters, sort, view mode, and a clear filter taxonomy.
- The right compare panel was useful but looked like an add-on, not part of a full application decision flow.
- Mobile was serviceable, but not enough like a deliberately designed mobile search experience.
- Visual trust was not bad, but it still leaned on generic cards and did not have enough editorial/product specificity.

Verdict:

v1 should not be migrated into the production React frontend.

## 2. UCAS Patterns Used In v2

### Home

UCAS home leads with a clear search proposition, a broad search input, and category routes such as Courses, Uni & Colleges, Scholarships, Events, Subject guides, Career guides, and City guides.

CUAC v2 adaptation:

- Home now leads with `Choose China programs you can actually apply for`.
- Search is the dominant first action.
- Browse categories are visible in the first viewport.
- Categories are adapted to China admissions:
  - Courses
  - Universities
  - Scholarships
  - Deadlines
  - City guides
  - English-taught
  - Late intake
  - Documents

### Course Search

UCAS course search shows a search field, result count, page count, sort, grid/list toggle, and a detailed filter system.

CUAC v2 adaptation:

- Program Search now has:
  - All programs / For you / Saved / Choices / Deadlines tabs.
  - Search input.
  - Sort control.
  - List/grid toggle.
  - Result count and page count.
  - Active chips.
  - Structured filters.
  - Dense program cards.

### Filters

UCAS filters by course type/year, vacancies, start date, study mode, qualifications, university/college, subject, duration, country, region, entry requirements, and entry point.

CUAC v2 adaptation:

- Course type and year.
- Degree level.
- Study language.
- Scholarship.
- HSK/English-first fit.
- Verified source.
- Document-light.
- City and budget.

### Deadlines

UCAS deadline pages use exact dates and explain what each date means.

CUAC v2 adaptation:

- Home now includes a cycle strip and mini deadline timeline.
- Program Search right rail exposes `Next deadline`.
- Program cards show exact dates instead of vague urgency alone.

## 3. v2 Scorecard Self Rating

Update after local browser QA:

- The earlier screenshot process was invalid for `#program-search-v2` and `#mobile-search-v2`; both captures were blank because the target board was not isolated.
- `index.html` now supports capture mode through `?view=home-v2`, `?view=program-search-v2`, `?view=mobile-search-v2`, and `?view=states-v2`.
- A fourth `States v2` board now covers empty results, saved/compared/in-choice/disabled actions, long-name stress, mobile filter drawer, and restrained motion rules.
- Browser screenshots were regenerated locally on 2026-08-12 and checked visually.

Scale: 1-5.

| Criterion | Score | Reason |
| --- | ---: | --- |
| First impression trust | 4 | More search-led, better hierarchy, less demo dashboard. Still needs final brand refinement and approved real imagery. |
| Search entry clarity | 5 | Search is the dominant first action on Home and Search. |
| Information density | 4 | Program rows expose comparable fields and now match a UCAS-style list/search rhythm. Could still improve with real pagination behavior. |
| Program card scanability | 4 | Fixed fact table is much better. Long-name stress was added and overflow issues were corrected. |
| Filter usefulness | 4 | Filters now map to real China application choices. Tuition slider is still illustrative. |
| Color maturity | 4 | Palette is controlled and not one-note. Some yellow/gold usage should be checked visually. |
| Typography hierarchy | 4 | Browser QA confirms no major overlap. Home hero was reduced to feel less heavy. |
| Mobile usability | 4 | Mobile search feels intentional and a bottom-sheet filter pattern is now specified. Needs interactive implementation test for sticky tray overlap. |
| Interaction readiness | 4 | Empty, saved, compared, in-choice, blocked, drawer, and motion examples now exist. Program Detail and Hub interactions are still missing. |
| High school student fit | 4 | Clear, practical, not childish. Could use slightly warmer microcopy. |

Average:

```txt
4.3 / 5
```

Migration verdict:

```txt
Good enough to use as the visual and interaction base for the next React frontend pass.
Do not publish. Do not call it complete until Program Detail and Hub receive the same treatment.
```

## 4. Remaining Problems Before React Migration

Fixed in this pass:

- Browser screenshot QA via isolated capture mode.
- Real empty state example.
- Selected/saved/compared/in-choice/disabled button state examples.
- Long-name stress test and overflow correction.
- Mobile filter drawer design.

Still needed before calling the whole frontend design production-complete:

- Some city imagery is sourced from remote photo URLs and must be replaced with final approved assets or removed before production.
- Need a Program Detail v2 static design before production migration.
- Need Hub v2 static design before production migration.
- Need a real interaction prototype for chip removal, filter drawer open/close, saved/compared/choice state changes, search loading, and empty-state recovery.
- Need final copy pass for high school students and parents.
- Need accessibility pass for contrast, focus states, keyboard order, and reduced motion.

## 5. Decision

The current Design Lab direction is materially closer to UCAS and materially more mature than the first deployed frontend.

It is now a credible base for frontend implementation, but not yet a complete product design. The next design step should be:

1. Program Detail v2.
2. Hub v2.
3. Real interactive prototype behavior.
4. React migration only after the user accepts the visual direction.
