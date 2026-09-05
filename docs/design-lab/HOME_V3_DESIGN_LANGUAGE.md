# CUAC Home v3 Design Language

Date: 2026-08-12

Artifact:

- `design-lab/home-v3.html`
- `design-lab/qa-home-v31-desktop.png`
- `design-lab/qa-home-v31-desktop-long.png`
- `design-lab/qa-home-v31-mobile.png`
- `design-lab/qa-home-v31-mobile-long-fix.png`
- `design-lab/qa-ucas-home-clean.png`
- `design-lab/qa-home-v33-desktop.png`
- `design-lab/qa-home-v33-desktop-long.png`
- `design-lab/qa-home-v33-mobile-long.png`
- `design-lab/qa-home-v43-desktop-long.png`
- `design-lab/qa-home-v43-mobile-long.png`

## 1. Why v3 Exists

The previous Home direction was too text-heavy and too dashboard-like. It technically followed many requirements, but it did not feel friendly, light, or attractive for international high school students.

Home v3 resets the page around one job:

`Get the student into a planning prompt or a browse category within 5 seconds.`

Home v3.1 keeps that job, but expands the homepage into a fuller UCAS-like entry surface. The page now has enough sections to feel like a real admissions homepage, while keeping copy short.

Home v3.2 changes the hero from a normal keyword search into a natural-language planning entry. This is the main CUAC difference from UCAS: students can describe an uncertain goal in plain English, then CUAC turns it into visible route chips and relevant browse/search destinations. In the frontend-only phase this behavior is mocked, but the interaction must feel honest, useful, and API-ready.

Home v3.3 adds a shared `Agent Workspace` pattern: after the student sends a goal from the Home hero input or the global bottom composer, a right-side panel opens to show how CUAC understands the goal and works through route search, city/cost comparison, readiness checks, and next actions. The same composer docks at the panel bottom while the workspace is open so students can continue asking follow-up questions. This pattern is inspired by embedded page-operation agents such as Alibaba PageAgent, but CUAC must keep a custom admissions-focused UI and its own domain logic.

## 2. Homepage Rules

- One short H1.
- One short supporting sentence.
- The natural-language planning input is the biggest control.
- Sending the Home planning input opens the shared right-side Agent Workspace.
- The global bottom composer remains available across student-facing pages, not only Home.
- When the Agent Workspace is open, the same composer moves into the panel bottom instead of duplicating state.
- Category tiles stay above the fold.
- Hub continuation is useful but secondary.
- No explanatory paragraphs in the first viewport.
- No dashboard preview as the main visual.
- No generic three-card marketing section.

## 3. Visual Direction

Keywords:

- warm
- clean
- friendly
- planning-first
- student-facing
- trustworthy
- not childish

Palette:

- white and cool soft-grey base
- deep green for CUAC trust
- bright blue for primary action
- small yellow/rose/mint accents for youthfulness

Layout:

- soft open background
- large natural-language planning module
- pill navigation
- compact category tiles
- one small continuation panel
- minimal text under each item

Width:

- Desktop content uses a wider `1400px` max container, based on the clean UCAS homepage screenshot at 1440px width.
- Mobile content is locked to the viewport with explicit 16px side padding to prevent horizontal cropping.

Typography:

- H1 is large but less heavy than v2.
- Navigation and chips use medium-bold weights rather than heavy dashboard weights.
- Section titles are prominent, but body copy stays short and secondary.

Icons:

- Use a Lucide-style linear icon language.
- Primary category icons behave like UCAS category icons, not cards.
- Icons may appear inside small soft square chips only when they need color grouping.
- Icons replace numeric-only category labels where possible.

Radius:

- Main cards/panels/images use 8px radius.
- Buttons and input controls use 6-8px radius.
- Pill chips may keep full capsule radius.
- Avoid rounded app-like cards above 12px radius.

Rhythm:

- Do not make every section a card grid.
- Use icon navigation for categories.
- Use large image + text for narrative sections.
- Use compact rows for decision lists.
- Use cards only where the user is comparing grouped information.
- Use a full-width CTA strip for one important account/deadline prompt.
- Use a dark institutional zone near the footer for non-student audiences, following UCAS's separation of student and institutional tasks.

## 4. Copy Direction

Use short practical copy:

- `Find China programs that fit.`
- `Tell us what you want to study in China.`
- `English-taught computer science in a lower-cost city`
- `No HSK, scholarship preferred, Fall 2026`
- `Closing soon`
- `City fit`

Avoid:

- long explanations
- motivational slogans
- bureaucratic admissions copy
- claims that sound like guaranteed admission

## 5. Interaction Language

Keep motion useful and light:

- category tile lift on hover
- planning input focus shadow
- global bottom Agent Composer stays available as a light, bottom-centered chat input
- right-side Agent Workspace slides in only after send
- submitted prompt briefly shows an interpreting state before route chips appear
- button press feedback
- Hub continuation can crossfade when the next action changes

Avoid:

- looping decorative animation
- animated backgrounds
- motion that competes with reading
- pretending frontend-only mock interpretation is a real AI result

## 6. Current Open Issues

- City photos are placeholders and must be replaced with approved production assets before launch.
- The homepage still needs a real interactive React pass after visual approval.
- The same design language should not be applied blindly to Program Search; search results need more density than Home.
- The Home natural-language planning input needs final copy and mocked interpretation states, while shared bottom composer behavior belongs in `shared-shell.css` and `shared-shell.js`.
- PageAgent is a possible future page-operation runtime, not the CUAC admissions recommendation engine.

## 7. Home v3.1 Section Model

The homepage now follows this structure:

1. Natural-language planning gateway.
2. UCAS-style icon category navigation.
3. Editorial discovery tiles.
4. Image + route list.
5. China fit CTA band.
6. Closing soon programs.
7. City fit.
8. Featured universities.
9. China-specific guides.
10. Deadline/Hub CTA strip.
11. Updates from CUAC.
12. Search-to-review steps.
13. Dark institutional zone.
14. Footer.

UCAS reference logic:

- UCAS puts search and category routes first.
- UCAS continues with discovery tiles, a high-contrast CTA band, featured providers, updates, a dark institutional section, and a full footer.
- CUAC adapts those sections into China-specific actions: scholarships, deadlines, documents, cities, visa/JW form, budget, and HSK/IELTS.
- CUAC must not copy UCAS's exact search treatment. The hero input should feel like a smarter admissions planning prompt, while category navigation and section rhythm keep the clarity standard of UCAS.

## 8. Motion

Motion is intentionally restrained:

- Planning input focus gets a slightly stronger shadow.
- Global bottom Agent Composer uses restrained focus and send feedback; no bounce or decorative loop.
- Mock interpretation can use a short pending label such as `Reading your goal` for 600-900ms, then show extracted chips.
- Agent Workspace uses one controlled right-side slide, docks the composer at the panel bottom, can collapse, and restores from a small `Agent` reopen control.
- Image tiles scale the image subtly on hover.
- Buttons lift by 1px on hover.
- Sections can fade/slide in on scroll.
- `?motion=off` disables reveal animation for screenshot QA.
- `prefers-reduced-motion: reduce` disables motion for users who request it.

Avoid:

- looping decorative animation
- moving backgrounds
- bouncing cards
- animation that hides information or delays search
