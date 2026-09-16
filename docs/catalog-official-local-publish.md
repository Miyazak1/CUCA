# Official catalog local publication

This runbook publishes only the reviewed v2 candidate bundle to the CUAC local-development PostgreSQL instance. It is not a production or staging deployment path.

## Current reviewed bundle

- Bundle: `seeds/catalog.official-five.local.json`
- Review reference: `product-owner-chat-approval-2026-09-10`
- Scope: four cities, five universities, one directly evidenced UIBE undergraduate program, and no scholarships
- Omitted values remain unpublished when the registered official page does not support them.

## Verification and rehearsal

```powershell
npm.cmd run catalog:official:test
node scripts/catalog-seed-dry-run.ts seeds/catalog.official-five.local.json
node scripts/pg-rehearse.ts --catalog-seed=seeds/catalog.official-five.local.json
```

The rehearsal creates a disposable local PostgreSQL container, imports twice to verify deterministic replay, and removes the container and its memory-only data.

## Publish to the current local runtime

```powershell
npm.cmd run catalog:official:publish-local
```

The publisher fails closed unless all of the following match: generated CUAC local runtime identity, loopback PostgreSQL target, persistent local container and volume names, database role and name, reviewed v2 handoff, exact confirmation token, and exact review reference. Connection credentials are never printed.

After publication, verify through `/api/v1/catalog/schools`, `/api/v1/catalog/programs`, `universities.html`, and `programs.html`.
