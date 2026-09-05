# CUAC Cities Page Design Spec

Date: 2026-08-13

## 1. Purpose

The Cities page helps international students decide where they can realistically live, study, and apply in China.

It is not a travel guide, tourism page, or generic city article hub. It is a study-decision page that connects city context to universities, programs, scholarships, costs, documents, and arrival readiness.

Primary product question:

`Which Chinese city fits my budget, study goal, lifestyle, and application route?`

## 2. Reference Research

### UCAS Reference

UCAS has a separate Location guides search page with grid/list view, filters for related scheme, audience, and location type, and city/country/region guide results.

Reference:

- https://www.ucas.com/explore/search/location-guides

UCAS city detail pages, such as London, include:

- city-at-a-glance context
- accommodation and cost of living
- travel and transport
- social/student life
- international student information
- student quotes/chat-to-students content

Reference:

- https://www.ucas.com/study-in/study-in-london

UCAS also has a Budget Calculator concept that turns location and lifestyle into a practical monthly cost model.

Reference:

- https://www.ucas.com/money-and-student-life/money/budgeting/budget-calculator

### What CUAC Should Borrow

Borrow:

- Independent city discovery route.
- City search and filters.
- City detail pages with practical student-life content.
- Cost breakdown and budgeting mindset.
- Location as part of the study decision, not just editorial content.

Do not copy:

- UK-region framing.
- UCAS visual identity.
- Generic student-life article tone.
- Travel-magazine content that does not help applications.

## 3. CUAC Business Difference

CUAC serves foreign students applying to Chinese universities.

The city decision is not only about where a student wants to live. It affects:

- university shortlist
- available English-taught programs
- Chinese-taught / HSK exposure
- monthly living cost
- scholarship practicality
- internship and industry signal
- travel and arrival difficulty
- family confidence
- adviser review
- visa/JW arrival planning

Therefore the Cities page should sit beside Programs, Universities, and Scholarships as a core decision page.

## 4. Existing Project Context

The old/current project already has useful city foundations.

### Existing Mock Data

`frontend/app/data.ts` includes:

```ts
export type City = {
  id: string;
  slug: string;
  name: string;
  province: string;
  monthlyCostRmb: number;
  costLevel: 'low' | 'medium' | 'high';
  climateSummary: string;
  studentLifeSummary: string;
  safetyNote?: string;
};
```

Current sample cities:

- Hangzhou
- Shanghai
- Beijing
- Shenzhen

### Admin City Guide Model

`migration-intake/AdminCityGuidesPage.tsx` shows a richer future model:

- slug
- Chinese / English name
- region
- monthly living cost
- cost level
- university density
- tags
- content summary
- reasons / why
- cost breakdown
- FAQs
- nearby cities
- references
- publish/draft status
- aggregated university/program/scholarship statistics

Important product implication:

City pages should not manually fake all counts. In production, counts should be aggregated from school/program/scholarship data.

### Current Navigation Gap

Current shared navigation points Cities to:

`universities.html?filter=Affordable`

This was acceptable as a temporary route, but it is not a real Cities page.

Target:

`Cities -> cities.html`

Then city pages link to:

- `programs.html?city=hangzhou`
- `universities.html?city=hangzhou`
- `scholarships.html?city=hangzhou`

## 5. Audience

Primary users:

- international high-school students
- undergraduate/master applicants
- parents comparing cost and safety
- students unsure whether to choose by city, university, subject, or scholarship first

User maturity:

- often unfamiliar with Chinese cities
- may know Beijing/Shanghai but not Hangzhou, Nanjing, Chengdu, Wuhan, Xi'an, Tianjin, Shenzhen
- may overvalue famous cities and undervalue cost/program fit
- may not understand the difference between tuition, living cost, accommodation, city transportation, and scholarship coverage

## 6. User Jobs

The page should help students answer:

1. Which Chinese city is affordable for my family?
2. Which cities have universities/programs in my subject?
3. Which cities have English-taught routes?
4. Which cities are better for scholarships or lower living cost?
5. What is daily life like there?
6. Is the city too fast, expensive, cold, hot, or language-heavy for me?
7. Which city should I compare next?
8. Should I browse programs, universities, or scholarships from this city?

## 7. Product Positioning

Headline direction:

`Find a China city that fits your study plan`

Supporting copy:

`Compare living cost, university routes, English-taught programs, scholarships, climate, and student-life fit before choosing where to apply.`

Core principle:

City is a decision filter, not an article category.

## 8. Page-Level Information Architecture

### 8.1 Shared Shell

Use the same shared header, footer, and Agent composer as Home, Universities, Programs, and Scholarships.

Active nav:

`Cities`

Body mode:

`data-agent-mode="cities"` should be supported later in `shared-shell.js`.

Suggested agent workflow:

1. Understand city preference.
2. Compare budget and living pace.
3. Match universities and programs.
4. Check scholarships and language route.
5. Prepare city shortlist.

### 8.2 Hero

Purpose:

Set the Cities page as a practical decision surface.

Content:

- Eyebrow: `Cities`
- H1: `Find a China city that fits your study plan`
- Body: `Compare living cost, university routes, English-taught programs, scholarships, climate, and student-life fit before choosing where to apply.`
- Natural-language input:
  - `Affordable city for English-taught computer science`
  - `Lower cost than Shanghai with strong business programs`
  - `Calmer city with scholarships and no HSK first`

Do not:

- use a giant travel hero
- use tourism copy
- make it feel like a destination marketing page

### 8.3 Quick City Comparison Rail

Purpose:

Give immediate orientation without forcing filters.

Suggested cities:

- Hangzhou
- Shanghai
- Beijing
- Shenzhen
- Nanjing
- Chengdu
- Wuhan
- Xi'an

Each city chip/row shows:

- city name
- province
- monthly cost estimate
- one phrase: `tech city`, `international`, `academic`, `lower cost`, `language route`

Interaction:

- click city -> updates highlighted city story
- click `View programs` -> `programs.html?city=...`
- click `View universities` -> `universities.html?city=...`

### 8.4 Featured City Story

Purpose:

Use one larger visual block to prevent the page from becoming a card wall.

Default:

Hangzhou.

Layout:

- large city/campus image
- short decision copy
- compact facts
- related routes

Facts:

- monthly living cost
- cost level
- city pace
- English-route signal
- scholarship signal
- representative universities

Tone:

`Good first China city for students who want strong universities, tech context, and calmer daily life than Shanghai.`

### 8.5 City Fit Matrix

Purpose:

This should be the most useful section.

Use a compact comparison matrix, not repeated cards.

Rows:

- Hangzhou
- Shanghai
- Beijing
- Shenzhen
- Nanjing
- Chengdu

Columns:

- monthly cost
- pace
- English routes
- scholarships
- internships / industry
- climate note
- best for

Design:

- restrained table/matrix
- sticky row labels only if needed
- mobile converts to horizontal scroll or stacked city rows

### 8.6 Choose By Need

Purpose:

Let students start from uncertainty, not from city names.

Need-based routes:

- Lower cost
- Strong tech city
- International environment
- Academic / research city
- Calmer daily life
- Scholarship-friendly
- Chinese language environment
- Warm climate

Interaction:

Need button updates city list or filters city cards.

### 8.7 City Cards / City List

Purpose:

Browse cities after orientation and comparison.

Card content:

- image
- city/province
- monthly cost estimate
- cost level
- two or three tags
- one-line student-life summary
- related counts:
  - universities
  - programs
  - English routes
  - scholarships
- primary action: `View city`
- secondary action: `Programs`

Card rule:

Use fewer, richer cards. Avoid card overload. A page with 6-8 cities is enough for the first demo.

### 8.8 Cost Breakdown

Purpose:

Make budget concrete.

Content:

- accommodation
- food
- transport
- mobile/internet
- personal/social

Interaction:

- simple segmented control: `lean`, `balanced`, `comfortable`
- updates monthly estimate

This is front-end only for now. Use mock calculations.

### 8.9 Linked Decisions

Purpose:

Connect city context to CUAC's actual application workflow.

Cards/rows:

- Programs in this city
- Universities in this city
- Scholarships in this city
- Arrival and documents

Do not make these large marketing cards. They should be practical next actions.

### 8.10 FAQ / Reality Checks

Suggested questions:

- Should I choose the city before the university?
- Is Shanghai too expensive for international students?
- Can I study in a smaller Chinese city without speaking Chinese?
- Does a cheaper city mean fewer good programs?
- Should I choose Hangzhou or Shanghai?
- What costs are not covered by scholarships?

## 9. Data Model For Front-End Demo

Suggested demo city object:

```ts
type CityCard = {
  id: string;
  slug: string;
  name: string;
  province: string;
  region: string;
  image: string;
  monthlyCostRmb: number;
  costLevel: 'low' | 'medium' | 'high';
  pace: 'calm' | 'balanced' | 'fast';
  climateSummary: string;
  studentLifeSummary: string;
  bestFor: string[];
  tags: string[];
  universityCount: number;
  programCount: number;
  englishProgramCount: number;
  scholarshipCount: number;
  representativeUniversities: string[];
  industrySignal: string;
  languageSignal: string;
  arrivalNote: string;
  costBreakdown: {
    accommodation: number;
    food: number;
    transport: number;
    personal: number;
  };
};
```

Initial demo cities:

- Hangzhou
- Shanghai
- Beijing
- Shenzhen
- Nanjing
- Chengdu
- Wuhan
- Xi'an

## 10. Visual Direction

The page should feel:

- clean
- mature
- practical
- optimistic
- less dry than Programs
- less article-like than UCAS
- less card-heavy than previous attempts

Use:

- white background
- deep jade green for primary actions
- low-saturation lake blue / grey-green for city data
- warm amber only for budget/deadline/opportunity highlights
- real city/campus imagery
- compact charts/data strips
- table/matrix rhythm

Avoid:

- UCAS bright-blue information-portal feel
- travel-site hero
- beige/dirty warm background
- too many rounded cards
- map decoration that does not support decisions
- long paragraphs

## 11. Motion And Interaction

Motion should be subtle:

- city rail item hover reveals one extra detail
- featured city story cross-fades when city changes
- cost segmented control animates number changes
- matrix row hover highlights the city
- Agent panel opens after natural-language submit

Do not:

- animate every card
- add parallax
- make map motion the main feature

## 12. Agent Behavior

The global Agent input is important on Cities page.

Example prompts:

- `I want a lower-cost city for engineering`
- `Compare Hangzhou and Shanghai for computer science`
- `Which city is better for scholarships and English-taught masters?`
- `I want a calm city with strong universities`

Agent panel should show:

1. Understand preference: cost, subject, language, pace.
2. Compare city fit: monthly cost, climate, daily life.
3. Match routes: universities and programs.
4. Check opportunity: scholarships, internships, English routes.
5. Prepare next action: city shortlist or programs in city.

## 13. Routing

Create:

- `design-lab/cities.html`
- `design-lab/cities.css`
- `design-lab/cities.js`

Sync later:

- `frontend/public/cities.html`
- `frontend/public/cities.css`
- `frontend/public/cities.js`

Update shared navigation:

- `Cities -> cities.html`

Related links:

- `programs.html?city=hangzhou`
- `universities.html?city=hangzhou`
- `scholarships.html?city=hangzhou`

## 14. MVP Page Sections

For the first mature demo, build these sections:

1. Shared header.
2. Hero with natural-language city fit input.
3. Quick city comparison rail.
4. Featured city story.
5. City fit matrix.
6. Choose by need.
7. City list.
8. Cost breakdown preview.
9. Linked decisions.
10. FAQ.
11. Shared footer and Agent.

## 15. Success Criteria

The Cities page is successful if:

- it clearly differs from Programs, Universities, and Scholarships
- it does not feel like a tourism page
- it helps compare cities in under 30 seconds
- it gives practical next actions into programs/universities/scholarships
- it uses fewer cards and more comparison/data rhythm
- it inherits the current CUAC design language
- it is visually better than a basic UCAS clone

## 16. Open Questions

Need later confirmation:

- Which cities should be included in the first production launch?
- Which city cost estimates are approved sources?
- Should city detail pages be built in the first demo or only city index?
- Do we need parent-oriented safety/cost notes on each city?
- Should city pages support multilingual content later?
