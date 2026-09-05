# CUAC Application Policy-Bound Authorization Contract

Status: implemented and locally sealed for PostgreSQL migration `0028` and the student application authorization service. It is not a formal-submission, Billing, legal, browser, or Alibaba Cloud production approval.

## 1. Stable application identity

An application choice is identified by one student-owned `application_choice` targeting exactly one:

- school;
- program;
- program intake; and
- explicitly selected admission route.

The authoritative business grain is therefore `student + program + intake`. A university-level form or portal may later group multiple program applications for transport, but it must not merge their authorization, material, status, result, or audit history.

## 2. Authorization v2 scope

Every newly confirmed submission authorization must use
`cuac.application-submission-authorization.v2` and bind all of the following into its immutable SHA-256 scope envelope:

- student, application set, application choice, school, program, and program intake;
- the admission route stored on the application choice;
- the exact reviewed official-submission-policy version and publication revision;
- policy document, target-set, and approval digests validated by the server;
- material selection revision, source revisions, selection digest, and material-content digest;
- the published privacy-notice version, publication revision, locale, and content digest.

The student request must echo the public policy identity shown during review: admission route, version id, publication revision, and document digest. The server obtains and validates the target-set and approval digests itself; internal reviewer identities or evidence are never accepted from or returned to the student.

## 3. Write rules

An authorization write succeeds only when, in one database transaction:

1. the account and active student role are valid;
2. the application set and choice are editable and have an exact program-intake target;
3. the choice has a non-null admission route;
4. the target and application window are available;
5. material selection, source revisions, rendered preview digest, and privacy notice still match the reviewed request;
6. the current policy publication for the exact program, intake, and stored route is active, approved, effective, and digest-valid;
7. the request's expected policy identity matches that publication; and
8. the policy publication/version/selected-target rows remain share-locked until the authorization and audit event commit.

A byte-identical active v2 scope is idempotent. Any changed scope supersedes the prior active authorization; history is never rewritten.

## 4. Currentness rules

An authorization is current only when it is active v2 evidence and all bound choice, material, source, notice, target, window, route, and policy facts still match.

At minimum, these changes make it non-current:

- application choice, program, intake, or route changes;
- policy withdrawal, replacement, publication-revision change, expiry, or digest mismatch;
- material selection or source-revision changes;
- notice withdrawal, replacement, expiry, or digest mismatch;
- target/window closure; or
- creation of a school application for that choice.

Preflight may remove `SUBMISSION_AUTHORIZATION_UNAVAILABLE` only after it has independently validated the current policy and matched the authorization's v2 policy binding. Policy availability alone never makes authorization current. Billing and submission blockers remain outside this slice.

## 5. Legacy evidence

Existing rows are labelled `cuac.application-submission-authorization.v1`. Migration `0028` must not infer a route or policy from current catalog/application state and must not recompute old scope digests.

Legacy rows and their material snapshots remain readable as historical evidence, but v1 is always non-current and cannot create a new material snapshot. The student must review the selected route and current policy and create a new v2 authorization. That new authorization supersedes any still-active v1 row.

The material-snapshot payload format stays v1: its authenticated encryption binding already includes `authorization_scope_sha256`, so a snapshot created from v2 authorization transitively binds route and policy. No old encrypted payload is rewritten.

## 6. Database constraints and rollout fence

`application_submission_authorizations` stores:

- `authorization_format`;
- `admission_route_key`;
- `policy_version_id`;
- `policy_publication_revision`;
- `policy_document_sha256`;
- `policy_target_set_sha256`; and
- `policy_approval_sha256`.

A row-level check permits only a complete v1 shape with all policy fields null or a complete v2 shape with valid route/revision/digests. A composite foreign key proves that each v2 policy version contains the exact school/program/intake/route target. It intentionally does not reference the mutable current-publication pointer.

The migration first labels existing rows v1, then changes the database default to v2. This is a mixed-version deployment fence: an old writer that omits the new policy fields after migration receives a constraint failure instead of silently producing a falsely current authorization.

## 7. Security and audit boundary

- Agent, school, and Ops surfaces do not receive a write path through this contract.
- No raw applicant material, policy review evidence, reviewer identity, or unrestricted SQL is exposed.
- Success audit metadata may include application set/choice ids, admission route, policy version id, publication revision, and record counts; it must not include material values or policy evidence.
- Failed authorization attempts remain atomic: no authorization, supersession, command receipt, or success audit may survive rollback.

## 8. Required gates

Release requires unit, PostgreSQL, built-HTTP, migration-upgrade, rollback/audit-failure, and real-lock concurrency coverage for:

- strict request parsing and v2 digest sensitivity;
- exact program/intake/route policy matching;
- policy replacement/withdrawal/expiry and route-change staleness;
- same-school sibling program isolation;
- v1 preservation without inference and v1 snapshot-create rejection;
- mixed-version writer failure after `0028`;
- idempotent replay, reauthorization, and concurrent authorization serialization; and
- no leakage of internal policy approval/review evidence.

## 9. Sealed local evidence

Migration `0028_application_policy_bound_authorization` is appended and sealed through baseline index 28. Its SQL SHA-256 is `ec5a0dbc13bc828e73da6785aea3da299f342d5f1d3b15eef931f02ceaae4d30`; its snapshot SHA-256 is `635e6159e122cd9ad0ef6146ed6e9ad6ab54ace2fe0c6d74fc8f30b19e789a70`.

At the `0028` slice seal, local gates passed `499/499` regular server tests, `366/366` real PostgreSQL tests, `463/463` built HTTP tests, and `7/7` isolated Linux migration tests; the `0029`, `0030` and `0031` totals remain historical evidence. The current suite through `0032` passes 523/523 regular, 477/477 PostgreSQL plus built HTTP and 7/7 Linux. It has 33 migrations, 24 snapshots, 58 tables, 864 columns, 310 constraints and 210 indexes. The current detached migration release digest is `b881c770d1a830dd152cecd760cd8cdd983b634154786fd0dad4593e885b94ca`. Later Billing, Program Application, transport-group, Agent-retention and candidate-capacity slices do not merge or weaken this per-project policy binding.

The populated `through-0027 -> 0028` rehearsal preserves v1 authorization and encrypted snapshot evidence without inference, proves an old writer fails after the rollout fence, then creates a new v2 authorization and snapshot only after explicit student review. A real lock race proves policy withdrawal waits until the authorization transaction commits. Same-school sibling programs, route changes, policy withdrawal/republication, strict HTTP input, minimal projections, audit rollback, and null/target database constraints are included. All fixtures are synthetic and disposable.
