import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("insights have native index, article, category, and RSS routes", async () => {
  const [index, article, category, rss] = await Promise.all([
    source("app/insights/page.tsx"),
    source("app/insights/[insightSlug]/page.tsx"),
    source("app/insights/category/[categorySlug]/page.tsx"),
    source("app/insights/rss.xml/route.ts"),
  ]);
  assert.match(index, /UCAC Insights/);
  assert.match(index, /"@type": "Blog"/);
  assert.match(article, /"@type": "BlogPosting"/);
  assert.match(article, /Official sources checked for this article/);
  assert.match(category, /listInsightsByCategory/);
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

test("sitemap and shared navigation expose insights", async () => {
  const [sitemap, shell, guideShell] = await Promise.all([
    source("app/sitemap.ts"),
    source("public/shared-shell.js"),
    source("app/guides/guide-shell.tsx"),
  ]);
  assert.match(sitemap, /listInsights/);
  assert.match(sitemap, /insights\/category/);
  assert.match(shell, /href: "\/insights\/"/);
  assert.match(guideShell, /href="\/insights\/"/);
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
