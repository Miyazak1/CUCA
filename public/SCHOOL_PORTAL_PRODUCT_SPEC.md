# CUAC School Portal Product Spec

Date: 2026-08-20

Purpose: define the school-facing admissions workspace for CUAC before connecting real backend, database, tenant permissions, analytics, or workflow APIs.

## Product Role

`school-portal.html` is not a student page. It is a school staff workspace for admissions teachers and international office staff.

The portal helps a school receive CUAC-routed student interest records, triage first contact, request documents directly from the student, and understand its own applicant pipeline. It must never expose another school's queue, another school's choice, or a student's private long-term Agent memory.

## Account And Permission Model

CUAC should use one unified registration and sign-in system for all people. Student, school staff, and CUAC Ops users create normal CUAC accounts. Their role and permission grants decide what they can access after authentication.

School staff access requires at least one approved tenant membership:

- Invite code from a school tenant owner.
- Verified school email domain.
- Manual tenant owner approval.
- CUAC admin approval for exceptional cases.

The signed-in account should carry:

- `userId`
- `role = school_staff`
- `tenantId`
- `schoolId`
- staff permission set
- audit metadata

The page must be locked to one tenant at a time. A Zhejiang University staff user sees Zhejiang University records only.

Registration and sign-in are unified across people. A school staff member does not use a separate auth system; they create or sign in to a normal CUAC account, then school access is granted by invitation, verified school email, tenant owner approval, or CUAC admin assignment. Protected school actions may resume after auth only after the role and tenant grant are rechecked.

## Tenant Scope Rules

School staff can see:

- Records routed to their school after student confirmation and CUAC fee/payment completion when required.
- Student contact fields needed for first contact.
- The specific school and program selected for this tenant.
- Student-declared non-document profile fields sent by CUAC.
- Status, owner, priority, and follow-up notes created in this school tenant.
- School-owned document request templates.
- Tenant-scoped analytics and exports.

School staff cannot see:

- Other schools selected by the student.
- Other schools' queues.
- Other schools' program choices.
- Cross-school fee details except the fact that this school's own record was routed.
- Student private Agent memory.
- Student saved favourites unless the student sent a record to this school.
- Documents uploaded to CUAC, because the current CUAC model does not collect official files.

## Information Source Model

Each school record combines three source groups.

Student profile fields:

- Legal name
- Email
- Phone or WhatsApp
- Passport nationality or region
- Current education stage
- Funding intent
- Language readiness
- Academic summary or readiness note
- Consent timestamp

Student choice fields:

- Selected school
- Selected concrete program
- Degree level
- Intake
- Teaching language
- Student choice note
- Choice priority

CUAC catalog fields:

- School ID and school name
- Program ID and program name
- Tuition signal
- Deadline signal
- Scholarship signal
- Official detail status
- Last checked date

The school receives its own record only. If the student selected three schools, the system creates three tenant-scoped records, not one shared cross-school bundle.

School routing is created only after the student confirms the application set and payment or free-school entitlement is complete. A failed payment keeps the student's choices saved but must not create school-visible records.

## Core Staff Jobs

The workspace should optimize for repeated admissions-office work:

- Identify new records that need first contact.
- Filter by status, program, intake, country, record origin, funding intent, and priority.
- Assign an owner inside the school team.
- Copy or send a document request template.
- Mark contacted, waiting for documents, documents received, interview needed, offer review, or closed.
- See a concise applicant detail panel without leaving the queue.
- Export tenant-scoped CSV after explicit confirmation.
- Understand where each number on the dashboard comes from.

## Dashboard And Analytics

The first screen should answer three questions quickly:

1. What requires action today?
2. Which programs and regions are generating interest?
3. Where are records getting stuck?

Recommended analytics:

- New records
- Need first contact
- Waiting for documents
- Contacted this week
- Live CUAC submissions
- CUAC files collected, currently expected to be zero in this model
- Pipeline by status
- Program distribution
- Funding intent split
- Record origin split
- Country or region distribution
- Intake distribution
- Owner workload
- Aging records by days since received
- Loading states for charts before fixture or API counts render

Avoid using the analytics area as raw decoration. Every chart should answer a staff action question and link back to the filtered queue where practical.

## Applicant Detail

Applicant detail should show:

- Student name and contact.
- Country or passport region.
- Selected school and selected program for this tenant.
- Degree level, intake, teaching language.
- Funding intent and language readiness.
- Current status, priority, owner, and due date.
- Next action.
- Timeline of tenant-visible events.
- Document request checklist owned by the school.

It should not show:

- The student's other school choices.
- Notes from other school tenants.
- CUAC internal support notes.
- Payment details unrelated to this school.
- Private student Agent conversation history.

## Document Handling Boundary

Current CUAC demo boundary:

- CUAC does not collect official files from students.
- CUAC sends non-document application information and choice context.
- Schools contact students directly for transcripts, passport scans, language proof, recommendation letters, portfolios, school-specific forms, and official application fees.
- School templates help staff request documents, but they are not file-upload workflows.

Production may later add document readiness tracking, but official file storage should be designed separately with consent, retention, encryption, and school-specific access rules.

## Agent Boundary

School Agent mode can:

- Summarize this tenant's visible queue.
- Explain dashboard numbers.
- Draft first-contact messages.
- Draft document request templates.
- Help filter, sort, and prioritize records.
- Mark tenant records after explicit confirmation.
- Prepare tenant-scoped export after explicit confirmation.

School Agent mode cannot:

- Reveal other-school choices.
- Compare this tenant against named competitor schools using raw applicant records.
- Read student private long-term Agent memory.
- Export without confirmation.
- Perform cross-tenant operations.
- Change payment or CUAC Ops audit state.

High-risk school actions require confirmation:

- Export CSV
- Bulk mark contacted
- Bulk owner reassignment
- Closing records
- Any action that sends a message or changes status at scale

## Backend Contracts

When this demo moves beyond static front-end state, the school portal needs:

- Auth session service.
- Tenant membership and role grants.
- School tenant resolver.
- Application routing service that writes one record per selected school.
- Payment confirmation or free-school entitlement gate before routing.
- School application record API.
- Status and owner update API.
- Template API.
- Tenant analytics API.
- Tenant export job API.
- Audit log API.
- Agent action registry with route, role, tenant, and confirmation checks.

Every API must verify `tenantId` server-side. Front-end route guards are not enough.

## Audit Events

Required audit events:

- School staff sign-in.
- Tenant opened.
- Record viewed.
- Status changed.
- Owner changed.
- Template copied or updated.
- Export requested.
- Export confirmed.
- Agent action proposed.
- Agent action confirmed or denied.
- Cross-tenant request denied.

## Open Product Questions

- Should schools be able to message students through CUAC, or only copy templates and contact externally?
- Should tenant owners approve staff from inside `school-settings.html`?
- Should students see school-side status changes immediately in Hub?
- How long should school tenant records be retained after intake closes?
- Which analytics should be visible to all staff versus tenant owners only?

## Current Demo Coverage

Current static prototype coverage:

- `school-portal.html`: tenant-scoped applicant queue, analytics, applicant detail, filters, school switcher as scope demonstration, mark contacted, copy template, export confirmation, and Agent actions.
- `school-portal.css` and `school-portal.js`: chart loading animations, reduced-motion handling, tenant-scoped analytics rendering, owner workload, and next-action summaries.
- `school-settings.html`: tenant template and staff settings preview.
- `application.html`: payment/free-school gate, consent, send to school, and school-scoped handoff state.
- `hub.html`: student-side follow-up state after school contact.
- `shared-shell.js`: role-aware auth, school Agent mode, tenant-scoped Agent context, and high-risk action confirmation.

Current automated coverage:

- Static tests assert the school portal product spec is published, shared shell is mounted, school tenant scope is explicit, cross-school switching is absent, analytics controls exist, and payment-to-school handoff remains connected.
- Browser layout QA covers school portal and school settings on desktop and mobile.
- Browser flow QA covers payment failure, successful school handoff, school contact updates, tenant export confirmation, school settings saves, role-aware auth, and student-side follow-up state.

This document is the product boundary for future school portal work. Any school-facing UI change should preserve tenant isolation and avoid turning the page into a student account view.
