# CUAC Hefei City Evidence Pack

Date: 2026-09-22
State: acquisition and organization complete for batch 01; manual review deferred; publication prohibited

## Acquired official evidence

- Hong Kong SAR Government mainland living guide for Hefei
  - SHA-256: `0ff27f39a9bc3d7dcd26f88c7362d921150fd93df317dcc713d129879b6d326a`
  - Official secondary source citing Hefei's 2024 official communique; used provisionally for population and urbanization.
- USTC 2026 Hefei accommodation-registration guide
  - SHA-256: `a75ae4c42c521c64e939c4e6323c48645afacac1326ed4389764860e49b1d0ce`
  - Used for the 24-hour non-hotel registration rule.
- USTC international non-degree accommodation and insurance page
  - SHA-256: `970f97254b19289741c64d0c83de79f94e5f35175404d4cb8304be39d7cfa2a9`
  - Used for the CNY 500–1,000 monthly dormitory range and CNY 800 annual insurance.

## Draft outputs

- `seeds/catalog.hefei-city-rich-batch-01.draft.json`
- `seeds/catalog.hefei-city-rich-batch-01.evidence.json`
- `seeds/catalog.hefei-city-rich-batch-01.validation.json`

The pack contains five facts, one accommodation-only snapshot and six locale drafts. All review states are pending and `publicationAuthorized` is `false`.

## Mandatory upgrades before publication

- Replace the official secondary population source with the exact Hefei Statistics Bureau 2024 or 2025 communique.
- Reconfirm the undated USTC dormitory and insurance values.
- Add a defensible complete student budget, public-transport fare and utility evidence or leave those fields absent.

Run `npm run catalog:city:hefei:draft` to reproduce the ignored local artifacts.
