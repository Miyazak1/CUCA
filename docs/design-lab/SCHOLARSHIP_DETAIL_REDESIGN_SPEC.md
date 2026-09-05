# CUAC Scholarship Detail Information Design Spec

Date: 2026-09-03

Scope: `design-lab/scholarship-detail.html` and the shared detail-rendering pieces it uses in `completion.js`, `completion.css`, and `cuac-data.js`.

This is a frontend-demo design specification. It does not add real backend, payment, authentication, file upload, or production Agent behavior.

## 1. Core Correction

The problem is not mainly whether sections are collapsed.

The problem is how scholarship information is organized, prioritized, and displayed so a student can understand it without being hit by a wall of fields.

Collapse can help with long reference material, but it is only a length-control tool. It cannot be the main hierarchy strategy. The page must feel clear even when the key information is visible.

Design goal:

Make the scholarship page read like a clean scholarship record with a small action sidebar, not a workflow dashboard or database record.

The student should understand:

1. What this scholarship is.
2. Whether it fits their route.
3. Which school or program it can connect to.
4. What needs checking before relying on it.
5. What to do next.

## 2. Product Context

CUAC helps international students turn China-study interest into an application route: school, program, funding, documents, payment, and school handoff.

The scholarship detail page has one job:

Help the student decide whether this funding route is useful for a real school-program choice.

It should not feel like:

- an internal admin record,
- an official notice dump,
- a generic article page,
- or a stack of visually identical cards.

## 3. Target Users

Primary user:

- International high-school or undergraduate applicant, usually 16-24.
- May be comparing China with other study destinations.
- Cares first about money, degree fit, deadline, provider, and next action.
- Does not want to read every official-note field before knowing whether the route matters.

Secondary users:

- Parent or adviser checking cost and risk.
- CUAC operator checking whether the page guides the right behavior.

The page should feel serious, calm, readable, and supportive.

## 4. Current Problem Diagnosis

The current page contains useful facts, but the information hierarchy is weak.

Observed issues:

- Primary facts repeat in multiple places: funding level, deadline, degree, provider.
- Too many small labels compete with the actual content.
- Many cards have similar size, border, tone, and weight, so the eye cannot tell what matters.
- Supporting explanation appears before the user has made the basic relevance decision.
- The side rail repeats facts instead of guiding action.
- Some components solve density by adding more boxes, which makes the page more fragmented.
- The page looks assembled from modules instead of designed around a reading path.

Main design failure:

The student must constantly decide what matters. The interface should do that work.

## 5. Information Principle

Use this rule for every section:

One section answers one student question.

Do not group fields by backend model shape. Group them by the student decision they support.

### Required Reading Path

```txt
Identity
  What scholarship am I looking at?

Decision summary
  Is the money, deadline, degree, and provider relevant?

Fit
  Can I plausibly use this scholarship?

Match
  Which school/program route could it attach to?

Prepare
  What would I need only if I continue?

Evidence
  Where do I verify official wording?

Next action
  What should I do now?
```

This path matters more than whether a section is open or closed.

## 6. Field Hierarchy

### Level 1: Decision Identity

Show once, near the top.

| Field | Display role |
| --- | --- |
| Scholarship title | H1 |
| One-line meaning | Subtitle |
| Funding level | Primary fact |
| Deadline | Primary fact |
| Degree scope | Primary fact |
| Provider | Primary fact |
| Main action | Primary button |

Rules:

- These facts must not be repeated as equal-weight cards later.
- The H1 identifies the scholarship; it should not consume the whole first viewport.
- The subtitle should explain value in one sentence, not restate the title.

### Level 2: Decision Modules

Visible in the main body because they directly affect the decision.

| Module | Student question | Best display |
| --- | --- | --- |
| Fit | Can I use it? | Two-lane comparison: coverage and eligibility |
| Match | Where can it apply? | Relationship rows for schools and programs |
| Deadline / process | What timing risk exists? | Timeline or compact step rows |

Rules:

- Use visual grouping, not long paragraphs.
- Use icons to mark information type.
- Use rows and dividers before adding more cards.

### Level 3: Supporting Details

Present, but visually quieter.

| Content | Best display |
| --- | --- |
| Materials | Checklist table: document, why, when |
| Process steps | Numbered task rows only if order matters |
| Scope notes | Short note inside the relevant module |
| Related route caveats | Inline warning row |

Rules:

- Do not make each supporting fact a separate mini-card.
- Avoid paragraph blocks unless the official wording truly needs it.

### Level 4: Evidence

Available for verification, not competing with decision content.

| Content | Best display |
| --- | --- |
| Official source link | Evidence/action row |
| Notice summary | Short source note |
| Full official wording | Reference block, expandable only if long |
| Contact/source lineage | Reference area |

Rules:

- Evidence is important, but it is not the first thing a student should parse.
- Do not expose raw model paths or backend source labels in the student UI.

## 7. Display Pattern Library

Use these patterns instead of repeatedly inventing new cards.

### Hero Identity Block

Purpose:

Orient the student.

Structure:

```txt
Back link
Page type
Scholarship title
One-line summary
Primary action + secondary action
```

Avoid:

- multiple status pills,
- decorative hero cards with repeated facts,
- overly large empty space.

### Decision Fact Rail

Purpose:

Show only the three facts students check first.

Items:

- Funding
- Degree
- Deadline

Format:

```txt
Funding   Partial
Degree    Bachelor / Master
Deadline  Oct 15
```

Rules:

- One value per fact.
- Short labels only.
- No paragraphs inside the rail.
- Do not use icons unless they clearly reduce reading load.
- Provider belongs in the record details or side facts, not the primary fact rail.

### Fit Lanes

Purpose:

Separate money from eligibility.

Structure:

```txt
Money and coverage              Eligibility
Tuition waiver                  Degree scope
Merit review                    Who should check this
Coverage caveat                 Application channel
```

Rules:

- Two lanes on desktop, stacked on mobile.
- Warm tint for money, neutral or teal tint for eligibility.
- Short row titles and one-line explanations.

### Match Rows

Purpose:

Connect the scholarship to real application choices.

Structure:

```txt
School row     Zhejiang University       View school
Program row    Computer Science MSc      View program
Program row    Biomedical Engineering    View program
```

Rules:

- Relationship rows are better than big cards here.
- Actions align right.
- The row title is the object name; metadata stays secondary.

### Document Matrix

Purpose:

Make preparation readable without dumping text.

Structure:

```txt
Document                  Why it matters                    When
Official scholarship form  Confirms route requirement         After program match
Transcript / study record  Needed if school asks              After school check
Passport copy              Identity document                  After route is useful
```

Rules:

- This is clearer than three tiny cards with long text.
- Each row has one job.
- Use icons only for document type, not decoration.

### Evidence Block

Purpose:

Give confidence and verification path.

Structure:

```txt
Official notice     Open source
Last checked        Demo value if available
Source note         One sentence max
```

Rules:

- Evidence should be calm and lower-density.
- Long official content can be expandable, but only because it is long.

### Side Action Rail

Purpose:

Tell the student what to do next.

Allowed:

- Decision progress.
- One primary action.
- Short checklist.
- What happens next.

Not allowed:

- Repeating the hero facts.
- Multiple panels saying the same thing.
- Long explanatory text.

## 8. Page Layout

### Desktop

```txt
------------------------------------------------------------
Hero identity                              Compact status card
------------------------------------------------------------
Decision fact rail: Funding | Deadline | Degree | Provider
------------------------------------------------------------
Main column                              Side action rail
  Fit lanes                              Progress
  Match rows                             Primary action
  Timing/process                         Checklist
  Prepare matrix                         Next steps
  Evidence block
------------------------------------------------------------
Footer
```

Layout rules:

- Use one consistent content width across the page.
- Main column carries information; side rail carries action.
- Section gaps should create rhythm: 20-28px between major sections.
- Inside a section, use 12-16px spacing and clear dividers.
- Avoid nested cards inside cards.

### Mobile

```txt
Hero
Actions
Decision facts as rows
Fit lanes stacked
Match rows
Side actions converted to normal sections
Prepare matrix
Evidence block
Footer
```

Mobile rules:

- No horizontal overflow.
- The first screen should show title, summary, and at least part of the decision facts.
- Primary action appears before long supporting details.
- Rows may stack, but labels and values must remain aligned.

## 9. Visual Hierarchy Rules

Typography:

- H1: route identity only.
- H2: major student question.
- Eyebrow: category label, not decoration.
- Body text: one sentence where possible.
- Metadata: smaller and quieter than decision content.

Color:

- Deep green for identity and primary actions.
- Teal tint for confirmed/usable states.
- Warm yellow only for deadline, funding caution, or review-needed states.
- Avoid turning every field into a colored pill.

Surfaces:

- Use section backgrounds for major conceptual groups.
- Use rows for related facts.
- Use cards only for objects that can be compared: schools, programs, scholarships.
- If everything is a card, nothing is important.

Spacing:

- Major sections need breathing room.
- Dense rows need stronger left alignment and consistent right actions.
- Button labels must be vertically and horizontally centered.
- Actions in repeated rows must share the same width and alignment.

Icon use:

- Icons identify fact type: money, calendar, degree, school, document, source.
- Icons should replace some text burden, not add decoration.

## 10. Content Rules

Use short, student-facing headings:

- `Funding fit`
- `Can I use it?`
- `Where it connects`
- `What to prepare`
- `Verify source`
- `Next step`

Avoid vague or system-heavy language:

- `Use this as planning information`
- `This route deserves deeper checks`
- `Apply and verify`
- `Funding route review`
- `Source quality`

Copy standard:

- If text explains backend logic, remove it from the main UI.
- If a sentence repeats a fact already visible, delete it.
- If a label needs a second label to explain it, rename it.

## 11. CSCAlite Alignment

Keep these concepts in the student UI:

- Provider.
- Funding / coverage.
- Degree scope.
- Application window / deadline.
- Eligibility.
- Materials.
- Official source.
- Related schools.
- Related programs.
- City or route context when it affects the decision.

Demote or remove from default display:

- Raw source quality labels.
- Internal source lineage.
- Repeated route type labels.
- Admin-like model fields.
- Generic planning notes.
- Duplicate funding/deadline/provider cards.

CSCAlite can inform the data model, but the UI should translate it into student decisions.

## 12. Interaction Model

Primary action:

- `Find programs` filters programs that can connect to this scholarship.

Secondary action:

- `All scholarships` returns to scholarship browser.

Save:

- `Save to favourites` gives immediate visible feedback.
- Saved state changes label or icon.

Checklist:

- Checklist items must be short and action-oriented.
- Checked state updates progress.
- Checklist should not duplicate the decision fact rail.

Expandable content:

- Use expansion only for genuinely long reference content.
- The collapsed row must still explain what is inside.
- Do not hide important decisions just to make the page shorter.

## 13. Good And Bad Patterns

Bad:

- Hero says `partial`.
- A summary card says `partial`.
- Side rail says `partial`.
- Checklist says `confirm funding`.

Good:

- Decision rail says `Funding: Partial`.
- Fit lane explains what partial may cover.
- Checklist says `Confirm official coverage`.

Bad:

- Three document cards each with long text.

Good:

- One document matrix with document, reason, timing.

Bad:

- Side rail repeats deadline, degree, provider, source.

Good:

- Side rail shows progress, primary action, and next steps.

Bad:

- Every field becomes a pill.

Good:

- Pills are reserved for states or filters; facts use rows.

## 14. Visual QA Acceptance Criteria

Desktop:

- First viewport shows title, one-line summary, actions, and decision facts.
- Funding, degree, and deadline appear once as primary facts.
- Provider and scope appear as quieter record facts.
- Main content and side rail have distinct jobs.
- At least three display patterns are visibly different: fact rail, fit lanes, relationship rows, document matrix, evidence block.
- No major section looks like a copy of the previous section.
- Buttons align consistently and text is centered.
- No horizontal overflow at 1440px.

Mobile:

- No horizontal overflow at 390px.
- H1 remains readable.
- Decision facts become clean stacked rows.
- Primary action appears before long content.
- Side rail content becomes normal content without crowding.

Content:

- A student can answer these within 10 seconds:
  - What scholarship is this?
  - Is it full, partial, or another coverage type?
  - What is the deadline?
  - What degree level does it fit?
  - Which school or program can it connect to?
  - What should I do next?

Design:

- The page does not feel like a stack of identical white cards.
- Information is grouped by user decision, not database field category.
- Spacing, line length, and record-style rows reduce reading load.
- Long reference content is available without dominating the page.

## 15. Implementation Boundary

This redesign pass should focus on the scholarship detail page only.

Do:

- Reorganize content into the hierarchy above.
- Reduce repeated labels and duplicate facts.
- Replace excessive cards with rows, lanes, matrices, and action rail patterns.
- Keep CSCAlite-aligned facts, but translate them into student-facing language.
- Verify with desktop and mobile screenshots.

Do not:

- Redesign every detail page in this pass.
- Add backend behavior.
- Add authentication, payment, or upload behavior.
- Copy CSCA.app or UCAS directly.
- Solve hierarchy by hiding everything.
- Add more badges as a substitute for structure.

## 16. Final Design Standard

The scholarship detail page is acceptable only when it feels like a student-friendly funding decision page:

- clear at first glance,
- calm enough to read,
- structured enough to trust,
- detailed enough for real planning,
- and visually organized so the student does not have to parse every field to know what matters.
