# CUAC Agent Sidebar Interaction Spec

Date: 2026-08-13

Purpose: define the front-end interaction model for the CUAC Agent sidebar before connecting real backend, database, retrieval, or workflow APIs.

## Product Role

The Agent sidebar is not only a chat box. It is the student's guided China admissions workspace.

It should help international students turn uncertain goals into concrete actions across programs, universities, scholarships, cities, documents, and application choices. The sidebar must preserve the user's page context, explain its reasoning, show source-aware results, and provide clear page actions the student can accept or reject.

## Authentication And Context Boundary

The Agent experience must change by login state. This is a product boundary, not just a visual state.

Signed-out visitor:

- Context source: only the currently opened page, visible filters, visible result cards, and the current Agent prompt.
- Storage: volatile in-page memory only. Do not write to account memory, `localStorage`, or application state.
- Retention: cleared when the page is closed or refreshed.
- Allowed behavior: answer, explain, compare public data, prepare suggestions, and invite the visitor to sign in before saving or applying.
- Blocked behavior: saving routes, reading profile data, reading previous chats, adding application choices, using document readiness, or retaining history across pages.
- Sign-in required interaction: if a visitor clicks save, add choice, submit, mark document, or any other memory/application action, store a sign-in continuation and redirect to `auth.html`. Do not perform the action or create temporary saved state before authentication. After sign-in succeeds, return to the original page and continue the exact recoverable action the visitor started.

Signed-in student:

- Context source: account-owned study goal, onboarding answers, preferences, saved programs, universities, scholarships, cities, application choices, receipt status, school follow-up state, notifications, and student-visible Agent history.
- Storage: account-level Agent memory, later backed by authenticated APIs instead of demo local state.
- Retention: keep through the application lifecycle and clear only when the student manually clears memory, enrolls, or the cycle is archived.
- Allowed behavior: summarize long-running application state, propose next actions, prepare application choices, and update page state after explicit confirmation.
- Confirmation required: add, remove, reorder, submit, pay, send to schools, or clear long-term memory.

School staff:

- Context source: tenant-scoped CUAC records, visible queue filters, school-owned templates, and school staff action history.
- Storage: tenant session / audited staff workspace, never student private Agent memory.
- Retention: staff session or tenant policy.
- Blocked behavior: seeing a student's other school choices, other schools' queues, private student Agent memory, or unaudited cross-tenant summaries.

CUAC ops:

- Context source: platform health, catalog quality, routing health, payment health, support queues, and Agent audit summaries.
- Storage: internal audit memory.
- Retention: ops audit policy.
- Blocked behavior: raw cross-tenant access without justification and audit.

## Current Coverage

Existing prototypes already expose Agent entry points on:

- `home-v3.html`: natural-language study goal composer.
- `programs.html`: global Agent composer, intended for program search and comparison.
- `universities.html`: global Agent composer, intended for school and provider exploration.
- `scholarships.html`: funding goal composer.
- `cities.html`: city preference composer.
- `guides.html`: prompt starters for documents, HSK/IELTS, timeline, source status, and after-offer steps.
- `hub.html`: route, document, deadline, and next-action prompts.
- `application.html`: multi-choice application set prompts, add-choice help, document matrix planning, and risk/deadline organization.

Current limitation: the sidebar mostly shows a linear workflow animation. It needs richer result states, contextual information, action cards, source signals, and page-to-Agent handoff.

## Sidebar Information Architecture

The sidebar should have five stable zones.

1. Header

- Current mode: Search, Compare, Funding, City fit, Guide, Hub, Application.
- Student context summary: goal, intake, degree level, language route, city/budget if known.
- Close and collapse controls.

2. Conversation

- User messages.
- Agent responses.
- Follow-up chips.
- Loading, working, and interrupted states.
- Short answer first, details expandable.

3. Analysis Result

Structured result cards, depending on task:

- Program matches.
- University/program choice recommendation.
- Scholarship route comparison.
- City fit comparison.
- Document checklist.
- Deadline risk.
- Source verification.
- Application choice order.

4. Actions

Actions must be explicit and reversible:

- Add program to application set.
- Save program.
- Compare choices.
- Open matching programs.
- Open university.
- Open scholarship route.
- Build document plan.
- Confirm choice order.
- Mark document ready.
- Ask adviser / request review.

5. Sources and Confidence

Every high-impact answer should show:

- Source status: verified, estimate, needs check.
- Last checked date.
- University page / scholarship page / guide reference placeholder.
- Confidence label: high, medium, needs adviser review.
- Admission caveat: CUAC can guide and organize; universities make final decisions.

## Interaction Modes

### Ask Mode

Default chat behavior. The student asks a question and receives a concise answer plus next actions.

Examples:

- "Can I apply to computer science without HSK?"
- "Which city is cheaper, Hangzhou or Shanghai?"
- "What documents do I need before Oct 15?"

UI result:

- Direct answer.
- Related cards.
- Suggested next actions.

### Search Mode

Turns natural language into filters and results.

Inputs:

- Subject.
- Degree level.
- Teaching language.
- City preference.
- Budget.
- Intake.
- Scholarship preference.
- Document readiness.

Outputs:

- 3 to 5 program cards.
- Filter chips interpreted from the question.
- "Open results", "Add to application", "Compare".

### Compare Mode

Compares selected programs, universities, scholarships, or cities.

Outputs:

- Comparison table.
- Best fit summary.
- Risk notes.
- User-controllable weighting: cost, ranking, language, scholarship, deadline, document effort.

### Application Mode

Organizes a multi-choice application set.

Inputs:

- Selected choices.
- Student profile.
- Document readiness.
- Target intake.
- Funding preference.

Outputs:

- Main / backup / funding-sensitive / risky roles.
- Shared document plan.
- Program-specific blockers.
- Earliest deadline.
- Next single action.

Actions:

- Confirm order.
- Add choice.
- Remove choice.
- Ask why.
- Build document matrix.
- Open specific choice.

### Guide Mode

Turns guides into actionable checklists.

Outputs:

- Timeline steps.
- Document explanation.
- HSK/IELTS pathway.
- Visa/JW/arrival checklist.

Actions:

- Add to Hub checklist.
- Open relevant guide section.
- Ask follow-up.

## Request Types The Demo Must Cover

The Agent must support more than "recommend a program". International students will ask many different kinds of questions while browsing. The demo should simulate the following request types with believable front-end results.

### 1. Direct Information Q&A

Purpose: answer a factual question using CUAC site data or guide content.

Examples:

- "Do I need HSK for English-taught computer science?"
- "What is a JW form?"
- "What documents do Chinese universities usually need?"
- "Can I apply without IELTS?"

Demo response:

- Short answer.
- Key conditions.
- Related source notes.
- Links to guides or relevant pages.

UI pattern:

- `AgentAnswer`
- `AgentSourceNote`
- `AgentActionBar`

### 2. Information Collection And Summary

Purpose: gather scattered information from programs, universities, scholarships, cities, and guides, then summarize.

Examples:

- "Summarize my saved programs."
- "Tell me what I need before Oct 15."
- "Which of my choices are English-taught?"
- "What does Zhejiang University need from me?"

Demo response:

- Summary bullets.
- Entity cards.
- Missing fields.
- Suggested next action.

UI pattern:

- `AgentSummaryCard`
- `AgentChecklist`
- `AgentChoiceCard`

### 3. Analysis And Recommendation

Purpose: compare multiple options and recommend a path.

Examples:

- "Which program should be my main choice?"
- "Should I choose Hangzhou or Shanghai?"
- "Which scholarship route is realistic?"
- "Which choices are too risky?"

Demo response:

- Recommendation.
- Reasons.
- Trade-off table.
- Confidence and source status.

UI pattern:

- `AgentCompareTable`
- `AgentRecommendationCard`
- `AgentSourceNote`

### 4. Calculation

Purpose: calculate estimated cost, timeline, document effort, or readiness.

Examples:

- "How much will one year in Hangzhou cost?"
- "Compare Shanghai and Nanjing monthly cost."
- "How many days do I have before my earliest deadline?"
- "What is my application readiness?"

Demo response:

- Calculation result.
- Inputs used.
- Assumptions.
- Editable chips or sliders in later implementation.

UI pattern:

- `AgentCalculationCard`
- `AgentAssumptionList`
- `AgentActionBar`

Demo calculation examples:

- Annual cost = tuition + monthly city estimate * 12 + setup cost.
- Deadline days = deadline date - current date.
- Readiness = completed required items / total required items.
- Document effort = shared documents + program-specific blockers.

### 5. Navigation

Purpose: route the user to the right page or section.

Examples:

- "Show me programs in Hangzhou."
- "Open my application set."
- "Where do I check documents?"
- "Take me to scholarships for this program."

Demo response:

- Short confirmation.
- Destination preview.
- Navigation action button.

UI pattern:

- `AgentNavigationCard`
- `AgentActionBar`

Demo actions:

- Open `programs.html`
- Open `universities.html`
- Open `scholarships.html`
- Open `cities.html`
- Open `guides.html#documents`
- Open `application.html`
- Open `hub.html`

### 6. Front-End Execution

Purpose: simulate actions the Agent can take for the student.

Examples:

- "Add this program to my application."
- "Save this university."
- "Mark passport ready."
- "Organize my choices."
- "Build my document checklist."

Demo response:

- Preview of action.
- Confirmation button.
- Applied state.
- Undo action.

UI pattern:

- `AgentActionPreview`
- `AgentAppliedToast`
- `AgentUndoButton`

Important rule:

In demo stage, actions should update local front-end UI only. They must not imply real submission, real university communication, or real backend persistence.

### 7. Clarification

Purpose: ask for missing information when the question is too broad.

Examples:

- "Help me study in China."
- "Find the best university."
- "Can I get scholarship?"

Demo response:

- One short clarification.
- 3 to 5 chips.
- Option to search broadly.

UI pattern:

- `AgentClarifyChips`
- `AgentAnswer`

### 8. Risk And Escalation

Purpose: handle uncertain or high-impact decisions responsibly.

Examples:

- "Will I definitely get scholarship?"
- "Can I submit after deadline?"
- "Is this source official?"
- "Can I use unofficial transcript?"

Demo response:

- Risk warning.
- Source status.
- Adviser review suggestion.
- Safer next step.

UI pattern:

- `AgentRiskCard`
- `AgentSourceNote`
- `AgentActionBar`

## Demo Simulation Matrix

The demo should include fixed scenario fixtures. Each scenario has a trigger prompt, visible result, and optional fake action.

| Page | Scenario | Trigger | Result | Fake Actions |
| --- | --- | --- | --- | --- |
| Home | Natural language search | "English-taught computer science in Hangzhou" | Parsed chips + 3 route cards | Open programs, save goal |
| Home | Broad unclear goal | "I want to study in China" | Clarification chips | Choose degree, choose subject |
| Programs | Program recommendation | "Find CS master under RMB 45k" | Program cards with tuition/deadline/source | Add to application, compare |
| Programs | Program explanation | "Why is this program a good fit?" | Fit reasons + blockers | Add, ask follow-up |
| Programs | Document burden | "Which programs need fewer documents?" | Ranked list by effort | Open low-effort programs |
| Universities | School exploration | "Tell me about Zhejiang University" | School strengths + matching programs | View programs |
| Universities | Specific program route | "Does ZJU have English CS master?" | Concrete program card | Add to application |
| Scholarships | Funding search | "Full scholarship for CS master" | CSC/university/city routes | Find matching programs |
| Scholarships | Funding realism | "Can I rely on CSC?" | Risk explanation | Add funding check |
| Cities | Cost calculation | "How much is Hangzhou for a year?" | Annual cost estimate | Compare cities |
| Cities | City comparison | "Hangzhou or Shanghai?" | Cost/lifestyle/opportunity table | Open city programs |
| Guides | Document Q&A | "Do I need certified translation?" | Guide answer + checklist | Add to checklist |
| Guides | Timeline | "What should I do before Oct 15?" | Timeline tasks | Add to Hub |
| Hub | Next action | "What should I do next?" | One prioritized action | Open application, build plan |
| Hub | Status summary | "Summarize my progress" | Saved choices/docs/deadlines | Open blockers |
| Application | Choice ordering | "Organize my choices" | Main/backup/funding roles | Confirm order, undo |
| Application | Add choice help | "Help me add another program" | Database-backed suggestions | Select program, add choice |
| Application | Document matrix | "What docs are shared?" | Shared vs program-specific matrix | Mark ready, open guide |
| Application | Cost across choices | "Which choice is cheapest?" | Tuition + city estimate table | Reorder choices |

## Demo Scenario Coverage Standard

The demo stage should feel like a capable admissions Agent even without backend or database integration. It should therefore cover breadth through believable front-end fixtures, not through real automation claims.

The Agent must simulate these user-demand groups:

### A. Ask And Answer

Student intent:

- Understand a term, requirement, process, or route.
- Ask about HSK, IELTS, JW form, visa, documents, intake, scholarship, city cost, or university fit.

Demo behavior:

- Return a concise answer.
- Show conditions and source status.
- Offer a guide/page action.

Example prompts:

- "Do I need HSK for English-taught computer science?"
- "What documents do Chinese universities need?"
- "What is JW form?"
- "Can I apply without IELTS?"

### B. Collect, Organize, And Summarize

Student intent:

- Ask the Agent to gather existing site/application information and make it understandable.

Demo behavior:

- Summarize saved routes, documents, deadlines, city costs, and readiness.
- Show missing information and next action.
- Keep the answer short enough to scan in the sidebar.

Example prompts:

- "Summarize my saved programs."
- "What is my progress?"
- "What should I fix before Oct 15?"
- "Which choices are English-taught?"

### C. Analyze And Recommend

Student intent:

- Compare options and ask what is more realistic.

Demo behavior:

- Show a recommendation, trade-off table, confidence/source note, and reversible action.
- Separate "best fit" from "famous school".

Example prompts:

- "Which program should be my main choice?"
- "Hangzhou or Shanghai?"
- "Which scholarship route is realistic?"
- "Which choices are risky?"

### D. Calculate

Student intent:

- Ask for estimated cost, readiness, timeline, or document effort.

Demo behavior:

- Show a calculation card with formula and assumptions.
- Never hide estimates as facts.
- Offer save/compare actions.

Example prompts:

- "How much is one year in Hangzhou?"
- "Which choice is cheapest?"
- "How many days until my deadline?"
- "What is my readiness?"

### E. Navigate

Student intent:

- Ask to open the right page or section.

Demo behavior:

- Preview the destination and reason.
- Route to the correct static page or anchor.
- Optionally apply local filters after the student accepts.

Example prompts:

- "Show me Hangzhou programs."
- "Take me to documents."
- "Open my application."
- "Where can I compare scholarships?"

### F. Execute Local Front-End Actions

Student intent:

- Ask the Agent to do something lightweight in the interface.

Demo behavior:

- Dispatch a shared action event.
- Let the current page update visible local state.
- Show an action log and undo.
- Never imply real submission or persistence.

Example prompts:

- "Add this program to my choices."
- "Save these routes."
- "Mark passport ready."
- "Organize my choices."
- "Build my document checklist."

### G. Risk, Boundary, And Adviser Escalation

Student intent:

- Ask high-impact or uncertain questions.

Demo behavior:

- Show a caution state.
- Explain what is known, what needs official/adviser review, and the safest next step.
- Avoid guarantees for admission, scholarship, visa/legal, deadlines, or policy exceptions.

Example prompts:

- "Will I definitely get CSC?"
- "Can I submit after the deadline?"
- "Is this official?"
- "Can I use an unofficial transcript?"

## Demo Scenario Router Requirements

The prototype should include a small local scenario router in the shared shell. It does not need real language understanding yet, but it should classify prompts into the visible result modes below.

Required classifications:

- `clarify`: broad or vague goal.
- `answer`: direct information answer.
- `summary`: saved route / Hub / progress summary.
- `programs`: concrete program routes.
- `university_summary`: school fit and available programs.
- `recommendation`: scholarship or route recommendation.
- `city_compare`: city trade-off.
- `calculation`: cost, readiness, document effort, or timeline.
- `deadline_plan`: date-driven action list.
- `checklist`: document or application checklist.
- `navigation`: route to a page or section.
- `action`: front-end operation preview.
- `choices`: application choice strategy.
- `risk`: caution and adviser/source escalation.

Minimum demo prompt set:

| Capability | Prompt | Expected visible result |
| --- | --- | --- |
| Clarify | "I want to study in China" | Clarification chips |
| Answer | "Do I need HSK for English-taught CS?" | Short answer + guide link |
| Summary | "Summarize my progress" | Saved route + blockers |
| Programs | "Find computer science master in Hangzhou" | Route cards |
| University | "Tell me about Zhejiang University" | School/program route cards |
| Scholarship | "Can I get CSC?" | Funding route + risk note |
| City | "Hangzhou or Shanghai?" | City comparison |
| Calculation | "How much is Hangzhou for one year?" | Cost formula |
| Timeline | "What should I do before Oct 15?" | Deadline checklist |
| Navigation | "Open my documents" | Destination preview + link |
| Execution | "Save these routes" | Local state update + undo |
| Application | "Organize my choices" | Main/backup/funding roles |
| Risk | "Will I definitely get scholarship?" | Caution + source/adviser step |

This coverage is enough for demo storytelling because it shows the Agent as a cross-site admissions helper, not just a chatbot. The actual production Agent can later replace the router with retrieval, tool calls, policy checks, database writes, and adviser workflow.

## Demo Fixture Requirements

The front-end prototype should include a small local fixture library, even before real APIs.

### Program Fixture

- `programId`
- `programName`
- `universityId`
- `universityName`
- `city`
- `degreeLevel`
- `teachingLanguage`
- `intake`
- `tuition`
- `deadline`
- `scholarshipSignals`
- `documentRequirements`
- `sourceStatus`

### University Fixture

- `universityId`
- `name`
- `city`
- `strengths`
- `verifiedRoutes`
- `programIds`
- `sourceStatus`

### Scholarship Fixture

- `scholarshipId`
- `name`
- `type`
- `coverage`
- `deadline`
- `eligibleDegree`
- `linkedProgramIds`
- `sourceStatus`

### City Fixture

- `cityId`
- `name`
- `monthlyCost`
- `pace`
- `internshipSignal`
- `climate`
- `studentSupportSignal`

### Student/Application Fixture

- `goal`
- `degreeLevel`
- `subject`
- `intake`
- `languagePreference`
- `budget`
- `savedProgramIds`
- `applicationChoices`
- `documents`
- `readiness`

## Demo Agent Result Types

Each simulated response should declare a `resultType` so the front-end can render the correct component.

```json
{
  "resultType": "calculation",
  "title": "Estimated first-year cost in Hangzhou",
  "summary": "Around RMB 85k for one academic year before travel.",
  "items": [],
  "actions": []
}
```

Recommended result types:

- `answer`
- `clarification`
- `program_results`
- `university_summary`
- `scholarship_routes`
- `city_compare`
- `document_checklist`
- `deadline_plan`
- `application_choices`
- `calculation`
- `navigation`
- `risk_warning`
- `action_preview`
- `action_applied`

## Demo Action Contract

All demo actions should share one simple front-end contract.

```json
{
  "actionId": "add_zju_cs_to_application",
  "type": "add_choice",
  "label": "Add ZJU Computer Science MSc",
  "confirmation": "Add this specific program to your application set?",
  "payload": {
    "programId": "zju-cs-msc",
    "universityId": "zju",
    "intake": "fall-2026"
  },
  "demoEffect": {
    "target": "applicationChoices",
    "operation": "append"
  }
}
```

Supported demo action types:

- `navigate`
- `add_choice`
- `save_program`
- `save_university`
- `compare`
- `mark_document_ready`
- `build_document_plan`
- `confirm_choice_order`
- `remove_choice`
- `reorder_choice`
- `add_checklist_item`
- `undo`

## Agent Can Handle Many Questions If It Has Boundaries

The demo should make Agent feel broadly helpful, but bounded.

It can confidently handle:

- Questions answerable from CUAC pages and fixtures.
- Program, university, scholarship, city, guide, Hub, and application context.
- Calculations based on shown assumptions.
- Front-end actions that are reversible.

It should show a caution state for:

- Guaranteed admission or scholarship.
- Official policy certainty without source.
- Visa/legal certainty.
- Deadline exceptions.
- Medical, legal, or financial promises.

For these, the UI should return:

- "Needs official/adviser review"
- Source status
- Safer next action

## Page-Specific Agent Responsibilities

### Home

Goal: convert a broad natural language study goal into a useful starting route.

Agent should:

- Parse intent.
- Suggest entry path: Programs, Universities, Scholarships, Cities, Guides, or Hub.
- Show first 3 matching routes.
- Offer "Start search" and "Save this goal".

### Programs

Goal: help students find and understand concrete school-program combinations.

Agent should:

- Convert natural language into filters.
- Explain why a program appears.
- Add a concrete program to application set.
- Compare programs by tuition, deadline, teaching language, document burden, city, source status.
- Warn when a program is not enough information to apply.

Key action:

- `Add to application set` must add a specific `universityId + programId + intakeId + languageRoute`.

### Universities

Goal: help students explore schools, but route them to concrete programs before applying.

Agent should:

- Explain university strengths.
- Show available programs under that university.
- Compare schools by city, English routes, scholarship availability, source status.
- Prevent "add university to application" without selecting a specific program.

Key action:

- `View programs at this university`.

### Scholarships

Goal: separate funding interest from guaranteed admission.

Agent should:

- Compare CSC, university, city/province, tuition waiver, and partial award routes.
- Show coverage, degree fit, deadline, source status.
- Link scholarships to matching programs.
- Warn that funding routes need independent verification.

Key actions:

- `Find matching programs`.
- `Add funding check to application choice`.

### Cities

Goal: connect lifestyle and budget to realistic application choices.

Agent should:

- Compare monthly cost, city pace, internships, climate, campus distribution.
- Recommend cities that fit budget and subject.
- Link city recommendations to programs.

Key actions:

- `Open programs in this city`.
- `Compare city cost for selected choices`.

### Guides

Goal: convert explanatory content into the next checklist step.

Agent should:

- Explain documents, HSK/IELTS, timeline, visa/JW, source status.
- Convert answer into checklist items.
- Link to related programs or application set.

Key action:

- `Add to checklist`.

### Hub

Goal: maintain the student's personalized command center.

Agent should:

- Read saved programs, documents, deadlines, onboarding profile, and application choices.
- Recommend one next action.
- Summarize route readiness.
- Explain blockers.

Key actions:

- `Start application`.
- `Build document plan`.
- `Open deadline`.

### Application

Goal: manage concrete application choices and preparation work.

Agent should:

- Organize multiple selected program choices.
- Recommend main/backup/funding/risk roles.
- Explain why a role was assigned.
- Build document matrix.
- Help add specific programs from the program database.
- Review whether the set is balanced.

Key actions:

- `Confirm choice order`.
- `Add specific program`.
- `Remove choice`.
- `Build shared document plan`.
- `Check source`.

## Required Front-End States

The sidebar should support these visible states before backend integration:

- Empty ready state.
- User message submitted.
- Working state with staged steps.
- Result state with structured cards.
- Error / unable to answer.
- Needs clarification.
- Needs source check.
- Action pending confirmation.
- Action applied.
- Action undone.
- Collapsed with summary badge.

## Required Result Components

Create reusable front-end result components:

- `AgentAnswer`: short explanation.
- `AgentSourceNote`: source status and checked date.
- `AgentProgramCard`: specific university-program route.
- `AgentChoiceCard`: application choice role and risk.
- `AgentCompareTable`: compact comparison.
- `AgentChecklist`: document or timeline tasks.
- `AgentActionBar`: primary and secondary actions.
- `AgentClarifyChips`: follow-up questions.
- `AgentAppliedToast`: action success feedback.

## Data Contracts For Future Integration

These are front-end-facing shapes, not backend implementation.

### Agent Request

```json
{
  "mode": "application",
  "prompt": "Organize my China application choices",
  "page": "application.html",
  "context": {
    "studentProfile": {},
    "selectedChoices": [],
    "savedPrograms": [],
    "documents": [],
    "filters": {},
    "visibleEntity": {}
  }
}
```

### Agent Response

```json
{
  "answer": "Your current set should use ZJU as the main route...",
  "confidence": "medium",
  "sourceStatus": "mixed",
  "cards": [],
  "actions": [],
  "followUps": []
}
```

### Agent Action

```json
{
  "type": "add_choice",
  "label": "Add ZJU Computer Science MSc",
  "payload": {
    "universityId": "zju",
    "programId": "cs-msc",
    "intakeId": "fall-2026",
    "languageRoute": "english"
  },
  "requiresConfirmation": true
}
```

## Interaction Principles

- The sidebar should never hide uncertainty.
- The first answer should be short; details should expand.
- Every recommendation should explain why.
- Every action should be reversible in the front-end prototype.
- Applying means a concrete program choice, never only a university.
- Scholarship advice must avoid implying guaranteed funding.
- Source status should be visible on decisions that affect time or money.
- The student should always know the next single action.

## Implementation Phasing

### Phase 1: Front-End Prototype

- Add structured result area to `shared-shell.js`.
- Add fake result cards per mode.
- Add action buttons with visual state only.
- Keep bottom composer and right-panel composer behavior.
- Add page context labels and result components.

### Current Prototype Status

Implemented in the design-lab static prototype:

- `shared-shell.js` now includes a demo scenario router that maps prompts to result types:
  - program routes
  - application choices
  - document checklist
  - cost calculation
  - city comparison
  - scholarship route
  - language route
  - clarification
- The Agent panel now supports:
  - structured result cards
  - checklists
  - comparison tables
  - calculation cards
  - action buttons
  - local toast feedback
  - action log entries
  - page-level undo events for simulated local actions
- Agent actions dispatch a shared `cuac:agent-action` event.
- Protected actions use the shared role-aware sign-in continuation flow:
  - public visitors keep only current-page Agent context;
  - registered add-choice and protected workspace navigation actions create a short-lived PostgreSQL continuation before redirecting to `auth.html`;
  - the Auth page supports one account sign-in flow across Student, School staff, and CUAC staff access contexts; self-registration creates only a Student account, while school and CUAC staff permissions require an existing approved membership or internal grant;
  - unauthenticated identity is unknown; the Auth page shows access context choices so the user can choose Student, School staff, or CUAC staff before continuing;
  - authentication is resolved from `GET /api/v1/me` and an HttpOnly server session; static page attributes and browser storage are never identity or role authority;
  - continuation payloads are limited to whitelisted navigation and catalog UUID references; the one-time token is carried only in the URL fragment, removed immediately by the Auth page, and never written to browser storage;
  - after sign-in succeeds, the Auth page consumes the continuation against the original guest browser session, active role, expiry, and current server registry before navigating once;
  - prototype-only save, checklist, and cost-estimate actions do not claim resumability until their real account APIs exist.
- Signed-in student context is visibly upgraded from volatile page context to account-level Agent memory, and Preferences exposes a confirm-before-clear Agent memory control.
- School staff and CUAC Ops actions are separated from student sign-in. School Agent mode uses tenant-scoped records only, and high-risk school or Ops Agent actions require confirmation before any local state changes.
- Page-specific front-end handlers are implemented for:
  - `application.html`: open/prefill add-choice modal, confirm order, document matrix update.
  - `programs.html`: smart filters, save shortlist, compare routes, route to application.
  - `universities.html`: smart filters and save universities.
  - `hub.html`: compare saved routes, update documents/readiness, route to application.
  - `scholarships.html`: funding filters, save scholarship routes, open focused route.
  - `cities.html`: lower-cost city filtering, budget estimate, route to programs.
  - `guides.html`: document checklist highlighting and guide-section navigation.
- Shared fallback routing exists for actions that the current page does not handle.
- Undo is implemented through `cuac:agent-undo` with page-level snapshots for current prototype pages.

Still prototype-only:

- All actions are local and simulated.
- No backend persistence, real agent call, database write, university communication, or real submission exists.
- Authentication and registered sign-in continuation now use real server sessions, PostgreSQL state, selected surfaces, tenant membership, internal grants, one-time consumption, and transactional audit. Agent-originated business writes remain prototype-only and must move to governed Tool Gateway calls after the corresponding core APIs are production ready.
- Undo restores front-end prototype state only. It is not a real transaction rollback and does not cover fallback navigation after a page unload.

### Phase 2: State Wiring

- Store selected choices, saved programs, and checklist state in front-end state.
- Let Agent actions update visible page modules.
- Add undo for applied actions.

### Phase 3: Real Data Integration

- Connect program/university/scholarship/city data.
- Replace static result cards with API responses.
- Add source metadata and checked dates.

### Phase 4: Real Agent Workflow

- Connect retrieval, reasoning, tool calls, and adviser review workflows.
- Add long-running task state.
- Add notifications and Hub persistence.

## Open Design Questions

- Should the sidebar keep a persistent thread per student, per page, or per application set?
- Should actions apply immediately after confirmation, or always create a preview first?
- Should adviser review be a first-class action inside Agent results?
- How many choices should one application set allow for CUAC's business model?
- Should scholarship choices be attached to programs or managed as separate funding routes?

## Next Front-End Work

1. Build a demo Agent scenario router in `shared-shell.js`.
2. Match common prompts to fixed `resultType` fixtures.
3. Update the Agent panel from workflow-only to conversation + result + actions.
4. Add reusable result components for answer, program cards, comparison, checklist, calculation, navigation, and risk.
5. Add `data-agent-context` hooks on important page modules.
6. Add fake action feedback: preview, confirmation, applied, undo, and open page.
7. Add application-specific demo actions for choice ordering, add choice, remove choice, and document matrix.
8. Add calculation fixtures for cost, deadline days, readiness, and document effort.
9. Keep all demo actions local and reversible until real persistence exists.
