import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("insights have native index, article, category, and RSS routes", async () => {
  const [index, article, category, rss, styles] = await Promise.all([
    source("app/insights/page.tsx"),
    source("app/insights/[insightSlug]/page.tsx"),
    source("app/insights/category/[categorySlug]/page.tsx"),
    source("app/insights/rss.xml/route.ts"),
    source("app/insights/insights.module.css"),
  ]);
  assert.match(index, /UCAC Insights/);
  assert.match(index, /"@type": "Blog"/);
  assert.match(index, /Our editorial standard/);
  assert.match(index, /How we publish/);
  assert.match(index, /featuredPost/);
  assert.match(index, /Latest analysis/);
  assert.match(article, /"@type": "BlogPosting"/);
  assert.match(article, /Official sources checked for this article/);
  assert.match(article, /section\.tables/);
  assert.match(article, /contentOrder/);
  assert.match(styles, /\.tableWrap/);
  assert.match(styles, /\.articleTable/);
  assert.match(category, /listPublishedInsights/);
  assert.match(rss, /application\/rss\+xml/);
});

test("insight content is dated, categorized, sourced, and distinct from guides", async () => {
  const content = await source("src/content/insights.ts");
  assert.match(content, /admissions-updates/);
  assert.match(content, /program-watch/);
  assert.match(content, /scholarship-watch/);
  assert.match(content, /2026-admissions-notices-what-applicants-should-track/);
  assert.match(content, /relatedGuides/);
  assert.match(content, /status: "draft" \| "published"/);
  assert.match(content, /post\.status === "published"/);
  assert.match(content, /Published insights require sections and official sources/);
  assert.doesNotMatch(content, /slug: "study-in-china-in-english-without-hsk"/);
});

test("sitemap and the original public shell expose insights", async () => {
  const [sitemap, shell, guideShell, insightShell, publicSiteShell] = await Promise.all([
    source("app/sitemap.ts"),
    source("public/shared-shell.js"),
    source("app/guides/guide-shell.tsx"),
    source("app/insights/insight-shell.tsx"),
    source("app/public-site-shell.tsx"),
  ]);
  assert.match(sitemap, /listPublishedInsights/);
  assert.match(sitemap, /insights\/category/);
  assert.match(shell, /href: "\/insights\/"/);
  assert.match(guideShell, /PublicSiteShell/);
  assert.match(guideShell, /active="guides"/);
  assert.match(insightShell, /PublicSiteShell/);
  assert.match(insightShell, /active="insights"/);
  assert.match(publicSiteShell, /data-cuac-header/);
  assert.match(publicSiteShell, /data-cuac-footer/);
  assert.match(publicSiteShell, /shared-shell\.css/);
  assert.match(publicSiteShell, /shared-shell\.js/);
});

test("site search exposes insights as a first-class result type", async () => {
  const [service, repository, page, script] = await Promise.all([
    source("src/server/search/service.ts"),
    source("src/server/search/postgres-repository.ts"),
    source("public/search.html"),
    source("public/search.js"),
  ]);
  assert.match(service, /"guide", "insight"/);
  assert.match(repository, /function searchInsights/);
  assert.match(page, /data-search-type="insight"/);
  assert.match(script, /insight: "IN"/);
});

test("Insights CMS keeps drafts governed while published content feeds every public surface", async () => {
  const [schema, migration, policy, governance, reader, validator, opsHtml, opsScript] = await Promise.all([
    source("src/server/db/schema.ts"), source("drizzle/pg/0079_insights_cms.sql"), source("src/server/policy/policy.ts"),
    source("src/server/insights/postgres-governance.ts"), source("src/server/insights/public-insights.ts"),
    source("src/server/insights/insight-document.ts"),
    source("public/ops-admin-api.html"), source("public/ops-admin-runtime.js"),
  ]);
  assert.match(schema, /insightPosts/);
  assert.match(schema, /insightVersions/);
  assert.match(migration, /CREATE TABLE "insight_posts"/);
  assert.match(migration, /CREATE TABLE "insight_versions"/);
  assert.match(policy, /catalog\.publish_insights/);
  assert.match(policy, /activeRole === "cuac_admin" && context\.authStrength === "step_up"/);
  assert.match(governance, /catalog\.insights\.\$\{action\}/);
  assert.match(governance, /this\.audit\(tx, scope, "publish"/);
  assert.match(governance, /publication_revision = publication_revision \+ 1/);
  assert.match(governance, /update catalog_publication_revisions set revision = revision \+ 1/);
  assert.match(reader, /current_version_id/);
  assert.match(reader, /listStaticInsights/);
  assert.match(validator, /Insight table rows must match the header width/);
  assert.match(validator, /contentOrder/);
  assert.match(opsHtml, /data-ops-tab="insights"/);
  assert.match(opsScript, /data-insight-draft/);
  assert.match(opsScript, /data-insight-publish/);
  assert.match(opsScript, /data-insight-withdraw/);
  assert.match(opsScript, /wordClipboardToInsightText/);
  assert.match(opsScript, /data-insight-body/);
  assert.match(opsScript, /parseInsightTable/);
  assert.doesNotMatch(opsScript, /data-insight-approve/);
});
