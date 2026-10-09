import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("clean guide routes server-render reviewed content with canonical metadata and Article schema", async () => {
  const [indexPage, detailPage, helper] = await Promise.all([
    source("app/guides/page.tsx"),
    source("app/guides/[guideSlug]/page.tsx"),
    source("src/server/catalog/public-guide-pages.ts"),
  ]);
  assert.match(indexPage, /listPublishedGuidePages/);
  assert.match(indexPage, /https:\/\/ucac\.cn\/guides\//);
  assert.match(detailPage, /getPublishedGuidePage/);
  assert.match(detailPage, /"@type": "Article"/);
  assert.match(detailPage, /Official sources/);
  assert.match(detailPage, /dateModified/);
  assert.match(helper, /PostgresCatalogRepository/);
});
test("robots, sitemap, and permanent legacy redirects expose the guide content center", async () => {
  const [robots, sitemap, config, detailRedirect] = await Promise.all([
    source("app/robots.ts"),
    source("app/sitemap.ts"),
    source("next.config.ts"),
    source("app/guide-detail.html/route.ts"),
  ]);
  assert.match(robots, /sitemap: "https:\/\/ucac\.cn\/sitemap\.xml"/);
  assert.match(robots, /disallow/);
  assert.match(sitemap, /listPublishedGuidePages/);
  assert.match(sitemap, /guides\/\$\{guide\.slug\}/);
  assert.match(config, /source: "\/guides\.html"/);
  assert.match(config, /permanent: true/);
  assert.match(detailRedirect, /status: 308/);
  assert.match(detailRedirect, /slugPattern\.test\(slug\)/);
  assert.match(detailRedirect, /`\/guides\/\$\{slug\}`/);
});
