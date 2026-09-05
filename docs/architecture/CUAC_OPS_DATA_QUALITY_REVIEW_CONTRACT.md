# CUAC Ops Catalog Data-Quality Review Contract

Status: implemented and locally verified on 2026-09-03. This contract governs human review of catalog verification metadata. It is not a general catalog editor, source crawler, or Agent capability.

## 1. Scope

The workflow covers exactly four catalog entity types:

- `city`
- `school`
- `program`
- `scholarship`

The queue derives current issues from the entity verification fields and its latest stored `catalog_source_evidence` row. Supported issue codes are `missing_source_evidence`, `invalid_source_url`, `unverified`, `stale`, `disputed`, and `verification_metadata_missing`.

## 2. Private HTTP Surface

- `GET /api/v1/ops/data-quality/catalog`
- `POST /api/v1/ops/data-quality/catalog/:entityType/:entityId/review-claim`
- `POST /api/v1/ops/data-quality/catalog/:entityType/:entityId/review-escalation`
- `POST /api/v1/ops/data-quality/catalog/:entityType/:entityId/review-resolution`

The list accepts only `limit`, or the paired `cursorType` and `cursor` values. `limit` is between 1 and 50. Mutation identity comes only from the route; bodies cannot supply actor, role, grant, entity, source, or result identity.

## 3. Queue Projection

Each item is limited to entity type, entity UUID, display label, normalized verification status, last verification time, next review due time, entity update time, issue code, latest evidence UUID/HTTPS URL/label/capture time, and the current review projection.

The response excludes evidence notes, source metadata, lineage payloads, quality scores, missing-field arrays, staff grant IDs, arbitrary filters, raw SQL, and student/application/payment data. Invalid stored values fail closed with a redacted availability error.

## 4. Authority And Separation Of Duties

Reads and claims require an authenticated `cuac_ops` or `cuac_admin` session on the Ops surface with purpose `data_quality_review`. Every repository operation rechecks and locks the actor's current approved staff grant.

The claiming staff member owns the investigation and is the only actor allowed to escalate it. Resolution requires a different `cuac_admin` actor with password `step_up`. Revision compare-and-swap prevents stale or concurrent workflow changes. No role, grant, actor, or authentication strength is accepted from the request body.

## 5. Generation Binding

One review is bound to the exact tuple `(entity_type, entity_id, source_entity_updated_at, source_evidence_id)`. PostgreSQL uses `UNIQUE NULLS NOT DISTINCT`, so an entity generation without evidence is also unique.

Claim and resolution derive the current entity generation and latest evidence inside SQL. An entity update, evidence replacement, grant revocation, or competing workflow transition invalidates the old command and requires a fresh read. JavaScript timestamp precision is not trusted to decide generation equality.

## 6. Resolution Effects

- `source_confirmed` requires stored evidence. It changes the entity to `verified`, records the resolving user and database time, and requires `reviewDueAt` between 30 and 366 days after resolution.
- `source_conflict_confirmed` requires stored evidence. It changes the entity to `disputed` and clears verification identity and dates.
- `source_invalid` requires stored evidence. It changes the entity to `disputed` and clears verification identity and dates.
- `source_evidence_required_no_change` is allowed only when evidence is absent. It closes the review without changing the entity generation.

Every non-no-change entity update and its review result use the same database clock. No resolution edits catalog descriptive fields, replaces evidence, follows URLs, republishes requirements, retries delivery, changes payments, or creates school change requests.

## 7. Audit And Database Enforcement

Claim, escalation, resolution, entity mutation, and success audit commit in one transaction. Audit failure rolls back the workflow and entity together. Audit metadata contains only fixed action/status/code, review UUID, revision, and catalog entity reference; free text and evidence content are excluded.

Migration `0045_ops_catalog_quality_reviews` adds the review table, source-evidence composite identity, verifier foreign keys, next-review dates, lifecycle checks, and bounded due-date checks. Direct SQL attempts that violate lifecycle, source binding, dual control, or resolution shape are rejected by PostgreSQL constraints.

## 8. Verification Evidence

- focused service/repository/HTTP tests: `12/12`
- focused real PostgreSQL rehearsal: `3/3`
- complete backend command set: `746/746`
- PostgreSQL plus production-build HTTP rehearsal: `525/525`
- PostgreSQL 16.13 parity: 72 tables, 1121 columns, 416 constraints, 278 indexes
- migrations/snapshots: 46 migrations, 37 snapshots, baseline sealed through `0045`
- detached release: `c9527e5cd654e27182ef38e323e8bb9c41b54f8564dad767e04b8713fca3ea80`
- persistent local smoke: 8 current catalog quality items read through the real Ops session at `http://127.0.0.1:52118`

TypeScript and focused ESLint pass. The production HTTP run initially overlapped a live Vinext development process that shared the build directory; after stopping that process, the isolated rerun passed all 525 tests. Rehearsal and development builds must therefore remain single-writer operations.

## 9. Remaining Boundaries

This milestone does not prove source authenticity, fetch remote URLs, schedule automatic freshness checks, accept school-submitted corrections, provide broad catalog CRUD, expose a management UI, or complete Alibaba Cloud staging. It is not registered in the Agent Tool Gateway. Those capabilities require separate contracts and acceptance evidence.
