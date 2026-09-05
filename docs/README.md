# CUAC Documentation

This directory is the version-controlled documentation package for CUAC.

## Start Here

- `DEVICE_HANDOFF_2026-09-05.md`: device-transfer handoff, current verified state, setup steps, safety boundaries, and next work.
- `architecture/CUAC_PRODUCTION_DESIGN_INDEX.md`: design and architecture reading order.
- `architecture/CUAC_PRODUCT_PRODUCTION_ROADMAP.md`: production roadmap and implementation status.
- `architecture/CUAC_FULL_BACKEND_BLUEPRINT.md`: backend architecture and delivery blueprint.
- `architecture/CUAC_POSTGRES_REHEARSAL_REPORT.md`: current PostgreSQL and HTTP rehearsal evidence.
- `architecture/CUAC_LOCAL_DEVELOPMENT_RUNBOOK.md`: local runtime operations.
- `architecture/CUAC_STAGING_ACCEPTANCE_RUNBOOK.md`: Alibaba Cloud staging acceptance process.

## Layout

- `architecture/`: the complete top-level CUAC design, contract, roadmap, research, and runbook set copied into the Git repository for device portability.
- `design-lab/`: design-lab Markdown specifications and reviews. Runtime browser profiles and generated captures are intentionally excluded.
- `migration-intake/`: documentation-only legacy migration references. Raw CSCAlite source files and databases are not part of this repository.

The executable application, API, migrations, tests, and local launchers live at the repository root. Environment files, generated credentials, local PostgreSQL state, release artifacts, browser profiles, and test outputs must remain untracked.
