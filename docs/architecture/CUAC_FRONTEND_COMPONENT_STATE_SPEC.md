# CUAC Frontend Component State Spec

Date: 2026-08-12

Status: revised after UCAS reference audit.

Purpose: define component states and interaction behavior for the planning-first CUAC frontend. Components must support production-quality frontend behavior even while data is mocked locally.

## 1. State Principles

Use state to clarify student progress, not to decorate the UI.

Global state names:

- `idle`
- `hover`
- `focus`
- `active`
- `selected`
- `pending`
- `success`
- `warning`
- `danger`
- `error`
- `disabled`
- `empty`
- `stale`
- `locked`

Async props:

- `isPending`
- `pendingActionId`
- `error`
- `lastUpdatedAt`
- `sourceStatus`

Rules:

- State changes must not resize core controls.
- Disabled controls must explain why.
- Important state changes should be visible in the related component, not only in a toast.
- Reduced-motion mode must preserve information while removing movement.

## 2. Search Gateway Components

### CompletionDetailState

Use on Program, University, Scholarship, City, and Guide detail pages before the production API layer exists.

States:

| State | Behavior |
| --- | --- |
| loading | show a stable skeleton, preserve the route type, and keep Back available |
| ready | render the full detail page from `CuacDataClient` or the normalized fallback |
| empty | explain that no matching CUAC record was found and route back to the relevant catalog |
| error | explain that detail data failed to load and provide Retry, Back to catalog, and Agent help |

Rules:

- Loading, empty, and error states must not masquerade as successful detail content.
- Actions must keep the student oriented to the original route type.
- Reduced-motion mode disables skeleton animation without removing the loading structure.
- Production API integration should reuse the same visible states rather than inventing page-specific failure copy.

### AuthAccountState

Use on the unified Auth page and shared continuation flow.

States:

| State | Behavior |
| --- | --- |
| signed_out | public browsing and current-page guest Agent context only |
| sign_in_required | redirect protected actions to `auth.html` and keep the original action pending |
| signed_in_preview | update shell state, return to the saved page, and continue the pending action in the frontend demo |
| recovery_requested | send a preview reset state while preserving the saved continuation |
| verification_pending | new registration records that email verification is required before long-term workspace memory |

Rules:

- Protected actions should return the user to the originating page/action after sign-in.
- Password recovery on the Auth page must preserve the pending action so the user can still sign in and continue.
- School and Ops account recovery/registration copy must preserve their separate account boundary.
- Production auth must replace local preview state with real sessions, email delivery, invitations, MFA where needed, and server-side role checks.

### NotificationEventState

Use when application, school, Agent, preference, or catalog events need to become student-visible notifications.

States:

| State | Behavior |
| --- | --- |
| event_created | store a normalized notification event with stable id, category, title, action, and route |
| visible | merge event-store notifications above baseline reminders in Notifications |
| filtered | hide only by user category preference or active tab |
| read | keep the item visible but reduce urgency |
| dismissed | remove the item from the current notification list |

Rules:

- Application submission and school first-contact events must appear in the student Notifications center.
- School-originated notification copy must not expose the student's other school choices.
- Notification preferences should filter categories, not delete the underlying event history.
- Read and dismissed notification states should persist across reloads in the frontend demo.
- Production should replace local event storage with server-side delivery, read receipts, and audit-backed school events.

### AgentActionConfirmationState

Use for Agent actions whose registry entry sets `confirmationRequired`.

States:

| State | Behavior |
| --- | --- |
| prepared | Agent proposes a controlled action but has not changed page state |
| confirmation_required | show an in-panel confirmation card with risk and audit context |
| confirmed | dispatch the page action event and allow the page to update local demo state |
| cancelled | remove the confirmation card without changing page state |
| blocked | show policy or sign-in reason without dispatching the action |

Rules:

- High-risk Agent actions must not update application, school, payment, export, or Ops state before confirmation.
- Confirmation copy should name the action risk and audit event.
- Student `submit-application` should open the payment/send modal only after confirmation; it should not send to schools until the student completes the modal action.
- School Agent actions stay tenant-scoped after confirmation.
- Production should pair confirmation with server-side authorization, audit logs, and idempotency for state-changing operations.

### PaymentSubmissionState

Use on Application and Billing.

States:

| State | Behavior |
| --- | --- |
| preview | fee can be reviewed but no school record has been sent |
| failed-preview | payment failed, choices remain saved, and schools receive nothing |
| paid-demo | payment was completed in preview and the application set was sent |
| free-submitted | no fee was due and the application set was sent |

Rules:

- Payment failure must not create school records or imply submission.
- Billing must reflect the same payment state saved by Application.
- Payment failures should create a student-visible notification event.
- Production must replace preview state with provider status, webhook signature checks, idempotency, receipts, refund handling, and reconciliation.

### NaturalLanguagePlannerInput

Use on Home as the primary first action.

States:

| State | Behavior |
| --- | --- |
| idle | prompt input, example chips, and `Find routes` button visible |
| focused | border/shadow strengthens |
| dirty | clear button appears and submit is enabled |
| interpreting | button and inline status show mock pending state |
| understood | extracted route chips appear or are passed to Program Search |
| empty_error | inline hint says what kind of goal to type |

Rules:

- Empty submit keeps focus in the input.
- Placeholder examples should sound like student goals: `English-taught CS master under RMB 40k`, `No HSK and scholarship preferred`, `Medicine in Chengdu`.
- Submit navigates to `/programs` with query/filter params after a short mocked interpreting state.
- Interpreted chips are visible, removable, and never presented as guaranteed eligibility.
- The submit button width stays stable.
- Latest submitted prompt wins; stale interpretation results are ignored.
- Pressing Enter submits on single-line input. If implementation uses textarea, Shift+Enter creates a line break and Enter submits.
- The component must disclose frontend-only mock behavior in internal copy/state names, but not with clumsy in-page demo disclaimers.

### GlobalAgentComposer

Use globally in the shared shell on every student-facing page. It is the persistent bottom-center natural-language composer, separate from the Home hero input, so a student can start or refine a study goal from Home, Universities, Program Search, Detail, Guides, or Hub.

States:

| State | Behavior |
| --- | --- |
| visible | bottom composer is usable without covering primary content |
| focused | expands enough for editing without covering headings |
| submitting | mirrors `NaturalLanguagePlannerInput` pending state |
| docked_in_panel | same composer appears at the bottom of the Agent Workspace for follow-up questions |
| footer_hidden | hidden near the footer bottom so legal links and footer actions stay usable |

Rules:

- Lives in `shared-shell.css` and `shared-shell.js`, not in individual pages.
- Shares value and pending state with `NaturalLanguagePlannerInput` when a page has a hero or page-level planner.
- Desktop position is fixed at the bottom-center of the viewport, centered to page content width.
- When `AgentWorkspacePanel` is open, move the same composer into the panel bottom rather than creating a second input.
- Mobile position is conservative: bottom compact prompt or collapsed pill; hide while keyboard is open.
- It must not cover nav, section headings, filters, pagination, footer links, or primary buttons.
- Reduced-motion mode uses instant visibility change.

### AgentWorkspacePanel

Use globally after the student submits a natural-language goal from the global composer or any page-level planning input.

States:

| State | Behavior |
| --- | --- |
| hidden | panel has not been opened yet |
| opening | slides in from the right with focusable content |
| running | workflow steps advance or highlight |
| collapsed | panel is hidden and a small right-edge `Agent` reopen control is visible |
| reopened | panel restores the last goal and step state |
| reduced_motion | panel appears without slide movement |

Required workflow steps:

- Understand intent.
- Search matching programs.
- Compare city and cost context.
- Check language, document, deadline, and scholarship readiness.
- Prepare next action.

Rules:

- Panel opens only after submit.
- Panel is a custom CUAC UI, even if future runtime uses Alibaba PageAgent or PageAgentCore behind it.
- Panel can collapse and reopen without losing the current goal.
- While open, the same `GlobalAgentComposer` is docked inside the panel footer so the student can continue asking follow-up questions.
- In frontend-only mode, workflow is mocked and must not claim real AI/adviser evaluation.
- Future PageAgent-style operation must be constrained to page actions such as applying filters, opening matching programs, saving, comparing, or opening Hub.
- Do not make PageAgent the admissions decision layer; CUAC domain logic remains responsible for matching and readiness.

### GlobalSearchBar

States:

| State | Behavior |
| --- | --- |
| idle | input and search button visible |
| focused | border/shadow strengthens |
| dirty | clear button appears |
| submitting | button shows pending state |
| empty_error | inline hint says what to search |

Rules:

- Empty submit keeps focus in the input.
- Placeholder examples should be specific: `Computer science, MBBS, business, Zhejiang`.
- Submit navigates to `/programs?q=...`.
- Search button width stays stable.
- Use this for Program Search and secondary search contexts; Home should use `NaturalLanguagePlannerInput`.

### BrowseCategoryTile

Required categories:

- Courses
- Universities
- Scholarships
- Deadlines
- City guides
- English-taught
- Late intake

States:

- `idle`
- `hover`
- `focus`
- `pressed`
- `selected` when current filter/page matches

Rules:

- Tiles are navigation controls, not decorative cards.
- Each tile has label, short count/status if available, and route/filter target.
- Icons are allowed, but text must remain primary.

### DeadlineStrip

States:

| State | Text Example | Behavior |
| --- | --- | --- |
| open_cycle | `Fall 2026 applications are open` | neutral |
| attention | `3 deadlines need attention` | amber |
| urgent | `1 deadline closes tomorrow` | red/coral |
| quiet | no current deadline pressure | can be hidden on non-home pages |

Rules:

- Always show exact date in expanded/hover/tap state.
- Click navigates to deadline-filtered search or deadline timeline.
- Never flash.

## 3. Program Search Components

### ProgramSearchHeader

Contains:

- query input
- result count
- sort select
- list/grid toggle
- active filter summary

States:

- `idle`
- `searching`
- `empty`
- `error`

Rules:

- Keep previous results visible while `searching`.
- Result count crossfades but does not shift layout.
- Sort and view toggle preserve URL filters.

### FilterRail / FilterDrawer

Filter groups:

- Course type/year
- Degree level
- Subject
- Teaching language
- Intake
- City/province
- Tuition
- Scholarship
- Deadline
- Documents/tests
- Source verification
- Late intake

States:

| State | Behavior |
| --- | --- |
| idle | filters available |
| dirty | active chips visible |
| pending_results | show small pending count indicator |
| empty_results | show relax filters |
| drawer_open | mobile focus trapped |
| drawer_closing | return focus to opener |

Rules:

- Filters update URL params.
- Keyword input is debounced by 250-350 ms.
- Latest request wins.
- Mobile drawer primary action is `Show N programs`.
- `Relax filters` removes strict filters in this order: document burden, scholarship, deadline, city, subject.

### ActiveFilterChips

States:

- `empty`
- `has_filters`
- `pending_remove`

Rules:

- Chips are removable buttons.
- Removing a chip updates URL and result count.
- Long labels truncate with tooltip.

### ProgramResultRow

Props:

- `program`
- `university`
- `city`
- `isSaved`
- `isCompared`
- `isInChoices`
- `readinessLevel`
- `missingDocumentCount`
- `sourceStatus`
- `pendingAction`
- `onOpen`
- `onSave`
- `onCompare`
- `onAddChoice`

States:

| State | Behavior |
| --- | --- |
| idle | row opens detail |
| loading | skeleton with same row height |
| saved | save icon filled |
| compared | compare button selected |
| in_choices | primary CTA becomes `In choices` or `Open application` |
| closed | add disabled, show late alternative action |
| stale_source | source badge warning |
| pending_save | only save control disabled |
| pending_compare | only compare control disabled |
| pending_choice | only choice control disabled |

Required visible fields:

- Program name.
- University and city.
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

Rules:

- Row action buttons stop row navigation.
- Row height stays stable across action states.
- Add-to-choice is idempotent.
- Long program names wrap to two lines then truncate.
- Source badge opens popover.

### ProgramResultCard

Used for grid view only.

Rules:

- Shows the same fields as row, but with tighter vertical grouping.
- Must not hide deadline, tuition, source, or add-to-choice.
- Grid cards keep equal height within a row.

### CompareTray

States:

| State | Behavior |
| --- | --- |
| hidden | no compared programs |
| one_item | show hint `Add one more to compare` |
| ready | compare action enabled |
| full | max 3; further compare disabled with reason |
| drawer_open | mobile compare details |

Rules:

- Enforce max count in reducer.
- Remove updates tray instantly.
- Compare dimensions: deadline, tuition, language, scholarship, tests, documents, source, readiness.
- Add-to-choice remains available from compare.

### ChoiceTray

States:

- `empty`
- `has_choices`
- `choice_added_success`
- `limit_reached` if future product sets a limit

Rules:

- After adding a choice, show `View Hub` and `Keep searching`.
- Duplicate add creates one choice.
- Mobile tray must not cover result action buttons.

## 4. Program Detail Components

### ProgramKeyFacts

Required facts:

- Degree.
- Language.
- Intake/start date.
- Duration.
- Deadline.
- Tuition.
- Scholarship.
- City.
- Source status.

Rules:

- Facts use stable grid slots.
- Deadline and tuition have stronger numeric hierarchy.

### ReadinessPanel

Levels:

- `strong_match`
- `likely_eligible`
- `needs_review`
- `blocked`

States:

| State | Behavior |
| --- | --- |
| calculated | show meter and reasons |
| stale_profile | prompt profile update |
| blocked | list hard blockers |
| deadline_closed | primary action becomes late alternatives |

Rules:

- Never say guaranteed admission.
- Every blocker has action label and route.
- Meter animates once unless reduced motion is active.

### SourceFreshnessBlock

States:

- `verified`
- `stale`
- `pending`
- `expanded`

Rules:

- Shows source label, URL, and last verified date when available.
- Stale source warns without hiding the program.
- Expand inline, not modal.

## 5. Hub Components

### NextActionPanel

Priority:

1. Add a program to choices.
2. Complete profile basics.
3. Prepare required documents.
4. Finish application sections.
5. Request adviser review.
6. Wait for adviser feedback.

States:

- `idle`
- `changed`
- `blocked`
- `ready`

Rules:

- Exactly one primary action.
- Copy must be short and direct.
- Change crossfades and records no duplicate timeline event.

### ChoiceStatusList

States:

- `empty`
- `has_choices`
- `documents_missing`
- `deadline_risk`
- `ready_for_review`
- `adviser_reviewing`

Rules:

- Choice cards open Application Builder.
- Each choice shows blockers and deadline.
- Add another choice routes to Program Search.

### DeadlineTimeline

States:

- `no_deadlines`
- `upcoming`
- `attention`
- `urgent`
- `past`

Rules:

- Use exact dates.
- Each item links to program detail or filtered search.
- Urgent is noticeable but not flashing.

### DocumentChecklist

States:

- `empty`
- `missing`
- `uploading`
- `uploaded`
- `accepted`
- `rejected`
- `expired`

Rules:

- Missing document rows link to Application Builder documents.
- Upload status updates Hub and Application Builder together.

## 6. Application Builder Components

### ApplicationSectionNav

Statuses:

- `not_started`
- `in_progress`
- `needs_attention`
- `ready`
- `submitted`
- `returned`
- `locked`

Rules:

- Active section is clearly selected.
- Ready icon animates once.
- Returned section explains required correction.
- Mobile nav opens as drawer.

### AutosaveIndicator

States:

- `saved`
- `dirty`
- `saving`
- `error`

Text:

- `Saved`
- `Unsaved changes`
- `Saving`
- `Could not save. Retry`

Rules:

- Use `aria-live="polite"`.
- Mark-ready waits for saving.
- Error exposes retry.

### DocumentUploadSlot

Statuses:

- `missing`
- `uploading`
- `uploaded`
- `under_review`
- `accepted`
- `rejected`
- `expired`
- `locked`

Behavior:

| Status | Primary Action |
| --- | --- |
| missing | `Upload` |
| uploading | disabled progress |
| uploaded | `Replace` |
| under_review | no primary action |
| accepted | `View` or `Replace` |
| rejected | `Upload again` |
| expired | `Replace` |
| locked | no action |

Rules:

- Repeated upload while uploading does nothing.
- Upload simulation has pending and success state.
- Rejected state includes reason.
- Status updates blockers and Hub next action.

### ReviewRequestPanel

States:

| State | CTA | Behavior |
| --- | --- | --- |
| blocked | `Resolve blockers` | disabled review |
| warnings_only | `Request adviser review` | enabled |
| ready | `Request adviser review` | enabled |
| pending | `Requesting review` | disabled |
| success | `Ready for adviser review` | sections lock visually |

Rules:

- Do not use `Submit`.
- Hard blockers prevent request.
- Warnings remain visible but do not block.
- Success creates timeline event.

## 7. Overlays

### Drawer

Use for:

- mobile filters
- mobile compare
- mobile section nav
- adviser permissions on mobile

Rules:

- Focus trap.
- Escape closes.
- Closing returns focus to opener.
- No drawer inside drawer.

### Popover

Use for:

- source freshness
- exact deadline date
- requirement explanation
- disabled action reason

Rules:

- Short content only.
- No destructive actions.

### Modal

Use for:

- revoke adviser access
- grant high-risk adviser permission
- discard unsaved changes

Rules:

- Explicit confirm/cancel.
- Focus trap.
- Destructive action uses danger variant.

## 8. Toasts And Banners

Toast:

- Success auto-dismisses after 1.5-2 seconds.
- Error/warning remains until dismissed or resolved.
- Toast must not cover sticky bottom actions on mobile.

Banner:

- stale source warning
- another tab updated application
- deadline risk
- degraded/offline mock state

Cross-route important events should become Hub messages or timeline events.

## 9. Component QA

Each component must pass:

- keyboard navigation
- visible focus
- reduced motion
- no layout jump
- mobile touch target
- loading state
- error state if async
- disabled reason if disabled
- rapid repeated click behavior
- long text wrapping
