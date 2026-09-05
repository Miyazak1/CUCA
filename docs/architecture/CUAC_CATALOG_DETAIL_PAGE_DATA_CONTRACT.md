# CUAC Catalog Detail Page Data Contract

Status: implementation contract for the public city, school, program, and scholarship detail pages.

## Purpose

The four public detail pages must render published PostgreSQL catalog records. They must not infer missing facts, copy values from demo fixtures, or expose internal operations fields merely because those fields exist in the database.

## Identity and routes

| Entity | Public API identity | Detail API | Browser query compatibility |
| --- | --- | --- | --- |
| Program | UUID | `GET /api/v1/catalog/programs/:programId` | `program=<UUID>` |
| School | UUID | `GET /api/v1/catalog/schools/:schoolId` | `university=<UUID>` |
| Scholarship | UUID | `GET /api/v1/catalog/scholarships/:scholarshipId` | `scholarship=<UUID>` |
| City | normalized slug | `GET /api/v1/catalog/cities/:citySlug` | `city=<slug>` |

Program, school, and scholarship detail identifiers are validated as UUIDs before repository access. City slugs are lowercase URL-safe segments. Legacy fixture slugs may be resolved only by first finding the matching published list record; they are not passed to UUID routes.

## Shared display rules

- Render only fields present in the detail response.
- A missing value is shown as unavailable or the section is omitted. It is never replaced by a plausible value.
- Verification state, source label, source URL, and last verification time are displayed together.
- `disputed` and `invalid` remain distinct public source states; they must not be collapsed into `unknown`.
- External links are limited to server-provided `http` or `https` URLs and open with `noopener noreferrer`.
- User-visible arrays are rendered only when the API value is an array. Unknown JSON shapes do not become prose.
- Internal fields remain excluded at the SQL projection boundary: source notes, reviewer identities, next-review dates, quality scores, missing-field audits, completeness labels, staff/tenant data, school contact notes, fit notes, and scholarship contact information.

## Program detail

The program detail DTO contains the list summary plus its slug, city relation, duration, subject area, CSCA fields, HSK and English requirements, scholarship note, display grouping, verification status, update time, active school reference, and active city reference.

Related calls:

- `GET /api/v1/catalog/programs/:programId/intakes`
- `GET /api/v1/catalog/programs/:programId/intakes/:intakeId/requirements` after the user selects an intake

The page must not invent intake availability, deadlines, application requirements, eligibility, admission probability, or scholarship guarantees.

## School detail

The school detail DTO contains the list summary plus city and province context, region label, ranking text, CSCA requirements, language requirements, subject and language tags, tuition band, campus highlights, update time, and up to eight published upcoming intake deadlines.

Quality score, missing fields, completeness status, fit notes, staff data, tenant data, and internal contact notes are not public detail fields.

## Scholarship detail

The scholarship detail DTO contains the list summary plus Chinese name, applicable degree/program text, body sections, benefits, tags, version, publication and verification states, field lineage, update time, and active related school/program references.

`contactInfo` is not public. Action links are the only callable external destinations. The page must not claim guaranteed funding, automatic eligibility, or a fixed award when the source fields do not state it.

## City detail

The city detail DTO contains the list representation plus database identity, source and verification metadata, and field lineage.

`references` are imported catalog snapshot counts. Existing `actual*` aliases are retained temporarily for compatibility but are not authoritative live aggregates and must not be used by the new detail page. The page labels `references` as catalog coverage. A future aggregate endpoint may add live counts after query cost and consistency are separately governed.

City climate, industries, lifestyle pace, safety, transport, or housing claims appear only when the corresponding key exists in the source-backed `content` object. The page never creates those claims from the city name, region, density, or cost level.

## Page information architecture

| Page | Primary decision | Required sections |
| --- | --- | --- |
| Program | Can I apply to this exact program and intake? | identity, fee/language/duration, intake timeline, requirements, official source, next action |
| School | Does this institution contain suitable published routes? | identity/location, catalog coverage, admissions/language/CSCA, upcoming deadlines, official links |
| Scholarship | Is this funding route applicable and actionable? | identity/provider, value and coverage, eligibility, materials, steps, deadline, related entities, official actions |
| City | Should I use this city as a catalog filter? | identity/region, cost data, source-backed city content, catalog coverage, nearby references, source state |

## Detail-page visual boundary

- The four catalog list pages keep their existing presentation. This contract applies only to the four detail pages.
- Detail pages use an unframed, record-first layout: compact identity header, source-status rail, four-item fact strip, document sections, and a narrow action column.
- Hero-scale marketing composition, nested cards, decorative gradients, and fabricated imagery are excluded from catalog records.
- Optional sections such as city tags, nearby references, scholarship materials, and campus highlights are omitted when their published arrays are empty. Core decision fields retain an explicit unavailable state.
- Boolean values remain visible when `false`; absence and a negative value are not treated as the same state.
- Numbered labels are reserved for ordered application steps. Benefits, eligibility criteria, materials, tags, and nearby references are not presented as an invented sequence.

## Verification evidence

- Focused catalog mapper, service, repository, HTTP, and route tests cover the DTO split, identifier validation, status preservation, SQL exclusions, and active related-entity joins.
- TypeScript build validates the public repository and service contracts.
- Local PostgreSQL-backed HTTP calls verify all four detail routes and confirm that scholarship contact information is absent.
- On 2026-09-03, `test:catalog-detail-frontend`, the focused rendered-HTML contract test, ESLint, JavaScript syntax validation, TypeScript project validation, and the production build passed.
- Browser checks at 1280px and 390px covered program, school, city, and scholarship-unavailable states with no horizontal overflow or console warnings/errors. The local catalog currently has no published scholarship record, so populated scholarship rendering remains contract-tested rather than represented by synthetic UI data.
