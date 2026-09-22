import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = path => readFile(new URL(path, root), "utf8");

test("released surfaces defer Agent UI and expose deterministic site search", async () => {
  const [shell, homeHtml, homeScript, searchHtml, searchScript] = await Promise.all([
    source("public/shared-shell.js"), source("public/home-v3.html"), source("public/home-v3.js"),
    source("public/search.html"), source("public/search.js"),
  ]);
  assert.match(shell, /fetch\("\/api\/v1\/capabilities"/);
  assert.match(shell, /isCapabilityEnabled\("agent"\)/);
  assert.match(shell, /agent:\s*false/);
  assert.match(shell, /function localizedSearchHref\(\)/);
  assert.match(shell, /`search\.html\?lang=\$\{encodeURIComponent\(locale\)\}`/);
  assert.match(homeHtml, /<body\b[^>]*\bdata-agent-mode="off"[^>]*>/);
  assert.match(homeHtml, /data-site-search-form/);
  assert.doesNotMatch(homeHtml, /data-planner-form|data-agent-prompt/);
  assert.match(homeScript, /new URLSearchParams\(\{ q: query \}\)/);
  assert.match(homeScript, /params\.set\("lang", window\.CUACI18n\.locale\)/);
  assert.match(searchHtml, /Programs[\s\S]*Universities[\s\S]*Scholarships[\s\S]*Cities[\s\S]*Guides/);
  assert.match(searchScript, /\/api\/v1\/search/);
  assert.match(searchScript, /AbortController/);
  assert.match(searchScript, /data-search-more/);
  assert.match(searchScript, /interpretedQuery/);
  assert.match(searchHtml, /data-i18n-locales="en,vi,th,id,ms,ar"/);
  assert.match(searchHtml, /search-i18n\.js/);
  assert.doesNotMatch(searchHtml, /data-search-locale=/);
  assert.match(searchScript, /state\.locale === "zh-CN" \? "zh" : "en"/);
  assert.match(searchScript, /displayTitle/);
});

test("all catalog and active workspace pages explicitly disable Agent mode", async () => {
  const pages = [
    "home-v3.html", "programs.html", "universities.html", "scholarships.html", "cities.html", "guides.html",
    "hub-api.html", "application.html", "favourites-api.html", "billing-api.html", "notifications.html",
    "preferences-api.html", "school-portal.html", "school-settings-api.html", "ops-admin-api.html", "search.html",
  ];
  for (const page of pages) assert.match(await source(`public/${page}`), /<body data-agent-mode="off"/i, page);
});

test("search migration installs bounded public catalog trigram indexes", async () => {
  const migration = await source("drizzle/pg/0048_public_catalog_search_indexes.sql");
  assert.match(migration, /CREATE EXTENSION IF NOT EXISTS pg_trgm/);
  for (const table of ["programs", "schools", "scholarships", "cities"]) {
    assert.match(migration, new RegExp(`${table}_public_search_trgm_idx`));
  }
  assert.match(migration, /verification_status.*verified/);
});

test("catalog writes advance one shared search publication revision", async () => {
  const migration = await source("drizzle/pg/0049_catalog_publication_revision.sql");
  assert.match(migration, /CREATE TABLE "catalog_publication_revisions"/);
  assert.match(migration, /CREATE FUNCTION "bump_public_catalog_revision"/);
  for (const table of ["cities", "schools", "programs", "scholarships"]) {
    assert.match(migration, new RegExp(`AFTER INSERT OR UPDATE OR DELETE ON "${table}"`));
  }
  assert.match(migration, /FOR EACH STATEMENT/);
});

test("published guides have a governed searchable repository and share catalog revision invalidation", async () => {
  const [migration, repository] = await Promise.all([
    source("drizzle/pg/0050_published_guides.sql"),
    source("src/server/search/postgres-repository.ts"),
  ]);
  assert.match(migration, /CREATE TABLE "public_guides"/);
  assert.match(migration, /public_guides_public_search_trgm_idx/);
  assert.match(migration, /public_guides_public_catalog_revision_trigger/);
  assert.equal((migration.match(/'published', 'verified'/g) ?? []).length, 5);
  assert.match(repository, /case "guide"/);
  assert.match(repository, /from public_guides g[\s\S]*where g\.status = 'published'/);
});

test("guide discovery reads the published catalog API and has no Agent event behavior", async () => {
  const [html, script, listRoute, detailRoute] = await Promise.all([
    source("public/guides.html"), source("public/guides.js"),
    source("app/api/v1/catalog/guides/route.ts"), source("app/api/v1/catalog/guides/[guideSlug]/route.ts"),
  ]);
  assert.match(html, /data-guide-grid/);
  assert.match(script, /new URL\("\/api\/v1\/catalog\/guides", location\.origin\)/);
  assert.match(script, /api\.searchParams\.set\("limit", "100"\)/);
  assert.doesNotMatch(html, /cuac-data\.js|data-application-timeline|timelineRail/);
  assert.doesNotMatch(script, /getDiscoveryGuides|CuacDataClient|cuac:agent-action|applyGuideAgentAction|Agent highlighted/);
  assert.match(listRoute, /\.listGuides\(request\)/);
  assert.match(detailRoute, /\.getGuide\(request, params\.guideSlug\)/);
});
