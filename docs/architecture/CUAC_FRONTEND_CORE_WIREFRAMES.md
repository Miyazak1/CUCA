# CUAC Frontend Core Wireframes

Date: 2026-08-12

Status: revised after UCAS reference audit.

Purpose: provide implementation-ready structural wireframes for the frontend-only production build. These wireframes prioritize natural-language planning, search, filters, comparable program fields, deadlines, and application tasks.

## 1. Shared Shell

### Desktop

```txt
┌──────────────────────────────────────────────────────────────────────────────┐
│ Utility row: Students | Parents | Advisers preview                           │
├──────────────────────────────────────────────────────────────────────────────┤
│ CUAC   Search   Universities   Scholarships   Deadlines   China Guides   Hub │
├──────────────────────────────────────────────────────────────────────────────┤
│ Optional route strip: deadline / source / preview profile status             │
├──────────────────────────────────────────────────────────────────────────────┤
│ Page content                                                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ Global bottom Agent Composer: "Tell CUAC what you want to study"        Send │
└──────────────────────────────────────────────────────────────────────────────┘
```

Rules:

- Student routes are primary.
- Adviser/provider/admin are not primary nav items.
- Header should be compact and should not consume the first viewport.
- Current route is visible.
- Planning/search is always reachable through the shared bottom Agent Composer on every student-facing page.
- Sending from the composer opens the shared right-side Agent Workspace; the same composer docks at the panel bottom, and collapsing the panel returns it to the page bottom.
- Individual pages may have page-level planning inputs, but they must feed the same shared composer/workspace state.

### Mobile

```txt
┌────────────────────────────┐
│ CUAC       Search   Menu   │
├────────────────────────────┤
│ Optional deadline strip    │
├────────────────────────────┤
│ Page content               │
└────────────────────────────┘
```

Rules:

- Menu opens a drawer.
- Search shortcut opens `/programs` with focused search.
- Sticky bottom actions reserve safe-area space.

## 2. Home: Natural-Language Planning Gateway

Purpose: move students into a plain-English planning prompt, search, or browse categories within 5 seconds.

### Desktop Wireframe

```txt
┌──────────────────────────────────────────────────────────────────────────────┐
│ TopNav                                                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│ DeadlineStrip: Fall 2026 | 3 deadlines need attention | View deadlines       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ H1: Find, compare, and prepare China university applications                 │
│ Body: Tell us what you want to study in China. We will help narrow it down.  │
│                                                                              │
│ ┌────────────────────────────────────────────────────────────────────────┐   │
│ │ I want an English-taught CS master in a lower-cost city    Find routes │   │
│ └────────────────────────────────────────────────────────────────────────┘   │
│ Prompt starters: No HSK | Scholarship preferred | Fall 2026 | Under RMB 40k  │
│                                                                              │
│ Browse categories                                                            │
│ ┌──────────┐ ┌─────────────┐ ┌──────────────┐ ┌─────────────┐ ┌──────────┐ │
│ │ Courses  │ │ Universities│ │ Scholarships │ │ Deadlines   │ │ Cities   │ │
│ └──────────┘ └─────────────┘ └──────────────┘ └─────────────┘ └──────────┘ │
│ ┌───────────────┐ ┌────────────┐                                             │
│ │ English-taught│ │ Late intake│                                             │
│ └───────────────┘ └────────────┘                                             │
│                                                                              │
│ Returning student strip: Next action | Open Hub                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Featured decision rows                                                       │
│ ┌────────────────────────────┐ ┌────────────────────────────┐               │
│ │ Closing soon programs      │ │ Scholarships still open    │               │
│ │ 3 dense mini rows          │ │ 3 dense mini rows          │               │
│ └────────────────────────────┘ └────────────────────────────┘               │
├──────────────────────────────────────────────────────────────────────────────┤
│ City fit preview: Hangzhou | Shanghai | Beijing | cost + student-life note   │
├──────────────────────────────────────────────────────────────────────────────┤
│ How it works: Search -> Compare -> Prepare -> Adviser review                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

Sticky planning bar after scroll:

```txt
┌──────────────────────────────────────────────────────────────────────────────┐
│ Top viewport overlay, centered content width                                 │
│ ┌────────────────────────────────────────────────────────────────────────┐   │
│ │ Computer science in Hangzhou                              Find routes  │   │
│ └────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

Rules:

- Sticky bar appears only after the hero planning input leaves the viewport.
- Desktop bar is compact and fixed near the top of the viewport.
- It must not cover section headings or interactive controls.
- It shares value/state with the hero input.
- Mobile can use a collapsed bottom pill or compact bottom input; hide it while the keyboard is open.

### Mobile Wireframe

```txt
┌────────────────────────────┐
│ Top bar                    │
├────────────────────────────┤
│ Deadline strip             │
├────────────────────────────┤
│ H1                         │
│ Short body                 │
│ Planning input             │
│ Find routes button         │
│ Prompt starter chips       │
│ Browse category grid       │
│ Open Hub next action       │
├────────────────────────────┤
│ Closing soon list          │
│ Scholarship list           │
│ City fit list              │
└────────────────────────────┘
```

Required interactions:

- Prompt submit shows a short interpreting state, creates mocked route chips, then navigates to `/programs` with URL filters/query.
- Empty prompt focuses input and shows inline hint.
- Example chips append or replace prompt text.
- Category buttons navigate to relevant filtered states.
- Deadline strip navigates to `/programs?deadlineStatus=closes_soon`.
- Hub strip navigates to `/hub`.

Motion:

- Planning input focus increases border/shadow.
- Interpreting state is 600-900ms and never blocks manual navigation.
- Sticky planning bar fades/slides in with a small offset.
- Category tiles lift slightly on hover/tap.
- Hub strip crossfades when next action changes.
- No decorative looping animation.

## 3. Program Search: Decision Workbench

Purpose: make search, filtering, saving, comparing, and choice-building the core product experience.

### Desktop Wireframe

```txt
┌──────────────────────────────────────────────────────────────────────────────┐
│ TopNav                                                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│ SearchHeader                                                                 │
│ ┌──────────────────────────────────────────────┐ Sort: Deadline  List Grid  │
│ │ Computer science                             │                             │
│ └──────────────────────────────────────────────┘                             │
│ 128 programs found  | Active chips: Master x English-taught x Scholarship x  │
├────────────────┬─────────────────────────────────────────────┬───────────────┤
│ FilterRail     │ Results                                     │ Choice/Compare│
│                │                                             │ Tray          │
│ Degree         │ ┌─────────────────────────────────────────┐ │ Compared: 2   │
│ Subject        │ │ ProgramResultRow                       │ │ Choices: 1    │
│ Language       │ │ Computer Science MSc                   │ │               │
│ Intake         │ │ Zhejiang University · Hangzhou          │ │ [Compare]     │
│ City/province  │ │ MSc · English · Fall 2026 · 2 years     │ │ [Open Hub]    │
│ Tuition        │ │ Deadline Oct 15 · RMB 42,000/year       │ │               │
│ Scholarship    │ │ Scholarship · IELTS · 6 docs · Verified │ │               │
│ Deadline       │ │ [Save] [Compare] [Add to choices]       │ │               │
│ Documents      │ └─────────────────────────────────────────┘ │               │
│ Source         │ ┌─────────────────────────────────────────┐ │               │
│ Late intake    │ │ ProgramResultRow                       │ │               │
│                │ └─────────────────────────────────────────┘ │               │
└────────────────┴─────────────────────────────────────────────┴───────────────┘
```

### Mobile Wireframe

```txt
┌────────────────────────────┐
│ Top bar                    │
├────────────────────────────┤
│ Search input               │
│ Filters button | Sort      │
│ Active chips horizontal    │
│ 128 programs found         │
├────────────────────────────┤
│ Program result rows        │
│ Program result rows        │
│ Program result rows        │
├────────────────────────────┤
│ Sticky tray: 2 compare | 1 choice │
└────────────────────────────┘
```

Filter drawer:

```txt
┌────────────────────────────┐
│ Filters              Close │
│ Course type/year           │
│ Degree level               │
│ Subject                    │
│ Teaching language          │
│ Intake                     │
│ City/province              │
│ Tuition                    │
│ Scholarship                │
│ Deadline                   │
│ Documents/tests            │
│ Source verification        │
│ [Show 128 programs]        │
│ [Reset filters]            │
└────────────────────────────┘
```

Result row field order:

1. Program name.
2. University and city.
3. Degree, language, intake, duration.
4. Deadline and tuition.
5. Scholarship and requirements.
6. Document count and source status.
7. Save, compare, add-to-choices.

Required interactions:

- Filters update URL params.
- Keyword search is debounced.
- Result count updates without clearing old rows immediately.
- Active chips remove filters.
- Save toggles instantly.
- Compare limit is 3.
- Add to choices shows inline confirmation.
- Row click opens detail.
- Action click does not open detail.
- List/grid toggle preserves filters.

Empty state:

```txt
No matching programs
Try removing scholarship, document burden, city, or deadline filters.
[Relax filters] [Clear all]
```

Motion:

- Active chips slide/fade in.
- Result count crossfades.
- Save icon fills with a small pulse.
- Compare tray slides in from side/bottom.
- No row layout jump.

## 4. Program Detail

Purpose: help student decide whether this program belongs in choices.

### Desktop Wireframe

```txt
┌──────────────────────────────────────────────────────────────────────────────┐
│ Back to results                                                              │
├──────────────────────────────────────────────────────────────┬───────────────┤
│ ProgramHeader                                                │ Sticky Panel  │
│ Computer Science MSc                                         │               │
│ Zhejiang University · Hangzhou                               │ Readiness     │
│ MSc · English · Fall 2026 · 2 years                          │ Likely eligible│
│                                                              │               │
│ Key facts grid                                               │ Missing       │
│ Deadline Oct 15 | RMB 42,000/year | Scholarship | Verified   │ IELTS cert    │
│                                                              │ Transcript    │
├──────────────────────────────────────────────────────────────┤ translation   │
│ Overview                                                     │               │
│ Eligibility                                                  │ [Save]        │
│ Required documents                                           │ [Compare]     │
│ Tuition and scholarship                                      │ [Add choices] │
│ Application timeline                                         │               │
│ University/city context                                      │               │
│ Source and verification                                      │               │
│ Similar programs                                             │               │
└──────────────────────────────────────────────────────────────┴───────────────┘
```

### Mobile Wireframe

```txt
┌────────────────────────────┐
│ Back to results            │
│ Program title              │
│ University · city          │
│ Key facts grid             │
│ Readiness panel            │
├────────────────────────────┤
│ Overview                   │
│ Eligibility                │
│ Documents                  │
│ Tuition/scholarship        │
│ Timeline                   │
│ Source                     │
│ Similar programs           │
├────────────────────────────┤
│ Sticky actions             │
└────────────────────────────┘
```

Required interactions:

- Back preserves previous search state.
- Add to choices updates Hub state.
- If already added, CTA becomes `Open application`.
- Missing document action opens builder with `section=documents`.
- Source block expands inline.
- Similar program card navigates to another detail route.
- Closed program shows `Find late alternatives`.

Motion:

- Readiness meter animates once.
- Source block expands with height/opacity.
- Similar cards use minimal stagger.

## 5. Student Hub

Purpose: answer "what should I do next?"

### Desktop Wireframe

```txt
┌──────────────────────────────────────────────────────────────────────────────┐
│ Hub header: Application workspace | Preview profile active                   │
├───────────────────────────────┬──────────────────────────────────────────────┤
│ NextActionPanel               │ DeadlineTimeline                             │
│ Prepare required documents    │ Oct 15 ZJU CS MSc                            │
│ [Open documents]              │ Nov 20 Tongji Civil Engineering              │
├───────────────────────────────┴──────────────────────────────────────────────┤
│ Active choices                                                               │
│ ┌────────────────────────┐ ┌────────────────────────┐ ┌───────────────────┐ │
│ │ ZJU CS MSc             │ │ Fudan Economics BA     │ │ Add another choice │ │
│ │ Missing 2 docs         │ │ Deadline urgent        │ │                   │ │
│ └────────────────────────┘ └────────────────────────┘ └───────────────────┘ │
├───────────────────────────────┬──────────────────────┬──────────────────────┤
│ Missing documents             │ Adviser access       │ Messages/tasks       │
│ Transcript translation        │ Scopes visible       │ Source recheck       │
│ IELTS certificate             │ [Manage access]      │ Deadline reminder    │
└───────────────────────────────┴──────────────────────┴──────────────────────┘
```

### Mobile Wireframe

```txt
┌────────────────────────────┐
│ Hub header                 │
│ Next action                │
│ Deadline timeline          │
│ Active choices             │
│ Missing documents          │
│ Adviser access             │
│ Messages/tasks             │
└────────────────────────────┘
```

Next action priority:

1. No choices: `Add a program to choices`.
2. Profile incomplete: `Complete profile basics`.
3. Documents missing: `Prepare required documents`.
4. Sections incomplete: `Finish application sections`.
5. Ready: `Request adviser review`.
6. Requested: `Wait for adviser feedback`.

Motion:

- Next action crossfades.
- Blocker removal animates.
- New message appears with subtle highlight.

## 6. Application Builder

Purpose: prepare a reviewable application packet without losing context.

### Desktop Wireframe

```txt
┌──────────────────────────────────────────────────────────────────────────────┐
│ Application header: 2 choices | documents missing | Autosave: Saved          │
├───────────────────┬───────────────────────────────────┬──────────────────────┤
│ Section nav       │ Active section                     │ Context panel        │
│ Personal          │ Documents                          │ Required by choices  │
│ Passport          │                                   │ Hard blockers        │
│ Education         │ Passport photo page    [Accepted]  │ Source notes         │
│ Language tests    │ IELTS certificate      [Upload]    │ Deadline risk        │
│ Choices           │ Transcript translation [Upload]    │                      │
│ Documents         │                                   │                      │
│ Study plan        │ [Mark section ready]               │                      │
│ Recommendation    │                                   │                      │
│ Scholarship       │                                   │                      │
│ Review            │                                   │                      │
└───────────────────┴───────────────────────────────────┴──────────────────────┘
```

### Mobile Wireframe

```txt
┌────────────────────────────┐
│ Application header         │
│ Progress bar               │
│ Section drawer button      │
│ Active section             │
│ Context accordion          │
│ Sticky section action      │
└────────────────────────────┘
```

Required interactions:

- Section nav remembers last section.
- Autosave cycles through dirty, saving, saved, error.
- Mark section ready waits for pending save.
- Upload simulation is per document.
- Request adviser review disabled until hard blockers clear.
- Success creates timeline event and locks completed sections visually.

Motion:

- Autosave label fades.
- Section status icon animates once.
- Upload slot shows progress.
- Review success uses calm success panel, no confetti.

## 7. Visual QA Targets

Desktop:

- Home first viewport shows planning input, categories, deadline strip, and Hub continuation.
- Program Search shows filters, result count, dense rows, and compare tray without scrolling.
- Program Detail shows key facts and readiness above the fold.
- Hub shows next action and deadlines above the fold.
- Application Builder shows section nav, active section, and context panel.

Mobile:

- The global bottom composer does not overlap content, pagination, keyboard input, or footer links.
- Planning/search and category actions fit without horizontal overflow.
- Program rows remain scannable.
- Filter drawer has a clear show-results action.
- Application sections are reachable without long scrolling through nav.

## 8. Wireframe Acceptance

Wireframes are implementation-ready when:

- Planning/search is the dominant first action.
- Program Search is the richest page.
- Program rows use fixed comparable fields.
- Deadlines are concrete and visible.
- Choices, compare, documents, and Hub are connected.
- Motion is tied to feedback.
- No page depends on a decorative dashboard to explain itself.
