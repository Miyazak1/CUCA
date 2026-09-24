# CUAC scholarship cycle governance

## Outcome

CUAC treats a scholarship's admissions cycle and its current application availability as separate facts.
A title such as “2026–2027 academic year” is not proof that a 2027 intake is open. An expired 2026
deadline is retained as historical evidence and is never moved forward automatically.

The first governed cycle is the Zhejiang University of Technology International Chinese Language
Teachers Scholarship one-semester route for the March 2027 intake. Its official deadline remains
October 20, 2026. The record was already published from reviewed official evidence; this stage adds
immutable cycle lineage and does not rewrite the scholarship.

## Data contract

`scholarship_cycle_lineage` stores one immutable cycle registration per scholarship:

- `series_key` groups future annual replacements without merging their content;
- `cycle_key`, `intake_year`, and `intake_label` identify the exact intake;
- `supersedes_scholarship_id` is nullable for the first known cycle and points to the exact prior
  scholarship record when a later official cycle is published;
- official URL, snapshot SHA-256, and capture time bind the relationship to evidence;
- update and delete are rejected by a database trigger. Corrections require a separately governed
  remediation rather than silent history rewriting.

The public scholarship DTO exposes:

- `applicationAvailability`: `open`, `closed`, or `unconfirmed`, computed from the recorded deadline;
- `cycle`: immutable series/cycle metadata when registered;
- `availability=open|closed|unconfirmed` as an optional public list filter.

## Classification rules

As-of time is always explicit in repeatable inventory runs.

1. `open`: `deadlineDate` is strictly later than the as-of timestamp.
2. `closed`: `deadlineDate` is on or before the as-of timestamp.
3. `unconfirmed`: no machine-readable deadline exists. CUAC does not infer one.
4. `explicit_2027_intake`: the published text explicitly connects 2027 with an intake/entry/term.
5. `academic_year_2026_2027`: a year range exists, but it is not by itself treated as a 2027 intake.

Records that are closed remain historical. Records with missing deadlines or no new official cycle enter
the waiting queue. When a school publishes the next guide, CUAC creates a new scholarship record and
registers it in the same series with `supersedes_scholarship_id`; it never overwrites the prior cycle.

## Local runbook

```powershell
npm run db:pg:migrate
npm run catalog:scholarships:cycle-inventory -- --as-of=2026-09-23T00:00:00.000Z
npm run catalog:scholarships:cycle-apply
npm run catalog:scholarships:cycle-apply -- --apply --confirm=apply-scholarship-cycle-batch-01-to-cuac-local
```

The apply command is dry-run by default, restricted to loopback PostgreSQL, verifies the exact source and
approval hashes, locks and checks the scholarship version, writes in one transaction, is idempotent, and
records a metadata-only audit event.

## First inventory baseline (2026-09-23)

- 596 scholarship records total;
- 516 scholarship records blocked by catalog readiness gates;
- 38 records with a 2027 signal;
- 9 signal-bearing records with a future deadline, 26 closed, and 3 unconfirmed;
- one immutable cycle lineage registration completed for the ZJUT March 2027 route.

The generated detail and waiting queue are written to
`work/catalog-quality/catalog-scholarship-cycle-inventory.json`; this path is operational output and is not
a source-of-truth artifact.
