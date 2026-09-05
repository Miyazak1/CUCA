# CUAC Historical Application Submission, Payment, and School Portal Draft

Date: 2026-08-14

Status update (2026-09-01): **historical demo draft, not a production contract**. The user confirmed one application per concrete program; same-school programs must not be merged into one application. The former “first school free / additional school” formula, payment timing, submit flow, school receipt flow, Agent prompts and UI copy below are superseded and must not be implemented or used to derive schema/API behavior. Pricing is a separate reviewed policy; exact fee entitlement is stored per project, while an eventual school-level Official Submission Group is transport only. Use [the backend submission contract](CUAC_APPLICATION_SUBMISSION_BACKEND_CONTRACT.md), [the Billing entitlement contract](CUAC_APPLICATION_BILLING_ENTITLEMENT_CONTRACT.md), [the official policy/group contract](CUAC_OFFICIAL_SUBMISSION_POLICY_AND_GROUP_CONTRACT.md) and the user-approved `design-lab/home-v3.html` reference instead.

## Purpose

This document defines the complete front-end product flow after a student has selected one or more concrete programs. It covers student submission, CUAC service payment, school-side receipt, and the boundaries between CUAC, the student, and the university.

The core model is intentionally lighter than UCAS:

- CUAC collects program choices and non-document application information.
- CUAC charges a service fee when a student applies to more than one school.
- CUAC sends the submitted application record to each selected school's CUAC portal.
- After the school receives the application, the school contacts the student directly for documents, official application steps, interviews, admission decisions, or other follow-up.
- CUAC does not collect or manage document upload in this flow.
- CUAC does not promise admission and does not continue as the main handler after school receipt.

## Research Notes

UCAS is useful as a reference for clear application entry and choice management. It lets students start from the Hub, add choices from the application overview, complete mandatory sections, pay, and send the application. UCAS also makes the choice object concrete: a university or college, course, campus, start date, and related details.

Chinese international admissions are more decentralized. University pages usually maintain their own application systems, document requirements, admission offices, and post-admission visa/JW-form processes. For example, Zhejiang University's undergraduate international application guide asks applicants to log in to its own online application system and upload required materials. Tsinghua's international graduate system is also a university-specific application and result inquiry system.

CUAC should therefore not copy UCAS as a central final-application authority. The better model for CUAC is a China admissions routing platform:

- help students choose realistic schools and programs;
- collect enough structured information for schools to triage interest;
- charge for multi-school routing;
- give partner schools a clean inbox and workflow;
- then let schools directly continue with students.

## Product Position

### CUAC is

- A China university admissions discovery and routing platform.
- A structured application-intent submission layer.
- A paid multi-school routing service.
- A school-facing lead/application inbox.
- A student assistant for choice clarity, cost, deadlines, and readiness.

### CUAC is not

- A final official application system for every university.
- A document upload and verification system.
- A visa, JW-form, or enrollment management system.
- A guaranteed admission service.
- A post-submission agent unless the business later adds that service.

## Roles

### Student

International student applying to Chinese universities. Often young, unfamiliar with Chinese admissions, and likely to need simple, confidence-building guidance.

### School Staff

University international admissions staff. They need to receive applications for their own school, understand student intent quickly, contact students, and manage internal statuses.

### CUAC Ops

Internal CUAC staff. They need to monitor payment, route submissions, handle bad data, support schools, and audit demo/business logic. They are not the default long-term handler after submission.

### Agent

Front-end assistant layer that helps students understand options, build choices, estimate payment, check missing non-document information, and explain what happens next. In the demo it simulates these states.

## Core Object Model

### Application Set

An `ApplicationSet` is one student submission cycle.

It contains:

- student identity and contact information;
- study level, intake, country/region, and language preference;
- one or more concrete choices;
- payment summary;
- consent to share information with selected schools;
- submission status;
- school receipt records.

### Choice

A `Choice` is one concrete program route:

- university;
- program;
- study level;
- intake;
- teaching language;
- campus or city if available;
- scholarship intent if relevant;
- short student note or reason;
- source/status metadata.

Important rule: a saved university or scholarship is not a choice. Only a specific university plus a specific program can become a choice.

### School Application

When an application set is submitted, CUAC creates one `SchoolApplication` per submitted concrete program choice, scoped to that choice's school.

If the student selected two programs under the same school, the school receives two independent applications, each with its own program, identifier, status and timeline. A school-grouped list is a presentation option, not an entity merge.

### Front-End Demo Data Source

The demo state should make the handoff explicit:

- `Add choice` creates structured route data: school, program, program level, city, intake, teaching language, tuition/deadline signals.
- `Applicant information` creates structured student profile data: name, email, phone/WhatsApp, country, education stage, funding intent, language status, and readiness note.
- The intended production handoff is one record per submitted program choice, with school tenant scope; historical demo storage is not the backend authority.
- The school portal must filter `submittedRecords` by the authenticated school tenant, for example `school === "Zhejiang University"`.
- A school portal must not show the student's other school choices, total school count, fee paid for other schools, or any cross-school switcher.

## Pricing Rule (Superseded)

No production pricing rule is approved in this document. Do not use distinct-school count, first-school-free, demo USD amounts or incremental-school charging as backend authority or user-facing production copy.

The current stable rules are:

- application identity is one `student + program + intake` choice;
- pricing policy may later calculate per project, per official form, bundles or waivers, but must be reviewed/versioned server data;
- each project requiring a fee must have its own exact current entitlement before submit;
- CUAC accepts no raw card/bank credentials and live provider/webhook/refund flows remain closed;
- frontend display cannot create paid state or submission authority.

The remaining payment examples in this historical draft are retained only as rejected demo context and are not acceptance criteria.

## Student Flow

### 1. Discover and Save

The student searches programs, universities, scholarships, cities, and guides. Saved items remain exploratory.

Primary CTA for program cards:

- `Add to choices`
- `Compare`
- `Save`

### 2. Add Choice

From Hub or Application page, the student clicks a clear `Add choice` tile.

The modal should be direct and UCAS-like in clarity, but adapted to CUAC:

1. Study level: Undergraduate / Master
2. University: selected from CUAC school database
3. Program: selected from CUAC program database and filtered by university and level
4. Intake
5. Teaching language
6. Optional student note: `Why this program?`
7. CTA: `Add to application set`

This is a manual mode. Agent mode can also suggest choices, but final adding must require explicit student confirmation.

### 3. Build Application Set

The Application page should have a very clear structure:

- `Your choices`
- `Applicant information`
- `School-specific questions`
- `Fee and submission`
- `What happens next`

The page should not feel like a document-management product. Document rows are only readiness notes, not uploads.

### 4. Complete Non-Document Information

Required student information should be enough for school staff to contact and initially assess the student.

Suggested fields:

- Full name
- Email
- WhatsApp / phone
- Country/region
- Date of birth or age band if needed
- Current education level
- Current or latest school
- Intended study level
- Intended intake
- Preferred teaching language
- Language background: IELTS/TOEFL/HSK status as text/status
- Academic summary: GPA/rank/major subjects as structured text
- Funding intent: self-funded / scholarship-seeking / mixed
- Passport nationality
- Guardian contact flag for under-18 students
- Free-form note to schools
- Consent to share this information with selected schools

Not required in CUAC:

- passport scan upload;
- transcript upload;
- recommendation upload;
- physical exam upload;
- visa/JW form handling.

Document section wording:

`CUAC does not collect your documents here. Schools may contact you directly for passport, transcript, language proof, study plan, recommendation, or other materials after receiving your application.`

### 5. Review Fee

Before submit, show a payment summary card:

```txt
Selected schools
1. Zhejiang University - Included
2. Fudan University - USD 20
3. UIBE - USD 20

Total due: USD 40
```

If the user has only one school:

```txt
Your first school is included. No payment is required for this submission.
```

### 6. Submit

Use a two-step confirmation:

1. `Review and continue`
2. `Pay and send` or `Send for free`

Confirmation copy:

`After you send, each selected school will receive your application information in its CUAC portal. The school may contact you directly by email or phone for documents and next steps.`

### 7. After Submission

Student sees:

- submission receipt;
- payment receipt if applicable;
- schools sent to;
- school contact expectation;
- current status per program application, optionally grouped by school without merging statuses.

Statuses:

- `Draft`
- `Ready to send`
- `Payment due`
- `Payment processing`
- `Sent to school`
- `School viewed`
- `School contacted student`
- `Closed by school`
- `Withdrawn by student`

Avoid using `admitted`, `offer`, or `rejected` unless the school explicitly updates it.

## School Portal

The school portal is a required part of the business model. It should be designed early, even if the demo is static.

### School Dashboard

Main modules:

- new applications;
- unread/contact-needed;
- viewed/contacted;
- by intake;
- by program;
- by country;
- export/download;
- school profile/program settings.

### Application Inbox

List view columns:

- student name;
- country/region;
- program interests;
- intake;
- language route;
- submitted date;
- CUAC fee status: visible only as `CUAC-paid` or `free first school`, not payment amount unless necessary;
- school status;
- assigned staff.

Primary actions:

- `Open`
- `Mark viewed`
- `Contact student`
- `Request documents`
- `Update status`

### Application Detail

Sections:

- Student overview
- Contact information
- Program choices for this school
- Academic summary
- Language status
- Funding intent
- Notes from student
- Document checklist expected by school, as guidance only
- Timeline
- Internal notes

The school should only see its own school application, not the student's applications to other schools.

### School Actions

School staff can:

- mark as viewed;
- set status: `New`, `Reviewing`, `Contacted`, `Waiting for student`, `Not suitable`, `Converted to official application`;
- send a templated email or copy contact details;
- request documents outside CUAC;
- add internal notes;
- assign to staff;
- export CSV/PDF;
- configure program availability and requirements.

### School Portal Permissions

Roles:

- `Owner`: manage school profile, staff, all applications.
- `Admissions staff`: view and manage applications.
- `Program manager`: manage assigned programs.
- `Read-only`: view only.

## CUAC Ops Console

Even if CUAC stops participating after school contact, an internal console is still needed.

CUAC Ops can:

- see all submitted application sets;
- verify payment and routing status;
- retry failed school delivery;
- handle support issues;
- deactivate school accounts;
- audit suspicious or duplicate submissions;
- configure demo data and program records.

CUAC Ops should not be positioned to make admissions decisions.

## Agent Interaction Design

The Agent should support the full demo flow with scenario triggers.

### Before Submission

Questions it should answer:

- `Which schools will be free or paid?`
- `What happens after I submit?`
- `What information is missing?`
- `Can I add two programs at the same university?`
- `Which choice should be my first free school?`
- `Should I add another school for the extra-school fee?`
- `What documents might schools ask me later?`

Actions it can simulate:

- open Add Choice modal;
- prefill university/program suggestions;
- explain fee calculation;
- open payment summary;
- open missing information section;
- summarize selected choices.

### During Payment

Questions:

- `Why am I paying an extra-school fee?`
- `Why is the first school free?`
- `Can I remove a school before paying?`
- `What if payment fails?`

Actions:

- show fee breakdown;
- remove unpaid school from selection;
- retry payment simulation;
- mark payment as successful in demo.

### After Submission

Questions:

- `Has ZJU received my application?`
- `Who will contact me?`
- `Do I need to upload documents here?`
- `Can I add Fudan after submitting?`

Actions:

- open receipt;
- show per-program application status within the student's authorized view;
- explain next step;
- add another school as a paid add-on.

### School Portal Agent

For school staff, the Agent can:

- summarize a student;
- identify missing contact or academic info;
- draft a document-request email;
- filter applicants by intake/program/country;
- explain status counts.

It cannot:

- decide admission;
- send final offers;
- change official university systems.

## Recommended Page Updates

### Hub

Hub should show an obvious application entry near the top:

- left: current application status;
- right: `Add choice` card;
- clear text: `Send your selected programs to Chinese universities. First school included.`

### Application Page

Needs to become the central flow page:

1. Large `Add choice` tile.
2. Choice list with one row per concrete program.
3. Applicant info checklist.
4. Fee summary.
5. `Send to schools` final CTA.
6. Post-submit status tracker.

### Payment Modal

The modal should be compact:

- selected schools;
- free first school;
- additional school fee;
- total;
- terms checkbox;
- payment CTA.

### Submission Confirmation

Show:

- `Sent to schools`
- school list;
- expected follow-up;
- receipt;
- `Go to Hub`.

### School Portal Demo

Create these static pages later:

- `school-portal.html`
- `school-application.html`
- `school-settings.html`

## Front-End Demo Scenarios

The demo should include at least these cases:

1. One school, one program: free send.
2. One school, two programs: still free.
3. Two schools: one extra-school fee due.
4. Three schools: two extra-school fees due.
5. Missing required non-document info: cannot send yet.
6. Payment failed: stay on payment step and allow retry.
7. Payment success: status changes to `Sent to school`.
8. School viewed: school portal status updates and student Hub reflects it.
9. School contacted student: student sees `School contacted you directly`.
10. Add another school after submit: one incremental extra-school fee.

## Key UX Principles

- The application entry must be visible, not hidden in lower modules.
- Adding a choice should be visually simple: big plus tile, short modal, database selects.
- Fee logic must be visible before payment.
- Do not show document upload controls.
- Use language that reduces anxiety: `school will contact you`, `documents may be requested later`, `first school included`.
- Keep Agent as an assistant and shortcut layer, not the only way to operate.
- School portal should feel efficient and work-focused, not youthful like student Hub.

## Open Decisions

1. Does `first school free` reset per application cycle, per student account, or per submitted application set?
2. If a student withdraws a paid extra school before school views it, is the extra-school fee refundable?
3. Can a student submit multiple application sets in one intake?
4. Should schools pay CUAC for received applications, or is student payment the only monetization in this flow?
5. Should CUAC review submissions before schools receive them, or send instantly after payment?
6. Can a school reject an application inside CUAC, or only mark `Not suitable` and contact outside the platform?
7. What exact contact fields are mandatory for school follow-up?
8. Should under-18 applicants require guardian contact before submission?
9. Can students edit submitted information after school receipt?
10. Are university official application fees shown in CUAC, or only mentioned as possible later school-side fees?

## Implementation Recommendation

Use this flow for the next front-end iteration:

1. Update Hub application entry so the next action is unmistakable.
2. Update Application page with a clear `Add choice` tile and choice list.
3. Add `Applicant information` section for non-document fields.
4. Add `Fee and submission` section with first-school-free pricing.
5. Add payment simulation modal.
6. Add submission confirmation and per-school status cards.
7. Add a simple school portal inbox demo.
8. Extend Agent scenarios to explain fees, missing info, submission, and school follow-up.

This gives CUAC a complete demo loop without designing backend APIs yet, while leaving clean boundaries for later database, payment provider, and school account implementation.
