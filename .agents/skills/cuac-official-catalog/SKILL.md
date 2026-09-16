---
name: cuac-official-catalog
description: Acquire and review CUAC university, program, admissions, and scholarship evidence from explicitly registered official sources. Use for refreshing the CUAC catalog or checking whether official source content changed; do not use to scrape third-party aggregators or publish unreviewed data.
---

# CUAC Official Catalog

Use the repository's deterministic collector for official catalog evidence. Keep acquisition, interpretation, and publication as separate decisions.

## Workflow

1. Read `docs/catalog-official-acquisition.md` and `catalog-sources/official-sources.json`.
2. Confirm each requested source is an exact official authority or university URL and is within the user's requested scope. Never add CSCA.app or another aggregator to the registry without its explicit written permission.
3. Run `npm run catalog:official:validate` before network access.
4. Run the narrowest collection possible with `node scripts/catalog-official-collect.ts --source=<id>`. Use the full collection only when the user requests a refresh of all registered sources.
5. Compare with a prior manifest when available. Treat any changed hash, redirect, missing source, unexpected content type, or old admissions year as a review item.
6. Read [references/review-policy.md](references/review-policy.md) before extracting fields or preparing a catalog v2 bundle.

Do not log in, submit forms, crawl discovered links recursively, bypass access controls, collect applicant data, or write acquisition output to a persistent database. Raw snapshots belong under ignored `work/catalog-official/`; do not commit them. A successful fetch never authorizes publication.
