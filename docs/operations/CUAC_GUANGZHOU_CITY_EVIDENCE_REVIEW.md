# CUAC Guangzhou City Evidence Pack

Date: 2026-09-22
State: acquisition and organization complete for batch 01; manual review deferred; publication prohibited

## Acquired official evidence

- Guangzhou Statistics Bureau 2025 statistical communique
  - SHA-256: `38af59a17faf8c96103d37983c43ea387c0fa0338958cfaeab5617f4db21206a`
  - Population, urbanization, tertiary-student scale and metro use.
- Guangzhou Police overseas accommodation registration portal
  - SHA-256: `4ed1fb3c85377a4ae88d32fe043ea401fa79b572a7cd24db682cc797614dc480`
- Guangzhou official foreign-arrival accommodation guide
  - SHA-256: `f5c1016b6c09f30d168014ba640025f81062149e1e849230ef0393251c2245cb`
  - Supports the 24-hour non-hotel accommodation-registration rule.
- Sun Yat-sen University international student dormitory fee table
  - SHA-256: `7fcebc24edbcdecf6b3e5f2d3140a11fcc470bd226c29ef72647fc0cb8095a17`
  - Guangzhou-campus room types only; published in 2022.

## Draft outputs

- `seeds/catalog.guangzhou-city-rich-batch-01.draft.json`
- `seeds/catalog.guangzhou-city-rich-batch-01.evidence.json`
- `seeds/catalog.guangzhou-city-rich-batch-01.validation.json`

The pack contains eight sourced facts, one accommodation-only cost snapshot and six locale drafts (`en`, `vi`, `th`, `id`, `ms`, `ar`). All review states are pending and `publicationAuthorized` is `false`.

## Known limits

- The SYSU room schedule is old and must be replaced or reconfirmed before publication.
- The CNY 250–1,333 monthly values are annual-room-fee equivalents for comparison, not a complete monthly budget.
- Fixed utilities, food, transport, personal expenses and tuition are excluded.
- The registered SCUT pre-departure PDF returned HTTP 404. The separate 2026 prospectus PDF exceeded the collector's 50 MiB ceiling; neither was bypassed.

Run `npm run catalog:city:guangzhou:draft` to reproduce the ignored local artifacts.
