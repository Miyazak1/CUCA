# CUAC Student Hub Design Spec

Date: 2026-08-13

Status: research-backed design plan before implementation.

Purpose: define the signed-in Hub experience after registration and onboarding. The Hub should be a personalized China study workspace for international students, not a generic dashboard and not a UCAS clone.

## 1. Decision

CUAC should build a dedicated Student Hub.

The Hub is necessary because CUAC's value is not only public discovery. A student applying to Chinese universities needs a private place where study goals, saved programs, university interests, scholarship routes, document readiness, deadlines, Agent conversations, and adviser support come together.

The Hub should become the signed-in home after onboarding.

It should answer one question every time the student opens it:

`What should I do next to make my China application more realistic?`

## 2. UCAS Hub Reference Assessment

The supplied UCAS Hub screenshot shows a strong young-student product pattern:

- a personalized page title and account identity;
- a horizontal Hub navigation strip;
- a status or service alert area;
- a next-step application panel;
- a personalized feed carousel;
- a high-energy content/tool area with colorful modules;
- student support tools such as budget calculator, notes, CV/personal-statement tools, FAQs;
- a clear footer after the workspace.

Useful principles:

- Hub is a home base, not a pure admin dashboard.
- Personalization and discovery sit next to application tasks.
- Modules feel light, visual, and youthful.
- Feed/tool cards use illustration, color, and rhythm to reduce form fatigue.
- The user can browse, save, learn, and act from one signed-in surface.

What CUAC should not copy:

- UCAS-specific application cycle wording.
- Career/apprenticeship/course-taster modules as primary content.
- Personal statement/CV builder as a first-order tool.
- UK-centric service status messaging.
- UCAS visual identity: purple avatar, coral active tab, blue band, exact card style.
- A feed that feels like unrelated marketing content.

## 3. CUAC Hub Product Position

CUAC Hub should be:

- a personalized China admissions workspace;
- a route planning surface;
- a shortlist and choice manager;
- a document readiness tracker;
- a deadline and intake monitor;
- an Agent collaboration home;
- a student support and discovery feed.

It should not be:

- a CRM dashboard;
- a university brochure page;
- a collection of generic article cards;
- a backend admin preview;
- an application form as the first screen;
- an admissions guarantee engine.

Working phrase:

`Your China study workspace`

Primary promise:

`Keep programs, universities, scholarships, documents, deadlines, and Agent guidance in one place.`

## 4. Target Users

Primary users:

- International high school students planning undergraduate study in China.
- Undergraduate graduates planning master study in China.
- Scholarship-sensitive students.
- Students seeking English-taught programs without HSK first.
- Students comparing unfamiliar Chinese cities and universities.

Secondary users:

- Parents checking cost, safety, and application readiness.
- School counselors or advisers helping a student prepare.
- Students who have saved options but are not ready to apply.

Typical Hub states:

- New account after onboarding with no saved programs.
- Student has saved programs but no choices.
- Student has choices but missing documents.
- Student has a scholarship preference and needs earlier deadlines.
- Student missed a deadline and needs late-intake alternatives.
- Student wants Agent or adviser review before applying.

## 5. Hub Jobs To Be Done

The Hub must support five jobs:

1. Continue
   - Show one next best action, not ten equal tasks.
   - Example: `Compare 4 English-taught CS programs before Sep 12`.

2. Organize
   - Keep saved programs, universities, scholarships, and cities together.
   - Let the student move from saved items to application choices.

3. Prepare
   - Show missing documents, language proof, translations, passport, study plan, and recommendation needs.
   - Tie blockers to specific programs.

4. Decide
   - Help compare program, city, budget, language route, scholarship, source freshness, and deadline.
   - Make tradeoffs visible.

5. Recover
   - Show alternatives when deadline, document burden, language requirement, or scholarship path is not realistic.
   - Example: `Still open in Hangzhou`, `Lower document burden`, `Spring intake routes`.

## 6. Information Architecture

Primary Hub route:

- `hub.html` in the frontend-only demo.
- Later production route: `/hub`.

Hub subroutes:

- `/hub`
- `/hub/shortlist`
- `/hub/choices`
- `/hub/documents`
- `/hub/deadlines`
- `/hub/messages`
- `/hub/settings`

In the current static frontend phase, these can be represented as tabs, anchors, or stub links.

Recommended Hub nav:

- Hub
- For you
- Shortlist
- Documents
- Deadlines
- Messages
- Agent

Why this differs from public nav:

- Public nav helps discovery.
- Hub nav helps continuation and application readiness.

## 7. First Screen Structure

The first viewport should be useful and calm.

Required first-screen modules:

1. Header
   - Shared CUAC header, signed-in state.
   - Account avatar can be a compact initials circle.
   - Avoid repeating the full public homepage hero.

2. Hub title block
   - H1: `Your Hub`
   - Subtitle: `Your China study workspace`
   - Small profile context: target intake, degree level, subject, country.

3. Alert strip
   - Only if meaningful.
   - Example: `Fall 2026: 3 saved routes close before Oct 15`.
   - Do not show fake service outage unless it supports the demo narrative.

4. Next best action panel
   - One dominant task.
   - Secondary status facts.
   - CTA to the most relevant page.

5. Compact snapshot row
   - Saved programs.
   - Application choices.
   - Documents ready.
   - Upcoming deadlines.
   - Scholarship routes.

The first screen should not start with a dense card grid.

## 8. Core Modules

### 8.1 Next Best Action

Purpose:

- Reduce uncertainty immediately.

Content:

- Main action title.
- Short reason.
- 3-4 compact facts.
- Primary CTA.
- Secondary CTA.

Example:

- Title: `Finish your Zhejiang University route check`
- Reason: `This route fits English-taught Computer Science, but IELTS and transcript translation need attention.`
- Facts:
  - `Oct 15 deadline`
  - `RMB 42k/year`
  - `7 documents`
  - `Scholarship possible`
- CTA: `Open route check`
- Secondary: `Ask Agent`

### 8.2 Application Snapshot

Purpose:

- Give a fast picture of where the student stands.

Metrics:

- `4 saved programs`
- `2 compared`
- `1 choice ready`
- `3 documents missing`
- `18 days to nearest deadline`

Design:

- Horizontal stat row on desktop.
- Two-column compact grid on mobile.
- Use numbers carefully; do not make it an analytics dashboard.

### 8.3 Shortlist

Purpose:

- Let students compare and continue saved programs.

Fields:

- Program name.
- University.
- City.
- Intake.
- Deadline.
- Tuition.
- Language route.
- Scholarship signal.
- Readiness status.

Actions:

- `Compare`
- `Move to choices`
- `Open details`
- `Ask Agent`

Design:

- Use 2-3 strong cards or a compact table-like list.
- Avoid showing every saved item on the first screen.
- Link to full shortlist.

### 8.4 Choices

Purpose:

- Represent programs the student is seriously preparing to apply to.

State language:

- `Draft`
- `Needs documents`
- `Ready for review`
- `Submitted preview`
- `Blocked`

Content:

- Choice card with program route.
- Section readiness checklist.
- Deadline.
- Adviser review status.

Important:

- Choices are not offers.
- Do not imply application has been submitted in the frontend demo.

### 8.5 Document Readiness

Purpose:

- Make China-specific requirements visible.

Core checklist:

- Passport.
- Transcript.
- Graduation certificate.
- Language proof: IELTS / TOEFL / HSK / waiver.
- Study plan or personal statement.
- Recommendation letter.
- Medical form.
- Financial support proof.
- Translation / notarization.
- Under-18 guardian documents when relevant.

Design:

- Show the top blockers first.
- Use status chips:
  - `Ready`
  - `Missing`
  - `Needs translation`
  - `Needs review`
  - `Program-specific`

### 8.6 Deadlines And Intake

Purpose:

- Make deadline pressure personal and exact.

Content:

- Nearest program deadline.
- Scholarship deadline if earlier.
- Intake window.
- Document target date.
- Visa/JW preparation reminder.

Design:

- Timeline strip or compact event list.
- Amber for soon.
- Red/coral only for real blockers.

### 8.7 Scholarship Routes

Purpose:

- Help scholarship-sensitive students understand realistic paths.

Content:

- CSC route.
- University scholarship.
- City/province scholarship.
- Partial tuition waiver.
- Self-funded backup.

Rules:

- Never state guaranteed scholarship.
- Always distinguish source status:
  - `Verified`
  - `Needs date check`
  - `Estimate`

### 8.8 City And Cost Fit

Purpose:

- Make city choice practical, not aesthetic.

Content:

- Monthly cost estimate.
- Student-life fit.
- International airport/access.
- University concentration.
- Internship or industry signal.
- Language environment.

Design:

- 2-3 city cards or a horizontal city comparison.
- Connect to saved programs.

### 8.9 Agent Workspace

Purpose:

- Turn natural-language questions into page actions and next steps.

Hub-specific Agent prompts:

- `Check which saved route is most realistic`
- `Build a document plan for Fall 2026`
- `Compare Hangzhou and Nanjing for budget`
- `Find scholarship routes for my shortlist`

Behavior:

- Use the shared bottom composer.
- When the side panel opens, composer docks inside the panel.
- Hub content can expose Agent CTAs inside modules.

### 8.10 For You Feed

Purpose:

- Keep the Hub lively and useful without becoming generic marketing.

Feed categories:

- `Guide`
- `Deadline`
- `Scholarship`
- `City`
- `Document`
- `Student story`
- `Tool`

Good feed cards:

- `How to choose between famous university and realistic program`
- `What an English-taught route usually needs`
- `Before Oct 15: documents to check`
- `Lower-cost China cities with strong engineering routes`
- `Scholarship route: what full funding usually covers`

Avoid:

- random blog tiles;
- unrelated career content;
- salesy agency content;
- long text-heavy cards.

## 9. Recommended Page Layout

Desktop:

1. Shared header.
2. Hub masthead with profile context and compact Hub nav.
3. Personal alert strip.
4. Main content container.
5. Top area:
   - Left: Next best action.
   - Right: Application snapshot + profile completeness.
6. Middle area:
   - Shortlist/choices module.
   - Document readiness module.
   - Deadline timeline.
7. Discovery area:
   - For you carousel.
   - What's happening in China admissions.
8. Tools area:
   - Document checklist builder.
   - Budget and scholarship estimator.
   - City comparison.
   - Notes.
   - Ask Agent.
9. Footer separated by a thin line.

Mobile:

1. Header.
2. Hub title.
3. Horizontal Hub nav chips.
4. Next best action.
5. Snapshot cards.
6. Shortlist.
7. Documents.
8. Deadlines.
9. Feed.
10. Tools.

## 10. Visual Direction

The Hub can be more energetic than public search pages, but still mature.

Use:

- white page base;
- deep jade as identity;
- mint for ready states;
- amber/gold for deadlines and scholarships;
- coral sparingly for blockers;
- bright but controlled accent panels;
- real China campus/city imagery where it adds meaning;
- small illustrations for tools if they are custom or clearly branded CUAC;
- compact cards with 6-8px radius;
- strong title typography but not huge hero type.

Avoid:

- copying UCAS's blue block section;
- purple identity;
- one-note teal across every module;
- too many equal cards;
- oversized dashboard charts;
- fake celebratory graphics for serious blockers;
- text-heavy content cards.

Design rhythm:

- Task modules should feel calm and precise.
- Feed/tool modules can be more colorful and youthful.
- Use section bands sparingly to create rhythm.
- Keep vertical spacing tighter than a marketing homepage, looser than a dense admin UI.

## 11. Interaction Design

Required interactions:

- Hub tab navigation.
- Save/compare/choice state changes in frontend preview.
- Expand/collapse modules where content is secondary.
- For You carousel or horizontal scroll with visible controls.
- `Ask Agent` from key modules.
- Document status toggles in preview.
- Notes preview textarea or linked note card.
- Mobile-safe sticky Agent composer.

Avoid:

- hover-only interactions;
- hidden actions without visible labels;
- complex drag-and-drop;
- modals for core tasks;
- confetti or playful motion on serious application states.

Motion:

- 180-240ms fade/slide for module reveal.
- Slight card lift on hover.
- Carousel moves with snap, not dramatic animation.
- Respect `prefers-reduced-motion`.

## 12. Content Strategy

Hub copy should be short and practical.

Good tone:

- `Your nearest deadline is Oct 15.`
- `Transcript translation is the main blocker.`
- `This scholarship route needs date confirmation.`
- `You can still compare lower-cost cities before choosing.`

Avoid:

- `You are guaranteed admission.`
- `Perfect match.`
- `Apply now before it is too late!`
- long motivational copy.

## 13. Data Model For Frontend Preview

```ts
type HubPreviewState = {
  student: {
    name: string;
    initials: string;
    nationality?: string;
    targetDegree?: string;
    targetSubject?: string;
    targetIntake?: string;
    preferredLanguage?: string;
  };
  nextAction: {
    title: string;
    reason: string;
    facts: string[];
    primaryHref: string;
    secondaryAgentPrompt: string;
  };
  snapshot: {
    savedPrograms: number;
    comparedPrograms: number;
    choices: number;
    missingDocuments: number;
    nearestDeadlineDays: number;
  };
  shortlist: Array<{
    program: string;
    university: string;
    city: string;
    deadline: string;
    tuition: string;
    readiness: 'strong' | 'needs_review' | 'blocked';
    scholarshipSignal?: string;
  }>;
  documents: Array<{
    label: string;
    status: 'ready' | 'missing' | 'needs_translation' | 'needs_review';
    linkedProgram?: string;
  }>;
  feed: Array<{
    type: 'guide' | 'deadline' | 'scholarship' | 'city' | 'tool';
    title: string;
    body: string;
    href: string;
    visualStyle: 'calm' | 'bright' | 'image';
  }>;
};
```

Later backend mapping:

- `StudentProfile`
- `SavedProgram`
- `ProgramChoice`
- `DocumentReadiness`
- `ApplicationTask`
- `DeadlineEvent`
- `ScholarshipMatch`
- `AgentConversation`
- `HubFeedItem`

## 14. Implementation Scope

Frontend-only implementation should create:

- `design-lab/hub.html`
- `design-lab/hub.css`
- `design-lab/hub.js`
- public copies under `frontend/public`

Update:

- shared header account icon may route to `hub.html` when signed-in preview state is active.
- onboarding final step can route to `hub.html` instead of `home-v3.html#cuac-hub` once Hub exists.
- auth sign-in can route to `hub.html`.

Do not:

- create backend APIs;
- implement real auth;
- upload documents;
- store sensitive document data;
- show fake submission success as real;
- publish unless explicitly requested.

## 15. MVP Recommendation

For the first Hub implementation, build these modules:

1. Hub masthead with profile context.
2. Next best action.
3. Application snapshot.
4. Shortlist preview.
5. Document readiness.
6. Deadline timeline.
7. Scholarship/city route strip.
8. For You feed.
9. Tools section:
   - Budget estimator card.
   - Document checklist card.
   - City comparison card.
   - Notes card.
   - Ask Agent card.
10. Shared footer.

Leave full subpages as links or stubs for now.

## 16. Success Criteria

The Hub design is successful when:

- it clearly feels like the signed-in home after onboarding;
- it is useful even with only a few saved items;
- it tells the student one main next action;
- it includes discovery and tools without losing application focus;
- it reflects China-specific realities: program route, city cost, HSK/IELTS, scholarship, documents, visa/JW timing, source verification;
- it feels younger and more energetic than program search, but still trustworthy;
- it does not look like UCAS, even though it borrows the high-standard Hub pattern;
- it works on mobile;
- it can later connect to backend profile, saved programs, choices, documents, deadlines, and Agent APIs.

## 17. Polish Pass: First Screen And Flow

This pass should turn the Hub from a useful dashboard into a calmer student workspace.

Key changes:

- The first viewport should not repeat the same route status in multiple large modules. Use one primary route panel, then a compact status strip.
- The main story is `profile -> concrete route -> blockers -> application set`, not a generic analytics dashboard.
- `Start application` should mean starting from a concrete program choice, not from a vague school interest.
- Snapshot numbers should support the page, not compete with the main action.
- Saved routes, documents, and dates should be readable in one scan, with fewer repeated buttons.
- Agent prompts should be tied to immediate student actions: organize choices, build checklist, compare routes, or recover from risk.
- The lively area should remain, but every card must relate to China admissions: language route, city cost, funding realism, documents, and deadlines.

Design direction:

- White page, restrained teal system, limited gold/coral for meaningful risk.
- Fewer large cards in the first screen.
- Clearer section rhythm: welcome and route, status strip, work modules, personalized feed, tools.
- More energetic than an admin dashboard, but calmer than a marketing home page.
