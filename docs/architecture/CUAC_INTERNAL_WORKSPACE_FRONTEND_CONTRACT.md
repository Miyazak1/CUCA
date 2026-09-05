# CUAC Internal Workspace Frontend Contract

Updated: 2026-09-04

## Scope boundary

The public Home, Programs, Universities, Cities, and Scholarships showcase/list pages are frozen for this workstream. This contract covers authenticated internal workspace pages and does not authorize changes to those public list surfaces.

Program, university, city, and scholarship detail pages may be redesigned, but only from their published catalog DTOs. A detail page must not rename, synthesize, infer, or persist catalog fields that the corresponding API does not return.

Agent UI and Agent memory are excluded. Every candidate page declares `data-agent-mode="off"` and must remain useful without Agent services.

Catalog deadlines use `deadlineDate` as the authoritative date whenever it is present. `deadlineLabel` is descriptive fallback text only and must not replace a concrete date or be presented as one.

## Real API candidates

| Candidate | Canonical page pending replacement | Server authorities |
| --- | --- | --- |
| `public/billing-api.html` | `public/billing.html` | `GET /api/v1/billing/invoices/:invoiceId` |
| `public/favourites-api.html` | `public/favourites.html` | `GET/POST /api/v1/student/saved-items`, `DELETE /api/v1/student/saved-items/:savedItemId` |
| `public/hub-api.html` | `public/hub.html` and prototype `/hub` | student profile, application sets, saved items, notifications |
| `public/preferences-api.html` | `public/preferences.html` | student profile and notification preferences |
| `public/onboarding-api.html` | `public/onboarding.html` | student profile |
| `public/school-settings-api.html` | `public/school-settings.html` | current actor and tenant-bound public school detail |

The existing canonical files contain work from another frontend task. They have not been overwritten by this workstream. Activation requires an explicit canonical replacement decision and updates to authenticated navigation/continuation allowlists.

The application routes `/programs`, `/programs/:programId`, `/hub`, and `/hub/applications/:applicationId` now redirect to the real static/API-backed surfaces. They no longer render the browser-local `CuacApp` prototype. The application detail redirect carries an explicit `applicationSet` UUID locator, and the target accepts only an exact application set owned by the current student.

## Field boundaries

### Billing

The page renders only the checkout status DTO: invoice ID, application set ID, CUAC ID, invoice status, checkout session ID, payment status, amount, and paid/canceled/refunded timestamps. It never displays or accepts card, bank, provider credential, or provider evidence fields.

### Saved items

Saved-item reads now include a minimal, read-only catalog projection: entity ID, slug, English and Chinese names, publication status, source status, and last verification time. Removal is an owner-scoped PostgreSQL soft delete and records metadata-only audit evidence. Private notes are updated through the existing saved-item POST contract and are never written to browser storage.

### Hub

Hub is a read-only aggregation of four independent services. It shows only exact counts and fields returned by the server. It does not infer readiness, deadlines, risk, ranking, admission probability, or recommendations.

### Preferences and onboarding

Study controls match `StudyPreferences`: degree level, subject areas, teaching language, preferred city IDs (preserved when not exposed), funding intent, intake year, and intake term. Notification updates carry each topic's current revision and preserve the mandatory in-app/email account-security channels.

Unsupported password, MFA, recovery email, theme, interface language, marketing, adviser-sharing, and Agent-memory controls are not exposed.

### School workspace information

The school page verifies that current actor role is `school_staff` and that both the session and school detail record match the same `tenantSchoolId`. It does not invent team membership, integrations, Webhooks, API keys, applicant analytics, or editable public catalog controls.

## Verification evidence

- candidate frontend contract suite: 19/19 passing;
- focused student service, HTTP, and PostgreSQL repository suite after saved-item removal/projection: 50/50 passing;
- focused billing service/provider suite: 35/35 passing;
- TypeScript project build: passing;
- focused ESLint for candidate runtimes and saved-item backend: passing;
- production `vinext build`: passing and includes `DELETE /api/v1/student/saved-items/:savedItemId`;
- application route boundary suite: 2/2 passing; no app page imports the browser-local `CuacApp` prototype;
- application frontend contract suite: 7/7 passing, including exact owned application-set selection and no browser demo fallback;
- full composed backend gate: passing after 649/649 server tests and every registered focused backend/frontend contract suite;
- guest browser checks on `127.0.0.1:52118`: student pages redirect to `auth.html?role=student`; school settings redirects to `auth.html?role=school`;
- billing no-locator desktop visual check: passing, with Agent shell absent.
- real PostgreSQL catalog detail checks on `127.0.0.1:52118`: program, university, city, and scholarship records render from current API fixtures on desktop; all four have no horizontal overflow at a 390-by-844 mobile viewport;
- deadline semantics check: a real Fall 2027 program intake displays its concrete June 1, 2027 deadline rather than repeating the intake label;

## Remaining acceptance work

1. Explicitly approve replacing the existing canonical internal workspace files and update all authenticated destinations to the canonical routes.
2. Confirm use of the local student, school, and Ops passwords for authenticated desktop/mobile browser acceptance. No password is used without action-time confirmation.
3. Run the saved-item create/update/remove and all six candidate pages against the real local PostgreSQL account fixtures.
4. Complete external staging evidence for email, payment provider, private OSS, official submission delivery, staff MFA, edge controls, alerts, backup/restore, rollback, and three-role end-to-end acceptance.

These candidates and tests are implementation evidence, not a staging or production deployment approval.
