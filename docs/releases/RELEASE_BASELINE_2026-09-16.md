# CUAC release baseline — 2026-09-16

Status: source candidate preparation for `school-handoff-v1`; not deployment approval.

## Included source scope

- Vinext application and public workspaces.
- PostgreSQL schema and immutable migrations through `0051_guide_governance`.
- Student, school and Ops server modules required by the school-handoff release.
- Deterministic public catalog search with Agent disabled.
- Production-readiness, staging-evidence and reviewed-start gates.
- Contract, backend and release-gate tests.
- Official-source registry and catalog acquisition/review tooling.

## Explicitly deferred capabilities

- Agent runtime and UI.
- Payment provider delivery.
- Student private-file upload.
- CUAC material submission and official external delivery.

These capabilities remain fail-closed. Their existing server foundations do not authorize them for this release.

## Catalog data custody

The `seeds/catalog.*.json` files produced during local acquisition, review and publication are data-release artifacts rather than application source. They remain on the workstation and are excluded from Git. `catalog-sources/local-artifact-manifest.json` records each artifact path, byte length and SHA-256 before the artifacts are moved to a protected object store.

The manifest is a custody inventory, not proof of cloud upload, approval or production import. Staging remains blocked until the approved catalog publication set is uploaded, bound to an immutable artifact identity and rehearsed against staging RDS.

## Required candidate gates

Before this branch can become a release tag:

1. Source status contains no unexpected untracked or modified files.
2. Secret scan reports no credential material in the candidate.
3. Production build, frontend contracts, backend suite and PostgreSQL schema check pass.
4. The exact source commit, application image digest and migration manifest digest are recorded together.
5. Staging acceptance and human release review remain separate mandatory gates.
