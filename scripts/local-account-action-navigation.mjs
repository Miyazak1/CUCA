import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { assertLocalDevelopmentState } from "./lib/local-development.ts";
import { localAcceptanceBrowser } from "./lib/local-browser-acceptance.mjs";
import { observeBrowserErrors } from "./lib/browser-error-acceptance.mjs";
const state = JSON.parse(await fs.readFile(".cuac-local/runtime.json", "utf8"));
assertLocalDevelopmentState(state);
const origin = `http://127.0.0.1:${state.applicationPort}`;
const { chromium, executablePath } = localAcceptanceBrowser();
const browser = await chromium.launch({ headless: true, executablePath });
const report = { date: new Date().toISOString(), pages: [], passed: false, deployed: false };
try {
  for (const route of ["verify-email", "reset-password", "school-invite"]) for (const locale of route === "school-invite" ? ["en"] : ["en", "vi", "th", "id", "ms", "ar"]) {
    const context = await browser.newContext({ locale: locale === "en" ? "vi-VN" : "en-US" });
    const page = await context.newPage();
    const monitor = await observeBrowserErrors(page);
    const response = await page.goto(`${origin}/auth/${route}?lang=${locale}`, { waitUntil: "networkidle" });
    const policy = response.headers()["content-security-policy"];
    const nonce = policy.match(/'nonce-([^']+)'/)?.[1];
    const result = { route, locale, status: response.status(), noncePresent: Boolean(nonce) };
    report.pages.push(result);
    assert.equal(response.status(), 200);
    assert.ok(nonce, "Account action SSR must hydrate under the real CSP");
    assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval/);
    const signIn = page.locator('main a[href*="auth.html"]').last();
    await signIn.waitFor({ state: "visible" });
    const heading = await page.locator("main").innerText();
    assert.ok(!heading.includes("Checking this secure"), "Invalid-token terminal state must load");
    result.browserErrors = await monitor.assertClean();
    const href = new URL(await signIn.getAttribute("href"), origin);
    if (route !== "school-invite") assert.equal(href.searchParams.get("lang"), locale);
    await signIn.click();
    await page.waitForURL(url => url.pathname === "/auth.html");
    if (route !== "school-invite") await page.waitForFunction(locale => window.CUACI18n?.locale === locale, locale);
    result.signInPath = new URL(page.url()).pathname;
    result.passed = true;
    await context.close();
  }
  report.passed = report.pages.length === 13 && report.pages.every(check => check.passed);
} finally {
  await browser.close();
  await fs.writeFile("output/feedback-20261112/account-action-navigation-e2e.json", JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ passed: report.passed, pages: report.pages.length }));
