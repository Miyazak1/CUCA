import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { localAcceptanceBrowser } from "./lib/local-browser-acceptance.mjs";
import { assertLocalDevelopmentState } from "./lib/local-development.ts";
const state = JSON.parse(await fs.readFile(".cuac-local/runtime.json", "utf8"));
assertLocalDevelopmentState(state);
const origin = `http://127.0.0.1:${state.applicationPort}`;
const { chromium, executablePath } = localAcceptanceBrowser();
const browser = await chromium.launch({ headless: true, executablePath });
const report = { date: new Date().toISOString(), responses: [], logoNavigation: [], passed: false, deployed: false };
try {
  for (const locale of ["en", "vi", "th", "id", "ms", "ar"]) {
    const query = new URLSearchParams({ lang: locale, q: "học bổng & 100%" });
    query.append("tag", "a"); query.append("tag", "b");
    const response = await fetch(`${origin}/?${query}`, { redirect: "manual" });
    const location = response.headers.get("location");
    report.responses.push({ locale, status: response.status, location });
    assert.equal(response.status, 307);
    const target = new URL(location, origin);
    assert.equal(target.pathname, "/home-v3.html");
    assert.deepEqual([...target.searchParams], [...query]);
    for (const width of [375, 1280]) {
      const context = await browser.newContext({ locale: locale === "en" ? "vi-VN" : "en-US", viewport: { width, height: 812 } });
      const page = await context.newPage();
      await page.goto(`${origin}/about.html?lang=${locale}`, { waitUntil: "networkidle" });
      const logo = page.locator(".footer .brand").first();
      await logo.scrollIntoViewIfNeeded();
      const redirect = page.waitForResponse(response => new URL(response.url()).pathname === "/" && response.request().isNavigationRequest());
      await logo.click();
      const rootResponse = await redirect;
      await page.waitForURL(url => url.pathname === "/home-v3.html" && url.searchParams.get("lang") === locale);
      await page.waitForFunction(locale => window.CUACI18n?.locale === locale, locale);
      assert.equal(rootResponse.status(), 307);
      report.logoNavigation.push({ locale, width, rootStatus: rootResponse.status(), rootLocation: rootResponse.headers().location, finalUrl: page.url(), documentLocale: await page.evaluate(() => document.documentElement.lang), passed: true });
      await context.close();
    }
  }
  const response = await fetch(`${origin}/`, { redirect: "manual" });
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "/home-v3.html");
  report.responses.push({ case: "no query", status: response.status, location: response.headers.get("location") });
  report.passed = true;
} finally {
  await browser.close();
  await fs.writeFile("output/feedback-20261112/home-redirect-e2e.json", JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ passed: report.passed, responses: report.responses.length, logoNavigation: report.logoNavigation.length }));
