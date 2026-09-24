# CUAC Catalog Release Candidate

Date: 2026-09-23
Status: candidate and actual-schema rehearsal complete; awaiting real staging target configuration
Publication: not authorized

## Decision model

The project owner chose default acceptance for hash-pinned official evidence candidates without per-record human review. The durable decision is recorded in `catalog-sources/owner-default-acceptance.json`.

This decision does not fabricate a completed human review. The release candidate records `humanReviewCompleted: false`, keeps official replacements non-public as `draft`, uses recoverable `archived` status for prohibited-source records and never performs physical deletion.

Official evidence conflicts remain unresolved. Sources blocked by CAPTCHA, unavailable or oversized attachments, 404 responses or absent official disclosure remain skipped with their gap records intact.

## Candidate surface

| Operation | Count | Rehearsed disposition |
| --- | ---: | --- |
| Official replacements | 298 | Update evidence-backed fields and keep `draft` / `unverified` |
| Null/blank field fills | 4,535 planned; 3,717 effective after replacements | Compare-and-set only |
| Program intakes | 160 | Insert only when program, term and year are absent |
| Prohibited-source records | 529 | Recoverable `archived` state |
| Catalog target rows with rollback preimages | 1,730 | Full target-row preimage retained in the ignored candidate artifact |

The difference between 4,535 planned field operations and 3,717 effective field changes is intentional: official replacements run first and populate some of the same blank fields. The later compare-and-set operations then make no conflicting change.

## Immutable identifiers

- readiness plan SHA-256: `9fb9867cdd8a7d6149a607482f70b91818760e46b6374c09ae5588579ca69cfd`
- operation payload SHA-256: `fa44d9bb0ab91d0386d857b2a0edc7c1236acbba4b2a0e9694fe40e910836844`
- rollback preimage SHA-256: `4ae19a2f1851936092b8e6589870d5218bba57f7bee9d9ac5976c4481b3835cd`
- rehearsal fixture SHA-256: `4d38dd2b08bc63494509f81921919dcc651a83f1037681fe55273e61e7373765`
- database migration release SHA-256: `51b42da63e231c1b7d67724cb428ae07d8f2959d7b6a5ab281c38ceb2b4f6ff4`

Any data, source, migration or target change requires regeneration and a new rehearsal. Hash drift is a hard failure.

## Completed verification

The full package was loaded into the real CUAC PostgreSQL catalog tables in a disposable PostgreSQL 16 container with loopback-only networking and memory-only storage.

- schema migrations ran before candidate loading;
- catalog foreign keys and real column types were exercised;
- the first pass performed 4,704 effective actions;
- a second pass performed zero actions;
- public-eligible prohibited-source records remained zero;
- transaction rollback restored the exact pre-migration target hash;
- the owned Docker container and all memory-only data were removed.

Machine-readable evidence is generated at `work/catalog-quality/catalog-data-release-candidate-rehearsal.json`. The ignored release candidate is generated at `work/catalog-quality/catalog-data-release-candidate.json`.

## Target binding

The candidate is deliberately separate from its deployment target. A target binding must provide all of the following:

- environment fixed to `staging`;
- exact database name and database user;
- exact database host;
- SHA-256 of the TLS certificate used for the database connection;
- SHA-256 of a separately supplied one-time confirmation token;
- the exact readiness, operations and preimage hashes above;
- migration mode fixed to `non_public_draft_and_archive_only`;
- `publicationAuthorized: false`.

Use `config/catalog-data-target.example.json` as the shape. Do not place passwords, connection strings or plaintext confirmation tokens in that file or in Git.

The gate rejects production bindings, missing TLS identity, hash drift and any attempt to authorize publication.

## Commands

```text
npm run catalog:data:release-candidate
npm run catalog:data:release-candidate-rehearse
npm run catalog:data:release-gate
```

With a real target descriptor available outside Git:

```text
CUAC_CATALOG_TARGET_CONFIG=<absolute-path-to-target-json> npm run catalog:data:release-gate
```

The gate is non-executing. Passing it does not connect to or modify the target database.

## Current stop boundary

All local release-candidate work is complete. The remaining input is real Hong Kong staging infrastructure configuration: database host, database name, migration user, TLS certificate fingerprint and a securely generated one-time confirmation token. Database credentials must be supplied through the deployment secret mechanism, not committed files.

Production publication remains a separate decision because this candidate explicitly records that per-record human review was not completed.
