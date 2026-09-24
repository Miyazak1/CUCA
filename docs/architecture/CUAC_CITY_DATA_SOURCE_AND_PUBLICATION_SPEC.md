# CUAC City Data Source and Publication Specification

Date: 2026-09-22
Status: Proposed production contract
Scope: Student-facing city index and city detail pages

## 1. Purpose

This specification defines how CUAC acquires, models, reviews, translates, publishes, and refreshes city information for international students.

The city product is a study-decision surface. It is not a generic travel guide and it must not copy a competitor's editorial content or treat an unverified third-party estimate as a fact.

The product question is:

`Can a student understand what they can study in this city, what daily life may cost, how arrival and student life work, and which facts are current and supported?`

This document complements:

- `CUAC_CITIES_PAGE_DESIGN_SPEC.md`, which defines page purpose and interaction design;
- `CUAC_CATALOG_DETAIL_PAGE_DATA_CONTRACT.md`, which defines shared catalog detail behavior;
- `catalog-official-acquisition.md`, which defines the evidence acquisition boundary.

It does not authorize publication of any city content by itself.

## 2. Current-State Finding

A read-only local API audit on 2026-09-22 found:

| Check | Result |
|---|---:|
| City records returned | 89 |
| Cities with a monthly cost value | 0 |
| Cities with a content summary | 0 |
| Cities with any non-zero catalog reference count | 0 |
| Verified cities | 0 |
| Active local fixture cities | 2 |
| Beijing stored school count | 0 |
| Schools returned by the Beijing school filter | 80 |
| Programs returned by the first Beijing program page | 100 |

The current problem is therefore not only missing editorial copy. It includes:

1. rich city content is not populated;
2. city catalog counts are stored snapshots rather than reliable live aggregates;
3. unverified and effectively empty records can remain active;
4. fixture records can appear in the public catalog;
5. the official seed contract cannot currently carry the full city content model;
6. source lineage exists in principle but is not complete at city-field level.

## 3. Product and Evidence Principles

### 3.1 Facts and editorial content are different

- Facts are structured, dated, and source-backed.
- Editorial summaries explain facts to students without changing their meaning.
- Derived estimates are clearly labelled as CUAC calculations.
- Unresolved or conflicting values remain absent or in review.

### 3.2 Catalog counts are computed, not authored

School, program, intake, English-taught route, scholarship, and CSCA counts must be derived from currently publishable CUAC catalog relations.

They must not be typed manually into a city editor or copied from another platform.

### 3.3 A city average must not impersonate a school-specific price

Tuition, application fees, and university accommodation normally belong to a school, program, or intake. City pages may aggregate school-level prices only when the population, calculation method, sample size, and observation date are visible.

### 3.4 Missing is safer than invented precision

If no defensible off-campus rent or food-cost range is available, CUAC should show that the value is not yet verified. It must not publish a precise number merely to complete a card.

### 3.5 Translation does not create a new fact

Numeric and relational facts are language-independent. Editorial text is translated separately and retains the same evidence references. Machine-assisted translations require editorial review before publication.

## 4. Source Hierarchy

CUAC uses the following hierarchy.

| Grade | Source class | Appropriate use | Publication treatment |
|---|---|---|---|
| A | National or local government, regulator, official statistics, official public operator | Administrative identity, statistics, public prices, transport, immigration, health and public services | May support facts after scope and currency review |
| B | University, international student office, official admissions or fee publication | School identity, accommodation, tuition, arrival, student services and campus-specific facts | May support school-scoped facts after cycle review |
| C | CUAC computation from reviewed A/B evidence or live CUAC catalog relations | Catalog counts, cost ranges, coverage ratios and comparison labels | Must expose method, inputs and calculation date |
| D | Commercial aggregator, listing site, competitor page, forum, social media or user report | Discovery, issue detection and editorial research | Must not directly support a published fact without independent A/B evidence |

A source is authoritative only for the claims it directly supports. For example, one university's admissions guide may support that university's location or accommodation rule; it cannot support a city-wide cost-of-living claim.

## 5. Field-to-Source Matrix

| Data area | Required fields | Preferred source | Refresh rule |
|---|---|---|---|
| Identity | names, province/municipality, region, coordinates, time zone | Government administrative sources and official city portal | Review annually or on administrative change |
| City overview | summary, study context, city character | Official city information plus CUAC editorial synthesis | Review annually |
| Catalog coverage | schools, programs, open intakes, English routes, scholarships, CSCA routes | Live CUAC published catalog | Recompute on catalog publication changes |
| Population and infrastructure | population, transport scale, health and education indicators | Statistical yearbook or annual statistical bulletin | Refresh by publication year |
| Climate | monthly/seasonal temperature and precipitation observations | National Meteorological Information Centre or local meteorological authority | Review annually; retain observation period |
| Public transport | fare model, airport links, public transport cards | Municipal government, price authority or official operator | Review quarterly and on change notice |
| On-campus accommodation | price, room type, availability and booking rule | Current university admissions, fee disclosure or accommodation notice | Refresh each admission cycle |
| Off-campus accommodation | descriptive availability and defensible price ranges | Government housing source when available; otherwise reviewed multi-source CUAC estimate | Review at least quarterly if published |
| Food and daily expenses | ranges by unit and student profile | Official student guide and multiple current university sources; CUAC derivation | Review at least quarterly if published |
| Health and emergency | emergency number, foreign-language services, insurance guidance | Health authority, municipal international portal and university guidance | Review every six months and on policy change |
| Immigration and registration | accommodation registration, residence permit and local process | National Immigration Administration and local exit-entry authority | Review on policy change and every six months |
| Arrival and connectivity | airports, stations, payment, SIM and first-arrival guidance | Official city international portal, operators and university arrival guides | Review every six months |
| Related schools | canonical school identifiers and cards | CUAC school-city relation | Live query or maintained aggregate |
| Related programs and scholarships | canonical identifiers and availability | CUAC catalog relations | Live query or maintained aggregate |

Refresh intervals above are CUAC product controls, not statutory deadlines.

## 6. City Profile V2 Model

The production model should use a hybrid design:

- typed core fields for identity, status, timestamps and queryable metrics;
- canonical relations for schools, programs and scholarships;
- structured facts with field-level evidence;
- versioned multilingual editorial sections.

It should not place every city property in a single opaque JSON object, and it should not create one database column for every possible editorial topic.

### 6.1 Core city record

```ts
type CityProfile = {
  id: string;
  slug: string;
  nameZh: string;
  nameEn: string;
  nameLocal?: string;
  provinceOrMunicipality: string;
  region: string;
  latitude?: number;
  longitude?: number;
  timeZone?: string;
  coverAssetId?: string;
  publicationState: "draft" | "limited" | "published" | "stale" | "archived";
  contentVersion: number;
  lastReviewedAt?: string;
  nextReviewAt?: string;
};
```

### 6.2 Computed catalog aggregate

```ts
type CityCatalogAggregate = {
  cityId: string;
  schoolCount: number;
  programCount: number;
  openIntakeCount: number;
  englishTaughtProgramCount: number;
  scholarshipCount: number;
  cscaRouteCount: number;
  computedAt: string;
  catalogRevision: string;
};
```

These values come from publishable records, not from the city editor.

### 6.3 Structured fact and evidence

```ts
type CityFact = {
  id: string;
  cityId: string;
  factType: string;
  value: unknown;
  unit?: string;
  scope?: string;
  observedAt?: string;
  validFrom?: string;
  validTo?: string;
  derivation: "explicit" | "derived";
  verificationStatus: "unverified" | "in_review" | "verified" | "conflicted" | "expired";
  evidenceIds: string[];
};

type CityEvidence = {
  id: string;
  sourceUrl: string;
  sourceTitle: string;
  sourceAuthority: string;
  sourceGrade: "A" | "B" | "C";
  capturedAt: string;
  snapshotSha256?: string;
  sourcePath: string;
  applicableYear?: string;
  reviewState: "pending" | "accepted" | "rejected" | "conflicted";
};
```

### 6.4 Multilingual editorial section

```ts
type CityContentSection = {
  cityId: string;
  sectionType:
    | "overview"
    | "why_study"
    | "housing"
    | "transport"
    | "climate"
    | "food_and_daily_life"
    | "health_and_emergency"
    | "arrival"
    | "language_environment"
    | "student_life"
    | "practical_notes";
  locale: string;
  title: string;
  body: string;
  evidenceIds: string[];
  translationState: "source" | "draft" | "reviewed";
  version: number;
};
```

Initial student locales are English, Vietnamese, Thai, Indonesian, Malay, and Arabic. Admin interfaces may remain Chinese-only.

## 7. Cost Model

### 7.1 Required shape

A published city budget is a snapshot, not a permanent attribute:

```ts
type CityCostSnapshot = {
  cityId: string;
  currency: "CNY";
  persona: "on_campus_student" | "off_campus_shared" | "off_campus_private";
  monthlyMinimum?: number;
  monthlyTypical?: number;
  monthlyComfortable?: number;
  observedFrom: string;
  observedTo: string;
  sampleSize?: number;
  methodologyVersion: string;
  evidenceIds: string[];
  reviewedAt: string;
};
```

Each category uses a range and a unit:

- accommodation per month or academic year;
- food per meal and derived monthly assumption;
- public transport per trip and derived monthly assumption;
- phone/internet per month;
- insurance per academic period;
- personal expenses per month.

### 7.2 Derivation rules

1. Preserve every original unit before calculating a monthly value.
2. Do not mix tuition with living cost.
3. Do not mix tourist hotel prices with long-term student accommodation.
4. Separate on-campus and off-campus personas.
5. Store the number of contributing schools or official guides.
6. Expose the observation window and methodology version.
7. Label the result `CUAC estimate` whenever the final value is derived.
8. If a category lacks sufficient evidence, omit it rather than silently assuming zero.

## 8. Acquisition and Review Workflow

City acquisition must extend the existing official catalog workflow without weakening it.

1. Register an exact official HTTPS URL and allowed hostname.
2. Assign a city-specific source role, such as:
   - `city-statistics`;
   - `city-public-transport`;
   - `city-public-prices`;
   - `city-student-cost`;
   - `city-climate`;
   - `city-international-services`;
   - `city-health-services`;
   - `city-student-guide`;
   - `school-accommodation`.
3. Validate the registry before network access.
4. Collect only the registered resource; do not recursively crawl discovered links.
5. Store the immutable snapshot, manifest metadata and SHA-256 under ignored acquisition work output.
6. Extract each field with a source path, table/heading/PDF page and applicability period.
7. Mark the value explicit, derived, unresolved or conflicted.
8. Perform editorial and prohibited-data review.
9. Prepare a versioned city bundle.
10. Validate and rehearse the bundle against a disposable database.
11. Publish only after an independent approval step.

Fetching a page successfully is not approval to publish it.

## 9. Publication States and Gates

### 9.1 `draft`

- not visible to public users;
- evidence collection or translation may be incomplete;
- fixture cities must remain draft or be excluded from production data entirely.

### 9.2 `limited`

May be public only when all of the following are true:

- canonical identity and location are verified;
- there is at least one currently publishable related school;
- catalog counts are computed from live relations;
- source and review timestamps are available;
- the page explicitly states that the full city guide is not yet available.

A limited page may show the city identity, live catalog coverage and links to schools/programs. It must not show empty cost cards as if data were zero.

### 9.3 `published`

Requires:

- all `limited` conditions;
- reviewed overview;
- reviewed transport and arrival guidance;
- reviewed climate summary;
- at least one defensible cost profile or an explicit decision not to publish a cost estimate;
- health/emergency guidance;
- reviewed primary-language content;
- complete field-level source lineage;
- no unresolved high-impact conflict;
- no fixture or demonstration-only data.

### 9.4 `stale`

A page becomes stale when a material source expires, a scheduled review is missed, or a source hash changes and affects a published claim.

Stale behavior:

- retain stable identity and live catalog aggregates;
- suppress or label the affected time-sensitive fact;
- queue the fact for review;
- do not silently retain an outdated price or policy.

### 9.5 `archived`

Used for merged, renamed or no-longer-supported city records. Archived records are not discoverable but may redirect to a canonical city.

## 10. Beijing Pilot Source Register

The following are candidate official sources for a Beijing pilot. They still require registry validation, snapshot capture and field-level review before publication.

| Purpose | Candidate official source | Intended fields |
|---|---|---|
| Statistical publications | https://tjj.beijing.gov.cn/tjsj_31433/tjsk_31457/ | Statistical yearbook identity and publication index |
| Annual city statistics | https://tjj.beijing.gov.cn/zxfbu/202603/t20260324_4564401.html | Population, education, health, transport and infrastructure context |
| International student portal | https://english.beijing.gov.cn/studyinginbeijing/ | Student-facing study context and official service links |
| International resident portal | https://english.beijing.gov.cn/livinginbeijing/ | Accommodation registration, payment, transport and living services |
| Foreign student guidance | https://english.beijing.gov.cn/studyinginbeijing/tips/202111/t20211119_2540585.html | Arrival, registration, insurance and residence guidance |
| Medical guidance | https://english.beijing.gov.cn/quickguideservices/medicalguide/ | Emergency and foreign-language medical services |
| Public transport prices | https://www.beijing.gov.cn/fwcj/jiage/index.html | Current official fare index and public price notices |
| Subway fare explanation | https://english.beijing.gov.cn/specials/beijinglifeonthesubway/noticeforpassengers/202504/t20250423_4072294.html | Distance-based subway fare rules |
| Climate observations | https://k.data.cma.cn/ | Historical monthly meteorological observations and observation period |
| National school baseline | https://hudong.moe.gov.cn/jyb_xxgk/s5743/s5744/202506/t20250627_1195683.html | Legal school existence and location cross-check |
| National immigration rules | https://en.nia.gov.cn/n147423/n147478/n147715/c158241/content.html | Accommodation registration and residence rules |
| School-specific fees | Current university admissions, accommodation and fee disclosure pages already registered or separately approved | On-campus accommodation and student-specific costs |

The Beijing government portal may contain useful published figures such as institution or international-student counts. Those figures must retain their stated date and must not replace CUAC's live catalog coverage counts.

## 11. Content Rules for the Student Page

The city detail page should present, in this order:

1. city identity, region, review date and source status;
2. live CUAC school/program/intake/scholarship coverage;
3. short study-focused overview and best-fit signals;
4. cost profiles with persona, range, date and method;
5. housing, transport, climate, daily life and health modules;
6. arrival and administrative guidance;
7. related universities, programs and scholarships with filters and pagination;
8. source and methodology disclosure;
9. practical next actions.

The page must not:

- display zero when a value is merely unknown;
- label a snapshot as a live total;
- show a single unsupported monthly cost;
- present a school fee as a city-wide fee;
- copy a competitor's text or data;
- display unsupported safety, quality or popularity scores;
- publish ads or unrelated widgets inside the evidence hierarchy.

## 12. Multilingual Policy

The source language is retained with the evidence record.

For student-facing content:

- English is the initial editorial source language unless the reviewed source content requires Chinese-first drafting;
- Vietnamese, Thai, Indonesian, Malay and Arabic are separate reviewed translations;
- names, costs, units and canonical relations are shared structured data;
- translated text cannot change scope, caveats or dates;
- locale fallback must be visible and must not falsely appear reviewed;
- right-to-left layout must be verified for Arabic.

## 13. Rollout Plan

### Phase 0: Contract and data safety

- [x] approve this field and evidence contract;
- [x] extend the source registry roles and city seed/import contract;
- [x] define production fixture exclusion;
- [x] implement live catalog aggregates, including current open intakes;
- [x] implement publication-state gates and stale behavior.

### Phase 1: Beijing pilot

- [x] register and collect the first approved Beijing source batch;
- [x] populate structured facts and evidence as an unreviewed draft;
- [x] calculate at least one traceable student cost profile as an unreviewed draft;
- [x] prepare English source content and five translation drafts;
- review the source content and translations;
- verify the complete city page in staging.

### Phase 2: Priority cities

Suggested first group:

- Shanghai;
- Guangzhou;
- Hangzhou;
- Nanjing;
- Wuhan;
- Chengdu;
- Xi'an;
- Tianjin;
- Chongqing.

Use the Beijing workflow and completeness report rather than copying Beijing values or prose.

### Phase 3: Remaining catalog cities

- publish verified identity plus live catalog relations as `limited` where appropriate;
- upgrade a city to `published` only after it meets the full gate;
- prioritize cities by active school, program and applicant demand rather than filling all records indiscriminately.

## 14. Acceptance Criteria

The city-data foundation is ready for production implementation when:

- [ ] fixture cities cannot enter the production catalog;
- [ ] a missing value remains null/unknown rather than rendering as zero;
- [ ] catalog counts match their underlying published records;
- [ ] every published time-sensitive fact has an applicable date and evidence reference;
- [ ] every derived cost exposes persona, method, observation window and contributing evidence;
- [ ] school-specific fees remain school-scoped;
- [ ] source changes create review work instead of silently overwriting published facts;
- [ ] unresolved conflicts block the affected field;
- [ ] translation status is visible to the publication workflow;
- [ ] a limited page and a full city guide are visibly distinct;
- [ ] Beijing passes the complete acquisition-to-publication rehearsal;
- [ ] the student page is verified in English and the selected launch locales, including Arabic RTL.

## 15. Decisions Captured

- A competitor city page is a product-reference source only, not a publishable data source.
- CUAC catalog relations are the source of truth for current school, program and scholarship coverage.
- Government and university evidence provide external facts within their direct scope.
- Cost-of-living values are snapshots and may be CUAC-derived only with a published method.
- Initial production quality is achieved through a small number of complete city guides plus honest limited pages, not through 89 superficially populated records.
- Acquisition, interpretation, translation, approval and publication remain separate actions.
