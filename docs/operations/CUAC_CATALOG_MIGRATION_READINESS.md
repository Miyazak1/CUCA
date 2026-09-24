# CUAC Catalog Migration Readiness

Date: 2026-09-23
Status: pre-approval preparation complete; execution, review and publication are not authorized

## Objective

Prepare the completed official catalog drafts for a later controlled migration without self-approving evidence, publishing unreviewed records or mutating the persistent local database. The preparation covers official replacements, recoverable quarantine candidates, field completion and program-intake candidates.

## Authoritative inputs

- `work/catalog-quality/catalog-data-integrity-audit.json`
- `work/catalog-quality/catalog-official-draft-coverage.json`
- `work/catalog-quality/catalog-data-reconciliation-candidates.draft.json`
- `work/catalog-quality/catalog-prohibited-source-remediation.draft.json`
- `work/catalog-quality/catalog-data-gap-queue.draft.json`
- `work/catalog-quality/catalog-data-remediation-plan.draft.json`
- `catalog-sources/official-completeness-exemptions.json`

Every generated report is non-authorizing. A report, candidate match or successful rehearsal is evidence of readiness only; it is not a review or publication decision.

## Current migration surface

| Category | Count | Current disposition |
| --- | ---: | --- |
| `set_if_null` field operations | 4,535 | Preconditions verified read-only; 32 use existing approved-local evidence and 4,503 remain review-deferred |
| Intake insert-if-absent operations | 160 | Preconditions verified read-only; all remain review-deferred |
| Exact prohibited-source replacements | 298 | Official draft candidate exists; review required |
| Prohibited-source quarantine candidates | 529 | No exact official replacement; proposed recoverable archive requires explicit approval |
| Conflicting official candidates | 0 | Gate passed |
| Public-eligible prohibited-source records | 0 | Public-exposure gate passed |

The deterministic normalized plan SHA-256 is `9fb9867cdd8a7d6149a607482f70b91818760e46b6374c09ae5588579ca69cfd` for the database and evidence state captured by the current readiness report. Any state or operation change must produce a new digest and a new review decision.

## Completed checks

`npm run catalog:data:migration-readiness` performs a repeatable-read, read-only database rehearsal and fails closed when an input becomes authorizing, a target changes, an evidence hash is invalid, a source is prohibited, an operation is duplicated or a classification is no longer exact.

Current result:

- all 4,535 field targets still satisfy `set_if_null`;
- all 160 intake targets are still absent for the exact program, term and year;
- all 827 prohibited-source target IDs, slugs, states and source URLs still match the classification report;
- all 298 replacement candidates use HTTPS official evidence with a 64-character SHA-256 and an existing school dependency where required;
- the first logical pass produces 5,522 changes;
- the second logical pass produces zero changes, proving plan-level idempotency;
- rollback restores the exact pre-image digest;
- every readiness gate is true;
- `executionAuthorized`, `publicationAuthorized` and `databaseWriteAuthorized` remain false.

The PostgreSQL migration runtime was exercised in Docker-owned, loopback-only PostgreSQL 16 containers using tmpfs. The standard catalog import rehearsal passed. The dedicated full-plan rehearsal then loaded all 5,522 proposed semantic changes into shadow operation tables, applied them in one serializable transaction, required the second pass to produce zero changes and rolled the transaction back to the exact original hash. In both rehearsals the owned container and memory-only data were removed after the test. The machine-readable full-plan result is `work/catalog-quality/catalog-data-migration-rehearsal.json`.

## Public exposure gate

The integrity audit separately checks records whose active status and verification state make them eligible for the public repository queries. The current count of public-eligible records whose source URL is a prohibited aggregator is zero. The broader 827-record cleanup queue remains active because inactive public exposure is not equivalent to acceptable persistent data provenance.

## Approval boundary

The following items cannot be manufactured by automation and are required before generating an executable bundle:

1. completed human review references for every draft replacement and review-deferred operation;
2. explicit approval of recoverable archival disposition for the 529 quarantine candidates;
3. a prohibited-data review confirming that the approved bundle contains no applicant, account, payment, file or personal-contact data;
4. fresh source and database hashes that still match the reviewed plan;
5. explicit selection of the target environment.

Until those conditions exist, no script may convert these drafts into version 2 reviewed bundles or call a persistent database writer.

## Approved execution design

After the approval boundary is satisfied, execution should follow this order:

1. freeze the reviewed candidate set and record its plan digest;
2. generate version 2 bundles whose handoff references the completed content and prohibited-data reviews;
3. capture exact pre-image rows for every affected ID into a deployment artifact encrypted and retained under the environment backup policy;
4. clone the target catalog into a disposable PostgreSQL rehearsal database;
5. apply field operations, intake inserts, exact replacements and recoverable archives in one transaction;
6. replay the same bundle and require zero semantic changes;
7. verify relationship, public-exposure, source-evidence and count postconditions;
8. run the same guarded transaction in staging;
9. complete staging acceptance before any production execution.

Physical deletion is excluded. Quarantine means a recoverable archive or equivalent non-public state selected during approval.

## Rollback design

- keep the pre-image keyed by entity type and immutable database ID;
- record the migration plan digest, source database identity, transaction timestamp and approved review references;
- if a postcondition fails, roll back the active transaction immediately;
- if a later rollback is required, apply the pre-image in a separate guarded transaction only when current rows still match the migration's post-image;
- rerun the complete integrity and public-exposure audit after rollback;
- never use broad deletes, slug-only restoration or an unverified backup.

## Commands

```powershell
npm run catalog:data:integrity-audit
npm run catalog:data:official-draft-coverage
npm run catalog:data:reconciliation-candidates
npm run catalog:data:prohibited-source-remediation
npm run catalog:data:gap-queue
npm run catalog:data:remediation-plan
npm run catalog:data:migration-readiness
npm run catalog:data:migration-rehearse
npm run catalog:migration:test
npm run catalog:official:test
npm run catalog:migration:rehearse
```

The final command creates and removes a disposable local PostgreSQL container. It does not authorize or execute the unreviewed remediation plan.
