# CUAC Frontend Demo Review Scorecard

Date: 2026-08-12

Purpose: evaluate the current official static frontend demo before backend implementation tickets begin.

Scoring: 1-5 for each item.

- 1 = poor / demo-like
- 2 = weak
- 3 = acceptable foundation
- 4 = strong
- 5 = production-quality

Minimum frontend-stage cutoff bar:

- No item below 3.
- Average score at least 4.
- Program Search information density at least 4.
- Mobile usability at least 4.

## 1. First Impression Trust

Question:

Does the page feel like a serious student admissions product within 5 seconds?

Check:

- It does not look like a generic template.
- Brand is visible but not oversized.
- Typography feels deliberate.
- The first viewport is not empty.

Score:

```txt
1 2 3 4 5
Notes:
```

## 2. Search Entry Clarity

Question:

Can a student immediately tell how to search for programs?

Check:

- Search input is visually dominant.
- Placeholder/example text is concrete.
- Browse categories are visible.
- Empty search behavior is defined.

Score:

```txt
1 2 3 4 5
Notes:
```

## 3. Information Density

Question:

Does the page expose enough useful information without overwhelming the user?

Check:

- Program rows show deadline, tuition, language, degree, duration, source, documents, and scholarship.
- Hub/continuation content is secondary but useful.
- Cards are not decorative filler.

Score:

```txt
1 2 3 4 5
Notes:
```

## 4. Program Card Scanability

Question:

Can a student compare programs quickly from the list?

Check:

- Fields appear in a consistent order.
- Key numbers stand out.
- Badges are meaningful.
- Actions are easy to find.

Score:

```txt
1 2 3 4 5
Notes:
```

## 5. Filter Usefulness

Question:

Do filters match real China application decisions?

Check:

- Degree, subject, language, intake, city, tuition, scholarship, deadline, documents, source, and late intake are represented.
- Active chips are visible.
- Reset/relax behavior is present.

Score:

```txt
1 2 3 4 5
Notes:
```

## 6. Color Maturity

Question:

Does the palette feel young and trustworthy rather than cheap or monotonous?

Check:

- White/grey base dominates.
- Teal is identity, blue is action.
- Amber/red/green/gold are status-specific.
- No decorative blobs or excessive gradients.

Score:

```txt
1 2 3 4 5
Notes:
```

## 7. Typography Hierarchy

Question:

Does text hierarchy guide the eye naturally?

Check:

- H1 is strong but not wasteful.
- Result row titles are readable.
- Metadata is compact.
- Long text does not overflow.

Score:

```txt
1 2 3 4 5
Notes:
```

## 8. Mobile Usability

Question:

Does mobile feel intentionally designed, not just squeezed down?

Check:

- Search is visible first.
- Filter and sort are easy to reach.
- Program cards remain scannable.
- Sticky tray does not cover actions.

Score:

```txt
1 2 3 4 5
Notes:
```

## 9. Interaction Readiness

Question:

Are interactive states obvious enough to implement?

Check:

- Save, compare, and add-to-choice states are shown.
- Filter chips and drawer behavior are implied.
- Pending/success states can be added without layout jump.
- Disabled reasons have a place to appear.

Score:

```txt
1 2 3 4 5
Notes:
```

## 10. High School Student Fit

Question:

Would a 16-20 year old international student understand and trust it?

Check:

- Language is direct.
- It avoids official jargon.
- It shows costs, deadlines, and documents clearly.
- It feels helpful without being childish.

Score:

```txt
1 2 3 4 5
Notes:
```

## Overall Verdict

```txt
Average score:
Ready to migrate to React? Yes / No
Required changes before migration:
```

## Current Review - 2026-08-22

Scope reviewed:

- Official demo routes listed in `README.md`, including public catalog pages, detail pages, Auth, Onboarding, Hub, Application, Billing, School Portal, School Settings, Ops Admin, Notifications, Favourites, and Preferences.
- Archived `index.html` and `home-v5.html` are not current UX evidence.

Evidence:

- `npm.cmd test -- --runInBand`: passed 12/12.
- `npm.cmd run qa:flows`: passed.
- `npm.cmd run qa:layout`: passed.
- Completion audit route scope and frontend-only cutoff ledger are current.

Scores:

| Item | Score | Notes |
| --- | ---: | --- |
| First Impression Trust | 4 | Current pages feel product-like rather than generic; school/Ops surfaces are clearly role-specific. |
| Search Entry Clarity | 4 | Public discovery starts from concrete search and route context; catalog pages expose useful filters. |
| Information Density | 4 | Programs, schools, scholarships, cities, application, and school portal expose useful fields without raw model-key reading. |
| Program Card Scanability | 4 | Card action pattern is unified and guarded against overflow; compare/detail actions are clear. |
| Filter Usefulness | 4 | Program pagination, filters, and route parameters are covered; fields map to China application decisions. |
| Color Maturity | 4 | Palette is restrained and consistent across public, student, school, and Ops surfaces. |
| Typography Hierarchy | 4 | Titles, metadata, cards, forms, and dense panels pass desktop/mobile layout QA. |
| Mobile Usability | 4 | Layout QA covers mobile catalog buttons, details, Auth, Application modal, school portal, and Agent panel. |
| Interaction Readiness | 5 | Auth continuation, Agent actions, payment simulation, consent blocking, school handoff, tenant export, and status updates pass browser QA. |
| High School Student Fit | 4 | Public pages avoid internal source-quality badges and raw model keys; copy emphasizes costs, deadlines, documents, and concrete choices. |

```txt
Average score: 4.1
Ready to start backend handoff tickets? Yes, if stakeholder visual review accepts the current look.
Required changes before backend implementation: no known blocker from automated frontend QA. Continue only targeted visual polish if stakeholder review finds a specific issue.
```
