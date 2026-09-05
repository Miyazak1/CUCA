# CUAC School Portal Teacher Workspace Spec

Status: upgrade specification for the frontend demo. This document defines how `school-portal.html` should evolve from a simple receipt preview into a school-side admissions workspace for university teachers or admissions officers.

Related specs:
- `design-lab/SCHOOL_PORTAL_PRODUCT_SPEC.md`: current static-demo product boundary, tenant scope, visible fields, analytics, document boundary, and Agent limits.
- `CUAC_SCHOOL_PORTAL_BACKEND_SPEC.md`: production backend model, tenant-safe projection, APIs, exports, metrics, and audit requirements.

## 1. Product Boundary

The school portal is not a student account area. It is a separate school staff workspace.

Student-side CUAC account:
- owned by the applicant;
- used to choose universities and programs;
- sends non-document application information to selected schools;
- does not upload files in this demo flow.

School-side CUAC account:
- owned by a university admissions office, faculty coordinator, or international office staff member;
- receives only records relevant to that school;
- reviews applicant fit, contact information, intended program, and follow-up status;
- contacts students directly for documents, official forms, interviews, or school-specific next steps.

The frontend demo must make this separation obvious in navigation, copy, layout, actions, and account state.

Registration model:
- students, school staff, and CUAC staff use the same base CUAC account creation and sign-in system;
- role, tenant membership, invitation, school-email approval, or CUAC admin grants decide what the signed-in account can access;
- school staff may be invited, but invited users still register or sign in as themselves before a tenant membership is attached;
- protected school actions may resume after sign-in or registration only after CUAC rechecks role and tenant permissions.

## 2. Primary Users

School admissions officer:
- triages new CUAC submissions;
- contacts students quickly;
- assigns records to colleagues;
- tracks which students are waiting for documents.

Program coordinator or teacher:
- reviews program fit;
- checks whether the applicant should be invited to submit official materials;
- flags scholarship, language, or prerequisite questions.

International office manager:
- monitors intake volume;
- sees application readiness and conversion status;
- exports or summarizes records for internal work.

## 3. Current Page Gap

Current `school-portal.html` already shows:
- school account header state;
- locked school tenant scope;
- inbox list;
- application detail panel;
- receipt banner after student-side submission;
- `Mark contacted`;
- document boundary copy;
- owner workload summary;
- next-action queue;
- export scope preview;
- document-request template preview.

Remaining teacher-depth gaps:
- school settings now previews owner routing, editable template management, staff seats, and response targets in the frontend demo;
- analytics cards now include loading states before rendering status, program, funding intent, record origin, and country summaries;
- browser QA now covers dense school portal layout, school settings, application handoff, payment gating, tenant export confirmation, and mobile behavior;
- no backend-backed owner assignment workflow yet;
- no template versioning or real response-time analytics yet;
- no backend-backed export file yet;
- no production notification or email delivery workflow yet.

## 4. Target First View

The first viewport should feel like a dense but calm admissions operations surface, not a student marketing page.

Recommended first viewport:
- top shared shell in school-account state;
- compact school workspace header;
- left or top operations summary;
- central application queue;
- right detail/insight panel.

Hero-scale marketing copy should be avoided. The school portal should prioritize scan speed, triage, and repeated use.

Suggested page title:
`School admissions workspace`

Suggested subtitle:
`Review CUAC student interests, contact applicants, and track school-side follow-up.`

## 5. Account State

Header must show a school staff identity, not a student identity.

Example:
- account name: `ZJU Admissions`;
- initial: `Z`;
- account menu labels should imply staff workspace:
  - `School workspace`
  - `Application queue`
  - `Portal settings`
  - `Sign out`

Do not show student-only labels such as `My Hub`, `Favourites`, or `Application set` as the primary account action in the school context.

For demo scope, the global shared shell may still reuse the same header component, but `data-agent-mode="off"` or a future `data-portal-role="school"` should suppress student Agent behavior and student shortcuts.

## 6. Information Architecture

Recommended sections:

1. Overview
   - Today’s new records
   - Need first contact
   - Waiting for documents
   - Contacted this week
   - Intake/program distribution

2. Application Queue
   - searchable/sortable student records
   - status tabs
   - priority labels
   - program/intake filters
   - last activity

3. Applicant Detail
   - student contact
   - program interest
   - study profile
   - funding intent and language context
   - CUAC note
   - school-only next action

4. Follow-Up Actions
   - mark contacted
   - copy document request
   - email student
   - assign owner
   - set follow-up due date
   - mark waiting for documents
   - mark not a fit

5. Analytics
   - submissions by program
   - submissions by country
   - English/Chinese-taught split
   - funding intent split
   - status pipeline
   - average time to contact

6. Boundaries
   - CUAC did not collect documents
   - each school sees only its own records
   - student must be contacted directly for official process

## 7. Queue Model

Each record in the queue should expose enough information for fast triage.

Fields:
- student name
- intended program
- intake
- teaching language
- country/passport region
- funding intent
- language context
- record origin: `Incoming CUAC submission` or `Prepared queue`
- status
- owner
- priority
- received time
- next due action

Statuses:
- `New`
- `Needs review`
- `Contact queued`
- `Contacted`
- `Waiting for documents`
- `Documents received by school`
- `Not a fit`
- `Archived`

Priority logic for demo:
- high priority when deadline is close, scholarship intent is present, or language/prerequisite uncertainty exists;
- normal priority for complete contact-ready records;
- low priority for archived records or prepared queue items that do not need first contact.

## 8. Detail Panel

The detail panel should answer:
- Who is the student?
- Which exact school program did they choose?
- Why did CUAC send this record to this school?
- What should the teacher do now?
- What information is missing?
- What has already happened?

Recommended detail groups:

Student:
- name
- country
- email
- WhatsApp/phone if present in demo fixture
- current education stage

Program interest:
- school
- program
- degree level
- intake
- language
- city/campus if applicable

Application context:
- funding intent
- language proof context
- document readiness note
- deadline risk
- fit summary

Action plan:
- next recommended action
- owner
- due date
- last contact status

Information source:
- student-selected route fields;
- CUAC catalog program fields;
- CUAC school catalog fields;
- student profile fields;
- tenant-safe `sourceFieldLineage` for Agent explanations and audit.

Boundary:
- `CUAC has not collected files for this student. Request documents through your school process.`

## 9. Analytics Requirements

The page should help school staff summarize incoming interest.

Top metrics:
- new records
- need contact
- waiting for documents
- contacted this week
- live CUAC submissions

Charts or compact visual summaries:
- program distribution
- country distribution
- status pipeline
- funding intent distribution
- intake distribution
- loading animation state before chart values render

For the frontend demo, these can be CSS-only bars and fixture-derived counts. No backend aggregation is required.

## 10. Operations and Bulk Actions

Add teacher-oriented controls:
- search by student, program, country, email;
- filter by status, program, intake, funding intent, language;
- sort by received date, deadline risk, status, owner;
- select multiple records;
- batch mark as contacted;
- batch assign owner;
- batch copy request template;
- export CSV mock action;
- export scope preview before exporting;
- compact owner workload and next-action queue.

Demo actions should visibly update the local page state and, where relevant, localStorage state used by the student-side Hub.

## 11. Incoming Submission vs Prepared Queue

The current page can show prepared queue records before a student submission, but it should not present them as cross-school sample data or expose another school's choices.

Before an incoming CUAC submission:
- show a compact waiting state such as `Waiting for CUAC records`;
- prepared queue records may support layout and workflow review;
- actions update local demo state but must stay framed as tenant-scoped school work.

After student flow sends records:
- receipt banner appears;
- records matching selected schools are labelled `Live CUAC submission`;
- the waiting state is hidden;
- metrics distinguish incoming CUAC submissions from prepared queue work.
- payment or free-school entitlement is resolved before CUAC writes school-visible records;
- payment failures keep choices saved but must not create school portal records.

## 12. School Visibility Rule

Each school view must only show records for that school. The school portal must not expose whether the student also applied to other schools.

Example:
- Zhejiang University sees Maya’s Zhejiang University program interest.
- Zhejiang University does not see Maya’s other school choices.
- Zhejiang University does not see any record that belongs to another school tenant.

The page should not include a cross-school switcher. Even in the frontend demo, the logged-in school account should behave as a locked tenant scope.

## 13. Student-Side Feedback Loop

When a school teacher clicks `Mark contacted`:
- school portal status changes to `Contacted`;
- localStorage updates `cuacSchoolPortalDemoState`;
- student Hub reads that state and shows `A school has contacted you directly`;
- Application submitted status changes the relevant school card to `School contacted student directly`.

This feedback loop is already present and should be preserved.

Upgrade should make the loop more visible:
- show a small confirmation toast in the school portal;
- show `Student-side Hub will now show contacted status` in demo copy;
- update metrics immediately.

## 14. Visual Direction

School portal should feel:
- operational;
- trustworthy;
- data-dense;
- calm;
- built for scanning.

Avoid:
- oversized student-style hero;
- playful cards that obscure record status;
- marketing copy;
- too much gradient decoration;
- student-first terms like `Hub` as the main label.

Use:
- compact metrics;
- tables/lists;
- status chips;
- split pane;
- dense filters;
- clear primary actions.

## 15. Recommended Page Layout

Desktop:
- Header
- Workspace toolbar
  - school name
  - tenant/school scope
  - intake selector
  - export/mock settings
- Metrics and analytics band
- Main split:
  - left: queue and filters
  - right: detail panel
- Lower analytics:
  - program/country/status breakdown
  - follow-up workload

Mobile:
- summary metrics;
- queue list;
- detail opens as a full-width panel;
- analytics below queue;
- filters collapse into drawer.

## 16. Frontend Demo Implementation Plan

Phase 1: Information Architecture
- rename page framing from `Received applications` to `School admissions workspace`;
- add workspace toolbar;
- add richer metric/analytics band;
- clarify school account vs student account copy.

Phase 2: Queue and Detail Upgrade
- replace simple inbox list with denser application queue;
- add search/filter/sort controls;
- add status/owner/priority fields;
- keep right detail panel.

Phase 3: Analytics and Bulk Actions
- add program, country, funding, and status breakdowns;
- add mock bulk actions;
- add export CSV mock button;
- add teacher operations summary for owner workload, next actions, export scope, and request template preview.

Phase 4: Feedback Loop Polish
- show toast when marked contacted;
- highlight student-side state effect;
- ensure Hub/Application still reflect school contact state.

## 17. Acceptance Criteria

The upgraded `school-portal.html` is acceptable when:
- a teacher can identify the highest-priority records in under 5 seconds;
- a teacher can filter records by status/program/intake;
- a teacher can see aggregate workload without opening every record;
- a teacher can see owner workload, next actions, and export scope without opening every record;
- selected record details include contact, program, funding, language, and note;
- `Mark contacted` visibly changes status and updates demo state;
- the page clearly states CUAC does not collect files;
- school account identity is clearly different from student account identity;
- Auth preview offers a distinct `School staff` account path into the locked school tenant portal;
- waiting, prepared queue, and incoming CUAC submission states are visually distinct;
- chart loading states and reduced-motion-safe animations are covered;
- payment failure does not create school records, while successful payment or free confirmation does;
- tests protect the school portal’s key copy, controls, and state handoff;
- tests also protect school settings staff/routing/template controls and local save feedback.

## 18. Suggested Test Coverage

Add or extend tests to assert:
- `school-portal.html` includes school workspace framing;
- page has analytics/summary controls;
- analytics cards expose loading states and reduced-motion-safe chart animations;
- page includes search/filter/sort/bulk controls;
- records expose status, owner, priority, and tenant-safe record origin labels;
- `school-portal.js` preserves a locked school tenant scope;
- `Mark contacted` persists to `cuacSchoolPortalDemoState`;
- student-side Hub and Application continue reading contacted school state.
- payment failure does not create school records; successful payment/free confirmation does.
