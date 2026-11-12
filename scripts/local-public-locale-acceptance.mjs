import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { localAcceptanceBrowser } from "./lib/local-browser-acceptance.mjs";
import { assertLocalDevelopmentState } from "./lib/local-development.ts";
import { observeBrowserErrors } from "./lib/browser-error-acceptance.mjs";

const state = JSON.parse(await fs.readFile(".cuac-local/runtime.json", "utf8"));
assertLocalDevelopmentState(state);
const origin = `http://127.0.0.1:${state.applicationPort}`;
const output = "output/feedback-20261112";
const resources = {};
for (const resource of ["programs", "schools", "scholarships", "cities"]) {
  const response = await fetch(`${origin}/api/v1/catalog/${resource}?limit=1`);
  assert.equal(response.status, 200);
  resources[resource] = (await response.json()).data[0];
}
const routes = [
  "home-v3.html", "about.html", "programs.html", "universities.html", "scholarships.html", "cities.html", "search.html?q=scholarship",
  `program-detail.html?program=${resources.programs.id}`, `university-detail.html?university=${resources.schools.id}`,
  `scholarship-detail.html?scholarship=${resources.scholarships.id}`, `city-detail.html?city=${resources.cities.slug}`,
  "auth.html", "auth-guardian-consent.html", "hub-api.html", "application.html", "favourites-api.html", "preferences-api.html", "onboarding-api.html", "notifications.html",
];
const report = { scope: "All 19 public HTML templates declaring six locales; two real viewports; all five non-English locales. Signed-out private gates here; authenticated full UI flows in application-ui-e2e.json. Editorial pages in editorial-e2e.json. Reviewed English-only legal notices and Chinese staff surfaces are outside this locale contract.", pages: [], filters: [], navigation: [], failed: [], passed: false };
await fs.mkdir(output, { recursive: true });
const { chromium, executablePath } = localAcceptanceBrowser();
const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const locale of ["vi", "th", "id", "ms", "ar"]) {
    for (const width of [375, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 812 } });
      for (const path of routes) {
        const page = await context.newPage();
        const browserErrors = await observeBrowserErrors(page, { allowSignedOut: true });
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        try {
          const response = await page.goto(`${origin}/${path}${path.includes("?") ? "&" : "?"}lang=${locale}`, { waitUntil: "domcontentloaded" });
          assert.equal(response.status(), 200);
          if (["hub-api.html", "favourites-api.html", "preferences-api.html", "onboarding-api.html", "notifications.html"].includes(path)) {
            await page.waitForURL(url => url.pathname === "/auth.html");
            await page.waitForFunction(language => document.documentElement.lang === language && document.querySelector("[data-auth-submit]"), locale);
            assert.equal(new URL(page.url()).searchParams.get("lang"), locale);
          }
          const ready = path.startsWith("programs.") ? "[data-program-card]" : path.startsWith("universities.") ? "[data-university-card]" : path.startsWith("scholarships.") ? "[data-scholarship-card]" : path.startsWith("cities.") ? "[data-city-card]" : null;
          if (ready) await page.locator(ready).first().waitFor({ state: "attached" });
          if (path.includes("-detail.html")) await page.waitForFunction(() => document.querySelector("[data-catalog-detail-root] h1"));
          if (path.startsWith("home-v3")) await page.waitForFunction(() => document.querySelector("main").dataset.homeSummaryReady === "true");
          const snapshot = await page.evaluate(() => ({
            lang: document.documentElement.lang, dir: document.documentElement.dir,
            title: document.title, heading: document.querySelector("h1")?.textContent.trim(),
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            missingKeys: [...document.querySelectorAll("[data-catalog-copy], [data-search-copy]")].map(node => node.textContent.trim()).filter(value => /^(?:catalog|search)\.[a-zA-Z.]+$/.test(value)),
          }));
          assert.equal(snapshot.lang, locale);
          assert.equal(snapshot.dir, locale === "ar" ? "rtl" : "ltr");
          assert.equal(snapshot.overflow, false, "horizontal overflow");
          assert.ok(snapshot.heading);
          assert.deepEqual(snapshot.missingKeys, []);
          assert.deepEqual(errors, []);
          snapshot.browserErrors = await browserErrors.assertClean();
          if (path === "about.html") {
            const actual = await page.locator('.about-actions a[href*="/guides"], .about-actions a[href*="/insights"]').evaluateAll(links => links.map(link => ({ text: link.textContent, lang: new URL(link.href).searchParams.get("lang") })));
            assert.ok(actual.every(link => link.lang === locale && !/tiếng Anh|Read application|Read admissions/.test(link.text)));
            assert.notEqual(snapshot.heading, "One product, one clear purpose");
          }
          if (path === "programs.html" || path === "scholarships.html") {
            const filter = page.locator('[data-filter-key="degree"]').filter({ visible: true }).first();
            const value = await filter.evaluate(select => [...select.options].find(option => option.value && option.value !== "all").value);
            if (path === "programs.html") {
              const [response] = await Promise.all([
                page.waitForResponse(response => response.url().includes("/api/v1/catalog/programs?") && new URL(response.url()).searchParams.get("degree") === value),
                filter.selectOption(value),
              ]);
              assert.equal(response.status(), 200);
            } else await filter.selectOption(value);
            assert.equal(await filter.inputValue(), value);
            report.filters.push({ locale, width, page: path, filter: "degree", rawValue: value, passed: true });
            const input = page.locator(path === "programs.html" ? "#searchInput" : "#scholarshipSearchInput");
            await input.fill("NoSuchLocalRegression20261112");
            await input.press("Enter");
            await page.locator(".catalog-list-state-empty").waitFor();
            assert.notEqual(await page.locator("[data-catalog-reset]").first().textContent(), "Reset filters");
            await page.locator("[data-catalog-reset]").first().click();
            await page.locator(ready).first().waitFor({ state: "attached" });
            report.filters.push({ locale, width, page: path, filter: "real empty search and reset", passed: true });
          }
          if (path === "universities.html") {
            await page.locator('[data-filter="English routes"]').click();
            assert.equal(await page.locator('[data-filter="English routes"]').getAttribute("aria-pressed"), "true");
            report.filters.push({ locale, width, page: path, filter: "English routes", passed: true });
          }
          if (path === "cities.html") {
            const button = page.locator("[data-need]").first();
            const value = await button.getAttribute("data-need");
            await button.click();
            assert.ok(await button.evaluate(node => node.classList.contains("active")));
            assert.notEqual(await page.locator("[data-clear-city-filter=need]").textContent(), value);
            report.filters.push({ locale, width, page: path, filter: "need", rawValue: value, passed: true });
          }
          report.pages.push({ locale, width, path, ...snapshot, passed: true });
        } catch (error) {
          report.failed.push({ locale, width, path, error: error.message, errors });
          await page.screenshot({ path: `${output}/locale-failure-${locale}-${width}-${path.split("?")[0]}.png`, fullPage: true });
          console.log(`FAILED ${locale}/${width}/${path}: ${error.message.slice(0, 220)}`);
        } finally { await page.close(); }
      }
      await context.close();
      console.log(`Public locale templates: ${locale}/${width}`);
    }
  }
  for (const locale of ["vi", "th", "id", "ms", "ar"]) {
    const page = await browser.newPage();
    await page.goto(`${origin}/programs.html?lang=${locale}`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-program-card]").first().waitFor({ state: "attached" });
    await page.evaluate(() => document.dispatchEvent(new CustomEvent("cuac:agent-action", { cancelable: true, detail: { action: "open-choice-modal" } })));
    await page.waitForURL(url => url.pathname === "/application.html" && url.hash === "#add-choice");
    assert.equal(new URL(page.url()).searchParams.get("lang"), locale);
    report.navigation.push({ locale, case: "Disabled Agent legacy action contract; dispatched explicitly for regression, feature stays off", passed: true });
    await page.close();
  }
  assert.deepEqual(report.failed, []);
  report.passed = true;
} finally {
  await browser.close();
  await fs.writeFile(`${output}/public-locales-e2e.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ passed: report.passed, pages: report.pages.length, filters: report.filters.length, navigation: report.navigation.length, failures: report.failed.length }));
