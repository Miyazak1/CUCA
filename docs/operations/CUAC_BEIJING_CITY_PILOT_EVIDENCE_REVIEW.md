# CUAC Beijing City Pilot Evidence Review

Status: evidence acquired; editorial review and publication approval pending.

Captured: 2026-09-22 UTC.

This register is the handoff between deterministic acquisition and human interpretation. A successful fetch, a listed claim candidate, or this document does not approve any value for publication.

## Acquired official evidence

| Source ID | Official scope | Snapshot SHA-256 | Candidate use | Review state |
|---|---|---|---|---|
| `beijing-statistical-publications-index` | Beijing Municipal Bureau of Statistics publication index | `f7af1325e5e1292dd480f5f3eaf03c1b5d10ae11d2c628a214c525ba86c4d5c8` | Identify current statistical yearbooks and communiques | Acquired; not approved |
| `beijing-statistical-communique-2025` | Beijing 2025 statistical communique, published 2026-03-25 | `4dd6578b251e2922bdd5970ed646fb313c453adce2356ab0bbe2cb3db2fa31b2` | Dated population, education, health and transport context | Acquired; field extraction pending |
| `beijing-international-study-portal` | Beijing government international study portal | `b190286295f165ad5f582a2ad0b716c53a895b3742dd4c8dc065f2e227eedd9e` | Official student-service navigation only | Acquired; page links require separate registration before use |
| `beijing-international-living-portal` | Beijing government international living portal | `79c3f57e751c73cf953d12c4526aa0d00a5c71b05eb1e3dd251a33e429ff4054` | Official resident-service navigation only | Acquired; page links require separate registration before use |
| `beijing-foreign-student-arrival-guide` | Beijing government page for foreign-student arrival and registration | `c196444e3834ac98b89be98605ec256bb7369c56af211dfc4f5a0f19ae1129aa` | Arrival, school registration, insurance and residence-permit checklist | Acquired; age/current-policy review required |
| `beijing-medical-guide-for-foreigners` | Beijing government medical guide | `1ecb49874e28b7f3cc1266e501123992180c3eecb6f353ec2964dfda88c620fe` | Emergency number, foreign-language medical-service and payment guidance | Acquired; volatile provider list requires dated review |
| `beijing-public-price-index` | Beijing government public prices and fees index | `c16c8a5cee34f1e714c9b86b2972f2839fc1476a36c875aeb122b459ea220c6c` | Discovery index for public transport and regulated fees | Acquired; each linked fact needs its own registered source |
| `beijing-subway-fares-2025` | Beijing government subway fare explanation dated 2025-04-23 | `4fdd1c26fc21a2f52b8323ad5664234f07a956720b38b6d3cfbac9818babc83e` | Distance-based subway fare bands and airport-line caveat | Acquired; fact extraction pending |
| `beijing-public-transport-prices` | Beijing government public-transport price table | `fb9fa97bd73504c4177e230cc1325aaa8e3a5f9a542ae71ea923f9a4a18da0fc` | Subway, bus and airport-express price rules | Acquired; structured draft extracted |
| `beijing-higher-education-accommodation-price-standard` | Beijing government higher-education accommodation price table | `0c914eb002e0d7bfe830efcb6f5709b40cfd8a6fa7fb4ca77d7695e1859ee14c` | Regulatory accommodation-price context | Acquired; international-student applicability unresolved |
| `beijing-pku-student-cost-reference` | Peking University international-student cost reference | `372a4629723fc582c0689a2e1f3a28e64c56de08ac571f66b7e9904f0d2c8c56` | Accommodation, food and transport/miscellaneous reference | Acquired; structured draft extracted |
| `beijing-bnu-student-cost-reference` | Beijing Normal University international-student fee reference | `405bd5772e0e83982046b20f7ab420b95ba7d4aaf78dea6aa2893b752b87e530` | Long-term dormitory and living-cost ranges | Acquired; structured draft extracted |
| `beijing-bit-student-cost-2026` | Beijing Institute of Technology 2026 fee reference | `49286d21e3e1941d4d5f5b87f71400373743244c7a8a229c5137cc7cc69a0c29` | Beijing-campus dormitory ranges | Acquired; structured draft extracted |

Raw response files and manifests are intentionally kept under the Git-ignored `work/catalog-official/` directory. The durable source definitions are in `catalog-sources/official-sources.json`.

## Evidence that is still missing

- an exact official Beijing climate dataset or publication that can be collected without login;
- defensible phone/internet and personal-expense inputs for a student cost model;
- a reviewed decision on whether the dated 2021 arrival guide remains current in every material respect;
- field-level extraction references, including heading/table/page, applicability dates and explicit/derived/unresolved classification;
- prohibited-data review, editorial review and an independent publication approval;
- editorial review of the English source draft and Vietnamese, Thai, Indonesian, Malay and Arabic translation drafts, including Arabic RTL QA.

## Generated draft artifacts

The deterministic build command `npm run catalog:city:beijing:draft` creates three Git-ignored working artifacts:

- `seeds/catalog.beijing-city-rich-batch-01.draft.json` — a schema-valid city seed candidate with status `draft` and verification status `unverified`;
- `seeds/catalog.beijing-city-rich-batch-01.evidence.json` — source snapshots, structured facts, two derived cost profiles, unresolved fields, and six locale drafts;
- `seeds/catalog.beijing-city-rich-batch-01.validation.json` — hashes and validation output with `publicationAuthorized: false`.

The current structured draft contains 12 facts, two cost profiles, and English, Vietnamese, Thai, Indonesian, Malay and Arabic copy. All translation states remain draft/pending; Arabic is explicitly marked right-to-left. No artifact is a publication approval.

## Next executable batch

1. Acquire a defensible official climate source and either acquire or explicitly omit off-campus rent, phone/internet and personal-expense ranges.
2. Keep the English and five translated locale drafts synchronized while review is deferred.
3. Run field-level editorial, prohibited-data and translation review when the review phase begins.
4. Add review references to a new immutable candidate rather than editing this captured evidence record.
5. Rehearse the reviewed city v2 bundle in a disposable database and publish to staging before production.
