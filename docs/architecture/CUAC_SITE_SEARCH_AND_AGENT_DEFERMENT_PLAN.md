# CUAC Site Search and Agent Deferment Plan

Date: 2026-09-15

Status: Agent deferment and the Phase 1 unified-search baseline are implemented locally; production hardening remains.

## Implementation checkpoint — 2026-09-15

The local implementation now includes:

- Agent entry points hidden from public, student, school and Ops product surfaces while retaining the disabled backend architecture;
- one public search page and API spanning active programs, schools, scholarships, cities and published guides;
- deterministic exact, prefix, token and supporting-field ranking with bound SQL parameters;
- reviewed aliases for common study terms and a versioned bilingual relevance fixture;
- query-bound opaque cursor pagination for scoped result lists;
- PostgreSQL trigram indexes for the five public catalog entity groups;
- home-page and shared-header search entry points, URL state, stale-request cancellation and complete loading/error/empty states;
- a production-readiness gate requiring shared API Gateway or WAF rate limiting for the public endpoint;
- locale-aware display titles and content-derived ETags with conditional revalidation;
- a transaction-aware catalog publication revision, advanced by statement-level database triggers and exposed as CDN surrogate keys;
- a repeatable live-catalog acceptance command covering bilingual results, aliases, cursor isolation and P95 latency;
- automated API, public-contract, migration and frontend-contract coverage.

Run the live acceptance check against local or staging with `CUAC_SEARCH_ACCEPTANCE_URL` and `npm run search:acceptance`. The default P95 threshold is 500 ms and can be tightened with `CUAC_SEARCH_ACCEPTANCE_P95_MS`. Requests run with concurrency 4 by default; staging can raise `CUAC_SEARCH_ACCEPTANCE_CONCURRENCY` and `CUAC_SEARCH_ACCEPTANCE_ITERATIONS` for a bounded load check.

Guides now use a governed `public_guides` repository, seeded with five reviewed bilingual routes, and participate in the same publication revision and cache invalidation contract as the catalog.

The public guide list and slug-detail routes are `GET /api/v1/catalog/guides` and `GET /api/v1/catalog/guides/{guideSlug}`. They expose only published display fields; reviewed search terms and editorial state remain server-side. The Guides page consumes the list route and retains its server-reviewed HTML as a failure fallback.

The next hardening increment is connecting the catalog revision to the chosen CDN purge API, deployment and acceptance of the configured edge rate-limit rule, a guide editorial/API workflow and higher-concurrency staging load tests. Content-derived ETags and surrogate keys now provide the required invalidation identity; external purge execution remains deployment-specific.

## 1. Decision

CUAC will temporarily remove Agent product surfaces from the current release and make site search the primary public discovery capability.

This decision means:

- Agent launchers, panels, prompts, promotional cards, preferences and operational navigation are hidden from current user-facing surfaces;
- Agent server code, database history, security boundaries and regression tests are retained in a disabled state so the capability can be reconsidered later;
- no Agent endpoint is enabled in local, staging or production release configuration;
- the released discovery experience is explicit, deterministic and source-aware search across published CUAC catalog content;
- student application materials and live payment execution remain outside this search initiative and outside the current release scope.

This is a product-surface deferment, not a destructive removal of Agent architecture.

## 2. Why Search Is a Release-Critical Capability

The current catalog experience has separate search implementations for programs, schools and scholarships. They do not provide one entry point, one relevance model or one result contract. Program search covers more fields than school and scholarship search, and the public database queries currently rely on leading-wildcard `ILIKE` matching without search-specific indexes.

As catalog volume grows, this creates four product risks:

1. users need to know which catalog page contains the answer before searching;
2. the same phrase produces inconsistent matching behavior across entity types;
3. bilingual names, aliases and common study terms are not ranked consistently;
4. loading full catalog collections and filtering in the browser does not scale.

Search is therefore part of the student discovery funnel, not an optional utility.

## 3. Product Scope

### 3.1 Phase 1 searchable entities

Phase 1 provides one search entry point for published:

- programs;
- schools;
- scholarships;
- cities;
- guides.

Guides joined the unified index after the `public_guides` published-content repository was introduced. Search reads only rows with `status = 'published'`; hard-coded guide cards are not mixed into database-backed results.

### 3.2 Search entry points

The same search behavior must be available from:

- the home-page hero;
- the shared public header on desktop;
- the public mobile navigation;
- the dedicated search result route;
- catalog-list pages, where the search can stay scoped to the current entity type.

The proposed canonical route is:

```text
/search?q=computer+science
```

Scoped catalog searches remain valid:

```text
/search?q=computer+science&type=program
/search?q=hangzhou&type=school,city
```

URLs must be shareable and browser back/forward navigation must restore the query, selected entity types and filters.

### 3.3 Result-page information architecture

The result page contains:

1. query input and submit action;
2. entity-type tabs with counts: All, Programs, Schools, Scholarships, Cities and Guides;
3. optional contextual filters for the selected type;
4. grouped results in All mode and a normal paginated list in scoped mode;
5. loading, partial failure, empty, invalid query and retry states;
6. a source/verification signal on every catalog result where evidence exists.

All-mode groups show a small bounded preview per type and a “View all” exit. It must not fetch every matching record.

## 4. Search Behavior

### 4.1 Query normalization

The server owns normalization. It must:

- trim surrounding whitespace;
- collapse repeated whitespace;
- normalize Unicode consistently;
- compare Latin text case-insensitively;
- preserve Chinese characters;
- cap the normalized query at 120 characters;
- reject control characters;
- treat an empty query as browse mode, not as a request to rank every record by relevance.

The frontend must wait for explicit submit on the home page. On the result page it may update after a 250 ms debounce when the normalized query has at least two characters. An Enter key submission always runs immediately.

### 4.2 Searchable fields

| Type | High-weight fields | Supporting fields |
| --- | --- | --- |
| Program | English/Chinese name, subject area, field category | school names, city names, degree, teaching language, scholarship text, English/HSK requirement |
| School | English/Chinese name, stable aliases | city, province, school type, subject tags, language tags |
| Scholarship | title, provider name | scholarship type, eligibility summary, linked school/program names |
| City | English/Chinese name | province, study/living summary and stable aliases |
| Guide | English/Chinese title | subtitle, reviewed summary and reviewed search terms |

Only published, active, student-safe fields enter the public search document. Internal Ops notes, review claims, private student data, school-tenant records, payment data and Agent memory are prohibited.

### 4.3 Relevance order

Phase 1 uses deterministic weighted ranking in this order:

1. exact normalized name/title match;
2. exact alias match;
3. name/title prefix match;
4. all query tokens present across high-weight fields;
5. partial high-weight-field match;
6. supporting-field match;
7. stable catalog sort order and ID as tie-breakers.

Verified and fresher records can break otherwise equal relevance, but must not cause an unrelated result to outrank a direct name match. Sponsored placement is not part of Phase 1. If introduced later, it must be separately labeled and must not alter organic rank invisibly.

### 4.4 Typo and bilingual behavior

Phase 1 supports:

- partial Latin spelling through trigram similarity;
- English and Chinese canonical names;
- reviewed aliases stored as catalog data;
- multi-token queries such as `english computer hangzhou`.

Phase 1 does not attempt model-generated query rewriting. Search synonyms such as `CS` to `computer science`, `bachelor` to `undergraduate`, and `PhD` to `doctoral` must come from a small reviewed synonym map with tests. Chinese word segmentation and phonetic/pinyin expansion are Phase 2 candidates and require relevance evaluation before release.

## 5. Public API Contract

Create one read-only public endpoint:

```http
GET /api/v1/search?q={query}&types={csv}&limit={number}&cursor={opaque}&locale={locale}
```

Rules:

- `q`: optional in browse mode, maximum normalized length 120;
- `types`: optional subset of `program,school,scholarship,city,guide`; default is all;
- `limit`: per-page result limit, default 20, maximum 50;
- `cursor`: opaque server-issued continuation cursor; clients must not construct offsets;
- `locale`: optional presentation preference, initially `en` or `zh`;
- entity-specific catalog filters remain on their existing endpoints in Phase 1 and do not become arbitrary global-search parameters.

Proposed response shape:

```json
{
  "data": {
    "query": "computer science",
    "groups": [
      {
        "type": "program",
        "total": 12,
        "items": [
          {
            "id": "uuid",
            "slug": "stable-slug",
            "title": "Computer Science",
            "titleZh": "计算机科学",
            "subtitle": "Example University · Hangzhou",
            "summary": "English-taught master's program",
            "href": "/programs/uuid",
            "verificationStatus": "verified",
            "lastVerifiedAt": "2026-08-30T00:00:00.000Z",
            "matchedFields": ["title", "subjectArea"]
          }
        ],
        "nextCursor": "opaque-or-null"
      }
    ]
  },
  "meta": {
    "requestId": "request-id",
    "tookMs": 42
  }
}
```

`matchedFields` contains allow-listed field categories, never snippets copied from internal fields. The endpoint must preserve existing public catalog authorization and response redaction boundaries.

## 6. Data and PostgreSQL Design

### 6.1 Initial implementation

Use PostgreSQL for Phase 1. Do not introduce a separate search service until measured catalog size or latency demonstrates a need.

Add a migration that:

- enables the approved `pg_trgm` extension in controlled environments;
- adds GIN trigram indexes for normalized public search expressions or stored search documents;
- adds ordinary indexes for status, verification and stable sort fields used with search;
- documents extension availability in staging and production readiness checks;
- is backward-compatible and does not rewrite or delete catalog records.

A stored/generated public search document is preferred when it makes the indexed expression stable and reviewable. It must contain only the allow-listed public fields in Section 4.2.

### 6.2 Query constraints

- never concatenate user text into SQL;
- use bound parameters;
- query only active published records;
- select only result-card fields, not full detail projections;
- apply the row limit inside each entity query;
- execute entity groups concurrently with a bounded database budget;
- cancel work when the HTTP request is aborted where the runtime permits;
- use cursor pagination with deterministic tie-breakers.

The implementation must not load all programs, schools or scholarships into the browser to perform global filtering.

### 6.3 When to consider a dedicated search engine

PostgreSQL remains the default until evidence shows one of the following:

- indexed production P95 repeatedly exceeds 500 ms under the accepted load;
- catalog volume or multilingual ranking exceeds the documented PostgreSQL design;
- typo tolerance, faceting or analytics requirements cannot be met safely;
- database search materially harms transactional workload.

Any later search service must consume a publication outbox or versioned projection. It cannot become an ungoverned second catalog source.

## 7. Performance, Caching and Resilience

Acceptance targets after warm-up:

- local seeded search P95 below 200 ms;
- staging/production API P95 below 500 ms at the agreed test load;
- first visible result skeleton immediately and useful results without loading unrelated catalog lists;
- no more than one active request for the latest debounced query per browser surface;
- aborted or superseded requests do not overwrite newer results;
- bounded public cache keyed by normalized query, types, locale and publication revision;
- a short timeout and a retry action for failures;
- partial group failure can still show successful groups with an explicit message.

Cache invalidation follows catalog publication revision, not an arbitrary long TTL. Private or personalized data must not enter the public cache.

## 8. Safety and Abuse Controls

The endpoint is public but not unlimited. It requires:

- length and character validation;
- per-IP and guest-session rate limiting with bounded bursts;
- maximum type and page limits;
- generic errors that do not disclose SQL or index details;
- request IDs and safe latency metrics;
- no query text in long-retention logs unless the analytics/privacy policy explicitly permits it;
- tests proving that inactive, draft, unverified-when-prohibited and internal records cannot appear.

Search suggestions, if added, must come from published entities or a reviewed synonym list. They must not expose other users' queries.

## 9. Analytics and Relevance Evaluation

Record privacy-safe product events:

- `search_submitted` with normalized length bucket, selected types and locale;
- `search_results_viewed` with result-count bucket, latency bucket and group types;
- `search_result_clicked` with entity type, anonymous rank position and result ID;
- `search_zero_results` with a short-lived or hashed query representation according to the analytics policy;
- `search_filter_changed`;
- `search_retry`.

Before release, create a reviewed relevance set containing at least:

- 20 exact school/program/scholarship/city names in English and Chinese;
- 20 subject, location, language and funding-intent queries;
- 10 abbreviations or reviewed synonyms;
- 10 partial spellings;
- 10 deliberately ambiguous or no-result queries.

Each case specifies expected top results or expected empty behavior. This set becomes a deterministic regression suite.

## 10. Agent Deferment Implementation Boundary

The Agent deferment should be delivered separately from search database changes so it is easy to review and reverse.

Required changes when implementation begins:

- set all released page Agent modes to `off` or remove the mode attribute where the shell contract permits;
- remove Agent launcher/composer/panel rendering from the released shared shell bundle;
- remove student-facing Agent cards, prompt buttons and Agent memory/preferences UI;
- remove school and Ops Agent navigation items that imply an enabled product;
- update accessibility, click-flow and layout tests to assert absence of Agent product surfaces;
- keep server Agent feature flags disabled;
- retain Agent source modules, migrations and security/policy regression tests;
- do not drop Agent tables or destroy stored development evidence as part of this change.

Re-enabling Agent later requires a new product decision and must not happen merely by restoring a visible button.

## 11. Delivery Slices

### Slice A — Defer Agent surfaces

- hide user-facing Agent UI across public, student, school and Ops pages;
- remove Agent-specific promotional paths and preferences;
- update affected frontend contracts and QA scripts;
- verify core student, school and Ops flows without Agent.

### Slice B — Stabilize existing catalog search

- unify query normalization across catalog repositories;
- add public search documents/indexes;
- reduce list projections to the fields each list needs;
- add query plans and latency tests for programs, schools and scholarships;
- preserve current scoped filters and URLs.

### Slice C — Unified search API

- implement the public `/api/v1/search` contract;
- add safe grouped queries, ranking and cursor behavior;
- add rate limits, caching, observability and security tests;
- add the reviewed relevance fixture.

### Slice D — Search product UI

- add home/header/mobile entry points;
- build the dedicated grouped result page;
- implement loading, partial failure, empty and retry states;
- add keyboard, screen-reader, mobile and browser-navigation coverage;
- measure end-to-end latency and click-through behavior.

### Slice E — Relevance iteration

- review zero-result and low-click queries using privacy-safe aggregates;
- expand reviewed aliases and synonyms;
- decide whether guides, pinyin or a dedicated search engine are justified by evidence.

## 12. Release Acceptance Criteria

The initiative is complete only when:

- no released student, school or Ops page shows an Agent launcher, prompt, panel, memory control or Agent-only navigation item;
- Agent remains disabled at the server configuration boundary;
- one search query can return relevant published programs, schools, scholarships and cities;
- exact bilingual entity names appear before partial supporting-field matches;
- unpublished and internal records never appear;
- result URLs and filters survive reload and browser navigation;
- superseded requests cannot replace newer results;
- empty, partial-error and full-error states are usable;
- search-specific indexes are present and query plans do not regress to unbounded catalog scans at the acceptance dataset size;
- API latency meets Section 7 targets;
- rate-limit, injection, redaction, accessibility and relevance regression suites pass;
- no application-material upload, payment execution or Agent capability has been introduced through this work.

## 13. Explicit Non-Goals

This plan does not include:

- student application-material collection;
- payment provider activation;
- personalized admissions decisions or eligibility guarantees;
- model-generated answers or autonomous actions;
- searching private student, school-tenant or Ops records from the public search box;
- external search-engine infrastructure without measured need;
- unreviewed scraping or automatic publication of source content.

## 14. Implementation Checkpoint — Governed Public Guides

The first governed guide workflow is now implemented for the registered public guides. It deliberately keeps guide discovery deterministic and separate from Agent capabilities.

### 14.1 Editorial lifecycle

- Ops and CUAC administrators can read registered guides and their immutable version history in the Ops API workspace.
- An Ops or CUAC administrator can prepare a bounded bilingual draft containing plain-text sections and explicit HTTP(S) source evidence.
- Approval requires a step-up CUAC administrator who is not the draft preparer, three explicit review confirmations, and review evidence bound to the exact content hash.
- Publication requires a step-up CUAC administrator, the approved content and approval hashes, and the current publication revision.
- Publication atomically advances the active publication pointer, updates the public guide projection, advances the shared catalog/search revision, and writes an audit record.
- Withdrawal requires step-up administration, an exact publication revision, and a reason; it archives the public projection without deleting version history.

### 14.2 Interfaces and verification

- Public reads remain `GET /api/v1/catalog/guides` and `GET /api/v1/catalog/guides/:guideSlug`.
- Governed routes live under `/api/v1/ops/catalog/guides` and are not registered as Agent tools.
- Migration `0051_guide_governance.sql` adds guide content, immutable versions, and publication pointers without deleting existing guide data.
- `npm run test:guide-governance` covers document safety, authorization, lifecycle HTTP binding, and route boundaries.
- `npm run db:rehearse:guide-governance` exercises prepare, independent approval, publication projection, and rollback against the local PostgreSQL schema.

### 14.3 Current boundary

This slice manages the five already registered guide identities. Creating an entirely new guide identity remains a separate catalog-registration operation so that a typo or unreviewed slug cannot be introduced through the editorial form. External source acquisition and change detection continue to require the reviewed official-catalog process.
