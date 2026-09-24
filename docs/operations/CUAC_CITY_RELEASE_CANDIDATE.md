# CUAC city release candidate

## Outcome

The city catalog now has a deterministic, non-public release-candidate path for the 26 cities that satisfy both prerequisites:

1. a hash-pinned official evidence draft exists; and
2. the current catalog contains at least one active school and one active program route for the city.

The remaining 61 production city identities stay outside this candidate because they have no active study route. The separate Dalian draft also remains outside this wave because the current route-readiness report does not classify it as an active catalog destination.

## Build

Run the inventory, source coverage and route report before creating a candidate:

```text
npm run catalog:cities:inventory
npm run catalog:cities:source-coverage
npm run catalog:cities:route-readiness
npm run catalog:cities:release-candidate
```

The last command reads the local database in a repeatable-read, read-only transaction. It validates each draft, validation report and evidence pack against the official-source registry, rejects prohibited domains, captures the exact database preimage, and writes `work/city-data/catalog-city-release-candidate.json`.

The candidate is hash-fixed and explicitly records:

- `humanReviewCompleted: false`;
- `executionAuthorized: false`;
- `persistentDatabaseWriteAuthorized: false`; and
- `publicationAuthorized: false`.

Owner default acceptance removes the need for per-record product-owner review, but does not pretend that human evidence review happened and does not make the artifact public.

## Disposable rehearsal

Run:

```text
npm run catalog:cities:release-candidate-rehearse
```

The command creates an owned, loopback-only, memory-backed PostgreSQL container, applies the actual migration release, loads exact minimal fixtures, applies the candidate in a serializable transaction, verifies a zero-change second pass, and rolls the transaction back. It then removes the owned container.

The test also exercises the real `PostgresCatalogRepository.listCities` query twice:

- the non-public candidate returns zero rows while its records remain `draft / unverified`;
- a savepoint-only hypothetical `active / verified` state returns all 26 cities, proving that the current public query and active school relation accept the candidate set once a separately authorized publication decision exists.

The hypothetical state is rolled back before the outer transaction is rolled back. It is not a database write or publication authorization. Rehearsal evidence is written to `work/city-data/catalog-city-release-candidate-rehearsal.json`.

## Production boundary

Do not point these commands at staging or production. A later release step must bind an exact target, preserve the candidate hashes, make a truthful review/publication decision, take a backup, and expose rollback controls. Until that step exists and is authorized, the public Cities page correctly remains empty even though the rich draft content is present locally.
