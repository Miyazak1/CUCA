# CUAC Documentation

This directory is the version-controlled documentation package for CUAC.

## Start Here

- `DEVICE_HANDOFF_2026-09-05.md`: device-transfer handoff, current verified state, setup steps, safety boundaries, and next work.
- `architecture/CUAC_PRODUCTION_DESIGN_INDEX.md`: design and architecture reading order.
- `architecture/CUAC_PRODUCT_PRODUCTION_ROADMAP.md`: production roadmap and implementation status.
- `architecture/CUAC_CITY_DATA_SOURCE_AND_PUBLICATION_SPEC.md`: production city fields, official source hierarchy, evidence workflow, publication gates, multilingual rules, and Beijing pilot sources.
- `architecture/CUAC_CATALOG_MASTER_DATA_ADMIN_CONTRACT.md`: shared production administration contract for city, school, program, and scholarship master data; city and school management workflows are implemented.
- `operations/CUAC_CITY_RELEASE_CANDIDATE.md`: 26-city hash-fixed candidate generation, actual-schema disposable rehearsal, public-query proof, and the remaining production boundary.
- `operations/CUAC_BEIJING_CITY_PILOT_EVIDENCE_REVIEW.md`: acquired Beijing official evidence, snapshot hashes, review state, and remaining publication gaps.
- `operations/CUAC_CATALOG_DATA_INTEGRITY_PHASE.md`: full school, program, intake and scholarship completeness/relationship audit and blocker accounting.
- `operations/CUAC_CATALOG_MIGRATION_READINESS.md`: non-authorizing migration surface, safety gates, rehearsal evidence, approval boundary and rollback design.
- `operations/CUAC_CATALOG_RELEASE_CANDIDATE.md`: owner-default-accepted non-public candidate, immutable hashes, actual-schema rehearsal and staging target binding.
- `operations/CUAC_SCHOLARSHIP_CYCLE_GOVERNANCE.md`: 2027 scholarship availability classification, immutable annual lineage, waiting queue and anti-roll-forward controls.
- `architecture/CUAC_FULL_BACKEND_BLUEPRINT.md`: backend architecture and delivery blueprint.
- `architecture/CUAC_POSTGRES_REHEARSAL_REPORT.md`: current PostgreSQL and HTTP rehearsal evidence.
- `architecture/CUAC_LOCAL_DEVELOPMENT_RUNBOOK.md`: local runtime operations.
- `architecture/CUAC_STAGING_ACCEPTANCE_RUNBOOK.md`: Alibaba Cloud staging acceptance process.
- `releases/LOCAL_RELEASE_CANDIDATE_2026-09-24.md`: current local release-candidate evidence, retired-test boundary, Hong Kong staging inputs, and ordered staging handoff.

## Layout

- `architecture/`: the complete top-level CUAC design, contract, roadmap, research, and runbook set copied into the Git repository for device portability.
- `design-lab/`: design-lab Markdown specifications and reviews. Runtime browser profiles and generated captures are intentionally excluded.
- `migration-intake/`: documentation-only legacy migration references. Raw CSCAlite source files and databases are not part of this repository.

The executable application, API, migrations, tests, and local launchers live at the repository root. Environment files, generated credentials, local PostgreSQL state, release artifacts, browser profiles, and test outputs must remain untracked.
