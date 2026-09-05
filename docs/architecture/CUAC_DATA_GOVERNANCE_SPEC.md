# CUAC Data Governance Spec

Date: 2026-08-14

Status: production data governance draft.

## 1. Purpose

CUAC's credibility depends on accurate China university, program, scholarship, deadline, tuition, and guide data. This document defines how catalog data is sourced, verified, updated, audited, and exposed.

## 2. Data Domains

- Schools
- Programs
- Program intakes
- Scholarships
- Cities
- Guides
- Document requirement guidance
- Source evidence
- Student-generated profile/application data
- School-generated status/contact data

Catalog data and personal data must be governed differently.

## 3. Source Types

### Official School Source

Examples:

- university admissions website;
- international office page;
- official program brochure;
- official email confirmation.

Highest trust.

### Government Or Scholarship Source

Examples:

- CSC pages;
- city/provincial scholarship pages;
- official education portals.

High trust.

### School Tenant Input

School staff updates data through school portal or change request.

Trust depends on school verification status and role.

### CUAC Ops Research

CUAC staff manually verifies data from sources.

### Imported Or Crawled Data

Useful for discovery, but must be reviewed before public `verified` status.

## 4. Source Status

Catalog records use:

- verified
- stale
- pending
- disputed
- archived

Definitions:

| Status | Meaning |
| --- | --- |
| verified | Source reviewed recently and suitable for display |
| stale | Previously valid but review window expired |
| pending | Imported or drafted, not yet verified |
| disputed | Conflicting information exists |
| archived | Not active for public display |

## 5. Verification Rules

Required verification fields:

- source_url or evidence note;
- verified_by_user_id;
- last_verified_at;
- next_review_due_at;
- source_status.

Review windows:

- deadlines: 30 to 60 days during application season;
- tuition: annual;
- scholarships: 30 to 90 days depending on cycle;
- program availability: annual or school-confirmed;
- city guides: annual;
- general guides: annual or policy-triggered.

## 6. Data Ownership

| Data | Owner |
| --- | --- |
| Program catalog | CUAC Ops, school owners for requests |
| School profile | CUAC Ops plus school owners |
| Scholarship catalog | CUAC Ops |
| City guides | CUAC Content/Ops |
| Student profile | Student |
| Application choices | Student until submission; then immutable snapshot |
| School application status | School tenant |
| Payment records | CUAC Finance/Ops |
| Agent logs | CUAC platform |

## 7. Change Workflow

1. Record created or imported as pending.
2. CUAC Ops reviews source evidence.
3. Record becomes verified or disputed.
4. Public pages display verified data and cautious copy for stale/pending data.
5. Source freshness job marks outdated records stale.
6. Ops dashboard queues stale and disputed records.
7. Changes are audited.

## 8. School Change Requests

Schools can request:

- program name update;
- intake/deadline update;
- tuition update;
- availability update;
- contact email update;
- scholarship note update;
- document checklist guidance.

MVP approach:

- school submits change request;
- CUAC Ops approves and publishes.

Later:

- trusted school owners can publish selected tenant-owned fields directly with audit.

## 9. Data Quality Checks

Automated checks:

- deadline date in the past while status open;
- tuition missing for paid degree programs;
- English-taught program with no English requirement note;
- Chinese-taught program with no HSK note;
- scholarship linked to closed intake;
- stale source older than threshold;
- duplicate program names under same school/intake;
- broken source URL.

## 10. Search And Ranking Signals

Search ranking can use:

- query relevance;
- verified source boost;
- deadline urgency;
- scholarship signal;
- student preference match;
- city/budget fit;
- document burden;
- school partnership status.

Ranking must not imply admission guarantee.

## 11. Agent Data Use

Agent can use:

- verified and stale catalog data with source caveat;
- student-owned data;
- school-scoped records;
- approved guide content.

Agent must disclose uncertainty when data is stale or pending.

Agent must not turn stale/pending data into confident claims.

## 12. Audit Requirements

Audit:

- catalog publish;
- source verification;
- school change request approval;
- status changes from verified to stale/disputed;
- bulk import;
- bulk update;
- destructive archive.

Audit log should include before/after snapshots.

