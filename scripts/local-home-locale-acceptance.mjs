import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { localAcceptanceBrowser } from "./lib/local-browser-acceptance.mjs";
import { assertLocalDevelopmentState } from "./lib/local-development.ts";

const state = JSON.parse(await fs.readFile(".cuac-local/runtime.json", "utf8"));
assertLocalDevelopmentState(state);
const origin = `http://127.0.0.1:${state.applicationPort}`;
const output = "output/feedback-20261112";
await fs.mkdir(output, { recursive: true });
const locales = ["en", "vi", "th", "id", "ms", "ar"];
const report = { scope: "BUG-23 footer navigation and BUG-24 homepage parity; real local catalog", pages: [], fallback: [], interactions: [], passed: false };
const { chromium, executablePath } = localAcceptanceBrowser();
const browser = await chromium.launch({ headless: true, executablePath });
try {
  const context = await browser.newContext();
  for (const width of [375, 1280]) {
    let baseline;
    for (const locale of locales) {
      for (const path of ["/home-v3.html", "/programs.html", "/insights/"]) {
        const page = await context.newPage();
        await page.setViewportSize({ width, height: 900 });
        const errors = [];
        const catalog = [];
        page.on("pageerror", error => errors.push(error.message));
        page.on("response", response => {
          if (response.url().includes("/api/v1/catalog/")) catalog.push({ url: new URL(response.url()).pathname, status: response.status() });
        });
        const response = await page.goto(`${origin}${path}?lang=${locale}`, { waitUntil: "domcontentloaded" });
        assert.equal(response.status(), 200);
        await page.locator(".footer-col").first().waitFor();
        if (path === "/home-v3.html") await page.waitForFunction(() => document.querySelector("main").dataset.homeSummaryReady === "true");
        const snapshot = await page.evaluate(() => {
          const normalize = href => { const url = new URL(href, location.href); url.searchParams.delete("lang"); return url.pathname + url.search + url.hash; };
          const main = document.querySelector("main");
          const brandColumn = document.querySelector(".footer-grid > div");
          const logo = brandColumn.querySelector(".brand img").getBoundingClientRect();
          const column = brandColumn.getBoundingClientRect();
          return {
            logoAlignmentError: Math.abs(document.documentElement.dir === "rtl" ? logo.right - column.right : logo.left - column.left),
            lang: document.documentElement.lang,
            dir: document.documentElement.dir,
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            // Compare the actual rendered element tree, classes, images and destinations.
            structure: [...main.querySelectorAll("*")].filter(node => !node.closest(".footer")).map(node => ({
              tag: node.tagName, classes: [...node.classList].filter(value => value !== "visible").join(" "),
              href: node.matches("a[href]") ? normalize(node.href) : null,
              image: node.matches("img") ? node.getAttribute("src") : null,
            })),
            sections: main.querySelectorAll(":scope > section").length,
            images: main.querySelectorAll("img").length,
            categories: main.querySelectorAll("[data-home-categories] .cat").length,
            footer: [...document.querySelectorAll(".footer-col")].map(column => [...column.querySelectorAll("a")].map(link => normalize(link.href))),
            badLocaleLinks: [...main.querySelectorAll("a[href]")].filter(link => {
              const url = new URL(link.href);
              return !link.closest(".footer-legal") && url.origin === location.origin && /\.html$|^\/guides(?:\/|$)|^\/insights(?:\/|$)/.test(url.pathname)
                && !(document.documentElement.lang === "en" ? [null, "en"] : [document.documentElement.lang]).includes(url.searchParams.get("lang"));
            }).map(link => link.getAttribute("href")),
          };
        });
        assert.equal(snapshot.lang, locale);
        assert.equal(snapshot.dir, locale === "ar" ? "rtl" : "ltr");
        assert.equal(snapshot.overflow, false, `${locale}:${width}:${path}: horizontal overflow`);
        assert.ok(snapshot.logoAlignmentError <= 1, `${locale}:${width}:${path}: footer logo alignment`);
        assert.deepEqual(errors, [], `${locale}:${path}: browser errors`);
        assert.deepEqual(snapshot.footer.map(links => links.length), [4, 4, 4]);
        if (path === "/home-v3.html") {
          assert.equal(catalog.length, 5, `${locale}: five homepage catalog requests`);
          assert.ok(catalog.every(response => response.status === 200), JSON.stringify(catalog));
          assert.equal(snapshot.categories, 7);
          assert.deepEqual(snapshot.badLocaleLinks, [], `${locale}: homepage links retain language`);
          if (locale === "en") baseline = snapshot;
          else {
            assert.equal(snapshot.sections, baseline.sections);
            assert.equal(snapshot.images, baseline.images);
            assert.deepEqual(snapshot.structure, baseline.structure, `${locale}:${width}: shared home structure`);
          }
          for (const section of await page.locator("main > section").all()) {
            await section.scrollIntoViewIfNeeded();
            await page.waitForFunction(element => element.classList.contains("visible"), await section.elementHandle());
          }
          if (["vi", "ar"].includes(locale)) {
            await page.evaluate(() => scrollTo(0, 0));
            await page.waitForTimeout(650); // Allow reveal transitions to finish for visual review.
            await page.screenshot({ path: `${output}/home-${locale}-${width}.png`, fullPage: true });
            await page.screenshot({ path: `${output}/home-top-${locale}-${width}.png` });
            await page.locator(".footer").screenshot({ path: `${output}/footer-${locale}-${width}.png` });
          }
        }
        if (locale === "en") assert.deepEqual(snapshot.footer.map(links => links.length), [4, 4, 4]);
        else assert.deepEqual(snapshot.footer, baseline.footer, `${locale}:${path}: same footer destinations`);
        report.pages.push({ path, locale, width, sections: snapshot.sections, images: snapshot.images, footerLinks: snapshot.footer.flat().length, catalogRequests: catalog.length });
        await page.close();
      }
    }
  }
  // Exercise the user's exact trigger: change language using the header selector.
  for (const width of [375, 1280]) {
    const page = await context.newPage();
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${origin}/home-v3.html?lang=en`, { waitUntil: "domcontentloaded" });
    for (const locale of [...locales.slice(1), "en"]) {
      await page.locator(".language-selector-trigger").click();
      await page.locator(`.language-selector-option[data-locale="${locale}"]`).click();
      await page.waitForURL(url => url.searchParams.get("lang") === locale);
      await page.waitForFunction(language => document.documentElement.lang === language && document.querySelector("main")?.dataset.homeSummaryReady === "true", locale);
      assert.equal(await page.locator("main > section").count(), 13);
      assert.equal(await page.locator("[data-home-categories] .cat").count(), 7);
      assert.equal(await page.locator(".footer-col a").count(), 12);
      report.interactions.push({ locale, width, action: "header language switch retains homepage and footer", passed: true });
    }
    await page.close();
  }
  // Failed catalog requests must retain the full translated fallback page too.
  let fallbackBaseline;
  for (const locale of locales) {
    const page = await context.newPage();
    await page.setViewportSize({ width: 375, height: 900 });
    await page.route("**/api/v1/catalog/**", route => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"local acceptance simulated outage"}' }));
    await page.goto(`${origin}/home-v3.html?lang=${locale}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("main").dataset.homeSummaryReady === "true");
    const tree = await page.locator("main").evaluate(main => [...main.querySelectorAll("*")].map(node => node.tagName + "." + [...node.classList].filter(value => value !== "visible").join(".")));
    if (locale === "en") fallbackBaseline = tree;
    else assert.deepEqual(tree, fallbackBaseline, `${locale}: complete fallback structure`);
    assert.equal(await page.locator("[data-home-categories] .cat").count(), 7);
    assert.equal(await page.locator(".footer-col a").count(), 12);
    report.fallback.push({ locale, passed: true });
    await page.close();
  }
  for (const locale of locales) {
    const page = await context.newPage();
    await page.goto(`${origin}/home-v3.html?lang=${locale}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("main").dataset.homeSummaryReady === "true");
    await page.locator('.footer-col a[href*="/guides/documents"]').click();
    await page.waitForURL(url => url.pathname === "/guides/documents");
    assert.ok((locale === "en" ? [null, "en"] : [locale]).includes(new URL(page.url()).searchParams.get("lang")));
    await page.waitForFunction(language => document.documentElement.lang === language, locale);
    report.interactions.push({ locale, action: "footer documents navigation", passed: true });
    await page.goto(`${origin}/home-v3.html?lang=${locale}`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-search-chip="master"]').click();
    await page.locator('.site-search button[type="submit"]').click();
    await page.waitForURL(url => url.pathname === "/search.html");
    assert.equal(new URL(page.url()).searchParams.get("q"), "master");
    assert.ok((locale === "en" ? [null, "en"] : [locale]).includes(new URL(page.url()).searchParams.get("lang")));
    report.interactions.push({ locale, action: "homepage search", passed: true });
    await page.close();
  }
  report.passed = true;
} finally {
  await browser.close();
  await fs.writeFile(`${output}/home-locale-e2e.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ passed: report.passed, pages: report.pages.length, fallback: report.fallback.length, interactions: report.interactions.length, report: `${output}/home-locale-e2e.json` }));
