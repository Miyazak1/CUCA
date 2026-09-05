# CUAC / CSCAlite Alignment Audit

Last reviewed: 2026-08-25

This frontend demo is still frontend-only. It should look and behave like a real product surface, but it does not design or implement the backend, database, real authentication, real payment provider, file upload, or production Agent service.

## Current Goal

Keep testing the CUAC demo against CSCAlite and close visible alignment gaps:

- Public student pages should use CSCAlite school, program, scholarship, and city fields without exposing raw model paths.
- School staff pages should be Chinese, tenant-scoped, and only show the school's own CUAC records.
- CUAC Ops pages should be Chinese, split into manageable sections, and support school data, public content, student application, access, queue, audit, and statistics workflows.
- Buttons and links should not be placeholders. Create, edit, save, archive, publish, export, and role-login paths need visible state changes or explicit demo feedback.
- Agent behavior must distinguish guest session context from long-lived logged-in student context, and protected actions should route through the shared auth page with continuation.

## CSCAlite Sources Checked

Observed CSCAlite surfaces:

- `backend/src/study-china/study-china.types.ts`
- `backend/src/study-china/study-china.service.ts`
- `backend/src/schools/admin-schools.controller.ts`
- `backend/src/schools/schools.types.ts` including `expectedVersion` on `AdminSchoolUpdateInput`, `AdminSchoolProgramInput`, `AdminSchoolCscaRuleInput`, and `AdminSchoolScholarshipInput`
- `backend/src/schools/admin-scholarships.service.ts` including expected-version conflict behavior (`VERSION_CONFLICT`)
- `frontend/src/pages/PublicSchoolsPage.tsx`
- `frontend/src/pages/SchoolDetailPage.tsx`
- `frontend/src/pages/ScholarshipPages.tsx`
- `frontend/src/pages/AdminCityGuidesPage.tsx`
- `frontend/src/pages/AdminScholarshipsPage.tsx`
- `frontend/src/pages/AdminSchoolsPage.tsx`

## Verified In Current CUAC Demo

- Public program, university, scholarship, and city detail pages preserve source lineage internally while hiding raw paths such as `SchoolProgram.deadlineDate` from student-visible copy.
- Public university, program, scholarship, and city detail pages now use a shared section-navigation pattern for long student-facing records, so users can jump to checks, requirements, timing, benefits, related programs, and next steps without reading a field-heavy page top to bottom.
- Public program detail now gives students a CSCAlite-style decision action cluster in the side panel: add the exact choice, open the university profile, and check the official/current program notice before relying on tuition, language, or deadline signals.
- Public universities list now exposes a visible CSCAlite-style program-fit filter row for degree level, teaching language, program subject, and upcoming deadlines, using the same criteria keys as `SchoolSearchQuery` instead of relying only on hidden URL parameters or Agent actions.
- Public universities list now exposes CSCAlite-style scholarship route filtering as a visible select: students can switch between CSC scholarship and detailed school scholarship routes, while the UI maps directly to `hasCsc` and `hasDetailedScholarship` instead of requiring hidden query parameters.
- Public university detail now surfaces CSCAlite-style official checks as student-facing content: application fee, official website, and admissions entry appear in a readable side card when real `http(s)` links exist, while raw model paths remain hidden.
- Public university detail and source lineage now use current CSCAlite summarized HSK/English requirement fields such as `hskRequirement` and `englishRequirement`, rather than legacy granular HSK/HSKK demo fields.
- Public university detail side decisions now follow CSCAlite `SchoolDetailPage` behavior more closely: the action panel points students to exact programs, the official admissions entry, and city context instead of repeating a generic hero CTA.
- Public university detail program rows now move closer to CSCAlite `SchoolDetailPage`: structured school programs expose degree, teaching language, CSCA subject filters, expandable language/application/source details, and student-facing official program links.
- Public scholarship detail now mirrors the CSCAlite detail sidebar more closely: application window, scope, planning source, official apply/source links, and copy-link feedback sit in a single `Apply and verify` card instead of being scattered through long content.
- Public scholarship detail now adds a CSCAlite-style scope summary near the top of the page, showing funding level, degree fit, country scope, deadline, linked school count, and program-route count before students read long requirements or prepare materials.
- Public scholarship list now follows CSCAlite scholarship browse behavior more closely: students can filter by target country/region, and cards show a student-readable scope summary with country/region plus linked school/program-route counts instead of internal status tags.
- Public city detail now moves closer to CSCAlite `StudyChinaCityDetailPage`: CityGuideAggregate program rows expose degree, language, and funding-signal filters so students can narrow city programs before opening exact school-program routes.
- City detail top facts now follow CSCAlite `StudyChinaCityDetailPage` structure more closely: the first fact strip uses `CityGuideAggregate`-style universities, programs, English routes, scholarship routes, and CSCA school counts, while CityGuide content quick facts remain separate supporting guidance.
- City detail side panel now mirrors CSCAlite's decision card behavior more closely: budget context leads into direct city-scoped actions for schools, English programs, and application timeline, with application tips separated from the checklist.
- Public scholarship cards no longer show internal labels like `Verified source`, `Needs date check`, `Needs source check`, or `Confirm notice`.
- City cards now use one primary CTA, `View city guide`; old `City detail / View programs / Preview` button groups are not present in current `cities.js`.
- Programs, universities, scholarships, and cities card actions have browser layout QA for desktop and mobile.
- Application choices support add, remove, fee recalculation, payment simulation, and school send after the allowed payment/confirmation path.
- School portal shows a Chinese teacher workspace with tenant lock copy, local queue, analytics, bulk contact, export, and school-only applicant detail.
- School portal record handoff only shows the current school's record and does not expose the student's other school choices.
- Ops admin is divided into in-page sections: overview, school data, content data, student applications, access permissions, queue and audit.
- Ops admin supports new school, school edit, school program/rule/scholarship subrecords, public scholarship create, city create, timeline create, save, archive, publish, import preview/apply, student export, access invite, and queue actions.
- `data-*` action audit found 130 action-like attributes in top-level design-lab pages/scripts, with no unmatched handler selector.
- Low-frequency Ops click paths were rechecked on 2026-08-24: public scholarship create, school scholarship create, city create, timeline create, publish/archive, access invite, queue retry, and support lookup all keep the page rendered and provide visible feedback.
- Ops edge-case paths now keep editable state and block bad writes: invalid school JSON imports, invalid public scholarship JSON imports, and school-staff invites missing a school tenant all show inline feedback without creating records.
- Ops blank-state recovery now creates and opens a public scholarship draft automatically if an internal content action leaves the main admin surface empty.
- Ops public scholarship and school scholarship create now run a post-click editor integrity check so a missing editor/subrecord is restored to an editable draft instead of leaving the admin page blank.
- Ops admin blank detection now validates the active visible section, not hidden DOM text, and reopens the intended scholarship/content workspace if a section is accidentally hidden after an add action.
- Ops post-click recovery is scoped to the active admin section, so a delayed content recovery cannot pull the user back from school data, and a delayed school recovery cannot pull the user away from content data.
- Ops school subrecord rendering now isolates a malformed project, CSCA rule, or school scholarship row instead of blanking the whole school editor.
- Ops school subrecord editors now follow CSCAlite admin input boundaries more closely: SchoolProgram uses core academic, CSCA, tuition, timing, application, and source fields; SchoolCscaRule removes non-input `applicablePrograms` / `isVerified`; SchoolScholarship removes non-input date, CSC flag, verification, and public-scholarship slug fields from the school-attached editor.
- Ops school main editor now follows the CSCAlite `updateAdminSchool` boundary more closely: basic identity, application/CSCA/language fields, tuition/application fee, official/admissions links, and source records remain editable; removed display/contact/quality/completeness/derived fields no longer appear as main school edit tabs.
- Ops school basic editor now includes a read-only public-page preview and CSCAlite field summary, showing the student-facing school name/location, quickFacts-style fields, project/deadline signal, data quality, related record counts, and missing operational fields before the admin opens the public preview page.
- Ops AdminSchool `englishPrograms` now keeps CSCAlite's string shape, while `programFields` and other true list fields continue to round-trip as arrays.
- Ops admin in-page navigation has browser QA across overview, school data, student applications, content data, access permissions, queue/audit, every school editor tab, and every content tab so unfinished panels cannot silently become blank.
- Ops content editors now match the CSCAlite admin editing pattern more closely: changing CityGuide, AdminScholarship, or ApplicationTimelineWindow fields marks the editor dirty, and publish/archive is blocked until the user saves the content fields.
- Ops content save/publish/archive now simulates CSCAlite optimistic concurrency: CityGuide, AdminScholarship, and ApplicationTimelineWindow use the displayed `version` as `expectedVersion`, successful actions increment `version`, and stale editors show the same administrator-conflict pattern instead of overwriting newer local state.
- Browser QA now explicitly covers stale CityGuide publish and stale ApplicationTimelineWindow save/archive conflicts, so content status actions cannot silently overwrite newer administrator edits.
- Ops school save/archive and SchoolProgram, SchoolCscaRule, and SchoolScholarship subrecord save/archive now simulate CSCAlite optimistic concurrency: the editor stores the opened `version` as `expectedVersion`, successful actions increment `version`, and stale school or subrecord editors show administrator-conflict feedback instead of overwriting newer local state.
- Ops school editor now blocks archive while AdminSchool fields are dirty, matching the CSCAlite admin pattern that status actions should not silently discard unsaved field edits.
- Ops school subrecord save now clears the dirty flag before status actions, so a saved SchoolScholarship can be archived without being incorrectly blocked as unsaved.
- CityGuide structured content fields now round-trip through the editor without swapping `value` and `note` in quick facts or cost profiles during a second save.

## Browser QA Evidence

Recently passed against `D:\CODE\CUAC\design-lab`:

- `npm.cmd run qa:flows`
- `npm.cmd run qa:layout`

Recently passed against `frontend/public`:

- `npm.cmd run qa:flows`

Important covered flows:

- Public scholarship create stays rendered through normal clicks, real mouse clicks, legacy local state, broken local state, missing `CSS.escape`, and catalog failure.
- Public scholarship create is now covered from the in-page content tab as well as the dedicated create regressions, so the normal `新增奖学金` path cannot silently leave `ops-admin.html` blank.
- Public scholarship create QA now also forces the Ops main area blank after creation and verifies it recovers to the public scholarship editor instead of an empty page.
- Scholarship create QA also forces the active content section hidden after opening the library, then verifies the blank guard restores the visible public scholarship workspace.
- Ops scholarship create QA now removes the rendered public scholarship editor and school scholarship subrecord after creation, then verifies the post-click integrity checks restore the editable surface.
- School scholarship QA confirms create, save, stale-conflict blocking, and archive continue to work after the delayed recovery checks, using the CSCAlite `AdminSchoolScholarshipInput` field boundary for the school-attached editor.
- AdminScholarship QA now confirms save increments `version`, then simulates another administrator updating the record and verifies stale save/archive actions are blocked with the CSCAlite-style conflict copy without overwriting the fresher record.
- CityGuide and ApplicationTimelineWindow QA now simulate another administrator updating the content record, then verify stale publish, save, and archive actions are blocked without changing the newer status or body.
- Content editor QA changes a CityGuide field, verifies archive is blocked while unsaved, saves the field, then confirms publish/archive and the CSCAlite-shaped CityGuide content still persist.
- Ops in-page navigation QA clicks all primary admin sections, all school editor tabs, and all content tabs, and fails if any selected panel becomes blank or enters recovery mode.
- Ops school basic-tab QA verifies the public-page preview, CSCAlite field summary, missing-field chips, and university-detail preview link render inside the school editor.
- School data QA changes an AdminSchool field, verifies archive is blocked while unsaved, restores and saves the record, then continues through source-field checks.
- AdminSchool QA now confirms school save increments `version`, then simulates another administrator updating the school and verifies stale save/archive actions are blocked without overwriting the fresher record.
- SchoolProgram, SchoolCscaRule, and SchoolScholarship QA now confirm subrecord save increments `version`, then simulate another administrator updating the same subrecord and verify stale saves are blocked without overwriting the fresher subrecord.
- City/timeline create flows stay rendered.
- Catalog-backed university, program, scholarship, and city detail pages pass desktop and mobile layout QA after the shared section-navigation update.
- Program detail QA now verifies the side decision action cluster and clickable add-choice shortcut, while still hiding raw `SchoolProgram.*` model paths.
- University detail QA checks that Zhejiang University's official website and admissions entry render as real links, and that raw field labels like `School.officialWebsiteUrl` and `School.admissionsWebsiteUrl` are not exposed to students.
- University detail QA now verifies the side decision shortcuts for exact programs, admissions entry, and Hangzhou city context, so the student-facing school page has the same next-action shape as CSCAlite's public `SchoolDetailPage`.
- Universities list QA verifies CSCAlite `SchoolSearchQuery` criteria can arrive from URL parameters, are reflected in visible filter controls, can be changed by the user, and update results/empty state without blanking the page.
- University detail QA now uses Zhejiang University's CSCAlite-shaped program records to exercise degree filtering, the visible match count, expandable program details, and official program source links without exposing raw `SchoolProgram.*` field names.
- Scholarship detail QA verifies the `Apply and verify` sidebar card, official-action buttons, and copy-link feedback while still hiding raw `Scholarship.*` model paths.
- Scholarship detail QA now verifies the top scope summary and section-nav link render with at least six readable scope facts, so the public page keeps a quick fit check before the long requirement sections.
- Scholarship list QA now verifies CSCAlite-style target country/region filtering, active filter chips, and scoped card summaries.
- City detail QA now uses Shanghai's CityGuideAggregate rows to exercise degree filtering, visible match count, and city-to-program route cards without exposing raw `CityGuide.*` or `CityGuideAggregate.*` field labels.
- City detail QA now verifies the CSCAlite-style side decision actions for city schools, English programs, and application timeline.
- School scholarship subrecord create/save/archive, content publish/archive, access invite creation, and audited support lookup are covered by browser QA.
- Invalid import/access form flows are covered by browser QA: failed school and scholarship JSON imports stay open with the submitted text, and invalid school-staff invites do not create access records.
- Student protected actions route to the shared auth page with role choice and continuation.
- School staff and CUAC Ops sign-in routes persist role state and route to the correct surface.
- Role-protected continuations now block wrong-role completion on the shared auth page: a student-selected sign-in cannot continue into school staff or CUAC Ops routes until the user chooses the required role.
- Student detail save carries source context into favourites, application state, and notifications.
- School-origin student notifications now carry localized Chinese copy and the notification center renders that copy when the signed-in student's `Preferences > Language and region > Interface language` is Chinese; the default English notification copy remains available for English preference.
- Ops school editor now restores the CSCAlite `School` contact and scale field group as its own in-page tab (`contactTel`, `contactEmail`, `contactAddress`, `yearEstablished`, `studentCount`, `studentsServed`, `under18GuardianRequired`, `under18RequirementNote`), and browser QA verifies imported and manually created schools can render, edit, save, and persist those fields without blanking.
- City detail now surfaces CSCAlite `CityGuide.content.bestFor` in the first-screen budget/fit card and normalizes `budgetSummary.monthly/yearly` before display; Ops city preview uses the same student-facing quick-fit treatment.

## Still Not Complete

The broader objective is not complete yet. Remaining work to keep testing and aligning:

- Review screenshots and actual rendered pages for older cached states. Some user screenshots showed UI that no longer exists in current files, so QA should keep checking design-lab directly.
- Continue comparing visible school/program/scholarship/city detail content depth against CSCAlite page behavior, especially exact copy, localization, and which fields should be emphasized first.
- Expand edge-case QA around more role-specific access combinations and unsaved-edit conflicts after publish/archive operations.
- Decide whether school staff global navigation should stay shared CUAC navigation or become a role-specific school navigation. Earlier feedback rejected a heavy header change, so this should not be changed without design agreement.
- Replace or approve remaining remote placeholder imagery before any production launch decision.
