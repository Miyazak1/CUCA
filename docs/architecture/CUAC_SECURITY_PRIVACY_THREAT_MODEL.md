# CUAC Security Privacy Threat Model

Date: 2026-08-14

Status: production security and privacy design draft.

## 1. Purpose

CUAC handles personal information, student application intent, school tenant data, payments, and Agent actions. This document identifies the main risks and the controls required for a mature product.

## 2. Protected Assets

- student identity and contact details;
- student profile and application choices;
- school application records;
- school tenant membership;
- payment records;
- Agent conversations and actions;
- audit logs;
- catalog source evidence;
- admin credentials;
- API keys and provider secrets.

## 3. Trust Boundaries

- public browser to CUAC API;
- authenticated user to API;
- Agent runtime to action service;
- CUAC API to database;
- CUAC API to payment provider;
- CUAC API to email/notification provider;
- CUAC Ops to cross-tenant data;
- school tenant user to school-scoped data.

## 4. Top Threats

### Cross-Tenant Data Leakage

Risk:

- school user sees another school's records;
- school user infers other schools selected by a student.

Controls:

- school-scoped APIs;
- row-level security for `school_applications`;
- policy tests;
- no school portal direct access to `application_sets`;
- audit cross-tenant CUAC Ops access.

### Account Takeover

Risk:

- attacker accesses student or school account.

Controls:

- secure password storage;
- MFA for school and admin accounts;
- session rotation;
- device/session management;
- suspicious login alerts;
- rate limiting and bot protection.

### Agent Overreach

Risk:

- Agent performs unauthorized or irreversible action;
- Agent leaks data from retrieved context.
- Agent writes durable memory for a signed-out visitor;
- school Agent reads student private Agent memory or other-school choices;
- sign-in continuation replays a stale or tampered protected action without rechecking authorization.

Controls:

- action registry;
- effective user permission checks;
- confirmation for high-risk actions;
- audit every executed Agent action;
- prompt injection isolation;
- governed analytics queries.
- signed-out Agent context is current-page/session only and expires without account memory;
- signed-in student memory is scoped to the student account and clearable after confirmation;
- school Agent context uses `tenant_school_id` and never joins student private memory;
- sign-in continuation stores only a minimal pending action, then revalidates the action after authentication.

### Account Boundary And Registration Abuse

Risk:

- student self-registration accidentally creates school or CUAC internal authority;
- unauthenticated visitors are incorrectly classified as students, school staff, or CUAC staff before choosing an access context;
- school staff access is granted without a valid invitation, approved school-email workflow, or active tenant membership;
- CUAC Ops/Admin permissions become publicly self-grantable;
- sign-in continuation created in one account context is consumed by another account type or tenant;
- invite tokens are guessed, replayed, leaked, or used after expiry.

Controls:

- use one base registration/sign-in system, but keep `student`, `school_staff`, and `cuac_internal` permission grants separate in UI, API, and database;
- student registration creates only a student role and student profile;
- school staff permission requires `school_staff_invites` or equivalent tenant-approved evidence and creates `school_staff_memberships`;
- CUAC internal access requires an approved `cuac_staff_access_grants` record from controlled CUAC approval, team invitation, SSO claim, or admin assignment before Ops/Admin permissions are active;
- sign-in continuation includes allowed or required access context constraints only as action policy, plus required role, tenant scope, expiry, and one-time consumption;
- recheck authorization after login/register before executing any pending action;
- hash invite and continuation tokens at rest, expire them quickly, and audit acceptance.

### Prompt Injection

Risk:

- malicious text in program notes, student notes, or school records instructs Agent to ignore rules.

Controls:

- treat retrieved content as untrusted;
- separate system rules from data;
- never execute actions from retrieved text;
- run action policy after model output;
- log suspicious payloads.

### Payment Fraud Or Duplicate Charges

Risk:

- duplicate payment;
- forged webhook;
- payment bypass.

Controls:

- provider signature verification;
- idempotency keys;
- server-side fee calculation;
- payment status checked before submit;
- reconciliation jobs;
- audit payment state changes.

### Personal Data Overcollection

Risk:

- CUAC collects more student data than needed.

Controls:

- MVP excludes document upload;
- profile fields limited to school follow-up;
- explicit consent before submission;
- retention schedule;
- data deletion workflow.

### Agent Memory Leakage Or Retention Drift

Risk:

- guest page context becomes durable account memory;
- student long-term Agent memory persists after clear, enrollment, or archive;
- school tenant session memory is mixed with student private memory;
- Ops audit context is used as a general unrestricted memory store.

Controls:

- no durable `agent_memory_entries` for `guest_page`;
- student Agent memory must be tied to `user_id` and lifecycle clear triggers;
- school Agent memory must require `tenant_school_id`;
- Ops Agent memory must require audit logging and support reason;
- memory clear operations need confirmation, audit, and regression tests.

### Insecure Exports

Risk:

- school exports personal data and leaks it.

Controls:

- tenant-scoped export jobs;
- short-lived URLs;
- export audit logs;
- rate limits;
- role restrictions;
- optional watermarking.

## 5. Privacy Requirements

### Data Minimization

Collect only:

- identity and contact;
- education stage;
- country/region;
- language status;
- funding intent;
- selected program choices;
- school-visible notes.

Do not collect in MVP:

- passport scan;
- transcript;
- recommendation letters;
- medical forms;
- visa/JW-form files.

### Consent

Before submission, student must consent that CUAC can share non-document application information with selected schools.

Consent record:

- user_id;
- application_set_id;
- consent_text_version;
- consented_at;
- ip_hash;
- user_agent_hash.

### Access Transparency

Student should see:

- which schools CUAC sent records to;
- school status updates visible to student;
- whether school contacted them;
- what data CUAC shares at a high level.

School should see:

- that records are tenant scoped;
- CUAC did not collect files;
- school must contact student directly for official materials.

## 6. Authentication Requirements

Student:

- email verification;
- strong password or OAuth;
- optional MFA later.

School:

- email verification;
- MFA recommended or required;
- invite-only membership;
- session timeout for inactivity.

CUAC Ops/Admin:

- MFA required;
- least privilege;
- IP/risk monitoring;
- admin action audit.

## 7. Authorization Requirements

- enforce object-level checks for every API;
- do not expose predictable IDs as authorization;
- use membership checks for school records;
- use support reason for CUAC Ops cross-tenant access;
- test direct-ID access attacks.

## 8. Secure Development Requirements

- dependency scanning;
- static analysis;
- secret scanning;
- security review for Agent actions;
- policy tests in CI;
- API contract tests;
- audit log tests;
- export scope tests.

## 9. Incident Response

Prepare runbooks for:

- suspected school data leak;
- payment provider issue;
- account takeover;
- Agent unsafe action;
- catalog poisoning;
- bulk export misuse.

Minimum incident log:

- detection time;
- affected users/schools;
- data types affected;
- containment action;
- user notification decision;
- remediation;
- follow-up controls.

## 10. Security Milestones

MVP must have:

- tenant isolation tests;
- secure auth;
- audit logs;
- payment webhook verification if real payments exist;
- Agent action permission gates;
- export audit;
- basic rate limiting;
- privacy policy and consent copy.

Post-MVP:

- row-level security;
- advanced anomaly detection;
- SSO for schools;
- DLP for exports;
- data subject request automation;
- third-party penetration test.
