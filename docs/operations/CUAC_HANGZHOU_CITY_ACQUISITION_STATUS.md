# CUAC Hangzhou City Acquisition Status

Status: official entry points acquired; fact extraction incomplete; manual review deferred; publication not authorized.
Captured: 2026-09-22 UTC.

## Acquired evidence

| Source ID | Snapshot SHA-256 | Current use |
|---|---|---|
| `hangzhou-statistical-communique-index` | `f8e07f98c51723ec2eb035c5ffde8c1d25502d033b60ef71e7588f742bd328ca` | Official municipal statistical-communique discovery entry point |
| `hangzhou-international-living-portal` | `d72ddb96fc0703561557c2bfe06ae81148cc541baf30abbbf6565b898e970d36` | Official English-language living-service entry point |

The first attempted statistics URL was the national-communique column, not the municipal column. The durable registry entry was corrected before downstream use, and the corrected municipal index was acquired separately. The mistaken snapshot remains only in the Git-ignored work directory and is not part of the evidence draft.

## Why no rich draft exists yet

The municipal index renders its article list through an official dynamic publishing endpoint. The deterministic collector captured the exact registered index but not the generated article list. CUAC will not infer a 2025 communique URL, reuse third-party copies or treat search snippets as acquired evidence.

Next work is to register and acquire the exact official article or attachment endpoint once discovered. Until then, Hangzhou stays at `city_evidence_acquired`, with no population, transit, cost or climate fact promoted into a rich draft.
