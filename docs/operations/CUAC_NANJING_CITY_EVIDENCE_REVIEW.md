# CUAC Nanjing City Evidence Draft

Status: evidence acquired; manual review deferred; publication not authorized.
Captured: 2026-09-22 UTC.

## Acquired evidence

| Source ID | Snapshot SHA-256 | Draft use |
|---|---|---|
| `nanjing-statistical-communique-2025` | `65c69d5bee013285991e7a03b6a01ee5df0d910b7211f36b00382bd0c3dfa210` | Official publication page and attachment lineage |
| `nanjing-statistical-communique-docx-2025` | `523d3a6974430153fd58c5e68bf34a6068cc577ee8ec3367013dfebbe5135cc7` | Population, rail-transit scale and higher-education counts |
| `nanjing-international-living-portal` | `0c7a4473f30fcf086909b6188f0eeb6208c0df8a8f6a8b1ee07d1d1485bc0a3d` | Official international-resident service scope |
| `nanjing-arrival-checklist` | `c4d3b9dda6f5d67108ddefd731ef6910bf0b7d9bdcd35d31533a125ebca5fd0b` | Temporary-residence registration timing |
| `nanjing-public-transport-price-handbook-2026` | `2e763afdff5ffa4ad410f4e052f8f95876d96910abdf0c52097ca7e359cea8fe` | Metro distance bands and single fares |
| `nuaa-undergraduate-admissions-2026` | `05bebd7b3991fbd2e0297660b2bc0f4efd625a5107e05af3332cb318b1f411bc` | NUAA on-campus dormitory reference |

Raw responses remain in Git-ignored `work/catalog-official/`. Source registrations are durable in `catalog-sources/official-sources.json`.

## Generated artifacts

Run `npm run catalog:city:nanjing:draft` to produce the Git-ignored candidate, evidence and validation files under `seeds/catalog.nanjing-city-rich-batch-01.*.json`.

The current build contains:

- ten structured facts;
- population, higher-education scale, rail-transit and metro-fare fields from official city sources;
- one transparent NUAA-scoped accommodation-only profile of CNY 4,000–14,000 per academic year;
- English source copy plus Vietnamese, Thai, Indonesian, Malay and Arabic drafts;
- explicit caveats that the accommodation profile is neither a complete student budget nor a city-wide market quote;
- `publicationAuthorized: false` in both evidence and validation output.

## Still unresolved

- a complete student budget covering food, utilities, local transport and personal expenses;
- a defensible off-campus rent profile and multi-school accommodation sample;
- official climate observations suitable for this data contract;
- current foreign-language medical-service guidance;
- editorial, prohibited-data and translation review, including Arabic RTL QA.
