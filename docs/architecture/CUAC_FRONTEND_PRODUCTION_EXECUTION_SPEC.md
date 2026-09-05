# CUAC Frontend Production Execution Spec

Date: 2026-08-12

Status: revised after UCAS reference audit and first visual critique.

Purpose: turn the revised CUAC frontend direction into an implementation plan covering framework, page priority, visual system, interaction behavior, animation, concurrency, QA, and publishing rules.

## 1. Current Engineering Reality

The current frontend lives under:

```txt
frontend/
  app/
  public/
  .openai/hosting.json
```

Current stack:

- Vinext app routes
- React
- TypeScript
- CSS design tokens in `app/globals.css`
- Client state in `app/cuac-app.tsx`
- Mock data in `app/data.ts`

Execution rule:

- Continue from the current Vinext structure.
- Do not switch to React Router unless the user explicitly asks for a rebuild.
- Do not introduce backend, database, auth, real upload, payment, or admin systems in this frontend phase.
- Do not publish/deploy unless the user explicitly asks.

## 2. Revised Product Experience Target

CUAC should feel like a student-facing admissions planning, search, and application-preparation tool.

Primary phrase:

`Find, compare, and prepare China university applications.`

Experience goals:

- Planning-first on Home, search-first inside Program Search.
- Dense enough for real comparison.
- Clear enough for international high school students.
- Friendly but not childish.
- Trustworthy without becoming bureaucratic.
- Motion and color support decisions rather than decorate.

Reject:

- Generic dashboard-first design.
- Empty hero space.
- Fake "radar" or abstract progress widgets.
- Decorative animations without functional feedback.
- Template-like three-card layouts as the main experience.

## 3. Page Priority

Implementation polish priority:

1. Program Search.
2. Home natural-language planning gateway.
3. Program Detail.
4. Hub.
5. Application Builder.

Reason:

Program Search is the core product surface. Home only succeeds if it sends students into search or clear browse routes quickly.

## 4. Home Execution Requirements

First viewport must include:

- Top nav.
- Deadline strip.
- H1 with product promise.
- Large natural-language planning input.
- `Find routes` action.
- Prompt starter chips such as `No HSK`, `Scholarship preferred`, `Fall 2026`, and `Lower-cost city`.
- Browse category grid.
- Returning-student Hub continuation.
- Sticky compact planning bar after the hero input scrolls away.

Browse categories:

- Courses
- Universities
- Scholarships
- Deadlines
- City guides
- English-taught
- Late intake

Do not use:

- Large dashboard preview as the dominant visual.
- Decorative hero illustration without useful content.
- Long explanatory paragraphs.
- Three generic cards as the first meaningful content.

Home interactions:

- Prompt submit shows a short mocked interpreting state, creates route chips, then navigates to `/programs` with query/filter params.
- The shared bottom `GlobalAgentComposer` is available on every student-facing page and shares value/submit state with the Home hero input.
- Prompt submit from either the hero input or global composer opens a right-side `Agent Workspace` that shows the planning workflow and can be collapsed/reopened.
- Category tile navigates to a route or filtered search.
- Deadline strip navigates to deadline-filtered search.
- Hub continuation navigates to `/hub`.

Home must stay honest in frontend-only mode:

- Do not claim a real AI or adviser has evaluated the student.
- Mock interpretation is allowed if it is fast, reversible, and represented as route suggestions.
- Empty or vague prompts should return helpful examples rather than a fake answer.

Agent Workspace requirements:

- Opens only after the student sends a goal.
- Shows CUAC-specific workflow steps, not generic chatbot filler.
- May display: intent parsing, program search, city/cost comparison, readiness check, and next action.
- Can collapse into a small right-edge `Agent` reopen control.
- Docks the same shared composer at the panel bottom while open so students can continue asking follow-up questions.
- In frontend-only mode, all workflow steps are mocked and must not claim a real adviser or AI has evaluated the student.

Shared shell requirements:

- Header, footer, social links, `GlobalAgentComposer`, and `AgentWorkspacePanel` live in shared shell code.
- Individual pages must not reimplement their own header, footer, bottom composer, or agent panel.
- Any page-level planning input should use the shared `data-planner-*` contract so it submits into the same agent workflow.

## 5. Program Search Execution Requirements

Search page layout:

- Desktop: filter rail, result list/grid, compare/choice tray.
- Mobile: search header, filter drawer, active chips, stacked results, sticky tray.

Required controls:

- Search input.
- Result count.
- Sort.
- List/grid toggle.
- Filters.
- Active filter chips.
- Relax filters.
- Clear all.

Required row/card fields:

- Program name.
- University.
- City/province.
- Degree/qualification.
- Teaching language.
- Intake/start date.
- Duration.
- Deadline.
- Tuition.
- Scholarship.
- HSK/English/admission test chips.
- Required document count.
- Source status.
- Save.
- Compare.
- Add to choices.

Search behavior:

- URL reflects filters.
- Results remain visible while new search is pending.
- Result count updates clearly.
- Empty state suggests specific filters to remove.
- Add-to-choice creates a visible confirmation with `View Hub` and `Keep searching`.

## 6. Program Detail Execution Requirements

Detail page must answer:

- Can I apply?
- When is the deadline?
- What does it cost?
- What documents/tests are required?
- Is scholarship available?
- Is source information fresh?
- What should I do next?

Required sections:

- Header.
- Key facts grid.
- Readiness panel.
- Eligibility.
- Documents.
- Tuition and scholarships.
- Timeline.
- University/city context.
- Source verification.
- Similar/late alternatives.

Primary action:

- `Add to choices`, or `Open application` if already added.

## 7. Hub Execution Requirements

Hub is a task cockpit.

Above the fold:

- Next best action.
- Deadline timeline.
- Active choices.

Secondary:

- Missing documents.
- Adviser access.
- Messages/tasks.
- Late-intake suggestions.

Next action priority:

1. Add a program to choices.
2. Complete profile basics.
3. Prepare required documents.
4. Finish application sections.
5. Request adviser review.
6. Wait for adviser feedback.

## 8. Application Builder Execution Requirements

Builder layout:

- Desktop: section nav, active section, context panel.
- Mobile: progress, section drawer, active section, context accordion.

Required:

- Autosave indicator.
- Section statuses.
- Document upload slots.
- Blocker list.
- Review request panel.
- Success timeline event.

Do not use final-wording `Submit` in frontend-only mode. Use `Request adviser review`.

## 9. Visual System

CUAC palette should be clear and youthful, not one-note.

```css
:root {
  --cuac-bg: #f6f9fb;
  --cuac-surface: #ffffff;
  --cuac-surface-soft: #eef6f5;
  --cuac-border: #d8e4ea;
  --cuac-border-strong: #b8cbd4;

  --cuac-text: #10242d;
  --cuac-text-muted: #526a75;
  --cuac-text-soft: #718690;

  --cuac-primary: #00756f;
  --cuac-primary-dark: #005e5a;
  --cuac-primary-soft: #dff4f1;

  --cuac-action: #246bfe;
  --cuac-action-dark: #164ec7;
  --cuac-action-soft: #e7efff;

  --cuac-success: #168a4a;
  --cuac-success-soft: #e4f7ec;
  --cuac-warning: #b7791f;
  --cuac-warning-soft: #fff3d6;
  --cuac-danger: #c2412d;
  --cuac-danger-soft: #ffe7e1;

  --cuac-scholarship: #b98a24;
  --cuac-scholarship-soft: #fff4d8;

  --cuac-youth-coral: #f26b5b;
  --cuac-youth-mint: #47c2a4;
  --cuac-youth-sky: #5bb8ff;
}
```

Usage ratio:

- 70% white/light grey.
- 15% teal identity.
- 10% blue actions.
- 5% status/accent colors.

Color roles:

- Teal: brand, verified, selected state.
- Blue: primary actions.
- Amber: deadline risk.
- Red/coral: blockers and urgent deadlines.
- Green/mint: ready and accepted states.
- Gold: scholarships.
- Sky: guides and helpful tips.

Rules:

- Cards use 8px radius max.
- Buttons/inputs use 6px radius.
- Avoid nested cards.
- Avoid decorative blobs/orbs.
- Do not scale fonts with viewport width.
- Letter spacing is 0 except small uppercase eyebrows if absolutely needed.
- Text must not overflow buttons/cards.

## 10. Typography

Use:

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Recommended fixed scale:

- Home H1 desktop: 56-64px.
- Home H1 mobile: 34-40px.
- Page H1 desktop: 40-48px.
- Page H1 mobile: 30-36px.
- Section title: 24-28px.
- Panel title: 18-20px.
- Body: 15-16px.
- Metadata: 13px.
- Badge/chip: 12px.

Rules:

- Use numeric hierarchy for deadlines, tuition, document count, and readiness.
- Long program names wrap to two lines, then truncate.
- Chinese and English names must not overlap.

## 11. Content Structure

Every page should answer:

1. What can I do here?
2. What options match me?
3. What is urgent?
4. What is missing?
5. What should I do next?
6. What source supports this?

Copy rules:

- Use direct verbs.
- Keep UI text short.
- Prefer exact dates and amounts.
- Avoid admissions guarantees.
- Avoid long official language.

Good button labels:

- `Find routes`
- `Search programs`
- `Save`
- `Compare`
- `Add to choices`
- `Open application`
- `Prepare documents`
- `Request adviser review`

Avoid:

- `Learn more`
- `Get started`
- `Explore`
- `Submit`

## 12. Motion And Animation

Motion is allowed, but it must be functional.

Motion tokens:

```css
:root {
  --motion-fast: 120ms;
  --motion-base: 180ms;
  --motion-slow: 260ms;
  --motion-panel: 320ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
}
```

Recommended motion:

- Planning/search focus shadow.
- Sticky planning bar enter/exit.
- Short prompt interpreting state.
- Filter chips enter/exit.
- Result count crossfade.
- Save icon fill pulse.
- Compare tray slide.
- Drawer open/close.
- Source panel expand.
- Document upload status progress.
- Section ready icon transition.
- Hub next-action crossfade.

Avoid:

- Confetti.
- Bouncy motion.
- Animated gradients behind text.
- Parallax.
- Scroll-jacking.
- Large decorative loops.
- Motion that delays input or navigation.

Reduced motion:

- Disable layout movement.
- Keep status text changes.
- Replace slides with short fades or instant state.

## 13. Open Source Interaction References

References can guide implementation, but CUAC should own its visual language.

Allowed references:

- Motion for React: component enter/exit, layout, reduced motion.
- shadcn/ui: dialogs, sheets, popovers, forms, alerts, command/search patterns.
- Animate UI: tasteful animated primitives.
- Animata: small accessible animated widgets.
- Magic UI: subtle badges or highlights only.
- React Bits: inspiration only, avoid expressive effects.
- Alibaba PageAgent: reference for embedded page-operation agents and possible future UI automation runtime.

Adoption rules:

- Check license.
- Restyle to CUAC tokens.
- Remove decorative effects.
- Add keyboard behavior.
- Add reduced-motion support.
- Keep code small enough to maintain.

PageAgent boundary:

- Treat PageAgent as a page-operation layer, not CUAC's admissions recommendation engine.
- CUAC-owned domain logic must decide program matching, readiness, scholarship, source freshness, and document requirements.
- Use PageAgent or PageAgentCore only behind a CUAC-designed `Agent Workspace` when it adds clear page-operation value.
- Do not expose LLM API keys in frontend code; production integration needs a backend proxy.
- Do not send passport, transcript, or other sensitive personal data to a demo/runtime without explicit privacy design.
- Keep pages semantic and accessible so a DOM-based agent can understand controls reliably.

## 14. Concurrency And Race Conditions

Even in frontend-only mode, interactions must be API-ready.

Search:

- Natural-language prompt interpretation uses request IDs.
- Latest prompt wins.
- Sticky and hero inputs stay synchronized.
- Debounce query.
- Use request ID or AbortController.
- Latest request wins.
- Keep old results visible while pending.

Save/compare/choice:

- Idempotent by program ID.
- Disable only clicked action while pending.
- Optimistic update with rollback path.
- Compare max enforced in reducer.
- Duplicate add-to-choice creates one choice.

Application:

- Per-section save queue.
- Latest field value wins.
- Mark-ready waits for autosave.
- Review request checks pending uploads and hard blockers.

LocalStorage:

- Store `stateVersion` and `updatedAt`.
- Listen for storage events.
- Show `Application updated in another tab` banner.

## 15. QA Requirements

Before accepting the next frontend iteration:

- Home desktop screenshot.
- Home mobile screenshot.
- Program Search desktop screenshot.
- Program Search mobile screenshot.
- Program Detail desktop screenshot.
- Hub desktop screenshot.
- Application Builder desktop screenshot.

Check:

- No overlapping text.
- No giant empty first viewport.
- Program Search has dense comparable fields.
- Filters are visible and useful.
- Sticky elements do not cover controls.
- Keyboard focus is visible.
- Reduced motion works.
- Rapid save/compare/add clicks do not duplicate state.
- Build passes.
- Lint and TypeScript pass.

## 16. Local Preview And Publishing

Local preview:

- Start or reuse local dev server.
- Use local URL for review.
- Make screenshots locally when visual QA is needed.

Publishing:

- Do not publish automatically.
- Do not deploy after build unless explicitly requested.
- Do not save a new live version unless explicitly requested.
- User approval must be specific: publish, deploy,上线, or equivalent.
