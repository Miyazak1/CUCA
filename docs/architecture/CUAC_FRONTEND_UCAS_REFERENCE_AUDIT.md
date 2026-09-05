# CUAC Frontend UCAS Reference Audit

Date: 2026-08-12

Purpose: record what CUAC should learn from UCAS before the next frontend redesign. This is not a request to copy UCAS styling. The goal is to borrow the product discipline: clear entry points, dense searchable course information, trustworthy decision fields, and an application flow students can understand without explanation.

Reference pages reviewed:

- UCAS home: https://www.ucas.com/
- UCAS course search beta: https://www.ucas.com/explore/search/courses-beta?query=computer%20science
- UCAS course display: https://digital.ucas.com/coursedisplay
- UCAS dates and deadlines: https://www.ucas.com/applying/applying-to-university/dates-and-deadlines-for-uni-applications

## 1. Executive Finding

The current CUAC frontend direction is too dashboard-led and not enough search-led. It looks like a demo workspace before it behaves like a serious admissions product.

UCAS succeeds because it treats the student journey as:

1. Search broadly.
2. Browse by familiar categories.
3. Filter and compare real course options.
4. Save favourites.
5. Track application tasks and deadlines.

CUAC should follow the same product order, adapted for China applications:

1. Search programs.
2. Browse by degree, subject, city, scholarship, language, deadline, and intake.
3. Filter dense program results.
4. Save, compare, and add programs to choices.
5. Prepare documents and request adviser review.

## 2. What UCAS Does Well

### 2.1 Homepage As Search Gateway

UCAS home leads with a clear future-oriented proposition and a large search field. It also immediately provides category shortcuts such as courses, universities and colleges, scholarships, apprenticeships, events, subject guides, career guides, and city guides.

CUAC implication:

- Home must not be a generic product dashboard.
- The first viewport must be a search gateway.
- The search entry should be supported by concrete browse categories.
- Returning-student Hub access is important but secondary to the main search gateway.

### 2.2 Information Architecture Before Decoration

UCAS navigation separates audiences and tasks. Students, providers, advisers, and businesses are not blended into one confusing surface. Student-facing pages are organized around Discover, Applying, Money and student life, and International.

CUAC implication:

- Student-facing navigation should stay narrow in this frontend phase.
- Adviser/provider/admin concepts must not leak into primary nav.
- CUAC's student IA should be:
  - Search
  - Universities
  - Scholarships
  - Deadlines
  - China Guides
  - Hub

### 2.3 Course Results Are Dense And Field-Based

UCAS course results show course title, provider, campus, qualification, duration, study mode, start date, tariff or entry requirement signal, and related options. The result page also supports filters, sort, list/grid display, and favourites.

CUAC implication:

- Program rows must be information-dense.
- Each row should show the same fields in the same order.
- CUAC-specific fields should include tuition, teaching language, scholarship, deadline, document burden, and source status.
- Cards should be designed for scanning and comparison, not storytelling.

### 2.4 Filters Are A Primary Product Surface

UCAS puts filters close to the results and includes course type/year, vacancies, residence, start date, study mode, qualifications, and provider.

CUAC implication:

- Filters cannot be a decorative side panel.
- Filters must be designed as the main decision instrument.
- CUAC filters should include:
  - Degree level
  - Subject
  - Teaching language
  - Intake year/term
  - City/province
  - Tuition range
  - Scholarship
  - Deadline status
  - Document burden
  - HSK/English test requirement
  - Late intake
  - Source verification

### 2.5 Deadlines Are Concrete

UCAS deadline content uses specific dates and explains what each date means. The deadline page makes the admissions cycle legible instead of hiding it inside generic alerts.

CUAC implication:

- CUAC should have a visible deadline system, not only warning chips.
- Deadline states need exact dates and action meaning.
- Hub should include a timeline of upcoming application and scholarship deadlines.
- Search should support deadline status filters.

### 2.6 Familiar Actions Build Trust

UCAS uses familiar actions such as search, favourites, apply/log in, and course comparison. The interface is not trying to impress; it is trying to help students decide.

CUAC implication:

- CUAC should prioritize:
  - Save
  - Compare
  - Add to choices
  - Open application
  - Prepare documents
  - Request adviser review
- Avoid vague CTAs such as "Explore your path" or "Start journey" in core flows.

## 3. What CUAC Should Not Copy

CUAC should not blindly copy UCAS.

Do not copy:

- UK-specific tariff language.
- UK residence filters.
- Apprenticeship-first taxonomy.
- Ad-heavy page structure.
- Institutional density that feels overwhelming for international high school students.
- Long official guidance pages as the first interaction.

CUAC must adapt for:

- International students applying to China.
- English and later bilingual UI.
- Tuition in RMB.
- Scholarship uncertainty.
- Document translation and notarization.
- HSK/English-test requirements.
- City living cost and student-life comparison.
- Adviser review as a service layer.

## 4. CUAC Design Corrections

### 4.1 Product Positioning

Old direction:

`Calm Application Workspace`

Issue:

- Too internal and workspace-heavy.
- Makes the product feel like a dashboard before students know what they are searching for.

Updated direction:

`Find, compare, and prepare China university applications.`

Supporting phrase:

`Search programs, check deadlines and documents, then build a review-ready application packet.`

### 4.2 Homepage Correction

Home must become:

- A search-first discovery page.
- A browse-by-category page.
- A returning-student continuation surface.

Home must not become:

- A hero dashboard.
- A marketing landing page.
- A generic three-card overview.

### 4.3 Search Page Correction

Program Search is the product's main page. It should receive the most design attention.

Required:

- Search field and result count above results.
- Persistent filters.
- Active filter chips.
- Sort and list/grid toggle.
- Dense program rows.
- Save/compare/add actions.
- Compare/choice tray.
- Clear empty and loading states.

### 4.4 Hub Correction

Hub should not be a statistics dashboard. It is a task cockpit.

Required:

- One next action.
- Active choices.
- Missing documents.
- Deadline timeline.
- Adviser review status.
- Messages/tasks.

### 4.5 Visual Correction

CUAC should feel young through clarity, speed, and small moments of progress, not through decorative gradients.

Use:

- Bright but restrained blue-green identity.
- White and soft grey surfaces.
- Strong text hierarchy.
- Real school/program/city imagery where relevant.
- Small status color accents.
- Motion tied to feedback.

Avoid:

- Empty hero space.
- Generic dashboard mockups.
- Nested cards.
- One-note teal screens.
- Fake "application radar" widgets that do not map to user decisions.

## 5. Updated Page Priority

Implementation priority should change:

1. Home search gateway.
2. Program Search as dense decision workbench.
3. Program Detail with application readiness.
4. Hub task cockpit.
5. Application Builder.

If time is constrained, Program Search should receive more polish than decorative Home sections.

## 6. Acceptance Criteria From UCAS Audit

The next CUAC frontend is acceptable only when:

- A student can understand the main search action within 5 seconds.
- Program Search feels like the core product, not a secondary page.
- Program rows expose comparable fields without opening detail.
- Filters are useful enough to narrow decisions.
- Deadlines are exact and visible.
- Save, compare, and choices are obvious.
- Hub answers "What should I do next?"
- Visual style is clean, youthful, and trustworthy without feeling like a template.

