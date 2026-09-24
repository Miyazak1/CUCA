# CUAC Catalog Master Data Administration Contract

Status: implemented foundation; city and school management are complete entity workflows.

## 1. Purpose

CUAC keeps city, school, program, and scholarship records as governed catalog master data. Staff editing must not bypass source evidence, publication state, audit logging, or optimistic concurrency. Public catalog APIs continue to expose only records that meet their existing publication rules.

This contract defines one reusable administration architecture for all four entity types. It deliberately avoids separate ad-hoc forms, direct database edits, hard deletion, or browser-local persistence.

## 2. Current delivery boundary

The delivered vertical slices are **city management** and **school management**:

- list and inspect cities, including archived records;
- create a draft;
- edit a draft or published record with an `expectedVersion` precondition;
- bind an official HTTPS source and source label;
- publish only when required identity, content, source evidence, and review date are valid;
- archive and restore without hard deletion;
- inspect immutable revision history;
- write metadata-only security audit events in the same transaction as each mutation.

School management adds an active-city publication dependency and blocks archive while any non-archived program, non-archived scholarship, active school staff membership, or non-archived school application still depends on the school. School self-service corrections remain a distinct evidence-and-review workflow; an applied correction increments the same school version and writes a school revision so it cannot bypass Ops concurrency.

Program and scholarship public catalog reads already exist, but their general-purpose Ops create/edit/publish/archive screens and commands are **not delivered yet**. They must reuse this foundation instead of copying a weaker implementation.

## 3. Authority model

| Capability | Required live grant | Additional control |
| --- | --- | --- |
| Read catalog administration data | `cuac_ops` or `cuac_admin`, Ops workspace, catalog-management scope | none |
| Create or edit a draft/record | `cuac_ops` or `cuac_admin`, Ops workspace, catalog-management scope | optimistic version match |
| Publish, archive, or restore | `cuac_admin`, Ops workspace, catalog-management scope | recent password step-up |

Every request rechecks the live staff grant inside the database transaction. Client-supplied actor, role, tenant, or authority fields are never trusted. Ordinary catalog editing does not require dual approval; publication protection is provided by role separation, step-up authentication, evidence gates, version checks, immutable revisions, and audit.

## 4. City lifecycle

```text
create -> draft -> publish -> published -> archive -> archived -> restore -> draft
                   ^             |
                   |---- edit ---|
```

- Create always produces a draft at version 1.
- Each successful mutation increments the version exactly once.
- Direct Ops editing of an active city or school demotes it to draft until its changed source and content pass publication gates again. The separate school-submitted correction workflow retains its established `applied_unverified` state and remains visible for explicit data-quality follow-up.
- A stale `expectedVersion` fails with a conflict and does not overwrite newer work.
- Archive is reversible and does not remove revisions or evidence.
- City archive is blocked while non-archived schools or programs reference it; school archive is blocked while non-archived programs or scholarships, active staff, or non-archived school applications depend on it.
- Restore returns the city to draft so evidence and content can be reviewed before republishing.
- There is no hard-delete endpoint.

## 5. Evidence and publication gates

A city can be published only when:

- stable slug, English name, Chinese name, province/region, and summary are present;
- structured content is a bounded JSON object;
- source URL is a valid public `https://` URL;
- source label identifies the official source;
- evidence is bound to the same city and current publication action;
- the next review date is valid;
- the request has the required administrator role and password step-up.

Publication marks the active evidence verified and records the verification and next-review timestamps. Evidence content is stored for traceability; audit entries contain identifiers and changed-field metadata rather than full catalog content.

## 6. HTTP surface

All routes use the existing secure API boundary, server-derived session context, CSRF protection for mutations, and JSON error envelope.

| Method and route | Purpose |
| --- | --- |
| `GET /api/v1/ops/catalog/cities` | filtered city list |
| `POST /api/v1/ops/catalog/cities` | create draft |
| `GET /api/v1/ops/catalog/cities/:cityId` | city plus revision history |
| `PATCH /api/v1/ops/catalog/cities/:cityId` | versioned edit |
| `POST /api/v1/ops/catalog/cities/:cityId/publication` | evidence-gated publish |
| `POST /api/v1/ops/catalog/cities/:cityId/archive` | reversible archive |
| `POST /api/v1/ops/catalog/cities/:cityId/restore` | restore as draft |
| `GET /api/v1/ops/catalog/schools` | filtered school list |
| `POST /api/v1/ops/catalog/schools` | create school draft |
| `GET /api/v1/ops/catalog/schools/:schoolId` | school plus revision history |
| `PATCH /api/v1/ops/catalog/schools/:schoolId` | versioned school edit |
| `POST /api/v1/ops/catalog/schools/:schoolId/publication` | city- and evidence-gated publish |
| `POST /api/v1/ops/catalog/schools/:schoolId/archive` | dependency-protected archive |
| `POST /api/v1/ops/catalog/schools/:schoolId/restore` | restore as draft |

The formal Ops candidate exposes these commands under the catalog-management tab. It does not invent client-side authority or store working data in local/session storage.

## 7. Persistence and history

The shared `catalog_entity_revisions` table stores immutable snapshots for city, school, program, and scholarship entities. Each revision records:

- entity type and identifier;
- entity version;
- lifecycle action;
- bounded JSON snapshot;
- changed-field list;
- optional source-evidence identifier;
- actor identifier and timestamp.

The unique entity/version constraint prevents duplicate history generations. School and program rows now also carry a version field so later entity workflows can adopt the same concurrency contract without another foundation migration.

## 8. Failure behavior

- Missing, expired, disabled, wrong-workspace, or wrong-scope grants fail closed.
- Student and guest sessions cannot enter the Ops catalog workspace.
- Validation failures do not mutate data.
- Version conflicts do not silently merge or overwrite.
- Audit or revision-write failure rolls back the catalog mutation.
- Publication without valid official evidence fails rather than creating an unverified public record.

## 9. Verification evidence

The milestone is accepted only when all of the following pass:

- catalog-admin service and route tests;
- Ops frontend contract tests;
- policy tests;
- schema snapshot and migration release tests;
- real PostgreSQL create/edit/publish/archive/restore rehearsal inside an outer rollback;
- production build;
- production-server public catalog reads and unauthorized Ops denial;
- browser confirmation that a student session is redirected away from the Ops page.

## 10. Program master-data boundary

Program management is available under `/api/v1/ops/catalog/programs`. It owns program identity, school and campus-city relationships, degree and delivery attributes, tuition and public display fields, the application link, and official source evidence. A normal edit uses optimistic version matching, creates an immutable revision, clears verification, and moves an active record back to draft.

Publishing requires a stepped-up `cuac_admin`, an active school, an active city, a teaching language, a safe HTTPS application link, and matching stored official-source evidence. Restoring an archived program always returns it to an unverified draft.

The program form does **not** edit admissions cycles or application requirements. Those remain in `program_intakes`, school intake publications, and program requirement publications with their own review and publication histories. Program detail exposes dependency counts only. Archiving is rejected while any open intake, active requirement publication, non-archived linked scholarship, or non-removed application choice still depends on the program. Historical school applications retain their references and do not prevent catalog retirement.

## 11. Scholarship master-data boundary

Scholarship management is available under `/api/v1/ops/catalog/scholarships`. A scholarship may be global, school-scoped, or program-scoped. When a program is selected, its school is derived transactionally; a conflicting client-supplied school is rejected. Edits use optimistic version matching, append an immutable snapshot, clear verification, and return an active record to draft.

Publishing requires a stepped-up `cuac_admin`, coverage and applicable-degree content, a future exact deadline or an explicit rolling/deadline label, matching official-source evidence, and active linked school/program records. A linked program must belong to the scholarship school. Restoring always returns the record to an unverified draft.

Current student application choices prevent archival. Historical removed choices and program relationship rows remain available for audit and do not force hard deletion. Structured body, benefit, eligibility, material, step, contact and action-link fields are shape-checked and size-bounded by the service, with database checks preserving JSON container types.

## 12. Cross-entity publication readiness

The read-only readiness workspace is available under `/api/v1/ops/catalog/readiness`. It evaluates cities, schools,
programs and scholarships through the exact SQL predicates used by their publication lifecycle commands. Those
predicates are defined once in `publication-readiness.ts`; a preview therefore cannot report that a record is ready
while the corresponding publication command would reject the same database state.

The list endpoint returns an all-entity summary, type totals, issue counts and a bounded page of records. Filters are
limited to entity type, catalog status, ready/blocked state, an enumerated reason code, a bounded search term and
canonical pagination. The exact entity endpoint is `/api/v1/ops/catalog/readiness/{entityType}/{entityId}`. Both
require current CUAC staff authority and emit metadata-only audit events. Neither endpoint accepts writes, performs
publication, changes verification, or exposes source notes and evidence payloads.

Blocking reasons model actual publication gates: archived state, invalid or unmatched official evidence, missing
required fields, inactive city/school/program relationships, and unavailable scholarship deadlines. Warnings model
conditions that do not make the publication command fail, including drafts, verification state, overdue reviews,
near scholarship deadlines and rolling-deadline-only records. The Chinese Ops workspace can filter these results and
open the corresponding catalog editor, but the administrator must still perform the normal version-bound,
step-up-protected publication command.

## 13. Immutable release planning

Release planning is available under `/api/v1/ops/catalog/release-manifests`. An authorized operator selects an
explicit, unique set of readiness records and submits each record's exact entity type, identifier and expected version.
Creation runs in one transaction, locks the selected catalog rows, recomputes the canonical readiness projection and
fails the whole request if a record is missing, blocked or has changed version. A successful manifest freezes:

- the ordered entity identities and versions;
- stable slugs and operator-facing labels;
- ready state, empty blocker set, warning set and capture time;
- a SHA-256 digest of the canonical selection;
- creator, creation time and manifest generation.

Manifest items are immutable at the database layer. A manifest itself permits only one version-bound transition from
`frozen` to `superseded`; it cannot be edited or deleted. Superseding preserves the frozen snapshot and records the
actor and timestamp. A current-state read recomputes each item's readiness and reports `entity_missing`,
`version_changed`, `readiness_blocked` and `warnings_changed` drift without changing either the manifest or catalog.

| Method and route | Purpose |
| --- | --- |
| `GET /api/v1/ops/catalog/release-manifests` | list frozen or superseded plans and current drift counts |
| `POST /api/v1/ops/catalog/release-manifests` | transactionally freeze 1–100 explicitly selected ready versions |
| `GET /api/v1/ops/catalog/release-manifests/:manifestId` | read the frozen snapshot and current drift comparison |
| `POST /api/v1/ops/catalog/release-manifests/:manifestId/supersede` | version-bound, auditable retirement of a frozen plan |

These routes require live CUAC staff authority, use the secure mutation boundary, and emit metadata-only audit events.
They intentionally expose no publish, bulk-publish, edit or delete command. The Ops UI therefore provides planning
and drift review only; every catalog publication remains an individual evidence-gated, step-up-protected command.

## 14. Next stage

The next catalog-data stage is remediation execution: use the canonical blocker inventory to repair records through
the existing entity editors, then create a new immutable manifest from the versions that pass readiness. That stage
must preserve explicit operator selection and must not treat a manifest as authorization to publish.

The first deterministic remediation batch and its remaining blocker inventory are documented in
`CUAC_CATALOG_READINESS_REMEDIATION.md`. It uses the same entity update/publication services, revisions and audit
events as interactive Ops actions; the batch executor is local-only, dry-run by default, hash-bound and idempotent.
