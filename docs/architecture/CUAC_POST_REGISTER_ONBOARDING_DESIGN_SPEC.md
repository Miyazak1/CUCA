# CUAC Post-Register Onboarding Design Spec

Date: 2026-08-13

Status: design evaluation and implementation spec. This document defines the experience after account creation and before entering Hub.

## 1. Decision

CUAC should have a post-register onboarding flow before sending a new student into Hub.

Reason:

- A blank Hub is weak. It needs study goal, intake, language route, budget, and document signals to show meaningful next actions.
- International students applying to China face more uncertainty than a normal account signup: degree level, HSK/IELTS, scholarship expectation, city cost, visa/JW timing, and document translation all affect the route.
- Asking a few focused questions early is less stressful than asking for a full profile later when the user is already trying to browse programs.
- UCAS uses setup steps to personalize Hub before the dashboard. CUAC should adopt the pattern, but not copy the UK-specific fields.

## 2. UCAS Reference Assessment

The supplied UCAS screenshots show a clear post-register pattern:

- Welcome screen before setup.
- Location question for support/personalization.
- Personal details and main study level.
- Interest selection for subjects, institutions, industries, and marketing preferences.
- Optional school connection.
- Final Hub entry with a personalized dashboard and modal prompts.

Useful principles:

- Setup is staged, not one giant form.
- Each step has one clear question cluster.
- The user can move forward only when required personalization data is enough.
- Hub is not shown until the user has at least a basic profile context.

What CUAC should not copy:

- UK address lookup as a primary field.
- Apprenticeship / conservatoire / Clearing fields.
- Heavy marketing preference collection before value is proven.
- Purple/blue UCAS visual identity.
- Large generic background images that do not relate to China admissions.

## 3. CUAC Onboarding Purpose

The CUAC onboarding flow should create a minimum viable application profile.

It should answer:

- Who is this student?
- Where are they applying from?
- What level do they want to study in China?
- When do they want to start?
- Which subjects/cities/language routes are they considering?
- Do they need scholarship support?
- Which documents or language proofs may block them?
- Should Hub start with programs, documents, scholarships, cities, or Agent?

It should not:

- become a full application form;
- ask for passport upload;
- ask for sensitive documents;
- force exact university choice;
- ask for consent-heavy marketing preferences too early;
- claim eligibility or admission likelihood.

## 4. Target User Fit

Primary users:

- International high school students considering undergraduate study in China.
- Undergraduate graduates considering master study in China.
- Students seeking English-taught programs without HSK first.
- Scholarship-sensitive students who need budget clarity.
- Parents or guardians checking the process.

Common user states:

- “I know China, but not which city or university.”
- “I know my subject, but not the document requirements.”
- “I want scholarship, but I do not know what is realistic.”
- “I want English-taught, but I am unsure about IELTS/HSK.”
- “I created an account because I want to save programs, but I need guidance.”

## 5. Flow Overview

Recommended route:

- `onboarding.html`

Registration flow:

1. User creates account on `auth.html`.
2. Frontend preview redirects or links to `onboarding.html`.
3. User completes or skips non-critical onboarding steps.
4. User lands in Hub preview with personalized modules.

MVP implementation can be frontend-only:

- No backend write.
- Store state in memory or `localStorage` only if useful.
- Show final “Hub prepared” state and link to `home-v3.html#cuac-hub`.

## 6. Step Structure

### Step 0: Welcome

Purpose:

- Confirm account creation and explain why CUAC asks a few questions.

Suggested copy:

- H1: `Welcome to CUAC`
- Body: `Let’s set up your China study workspace so your Hub can show relevant programs, documents, deadlines, and scholarship routes.`

Controls:

- `Let’s go`
- Secondary link: `I am an adviser or partner`

Visual:

- Full-screen onboarding surface.
- CUAC brand visible but quiet.
- Avoid a giant UCAS-like gradient. Use white/card structure with subtle China campus/city line-art or soft map pattern if a visual is needed.

### Step 1: Location And Background

Purpose:

- Personalize visa/support assumptions, time zone, common document patterns, and scholarship country route hints.

Fields:

- Nationality / passport country
- Current country or region
- Current education stage

Recommended options:

- High school / Grade 12 or equivalent
- Undergraduate student
- Undergraduate graduate
- Master student / graduate
- Other

Do not ask:

- full home address;
- detailed ID/passport number;
- exact date of birth in MVP unless age-specific rules are being demonstrated.

Why this is China-specific:

- Some scholarships have nationality/country scope.
- Visa process and document legalization can vary by country.
- Students under 18 may later need guardian documents, but this should be a later conditional prompt.

### Step 2: Study Goal

Purpose:

- Build the first program-search context.

Fields:

- Target degree level
- Subject interest
- Intake year / term
- Teaching language preference

Recommended controls:

- Degree segmented buttons: Undergraduate, Master, PhD, Non-degree / language.
- Subject chips plus typeahead: Computer Science, Business, Engineering, Medicine, Chinese Language, Economics, Design.
- Intake buttons: Spring 2026, Fall 2026, Spring 2027, Not sure.
- Language route: English-taught, Chinese-taught, Not sure.

Key copy:

- `These are not application choices. You can change them later.`

### Step 3: Budget And Scholarship

Purpose:

- Avoid showing unrealistic program or city suggestions.

Fields:

- Annual tuition comfort range
- Scholarship interest
- City cost comfort

Recommended controls:

- Tuition range chips:
  - Under RMB 25k/year
  - RMB 25k-45k/year
  - RMB 45k-70k/year
  - Flexible
- Scholarship route:
  - Need full funding
  - Prefer partial scholarship
  - Self-funded possible
  - Not sure
- City cost preference:
  - Lower-cost city
  - Balanced city
  - International city
  - Not sure

Rules:

- Do not imply scholarship eligibility.
- Use copy such as `This helps us prioritize funding routes and city cost, not decide your admission outcome.`

### Step 4: Readiness Snapshot

Purpose:

- Let Hub start with useful document and language tasks.

Fields:

- Passport ready?
- Transcript ready?
- Graduation certificate or expected graduation proof?
- IELTS/TOEFL?
- HSK?
- Need translation?

Recommended UI:

- Compact checklist with statuses:
  - Ready
  - Not yet
  - Not sure

Rules:

- No uploads in onboarding.
- No document review claim.
- Keep it fast.

### Step 5: Interests And Shortlist Seeds

Purpose:

- Personalize feed, saved suggestions, and starting pages.

Fields:

- Preferred cities
- Universities of interest
- Priorities

Recommended priority chips:

- English-taught
- Scholarship
- Lower cost
- Top-ranked university
- Easier document route
- Internship city
- Late intake
- Medicine
- Tech / AI

Rules:

- Clearly say interests are not application choices.
- Allow “Not sure”.

### Step 6: Support Preference

Purpose:

- Decide how Hub frames guidance.

Fields:

- I want to explore myself
- I want Agent guidance
- I may want adviser review
- I am a parent/guardian helping a student

Optional:

- School/agency/adviser connection, but it must be optional and skippable.

China-specific version of UCAS “connect to your school”:

- `Connect an adviser or school`
- `Skip for now`

Use cases:

- Some international students work with a counselor, agent, high school, or family adviser.
- CUAC should not force this before students see product value.

### Step 7: Finish And Enter Hub

Purpose:

- Convert answers into visible Hub modules.

Summary card:

- Target: `English-taught Computer Science Master`
- Intake: `Fall 2026`
- Budget: `RMB 25k-45k/year`
- Funding: `Scholarship preferred`
- Readiness: `Transcript ready, IELTS missing`

Primary CTA:

- `Enter my Hub`

Secondary:

- `Go to matching programs`

## 7. Hub Personalization After Onboarding

Hub should not be generic after onboarding.

Modules to show:

- Next best action:
  - `Compare English-taught Computer Science programs`
  - `Prepare IELTS or equivalent English proof`
  - `Check scholarship deadlines before choosing`
- Readiness meter:
  - Based on document/language snapshot.
- Suggested programs:
  - Filtered by degree, subject, language, intake, budget.
- Suggested cities:
  - Filtered by cost preference.
- Scholarship route:
  - Only if scholarship interest is selected.
- Document checklist:
  - From readiness snapshot.
- Agent prompt:
  - Pre-filled with onboarding context.

## 8. Visual Design Direction

The onboarding should belong to CUAC, not UCAS.

Use:

- white primary surface;
- deep jade accent;
- restrained amber for deadline/funding caution;
- soft off-white / pale green background pattern;
- 6-8 px radius for controls;
- crisp type hierarchy;
- a progress indicator that feels calm and precise.

Avoid:

- UCAS purple/blue gradients;
- full-screen unrelated stock images;
- large decorative blobs;
- too many cards;
- form fields that feel like government paperwork;
- marketing preference pages before core application setup.

Recommended layout:

- Centered setup card, max width 680-760 px.
- Left or top progress rail on desktop.
- Bottom action row with Back / Continue.
- On mobile, progress becomes compact `Step 2 of 7`.

## 9. Interaction Rules

Required:

- Back button.
- Skip for non-critical steps.
- Continue disabled only for truly required fields.
- Clear selected chips.
- Save progress locally in frontend preview.
- Keyboard accessible controls.
- Reduced motion support.

Step validation:

- Required:
  - nationality/passport country
  - target degree or `Not sure`
  - intake or `Not sure`
- Optional:
  - city interests
  - university interests
  - adviser/school connection
  - marketing/contact preferences

Motion:

- Step transition: 180-240 ms fade/slide.
- No bounce.
- No animated full-screen background.

## 10. Data Model

Frontend-only draft:

```ts
type OnboardingDraft = {
  displayName?: string;
  nationality?: string;
  currentCountry?: string;
  currentEducationLevel?: 'high_school' | 'undergraduate' | 'master' | 'other';
  targetDegreeLevel?: 'undergraduate' | 'master' | 'phd' | 'non_degree' | 'not_sure';
  subjectInterests: string[];
  targetIntake?: 'spring_2026' | 'fall_2026' | 'spring_2027' | 'not_sure';
  preferredTeachingLanguage?: 'english' | 'chinese' | 'bilingual' | 'not_sure';
  tuitionRange?: 'under_25k' | '25k_45k' | '45k_70k' | 'flexible';
  scholarshipPreference?: 'full_needed' | 'partial_preferred' | 'self_funded_possible' | 'not_sure';
  cityCostPreference?: 'lower_cost' | 'balanced' | 'international_city' | 'not_sure';
  readiness: {
    passport?: 'ready' | 'not_yet' | 'not_sure';
    transcript?: 'ready' | 'not_yet' | 'not_sure';
    graduationProof?: 'ready' | 'not_yet' | 'not_sure';
    englishProof?: 'ready' | 'not_yet' | 'not_sure';
    hsk?: 'ready' | 'not_yet' | 'not_sure';
    translation?: 'ready' | 'not_yet' | 'not_sure';
  };
  preferredCityIds: string[];
  universityInterests: string[];
  priorities: string[];
  supportPreference?: 'self_guided' | 'agent_guided' | 'adviser_review' | 'parent_guardian';
  adviserConnection?: {
    type?: 'school' | 'agency' | 'family' | 'none';
    name?: string;
    skipped?: boolean;
  };
};
```

Later backend mapping:

- `StudentProfile`
- `StudentPreference`
- `StudentDocumentReadiness`
- `AdvisorConsentGrant`
- `HubPersonalizationState`

## 11. Implementation Scope

Create:

- `design-lab/onboarding.html`
- `design-lab/onboarding.css`
- `design-lab/onboarding.js`
- public copies under `frontend/public`

Update:

- `auth.html` create account success should point to `onboarding.html`.
- `shared-shell.js` can keep account/sign-in pointing to `auth.html`.

Do not:

- create backend endpoints;
- implement real auth redirects;
- upload files;
- persist sensitive data;
- publish the site unless requested.

## 12. MVP Step Count Recommendation

For the demo, use 6 screens:

1. Welcome
2. Location and background
3. Study goal
4. Budget and scholarship
5. Readiness snapshot
6. Interests and finish

Merge support preference into the finish screen as optional:

- `I want Agent guidance`
- `I may want adviser review`
- `Connect adviser later`

This keeps setup lightweight while still making Hub meaningful.

## 13. Success Criteria

The onboarding is successful when:

- it clearly appears after registration and before Hub;
- it feels like CUAC, not UCAS;
- it collects only data needed to personalize China application guidance;
- it avoids full application-form pressure;
- it handles uncertainty with `Not sure`;
- it routes into Hub, matching programs, or Agent with context;
- it supports international student realities: nationality, language proof, budget, scholarship, city, documents, intake;
- it is visually polished and mobile-safe.

