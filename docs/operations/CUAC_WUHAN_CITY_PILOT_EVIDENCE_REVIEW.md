# CUAC Wuhan City Evidence Draft

Status: evidence acquired; manual review deferred; publication not authorized.
Captured: 2026-09-22 UTC.

## Acquired evidence

| Source ID | Snapshot SHA-256 | Draft use |
|---|---|---|
| `wuhan-statistical-communique-2025` | `bb65c94fa39fe3ca6dbf238d3bd98482eb9a6488d302f0b14dffc3221d3a3971` | Population, rail-transit scale and higher-education student counts |
| `wuhan-international-services-portal` | `954c8462965d328887e663fb75c4cc2710c17da802abcf3f1009d1778ccf72e1` | Official international-resident service scope |
| `wuhan-foreign-residence-guide` | `24eba29f2b1ea2be7a23c5287ea051f4434799bfc86823cfc0212edaa75ba4ff` | Arrival and residence-permit timing |
| `wuhan-metro-fares` | `f034b5f15c41c98fc8f88d434b9ccf299c0182b6ce2e209e2ecef6a2af264b2b` | Distance-based metro fare |
| `hust-undergraduate-guide-2026` | `1cec0171dd9acff5c8bd79ef8f3132d818c2e0a16d2e22464bc08df670c16181` | HUST undergraduate accommodation reference |
| `hust-graduate-guide-2026` | `7c0c7c8c88371e1479a8844c4dbdc14aa1d9ae284f0b38581f1021630aefee29` | HUST accommodation, living expenses and incidental costs |

Raw responses remain in Git-ignored `work/catalog-official/`. Source registrations are durable in `catalog-sources/official-sources.json`.

## Generated artifacts

Run `npm run catalog:city:wuhan:draft` to produce the Git-ignored candidate, evidence and validation files under `seeds/catalog.wuhan-city-rich-batch-01.*.json`.

The current build contains:

- nine structured facts;
- one transparent HUST-scoped on-campus cost profile of CNY 1,900–3,900/month, excluding tuition;
- English source copy plus Vietnamese, Thai, Indonesian, Malay and Arabic drafts;
- explicit caveats that the cost profile is not a city-wide or off-campus rent estimate;
- `publicationAuthorized: false` in both evidence and validation output.

## Still unresolved

- official climate observations suitable for this data contract;
- a defensible off-campus rent profile;
- a multi-school cost sample rather than one HUST-scoped reference;
- current foreign-language medical-service guidance;
- editorial, prohibited-data and translation review, including Arabic RTL QA.
