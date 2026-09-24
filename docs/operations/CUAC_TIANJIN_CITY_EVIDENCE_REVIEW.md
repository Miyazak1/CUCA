# CUAC Tianjin City Evidence Draft

Status: evidence acquired; manual review deferred; publication not authorized.
Captured: 2026-09-22 UTC.

## Acquired evidence

| Source ID | Snapshot SHA-256 | Draft use |
|---|---|---|
| `tianjin-statistical-communique-2025` | `a88f7455e6f784a1d0b99ca2b48a02e2e61d8ad4aae12dffdf21b60990754fea` | Population, urbanization, higher-education scale and rail-transit lower bound |
| `tianjin-foreign-service-entry-exit` | `69040e37fee4f6062d1d099a1f66a5258916bd80348b40365bbe4f2db347d638` | Official international-resident service scope |
| `tianjin-private-affairs-residence-guide` | `dd9d73842840f1151a2d909517fcef353f4e99d7dd266165680dfbed8671b897` | Temporary-residence registration timing |
| `tianjin-nankai-undergraduate-cost-2026` | `807f7bf793268f7e60874649e186b1ba99bcd185003e8988e67aa653e09a7ce3` | Nankai on-campus accommodation range |
| `tianjin-university-accommodation-2026` | `763a1ce35170d8fdedc6d41e8f047bfd5b9ff58e03f4688d6c0dce5600e155d8` | Tianjin University room rates |

Raw responses remain in Git-ignored `work/catalog-official/`. Source registrations are durable in `catalog-sources/official-sources.json`.

## Generated artifacts

Run `npm run catalog:city:tianjin:draft` to produce the Git-ignored candidate, evidence and validation files under `seeds/catalog.tianjin-city-rich-batch-01.*.json`.

The current build contains ten structured facts, two school-scoped accommodation-only profiles, and English, Vietnamese, Thai, Indonesian, Malay and Arabic content drafts. Both cost profiles explicitly exclude food, transport, personal expenses and tuition. Evidence and validation output retain `publicationAuthorized: false`.

## Still unresolved

- a complete student budget and defensible off-campus rent range;
- a current exact metro fare schedule;
- official climate observations suitable for the data contract;
- editorial, prohibited-data and translation review, including Arabic RTL QA.
