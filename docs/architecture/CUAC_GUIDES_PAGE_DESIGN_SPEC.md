# CUAC Guides Page Design Spec

Date: 2026-08-13

Status: design research and product spec. This document defines the Guides page before implementation.

## 1. Purpose

The Guides page is the student-facing application guide hub for international students applying to Chinese universities through CUAC.

It must not become:

- a generic article archive;
- a dense filter/search page;
- a dashboard for signed-in users;
- a copy of UCAS page structure with Chinese labels.

It should answer one practical question:

> What do I need to understand and do next to apply to China correctly?

## 2. Reference Research

### 2.1 Local Project Findings

Existing CUAC planning already defines an application guide and timeline direction:

- `FRONTEND_FIRST_COMPLETE_PRODUCT_PLAN_2026-08-12.md` says the Apply Guide exists to explain the process without forcing students to read long articles.
- The guide structure already identified is: choose programs, check requirements, prepare documents, request review, submit application, track offer, prepare visa/arrival.
- `CUAC_HOME_V5_OPTIMIZATION_STRATEGY.md` recommends a visual timeline for the China application process, with short anxiety-reducing copy rather than long guidance.
- `CUAC_FRONTEND_MOCK_DATA_CONTRACT.md` models document requirements as requirement-led objects, including passport, transcript, translation, graduation certificate, IELTS/TOEFL, HSK, study plan, and recommendation letter.
- The old `migration-intake/StudyChinaPages.tsx` includes useful application-timeline behavior: deadline risk cards, browse by month, browse by subject/field, English-taught route, scholarship route, and deadline filtering.
- Scholarship service content includes real China-specific post-offer steps: admission notice, JW201/JW202 confirmation forms, Foreigner Physical Examination Form, X1/X2 visa logic, registration, health verification, and residence permit.

### 2.2 UCAS Reference Findings

UCAS is useful as an information architecture reference, not as a visual template.

Relevant UCAS patterns:

- UCAS separates discovery, applying, money/student life, international students, subject guides, career guides, city guides, and provider search into clear entry points.
- UCAS guide pages are organized around student questions and next actions rather than one long explanatory document.
- The UCAS homepage gives guidance routes, visual story modules, provider discovery, updates, and account entry without making the first page feel like a logged-in dashboard.
- The UCAS provider search keeps browsing and guides connected: a student can move from broad advice to specific providers and back.

Useful references:

- [UCAS international students](https://www.ucas.com/international/international-students)
- [UCAS undergraduate applying guidance](https://www.ucas.com/undergraduate/applying-university)
- [UCAS discover / where to start](https://www.ucas.com/discover/where-to-start)

## 3. CUAC Business Difference

CUAC is not helping UK students apply to UK universities. CUAC helps international students apply to Chinese universities.

That changes the Guides page priorities:

- Program reality matters more than school name. Students need to know whether a specific program is open, taught in English, within budget, and realistic.
- China admissions rules vary by university and year. The page must constantly frame guidance as source-aware and deadline-aware.
- Documents are a major blocker: translation, notarization, passport validity, degree certificates, transcripts, recommendation letters, study plans, and language proof.
- Language routes are confusing: English-taught programs may require IELTS/TOEFL, Chinese-taught programs may require HSK, and some programs have additional tests or interview requirements.
- Scholarships are attractive but often misunderstood. Guides must separate tuition waiver, stipend, full funding, partial funding, and admission probability.
- Post-offer steps are China-specific: admission notice, JW form, X1/X2 visa, physical examination, registration, residence permit.

## 4. Target Users

Primary audience:

- International high school students considering undergraduate study in China.
- Undergraduate graduates considering master's programs in China.
- Students who want English-taught routes and are unsure whether HSK is required.
- Scholarship-seeking students with limited budget clarity.
- Parents or guardians checking whether the process is trustworthy.

User mindset:

- Curious but uncertain.
- Worried about missing deadlines.
- Confused by different university rules.
- Interested in China but not ready to read a long policy page.
- Needs a clear next action more than a perfect encyclopedia.

## 5. Product Positioning

Page name:

- `Guides`

Recommended H1:

- `Apply to China with fewer surprises`

Supporting copy:

- `Short guides for timelines, documents, language routes, scholarships, visas, and arrival steps.`

The page should feel like a calm application map. It gives students enough structure to act, then routes them to programs, universities, scholarships, cities, or the Agent composer.

## 6. Routing

Primary route:

- `guides.html`

Shared navigation:

- Header nav item: `Guides`
- Footer group `Apply to China` should route:
  - Documents -> `guides.html#documents`
  - HSK / IELTS -> `guides.html#language`
  - Visa and JW form -> `guides.html#visa`
  - Intake calendar -> `guides.html#timeline`

Cross-page routes:

- From home category `Documents` -> `guides.html#documents`
- From home category `Intakes` -> `guides.html#timeline`
- From programs document burden chips -> `guides.html#documents`
- From scholarship deadline/source hints -> `guides.html#scholarships`
- From cities application advice -> `guides.html#arrival`

## 7. Page Structure

### 7.1 Header

Use the shared CUAC header and active nav state.

Do not create a new header variant.

### 7.2 Hero

Hero should be simple, white, spacious, and editorial.

Contents:

- Kicker: `CUAC Guides`
- H1: `Apply to China with fewer surprises`
- Body: `Understand the steps, documents, deadlines, language routes, scholarships, and visa preparation before you apply.`
- Primary CTA: `Start with timeline`
- Secondary CTA: `Check documents`

Hero should not use a large decorative image. Guides page should rely on structured visual elements: timeline, checklist, and decision rows.

### 7.3 Quick Question Routes

Use a horizontal or 2-row icon route strip, not bulky cards.

Routes:

- `When should I apply?` -> timeline
- `What documents do I need?` -> documents
- `Do I need HSK or IELTS?` -> language
- `How do scholarships work?` -> scholarships
- `What happens after offer?` -> visa/arrival
- `Which page should I open next?` -> Agent composer

Each item should have:

- one line title;
- one short supporting phrase;
- simple line icon;
- hover state with subtle underline or background tint.

### 7.4 Application Timeline

Anchor:

- `#timeline`

Use a visual process rail instead of cards.

Steps:

1. Explore programs
2. Check requirements
3. Prepare documents
4. Review shortlist
5. Submit applications
6. Track offer
7. Visa, JW form, and arrival

Each step includes:

- short title;
- one practical explanation;
- one action link.

Example:

- `Check requirements`
- `Confirm degree level, language proof, deadline, tuition, and scholarship conditions.`
- `View programs`

Interaction:

- Step hover expands a 2-line note.
- Active step has a jade accent.
- On mobile, timeline becomes a vertical rail.
- Motion should be reveal-on-scroll, 160-220 ms, no bounce.

### 7.5 Documents Readiness

Anchor:

- `#documents`

Design as a checklist table/rail, not repeated cards.

Rows:

- Passport photo page
- Transcript
- Graduation certificate or expected graduation proof
- Certified translation
- IELTS / TOEFL certificate
- HSK certificate
- Study plan / personal statement
- Recommendation letters
- Physical examination form, when relevant
- Portfolio, interview, or test proof, when relevant

Columns:

- Document
- Usually needed for
- Common blocker
- Next action

Example row:

- `Certified translation`
- `Most non-English/non-Chinese transcripts`
- `Translation format varies by university`
- `Ask Agent`

Visual:

- compact rows with icon markers;
- one highlighted explainer panel: `Documents are reusable, but requirements are program-specific.`
- use amber only for deadline/document caution, not decoration.

### 7.6 Language Route Guide

Anchor:

- `#language`

This section explains language pathways:

- English-taught route
- Chinese-taught route
- Bilingual / foundation / non-degree route

Use a three-column comparison band on desktop and stacked rows on mobile.

Fields:

- Typical proof
- Common blocker
- Best next action

Copy guidance:

- Avoid saying English-taught means no language proof.
- Clarify that English-taught often means no HSK first, but IELTS/TOEFL or equivalent may still be required.
- Clarify that Chinese-taught programs may require HSK and sometimes additional academic checks.

### 7.7 Scholarship Guide

Anchor:

- `#scholarships`

This section should not duplicate the scholarships page. It explains how to think about scholarships.

Structure:

- Short intro: scholarships reduce cost but do not guarantee admission.
- Four funding types:
  - Full funding
  - Tuition waiver
  - Stipend
  - Partial award
- One deadline/source reminder row.
- CTA to `scholarships.html`.

Visual:

- Use one split information band, not four identical large cards.
- Use gold/amber accent sparingly.
- Include source status language: `Check exact rules by university and year.`

### 7.8 Visa And Arrival

Anchor:

- `#visa`

This is a key China-specific differentiator.

Contents:

- After admission notice
- JW201 / JW202 form
- X1 / X2 visa
- Physical examination / health verification
- Registration at university
- Residence permit, where required

Design:

- Use a calm step list with official-document visual language.
- Avoid legal certainty. Use copy such as `Typical sequence` and `Confirm requirements with the university and embassy/consulate`.
- Add a source note that real requirements vary by country, university, and current policy.

### 7.9 Guide Library By Question

This is the only section that can look like a guide library. It should still avoid a card wall.

Groups:

- Before choosing
- Before applying
- After offer
- Living in China

Each group has 3-4 text links with short descriptions.

Examples:

- `How to compare a famous university with a realistic program`
- `How to read application deadlines`
- `What "verified source" means`
- `When scholarships close before admissions`
- `What to prepare before arrival`

### 7.10 Agent Prompt Band

Use the global bottom Agent composer, not a second search bar.

Inline prompt examples can appear as chips:

- `I want English-taught business under RMB 40k`
- `Do I need HSK for computer science?`
- `Make me a Fall 2026 application checklist`
- `What should I prepare after receiving an offer?`

When submitted, open the right Agent workspace with `guides` mode.

### 7.11 Footer

Use the shared footer.

Do not introduce page-specific footer styling.

## 8. Agent Mode For Guides

Add `data-agent-mode="guides"` to the page body or page root.

Mock workflow:

1. Understand current stage
2. Identify requirement blockers
3. Build document checklist
4. Map deadlines and scholarships
5. Recommend next page or action

Possible content actions inside the Agent panel:

- Show a checklist preview.
- Link to filtered programs.
- Link to scholarships.
- Link to `guides.html#documents`.
- Link to `guides.html#visa`.

The Agent must not claim:

- real admission eligibility;
- scholarship approval;
- visa approval;
- official legal advice.

## 9. Visual Language

Guides page should match the homepage, universities page, programs page, scholarships page, and cities page:

- white page background;
- deep jade primary actions;
- ink text;
- restrained amber for deadlines/scholarship caution;
- subtle lake/blue only for information accents;
- 6-8 px radius for repeated items;
- consistent line icons;
- no rounded decorative blobs;
- no large warm dirty background wash.

Density:

- More open than Programs.
- More structured than Scholarships.
- Less image-led than Cities.
- Less hero-heavy than Home.

Typography:

- H1: 52-60 px desktop, 36-42 px mobile.
- Section title: 28-34 px desktop.
- Body: 16-18 px.
- Table/checklist body: 14-15 px.
- Use consistent font weight: strong headings, normal explanatory text, semibold labels.

## 10. Interaction And Motion

Recommended interactions:

- Timeline step hover/focus expands concise detail.
- Checklist rows can reveal a short blocker note.
- Question-route strip has smooth hover translation of 2 px maximum.
- Anchor navigation scrolls to sections with stable offset below header.
- Agent composer remains global and hides at footer bottom, as already defined.
- When Agent panel is open, composer docks inside the panel footer and can expand on focus.

Motion constraints:

- Duration: 160-240 ms.
- Easing: `cubic-bezier(.2, .8, .2, 1)`.
- No large parallax.
- No playful bouncing.
- Respect `prefers-reduced-motion`.

## 11. Data Model

Frontend-only mock types:

```ts
type GuideCategory = {
  id: string;
  title: string;
  description: string;
  anchor: string;
  icon: string;
};

type GuideTimelineStep = {
  id: string;
  title: string;
  body: string;
  actionLabel: string;
  href: string;
};

type GuideDocumentRow = {
  id: string;
  label: string;
  usuallyNeededFor: string;
  commonBlocker: string;
  actionLabel: string;
  href: string;
};

type GuideQuestion = {
  id: string;
  group: 'before_choosing' | 'before_applying' | 'after_offer' | 'living_in_china';
  title: string;
  description: string;
  href: string;
};
```

Reuse existing mock concepts:

- `DocumentRequirement`
- `Program`
- `Scholarship`
- `City`
- `SourceStatus`
- `DeadlineStatus`

## 12. Implementation Notes For Later

Files to create when implementation starts:

- `design-lab/guides.html`
- `design-lab/guides.css`
- `design-lab/guides.js`, only if necessary for simple interactions
- `frontend/public/guides.html`
- `frontend/public/guides.css`
- `frontend/public/guides.js`, only if necessary

Shared files to update:

- `design-lab/shared-shell.js`
- `frontend/public/shared-shell.js`
- `design-lab/shared-shell.css`, only if shared nav/footer/agent states need adjustments
- `frontend/public/shared-shell.css`, mirror changes

Do not fork header/footer per page.

## 13. MVP Scope

First implementation should include:

- shared header with active Guides nav;
- editorial hero;
- quick question routes;
- application timeline;
- documents readiness table;
- language route comparison;
- scholarship explainer band;
- visa/JW/arrival sequence;
- guide library by question;
- shared footer;
- global Agent composer and right panel guides workflow.

Can defer:

- real article detail pages;
- CMS-style guide management;
- personalized signed-in deadline data;
- real Agent execution.

## 14. Quality Bar

The page is ready when:

- it feels like a mature admissions guide hub, not an article dump;
- the student can understand the China application process in under 60 seconds;
- every major guide section has a next action;
- the page visually belongs to CUAC, not UCAS;
- it uses fewer cards than Programs and Scholarships;
- it links naturally to Programs, Universities, Scholarships, Cities, and Agent;
- it does not make legal, visa, scholarship, or admission guarantees;
- mobile layout remains clear without horizontal overflow.

