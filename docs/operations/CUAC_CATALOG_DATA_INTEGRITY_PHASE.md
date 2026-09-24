# CUAC Catalog Data Integrity Phase

Date: 2026-09-23
Status: automatic evidence completion gate passed; manual review and publication are deferred

## Goal

Complete a full data-integrity and relationship audit for schools, programs, program intakes and scholarships. Correct only issues that are deterministically supported by existing official evidence. Keep unresolved fields empty and create an explicit evidence-acquisition queue.

## Execution stages

1. **Public evidence boundary — complete.** Enforce entity-level verification gates, audit every active row and keep third-party-only records out of public queries.
2. **Legacy replacement preparation — in progress.** Consolidate exact-slug replacements already backed by registered official snapshots; do not write unreviewed drafts to the database.
3. **Existing-evidence completion — complete at the safe automatic boundary.** Extract only fields explicitly present in acquired official snapshots. Preserve unresolved fields as unresolved and apply only explicitly scoped external-blocker deferments.
4. **Official-source acquisition — deferred where externally blocked.** All production schools have an exact official source registered. Sources still blocked by CAPTCHA, access controls, unavailable endpoints, certificate failures or collector safety limits are not bypassed and no longer block the current completion gate.
5. **Cycle renewal — queued.** Replace expired 2026 intake and scholarship dates only when a 2027 official notice exists. Never roll a prior date forward mechanically.
6. **Review and publication — deferred by product decision.** Human review, database overwrite/archive actions and publication authorization remain outside this data-production phase.

## Boundaries

- The audit is read-only and writes only an ignored report under `work/catalog-quality/`.
- Acquisition uses exact registered official HTTPS URLs only.
- Missing fields, expired deadlines and possible duplicates do not authorize automatic replacement values.
- No draft becomes reviewed, verified or publication-authorized in this phase.
- National or provider-level scholarships are not required to belong to one school or program.

## Gates

1. Structural integrity: no active program under an inactive school, invalid intake window, scholarship/program school mismatch, non-HTTPS official source URL or active record sourced only from a prohibited third-party aggregator.
2. Temporal integrity: expired open intakes and expired active scholarships are separated from current routes.
3. Completeness: missing school, program and scholarship fields are grouped by exact missing field and official-source availability.
4. Identity integrity: exact normalized duplicate candidates are reported without automatic merging.
5. Evidence integrity: corrections retain exact official URL, snapshot SHA-256, capture time and field path.

Program and school cities may legitimately differ for cross-city campuses. These rows are a classification queue, not a structural blocker, and are never overwritten from the parent school's city without direct campus evidence.

Run `npm run catalog:data:integrity-audit` against the owned local PostgreSQL instance.

## Baseline result

The first full run found 80 active schools, 9,964 active programs, 9,510 intake rows and 583 active catalog scholarship records. Relational integrity is sound: there are no active programs under inactive schools, invalid intake windows, scholarship/program school mismatches or non-HTTPS active source URLs.

A second evidence-boundary pass found 827 active legacy records whose only recorded source is a prohibited third-party aggregator: 45 schools, 434 programs and 348 scholarships. All 827 are unverified. This is a production blocker even though it is not a foreign-key or date-window error.

The public repository now enforces evidence eligibility independently by entity:

- school lists and school detail pages require the school record to be `verified` or `stale`;
- program lists, counts, detail pages and selectable intakes require the program record to be `verified` or `stale` and its parent school to remain active;
- a verified program does not inherit the parent school's full unverified profile: only the program response's school identity reference is used, while the school detail remains unavailable until verified;
- scholarship publication continues to require `verified` status.

This boundary leaves 33 school profiles and 9,527 program routes eligible for public use. It avoids hiding 3,076 verified program routes merely because their parent school profile is still awaiting its own evidence review.

The remaining work is content production rather than relational repair:

- 40 schools have at least one missing public core field;
- 2,075 programs have at least one missing public core field after resolving valid parent-city inheritance;
- 491 active programs have no intake row;
- 356 active scholarships have at least one missing core field;
- 144 scholarship records carry a deadline already past at the audit date and belong in the next-cycle renewal queue;
- 348 program-city differences are predominantly explicit cross-city campuses and are classified for evidence review, not overwritten from the parent school;
- 70 production schools can continue from acquired official evidence, eight have registered sources awaiting acquisition, and none remain without an exact registered official source;
- 275 incomplete scholarships are provider-level rather than attached to one school and are handled in a separate provider queue.

The prohibited-source remediation classifier found 298 exact-slug official-evidence replacements in local evidence bundles (37 schools, 247 programs and 14 scholarships). They remain unreviewed drafts. The other 529 records (eight schools, 187 programs and 334 scholarships) have no registered official replacement candidate and remain quarantined from public queries.

The local database contains 80 active school rows, of which two use the reserved `local-` fixture namespace. Production acquisition queues exclude those fixtures, leaving 78 production school profiles. Public city queries already exclude the same namespace; the fixture rows remain available only for local workflow testing.

The reconciliation pass found evidence-backed null-fill candidates for 33 schools, 246 programs and 15 scholarships, plus intake candidates for 150 programs. It does not write them to the database. `catalog:data:remediation-plan` separates values from previously approved local bundles from new unreviewed draft values and emits only compare-and-set operations.

## First completion batch: Liaoning University of Traditional Chinese Medicine

The first school selected from the prohibited-source queue now has a complete, traceable draft bundle at `seeds/catalog.lnutcm-complete-batch-01.draft.json`, with its contract report at `seeds/catalog.lnutcm-complete-batch-01.validation.json`.

- eight exact official LNUTCM sources are registered; the registry contains 771 sources in total and validates successfully;
- six primary pages/PDFs were acquired and hash-pinned for the degree and scholarship records, plus the 2026–2027 language-program index page;
- the bundle contains Shenyang identity data, one school profile, 36 programs, 36 intake rows and two scholarships;
- 35 degree routes retain their real closed Fall 2026 intake rather than receiving fabricated 2027 dates;
- one non-degree Chinese-language route has an explicitly published Spring 2027 intake and October 31, 2026 applicant deadline;
- the current March 2027 International Chinese Language Teachers Scholarship is recorded separately from the closed 2026 Chinese Government Scholarship route;
- all nine pages of the official 2026 master's catalog were rendered and visually inspected; English program names remain labeled as editorial translations;
- the separate self-funded Chinese-language attachment returned HTML rather than a PDF, so it is not used for tuition, deadline or application claims;
- a conflicting institution name in one scholarship process sentence is excluded and retained as a source-quality warning.

The new official school draft creates one additional exact school replacement, but its 36 reviewed program identities do not match the 22 unrelated legacy program slugs. Those legacy rows therefore remain quarantined instead of being overwritten. The new records remain `draft`, `publicationAuthorized: false` and `databaseWriteAuthorized: false`.

## Second completion batch: Jinan University

Five exact official Jinan University sources were registered and acquired: the undergraduate freshness index, the 2026 international undergraduate guide, the 2026 international graduate guide, the 2026 high-level graduate scholarship and the 2026 Silk Road undergraduate scholarship. The resulting bundle is `seeds/catalog.jnu-complete-batch-01.draft.json`, with its contract report at `seeds/catalog.jnu-complete-batch-01.validation.json`.

- the official-source registry now contains 776 valid entries;
- the bundle contains the existing rich Guangzhou city evidence, one school profile, 16 undergraduate routes, 16 closed Fall 2026 intake rows and two closed 2026 scholarships;
- 14 legacy program identities receive exact official replacement candidates, while the generic legacy Chinese Language and Literature route remains quarantined because the official catalog publishes distinct Shipai and Zhuhai versions;
- all tuition, duration, language and CSCA values come from the 2026 program and fee tables;
- the graduate guide is retained as school-level evidence, but no graduate program identities are created because its program catalog is available only through a QR-code reference in the captured page;
- no 2027 Jinan University intake or scholarship date is inferred from the closed 2026 cycle.

This batch increased exact official replacements from 108 to 123 and reduced the no-replacement quarantine from 719 to 704 without changing the database or public verification states.

## Third completion batch: Tianjin Foreign Studies University

Four exact official Tianjin Foreign Studies University sources were registered, safely acquired and hash-pinned: the 2026 international undergraduate guide, the 2026 Tianjin Government Scholarship guide, the 2026 Chinese Government Scholarship bilateral Type A guide and the 2026 high-level graduate Type B guide. The resulting bundle is `seeds/catalog.tjfsu-complete-batch-01.draft.json`, with its contract report at `seeds/catalog.tjfsu-complete-batch-01.validation.json`.

- the official-source registry now contains 784 valid entries;
- the bundle reuses the rich Tianjin city evidence and contains one school profile, all 33 undergraduate routes in the official table, 33 closed Fall 2026 intake rows and three distinct scholarship records;
- ten legacy program identities receive exact official replacement candidates;
- each program retains its published teaching language, four-year duration, CNY 15,400 annual tuition and route-specific CSCA subjects;
- the 2026 undergraduate and university-controlled scholarship deadlines remain closed and no 2027 dates are inferred;
- the bilateral Type A deadline remains controlled by each home-country dispatching authority, so the draft preserves the official date range without inventing an exact deadline;
- the legacy generic new-student scholarship is not overwritten by the municipal scholarship because they are not the same award;
- English program names are editorial renderings of the official Chinese table and remain explicitly review-required.

This batch increased exact official replacements from 123 to 134 and reduced the no-replacement quarantine from 704 to 693 without changing the database or public verification states.

## Registered-source acquisition blockers

Two schools now have exact official sources registered but cannot yet produce a safe draft from the current official hosting state:

- **China Medical University:** `https://ies.cmu.edu.cn/` is registered as the official international-admissions portal. No current 2026/2027 public catalog was found, and the safe collector rejects the host because it requires unsafe legacy TLS renegotiation. TLS verification will not be bypassed. The school must repair the HTTPS configuration or provide an official signed/hosted admissions document before evidence can be hash-pinned.
- **Dalian Jiaotong University:** the exact 2026 undergraduate guide, 2026–2027 high-level graduate scholarship and official CSCA PDF are registered. The official host resets the TLS connection before a secure session is established, including on an isolated retry. Search-result text is not accepted as seed evidence; a retrievable official snapshot is required before a draft can be produced.

Neither blocker authorizes third-party substitution, TLS bypass, database mutation or publication.

## Fourth completion batch: Qingdao University

Four exact official Qingdao University sources were registered and safely acquired: the six-page 2026 international undergraduate guide, the four-page 2026 English-taught MBBS guide, the two-page Spring 2027 Chinese-language guide and the 2026 Presidential Scholarship page. All 12 PDF pages were rendered and visually inspected. The resulting bundle is `seeds/catalog.qdu-complete-batch-01.draft.json`, with its contract report at `seeds/catalog.qdu-complete-batch-01.validation.json`.

- the official-source registry now contains 788 valid entries;
- the bundle reuses the rich Qingdao city evidence and contains one school profile, five explicitly named programs, five intake rows and one scholarship;
- both prohibited-source legacy program identities now have exact official replacements: the Chinese Language and Business Administration dual degree and English-taught MBBS;
- the legacy Presidential Scholarship record now has an exact official replacement without changing its identity;
- the Spring 2027 Chinese-language non-degree route is recorded as currently open, with its explicit December 11, 2026 deadline and CNY 7,000 semester tuition;
- the 2026 named undergraduate routes, MBBS route and Presidential Scholarship remain closed; no dates are rolled forward;
- the guide's broad statement that domestic undergraduate majors accept international students is not expanded into fabricated route-level records because no route-specific international catalog was acquired.

This batch increased exact official replacements from 134 to 138 and reduced the no-replacement quarantine from 693 to 689 without changing the database or public verification states.

## Fifth completion batch: Sichuan International Studies University

Three exact official sources were registered and safely acquired: the 2026-2027 international undergraduate guide, the 2026-2027 Chinese-language study guide and the 2026-2027 MOE-Chongqing Government joint scholarship guide. The resulting bundle is `seeds/catalog.sisu-complete-batch-01.draft.json`, with its contract report at `seeds/catalog.sisu-complete-batch-01.validation.json`.

- the official-source registry now contains 791 valid entries;
- the bundle reuses the rich Chongqing city evidence and contains one school profile, seven explicitly named undergraduate majors, one Chinese-language study route, eleven intake rows and one scholarship;
- November 2026, March 2027 and May 2027 Chinese-language intakes remain open on their explicit official deadlines;
- the official undergraduate guide says additional majors exist but does not enumerate them, so only the seven named majors are created;
- the legacy generic Economics record is not conflated with the explicitly published International Economics and Trade route;
- the legacy MBBS and Stomatology records receive no replacement because none of the reviewed official pages identifies those programs;
- the legacy President Scholarship remains quarantined because the reviewed official notice concerns scholarships for current students rather than a new-applicant award.

This batch adds one exact school replacement, increasing the exact official replacement count from 138 to 139 and reducing the no-replacement quarantine from 689 to 688. It deliberately does not force unsafe program or scholarship matches.

## Sixth completion batch: Guangdong University of Foreign Studies

Five exact official Guangdong University of Foreign Studies sources were registered and safely acquired: the Fall 2026 international degree admissions notice, the current 2026 undergraduate catalog, the linked English-taught undergraduate program page, the Guangdong Government scholarship page and the GDUFS international student scholarship page. The resulting bundle is `seeds/catalog.gdufs-complete-batch-01.draft.json`, with its contract report at `seeds/catalog.gdufs-complete-batch-01.validation.json`.

- the official-source registry now contains 796 valid entries;
- the bundle reuses the rich Guangzhou city evidence and contains one school profile, five undergraduate routes, five closed Fall 2026 intake rows and two new-applicant scholarship records;
- all three prohibited-source legacy program identities now have exact official replacements: Chinese-taught Business Administration, Chinese-taught International Economics and Trade, and English-taught International Business;
- two additional English-taught routes, International Economics and Trade and Marketing, are included because the current official program page explicitly names them and the Fall 2026 admissions notice links that page;
- the English-taught routes retain the published CNY 33,800 annual tuition and language threshold; current Chinese-taught tuition remains unresolved because the official fee attachment is image-based and was not acquired as structured evidence;
- the Guangdong Government award is represented only for its eligible new/current degree-student scope, and the university award is narrowed to the new-degree-student category rather than mixing it with current-student awards;
- all reviewed 2026 application windows are closed and no 2027 intake or scholarship date is inferred.

This batch increases exact official replacements from 139 to 143 and reduces the no-replacement quarantine from 688 to 684. It also reduces the exact-source-registration queue from 14 schools to 13. No database state or public verification state was changed.

## Seventh completion batch: Shanghai University of Political Science and Law

The exact 2026 international student admission guide was registered and safely acquired from the university's International Student Office. The resulting bundle is `seeds/catalog.shupl-complete-batch-01.draft.json`, with its contract report at `seeds/catalog.shupl-complete-batch-01.validation.json`.

- the official-source registry now contains 797 valid entries;
- the bundle reuses the rich Shanghai city evidence and contains one school profile, all nine undergraduate identities already present in the legacy database and all three legacy scholarship categories;
- the guide directly supplies each program's teaching language, four-year duration and annual tuition, plus the CNY 400 application fee, CNY 30/day double-room accommodation and CNY 1,000/year medical insurance;
- all nine prohibited-source legacy program identities, the school identity and the three scholarship identities now have exact official replacement candidates;
- the three scholarship drafts preserve only the coverage published for Chinese Government, Shanghai Government and Belt and Road award categories; category-specific eligibility is left unresolved;
- no intake rows are created because the guide identifies Fall 2026 but does not publish an exact general application deadline or explicit close date;
- the linked CSCA subject attachment was not registered in this batch, so the universal undergraduate CSCA requirement is retained while route-specific subjects remain unresolved.

This batch increases exact official replacements from 143 to 156, reduces the no-replacement quarantine from 684 to 671 and reduces the exact-source-registration queue from 13 schools to 12. No database state or public verification state was changed.

## Eighth completion batch: Shanghai International Studies University

The official 2026 international undergraduate and master's admission pages were registered and safely acquired, followed by the university's exact 2026 Shanghai Government Scholarship guide. The resulting bundle is `seeds/catalog.shisu-complete-batch-01.draft.json`, with its contract report at `seeds/catalog.shisu-complete-batch-01.validation.json`.

- the official-source registry now contains 800 valid entries;
- the bundle reuses the rich Shanghai city evidence and contains one school profile, eleven exact legacy program identities, eleven closed Fall 2026 intake rows and one new Shanghai Government Scholarship record;
- nine undergraduate records are kept distinct by campus or route where the official page does so, including separate Songjiang, Hongkou and Japanese International Economics and Trade identities;
- all targeted undergraduate routes retain the published four-year duration, CNY 24,800 annual tuition, Chinese-medium requirement and applicable CSCA subjects;
- the English-taught academic master's routes in Finance and Global Communication retain the published two-year duration, IELTS 6.0-or-equivalent threshold and CNY 26,000 annual tuition; they are not conflated with the separately priced professional Finance degree;
- the intake records preserve the exact closed 2026 deadlines: April 15 for Songjiang undergraduate, April 30 for self-funded master's and July 20 for Hongkou undergraduate;
- the new Shanghai Government Scholarship record preserves the A/B coverage, age limits, program exclusions and March 31, 2026 deadline from the official notice;
- the prohibited-source legacy records named “上海外国语大学学校奖学金” remain quarantined because the municipal scholarship is not the same award;
- no 2027 route or date is inferred, and the English program titles remain review-required editorial renderings of exact Chinese official rows.

This batch increases exact official replacements from 156 to 168, reduces the no-replacement quarantine from 671 to 659 and reduces the exact-source-registration queue from 12 schools to 11. No database state or public verification state was changed.

## Ninth completion batch: Shandong Normal University

The official 2026 self-sponsored undergraduate brochure, the bilingual 2026-2027 international-program catalog and the 2026 Shandong Provincial Government Scholarship page were registered and safely acquired. The source domain was normalized from the certificate-invalid two-label `www.cie.sdnu.edu.cn` host to the certificate-valid official `cie.sdnu.edu.cn` host; TLS verification was never disabled. The resulting bundle is `seeds/catalog.sdnu-complete-batch-01.draft.json`, with its contract report at `seeds/catalog.sdnu-complete-batch-01.validation.json`.

- the official-source registry now contains 806 valid entries;
- the bundle reuses the rich Jinan city evidence and contains one school profile, ten exact legacy undergraduate program identities, ten closed Fall 2026 intake rows and one new provincial-government scholarship record;
- all ten program rows retain the official four-year duration, Chinese teaching language, exact Chinese/English titles and the published CNY 14,000-18,000 annual tuition;
- the undergraduate window remains April 1-May 31, 2026 and is explicitly closed; no 2027 intake or deadline is inferred;
- the undergraduate guide requires CSCA but does not publish program-specific subject combinations, so the draft records the requirement without inventing subjects;
- the provincial scholarship remains a distinct closed master's/doctoral route, with the published April 5-May 15, 2026 application window, degree scope, stipend and coverage;
- the scholarship is not attached as an entitlement to the ten undergraduate programs, and its separate specialty attachments remain a narrower unresolved eligibility boundary.

This batch increases exact official replacements from 168 to 179, reduces the no-replacement quarantine from 659 to 648 and reduces the exact-source-registration queue from 11 schools to 10. No database state or public verification state was changed.

## Tenth completion batch: Peking University Health Science Center

The authoritative Chinese 2026 international-undergraduate guide, its official English translation and the matching pre-arrival guide were registered and acquired. The resulting bundle is `seeds/catalog.pkuhsc-complete-batch-01.draft.json`, with its contract report at `seeds/catalog.pkuhsc-complete-batch-01.validation.json`.

- the official-source registry now contains 809 valid entries;
- the bundle reuses the rich Beijing city evidence and contains one school profile, two current international undergraduate programs and two closed Fall 2026 intake rows;
- the only current international undergraduate routes are six-year Clinical Medicine and five-year Oral Medicine, both Chinese-taught and both priced at CNY 45,000 per academic year;
- Clinical Medicine requires HSK 5, Oral Medicine requires HSK 6, and both require CSCA STEM Chinese, Mathematics, Physics and Chemistry in Chinese;
- the final self-funded application batch closed April 30, 2026; no 2027 date is inferred;
- the four prohibited-source legacy Law, Economics and Physics records do not belong to the medical-center international catalog and remain quarantined instead of being force-mapped;
- the generic legacy university-scholarship record also remains quarantined because the 2026 guide only directs Chinese Government Scholarship applicants to embassy channels and does not publish equivalent university-award terms.

This batch increases exact official replacements from 179 to 180, reduces the no-replacement quarantine from 648 to 647 and reduces the exact-source-registration queue from 10 schools to nine. No database state or public verification state was changed.

## Current official-source acquisition blockers

- Gansu University of Chinese Medicine: the official international-admissions portal is now registered, but the safe collector receives HTTP 412 and the browser times out. Search results expose only third-party reproductions, which are not accepted as evidence, so one school and ten legacy programs remain quarantined.
- Anhui University: acquired official program catalogs establish program identities but do not publish the missing current-cycle teaching language, duration, tuition or general admission window. Older general brochures are not promoted to 2026 evidence, and the two ambiguous legacy Economics rows remain unresolved.
- Yunnan Minzu University: the exact 2026 official program page and linked XLS are registered, but the safe collector rejects the host's incomplete certificate chain. TLS verification is not bypassed, and browser-visible content is not substituted for a hash-pinned collector snapshot.
- Hebei University of Economics and Business: the exact 2026 undergraduate, Chinese Government Scholarship and Hebei Government Scholarship pages are registered, but the safe collector rejects the host's incomplete certificate chain. No draft is generated until the official HTTPS chain is repaired or the university provides a retrievable official document.
- Southwest University of Political Science and Law: the official international-admissions portal is now registered, but the safe collector receives HTTP 412 and the site does not expose a retrievable 2026/2027 international guide. Older 2022/2023 brochures and unrelated domestic or Hong Kong, Macao and Taiwan admission notices are not promoted to current international evidence.
- Renmin University of China: all 11 exact 2026 official PDF URLs are registered, but the official host currently loops through HTTPS redirects before a document can be obtained. The collector fails closed and browser-visible redirect targets are not substituted for a hash-pinned snapshot.
- Zhengzhou University: eight exact official admissions and scholarship sources are registered, but the official host resets the connection before TLS negotiation completes. TLS verification is not disabled and no third-party reproduction is accepted as evidence.

The registered-acquisition queue now contains China Medical University, Dalian Jiaotong University, Gansu University of Chinese Medicine, Zhengzhou University, Yunnan Minzu University, Southwest University of Political Science and Law, Hebei University of Economics and Business and Renmin University of China. The exact-source-registration queue is empty.

## Eleventh completion batch: Harbin Institute of Technology, Shenzhen

The official 2026 international-undergraduate prospectus page and its eight-page PDF were registered, safely acquired and hash-pinned. Every PDF page was rendered and visually inspected. The resulting bundle is `seeds/catalog.hitsz-complete-batch-01.draft.json`, with its contract report at `seeds/catalog.hitsz-complete-batch-01.validation.json`.

- the official-source registry now contains 811 valid entries;
- the bundle reuses the rich Shenzhen city evidence and contains one school profile, all eight English-taught undergraduate routes in the prospectus, eight closed Fall 2026 intake rows and one current entrance-scholarship identity;
- the reviewed routes are Computer Science and Technology, Optoelectronic Information Science and Engineering, Mechanical Design, Manufacturing and Automation, Energy and Power Engineering, Civil Engineering, Business Administration, Economics and Architecture;
- the first five routes require CSCA Mathematics and Physics in English plus a university Mathematics-and-Physics entrance exam; Business Administration, Economics and Architecture require CSCA Mathematics in English plus a university Mathematics entrance exam;
- all reviewed routes charge CNY 30,000 per year; Architecture is five years and the other seven routes are four years;
- the application window ran December 30, 2025-May 20, 2026 and is closed; no 2027 date is inferred;
- the HITSZ Entrance Scholarship is a distinct draft automatically considered with the admission application, with published award levels from 70% tuition through full tuition plus CNY 1,000 per month;
- only Architecture is an exact current match among the ten prohibited-source legacy program identities; Business Administration is not force-mapped to the legacy Business Management row, and the other unrelated legacy programs remain quarantined;
- the two prohibited-source legacy scholarship titles are not treated as aliases of the current entrance scholarship;
- the Shenzhen municipal and Guangdong provincial awards are not created in this batch because the prospectus gives only general annual application periods rather than a current exact route and deadline.

This batch increases exact official replacements from 180 to 182, reduces the no-replacement quarantine from 647 to 645 and reduces the exact-source-registration queue from nine schools to eight. No database state or public verification state was changed.

## Twelfth completion batch: East China University of Political Science and Law

The official 2026 international-undergraduate guide, its linked XLS program catalog and linked DOCX CSCA subject notice were registered, safely acquired and hash-pinned. The resulting bundle is `seeds/catalog.ecupl-complete-batch-01.draft.json`, with its contract report at `seeds/catalog.ecupl-complete-batch-01.validation.json`.

- the official-source registry now contains 819 valid entries, including the newly registered Yunnan Minzu University and Hebei University of Economics and Business sources that remain acquisition-blocked;
- the bundle reuses the rich Shanghai city evidence and contains one school profile, all 15 undergraduate routes in the official catalog and 15 Fall 2026 self-funded intake rows;
- the XLS contains exactly 15 populated program rows and two empty worksheets; program names, annual tuition and the CNY 400 application fee are retained from the catalog and admissions guide;
- 14 routes are Chinese-taught, normally charge CNY 24,000 per year and require CSCA Mathematics plus Liberal Arts Chinese; Business Chinese Communication charges CNY 22,000 and requires HSK Level 3, while a valid HSK Level 4 score is needed for its published CSCA Chinese-subject exemption;
- International Business Law is the only reviewed English-taught route, charges CNY 30,000 per year, requires CSCA Mathematics but no Professional Chinese subject, and uses the university's English telephone interview requirement;
- the self-funded application window is open from May 1 through September 30, 2026 at the audit date; the scholarship application window closed April 30, 2026, and no 2027 date is inferred;
- no scholarship row is created because the guide links generic Chinese Government and Shanghai Government scholarship portals without complete route-specific eligibility and coverage;
- Law and International Business Law receive exact current replacement candidates. Legacy Accounting, Business Administration and Economics do not appear in the current official catalog and are not force-mapped;
- the DOCX text and package were structurally inspected. Visual page rendering is explicitly marked unresolved because the bundled workspace runtime does not include LibreOffice.

This batch increases exact official replacements from 182 to 184, reduces the no-replacement quarantine from 645 to 643 and reduces the exact-source-registration queue from eight schools to five after the additional official-source registrations. No database state or public verification state was changed.

## Thirteenth completion batch: Tianjin University of Finance and Economics

The bilingual 2026 international-undergraduate guides, the 2026 Chinese Government Scholarship bilateral Type A guide and the Chinese 2026 high-level graduate scholarship guide were registered, safely acquired and hash-pinned. The resulting bundle is `seeds/catalog.tjufe-complete-batch-01.draft.json`, with its contract report at `seeds/catalog.tjufe-complete-batch-01.validation.json`.

- the bundle reuses the rich Tianjin city evidence and contains one school profile, all 49 four-year undergraduate routes in the official table, 49 closed Fall 2026 intake rows and two distinct scholarship records;
- the reviewed undergraduate routes retain Chinese as the teaching language, CSCA Chinese and Mathematics, and the published CNY 16,600 annual tuition including insurance, or CNY 20,000 for art routes;
- the bilateral Type A record leaves its dispatching-authority deadline unresolved instead of inventing one universal date;
- the high-level graduate record uses the February 20, 2026 deadline on the authoritative Chinese guide and records the conflicting February 15 English-page date as a review note;
- six exact legacy program identities and the school profile receive official replacement candidates; no unrelated identity is force-mapped;
- all reviewed 2026 university-controlled windows are closed and no 2027 date is inferred.

This batch increases exact official replacements from 184 to 191 and reduces the no-replacement quarantine from 643 to 636. No database state or public verification state was changed.

## Fourteenth completion batch: Harbin University of Science and Technology

The 2026 international-undergraduate guide, current ordinary undergraduate catalog and 2026 Chinese Government Scholarship Silk Road guide were registered, safely acquired and hash-pinned. The resulting bundle is `seeds/catalog.hrbust-complete-batch-01.draft.json`, with its contract report at `seeds/catalog.hrbust-complete-batch-01.validation.json`.

- the bundle contains one school profile, six evidence-bounded undergraduate routes, six closed Fall 2026 intake rows and one closed graduate Electrical Engineering scholarship;
- Chinese Language Education is explicitly named in the international guide and retains its published four-year duration, no-HSK rule and CSCA Mathematics requirement;
- five ordinary legacy program identities are included only where their exact Chinese names occur in the current university catalog and the international guide permits qualified applicants to choose an ordinary current-plan major;
- duration remains unresolved for those five ordinary majors because the reviewed international evidence does not publish it;
- all reviewed undergraduate routes retain the CNY 15,000 annual tuition and route-specific CSCA/HSK rules;
- the Silk Road award is kept as a separate closed graduate Electrical Engineering route and is not presented as an undergraduate entitlement.

This batch increases exact official replacements from 191 to 197 and reduces the no-replacement quarantine from 636 to 630. No database state or public verification state was changed.

## Fifteenth completion batch: Central University of Finance and Economics

The bilingual 2026 international-undergraduate guides and program catalogs, the separate English-taught Finance guide, the 2026 Silk Road scholarship guide and the 2026 high-level graduate scholarship guide were registered, safely acquired and hash-pinned. The resulting bundle is `seeds/catalog.cufe-complete-batch-01.draft.json`, with its contract report at `seeds/catalog.cufe-complete-batch-01.validation.json`.

- the official-source registry now contains 833 valid entries;
- the bundle reuses the rich Beijing city evidence and contains one school profile, all 28 four-year undergraduate routes in the official bilingual table, 28 closed Fall 2026 intake rows and two specific closed scholarship records;
- the catalog's two Finance routes are kept separate: the Chinese Academy of Finance and Development route is English-taught at CNY 40,000/year, while the School of Finance route is Chinese-taught at CNY 25,000/year;
- all other 26 undergraduate routes are Chinese-taught at CNY 25,000/year; Chinese routes require HSK 5 score 180 plus CSCA Humanities Chinese and Mathematics, while English Finance requires CSCA Mathematics and accepted English evidence;
- only the four undergraduate routes explicitly named by the Silk Road guide are marked scholarship-linked;
- the scholarship pages identify full awards but do not itemize benefit amounts, so those amounts remain unresolved rather than copied from another institution or scheme;
- four exact legacy program identities and the school profile receive official replacement candidates; legacy Marketing (Big Data and Marketing) and the generic scholarship identity remain quarantined because no exact current identity matches them;
- all reviewed 2026 deadlines are closed and no 2027 date is inferred.

This batch increases exact official replacements from 197 to 202 and reduces the no-replacement quarantine from 630 to 625. The subsequent registration of the official Gansu University of Chinese Medicine and Southwest University of Political Science and Law admissions portals raises the registry to 835 valid entries and reduces the exact-source-registration queue to zero; both portals currently return HTTP 412 to the safe collector and remain acquisition blockers. No database state or public verification state was changed.

## Sixteenth completion batch: official school identity replacements

Eight exact school-profile drafts were generated from already acquired official university evidence: Anhui University, Central China Normal University, Dalian University of Technology, Guangxi Medical University, Guizhou Medical University, Xi'an Jiaotong University, Yanshan University and Yunnan University of Finance and Economics. The resulting bundle is `seeds/catalog.school-identity-replacements-batch-01.draft.json`, with its contract report at `seeds/catalog.school-identity-replacements-batch-01.validation.json`.

- the bundle contains seven existing evidence-backed city dependencies and eight school identities; it creates no program, intake or scholarship rows;
- only official school identity, directly supported city context, public-university context and exact official international-admission entry points are retained;
- legacy aggregator profile prose, rankings, tuition, language requirements and deadlines are not copied;
- Dalian University of Technology intentionally omits `citySlug` from this sparse replacement because a reviewed Dalian city dependency is not yet present in the local rich-city bundles; a future compare-and-set operation can preserve the existing relationship pending city evidence;
- the remaining eight prohibited-source school records are exactly the eight schools whose registered official sources are still acquisition-blocked: China Medical University, Dalian Jiaotong University, Gansu University of Chinese Medicine, Hebei University of Economics and Business, Renmin University of China, Southwest University of Political Science and Law, Yunnan Minzu University and Zhengzhou University.

This batch increases exact official replacements from 202 to 210, raises school replacement candidates from 29 to 37 and reduces the no-replacement quarantine from 625 to 617. No database state or public verification state was changed.

## Seventeenth completion batch: Xi'an Jiaotong University

Nine exact official sources are hash-pinned for this batch: the 2026 non-medical undergraduate guide, undergraduate catalog page, program-and-CSCA workbook, separate medical undergraduate guide, graduate guide and program catalog, Atomic Energy Scholarship brochure, direct-doctoral scholarship brochure and Chinese-language program brochure. The resulting bundle is `seeds/catalog.xjtu-complete-batch-01.draft.json`, with its contract report at `seeds/catalog.xjtu-complete-batch-01.validation.json`.

- the official-source registry now contains 837 valid entries;
- the bundle reuses the existing Xi'an city and XJTU school-identity drafts and contains all 49 teaching routes in the official 2026 undergraduate workbook, 49 closed Fall 2026 intake rows and six exact scholarship identities;
- the undergraduate catalog contains 44 Chinese-taught and five English-taught routes, including a separately verified six-year English MBBS route;
- every program preserves the official language, duration, degree type and route-specific CSCA subjects; the four English engineering routes retain Mathematics plus Physics or Chemistry, while MBBS retains Mathematics and Chemistry;
- the non-medical guide supplies the CNY 20,000, CNY 22,000, CNY 40,000 and CNY 180,000 annual tuition bands; the medical guide independently confirms CNY 40,000 annual MBBS tuition;
- all 15 prohibited-source legacy XJTU program identities now have exact official replacement candidates, along with the school identity and two matching legacy scholarship identities;
- the legacy “developing countries scholarship” remains quarantined because the current Atomic Energy and direct-doctoral awards are distinct programs and are not treated as aliases;
- graduate program tables were acquired and retained for a separate structured transformation pass; this batch does not rely on lossy PDF-table extraction to create graduate identities;
- all 2026 routes are closed at the audit date and no 2027 intake or deadline is inferred.

This batch increases exact official replacements from 210 to 227, raises program replacement candidates from 169 to 184 and scholarship replacement candidates from four to six, and reduces the no-replacement quarantine from 617 to 600. No database state or public verification state was changed.

## Eighteenth completion batch: East China Normal University legacy alignment

The existing ECNU safe-new bundle already contains 280 official 2026 program records, 280 intake records and eight current scholarship identities. The remaining problem was a parallel set of legacy slugs that could not be matched automatically. The deterministic alignment bundle is `seeds/catalog.ecnu-legacy-alignment-batch-01.draft.json`, with its contract report at `seeds/catalog.ecnu-legacy-alignment-batch-01.validation.json`.

- eleven legacy undergraduate identities map uniquely to one current official route by program name, degree level and school or faculty;
- the aligned routes include Accounting, Administration Management, Applied Psychology, Biology Science, Biology Technology, two school-specific Business Administration routes, Chemistry, the English-taught double-degree Business Administration route, Economics and Environmental Science;
- the generic legacy Business Administration row is not aligned because two current Chinese-taught schools publish that exact name;
- three legacy scholarship identities map exactly to the current Shanghai Government undergraduate, Chinese Government Type B graduate and Excellent Freshmen routes;
- generic International Chinese Language Teachers, historical excellence-award, school-special and separate Shanghai A/B legacy rows are not force-mapped to degree-specific or combined current records;
- the bundle reuses the exact official source URL, snapshot SHA-256 and field lineage from the previously generated ECNU current-route bundle, and remains a draft identity alignment only.

This batch increases exact official replacements from 227 to 241, raises program replacement candidates from 184 to 195 and scholarship replacement candidates from six to nine, and reduces the no-replacement quarantine from 600 to 586. No duplicate insertion, archival action, database write or publication is authorized.

## Nineteenth completion batch: Xiamen University legacy alignment

The existing XMU complete bundle already contains 535 official 2026 program records, 535 intake records and four current scholarship identities. The deterministic alignment bundle is `seeds/catalog.xmu-legacy-alignment-batch-01.draft.json`, with its contract report at `seeds/catalog.xmu-legacy-alignment-batch-01.validation.json`.

- twelve legacy undergraduate identities map uniquely to current official routes by name, level, language and exact catalog row: Accounting, Biological Science, Chemistry, English MBBS, English Digital Media Art, Ecology, Economics, English Environmental Design, Finance, International Economics and Trade, Statistics and English Visual Communication Design;
- legacy Education is not aligned because the current international undergraduate catalog contains no exact standalone Education route;
- legacy Marine Science is not aligned because four different current undergraduate rows share that name and the old row has no school or direction discriminator;
- the legacy new-international-student scholarship and Fujian Government scholarship map exactly to current official 2026 records;
- the legacy Tan Kah Kee Scholarship remains unresolved because the reviewed current bundle contains no matching exact route;
- all aligned records reuse the previously hash-pinned official URL, snapshot SHA-256 and field lineage and remain draft-only.

This batch increases exact official replacements from 241 to 255, raises program replacement candidates from 195 to 207 and scholarship replacement candidates from nine to 11, and reduces the no-replacement quarantine from 586 to 572. No duplicate insertion, archival action, database write or publication is authorized.

## Twentieth completion batch: Tianjin University legacy alignment

The existing Tianjin University complete bundle already contains 296 official program records, 296 intake records and six current scholarship identities. The deterministic alignment bundle is `seeds/catalog.tju-legacy-alignment-batch-01.draft.json`, with its contract report at `seeds/catalog.tju-legacy-alignment-batch-01.validation.json`.

- twelve legacy undergraduate identities map uniquely to current official routes by name, level and teaching language: Biological Engineering, Biomedical Engineering, Chinese- and English-taught Chemical Engineering and Technology, Chinese Language and Literature, English-taught Environmental Engineering, Fine Chemical Engineering, Food Science and Engineering, Intelligent Medical Engineering, Pharmaceutical Engineering, English-taught Pharmaceutical Science and Synthetic Biology;
- Process Equipment and Control Engineering is not aligned because it is absent from the current international undergraduate catalog;
- the four legacy faculty-special or generic scholarship identities are not force-mapped to the six currently published named scholarship routes;
- all aligned records reuse the previously hash-pinned official URL, snapshot SHA-256 and field lineage and remain draft-only.

This batch increases exact official replacements from 255 to 267, raises program replacement candidates from 207 to 219 and reduces the no-replacement quarantine from 572 to 560. The reconciliation pass now exposes 140 evidence-backed intake candidates. No duplicate insertion, archival action, database write or publication is authorized.

## Twenty-first completion batch: Nankai University legacy alignment

The deterministic alignment bundle is `seeds/catalog.nankai-legacy-alignment-batch-01.draft.json`, with its contract report at `seeds/catalog.nankai-legacy-alignment-batch-01.validation.json`.

- Business Administration and Insurance are the only legacy undergraduate identities that map to one exact current official undergraduate route by name and level;
- Accounting and Financial Engineering occur only at graduate level in the reviewed current catalog, Finance is published as Finance Specialty, and the remaining legacy names have no exact current undergraduate identity;
- the generic legacy university scholarship is not mapped to either of the two distinct current named scholarship routes.

This batch adds two exact program replacement drafts and two evidence-backed intake candidates. Ambiguous and absent routes remain quarantined.

## Twenty-second completion batch: University of International Business and Economics legacy alignment

The deterministic alignment bundle is `seeds/catalog.uibe-legacy-alignment-batch-01.draft.json`, with its contract report at `seeds/catalog.uibe-legacy-alignment-batch-01.validation.json`.

- Business Administration, Finance, International Economics and Trade, and Marketing map uniquely by exact English name and undergraduate level to current official English-taught routes;
- Accounting and Logistics Management are absent from the reviewed current official route list;
- the two generic or institution-level legacy scholarship rows are not conflated with the current named Silk Road and Youth of Excellence routes;
- no annual intake is inferred from a recurring application-period page.

This batch adds four exact program replacement drafts without inventing intake years or deadlines.

## Twenty-third completion batch: Dalian University of Technology scholarships

Ten registered DUT official pages were already hash-pinned in `work/catalog-official/dut-complete-batch-01/manifest.json`. Five current scholarship routes are structured in `seeds/catalog.dut-scholarships-batch-01.draft.json`, with validation at `seeds/catalog.dut-scholarships-batch-01.validation.json`: High-Level Postgraduate and Silk Road Type B, Type A Bilateral, China Link, Youth of Excellence, and the university Presidential Scholarship.

- degree-specific, authority-dependent and rolling deadlines are retained as published; no universal deadline is invented;
- the exact legacy International Students Presidential Scholarship identity is aligned in `seeds/catalog.dut-legacy-alignment-batch-01.draft.json`;
- the legacy International Chinese Language Teachers Scholarship remains unresolved because the reviewed current pages do not evidence that route;
- five official program-list attachment endpoints were registered, but each returned an interactive image-verification download page. The collector does not bypass this control, so the program-catalog portion remains blocked until the university exposes an accessible official file or a permitted operator supplies the attachment.

The official-source registry now contains 842 valid entries. Across the Nankai, UIBE and DUT steps, exact official replacements increase from 267 to 274, program replacements increase from 219 to 225, scholarship replacements increase from 11 to 12, and quarantine falls from 560 to 553. No database write or publication is authorized.

## Twenty-fourth completion batch: Beijing Language and Culture University legacy alignment

The deterministic alignment bundle is `seeds/catalog.blcu-legacy-alignment-batch-01.draft.json`, with its contract report at `seeds/catalog.blcu-legacy-alignment-batch-01.validation.json`.

- the suffixed legacy International Economics and Trade identity maps exactly to the current official independent bachelor's route;
- both official Spring and Fall 2026 intake rows are preserved and are closed at their published deadlines;
- the dual-degree Chinese Language plus Artificial Intelligence and Translation (Localization) legacy identities have no exact current record in the reviewed bundles;
- the five remaining legacy scholarship rows are not forced onto different current named scholarship routes.

This batch adds one exact program replacement and one program with evidence-backed intake candidates.

## Twenty-fifth completion batch: Yanshan University

The official 2026 admission page embeds Chinese and English brochure PDFs. Both exact PDF URLs were registered and hash-pinned; the English brochure was text-extracted and visually checked across the program, fee, scholarship and deadline pages. The resulting bundle is `seeds/catalog.yanshan-complete-batch-01.draft.json`, with its contract report at `seeds/catalog.yanshan-complete-batch-01.validation.json`.

- the bundle contains all 13 undergraduate routes from the official table, their exact teaching language and route-specific CSCA subjects, plus 13 closed Fall 2026 intake rows;
- it preserves CNY 15,700 annual undergraduate tuition and the published June 15, 2026 degree-program deadline;
- seven scholarship records separate Type A, Type B, International Chinese Language Teachers, Hebei Government and degree-specific YSU President Scholarship routes;
- the master's and doctoral president-scholarship records reuse the two matching legacy identities and retain the official CNY 1,000 and CNY 2,000 monthly allowances, tuition and dormitory coverage;
- all 11 prohibited-source legacy Yanshan program identities now have exact official replacement candidates; no 2027 intake is inferred.

This batch increases exact replacements from 275 to 288 and reduces quarantine from 552 to 539 without creating conflicts.

## Twenty-sixth completion batch: Guangxi Medical University

The hash-pinned official 2026 undergraduate brochure contains a structured program table, application rules, fees, CSCA requirements and four financial-aid routes. The resulting bundle is `seeds/catalog.gxmu-complete-batch-01.draft.json`, with its contract report at `seeds/catalog.gxmu-complete-batch-01.validation.json`.

- the brochure publishes 25 actual rows despite numbering that skips 19; the bundle follows the table rows and does not invent a missing program;
- the six-year English MBBS route remains distinct from five-year Chinese-taught Clinical Medicine; the other 23 routes are Chinese-taught;
- every route requires Mathematics and Chemistry, Chinese-taught routes additionally retain STEM Chinese, and language thresholds are stored separately;
- tuition is CNY 35,000 per year for English MBBS and CNY 28,000 for Chinese-taught undergraduate routes;
- all Fall 2026 routes are closed at the published August 15 deadline; the separate July 30 self-funded CSCA-result deadline is retained in the program requirement rather than substituted as the application deadline;
- six legacy program identities now point to exact or clearly expanded official titles; four financial-aid routes preserve nationality and route restrictions without inventing unpublished amounts or fixed dates.

The official-source registry now contains 845 valid entries. This batch increases exact official replacements from 288 to 294, raises program replacements from 237 to 243 and reduces quarantine from 539 to 533. The complete catalog migration and official-source safety suites pass 31 of 31 tests. No database write or publication is authorized.

## Twenty-seventh completion batch: Guizhou Medical University

The official 2026 undergraduate guide page and its embedded six-page PDF were registered, hash-pinned and visually inspected. The resulting bundle is `seeds/catalog.gmcu-complete-batch-01.draft.json`, with its contract report at `seeds/catalog.gmcu-complete-batch-01.validation.json`.

- the bundle contains the two degree routes explicitly published by the brochure: Clinical Medicine and Bachelor of Dental Surgery;
- both routes retain the open Fall 2026 application deadline of September 30, 2026 and no 2027 intake is inferred;
- the existing Clinical Medicine identity receives an exact official replacement candidate, while Nursing, Pharmacy and Pharmacy Administration remain quarantined because they are absent from the reviewed current brochure;
- Chinese Government Scholarship and Guizhou Government Scholarship are retained only at the scope published by the brochure; unpublished amounts and independent deadlines remain unresolved;
- teaching-language labels are recorded as evidence-backed editorial derivations and remain flagged for later human review rather than being treated as independently published facts.

This batch adds one exact program replacement and two evidence-backed intake candidates. No database write or publication is authorized.

## Twenty-eighth completion batch: University of Electronic Science and Technology of China legacy alignment

The deterministic alignment bundle is `seeds/catalog.uestc-legacy-alignment-batch-01.draft.json`, with its contract report at `seeds/catalog.uestc-legacy-alignment-batch-01.validation.json`.

- Biomedical Engineering and Mechanical Design Manufacture and Automation map uniquely to current official Chinese-taught undergraduate routes;
- Urban Management has no exact current route and remains quarantined;
- the legacy freshman-scholarship title is not forced onto the broader current university scholarship;
- two other legacy scholarship records naming Guilin University of Electronic Technology and Xidian University are treated as institution mismatches and remain quarantined.

This batch adds two exact program replacements and two intake candidates without conflating similarly named institutions or scholarship schemes.

## Twenty-ninth completion batch: Anhui University legacy Economics alignment

The deterministic alignment bundle is `seeds/catalog.ahu-legacy-alignment-batch-01.draft.json`, with its contract report at `seeds/catalog.ahu-legacy-alignment-batch-01.validation.json`.

- the unsuffixed legacy Economics identity maps uniquely to the current official undergraduate Economics route;
- the duplicate `anhui-university-economics-3` identity remains quarantined for later merge or archival review instead of creating a second current route;
- no intake is inferred because the reviewed official program list does not publish a current intake year or deadline;
- the bundle uses the official Hefei and Anhui University dependencies and does not copy the prohibited third-party dependencies from the earlier cleanup draft.

This batch raises the classifier to 298 exact replacement drafts and reduces quarantine to 529, with no conflicts.

## Thirtieth completion batch: Northwestern Polytechnical University

Eight already acquired official 2026 pages were transformed into `seeds/catalog.nwpu-complete-batch-01.draft.json`, with validation at `seeds/catalog.nwpu-complete-batch-01.validation.json` and a non-authorizing review ledger at `seeds/catalog.nwpu-complete-batch-01.review.json`.

- the bundle contains 17 undergraduate language routes, 47 master's routes and 32 doctoral routes, for 96 program routes and 96 closed 2026 intake rows;
- all routes retain their published teaching language, degree level, duration, tuition band and applicable language or CSCA requirements;
- four current scholarship identities are separated: Chinese Government Scholarship, NPU President Scholarship, Xi'an Belt and Road International Students Scholarship and Outstanding Visiting Student Scholarship;
- award-specific details not published by the reviewed overview pages remain unresolved;
- proposed legacy alias archival remains a future reviewed database operation and is not authorized by this draft.

The official-source registry now contains 846 valid entries. This batch expands current official catalog coverage but does not increase exact legacy replacements because the remaining legacy scholarship names are not treated as aliases without direct evidence. No database write, archival action or publication is authorized.

## Thirty-first completion batch: Nanjing University graduate catalog

Seven hash-pinned 2026 graduate-admission, program-catalog and scholarship sources were transformed into `seeds/catalog.nju-complete-batch-02.draft.json`, with validation at `seeds/catalog.nju-complete-batch-02.validation.json` and an explicitly non-authorizing ledger at `seeds/catalog.nju-complete-batch-02.review.json`.

- the bundle reuses the byte-equivalent approved Nanjing city and Nanjing University dependencies but does not write either dependency to a database;
- it contains 202 new graduate routes: 141 master's and 61 doctoral routes, including 193 Chinese-taught and nine English-taught routes;
- every route keeps its official program code, school or department, teaching language, duration and PDF page/row lineage, plus one closed Fall 2026 intake record;
- three distinct scholarships are included: the Type B High-Level Graduate Program, the CSC Excellence Program and the Nanjing Government Scholarship;
- personal contact details are removed from public notes, and unresolved route-level tuition or exceptional language thresholds remain explicitly unresolved;
- the earlier 59 undergraduate routes and the existing Silk Road scholarship are not duplicated or modified.

This batch adds 202 current official program routes, 202 intake rows and three scholarship records to the draft catalog without changing the 298 exact legacy-replacement count. No review, publication or database write is authorized.

## Thirty-second completion batch: official-draft completeness and safe field enrichment

An evidence-gated coverage audit is now available through `npm run catalog:data:official-draft-coverage`. It scans draft and local-reviewed seed artifacts but counts a record only when its source URL and SHA-256 match a successful acquisition manifest and the exact source remains registered. Duplicate slugs are reduced to the candidate with the greatest core-field completeness; this selection does not promote or approve any record.

- the authoritative draft corpus currently contains 69 unique schools, 9,497 unique programs, 285 unique scholarships and 9,098 evidence-backed intake rows;
- four intakes are explicitly open for 2027 or later, all for non-degree Chinese-language study; no 2027 degree intake is inferred;
- a Dalian city dependency was generated from the hash-pinned Dalian University of Technology 2026 guide, allowing the DUT school identity to retain `citySlug: dalian` without relying on a prohibited source;
- the DUT school draft was enriched with the guide's undergraduate level, English teaching medium, language thresholds, month-bounded application period, CNY 25,500 annual tuition, CNY 600-1,800 monthly accommodation range, CNY 800 application fee and the evidence-bounded CSCA rule;
- UIBE's official international-school website was filled from the HTTPS origin of its hash-pinned official program source;
- five school records received missing official website or admissions entry fields in `seeds/catalog.school-access-enrichment-batch-01.draft.json`; every value is either the exact registered official page/guide or that source's HTTPS origin;
- Xi'an Jiaotong University, Yanshan University and Yunnan University of Finance and Economics received application-level labels only where the hash-pinned page explicitly exposes the relevant admission channels or degree-awarding levels;
- the ZJSU International Chinese Language Teachers Scholarship received a non-numeric `amountText` that restates the official coverage categories and explicitly preserves the absence of one universal itemized cash amount;
- scholarship core-field gaps are now zero, while school core-field gaps are reduced to one unresolved Central China Normal University `applicationLevel` field because the page's attached guide has not been safely acquired;
- 1,034 program records still lack at least one core field: 317 teaching-language fields, 988 tuition fields and 170 application URLs. Most are concentrated in Wuhan University, Anhui University, Beijing Forestry University, South China University of Technology and Beijing Language and Culture University. Their reviewed official sources do not establish those values per route, so the fields remain absent rather than being guessed;
- all eight previously blocked school endpoints remain blocked under a fresh safe-collector retry: legacy TLS renegotiation, TLS reset, HTTP 412, unverifiable certificate chains or a redirect rejected by the HTTPS/allowlist guard. No TLS or redirect safeguard was bypassed;
- the migration suite passes 21 of 21 tests, the official-source and local-publication safety suite passes 10 of 10 tests, and the production build completes successfully;
- after the generated local PostgreSQL service was restored by the operator, the read-only reconciliation pass completed successfully: 37 school records, 246 program records and 16 scholarship records have safe candidates, 150 programs have evidence-backed intake candidates, and no school, program or scholarship candidate conflicts were found;
- the live local database still contains 827 active records sourced from prohibited aggregators. Of these, 298 have draft official replacements and 529 require quarantine until an exact official replacement exists; this report does not authorize either replacement or quarantine writes.

All enrichment artifacts in this batch have `publicationAuthorized: false` and `databaseWriteAuthorized: false`. The project currently has no human-review step, so these files remain unreviewed drafts and must not be presented as published catalog data.

Run order:

1. `npm run catalog:data:integrity-audit`
2. `npm run catalog:data:official-draft-coverage`
3. `npm run catalog:data:reconciliation-candidates`
4. `npm run catalog:data:prohibited-source-remediation`
5. `npm run catalog:data:gap-queue`
6. `npm run catalog:data:remediation-plan`

## Thirty-third completion batch: route-level core-field completion

Four deterministic enrichment builders were added for values that can be established from exact, hash-pinned official evidence. Their outputs remain `unreviewed_draft`; this batch does not review, approve, publish or write any catalog record to PostgreSQL.

- `seeds/catalog.gdufs-tuition-enrichment-batch-01.draft.json` adds the explicitly published CNY 20,000/year tuition to the two Chinese-taught GDUFS undergraduate routes that lacked it;
- `seeds/catalog.whu-tuition-enrichment-batch-01.draft.json` applies Wuhan University's current official level, teaching-medium and discipline-band fee matrix to all 599 matching routes through explicit fail-closed school/unit allowlists;
- `seeds/catalog.residual-core-enrichment-batch-01.draft.json` records three UIBE Silk Road routes as English-taught with scholarship-covered tuition, the one-academic-year English IMPA route with non-itemized full-scholarship coverage, the absence of a published French-route fee at BUCT, and the published CNY 6,500/semester fee for the LNUTCM Spring 2027 one-semester Chinese-language route;
- `seeds/catalog.blcu-teaching-language-enrichment-batch-01.draft.json` adds Chinese teaching language to 21 exact BLCU route identities that are explicitly listed in the official CSCA table. Same-name English alternatives, joint degrees, associate programs and differently named specializations are intentionally not inferred;
- Anhui University's supplementary 2026-2027 scholarship brochure was acquired and checked, but it delegates major and teaching-language selection to the CSC system instead of publishing a route table, so it does not support filling those values;
- two Wuhan University fee attachments resolve to a CAPTCHA response in the safe collector, but the publicly linked official FEES page independently publishes the required fee matrix. No CAPTCHA or access control was bypassed;
- six official LNUTCM brochure images were registered and hash-pinned. The final image explicitly supplies the long-term Chinese-language tuition used by the enrichment draft;
- the accessible-looking supplementary SCUT PDF endpoint returns HTTP 404, while the two existing official prospectus PDFs exceed the collector's 50 MB safety limit. No alternate or third-party value is substituted;
- the official-source registry now contains 861 structurally valid exact-source entries.

The evidence-gated completeness audit now reports 70 unique schools, 9,497 unique programs, 285 unique scholarships and 9,118 evidence-backed intake rows. Scholarship core-field gaps remain zero. Missing core records fell from 1,034 at the start of the previous completion batch to 295:

| School | Remaining records | Exact unresolved fields | Reason the value remains absent |
| --- | ---: | --- | --- |
| Anhui University | 170 | teaching language | The acquired program and scholarship materials do not publish route-level teaching medium. |
| South China University of Technology | 99 | teaching language and tuition | The registered prospectus files are either over the safe size limit or unavailable at the supplementary endpoint. |
| Beijing Language and Culture University | 25 | teaching language | The available table does not uniquely identify these joint, associate, specialization or same-name bilingual routes. |
| Central China Normal University | 1 school | application level | The required attached guide remains inaccessible to the safe collector. |

The latest read-only local PostgreSQL reconciliation exposes 37 school, 1,145 program and 16 scholarship records with safe draft candidates, plus 150 programs with evidence-backed intake candidates. It reports zero school, program or scholarship candidate conflicts. The active database is unchanged.

Checkpoint verification:

- official registry validation: 861 of 861 entries valid;
- enrichment-script lint: passed;
- catalog migration and import-safety suite: 21 of 21 tests passed;
- official-source and local-publication safety suite: 10 of 10 tests passed;
- production build: passed.

This phase has reached its safe automatic evidence boundary. The remaining 295 records require newly published or operator-supplied official material, or a future review decision; they are not eligible for guessed defaults. All generated artifacts retain `publicationAuthorized: false` and `databaseWriteAuthorized: false`.

### Product-authorized external-blocker deferment

The product owner authorized official-evidence gaps caused by non-publication, CAPTCHA/access controls, inaccessible or oversized attachments, HTTP 404 responses and unresolved official identity ambiguity to be skipped for the current data-completion phase. The exact, fail-closed rules are stored in `catalog-sources/official-completeness-exemptions.json`.

- all 295 known missing-core records remain visible in the coverage report;
- all 295 are classified as `deferred_external_blocker` with a reason code and rule ID;
- `actionableCoreRecords` and `blockingCoreRecords` are both zero;
- each rule declares an expected record count, and the coverage command fails if the live match count changes;
- a new registered official source, a changed official snapshot hash or an operator-supplied accessible official attachment reopens the affected rule for completion;
- deferment does not populate a field, imply verification, authorize publication or permit a database write.

## Final completion audit

The full data-integrity objective is complete at the explicitly requested unreviewed, non-publishable boundary. The final audit regenerates every report from the current local PostgreSQL state and the current hash-pinned evidence corpus; it does not infer completion from the existence of scripts or earlier reports.

### Scope accounting

- all 78 non-local production schools are classified;
- 70 schools have an evidence-gated official school draft;
- eight schools have exact official sources registered but are explicitly deferred because the official endpoint is inaccessible to the safe collector;
- no production school is left without either an official draft or an exact external-source deferment;
- the Shandong University school draft is now counted after a narrow re-acquisition of its already registered official guide image reproduced the exact existing SHA-256 `081e84897e7c51e81e93e691568d95d3703dd016de896162f5852cd6654f23e2`;
- the official draft corpus contains 9,497 unique programs, 285 unique scholarships and 9,118 evidence-backed intake rows.

### Completeness and evidence result

- actionable official-draft core gaps: zero;
- external-blocker-deferred core records: 295;
- schools needing a new exact source registration: zero;
- schools still queued for retrievable-source acquisition: zero;
- externally deferred source sets: eight;
- scholarship core-field gaps in the official draft corpus: zero;
- every deferment is fail-closed: record counts and source-access state must continue to match the explicit rule or report generation fails.

### Relationship and structural result

The live database audit reports zero active programs under an inactive school, zero invalid intake windows, zero scholarship/program school mismatches, zero non-HTTPS active official source URLs and zero open intakes with a past deadline. The 348 program-versus-school city differences remain a classification queue because cross-city campuses can be legitimate; they are not automatically overwritten.

The remaining live-database publication blockers are explicitly listed rather than mutated:

- 827 active records still use prohibited aggregator sources;
- 298 of those have an exact official replacement draft;
- 529 require quarantine until an exact official replacement exists;
- official replacement candidate conflicts: zero;
- 259 possible duplicate-program groups remain an identity-review queue;
- 491 active programs currently have no intake, of which 150 have evidence-backed intake candidates;
- 144 active scholarships have a past deadline and remain in the cycle-renewal queue;
- 3,076 verified or stale programs belong to schools whose verification state is not yet verified or stale and remain a verification-hierarchy remediation queue;
- 275 provider-level scholarship records remain in the provider evidence queue.

### Generated deliverables

- `work/catalog-quality/catalog-data-integrity-audit.json` — read-only live-database completeness and relationship audit;
- `work/catalog-quality/catalog-official-draft-coverage.json` — evidence-gated official draft coverage and exact external-blocker deferments;
- `work/catalog-quality/catalog-data-reconciliation-candidates.draft.json` — conflict-checked school, program, scholarship and intake candidates;
- `work/catalog-quality/catalog-prohibited-source-remediation.draft.json` — exact replacement versus quarantine classification for all prohibited-source records;
- `work/catalog-quality/catalog-data-gap-queue.draft.json` — database remediation, external-source deferment and future-cycle queues;
- `work/catalog-quality/catalog-data-remediation-plan.draft.json` — non-authorizing field/intake operations and consolidated blocker lists;
- `catalog-sources/official-completeness-exemptions.json` — tracked, fail-closed product-authorized deferment rules.

All candidate and plan artifacts remain `unreviewed_draft`, `publicationAuthorized: false` and, where applicable, `databaseWriteAuthorized: false`. No database row, verification state, archive state or public catalog entry was changed by this phase.
