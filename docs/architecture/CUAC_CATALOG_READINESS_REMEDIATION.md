# CUAC Catalog Readiness Remediation

Status: first deterministic batch applied to the local CUAC PostgreSQL database on 2026-09-23.

## Boundary

This workflow starts from the canonical publication-readiness projection used by the lifecycle commands. It does not
interpret a successful fetch as publication approval, invent missing admissions facts, activate archived records, or
silently repair missing relationships. Raw evidence remains separate from interpretation and publication.

The inventory command is local-only and defaults to a rollback transaction:

```powershell
npm run catalog:data:readiness-remediation
```

It writes the ignored working report `work/catalog-quality/catalog-readiness-remediation.json`. The report contains
the exact entity/version, blocker set, source-registration match and dependency status needed to reproduce triage.

## First baseline and result

The persistent database baseline contained 10,778 catalog records: 9,429 ready and 922 blocked. The earlier
10,782/924 measurement included four temporary records inside the catalog-admin rehearsal transaction and was not a
persistent-data count.

The first approved operation repaired Sichuan University's missing `schoolType`. The exact official snapshot says the
university offers a complete range of 13 disciplines. Its SHA-256 matched the registered acquisition manifest, and the
existing approved SCU bundle records that prohibited applicant data was excluded. The operation used the normal
version-bound school update and stepped-up publication services, producing versions 2 and 3, immutable revisions and
metadata-only audit events. It did not use direct table updates.

After the batch, 9,430 records are ready and 921 remain blocked:

| Group | Records | Decision |
| --- | ---: | --- |
| scholarship content/deadline gaps | 516 | wait for explicit current official coverage, degree and deadline facts |
| program language/application gaps | 401 | wait for explicit route language and official application entry |
| school relationship/website gaps | 4 | wait for a supported city relationship and official school URL |
| archived records within the groups above | 62 | intentionally remain blocked; never auto-activate |

The remaining reason counts overlap because one record can have more than one blocker: deadline unavailable 516,
missing applicable degree 366, missing coverage 366, missing teaching language 304, invalid application URL 262,
inactive or missing city relation 52, archived 62, and invalid school website URL 3.

## Apply contract

The committed batch declaration is
`catalog-sources/remediations/catalog-readiness-batch-01.json`. Its executor is dry-run by default:

```powershell
npm run catalog:data:readiness-remediation:apply
```

Actual local application additionally requires both `--apply` and the exact confirmation token printed in the script
contract. Before writing, it verifies loopback PostgreSQL, entity version, exact blocker set, source URL, raw artifact
SHA-256, supporting official text, prior approval mode and prohibited-data exclusion. The full batch runs in one
transaction. Re-running it after success returns `already_applied` and verifies the revision and audit history.

## Next batches

No remaining blocker is eligible for value inference. Follow-up work must be organized by official-source families:

1. current scholarship deadlines, coverage and applicable degrees;
2. route-specific program teaching languages and official application URLs;
3. missing city relationships and official school websites;
4. new-year replacement records for expired 2025/2026 scholarships.

Official material blocked by CAPTCHA, inaccessible attachments, oversized files or 404 responses may remain deferred,
as previously authorized. Deferred records remain blocked rather than receiving guessed values.
