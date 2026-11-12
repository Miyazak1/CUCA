import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { localAcceptanceBrowser } from "./lib/local-browser-acceptance.mjs";
import { assertLocalDevelopmentState } from "./lib/local-development.ts";
import { listInsights, insightCategories } from "../src/content/insights.ts";
const state = JSON.parse(await fs.readFile(".cuac-local/runtime.json", "utf8"));
assertLocalDevelopmentState(state);
const origin = `http://127.0.0.1:${state.applicationPort}`;
const manifest = JSON.parse(await fs.readFile("config/public-release-assets.json", "utf8"));
const htmlFiles = manifest.files.filter(file => file.endsWith(".html"));
const data = {};
for (const resource of ["programs", "schools", "scholarships", "cities", "guides"]) data[resource] = (await (await fetch(`${origin}/api/v1/catalog/${resource}?limit=100`)).json()).data;
const detailQueries = { "program-detail.html": `program=${data.programs[0].id}`, "university-detail.html": `university=${data.schools[0].id}`, "scholarship-detail.html": `scholarship=${data.scholarships[0].id}`, "city-detail.html": `city=${data.cities[0].slug}` };
const editorial = ["/guides/", ...data.guides.map(guide => `/guides/${guide.slug}`), "/insights/", ...listInsights().map(post => `/insights/${post.slug}`), ...insightCategories.map(category => `/insights/category/${category.slug}`)];
const locales = ["en", "vi", "th", "id", "ms", "ar"];
const pages = [];
for (const file of htmlFiles) {
  const source = await fs.readFile(`public/${file}`, "utf8");
  const translated = source.includes('data-i18n-locales="en,vi,th,id,ms,ar"');
  for (const locale of translated ? locales : ["en"]) pages.push({ path: `/${file}?${detailQueries[file] ? detailQueries[file] + "&" : ""}lang=${locale}`, locale, translated, template: file });
}
for (const path of editorial) for (const locale of locales) pages.push({ path: `${path}?lang=${locale}`, locale, translated: true, template: path });
const report = { date: new Date().toISOString(), scope: "All 28 released HTML templates plus every published local guide, insight, category and index; actual rendered links and dataset destinations. Authenticated workspaces separately exercised in UI and sign-in navigation suites.", expectedPages: pages.length, pages: [], links: [], failed: [], passed: false, deployed: false };
const links = new Map();
const { chromium, executablePath } = localAcceptanceBrowser();
const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const [index, entry] of pages.entries()) {
    const context = await browser.newContext({ locale: entry.locale === "en" ? "vi-VN" : "en-US", viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    const scriptErrors = [];
    page.on("pageerror", error => scriptErrors.push(error.message));
    try {
      const response = await page.goto(origin + entry.path, { waitUntil: "networkidle" });
      assert.equal(response.status(), 200);
      const actual = await page.evaluate(() => ({ lang: document.documentElement.lang, path: location.pathname, hrefs: [...document.querySelectorAll("a[href], [data-detail-href]")].map(node => node.href || (node.dataset.detailHref ? new URL(node.dataset.detailHref, document.baseURI).href : null)).filter(Boolean) }));
      assert.deepEqual(scriptErrors, []);
      if (entry.translated) assert.equal(actual.lang, entry.locale);
      const local = [];
      for (const href of actual.hrefs) {
        if (/^(?:#|mailto:|tel:|javascript:)/i.test(href)) continue;
        const target = new URL(href, page.url());
        if (target.origin !== origin) continue;
        target.hash = "";
        const path = target.pathname + target.search;
        if (!links.has(path)) links.set(path, new Set());
        links.get(path).add(entry.path);
        local.push(path);
      }
      report.pages.push({ ...entry, finalPath: actual.path, finalLocale: actual.lang, localLinks: local.length, passed: true });
    } catch (error) { report.failed.push({ path: entry.path, error: error.message }); }
    await context.close();
    if ((index + 1) % 25 === 0) console.log(`Rendered site inventory: ${index + 1}/${pages.length}`);
  }
  const targets = [...links];
  for (let start = 0; start < targets.length; start += 8) {
    await Promise.all(targets.slice(start, start + 8).map(async ([path, sources]) => {
      const chain = [];
      let current = new URL(path, origin);
      let status;
      let error;
      const visited = new Set();
      try {
        for (let depth = 0; depth < 7; depth++) {
          assert.ok(!visited.has(current.href), "Redirect loop");
          visited.add(current.href);
          const response = await fetch(current, { redirect: "manual" });
          status = response.status;
          const location = response.headers.get("location");
          chain.push({ path: current.pathname + current.search, status, location });
          if (![301, 302, 303, 307, 308].includes(status)) break;
          assert.ok(location, "Redirect missing Location");
          current = new URL(location, current);
          assert.equal(current.origin, origin, "Unexpected external redirect");
        }
        assert.ok(status >= 200 && status < 300, `Final HTTP ${status}`);
        const initial = new URL(path, origin);
        for (const key of new Set(initial.searchParams.keys())) {
          if (initial.pathname === "/guide-detail.html" && key === "guide") continue;
          assert.deepEqual(current.searchParams.getAll(key), initial.searchParams.getAll(key), `Redirect lost parameter ${key}`);
        }
      } catch (failure) { error = failure.message; report.failed.push({ path, error }); }
      report.links.push({ path, sourceCount: sources.size, sources: [...sources], chain, finalPath: current.pathname + current.search, passed: !error, ...(error ? { error } : {}) });
    }));
  }
  report.passed = report.pages.length === pages.length && report.failed.length === 0;
  assert.equal(report.passed, true, "Full-site rendered link inventory failed; inspect evidence");
} finally {
  await browser.close();
  await fs.writeFile("output/feedback-20261112/site-link-inventory-e2e.json", JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ passed: report.passed, pages: report.pages.length, links: report.links.length, failed: report.failed.length }));
