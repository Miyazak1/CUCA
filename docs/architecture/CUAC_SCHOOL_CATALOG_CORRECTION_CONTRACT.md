# CUAC School Catalog Correction Contract

Date: 2026-09-03

Status: implemented and verified locally against PostgreSQL 16.

## 1. Purpose

School staff may report a correction to their own school's public catalog record without receiving direct catalog write authority. CUAC staff review the request through a separate Ops surface. One staff member claims the request and a different step-up CUAC administrator records the final resolution.

This workflow does not grant Agent access and is not registered as an Agent tool.

## 2. Supported Fields

Only these existing `schools` fields are accepted:

- `websiteUrl` -> `schools.website_url`
- `admissionsUrl` -> `schools.admissions_url`
- `applicationLevel` -> `schools.application_level`
- `languageOfInstruction` -> `schools.language_of_instruction`
- `deadlineSummary` -> `schools.deadline_summary`
- `tuitionSummary` -> `schools.tuition_summary`
- `applicationFee` -> `schools.application_fee`

Names, school identity, status, source evidence ownership, verification authority, staff access, and tenant identity cannot be changed through this workflow. The repository uses fixed SQL columns; field names are never interpolated into SQL.

## 3. HTTP Contract

School surface:

- `GET /api/v1/school/catalog-corrections`
- `POST /api/v1/school/catalog-corrections`

The submit body contains exactly:

```json
{
  "sourceSchoolUpdatedAt": "2026-09-03T01:00:00.000000Z",
  "changes": { "websiteUrl": "https://example.edu/" },
  "evidenceUrl": "https://example.edu/official-notice",
  "reasonCode": "official_website_changed"
}
```

Ops surface:

- `GET /api/v1/ops/catalog-corrections?status=<status>&limit=<1..100>`
- `POST /api/v1/ops/catalog-corrections/:correctionId/claim`
- `POST /api/v1/ops/catalog-corrections/:correctionId/resolution`

Claim requires `expectedRevision: 1`. Resolution requires `expectedRevision: 2`, a fixed resolution code, and a bounded evidence reference.

## 4. Authority And Lifecycle

School reads and submissions require all of the following:

- an active account and `school_staff` role;
- the school surface and `school_catalog_correction` purpose;
- an active staff membership for the exact tenant school;
- session or step-up authentication strength.

Ops reads and claims require an active `cuac_ops` or `cuac_admin` grant. Final resolution requires `cuac_admin`, the Ops surface, the `catalog_correction_review` purpose, and step-up authentication.

Lifecycle:

1. `submitted`, revision 1
2. `claimed`, revision 2
3. `applied` or `rejected`, revision 3

The resolving user must differ from the claiming user. PostgreSQL constraints bind requester membership and CUAC grants to the recorded roles.

## 5. Publication Semantics

`applied_unverified` performs a database-side compare-and-swap against the exact source school generation. The API returns that generation as a six-digit UTC timestamp so browser JSON conversion cannot truncate PostgreSQL microseconds.

An applied correction:

- writes only the submitted supported fields;
- sets `verification_status` to `unverified`;
- clears `verified_by_user_id`, `last_verified_at`, and `next_review_due_at`;
- appends field lineage in the form `school_catalog_correction:<request-id>:unverified`;
- records the resulting school timestamp in the request.

A rejected correction never changes the school row. Stale school generations, duplicate active requests, same-person resolution, revoked authority, weak authentication, invalid evidence URLs, and audit failures fail closed.

## 6. Data And Audit Boundaries

The school projection hides CUAC actor identities. Audits include workflow IDs, school ID, field names, status, revision, reason or resolution code, and the policy decision ID. Proposed values and evidence URLs are not copied into audit metadata.

Evidence URLs must be canonical credential-free HTTPS URLs with length between 9 and 2048 characters. Structured changes are bounded by field-specific limits and database checks.

## 7. Database Artifacts

- `0046_school_catalog_corrections.sql` creates the workflow table, authority foreign keys, lifecycle checks, active-generation uniqueness, and indexes.
- `0047_school_catalog_correction_url_check.sql` replaces the PostgreSQL-incompatible URL repetition expression with a portable HTTPS and length check.
- Both migrations and their snapshots are sealed in `drizzle/pg/_schema-baseline.json` through index 47.

## 8. Verification Evidence

Verified on 2026-09-03:

- TypeScript build: passed.
- Focused service, repository, HTTP, policy, migration, and snapshot tests: passed.
- Full `npm run test:backend`: passed.
- Default production frontend gate `npm test`: production build plus 42 API-specific frontend contract tests passed.
- Disposable PostgreSQL 16 migration and repository rehearsal: 417 tests passed, 0 failed.
- Schema parity: 73 public tables, 1145 columns, 424 constraints, and 283 indexes.
- Persistent local runtime: PostgreSQL on `127.0.0.1:62251` and application on `http://127.0.0.1:52118` both healthy after migrations 46 and 47 were applied.

The legacy monolithic `tests/rendered-html.test.mjs` still contains frontend-only demo assertions for `design-lab`, `CuacDataClient`, local browser state, and the old Agent scenario UI. It is not accepted as a production gate until those assertions are migrated to the existing API-specific frontend contract suites; it must not be skipped or reported as passing.
