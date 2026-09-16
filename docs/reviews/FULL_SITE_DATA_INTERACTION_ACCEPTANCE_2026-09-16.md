# CUAC Full-Site Data Interaction Acceptance

Date: 2026-09-16
Environment: local Vinext application with persistent local PostgreSQL
Decision: passed for the current release scope

## 1. Scope

This acceptance verifies that released public, student, school, Ops and CUAC Admin surfaces use the expected server data, preserve record identity across projections, and reject access outside the active persona.

Explicitly excluded from this release:

- student application-material submission;
- payment execution or provider settlement;
- enabled Agent product behavior;
- production email, object-storage, WAF and external provider round trips.

The excluded interfaces remain disabled or fail closed and retain their security regression tests.

## 2. Acceptance matrix

| Area | Interaction checked | Expected result |
| --- | --- | --- |
| Runtime | application health and PostgreSQL probe | both healthy |
| Released surfaces | public, student, school and Ops HTML entry points | all served without HTTP failure |
| Public catalog | programs, schools, scholarships, cities and guides | list identity resolves to the same detail identity |
| Search | published program projection and conditional request | catalog identity present; ETag returns 304 |
| Anonymous access | student, school and Ops APIs | denied |
| Cross-role access | student, school and Ops access to another persona | denied |
| Student projection | choices, published programs and school progress | same bounded set of identities |
| School projection | queue and application detail | same tenant-scoped application identity |
| Internal projection | Ops and Admin governed guide registry | same registered guide set |
| Error boundary | malformed UUID and private search type | HTTP 400 without fallback data |
| Student runtime | session, application set, intakes, handoff and catalog page | seven runtime checks pass |
| Search performance | six reviewed cases, 18 concurrent requests | local P95 below 500 ms |
| Full regression | backend, frontend, policy and disabled-feature boundaries | unified test gate passes |

## 3. Executed evidence

- `npm run test:backend` — passed after adding search and guide governance suites to the unified gate.
- `npm run test:frontend-contracts` — 56/56 passed.
- `npm run local:smoke` — passed across student, school, Ops and Admin step-up roles using synthetic local data.
- `npm run qa:student-runtime` — 7/7 passed; first catalog page observed at 71 ms after warm-up.
- `npm run search:acceptance` — 18 requests, concurrency 4, P95 89 ms, conditional status 304.
- `npm run qa:data-interactions` — all full-site interaction checks passed.
- `node --test tests/server/db/migration-release.test.mjs` — 3/3 passed, including reproducible bytes and tamper rejection.

## 4. Issues found and resolved during acceptance

1. The student runtime QA still looked for an obsolete progressive-hydration comment. The product already used bounded server-side pagination; the test now verifies the real `limit` and `offset` behavior.
2. Search acceptance defaulted to a stale fixed port. It now discovers the active local application port from the owned runtime state while preserving the explicit staging/production URL override.
3. The migration release test had no approved npm offline-cache entries. Exact versions already pinned by `package-lock.json` were cached; the reproducible offline release test then passed.
4. The unified backend gate did not invoke search and guide governance suites. Both are now included.
5. Concurrent cold-start test processes exceeded the local Vinext development timeout and triggered authentication burst limits. Acceptance now warms the runtime and performs persona logins sequentially; production behavior remains covered by build and service tests.

## 5. Remaining release boundary

No current-scope data interaction blocker remains in the local environment. Staging acceptance is still required for infrastructure-specific behavior: shared public-search rate limiting/WAF, TLS PostgreSQL, email delivery and any future provider activation. Payment execution, student material submission and Agent enablement require separate product approval and acceptance plans.
