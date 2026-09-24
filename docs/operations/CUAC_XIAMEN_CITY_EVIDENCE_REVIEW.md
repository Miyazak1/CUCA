# CUAC Xiamen City Evidence Pack

Date: 2026-09-22
State: acquisition and organization complete for batch 01; manual review deferred; publication prohibited

## Acquired official evidence

- Xiamen Statistics Bureau, `Xiamen 2023 statistical communique`
  - Exact URL: `https://tjj.xm.gov.cn/tjzl/ndgb/202403/t20240320_2829912.htm`
  - Snapshot SHA-256: `178b6895ed926a5b5c305ffea79a12f9ab30c8e6b3ec5384d5ca17ed87793897`
  - Used for population, urbanization and higher-education scale.
- Xiamen University, `2026 international undergraduate admissions guide`
  - Exact URL: `https://admissions.xmu.edu.cn/cn/info/1019/2036.htm`
  - Snapshot SHA-256: `e9f2857813fa46cbed8f8a00e1f32cea4b3d094b5949fbbcbf9c4bd9ad29b39d`
  - Used for campus accommodation, nearby room rent, food and insurance.

## Acquisition exceptions

The Xiamen Foreign Affairs Office English city overview and foreigners-guide index are registered but not acquired. The host returned a TLS certificate for `*.chinadaily.com.cn`, not `en.fao.xm.gov.cn`. Strict certificate verification remains enabled; CUAC did not bypass the mismatch.

## Draft outputs

- `seeds/catalog.xiamen-city-rich-batch-01.draft.json`
- `seeds/catalog.xiamen-city-rich-batch-01.evidence.json`
- `seeds/catalog.xiamen-city-rich-batch-01.validation.json`

The generated pack contains 10 sourced facts, two transparent Xiamen-University/Siming-campus partial cost profiles and six locale drafts (`en`, `vi`, `th`, `id`, `ms`, `ar`). Every review state is pending and `publicationAuthorized` is `false`.

## Known limits

- The city-wide statistical source is the 2023 communique; it must be upgraded when a newer exact official page is collectable.
- Cost profiles are school- and campus-scoped, not city-wide market estimates.
- Tuition, utilities, local transport and personal expenses are excluded.
- Arrival and transport guidance remains unresolved because the municipal English host could not be acquired safely.

Run `npm run catalog:city:xiamen:draft` to reproduce the ignored local artifacts from the acquired snapshots.
