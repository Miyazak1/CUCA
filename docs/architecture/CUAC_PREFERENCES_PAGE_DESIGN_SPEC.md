# CUAC Preferences Page Design Spec

Date: 2026-08-14

Status: design and product-function specification before implementation.

## 1. Decision

CUAC should build a dedicated `Preferences` page as part of the signed-in account area.

This page should not be a generic account-settings screen. For CUAC, preferences decide how the whole application experience behaves:

- what Hub shows first;
- which saved routes are prioritized;
- when deadlines and document blockers trigger notifications;
- what context the Agent can remember and use;
- which language, currency, timezone, and communication style the student prefers;
- whether advisers, parents, or partner schools can help;
- what data is used for personalization.

The page should be designed as a control center for a student's China admissions workspace.

## 2. Product Role

Working name:

`Preferences`

Product promise:

`Tune CUAC around your study goal, reminders, Agent help, and privacy choices.`

Core question:

`How should CUAC help me without overwhelming me?`

Preferences should connect these existing CUAC surfaces:

- `hub.html`: next best action, personalized feed, saved-route summaries.
- `programs.html`: default filters, degree/subject/language/intake assumptions.
- `universities.html`: preferred cities, school type, scholarship signal.
- `scholarships.html`: funding route priority and source warnings.
- `cities.html`: budget, city-cost comfort, climate/lifestyle emphasis.
- `guides.html`: document, HSK/IELTS, visa, and timeline guide priority.
- `notifications.html`: reminder categories, urgency, quiet behavior.
- `application.html`: application-choice order, adviser review, document readiness.
- Shared Agent sidebar: memory, context, handoff actions, and safety boundaries.

## 3. Target Users

Primary users:

- International high school students applying to undergraduate programs in China.
- Undergraduate graduates applying to master's programs in China.
- Students seeking English-taught routes and trying to avoid HSK blockers.
- Scholarship-sensitive students comparing funding and city cost.
- Students with saved schools but no concrete program choices.

Secondary users:

- Parents checking budget, safety, and readiness.
- School counsellors or advisers supporting a student.
- Partner schools that may need limited visibility into the student's progress.

Typical needs:

- "Do not show me Chinese-taught programs unless I ask."
- "Tell me early when documents block my saved programs."
- "Prioritize scholarship-friendly programs."
- "Use USD when explaining budgets, but keep official tuition in RMB."
- "Let Agent remember my study goal, but do not use marketing preferences."
- "Let my adviser review my shortlist, not my private account settings."

## 4. Reference Assessment

UCAS account/preferences patterns are useful because they separate:

- profile;
- preferences;
- password/security;
- language settings;
- Hub personalization;
- support needs.

Useful principles:

- Settings are grouped, not placed in one long form.
- Account-side navigation is stable.
- Preferences can be expandable sections.
- Save/cancel states are obvious.
- Language and security can be separate from personalization.

What CUAC should not copy:

- UK-only language logic such as Welsh application correspondence.
- UCAS-specific marketing categories.
- Large account background images that do not improve task clarity.
- Generic "student panel" language.
- A preference page that is mostly collapsed with no immediate value.

CUAC should keep the page calmer, more specific, and more action-connected.

## 5. Information Architecture

Recommended static route:

- `preferences.html`

Future production account routes:

- `/account/profile`
- `/account/preferences`
- `/account/security`
- `/account/language`
- `/account/privacy`

In the current static demo, a single `preferences.html` can present all preference groups as tabs or section cards.

Suggested left or top account navigation:

- Profile
- Preferences
- Notifications
- Agent memory
- Privacy
- Security

Do not place everything under Hub anchors. Preferences should be an account-level page, reachable from the signed-in account dropdown.

Current static implementation should expose Profile, Password & security, and Language & region as first-class sections inside `preferences.html`, not as future-only placeholders. The account dropdown "Edit your account" should route directly to `preferences.html#profile`.

## 6. Core Preference Groups

### 6.1 Study Goal Defaults

Purpose:

- Let CUAC default search, Hub, notifications, and Agent context to the student's real target.

Fields:

- Target degree level: Undergraduate, Master, PhD, Non-degree / Chinese language.
- Subject focus: Computer Science, Business, Engineering, Medicine, Economics, Chinese Language, Design, Not sure.
- Intake: Spring / Fall, year, not sure.
- Teaching language: English-taught, Chinese-taught, bilingual, not sure.
- Preferred cities: up to 3.

Connected behavior:

- Program search default chips.
- Hub next best action.
- Agent initial context.
- Notifications for relevant deadlines only.

### 6.2 Budget And Funding

Purpose:

- Avoid unrealistic recommendations and clarify scholarship expectations.

Fields:

- Tuition comfort range.
- Monthly living cost comfort.
- Currency display preference: RMB, USD, EUR, GBP, local currency.
- Scholarship priority: need full funding, prefer partial award, self-funded possible, unsure.
- Risk tolerance: safer route first, balanced, ambitious stretch.

Connected behavior:

- City page cost comparison.
- Scholarship page route ordering.
- Agent cost estimates.
- Hub funding reminders.
- Warnings when a saved route exceeds budget comfort.

Important copy:

`Scholarship preferences help CUAC prioritize routes. They do not guarantee funding or admission.`

### 6.3 Document And Readiness

Purpose:

- Show document reminders only when they matter to the student's routes.

Fields:

- Passport ready.
- Transcript ready.
- Transcript translation status.
- Graduation certificate status.
- IELTS / TOEFL status.
- HSK status.
- Study plan / personal statement status.
- Recommendation letters status.

Connected behavior:

- Application blocker matrix.
- Notifications page.
- Guides page personalized ordering.
- Agent document checklist.

### 6.4 Notifications

Purpose:

- Prevent important deadlines from being missed while avoiding notification fatigue.

Categories:

- Deadline changes.
- Document blockers.
- Scholarship/source updates.
- Saved route changes.
- Agent results.
- Adviser comments.
- Application status changes.

Controls:

- Urgent only / balanced / all updates.
- Quiet hours.
- Reminder timing: same day, 3 days before, 7 days before, 14 days before.
- Channels in future production: in-app, email, WhatsApp/WeChat placeholder, adviser copy.

Connected behavior:

- `notifications.html` filters and counts.
- Account dropdown notification badge in future.
- Hub alert strip.

### 6.5 Agent Memory And Assistance

Purpose:

- Make Agent useful while giving the student control over what it remembers.

Controls:

- Use my study goal in Agent answers.
- Use saved programs and favourites.
- Use document readiness.
- Use budget preferences.
- Use city preferences.
- Use adviser notes.
- Show source confidence and caveats by default.
- Ask before adding or removing an application choice.
- Reset demo memory.

Connected behavior:

- Shared Agent sidebar.
- Scenario prompts.
- Application page add-choice assistant.
- Hub next-action explanation.

Agent boundaries:

- Agent may suggest, compare, summarize, and prepare actions.
- Agent must not claim admission certainty.
- Agent must ask before destructive or high-impact changes.
- Agent should distinguish verified data, estimates, and items needing adviser/source review.

### 6.6 Adviser And Family Access

Purpose:

- Support the real application process without exposing too much data.

Permission scopes:

- View shortlist.
- View document readiness.
- Comment on application choices.
- Receive deadline reminders.
- Review funding plan.
- No access to password/security/private consent settings.

Connected behavior:

- Hub adviser review module.
- Application review status.
- Notifications for adviser comments.
- Future partner-school workflows.

### 6.7 Language, Locale, And Accessibility

Purpose:

- Make the site understandable to international students and parents.

Fields:

- Interface language: English first; later Chinese, Arabic, Russian, French, Spanish, etc.
- Explanation style: concise, detailed, beginner-friendly.
- Time zone.
- Date format.
- Currency display.
- Accessibility: reduced motion, high contrast, larger text.

Connected behavior:

- All public pages and Hub.
- Agent response tone and detail level.
- Deadline displays.
- Cost calculations.

### 6.8 Privacy And Data Use

Purpose:

- Make personalization transparent.

Controls:

- Use saved items for recommendations.
- Use interactions for route ranking.
- Allow adviser/partner visibility by scope.
- Marketing communication preferences.
- Data export placeholder.
- Delete account placeholder.

Design rule:

- Privacy controls should be plain-language and separate from marketing.
- Do not bury data-sharing in long copy.

## 7. Page Layout

Recommended first viewport:

1. Shared signed-in header.
2. Account page title:
   - H1: `Preferences`
   - Subtitle: `Control how CUAC personalizes your China study workspace.`
3. Profile context strip:
   - `Master`
   - `Computer Science`
   - `Fall 2026`
   - `English-taught`
   - `Scholarship interested`
4. Quick status cards:
   - Goal defaults complete.
   - Notifications balanced.
   - Agent memory enabled.
   - Adviser access off / limited.
5. Main settings area:
   - Left account nav on desktop.
   - Sticky or compact section tabs on mobile.
   - Right content area with grouped panels.

The page should not begin with a huge scenic hero. Preferences is a control surface; it should feel clear, mature, and calm.

## 8. Interaction Design

### Section Panels

Each section should show:

- title;
- one-line explanation;
- current state summary;
- editable controls;
- save/cancel state.

Avoid long accordion lists where every section is closed. Students should see current preference values immediately.

### Save Behavior

Frontend demo:

- Show unsaved state after changes.
- Show a small inline "Saved in this demo" confirmation.
- Use local in-memory state only unless localStorage is intentionally added.

Future production:

- Save section-level patches.
- Avoid one giant profile update request.
- Keep audit trail for consent/privacy changes.

### Agent Handoff

Every complex section can have a contextual Agent prompt:

- Study goal: `Help me set defaults for English-taught CS in China.`
- Budget: `Estimate a realistic budget for my saved routes.`
- Documents: `Build a document checklist from my preferences.`
- Notifications: `Which reminders should I keep on for Fall 2026?`
- Adviser access: `Explain what my adviser can see.`

### Mobile

Mobile should use:

- top segmented tabs or a compact account menu;
- section cards stacked vertically;
- controls large enough for touch;
- no sticky bottom composer overlap with save bars.

## 9. Related Features To Define

Preferences is a dependency for several future features:

### Personalized Search Defaults

Program and university pages should read:

- degree level;
- subject;
- teaching language;
- city preference;
- budget range;
- intake.

This makes default search feel intelligent without requiring a blank query each time.

### Notification Rules

Notifications should be generated from:

- saved programs;
- application choices;
- document readiness;
- scholarship source status;
- deadline dates;
- adviser comments;
- Agent completed tasks.

Preferences decide which notifications are shown or suppressed.

### Agent Context Policy

Agent should receive only the allowed context:

- study goal if enabled;
- saved routes if enabled;
- document readiness if enabled;
- budget preferences if enabled;
- adviser notes if enabled.

The UI must show that this is user-controlled.

### Adviser Collaboration

If enabled, adviser access should be scoped, visible, and reversible.

Example scopes:

- `Can view shortlist`
- `Can comment on choices`
- `Can view document readiness`
- `Can receive deadline reminders`

### Data And Consent Model

Preferences should produce a future `StudentPreference` object.

Suggested fields:

```ts
type StudentPreference = {
  studyGoal: {
    degreeLevel?: DegreeLevel;
    subjectAreas: string[];
    intakeTerm?: "spring" | "fall";
    intakeYear?: number;
    teachingLanguage?: TeachingLanguage;
    preferredCityIds: string[];
  };
  budget: {
    tuitionRange?: string;
    monthlyCostRange?: string;
    displayCurrency: "RMB" | "USD" | "EUR" | "GBP" | "LOCAL";
    scholarshipPriority: "full" | "partial" | "self_funded_possible" | "unsure";
    riskTolerance: "safe_first" | "balanced" | "ambitious";
  };
  readiness: {
    passport: DocumentStatus;
    transcript: DocumentStatus;
    transcriptTranslation: DocumentStatus;
    languageProof: DocumentStatus;
    recommendation: DocumentStatus;
  };
  notifications: {
    intensity: "urgent_only" | "balanced" | "all";
    categories: string[];
    quietHours?: { start: string; end: string; timezone: string };
    reminderOffsetsDays: number[];
  };
  agent: {
    useStudyGoal: boolean;
    useSavedItems: boolean;
    useDocuments: boolean;
    useBudget: boolean;
    useAdviserNotes: boolean;
    requireConfirmationForChoices: boolean;
  };
  adviserAccess: {
    enabled: boolean;
    scopes: string[];
  };
  locale: {
    interfaceLanguage: string;
    explanationStyle: "concise" | "detailed" | "beginner";
    timezone: string;
    dateFormat: string;
    reducedMotion: boolean;
  };
  privacy: {
    personalizationEnabled: boolean;
    marketingEnabled: boolean;
    partnerSharingEnabled: boolean;
  };
};
```

## 10. Demo Content

Use a realistic demo student:

- Name: Maya.
- Goal: Master, Computer Science, Fall 2026.
- Language route: English-taught.
- Scholarship: partial or full funding preferred.
- Cities: Hangzhou, Nanjing, Shanghai.
- Budget: balanced, scholarship-sensitive.
- Document blockers: IELTS/waiver, transcript translation.

Sample section summaries:

- `Search defaults favor English-taught CS programs for Fall 2026.`
- `Notifications are balanced: urgent deadlines, documents, Agent results.`
- `Agent can use saved routes, budget, and document readiness.`
- `Adviser access is off in this demo.`
- `Currency explanations show RMB first, with USD estimate.`

## 11. Visual Direction

Use the current CUAC design language:

- white page background;
- teal primary actions;
- small-radius cards;
- compact chips;
- clear section labels;
- restrained color, not a loud dashboard.

Suggested accent colors:

- Teal: primary action and enabled state.
- Pale mint: safe/on/ready.
- Warm yellow: reminder sensitivity.
- Pale blue: Agent memory and personalization.
- Soft coral: privacy/security risk or disabled destructive action.

Avoid:

- heavy scenic background image as the main layout;
- oversized decorative cards;
- too many equal-weight settings boxes;
- dense legal text in the main flow;
- UCAS-like blue/pink visual identity.

## 12. Front-End Scope

Current demo scope:

- Static `preferences.html`.
- Section-level controls with local demo state.
- Account dropdown routes to `preferences.html`.
- "Ask Agent" prompts open the existing sidebar.
- No backend persistence, auth changes, password flow, email verification, data export, or real consent storage.

Future backend scope:

- Persist user preferences.
- Sync preference changes to recommendation APIs.
- Generate notifications from preferences.
- Control Agent context permissions.
- Persist adviser access scopes.
- Store privacy/marketing consent history.

## 13. Acceptance Criteria

The page is ready for implementation when:

- It explains preferences as part of the China study workspace, not generic account settings.
- It includes study goal, budget, documents, notifications, Agent, adviser, language, and privacy settings.
- It links conceptually to Hub, Programs, Universities, Scholarships, Cities, Guides, Notifications, Application, and Agent.
- It distinguishes demo-only local state from future backend state.
- It defines the data model future implementation will need.
- It avoids copying UCAS visual style while learning from its account structure.
