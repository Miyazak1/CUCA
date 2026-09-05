# CUAC Notifications Page Design Spec

## Purpose

Notifications is not a generic inbox. It is the student's action center for China admissions: deadline risk, document blockers, saved-route changes, funding source updates, and Agent results that should lead to a next step.

The page should help an international high-school or early university applicant answer three questions quickly:

- What needs action now?
- What changed in my saved routes, documents, scholarships, or cities?
- What should I ask CUAC Agent to organize or explain next?

## User Context

Primary users are international students applying to Chinese universities, often with family or adviser involvement. They may not fully understand Chinese university application timing, document requirements, scholarship uncertainty, language routes, city cost, or the difference between saving a school and adding a concrete program choice.

The page should feel calm, young, and useful. Avoid dense administrative tables. Use short notification cards, clear severity, and one primary action per item.

## Information Model

Each notification should carry:

- Type: deadline, document, funding, agent, route, city, account
- Severity: urgent, action, update, done
- Title: one clear sentence
- Context: route, school, program, scholarship, city, or guide
- Time group: Today, This week, Earlier
- Primary action: open, review, build checklist, compare, ask agent
- Optional Agent prompt: prefilled question for the right-side Agent workspace
- Read/dismiss state: front-end demo only

## Page Structure

1. Hero summary
   - Title: Notifications
   - Short promise: "Act on what changed before it becomes deadline pressure."
   - Summary metrics: needs action, deadlines, document blockers, Agent results.

2. Priority action
   - One prominent card for the next best action.
   - Keep it visual and compact: icon, deadline/status chip, short copy, action buttons.

3. Filter row
   - All, Action needed, Deadlines, Documents, Funding, Agent, Updates.
   - Filters should reduce the list without changing layout.

4. Notification timeline
   - Group by Today, This week, Earlier.
   - Cards should be compact, not card-heavy grids.
   - Each row has icon, title, one-line detail, related entity, time, status, and actions.

5. Preferences / quiet settings
   - Small aside module for reminder channels and frequency.
   - Demo copy only; no backend.

## Agent Integration

Notifications should be one of the main Agent entry points. Agent can:

- Explain why an item matters.
- Build a document checklist from a notification.
- Compare affected routes.
- Estimate cost or funding risk.
- Navigate to the relevant page.
- Summarize all unread action items.

Demo behavior:

- "Ask Agent" buttons open the shared Agent panel with a prefilled prompt.
- Notifications page uses `data-agent-mode="notifications"` so future real logic can route prompts differently.
- Read/dismiss state is local to the page runtime.

## Visual Direction

- Use the shared CUAC header/footer and white page base.
- Keep the CUAC teal as the primary action color.
- Use restrained warm yellow only for deadline/funding warnings.
- Use pale blue for Agent output, pale mint for completed/verified updates, and soft coral for urgent blockers.
- Radius stays small: 6-8px.
- No heavy dashboard density. Use enough whitespace and strong type hierarchy.

## Front-End Scope

This version is static and front-end only:

- No real accounts, database, push notification service, or backend.
- Demo read/dismiss/filter states live in memory.
- Links route to existing static pages.
- Agent calls are simulated through the shared sidebar.

## Acceptance Notes

- Account dropdown Notifications opens `notifications.html`.
- Page is reachable from Hub and shared navigation account menu.
- Cards are shorter than Favourites page cards and grouped by time.
- The bottom Agent composer and right panel still work on this page.
- Footer spacing should end cleanly without large trailing blank space.
