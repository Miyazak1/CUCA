import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

function loadCuacDataContext(source) {
  const localStorageItems = new Map();
  const localStorage = {
    getItem(key) {
      return localStorageItems.has(key) ? localStorageItems.get(key) : null;
    },
    setItem(key, value) {
      localStorageItems.set(key, String(value));
    },
    removeItem(key) {
      localStorageItems.delete(key);
    },
  };
  const context = {
    window: {},
    localStorage,
    console,
  };
  vm.runInNewContext(source, context, { filename: "cuac-data.js" });
  return { ...context, localStorage };
}

function loadCuacDataClient(source) {
  return loadCuacDataContext(source).window.CuacDataClient;
}

function parseTypeFields(source, typeName) {
  const match = source.match(new RegExp(`export type ${typeName} = (?:[A-Za-z_][A-Za-z0-9_]*\\s*&\\s*)?\\{([\\s\\S]*?)\\n\\};`));
  assert.ok(match, `CSCAlite type ${typeName} should exist`);
  return [...match[1].matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\??:/gm)].map((item) => item[1]);
}

function parseLocalTypeFields(source, typeName) {
  const match = source.match(new RegExp(`(?:export\\s+)?type ${typeName} = (?:[A-Za-z_][A-Za-z0-9_]*\\s*&\\s*)?\\{([\\s\\S]*?)\\n\\};`));
  assert.ok(match, `CSCAlite local type ${typeName} should exist`);
  return [...match[1].matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\??:/gm)].map((item) => item[1]);
}

function parseSourceModelFields(source, modelName) {
  const match = source.match(new RegExp(`(^|\\n)\\s*${modelName}: \\[([\\s\\S]*?)\\n\\s*\\]`, "m"));
  assert.ok(match, `CUAC sourceModelFields.${modelName} should exist`);
  return [...match[2].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

const deprecatedCscaliteFieldsByModel = {
  AdminUser: new Set(["aiBalanceUnits", "aiLifetimeGranted", "aiLifetimeUsed"]),
};

function assertCscaliteTypeCoverage(cscaliteTypes, cuacData, pairs) {
  pairs.forEach(([modelName, typeName]) => {
    const cscaliteFields = parseTypeFields(cscaliteTypes, typeName);
    const cuacFields = parseSourceModelFields(cuacData, modelName);
    const deprecatedFields = deprecatedCscaliteFieldsByModel[modelName] || new Set();
    const missingFields = cscaliteFields.filter((field) => !cuacFields.includes(field) && !deprecatedFields.has(field));
    assert.deepEqual(missingFields, [], `${modelName} sourceModelFields should cover CSCAlite ${typeName} fields`);
  });
}

function assertCscaliteLocalTypeCoverage(cscaliteTypes, cuacData, pairs) {
  pairs.forEach(([modelName, typeName]) => {
    const cscaliteFields = parseLocalTypeFields(cscaliteTypes, typeName);
    const cuacFields = parseSourceModelFields(cuacData, modelName);
    const missingFields = cscaliteFields.filter((field) => !cuacFields.includes(field));
    assert.deepEqual(missingFields, [], `${modelName} sourceModelFields should cover CSCAlite local ${typeName} fields`);
  });
}

test("server redirects the root route to the CUAC static demo home", async () => {
  const response = await render();
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "/home-v3.html");
});

test("catalog detail pages use published API contracts without demo field synthesis", async () => {
  const [detailJs, detailCss, contract, ...pages] = await Promise.all([
    readFile(new URL("../public/catalog-detail.js", import.meta.url), "utf8"),
    readFile(new URL("../public/catalog-detail.css", import.meta.url), "utf8"),
    readFile(new URL("../../CUAC_CATALOG_DETAIL_PAGE_DATA_CONTRACT.md", import.meta.url), "utf8"),
    ...["program-detail.html", "university-detail.html", "scholarship-detail.html", "city-detail.html"]
      .map((file) => readFile(new URL(`../public/${file}`, import.meta.url), "utf8")),
  ]);

  assert.match(detailJs, /fetch\(path, \{ headers: \{ accept: "application\/json" \} \}\)/);
  assert.match(detailJs, /\/api\/v1\/catalog\/programs\/\$\{encodeURIComponent\(record\.id\)\}\/intakes/);
  assert.match(detailJs, /No current, approved requirement document is published/);
  assert.match(detailJs, /Counts are imported reference snapshots/);
  assert.match(detailJs, /This link points to a demo or unpublished record/);
  assert.doesNotMatch(detailJs, /getCompletionDetail|CuacDataClient|actualSchoolCount|actualProgramCount|contactInfo|qualityScore|missingFields|fitNotes/);
  assert.match(detailCss, /body\[data-catalog-detail-page\] \.cuac-agent-composer/);
  assert.match(detailCss, /@media \(max-width: 560px\)/);
  assert.match(detailCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(contract, /must not infer missing facts/);
  assert.match(contract, /Existing `actual\*` aliases are retained temporarily for compatibility but are not authoritative live aggregates/);
  assert.match(contract, /`contactInfo` is not public/);

  pages.forEach((html) => {
    assert.match(html, /href="catalog-detail\.css"/);
    assert.match(html, /src="catalog-detail\.js"/);
    assert.doesNotMatch(html, /src="completion\.js/);
  });
});

test("keeps design-lab and published static demo files in sync", async () => {
  const publicFiles = await readdir(new URL("../public/", import.meta.url));
  const staticDemoFiles = publicFiles.filter((file) => /\.(html|css|js|md)$/.test(file));

  await Promise.all(
    staticDemoFiles.map(async (file) => {
      const [publicContent, designContent] = await Promise.all([
        readFile(new URL(`../public/${file}`, import.meta.url), "utf8"),
        readFile(new URL(`../../design-lab/${file}`, import.meta.url), "utf8"),
      ]);
      assert.equal(publicContent, designContent, `${file} differs between design-lab and frontend/public`);
    }),
  );
});

test("keeps official demo pages mounted on the shared shell", async () => {
  const [readme, scorecard, acceptance] = await Promise.all([
    readFile(new URL("../public/README.md", import.meta.url), "utf8"),
    readFile(new URL("../public/DESIGN_REVIEW_SCORECARD.md", import.meta.url), "utf8"),
    readFile(new URL("../public/FRONTEND_STAGE_ACCEPTANCE.md", import.meta.url), "utf8"),
  ]);
  const sharedShellPages = {
    "application.html": "CUAC | Application basket",
    "auth.html": "CUAC | Sign in or create account",
    "billing.html": "CUAC | Billing and receipt",
    "cities.html": "CUAC | Cities",
    "city-detail.html": "CUAC | City details",
    "favourites.html": "CUAC | Favourites",
    "guide-detail.html": "CUAC | Guide",
    "guides.html": "CUAC | Application guides",
    "home-v3.html": "CUAC | Study in China",
    "hub.html": "CUAC | Student Hub",
    "notifications.html": "CUAC | Notifications",
    "onboarding.html": "CUAC | Account setup",
    "ops-admin.html": "CUAC | 运营管理后台",
    "preferences.html": "CUAC | Preferences",
    "program-detail.html": "CUAC | Program details",
    "programs.html": "CUAC | Programs",
    "scholarship-detail.html": "CUAC | Scholarship details",
    "scholarships.html": "CUAC | Scholarships",
    "school-settings.html": "CUAC | 学校设置",
    "school-portal.html": "CUAC | 学校招生工作台",
    "university-detail.html": "CUAC | University details",
    "universities.html": "CUAC | Universities",
  };
  const catalogListPages = new Set(["programs.html", "universities.html", "scholarships.html", "cities.html"]);
  const catalogDetailPages = new Set(["program-detail.html", "university-detail.html", "scholarship-detail.html", "city-detail.html"]);
  assert.match(readme, /## Current Official Demo Routes/);
  assert.match(readme, /`home-v3\.html`: public homepage and root redirect target/);
  assert.match(readme, /`school-portal\.html`, `school-settings\.html`: school admissions workspace and tenant settings/);
  assert.match(readme, /## Archived Reference Only/);
  assert.match(readme, /Do not treat archived pages as current UX evidence/);
  assert.match(readme, /Do not publish or deploy unless explicitly requested/);
  assert.match(readme, /FRONTEND_STAGE_ACCEPTANCE\.md/);
  assert.match(scorecard, /Current Review - 2026-08-22/);
  assert.match(scorecard, /Average score: 4\.1/);
  assert.match(scorecard, /Ready to start backend handoff tickets\? Yes, if stakeholder visual review accepts the current look/);
  assert.match(scorecard, /Archived `index\.html` and `home-v5\.html` are not current UX evidence/);
  assert.match(acceptance, /CUAC Frontend Stage Acceptance/);
  assert.match(acceptance, /Review only the current official demo routes listed in `README\.md`/);
  assert.match(acceptance, /Do not use `index\.html` or `home-v5\.html` as acceptance evidence/);
  assert.match(acceptance, /Manual Review Runbook/);
  assert.match(acceptance, /Open `home-v3\.html` on desktop and mobile/);
  assert.match(acceptance, /Open `programs\.html`, `universities\.html`, `scholarships\.html`, and `cities\.html`/);
  assert.match(acceptance, /Open `application\.html`/);
  assert.match(acceptance, /Open `school-portal\.html` and `school-settings\.html`/);
  assert.match(acceptance, /Open the Agent panel on at least one public page, one student page, one school page, and one Ops page/);
  assert.match(acceptance, /Record any rejection as a targeted frontend polish item/);
  assert.match(acceptance, /`npm\.cmd test -- --runInBand`: passed 12\/12/);
  assert.match(acceptance, /`npm\.cmd run qa:flows`: passed/);
  assert.match(acceptance, /`npm\.cmd run qa:layout`: passed/);
  assert.match(acceptance, /close the frontend-only demo stage/);
  assert.match(acceptance, /Do not implement a real database, backend API, auth provider, payment provider, file upload service, university integration, production Agent service, or deployment in this stage/);

  await Promise.all(
    Object.entries(sharedShellPages).map(async ([file, title]) => {
      const html = await readFile(new URL(`../public/${file}`, import.meta.url), "utf8");
      assert.match(html, new RegExp(`<title>${title.replace(/[|]/g, "\\|")}</title>`), `${file} has an internal or outdated browser title`);
      assert.match(html, /href="shared-shell\.css"/, `${file} is missing shared shell CSS`);
      assert.match(html, /data-cuac-header/, `${file} is missing shared header mount`);
      assert.match(html, /data-cuac-footer/, `${file} is missing shared footer mount`);
      if (catalogListPages.has(file)) {
        assert.doesNotMatch(html, /src="cuac-data\.js"/, `${file} must not load the demo data client`);
        assert.match(html, /src="shared-shell\.js"[\s\S]*src="catalog-list-api\.js"/, `${file} must load the published catalog list client`);
      } else if (catalogDetailPages.has(file)) {
        assert.match(html, /src="shared-shell\.js"[\s\S]*src="catalog-detail\.js"/, `${file} must load the published catalog detail client`);
      } else {
        assert.match(html, /src="cuac-data\.js"[\s\S]*src="cuac-actions\.js"[\s\S]*src="shared-shell\.js"/, `${file} must load data and action contracts before the shared shell`);
      }
      assert.match(html, /src="shared-shell\.js"/, `${file} is missing shared shell JS`);
      if (file === "ops-admin.html") {
        assert.match(html, /href="completion\.css\?v=20260826-ops-route-sync-v11"/, "ops-admin.html must bust stale completion.css after ops route sync updates");
        assert.match(html, /src="completion\.js\?v=20260826-ops-route-sync-v11"/, "ops-admin.html must bust stale completion.js after ops route sync updates");
      }
      assert.doesNotMatch(html, /<title>CUAC (Home v\d|Agent Application Workspace|School Portal|Ops Admin|Program Detail|University Detail|Scholarship Detail|City Detail|Guide Detail)<\/title>/, `${file} title should not expose internal route names`);
    }),
  );
});

test("keeps the school portal product spec explicit and published", async () => {
  const [readme, spec] = await Promise.all([
    readFile(new URL("../public/README.md", import.meta.url), "utf8"),
    readFile(new URL("../public/SCHOOL_PORTAL_PRODUCT_SPEC.md", import.meta.url), "utf8"),
  ]);

  assert.match(readme, /SCHOOL_PORTAL_PRODUCT_SPEC\.md/);
  assert.match(spec, /school-facing admissions workspace/);
  assert.match(spec, /one unified registration and sign-in system/);
  assert.match(spec, /Tenant Scope Rules/);
  assert.match(spec, /Other schools' program choices/);
  assert.match(spec, /CUAC does not collect official files from students/);
  assert.match(spec, /Dashboard And Analytics/);
  assert.match(spec, /Official detail status/);
  assert.match(spec, /payment or free-school entitlement is complete/);
  assert.match(spec, /failed payment keeps the student's choices saved but must not create school-visible records/);
  assert.match(spec, /Loading states for charts before fixture or API counts render/);
  assert.match(spec, /Current automated coverage/);
  assert.match(spec, /School Agent mode can/);
  assert.match(spec, /School Agent mode cannot/);
  assert.match(spec, /Every API must verify `tenantId` server-side/);
  assert.match(spec, /Application routing service that writes one record per selected school/);
});

test("keeps the frontend completion routes explicit and connected", async () => {
  const [
    audit,
    cuacData,
    completionJs,
    completionCss,
    programDetail,
    universityDetail,
    scholarshipDetail,
    cityDetail,
    guideDetail,
    billing,
    schoolSettings,
    opsAdmin,
    programsJs,
    universitiesJs,
    scholarships,
    scholarshipsJs,
    cities,
    citiesJs,
    guides,
    guidesJs,
    guidesCss,
    application,
    schoolPortal,
    preferences,
    sharedJs,
    productionIndex,
    agentArchitecture,
  ] = await Promise.all([
    readFile(new URL("../../CUAC_FRONTEND_COMPLETION_AUDIT.md", import.meta.url), "utf8"),
    readFile(new URL("../public/cuac-data.js", import.meta.url), "utf8"),
    readFile(new URL("../public/completion.js", import.meta.url), "utf8"),
    readFile(new URL("../public/completion.css", import.meta.url), "utf8"),
    readFile(new URL("../public/program-detail.html", import.meta.url), "utf8"),
    readFile(new URL("../public/university-detail.html", import.meta.url), "utf8"),
    readFile(new URL("../public/scholarship-detail.html", import.meta.url), "utf8"),
    readFile(new URL("../public/city-detail.html", import.meta.url), "utf8"),
    readFile(new URL("../public/guide-detail.html", import.meta.url), "utf8"),
    readFile(new URL("../public/billing.html", import.meta.url), "utf8"),
    readFile(new URL("../public/school-settings.html", import.meta.url), "utf8"),
    readFile(new URL("../public/ops-admin.html", import.meta.url), "utf8"),
    readFile(new URL("../public/programs.js", import.meta.url), "utf8"),
    readFile(new URL("../public/universities.js", import.meta.url), "utf8"),
    readFile(new URL("../public/scholarships.html", import.meta.url), "utf8"),
    readFile(new URL("../public/scholarships.js", import.meta.url), "utf8"),
    readFile(new URL("../public/cities.html", import.meta.url), "utf8"),
    readFile(new URL("../public/cities.js", import.meta.url), "utf8"),
    readFile(new URL("../public/guides.html", import.meta.url), "utf8"),
    readFile(new URL("../public/guides.js", import.meta.url), "utf8"),
    readFile(new URL("../public/guides.css", import.meta.url), "utf8"),
    readFile(new URL("../public/application.html", import.meta.url), "utf8"),
    readFile(new URL("../public/school-portal.html", import.meta.url), "utf8"),
    readFile(new URL("../public/preferences.html", import.meta.url), "utf8"),
    readFile(new URL("../public/shared-shell.js", import.meta.url), "utf8"),
    readFile(new URL("../../CUAC_PRODUCTION_DESIGN_INDEX.md", import.meta.url), "utf8"),
    readFile(new URL("../../CUAC_AGENT_ACTION_ARCHITECTURE.md", import.meta.url), "utf8"),
  ]);

  assert.match(audit, /Program detail/);
  assert.match(audit, /Billing/);
  assert.match(audit, /School settings/);
  assert.match(audit, /Ops admin/);
  assert.match(audit, /P0/);
  assert.match(audit, /completion\/detail pages: Program detail, University detail, Scholarship detail, City detail, Guide detail, Billing, School settings, Ops admin/);
  assert.match(audit, /`auth\.html` sign-in continuation for protected save\/application actions/);
  assert.match(audit, /auth page -> continued navigation/);
  assert.match(audit, /shared Agent prompt handling now attaches structured context/);
  assert.match(audit, /application fee CTA now opens payment review before send and switches to a sent-status CTA/);
  assert.match(audit, /Next Stage Delivery Map/);
  assert.match(audit, /Student Core Chain/);
  assert.match(audit, /School Teacher Chain/);
  assert.match(audit, /CUAC Ops And Analytics Chain/);
  assert.match(audit, /Agent And Natural-Language Operations Chain/);
  assert.match(audit, /Design-System Cleanup Chain/);
  assert.match(audit, /A student can discover routes, inspect CSCAlite-backed details, save\/compare, sign in or register through unified Auth/);
  assert.match(audit, /send records only after payment\/free entitlement/);
  assert.match(audit, /school staff user sees only their own school's CUAC records/);
  assert.match(audit, /evaluate Alibaba PageAgent or a similar DOM-operation layer/);
  assert.match(audit, /CuacDataClient\.getBackendAdapterContract\(\)/);
  assert.match(audit, /student value only on public pages, operational quality metadata only in internal\/school contexts/);
  assert.match(audit, /Program, University, Scholarship, and City cards use a unified primary\/secondary action pattern/);
  assert.match(audit, /current stage remains frontend-only: backend, database, real auth, real payment, file upload, university integration, and production Agent service are documented but not implemented here/);
  assert.match(audit, /Current Stage Acceptance Boundary/);
  assert.match(audit, /static frontend demo can be used as the product blueprint for backend implementation/);
  assert.match(audit, /Backend implementation begins only after those frontend contracts are proven/);
  assert.match(audit, /static tests, browser-flow QA, and layout QA cover the above frontend contracts/);
  assert.match(audit, /Stage Cutoff Checklist/);
  assert.match(audit, /Use this checklist to decide whether the current frontend-demo goal can stop and backend tickets can begin/);
  assert.match(audit, /A backend task should not start simply because a database, API, permission, security, payment, or Agent architecture document exists/);
  assert.match(audit, /The frontend-demo stage is ready to close only when all of these are true/);
  assert.match(audit, /Stop the frontend-demo stage at that point/);
  assert.match(audit, /auth\/session, catalog APIs, application\/payment handoff, tenant permissions, notifications, analytics, and Agent action execution/);
  assert.match(audit, /Frontend-Only Cutoff Ledger/);
  assert.match(audit, /Use this ledger as the practical answer to "when does this goal stop\?"/);
  assert.match(audit, /It does not stop because backend documents exist, and it must not grow into real backend implementation/);
  assert.match(audit, /Current Demo Route Scope/);
  assert.match(audit, /The cutoff decision should evaluate only the current official demo routes listed in `README\.md`/);
  assert.match(audit, /Archived exploration pages such as `index\.html` and `home-v5\.html` are reference material only/);
  assert.match(audit, /They are not current UX evidence, must not be linked from current flows/);
  assert.match(audit, /Public catalog and details/);
  assert.match(audit, /Student application loop/);
  assert.match(audit, /School teacher loop/);
  assert.match(audit, /Agent context and operations/);
  assert.match(audit, /Current Evidence Snapshot - 2026-08-22/);
  assert.match(audit, /`npm\.cmd test -- --runInBand` passed 12\/12 static tests/);
  assert.match(audit, /`npm\.cmd run qa:flows` passed the core browser flow suite/);
  assert.match(audit, /`npm\.cmd run qa:layout` passed desktop\/mobile layout QA/);
  assert.match(audit, /`DESIGN_REVIEW_SCORECARD\.md` records the current official demo review at 4\.1 average/);
  assert.match(audit, /This snapshot is frontend evidence, not backend completion/);
  assert.match(audit, /Current closure decision: automated frontend evidence is sufficient for backend handoff ticket preparation/);
  assert.match(audit, /goal should remain open until stakeholder visual review accepts the current look/);
  assert.match(audit, /If any ledger row lacks current evidence, continue frontend demo work in that row/);
  assert.match(productionIndex, /Current Frontend Demo Status/);
  assert.match(productionIndex, /Current Stage Exit Boundary/);
  assert.match(productionIndex, /This current stage ends when the frontend demo is coherent enough to guide production build decisions, not when a backend is implemented/);
  assert.match(productionIndex, /Out of scope for this stage/);
  assert.match(productionIndex, /implementing a real database, backend API, auth provider, payment provider, file upload service, university integration, or production Agent service/);
  assert.match(productionIndex, /publishing or deploying the site unless explicitly requested/);
  assert.match(productionIndex, /Exit evidence for this frontend stage/);
  assert.match(productionIndex, /application payment is represented as a frontend simulation gate/);
  assert.match(productionIndex, /school staff workspaces stay locked to one school tenant/);
  assert.match(productionIndex, /tests and QA prove the frontend contracts before backend tickets start/);
  assert.match(productionIndex, /sign-in continuation/);
  assert.match(productionIndex, /protected student actions must redirect to the unified auth page and continue the original action only after sign-in/);
  assert.match(productionIndex, /Agent prompt invocations now carry route, role, surface, retention policy, entity ID, and source model context/);
  assert.match(productionIndex, /application payment\/send buttons must represent the true state/);
  assert.match(productionIndex, /Practical cutoff rule/);
  assert.match(productionIndex, /continue frontend work while the public catalog, student application chain, school teacher chain, Agent context chain, or visual system still has obvious missing or inconsistent demo behavior/);
  assert.match(productionIndex, /stop frontend-only expansion when those chains are demonstrable end to end and covered by static, browser-flow, and layout QA/);
  assert.match(productionIndex, /then create backend tickets from the proven contracts instead of adding more static screens/);
  assert.match(productionIndex, /Recommended Immediate Work/);
  const productizationSpec = await readFile(new URL("../../CUAC_FRONTEND_PRODUCTIZATION_SPEC.md", import.meta.url), "utf8");
  assert.match(productizationSpec, /Finish the current frontend-only stage before backend implementation/);
  assert.match(productizationSpec, /do not implement a real database, backend API, auth provider, payment provider, file upload service, university integration, or production Agent service/);
  assert.match(productizationSpec, /use the `Frontend-Only Cutoff Ledger` in `CUAC_FRONTEND_COMPLETION_AUDIT\.md`/);
  assert.match(productizationSpec, /If all rows have current static, browser-flow, layout, and visual evidence, stop adding static frontend scope/);
  assert.match(agentArchitecture, /Frontend Demo Registry Status/);
  assert.match(agentArchitecture, /Frontend Demo Context Binding Status/);
  assert.match(agentArchitecture, /data-agent-entity-type/);
  assert.match(agentArchitecture, /cuac:agent-action\.detail/);
  assert.match(agentArchitecture, /backend authorization, tenant policy, and source retrieval must re-resolve them server-side/);
  assert.match(agentArchitecture, /redirects to `auth\.html`/);

  for (const html of [guideDetail, billing, schoolSettings, opsAdmin]) {
    assert.match(html, /href="completion\.css(?:\?[^"]*)?"/);
    assert.match(html, /src="completion\.js(?:\?[^"]*)?"/);
    assert.match(html, /data-cuac-header/);
    assert.match(html, /data-cuac-footer/);
    assert.match(html, /data-completion-page="/);
  }

  for (const html of [programDetail, universityDetail, scholarshipDetail, cityDetail]) {
    assert.match(html, /href="catalog-detail\.css"/);
    assert.match(html, /src="catalog-detail\.js"/);
    assert.match(html, /data-cuac-header/);
    assert.match(html, /data-cuac-footer/);
    assert.match(html, /data-catalog-detail-page="/);
    assert.doesNotMatch(html, /src="completion\.js/);
  }

  assert.match(completionCss, /\.detail-hero/);
  assert.match(completionCss, /\.university-detail-hero/);
  assert.match(completionCss, /\.university-glance-band/);
  assert.match(completionCss, /\.university-decision-card/);
  assert.match(completionCss, /\.profile-section-list/);
  assert.match(completionCss, /\.profile-card-intro/);
  assert.match(completionCss, /\.profile-section-head/);
  assert.match(completionCss, /\.profile-section-disclosure/);
  assert.match(completionCss, /\.profile-row-list/);
  assert.match(completionCss, /\.decision-panel-grid/);
  assert.match(completionCss, /\.decision-panel/);
  assert.match(completionCss, /\.side-progress-track/);
  assert.match(completionCss, /\.side-snapshot/);
  assert.match(completionCss, /\.side-actions/);
  assert.match(completionCss, /\.program-side-action-grid/);
  assert.match(completionCss, /\.program-side-action\.primary/);
  assert.match(completionCss, /grid-template-columns: auto auto 1fr/);
  assert.match(completionCss, /height: 3px;[\s\S]*background: linear-gradient\(90deg, #007d76, #0e9c8f\)/);
  assert.match(completionCss, /\.side-snapshot article\s*\{[\s\S]*grid-template-columns: 1fr/);
  assert.match(completionCss, /text-overflow: ellipsis/);
  assert.match(completionCss, /\.timeline-phase/);
  assert.match(completionCss, /\.detail-toast/);
  assert.match(completionCss, /\.state-panel/);
  assert.match(completionCss, /\.state-skeleton/);
  assert.match(completionCss, /@keyframes completionPulse/);
  assert.match(completionCss, /\.city-section-nav/);
  assert.match(completionCss, /\.detail-section-nav/);
  assert.match(completionCss, /\.detail-section-nav,\s*\n\.city-section-nav\s*\{[^}]*position: static/);
  assert.doesNotMatch(completionCss, /\.detail-section-nav,\s*\n\.city-section-nav\s*\{[^}]*position: sticky/);
  assert.match(completionCss, /scroll-margin-top: 82px/);
  assert.match(completionJs, /function renderDetailPage/);
  assert.match(completionJs, /function readableCountLabel\(count, singular = "check", plural = "checks"\)/);
  assert.match(completionJs, /readableCountLabel\(totalRows, "item", "items"\)/);
  assert.doesNotMatch(completionJs, /sections\} sections · \$\{escapeHtml\(totalRows\)\} fields|rows\.length\)} items/);
  assert.match(completionJs, /function renderUniversityDetailPage\(data\)/);
  assert.match(completionJs, /const deadline = detailFactValue\(data, "Next deadline", "Confirm"\)/);
  assert.match(completionJs, /const tuition = detailFactValue\(data, "Tuition", data\.metrics\?\.\[3\]\?\.\[0\] \|\| "Confirm"\)/);
  assert.doesNotMatch(completionJs, /const deadline = detailFactValue\(data, "Next deadline", data\.metrics\?\.\[3\]/);
  assert.match(completionJs, /View program/);
  assert.match(completionJs, /View funding/);
  assert.match(completionJs, /function renderProgramDetailPage\(data\)/);
  assert.match(completionJs, /function renderCityDetailPage\(data\)/);
  assert.match(completionJs, /function renderCityGlance\(guide = \{\}\)/);
  assert.match(completionJs, /renderCityAggregateCards\(guide\.aggregateCards \|\| \[\]\)/);
  assert.match(completionJs, /Options to compare from this city/);
  assert.match(completionJs, /Use these counts as a quick route check/);
  assert.match(completionJs, /card\.href \? `<a href="\$\{escapeHtml\(card\.href\)\}">/);
  assert.match(completionJs, /Decision snapshot/);
  assert.match(completionJs, /Use the city as a planning filter/);
  assert.match(completionJs, /City decision summary/);
  assert.match(completionJs, /fieldValue\("Monthly cost", "Pending"\)/);
  assert.match(completionJs, /function renderCitySectionNav\(\)/);
  assert.match(completionJs, /function renderDetailSectionNav\(sections = \[\], label = "Detail sections"/);
  assert.match(completionJs, /renderDetailSectionNav\(sections, "City guide sections", "city-section-nav"\)/);
  assert.match(completionJs, /#city-schools/);
  assert.match(completionJs, /#city-funding/);
  assert.match(completionJs, /function renderCityRelatedList\(items = \[\]/);
  assert.match(completionJs, /function renderCitySchoolCards\(items = \[\]/);
  assert.match(completionJs, /function renderCityProgramCards\(items = \[\]/);
  assert.match(completionJs, /function renderCityScholarshipCards\(items = \[\]/);
  assert.match(completionCss, /\.city-school-list/);
  assert.match(completionCss, /\.city-program-card/);
  assert.match(completionCss, /\.city-scholarship-card/);
  assert.match(completionCss, /\.city-aggregate-panel/);
  assert.match(completionCss, /\.city-aggregate-grid/);
  assert.match(completionCss, /\.city-aggregate-grid a/);
  assert.match(completionJs, /function renderScholarshipDetailPage\(data\)/);
  assert.match(completionJs, /function splitScholarshipOfficialNotice/);
  assert.match(completionJs, /function renderScholarshipOfficialNotice/);
  assert.match(completionCss, /\.scholarship-official-reader/);
  assert.match(cuacData, /officialNoticeSections: splitScholarshipOfficialNotice\(item\.requirementText \|\| ""\)/);
  assert.match(completionJs, /function renderFundingCards\(items = \[\]/);
  assert.match(completionJs, /program-glance-band/);
  assert.match(completionJs, /city-glance-band/);
  assert.match(completionJs, /funding-glance-band/);
  assert.match(completionJs, /if \(mode === "program" && data\.programGuide\)/);
  assert.match(completionJs, /if \(mode === "city" && data\.cityGuide\)/);
  assert.match(completionJs, /if \(mode === "scholarship" && data\.scholarshipGuide\)/);
  assert.match(completionJs, /if \(mode === "university" && data\.entityType === "School"\)/);
  assert.match(completionJs, /University decision snapshot/);
  assert.match(completionJs, /Decision snapshot/);
  assert.match(completionJs, /Before you choose this university/);
  assert.match(completionJs, /Before you add this program/);
  assert.match(completionJs, /program-side-action-grid/);
  assert.match(completionJs, /Add exact choice/);
  assert.match(completionJs, /Official program check/);
  assert.match(completionJs, /CUAC application handoff/);
  assert.match(completionJs, /What happens after you add it/);
  assert.match(completionJs, /Monthly living cost reference/);
  assert.match(completionJs, /Use the city as a planning filter/);
  assert.match(completionJs, /Universities students can compare here/);
  assert.match(completionJs, /Programs students can actually compare/);
  assert.match(completionJs, /Scholarship routes in this city/);
  assert.match(completionJs, /Funding should be checked together with the school and program/);
  assert.match(completionJs, /City schools/);
  assert.match(completionJs, /Related programs/);
  assert.match(completionJs, /cityTextListItems\(guide\.applicationTips \|\| checklist \|\| \[\], 3\)/);
  assert.match(completionJs, /City scholarships/);
  assert.match(completionJs, /Before you rely on this scholarship/);
  assert.match(completionJs, /Turn the city choice into specific programs/);
  assert.match(completionJs, /Use city fit as a tie-breaker/);
  assert.match(completionJs, /city-side-summary/);
  assert.match(completionJs, /city-side-action-grid/);
  assert.match(completionJs, /Filter this city schools/);
  assert.match(completionJs, /English programs/);
  assert.match(completionJs, /guides\.html#timeline/);
  assert.match(completionJs, /city-side-tip-list/);
  assert.doesNotMatch(completionJs, /City route actions/);
  assert.match(completionJs, /Route actions/);
  assert.match(completionJs, /What happens next/);
  assert.match(completionCss, /\.city-related-columns[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(completionCss, /\.city-side-summary/);
  assert.match(completionCss, /\.city-side-action-grid/);
  assert.match(completionCss, /\.city-side-tip-list/);
  assert.match(completionCss, /\.university-program-row/);
  assert.match(completionCss, /\.university-program-facts/);
  assert.match(completionCss, /@media \(max-width: 1100px\)[\s\S]*\.city-related-columns[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(completionCss, /@media \(max-width: 620px\)[\s\S]*\.city-related-columns[\s\S]*grid-template-columns: 1fr/);
  assert.match(completionJs, /function renderProfileSections/);
  assert.match(completionJs, /function renderProfileSection\(section = \{\}, index = 0\)/);
  assert.match(completionJs, /profile-section-disclosure/);
  assert.match(completionJs, /Key facts are grouped by eligibility, cost, timing, and next steps/);
  assert.match(completionJs, /function renderSideSnapshot/);
  assert.match(completionJs, /function renderDecisionPanels/);
  assert.match(completionJs, /function renderTimelineItems/);
  assert.match(completionJs, /timeline-phase/);
  assert.match(completionJs, /function renderDetailMetrics/);
  assert.match(completionJs, /function renderSnapshot/);
  assert.match(completionJs, /function updateChecklistProgress/);
  assert.match(completionJs, /data-check-progress/);
  assert.match(completionJs, /data-check-meter/);
  assert.match(completionJs, /meter\.style\.width = `\$\{percent\}%`/);
  assert.match(completionJs, /Decision summary/);
  assert.match(completionJs, /Decision guide/);
  assert.match(completionJs, /readableCountLabel\(totalRows, "item", "items"\)/);
  assert.match(completionJs, /detailFactValue\(data, "Chinese name", "Not listed"\)/);
  assert.doesNotMatch(completionJs, /detailFactValue\(data, "Chinese name", data\.title\)/);
  assert.match(completionJs, /data\.hideSnapshot/);
  assert.match(completionJs, /data\.profileTitle \|\| "Information that affects your choice"/);
  assert.match(completionJs, /detailSourceFieldCount/);
  assert.match(completionJs, /target\.dataset\.detailEntityType = data\.entityType \|\| mode \|\| "detail"/);
  assert.match(completionJs, /target\.dataset\.detailEntityId = data\.entityId \|\| data\.programId \|\| data\.schoolId \|\| data\.title \|\| ""/);
  assert.match(completionJs, /target\.dataset\.detailSourceModel = data\.sourceFieldLineage\?\.sourceModel/);
  assert.match(completionJs, /function renderCompletionLoading/);
  assert.match(completionJs, /function renderCompletionEmpty/);
  assert.match(completionJs, /function renderCompletionError/);
  assert.match(completionJs, /data-completion-state="loading"/);
  assert.match(completionJs, /data-completion-state="empty"/);
  assert.match(completionJs, /data-completion-state="error"/);
  assert.match(completionJs, /function renderBillingPage/);
  assert.match(completionJs, /function renderSchoolSettingsPage/);
  assert.match(completionJs, /function renderOpsPage/);
  assert.match(completionJs, /function fallbackDetail/);
  assert.match(completionJs, /function saveCurrentDetail/);
  assert.match(completionJs, /dataClient\?\.addSavedDetailItem/);
  assert.match(completionJs, /applicationChoice: entityType === "Program"/);
  assert.match(completionJs, /sourceFieldLineage: item\.sourceFieldLineage/);
  assert.match(completionJs, /if \(!detailModes\.includes\(mode\) \|\| !currentDetailData\)/);
  assert.match(completionJs, /data-save-detail/);
  assert.match(completionJs, /data-school-settings-save/);
  assert.match(completionJs, /data-owner-routing/);
  assert.match(completionJs, /data-school-template/);
  assert.match(completionJs, /cuacSchoolSettingsDemoState/);
  assert.match(completionJs, /data-ops-action/);
  assert.match(completionJs, /data-ops-tab/);
  assert.match(completionJs, /data-ops-section/);
  assert.match(completionJs, /function switchOpsSection/);
  assert.doesNotMatch(completionJs, /data-ops-section="analytics"/);
  assert.doesNotMatch(completionJs, /\["analytics", "Analytics"\]/);
  assert.match(completionJs, /cuacOpsAdminDemoState/);
  assert.match(completionJs, /学校数据管理/);
  assert.match(completionJs, /批量 JSON 导入/);
  assert.match(completionJs, /function createOpsSchoolImportExample/);
  assert.match(completionJs, /function renderOpsSchoolCreatePanel/);
  assert.match(completionJs, /data-ops-school-create-toggle/);
  assert.match(completionJs, /data-ops-school-create-field="nameZh"/);
  assert.match(completionJs, /至少需要中文名；创建后继续在右侧补齐申请要求、项目、奖学金和来源信息/);
  assert.doesNotMatch(completionJs, /<small>AdminSchoolCreateInput\.nameZh<\/small>/);
  assert.match(completionJs, /function readOpsSchoolCreateDraftInput/);
  assert.match(completionJs, /请先填写学校中文名/);
  assert.match(completionCss, /\.ops-create-panel/);
  assert.match(completionJs, /function parseOpsSchoolImportItems/);
  assert.match(completionJs, /function applyOpsSchoolImport/);
  assert.match(completionJs, /可粘贴旧项目导出的学校数据/);
  assert.match(completionJs, /JSON · \{ items: \[\.\.\.\] \}/);
  assert.match(completionJs, /Array\.isArray\(parsed\) \? parsed : isPlainRecord\(parsed\) \? parsed\.items/);
  assert.match(completionJs, /data-ops-school-import-toggle/);
  assert.match(completionJs, /data-ops-school-import-preview/);
  assert.match(completionJs, /data-ops-school-import-apply/);
  assert.match(completionJs, /import_school_create/);
  assert.match(completionJs, /import_school_update/);
  assert.match(completionJs, /学生申请管理/);
  assert.match(completionJs, /function createOpsStudentCsv/);
  assert.match(completionJs, /function exportOpsStudentsCsv/);
  assert.match(completionJs, /function downloadOpsStudentsCsv/);
  assert.match(completionJs, /function saveOpsStudentEditor/);
  assert.match(completionJs, /data-ops-student-save/);
  assert.match(completionJs, /data-ops-student-field/);
  assert.match(completionJs, /学生与申请编辑/);
  assert.match(completionJs, /<details class="ops-student-editor-panel ops-student-editor-disclosure" data-ops-student-editor>/);
  assert.match(completionJs, /<summary class="ops-student-editor-summary">/);
  assert.match(completionJs, /class="ops-form-group"/);
  assert.match(completionJs, /class="ops-student-card ops-student-list-row/);
  assert.match(completionJs, /class="ops-student-row-metrics"/);
  assert.match(completionJs, /class="ops-student-card-actions" aria-label="学生申请视图"/);
  assert.match(completionJs, /data-ops-student-open-tab="handoff"/);
  assert.match(completionJs, /data-ops-student-open-tab="account"/);
  assert.doesNotMatch(completionJs, /class="ops-student-card-stats"/);
  assert.match(completionJs, /class="ops-student-card-foot"/);
  assert.doesNotMatch(completionJs, /class="ops-student-card \$\{selected \? "selected" : ""\}"[\s\S]*class="ops-school-card-stats"/);
  assert.doesNotMatch(completionJs, /<section class="ops-editor-section compact" data-ops-student-editor>/);
  assert.doesNotMatch(completionJs, /<section class="ops-student-editor-panel" data-ops-student-editor>/);
  assert.match(completionJs, /学生申请资料已保存，并写入运营审计/);
  assert.doesNotMatch(completionJs, /AdminUser \/ StudentProfile \/ application record/);
  assert.match(completionJs, /function opsStudentRoleLabel\(role\)/);
  assert.match(completionJs, /function opsStudentAccountStatusLabel\(status\)/);
  assert.match(completionJs, /function opsStudentPaymentStateLabel\(state\)/);
  assert.match(completionJs, /CSV · 学生申请导出/);
  assert.doesNotMatch(completionJs, /学生资料 · StudentProfile/);
  assert.doesNotMatch(completionJs, /申请与账号 · AdminUser/);
  assert.doesNotMatch(completionJs, /账号治理 · 对齐 AdminUser/);
  assert.doesNotMatch(completionJs, /CSV · filtered student applications/);
  assert.match(completionJs, /data-ops-student-export/);
  assert.match(completionJs, /data-ops-student-export-csv/);
  assert.match(completionJs, /旧项目字段映射/);
  assert.match(completionJs, /const opsSchoolViews = \[/);
  assert.match(completionJs, /data-ops-school-view=/);
  assert.match(completionJs, /data-ops-school-view-panel/);
  assert.match(completionJs, /function setOpsSchoolView/);
  assert.match(completionJs, /class="ops-school-view-stack"/);
  assert.ok(
    completionJs.indexOf('renderOpsSchoolViewPanel("catalog"', completionJs.indexOf("学校数据管理")) < completionJs.indexOf('renderOpsSchoolViewPanel("model"'),
    "School catalog view should render before the model and audit view.",
  );
  assert.ok(
    completionJs.indexOf("data-ops-school-apply-filter") < completionJs.indexOf('renderOpsSchoolViewPanel("model"'),
    "School filters should stay in the catalog flow before model/audit fields.",
  );
  assert.match(completionJs, /AdminSchoolSummary\.id/);
  assert.match(completionJs, /AdminSchoolSummary\.version/);
  assert.match(completionJs, /School\.nameZh/);
  assert.match(completionJs, /School\.nameEn/);
  assert.match(completionJs, /School\.schoolType/);
  assert.match(completionJs, /School\.region/);
  assert.match(completionJs, /School\.status/);
  assert.match(completionJs, /School\.applicationLevel/);
  assert.match(completionJs, /School\.cscaRequired/);
  assert.match(completionJs, /School\.cscaRequirement/);
  assert.match(completionJs, /School\.cscaRequirementNote/);
  assert.match(completionJs, /AdminSchoolDetail\.languageRequirement/);
  assert.match(completionJs, /School\.languageOfInstruction/);
  assert.match(completionJs, /School\.englishPrograms/);
  assert.match(completionJs, /School\.programFields/);
  assert.match(completionJs, /School\.tuitionSummary/);
  assert.match(completionJs, /School\.applicationFee/);
  assert.match(completionJs, /School\.scholarships/);
  assert.match(completionJs, /AdminSchoolDetail\.officialWebsiteUrl/);
  assert.match(completionJs, /AdminSchoolDetail\.admissionsWebsiteUrl/);
  assert.match(completionJs, /School\.sourceId/);
  assert.match(completionJs, /School\.sourceUrl/);
  assert.match(completionJs, /School\.rank/);
  assert.match(completionJs, /School\.cscaSubjects/);
  assert.match(completionJs, /School\.englishRequirement/);
  assert.match(completionJs, /School\.deadlineSummary/);
  assert.match(completionJs, /School\.sourceLabel/);
  assert.match(completionJs, /School\.sourceNote/);
  assert.match(completionJs, /AdminSchoolSummary\.verificationStatus/);
  assert.match(completionJs, /School\.qualityScore/);
  assert.match(completionJs, /AdminSchoolSummary\.completenessLabel/);
  assert.match(completionJs, /AdminSchoolSummary\.missingFields/);
  assert.match(completionJs, /创建\/更新/);
  assert.match(completionJs, /School\.updatedAt/);
  assert.match(completionJs, /SchoolChangeLog/);
  assert.match(completionJs, /变更记录/);
  assert.match(completionJs, /function appendOpsSchoolChangeLog/);
  assert.match(completionJs, /function renderOpsSchoolChangeLogs/);
  assert.match(completionJs, /function renderOpsFieldLabel/);
  assert.match(completionJs, /function opsFieldSource\(label = ""\)/);
  assert.match(completionJs, /function opsFieldSourceAttrs\(label = ""\)/);
  assert.match(completionJs, /data-source-field="\$\{escapeHtml\(source\)\}"/);
  assert.match(completionJs, /function renderOpsSchoolPublicPreview/);
  assert.match(completionJs, /data-ops-school-public-preview/);
  assert.match(completionJs, /学生端展示字段/);
  assert.doesNotMatch(completionJs, /CSCAlite 展示字段/);
  assert.match(completionJs, /待补字段/);
  assert.match(completionJs, /function renderOpsSchoolRecordSignals/);
  assert.match(completionJs, /data-ops-school-record-readonly/);
  assert.match(completionJs, /本区只编辑学校档案的可维护字段/);
  assert.doesNotMatch(completionJs, /label: "排名 · School\.rank", key: "rank"/);
  assert.doesNotMatch(completionJs, /label: "申请层级 · School\.applicationLevel", key: "applicationLevel"/);
  assert.doesNotMatch(completionJs, /label: "CSCA 科目 · School\.cscaSubjects", key: "cscaSubjects"/);
  assert.doesNotMatch(completionJs, /label: "英语要求 · School\.englishRequirement", key: "englishRequirement"/);
  assert.doesNotMatch(completionJs, /label: "截止摘要 · School\.deadlineSummary", key: "deadlineSummary"/);
  assert.doesNotMatch(completionJs, /label: "来源标签 · School\.sourceLabel", key: "sourceLabel"/);
  assert.doesNotMatch(completionJs, /label: "来源备注 · School\.sourceNote", key: "sourceNote"/);
  assert.doesNotMatch(completionJs, /label: "核验状态 · AdminSchoolSummary\.verificationStatus", key: "verificationStatus"/);
  assert.doesNotMatch(completionJs, /label: "质量分 · School\.qualityScore", key: "qualityScore"/);
  assert.doesNotMatch(completionJs, /label: "完整度 · AdminSchoolSummary\.completenessLabel", key: "completenessLabel"/);
  assert.doesNotMatch(completionJs, /label: "缺失字段 · AdminSchoolSummary\.missingFields", key: "missingFields"/);
  assert.match(completionJs, /data-source-field="\$\{escapeHtml\(field\)\}"/);
  assert.match(completionJs, /需要复核学校截止摘要、项目截止日期和来源链接是否一致/);
  assert.match(completionJs, /deadlineSummary:\s*record\.deadlineSummary \|\| \[record\.round1Deadline, record\.round2Deadline\]/);
  assert.match(completionJs, /school\.deadlineSummary \|\| "待补充"/);
  assert.doesNotMatch(completionJs, /school\.round1Deadline \|\| school\.round2Deadline \|\| "待补充"/);
  assert.doesNotMatch(completionJs, /round1Deadline:\s*""/);
  assert.doesNotMatch(completionJs, /englishRequirementNote:\s*""/);
  assert.doesNotMatch(completionJs, /tuitionByCategory:\s*""/);
  assert.doesNotMatch(completionJs, /School\.round1Deadline/);
  assert.doesNotMatch(completionJs, /School\.englishRequirementNote/);
  assert.doesNotMatch(completionJs, /School\.tuitionByCategory/);
  assert.match(completionJs, /\["contact", "联系与规模"\]/);
  assert.match(completionJs, /function renderOpsSchoolEditorBrief/);
  assert.match(completionJs, /class="ops-school-editor-brief"/);
  assert.match(completionCss, /\.ops-school-editor-brief/);
  assert.match(completionJs, /招生电话 · School\.contactTel/);
  assert.match(completionJs, /招生邮箱 · School\.contactEmail/);
  assert.match(completionJs, /未成年监护要求 · School\.under18GuardianRequired/);
  assert.match(completionJs, /class="ops-field-label"/);
  assert.doesNotMatch(completionJs, /data-source-field="\$\{escapeHtml\(meta\)\}"/);
  assert.doesNotMatch(completionJs, />字段映射<\/small>/);
  assert.doesNotMatch(completionJs, /ops-field-label"><strong>[^<]+<\/strong><small/);
  assert.doesNotMatch(completionJs, /AdminSchoolCreateInput\.nameZh<\/small>/);
  assert.match(completionJs, /ops-field-map-collapsible/);
  assert.match(completionJs, /按需展开，接口定型和数据迁移时检查/);
  assert.doesNotMatch(completionCss, /\.ops-field-label small/);
  assert.match(completionCss, /\.ops-field-map-collapsible/);
  assert.match(completionCss, /\.ops-school-public-preview/);
  assert.match(completionCss, /\.ops-preview-metrics/);
  assert.doesNotMatch(completionJs, /module-kicker">SchoolProgram/);
  assert.doesNotMatch(completionJs, /module-kicker">SchoolScholarship/);
  assert.doesNotMatch(completionJs, /module-kicker">SchoolChangeLog/);
  assert.doesNotMatch(completionJs, /data-ops-school-tab="\$\{escapeHtml\(key\)\}"[\s\S]*展示配置/);
  assert.doesNotMatch(completionJs, /\["display", "展示配置"\]/);
  assert.doesNotMatch(completionJs, /\["contact", "联系与补充"\]/);
  assert.doesNotMatch(completionJs, /\n\s+display:\s*`[\s\S]*renderSchoolFieldGroup\("display"/);
  assert.match(completionJs, /\n\s+contact:\s*`[\s\S]*renderSchoolFieldGroup\("contact"/);
  assert.match(completionJs, /function normalizeOpsSchoolEditorValues/);
  assert.match(completionJs, /SchoolProgram\.deadlineDate/);
  assert.match(completionJs, /SchoolProgram\.displaySubjects/);
  assert.match(completionJs, /SchoolProgram\.hasScholarship/);
  assert.match(completionJs, /SchoolProgram\.badgeText/);
  assert.match(completionJs, /function renderOpsSchoolProgramRecordSignals/);
  assert.match(completionJs, /data-ops-school-program-readonly/);
  assert.match(completionJs, /本区只编辑项目的可维护字段/);
  assert.match(completionJs, /function renderOpsSchoolCscaRuleRecordSignals/);
  assert.match(completionJs, /data-ops-school-csca-readonly/);
  assert.match(completionJs, /SchoolCscaRule\.applicablePrograms/);
  assert.match(completionJs, /SchoolCscaRule\.isVerified/);
  assert.match(completionJs, /本区只编辑 CSCA 规则的可维护字段/);
  assert.match(completionJs, /opsSchoolSubrecordFieldGroups/);
  assert.match(completionJs, /资助备注/);
  assert.match(completionJs, /资助与要求/);
  assert.match(completionJs, /SchoolScholarship/);
  assert.match(completionJs, /programs:\s*\[[\s\S]*\["基础信息", \["nameZh", "nameEn", "degreeLevel", "durationYears", "fieldCategory", "teachingLanguage", "sortOrder", "version", "status"\]\]/);
  assert.match(completionJs, /programs:\s*\[[\s\S]*\["资助备注", \["scholarshipText"\]\]/);
  assert.doesNotMatch(completionJs, /programs:\s*\[[\s\S]*\["学生端展示", \["badgeText", "displayTuition", "displaySubjects", "displayGroup", "displayGroupLabel"\]\]/);
  assert.match(completionJs, /function renderOpsSchoolScholarshipRecordSignals/);
  assert.match(completionJs, /data-ops-school-scholarship-readonly/);
  assert.match(completionJs, /SchoolScholarship\.deadlineDate/);
  assert.match(completionJs, /SchoolScholarship\.scholarshipSlug/);
  assert.match(completionJs, /SchoolScholarship\.isCsc/);
  assert.match(completionJs, /SchoolScholarship\.isVerified/);
  assert.match(completionJs, /本区只编辑学校奖学金的可维护字段/);
  assert.match(completionJs, /scholarships:\s*\[[\s\S]*\["适用范围", \["applicableDegree", "programId", "applicableProgram"\]\]/);
  assert.doesNotMatch(completionJs, /scholarships:\s*\[[\s\S]*\["申请时间", \["deadlineDate", "deadlineLabel", "applicationRound"\]\]/);
  assert.match(completionJs, /scholarships:\s*\[[\s\S]*\["来源记录", \["sourceUrl", "sourceLabel", "lastVerifiedAt"\]\]/);
  assert.match(completionJs, /opsSchoolSubrecordFields/);
  assert.match(completionJs, /function renderOpsSubrecordEditor/);
  assert.match(completionJs, /function renderOpsSubrecordEditorSafe/);
  assert.match(completionJs, /子记录需要修复/);
  assert.match(completionJs, /ops-subrecord-\$\{escapeHtml\(kind\)\}/);
  assert.match(completionJs, /ops-subrecord-fields/);
  assert.match(completionJs, /<details class="ops-subrecord editable ops-subrecord-\$\{escapeHtml\(kind\)\} ops-subrecord-disclosure"/);
  assert.match(completionJs, /<summary class="ops-subrecord-head">/);
  assert.match(completionJs, /const openAttr = record\.status === "draft" \? " open" : ""/);
  assert.match(completionJs, /data-ops-subrecord-field/);
  assert.match(completionJs, /data-ops-subrecord-save/);
  assert.match(completionJs, /data-ops-subrecord-archive/);
  assert.doesNotMatch(completionJs, /<article class="ops-subrecord editable ops-subrecord-\$\{escapeHtml\(kind\)\}"/);
  assert.match(completionJs, /当前子记录有未保存改动，请先保存此条再归档/);
  assert.match(completionJs, /function collectOpsSchoolSubrecords/);
  assert.match(completionJs, /function collectOpsSingleSubrecord/);
  assert.match(completionJs, /function handleOpsSubrecordAction/);
  assert.match(completionJs, /function opsSubrecordStorageKey/);
  assert.match(completionJs, /parseOpsSubrecordValue/);
  assert.match(completionJs, /opsScholarshipListFields/);
  assert.match(completionJs, /opsScholarshipFieldGroups/);
  assert.match(completionJs, /可粘贴旧项目导出的奖学金数据/);
  assert.match(completionJs, /JSON · \{ items: \[\.\.\.\] \}/);
  assert.match(completionJs, /Array\.isArray\(parsed\) \? parsed : isPlainRecord\(parsed\) \? parsed\.items/);
  assert.match(completionJs, /return mergeOpsRouteState\(sanitizeOpsAdminState\(parsed\)\)/);
  assert.match(completionJs, /function createOpsPublicScholarshipDraftRecord/);
  assert.match(completionJs, /function createOpsContentDraft\(forcedType = ""\)/);
  assert.match(completionJs, /function normalizeOpsMixedIdListValue/);
  assert.match(completionJs, /schoolIds: normalizeOpsMixedIdListValue\(merged\.schoolIds\)/);
  assert.match(completionJs, /programIds: normalizeOpsMixedIdListValue\(merged\.programIds\)/);
  assert.match(completionJs, /function normalizeOpsContentType/);
  assert.match(completionJs, /scholarship:\s*"scholarships"/);
  assert.match(completionJs, /publicscholarship:\s*"scholarships"/);
  assert.match(completionJs, /function createOpsTimelineDraftRecord/);
  assert.match(completionJs, /function createOpsScholarshipImportExample/);
  assert.match(completionJs, /function parseOpsScholarshipImportItems/);
  assert.match(completionJs, /function applyOpsScholarshipImport/);
  assert.match(completionJs, /公共奖学金 JSON 导入/);
  assert.match(completionJs, /data-ops-scholarship-import-toggle/);
  assert.match(completionJs, /data-ops-scholarship-import-preview/);
  assert.match(completionJs, /data-ops-scholarship-import-apply/);
  assert.match(completionJs, /function createOpsSchoolScholarshipDraftRecord/);
  assert.match(completionJs, /function recoverOpsSchoolScholarshipDraftState/);
  assert.match(completionJs, /新增学校奖学金/);
  assert.match(completionJs, /function ensureOpsSchoolEditorRendered/);
  assert.match(completionJs, /function scheduleOpsSchoolEditorIntegrityCheck/);
  assert.match(completionJs, /function assertOpsSchoolSubrecordDraftVisible/);
  assert.match(completionJs, /已从新增学校奖学金空白状态自动恢复草稿/);
  assert.match(completionJs, /data-ops-content-create data-content-type="\$\{escapeHtml\(activeType\)\}"/);
  assert.match(completionJs, /新增\$\{opsContentCreateLabel\(activeType\)\}/);
  assert.match(completionJs, /function filterOpsContentRecords/);
  assert.match(completionJs, /function applyOpsContentFilters/);
  assert.match(completionJs, /function opsContentStatusStats/);
  assert.match(completionJs, /data-ops-content-search/);
  assert.match(completionJs, /class="ops-filter-bar" aria-label="内容数据筛选"/);
  assert.match(completionJs, /class="ops-content-card ops-content-list-row \$\{String\(selectedId\) === String\(item\.id\) \? "selected" : ""\}"/);
  assert.match(completionJs, /class="ops-content-row-meta"/);
  assert.doesNotMatch(completionJs, /class="ops-content-card-stats"/);
  assert.match(completionJs, /class="ops-content-card-foot"/);
  assert.doesNotMatch(completionJs, /class="ops-school-card \$\{String\(selectedId\) === String\(item\.id\) \? "selected" : ""\}"/);
  assert.match(completionJs, /data-ops-content-status-filter/);
  assert.match(completionJs, /data-ops-content-apply-filter/);
  assert.match(completionJs, /内容数据筛选已应用/);
  assert.match(completionJs, /function markOpsContentEditorDirtyFromEvent/);
  assert.match(completionJs, /class="section-head ops-content-editor-head"/);
  assert.match(completionJs, /<div class="ops-editor-alert-stack">\s*<div class="ops-editor-note warn" data-ops-content-unsaved-warning hidden>/);
  assert.match(completionJs, /当前内容有未保存改动，请先保存内容再发布或归档/);
  assert.match(completionJs, /function assertOpsContentExpectedVersion/);
  assert.match(completionJs, /VERSION_CONFLICT/);
  assert.match(completionJs, /奖学金已被其他管理员更新，请刷新后再继续/);
  assert.match(completionJs, /version: nextVersion/);
  assert.match(completionJs, /function assertOpsSchoolExpectedVersion/);
  assert.match(completionJs, /function assertOpsSchoolSubrecordExpectedVersion/);
  assert.match(completionJs, /function withOpsSchoolSubrecordVersions/);
  assert.match(completionJs, /data-school-version/);
  assert.match(completionJs, /data-record-version/);
  assert.match(completionJs, /school: "学校"/);
  assert.match(completionJs, /programs: "项目"/);
  assert.match(completionJs, /\$\{noun\}已被其他管理员更新，请刷新后再继续/);
  assert.match(completionJs, /if \(type === "scholarships"\) return "公共奖学金"/);
  assert.match(completionJs, /function recoverOpsPublicScholarshipDraftState/);
  assert.match(completionJs, /scholarshipImportOpen:\s*false/);
  assert.match(completionJs, /ensureOpsPageNotBlank\(context\)/);
  assert.match(completionJs, /页面空白状态已自动恢复，并打开公共奖学金草稿/);
  assert.match(completionJs, /function bootCompletionPage\(\)/);
  assert.match(completionJs, /CUAC ops initial render failed/);
  assert.match(completionJs, /页面初始化渲染失败/);
  assert.match(completionJs, /恢复并新增奖学金草稿/);
  assert.match(completionJs, /已恢复公共奖学金草稿/);
  assert.match(completionJs, /已恢复学校奖学金草稿/);
  assert.match(completionJs, /function recoverFromCompletionClickError/);
  assert.match(completionJs, /function ensureOpsPageNotBlank/);
  assert.match(completionJs, /hasVisibleOpsWork/);
  assert.match(completionJs, /activePanelText\.length > 80/);
  assert.match(completionJs, /activePanel\.querySelector\("\.ops-management-surface, \.ops-record-editor, \.ops-overview-section/);
  assert.doesNotMatch(completionJs, /activePanel\.querySelector\("\.detail-card/);
  assert.match(completionJs, /\.ops-school-workbench, \.ops-school-view-stack, \.ops-content-workbench, \.ops-content-view-stack/);
  assert.match(completionJs, /\.ops-queue-workspace, \.ops-queue-section, \.ops-queue-side-panel/);
  assert.match(completionJs, /switchOpsSection\(section, \{ persist: false, scroll: false \}\)/);
  assert.match(completionJs, /function ensureOpsContentEditorRendered/);
  assert.match(completionJs, /normalizeOpsContentType\(currentState\.contentType\) !== normalizeOpsContentType\(type\)/);
  assert.match(completionJs, /const requiredFields = \{\s*cities: \["nameZh", "contentJsonText"\],\s*scholarships: \["title", "schoolIds"\],\s*timeline: \["month", "applicationWindow", "cscaWindow"\]/);
  assert.match(completionJs, /hasDraftIdentity && hasRequiredFields\(editor, type\)/);
  assert.match(completionJs, /function scheduleOpsContentEditorIntegrityCheck/);
  assert.match(completionJs, /setTimeout\(verify, 240\)/);
  assert.match(completionJs, /String\(editor\.dataset\.contentId \|\| ""\) === String\(draftId \|\| ""\)/);
  assert.match(completionJs, /existingScholarshipRecords = readOpsScholarshipRecords\(state\)/);
  assert.match(completionJs, /publicScholarshipRecords: \[draft, \.\.\.existingScholarshipRecords\]/);
  assert.match(completionJs, /hasExpectedSubrecord/);
  assert.match(completionJs, /已从学校奖学金空白状态自动恢复草稿/);
  assert.match(completionJs, /学校奖学金草稿已自动恢复，请继续编辑/);
  assert.match(completionJs, /ensureOpsContentEditorRendered\("scholarships", draftId, "新公共奖学金草稿"\)/);
  assert.match(completionJs, /scheduleOpsContentEditorIntegrityCheck\("scholarships", draftId, "新公共奖学金草稿"\)/);
  assert.match(completionJs, /const hasEditableSubrecord = !kindKey \|\| expectedSubrecords/);
  assert.match(completionJs, /function ensureOpsSchoolEditorRendered\(kind = "", label = "", recordId = ""\)/);
  assert.match(completionJs, /String\(node\.dataset\.recordId \|\| ""\) === String\(recordId\)/);
  assert.match(completionJs, /const identityRequired = Boolean\(label \|\| recordId\)/);
  assert.match(completionJs, /scheduleOpsSchoolEditorIntegrityCheck\(kind, kind === "scholarship" \? "新奖学金草稿" : "", createdRecordId\)/);
  assert.match(completionJs, /function refreshOpsSchoolEditorOnly/);
  assert.match(completionJs, /refreshOpsSchoolEditorOnly\(nextState, schoolId, config\.tab, config\.message\)/);
  assert.match(completionJs, /const hasEditableScholarship = Array\.from\(panel\?\.querySelectorAll\('\[data-ops-subrecord\]\[data-kind="scholarships"\]'\) \|\| \[\]\)/);
  assert.doesNotMatch(completionJs, /node\.textContent\.includes\("新奖学金草稿"\) && node\.querySelector\("\[data-ops-subrecord-field\]"\)/);
  assert.match(completionJs, /function renderOpsBlankRecoveryState/);
  assert.match(completionJs, /function renderOpsContentEditorGroups/);
  assert.match(completionJs, /data-ops-content-editor-tab/);
  assert.match(completionJs, /data-ops-content-editor-panel/);
  assert.match(completionJs, /class="ops-content-editor-section" data-ops-content-editor-panel/);
  assert.match(completionJs, /class="ops-content-editor-section">\s*<div class="ops-relation-head">/);
  assert.doesNotMatch(completionJs, /class="ops-editor-section" data-ops-content-editor-panel/);
  assert.match(completionJs, /function updateOpsContentStatus\(status, trigger = null\)/);
  assert.match(completionJs, /trigger\?\.closest\?\.\("\[data-ops-content-editor\]"\) \|\| currentOpsContentEditor\(\)/);
  assert.match(completionJs, /const contentArchive = event\.target\.closest\("\[data-ops-content-archive\]"\)/);
  assert.match(completionJs, /updateOpsContentStatus\("archived", contentArchive\)/);
  assert.match(completionJs, /let opsContentTypeGuardToken = 0/);
  assert.match(completionJs, /const guardToken = \+\+opsContentTypeGuardToken/);
  assert.match(completionJs, /guardToken !== opsContentTypeGuardToken/);
  assert.match(completionJs, /aria-selected/);
  assert.match(completionJs, /function renderOpsScholarshipPublicPreview/);
  assert.match(completionJs, /data-ops-scholarship-public-preview/);
  assert.match(completionJs, /function opsScholarshipRelationSummary/);
  assert.match(completionJs, /function renderOpsScholarshipRelationSummary/);
  assert.match(completionJs, /data-ops-scholarship-relation-summary/);
  assert.match(completionJs, /resolveOpsScholarshipSchools\(item\.schoolIds\)/);
  assert.match(completionJs, /resolveOpsScholarshipPrograms\(item\.programIds\)/);
  assert.match(completionJs, /scholarship-detail\.html\?scholarship=/);
  assert.match(completionJs, /function renderOpsScholarshipRecordSignals/);
  assert.match(completionJs, /data-ops-scholarship-record-readonly/);
  assert.match(completionJs, /本区只编辑公共奖学金的可维护字段/);
  assert.match(completionJs, /title === "基础信息" \? `\$\{renderOpsScholarshipPublicPreview\(item\)\}\$\{renderOpsScholarshipRecordSignals\(item\)\}`/);
  assert.match(completionJs, /function renderOpsCityPublicPreview/);
  assert.match(completionJs, /function renderOpsCityRecordSignals/);
  assert.match(completionJs, /data-ops-city-record-readonly/);
  assert.match(completionJs, /本区只编辑城市指南的可维护字段/);
  assert.match(completionJs, /function renderOpsTimelineRecordSignals/);
  assert.match(completionJs, /data-ops-timeline-record-readonly/);
  assert.match(completionJs, /本区只编辑申请时间窗的可维护字段/);
  assert.match(completionJs, /data-ops-city-public-preview/);
  assert.match(completionJs, /学生端预览/);
  assert.match(completionJs, /city-detail\.html\?city=/);
  assert.match(completionJs, /title === "基础信息" \? `\$\{renderOpsCityPublicPreview\(item\)\}\$\{renderOpsCityRecordSignals\(item\)\}`/);
  assert.doesNotMatch(completionJs, /label: "ID · CityGuide\.id", key: "id"/);
  assert.doesNotMatch(completionJs, /label: "版本 · CityGuide\.version", key: "version"/);
  assert.doesNotMatch(completionJs, /label: "创建时间 · CityGuide\.createdAt", key: "createdAt"/);
  assert.doesNotMatch(completionJs, /label: "更新时间 · CityGuide\.updatedAt", key: "updatedAt"/);
  assert.doesNotMatch(completionJs, /label: "ID · AdminScholarship\.id", key: "id"/);
  assert.doesNotMatch(completionJs, /label: "版本 · AdminScholarship\.version", key: "version"/);
  assert.doesNotMatch(completionJs, /label: "创建时间 · AdminScholarship\.createdAt", key: "createdAt"/);
  assert.doesNotMatch(completionJs, /label: "更新时间 · AdminScholarship\.updatedAt", key: "updatedAt"/);
  assert.doesNotMatch(completionJs, /label: "ID · ApplicationTimelineWindow\.id", key: "id"/);
  assert.doesNotMatch(completionJs, /label: "版本 · ApplicationTimelineWindow\.version", key: "version"/);
  assert.doesNotMatch(completionJs, /label: "更新时间 · ApplicationTimelineWindow\.updatedAt", key: "updatedAt"/);
  assert.match(completionCss, /\.ops-content-editor-tabs/);
  assert.match(completionCss, /\.ops-content-editor-panels/);
  assert.match(completionCss, /\.ops-content-editor-section\s*\{[\s\S]*border-top: 1px solid/);
  assert.doesNotMatch(completionCss, /\.ops-editor-section/);
  assert.match(completionCss, /\.ops-content-public-preview/);
  assert.match(completionCss, /\.ops-content-preview-strip\.compact/);
  assert.match(completionCss, /\.ops-content-preview-metrics/);
  assert.match(completionCss, /\.ops-relation-summary/);
  assert.match(completionJs, /function sanitizeOpsAdminState/);
  assert.match(completionJs, /function sanitizeOpsContentRecords/);
  assert.match(completionJs, /publicScholarshipRecords = sanitizeOpsContentRecords\(next\.publicScholarshipRecords\)/);
  assert.match(completionJs, /function installOpsRuntimeRecovery/);
  assert.match(completionJs, /window\.addEventListener\("error"/);
  assert.match(completionJs, /首次绘制后主区域为空/);
  assert.match(completionJs, /恢复并新增公共奖学金草稿/);
  assert.match(completionJs, /const activeContentType = contentCreate\.closest\("\[data-ops-section\]"\)\?\.querySelector\("\[data-ops-content-tab\]\.active"\)\?\.dataset\.opsContentTab/);
  assert.match(completionJs, /const stateContentType = readOpsAdminState\(\)\.contentType/);
  assert.match(completionJs, /const buttonContentType = contentCreate\.dataset\.contentType \|\| ""/);
  assert.match(completionJs, /const normalizedActiveContentType = activeContentType \? normalizeOpsContentType\(activeContentType\) : ""/);
  assert.match(completionJs, /const normalizedButtonContentType = buttonContentType \? normalizeOpsContentType\(buttonContentType\) : ""/);
  assert.match(completionJs, /normalizedButtonContentType && normalizedButtonContentType === normalizedStateContentType/);
  assert.match(completionJs, /function scheduleOpsContentClickGuard/);
  assert.match(completionJs, /let opsContentCreateGuardToken = 0/);
  assert.match(completionJs, /const guardToken = \+\+opsContentCreateGuardToken/);
  assert.match(completionJs, /if \(guardToken !== opsContentCreateGuardToken\) return/);
  assert.match(completionJs, /function ensureOpsContentTypeRendered/);
  assert.match(completionJs, /function scheduleOpsContentTypeGuard/);
  assert.match(completionJs, /activeTab === nextType[\s\S]*createType === nextType/);
  assert.match(completionJs, /switchOpsSection\("content", \{ persist: false, scroll: false \}\)/);
  assert.match(completionJs, /const requestedType = normalizedActiveContentType && normalizedActiveContentType === normalizedStateContentType/);
  assert.match(completionJs, /const draftId = createOpsContentDraft\(requestedType\)/);
  assert.match(completionJs, /ensureOpsContentTypeRendered\(requestedType\)/);
  assert.match(completionJs, /function forceOpsContentEditorRendered/);
  assert.match(completionJs, /forceOpsContentEditorRendered\(normalizeOpsContentType\(requestedType\), draftId, draftLabels/);
  assert.match(completionJs, /if \(!hasWork\) forceOpsContentEditorRendered\(contentType, draftId, labels\[contentType\]\)/);
  assert.match(completionJs, /scheduleOpsContentClickGuard\(requestedType, draftId\)/);
  assert.match(completionJs, /function scheduleOpsSchoolScholarshipClickGuard/);
  assert.match(completionJs, /scheduleOpsSchoolScholarshipClickGuard\(\)/);
  assert.match(completionJs, /function recoverOpsSchoolScholarshipDraftAndRender/);
  assert.match(completionJs, /data-ops-recover-school-scholarship-draft/);
  assert.match(completionJs, /recoverOpsPublicScholarshipDraftState\("已从异常状态恢复并新增公共奖学金草稿"\)/);
  assert.match(completionJs, /页面已自动恢复/);
  assert.match(completionJs, /function safelyEnsureOpsPageNotBlank/);
  assert.match(completionJs, /finally \{[\s\S]*safelyEnsureOpsPageNotBlank\("点击操作后主区域为空"\)/);
  assert.match(completionJs, /操作异常已自动恢复，页面未清空/);
  assert.match(completionJs, /页面已进入恢复模式/);
  assert.match(completionJs, /基础信息[\s\S]*展示内容[\s\S]*适用范围[\s\S]*来源与联系/);
  assert.match(completionJs, /data-ops-content-publish/);
  assert.match(completionJs, /data-ops-content-archive/);
  assert.match(completionJs, /function updateOpsContentStatus/);
  assert.match(completionJs, /申请时间窗/);
  assert.match(completionJs, /ApplicationTimelineWindow\.month/);
  assert.match(completionJs, /ApplicationTimelineWindow\.applicationWindow/);
  assert.match(completionJs, /ApplicationTimelineWindow\.cscaWindow/);
  assert.match(completionJs, /selectedTimelineWindowId/);
  assert.match(completionJs, /timelineWindowRecords/);
  assert.match(completionJs, /Scholarship\.id/);
  assert.match(completionJs, /AdminScholarship\.schoolIds/);
  assert.match(completionJs, /AdminScholarship\.programIds/);
  assert.match(completionJs, /data-ops-scholarship-school-picker/);
  assert.match(completionJs, /data-ops-scholarship-school-toggle/);
  assert.match(completionJs, /data-ops-scholarship-program-picker/);
  assert.match(completionJs, /data-ops-scholarship-program-toggle/);
  assert.match(completionJs, /已选择 <strong data-ops-scholarship-school-count/);
  assert.match(completionJs, /已选择 <strong data-ops-scholarship-program-count/);
  assert.doesNotMatch(completionJs, /<\/strong> selected<\/span>/);
  assert.match(completionJs, /从学校库勾选适用学校，保存后同步到奖学金关联学校/);
  assert.match(completionJs, /从项目库勾选适用项目，保存后同步到奖学金关联项目/);
  assert.doesNotMatch(completionJs, /自动同步到 Scholarship\.schoolIds/);
  assert.doesNotMatch(completionJs, /从 SchoolProgram 记录勾选适用项目/);
  assert.doesNotMatch(completionJs, /SchoolProgram 记录/);
  assert.match(completionJs, /function opsContentDisplayLabel\(type\)/);
  assert.match(completionJs, /if \(type === "timeline"\) return "申请时间窗"/);
  assert.match(completionJs, /module-kicker">\$\{escapeHtml\(displayLabel\)\}编辑器/);
  assert.doesNotMatch(completionJs, /type === "timeline" \? "ApplicationTimelineWindow"/);
  assert.doesNotMatch(completionJs, /module-kicker">\$\{escapeHtml\(model\)\} 编辑器/);
  assert.match(completionJs, /function syncOpsScholarshipSchoolPicker/);
  assert.match(completionJs, /function syncOpsScholarshipProgramPicker/);
  assert.match(completionJs, /AdminScholarship\.benefits/);
  assert.match(completionJs, /function resolveOpsScholarshipSchools/);
  assert.match(completionJs, /function resolveOpsScholarshipPrograms/);
  assert.match(completionJs, /function parseOpsScholarshipContentValue/);
  assert.match(completionJs, /function parseOpsScholarshipActionLinks/);
  assert.match(completionJs, /function parseOpsScholarshipContactInfo/);
  assert.match(completionJs, /opsCityContentFields/);
  assert.match(completionJs, /opsCityFieldGroups/);
  assert.match(completionJs, /function renderOpsCityAggregatePreview/);
  assert.match(completionJs, /CityGuide\.slug/);
  assert.match(completionJs, /CityGuide\.version/);
  assert.match(completionJs, /CityGuide\.updatedAt/);
  assert.match(completionJs, /data-ops-city-record-readonly/);
  assert.match(completionJs, /field\.readonly \? "readonly" : ""/);
  assert.match(completionJs, /CityGuideAggregate\.actualSchoolCount|actualSchoolCount/);
  assert.match(completionJs, /data-source-field="\$\{escapeHtml\(sourceField\)\}"/);
  assert.match(completionJs, /聚合字段映射/);
  assert.match(completionJs, /记录字段映射/);
  assert.ok(
    completionJs.indexOf('renderOpsContentViewPanel("catalog"', completionJs.indexOf("城市、公共奖学金与申请时间窗管理")) < completionJs.indexOf('renderOpsContentViewPanel("model"'),
    "Content catalog view should render before the field mapping view.",
  );
  assert.ok(
    completionJs.indexOf("renderOpsScholarshipEditorGroups") < completionJs.indexOf("内容字段映射"),
    "Content editor form groups should appear before the content field map.",
  );
  assert.match(completionCss, /\.ops-aggregate-sources/);
  assert.match(completionJs, /CityGuide\.content\.costProfiles/);
  assert.match(completionJs, /页面内容结构 · CityGuide\.content/);
  assert.match(completionJs, /contentJsonText/);
  assert.match(completionJs, /CityGuide\.content JSON 格式不正确/);
  assert.match(completionCss, /ops-json-editor/);
  assert.match(completionJs, /function parseOpsCityQuickFacts/);
  assert.match(completionJs, /function parseOpsCityCostProfiles/);
  assert.match(completionJs, /CityGuide\.content\.costBreakdown/);
  assert.match(completionJs, /CityGuide\.content\.applicationTips/);
  assert.match(completionJs, /CityGuide\.content\.relatedProgramKeywords/);
  assert.match(completionJs, /CityGuide\.content\.cityFaqs/);
  assert.match(completionJs, /function formatOpsCityContentField/);
  assert.match(completionJs, /cityFaqs:\s*formatOpsCityContentField\("cityFaqs", content\.cityFaqs\)/);
  assert.match(completionJs, /CityGuide\.nearby/);
  assert.match(completionJs, /function normalizeOpsContentValues/);
  assert.match(completionJs, /contentJson/);
  assert.match(completionJs, /cscaRequiredSchoolCount/);
  assert.match(completionJs, /next\.benefits = next\.benefits\?\.length/);
  assert.match(completionJs, /applicationNote/);
  assert.match(completionJs, /sourceLabel/);
  assert.match(completionJs, /importantNote/);
  assert.match(completionJs, /SchoolCscaRule\.cscaSubjects/);
  assert.match(completionJs, /importantNote/);
  assert.match(completionJs, /SchoolScholarship\.amountText/);
  assert.match(completionJs, /已打开学校目录编辑器，并保留旧项目字段映射参考/);
  assert.match(completionJs, /function guardOpsSchoolUnsavedSwitch/);
  assert.match(completionJs, /function markOpsSchoolEditorDirtyFromEvent/);
  assert.match(completionJs, /function discardOpsSchoolUnsavedAndContinue/);
  assert.match(completionJs, /data-ops-school-unsaved-warning/);
  assert.match(completionJs, /data-ops-school-switch-confirm/);
  assert.match(completionJs, /data-ops-school-discard-switch/);
  assert.match(completionJs, /当前学校有未保存改动/);
  assert.match(completionJs, /当前学校有未保存改动，请先保存修改再归档/);
  assert.match(completionJs, /切换学校前确认/);
  assert.match(completionJs, /已生成学生申请汇总/);
  assert.match(completionJs, /账号权限管理/);
  assert.match(completionJs, /function defaultOpsAccessRecords/);
  assert.match(completionJs, /function createOpsAccessInvite/);
  assert.match(completionJs, /function approveOpsAccessGrant/);
  assert.match(completionJs, /function toggleOpsAccessStatus/);
  assert.match(completionJs, /function openOpsAccessGrantPanel/);
  assert.match(completionJs, /function updateOpsAccessAgentService/);
  assert.match(completionJs, /function filterOpsAccessRecords/);
  assert.match(completionJs, /function applyOpsAccessFilter/);
  assert.match(completionJs, /function exportOpsAccessAudit/);
  assert.match(completionJs, /const opsAccessViews = \[/);
  assert.match(completionJs, /function normalizeOpsAccessView/);
  assert.match(completionJs, /function activeOpsAccessView/);
  assert.match(completionJs, /function renderOpsAccessViewTabs/);
  assert.match(completionJs, /function renderOpsAccessViewPanel/);
  assert.match(completionJs, /function setOpsAccessView/);
  assert.match(completionJs, /#access\/\$\{normalizeOpsAccessView\(state\.accessView\)\}/);
  assert.match(completionJs, /opsTabPanelAttrs\("access", opsState\)/);
  assert.match(completionJs, /data-ops-access-view="\$\{escapeHtml\(key\)\}"/);
  assert.match(completionJs, /data-ops-access-view-panel="\$\{escapeHtml\(view\)\}"/);
  assert.match(completionJs, /class="ops-access-view-tabs"/);
  assert.match(completionJs, /class="ops-access-view-stack"/);
  assert.match(completionJs, /data-ops-access-search/);
  assert.match(completionJs, /class="ops-filter-bar" aria-label="账号权限筛选"/);
  assert.match(completionJs, /class="ops-access-command-center" aria-label="账号权限操作台"/);
  assert.match(completionJs, /class="ops-access-command-copy"/);
  assert.match(completionJs, /class="ops-access-command-metrics" aria-label="账号权限摘要"/);
  assert.match(completionJs, /class="ops-access-command-actions"/);
  assert.doesNotMatch(completionJs, /class="ops-access-command-center" aria-label="账号权限操作台">[\s\S]{0,120}\s*<article>/);
  assert.match(completionJs, /function renderOpsAccessCommandCenter\(accessRows = \[\], filteredRows = \[\]\)/);
  assert.match(completionJs, /data-ops-access-export/);
  assert.doesNotMatch(completionJs, /data-ops-access-command-view=/);
  assert.doesNotMatch(completionJs, /<div class="ops-command-strip">\s*<span>统一账号体系/);
  assert.doesNotMatch(completionJs, /class="ops-access-policy-strip" aria-label="账号权限策略摘要"/);
  assert.match(completionJs, /统一账号入口/);
  assert.match(completionJs, /Agent 复核/);
  assert.match(completionJs, /申请辅助免费开放，按账号权限审计/);
  assert.doesNotMatch(completionJs, /class="ops-access-summary-strip"/);
  assert.match(completionJs, /class="ops-access-card ops-access-list-row" data-ops-access-card/);
  assert.match(completionJs, /class="ops-access-row-meta"/);
  assert.match(completionJs, /<span>邀请审批<\/span>/);
  assert.match(completionJs, /<span>权限策略<\/span>/);
  assert.doesNotMatch(completionJs, /<span>school_staff_invites<\/span>/);
  assert.doesNotMatch(completionJs, /<span>agent_access_policy<\/span>/);
  assert.match(completionJs, /function opsAccessSourceLabel\(source\)/);
  assert.match(completionJs, /self_registered: "自主注册"/);
  assert.match(completionJs, /school_staff_invite: "学校邀请"/);
  assert.match(completionJs, /opsAccessSourceLabel\(item\.source\)/);
  assert.doesNotMatch(completionJs, /\$\{escapeHtml\(item\.lastAction\)\} · \$\{escapeHtml\(item\.source\)\}/);
  assert.doesNotMatch(completionJs, /class="ops-access-card-stats"/);
  assert.doesNotMatch(completionJs, /class="ops-school-card" data-ops-access-card/);
  assert.match(completionJs, /data-ops-access-role-filter/);
  assert.match(completionJs, /data-ops-access-status-filter/);
  assert.match(completionJs, /data-ops-access-grant-filter/);
  assert.match(completionJs, /data-ops-access-apply-filter/);
  assert.match(completionJs, /class="ops-access-workbench"/);
  assert.match(completionJs, /<details class="ops-access-boundary-panel ops-access-boundary-disclosure" aria-label="权限边界" open>/);
  assert.match(completionJs, /<summary class="ops-access-boundary-summary">/);
  assert.match(completionJs, /renderOpsFieldMap\("账号字段映射", "统一账号、角色、租户成员和邀请来源字段/);
  assert.match(completionJs, /renderOpsFieldMap\("权限审计字段", "展开查看后端校验字段"/);
  assert.doesNotMatch(completionJs, /<div class="ops-field-map compact">/);
  assert.doesNotMatch(completionJs, /<div class="ops-school-workbench">\s*<div class="ops-management-table">\$\{filteredRows\.map\(\(item\) => renderOpsAccessCard/);
  assert.doesNotMatch(completionJs, /<aside class="ops-access-boundary-panel"/);
  assert.match(completionJs, /<details class="ops-access-action-panel ops-access-disclosure-panel"/);
  assert.match(completionJs, /<summary class="ops-access-action-summary">/);
  assert.doesNotMatch(completionJs, /<section class="ops-editor-section">\s*<div class="ops-relation-head">\s*<div><h3>新增账号邀请/);
  assert.doesNotMatch(completionJs, /<section class="ops-access-action-panel">\s*<div class="ops-relation-head">\s*<div><h3>新增账号邀请/);
  assert.match(completionJs, /data-ops-access-create-invite/);
  assert.match(completionJs, /data-ops-access-invite-feedback/);
  assert.match(completionJs, /学校老师邀请必须选择学校租户/);
  assert.match(completionJs, /学校老师邀请必须填写邀请码/);
  assert.match(completionJs, /data-ops-access-approve/);
  assert.match(completionJs, /data-ops-access-toggle/);
  assert.match(completionJs, /data-ops-access-open-grant/);
  assert.match(completionJs, /function opsAgentGatewayStatusLabel\(status\)/);
  assert.match(completionJs, /function opsAgentReadinessStatusLabel\(status\)/);
  assert.match(completionJs, /<h2>网关与服务配置<\/h2>/);
  assert.match(completionJs, /<span>Agent 申请辅助就绪度<\/span>/);
  assert.doesNotMatch(completionJs, /Agent 申请辅助 readiness/);
  assert.doesNotMatch(completionJs, /已刷新 Gateway、Provider、readiness 和生成队列摘要/);
  assert.doesNotMatch(completionJs, /真实上线时/);
  assert.doesNotMatch(completionJs, /前端模拟/);
  assert.doesNotMatch(completionJs, /AdminUser \/ StudentProfile \/ application record/);
  assert.match(completionJs, /学校字段已本地保存，并写入变更记录/);
  assert.match(completionJs, /学生申请资料已保存，并写入运营审计/);
  assert.match(completionJs, /账号权限已批准，并写入权限审计/);
  assert.doesNotMatch(completionJs, /const accessCommandView = event\.target\.closest/);
  assert.match(completionJs, /class="ops-access-action-panel ops-access-disclosure-panel" data-ops-access-grant-panel/);
  assert.match(completionJs, /data-ops-access-agent-status/);
  assert.match(completionJs, /data-ops-access-agent-reason/);
  assert.match(completionJs, /Agent 申请辅助免费提供/);
  assert.match(completionJs, /这里管理账号是否能在对应工作台使用 Agent，不发放额度，也不展示题库相关能力/);
  assert.match(completionJs, /已更新账号 Agent 服务权限/);
  assert.doesNotMatch(completionJs, /grantAdminAdaptiveAIUnits|data-ops-access-grant-units|Agent 额度|AI 额度|Agent 余额|AI 余额|当前余额/);
  assert.match(completionJs, /已处理运营动作/);
  assert.doesNotMatch(completionJs, /Ops action reviewed/);
  assert.doesNotMatch(completionJs, /Agent units/);
  assert.match(completionJs, /AdminUser\.email/);
  assert.match(completionJs, /user_roles\.role/);
  assert.match(completionJs, /organization_members\.organizationId/);
  assert.match(completionJs, /school_staff_invites\.inviteCode/);
  assert.match(completionJs, /已按幂等检查加入发送重试队列/);
  assert.match(completionJs, /function readOpsAuditEvents/);
  assert.match(completionJs, /function filterOpsAuditEvents/);
  assert.match(completionJs, /function renderOpsAuditEventsPanel/);
  assert.match(completionJs, /function opsAuditModuleLabel\(module\)/);
  assert.match(completionJs, /function opsAuditActionLabel\(action\)/);
  assert.match(completionJs, /function opsAuditResourceTypeLabel\(resourceType\)/);
  assert.match(completionJs, /function opsAuditStatusLabel\(status\)/);
  assert.match(completionJs, /opsAuditResourceTypeLabel\(event\.resourceType\)/);
  assert.match(completionJs, /已生成可下载审计 CSV，包含时间、操作人、模块、动作、范围和摘要/);
  assert.doesNotMatch(completionJs, /\$\{escapeHtml\(event\.module\)\} · \$\{escapeHtml\(event\.action\)\}/);
  assert.doesNotMatch(completionJs, /\$\{escapeHtml\(event\.actor\)\} · \$\{escapeHtml\(event\.resourceType\)\} · \$\{escapeHtml\(event\.status\)\}/);
  assert.match(completionJs, /function applyOpsAuditFilters/);
  assert.match(completionJs, /function exportOpsAuditCsv/);
  assert.match(completionJs, /data-ops-audit-events-panel/);
  assert.match(completionJs, /data-ops-audit-search/);
  assert.match(completionJs, /data-ops-audit-module-filter/);
  assert.match(completionJs, /data-ops-audit-action-filter/);
  assert.match(completionJs, /data-ops-audit-apply-filter/);
  assert.match(completionJs, /data-ops-audit-export/);
  assert.match(completionJs, /occurredAt", "actor", "module", "resourceType", "action", "scope", "status", "summary"/);
  assert.match(completionJs, /function readOpsAgentOpsState/);
  assert.match(completionJs, /function renderOpsAgentOperationsCard/);
  assert.match(completionJs, /function handleOpsAgentOperationsAction/);
  assert.match(completionJs, /data-ops-agent-operations/);
  assert.match(completionJs, /class="ops-agent-readiness-card"/);
  assert.match(completionJs, /class="ops-agent-job-grid"/);
  assert.match(completionJs, /renderOpsFieldMap\("Agent 运维字段", "展开查看网关与申请辅助队列字段"/);
  assert.match(completionJs, /<details class="ops-queue-side-panel ops-queue-disclosure-panel" data-ops-agent-operations\$\{openAttr\}>/);
  assert.match(completionJs, /<summary class="ops-queue-disclosure-summary">/);
  assert.doesNotMatch(completionJs, /data-ops-agent-operations[\s\S]{0,900}class="response-grid"/);
  assert.doesNotMatch(completionJs, /data-ops-agent-operations[\s\S]{0,900}class="ops-impact-card"/);
  assert.match(completionJs, /data-ops-agent-ops-action="refresh"/);
  assert.match(completionJs, /data-ops-agent-ops-action="retry-failed"/);
  assert.match(completionJs, /data-ops-agent-ops-action="toggle-rollout"/);
  assert.match(completionJs, /CUACAgentGatewaySummary/);
  assert.match(completionJs, /CUACAgentProviderConfig/);
  assert.match(completionJs, /CUACAgentApplicationQueueHealth/);
  assert.match(completionJs, /CUACAgentOperationalReadiness/);
  assert.doesNotMatch(completionJs, /AdminAIQuestioningGenerationQueueHealth|AdminAIQuestioningOperationalReadiness/);
  assert.match(completionJs, /Selected \$\{kind\} profile from the CUAC catalog/);
  assert.match(completionJs, /Catalog facts/);
  assert.match(completionJs, /Preparing route detail/);
  assert.match(completionJs, /Agent ready soon/);
  assert.match(completionJs, /saved to Favourites for later review/);
  assert.doesNotMatch(completionJs, /Catalog detail|Checking source|Agent context pending|source lineage so Agent|with source context|Recovery contract/);
  assert.match(completionJs, /Review the routing fee, invoice state, and what was sent to schools/);
  assert.match(completionJs, /设置就绪/);
  assert.match(completionJs, /运营控制台/);
  assert.match(completionJs, /模板已重置。学校仍直接向学生索取文件。/);
  assert.doesNotMatch(completionJs, /CUAC demo|Demo detail|Paid demo|Review the demo routing fee|Preview settings|Reset demo copy|Preview console|in this demo|Demo template reset/);
  assert.match(completionCss, /\.settings-table/);
  assert.match(completionCss, /\.ops-subrecord\.editable/);
  assert.match(completionJs, /class="ops-subrecord-field-group"/);
  assert.doesNotMatch(completionJs, /class="ops-editor-section compact flat"/);
  assert.match(completionCss, /\.ops-subrecord-fields/);
  assert.match(completionCss, /\.ops-subrecord-readonly\.compact-strip/);
  assert.match(completionCss, /\.ops-subrecord-field-group\s*\{[\s\S]*border-top: 1px solid/);
  assert.match(completionJs, /class="ops-management-surface ops-school-management"/);
  assert.match(completionJs, /class="ops-management-surface ops-content-management"/);
  assert.match(completionJs, /class="ops-content-command-center" data-ops-content-command-center/);
  assert.match(completionJs, /class="ops-content-command-copy"/);
  assert.match(completionJs, /class="ops-content-summary-strip" aria-label="内容状态摘要"/);
  assert.match(completionJs, /class="ops-content-catalog-command" aria-label="内容数据操作"/);
  assert.match(completionJs, /class="ops-content-catalog-copy"/);
  assert.match(completionJs, /class="ops-content-catalog-actions"/);
  assert.match(completionJs, /<span class="module-kicker">目录维护<\/span>/);
  assert.match(completionJs, /const opsContentViews = \[/);
  assert.match(completionJs, /data-ops-content-view=/);
  assert.match(completionJs, /data-ops-content-view-panel/);
  assert.match(completionJs, /function switchOpsContentView/);
  assert.match(completionJs, /function openOpsContentRecordView\(type, id, view = "edit"\)/);
  assert.match(completionJs, /data-ops-content-open-view="preview"/);
  assert.match(completionJs, /data-ops-content-open-view="model"/);
  assert.match(completionJs, /const contentOpenView = event\.target\.closest\("\[data-ops-content-open-view\]"\)/);
  assert.doesNotMatch(completionJs, /<aside class="ops-content-catalog-aside">/);
  assert.match(completionJs, /class="ops-content-editor-brief" data-ops-content-editor-brief/);
  assert.match(completionJs, /class="ops-content-editor-metrics"/);
  assert.match(completionJs, /城市详情页/);
  assert.match(completionJs, /公共奖学金内容、适用学校和适用项目关系/);
  assert.match(completionJs, /class="ops-management-surface ops-access-management"/);
  assert.match(completionJs, /class="ops-management-surface ops-student-management"/);
  assert.doesNotMatch(completionJs, /class="ops-management-surface ops-school-management">[\s\S]*账号权限管理/);
  assert.doesNotMatch(completionJs, /class="detail-card ops-school-management"/);
  assert.doesNotMatch(completionJs, /class="detail-card ops-student-management"/);
  assert.match(completionCss, /\.ops-management-surface,\s*\n\.ops-school-management,\s*\n\.ops-content-management,\s*\n\.ops-access-management,\s*\n\.ops-student-management\s*\{[\s\S]*background: transparent/);
  assert.match(completionCss, /\.ops-management-surface\s*\{[\s\S]*min-width: 0/);
  assert.match(completionCss, /\.ops-student-management/);
  assert.match(completionCss, /\.ops-school-workbench,\s*\n\.ops-content-workbench\s*\{[\s\S]*grid-template-columns: 1fr/);
  assert.match(completionCss, /\.ops-school-view-shell-head\s*\{[\s\S]*grid-template-columns: 1fr/);
  assert.match(completionCss, /\.ops-school-view-tabs\s*\{[\s\S]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(completionCss, /\.ops-school-task-strip\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto/);
  assert.doesNotMatch(completionCss, /\.ops-school-task-actions\s*\{/);
  assert.match(completionCss, /\.ops-school-catalog-command\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto/);
  assert.match(completionCss, /\.ops-school-command-actions\s*\{[\s\S]*display: flex/);
  assert.match(completionCss, /\.ops-school-catalog-grid\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(completionCss, /\.ops-school-card-actions\s*\{[\s\S]*display: flex/);
  assert.match(completionCss, /@media \(max-width: 1100px\)[\s\S]*\.ops-school-catalog-command,[\s\S]*grid-template-columns: 1fr/);
  assert.match(completionCss, /\.ops-content-command-center\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto/);
  assert.match(completionCss, /\.ops-content-summary-strip\s*\{[\s\S]*min-width: 430px/);
  assert.match(completionCss, /\.ops-content-view-shell-head\s*\{[\s\S]*grid-template-columns: minmax\(420px, 1fr\) minmax\(220px, 0\.34fr\)/);
  assert.match(completionCss, /\.ops-content-view-tabs\s*\{[\s\S]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(completionCss, /\.ops-content-catalog-command\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto/);
  assert.match(completionCss, /\.ops-content-catalog-actions\s*\{[\s\S]*display: flex/);
  assert.doesNotMatch(completionCss, /\.ops-content-catalog-command article\s*\{/);
  assert.match(completionCss, /\.ops-content-catalog-grid\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(completionCss, /\.ops-content-card-actions\s*\{[\s\S]*display: flex/);
  assert.match(completionCss, /@media \(max-width: 1100px\)[\s\S]*\.ops-content-catalog-command,[\s\S]*grid-template-columns: 1fr/);
  assert.match(completionCss, /\.ops-content-editor-brief\s*\{[\s\S]*grid-template-columns: minmax\(220px, 0\.76fr\) minmax\(360px, 1\.24fr\)/);
  assert.match(completionCss, /\.ops-content-editor-metrics\s*\{[\s\S]*grid-template-columns: minmax\(120px, 1\.2fr\) repeat\(2, minmax\(74px, 0\.6fr\)\)/);
  assert.match(completionCss, /\.ops-access-workbench\s*\{[\s\S]*display: grid[\s\S]*gap: 10px/);
  assert.doesNotMatch(completionCss, /\.ops-school-workbench,\s*\n\.ops-content-workbench,\s*\n\.ops-access-workbench\s*\{[\s\S]*grid-template-columns: minmax\(360px, 0\.78fr\) minmax\(560px, 1\.22fr\)/);
  assert.doesNotMatch(completionCss, /\.ops-school-workbench,\s*\n\.ops-content-workbench\s*\{[\s\S]*grid-template-columns: minmax\(320px, 0\.54fr\) minmax\(720px, 1\.46fr\)/);
  assert.match(completionCss, /\.ops-school-workbench > \.ops-management-table,\s*\n\.ops-content-workbench > \.ops-management-table,\s*\n\.ops-student-workbench > \.ops-management-table\s*\{[\s\S]*margin-top: 0/);
  assert.match(completionCss, /\.ops-access-workbench > \.ops-management-table\s*\{[\s\S]*margin-top: 0/);
  assert.match(completionCss, /\.ops-student-editor-panel\s*\{[\s\S]*border-block: 1px solid/);
  assert.match(completionCss, /\.ops-student-editor-summary\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto/);
  assert.match(completionCss, /\.ops-student-editor-summary::after\s*\{[\s\S]*content: "\+"/);
  assert.match(completionCss, /\.ops-student-editor-disclosure\[open\] > \.ops-student-editor-summary::after\s*\{[\s\S]*content: "-"/);
  assert.match(completionCss, /\.ops-student-editor-body\s*\{[\s\S]*padding: 2px 0 14px/);
  assert.match(completionCss, /\.ops-form-group\s*\{[\s\S]*border-top: 1px solid/);
  assert.match(completionCss, /\.ops-school-card-stats\s*\{[\s\S]*border-block/);
  assert.match(completionCss, /\.ops-content-row-meta\s*\{[\s\S]*border-block/);
  assert.match(completionCss, /\.ops-student-row-metrics\s*\{[\s\S]*border-block/);
  assert.match(completionCss, /\.ops-access-row-meta\s*\{[\s\S]*border-block/);
  assert.match(completionJs, /class="ops-admin-hero reveal"/);
  assert.match(completionJs, /class="ops-admin-readout"/);
  assert.match(completionJs, /class="ops-admin-metrics reveal"/);
  assert.doesNotMatch(completionJs, /metric-strip reveal"><article class="metric-card"><strong>\$\{overviewStats\.schoolCount\}/);
  assert.doesNotMatch(completionJs, /alt="运营数据看板"/);
  assert.match(completionCss, /\.ops-admin-hero\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) minmax\(280px, 0\.34fr\)/);
  assert.match(completionCss, /\.ops-admin-hero\s*\{[\s\S]*padding: 0 0 12px/);
  assert.match(completionCss, /\.ops-admin-title h1\s*\{[\s\S]*font-size: clamp\(30px, 2\.6vw, 40px\)/);
  assert.match(completionJs, /管理目录数据、学生申请、支付发送、租户健康和 Agent 审计。这里是内部运营工作台。/);
  assert.match(completionCss, /\.ops-admin-readout\s*\{[\s\S]*border-left: 3px solid/);
  assert.match(completionCss, /\.ops-admin-metrics\s*\{[\s\S]*grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(completionJs, /<span>学生申请<\/span><\/article><article><strong>\$\{overviewStats\.followUpCount\}<\/strong><span>待跟进<\/span>/);
  assert.match(completionCss, /\.ops-admin-metrics article\s*\{[\s\S]*border-left: 1px solid/);
  assert.match(completionCss, /\.ops-admin-metrics strong,\s*\n\.ops-admin-metrics span\s*\{[\s\S]*overflow-wrap: anywhere/);
  assert.doesNotMatch(completionCss, /\.ops-admin-metrics\s*\{[\s\S]*grid-template-columns: repeat\(auto-fit, minmax\(120px, 1fr\)\)/);
  assert.match(completionCss, /@media \(max-width: 1100px\)[\s\S]*\.ops-admin-metrics\s*\{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(completionCss, /@media \(max-width: 620px\)[\s\S]*\.ops-admin-metrics,[\s\S]*grid-template-columns: 1fr/);
  assert.match(completionJs, /role="tablist"/);
  assert.match(completionJs, /role="tab" aria-selected/);
  assert.match(completionJs, /role="tabpanel"/);
  assert.match(completionJs, /setAttribute\("aria-selected", active \? "true" : "false"\)/);
  assert.match(completionJs, /function parseOpsHashRoute\(hash = location\.hash\)/);
  assert.match(completionJs, /function mergeOpsRouteState\(state = \{\}\)/);
  assert.match(completionJs, /function buildOpsHashRoute\(state = readOpsAdminState\(\)\)/);
  assert.match(completionJs, /function syncOpsHashRoute\(state = readOpsAdminState\(\)\)/);
  assert.match(completionJs, /function opsTabPanelAttrs\(section, state = readOpsAdminState\(\)\)/);
  assert.match(completionJs, /<section \$\{opsTabPanelAttrs\("overview", opsState\)\}>/);
  assert.match(completionJs, /<section \$\{opsTabPanelAttrs\("school", opsState\)\}>/);
  assert.match(completionJs, /<section \$\{opsTabPanelAttrs\("content", opsState\)\}>/);
  assert.match(completionJs, /<section \$\{opsTabPanelAttrs\("access", opsState\)\}>/);
  assert.match(completionJs, /<section \$\{opsTabPanelAttrs\("queue", opsState\)\}>/);
  assert.doesNotMatch(completionJs, /<section class="ops-tab-panel reveal active" data-ops-section="overview" role="tabpanel">/);
  assert.doesNotMatch(completionJs, /<section class="ops-tab-panel reveal" data-ops-section="access" role="tabpanel" hidden>/);
  assert.match(completionJs, /window\.addEventListener\("hashchange"/);
  assert.match(completionJs, /window\.addEventListener\("popstate"/);
  assert.match(completionJs, /#school\/\$\{normalizeOpsSchoolView\(state\.schoolView\)\}\/\$\{normalizeOpsSchoolTab\(state\.schoolEditorTab\)\}/);
  assert.match(completionJs, /#content\/\$\{normalizeOpsContentType\(state\.contentType\)\}\/\$\{normalizeOpsContentView\(state\.contentView\)\}/);
  assert.match(completionJs, /#students\/\$\{normalizeOpsStudentDetailTab\(state\.studentDetailTab\)\}/);
  assert.match(completionJs, /\["school", "学校数据", `\$\{overviewStats\.schoolCount\} 所`\]/);
  assert.match(completionJs, /\["students", "学生申请", `\$\{overviewStats\.followUpCount\} 待跟进`\]/);
  assert.match(completionCss, /\.ops-tab-nav\s*\{[^}]*position: static/);
  assert.doesNotMatch(completionCss, /\.ops-tab-nav\s*\{[^}]*position: sticky/);
  assert.match(completionCss, /\.ops-tab-nav\s*\{[\s\S]*box-shadow: none/);
  assert.match(completionCss, /\.ops-tab-nav\s*\{[\s\S]*grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(completionCss, /\.ops-tab-nav button small\s*\{[\s\S]*font-size: 11px/);
  assert.match(completionCss, /\.ops-tab-nav button span,\s*\n\.ops-tab-nav button small\s*\{[\s\S]*overflow-wrap: anywhere/);
  assert.match(completionCss, /@media \(max-width: 1100px\)[\s\S]*\.ops-tab-nav\s*\{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(completionCss, /@media \(max-width: 620px\)[\s\S]*\.ops-tab-nav\s*\{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(completionJs, /function renderOpsOverviewPriorityList\(stats, accessRows\)/);
  assert.match(completionJs, /function renderOpsOverviewHealthGrid\(stats, accessRows, agentOps\)/);
  assert.match(completionJs, /class="ops-overview-dashboard" aria-label="运营概览驾驶舱"/);
  assert.match(completionJs, /class="ops-overview-priority"/);
  assert.match(completionJs, /class="ops-overview-health"/);
  assert.match(completionJs, /<span class="module-kicker">今日处理<\/span><h2>先处理会影响申请闭环的事项<\/h2>/);
  assert.match(completionJs, /<span class="module-kicker">系统健康<\/span><h2>数据、支付、权限、Agent<\/h2>/);
  assert.match(completionJs, /class="ops-overview-snapshot" data-ops-overview-summary/);
  assert.match(completionJs, /class="ops-module-list"/);
  assert.match(completionJs, /class="ops-module-row"/);
  assert.doesNotMatch(completionJs, /class="ops-module-card"/);
  assert.doesNotMatch(completionJs, /class="ops-command-strip ops-overview-status"/);
  assert.doesNotMatch(completionJs, /data-ops-overview-summary[\s\S]{0,600}管理学校/);
  assert.match(completionJs, /class="ops-overview-section ops-analytics-grid"/);
  assert.match(completionJs, /<section class="ops-overview-section"><span class="module-kicker">管理门禁/);
  assert.match(completionJs, /function renderOpsRiskGrid\(stats\)[\s\S]*class="ops-risk-grid"/);
  assert.doesNotMatch(completionJs, /function renderOpsRiskGrid\(stats\)[\s\S]*class="response-grid"/);
  assert.match(completionJs, /<h2>上线前检查<\/h2><div class="ops-gate-list">/);
  assert.doesNotMatch(completionJs, /<h2>上线前检查<\/h2><div class="check-list">/);
  assert.doesNotMatch(completionJs, /detail-card action-panel"><span class="module-kicker">管理门禁/);
  assert.match(completionCss, /\.ops-module-list\s*\{[\s\S]*border-block: 1px solid/);
  assert.match(completionCss, /\.ops-module-row\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) minmax\(160px, 0\.42fr\) auto/);
  assert.match(completionCss, /\.ops-module-row\s*\{[\s\S]*box-shadow: none/);
  assert.match(completionCss, /\.ops-overview-dashboard\s*\{[\s\S]*grid-template-columns: minmax\(0, 1\.08fr\) minmax\(320px, 0\.92fr\)/);
  assert.match(completionCss, /\.ops-overview-priority,\s*\n\.ops-overview-health\s*\{[\s\S]*box-shadow: none/);
  assert.match(completionCss, /\.ops-overview-snapshot\s*\{[\s\S]*border-left: 3px solid/);
  assert.match(completionCss, /\.ops-overview-priority-item\s*\{[\s\S]*grid-template-columns: 54px minmax\(0, 1fr\) auto/);
  assert.match(completionCss, /\.ops-overview-health-grid\s*\{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(completionCss, /@media \(max-width: 1100px\)[\s\S]*\.ops-overview-dashboard,[\s\S]*grid-template-columns: 1fr/);
  assert.match(completionCss, /@media \(max-width: 620px\)[\s\S]*\.ops-overview-health-grid,[\s\S]*grid-template-columns: 1fr/);
  assert.match(completionCss, /\.ops-overview-section\s*\{[\s\S]*border-top: 1px solid/);
  assert.match(completionCss, /\.ops-overview-section\s*\{[\s\S]*box-shadow: none/);
  assert.match(completionCss, /\.ops-gate-list\s*\{[\s\S]*border-block: 1px solid/);
  assert.match(completionCss, /\.ops-gate-list label\s*\{[\s\S]*grid-template-columns: auto minmax\(0, 1fr\)/);
  assert.match(completionCss, /\.ops-risk-grid,\s*\n\.ops-agent-job-grid\s*\{[\s\S]*margin-top: 14px/);
  assert.match(completionCss, /\.ops-agent-job-grid\s*\{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(completionCss, /@media \(max-width: 620px\)[\s\S]*\.ops-agent-job-grid,[\s\S]*grid-template-columns: 1fr/);
  assert.match(completionCss, /\.ops-filter-bar,\s*\n\.ops-school-tools\s*\{[\s\S]*background: transparent/);
  assert.doesNotMatch(completionJs, /class="ops-school-tools" aria-label="内容数据筛选"/);
  assert.doesNotMatch(completionJs, /class="ops-school-tools" aria-label="账号权限筛选"/);
  assert.match(completionJs, /<div class="ops-school-tools">\s*<label><span>搜索学校/);
  assert.match(completionJs, /<div class="ops-filter-bar">\s*<label><span>搜索学生/);
  assert.match(completionCss, /\.ops-field-map-collapsible\s*\{[\s\S]*border-block: 1px solid/);
  assert.match(completionCss, /\.ops-import-panel\s*\{[\s\S]*border-block: 1px solid/);
  assert.match(completionCss, /\.ops-create-panel\s*\{[\s\S]*box-shadow: none/);
  assert.match(completionCss, /\.ops-content-public-preview\s*\{[\s\S]*background: transparent/);
  assert.match(completionJs, /function renderOpsSchoolOverviewPanel\(school = \{\}\)/);
  assert.match(completionJs, /class="ops-school-overview-panel" data-ops-school-overview/);
  assert.match(completionJs, /class="ops-school-summary-strip" aria-label="学校数据筛选摘要"/);
  assert.match(completionJs, /function renderOpsSchoolSelectedTaskStrip\(activeView, selectedSchool, activeTab\)/);
  assert.match(completionJs, /class="ops-school-task-strip" data-ops-school-selected-task/);
  assert.match(completionJs, /<span class="module-kicker">当前学校任务<\/span>/);
  assert.doesNotMatch(completionJs, /class="ops-school-task-actions"/);
  assert.doesNotMatch(completionJs, /data-ops-school-open-view="edit" data-school-id="\$\{escapeHtml\(selectedSchool\.id\)\}" type="button">继续编辑/);
  assert.match(completionJs, /class="ops-school-catalog-command" aria-label="学校数据操作"/);
  assert.match(completionJs, /class="ops-school-command-copy"/);
  assert.match(completionJs, /class="ops-school-command-actions"/);
  assert.doesNotMatch(completionJs, /class="ops-school-catalog-command" aria-label="学校数据操作">[\s\S]{0,120}\s*<article>/);
  assert.match(completionJs, /data-ops-school-open-view="preview"/);
  assert.match(completionJs, /data-ops-school-open-view="model"/);
  assert.match(completionJs, /function openOpsSchoolRecordView\(schoolId, view = "edit"\)/);
  assert.match(completionJs, /const schoolOpenView = event\.target\.closest\("\[data-ops-school-open-view\]"\)/);
  assert.doesNotMatch(completionJs, /<aside class="ops-school-catalog-aside">/);
  assert.match(completionJs, /\["overview", "概览"\]/);
  assert.match(completionJs, /\["basic", "基础信息"\]/);
  assert.match(completionJs, /\["admissions", "申请要求"\]/);
  assert.match(completionJs, /\["costs", "费用与链接"\]/);
  assert.match(completionJs, /\["contact", "联系与规模"\]/);
  assert.match(completionJs, /basic:\s*`\s*\$\{renderSchoolFieldGroup\("basic", school\)\}/);
  assert.doesNotMatch(completionJs, /basic:\s*`[\s\S]{0,100}renderOpsSchoolPublicPreview\(school\)/);
  assert.match(completionCss, /\.ops-school-preview-disclosure/);
  assert.match(completionCss, /\.ops-school-public-preview\s*\{[\s\S]*padding: 14px 16px 16px/);
  assert.match(completionCss, /\.ops-preview-metrics article,\s*\n\.ops-preview-grid article\s*\{[\s\S]*border-left: 1px solid/);
  assert.match(completionCss, /\.ops-relation-summary\s*\{[\s\S]*border-left: 2px solid/);
  assert.match(completionCss, /\.ops-aggregate-grid article\s*\{[\s\S]*border-left: 2px solid/);
  assert.match(completionCss, /\.ops-student-alert\s*\{[\s\S]*background: transparent/);
  assert.match(completionCss, /\.ops-student-alert\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto/);
  assert.match(completionCss, /\.ops-student-profile-grid\s*\{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(completionCss, /\.ops-account-grid\s*\{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(completionCss, /\.ops-choice-list article\s*\{[\s\S]*grid-template-columns: minmax\(150px, 1\.1fr\) minmax\(170px, 1\.1fr\) minmax\(76px, 0\.45fr\) minmax\(94px, 0\.5fr\) minmax\(86px, 0\.45fr\) minmax\(110px, 0\.55fr\)/);
  assert.match(completionJs, /class="ops-student-action-bar" aria-label="学生申请操作"/);
  assert.match(completionJs, /class="ops-student-action-primary"/);
  assert.match(completionJs, /class="ops-student-action-secondary"/);
  assert.match(completionJs, /class="ops-student-action-danger"/);
  assert.doesNotMatch(completionJs, /class="ops-student-action-group/);
  assert.match(completionJs, /class="ops-student-action-summary"/);
  assert.match(completionJs, /class="ops-student-case-strip" aria-label="申请交接摘要"/);
  assert.match(completionJs, /<span><small>学校选择<\/small><strong>\$\{choiceCount\}<\/strong><\/span>/);
  assert.doesNotMatch(completionJs, /class="ops-student-case-strip" aria-label="申请交接摘要">\s*<article>/);
  assert.match(completionJs, /class="ops-student-detail-tabs" aria-label="学生详情分区" role="tablist"/);
  assert.match(completionJs, /data-ops-student-detail-panel=/);
  assert.match(completionJs, /class="ops-choice-list ops-student-handoff-table" role="table"/);
  assert.match(completionJs, /function setOpsStudentDetailTab\(tab\)/);
  assert.match(completionJs, /function openOpsStudentRecordTab\(studentId, tab = "overview"\)/);
  assert.match(completionJs, /const studentOpenTab = event\.target\.closest\("\[data-ops-student-open-tab\]"\)/);
  assert.match(completionJs, /function applyOpsStudentQuickFilter\(filter\)/);
  assert.match(completionJs, /const studentQuickFilter = event\.target\.closest\("\[data-ops-student-quick-filter\]"\)/);
  assert.match(completionCss, /\.ops-student-workbench\s*\{[\s\S]*grid-template-columns: 1fr/);
  assert.doesNotMatch(completionCss, /\.ops-student-workbench\s*\{[\s\S]*grid-template-columns: minmax\(360px, 0\.48fr\) minmax\(0, 1\.52fr\)/);
  assert.ok(
    completionJs.indexOf("ops-student-action-bar", completionJs.indexOf("function renderOpsStudentDetail")) < completionJs.indexOf("ops-student-case-strip", completionJs.indexOf("function renderOpsStudentDetail")),
    "Student action bar should appear before the case handoff summary.",
  );
  assert.ok(
    completionJs.indexOf("ops-student-case-strip", completionJs.indexOf("function renderOpsStudentDetail")) < completionJs.indexOf("ops-student-detail-tabs", completionJs.indexOf("function renderOpsStudentDetail")),
    "Student case summary should appear before the detail tabs.",
  );
  assert.ok(
    completionJs.indexOf("ops-student-alert", completionJs.indexOf("function renderOpsStudentDetail")) < completionJs.indexOf("ops-student-profile-grid", completionJs.indexOf("function renderOpsStudentDetail")),
    "Student status alert should appear before profile facts.",
  );
  assert.match(completionCss, /\.ops-student-action-bar\s*\{[\s\S]*display: grid/);
  assert.match(completionCss, /\.ops-student-action-bar\s*\{[\s\S]*grid-template-columns: minmax\(260px, 1fr\) auto minmax\(0, auto\) auto/);
  assert.match(completionCss, /\.ops-student-action-bar\s*\{[\s\S]*border-bottom: 1px solid/);
  assert.match(completionCss, /\.ops-student-action-primary,\s*\n\.ops-student-action-secondary,\s*\n\.ops-student-action-danger\s*\{[\s\S]*display: flex/);
  assert.match(completionCss, /\.ops-student-action-danger\s*\{[\s\S]*border-left: 1px solid/);
  assert.doesNotMatch(completionCss, /\.ops-student-action-group\s*\{/);
  assert.match(completionCss, /\.ops-student-command-center\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto auto/);
  assert.match(completionCss, /\.ops-student-command-metrics\s*\{[\s\S]*grid-template-columns: repeat\(3, minmax\(64px, 1fr\)\)/);
  assert.match(completionCss, /\.ops-student-command-actions\s*\{[\s\S]*display: flex/);
  assert.match(completionCss, /\.ops-student-card-actions\s*\{[\s\S]*display: flex/);
  assert.match(completionCss, /\.ops-student-case-strip\s*\{[\s\S]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(completionCss, /\.ops-student-case-strip > span\s*\{[\s\S]*border-left: 1px solid/);
  assert.match(completionCss, /@media \(max-width: 1100px\)[\s\S]*\.ops-student-command-center\s*\{[\s\S]*grid-template-columns: 1fr/);
  assert.match(completionCss, /@media \(max-width: 620px\)[\s\S]*\.ops-student-action-bar\s*\{[\s\S]*grid-template-columns: 1fr/);
  assert.match(completionJs, /class="ops-access-card-actions" aria-label="账号操作"/);
  assert.match(completionCss, /\.ops-access-card-actions\s*\{[\s\S]*display: flex/);
  assert.doesNotMatch(completionCss, /\.ops-access-card-actions\s*\{[\s\S]{0,140}grid-template-columns: repeat\(3, minmax\(96px, 1fr\)\)/);
  assert.match(completionCss, /\.ops-access-card-actions \.secondary-action\.danger\s*\{[\s\S]*color: var\(--completion-danger\)/);
  assert.match(completionCss, /\.ops-access-command-center\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto auto/);
  assert.match(completionCss, /\.ops-access-command-metrics\s*\{[\s\S]*grid-template-columns: repeat\(3, minmax\(68px, 1fr\)\)/);
  assert.match(completionCss, /\.ops-access-command-actions\s*\{[\s\S]*display: flex/);
  assert.match(completionCss, /\.ops-access-view-tabs\s*\{[\s\S]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(completionCss, /\.ops-access-view-panel\[hidden\]\s*\{[\s\S]*display: none/);
  assert.match(completionCss, /\.ops-access-panel-brief\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto/);
  assert.match(completionJs, /class="ops-record-editor ops-school-editor" data-ops-school-editor/);
  assert.match(completionJs, /class="ops-record-editor ops-content-editor" data-ops-content-editor/);
  assert.match(completionJs, /class="ops-student-detail" data-ops-student-detail/);
  assert.doesNotMatch(completionJs, /class="detail-card ops-record-editor/);
  assert.doesNotMatch(completionJs, /class="detail-card ops-student-detail/);
  assert.doesNotMatch(completionJs, /class="detail-card ops-school-editor" data-ops-content-editor/);
  assert.doesNotMatch(completionJs, /class="detail-card ops-school-editor ops-error-state" data-ops-content-editor/);
  assert.match(completionCss, /\.ops-record-editor\s*\{[\s\S]*border: 1px solid rgb\(0 125 118 \/ 0\.18\)/);
  assert.match(completionCss, /\.ops-record-editor\s*\{[\s\S]*box-shadow: none/);
  assert.match(completionCss, /\.ops-student-detail\s*\{[\s\S]*border: 1px solid rgb\(0 125 118 \/ 0\.16\)/);
  assert.match(completionCss, /\.ops-student-detail\s*\{[\s\S]*box-shadow: none/);
  assert.match(completionJs, /<section class="ops-error-state" role="alert">/);
  assert.doesNotMatch(completionJs, /class="detail-card ops-error-state"/);
  assert.match(completionCss, /\.ops-error-state\s*\{[\s\S]*border: 1px solid rgb\(175 59 50 \/ 0\.2\)/);
  assert.match(completionCss, /\.ops-error-state\s*\{[\s\S]*box-shadow: none/);
  assert.match(completionJs, /class="ops-access-boundary-panel ops-access-boundary-disclosure"/);
  assert.match(completionJs, /class="ops-access-boundary-list"/);
  assert.doesNotMatch(completionJs, /class="ops-access-boundary-panel"[\s\S]{0,260}<div class="check-list"/);
  assert.doesNotMatch(completionJs, /<article class="detail-card">\s*<span class="module-kicker">权限边界/);
  assert.match(completionCss, /\.ops-access-boundary-panel\s*\{[\s\S]*border-block: 1px solid/);
  assert.match(completionCss, /\.ops-access-boundary-panel\s*\{[\s\S]*box-shadow: none/);
  assert.match(completionCss, /\.ops-access-boundary-summary\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto auto/);
  assert.match(completionCss, /\.ops-access-boundary-summary::after\s*\{[\s\S]*content: "\+"/);
  assert.match(completionCss, /\.ops-access-boundary-disclosure\[open\] > \.ops-access-boundary-summary::after\s*\{[\s\S]*content: "-"/);
  assert.match(completionCss, /\.ops-access-card\s*\{[\s\S]*border-bottom: 1px solid/);
  assert.match(completionCss, /\.ops-access-boundary-list\s*\{[\s\S]*border-block: 1px solid/);
  assert.match(completionCss, /\.ops-access-boundary-list label\s*\{[\s\S]*grid-template-columns: auto minmax\(0, 1fr\)/);
  assert.match(completionCss, /\.ops-access-action-panel\s*\{[\s\S]*border-block: 1px solid/);
  assert.match(completionCss, /\.ops-access-action-panel \+ \.ops-access-action-panel\s*\{[\s\S]*margin-top: 10px/);
  assert.match(completionCss, /\.ops-access-action-summary\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto/);
  assert.match(completionCss, /\.ops-access-action-summary::after\s*\{[\s\S]*content: "\+"/);
  assert.match(completionCss, /\.ops-access-disclosure-panel\[open\] > \.ops-access-action-summary::after\s*\{[\s\S]*content: "-"/);
  assert.match(completionCss, /\.ops-access-action-body\s*\{[\s\S]*padding: 2px 0 14px/);
  assert.match(completionCss, /@media \(max-width: 1100px\)[\s\S]*\.ops-access-command-center\s*\{[\s\S]*grid-template-columns: 1fr/);
  assert.match(completionCss, /@media \(max-width: 1100px\)[\s\S]*\.ops-access-view-tabs\s*\{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(completionCss, /@media \(max-width: 620px\)[\s\S]*\.ops-access-view-tabs,[\s\S]*grid-template-columns: 1fr/);
  assert.match(completionJs, /class="ops-queue-impact-card"/);
  assert.doesNotMatch(completionJs, /class="ops-impact-card"/);
  assert.match(completionCss, /\.ops-queue-detail-grid article,\s*\n\.ops-queue-impact-card,\s*\n\.ops-agent-readiness-card,\s*\n\.ops-support-result\s*\{[\s\S]*border-left: 1px solid/);
  assert.match(completionCss, /\.ops-content-editor-section\s*\{[\s\S]*border-top: 1px solid/);
  assert.match(completionCss, /\.ops-subrecord-field-group\s*\{[\s\S]*border-top: 1px solid/);
  assert.match(completionCss, /\.ops-summary-grid article\s*\{[\s\S]*border-left: 2px solid/);
  assert.doesNotMatch(completionJs, /class="ops-student-summary-strip"/);
  assert.match(completionJs, /class="ops-student-command-center" aria-label="学生申请操作台"/);
  assert.match(completionJs, /class="ops-student-command-copy"/);
  assert.match(completionJs, /class="ops-student-command-metrics" aria-label="学生申请处理摘要"/);
  assert.match(completionJs, /class="ops-student-command-actions"/);
  assert.doesNotMatch(completionJs, /class="ops-student-command-center" aria-label="学生申请操作台">[\s\S]{0,120}\s*<article>/);
  assert.doesNotMatch(completionCss, /\.ops-student-summary-strip/);
  assert.match(completionJs, /class="ops-content-summary-strip"/);
  assert.match(completionJs, /data-ops-content-filter-selected/);
  assert.match(completionJs, /function saveOpsContentEditor\(trigger = null\)/);
  assert.match(completionJs, /saveOpsContentEditor\(contentSave\)/);
  assert.match(completionCss, /\.ops-content-summary-strip\s*\{[\s\S]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(completionCss, /\.ops-content-summary-strip span\s*\{[\s\S]*overflow-wrap: anywhere/);
  assert.doesNotMatch(completionCss, /\.ops-content-summary-strip article\s*\{/);
  assert.doesNotMatch(completionCss, /\.ops-access-policy-strip/);
  assert.doesNotMatch(completionCss, /\.ops-access-summary-strip/);
  assert.match(completionJs, /const opsQueueViews = \[/);
  assert.match(completionJs, /function normalizeOpsQueueView/);
  assert.match(completionJs, /function renderOpsQueueViewTabs/);
  assert.doesNotMatch(completionJs, /function renderOpsQueueSummaryStrip/);
  assert.match(completionJs, /function renderOpsQueueCommandCenter\(queueRows = \[\], auditEvents = \[\], agentOps = \{\}, stats = \{\}\)/);
  assert.match(completionJs, /data-ops-queue-view="\$\{escapeHtml\(key\)\}"/);
  assert.match(completionJs, /data-ops-queue-view-panel="\$\{escapeHtml\(view\)\}"/);
  assert.match(completionJs, /#queue\/\$\{normalizeOpsQueueView\(state\.queueView\)\}/);
  assert.match(completionJs, /class="ops-queue-command-center" aria-label="运营队列操作台"/);
  assert.match(completionJs, /class="ops-queue-command-copy"/);
  assert.match(completionJs, /class="ops-queue-command-metrics" aria-label="运营队列摘要"/);
  assert.match(completionJs, /class="ops-queue-command-actions"/);
  assert.match(completionJs, /<span class="module-kicker">队列调度<\/span>/);
  assert.match(completionJs, /data-ops-queue-command-view="work" type="button">待办队列/);
  assert.match(completionJs, /data-ops-queue-command-view="audit" type="button">审计事件/);
  assert.match(completionJs, /data-ops-queue-command-view="support" type="button">支持查询/);
  assert.match(completionJs, /data-ops-queue-command-view="agent" type="button">Agent 运维/);
  assert.doesNotMatch(completionJs, /class="ops-queue-command-center" aria-label="运营队列操作台">[\s\S]{0,120}\s*<article>/);
  assert.match(completionJs, /const queueCommandView = event\.target\.closest\("\[data-ops-queue-command-view\]"\)/);
  assert.doesNotMatch(completionJs, /class="ops-queue-summary-strip"/);
  assert.doesNotMatch(completionCss, /\.ops-queue-summary-strip/);
  assert.match(completionCss, /\.ops-queue-command-center\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto auto/);
  assert.match(completionCss, /\.ops-queue-command-metrics\s*\{[\s\S]*grid-template-columns: repeat\(3, minmax\(68px, 1fr\)\)/);
  assert.match(completionCss, /\.ops-queue-command-actions\s*\{[\s\S]*display: flex/);
  assert.doesNotMatch(completionCss, /\.ops-queue-command-center article\s*\{/);
  assert.match(completionCss, /@media \(max-width: 1100px\)[\s\S]*\.ops-queue-command-center\s*\{[\s\S]*grid-template-columns: 1fr/);
  assert.match(completionCss, /\.ops-queue-view-tabs\s*\{[\s\S]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(completionCss, /\.ops-queue-card\s*\{[\s\S]*border-bottom: 1px solid/);
  assert.match(completionJs, /class="ops-queue-workspace"/);
  assert.match(completionJs, /class="ops-queue-shell"/);
  assert.match(completionJs, /class="ops-queue-section"/);
  assert.match(completionJs, /class="ops-queue-side-panel ops-queue-disclosure-panel"/);
  assert.match(completionJs, /class="ops-queue-ops-row"/);
  assert.match(completionJs, /class="ops-queue-section ops-support-console" data-ops-support-console/);
  assert.match(completionCss, /\.ops-queue-note\s*\{[\s\S]*font-size: 13px/);
  assert.doesNotMatch(completionJs, /<article class="detail-card">\s*<div class="section-head"><div><span class="module-kicker">队列/);
  assert.doesNotMatch(completionJs, /<article class="ops-queue-section">\s*<div class="section-head"><div><span class="module-kicker">支持控制台/);
  assert.doesNotMatch(completionJs, /<article class="detail-card" data-ops-agent-operations/);
  assert.doesNotMatch(completionJs, /<aside class="ops-queue-side">/);
  assert.match(completionCss, /\.ops-queue-workspace\s*\{[\s\S]*grid-template-columns: 1fr/);
  assert.match(completionCss, /\.ops-queue-main\s*\{[\s\S]*display: flex/);
  assert.match(completionCss, /\.ops-queue-main\s*\{[\s\S]*flex-direction: column/);
  assert.match(completionCss, /\.ops-queue-main > \.ops-queue-detail\s*\{[^}]*position: static/);
  assert.match(completionCss, /\.ops-queue-main > \.ops-queue-detail\s*\{[^}]*order: 2/);
  assert.doesNotMatch(completionCss, /\.ops-queue-main\s*\{[\s\S]*grid-template-columns: minmax\(360px, 0\.68fr\) minmax\(680px, 1\.32fr\)/);
  assert.doesNotMatch(completionCss, /\.ops-queue-main\s*\{[^}]*grid-template-columns: 1fr/);
  assert.doesNotMatch(completionCss, /\.ops-queue-main > \.ops-queue-detail\s*\{[^}]*grid-column/);
  assert.doesNotMatch(completionCss, /\.ops-queue-main > \.ops-queue-detail\s*\{[^}]*grid-row: 1 \/ span 2/);
  assert.match(completionCss, /\.ops-record-editor\s*\{[^}]*position: static/);
  assert.match(completionCss, /\.ops-student-detail\s*\{[^}]*position: static/);
  assert.match(completionCss, /\.side-stack\s*\{[^}]*position: static/);
  assert.match(completionCss, /\.city-side-stack\s*\{[^}]*position: static/);
  assert.match(completionCss, /body\[data-completion-page="ops"\] \.ops-record-editor,[\s\S]*body\[data-completion-page="ops"\] \.ops-tab-nav\s*\{[\s\S]*position: static/);
  assert.match(completionCss, /body\[data-completion-page="ops"\] \.ops-record-editor,[\s\S]*body\[data-completion-page="ops"\] \.ops-tab-nav\s*\{[\s\S]*align-self: stretch/);
  assert.doesNotMatch(completionCss, /\.ops-queue-main > \.ops-queue-detail\s*\{[^}]*position: sticky/);
  assert.doesNotMatch(completionJs, /<span class="module-kicker">Runbook<\/span>/);
  assert.match(completionJs, /<span class="module-kicker">处理手册<\/span>/);
  assert.doesNotMatch(completionCss, /\.ops-record-editor\s*\{[^}]*position: sticky/);
  assert.doesNotMatch(completionCss, /\.ops-student-detail\s*\{[^}]*position: sticky/);
  assert.doesNotMatch(completionCss, /\.side-stack\s*\{[^}]*position: sticky/);
  assert.doesNotMatch(completionCss, /\.city-side-stack\s*\{[^}]*position: sticky/);
  assert.match(completionCss, /\.ops-queue-ops-row\s*\{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(completionCss, /\.ops-queue-disclosure-summary\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto auto/);
  assert.match(completionCss, /\.ops-queue-disclosure-summary::after\s*\{[\s\S]*content: "\+"/);
  assert.match(completionCss, /\.ops-queue-section,\s*\n\.ops-queue-detail,\s*\n\.ops-queue-side-panel\s*\{[\s\S]*box-shadow: none/);
  assert.match(completionCss, /@media \(max-width: 1100px\)[\s\S]*\.ops-queue-command-center\s*\{[\s\S]*grid-template-columns: 1fr/);
  assert.match(completionCss, /@media \(max-width: 1100px\)[\s\S]*\.ops-queue-ops-row\s*\{[\s\S]*grid-template-columns: 1fr/);
  assert.match(completionCss, /@media \(max-width: 1100px\)[\s\S]*\.ops-queue-side,[\s\S]*position: static/);
  assert.match(completionCss, /\.ops-editor-note\s*\{[\s\S]*border-left: 3px solid/);
  assert.match(completionCss, /\.ops-editor-note\.danger\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto/);
  assert.match(completionCss, /\.ops-editor-tabs button\.active\s*\{[\s\S]*box-shadow: inset 0 -3px 0 #007d76/);
  assert.match(completionCss, /\.ops-import-body\s*\{[\s\S]*border-top: 1px solid/);
  assert.match(completionJs, /class="ops-editor-alert-stack"/);
  assert.match(completionJs, /class="section-head ops-school-editor-head"/);
  assert.match(completionJs, /class="ops-school-editor-metrics">\s*<span><small>当前分区/);
  assert.doesNotMatch(completionJs, /class="ops-school-editor-metrics">\s*<article>/);
  assert.match(completionJs, /class="ops-editor-tabs ops-school-editor-tabs" aria-label="学校编辑分区" role="tablist"/);
  assert.match(completionJs, /data-ops-school-tab="\$\{escapeHtml\(key\)\}" type="button" role="tab" aria-selected=/);
  assert.match(completionCss, /\.ops-school-editor-tabs\s*\{[\s\S]*display: flex/);
  assert.match(completionCss, /\.ops-school-editor-tabs\s*\{[\s\S]*overflow-x: auto/);
  assert.match(completionCss, /\.ops-school-editor-tabs\s*\{[\s\S]*border: 1px solid/);
  assert.match(completionCss, /\.ops-school-editor-tabs\s*\{[\s\S]*border-radius: 8px/);
  assert.match(completionCss, /@media \(max-width: 620px\)[\s\S]*\.ops-school-editor-tabs\s*\{[\s\S]*display: flex/);
  assert.match(completionCss, /\.ops-record-editor > \.section-head\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto/);
  assert.match(completionCss, /\.ops-record-editor > \.section-head\s*\{[\s\S]*padding: 22px 24px 18px/);
  assert.match(completionCss, /\.ops-school-editor > \.ops-school-editor-head\s*\{[\s\S]*padding: 20px 24px 14px/);
  assert.match(completionCss, /\.ops-school-editor > \.ops-school-editor-head\s*\{[\s\S]*border-bottom: 0/);
  assert.match(completionCss, /\.ops-content-editor > \.ops-content-editor-head\s*\{[\s\S]*padding: 20px 24px 18px/);
  assert.match(completionCss, /\.ops-content-editor > \.ops-content-editor-head\s*\{[\s\S]*border-bottom: 1px solid rgb\(0 125 118 \/ 0\.1\)/);
  assert.match(completionCss, /\.ops-record-editor > \.section-head > div:first-child\s*\{[\s\S]*gap: 9px/);
  assert.match(completionCss, /\.ops-editor-alert-stack\s*\{[\s\S]*padding: 16px 24px 0/);
  assert.match(completionCss, /\.ops-school-editor > \.ops-editor-alert-stack\s*\{[\s\S]*padding: 14px 24px 0/);
  assert.match(completionCss, /\.ops-school-editor > \.ops-editor-alert-stack \+ \.ops-school-editor-tabs\s*\{[\s\S]*margin-top: 14px/);
  assert.match(completionCss, /\.ops-content-editor > \.ops-editor-alert-stack\s*\{[\s\S]*padding: 16px 24px 0/);
  assert.match(completionCss, /\.ops-content-editor > \.ops-editor-alert-stack \+ \.ops-content-editor-tabs\s*\{[\s\S]*margin-top: 14px/);
  assert.match(completionCss, /\.ops-editor-alert-stack:not\(:has\(\.ops-editor-note:not\(\[hidden\]\)\)\)\s*\{[\s\S]*display: none/);
  assert.match(completionCss, /\.ops-editor-alert-stack \.ops-editor-note\.warn,\s*\n\.ops-editor-alert-stack \.ops-editor-note\.danger\s*\{[\s\S]*border-block: 1px solid/);
  assert.match(completionCss, /\.ops-editor-alert-stack \.ops-editor-note\.warn,\s*\n\.ops-editor-alert-stack \.ops-editor-note\.danger\s*\{[\s\S]*border-radius: 0/);
  assert.match(completionCss, /\.ops-editor-alert-stack \.ops-editor-note\.danger\s*\{[\s\S]*grid-template-columns: minmax\(138px, 0\.24fr\) minmax\(0, 1fr\) auto/);
  assert.match(completionCss, /@media \(max-width: 620px\)[\s\S]*\.ops-editor-alert-stack \.ops-editor-note\.warn,\s*\n  \.ops-editor-alert-stack \.ops-editor-note\.danger\s*\{[\s\S]*grid-template-columns: 1fr/);
  assert.match(completionCss, /\.ops-editor-tabs\s*\{[\s\S]*margin: 18px 20px 0/);
  assert.match(completionCss, /\.ops-school-editor-tabs\s*\{[\s\S]*margin: 12px 24px 0/);
  assert.match(completionCss, /body\[data-completion-page="ops"\] \.completion-main\s*\{[\s\S]*padding-bottom: 132px/);
  assert.match(completionCss, /\.ops-school-card\.selected,\s*\n\.ops-access-card\.selected,\s*\n\.ops-content-card\.selected,\s*\n\.ops-student-card\.selected\s*\{[\s\S]*box-shadow: inset 3px 0 0 #007d76/);
  assert.match(completionCss, /\.ops-management-row\s*\{[\s\S]*border-bottom: 1px solid/);
  assert.match(completionCss, /\.ops-subrecord-head\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto auto/);
  assert.match(completionCss, /\.ops-subrecord-head::after\s*\{[\s\S]*content: "\+"/);
  assert.match(completionCss, /\.ops-subrecord-disclosure\[open\] > \.ops-subrecord-head::after\s*\{[\s\S]*content: "-"/);
  assert.match(completionCss, /\.ops-subrecord-body\s*\{[\s\S]*padding: 12px 16px 16px/);
  assert.doesNotMatch(completionCss, /\.ops-school-card\.selected,\s*\n\.ops-access-card\.selected,\s*\n\.ops-content-card\.selected,\s*\n\.ops-student-card\.selected\s*\{[^}]*linear-gradient/);
  assert.match(completionCss, /\.ops-school-checkbox-grid/);
  assert.match(completionCss, /\.ops-form-grid\.compact/);
  assert.match(completionCss, /\.program-detail-hero/);
  assert.match(completionCss, /\.program-glance-band/);
  assert.match(completionCss, /\.program-card-grid/);
  assert.match(completionCss, /\.city-glance-band/);
  assert.match(completionCss, /\.city-glance-list/);
  assert.match(completionCss, /\.city-program-keywords/);
  assert.match(completionCss, /\.program-official-list/);
  assert.match(completionCss, /\.funding-detail-hero/);
  assert.match(completionCss, /\.funding-glance-band/);
  assert.match(completionCss, /\.funding-card-grid/);
  assert.match(completionCss, /\.routing-row/);
  assert.match(completionCss, /\.template-editor/);
  assert.match(completionCss, /\.response-grid/);
  assert.match(completionCss, /\.ops-queue/);
  assert.match(completionCss, /\.ops-tab-nav/);
  assert.match(completionCss, /\.ops-tab-panel/);
  assert.match(completionCss, /\.ops-overview-grid/);
  assert.match(completionCss, /\.ops-module-list/);
  assert.match(completionCss, /\.ops-management-row/);
  assert.match(completionCss, /\.ops-analytics-grid/);
  assert.match(completionCss, /\.support-lookup/);
  assert.match(completionCss, /\.audit-list/);

  assert.match(programsJs, /program-detail\.html\?program=/);
  assert.match(programsJs, /university-detail\.html\?university=/);
  assert.match(universitiesJs, /data-university-card/);
  assert.match(universitiesJs, /university-detail\.html\?university=/);
  assert.match(scholarships, /scholarship-detail\.html\?scholarship=csc/);
  assert.match(scholarshipsJs, /scholarship-detail\.html\?scholarship=/);
  assert.match(cities, /city-detail\.html\?city=hangzhou/);
  assert.match(citiesJs, /city-detail\.html\?city=/);
  assert.match(guides, /guide-detail\.html\?guide=documents/);
  assert.match(guides, /data-application-timeline/);
  assert.match(guides, /data-application-window-list/);
  assert.match(guides, /data-timeline-filter-panel/);
  assert.match(guidesJs, /getApplicationTimeline/);
  assert.match(guidesJs, /renderApplicationTimeline/);
  assert.match(guidesJs, /renderTimelineDeadlineBoard/);
  assert.match(guidesJs, /function readTimelineRouteState/);
  assert.match(guidesJs, /params\.get\("timelineQuery"\) \|\| params\.get\("keyword"\) \|\| params\.get\("q"\)/);
  assert.match(guidesJs, /data-timeline-search/);
  assert.match(guidesJs, /data-timeline-deadline-filter/);
  assert.match(guidesJs, /data-timeline-tag-filter/);
  assert.match(guidesJs, /data-timeline-result-mode="program"/);
  assert.match(guidesJs, /data-timeline-school-result/);
  assert.match(guidesCss, /\.timeline-filter-panel/);
  assert.match(guidesCss, /\.timeline-school-list/);
  assert.match(application, /href="billing\.html"/);
  assert.match(schoolPortal, /href="school-settings\.html"/);
  assert.match(preferences, /Billing and receipts/);
  assert.match(sharedJs, /\["billing\.html", icons\.intent, "Billing"\]/);

  assert.match(schoolSettings, /data-portal-role="school"/);
  assert.match(schoolSettings, /data-agent-mode="school"/);
  assert.match(completionJs, /无跨校数据/);
  assert.match(completionJs, /内部运营/);
  assert.match(completionJs, /ops-review-agent-audit/);
  assert.match(completionJs, /recordOpsAction\("review-agent-audit"\)/);
  assert.match(opsAdmin, /data-completion-page="ops"/);
  assert.match(opsAdmin, /data-agent-mode="ops"/);
  assert.match(opsAdmin, /data-cuac-agent/);
});

test("keeps frontend mock business data behind CuacDataClient", async () => {
  const [
    cuacData,
    cuacActions,
    application,
    applicationJs,
    schoolPortal,
    schoolPortalJs,
    billing,
    completionJs,
    completionCss,
    programs,
    programsJs,
    universities,
    universitiesJs,
    scholarships,
    scholarshipsJs,
    cities,
    citiesJs,
    guides,
    guidesJs,
    legacySpec,
    mockDataSpec,
    apiSpec,
    dbSpec,
    cscaliteTypes,
    cscaliteSchoolBackendTypes,
    cscaliteAdminScholarshipsService,
  ] = await Promise.all([
    readFile(new URL("../public/cuac-data.js", import.meta.url), "utf8"),
    readFile(new URL("../public/cuac-actions.js", import.meta.url), "utf8"),
    readFile(new URL("../public/application.html", import.meta.url), "utf8"),
    readFile(new URL("../public/application.js", import.meta.url), "utf8"),
    readFile(new URL("../public/school-portal.html", import.meta.url), "utf8"),
    readFile(new URL("../public/school-portal-runtime.js", import.meta.url), "utf8"),
    readFile(new URL("../public/billing.html", import.meta.url), "utf8"),
    readFile(new URL("../public/completion.js", import.meta.url), "utf8"),
    readFile(new URL("../public/completion.css", import.meta.url), "utf8"),
    readFile(new URL("../public/programs.html", import.meta.url), "utf8"),
    readFile(new URL("../public/programs.js", import.meta.url), "utf8"),
    readFile(new URL("../public/universities.html", import.meta.url), "utf8"),
    readFile(new URL("../public/universities.js", import.meta.url), "utf8"),
    readFile(new URL("../public/scholarships.html", import.meta.url), "utf8"),
    readFile(new URL("../public/scholarships.js", import.meta.url), "utf8"),
    readFile(new URL("../public/cities.html", import.meta.url), "utf8"),
    readFile(new URL("../public/cities.js", import.meta.url), "utf8"),
    readFile(new URL("../public/guides.html", import.meta.url), "utf8"),
    readFile(new URL("../public/guides.js", import.meta.url), "utf8"),
    readFile(new URL("../../CUAC_LEGACY_FIELD_MAPPING_SPEC.md", import.meta.url), "utf8"),
    readFile(new URL("../../CUAC_FRONTEND_MOCK_DATA_CONTRACT.md", import.meta.url), "utf8"),
    readFile(new URL("../../CUAC_APPLICATION_API_CONTRACT.md", import.meta.url), "utf8"),
    readFile(new URL("../../CUAC_DATABASE_ERD_SPEC.md", import.meta.url), "utf8"),
    readFile("D:/CODE/CSCAlite/frontend/src/lib/api-types.ts", "utf8"),
    readFile("D:/CODE/CSCAlite/backend/src/schools/schools.types.ts", "utf8"),
    readFile("D:/CODE/CSCAlite/backend/src/schools/admin-scholarships.service.ts", "utf8"),
  ]);

  assert.match(cuacData, /window\.CuacDataClient/);
  assert.match(cuacData, /legacyFieldContracts/);
  assert.match(cuacData, /sourceProject:\s*"D:\\\\CODE\\\\CSCAlite"/);
  assert.match(cuacData, /sourceFiles:\s*\[/);
  assert.match(cuacData, /sourceModelFields:\s*\{/);
  assertCscaliteTypeCoverage(cscaliteTypes, cuacData, [
    ["School", "School"],
    ["SchoolDetail", "SchoolDetail"],
    ["SchoolQuickFacts", "SchoolQuickFacts"],
    ["SchoolDetailDisplay", "SchoolDetailDisplay"],
    ["SchoolProgramDisplayGroup", "SchoolProgramDisplayGroup"],
    ["SchoolApplicationTimelineItem", "SchoolApplicationTimelineItem"],
    ["SchoolUpcomingDeadline", "SchoolUpcomingDeadline"],
    ["SchoolSearchParams", "SchoolSearchParams"],
    ["SchoolListFacets", "SchoolListFacets"],
    ["SchoolListResult", "SchoolListResult"],
    ["PublicContentBlock", "PublicContentBlock"],
    ["AdminContentBlock", "AdminContentBlock"],
    ["SavedSchool", "SavedSchool"],
    ["CompareSchool", "CompareSchool"],
    ["CompareDetailsResult", "CompareDetailsResult"],
    ["AdminSchoolSummary", "AdminSchoolSummary"],
    ["AdminSchoolDetail", "AdminSchoolDetail"],
    ["SchoolChangeLog", "SchoolChangeLog"],
    ["SchoolProgram", "SchoolProgram"],
    ["SchoolCscaRule", "SchoolCscaRule"],
    ["SchoolScholarship", "SchoolScholarship"],
    ["Scholarship", "PublicScholarship"],
    ["ScholarshipBodySection", "ScholarshipBodySection"],
    ["ScholarshipBenefitItem", "ScholarshipBenefitItem"],
    ["ScholarshipInfoItem", "ScholarshipInfoItem"],
    ["ScholarshipContactInfo", "ScholarshipContactInfo"],
    ["ScholarshipActionLink", "ScholarshipActionLink"],
    ["ScholarshipStats", "ScholarshipStats"],
    ["ScholarshipListResult", "ScholarshipListResult"],
    ["ScholarshipTypeSummary", "ScholarshipTypeSummary"],
    ["ScholarshipCountrySummary", "ScholarshipCountrySummary"],
    ["ScholarshipCountriesResult", "ScholarshipCountriesResult"],
    ["ScholarshipDetailResult", "ScholarshipDetailResult"],
    ["AdminScholarship", "AdminScholarship"],
    ["CityGuide", "CityGuide"],
    ["CityGuideContent", "CityGuideContent"],
    ["CityGuideAggregate", "CityGuideAggregate"],
    ["CityGuideDetail", "CityGuideDetail"],
    ["ApplicationTimelineWindow", "ApplicationTimelineWindow"],
    ["ApplicationTimelineProject", "ApplicationTimelineProject"],
    ["ApplicationTimelineSchool", "ApplicationTimelineSchool"],
    ["ApplicationTimelineResponse", "ApplicationTimelineResponse"],
    ["SearchItem", "SearchItem"],
    ["SearchResult", "SearchResult"],
    ["User", "User"],
    ["AuthResult", "AuthResult"],
    ["StudentProfile", "StudentProfile"],
    ["AdminUser", "AdminUser"],
    ["AdminAIOrganization", "AdminAIOrganization"],
    ["AdminAIOrganizationInviteCreateResult", "AdminAIOrganizationInviteCreateResult"],
    ["AdminAIOrganizationAdminAssignmentResult", "AdminAIOrganizationAdminAssignmentResult"],
    ["AdminAIOrganizationInviteBulkReissueResult", "AdminAIOrganizationInviteBulkReissueResult"],
    ["AdminAIOrganizationInviteHistory", "AdminAIOrganizationInviteHistory"],
    ["OrganizationInviteAcceptResult", "OrganizationInviteAcceptResult"],
    ["PricingLine", "PricingLine"],
    ["PricingSummary", "PricingSummary"],
    ["CartItem", "CartItem"],
    ["CartResult", "CartResult"],
    ["CommerceOrder", "CommerceOrder"],
    ["PaymentCreateResult", "PaymentCreateResult"],
    ["AuditItem", "AuditItem"],
    ["AdminAuditSummary", "AdminAuditSummary"],
    ["AdminAuditEvent", "AdminAuditEvent"],
    ["AdminReadinessEvidenceFile", "AdminReadinessEvidenceFile"],
    ["AdminReadinessEvidenceDetail", "AdminReadinessEvidenceDetail"],
  ]);
  assertCscaliteTypeCoverage(cscaliteSchoolBackendTypes, cuacData, [
    ["AdminSchoolUpdateInput", "AdminSchoolUpdateInput"],
    ["AdminSchoolCreateInput", "AdminSchoolCreateInput"],
    ["AdminSchoolImportInput", "AdminSchoolImportInput"],
    ["AdminSchoolProgramInput", "AdminSchoolProgramInput"],
    ["AdminSchoolCscaRuleInput", "AdminSchoolCscaRuleInput"],
    ["AdminSchoolScholarshipInput", "AdminSchoolScholarshipInput"],
  ]);
  assertCscaliteLocalTypeCoverage(cscaliteAdminScholarshipsService, cuacData, [
    ["AdminScholarshipInput", "AdminScholarshipInput"],
  ]);
  assert.match(cuacData, /School:\s*\[[\s\S]*"officialWebsiteUrl"[\s\S]*"admissionsWebsiteUrl"[\s\S]*"scholarshipsDetailed"/);
  assert.match(cuacData, /SchoolDetail:\s*\[[\s\S]*"applicationPortalNotes"[\s\S]*"campusHighlights"[\s\S]*"contactNotes"/);
  assert.match(cuacData, /SchoolQuickFacts:\s*\[[\s\S]*"location"[\s\S]*"tuition"[\s\S]*"livingCost"[\s\S]*"programCount"[\s\S]*"englishProgramCount"/);
  assert.match(cuacData, /SchoolDetailDisplay:\s*\[[\s\S]*"city"[\s\S]*"regionLabel"[\s\S]*"displayProgramCount"[\s\S]*"programDisplayGroups"[\s\S]*"applicationTimeline"/);
  assert.match(cuacData, /SchoolProgramDisplayGroup:\s*\[[\s\S]*"key"[\s\S]*"label"[\s\S]*"total"[\s\S]*"visibleCount"[\s\S]*"hiddenNote"/);
  assert.match(cuacData, /SchoolApplicationTimelineItem:\s*\[[\s\S]*"key"[\s\S]*"label"[\s\S]*"dateLabel"[\s\S]*"startDate"[\s\S]*"endDate"[\s\S]*"description"[\s\S]*"statusLabel"/);
  assert.match(cuacData, /SchoolUpcomingDeadline:\s*\[[\s\S]*"programId"[\s\S]*"programName"[\s\S]*"deadlineDate"[\s\S]*"daysUntilDeadline"[\s\S]*"statusLabel"/);
  assert.match(cuacData, /SchoolSearchParams:\s*\[[\s\S]*"keyword"[\s\S]*"pageSize"[\s\S]*"hasScholarship"[\s\S]*"hasCscaRules"[\s\S]*"hasDetailedScholarship"/);
  assert.match(cuacData, /SchoolListFacets:\s*\[[\s\S]*"regions"[\s\S]*"schoolTypes"[\s\S]*"cscaOptions"[\s\S]*"applicationLevels"/);
  assert.match(cuacData, /SchoolListResult:\s*\[[\s\S]*"items"[\s\S]*"pagination"[\s\S]*"totalPages"[\s\S]*"facets"[\s\S]*"appliedFiltersSummary"/);
  assert.match(cuacData, /PublicContentBlock:\s*\[[\s\S]*"key"[\s\S]*"locale"[\s\S]*"requestedLocale"[\s\S]*"isFallback"[\s\S]*"title"[\s\S]*"body"[\s\S]*"updatedAt"/);
  assert.match(cuacData, /AdminContentBlock:\s*\[[\s\S]*"key"[\s\S]*"title"[\s\S]*"body"[\s\S]*"id"[\s\S]*"status"[\s\S]*"sortOrder"[\s\S]*"version"/);
  assert.match(cuacData, /SavedSchool:\s*\[[\s\S]*"savedAt"/);
  assert.match(cuacData, /CompareSchool:\s*\[[\s\S]*"comparedAt"/);
  assert.match(cuacData, /CompareDetailsResult:\s*\[[\s\S]*"items"/);
  assert.match(cuacData, /AdminSchoolSummary:\s*\[[\s\S]*"verificationStatus"[\s\S]*"status"[\s\S]*"completenessLabel"[\s\S]*"missingFields"/);
  assert.match(cuacData, /AdminSchoolDetail:\s*\[[\s\S]*"schoolType"[\s\S]*"sourceId"[\s\S]*"programs"[\s\S]*"cscaRules"[\s\S]*"scholarshipsDetailed"/);
  assert.match(cuacData, /AdminSchoolUpdateInput:\s*\[[\s\S]*"expectedVersion"[\s\S]*"nameZh"[\s\S]*"officialWebsiteUrl"[\s\S]*"programs"[\s\S]*"scholarshipsDetailed"[\s\S]*"status"/);
  assert.match(cuacData, /AdminSchoolCreateInput:\s*\[[\s\S]*"expectedVersion"[\s\S]*"nameZh"[\s\S]*"schoolType"[\s\S]*"programs"[\s\S]*"status"/);
  assert.match(cuacData, /AdminSchoolImportInput:\s*\[[\s\S]*"items"/);
  assert.match(cuacData, /AdminSchoolProgramInput:\s*\[[\s\S]*"expectedVersion"[\s\S]*"degreeLevel"[\s\S]*"teachingLanguage"[\s\S]*"applicationUrl"[\s\S]*"sourceLabel"[\s\S]*"sortOrder"[\s\S]*"status"/);
  assert.match(cuacData, /AdminSchoolCscaRuleInput:\s*\[[\s\S]*"programId"[\s\S]*"cscaSubjects"[\s\S]*"languageCondition"[\s\S]*"importantNote"[\s\S]*"sourceLabel"[\s\S]*"sortOrder"/);
  assert.match(cuacData, /AdminSchoolScholarshipInput:\s*\[[\s\S]*"programId"[\s\S]*"applicableDegree"[\s\S]*"applicableProgram"[\s\S]*"amountText"[\s\S]*"requirementText"[\s\S]*"sourceLabel"[\s\S]*"sortOrder"/);
  assert.match(cuacData, /SchoolChangeLog:\s*\[[\s\S]*"actorEmail"[\s\S]*"before"[\s\S]*"after"[\s\S]*"changes"/);
  for (const field of [
    "city",
    "regionLabel",
    "applicationLevel",
    "cscaSubjects",
    "languageRequirement",
    "englishRequirement",
    "deadlineSummary",
    "officialWebsiteUrl",
    "admissionsWebsiteUrl",
    "qualityScore",
    "missingFields",
    "completenessLabel",
    "programCount",
    "englishProgramCount",
    "hasEnglishPrograms",
    "hasScholarships",
    "subjectTags",
    "languageTags",
    "scholarshipsDetailed",
    "upcomingDeadlines",
    "quickFacts",
    "detailDisplay",
  ]) {
    assert.match(cuacData, new RegExp(`"${field}"`));
  }
  assert.match(cuacData, /SchoolProgram:\s*\[[\s\S]*"deadlineDate"[\s\S]*"applicationUrl"[\s\S]*"isVerified"[\s\S]*"hasScholarship"[\s\S]*"displayTuition"[\s\S]*"displaySubjects"[\s\S]*"displayGroupLabel"[\s\S]*"version"[\s\S]*"scholarshipLinks"/);
  assert.match(cuacData, /SchoolCscaRule:\s*\[[\s\S]*"schoolId"[\s\S]*"programId"[\s\S]*"title"[\s\S]*"category"[\s\S]*"cscaSubjects"[\s\S]*"applicablePrograms"[\s\S]*"importantNote"[\s\S]*"sortOrder"[\s\S]*"status"[\s\S]*"isVerified"/);
  assert.match(cuacData, /SchoolScholarship:\s*\[[\s\S]*"schoolId"[\s\S]*"programId"[\s\S]*"amountText"[\s\S]*"deadlineDate"[\s\S]*"applicationRound"[\s\S]*"scholarshipSlug"[\s\S]*"isCsc"[\s\S]*"isVerified"[\s\S]*"version"[\s\S]*"program"/);
  assert.match(cuacData, /function schoolQuickFactItems\(school = \{\}\)/);
  assert.match(cuacData, /function schoolProgramDisplayGroups\(school = \{\}\)/);
  assert.match(cuacData, /function schoolApplicationTimeline\(school = \{\}\)/);
  assert.match(cuacData, /quickFacts: schoolQuickFactItems\(school\)/);
  assert.match(cuacData, /const schoolScholarshipCatalog = \[/);
  assert.match(cuacData, /function getSchoolScholarshipRecords\(program = \{\}\)/);
  assert.match(cuacData, /fromSchoolScholarshipRecords: schoolScholarships\.map/);
  assert.match(cuacData, /scholarshipSignals: scholarshipRecords/);
  assert.match(cuacData, /Scholarship:\s*\[[\s\S]*"typeLabel"[\s\S]*"fundingLevel"[\s\S]*"schoolId"[\s\S]*"schoolName"[\s\S]*"schoolCount"[\s\S]*"programId"[\s\S]*"programName"[\s\S]*"applicationMaterials"[\s\S]*"deadline"[\s\S]*"tags"[\s\S]*"version"/);
  assert.match(cuacData, /ScholarshipBodySection:\s*\[[\s\S]*"title"[\s\S]*"body"[\s\S]*"paragraphs"[\s\S]*"items"/);
  assert.match(cuacData, /ScholarshipBenefitItem:\s*\[[\s\S]*"key"[\s\S]*"label"[\s\S]*"included"[\s\S]*"note"/);
  assert.match(cuacData, /ScholarshipInfoItem:\s*\[[\s\S]*"label"[\s\S]*"value"[\s\S]*"body"/);
  assert.match(cuacData, /ScholarshipContactInfo:\s*\[[\s\S]*"email"[\s\S]*"phone"[\s\S]*"website"[\s\S]*"address"/);
  assert.match(cuacData, /ScholarshipActionLink:\s*\[[\s\S]*"label"[\s\S]*"url"[\s\S]*"kind"/);
  assert.match(cuacData, /ScholarshipStats:\s*\[[\s\S]*"total"[\s\S]*"fullFunding"[\s\S]*"government"[\s\S]*"countries"[\s\S]*"types"/);
  assert.match(cuacData, /ScholarshipListResult:\s*\[[\s\S]*"items"[\s\S]*"pagination"[\s\S]*"facets"[\s\S]*"stats"/);
  assert.match(cuacData, /ScholarshipDetailResult:\s*\[[\s\S]*"item"[\s\S]*"schools"[\s\S]*"programs"[\s\S]*"similar"/);
  assert.match(cuacData, /AdminScholarship:\s*\[[\s\S]*"providerName"[\s\S]*"providerNameEn"[\s\S]*"providerLocation"[\s\S]*"schoolIds"[\s\S]*"programIds"[\s\S]*"status"[\s\S]*"version"[\s\S]*"createdAt"[\s\S]*"updatedAt"/);
  assert.match(cuacData, /AdminScholarshipInput:\s*\[[\s\S]*"expectedVersion"[\s\S]*"title"[\s\S]*"bodySections"[\s\S]*"contactInfo"[\s\S]*"schoolIds"[\s\S]*"programIds"/);
  assert.match(cuacData, /AdminScholarshipImportInput:\s*\[[\s\S]*"items"[\s\S]*"expectedVersion"[\s\S]*"title"[\s\S]*"schoolIds"[\s\S]*"programIds"/);
  assert.match(cuacData, /CityGuide:\s*\[[\s\S]*"content"[\s\S]*"contentJson"[\s\S]*"references"[\s\S]*"referenceCscaSchoolCount"[\s\S]*"version"[\s\S]*"updatedAt"/);
  assert.match(cuacData, /CityGuideContent:\s*\[[\s\S]*"summary"[\s\S]*"budgetSummary"[\s\S]*"costProfiles"[\s\S]*"applicationAdvice"[\s\S]*"cityFaqs"/);
  assert.match(cuacData, /CityGuideDetail:\s*\[[\s\S]*"city"[\s\S]*"aggregate"/);
  assert.match(cuacData, /if \(typeof items === "string"\) \{/);
  assert.match(cuacData, /function cityStructuredList\(value = \[\]\)/);
  assert.match(cuacData, /const items = cityStructuredList\(hasSourceValue\(nextSteps\)/);
  assert.match(cuacData, /ApplicationTimelineWindow:\s*\[[\s\S]*"month"[\s\S]*"title"[\s\S]*"applicationWindow"[\s\S]*"cscaWindow"[\s\S]*"status"[\s\S]*"sortOrder"[\s\S]*"version"[\s\S]*"updatedAt"/);
  assert.match(cuacData, /ApplicationTimelineProject:\s*\[[\s\S]*"schoolId"[\s\S]*"schoolName"[\s\S]*"deadlineDate"[\s\S]*"applicationRound"[\s\S]*"tags"/);
  assert.match(cuacData, /ApplicationTimelineSchool:\s*\[[\s\S]*"school"[\s\S]*"rows"[\s\S]*"earliest"/);
  assert.match(cuacData, /ApplicationTimelineResponse:\s*\[[\s\S]*"stats"[\s\S]*"windows"[\s\S]*"schools"[\s\S]*"programs"/);
  assert.match(cuacData, /fallbackApplicationTimelineWindows/);
  assert.match(cuacData, /function getApplicationTimeline\(\)/);
  assert.match(cuacData, /readOpsPreviewList\("timelineWindowRecords"\)/);
  assert.match(cuacData, /TimelineWindow:\s*\{[\s\S]*collection: "getApplicationTimeline"/);
  assert.match(cuacData, /getApplicationTimeline,/);
  assert.match(cuacData, /SearchItem:\s*\[[\s\S]*"type"[\s\S]*"title"[\s\S]*"snippet"[\s\S]*"href"[\s\S]*"score"[\s\S]*"metadata"/);
  assert.match(cuacData, /SearchResult:\s*\[[\s\S]*"query"[\s\S]*"total"[\s\S]*"degraded"[\s\S]*"items"[\s\S]*"groups"/);
  assert.match(cuacData, /User:\s*\[[\s\S]*"email"[\s\S]*"role"[\s\S]*"displayName"[\s\S]*"emailVerifiedAt"[\s\S]*"googleLinked"/);
  assert.match(cuacData, /AuthResult:\s*\[[\s\S]*"user"[\s\S]*"tokens"[\s\S]*"accessToken"[\s\S]*"refreshToken"/);
  assert.match(cuacData, /StudentProfile:\s*\[[\s\S]*"nationality"[\s\S]*"nationalityCode"[\s\S]*"country"[\s\S]*"countryCode"[\s\S]*"grade"[\s\S]*"gradeCode"[\s\S]*"currentOrganizationId"[\s\S]*"updatedAt"/);
  assert.match(cuacData, /AdminUser:\s*\[[\s\S]*"email"[\s\S]*"role"[\s\S]*"status"[\s\S]*"agentAccessStatus"[\s\S]*"agentMemoryState"[\s\S]*"agentMemoryUntil"[\s\S]*"createdAt"[\s\S]*"updatedAt"/);
  assert.doesNotMatch(cuacData, /"aiBalanceUnits"|"aiLifetimeGranted"|"aiLifetimeUsed"/);
  assert.match(cuacData, /AdminAIOrganization:\s*\[[\s\S]*"members"[\s\S]*"cohorts"[\s\S]*"invites"[\s\S]*"inviteAttempts"[\s\S]*"llmProviderConfigs"/);
  assert.match(cuacData, /AdminAIOrganizationInviteCreateResult:\s*\[[\s\S]*"token"[\s\S]*"shortCode"[\s\S]*"acceptPath"/);
  assert.match(cuacData, /AdminAIOrganizationAdminAssignmentResult:\s*\[[\s\S]*"assignment"[\s\S]*"email"[\s\S]*"status"[\s\S]*"userId"[\s\S]*"inviteId"[\s\S]*"acceptPath"/);
  assert.match(cuacData, /AdminAIOrganizationInviteBulkReissueResult:\s*\[[\s\S]*"invites"[\s\S]*"sourceInviteId"[\s\S]*"token"[\s\S]*"shortCode"[\s\S]*"acceptPath"/);
  assert.match(cuacData, /AdminAIOrganizationInviteHistory:\s*\[[\s\S]*"effectiveStatus"[\s\S]*"acceptedAt"[\s\S]*"canRevealToken"/);
  assert.match(cuacData, /OrganizationInviteAcceptResult:\s*\[[\s\S]*"accepted"[\s\S]*"organization"[\s\S]*"membership"[\s\S]*"role"[\s\S]*"status"[\s\S]*"invite"[\s\S]*"usedCount"[\s\S]*"maxUses"/);
  assert.match(cuacData, /CartResult:\s*\[[\s\S]*"items"[\s\S]*"pricing"/);
  assert.match(cuacData, /CommerceOrder:\s*\[[\s\S]*"providerTxnId"[\s\S]*"payableTotalCents"[\s\S]*"pricingBreakdown"/);
  assert.match(cuacData, /PaymentCreateResult:\s*\[[\s\S]*"paymentId"[\s\S]*"orderId"[\s\S]*"callbackSignaturePayload"[\s\S]*"testCallbackSignature"/);
  assert.match(cuacData, /AuditItem:\s*\[[\s\S]*"id"[\s\S]*"title"[\s\S]*"status"[\s\S]*"detail"/);
  assert.match(cuacData, /AdminAuditSummary:\s*\[[\s\S]*"schoolsTotal"[\s\S]*"schoolsVerified"[\s\S]*"adminAuditEventCount"[\s\S]*"latestAdminAuditEventAt"[\s\S]*"schoolChangeCount"/);
  assert.match(cuacData, /AdminAuditEvent:\s*\[[\s\S]*"actorEmail"[\s\S]*"organizationSlug"[\s\S]*"targetEmail"[\s\S]*"resourceType"[\s\S]*"before"[\s\S]*"after"[\s\S]*"createdAt"/);
  assert.match(cuacData, /AdminReadinessEvidenceFile:\s*\[[\s\S]*"name"[\s\S]*"kind"[\s\S]*"phase"[\s\S]*"source"[\s\S]*"sizeBytes"[\s\S]*"modifiedAt"/);
  assert.match(cuacData, /AdminReadinessEvidenceDetail:\s*\[[\s\S]*"file"[\s\S]*"content"/);
  assert.match(cuacData, /displayAliases:\s*\{/);
  assert.doesNotMatch(cuacData, /School:\s*\[[\s\S]*"officialWebsite"[\s\S]*"applicationSystemUrl"[\s\S]*"detailedScholarships"/);
  assert.doesNotMatch(cuacData, /School:\s*\[[\s\S]*"englishRequirementNote"/);
  assert.doesNotMatch(cuacData, /School:\s*\[[\s\S]*"round1Deadline"/);
  assert.doesNotMatch(cuacData, /School:\s*\[[\s\S]*"tuitionByCategory"/);
  assert.doesNotMatch(cuacData, /School:\s*\[[\s\S]*"under18GuardianRequired"/);
  assert.match(cuacData, /"Program\.name": "SchoolProgram\.nameEn"/);
  assert.match(cuacData, /auditEvidence:\s*\{[\s\S]*checkedAt:\s*"2026-08-20"[\s\S]*verifiedModels:\s*\["School", "SchoolDetail", "SchoolQuickFacts", "SchoolDetailDisplay", "SchoolProgramDisplayGroup", "SchoolApplicationTimelineItem", "SchoolUpcomingDeadline", "SchoolSearchParams", "SchoolListFacets", "SchoolListResult", "PublicContentBlock", "AdminContentBlock", "SavedSchool", "CompareSchool", "CompareDetailsResult", "AdminSchoolSummary", "AdminSchoolDetail", "AdminSchoolUpdateInput", "AdminSchoolCreateInput", "AdminSchoolImportInput", "AdminSchoolProgramInput", "AdminSchoolCscaRuleInput", "AdminSchoolScholarshipInput", "SchoolChangeLog", "SchoolProgram", "SchoolCscaRule", "SchoolScholarship", "Scholarship", "ScholarshipBodySection", "ScholarshipBenefitItem", "ScholarshipInfoItem", "ScholarshipContactInfo", "ScholarshipActionLink", "ScholarshipStats", "ScholarshipListResult", "ScholarshipTypeSummary", "ScholarshipCountrySummary", "ScholarshipCountriesResult", "ScholarshipDetailResult", "AdminScholarship", "AdminScholarshipInput", "AdminScholarshipImportInput", "ScholarshipSchool", "ScholarshipProgram", "CityGuide", "CityGuideContent", "CityGuideAggregate", "CityGuideDetail", "ApplicationTimelineWindow", "ApplicationTimelineProject", "ApplicationTimelineSchool", "ApplicationTimelineResponse", "SearchItem", "SearchResult", "User", "AuthResult", "StudentProfile", "AdminUser", "AdminAIOrganization", "AdminAIOrganizationInviteCreateResult", "AdminAIOrganizationAdminAssignmentResult", "AdminAIOrganizationInviteBulkReissueResult", "AdminAIOrganizationInviteHistory", "OrganizationInviteAcceptResult", "PricingLine", "PricingSummary", "CartItem", "CartResult", "CommerceOrder", "PaymentCreateResult", "AuditItem", "AdminAuditSummary", "AdminAuditEvent", "AdminReadinessEvidenceFile", "AdminReadinessEvidenceDetail"\]/);
  assert.match(cuacData, /entityContracts:\s*\{[\s\S]*Program:\s*\{[\s\S]*legacyModel:\s*"SchoolProgram"[\s\S]*backendType:\s*"SchoolProgramRecord"/);
  assert.match(cuacData, /SchoolDisplaySurface:\s*\{[\s\S]*legacyModel:\s*"SchoolQuickFacts \+ SchoolDetailDisplay \+ SchoolProgramDisplayGroup \+ SchoolApplicationTimelineItem \+ SchoolUpcomingDeadline"[\s\S]*agentBoundary:\s*"SchoolDisplaySurface is student-readable derived display context/);
  assert.match(cuacData, /SchoolCatalog:\s*\{[\s\S]*legacyModel:\s*"SchoolSearchParams \+ SchoolListFacets \+ SchoolListResult"[\s\S]*agentBoundary:\s*"SchoolCatalog supports public discovery/);
  assert.match(cuacData, /ContentDiscovery:\s*\{[\s\S]*legacyModel:\s*"PublicContentBlock \+ AdminContentBlock \+ SearchItem \+ SearchResult"[\s\S]*agentBoundary:\s*"ContentDiscovery gives Guides and Agent references/);
  assert.match(cuacData, /SavedCompare:\s*\{[\s\S]*legacyModel:\s*"SavedSchool \+ CompareSchool \+ CompareDetailsResult"[\s\S]*agentBoundary:\s*"Saved and compared schools support student planning/);
  assert.match(cuacData, /AdminSchool:\s*\{[\s\S]*legacyModel:\s*"AdminSchoolSummary \+ AdminSchoolDetail \+ AdminSchoolUpdateInput \+ AdminSchoolCreateInput \+ AdminSchoolImportInput \+ AdminSchoolProgramInput \+ AdminSchoolCscaRuleInput \+ AdminSchoolScholarshipInput"[\s\S]*agentBoundary:\s*"AdminSchool is an internal management view/);
  assert.match(cuacData, /SchoolChangeLog:\s*\{[\s\S]*legacyModel:\s*"SchoolChangeLog"[\s\S]*agentBoundary:\s*"SchoolChangeLog is internal audit evidence/);
  assert.match(cuacData, /SchoolScholarship:\s*\{[\s\S]*agentBoundary:\s*"SchoolScholarship is school-scoped funding context and must not be flattened into public Scholarship records\."/);
  assert.match(cuacData, /SchoolCscaRule:\s*\{[\s\S]*legacyModel:\s*"SchoolCscaRule"[\s\S]*agentBoundary:\s*"SchoolCscaRule informs eligibility and document planning/);
  assert.match(cuacData, /PublicScholarship:\s*\{[\s\S]*legacyModel:\s*"Scholarship \+ ScholarshipBodySection \+ ScholarshipBenefitItem \+ ScholarshipInfoItem \+ ScholarshipContactInfo \+ ScholarshipActionLink \+ ScholarshipListResult \+ ScholarshipDetailResult"[\s\S]*bodySections/);
  assert.match(cuacData, /AdminScholarship:\s*\{[\s\S]*legacyModel:\s*"AdminScholarship \+ AdminScholarshipInput \+ importAdminScholarships"[\s\S]*canonicalKeys:\s*\[[\s\S]*"expectedVersion"[\s\S]*"items"[\s\S]*"schoolIds"[\s\S]*"programIds"[\s\S]*agentBoundary:\s*"AdminScholarship is an internal management view/);
  assert.match(cuacData, /TimelineWindow:\s*\{[\s\S]*legacyModel:\s*"ApplicationTimelineWindow \+ ApplicationTimelineProject \+ ApplicationTimelineSchool \+ ApplicationTimelineResponse"[\s\S]*agentBoundary:\s*"Timeline windows and deadline projects guide planning/);
  assert.match(cuacData, /StudentProfile:\s*\{[\s\S]*legacyModel:\s*"StudentProfile"[\s\S]*agentBoundary:\s*"StudentProfile can continue a student's logged-in application context/);
  assert.match(cuacData, /AccessGovernance:\s*\{[\s\S]*legacyModel:\s*"AuthResult \+ User \+ AdminUser \+ AdminAIOrganization \+ AdminAIOrganizationInviteCreateResult \+ AdminAIOrganizationAdminAssignmentResult \+ AdminAIOrganizationInviteBulkReissueResult \+ AdminAIOrganizationInviteHistory \+ OrganizationInviteAcceptResult"[\s\S]*agentBoundary:\s*"Access governance determines/);
  assert.match(cuacData, /OpsAuditGovernance:\s*\{[\s\S]*legacyModel:\s*"AuditItem \+ AdminAuditSummary \+ AdminAuditEvent \+ AdminReadinessEvidenceFile \+ AdminReadinessEvidenceDetail"[\s\S]*agentBoundary:\s*"OpsAuditGovernance is CUAC-internal evidence/);
  assert.match(cuacData, /CommerceFlow:\s*\{[\s\S]*legacyModel:\s*"CartResult \+ CommerceOrder \+ PaymentCreateResult"[\s\S]*agentBoundary:\s*"Commerce state gates school sending/);
  assert.match(cuacData, /function getLegacyEntityContract\(entityName\)/);
  assert.match(cuacData, /checkedAt:\s*"2026-08-20"/);
  assert.match(cuacData, /checkedSourceProject:\s*"D:\\\\CODE\\\\CSCAlite"/);
  assert.match(cuacData, /currentBaseline:\s*\{/);
  assert.match(cuacData, /CityGuideAggregate:\s*\[[\s\S]*"actualProgramCount"[\s\S]*"visibleScholarships"/);
  assert.match(cuacData, /function cityRelatedSchools\(city = \{\}\)/);
  assert.match(cuacData, /function cityRelatedPrograms\(city = \{\}\)/);
  assert.match(cuacData, /function cityRelatedScholarships\(city = \{\}, relatedSchools = \[\]\)/);
  assert.match(cuacData, /relatedSchools,\s*\n\s*relatedPrograms,\s*\n\s*relatedScholarships/);
  assert.match(cuacData, /function getLegacySourceCoverageAudit\(\)/);
  assert.match(cuacData, /function getLegacyContractReadiness\(\)/);
  assert.match(cuacData, /legacyRuntimeReadinessRules/);
  assert.match(cuacData, /function sourceFieldLineage\(modelName, displayAliasPrefix\)/);
  assert.match(cuacData, /sourceFieldLineage:\s*sourceFieldLineage\("SchoolProgram", "Program"\)/);
  assert.match(cuacData, /sourceFieldLineage:\s*sourceFieldLineage\("School", "School"\)/);
  assert.match(cuacData, /sourceFieldLineage:\s*sourceFieldLineage\("Scholarship", "Scholarship"\)/);
  assert.match(cuacData, /sourceFieldLineage:\s*sourceFieldLineage\("CityGuide", "City"\)/);
  assert.match(cuacData, /sourceFieldLineage:\s*\{[\s\S]*selectedByStudent: "Student-selected route fields constrained by School and SchoolProgram catalog IDs\."/);
  assert.match(cuacData, /informationSources:\s*handoff[\s\S]*sourceFieldLineage:\s*handoff\.sourceFieldLineage/);
  assert.match(cuacData, /sourceFieldLineage:\s*record\.sourceFieldLineage \|\| record\.informationSources\?\.sourceFieldLineage \|\| null/);
  assert.match(cuacData, /backend\/prisma\/schema\.prisma/);
  assert.match(cuacData, /backend\/src\/schools\/schools\.types\.ts/);
  assert.match(cuacData, /backend\/src\/schools\/schools\.service\.ts/);
  assert.match(cuacData, /backend\/src\/schools\/admin-scholarships\.service\.ts/);
  assert.match(cuacData, /backend\/src\/study-china\/study-china\.types\.ts/);
  assert.match(cuacData, /frontend\/src\/pages\/AdminSchoolsPage\.tsx/);
  assert.match(cuacData, /frontend\/src\/pages\/AdminScholarshipsPage\.tsx/);
  assert.match(cuacData, /frontend\/src\/lib\/api-admin\.ts/);
  assert.match(cuacData, /frontend\/src\/lib\/api-scholarships\.ts/);
  assert.match(cuacData, /"sourceNote"/);
  assert.match(cuacData, /"officialWebsiteUrl"/);
  assert.match(cuacData, /"admissionsWebsiteUrl"/);
  assert.match(cuacData, /"deadlineSummary"/);
  assert.match(cuacData, /"tuitionSummary"/);
  assert.match(cuacData, /"fitNotes"/);
  assert.match(cuacData, /"programSubjectTags"/);
  assert.match(cuacData, /"programTuitionBandLabel"/);
  assert.match(cuacData, /"programQualityIssues"/);
  assert.match(cuacData, /"requiredSubjectTags"/);
  assert.match(cuacData, /publicScholarship:\s*\[[\s\S]*"sortOrder"/);
  assert.match(cuacData, /const cityContentJson = city\.contentJson \|\| city\.content \|\| \{\}/);
  assert.match(cuacData, /const content = \{/);
  assert.match(cuacData, /contentJson:\s*content/);
  assert.match(cuacData, /overview: cityContentJson\.overview \|\| city\.overview \|\| city\.summary \|\| ""/);
  assert.match(cuacData, /budgetSummary: cityContentJson\.budgetSummary \|\| city\.budgetSummary \|\| \{/);
  assert.match(cuacData, /costProfiles: cityContentJson\.costProfiles \|\| city\.costProfiles \|\| \[\]/);
  assert.match(cuacData, /applicationAdvice: cityContentJson\.applicationAdvice \|\| city\.applicationAdvice \|\| \[\]/);
  assert.match(cuacData, /cityFaqs: cityContentJson\.cityFaqs \|\| city\.cityFaqs \|\| \[\]/);
  assert.match(cuacData, /relatedProgramKeywords: "Recommended program directions"/);
  assert.match(cuacData, /transportNotes: "Transport and arrival"/);
  assert.match(cuacData, /nextSteps: "Next steps"/);
  assert.match(cuacData, /cityFaqs: "City questions"/);
  assert.match(cuacData, /sourceNote:\s*school\.sourceNote \|\| ""/);
  assert.match(cuacData, /fitNotes:\s*school\.fitNotes \|\| \[\]/);
  assert.match(cuacData, /programSubjectTags:\s*school\.programSubjectTags \|\| subjectTags/);
  assert.match(cuacData, /programTuitionBandLabel:\s*school\.programTuitionBandLabel \|\| tuitionSummary/);
  assert.match(cuacData, /programQualityIssues:\s*school\.programQualityIssues \|\| \[\]/);
  assert.match(cuacData, /requiredSubjectTags:\s*school\.requiredSubjectTags \|\| \[\]/);
  assert.match(cuacData, /getProgramCatalog/);
  assert.match(cuacData, /const routeContracts = \[/);
  assert.match(cuacData, /getRouteContracts/);
  assert.match(cuacData, /getRouteContract/);
  assert.match(cuacData, /getLegacyEntityContract/);
  assert.match(cuacData, /const agentContextPolicies = \{/);
  assert.match(cuacData, /getAgentContextPolicy/);
  assert.match(cuacData, /guest:\s*\{[\s\S]*authState:\s*"signed-out"[\s\S]*retention:\s*"current-page-session"[\s\S]*storage:\s*"session"[\s\S]*storageKey:\s*"cuacGuestAgentPageContext"/);
  assert.match(cuacData, /student:\s*\{[\s\S]*authState:\s*"signed-in"[\s\S]*retention:\s*"application-lifecycle"[\s\S]*storage:\s*"account"/);
  assert.match(cuacData, /clearTrigger:\s*"student-clears-memory-or-enrollment-archive"/);
  assert.match(cuacData, /schoolStaff:\s*\{[\s\S]*blockedContext:\s*\[[\s\S]*"student's other school choices"[\s\S]*"student private Agent memory"/);
  assert.match(cuacData, /primaryTask:\s*"Sign in or register for a CUAC account, then receive role and organization permissions\."/);
  assert.match(cuacData, /permissionRisk:\s*"High later; real auth must separate student, school, and CUAC staff permissions within one account system\."/);
  assert.match(cuacData, /route:\s*"application\.html"[\s\S]*surface:\s*"authenticated-student"[\s\S]*role:\s*"student"/);
  assert.match(cuacData, /route:\s*"school-portal\.html"[\s\S]*surface:\s*"school-staff"[\s\S]*role:\s*"school_staff"[\s\S]*permissionRisk:\s*"Critical; must show only this school's own records\."/);
  assert.match(cuacData, /Catalog list uses CuacDataClient, pagination, filters, compare state, and protected choice entry/);
  assert.match(cuacData, /student-readable field labels/);
  assert.match(cuacData, /Discovery scholarships use CuacDataClient with funding filters, student-readable actions, pagination, and matching-program exits/);
  assert.match(cuacData, /Detail shell resolves non-default discovery cities with student-readable city fields and route exits/);
  assert.match(cuacData, /Guide search references use CuacDataClient with page-context Agent prompts and detail exits/);
  assert.match(cuacData, /Fee calculation, payment state, consent, selected choices, and school records use CuacDataClient\/local state/);
  assert.match(cuacData, /Billing snapshot uses CuacDataClient and reflects payment failure, preview, paid, or free-submitted state/);
  assert.match(cuacData, /Tenant records, analytics loading, owner workload, export confirmation, and student feedback loop use CuacDataClient\/local state/);
  assert.match(cuacData, /Frontend settings preview covers staff seats, owner routing, templates, response targets, and local save/);
  assert.match(cuacData, /route:\s*"ops-admin\.html"[\s\S]*surface:\s*"cuac-internal"[\s\S]*role:\s*"cuac_ops"/);
  assert.match(cuacData, /requiredStates:\s*\["loading", "empty", "error", "success", "confirmation"\]/);
  assert.match(cuacData, /getDiscoveryPrograms/);
  assert.match(cuacData, /getDiscoverySchools/);
  assert.match(cuacData, /getDiscoveryScholarships/);
  assert.match(cuacData, /getDiscoveryCities/);
  assert.match(cuacData, /getDiscoveryGuides/);
  assert.match(cuacData, /getCompletionDetailCatalog/);
  assert.match(cuacData, /getCompletionDetail/);
  assert.match(cuacData, /const backendAdapterContract = \{/);
  assert.match(cuacData, /getBackendAdapterContract/);
  assert.match(cuacData, /savedDetailItems: "cuacSavedDetailItemsDemoState"/);
  assert.match(cuacData, /function readSavedDetailItems\(\)/);
  assert.match(cuacData, /function addSavedDetailItem\(item = \{\}\)/);
  assert.match(cuacData, /function routeProgramCatalogSnapshot\(route = \{\}\)/);
  assert.match(cuacData, /schoolId: program\.schoolId \|\| school\.id \|\| route\.schoolId/);
  assert.match(cuacData, /programId: program\.programId \|\| program\.id \|\| route\.programId/);
  assert.match(cuacData, /function opsProgramPreviewRecords\(\)/);
  assert.match(cuacData, /function opsSchoolScholarshipPreviewRecords\(\)/);
  assert.match(cuacData, /function enrichProgramScholarshipContext\(program = \{\}\)/);
  assert.match(cuacData, /opsSchoolScholarshipPreviewRecords\(\)/);
  assert.match(cuacData, /function scholarshipLinkedSchools\(item = \{\}\)/);
  assert.match(cuacData, /function scholarshipLinkedPrograms\(item = \{\}\)/);
  assert.match(cuacData, /Scholarship\.schoolIds/);
  assert.match(cuacData, /Scholarship\.programIds/);
  assert.match(cuacData, /function programCatalogDiscoveryRecords\(\)/);
  assert.match(cuacData, /const normalizedDiscovery = discoveryPrograms\.map\(normalizeDiscoveryProgram\)/);
  assert.match(cuacData, /mergePreviewRecords\(programCatalogDiscoveryRecords\(\), normalizedDiscovery, \["programId", "id"\]\)/);
  assert.match(cuacData, /mergePreviewRecords\(catalogBase, opsProgramPreviewRecords\(\), \["id", "programId"\]\)/);
  assert.match(cuacData, /map\(normalizeDiscoveryProgram\)\.map\(enrichProgramScholarshipContext\)/);
  assert.match(cuacData, /function getProgramCatalog\(\) \{[\s\S]*getDiscoveryPrograms\(\)\.reduce/);
  assert.match(cuacData, /const discoveryMatch = getDiscoveryPrograms\(\)\.find/);
  const dataClient = loadCuacDataClient(cuacData);
  const [program] = dataClient.getDiscoveryPrograms();
  const [school] = dataClient.getDiscoverySchools();
  const [scholarship] = dataClient.getDiscoveryScholarships();
  const [city] = dataClient.getDiscoveryCities();
  const programContract = dataClient.getLegacyEntityContract("SchoolProgram");
  const schoolFundingContract = dataClient.getLegacyEntityContract("SchoolScholarship");
  const publicScholarshipContract = dataClient.getLegacyEntityContract("Scholarship");
  const cityContract = dataClient.getLegacyEntityContract("CityGuide");
  const adapterContract = dataClient.getBackendAdapterContract();

  assert.equal(adapterContract.status, "frontend-demo-contract");
  assert.match(adapterContract.principle, /Pages call CuacDataClient methods/);
  assert.ok(adapterContract.authBoundary.mustRecheck.includes("tenantSchoolId"));
  assert.ok(adapterContract.authBoundary.mustRecheck.includes("continuationToken"));
  assert.ok(adapterContract.domains.some((item) => item.domain === "catalog" && item.currentMethods.includes("getDiscoveryPrograms") && item.productionEndpoints.includes("GET /api/catalog/programs")));
  assert.ok(adapterContract.domains.some((item) => item.domain === "applications_payments" && item.adapterNotes.includes("Payment failure keeps choices saved")));
  assert.ok(adapterContract.domains.some((item) => item.domain === "school_portal" && item.requiredScopes.includes("school_tenant") && item.adapterNotes.includes("tenantSchoolId server-side")));
  assert.ok(adapterContract.domains.some((item) => item.domain === "agent_actions" && item.requiredScopes.includes("guest_page") && item.requiredScopes.includes("ops_audit")));

  assert.equal(program.sourceFieldLineage.sourceModel, "SchoolProgram");
  assert.ok(program.sourceFieldLineage.sourceFields.includes("deadlineDate"));
  assert.ok(program.sourceFieldLineage.sourceFields.includes("applicationUrl"));
  assert.equal(program.sourceFieldLineage.displayAliases.name, "SchoolProgram.nameEn");
  assert.equal(program.school.sourceFieldLineage.sourceModel, "School");
  assert.ok(program.school.sourceFieldLineage.sourceFields.includes("admissionsWebsiteUrl"));

  const previewContext = loadCuacDataContext(cuacData);
  previewContext.localStorage.setItem("cuacOpsAdminDemoState", JSON.stringify({
    schoolRecords: [{
      id: "school-preview-01",
      nameZh: "预览大学",
      nameEn: "Preview University",
      cityZh: "杭州",
      region: "Zhejiang",
      status: "published",
      programs: [{
        id: "program-preview-01",
        schoolId: "school-preview-01",
        nameZh: "预览计算机硕士",
        nameEn: "Preview Computer Science MSc",
        degreeLevel: "Master",
        teachingLanguage: "English-taught",
        fieldCategory: "Computer Science",
        tuitionAmount: 42000,
        deadlineDate: "2026-10-15",
        deadlineLabel: "Oct 15",
        applicationRound: "Fall 2026",
        status: "draft",
      }],
      scholarshipsDetailed: [{
        id: "school-scholarship-preview-01",
        schoolId: "school-preview-01",
        programId: "program-preview-01",
        name: "Preview School Merit Award",
        type: "university",
        applicableDegree: "Master",
        applicableProgram: "Preview Computer Science MSc",
        amountText: "Partial tuition waiver",
        requirementText: "School confirms documents after contact.",
        deadlineDate: "2026-10-15",
        deadlineLabel: "Oct 15",
        applicationRound: "Fall 2026",
        status: "draft",
        isVerified: true,
      }],
    }],
    publicScholarshipRecords: [{
      id: "public-scholarship-preview-01",
      slug: "preview-linked-scholarship",
      title: "Preview Linked Public Scholarship",
      type: "university",
      fundingLevel: "partial",
      providerName: "Preview University",
      summary: "Public scholarship created from AdminScholarship relation IDs.",
      schoolIds: ["school-preview-01"],
      programIds: ["program-preview-01"],
      benefits: ["Tuition support"],
      applicationMaterials: [{ label: "Transcript", body: "Official academic record" }],
      status: "published",
    }],
    cityGuideRecords: [{
      id: "city-preview-01",
      slug: "preview-city",
      nameZh: "预览城市",
      nameEn: "Preview City",
      region: "Zhejiang",
      monthlyCost: 3100,
      costLevel: "medium",
      density: "student city",
      tags: ["Student city"],
      contentJson: {
        summary: "Preview city summary for students.",
        bestFor: ["Students comparing school-program choices"],
        transportNotes: ["Campus commute: confirm campus before renting"],
        applicationAdvice: [{ title: "Compare programs", body: "Use the city after academic fit is clear." }],
        nextSteps: [{ title: "Open matching programs", body: "Filter programs by Preview City and compare deadlines." }],
        relatedProgramKeywords: ["Computer Science"],
        cityFaqs: [{ question: "Should I choose by city first?", answer: "Use the city after program fit." }],
      },
      nearby: ["杭州", "Shanghai"],
      referenceProgramCount: 1,
      status: "published",
    }],
  }));
  const previewClient = previewContext.window.CuacDataClient;
  const previewProgram = previewClient.getDiscoveryPrograms().find((item) => item.id === "program-preview-01");
  assert.ok(previewProgram, "ops school program should enter public program discovery");
  assert.ok(previewProgram.schoolScholarships.some((item) => item.name === "Preview School Merit Award"), "ops SchoolScholarship should enrich public program discovery");
  assert.match(previewProgram.scholarshipText, /Preview School Merit Award/);
  const previewProgramDetail = previewClient.getCompletionDetail("program", "program-preview-01");
  assert.ok(previewProgramDetail.facts.some(([label, value]) => label === "Scholarship route" && /Preview School Merit Award/.test(value)));
  const [previewSubmittedRecord] = previewClient.buildSubmittedRecords({
    routes: [{
      schoolId: "school-preview-01",
      programId: "program-preview-01",
      university: "Preview University",
      program: "Preview Computer Science MSc",
      programName: "Preview Computer Science MSc",
      degree: "Master",
      intake: "Fall 2026",
      language: "English-taught",
    }],
    student: previewClient.defaultStudentProfile,
  });
  assert.ok(previewSubmittedRecord.informationSources.fromSchoolScholarshipRecords.some((item) => item.name === "Preview School Merit Award"));
  assert.ok(previewSubmittedRecord.scholarshipSignals.some((item) => item.name === "Preview School Merit Award"));
  const linkedPublicScholarship = previewClient.getCompletionDetail("scholarship", "preview-linked-scholarship");
  assert.ok(linkedPublicScholarship.scholarshipGuide.schoolCards.some((card) => /Preview University/.test(`${card.title} ${card.body}`)));
  assert.ok(linkedPublicScholarship.scholarshipGuide.programCards.some((card) => /Preview Computer Science MSc/.test(`${card.title} ${card.body}`)));
  assert.ok(linkedPublicScholarship.schemaSections.some((section) => section.rows.some(([label]) => label === "School IDs")));
  assert.ok(linkedPublicScholarship.schemaSections.some((section) => section.rows.some(([label]) => label === "Program IDs")));
  const previewCityDetail = previewClient.getCompletionDetail("city", "preview-city");
  assert.ok(previewCityDetail.cityGuide.nextSteps.some((item) => item.title === "Open matching programs"));
  assert.ok(previewCityDetail.cityGuide.nearbyCards.some((card) => /city=hangzhou/.test(card.href) && card.title === "Hangzhou"));
  assert.ok(previewCityDetail.cityGuide.nearbyCards.some((card) => /city=shanghai/.test(card.href) && card.title === "Shanghai"));
  assert.ok(!previewCityDetail.cityGuide.nearbyCards.some((card) => /city=preview-city/.test(card.href)));
  assert.ok(previewCityDetail.profileSections.some((section) => section.title === "Application planning" && section.rows.some(([label, value]) => /Open matching programs/.test(`${label} ${value}`))));
  assert.ok(previewCityDetail.schemaSections.some((section) => section.rows.some(([label]) => label === "Next steps")));
  assert.ok(previewCityDetail.schemaSections.some((section) => section.rows.some(([label]) => label === "Transport and arrival")));
  assert.ok(previewCityDetail.schemaSections.some((section) => section.rows.some(([label]) => label === "City questions")));

  assert.equal(school.sourceFieldLineage.sourceModel, "School");
  assert.equal(school.nameZh, "浙江大学");
  assert.ok(school.sourceFieldLineage.sourceFields.includes("officialWebsiteUrl"));
  assert.ok(school.sourceFieldLineage.sourceFields.includes("qualityScore"));
  assert.ok(school.sourceFieldLineage.sourceFields.includes("admissionsWebsiteUrl"));
  for (const field of [
    "applicationLevel",
    "languageRequirement",
    "hskRequirement",
    "englishRequirement",
    "deadlineSummary",
    "tuitionSummary",
    "scholarshipsDetailed",
    "quickFacts",
    "detailDisplay",
    "sourceId",
    "createdAt",
    "updatedAt",
  ]) {
    assert.ok(Object.prototype.hasOwnProperty.call(school, field), `School detail source record should preserve ${field}`);
  }

  assert.equal(scholarship.sourceFieldLineage.sourceModel, "Scholarship");
  assert.ok(scholarship.sourceFieldLineage.sourceFields.includes("fundingLevel"));
  assert.ok(scholarship.sourceFieldLineage.sourceFields.includes("applicationMaterials"));
  assert.equal(scholarship.sourceFieldLineage.displayAliases.name, "Scholarship.title");

  assert.equal(city.sourceFieldLineage.sourceModel, "CityGuide");
  assert.ok(city.sourceFieldLineage.sourceFields.includes("contentJson"));
  assert.ok(city.sourceFieldLineage.sourceFields.includes("referenceCscaSchoolCount"));
  assert.equal(city.sourceFieldLineage.displayAliases.name, "CityGuide.nameEn");

  const hubSummary = dataClient.getStudentHubSummary();
  const [hubRoute] = hubSummary.routes;
  assert.equal(hubRoute.schoolId, 101);
  assert.equal(hubRoute.programId, 10102);
  assert.equal(hubRoute.degreeLevel, "Master");
  assert.equal(hubRoute.teachingLanguage, "English-taught");
  assert.equal(hubRoute.deadlineLabel, "Oct 15");
  assert.equal(hubRoute.tuitionText, "RMB 42k");
  assert.equal(hubRoute.sourceFieldLineage.sourceModel, "SchoolProgram");

  const savedSummary = dataClient.getSavedItemsSummary();
  const savedProgram = savedSummary.items.find((item) => item.type === "program" && item.programId === 10102);
  assert.equal(savedProgram.schoolId, 101);
  assert.equal(savedProgram.degreeLevel, "Master");
  assert.equal(savedProgram.teachingLanguage, "English-taught");
  assert.equal(savedProgram.deadlineLabel, "Oct 15");
  assert.equal(savedProgram.sourceFieldLineage.sourceModel, "SchoolProgram");
  dataClient.addSavedDetailItem({
    id: "detail-program-qa",
    type: "program",
    entityType: "Program",
    entityId: "qa-program",
    title: "QA saved detail",
    meta: "QA University · Hangzhou",
    facts: ["Oct 15", "RMB 42k"],
    status: "ready",
    href: "program-detail.html?program=qa",
    sourceFieldLineage: { sourceModel: "SchoolProgram", sourceFields: ["nameEn"] },
  });
  const dynamicSaved = dataClient.getSavedItemsSummary().items.find((item) => item.id === "detail-program-qa");
  assert.equal(dynamicSaved.entityType, "Program");
  assert.equal(dynamicSaved.sourceFieldLineage.sourceModel, "SchoolProgram");

  const programDetail = dataClient.getCompletionDetail("program", "zju-cs-msc");
  assert.equal(programDetail.entityType, "Program");
  assert.equal(programDetail.entityId, "zju-cs-msc");
  assert.equal(programDetail.programId, 10102);
  assert.ok(programDetail.schoolId);
  assert.equal(programDetail.sourceFieldLineage.sourceModel, "SchoolProgram");
  assert.equal(programDetail.facts.find(([label]) => label === "Chinese school name")?.[1], "浙江大学");
  assert.equal(programDetail.facts.find(([label]) => label === "Degree level")?.[1], "Master");
  assert.equal(programDetail.hideSnapshot, true);
  assert.ok(programDetail.programGuide);
  assert.ok(Array.isArray(programDetail.programGuide.fieldSummary) && programDetail.programGuide.fieldSummary.length >= 5);
  assert.ok(programDetail.programGuide.fieldSummary.some((field) => field.label === "University"));
  assert.equal(programDetail.programGuide.schoolChineseName, "浙江大学");
  assert.equal(programDetail.programGuide.programChineseName, "计算机科学硕士");
  assert.ok(!programDetail.programGuide.fieldSummary.some((field) => field.label === "Chinese school name"));
  assert.ok(programDetail.programGuide.routeCards.some((card) => card.title === "University" && /浙江大学/.test(card.body)));
  assert.ok(programDetail.programGuide.routeCards.some((card) => card.title === "Program" && /计算机科学硕士/.test(card.body)));
  assert.ok(programDetail.programGuide.fieldSummary.some((field) => field.label === "Teaching"));
  assert.ok(programDetail.programGuide.fieldSummary.some((field) => field.label === "Tuition" && /RMB|Confirm/.test(field.value)));
  assert.ok(programDetail.programGuide.fieldSummary.some((field) => field.label === "Deadline"));
  assert.ok(Array.isArray(programDetail.programGuide.routeCards) && programDetail.programGuide.routeCards.length >= 3);
  assert.ok(Array.isArray(programDetail.programGuide.routeSignalCards) && programDetail.programGuide.routeSignalCards.length >= 4);
  assert.ok(programDetail.programGuide.routeSignalCards.some((card) => card.title === "Program group"));
  assert.ok(programDetail.programGuide.routeSignalCards.some((card) => card.title === "Subjects to prepare"));
  assert.ok(programDetail.programGuide.routeSignalCards.some((card) => card.title === "Tuition planning"));
  assert.ok(programDetail.programGuide.routeSignalCards.some((card) => card.title === "Funding option"));
  assert.ok(programDetail.programGuide.routeBadge);
  assert.match(completionJs, /program-route-badge/);
  assert.match(completionCss, /\.program-route-badge/);
  assert.ok(Array.isArray(programDetail.programGuide.compareCards) && programDetail.programGuide.compareCards.length >= 3);
  assert.ok(programDetail.programGuide.compareCards.some((card) => card.title === "Academic fit"));
  assert.ok(programDetail.programGuide.compareCards.some((card) => card.title === "Cost planning"));
  assert.ok(programDetail.programGuide.compareCards.some((card) => card.title === "Deadline planning"));
  assert.ok(Array.isArray(programDetail.programGuide.requirementCards) && programDetail.programGuide.requirementCards.length >= 2);
  assert.ok(Array.isArray(programDetail.programGuide.timingCards) && programDetail.programGuide.timingCards.length >= 2);
  assert.ok(Array.isArray(programDetail.programGuide.nextCards) && programDetail.programGuide.nextCards.length >= 2);
  assert.ok(Array.isArray(programDetail.programGuide.readinessCards) && programDetail.programGuide.readinessCards.length >= 3);
  assert.ok(Array.isArray(programDetail.programGuide.officialCards) && programDetail.programGuide.officialCards.length >= 1);
  assert.ok(programDetail.programGuide.officialCards.some((card) => card.title === "Official program notice" || card.title === "School application page"));
  assert.ok(programDetail.programGuide.officialCards.some((card) => card.title === "Zhejiang University International Student Scholarship" && /scholarship-detail\.html\?scholarship=zju-international-student-scholarship/.test(card.href)));
  assert.ok(programDetail.programGuide.officialCards.some((card) => card.title === "CSC possible through university channel" && /scholarship-detail\.html\?scholarship=csc-university-channel/.test(card.href)));
  assert.ok(programDetail.programGuide.readinessCards.some((card) => card.title === "Language readiness"));
  assert.ok(programDetail.programGuide.readinessCards.some((card) => card.title === "School follow-up"));
  assert.ok(programDetail.programGuide.readinessCards.some((card) => card.title === "Funding route"));
  assert.ok(!programDetail.programGuide.routeSignalCards.some((card) => ["Displayed tuition", "Information status"].includes(card.title)));
  assert.ok(!programDetail.programGuide.compareCards.some((card) => ["Cost signal", "Source confidence"].includes(card.title)));
  assert.ok(!programDetail.programGuide.readinessCards.some((card) => ["Application note", "Scholarship and source"].includes(card.title)));
  assert.match(completionJs, /function renderProgramOfficialCards/);
  assert.match(completionJs, /#program-requirements/);
  assert.match(completionJs, /#program-handoff/);
  assert.match(completionJs, /Where to check current details/);
  assert.match(cuacData, /function programOfficialCards\(program = \{\}\)/);
  assert.match(cuacData, /officialCards: programOfficialCards\(program\)/);
  assert.ok(programDetail.decisionPanels.some((panel) => panel.title === "Language route"));
  assert.ok(programDetail.status.includes("Application ready") || programDetail.status.includes("Review before applying"));
  assert.ok(programDetail.facts.some(([label, value]) => label === "Application page" && /Application ready|Review before applying/.test(value)));
  assert.equal(programDetail.profileTitle, "Program information");
  assert.ok(programDetail.profileSections.some((section) => section.rows.some(([label]) => label === "Application entry")));
  assert.ok(programDetail.profileSections.some((section) => section.title === "Course basics"));
  assert.ok(programDetail.profileSections.some((section) => section.title === "Admissions requirements"));
  assert.ok(programDetail.profileSections.some((section) => section.title === "Tuition and timing"));
  assert.ok(programDetail.profileSections.some((section) => section.title === "CUAC application handoff"));
  assert.ok(!programDetail.profileSections.some((section) => section.title === "Requirement details" || section.title === "Funding signal" || section.title === "Funding and next step"));
  assert.equal(programDetail.schemaTitle, "Program information guide");
  assert.ok(programDetail.schemaSections.some((section) => section.rows.some(([label]) => label === "Application entry")));
  assert.ok(programDetail.schemaSections.some((section) => section.rows.some(([label]) => label === "Deadline")));
  assert.ok(programDetail.schemaSections.some((section) => section.rows.some(([label]) => label === "Scholarship links")));
  assert.ok(programDetail.schemaSections.some((section) => section.rows.some(([label]) => label === "Subject tags")));
  assert.ok(programDetail.schemaSections.some((section) => section.rows.some(([label]) => label === "Route group key")));
  assert.ok(programDetail.schemaSections.some((section) => section.rows.some(([label]) => label === "Route group label")));
  assert.ok(!programDetail.schemaSections.some((section) => section.rows.some(([label]) => label.includes("SchoolProgram."))));

  const scholarshipDetail = dataClient.getCompletionDetail("scholarship", "csc");
  assert.equal(scholarshipDetail.entityType, "PublicScholarship");
  assert.equal(scholarshipDetail.sourceFieldLineage.sourceModel, "Scholarship");
  assert.equal(scholarshipDetail.hideSnapshot, true);
  assert.equal(scholarshipDetail.profileTitle, "Scholarship information");
  assert.ok(scholarshipDetail.facts.some(([label]) => label === "Deadline timing"));
  assert.ok(scholarshipDetail.scholarshipGuide);
  assert.ok(Array.isArray(scholarshipDetail.scholarshipGuide.fieldSummary) && scholarshipDetail.scholarshipGuide.fieldSummary.length >= 5);
  assert.ok(scholarshipDetail.scholarshipGuide.fieldSummary.some((field) => field.label === "Provider"));
  assert.ok(scholarshipDetail.scholarshipGuide.fieldSummary.some((field) => field.label === "Funding level" && /Full|Partial|Confirm/.test(field.value)));
  assert.ok(scholarshipDetail.scholarshipGuide.fieldSummary.some((field) => field.label === "Deadline"));
  assert.ok(Array.isArray(scholarshipDetail.scholarshipGuide.coverageCards) && scholarshipDetail.scholarshipGuide.coverageCards.length >= 2);
  assert.ok(scholarshipDetail.scholarshipGuide.coverageCards.some((card) => card.state === "Included" || card.state === "Not included"));
  assert.match(completionJs, /funding-benefit-state/);
  assert.match(completionCss, /\.funding-benefit-state/);
  assert.ok(Array.isArray(scholarshipDetail.scholarshipGuide.eligibilityCards) && scholarshipDetail.scholarshipGuide.eligibilityCards.length >= 1);
  assert.ok(Array.isArray(scholarshipDetail.scholarshipGuide.materialCards) && scholarshipDetail.scholarshipGuide.materialCards.length >= 2);
  assert.ok(Array.isArray(scholarshipDetail.scholarshipGuide.stepCards) && scholarshipDetail.scholarshipGuide.stepCards.length >= 2);
  assert.ok(Array.isArray(scholarshipDetail.scholarshipGuide.noticeSections) && scholarshipDetail.scholarshipGuide.noticeSections.length >= 1);
  assert.ok(scholarshipDetail.scholarshipGuide.noticeSections.some((section) => Array.isArray(section.paragraphs) && section.paragraphs.length >= 1));
  assert.ok(Array.isArray(scholarshipDetail.scholarshipGuide.schoolCards) && scholarshipDetail.scholarshipGuide.schoolCards.length >= 1);
  assert.ok(Array.isArray(scholarshipDetail.scholarshipGuide.programCards) && scholarshipDetail.scholarshipGuide.programCards.length >= 1);
  assert.ok(Array.isArray(scholarshipDetail.scholarshipGuide.sidebarCards) && scholarshipDetail.scholarshipGuide.sidebarCards.some((card) => card.title === "Scope"));
  assert.ok(scholarshipDetail.scholarshipGuide.primaryAction === null || scholarshipDetail.scholarshipGuide.primaryAction.href);
  assert.ok(!scholarshipDetail.scholarshipGuide.sourceAction || scholarshipDetail.scholarshipGuide.sourceAction.href);
  assert.ok(scholarshipDetail.decisionPanels.some((panel) => panel.title === "Funding level"));
  assert.ok(scholarshipDetail.profileSections.some((section) => section.title === "Funding route"));
  assert.ok(scholarshipDetail.profileSections.some((section) => section.title === "Eligibility fit"));
  assert.ok(scholarshipDetail.profileSections.some((section) => section.title === "Preparation"));
  assert.ok(scholarshipDetail.profileSections.some((section) => section.title === "Use it with programs"));
  assert.ok(!scholarshipDetail.profileSections.some((section) => section.title === "Official links and contact" || section.rows.some(([label]) => label === "Official notice state" || label === "Last checked" || label === "Official source")));
  assert.equal(scholarshipDetail.schemaTitle, "Scholarship information guide");
  assert.ok(scholarshipDetail.schemaSections.some((section) => section.rows.some(([label]) => label === "Eligibility requirements")));
  assert.ok(scholarshipDetail.schemaSections.some((section) => section.rows.some(([label]) => label === "Application materials")));
  assert.ok(!scholarshipDetail.schemaSections.some((section) => section.rows.some(([label]) => label.includes("Scholarship."))));
  assert.match(completionJs, /function renderScholarshipRelatedCards/);
  assert.match(completionJs, /Applicable schools/);
  assert.match(completionJs, /Program routes/);
  assert.match(completionJs, /function renderScholarshipScopeSummary/);
  assert.match(completionJs, /id="scholarship-scope"/);
  assert.match(completionJs, /Scope summary/);
  assert.match(completionJs, /Check fit before preparing documents/);
  assert.match(completionJs, /Funding benefits/);
  assert.match(completionJs, /#scholarship-eligibility/);
  assert.match(completionJs, /#scholarship-options/);
  assert.match(completionJs, /Materials and steps/);
  assert.match(completionJs, /Scholarship overview/);
  assert.match(completionJs, /What to confirm with the school/);
  assert.match(completionJs, /function renderScholarshipApplyPanel/);
  assert.match(completionJs, /Apply and verify/);
  assert.match(completionJs, /Use the current notice/);
  assert.match(completionJs, /data-share-scholarship/);
  assert.match(completionJs, /function copyCurrentScholarshipLink/);
  assert.match(completionCss, /\.scholarship-apply-panel/);
  assert.match(completionCss, /\.scholarship-apply-actions/);
  assert.match(completionCss, /\.scholarship-scope-summary/);
  assert.match(completionCss, /\.scholarship-scope-facts/);
  assert.doesNotMatch(completionJs, /Official source and contact|Where to verify before preparing|Contact and links/);
  assert.match(completionJs, /function renderScholarshipNoticeSections/);
  assert.doesNotMatch(completionJs, /\$\{renderProfileSections\(data\)\}[\s\S]{0,800}<article class="detail-card funding-section-card">/);

  const schoolDetail = dataClient.getCompletionDetail("university", "tsinghua-university");
  assert.equal(schoolDetail.entityType, "School");
  assert.equal(schoolDetail.sourceFieldLineage.sourceModel, "School");
  assert.equal(schoolDetail.profileTitle, "University information");
  assert.equal(schoolDetail.schemaTitle, "University information guide");
  assert.ok(schoolDetail.schoolGuide);
  assert.ok(schoolDetail.schoolGuide.officialActions);
  assert.ok(schoolDetail.schoolGuide.officialActions.applicationFee);
  const zjuSchoolDetail = dataClient.getCompletionDetail("university", "zhejiang-university");
  assert.ok(zjuSchoolDetail.schoolGuide.officialActions.links.some((link) => link.title === "Official website" && /^https?:\/\//.test(link.href)));
  assert.ok(zjuSchoolDetail.schoolGuide.officialActions.links.some((link) => link.title === "Admissions entry" && /^https?:\/\//.test(link.href)));
  assert.ok(Array.isArray(zjuSchoolDetail.schoolGuide.upcomingDeadlines) && zjuSchoolDetail.schoolGuide.upcomingDeadlines.length >= 1);
  assert.ok(zjuSchoolDetail.schoolGuide.upcomingDeadlines.some((row) => row.title && row.deadline && row.status));
  assert.match(cuacData, /function schoolUpcomingDeadlineRows/);
  assert.match(cuacData, /upcomingDeadlines:\s*schoolUpcomingDeadlineRows\(school\)/);
  assert.match(completionJs, /const structuredDeadlines = Array\.isArray\(guide\.upcomingDeadlines\)/);
  assert.ok(Array.isArray(schoolDetail.schoolGuide.programCards) && schoolDetail.schoolGuide.programCards.length >= 1);
  assert.ok(Array.isArray(schoolDetail.schoolGuide.scholarshipCards) && schoolDetail.schoolGuide.scholarshipCards.length >= 1);
  assert.ok(zjuSchoolDetail.schoolGuide.programCards.some((card) => /计算机科学硕士/.test(`${card.title} ${card.body}`)));
  assert.ok(Array.isArray(schoolDetail.schoolGuide.programRows) && schoolDetail.schoolGuide.programRows.length >= 1);
  assert.ok(schoolDetail.schoolGuide.programRows.some((row) => row.teaching && row.csca && row.tuition && row.deadline));
  assert.ok(schoolDetail.schoolGuide.programRows.some((row) => "degree" in row && Array.isArray(row.subjects)));
  assert.ok(Array.isArray(schoolDetail.schoolGuide.applicationTimeline) && schoolDetail.schoolGuide.applicationTimeline.length >= 1);
  assert.match(completionJs, /function renderUniversityApplicationPlanning\(guide = \{\}\)/);
  assert.match(completionJs, /Application timing/);
  assert.match(completionJs, /Closest program deadlines/);
  assert.match(completionJs, /hasApplicationTiming \? \["#university-timing", "Timing"\]/);
  assert.match(completionCss, /\.university-application-plan-grid/);
  assert.match(completionCss, /\.university-deadline-list article/);
  assert.ok(zjuSchoolDetail.schoolGuide.programRows.some((row) => row.titleZh === "计算机科学硕士"));
  assert.ok(zjuSchoolDetail.schoolGuide.programRows.some((row) => row.degree === "Master" && row.subjects.includes("Mathematics") && row.applicationUrl));
  assert.ok(Array.isArray(schoolDetail.schoolGuide.cscaRuleCards) && schoolDetail.schoolGuide.cscaRuleCards.length >= 1);
  assert.ok(schoolDetail.schoolGuide.cscaRuleCards.some((card) => card.title && card.body && card.category));
  assert.ok(Array.isArray(schoolDetail.schoolGuide.scholarshipRows) && schoolDetail.schoolGuide.scholarshipRows.length >= 1);
  assert.ok(schoolDetail.schoolGuide.scholarshipRows.some((row) => row.coverage && row.requirement));
  assert.ok(schoolDetail.schoolGuide.programCards.some((card) => /Engineering|Computer Science|Architecture|Policy/.test(card.title)));
  assert.ok(schoolDetail.status.includes("Application ready") || schoolDetail.status.includes("Review before applying"));
  assert.equal(schoolDetail.hideSnapshot, true);
  assert.ok(schoolDetail.decisionPanels.some((panel) => panel.title === "Can I apply?"));
  assert.ok(schoolDetail.decisionPanels.some((panel) => panel.title === "Cost range"));
  assert.equal(schoolDetail.profileSections[0].rows.find(([label]) => label === "Chinese name")?.[1], "清华大学");
  assert.ok(schoolDetail.profileSections.some((section) => section.rows.some(([label]) => label === "Admissions entry")));
  assert.ok(schoolDetail.profileSections.some((section) => section.rows.some(([label]) => label === "HSK requirement")));
  assert.ok(schoolDetail.profileSections.some((section) => section.title === "Identity and school"));
  assert.ok(schoolDetail.profileSections.some((section) => section.title === "Degree fit"));
  assert.ok(schoolDetail.profileSections.some((section) => section.title === "Language and CSCA"));
  assert.ok(schoolDetail.profileSections.some((section) => section.title === "Costs and funding"));
  assert.ok(schoolDetail.profileSections.some((section) => section.title === "Dates and official entry"));
  assert.ok(!schoolDetail.profileSections.some((section) => section.title === "At a glance" || section.title === "Official application route"));
  assert.ok(!schoolDetail.profileSections.some((section) => section.title === "Source and freshness" || section.rows.some(([label]) => label === "Data quality" || label === "Official detail state")));
  assert.ok(schoolDetail.schemaSections.some((section) => section.rows.some(([label]) => label === "HSK requirement")));
  assert.ok(schoolDetail.schemaSections.some((section) => section.rows.some(([label]) => label === "English requirement")));
  assert.ok(!schoolDetail.schemaSections.some((section) => section.rows.some(([label]) => label === "Source Id")));
  assert.ok(!schoolDetail.schemaSections.some((section) => section.rows.some(([label]) => label === "Created At")));
  assert.ok(schoolDetail.schemaSections.some((section) => section.rows.some(([label]) => label === "Deadline summary")));
  assert.ok(schoolDetail.schemaSections.some((section) => section.rows.some(([label]) => label === "Tuition summary")));
  assert.ok(schoolDetail.schemaSections.some((section) => section.rows.some(([label]) => label === "Detailed scholarships")));
  assert.match(completionJs, /function renderUniversityPreviewCards/);
  assert.match(completionJs, /function renderUniversityGlance/);
  assert.match(completionJs, /Decision snapshot/);
  assert.match(completionJs, /function renderUniversityProgramRows/);
  assert.match(completionJs, /university-program-title-zh/);
  assert.match(completionJs, /function renderUniversityScholarshipRows/);
  assert.match(completionJs, /function renderUniversityCscaRuleCards/);
  assert.match(completionJs, /function renderUniversitySchoolChecks/);
  assert.match(completionJs, /function renderUniversityOfficialActions/);
  assert.match(completionJs, /function renderUniversityProgramFilters/);
  assert.match(completionJs, /function updateUniversityProgramFilters/);
  assert.match(completionJs, /data-university-program-filter/);
  assert.match(completionJs, /Program details/);
  assert.match(completionJs, /Scholarship route/);
  assert.doesNotMatch(completionJs, /Scholarship and source/);
  assert.match(completionJs, /Official program notice/);
  assert.match(completionJs, /university-side-action-grid/);
  assert.match(completionJs, /Find exact programs/);
  assert.match(completionJs, /Admissions entry/);
  assert.match(completionJs, /City context/);
  assert.match(completionCss, /\.university-official-card/);
  assert.match(completionCss, /\.university-official-fee/);
  assert.match(completionCss, /\.university-side-action-grid/);
  assert.match(completionCss, /\.university-side-action\.primary/);
  assert.match(completionCss, /\.university-program-filter-bar/);
  assert.match(completionCss, /\.university-program-title-zh/);
  assert.match(completionCss, /\.university-program-details/);
  assert.match(completionJs, /#university-checks/);
  assert.match(completionJs, /#university-programs/);
  assert.match(completionJs, /CSCA and funding checks from this school/);
  assert.match(completionJs, /Programs at this school/);
  assert.match(completionJs, /Scholarship routes at this school/);
  assert.ok(!schoolDetail.schemaSections.some((section) => section.rows.some(([label]) => label.includes("School."))));

  const zhejiangDetail = dataClient.getCompletionDetail("university", "zhejiang-university");
  assert.equal(zhejiangDetail.profileSections[0].rows.find(([label]) => label === "Chinese name")?.[1], "浙江大学");
  const duplicateSchemaLabels = (detail) => {
    const labels = (detail.schemaSections || []).flatMap((section) => (section.rows || []).map(([label]) => label));
    return [...new Set(labels.filter((label, index) => labels.indexOf(label) !== index))];
  };
  assert.deepEqual(duplicateSchemaLabels(zhejiangDetail), [], "university detail should not repeat public schema labels");
  assert.ok(zhejiangDetail.schemaSections.some((section) => section.rows.some(([label]) => label === "City slug")));
  assert.ok(zhejiangDetail.schemaSections.some((section) => section.rows.some(([label]) => label === "City name")));

  const zjuProgramDetail = dataClient.getCompletionDetail("program", "zju-cs-msc");
  assert.deepEqual(duplicateSchemaLabels(zjuProgramDetail), [], "program detail should not repeat public schema labels");
  assert.ok(zjuProgramDetail.schemaSections.some((section) => section.rows.some(([label]) => label === "Program English name")));
  assert.ok(zjuProgramDetail.schemaSections.some((section) => section.rows.some(([label]) => label === "University English name")));
  assert.ok(zjuProgramDetail.schemaSections.some((section) => section.rows.some(([label]) => label === "Route group key")));
  assert.ok(zjuProgramDetail.schemaSections.some((section) => section.rows.some(([label]) => label === "Route group label")));

  const cityDetail = dataClient.getCompletionDetail("city", "hangzhou");
  assert.equal(cityDetail.entityType, "City");
  assert.equal(cityDetail.sourceFieldLineage.sourceModel, "CityGuide");
  assert.equal(cityDetail.hideSnapshot, true);
  assert.equal(cityDetail.profileTitle, "City information");
  assert.ok(cityDetail.cityGuide);
  assert.ok(Array.isArray(cityDetail.cityGuide.fieldSummary) && cityDetail.cityGuide.fieldSummary.length >= 5);
  assert.equal(cityDetail.cityGuide.fieldSummary.find((field) => field.label === "Chinese name")?.value, "杭州");
  assert.ok(cityDetail.cityGuide.fieldSummary.some((field) => field.label === "Monthly cost" && /RMB/.test(field.value)));
  assert.ok(cityDetail.cityGuide.fieldSummary.some((field) => field.label === "City pace"));
  assert.ok(Array.isArray(cityDetail.cityGuide.resourceFacts) && cityDetail.cityGuide.resourceFacts.length === 5);
  assert.equal(cityDetail.cityGuide.resourceFacts.map((fact) => fact.label).join("|"), "Universities|Programs|English routes|Scholarship routes|CSCA schools");
  assert.ok(cityDetail.cityGuide.resourceFacts.some((fact) => fact.note === "Current CUAC school options"));
  assert.ok(cityDetail.cityGuide.resourceFacts.some((fact) => fact.note === "Specific degree routes"));
  assert.ok(cityDetail.cityGuide.resourceFacts.some((fact) => fact.note === "Planning requirement check"));
  assert.ok(Array.isArray(cityDetail.cityGuide.quickFacts) && cityDetail.cityGuide.quickFacts.length >= 3);
  assert.ok(cityDetail.cityGuide.quickFacts.some((fact) => fact.label === "Monthly cost" || fact.note === "Living-cost reference"));
  assert.ok(!cityDetail.cityGuide.quickFacts.some((fact) => ["Universities", "Programs", "English routes", "Scholarship routes", "CSCA schools"].includes(fact.label)));
  assert.ok(!cityDetail.cityGuide.quickFacts.some((fact) => /signals|library/i.test(fact.note || "")));
  assert.match(completionJs, /renderCityQuickFacts\(guide\.quickFacts \|\| \[\]\)/);
  assert.match(completionJs, /function cityBudgetDisplayLine\(guide = \{\}\)/);
  assert.match(completionJs, /function cityTextListItems\(value, limit = 4\)/);
  assert.match(completionJs, /function renderCityBestForChips\(items = \[\]\)/);
  assert.match(completionJs, /renderCityBestForChips\(guide\.bestFor \|\| \[\]\)/);
  assert.match(completionCss, /\.city-best-for-strip/);
  assert.doesNotMatch(completionJs, /renderCityQuickFacts\(resourceFacts\)/);
  assert.doesNotMatch(completionJs, /city-budget-panel[\s\S]*renderCityContentFacts\(guide\.quickFacts/);
  assert.ok(Array.isArray(cityDetail.cityGuide.aggregateCards) && cityDetail.cityGuide.aggregateCards.length >= 5);
  assert.ok(cityDetail.cityGuide.aggregateCards.some((card) => card.label === "CSCA schools" && /CSCA timing/.test(card.note)));
  assert.ok(cityDetail.cityGuide.aggregateCards.some((card) => card.label === "Schools" && /universities\.html\?city=/.test(card.href) && card.action === "Compare schools"));
  assert.ok(cityDetail.cityGuide.aggregateCards.some((card) => card.label === "Scholarships" && /scholarships\.html\?city=/.test(card.href) && card.action === "Compare funding"));
  assert.ok(cityDetail.cityGuide.budget?.monthly);
  assert.ok(Array.isArray(cityDetail.cityGuide.why) && cityDetail.cityGuide.why.length >= 2);
  assert.ok(cityDetail.cityGuide.why.every((item) => item.title && item.body));
  assert.ok(Array.isArray(cityDetail.cityGuide.costProfiles) && cityDetail.cityGuide.costProfiles.length >= 2);
  assert.ok(Array.isArray(cityDetail.cityGuide.costBreakdown) && cityDetail.cityGuide.costBreakdown.length >= 2);
  assert.ok(Array.isArray(cityDetail.cityGuide.lifeSections) && cityDetail.cityGuide.lifeSections.length >= 2);
  assert.ok(Array.isArray(cityDetail.cityGuide.transportNotes) && cityDetail.cityGuide.transportNotes.length >= 2);
  assert.ok(Array.isArray(cityDetail.cityGuide.nearbyCards) && cityDetail.cityGuide.nearbyCards.length >= 1);
  assert.ok(Array.isArray(cityDetail.cityGuide.relatedSchools) && cityDetail.cityGuide.relatedSchools.length >= 1);
  assert.ok(Array.isArray(cityDetail.cityGuide.relatedPrograms) && cityDetail.cityGuide.relatedPrograms.length >= 1);
  const shanghaiCityDetail = dataClient.getCompletionDetail("city", "shanghai");
  assert.ok(shanghaiCityDetail.cityGuide.relatedPrograms.some((program) => program.degree && program.language && program.funding));
  assert.ok(shanghaiCityDetail.cityGuide.relatedPrograms.some((program) => program.degree === "master" && program.language === "english"));
  assert.ok(shanghaiCityDetail.cityGuide.relatedPrograms.some((program) => ["经济学本科", "土木工程硕士"].includes(program.titleZh)));
  assert.ok(Array.isArray(cityDetail.cityGuide.relatedScholarships) && cityDetail.cityGuide.relatedScholarships.length >= 1);
  assert.ok(Array.isArray(cityDetail.cityGuide.programKeywords) && cityDetail.cityGuide.programKeywords.length >= 1);
  assert.ok(Array.isArray(cityDetail.cityGuide.applicationTips) && cityDetail.cityGuide.applicationTips.length >= 2);
  assert.ok(Array.isArray(cityDetail.cityGuide.applicationAdvice) && cityDetail.cityGuide.applicationAdvice.length >= 2);
  assert.ok(Array.isArray(cityDetail.cityGuide.nextSteps) && cityDetail.cityGuide.nextSteps.length >= 2);
  assert.ok(cityDetail.cityGuide.nextSteps.every((step) => step.title && step.body));
  assert.ok(Array.isArray(cityDetail.cityGuide.faqs) && cityDetail.cityGuide.faqs.length >= 2);
  assert.ok(cityDetail.cityGuide.faqs.every((item) => item.question && item.answer && !/^[:：\s]/.test(item.answer)));
  assert.ok(cityDetail.cityGuide.routes.some((route) => route.label === "Programs in this city"));
  assert.ok(cityDetail.decisionPanels.some((panel) => panel.title === "Monthly budget"));
  assert.ok(cityDetail.decisionPanels.some((panel) => panel.title === "Schools and programs"));
  assert.equal(cityDetail.profileSections[0].rows.find(([label]) => label === "Chinese name")?.[1], "杭州");
  assert.ok(!cityDetail.profileSections[0].rows.some(([label]) => label === "English name"));
  assert.ok(cityDetail.profileSections.some((section) => section.title === "Student fit"));
  assert.ok(cityDetail.profileSections.some((section) => section.rows.some(([label]) => label === "Good fit for")));
  assert.ok(cityDetail.profileSections.some((section) => section.title === "Budget planning"));
  assert.ok(cityDetail.profileSections.some((section) => section.title === "Schools and programs"));
  assert.ok(cityDetail.profileSections.some((section) => section.rows.some(([label]) => label === "Available schools")));
  assert.ok(cityDetail.profileSections.some((section) => section.rows.some(([label]) => label === "English-taught programs")));
  assert.ok(cityDetail.profileSections.some((section) => section.rows.some(([label]) => label === "Recommended program directions")));
  assert.ok(cityDetail.profileSections.some((section) => section.title === "Life and arrival"));
  assert.ok(cityDetail.profileSections.some((section) => section.rows.some(([label]) => label === "Campus commute" || label === "Arrival transport")));
  assert.ok(cityDetail.profileSections.some((section) => section.title === "Application planning"));
  assert.ok(cityDetail.profileSections.some((section) => section.title === "Common questions"));
  assert.ok(!cityDetail.profileSections.some((section) => section.rows.some(([label]) => /^Note \d|^Step \d|^Q\d/.test(label))));
  assert.equal(cityDetail.schemaTitle, "City information guide");
  assert.deepEqual(duplicateSchemaLabels(cityDetail), [], "city detail should not repeat public schema labels");
  assert.ok(cityDetail.schemaSections.some((section) => section.rows.some(([label]) => label === "Budget summary")));
  assert.ok(cityDetail.schemaSections.some((section) => section.rows.some(([label]) => label === "Program routes")));
  assert.ok(cityDetail.schemaSections.some((section) => section.rows.some(([label]) => label === "Recommended program directions")));
  assert.ok(!cityDetail.schemaSections.some((section) => section.rows.some(([label]) => label.includes("CityGuide."))));
  assert.match(completionJs, /Use the city only after program fit is clear/);
  assert.match(completionJs, /#city-why/);
  assert.match(completionJs, /Why this city works/);
  assert.match(completionJs, /function normalizeCityTextCard/);
  assert.match(completionJs, /renderCityTextCards\(guide\.why \|\| \[\], "city-why-grid"\)/);
  assert.match(completionJs, /renderCityApplicationChecklist\(guide\.applicationTips \|\| checklist \|\| \[\]\)/);
  assert.match(completionCss, /\.city-application-checklist/);
  assert.match(completionCss, /\.city-application-tip-list/);
  assert.match(completionJs, /program-name-alias/);
  assert.match(completionCss, /\.hero-copy \.program-name-alias/);
  assert.match(completionJs, /function renderCityProgramKeywords/);
  assert.match(completionJs, /function renderCityProgramFilters/);
  assert.match(completionJs, /city-program-title-zh/);
  assert.match(completionJs, /function updateCityProgramFilters/);
  assert.match(completionJs, /data-city-program-filter/);
  assert.match(completionJs, /function renderCityNextSteps/);
  assert.match(completionJs, /renderCityNextSteps\(guide\.nextSteps \|\| \[\]\)/);
  assert.match(completionJs, /Recommended program directions/);
  assert.match(completionJs, /Transport and arrival/);
  assert.doesNotMatch(completionJs, /fields\.map\(\(field\)[\s\S]{0,240}field\.label/);
  assert.match(cuacData, /why: cityWhyDisplay\(city\)/);
  assert.match(cuacData, /function cityStructuredList\(value = \[\]\)/);
  assert.match(cuacData, /const notes = cityStructuredList\(content\.lifeSections \|\| city\.lifeSections \|\| \[\]\)/);
  assert.match(cuacData, /const nextSteps = cityStructuredList\(content\.nextSteps \|\| city\.nextSteps \|\| \[\]\)/);
  assert.match(cuacData, /const advice = cityStructuredList\(content\.applicationAdvice \|\| city\.applicationAdvice \|\| \[\]\)/);
  assert.match(cuacData, /\.\.\.cityStructuredList\(content\.cityFaqs\)/);
  assert.match(cuacData, /const notes = cityStructuredList\(content\.transportNotes \|\| city\.transportNotes\)/);
  assert.match(cuacData, /const items = cityStructuredList\(hasSourceValue\(nextSteps\)/);
  assert.match(cuacData, /question: sourceDisplayValue\(item\.question, "Student question"\)/);
  assert.match(cuacData, /answer: sourceDisplayValue\(item\.answer, "Confirm with the school before deciding\."\)/);
  assert.match(cuacData, /const key = `\$\{item\.question\}::\$\{item\.answer\}`/);
  assert.match(cuacData, /const faqRows = cityFaqItems\(city\)\.map\(\(item\) => \[item\.question, item\.answer\]\)/);
  assert.doesNotMatch(cuacData, /return `\$\{item\.question \|\| "Student question"\}: \$\{item\.answer \|\| "Confirm with the school before deciding\."\}`/);
  assert.match(completionCss, /\.city-why-grid/);
  assert.match(completionCss, /\.city-program-filter-bar/);
  assert.match(completionCss, /\.city-program-title-zh/);
  assert.match(completionCss, /\.city-glance-list p/);
  assert.match(completionCss, /\.city-side-next-list article/);
  assert.doesNotMatch(completionJs, /Reference counts are the editable CityGuide/);
  assert.doesNotMatch(completionJs, /What CUAC can currently show here|guide reference/);

  const rawPublicSchemaLabel = /\b(?:School|SchoolProgram|SchoolScholarship|Scholarship|PublicScholarship|CityGuide|CityGuideAggregate)\.[A-Za-z_][A-Za-z0-9_]*/;
  [
    ["program", dataClient.getDiscoveryPrograms().map((item) => item.id || item.slug || item.nameEn || item.name)],
    ["university", dataClient.getDiscoverySchools().map((item) => item.id || item.sourceId || item.slug || item.nameEn || item.name || item.nameZh)],
    ["scholarship", dataClient.getDiscoveryScholarships().map((item) => item.slug || item.id || item.title || item.name)],
    ["city", dataClient.getDiscoveryCities().map((item) => item.slug || item.id || item.nameEn || item.name)],
  ].forEach(([mode, ids]) => {
    ids.forEach((id) => {
      const detail = dataClient.getCompletionDetail(mode, String(id));
      assert.ok(detail, `${mode} detail should resolve from catalog id ${id}`);
      assert.ok(detail.sourceFieldLineage?.sourceModel, `${mode} detail ${id} should preserve CSCAlite lineage`);
      const labels = (detail.schemaSections || []).flatMap((section) => (section.rows || []).map(([label]) => label));
      assert.ok(labels.length >= 8, `${mode} detail ${id} should expose a useful public schema`);
      assert.deepEqual([...new Set(labels.filter((label, index) => labels.indexOf(label) !== index))], [], `${mode} detail ${id} should not repeat public schema labels`);
      assert.ok(!labels.some((label) => rawPublicSchemaLabel.test(label)), `${mode} detail ${id} should not expose raw CSCAlite field labels`);
    });
  });
  const guideDetail = dataClient.getCompletionDetail("guide", "documents");
  assert.equal(guideDetail.entityType, "ContentDiscovery");
  assert.equal(guideDetail.sourceFieldLineage.sourceModel, "PublicContentBlock + SearchItem");
  assert.ok(guideDetail.sourceFieldLineage.sourceFields.includes("body"));
  assert.ok(guideDetail.sourceFieldLineage.sourceFields.includes("metadata"));
  assert.equal(guideDetail.schemaTitle, "Guide information source");
  assert.ok(guideDetail.schemaSections.some((section) => section.title === "Content source"));
  assert.ok(!guideDetail.schemaSections.some((section) => section.rows.some(([label]) => label.includes("PublicContentBlock.") || label.includes("SearchItem."))));

  const notificationSummary = dataClient.getNotificationCenterSummary();
  const deadlineNotice = notificationSummary.baseItems.find((item) => item.id === "deadline-zju");
  assert.equal(deadlineNotice.entityType, "Program");
  assert.equal(deadlineNotice.schoolId, 101);
  assert.equal(deadlineNotice.programId, 10102);
  assert.equal(deadlineNotice.sourceFieldLineage.sourceModel, "SchoolProgram");
  const fundingNotice = notificationSummary.baseItems.find((item) => item.id === "funding-csc");
  assert.equal(fundingNotice.entityType, "PublicScholarship");
  assert.equal(fundingNotice.sourceFieldLineage.sourceModel, "Scholarship");

  assert.equal(programContract.legacyModel, "SchoolProgram");
  assert.equal(programContract.backendType, "SchoolProgramRecord");
  assert.ok(programContract.canonicalKeys.includes("deadlineDate"));
  assert.ok(programContract.agentBoundary.includes("Add choice selects schoolId and programId"));
  assert.equal(schoolFundingContract.legacyModel, "SchoolScholarship");
  assert.ok(schoolFundingContract.agentBoundary.includes("school-scoped funding context"));
  assert.equal(publicScholarshipContract.legacyModel, "Scholarship + ScholarshipBodySection + ScholarshipBenefitItem + ScholarshipInfoItem + ScholarshipContactInfo + ScholarshipActionLink + ScholarshipListResult + ScholarshipDetailResult");
  assert.ok(publicScholarshipContract.canonicalKeys.includes("bodySections"));
  assert.ok(publicScholarshipContract.canonicalKeys.includes("paragraphs"));
  assert.ok(publicScholarshipContract.canonicalKeys.includes("actionLinks"));
  assert.equal(cityContract.legacyModel, "CityGuide");
  assert.ok(cityContract.canonicalKeys.includes("contentJson"));
  const schoolDisplayContract = dataClient.getLegacyEntityContract("SchoolQuickFacts");
  assert.equal(schoolDisplayContract.legacyModel, "SchoolQuickFacts + SchoolDetailDisplay + SchoolProgramDisplayGroup + SchoolApplicationTimelineItem + SchoolUpcomingDeadline");
  assert.ok(schoolDisplayContract.canonicalKeys.includes("programDisplayGroups"));
  assert.ok(schoolDisplayContract.canonicalKeys.includes("dateLabel"));
  assert.ok(schoolDisplayContract.agentBoundary.includes("student-readable"));
  const schoolCatalogContract = dataClient.getLegacyEntityContract("SchoolSearchParams");
  assert.equal(schoolCatalogContract.legacyModel, "SchoolSearchParams + SchoolListFacets + SchoolListResult");
  assert.ok(schoolCatalogContract.canonicalKeys.includes("pageSize"));
  assert.ok(schoolCatalogContract.canonicalKeys.includes("cscaOptions"));
  assert.ok(schoolCatalogContract.agentBoundary.includes("public discovery"));
  const contentDiscoveryContract = dataClient.getLegacyEntityContract("SearchResult");
  assert.equal(contentDiscoveryContract.legacyModel, "PublicContentBlock + AdminContentBlock + SearchItem + SearchResult");
  assert.ok(contentDiscoveryContract.canonicalKeys.includes("body"));
  assert.ok(contentDiscoveryContract.canonicalKeys.includes("groups"));
  assert.ok(contentDiscoveryContract.agentBoundary.includes("without restoring a top-nav search entry"));
  const adminSchoolContract = dataClient.getLegacyEntityContract("AdminSchool");
  assert.equal(adminSchoolContract.legacyModel, "AdminSchoolSummary + AdminSchoolDetail + AdminSchoolUpdateInput + AdminSchoolCreateInput + AdminSchoolImportInput + AdminSchoolProgramInput + AdminSchoolCscaRuleInput + AdminSchoolScholarshipInput");
  assert.ok(adminSchoolContract.canonicalKeys.includes("expectedVersion"));
  assert.ok(adminSchoolContract.canonicalKeys.includes("items"));
  assert.ok(adminSchoolContract.canonicalKeys.includes("sourceLabel"));
  assert.ok(adminSchoolContract.agentBoundary.includes("create, import, and edit"));
  const savedCompareContract = dataClient.getLegacyEntityContract("SavedSchool");
  assert.equal(savedCompareContract.legacyModel, "SavedSchool + CompareSchool + CompareDetailsResult");
  assert.ok(savedCompareContract.canonicalKeys.includes("savedAt"));
  assert.ok(savedCompareContract.canonicalKeys.includes("comparedAt"));
  assert.ok(savedCompareContract.agentBoundary.includes("concrete SchoolProgram choice"));
  const studentProfileContract = dataClient.getLegacyEntityContract("StudentProfile");
  assert.equal(studentProfileContract.legacyModel, "StudentProfile");
  assert.ok(studentProfileContract.canonicalKeys.includes("countryCode"));
  assert.ok(studentProfileContract.canonicalKeys.includes("currentOrganizationId"));
  assert.match(cuacData, /function readOpsPreviewList/);
  assert.match(cuacData, /function publicPreviewRecords/);
  assert.match(cuacData, /publicPreviewRecords\("schoolRecords"\)/);
  assert.match(cuacData, /mergePreviewRecords\(base, publicPreviewRecords\("schoolRecords"\), \["id", "sourceId", "nameEn", "nameZh"\]\)/);
  assert.match(cuacData, /publicPreviewRecords\("publicScholarshipRecords"\)/);
  assert.match(cuacData, /mergePreviewRecords\(base, publicPreviewRecords\("publicScholarshipRecords"\), \["id", "slug", "title"\]\)/);
  assert.match(cuacData, /readOpsPreviewList\("cityGuideRecords"\)/);
  assert.match(cuacData, /mergePreviewRecords\(base, readOpsPreviewList\("cityGuideRecords"\), \["id", "slug", "nameEn", "nameZh"\]\)/);
  const timelineContract = dataClient.getLegacyEntityContract("TimelineWindow");
  assert.equal(timelineContract.legacyModel, "ApplicationTimelineWindow + ApplicationTimelineProject + ApplicationTimelineSchool + ApplicationTimelineResponse");
  assert.ok(timelineContract.canonicalKeys.includes("cscaWindow"));
  assert.ok(timelineContract.canonicalKeys.includes("schoolId"));
  assert.ok(timelineContract.canonicalKeys.includes("stats"));
  const accessContract = dataClient.getLegacyEntityContract("AccessGovernance");
  assert.equal(accessContract.legacyModel, "AuthResult + User + AdminUser + AdminAIOrganization + AdminAIOrganizationInviteCreateResult + AdminAIOrganizationAdminAssignmentResult + AdminAIOrganizationInviteBulkReissueResult + AdminAIOrganizationInviteHistory + OrganizationInviteAcceptResult");
  assert.ok(accessContract.canonicalKeys.includes("accessToken"));
  assert.ok(accessContract.canonicalKeys.includes("membership"));
  assert.ok(accessContract.canonicalKeys.includes("acceptPath"));
  const opsAuditContract = dataClient.getLegacyEntityContract("AdminAuditEvent");
  assert.equal(opsAuditContract.legacyModel, "AuditItem + AdminAuditSummary + AdminAuditEvent + AdminReadinessEvidenceFile + AdminReadinessEvidenceDetail");
  assert.ok(opsAuditContract.canonicalKeys.includes("adminAuditEventCount"));
  assert.ok(opsAuditContract.canonicalKeys.includes("resourceType"));
  assert.ok(opsAuditContract.canonicalKeys.includes("sizeBytes"));
  assert.ok(opsAuditContract.agentBoundary.includes("CUAC-internal evidence"));

  const coverageAudit = dataClient.getLegacySourceCoverageAudit();
  assert.equal(coverageAudit.sourceProject, "D:\\CODE\\CSCAlite");
  assert.equal(coverageAudit.checkedAt, "2026-08-20");
  assert.equal(coverageAudit.passed, true);
  assert.equal(coverageAudit.issueCount, 0);
  assert.equal(coverageAudit.entities.map((entity) => entity.entity).join(","), "School,SchoolDisplaySurface,SchoolCatalog,ContentDiscovery,SavedCompare,AdminSchool,SchoolChangeLog,SchoolProgram,SchoolCscaRule,SchoolScholarship,PublicScholarship,AdminScholarship,City,TimelineWindow,StudentProfile,AccessGovernance,OpsAuditGovernance,CommerceFlow");
  for (const entity of coverageAudit.entities) {
    assert.equal(entity.passed, true, `${entity.entity} should preserve all CSCAlite baseline fields`);
    assert.ok(entity.checkedFields.length > 0, `${entity.entity} should expose checked source fields`);
  }
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "School")?.checkedFields.includes("deadlineSummary"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "School")?.checkedFields.includes("scholarshipsDetailed"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "SchoolDisplaySurface")?.sourceModel.includes("SchoolQuickFacts"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "SchoolDisplaySurface")?.sourceModel.includes("SchoolApplicationTimelineItem"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "SchoolDisplaySurface")?.checkedFields.includes("programDisplayGroups"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "SchoolDisplaySurface")?.checkedFields.includes("dateLabel"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "SchoolDisplaySurface")?.checkedFields.includes("daysUntilDeadline"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "SchoolCatalog")?.sourceModel.includes("SchoolSearchParams"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "SchoolCatalog")?.sourceModel.includes("SchoolListResult"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "SchoolCatalog")?.checkedFields.includes("pageSize"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "SchoolCatalog")?.checkedFields.includes("cscaOptions"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "ContentDiscovery")?.sourceModel.includes("PublicContentBlock"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "ContentDiscovery")?.sourceModel.includes("SearchResult"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "ContentDiscovery")?.checkedFields.includes("body"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "ContentDiscovery")?.checkedFields.includes("groups"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "AdminSchool")?.sourceModel.includes("AdminSchoolProgramInput"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "AdminSchool")?.sourceModel.includes("AdminSchoolScholarshipInput"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "AdminSchool")?.checkedFields.includes("expectedVersion"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "AdminSchool")?.checkedFields.includes("items"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "AdminSchool")?.checkedFields.includes("sourceLabel"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "AdminSchool")?.checkedFields.includes("sortOrder"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "SavedCompare")?.sourceModel.includes("SavedSchool"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "SavedCompare")?.checkedFields.includes("savedAt"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "SavedCompare")?.checkedFields.includes("comparedAt"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "AdminSchool")?.checkedFields.includes("verificationStatus"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "SchoolChangeLog")?.checkedFields.includes("changes"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "SchoolProgram")?.checkedFields.includes("applicationUrl"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "SchoolCscaRule")?.checkedFields.includes("importantNote"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "PublicScholarship")?.checkedFields.includes("applicationMaterials"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "PublicScholarship")?.checkedFields.includes("schoolCount"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "PublicScholarship")?.checkedFields.includes("programNameEn"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "PublicScholarship")?.checkedFields.includes("deadlineLabel"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "PublicScholarship")?.checkedFields.includes("applicationRound"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "PublicScholarship")?.checkedFields.includes("benefits"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "PublicScholarship")?.checkedFields.includes("fundingLevels"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "PublicScholarship")?.sourceModel.includes("ScholarshipBodySection"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "PublicScholarship")?.sourceModel.includes("ScholarshipListResult"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "PublicScholarship")?.checkedFields.includes("paragraphs"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "PublicScholarship")?.checkedFields.includes("stats"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "PublicScholarship")?.checkedFields.includes("similar"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "AdminScholarship")?.checkedFields.includes("schoolIds"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "City")?.sourceModel.includes("CityGuideAggregate"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "City")?.sourceModel.includes("CityGuideContent"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "City")?.sourceModel.includes("CityGuideDetail"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "City")?.checkedFields.includes("referenceSchoolCount"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "City")?.checkedFields.includes("actualSchoolCount"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "City")?.checkedFields.includes("actualEnglishProgramCount"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "City")?.checkedFields.includes("visibleSchools"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "City")?.checkedFields.includes("transportNotes"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "TimelineWindow")?.sourceModel.includes("ApplicationTimelineProject"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "TimelineWindow")?.sourceModel.includes("ApplicationTimelineSchool"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "TimelineWindow")?.sourceModel.includes("ApplicationTimelineResponse"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "TimelineWindow")?.checkedFields.includes("cscaWindow"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "TimelineWindow")?.checkedFields.includes("deadlineDate"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "TimelineWindow")?.checkedFields.includes("earliest"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "StudentProfile")?.checkedFields.includes("currentOrganizationId"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "AccessGovernance")?.sourceModel.includes("AuthResult"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "AccessGovernance")?.sourceModel.includes("OrganizationInviteAcceptResult"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "AccessGovernance")?.checkedFields.includes("accessToken"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "AccessGovernance")?.checkedFields.includes("membership"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "AccessGovernance")?.checkedFields.includes("acceptPath"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "OpsAuditGovernance")?.sourceModel.includes("AdminAuditEvent"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "OpsAuditGovernance")?.sourceModel.includes("AdminReadinessEvidenceFile"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "OpsAuditGovernance")?.checkedFields.includes("adminAuditEventCount"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "OpsAuditGovernance")?.checkedFields.includes("resourceType"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "OpsAuditGovernance")?.checkedFields.includes("sizeBytes"));
  assert.ok(coverageAudit.entities.find((entity) => entity.entity === "CommerceFlow")?.checkedFields.includes("callbackSignaturePayload"));

  const readiness = dataClient.getLegacyContractReadiness();
  assert.equal(readiness.sourceProject, "D:\\CODE\\CSCAlite");
  assert.equal(readiness.passed, true);
  assert.equal(readiness.issueCount, 0);
  assert.equal(readiness.entities.map((entity) => entity.entity).join(","), "Program,School,PublicScholarship,City,TimelineWindow,SchoolHandoff");
  for (const entity of readiness.entities) {
    assert.ok(entity.checkedRecords > 0, `${entity.entity} should have runtime records to audit`);
    assert.equal(entity.passed, true, `${entity.entity} should satisfy CSCAlite runtime fields`);
  }
  const timeline = dataClient.getApplicationTimeline();
  assert.ok(timeline.windows.length >= 5);
  assert.ok(timeline.programs.length > 0);
  assert.ok(timeline.schools.length > 0);
  assert.equal(timeline.sourceFieldLineage.sourceModel, "ApplicationTimelineWindow");
  assert.ok(timeline.sourceFieldLineage.sourceFields.includes("applicationWindow"));

  const [submittedRecord] = dataClient.buildSubmittedRecords();
  assert.equal(submittedRecord.sourceFieldLineage.fromProgramRecord.sourceModel, "SchoolProgram");
  assert.equal(submittedRecord.sourceFieldLineage.fromSchoolScholarshipRecords.sourceModel, "SchoolScholarship");
  assert.equal(submittedRecord.sourceFieldLineage.fromSchoolRecord.sourceModel, "School");
  assert.equal(submittedRecord.sourceFieldLineage.fromStudentProfile.sourceModel, "StudentProfile");
  assert.equal(submittedRecord.informationSources.sourceFieldLineage.fromProgramRecord.sourceModel, "SchoolProgram");
  assert.equal(submittedRecord.informationSources.sourceFieldLineage.fromSchoolScholarshipRecords.sourceModel, "SchoolScholarship");
  assert.ok(submittedRecord.informationSources.fromProgramRecord.sourceFieldLineage.sourceFields.includes("tuitionAmount"));
  assert.deepEqual([...submittedRecord.sourceFieldLineage.fromStudentProfile.sourceFields], ["nationality", "nationalityCode", "country", "countryCode", "grade", "gradeCode", "currentOrganizationId", "updatedAt"]);
  assert.equal(submittedRecord.informationSources.fromStudentProfile.countryCode, "MY");
  assert.equal(submittedRecord.informationSources.fromStudentProfile.nationalityCode, "MY");
  assert.equal(submittedRecord.informationSources.fromStudentProfile.gradeCode, "UG_FINAL");
  assert.equal(submittedRecord.informationSources.fromStudentProfile.currentOrganizationId, 7001);
  assert.equal(submittedRecord.informationSources.fromStudentProfile.updatedAt, "2026-08-24T09:00:00.000Z");
  assert.ok(submittedRecord.informationSources.fromSchoolScholarshipRecords.length > 0);
  assert.equal(submittedRecord.informationSources.fromSchoolScholarshipRecords[0].sourceFieldLineage.sourceModel, "SchoolScholarship");
  assert.ok(submittedRecord.scholarshipSignals.length > 0);
  assert.equal(submittedRecord.scholarshipSignals[0].schoolId, submittedRecord.schoolId);
  assert.equal(submittedRecord.scholarshipSignals[0].programId, submittedRecord.programId);
  assert.ok(submittedRecord.informationSources.fromSchoolRecord.sourceFieldLineage.sourceFields.includes("admissionsWebsiteUrl"));
  const [notedRecord] = dataClient.buildSubmittedRecords({
    routes: [{
      university: "Zhejiang University",
      program: "Biomedical Engineering MSc",
      programName: "Biomedical Engineering",
      degree: "MSc",
      city: "Hangzhou",
      intake: "Fall 2026",
      language: "English-taught",
      tuition: "RMB 45k",
      deadline: "Oct 20",
      signal: "Lab fit",
      choiceNote: "I want lab exposure and scholarship review.",
    }],
    student: dataClient.defaultStudentProfile,
    submittedAt: "2026-08-20T10:00:00.000Z",
  });
  assert.equal(notedRecord.studentChoiceNote, "I want lab exposure and scholarship review.");
  assert.equal(notedRecord.informationSources.selectedByStudent.studentChoiceNote, "I want lab exposure and scholarship review.");
  assert.equal(notedRecord.informationSources.fromStudentProfile.passportNationality, "Malaysia");
  assert.equal(notedRecord.informationSources.fromStudentProfile.currentSchool, "Taylor's University");
  assert.equal(notedRecord.informationSources.fromStudentProfile.intendedLevel, "Master");
  assert.equal(notedRecord.informationSources.fromStudentProfile.guardianStatus, "Not required");
  assert.match(notedRecord.informationSources.fromStudentProfile.academicSummary, /software and biology coursework/);
  assert.match(notedRecord.note, /lab exposure and scholarship review/);
  const groupedSchoolRecords = dataClient.buildSubmittedRecords({
    routes: [
      {
        university: "Zhejiang University",
        program: "Computer Science MSc",
        programName: "Computer Science",
        degree: "MSc",
        city: "Hangzhou",
        intake: "Fall 2026",
        language: "English-taught",
        tuition: "RMB 42k",
        deadline: "Oct 15",
        signal: "CSC possible",
      },
      {
        university: "Zhejiang University",
        program: "Biomedical Engineering MSc",
        programName: "Biomedical Engineering",
        degree: "MSc",
        city: "Hangzhou",
        intake: "Fall 2026",
        language: "English-taught",
        tuition: "RMB 45k",
        deadline: "Oct 20",
        signal: "Lab fit",
        choiceNote: "Second ZJU program note.",
      },
    ],
    student: dataClient.defaultStudentProfile,
    submittedAt: "2026-08-20T11:00:00.000Z",
  });
  assert.equal(groupedSchoolRecords.length, 1);
  assert.equal(groupedSchoolRecords[0].school, "Zhejiang University");
  assert.equal(groupedSchoolRecords[0].programInterests.length, 2);
  assert.equal(groupedSchoolRecords[0].programInterests[1].programFullName, "Biomedical Engineering MSc");
  assert.equal(groupedSchoolRecords[0].programInterests[1].studentChoiceNote, "Second ZJU program note.");
  assert.match(cuacData, /notificationEvents:\s*"cuacNotificationEventsDemoState"/);
  assert.match(cuacData, /notificationCenterState:\s*"cuacNotificationCenterDemoState"/);
  assert.match(cuacData, /function readNotificationEvents/);
  assert.match(cuacData, /function addNotificationEvent/);
  assert.match(cuacData, /function getNotificationCenterSummary\(\)/);
  assert.match(cuacData, /function readNotificationCenterState/);
  assert.match(cuacData, /function writeNotificationCenterState/);
  assert.match(cuacData, /normalizeDiscoveryProgram/);
  assert.match(cuacData, /normalizeDiscoverySchool/);
  assert.match(cuacData, /normalizeDiscoveryScholarship/);
  assert.match(cuacData, /normalizeDiscoveryCity/);
  assert.match(cuacData, /const cityContentJson = city\.contentJson \|\| city\.content \|\| \{\}/);
  assert.match(cuacData, /monthlyCostRmb: monthlyCost/);
  assert.match(cuacData, /programs: city\.programs \?\? references\.programCount/);
  assert.match(cuacData, /bestFor: city\.bestFor \|\| content\.bestFor \|\| \[\]/);
  assert.match(cuacData, /normalizeDiscoverySchools/);
  assert.match(cuacData, /normalizeDiscoveryScholarships/);
  assert.match(cuacData, /normalizeDiscoveryCities/);
  assert.match(cuacData, /const schoolCatalog = \{/);
  assert.match(cuacData, /function normalizeCatalogProgram/);
  assert.match(cuacData, /function getNormalizedProgramCatalog/);
  assert.match(cuacData, /function buildChoiceHandoffSnapshot/);
  assert.match(cuacData, /schoolProgram:\s*\[/);
  assert.match(cuacData, /school:\s*\[/);
  assert.match(cuacData, /degreeLevel/);
  assert.match(cuacData, /teachingLanguage/);
  assert.match(cuacData, /tuitionAmount/);
  assert.match(cuacData, /deadlineDate/);
  assert.match(cuacData, /sourceLabel/);
  assert.match(cuacData, /cityGuide:\s*\[/);
  assert.match(cuacData, /publicScholarship:\s*\[/);
  assert.match(cuacData, /schoolScholarship:\s*\[/);
  assert.match(cuacData, /upcomingDeadlines/);
  assert.match(cuacData, /quickFacts/);
  assert.match(cuacData, /detailDisplay/);
  assert.match(cuacData, /programRecords/);
  assert.match(cuacData, /applicationPortalNotes/);
  assert.match(cuacData, /sourceId: school\.sourceId \|\| slugify\(nameEn\)/);
  assert.match(cuacData, /schoolNameEn/);
  assert.match(cuacData, /programNameEn/);
  assert.match(cuacData, /referenceEnglishProgramCount/);
  assert.match(cuacData, /informationSources:\s*handoff/);
  assert.match(cuacData, /notCollectedByCuac:\s*handoff\.notCollectedByCuac/);
  assert.match(cuacData, /fromProgramRecord:\s*\{/);
  assert.match(cuacData, /fromSchoolRecord:\s*\{/);
  assert.match(cuacData, /fromStudentProfile:\s*\{/);
  assert.match(cuacData, /schoolId:\s*handoff\.selectedByStudent\.schoolId/);
  assert.match(cuacData, /programId:\s*handoff\.selectedByStudent\.programId/);
  assert.match(cuacData, /actualCscaRequiredSchoolCount/);
  assert.match(cuacData, /visibleScholarships/);
  assert.match(cuacData, /const references = city\.references \|\| \{/);
  assert.match(cuacData, /const aggregate = city\.aggregate \|\| \{/);
  assert.match(cuacData, /addChoiceInformationSources:\s*\{/);
  assert.match(cuacData, /selectedByStudent:\s*\["schoolId", "programId", "degreeLevel", "intake", "teachingLanguage", "studentChoiceNote"\]/);
  assert.match(cuacData, /fromStudentProfile:\s*\["legalName", "email", "phone", "country", "countryCode", "nationality", "nationalityCode", "passportNationality", "highestEducation", "grade", "gradeCode", "currentSchool", "currentOrganizationId", "intendedLevel", "fundingIntent", "languageTests", "academicSummary", "guardianStatus", "updatedAt", "consent"\]/);
  assert.match(cuacData, /notCollectedByCuac:\s*\["transcriptFile", "passportScan", "languageCertificateFile", "recommendationLetters", "physicalExamForm"\]/);
  assert.match(cuacData, /calculateFee/);
  assert.match(cuacData, /buildSubmittedRecords/);
  assert.match(cuacData, /studentChoiceNote: route\.choiceNote \|\| ""/);
  assert.match(cuacData, /studentChoiceNote: handoff\.selectedByStudent\.studentChoiceNote/);
  assert.match(cuacData, /programInterests:\s*\[\]/);
  assert.match(cuacData, /record\.programInterests\.push\(interest\)/);
  assert.match(cuacData, /programInterestSummary/);
  assert.match(cuacData, /getBillingSnapshot/);
  assert.match(cuacData, /paymentStatus = state\?\.paymentStatus/);
  assert.match(cuacData, /"failed-preview": "Payment issue"/);
  assert.match(cuacData, /commerceOrder = state\?\.commerceOrder/);
  assert.match(cuacData, /paymentCreateResult = state\?\.paymentCreateResult/);
  assert.match(cuacData, /callbackSignaturePayload: paymentCreateResult\?\.callbackSignaturePayload/);
  assert.match(cuacData, /getTenantSubmittedRecords/);
  assert.match(cuacData, /normalizeSchoolRecord/);
  assert.match(cuacData, /extraSchoolFeeUsd:\s*20/);
  assert.match(cuacData, /defaultSchoolTenant:\s*"Zhejiang University"/);

  assert.match(cuacActions, /window\.CuacActionRegistry/);
  assert.match(cuacActions, /application\.submit/);
  assert.match(cuacActions, /application\.open_add_choice/);
  assert.match(cuacActions, /uiActions:\s*\["open-choice-modal"\]/);
  assert.match(cuacActions, /uiActions:\s*\["submit-application"\]/);
  assert.match(cuacActions, /allowedSurfaces:\s*\["authenticated-student"\]/);
  assert.match(cuacActions, /getActionByUiAction/);
  assert.match(cuacActions, /resolveAction/);
  assert.match(cuacActions, /canRunAction/);
  assert.match(cuacActions, /const signedInRequiredUiActions = new Set/);
  assert.match(cuacActions, /"open-choice-modal"/);
  assert.match(cuacActions, /"save-checklist"/);
  assert.match(cuacActions, /"save-cost-estimate"/);
  assert.match(cuacActions, /function requiresSignedIn\(action\)/);
  assert.match(cuacActions, /function resolveAuthState\(authState, surface, role\)/);
  assert.match(cuacActions, /requiresSignedIn\(action\) && resolvedAuthState !== "signed-in"/);
  assert.match(cuacActions, /reason:\s*"sign-in-required"/);
  assert.match(cuacActions, /currentRouteContract/);
  assert.match(cuacActions, /allowedRoutes\.length > 0\) return action\.allowedRoutes\.includes\(routeName\)/);
  assert.match(cuacActions, /reason:\s*"role-not-allowed"/);
  assert.match(cuacActions, /school\.records\.export_csv/);
  assert.match(cuacActions, /school\.records\.bulk_contact/);
  assert.match(cuacActions, /confirmationRequired:\s*true/);

  assert.match(application, /src="cuac-data\.js"[\s\S]*src="application\.js"/);
  assert.match(application, /src="cuac-actions\.js"[\s\S]*src="shared-shell\.js"/);
  const applicationHero = application.match(/<section class="app-hero[\s\S]*?<\/section>/)?.[0] || "";
  assert.doesNotMatch(applicationHero, /data-open-choice-modal/);
  assert.doesNotMatch(applicationHero, /data-agent-prompt/);
  assert.doesNotMatch(applicationHero, /Ask Agent to explain/);
  assert.doesNotMatch(applicationHero, /data-scroll-target/);
  assert.doesNotMatch(applicationHero, /Review choices/);
  assert.match(application, /<button class="add-choice-tile"[\s\S]*data-open-choice-modal/);
  assert.match(application, /data-remove-choice/);
  assert.match(application, /Application status/);
  assert.match(application, /class="application-stepper"/);
  assert.match(application, /data-required-step="choices"/);
  assert.match(application, /data-required-step="payment"/);
  assert.match(application, /data-required-step="send"/);
  assert.match(schoolPortal, /src="shared-shell\.js"[\s\S]*src="school-portal-runtime\.js(?:\?[^"]*)?"/);
  assert.match(billing, /src="cuac-data\.js"[\s\S]*src="completion\.js"/);
  assert.match(programs, /src="cuac-data\.js"[\s\S]*src="programs\.js(?:\?[^"]*)?"/);
  assert.match(universities, /src="cuac-data\.js"[\s\S]*src="universities\.js(?:\?[^"]*)?"/);
  assert.match(scholarships, /src="cuac-data\.js"[\s\S]*src="scholarships\.js(?:\?[^"]*)?"/);
  assert.match(cities, /src="cuac-data\.js"[\s\S]*src="cities\.js(?:\?[^"]*)?"/);
  assert.match(guides, /src="cuac-data\.js"[\s\S]*src="guides\.js"/);

  assert.match(applicationJs, /const dataClient = window\.CuacDataClient/);
  assert.match(applicationJs, /dataClient\?\.getProgramCatalog/);
  assert.match(applicationJs, /dataClient\?\.calculateFee/);
  assert.match(applicationJs, /dataClient\?\.buildSubmittedRecords/);
  assert.match(applicationJs, /dataClient\?\.writeApplicationDemoState/);
  assert.match(applicationJs, /function appendChoiceRoute\(route = \{\}, options = \{\}\)/);
  assert.match(applicationJs, /function restorePersistedChoiceRoutes\(\)/);
  assert.match(applicationJs, /restorePersistedChoiceRoutes\(\);/);
  assert.doesNotMatch(applicationJs, /\[data-scroll-target\]/);
  assert.match(applicationJs, /location\.hash === "#add-choice"/);
  assert.match(applicationJs, /function removeChoice\(button\)/);
  assert.match(schoolPortalJs, /requestJson\("\/api\/v1\/school\/applications"\)/);
  assert.match(schoolPortalJs, /auth\.tenantSchoolId/);
  assert.doesNotMatch(schoolPortalJs, /CuacDataClient|localStorage|sessionStorage/);
  assert.match(completionJs, /CuacDataClient\?\.getBillingSnapshot/);
  assert.match(completionJs, /billing\.paymentStatus === "failed-preview"/);
  assert.match(completionJs, /Choices saved, not sent/);
  assert.match(completionJs, /CSCAlite commerce flow/);
  assert.match(completionJs, /PaymentCreateResult\.paymentId/);
  assert.match(completionJs, /callbackSignaturePayload/);
  assert.match(completionJs, /dataClient\?\.getCompletionDetail/);
  assert.match(completionJs, /mode !== "school-settings"/);
  assert.match(completionJs, /school-copy-request-template/);
  assert.match(completionJs, /材料请求模板已复制。CUAC 未收取文件。/);
  assert.match(completionJs, /window\.CUAC\?\.requireSignedIn[\s\S]*Save this item/);
  assert.doesNotMatch(completionJs, /const catalog =/);
  assert.match(programsJs, /fallbackPrograms/);
  assert.match(programsJs, /CuacDataClient\?\.getDiscoveryPrograms/);
  assert.match(programsJs, /window\.CUAC\?\.requireStudentSignedIn[\s\S]*Save this program/);
  assert.match(programsJs, /function programDegreeValue\(program = \{\}\)/);
  assert.match(programsJs, /program\.degree \|\| program\.degreeLevel/);
  assert.match(programsJs, /function programLanguageValue\(program = \{\}\)/);
  assert.match(programsJs, /program\.language \|\| program\.teachingLanguage/);
  assert.match(programsJs, /function programDeadline\(program = \{\}\)/);
  assert.match(programsJs, /program\.deadlineDate \|\| program\.deadline/);
  assert.match(programsJs, /function programTuitionAmount\(program = \{\}\)/);
  assert.match(programsJs, /program\.tuitionAmount \?\? program\.tuition/);
  assert.match(programsJs, /routeParams\.get\("keyword"\) \|\| routeParams\.get\("q"\)/);
  assert.match(programsJs, /routeParams\.get\("degreeLevel"\) \|\| routeParams\.get\("applicationLevel"\)/);
  assert.match(programsJs, /routeParams\.get\("teachingLanguage"\)/);
  assert.match(programsJs, /routeParams\.get\("programSubject"\) \|\| routeParams\.get\("fieldCategory"\) \|\| routeParams\.get\("subject"\)/);
  assert.match(programsJs, /truthyParam\(routeParams\.get\("hasScholarship"\)\)/);
  assert.match(programsJs, /truthyParam\(routeParams\.get\("hasUpcomingDeadline"\)\)/);
  assert.match(programsJs, /function programCscaSummary\(program = \{\}\)/);
  assert.match(programsJs, /program\.displaySubjects \|\| program\.cscaSubjects \|\| program\.cscaRequirement/);
  assert.match(programsJs, /function renderRequirementCards\(program = \{\}\)/);
  assert.match(programsJs, /Language proof/);
  assert.match(programsJs, /Application note/);
  assert.match(cuacData, /const discoverySchools = \[/);
  assert.match(cuacData, /const discoveryScholarships = \[/);
  assert.match(cuacData, /const discoveryCities = \[/);
  assert.match(cuacData, /const discoveryGuides = \[/);
  assert.match(cuacData, /const completionDetailCatalog = \{/);
  assert.match(cuacData, /function buildDynamicCompletionDetail\(mode, slug\)/);
  assert.match(cuacData, /function buildProgramCompletionDetail\(program\)/);
  assert.match(cuacData, /function buildSchoolCompletionDetail\(school\)/);
  assert.match(cuacData, /function buildScholarshipCompletionDetail\(item\)/);
  assert.match(cuacData, /function buildCityCompletionDetail\(city\)/);
  assert.match(cuacData, /function cityDisplayGuide\(city = \{\}\)/);
  assert.match(cuacData, /function cityResourceFacts\(city = \{\}\)/);
  assert.match(cuacData, /resourceFacts: cityResourceFacts\(city\)/);
  assert.match(cuacData, /quickFacts: cityQuickFacts\(city\)/);
  assert.match(completionJs, /renderCityQuickFacts\(guide\.quickFacts \|\| \[\]\)/);
  assert.doesNotMatch(completionJs, /renderCityQuickFacts\(resourceFacts\)/);
  assert.match(completionJs, /function renderCityContentFacts\(facts = \[\]\)/);
  assert.doesNotMatch(completionJs, /renderCityContentFacts\(guide\.quickFacts \|\| \[\]\)/);
  assert.match(completionCss, /\.city-content-facts/);
  assert.match(cuacData, /lifeSections: cityLifeSectionsDisplay\(city\)/);
  assert.match(cuacData, /applicationAdvice: cityApplicationAdviceDisplay\(city\)/);
  assert.match(cuacData, /faqs: cityFaqDisplay\(city\)/);
  assert.match(cuacData, /function normalizeCompletionDetail\(mode, slug, detail, dynamicDetail = null\)/);
  assert.match(cuacData, /const dynamicDetail = buildDynamicCompletionDetail\(mode, slug\)/);
  assert.match(cuacData, /return clone\(normalizeCompletionDetail\(mode, slug, detail, dynamicDetail\)\)/);
  assert.match(universitiesJs, /^(?:\uFEFF)?const universities = window\.CuacDataClient\?\.getDiscoverySchools\?\.\(\) \|\| \[\]/);
  assert.doesNotMatch(universitiesJs, /fallbackUniversities/);
  assert.match(universitiesJs, /window\.CUAC\?\.requireStudentSignedIn[\s\S]*Save this university/);
  assert.match(universitiesJs, /function schoolName\(item = \{\}\)/);
  assert.match(universitiesJs, /item\.nameEn \|\| item\.name/);
  assert.match(universitiesJs, /function schoolCity\(item = \{\}\)/);
  assert.match(universitiesJs, /item\.cityZh \|\| item\.city/);
  assert.match(universitiesJs, /function schoolProgramCount\(item = \{\}\)/);
  assert.match(universitiesJs, /if \(item\.programCount != null\) return item\.programCount/);
  assert.match(universitiesJs, /return schoolPrograms\(item\)\.length/);
  assert.match(universitiesJs, /function schoolEnglishRouteCount\(item = \{\}\)/);
  assert.match(universitiesJs, /if \(item\.englishProgramCount != null\) return item\.englishProgramCount/);
  assert.match(universitiesJs, /if \(item\.routes != null\) return item\.routes/);
  assert.match(scholarshipsJs, /const scholarships = window\.CuacDataClient\?\.getDiscoveryScholarships\?\.\(\) \|\| \[\]/);
  assert.doesNotMatch(scholarshipsJs, /fallbackScholarships/);
  assert.match(scholarshipsJs, /window\.CUAC\?\.requireStudentSignedIn[\s\S]*Save this scholarship/);
  assert.match(scholarshipsJs, /function coverageValues/);
  assert.match(scholarshipsJs, /function renderScholarshipReadiness\(item = \{\}\)/);
  assert.match(scholarshipsJs, /keyword:\s*""/);
  assert.match(scholarshipsJs, /function scholarshipMatchesKeyword\(item = \{\}\)/);
  assert.match(scholarshipsJs, /function normalizeScholarshipTypeParam\(value\)/);
  assert.match(scholarshipsJs, /function normalizeScholarshipFundingParam\(value\)/);
  assert.match(scholarshipsJs, /function normalizeScholarshipDegreeParam\(value\)/);
  assert.match(scholarshipsJs, /routeParams\.get\("keyword"\) \|\| routeParams\.get\("q"\)/);
  assert.match(scholarshipsJs, /routeParams\.get\("fundingLevel"\) \|\| routeParams\.get\("funding"\)/);
  assert.match(scholarshipsJs, /routeParams\.get\("country"\) \|\| routeParams\.get\("targetCountry"\)/);
  assert.match(scholarshipsJs, /routeParams\.get\("region"\) \|\| routeParams\.get\("targetRegion"\)/);
  assert.match(scholarshipsJs, /routeParams\.get\("applicableDegree"\) \|\| routeParams\.get\("degree"\)/);
  assert.match(scholarshipsJs, /provincial:\s*"province"/);
  assert.match(scholarshipsJs, /country:\s*"all"/);
  assert.match(scholarshipsJs, /function scholarshipCountryOptions\(\)/);
  assert.match(scholarshipsJs, /function scholarshipScopeSummary\(item = \{\}\)/);
  assert.match(scholarshipsJs, /Country \/ region/);
  assert.match(scholarshipsJs, /Scholarship scope/);
  assert.match(scholarshipsJs, /item\.eligibilityItems/);
  assert.match(scholarshipsJs, /item\.applicationMaterials/);
  assert.match(scholarshipsJs, /item\.applicationSteps/);
  assert.match(scholarshipsJs, /Scholarship readiness summary/);
  assert.match(citiesJs, /const cities = window\.CuacDataClient\?\.getDiscoveryCities\?\.\(\) \|\| \[\]/);
  assert.doesNotMatch(citiesJs, /fallbackCities/);
  assert.match(citiesJs, /#cityList \.browser-tools/);
  assert.match(citiesJs, /function cityFromHash\(value = window\.location\.hash\)/);
  assert.match(citiesJs, /function applyHashCity\(value = window\.location\.hash\)/);
  assert.match(citiesJs, /function cityMonthlyCost\(city = \{\}\)/);
  assert.match(citiesJs, /referenceProgramCount \?\? city\.programs/);
  assert.match(citiesJs, /referenceEnglishProgramCount \?\? city\.englishRoutes/);
  assert.match(citiesJs, /city\.contentJson\?\.summary/);
  assert.match(citiesJs, /applyHashCity\(\);[\s\S]*renderAll\(\);/);
  assert.match(citiesJs, /window\.addEventListener\("hashchange"/);
  assert.match(guides, /programs\.html\?degree=non-degree/);
  assert.match(guides, /Open the next workspace/);
  assert.match(guides, /Open Hub/);
  assert.doesNotMatch(guides, /data-guide-prompt|Ask Agent|Ask CUAC Agent/);
  assert.doesNotMatch(guides, /programs\.html\?degree=non_degree/);
  assert.match(guidesJs, /CuacDataClient\?\.getDiscoveryGuides/);
  assert.doesNotMatch(guidesJs, /data-guide-prompt|runGuidePrompt/);
  assert.match(cuacData, /type:\s*"content"/);
  assert.match(legacySpec, /D:\\CODE\\CSCAlite/);
  assert.match(legacySpec, /Field governance rule/);
  assert.match(legacySpec, /source layer keeps current CSCAlite\/Prisma-compatible field names/);
  assert.match(legacySpec, /display\/API layer may expose clearer CUAC aliases/);
  assert.match(legacySpec, /`School\.officialWebsiteUrl`/);
  assert.match(legacySpec, /`School\.admissionsWebsiteUrl`/);
  assert.match(legacySpec, /`School\.qualityScore`/);
  assert.match(legacySpec, /SchoolProgramRecord/);
  assert.match(legacySpec, /SchoolScholarshipRecord/);
  assert.match(legacySpec, /PublicScholarship/);
  assert.match(legacySpec, /CityGuide/);
  assert.match(legacySpec, /`sourceNote`/);
  assert.match(legacySpec, /`programSubjectTags`/);
  assert.match(legacySpec, /governance\/display: `sortOrder`/);
  assert.match(legacySpec, /SearchItem/);
  assert.match(legacySpec, /CUAC aliases allowed/);
  assert.doesNotMatch(legacySpec, /`officialWebsiteUrl` -> `officialWebsite`/);
  assert.doesNotMatch(legacySpec, /`admissionsWebsiteUrl` -> `applicationSystemUrl`/);
  assert.doesNotMatch(legacySpec, /`dataQualityScore` -> `qualityScore`/);
  assert.match(legacySpec, /Add Choice Information Sources/);
  assert.match(legacySpec, /not the Add choice selector/);
  assert.match(legacySpec, /Current demo implementation/);
  assert.match(legacySpec, /`CuacDataClient\.buildSubmittedRecords\(\)` builds a tenant-scoped school handoff record/);
  assert.match(legacySpec, /informationSources\.selectedByStudent/);
  assert.match(legacySpec, /informationSources\.fromProgramRecord/);
  assert.match(legacySpec, /informationSources\.fromSchoolScholarshipRecords/);
  assert.match(legacySpec, /informationSources\.fromSchoolRecord/);
  assert.match(legacySpec, /informationSources\.fromStudentProfile/);
  assert.match(legacySpec, /informationSources\.sourceFieldLineage/);
  assert.match(legacySpec, /top-level school handoff `sourceFieldLineage`/);
  assert.match(legacySpec, /informationSources\.notCollectedByCuac/);
  assert.match(legacySpec, /must not reveal other school choices or student private Agent memory/);
  assert.match(legacySpec, /Runtime Contract Surface/);
  assert.match(legacySpec, /CuacDataClient\.legacyFieldContracts\.auditEvidence/);
  assert.match(legacySpec, /auditEvidence\.currentBaseline/);
  assert.match(legacySpec, /CuacDataClient\.legacyFieldContracts\.entityContracts/);
  assert.match(legacySpec, /CuacDataClient\.getLegacyEntityContract\(entityName\)/);
  assert.match(legacySpec, /CuacDataClient\.getLegacySourceCoverageAudit\(\)/);
  assert.match(legacySpec, /`Scholarship` resolves to public scholarship, while `SchoolScholarship` remains school-scoped funding context/);
  assert.match(legacySpec, /Current Audit Against CSCAlite/);
  assert.match(legacySpec, /Use the current Prisma schema and public\/backend types as the baseline/);
  assert.match(legacySpec, /backend\/prisma\/migrations\/0008_school_decision_enhancements\/migration\.sql/);
  assert.match(legacySpec, /Do not treat `migration-intake\/0007_school_programs\/migration\.sql` as the complete program model by itself/);
  assert.match(legacySpec, /`SchoolProgram\.openDate`, `deadlineDate`, `deadlineLabel`, `applicationRound`, `applicationUrl`, `applicationNote`/);
  assert.match(legacySpec, /summarized HSK\/English requirement fields/);
  assert.match(legacySpec, /`hskRequirement`/);
  assert.match(legacySpec, /SchoolScholarship` is a separate source model from public `Scholarship`/);
  assert.match(legacySpec, /source lineage must cite `CityGuide\.contentJson`/);
  assert.match(legacySpec, /Verified against the current `D:\\CODE\\CSCAlite` worktree on 2026-08-20/);
  assert.match(legacySpec, /Runtime guard added on 2026-08-20/);
  assert.match(legacySpec, /CityGuideAggregate/);
  assert.match(legacySpec, /`CuacDataClient\.getLegacyContractReadiness\(\)` scans the runtime demo records/);
  assert.match(legacySpec, /School portal analytics should read tenant-scoped `schoolId`, `programId`, `degreeLevel`, `teachingLanguage`, `deadlineDate`, `applicationRound`/);
  assert.match(mockDataSpec, /CSCAlite compatibility rule/);
  assert.match(mockDataSpec, /source-field lineage from `D:\\CODE\\CSCAlite`/);
  assert.match(mockDataSpec, /Use `CUAC_LEGACY_FIELD_MAPPING_SPEC\.md` as the canonical field audit/);
  assert.match(mockDataSpec, /do not copy only the early `0007_school_programs` shape/);
  assert.match(mockDataSpec, /`SchoolProgram`/);
  assert.match(mockDataSpec, /Add choice and school handoff must use these source fields rather than free text/);
  assert.match(mockDataSpec, /Application handoff records should carry `sourceFieldLineage`/);
  assert.match(mockDataSpec, /internal metadata for traceability and Agent explanation/);
  assert.match(mockDataSpec, /handoff should include `scholarshipSignals`/);
  assert.match(mockDataSpec, /informationSources\.fromSchoolScholarshipRecords/);
  assert.match(mockDataSpec, /public scholarships are projections of `Scholarship` plus `ScholarshipSchool`\/`ScholarshipProgram` links/);
  assert.match(apiSpec, /Catalog payloads preserve CSCAlite-compatible camelCase field names/);
  assert.match(apiSpec, /Frontend Adapter Alignment/);
  assert.match(apiSpec, /CuacDataClient\.getBackendAdapterContract\(\)/);
  assert.match(apiSpec, /Adapter domains map to this API contract/);
  assert.match(apiSpec, /applications_payments/);
  assert.match(apiSpec, /Payment failure keeps choices saved and must not create school-visible records/);
  assert.match(apiSpec, /school_portal/);
  assert.match(apiSpec, /Every request resolves `tenantSchoolId` server-side/);
  assert.match(apiSpec, /backend must recheck `role`, `surface`, `tenantSchoolId`, `actionKey`, and `continuationToken`/);
  assert.match(apiSpec, /Page components should not call arbitrary backend endpoints directly/);
  assert.match(apiSpec, /Catalog and handoff payloads may include `sourceFieldLineage`/);
  assert.match(apiSpec, /machine-readable metadata used for Agent citation, audit, data-quality review/);
  assert.match(apiSpec, /SchoolProgramRecord/);
  assert.match(apiSpec, /SchoolRecord/);
  assert.match(apiSpec, /PublicScholarship/);
  assert.match(apiSpec, /CityGuideAggregate/);
  assert.match(apiSpec, /"nameEn": "Computer Science MSc"/);
  assert.match(apiSpec, /"tuitionText": "RMB 42,000 \/ year"/);
  assert.match(apiSpec, /"sourceLabel": "School admissions notice"/);
  assert.match(apiSpec, /"sourceFieldLineage": \{[\s\S]*"sourceModel": "SchoolProgram"/);
  assert.match(apiSpec, /"displayAliases": \{ "name": "SchoolProgram\.nameEn"/);
  assert.match(apiSpec, /Copy `informationSources` and `sourceFieldLineage` snapshots into each school-scoped record/);
  assert.match(apiSpec, /Response items should include only tenant-safe `sourceFieldLineage` and `informationSources`/);
  assert.match(apiSpec, /informationSources\.fromProgramRecord/);
  assert.match(apiSpec, /notCollectedByCuac/);
  assert.match(apiSpec, /### GET \/cities/);
  assert.match(apiSpec, /"actualCscaRequiredSchoolCount": 0/);
  assert.match(dbSpec, /Catalog Legacy Compatibility Rule/);
  assert.match(dbSpec, /Physical database columns use snake_case/);
  assert.match(dbSpec, /Catalog and school handoff rows should preserve machine-readable source lineage/);
  assert.match(dbSpec, /source_field_lineage_json/);
  assert.match(dbSpec, /selected_by_student_json jsonb default '\{\}'/);
  assert.match(dbSpec, /information_sources_json jsonb default '\{\}'/);
  assert.match(dbSpec, /not_collected_by_cuac_json jsonb default '\[\]'/);
  assert.match(dbSpec, /program_record_snapshot_json jsonb default '\{\}'/);
  assert.match(dbSpec, /SchoolRecord-compatible columns/);
  assert.match(dbSpec, /SchoolProgramRecord-compatible columns/);
  assert.match(dbSpec, /PublicScholarship-compatible columns/);
  assert.match(dbSpec, /CityGuide-compatible columns/);
  assert.match(dbSpec, /source_note/);
  assert.match(dbSpec, /program_subject_tags/);
  assert.match(dbSpec, /tuition_text/);
  assert.match(dbSpec, /deadline_label/);
  assert.match(dbSpec, /content_json/);
  assert.match(dbSpec, /reference_csca_school_count/);
  assert.match(dbSpec, /submittedRecords \| school_applications, school_application_program_interests, information_sources_json, source_field_lineage_json/);
});

test("keeps page route contracts aligned with the frontend product taxonomy", async () => {
  const [cuacData, routeChecklist, productSpec, sharedJs, authJs, apiSpec, dbSpec, agentSpec, roleMatrix, threatModel] = await Promise.all([
    readFile(new URL("../public/cuac-data.js", import.meta.url), "utf8"),
    readFile(new URL("../../CUAC_FRONTEND_ROUTE_CONTRACT_CHECKLIST.md", import.meta.url), "utf8"),
    readFile(new URL("../../CUAC_FRONTEND_PRODUCTIZATION_SPEC.md", import.meta.url), "utf8"),
    readFile(new URL("../public/shared-shell.js", import.meta.url), "utf8"),
    readFile(new URL("../public/auth.js", import.meta.url), "utf8"),
    readFile(new URL("../../CUAC_APPLICATION_API_CONTRACT.md", import.meta.url), "utf8"),
    readFile(new URL("../../CUAC_DATABASE_ERD_SPEC.md", import.meta.url), "utf8"),
    readFile(new URL("../../CUAC_AGENT_ACTION_ARCHITECTURE.md", import.meta.url), "utf8"),
    readFile(new URL("../../CUAC_ROLE_PERMISSION_MATRIX.md", import.meta.url), "utf8"),
    readFile(new URL("../../CUAC_SECURITY_PRIVACY_THREAT_MODEL.md", import.meta.url), "utf8"),
  ]);

  const contractedRoutes = [
    "home-v3.html",
    "programs.html",
    "program-detail.html",
    "universities.html",
    "university-detail.html",
    "scholarships.html",
    "scholarship-detail.html",
    "cities.html",
    "city-detail.html",
    "guides.html",
    "guide-detail.html",
    "auth.html",
    "onboarding.html",
    "hub.html",
    "favourites.html",
    "application.html",
    "billing.html",
    "notifications.html",
    "preferences.html",
    "school-portal.html",
    "school-settings.html",
    "ops-admin.html",
  ];

  for (const route of contractedRoutes) {
    assert.match(cuacData, new RegExp(`route:\\s*"${route.replace(".", "\\.")}"`));
    assert.match(routeChecklist, new RegExp(`\\\`${route.replace(".", "\\.")}\\\``));

    const routeBlock = cuacData.match(new RegExp(`route:\\s*"${route.replace(".", "\\.")}"[\\s\\S]*?productizationStatus:\\s*"[^"]+"`))?.[0] || "";
    const expectedAgentMode = routeBlock.match(/agentMode:\s*"([^"]+)"/)?.[1] || "";
    const surface = routeBlock.match(/surface:\s*"([^"]+)"/)?.[1] || "";
    const html = await readFile(new URL(`../public/${route}`, import.meta.url), "utf8");
    const bodyAgentMode = html.match(/<body[^>]*data-agent-mode="([^"]+)"/)?.[1] || "";

    assert.equal(bodyAgentMode, expectedAgentMode, `${route} body Agent mode should match its route contract`);

    if (surface === "public-student") {
      assert.doesNotMatch(html, /data-auth-state="signed-in"/, `${route} should not force long-term student memory while public`);
    }

    if (surface === "authenticated-student" && route === "onboarding.html") {
      assert.match(html, /<body[^>]*data-auth-state="signed-in"/);
      assert.match(html, /data-cuac-header[^>]*data-auth-state="signed-in"/);
    }
  }

  assert.match(cuacData, /surface:\s*"public-student"/);
  assert.match(cuacData, /surface:\s*"authenticated-student"/);
  assert.match(cuacData, /surface:\s*"school-staff"/);
  assert.match(cuacData, /surface:\s*"cuac-internal"/);
  assert.match(cuacData, /dataSource:\s*\["shared-client", "local-state"\]/);
  assert.match(cuacData, /agentMode:\s*"application"/);
  assert.match(cuacData, /route:\s*"school-portal\.html"[\s\S]*agentMode:\s*"school"/);
  assert.match(cuacData, /route:\s*"school-settings\.html"[\s\S]*agentMode:\s*"school"/);
  assert.match(cuacData, /keyExits:\s*\["billing\.html", "school-portal\.html", "hub\.html"\]/);
  assert.match(cuacData, /permissionRisk:\s*"Critical; cross-tenant access must be internal-only and audited\."/);
  assert.match(routeChecklist, /getRouteContracts\(\)/);
  assert.match(productSpec, /Route Contracts/);
  assert.match(productSpec, /CuacDataClient\.getBackendAdapterContract\(\)/);
  assert.match(productSpec, /Current adapter domains/);
  assert.match(productSpec, /applications\/payments: Add Choice, fee review, payment simulation, billing, and school handoff/);
  assert.match(productSpec, /Prepare production backend handoff tickets from the proven frontend contracts in this order/);
  assert.match(productSpec, /static mock data can be swapped for API data through `CuacDataClient` and its backend adapter contract/);
  assert.match(productSpec, /Agent actions should eventually use these contracts/);
  assert.match(productSpec, /Agent Context Retention/);
  assert.match(productSpec, /signed-out visitors use only the current page\/session context/);
  assert.match(productSpec, /signed-in students may keep long-cycle application memory/);
  assert.match(productSpec, /school staff Agent context must use only tenant-scoped records/);
  assert.match(productSpec, /public student routes must resolve to signed-out Agent context/);
  assert.match(routeChecklist, /public student routes default to signed-out Agent context/);
  assert.match(routeChecklist, /body `data-agent-mode` must match its `CuacDataClient` route contract/);
  assert.match(sharedJs, /let runtimeAuthState = \{/);
  assert.match(apiSpec, /signed-out visitor: current page context only; no durable conversation or account memory/);
  assert.match(apiSpec, /The shared frontend auth page is a continuation shell, not a student-only form/);
  assert.match(apiSpec, /POST \/auth\/register/);
  assert.match(apiSpec, /Deprecated compatibility: `POST \/auth\/student\/register` may exist as a temporary alias/);
  assert.match(apiSpec, /POST \/auth\/school\/invitations\/accept/);
  assert.match(apiSpec, /POST \/auth\/internal\/access\/accept/);
  assert.match(apiSpec, /POST \/auth\/sign-in-continuations/);
  assert.match(apiSpec, /one account registration\/sign-in pattern with different access contexts, roles, and organization grants/);
  assert.match(apiSpec, /the invited person still creates or signs in to their own account/);
  assert.match(apiSpec, /"accessStatus": "pending"/);
  assert.match(apiSpec, /"nextRequiredGrant": "cuac_staff_access_grant"/);
  assert.match(apiSpec, /materializes approved roles into `user_roles`/);
  assert.match(apiSpec, /surface_or_role_mismatch/);
  assert.match(apiSpec, /Ops\/Admin permissions start only after this access record is approved and audited/);
  assert.match(apiSpec, /signInContinuationAllowed:\s*true/);
  assert.match(apiSpec, /DELETE \/agent\/memory/);
  assert.match(dbSpec, /primary_account_type text: person, service/);
  assert.match(dbSpec, /intended_surface text nullable: student, school_staff, cuac_internal/);
  assert.match(dbSpec, /### auth_identities/);
  assert.match(dbSpec, /### auth_sessions/);
  assert.match(dbSpec, /### school_staff_invites/);
  assert.match(dbSpec, /### cuac_staff_access_grants/);
  assert.match(dbSpec, /grant_source text: team_invite, sso_claim, admin_assignment, manual_approval/);
  assert.match(dbSpec, /must not create `user_roles\.role = cuac_ops` or `cuac_admin` until an approved grant exists/);
  assert.match(dbSpec, /### sign_in_continuations/);
  assert.match(dbSpec, /allowed_access_contexts text\[\] nullable: student, school_staff, cuac_internal/);
  assert.match(dbSpec, /required_access_context text nullable: student, school_staff, cuac_internal/);
  assert.match(dbSpec, /action policy, not the signed-out visitor's identity/);
  assert.match(dbSpec, /Cross-context, cross-role, or cross-tenant replay must be denied/);
  assert.match(dbSpec, /context_scope text: guest_page, student_account, school_tenant, ops_audit/);
  assert.match(dbSpec, /No row may use `context_scope = guest_page`/);
  assert.match(dbSpec, /pending_after_sign_in boolean default false/);
  assert.match(agentSpec, /signed-out visitor: current-page session only, no durable Agent memory/);
  assert.match(roleMatrix, /Use Agent page context/);
  assert.match(roleMatrix, /Read long-term student Agent memory/);
  assert.match(roleMatrix, /Protected visitor actions should return a sign-in continuation path/);
  assert.match(roleMatrix, /Create student account/);
  assert.match(roleMatrix, /Accept school staff invite/);
  assert.match(roleMatrix, /Create CUAC account and request internal access/);
  assert.match(roleMatrix, /Students, school staff, and CUAC staff use the same base account registration and sign-in system/);
  assert.match(roleMatrix, /approved `cuac_staff_access_grants` record/);
  assert.match(roleMatrix, /School staff may use only tenant-scoped school Agent context/);
  assert.match(threatModel, /Agent Memory Leakage Or Retention Drift/);
  assert.match(threatModel, /sign-in continuation replays a stale or tampered protected action/);
  assert.match(threatModel, /Account Boundary And Registration Abuse/);
  assert.match(threatModel, /student self-registration accidentally creates school or CUAC internal authority/);
  assert.match(threatModel, /approved `cuac_staff_access_grants` record/);
  assert.match(threatModel, /hash invite and continuation tokens at rest/);
  assert.match(threatModel, /no durable `agent_memory_entries` for `guest_page`/);
  assert.match(threatModel, /school Agent memory must require `tenant_school_id`/);
  assert.match(sharedJs, /function runtimeSurface\(role, selectedSurface\)/);
  assert.match(sharedJs, /async function loadRuntimeAuthState\(\)/);
  assert.match(sharedJs, /fetch\("\/api\/v1\/me"/);
  assert.match(sharedJs, /fetch\("\/api\/v1\/auth\/logout"/);
  assert.match(sharedJs, /function showSignInRequired/);
  assert.match(sharedJs, /async function createServerContinuation\(input\)/);
  assert.match(sharedJs, /fetch\("\/api\/v1\/auth\/guest-session"/);
  assert.match(sharedJs, /fetch\("\/api\/v1\/auth\/sign-in-continuations"/);
  assert.match(sharedJs, /navigation\.open_student_workspace/);
  assert.match(sharedJs, /navigation\.open_school_workspace/);
  assert.match(sharedJs, /navigation\.open_ops_workspace/);
  assert.match(sharedJs, /function navigateToAuthPage\(options = \{\}\)/);
  assert.match(sharedJs, /const requiredRole = options\.requiredRole \|\| options\.role \|\| "student"/);
  assert.match(sharedJs, /selectedRole: options\.requiredRole \|\| options\.role/);
  assert.doesNotMatch(sharedJs, /function readStoredAuthState\(\)|approved-preview|cuacAuthDemoState|cuacAuthContinuationDemoState/);
  assert.match(authJs, /requestJson\("\/api\/v1\/auth\/sessions"/);
  assert.match(authJs, /requestJson\("\/api\/v1\/auth\/register"/);
  assert.match(authJs, /requestJson\("\/api\/v1\/auth\/password-reset"/);
  assert.doesNotMatch(authJs, /persistAuthPreview|approved-preview|cuacAuthDemoState|localStorage\.setItem/);
  assert.doesNotMatch(sharedJs, /function persistModalAuth/);
  assert.doesNotMatch(sharedJs, /data-cuac-auth-modal/);
  assert.match(sharedJs, /function normalizeContinuationTarget\(value\)/);
  assert.match(sharedJs, /payloadPreview: options\.payloadPreview \|\| \{\}/);
  assert.doesNotMatch(sharedJs, /resumeAction: options\.resumeAction|click-selector-resumed/);
  assert.match(sharedJs, /navigateToAuthPage\(\)/);
  assert.match(sharedJs, /runtimeAuthState\.authState === "signed-in"/);
  assert.match(sharedJs, /return \{ authState: "signed-out", role: "visitor", surface: routeSurface \}/);
  assert.match(sharedJs, /actor\?\.actorUserId && allowedRole/);
  assert.match(sharedJs, /function initProtectedStudentPage\(\)/);
  assert.match(sharedJs, /const protectedRoleRoutes = \{/);
  assert.match(sharedJs, /"school-portal\.html": \{ role: "school_staff"/);
  assert.match(sharedJs, /"ops-admin\.html": \{ role: "cuac_ops"/);
  assert.match(sharedJs, /function initProtectedRolePage\(\)/);
  assert.match(sharedJs, /initProtectedRolePage\(\);/);
  assert.match(sharedJs, /showSignInRequired\("Sign in to open your student workspace", \{ requiredRole: "student" \}\)/);
  assert.match(sharedJs, /initProtectedStudentPage\(\);/);
});

test("keeps the CUAC app shell and static demo assets wired", async () => {
  const [
    page,
    layout,
    packageJson,
    home,
    homeJs,
    programs,
    programsJs,
    programsCss,
    universities,
    universitiesJs,
    universitiesCss,
    cities,
    citiesJs,
    citiesCss,
    scholarships,
    scholarshipsJs,
    scholarshipsCss,
    notifications,
    notificationsJs,
    notificationsCss,
    preferences,
    preferencesJs,
    preferencesCss,
    favourites,
    favouritesJs,
    hub,
    hubJs,
    onboardingJs,
    cuacData,
    routeChecklist,
    auth,
    authJs,
    authCss,
    applicationJs,
    completionJs,
    sharedJs,
    sharedCss,
    qaCoreFlows,
    qaLayout,
  ] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../public/home-v3.html", import.meta.url), "utf8"),
    readFile(new URL("../public/home-v3.js", import.meta.url), "utf8"),
    readFile(new URL("../public/programs.html", import.meta.url), "utf8"),
    readFile(new URL("../public/programs.js", import.meta.url), "utf8"),
    readFile(new URL("../public/programs.css", import.meta.url), "utf8"),
    readFile(new URL("../public/universities.html", import.meta.url), "utf8"),
    readFile(new URL("../public/universities.js", import.meta.url), "utf8"),
    readFile(new URL("../public/universities.css", import.meta.url), "utf8"),
    readFile(new URL("../public/cities.html", import.meta.url), "utf8"),
    readFile(new URL("../public/cities.js", import.meta.url), "utf8"),
    readFile(new URL("../public/cities.css", import.meta.url), "utf8"),
    readFile(new URL("../public/scholarships.html", import.meta.url), "utf8"),
    readFile(new URL("../public/scholarships.js", import.meta.url), "utf8"),
    readFile(new URL("../public/scholarships.css", import.meta.url), "utf8"),
    readFile(new URL("../public/notifications.html", import.meta.url), "utf8"),
    readFile(new URL("../public/notifications.js", import.meta.url), "utf8"),
    readFile(new URL("../public/notifications.css", import.meta.url), "utf8"),
    readFile(new URL("../public/preferences.html", import.meta.url), "utf8"),
    readFile(new URL("../public/preferences.js", import.meta.url), "utf8"),
    readFile(new URL("../public/preferences.css", import.meta.url), "utf8"),
    readFile(new URL("../public/favourites.html", import.meta.url), "utf8"),
    readFile(new URL("../public/favourites.js", import.meta.url), "utf8"),
    readFile(new URL("../public/hub.html", import.meta.url), "utf8"),
    readFile(new URL("../public/hub.js", import.meta.url), "utf8"),
    readFile(new URL("../public/onboarding.js", import.meta.url), "utf8"),
    readFile(new URL("../public/cuac-data.js", import.meta.url), "utf8"),
    readFile(new URL("../../CUAC_FRONTEND_ROUTE_CONTRACT_CHECKLIST.md", import.meta.url), "utf8"),
    readFile(new URL("../public/auth.html", import.meta.url), "utf8"),
    readFile(new URL("../public/auth.js", import.meta.url), "utf8"),
    readFile(new URL("../public/auth.css", import.meta.url), "utf8"),
    readFile(new URL("../public/application.js", import.meta.url), "utf8"),
    readFile(new URL("../public/completion.js", import.meta.url), "utf8"),
    readFile(new URL("../public/shared-shell.js", import.meta.url), "utf8"),
    readFile(new URL("../public/shared-shell.css", import.meta.url), "utf8"),
    readFile(new URL("./qa-core-flows.cjs", import.meta.url), "utf8"),
    readFile(new URL("./qa-layout.cjs", import.meta.url), "utf8"),
  ]);

  assert.match(page, /export const metadata:\s*Metadata/);
  assert.match(page, /redirect\("\/home-v3\.html"\)/);
  assert.match(page, /CUAC \| China admissions for international students/);
  assert.match(layout, /CUAC \| China university application workspace/);
  assert.match(layout, /favicon\.svg/);
  assert.match(packageJson, /"vinext": "1\.0\.0-beta\.2"/);
  assert.match(home, /data-home-categories/);
  assert.match(home, /data-home-open-intakes/);
  assert.match(home, /data-home-schools/);
  assert.match(home, /data-create-list/);
  assert.match(homeJs, /getHomeDiscoverySummary/);
  assert.match(homeJs, /renderHomeSummary\(\)/);
  assert.match(homeJs, /window\.CUAC\?\.requireStudentSignedIn\?\.\("Create your student list"/);
  assert.match(homeJs, /selector: "\[data-create-list\]"/);
  assert.match(homeJs, /window\.location\.href = "onboarding\.html"/);
  assert.match(home, /Application-ready routes/);
  assert.doesNotMatch(home, /Official details/);
  assert.match(cuacData, /function getHomeDiscoverySummary\(\)/);
  assert.match(cuacData, /source: "CuacDataClient home discovery summary fixture"/);
  [programsJs, scholarshipsJs, sharedJs, favouritesJs, applicationJs, completionJs, cuacData].forEach((asset) => {
    assert.doesNotMatch(asset, /Official details|Confirm details|Needs check|Source pending|Needs recheck|source freshness|Verified source|Needs source check|Needs date check|Confirm notice|source-quality/);
    assert.doesNotMatch(asset, /Paid demo|Demo estimate|Demo compare|this demo could|Best demo|demo programs|CUAC demo keeps|Demo verified|Demo boundary|Demo ranking|Demo city fit/);
  });
  assert.doesNotMatch(programsJs, /Confirm language proof|Confirm HSK rule|Confirm CSCA|Confirm HSK/);
  assert.doesNotMatch(scholarshipsJs, /Confirm the official scholarship notice/);
  assert.match(programsJs, /Check language proof/);
  assert.match(programsJs, /Check HSK requirement/);
  assert.match(programsJs, /Check CSCA subjects/);
  assert.match(scholarshipsJs, /Review eligibility, deadline, and school fit/);
  assert.match(sharedJs, /Application ready/);
  assert.match(sharedJs, /Planning estimate/);
  assert.match(sharedJs, /Planning boundary/);
  assert.match(favouritesJs, /Review before applying/);
  assert.match(favouritesJs, /Compare supports up to 3 saved items/);
  assert.match(applicationJs, /Review before send/);
  assert.match(completionJs, /Application info/);
  assert.match(completionJs, /CUAC could not match the requested/);
  assert.match(cuacData, /"paid-demo": "Paid"/);
  assert.match(routeChecklist, /home categories, featured routes, intakes, cities, and schools read shared discovery summary data/);
  assert.match(routeChecklist, /Catalog list uses `CuacDataClient`, pagination, filters, compare state, and protected choice entry/);
  assert.match(routeChecklist, /student-readable field labels/);
  assert.match(routeChecklist, /Discovery scholarships use `CuacDataClient` with funding filters, student-readable actions, pagination, and matching-program exits/);
  assert.match(routeChecklist, /Guide search references use `CuacDataClient` with page-context Agent prompts and detail exits/);
  assert.match(routeChecklist, /Fee calculation, payment state, consent, selected choices, and school records use `CuacDataClient`\/local state/);
  assert.match(routeChecklist, /Billing snapshot uses `CuacDataClient` and reflects payment failure, preview, paid, or free-submitted state/);
  assert.match(routeChecklist, /Tenant records, analytics loading, owner workload, export confirmation, and student feedback loop use `CuacDataClient`\/local state/);
  assert.match(routeChecklist, /Prepare backend adapter seams/);
  assert.doesNotMatch(routeChecklist, /Started: discovery scholarships/);
  assert.doesNotMatch(routeChecklist, /Started: guide search/);
  assert.doesNotMatch(routeChecklist, /Started: fee and school records/);
  assert.doesNotMatch(routeChecklist, /Started: billing snapshot/);
  assert.doesNotMatch(routeChecklist, /Needs shared featured-route data/);
  assert.doesNotMatch(routeChecklist, /Continue moving discovery fixtures into `CuacDataClient`/);
  assert.match(packageJson, /"qa:flows": "node tests\/qa-core-flows\.cjs"/);
  assert.match(packageJson, /"qa:layout": "node tests\/qa-layout\.cjs"/);
  assert.match(qaCoreFlows, /guest save redirects to auth page and continues after sign-in/);
  assert.match(qaCoreFlows, /persisted auth-page sign-in after reload/);
  assert.match(qaCoreFlows, /signed-in Agent account memory after reload/);
  assert.match(qaCoreFlows, /program results pagination changes pages and filters reset to first page/);
  assert.match(qaCoreFlows, /Program pagination did not change visible results/);
  assert.match(qaCoreFlows, /guest protected student link redirects to auth page and continues navigation/);
  assert.match(qaCoreFlows, /guest home create-list redirects to auth page and continues onboarding/);
  assert.match(qaCoreFlows, /guest Agent protected action signs in and continues to add choice/);
  assert.match(qaCoreFlows, /guest Agent save checklist signs in and continues page action/);
  assert.match(qaCoreFlows, /guest Agent save cost estimate signs in and continues page action/);
  assert.match(qaCoreFlows, /school settings saves editable tenant template/);
  assert.match(qaCoreFlows, /added program choice keeps source fields through school portal handoff/);
  assert.match(qaCoreFlows, /Added choice did not persist CSCAlite-style source fields before school handoff/);
  assert.match(qaCoreFlows, /ops admin retry action writes audited local state/);
  assert.match(qaCoreFlows, /ops public scholarship create trusts button type over stale active tab/);
  assert.match(qaCoreFlows, /ops city publish version conflict/);
  assert.match(qaCoreFlows, /Ops CityGuide version conflict did not block stale publish/);
  assert.match(qaCoreFlows, /ops timeline save version conflict/);
  assert.match(qaCoreFlows, /ops timeline archive version conflict/);
  assert.match(qaCoreFlows, /high-risk Ops Agent action requires confirmation and writes audit state/);
  assert.match(qaCoreFlows, /high-risk school Agent export requires confirmation and persists tenant scope/);
  assert.match(qaCoreFlows, /High-risk tenant export persisted before confirmation/);
  assert.match(qaCoreFlows, /scope === 'tenant-only'/);
  assert.match(qaCoreFlows, /completion detail exposes loading empty and error states/);
  assert.match(qaCoreFlows, /completion detail resolves non-default catalog records/);
  assert.match(qaCoreFlows, /university-detail-hero/);
  assert.match(qaCoreFlows, /hub renders shared student summary and onboarding override/);
  assert.match(qaCoreFlows, /favourites renders shared saved-items summary/);
  assert.match(qaCoreFlows, /notifications render shared notification summary and dynamic events/);
  assert.match(qaCoreFlows, /preferences render shared preference summary defaults/);
  assert.match(qaCoreFlows, /notification preferences persist into notifications center/);
  assert.match(qaCoreFlows, /Agent memory clear requires confirmation and persists cleared state/);
  assert.match(qaCoreFlows, /Agent memory cleared before confirmation/);
  assert.match(qaCoreFlows, /notification read and dismiss states persist after reload/);
  assert.match(qaCoreFlows, /role-aware auth routes school staff and ops accounts/);
  assert.match(qaCoreFlows, /auth recovery and verification states stay in-page/);
  assert.match(qaCoreFlows, /add choice hash opens school-facing selector with student-friendly receipt copy/);
  assert.match(qaCoreFlows, /payment issue persists to billing and notifications without school send/);
  assert.match(qaCoreFlows, /application consent blocks school send with inline feedback/);
  assert.match(qaCoreFlows, /Application consent failure still sent or persisted school records/);
  assert.match(qaCoreFlows, /high-risk student Agent submit requires confirmation before payment modal/);
  assert.match(qaCoreFlows, /application send writes school-scoped record visible in school portal/);
  assert.match(qaCoreFlows, /school mark contacted updates status and student-loop storage/);
  assert.match(qaCoreFlows, /high-risk school Agent action requires confirmation before applying/);
  assert.match(qaLayout, /async function setStudentAuthPreview\(cdp\)/);
  assert.match(qaLayout, /source: 'layout-qa'/);
  assert.match(qaLayout, /application add-choice modal layout stays usable/);
  assert.match(qaLayout, /auth continuation page layout stays usable/);
  assert.match(qaLayout, /auth recovery page layout stays usable/);
  assert.match(qaLayout, /catalog card entry points stay usable/);
  assert.match(qaLayout, /#programList \[data-program-card\]/);
  assert.match(qaLayout, /#programList \.program-card-open/);
  assert.match(qaLayout, /#programList \.program-action-secondary/);
  assert.match(qaLayout, /#scholarshipGrid \[data-scholarship-card\]/);
  assert.match(qaLayout, /completion state pages stay usable/);
  assert.match(qaLayout, /catalog-backed detail pages stay usable/);
  assert.match(qaLayout, /city-detail\.html\?city=hangzhou&motion=off/);
  assert.match(qaLayout, /Dynamic city quick facts/);
  assert.match(qaLayout, /favourites shared saved-items layout stays usable/);
  assert.match(qaLayout, /notifications shared summary layout stays usable/);
  assert.match(qaLayout, /preferences shared summary layout stays usable/);
  assert.match(qaLayout, /school portal dashboard layout stays usable/);
  assert.match(qaLayout, /school settings layout stays usable/);
  assert.match(qaLayout, /ops admin layout stays usable/);
  assert.match(qaLayout, /agent panel layout keeps composer usable/);
  assert.match(qaLayout, /function assertNoHorizontalOverflow/);
  assert.match(qaLayout, /function assertClickableCenter/);

  assert.match(home, /data-active="home"/);
  assert.match(programs, /data-active="programs"/);
  assert.match(programs, /<nav class="pagination" id="pagination" aria-label="Program results pages"><\/nav>/);
  assert.match(programsJs, /pageSize: 8/);
  assert.match(programsJs, /const scholarshipParam = String\(routeParams\.get\("scholarship"\) \|\| ""\)\.trim\(\)\.toLowerCase\(\)/);
  assert.match(programsJs, /truthyParam\(routeParams\.get\("hasScholarship"\)\) \|\| \(scholarshipParam && !\["false", "0", "no"\]\.includes\(scholarshipParam\)\)/);
  assert.match(programsJs, /function normalizeCityParam\(value\)/);
  assert.match(programsJs, /function normalizeDegreeParam\(value\)/);
  assert.match(programsJs, /function normalizeLanguageParam\(value\)/);
  assert.match(programsJs, /nondegree: "non-degree"/);
  assert.match(programsJs, /upcomingDeadline: false/);
  assert.match(programsJs, /function normalizeSearchText\(value\)/);
  assert.match(programsJs, /english\[\\s-\]\*taught/);
  assert.match(programsJs, /function queryMatchesProgram\(query, program\)/);
  assert.match(programsJs, /tokens\.every\(\(token\) => haystack\.includes\(token\)\)/);
  assert.match(programsJs, /queryMatchesProgram\(f\.q, program\)/);
  assert.match(programsJs, /\(!f\.upcomingDeadline \|\| Boolean\(programDeadline\(program\)\)/);
  assert.match(programsJs, /state\.filters\.q = "English-taught computer science Hangzhou"/);
  assert.match(programsJs, /const focusedUniversity = routeParams\.get\("university"\)/);
  assert.match(programsJs, /const scholarshipRoute = routeParams\.get\("route"\) \|\| routeParams\.get\("type"\) \|\| ""/);
  assert.match(programsJs, /const scholarshipFunding = routeParams\.get\("funding"\) \|\| ""/);
  assert.match(programsJs, /function scholarshipRouteQuery\(route, funding\)/);
  assert.match(programsJs, /function scholarshipParamQuery\(value\)/);
  assert.match(programsJs, /csc: "CSC scholarship"/);
  assert.match(programsJs, /government: "CSC scholarship"/);
  assert.match(programsJs, /const initialQuery = routeParams\.get\("keyword"\) \|\| routeParams\.get\("q"\) \|\| focusedUniversity \|\| \(initialProgram \? programName\(initialProgram\) : ""\) \|\| scholarshipRouteQuery\(scholarshipRoute, scholarshipFunding\) \|\| scholarshipParamQuery\(scholarshipParam\)/);
  assert.match(programsJs, /key === "degree" \? normalizeDegreeParam\(value\) : key === "language" \? normalizeLanguageParam\(value\) : value/);
  assert.match(programsJs, /function renderPagination\(total\)/);
  assert.match(programsJs, /Showing \$\{start\}-\$\{end\} of \$\{total\}/);
  assert.match(programsJs, /aria-label="Previous page"/);
  assert.match(programsJs, /aria-label="Next page"/);
  assert.match(programsJs, /renderPagination\(results\.length\)/);
  assert.match(programsJs, /if \(page\.disabled\) return/);
  assert.match(programsCss, /\.pagination-summary/);
  assert.match(programsCss, /\.pagination button:disabled/);
  assert.match(programsJs, /Saved \$\{program \? programName\(program\) : "program"\} to Favourites/);
  assert.match(programsJs, /<a href="favourites\.html">Review saved items<\/a>/);
  assert.match(programsCss, /\.program-agent-notice a/);
  assert.match(programs, /Application readiness/);
  assert.match(programs, /deadline, cost, language, and document effort visible/);
  assert.doesNotMatch(programs, /Clear application info first|Official details first|deadline, source, and document signals/);
  assert.match(programsJs, /Ready to compare/);
  assert.match(programsJs, /Review before applying/);
  assert.match(programsJs, /function programApplicationReadinessScore\(program = \{\}\)/);
  assert.match(programsJs, /function programDecisionNote\(program\)/);
  assert.match(programsJs, /Ready to compare with saved choices/);
  assert.match(programsJs, /Review deadline and requirements before adding/);
  assert.match(programsJs, /Check program fit before adding/);
  assert.match(programsJs, /Save programs first, then compare deadline, tuition, documents, and application readiness/);
  assert.doesNotMatch(programsJs, /data-filter-key="source"|sourceText|Application info checked|Check school page|Recheck school page|School page check needed|School application page: ready to review|School application page: recheck before sending|School application page: confirm before sending|Official details|Confirm details|Source pending|Needs recheck|source freshness|source needs confirmation|source needs|school-page confidence/);
  assert.doesNotMatch(programsJs, /demo routes/);
  assert.match(programs, /programs\.css\?v=20260825-card-actions-a11y/);
  assert.match(programs, /programs\.js\?v=20260825-card-actions-a11y/);
  assert.match(programsJs, /const iconCompare = '<svg/);
  assert.match(programsJs, /const iconArrowRight = '<svg/);
  assert.match(programsJs, /role="link" tabindex="0" data-program-id="\$\{id\}" data-program-card data-detail-href="\$\{programHref\}"/);
  assert.match(programsJs, /if \(programCard && !event\.target\.closest\("a, button, input, select, textarea"\) && \["Enter", " "\]\.includes\(event\.key\)\)/);
  assert.match(programsJs, /programCard\.dataset\.detailHref/);
  assert.match(programsJs, /class="program-card-open" aria-hidden="true">\$\{iconArrowRight\}<\/span>/);
  assert.match(programsJs, /class="program-card-action program-action-secondary compare-action[\s\S]*aria-label="\$\{isCompared \? "Remove from compare" : "Add to compare"\}: \$\{name\}"[\s\S]*>\$\{iconCompare\}<\/button>/);
  assert.doesNotMatch(programsJs, />\$\{isCompared \? "Compared" : "Compare"\}<\/button>/);
  assert.doesNotMatch(programsJs, /class="program-card-action program-action-main details-link"[\s\S]*>View program<\/a>/);
  assert.doesNotMatch(programsJs, /program-action-main/);
  assert.match(programsCss, /\.program-card-open\s*\{/);
  assert.match(programsCss, /\.program-row:hover \.program-card-open,\s*\n\s*\.program-row:focus-visible \.program-card-open/);
  assert.match(programsCss, /\.program-row:focus-visible\s*\{[\s\S]*outline: 3px solid rgb\(var\(--accent-rgb\) \/ 0\.18\)/);
  assert.match(programsCss, /\.program-row h2\s*\{[\s\S]*-webkit-line-clamp: 2;/);
  assert.match(programsCss, /\.row-actions\s*\{[\s\S]*display: flex;[\s\S]*justify-content: flex-end;/);
  assert.match(programsCss, /\.program-card-action\s*\{[\s\S]*min-height: 38px;[\s\S]*white-space: nowrap;[\s\S]*text-overflow: ellipsis;/);
  assert.match(programsCss, /\.program-action-secondary\s*\{[\s\S]*width: 38px;[\s\S]*border-radius: var\(--radius-pill\);[\s\S]*background: #ffffff;/);
  assert.match(programsCss, /\.program-action-secondary svg\s*\{[\s\S]*stroke: currentColor;/);
  assert.doesNotMatch(programsCss, /\.program-action-main/);
  assert.match(universities, /data-active="universities"/);
  assert.match(universities, /Program fit filters/);
  assert.match(universities, /data-criteria-field="degreeLevel"/);
  assert.match(universities, /data-criteria-field="teachingLanguage"/);
  assert.match(universities, /data-criteria-field="programSubject"/);
  assert.match(universities, /data-criteria-field="hasUpcomingDeadline"/);
  assert.match(universities, /data-criteria-field="scholarshipRoute"/);
  assert.match(universitiesJs, /if \(field\.dataset\.criteriaField === "scholarshipRoute"\)/);
  assert.match(universitiesJs, /state\.criteria\.hasCsc = "true"/);
  assert.match(universitiesJs, /state\.criteria\.hasDetailedScholarship = "true"/);
  assert.match(universities, /<option value="rank">Rank cue<\/option>/);
  assert.match(universities, /<option value="csca">CSCA first<\/option>/);
  assert.match(universities, /<option value="name">Name A-Z<\/option>/);
  assert.match(universitiesJs, /const cscaliteSchoolCriteriaKeys = \[/);
  assert.match(universitiesJs, /"degreeLevel"[\s\S]*"teachingLanguage"[\s\S]*"programSubject"[\s\S]*"fieldCategory"[\s\S]*"hasUpcomingDeadline"[\s\S]*"hasCsc"[\s\S]*"hasCscaRules"[\s\S]*"hasDetailedScholarship"/);
  assert.match(universitiesJs, /function schoolRankValue/);
  assert.match(universitiesJs, /function compareSchoolName/);
  assert.match(universitiesJs, /state\.sort === "rank"[\s\S]*schoolRankValue/);
  assert.match(universitiesJs, /state\.sort === "csca"[\s\S]*schoolHasCscaRules/);
  assert.match(universitiesJs, /state\.sort === "name"[\s\S]*compareSchoolName/);
  assert.match(universitiesJs, /state\.query = routeParams\.get\("keyword"\) \|\| routeParams\.get\("q"\) \|\| normalizeCityParam\(routeParams\.get\("city"\)\) \|\| ""/);
  assert.match(universitiesJs, /const criteriaFields = \[\.\.\.document\.querySelectorAll\("\[data-criteria-field\]"\)\]/);
  assert.match(universitiesJs, /field\.value = state\.criteria\?\.\[field\.dataset\.criteriaField\] \|\| ""/);
  assert.match(universitiesJs, /field\.addEventListener\("change"/);
  assert.match(universitiesJs, /function schoolPrograms\(item = \{\}\)/);
  assert.match(universitiesJs, /function schoolHasCscaRules\(item = \{\}\)/);
  assert.match(universitiesJs, /truthyParam\(item\.cscaRequired\)/);
  assert.match(universitiesJs, /confirm by\|check\|pending\|待确认\|待复核\|按项目确认/);
  assert.match(universitiesJs, /csca\|考试\|科目\|subject\|math\|physics\|chemistry\|biology\|数学\|物理\|化学\|生物/);
  assert.doesNotMatch(universitiesJs, /Boolean\(item\.cscaRequired \|\| schoolHasCscaRules\(item\)\)/);
  assert.match(universitiesJs, /function schoolHasDetailedScholarship\(item = \{\}\)/);
  assert.match(universitiesJs, /function schoolHasCsc\(item = \{\}\)/);
  assert.match(universitiesJs, /function matchesCriteria\(item = \{\}\)/);
  assert.match(universitiesJs, /matchesQuery\(item\) && matchesFilters\(item\) && matchesCriteria\(item\)/);
  assert.match(universitiesJs, /data-remove-type="\$\{filter\.type\}"/);
  assert.match(universities, /data-filter="CSCA rules"/);
  assert.match(universities, /data-filter="Detailed scholarships"/);
  assert.match(universities, /data-filter="CSC scholarship"/);
  assert.match(universitiesJs, /function normalizeSearchText\(value\)/);
  assert.match(universitiesJs, /english routes\?/);
  assert.match(universitiesJs, /tokens\.every\(\(token\) => haystack\.includes\(token\)\)/);
  assert.match(universitiesJs, /const universityArrowRight = '<svg/);
  assert.match(universitiesJs, /data-university-card data-detail-href="\$\{detailHref\}"/);
  assert.match(universitiesJs, /role="link" tabindex="0"/);
  assert.match(universitiesJs, /universityCard\.dataset\.detailHref/);
  assert.match(universitiesJs, /class="university-card-open" aria-hidden="true">\$\{universityArrowRight\}<\/span>/);
  assert.doesNotMatch(universitiesJs, /class="university-action-main"[\s\S]*>View university<\/a>/);
  assert.doesNotMatch(universitiesJs, /class="university-action-secondary"[\s\S]*>Programs<\/a>/);
  assert.doesNotMatch(universitiesJs, />Detail<\/a>|>Preview<\/button>/);
  assert.doesNotMatch(universitiesJs, />View profile<\/a>|>View programs<\/a>|>Compare<\/button>/);
  assert.match(universitiesJs, /Saved \$\{name\} to Favourites/);
  assert.match(universitiesJs, /<a href="favourites\.html">Find matching programs<\/a>/);
  assert.match(universitiesCss, /\.university-agent-notice a/);
  assert.match(universitiesCss, /\.university-card-open\s*\{/);
  assert.match(universitiesCss, /\.university-card:hover \.university-card-open/);
  assert.doesNotMatch(universitiesCss, /\.university-action-main/);
  assert.doesNotMatch(universitiesCss, /\.university-action-secondary/);
  assert.match(universitiesCss, /text-overflow: ellipsis/);
  assert.match(universities, /Application ready/);
  assert.match(universities, /Application readiness/);
  assert.doesNotMatch(universities, />Verified</);
  assert.match(universitiesJs, /function schoolApplicationReadiness\(item = \{\}\)/);
  assert.match(universitiesJs, /Application ready/);
  assert.match(universitiesJs, /Admissions page review/);
  assert.match(universitiesJs, /application-ready, English-route, lower-cost universities/);
  assert.match(universitiesJs, /function schoolApplicationReady\(item = \{\}\)/);
  assert.match(universitiesJs, /const hasApplicationEntry = Boolean\(item\.applicationSystemUrl \|\| item\.admissionsWebsiteUrl \|\| item\.officialWebsite\)/);
  assert.match(universitiesJs, /const hasProgramRoutes = schoolProgramCount\(item\) > 0 \|\| schoolEnglishRouteCount\(item\) > 0/);
  assert.match(universitiesJs, /const hasTiming = Boolean\(item\.deadlineSummary \|\| item\.round1Deadline \|\| item\.round2Deadline \|\| item\.round1CloseDate \|\| item\.round2CloseDate\)/);
  assert.doesNotMatch(universitiesJs, /schoolVerified/);
  assert.doesNotMatch(universitiesJs, /dataQualityScore/);
  assert.doesNotMatch(universitiesJs, /String\(item\.dataQualityScore \|\| ""\)/);
  assert.doesNotMatch(universitiesJs, /filter === "Application ready" \|\| filter === "Verified"/);
  assert.doesNotMatch(universitiesJs, /Clear application info|Check admissions page|Needs check|source-quality signals|official details|confirm details/);
  assert.match(citiesJs, /arrowRight:/);
  assert.match(citiesJs, /data-city-card data-detail-href="\$\{detailHref\}"/);
  assert.match(citiesJs, /role="link" tabindex="0"/);
  assert.match(citiesJs, /cityCard\.dataset\.detailHref/);
  assert.match(citiesJs, /document\.addEventListener\("keydown"/);
  assert.doesNotMatch(citiesJs, /class="city-card-action city-action-(main|secondary)"/);
  assert.doesNotMatch(citiesJs, />City detail<\/a>|>Preview<\/button>/);
  assert.doesNotMatch(citiesJs, /demo backup route/);
  assert.match(cities, /cities\.css\?v=20260825-card-action-polish/);
  assert.match(cities, /cities\.js\?v=20260825-card-action-polish/);
  assert.match(citiesJs, /let routeQuery = ""/);
  assert.match(citiesJs, /let routeRegion = ""/);
  assert.match(citiesJs, /let routeCostLevel = ""/);
  assert.match(citiesJs, /let routeDensity = ""/);
  assert.match(citiesJs, /function applyRouteCityParams\(params = routeParams\)/);
  assert.match(citiesJs, /routeQuery = params\.get\("keyword"\) \|\| params\.get\("q"\) \|\| ""/);
  assert.match(citiesJs, /routeRegion = params\.get\("region"\) \|\| params\.get\("province"\) \|\| ""/);
  assert.match(citiesJs, /routeCostLevel = normalizeLevel\(params\.get\("costLevel"\) \|\| params\.get\("cost"\) \|\| ""\)/);
  assert.match(citiesJs, /routeDensity = normalizeLevel\(params\.get\("density"\) \|\| params\.get\("universityDensity"\) \|\| ""\)/);
  assert.match(citiesJs, /const cityParam = params\.get\("city"\) \|\| params\.get\("slug"\) \|\| ""/);
  assert.match(citiesJs, /data-clear-city-filter="\$\{key\}"/);
  assert.match(citiesJs, /function syncCityControls\(\)/);
  assert.match(citiesJs, /sortSelect\.value = sortMode/);
  assert.match(citiesJs, /syncCityControls\(\);[\s\S]*renderActiveChips\(\);/);
  assert.match(citiesCss, /\.city-card-open\s*\{/);
  assert.match(citiesCss, /\.city-card:hover,\s*\n\.city-card:focus-visible/);
  assert.match(citiesCss, /\.city-card-open svg\s*\{/);
  assert.match(citiesCss, /\.city-card h3\s*\{[\s\S]*-webkit-line-clamp: 2;/);
  assert.match(citiesCss, /\.city-stats b\s*\{[\s\S]*overflow-wrap: anywhere;/);
  assert.doesNotMatch(citiesCss, /\.city-card \.card-actions/);
  assert.doesNotMatch(citiesCss, /\.city-card-action/);
  assert.doesNotMatch(citiesCss, /\.city-card \.card-actions[\s\S]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/);
  assert.match(scholarshipsJs, /let routeCityFocus = ""/);
  assert.match(scholarshipsJs, /function scholarshipKey\(item = \{\}\)/);
  assert.match(scholarshipsJs, /function scholarshipTitle\(item = \{\}\)/);
  assert.match(scholarshipsJs, /function scholarshipFundingLevel\(item = \{\}\)/);
  assert.match(scholarshipsJs, /item\.fundingLevel \|\| item\.funding/);
  assert.match(scholarshipsJs, /function scholarshipFundingLabel\(item = \{\}\)/);
  assert.match(scholarshipsJs, /if \(level === "full"\) return "Full"/);
  assert.match(scholarshipsJs, /if \(level === "partial"\) return "Partial"/);
  assert.match(scholarshipsJs, /return "Check"/);
  assert.match(scholarshipsJs, /function scholarshipProvider\(item = \{\}\)/);
  assert.match(scholarshipsJs, /providerNameEn \|\| item\.providerName/);
  assert.match(scholarshipsJs, /function scholarshipDegree\(item = \{\}\)/);
  assert.match(scholarshipsJs, /item\.applicableDegree \|\| item\.degree/);
  assert.match(scholarshipsJs, /function scholarshipDeadlineLabel\(item = \{\}\)/);
  assert.match(scholarshipsJs, /item\.deadlineLabel \|\| item\.deadline \|\| item\.applicationRound/);
  assert.match(scholarshipsJs, /function matchingProgramsHref\(item = \{\}\)/);
  assert.match(scholarshipsJs, /params\.set\("route", type\)/);
  assert.match(scholarshipsJs, /params\.set\("funding", funding\)/);
  assert.doesNotMatch(scholarshipsJs, /href="\$\{matchingProgramsHref\(item\)\}"[\s\S]*>Programs<\/a>/);
  assert.doesNotMatch(scholarshipsJs, /class="ghost scholarship-action-secondary"[\s\S]*>Programs<\/a>/);
  assert.match(scholarshipsJs, /data-scholarship-card data-detail-href="\$\{detailHref\}"/);
  assert.match(scholarshipsJs, /role="link" tabindex="0"/);
  assert.match(scholarshipsJs, /scholarshipIcons\.arrowRight/);
  assert.match(scholarshipsJs, /window\.location\.href = scholarshipCard\.dataset\.detailHref/);
  assert.match(scholarshipsJs, /event\.key !== "Enter" && event\.key !== " "/);
  assert.doesNotMatch(scholarshipsJs, /class="primary scholarship-action-main"[\s\S]*>View funding<\/a>/);
  assert.doesNotMatch(scholarshipsJs, /Matching programs|>Preview<\/button>/);
  assert.match(scholarships, /scholarships\.css\?v=20260825-card-action-polish/);
  assert.match(scholarships, /scholarships\.js\?v=20260825-card-action-polish/);
  assert.match(scholarships, />Find programs<\/a>/);
  assert.match(scholarships, />View funding<\/a>/);
  assert.doesNotMatch(scholarships, /See matching programs|Full detail/);
  assert.doesNotMatch(scholarshipsJs, /Verified source|Needs date check|Needs source check|Confirm notice/);
  assert.match(scholarshipsCss, /\.scholarship-readiness/);
  assert.match(scholarshipsCss, /\.scope-row/);
  assert.match(scholarshipsCss, /\.scholarship-card-open/);
  assert.match(scholarshipsCss, /\.scholarship-card:focus-visible/);
  assert.match(scholarshipsCss, /\.scholarship-card h3\s*\{[\s\S]*-webkit-line-clamp: 2;/);
  assert.match(scholarshipsCss, /\.facts b\s*\{[\s\S]*overflow-wrap: anywhere;/);
  assert.doesNotMatch(scholarshipsCss, /\.card-actions \.scholarship-action-main/);
  assert.doesNotMatch(scholarshipsCss, /\.status\.verified|\.status\.pending|\.status\.check/);
  assert.doesNotMatch(scholarshipsJs, /demo path/);
  assert.match(scholarshipsJs, /function findScholarshipFromHash\(value = window\.location\.hash\)/);
  assert.match(scholarshipsJs, /zju: \["zju", "zhejiang"\]/);
  assert.match(scholarshipsJs, /function applyHashFocus\(\)/);
  assert.match(scholarshipsJs, /window\.addEventListener\("hashchange"/);
  assert.match(scholarshipsJs, /function cityScholarshipAliases\(value\)/);
  assert.match(scholarshipsJs, /routeCityFocus = normalizeCityParam\(routeParams\.get\("city"\)\)/);
  assert.match(scholarshipsJs, /if \(key === "city"\) routeCityFocus = ""/);
  assert.match(scholarshipsJs, /Saved \$\{item \? scholarshipTitle\(item\) : "scholarship"\} to Favourites/);
  assert.match(scholarshipsJs, /<a href="favourites\.html">Review funding context<\/a>/);
  assert.match(scholarshipsCss, /\.scholarship-agent-notice a/);
  assert.match(notifications, /data-agent-mode="notifications"/);
  assert.match(notifications, /data-active="notifications"/);
  assert.match(notifications, /Grouped by decision impact/);
  assert.match(notifications, /Review action items/);
  assert.match(notifications, /id="notification-list"/);
  assert.match(notifications, /data-priority-card/);
  assert.match(notifications, /data-quiet-pref="agent"/);
  assert.match(notifications, /preferences\.html#notifications/);
  assert.doesNotMatch(notifications, /data-agent-prompt|Ask Agent/);
  assert.match(notificationsJs, /const notificationSummary = dataClient\?\.getNotificationCenterSummary\?\.?\(\) \|\| \{\}/);
  assert.match(notificationsJs, /const baseNotificationItems = \(notificationSummary\.baseItems \|\| \[\]\)\.map/);
  assert.match(notificationsJs, /const notificationGroups = notificationSummary\.groups \|\| \["Today", "This week", "Earlier"\]/);
  assert.match(cuacData, /source: "CuacDataClient notification center summary fixture"/);
  assert.match(cuacData, /Transcript translation still needs review/);
  assert.match(cuacData, /defaultNotificationPreferences/);
  assert.match(notificationsJs, /cuacNotificationEventsDemoState/);
  assert.match(notificationsJs, /cuacNotificationCenterDemoState/);
  assert.match(notificationsJs, /function readNotificationEvents/);
  assert.match(notificationsJs, /\.\.\.event/);
  assert.match(notificationsJs, /function preferredInterfaceLanguage/);
  assert.match(notificationsJs, /workspace\?\.language\?\.interfaceLanguage/);
  assert.match(notificationsJs, /function localizedNotificationFields/);
  assert.match(notificationsJs, /event\.localized\?\.zh/);
  assert.match(notificationsJs, /data-entity-type="\$\{escapeHtml\(item\.entityType \|\| item\.type\)\}"/);
  assert.match(notificationsJs, /data-source-model="\$\{escapeHtml\(item\.sourceFieldLineage\?\.sourceModel/);
  assert.match(notificationsJs, /function hydrateNotificationItems/);
  assert.match(notificationsJs, /function readNotificationCenterState/);
  assert.match(notificationsJs, /function persistNotificationCenterState/);
  assert.match(notificationsJs, /function renderNotifications/);
  assert.doesNotMatch(notificationsJs, /data-agent-prompt|Ask Agent/);
  assert.match(notificationsJs, /data-mark-all-read/);
  assert.match(notificationsJs, /cuacPreferencesDemoState/);
  assert.match(notificationsJs, /function readNotificationPreferences/);
  assert.match(notificationsJs, /function isEnabledByPreferences/);
  assert.match(notificationsJs, /data-quiet-pref/);
  assert.match(notificationsJs, /Preferences are synced with your account settings/);
  assert.doesNotMatch(notificationsJs, /Preferences sync in this demo/);
  assert.match(notificationsCss, /\.notice-tabs button\.active/);
  assert.match(notificationsCss, /\.priority-card/);
  assert.match(preferences, /data-agent-mode="preferences"/);
  assert.match(preferences, /data-active="preferences"/);
  assert.match(preferences, /Make CUAC work your way/);
  assert.match(preferences, /data-section="agent"/);
  assert.match(preferences, /data-preferences-savebar/);
  assert.match(preferences, /data-profile-chips/);
  assert.match(preferences, /data-workspace-health/);
  assert.match(preferencesJs, /const preferenceSummary = dataClient\?\.getPreferenceCenterSummary\?\.?\(\) \|\| \{\}/);
  assert.match(preferencesJs, /function setActiveSection/);
  assert.match(preferencesJs, /function setDirty/);
  assert.match(preferencesCss, /\.preference-shell/);
  assert.match(preferencesCss, /\.save-bar/);
  assert.match(favourites, /data-active="favourites"/);
  assert.match(favourites, /data-agent-mode="favourites"/);
  assert.match(favourites, /Application shortlist/);
  assert.match(favourites, /5 active routes/);
  assert.match(favourites, /Start from a saved program, then open Application/);
  assert.match(favourites, /Choice rules/);
  assert.match(favourites, /Only their own chosen program record after payment or free send/);
  assert.doesNotMatch(favourites, /5 max in demo|in this demo|Real submission and persistence/);
  assert.doesNotMatch(favourites, /data-agent-prompt|Ask Agent to review|Ask Agent to compare|Organize with Agent/);
  assert.match(favourites, /data-compare-tray/);
  assert.match(favourites, /Only a concrete program route can become an application choice|Concrete routes first/);
  assert.match(favouritesJs, /function renderCompareTray/);
  assert.match(favouritesJs, /All selected items look low-risk for the current shortlist/);
  assert.match(favouritesJs, /Agent turned saved guides and blockers into a checklist\./);
  assert.doesNotMatch(favouritesJs, /low-risk context in this demo|checklist preview/);
  assert.doesNotMatch(favouritesJs, /data-agent-prompt|Ask Agent to compare|Explain whether|Organize with Agent|function openAgentPrompt/);
  assert.match(favouritesJs, /<a href="application\.html">Open application<\/a>/);
  assert.match(favouritesJs, /Find concrete programs/);
  assert.match(favouritesJs, /data-clear-compare/);
  assert.match(favouritesJs, /const savedSummary = dataClient\?\.getSavedItemsSummary\?\.?\(\) \|\| \{\}/);
  assert.match(favouritesJs, /function savedItemDataAttributes\(item\)/);
  assert.match(favouritesJs, /data-entity-type="\$\{escapeHtml\(entityType\)\}"/);
  assert.match(favouritesJs, /data-source-model="\$\{escapeHtml\(sourceModel\)\}"/);
  assert.match(favouritesJs, /function persistApplicationChoice\(item\)/);
  assert.match(favouritesJs, /dataClient\?\.readApplicationDemoState/);
  assert.match(favouritesJs, /dataClient\?\.writeApplicationDemoState/);
  assert.match(favouritesJs, /routes: exists \? routes : \[\.\.\.routes, route\]/);
  assert.match(cuacData, /function getSavedItemsSummary\(\)/);
  assert.match(cuacData, /source: "CuacDataClient saved items summary fixture"/);
  assert.match(cuacData, /programs\.html\?university=Zhejiang%20University/);
  assert.match(cuacData, /scholarships\.html#zju/);
  assert.match(cuacData, /cities\.html#hangzhou/);
  assert.match(cuacData, /cities\.html#shanghai/);
  assert.match(cuacData, /Choose a program first/);
  assert.match(cuacData, /programs\.html\?scholarship=CSC/);
  assert.match(cuacData, /Find programs for this scholarship/);
  assert.match(cuacData, /Review funding routes/);
  assert.match(cuacData, /Compare cities/);
  assert.match(favouritesJs, /Open application/);
  assert.match(cuacData, /Review related program/);
  assert.match(cuacData, /Review backup route/);
  assert.match(cuacData, /Review funding context/);
  assert.match(hub, /href="favourites\.html">Manage favourites/);
  assert.match(hub, /Application center/);
  assert.match(hub, /First school included/);
  assert.match(hub, /application-flow/);
  assert.match(hub, /href="application\.html"/);
  assert.match(hub, /data-application-next/);
  assert.match(hubJs, /received this application record/);
  assert.match(hubJs, /school workspace/);
  assert.match(hubJs, /current CUAC data/);
  assert.doesNotMatch(hubJs, /school portal demo|demo record|demo data/);
  assert.match(hub, /data-profile-summary/);
  assert.match(hub, /data-route-title/);
  assert.match(hub, /data-route-copy/);
  assert.match(onboardingJs, /cuacOnboardingPreview/);
  assert.match(onboardingJs, /state\.nationality = fieldValue\("nationality"\)/);
  assert.match(onboardingJs, /state\.currentCountry = fieldValue\("currentCountry"\)/);
  assert.match(onboardingJs, /state\.stage = fieldValue\("stage"\)/);
  assert.match(onboardingJs, /state\.intake = fieldValue\("intake"\)/);
  assert.match(onboardingJs, /state\.language = fieldValue\("language"\)/);
  assert.match(onboardingJs, /state\.readiness = readinessState\(\)/);
  assert.match(onboardingJs, /readinessReadyCount: readinessCount\(\)/);
  assert.match(cuacData, /function getStudentHubSummary\(\)/);
  assert.match(cuacData, /source: "CuacDataClient student hub summary fixture"/);
  assert.match(hubJs, /const ONBOARDING_PREVIEW_KEY = "cuacOnboardingPreview"/);
  assert.match(hubJs, /const hubSummary = dataClient\?\.getStudentHubSummary\?\.\(\) \|\| \{\}/);
  assert.match(hubJs, /function applyHubSummary\(\)/);
  assert.match(hubJs, /function applyOnboardingPreview/);
  assert.match(hubJs, /function applyOnboardingReadiness\(readiness = \{\}\)/);
  assert.match(hubJs, /doc\.status = doc\.checked \? match\.ready : match\.missing/);
  assert.match(hubJs, /function routeFromOnboarding/);
  assert.match(hubJs, /applyHubSummary\(\);\s*applyOnboardingPreview\(\);/);
  assert.match(cuacData, /programs\.html\?program=zju-cs-msc/);
  assert.match(cuacData, /programs\.html\?program=uibe-trade-msc/);
  assert.match(cuacData, /programs\.html\?program=nju-data-msc/);
  assert.match(auth, /data-auth-state="signed-out"/);
  assert.match(auth, /data-auth-role="student"/);
  assert.match(auth, /data-auth-role="school"/);
  assert.match(auth, /data-auth-role="ops"/);
  assert.match(auth, /Choose workspace access/);
  assert.match(auth, /One CUAC account\. Choose the workspace access you need/);
  assert.match(auth, />Open Hub<\/a>/);
  assert.match(auth, /Your account keeps saved choices, application actions, and Agent context together/);
  assert.match(auth, /Send a secure reset link/);
  assert.doesNotMatch(auth, /previewpass|newpreviewpass|maya\.student@example\.com|zju\.admissions@example\.edu|staff@cuac\.example|ZJU-INVITE-2026|CUAC-OPS-INVITE/);
  assert.doesNotMatch(auth, /Preview Hub/);
  assert.doesNotMatch(auth, /Secure demo mode|demo reset|without a backend|ZJU-DEMO|CUAC-OPS-DEMO|would happen/);
  assert.match(auth, /data-auth-panel="reset"/);
  assert.match(auth, /data-register-role-panel="student"/);
  assert.doesNotMatch(auth, /data-register-role-panel="school"|data-register-role-panel="ops"|Invitation code/);
  assert.match(auth, /data-auth-school-id/);
  assert.match(auth, /data-register-password minlength="15"/);
  assert.match(auth, /data-auth-reset-trigger/);
  assert.match(auth, /data-verification-note/);
  assert.match(authJs, /const roleProfiles = \{/);
  assert.match(authJs, /function normalizeAuthRole\(role\)/);
  assert.match(authJs, /\["school", "school_staff", "school-staff", "staff"\]\.includes\(value\)/);
  assert.match(authJs, /\["ops", "cuac_ops", "cuac-internal", "cuac_internal", "internal"\]\.includes\(value\)/);
  assert.match(authJs, /requestSurface:\s*"student"/);
  assert.match(authJs, /requestSurface:\s*"school_staff"/);
  assert.match(authJs, /requestSurface:\s*"cuac_internal"/);
  assert.match(authJs, /School access is checked against an active staff membership/);
  assert.match(authJs, /Internal roles are assigned by CUAC administrators/);
  assert.match(authJs, /School access boundary/);
  assert.match(authJs, /Internal access boundary/);
  assert.match(authJs, /function continuationMatchesRole\(continuation, role\)/);
  assert.match(authJs, /nextLabel:\s*"Open Hub"/);
  assert.match(authJs, /nextLabel:\s*"Open school portal"/);
  assert.match(authJs, /nextLabel:\s*"Open Ops"/);
  assert.match(authJs, /If an eligible account exists, a password reset link has been queued/);
  assert.match(authJs, /Signed in\. Opening the authorized workspace/);
  assert.match(authJs, /Check your email for the verification link/);
  assert.doesNotMatch(authJs, /Preview interaction only|Preview reset link sent|Preview school portal|Preview Ops|Demo access is local|In production|sent in preview|would happen/);
  assert.doesNotMatch(authJs, /School account boundary|Internal account boundary/);
  assert.match(authJs, /requestJson\("\/api\/v1\/auth\/sessions"/);
  assert.match(authJs, /requestJson\("\/api\/v1\/auth\/register"/);
  assert.match(authJs, /requestJson\("\/api\/v1\/auth\/password-reset"/);
  assert.match(authJs, /requestJson\("\/api\/v1\/auth\/email-verification"/);
  assert.match(authJs, /requestJson\("\/api\/v1\/me"/);
  assert.doesNotMatch(authJs, /cuacAuthDemoState|cuacAuthRecoveryDemoState|accessGrantStatus|localStorage\.setItem/);
  assert.match(authJs, /window\.location\.hash === "#reset"/);
  assert.match(authJs, /school_staff/);
  assert.match(authJs, /cuac_ops/);
  assert.match(authCss, /\.role-switcher/);
  assert.match(authCss, /\.continuation-strip/);
  assert.match(authCss, /\.auth-role-panel/);
  assert.match(authCss, /\.role-note/);
  assert.match(authCss, /\.verification-note/);
  assert.match(authCss, /\.recovery-form/);
  assert.match(sharedJs, /function renderHeader/);
  assert.match(sharedJs, /function renderFooter/);
  assert.match(sharedJs, /function renderAgentShell/);
  assert.match(sharedJs, /function getShellContext/);
  assert.match(sharedJs, /function renderAccountMenu/);
  assert.match(authJs, /Action saved for after sign in/);
  assert.match(authJs, /function safeLocalUrl\(value\)/);
  assert.match(sharedJs, /function normalizeActiveNav/);
  assert.match(sharedJs, /\["favourites", "notifications", "preferences", "auth"\]\.includes\(active\)\) return "hub"/);
  assert.match(sharedJs, /data-account-menu-trigger/);
  assert.match(sharedJs, /function shouldShowSavedShortcut\(shellContext\)/);
  assert.match(sharedJs, /shellContext\.authState === "signed-in" && shellContext\.role === "student"/);
  assert.match(sharedJs, /function renderSavedShortcut\(\)/);
  assert.match(sharedJs, /data-nav-saved-shortcut/);
  assert.match(sharedJs, /shellContext\.surface === "school-staff"/);
  assert.match(sharedJs, /学校工作台/);
  assert.match(sharedJs, /租户设置/);
  assert.match(sharedJs, /请求模板/);
  assert.match(sharedJs, /shellContext\.surface === "cuac-internal"/);
  assert.match(sharedJs, /运营后台/);
  assert.match(sharedJs, /Agent 审计/);
  assert.match(sharedJs, /showSavedShortcut = shouldShowSavedShortcut\(shellContext\)/);
  assert.match(sharedJs, /navActions\.innerHTML = `\$\{shouldShowSavedShortcut\(shellContext\)/);
  assert.match(sharedJs, /\["notifications\.html", icons\.bell, "Notifications"\]/);
  assert.match(sharedJs, /\["preferences\.html", icons\.settings, "Preferences"\]/);
  assert.match(sharedJs, /preferences\.html#profile/);
  assert.match(sharedCss, /\.nav a,\s*\.footer a,\s*\.account-popover a,\s*\.brand/);
  assert.match(sharedCss, /\.footer-col a:any-link/);
  assert.match(sharedCss, /\.footer-legal a:any-link/);
  assert.match(sharedJs, /\["favourites\.html", icons\.saved, "Favourites"\]/);
  assert.match(sharedJs, /sign-in-pill/);
  assert.match(sharedJs, /data-cuac-sign-in-trigger/);
  assert.doesNotMatch(sharedJs, /<a class="sign-in-pill" href="auth\.html">/);
  assert.doesNotMatch(sharedJs, /School staff sign in|CUAC staff sign in/);
  assert.match(sharedJs, /shellContext\.role === "student"/);
  assert.match(sharedCss, /\.cuac-agent-composer/);
  assert.match(sharedCss, /\.account-popover\[hidden\]/);
  assert.match(sharedCss, /\.sign-in-pill/);
  assert.match(sharedCss, /\.sign-in-pill\s*\{[\s\S]*border:\s*0/);
  assert.match(sharedCss, /\.sign-in-pill\s*\{[\s\S]*cursor:\s*pointer/);
  assert.match(authCss, /\.role-switcher/);
  assert.match(authCss, /\.auth-tabs/);
  assert.match(authCss, /\.auth-role-panel/);
  assert.doesNotMatch(sharedCss, /\.cuac-auth-modal/);
  assert.match(sharedCss, /\.nav-links a\s*\{[\s\S]*text-decoration:\s*none/);
  assert.match(sharedCss, /\.footer-col a\s*\{[\s\S]*text-decoration:\s*none/);
  assert.match(sharedCss, /\.brand:visited,\s*\.brand:any-link\s*\{[\s\S]*color:\s*var\(--accent-dark\)/);
  assert.match(sharedCss, /\.footer-legal a,\s*\.footer-legal a:visited,\s*\.footer-legal a:any-link\s*\{[\s\S]*color:\s*var\(--text-muted\)/);

  await assert.rejects(
    access(new URL("public/_sites-preview", templateRoot)),
  );
});

test("keeps the CUAC Favourites page decision logic explicit", async () => {
  const [favourites, favouritesJs, favouritesCss, cuacData] = await Promise.all([
    readFile(new URL("../public/favourites.html", import.meta.url), "utf8"),
    readFile(new URL("../public/favourites.js", import.meta.url), "utf8"),
    readFile(new URL("../public/favourites.css", import.meta.url), "utf8"),
    readFile(new URL("../public/cuac-data.js", import.meta.url), "utf8"),
  ]);

  assert.match(favourites, /Back to Hub/);
  assert.match(favourites, /Open application/);
  assert.match(favourites, /Browse programs/);
  assert.match(favourites, /Saved schools alone stay as interests until you pick a program/);
  assert.match(favourites, /role="tab" aria-selected="true" data-filter="all"/);
  assert.match(favourites, /role="tab" aria-selected="false" data-filter="program"/);
  assert.match(favourites, /role="tab" aria-selected="false" data-filter="university"/);
  assert.match(favourites, /role="tab" aria-selected="false" data-filter="scholarship"/);
  assert.match(favourites, /role="tab" aria-selected="false" data-filter="city"/);
  assert.match(favourites, /role="tab" aria-selected="false" data-filter="guide"/);
  assert.match(favourites, /No saved items in this view/);

  assert.match(cuacData, /function getSavedItemsSummary\(\)/);
  assert.match(cuacData, /const savedDetailItems = readSavedDetailItems\(\)/);
  assert.match(cuacData, /\.\.\.savedDetailItems/);
  assert.match(cuacData, /defaultApplicationRoutes\.map\(buildSavedProgramItem\)\.filter/);
  assert.match(cuacData, /collections: defaultSavedCollections/);
  assert.match(cuacData, /routeGroups: defaultSavedRouteGroups/);
  assert.match(favouritesJs, /const savedSummary = dataClient\?\.getSavedItemsSummary\?\.?\(\) \|\| \{\}/);
  assert.match(favouritesJs, /const savedItems = \(savedSummary\.items \|\| \[\]\)\.map/);
  assert.match(favouritesJs, /const collections = \(savedSummary\.collections \|\| \[\]\)\.map/);
  assert.match(favouritesJs, /const routeGroups = \(savedSummary\.routeGroups \|\| \[\]\)\.map/);
  assert.match(favouritesJs, /const savedState = new Map\(savedItems\.map/);
  assert.match(favouritesJs, /const compared = new Set\(savedSummary\.comparedIds \|\| \["zju-cs"\]\)/);
  assert.match(favouritesJs, /const addedChoices = new Set\(\[/);
  assert.match(favouritesJs, /\.\.\.\(savedSummary\.addedChoiceIds \|\| \[\]\)/);
  assert.match(favouritesJs, /applicationRoutes\.some\(\(route\) => routeMatchesSavedItem\(route, item\)\)/);
  assert.match(favouritesJs, /function updateSummary\(\)/);
  assert.match(favouritesJs, /programs\.length \? Math\.round\(\(ready \/ programs\.length\) \* 100\) : 0/);
  assert.match(favouritesJs, /const canApply = item\.type === "program"/);
  assert.match(favouritesJs, /if \(!item \|\| item\.type !== "program"\)/);
  assert.match(favouritesJs, /Choose a specific program route before adding an application choice/);
  assert.match(favouritesJs, /addedChoices\.add\(id\)/);
  assert.match(favouritesJs, /compared\.size >= 3/);
  assert.match(favouritesJs, /Compare supports up to 3 saved items/);
  assert.match(favouritesJs, /empty\.classList\.toggle\("visible", items\.length === 0\)/);
  assert.match(favouritesJs, /function setActiveFilter\(nextFilter, focus = false\)/);
  assert.match(favouritesJs, /button\.setAttribute\("aria-selected", active \? "true" : "false"\)/);
  assert.match(favouritesJs, /setActiveFilter\(filter\.dataset\.filter \|\| "all"\)/);
  assert.match(favouritesJs, /document\.addEventListener\("keydown"/);
  assert.match(favouritesJs, /"ArrowLeft", "ArrowRight", "Home", "End"/);
  assert.match(favouritesJs, /setActiveFilter\(tabs\[nextIndex\]\.dataset\.filter \|\| "all", true\)/);
  assert.match(favouritesJs, /function showUndoSave\(item\)/);
  assert.match(favouritesJs, /data-undo-save="\$\{escapeHtml\(item\.id\)\}"/);
  assert.match(favouritesJs, /removed from Favourites/);
  assert.match(favouritesJs, /const undoSave = event\.target\.closest\("\[data-undo-save\]"\)/);
  assert.match(favouritesJs, /savedState\.set\(item\.id, false\)/);
  assert.match(favouritesJs, /savedState\.set\(item\.id, true\)/);
  assert.match(favouritesJs, /restored to Favourites/);
  assert.match(favouritesCss, /\.agent-note button/);
  assert.match(favouritesCss, /\.rule-stack/);
  assert.match(favouritesCss, /\.primary-route-action/);
  assert.match(favouritesCss, /\.compare-actions button,\s*\n\.compare-actions a/);
  assert.match(favouritesJs, /action === "compare-routes"/);
  assert.match(favouritesJs, /\["zju-cs", "nju-se", "uibe-trade"\]/);
  assert.match(favouritesJs, /action === "save-checklist"/);
});

test("keeps the CUAC Preferences page tied to personalization and Agent controls", async () => {
  const [preferences, preferencesJs, preferencesCss, hubJs, spec, cuacData] = await Promise.all([
    readFile(new URL("../public/preferences.html", import.meta.url), "utf8"),
    readFile(new URL("../public/preferences.js", import.meta.url), "utf8"),
    readFile(new URL("../public/preferences.css", import.meta.url), "utf8"),
    readFile(new URL("../public/hub.js", import.meta.url), "utf8"),
    readFile(new URL("../../CUAC_PREFERENCES_PAGE_DESIGN_SPEC.md", import.meta.url), "utf8"),
    readFile(new URL("../public/cuac-data.js", import.meta.url), "utf8"),
  ]);

  assert.match(preferences, /Study goal defaults/);
  assert.match(preferences, /Your account profile/);
  assert.match(preferences, /Password and sign-in security/);
  assert.match(preferences, /Language and region preferences/);
  assert.match(preferences, /Recovery email/);
  assert.match(preferences, /Two-step verification/);
  assert.match(preferences, /Interface language/);
  assert.match(preferences, /Date format/);
  assert.match(preferences, /Budget and funding/);
  assert.match(preferences, /Document readiness/);
  assert.match(preferences, /Notification rules/);
  assert.match(preferences, /data-notification-pref="agent"/);
  assert.match(preferences, /data-notification-timing/);
  assert.match(preferences, /Agent memory/);
  assert.match(preferences, /Signed-in students can keep application memory across the study cycle/);
  assert.match(preferences, /Guest page context/);
  assert.match(preferences, /Signed-out browsing is cleared when the page closes/);
  assert.match(preferences, /Long-term student memory/);
  assert.match(preferences, /Keep until enrollment archive or manual clear/);
  assert.match(preferences, /clearing long-term memory should require confirmation/);
  assert.match(preferences, /data-agent-memory-panel/);
  assert.match(preferences, /data-clear-agent-memory/);
  assert.match(preferences, /data-confirm-clear-agent-memory/);
  assert.match(preferences, /data-agent-long-memory/);
  assert.match(preferences, /Privacy and access/);
  assert.match(preferences, /Open Hub/);
  assert.match(preferences, /Open Hub with this style/);
  assert.match(preferences, /Review funding routes/);
  assert.match(preferences, /Open Hub context/);
  assert.doesNotMatch(preferences, /data-agent-prompt|Ask Agent|Try Agent style|Ask Agent about funding|Explain boundaries/);
  assert.doesNotMatch(preferences, /Preview Agent style/);
  assert.match(preferences, /Use saved routes/);
  assert.match(preferences, /Adviser notes/);
  assert.match(preferences, /Scholarship is a route, not a promise/);
  assert.match(preferences, /Use these settings to shape search defaults, Hub, notifications, and Agent responses/);
  assert.doesNotMatch(preferences, /frontend demo|sign-in preview|unsaved demo changes|Saved in this demo/i);
  assert.doesNotMatch(preferences, /previewpass|newpreviewpass/);
  assert.match(preferences, /data-profile-chips/);
  assert.match(preferences, /data-workspace-health/);

  assert.match(cuacData, /function getPreferenceCenterSummary\(\)/);
  assert.match(cuacData, /source: "CuacDataClient preference center summary fixture"/);
  assert.match(cuacData, /defaultPreferenceSections/);
  assert.match(cuacData, /defaultPreferenceProfile/);
  assert.match(cuacData, /defaultAgentMemoryState/);
  assert.match(cuacData, /"cuacPreferencesDemoState"/);
  assert.match(cuacData, /"cuacStudentAgentMemory"/);
  assert.match(preferencesJs, /document\.querySelectorAll\("\[data-section\]"\)/);
  assert.match(preferencesJs, /document\.querySelectorAll\("\[data-panel\]"\)/);
  assert.match(preferencesJs, /const preferenceSummary = dataClient\?\.getPreferenceCenterSummary\?\.?\(\) \|\| \{\}/);
  assert.match(preferencesJs, /const sectionCopy = preferenceSummary\.sections \|\| \{/);
  assert.match(preferencesJs, /function renderPreferenceSummary/);
  assert.match(preferencesJs, /function currentWorkspacePreferences\(\)/);
  assert.match(preferencesJs, /function applyWorkspacePreferences\(workspace = \{\}\)/);
  assert.match(preferencesJs, /workspace,\s*notifications: currentNotificationPreferences\(\)/);
  assert.match(preferencesJs, /goal:\s*\{[\s\S]*degreeLevel: controlValue\("goal", "Degree level"\)/);
  assert.match(preferencesJs, /readiness:\s*\{[\s\S]*languageEvidence: checkboxValue\("readiness", "IELTS or waiver evidence ready"\)/);
  assert.match(preferencesJs, /window\.location\.hash/);
  assert.match(preferencesJs, /function applyHashSection\(\)/);
  assert.match(preferencesJs, /if \(hashSection && sectionCopy\[hashSection\]\)/);
  assert.match(preferencesJs, /applyHashSection\(\);/);
  assert.match(preferencesJs, /window\.addEventListener\("hashchange", applyHashSection\)/);
  assert.match(preferencesJs, /data-save-preferences/);
  assert.match(preferencesJs, /data-reset-preferences/);
  assert.match(preferencesJs, /cuacPreferencesDemoState/);
  assert.match(preferencesJs, /preferenceSummary\.storageKeys\?\.agentMemory \|\| "cuacStudentAgentMemory"/);
  assert.match(preferencesJs, /const defaultAgentMemoryState = preferenceSummary\.defaultAgentMemoryState \|\| \{/);
  assert.match(preferencesJs, /function renderAgentMemoryState/);
  assert.match(preferencesJs, /function persistAgentMemoryCleared/);
  assert.match(preferencesJs, /status:\s*"cleared-preview"/);
  assert.match(preferencesJs, /clearTrigger:\s*"manual-confirmation"/);
  assert.match(preferencesJs, /localStorage\.removeItem\(agentMemoryStorageKey\)/);
  assert.match(preferencesJs, /function currentNotificationPreferences/);
  assert.match(preferencesJs, /function applyNotificationPreferences/);
  assert.match(preferencesJs, /Unsaved changes/);
  assert.match(preferencesJs, /Preferences saved/);
  assert.match(hubJs, /const PREFERENCES_DEMO_STATE_KEY = "cuacPreferencesDemoState"/);
  assert.match(hubJs, /function applyPreferencesState\(\)/);
  assert.match(hubJs, /function applyPreferenceReadiness\(readiness = \{\}\)/);
  assert.match(hubJs, /Updated from Preferences/);
  assert.match(hubJs, /applyPreferencesState\(\);\s*renderRoutes\(\);/);

  assert.match(preferencesCss, /\.account-nav button\.active/);
  assert.match(preferencesCss, /\.profile-edit/);
  assert.match(preferencesCss, /\.avatar-preview/);
  assert.match(preferencesCss, /\.control-grid input/);
  assert.match(preferencesCss, /\.toggle-list/);
  assert.match(preferencesCss, /\.agent-memory-panel/);
  assert.match(preferencesCss, /\.memory-confirm/);
  assert.match(preferencesCss, /\.accent-card\.blue/);
  assert.match(preferencesCss, /\.danger-card/);

  assert.match(spec, /Preferences should connect these existing CUAC surfaces/);
  assert.match(spec, /Agent Context Policy/);
  assert.match(spec, /StudentPreference/);
});

test("keeps the CUAC Agent scenario picker available and contained", async () => {
  const [shellJs, shellCss, spec, authJs] = await Promise.all([
    readFile(new URL("../public/shared-shell.js", import.meta.url), "utf8"),
    readFile(new URL("../public/shared-shell.css", import.meta.url), "utf8"),
    readFile(new URL("../public/AGENT_SIDEBAR_INTERACTION_SPEC.md", import.meta.url), "utf8"),
    readFile(new URL("../public/auth.js", import.meta.url), "utf8"),
  ]);

  assert.match(shellJs, /const agentScenarios = \[/);
  assert.match(shellJs, /Choose an Agent scenario/);
  assert.match(shellJs, /Action applied to the current page/);
  assert.match(shellJs, /Current routing fee for each additional school/);
  assert.match(shellJs, /current CUAC data/);
  assert.doesNotMatch(shellJs, /In this demo|For this demo|demo data|Demo action|preview sign-up|Choose a demo Agent scenario|Current page updated locally|Real submission and persistence|prepared locally|demo plan|demo tuition|Demo value|Demo routing|Demo logic/);
  assert.match(shellJs, /function getAgentContextPolicy/);
  assert.match(shellJs, /data-agent-context-policy/);
  assert.match(shellJs, /data-agent-context-retention/);
  assert.match(shellJs, /data-agent-context-storage/);
  assert.match(shellJs, /const shellContext = getShellContext\(header \|\| \{\}\)/);
  assert.match(shellJs, /const shellContext = getShellContext\(\)/);
  assert.match(shellJs, /authState: shellContext\.authState/);
  assert.match(shellJs, /surface: shellContext\.surface/);
  assert.match(shellJs, /role: shellContext\.role/);
  assert.match(shellJs, /route: currentRouteName\(\)/);
  assert.match(shellJs, /actionGuard && !actionGuard\.allowed/);
  assert.match(shellJs, /actionGuard\.reason === "sign-in-required"/);
  assert.match(shellJs, /function showSignInRequired\(labelOrOptions = "Use this feature", maybeOptions = \{\}\)/);
  assert.match(shellJs, /const signInTrigger = event\.target\.closest\("\[data-cuac-sign-in-trigger\]"\)/);
  assert.match(shellJs, /navigateToAuthPage\(\)/);
  assert.match(shellJs, /createServerContinuation\(continuationRequest\)/);
  assert.match(shellJs, /#continuation=/);
  assert.match(shellJs, /let runtimeAuthState = \{/);
  assert.match(shellJs, /async function loadRuntimeAuthState\(\)/);
  assert.match(shellJs, /fetch\("\/api\/v1\/me"/);
  assert.match(shellJs, /fetch\("\/api\/v1\/auth\/logout"/);
  assert.match(shellJs, /authRoleParam\(role\)/);
  assert.doesNotMatch(shellJs, /function readStoredStudentAuthState|authRoleConfigs|approved-preview|cuacAuthDemoState|cuacAuthContinuationDemoState/);
  assert.doesNotMatch(authJs, /function persistAuthPreview|approved-preview|cuacAuthDemoState|cuacAuthContinuationDemoState|localStorage|sessionStorage/);
  assert.doesNotMatch(shellJs, /function persistModalAuth/);
  assert.match(authJs, /function readContinuationCapability\(\)/);
  assert.match(authJs, /window\.history\.replaceState/);
  assert.match(authJs, /async function consumePendingContinuation\(role\)/);
  assert.match(shellJs, /data-auth-continuation-id/);
  assert.match(shellJs, /localStorage\.removeItem\(AUTH_CONTINUATION_KEY\)/);
  assert.match(shellJs, /authContinuationAction/);
  assert.match(shellJs, /const shellContext = getShellContext\(header \|\| \{\}\)/);
  assert.match(shellJs, /target\.dataset\.agentContextRetention = contextPolicy\.retention \|\| ""/);
  assert.match(shellJs, /target\.dataset\.agentContextStorage = contextPolicy\.storage \|\| ""/);
  assert.match(shellJs, /function collectAgentEntityContext\(sourceElement = null\)/);
  assert.match(shellJs, /sourceElement\?\.closest\?\.\("\[data-entity-type\], \[data-detail-root\], \[data-choice\], \[data-saved-item\], \[data-school-status\]"\)/);
  assert.match(shellJs, /function collectAgentInvocationContext\(sourceElement = null, prompt = ""\)/);
  assert.match(shellJs, /contextPolicy,\s*\n\s*entity: collectAgentEntityContext\(sourceElement\)/);
  assert.match(shellJs, /function persistAgentInvocationContext\(context = \{\}\)/);
  assert.match(shellJs, /policy\.storage === "account"[\s\S]*window\.localStorage : window\.sessionStorage/);
  assert.match(shellJs, /persistAgentInvocationContext\(activeAgentContext\)/);
  assert.match(shellJs, /results\.dataset\.agentEntityType = activeAgentContext\.entity\.entityType \|\| ""/);
  assert.match(shellJs, /results\.dataset\.agentSourceModel = activeAgentContext\.entity\.sourceModel \|\| ""/);
  assert.match(shellJs, /document\.addEventListener\("click", \(event\) => \{[\s\S]*const promptTrigger = event\.target\.closest\("\[data-agent-prompt\]"\)/);
  assert.match(shellJs, /context: activeAgentContext/);
  assert.match(shellJs, /sourceContext: activeAgentContext\?\.entity \|\| null/);
  assert.match(shellJs, /openAgentPrompt: launchAgentPrompt/);
  assert.match(shellJs, /resumeAction:\s*\{[\s\S]*type:\s*"agent-action"[\s\S]*actionId/);
  assert.match(shellJs, /const protectedStudentRoutes = new Set/);
  assert.match(shellJs, /function initProtectedStudentLinks\(\)/);
  assert.match(shellJs, /function isStudentSignedIn\(\)/);
  assert.match(shellJs, /function requireStudentSignedIn\(label = "Use this feature", afterSignIn\)/);
  assert.match(shellJs, /if \(isStudentSignedIn\(\)\) return/);
  assert.match(shellJs, /showSignInRequired\(link\.textContent\.trim\(\) \|\| "Open student workspace", \{ requiredRole: "student", returnUrl: href \}\)/);
  assert.match(shellJs, /function initProtectedStudentPage\(\)/);
  assert.match(shellJs, /showSignInRequired\("Sign in to open your student workspace", \{ requiredRole: "student" \}\)/);
  assert.match(shellJs, /initProtectedStudentPage\(\);/);
  assert.match(shellJs, /window\.CUAC = \{ \.\.\.\(window\.CUAC \|\| \{\}\), requireSignedIn, requireStudentSignedIn, showSignInRequired/);
  assert.match(shellJs, /actionKey: actionGuard\?\.action\?\.actionKey/);
  assert.match(shellJs, /confirmationRequired: Boolean\(actionGuard\?\.action\?\.confirmationRequired\)/);
  assert.match(shellJs, /data-agent-confirmation/);
  assert.match(shellJs, /data-agent-confirmed="true"/);
  assert.match(shellJs, /Confirm before CUAC changes school, application, payment, export, or internal audit state/);
  assert.match(spec, /Protected actions use the shared role-aware sign-in continuation flow/);
  assert.match(spec, /public visitors keep only current-page Agent context/);
  assert.match(spec, /one account sign-in flow across Student, School staff, and CUAC staff access contexts/);
  assert.match(spec, /unauthenticated identity is unknown; the Auth page shows access context choices/);
  assert.match(spec, /authentication is resolved from `GET \/api\/v1\/me` and an HttpOnly server session/);
  assert.match(spec, /after sign-in succeeds, the exact pending action is replayed once/);
  assert.match(spec, /remaining continuation migration must move the bounded static-page payload/);
  assert.match(shellJs, /data-agent-scenario-trigger/);
  assert.match(shellJs, /data-agent-scenario-menu/);
  assert.match(shellJs, /data-cuac-agent-resize/);
  assert.match(shellJs, /panel\.classList\.toggle\("wide", wide\)/);
  assert.match(shellJs, /Find English-taught computer science master in Hangzhou/);
  assert.match(shellJs, /Summarize my progress and blockers/);
  assert.match(shellJs, /Summarize this school's CUAC application queue/);
  assert.match(shellJs, /Review denied Agent export requests/);
  assert.match(shellJs, /mode === "ops"/);
  assert.match(shellJs, /ops-review-agent-audit/);
  assert.match(shellJs, /Submit application set/);
  assert.match(shellJs, /action: "submit-application"/);
  assert.match(shellJs, /school-copy-request-template/);
  assert.match(shellJs, /school-bulk-contact/);
  assert.match(shellJs, /school-export-csv/);
  assert.match(shellJs, /const isSchoolSettingsPage = currentRouteName\(\) === "school-settings\.html"/);
  assert.match(shellJs, /Open applicant queue/);
  assert.match(shellJs, /const isSchoolMode = agentMode === "school"/);
  assert.match(shellJs, /School Agent mode uses tenant-scoped CUAC records only/);
  assert.match(shellJs, /Do not reveal other school choices, student private memory, or cross-tenant data/);
  assert.match(shellJs, /Summarize my saved routes and tell me which can become application choices/);
  assert.match(shellJs, /const isFavouritesMode = agentMode === "favourites"/);
  assert.match(shellJs, /How your saved programs, universities, scholarships, cities, and guides are becoming application-ready routes/);
  assert.match(shellJs, /Will I definitely get scholarship\?/);
  assert.match(shellJs, /Prefill choice/);
  assert.doesNotMatch(shellJs, /Ask Agent to prefill/);
  assert.match(shellJs, /composer\?\.classList\.toggle\("menu-open", open\)/);

  assert.match(shellCss, /\.cuac-agent-composer\.in-panel \.cuac-scenario-menu/);
  assert.match(shellCss, /\.cuac-agent-confirmation\s*\{/);
  assert.match(shellCss, /\.cuac-agent-context\s*\{/);
  assert.match(shellCss, /\.cuac-agent-context strong/);
  assert.match(shellCss, /\.cuac-agent-log-item\.blocked/);
  assert.doesNotMatch(shellCss, /\.cuac-auth-modal\s*\{/);
  assert.doesNotMatch(shellCss, /\.cuac-auth-dialog\s*\{/);
  assert.doesNotMatch(shellCss, /\.cuac-auth-actions \.primary/);
  assert.match(shellCss, /\.cuac-agent-panel\.wide\s*\{[\s\S]*width:\s*min\(760px,\s*50vw\)/);
  assert.match(shellCss, /\.cuac-agent-resize\s*\{/);
  assert.match(shellCss, /\.cuac-agent-form\s*\{[\s\S]*position:\s*relative/);
  assert.match(shellCss, /\.cuac-agent-composer\.in-panel \.cuac-scenario-picker\s*\{[\s\S]*position:\s*static/);
  assert.match(shellCss, /\.cuac-scenario-menu\[hidden\]\s*\{[\s\S]*display:\s*none/);
  assert.match(shellCss, /max-height:\s*min\(300px,\s*calc\(100vh - 360px\)\)/);
  assert.match(shellCss, /\.cuac-agent-composer\.in-panel\.menu-open \.cuac-agent-form/);
  assert.match(shellCss, /\.cuac-agent-composer\.in-panel \.cuac-scenario-trigger span\s*\{[\s\S]*display:\s*none/);

  assert.match(spec, /Demo Scenario Coverage Standard/);
  assert.match(spec, /redirect to `auth\.html`/);
  assert.match(spec, /After sign-in succeeds, return to the original page/);
  assert.match(spec, /Demo Scenario Router Requirements/);
  assert.match(spec, /\| Risk \| "Will I definitely get scholarship\?" \| Caution \+ source\/adviser step \|/);
});

test("keeps the CUAC application payment and school handoff contracts explicit", async () => {
  const [application, applicationJs, applicationCss, hub, hubCss, hubJs, sharedJs, schoolPortal, schoolPortalJs, schoolPortalCss, cuacData, spec, schoolSpec, schoolBackendSpec, rootReadme] = await Promise.all([
    readFile(new URL("../public/application.html", import.meta.url), "utf8"),
    readFile(new URL("../public/application.js", import.meta.url), "utf8"),
    readFile(new URL("../public/application.css", import.meta.url), "utf8"),
    readFile(new URL("../public/hub.html", import.meta.url), "utf8"),
    readFile(new URL("../public/hub.css", import.meta.url), "utf8"),
    readFile(new URL("../public/hub.js", import.meta.url), "utf8"),
    readFile(new URL("../public/shared-shell.js", import.meta.url), "utf8"),
    readFile(new URL("../public/school-portal.html", import.meta.url), "utf8"),
    readFile(new URL("../public/school-portal-runtime.js", import.meta.url), "utf8"),
    readFile(new URL("../public/school-workspace.css", import.meta.url), "utf8"),
    readFile(new URL("../public/cuac-data.js", import.meta.url), "utf8"),
    readFile(new URL("../../CUAC_APPLICATION_SUBMISSION_PAYMENT_SCHOOL_PORTAL_SPEC.md", import.meta.url), "utf8"),
    readFile(new URL("../../CUAC_SCHOOL_PORTAL_TEACHER_WORKSPACE_SPEC.md", import.meta.url), "utf8"),
    readFile(new URL("../../CUAC_SCHOOL_PORTAL_BACKEND_SPEC.md", import.meta.url), "utf8"),
    readFile(new URL("../../README.md", import.meta.url), "utf8"),
  ]);

  assert.match(hub, /href="application\.html"/);
  assert.doesNotMatch(hub, /href="application\.html#add-choice"/);
  assert.match(hub, /Open application center/);
  assert.match(hub, /Choices<\/b>[\s\S]*Info<\/b>[\s\S]*Fee<\/b>[\s\S]*Send<\/b>/);
  assert.match(hub, /data-application-title/);
  assert.match(hub, /Need help/);
  assert.match(hub, /<strong>Ask Agent<\/strong>/);
  assert.match(hub, /data-agent-prompt/);
  assert.doesNotMatch(hub, /Preferences<\/strong>|Open settings|<strong>Documents<\/strong>|Hub notes/);
  assert.match(hubJs, /setApplicationCta\("Start application", "application\.html"\)/);
  assert.doesNotMatch(hubJs, /setApplicationCta\("Start application", "application\.html#add-choice"\)/);
  assert.doesNotMatch(hubJs, /data-route-agent/);
  assert.match(hubCss, /\.agent-tool/);
  assert.doesNotMatch(hubCss, /\.preferences-tool|\.notes-lines/);
  assert.match(hubJs, /cuacApplicationDemoState/);
  assert.match(hubJs, /cuacSchoolPortalDemoState/);
  assert.match(hubJs, /window\.location\.href = "application\.html#add-choice"/);
  assert.match(hubJs, /Application sent/);
  assert.match(hubJs, /School contacted you/);
  assert.match(hubJs, /School viewed your record/);

  assert.match(application, /Application center/);
  assert.match(application, /Application status/);
  assert.match(application, /Complete, pay, send/);
  assert.match(application, /id="overview" data-application-step="overview"/);
  assert.match(application, /Next step/);
  assert.match(application, /data-overview-next-title/);
  assert.match(application, /data-overview-next-detail/);
  assert.match(application, /data-overview-next-action/);
  assert.match(application, /data-overview-step="choices"/);
  assert.match(application, /data-overview-step="info"/);
  assert.match(application, /data-overview-step="fee"/);
  assert.match(application, /data-overview-step="payment"/);
  assert.match(application, /data-overview-step="send"/);
  assert.match(application, /data-application-step="info" aria-label="Student information"/);
  assert.match(application, /Payment<\/strong>[\s\S]*Pay CUAC fee/);
  assert.match(application, /Review choices/);
  assert.match(application, /data-open-choice-modal/);
  assert.match(application, /data-choice-modal/);
  assert.match(application, /data-degree-select/);
  assert.match(application, /data-choice-source-map/);
  assert.match(application, /data-choice-note/);
  assert.match(application, /Student note to this school/);
  assert.match(application, /What the selected school will receive/);
  assert.match(application, /data-student-info-form/);
  assert.match(application, /data-profile-detail-hero/);
  assert.match(application, /data-profile-detail-title/);
  assert.match(application, /Return to student info/);
  assert.match(application, /profile-section-overview/);
  assert.match(application, /Personal details/);
  assert.match(application, /Finance & exams/);
  assert.match(application, /data-profile-overview-back/);
  assert.match(application, /data-profile-section-target="personal"/);
  assert.match(application, /data-profile-section-target="contact"/);
  assert.match(application, /data-profile-section-target="education"/);
  assert.match(application, /data-profile-section-target="finance"/);
  assert.match(application, /data-profile-section-target="school-summary"/);
  assert.match(application, /data-profile-section="personal"/);
  assert.match(application, /data-profile-section="finance"/);
  assert.match(application, /data-profile-section="documents"/);
  assert.match(application, /data-profile-section="consent"/);
  assert.match(application, /data-profile-next/);
  assert.match(application, /name="currentCountry"/);
  assert.match(application, /name="fullName"/);
  assert.match(application, /name="email"/);
  assert.match(application, /name="phone"/);
  assert.match(application, /name="preferredContact"/);
  assert.match(application, /name="country"/);
  assert.match(application, /name="passportNationality"/);
  assert.match(application, /name="educationStage"/);
  assert.match(application, /name="currentSchool"/);
  assert.match(application, /name="intendedLevel"/);
  assert.match(application, /name="subjectInterest"/);
  assert.match(application, /name="fundingIntent"/);
  assert.match(application, /name="budgetRange"/);
  assert.match(application, /name="languageStatus"/);
  assert.match(application, /name="hskStatus"/);
  assert.match(application, /name="cscaStatus"/);
  assert.match(application, /name="guardianStatus"/);
  assert.match(application, /name="passportReady"/);
  assert.match(application, /name="transcriptReady"/);
  assert.match(application, /name="translationReady"/);
  assert.match(application, /name="languageProofReady"/);
  assert.match(application, /name="academicSummary"/);
  assert.match(application, /name="readinessNote"/);
  assert.match(application, /name="schoolInfoConsent"/);
  assert.match(application, /data-school-id="101"/);
  assert.match(application, /data-program-id="10102"/);
  assert.match(application, /data-school-id="102"/);
  assert.match(application, /data-program-id="10202"/);
  assert.match(application, /data-school-id="103"/);
  assert.match(application, /data-program-id="10302"/);
  assert.match(application, /data-school="Zhejiang University"/);
  assert.match(application, /data-program="Computer Science MSc"/);
  assert.match(application, /data-program-name="Computer Science"/);
  assert.match(application, /data-intake="Fall 2026"/);
  assert.match(application, /data-flow-target="choices"/);
  assert.match(application, /data-flow-target="fee"/);
  assert.match(application, /id="fee" data-fee-card/);
  assert.match(application, /id="payment" data-application-step="payment"/);
  assert.match(application, /First school is included\. Each additional school adds USD/);
  assert.match(application, /Send to selected schools/);
  assert.match(application, /data-send-to-schools/);
  assert.match(application, /School record sent/);
  assert.match(application, /Watch status/);
  assert.doesNotMatch(application, /data-payment-modal|payment-dialog|data-close-payment/);
  assert.match(application, /data-payment-simulation-status/);
  assert.match(application, /data-submit-consent/);
  assert.match(application, /USD <span data-extra-school-fee>20<\/span> \/ extra school/);
  assert.match(application, /data-complete-payment/);
  assert.match(application, /data-payment-fail/);
  assert.match(application, /Payment was not completed/);
  assert.match(application, /Each school receives only its own program record/);
  assert.match(application, /View school receipt/);
  assert.doesNotMatch(application, /Confirm payment and send/);
  assert.match(application, /Show payment issue/);
  assert.match(application, /Choice logic/);
  assert.match(application, /Saved routes/);
  assert.match(application, /Guide/);
  assert.doesNotMatch(application, /Ask Agent first/);
  assert.doesNotMatch(application, /data-agent-prompt|Explain next|Agent order|Refresh|Why\?|Check funding|Compare Nanjing/);
  assert.doesNotMatch(application, /demo flow|school portal demo|View school portal demo|Simulate payment issue/i);
  assert.match(applicationJs, /const EXTRA_SCHOOL_FEE_USD = dataClient\?\.config\?\.extraSchoolFeeUsd \|\| 20/);
  assert.match(applicationJs, /dataClient\?\.calculateFee/);
  assert.match(applicationJs, /cuacSchoolPortalDemoState/);
  assert.match(applicationJs, /cuacNotificationEventsDemoState/);
  assert.match(applicationJs, /schools\.length - 1/);
  assert.match(applicationJs, /total: paidSchools \* EXTRA_SCHOOL_FEE_USD/);
  assert.match(applicationJs, /persistApplicationDemoState/);
  assert.match(applicationJs, /function getStudentProfile/);
  assert.match(applicationJs, /function buildSubmittedRecords/);
  assert.match(applicationJs, /function appProgramName\(program = \{\}\)/);
  assert.match(applicationJs, /program\.nameEn \|\| program\.name \|\| program\.program/);
  assert.match(applicationJs, /function appProgramDegree\(program = \{\}\)/);
  assert.match(applicationJs, /program\.degreeLevel \|\| program\.degree/);
  assert.match(applicationJs, /function appProgramLanguage\(program = \{\}\)/);
  assert.match(applicationJs, /program\.teachingLanguage \|\| program\.language/);
  assert.match(applicationJs, /function renderLockedChoiceField\(select, value, label\)/);
  assert.match(applicationJs, /select\.dataset\.catalogLocked = "SchoolProgram"/);
  assert.match(applicationJs, /renderLockedChoiceField\(form\.elements\.intake, selected\.intake, "Intake"\)/);
  assert.match(applicationJs, /renderLockedChoiceField\(form\.elements\.language, selected\.language, "Teaching language"\)/);
  assert.match(applicationJs, /appendChoiceRoute\(\{ \.\.\.selected, choiceNote: getFieldValue\(form, "choiceNote", ""\) \}\)/);
  assert.match(applicationJs, /function appProgramOptionValue\(program = \{\}\)/);
  assert.match(applicationJs, /String\(appProgramId\(program\) \|\| appProgramName\(program\)\)/);
  assert.match(applicationJs, /findCatalogProgramBySelection\(university, value, degree\)/);
  assert.match(applicationJs, /appProgramDegree\(entry\) === degree/);
  assert.match(applicationJs, /data-school-id="\$\{safeSchoolId\}"/);
  assert.match(applicationJs, /data-program-id="\$\{safeProgramId\}"/);
  assert.match(applicationJs, /schoolId: card\.dataset\.schoolId \|\| ""/);
  assert.match(applicationJs, /programId: card\.dataset\.programId \|\| ""/);
  assert.match(applicationJs, /choiceNote: card\.dataset\.choiceNote \|\| ""/);
  assert.match(applicationJs, /data-choice-note="\$\{safeChoiceNote\}"/);
  assert.match(applicationCss, /\.choice-school-note/);
  assert.match(applicationCss, /\.choice-form select\[data-catalog-locked="SchoolProgram"\]/);
  assert.match(hubCss, /--page-width:\s*min\(1720px, calc\(100vw - 144px\)\)/);
  assert.match(applicationCss, /--page-width:\s*min\(1720px, calc\(100vw - 144px\)\)/);
  assert.match(applicationCss, /\.application-stepper\s*\{[\s\S]*grid-template-columns:\s*repeat\(6, minmax\(112px, 1fr\)\)/);
  assert.match(applicationCss, /@media \(max-width: 1280px\)\s*\{[\s\S]*\.draft-card\.application-status-card\s*\{[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(applicationCss, /@media \(max-width: 1280px\)\s*\{[\s\S]*\.application-stepper\s*\{[\s\S]*grid-template-columns:\s*repeat\(6, minmax\(108px, 1fr\)\)/);
  assert.match(applicationCss, /\.section-cards\s*\{[\s\S]*grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(applicationCss, /\.application-page\.profile-detail-mode \.profile-detail-hero\s*\{[\s\S]*width:\s*var\(--page-width\)/);
  assert.match(applicationCss, /\.application-page\.profile-detail-mode \.submission-grid\s*\{[\s\S]*width:\s*var\(--page-width\)/);
  assert.match(applicationCss, /\.overview-section-cards \.section-card::after\s*\{[\s\S]*display:\s*none/);
  assert.match(applicationCss, /\.section-card\.ready\s*\{[\s\S]*background:\s*#ffffff/);
  assert.match(applicationCss, /\.section-card\.done \.section-status\s*\{[\s\S]*background:\s*#6c9b00/);
  assert.match(applicationCss, /\.profile-section-card\s*\{[\s\S]*min-height:\s*218px[\s\S]*background:\s*linear-gradient/);
  assert.match(applicationCss, /\.profile-section-card:nth-child\(5\)\s*\{[\s\S]*rgb\(255 244 207 \/ 0\.58\)/);
  assert.match(applicationCss, /\.profile-section-overview\s*\{[\s\S]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)[\s\S]*max-width:\s*none/);
  assert.match(applicationCss, /\.profile-editor-shell\s*\{[\s\S]*grid-template-columns:\s*260px minmax\(0, 960px\)/);
  assert.match(applicationCss, /\.section-head button,\s*\n\.section-head a/);
  assert.match(application, /class="profile-document-matrix" aria-label="Document requests by selected school"/);
  assert.match(application, /School requests[\s\S]*By school[\s\S]*Status only/);
  assert.doesNotMatch(application, /class="document-matrix reveal"/);
  assert.match(applicationCss, /\.profile-document-matrix \.section-title button,\s*\n\.profile-document-matrix \.section-title a/);
  assert.doesNotMatch(applicationCss, /\.document-matrix/);
  assert.match(applicationJs, /\.profile-document-matrix \.matrix-cell/);
  assert.match(applicationJs, /function addApplicationNotificationEvent/);
  assert.match(applicationJs, /application-submitted-to-schools/);
  assert.match(applicationJs, /const persistedApplicationState = readApplicationDemoState\(\)/);
  assert.match(applicationJs, /let paymentStatus = persistedApplicationState\?\.paymentStatus \|\| "preview"/);
  assert.match(applicationJs, /let commerceOrder = persistedApplicationState\?\.commerceOrder \|\| null/);
  assert.match(applicationJs, /let paymentCreateResult = persistedApplicationState\?\.paymentCreateResult \|\| null/);
  assert.match(applicationJs, /const paymentComplete = submittedToSchools \|\| paymentStatus === "paid-demo" \|\| paymentStatus === "free-submitted"/);
  assert.match(applicationJs, /payment:\s*\{[\s\S]*status: paymentComplete \? "Paid" : submitReady \? "Pay" : "Locked"/);
  assert.match(applicationJs, /target: "payment"[\s\S]*Payment unlocks final send/);
  assert.match(applicationJs, /getRequiredStepState\(\)\.payment\.complete/);
  assert.match(applicationJs, /paymentStatus = "failed-preview"/);
  assert.match(applicationJs, /function startPaymentSimulation/);
  assert.match(applicationJs, /paymentStatus = "processing-demo"/);
  assert.match(applicationJs, /function buildCommerceCartResult/);
  assert.match(applicationJs, /function buildCommerceOrder/);
  assert.match(applicationJs, /function buildPaymentCreateResult/);
  assert.match(applicationJs, /function syncCommercePayment/);
  assert.match(applicationJs, /paymentCreateResult\.providerTxnId/);
  assert.match(applicationJs, /callbackSignaturePayload/);
  assert.match(applicationCss, /\.application-page\[data-application-stage="fee"\] \.submission-grid\s*\{[\s\S]*width:\s*var\(--page-width\)/);
  assert.match(applicationCss, /\.payment-page\s*\{[\s\S]*width:\s*var\(--page-width\)/);
  assert.match(applicationCss, /\.payment-receipt-strip/);
  assert.doesNotMatch(applicationCss, /\.payment-record-grid|\.payment-modal|\.payment-dialog/);
  assert.doesNotMatch(applicationJs, /CommerceOrder\.id<\/span>|PaymentCreateResult\.providerTxnId<\/span>/);
  assert.doesNotMatch(applicationJs, /querySelector\("\[data-payment-modal\]"\)/);
  assert.match(applicationJs, /function renderPaymentPage/);
  assert.doesNotMatch(applicationJs, /function renderPaymentModal/);
  assert.match(applicationCss, /\.payment-steps span\s*\{[\s\S]*display:\s*flex[\s\S]*text-align:\s*left/);
  assert.match(applicationJs, /Confirm \$\{formatFee\(feeInfo\.total\)\} payment/);
  assert.match(applicationJs, /Payment confirmation required/);
  assert.match(applicationJs, /Complete payment before final send/);
  assert.doesNotMatch(applicationJs, /Processing demo payment|Payment simulation required|Use the demo payment step|Try the payment simulation|Simulate \$\{formatFee/);
  assert.doesNotMatch(applicationJs, /data-agent-prompt|function openAgentWithPrompt|Check whether/);
  assert.match(applicationJs, /button\.textContent = "View sent status"/);
  assert.match(applicationJs, /button\.removeAttribute\("disabled"\)/);
  assert.match(applicationJs, /function viewSentStatus/);
  assert.match(applicationJs, /history\.replaceState\(null, "", "#send"\)/);
  assert.match(applicationJs, /document\.querySelector\("\[data-submission-status\]"\)\?\.scrollIntoView/);
  assert.match(applicationJs, /payment-issue-application-set/);
  assert.match(applicationJs, /paymentStatus = feeInfo\.total \? "paid-demo" : "free-submitted"/);
  assert.match(applicationJs, /function deriveSchoolPriority/);
  assert.match(applicationJs, /const sourceMap = document\.querySelector\("\[data-choice-source-map\]"\)/);
  assert.match(applicationJs, /What this school will receive/);
  assert.match(applicationJs, /Your selected route/);
  assert.match(applicationJs, /Academic route/);
  assert.match(applicationJs, /Entry requirements/);
  assert.match(applicationJs, /Application route/);
  assert.match(applicationJs, /Funding match/);
  assert.match(applicationJs, /Your contact profile/);
  assert.match(applicationJs, /Not shared by CUAC/);
  assert.doesNotMatch(applicationJs, /source check stays with CUAC data|Program record adds|School funding record|Profile adds|CUAC program data adds|Auto-attached from SchoolScholarship|Student profile adds|Not sent by CUAC/);
  assert.match(applicationJs, /syncProgramFields\(\);\s*persistApplicationDemoState\(\);/);
  assert.match(applicationJs, /studentProfile/);
  assert.match(applicationJs, /submittedRecords/);
  assert.match(applicationJs, /data-student-info-form/);
  assert.match(applicationJs, /function showPaymentError/);
  assert.match(applicationJs, /Confirm information sharing before CUAC sends this non-document record to selected schools/);
  assert.match(applicationJs, /if \(paymentError\) paymentError\.hidden = true/);
  assert.match(applicationJs, /function renderSchoolContactStatuses/);
  assert.match(applicationJs, /const schoolFollowups = portalState\?\.schoolFollowups \|\| \{\}/);
  assert.match(applicationJs, /card\.classList\.remove\("contacted", "viewed", "waiting"\)/);
  assert.match(applicationJs, /followup\?\.statusKey === "viewed"/);
  assert.match(applicationJs, /followup\?\.statusKey === "waiting-documents"/);
  assert.match(applicationCss, /\.school-status-grid article\.viewed/);
  assert.match(applicationJs, /function openChoiceModalFromHash/);
  assert.match(applicationJs, /let currentApplicationStage = "overview"/);
  assert.match(applicationJs, /const applicationStages = \["overview", "choices", "info", "fee", "payment", "send"\]/);
  assert.match(applicationJs, /const profileSections = \["personal", "nationality", "contact", "education", "finance", "documents", "school-summary", "consent"\]/);
  assert.match(applicationJs, /const profileSectionRouteAliases = \{/);
  assert.match(applicationJs, /account:\s*"personal"/);
  assert.match(applicationJs, /background:\s*"education"/);
  assert.match(applicationJs, /funding:\s*"finance"/);
  assert.match(applicationJs, /notes:\s*"school-summary"/);
  assert.match(applicationJs, /function normalizeProfileSection/);
  assert.match(applicationJs, /setApplicationStage\("overview"\)/);
  assert.match(applicationJs, /location\.hash === "" \|\| location\.hash === "#overview"/);
  assert.match(applicationJs, /function updateOverviewStepCards/);
  assert.match(applicationJs, /function getOverviewNextAction/);
  assert.match(applicationJs, /function updateOverviewNextAction/);
  assert.match(applicationJs, /action\.dataset\.nextApplicationStep = next\.target/);
  assert.match(applicationJs, /function navigateApplicationStage/);
  assert.match(applicationJs, /function choiceRingValue/);
  assert.match(applicationJs, /return orderConfirmed \? "Done" : String\(choiceCount\)/);
  assert.doesNotMatch(applicationJs, /\[data-choice-status\]"\)\.textContent = `\$\{choiceCount\} choice/);
  assert.doesNotMatch(applicationJs, /\[data-choice-status\]"\)\.textContent = `\$\{choiceCount\} choices`/);
  assert.doesNotMatch(applicationJs, /textContent = "Order confirmed"/);
  assert.match(applicationJs, /if \(location\.hash === "#payment"\)/);
  assert.match(applicationJs, /function finishPaymentReview/);
  assert.match(applicationJs, /profileRoutePrefix/);
  assert.match(applicationJs, /function openProfileDetail/);
  assert.match(applicationJs, /profile-detail-mode/);
  assert.match(applicationJs, /function resetChoiceConfirmationAfterChange/);
  assert.match(applicationJs, /schools selected · \$\{formatFee\(feeInfo\.total\)\} due/);
  assert.match(applicationJs, /const flowTarget = event\.target\.closest\("\[data-flow-target\]"\)/);
  assert.match(applicationJs, /A new program was added\. Recheck and confirm the choice order before reviewing the fee\./);
  assert.match(applicationJs, /window\.addEventListener\("hashchange", openChoiceModalFromHash\)/);
  assert.match(applicationJs, /const openPayment = event\.target\.closest\("\[data-open-payment\]"\)[\s\S]*navigateApplicationStage\("payment", \{ scroll: true \}\)/);
  assert.match(applicationJs, /const sendToSchools = event\.target\.closest\("\[data-send-to-schools\]"\)[\s\S]*completeSubmission\(\{ paymentCompleted: true \}\)/);
  assert.match(applicationJs, /submittedToSchools = true/);
  assert.match(applicationJs, /Application sent\. Schools will now contact the student directly/);
  assert.match(sharedJs, /"open-choice-modal": "application\.html#add-choice"/);
  assert.match(schoolPortal, /data-portal-role="school"/);
  assert.match(schoolPortal, /class="school-workspace-main"/);
  assert.match(schoolPortal, /data-cuac-header data-active="hub"/);
  assert.match(schoolPortal, /data-cuac-footer><\/div>/);
  assert.match(schoolPortal, /school-workspace\.css\?v=20260903-api-v1/);
  assert.match(schoolPortal, /school-portal-runtime\.js\?v=20260903-api-v1/);
  assert.match(schoolPortal, /<body data-agent-mode="school" data-portal-role="school">/);
  assert.match(schoolPortal, /处理当前学校已确认收到的 CUAC 项目申请/);
  assert.match(schoolPortal, /其他学校的申请不会出现在这里/);
  assert.match(schoolPortal, /data-school-name/);
  assert.match(schoolPortal, /data-refresh-school/);
  assert.match(schoolPortal, /id="records"/);
  assert.match(schoolPortal, /data-school-search/);
  assert.match(schoolPortal, /data-school-status-filter/);
  assert.match(schoolPortal, /data-school-queue/);
  assert.match(schoolPortal, /data-school-detail/);
  assert.doesNotMatch(schoolPortal, /data-owner|data-priority|data-bulk-contact|data-export-csv|data-analytics/);
  assert.doesNotMatch(schoolPortal, /预置队列|Demo|Sample record|浙江大学租户/);
  assert.match(schoolPortalJs, /\/api\/v1\/school\/applications/);
  assert.match(schoolPortalJs, /expectedRevision: detail\.schoolRevision/);
  assert.match(schoolPortalJs, /"Idempotency-Key": crypto\.randomUUID\(\)/);
  assert.match(schoolPortalJs, /item\.schoolId !== schoolState\.tenantSchoolId/);
  assert.match(schoolPortalJs, /auth\.role !== "school_staff"/);
  assert.match(schoolPortalJs, /detail\.applicationRecordFormat !== "cuac\.program-application\.v2"/);
  assert.doesNotMatch(schoolPortalJs, /localStorage|sessionStorage|CuacData|Demo source|Sample record/);
  assert.match(schoolPortalCss, /button:focus-visible/);
  assert.match(schoolPortalCss, /@media \(max-width: 560px\)/);
  assert.match(schoolPortalCss, /prefers-reduced-motion: reduce/);
  assert.match(cuacData, /function getSchoolCatalogRecordById\(schoolId, fallbackName = config\.defaultSchoolTenant\)/);
  assert.match(cuacData, /route\.programId && Number\(program\.id\) === Number\(route\.programId\)/);
  assert.match(cuacData, /route\.schoolId[\s\S]*getSchoolCatalogRecordById\(route\.schoolId/);
  assert.match(hubJs, /const schoolFollowups = Object\.values\(portalState\?\.schoolFollowups \|\| \{\}\)/);
  assert.match(hubJs, /School viewed your record/);
  assert.match(hubJs, /Documents needed/);
  assert.match(applicationCss, /\.choice-source-map/);
  assert.match(applicationCss, /\.choice-source-intro/);
  assert.match(applicationCss, /\.choice-source-map article\.not-sent/);

  assert.match(spec, /extraSchoolFeeUsd = configurable value, demo default 20/);
  assert.match(spec, /Review and send` writes `submittedRecords`/);
  assert.match(spec, /school === "Zhejiang University"/);
  assert.match(spec, /The school should only see its own school application/);
  assert.match(spec, /CUAC does not collect your documents here/);
  assert.match(schoolSpec, /School admissions workspace/);
  assert.match(schoolSpec, /must not expose whether the student also applied to other schools/);
  assert.match(schoolSpec, /should not include a cross-school switcher/);
  assert.match(schoolSpec, /locked school tenant scope/);
  assert.match(schoolSpec, /searchable\/sortable student records/);
  assert.match(schoolSpec, /batch mark as contacted/);
  assert.match(schoolSpec, /Information source:/);
  assert.match(schoolSpec, /tenant-safe `sourceFieldLineage` for Agent explanations and audit/);
  assert.match(schoolPortal, /正在读取当前租户的申请记录/);
  assert.match(schoolSpec, /design-lab\/SCHOOL_PORTAL_PRODUCT_SPEC\.md/);
  assert.match(schoolSpec, /CUAC_SCHOOL_PORTAL_BACKEND_SPEC\.md/);
  assert.match(rootReadme, /design-lab\/SCHOOL_PORTAL_PRODUCT_SPEC\.md/);
  assert.match(rootReadme, /Current frontend demo boundary for the school-facing admissions workspace/);
  assert.match(schoolBackendSpec, /requires an explicit product\/privacy approval and is not implemented yet/);
  assert.match(schoolBackendSpec, /`sourceFieldLineage` or `informationSources` for other schools/);
  assert.match(schoolBackendSpec, /tenant-safe information sources explaining whether visible fields came from student choice, program catalog, school catalog, or student profile/);
  assert.match(schoolBackendSpec, /Source Lineage Projection/);
  assert.match(schoolBackendSpec, /sourceFieldLineage\.fromProgramRecord/);
  assert.match(schoolBackendSpec, /Lineage metadata is not a cross-tenant audit bypass/);
});
