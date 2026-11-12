import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import ts from "typescript";
import { localAcceptanceBrowser } from "./lib/local-browser-acceptance.mjs";
import { assertLocalDevelopmentState } from "./lib/local-development.ts";

const state = JSON.parse(await fs.readFile(".cuac-local/runtime.json", "utf8"));
assertLocalDevelopmentState(state);
const origin = `http://127.0.0.1:${state.applicationPort}`;
const directory = "output/feedback-20261112";
const report = { startedAt: new Date().toISOString(), scope: "Read-only independent recheck; current local managed build; no product changes or deployment", navigation: [], englishPreference: [], stateCopy: [], accessibility: [], reveal: [], framing: null, sourceHashes: {}, completed: false };
for (const path of ["public/programs.js", "public/universities.js", "public/scholarships.js", "public/cities.js", "public/home-i18n.js", "public/about-i18n.js", "public/catalog-list-i18n.js", "public/shared-shell.js"]) {
  report.sourceHashes[path] = createHash("sha256").update(await fs.readFile(path)).digest("hex");
}
const { chromium, executablePath } = localAcceptanceBrowser();
const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const locale of ["en", "vi", "th", "id", "ms", "ar"]) {
    const context = await browser.newContext({ locale: locale === "en" ? "vi-VN" : "en-US", viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
    for (const [route, selector] of [["programs", "[data-program-card]"], ["universities", "[data-university-card]"], ["scholarships", "[data-scholarship-card]"], ["cities", "[data-city-card]"]]) {
      for (const action of ["click", "Enter", "Space"]) {
        const page = await context.newPage();
        try {
          await page.goto(`${origin}/${route}.html?lang=${locale}`, { waitUntil: "domcontentloaded" });
          const card = page.locator(selector).first();
          await card.waitFor({ state: "attached" });
          await card.scrollIntoViewIfNeeded();
          const generatedHref = await card.getAttribute("data-detail-href");
          const go = page.waitForURL(url => url.pathname.endsWith("-detail.html"));
          if (action === "click") {
            const box = await card.boundingBox();
            await card.click({ position: { x: 6, y: box.height - 6 } });
          } else { await card.focus(); await page.keyboard.press(action); }
          await go;
          await page.waitForLoadState("domcontentloaded");
          const actualLocale = await page.evaluate(() => window.CUACI18n?.locale);
          const finalLang = new URL(page.url()).searchParams.get("lang");
          const passed = actualLocale === locale && finalLang === locale;
          report.navigation.push({ locale, route, action, generatedHref, actualLocale, finalLang, passed });
        } finally { await page.close(); }
      }
    }
    console.log(`Card navigation checked: ${locale}`);
    if (locale !== "en") {
      const page = await context.newPage();
      await page.goto(`${origin}/scholarships.html?lang=${locale}`, { waitUntil: "domcontentloaded" });
      await page.locator("[data-scholarship-card]").first().waitFor({ state: "attached" });
      const labels = await page.locator("[data-scholarship-card]").first().evaluate(card => ({ label: card.getAttribute("aria-label"), cover: card.querySelector("img")?.alt }));
      report.accessibility.push({ locale, ...labels, passed: !/^View .+ funding details$/.test(labels.label) && !/ cover$/.test(labels.cover) });
      for (const state of ["loading", "empty", "error"]) {
        const text = await page.evaluate(state => {
          const target = document.createElement("div");
          document.body.append(target);
          window.CuacCatalogList.listState(target, state, { noun: "scholarships" });
          const text = target.textContent;
          target.remove();
          return text;
        }, state);
        report.stateCopy.push({ locale, state, text, passed: !/\bscholarships\b/.test(text) });
      }
      await page.close();
    }
    await context.close();
  }
  const nativeVietnamese = await browser.newContext({ locale: "vi-VN" });
  for (const [route, selector] of [["home-v3.html", "[data-home-categories] a"], ["about.html", '.about-actions a[href*="programs"]'], ["search.html?q=master", ".search-result-card"]]) {
    const page = await nativeVietnamese.newPage();
    await page.goto(`${origin}/${route}${route.includes("?") ? "&" : "?"}lang=en`, { waitUntil: "domcontentloaded" });
    if (route === "home-v3.html") await page.waitForFunction(() => document.querySelector("main").dataset.homeSummaryReady === "true");
    const link = page.locator(selector).first();
    await link.waitFor();
    const href = await link.getAttribute("href");
    await link.click();
    await page.waitForLoadState("domcontentloaded");
    const actualLocale = await page.evaluate(() => window.CUACI18n?.locale);
    report.englishPreference.push({ route, href, actualLocale, finalUrl: page.url(), passed: actualLocale === "en" });
    await page.close();
  }
  await nativeVietnamese.close();
  const shell = await fs.readFile("public/shared-shell.js", "utf8");
  const syntax = ts.createSourceFile("shared-shell.js", shell, ts.ScriptTarget.Latest, true);
  let revealFunction;
  function find(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === "initPageReveal") revealFunction = node.getText(syntax); ts.forEachChild(node, find); }
  find(syntax);
  assert.ok(revealFunction);
  const css = await fs.readFile("public/shared-shell.css", "utf8");
  for (const height of [667, 812]) for (const blockHeight of [5594, 5744, 6943, 18121]) {
    const page = await browser.newPage({ viewport: { width: 375, height }, reducedMotion: "reduce" });
    await page.setContent(`<style>${css}body{margin:0}.spacer{height:1200px}</style><div class="spacer"></div><section class="reveal" style="height:${blockHeight}px">Original-height list boundary</section>`);
    await page.evaluate(`(() => { ${revealFunction}; initPageReveal(); })()`);
    await page.evaluate(() => scrollTo(0, 1100));
    await page.waitForFunction(() => document.querySelector(".reveal").classList.contains("visible"));
    report.reveal.push({ height, blockHeight, passed: true });
    await page.close();
  }
  const parent = await browser.newPage();
  const messages = [];
  parent.on("console", message => messages.push(message.text()));
  await parent.route("**/__independent-frame-review.html", route => route.fulfill({ contentType: "text/html", body: `<html><body><iframe src="${origin}/programs.html?lang=vi"></iframe></body></html>` }));
  await parent.goto(`${origin}/__independent-frame-review.html`);
  await parent.waitForFunction(() => document.querySelector("iframe").contentDocument === null);
  const frameUrls = parent.frames().map(frame => frame.url());
  report.framing = { parentHasCsp: false, messages, frameUrls, passed: messages.some(message => /frame-ancestors|X-Frame-Options/i.test(message)) && !frameUrls.some(url => url.includes("/programs.html")) };
  assert.equal(report.framing.passed, true);
  await parent.close();
  report.completed = true;
  report.passed = [report.navigation, report.englishPreference, report.stateCopy, report.accessibility, report.reveal].every(checks => checks.length > 0 && checks.every(check => check.passed)) && report.framing.passed;
  assert.equal(report.passed, true, "A recorded completeness check failed; inspect evidence");
} finally {
  await browser.close();
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(`${directory}/independent-recheck-evidence.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ navigation: report.navigation.length, navigationFailed: report.navigation.filter(check => !check.passed).length, englishPreference: report.englishPreference, stateCopyFailed: report.stateCopy.filter(check => !check.passed).length, accessibilityFailed: report.accessibility.filter(check => !check.passed).length, reveal: report.reveal.length, iframePassed: report.framing?.passed }));
