# CUAC City Data Completeness Snapshot

Date: 2026-09-22
Scope: production-planning inventory; publication is not authorized

Run `npm run catalog:cities:inventory` to regenerate the machine-readable snapshot at `work/city-data/city-inventory.json` from the current local catalog.

Run `npm run catalog:cities:source-coverage` and `npm run catalog:cities:baseline-draft` after the inventory to regenerate the official-source coverage matrix and the consolidated 87-city unpublished baseline.

Run `npm run catalog:cities:route-readiness` last to separate active study destinations from identity-only legacy city records.

## Current inventory

| Measure | Result |
|---|---:|
| Non-fixture cities | 87 |
| Priority cities | 10 |
| Complete core identity fields | 10 |
| Missing a province/municipality value | 77 |
| Structured evidence draft available | 26 |
| Active-route cities awaiting collectable evidence | 0 |
| Cities with some acquired official evidence | 26 |
| Cities without acquired official evidence | 61 (all have no active route) |
| Publication-ready cities | 0 |

The only missing core identity field is `province`. Names and broad region values exist for all 87 records, but several region values still use mixed Chinese/English taxonomy and therefore are not considered normalized publication data.

The separate unreviewed identity-normalization artifact now contains candidate province and normalized seven-region values for all 87 cities. It adds 77 missing province candidates but deliberately does not write them to the database or authorize publication.

## Priority order from live catalog coverage

1. Beijing — 17 schools, 1,602 programs, 592 English-program records, 57 verified scholarship records.
2. Wuhan — 3 schools, 1,073 programs, 126 English-program records, 14 verified scholarship records.
3. Shanghai — 10 schools, 877 programs, 106 English-program records, 31 verified scholarship records.
4. Hangzhou — 3 schools, 862 programs, 204 English-program records, 16 verified scholarship records.
5. Chengdu — 2 schools, 714 programs, 91 English-program records, 2 verified scholarship records.
6. Tianjin — 4 schools, 674 programs, 99 English-program records, 8 verified scholarship records.
7. Nanjing — 3 schools, 570 programs, 104 English-program records, 13 verified scholarship records.
8. Xiamen — 1 school, 549 programs, 68 English-program records, 4 verified scholarship records.
9. Guangzhou — 4 schools, 535 programs, 8 English-program records, 18 verified scholarship records.
10. Hefei — 2 schools, 457 programs, 88 English-program records, 6 verified scholarship records.

These counts are planning signals computed from local catalog relations. They are not manually authored city facts. The current open-intake count is zero across the inventory and must not be interpreted as “no future intake”; it reflects that no currently-open intake rows meet the production query at the snapshot time.

## Data states

- `not_started`: only legacy identity/catalog relations exist; no rich city evidence pack has been built.
- `draft_available`: official snapshots and a structured city draft exist, but review and publication are blocked.
- `reviewed`: field-level review exists; not currently reached by any city in this deferred-review phase.
- `publication_ready`: all required gates pass; currently zero.

## Execution order while review is deferred

1. Complete and normalize the 87-city core identity draft without changing public visibility.
2. Build evidence packs for the priority group using exact registered official URLs.
3. Produce English source drafts and Vietnamese, Thai, Indonesian, Malay and Arabic translation drafts with explicit pending status.
4. Keep cost data split into sourced facts and transparent derived profiles; leave unsupported categories null.
5. Run review, staging rehearsal and publication only after the project enters the review phase.

No manual-review reference, approval record or verification timestamp may be fabricated to make the completeness number appear higher.

## Acquisition exception

Five exact Shanghai municipal sources are registered and registry-valid, but the official hosts returned HTTP 403 to the deterministic collector on 2026-09-22. The pipeline did not bypass the host controls and did not create municipal facts from search-result text. A structured Shanghai school-evidence draft was instead produced from 95 already-acquired official university sources linked to the ten active Shanghai school records. Municipal statistics, city-wide cost and arrival fields remain empty until a collectable official mirror or authorized official download endpoint is available.

Nanjing is the third rich evidence draft. Its official city page, attached statistical communique, international living portal, arrival checklist and public-transport price handbook were acquired successfully. The cost field remains deliberately accommodation-only because no defensible complete city student budget has been acquired.

Xiamen is the fifth rich evidence draft. The official 2023 statistical communique and Xiamen University's 2026 international undergraduate cost page were acquired. Its two budgets are explicitly Xiamen-University/Siming-campus partial profiles. Two registered municipal English-service pages remain unacquired because the host presented a TLS certificate for a different domain; certificate validation was not bypassed.

Guangzhou is the sixth rich evidence draft. Its 2025 statistical communique, police accommodation-registration portal, official 24-hour arrival guidance and a SYSU dormitory fee table were acquired. The cost profile remains accommodation-only and carries a prominent stale-source warning because the room schedule dates from 2022.

Hefei is the seventh rich evidence draft. An HKSAR Government Hefei guide citing the city's 2024 official communique, a USTC 2026 accommodation-registration guide and a maintained USTC cost page were acquired. Population fields are explicitly marked as official-secondary, while the undated accommodation range is blocked from publication until reconfirmed.

Hangzhou is the eighth rich evidence draft. Its official 2025 first-half economic update, international-living portal and Zhejiang University accommodation schedule were acquired. The budget remains a transparent Zijingang accommodation-only per-student equivalent; population and complete living-cost claims remain absent.

Chengdu is the ninth rich evidence draft. Its official rail-network update and Sichuan University accommodation page were acquired. The budget remains an SCU accommodation-only range across different campuses and room types. The exact 2025 statistical communique returned HTTP 412, so no population or city-economy facts were inferred.

The school-evidence wave covers Shanghai, Guiyang, Changsha, Xi'an, Harbin, Changchun, Jinan, Xiangtan, Shenzhen, Qingdao, Kunming, Qinhuangdao and Nanning. These artifacts organize official university snapshots and six-language draft copy, but deliberately leave unsupported city-wide facts empty. Kunming and Nanning include transparent university-accommodation-only figures.

Chongqing, Zhengzhou, Shijiazhuang and Lanzhou now have official-statistics drafts. The Chongqing and Shijiazhuang drafts include explicit higher-education context; none of the four invents a student budget from general resident-consumption data.

All 26 cities with active school and program relationships now have a structured evidence draft. Guiyang uses a successfully acquired 2026 Guizhou Medical University official admission source; its separate municipal English portal still presents an invalid-hostname TLS certificate. Shanghai uses acquired official university sources while its municipal hosts continue to return HTTP 403. No certificate validation or host protection was bypassed.

Only 26 of the 87 city records currently have any linked active school/program data. The other 61 are legacy city records with zero active school and zero active program relationships. Their identity fields are normalized in the unpublished baseline and they are explicitly classified as `hold_from_public_city_directory_until_route_exists` in `work/city-data/city-route-readiness.draft.json`. Enriching them as public study destinations before a route exists would create dead-end pages.
