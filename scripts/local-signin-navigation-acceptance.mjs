import fs from "node:fs/promises";
import assert from "node:assert/strict";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { assertLocalDevelopmentState, localDatabaseUrl } from "./lib/local-development.ts";
import { localAcceptanceBrowser } from "./lib/local-browser-acceptance.mjs";
const state = JSON.parse(await fs.readFile(".cuac-local/runtime.json", "utf8"));
assertLocalDevelopmentState(state);
const origin = `http://127.0.0.1:${state.applicationPort}`;
let applicationSetId;
const pool = new pg.Pool({ connectionString: localDatabaseUrl(state), ssl: false });
let account;
const { chromium, executablePath } = localAcceptanceBrowser();
const browser = await chromium.launch({ headless: true, executablePath });
const report = { date: new Date().toISOString(), saveAfterLogin: [], existingSession: [], applicationReturn: [], passed: false, deployed: false };
async function login(page, locale) {
  await page.locator("[data-auth-email]").fill(account.email);
  await page.locator("[data-auth-password]").fill(state.studentPassword);
  const response = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/v1/auth/sessions");
  await page.locator("[data-auth-submit]").click();
  assert.equal((await response).status(), 200, "Synthetic account login must succeed without bypassing rate limiting");
  await page.waitForURL(url => !url.pathname.endsWith("auth.html"));
  await page.waitForFunction(locale => window.CUACI18n?.locale === locale, locale);
}
async function savedCount(page, type, entityId) {
  return page.evaluate(async ({ type, entityId }) => {
    const response = await fetch("/api/v1/student/saved-items");
    if (!response.ok) throw new Error(`Saved-items status ${response.status}`);
    return (await response.json()).data.filter(item => item.entityType === type && item.entityId === entityId).length;
  }, { type, entityId });
}
try {
  for (const locale of ["en", "vi", "th", "id", "ms", "ar"]) {
    account = { email: `nav-${locale}-${randomUUID()}@local.cuac.invalid` };
    assert.match(account.email, /^nav-[a-z]+-[a-f0-9-]+@local\.cuac\.invalid$/);
    applicationSetId = null;
    const setup = await browser.newContext();
    const registration = await setup.request.post(`${origin}/api/v1/auth/register`, { headers: { origin }, data: { email: account.email, password: state.studentPassword, displayName: "Local navigation regression", ageBand: "14_or_older", uiLocale: locale } });
    assert.equal(registration.status(), 201);
    assert.equal((await pool.query("update users set email_verified_at=now() where email=$1 returning id", [account.email])).rowCount, 1);
    await setup.close();
    for (const [route, type, card] of [["programs", "program", "program"], ["universities", "school", "university"], ["scholarships", "scholarship", "scholarship"]]) {
      const context = await browser.newContext({ locale: locale === "en" ? "vi-VN" : "en-US" });
      const page = await context.newPage();
      await page.goto(`${origin}/${route}.html?lang=${locale}`, { waitUntil: "networkidle" });
      const save = page.locator(`[data-${card}-card] [data-save]`).first();
      await save.waitFor({ state: "attached" });
      const entityId = await save.getAttribute("data-save");
      await save.scrollIntoViewIfNeeded();
      await save.click();
      await page.waitForURL(url => url.pathname === "/auth.html");
      assert.equal(new URL(page.url()).searchParams.get("continue"), "1", "Save must create an actual server continuation");
      await login(page, locale);
      await page.waitForURL(url => url.pathname === `/${route}.html` && url.searchParams.get("lang") === locale);
      assert.equal(await savedCount(page, type, entityId), 1);
      if (!applicationSetId) applicationSetId = await page.evaluate(async () => {
        const response = await fetch("/api/v1/student/application-sets", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ name: "Local navigation regression", targetIntake: null }) });
        if (!response.ok) throw new Error(`Draft preparation status ${response.status}`);
        return (await response.json()).data.id;
      });
      report.saveAfterLogin.push({ locale, route, entityId, exactSavedCount: 1, passed: true });
      await context.close();
    }
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${origin}/home-v3.html?lang=${locale}`, { waitUntil: "networkidle" });
    const capability = await page.evaluate(async () => {
      let response = await fetch("/api/v1/auth/guest-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!response.ok) throw new Error("Guest session failed");
      const list = (await (await fetch("/api/v1/catalog/programs?limit=1")).json()).data;
      response = await fetch("/api/v1/auth/sign-in-continuations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetRoute: "/programs.html", actionKey: "catalog.save_program", requiredRole: "student", payloadPreview: { programId: list[0].id } }) });
      if (!response.ok) throw new Error(`Continuation status ${response.status}`);
      const capability = (await response.json()).data;
      return { id: capability.continuationId, token: capability.continuationToken, entityId: list[0].id };
    });
    await page.goto(`${origin}/auth.html?lang=${locale}`);
    await login(page, locale);
    await page.goto(`${origin}/auth.html?lang=${locale}&continue=1#continuation=${capability.id}.${capability.token}`);
    await page.waitForURL(url => url.pathname === "/programs.html" && url.searchParams.get("lang") === locale);
    assert.equal(await savedCount(page, "program", capability.entityId), 1);
    assert.ok(!page.url().includes("object"));
    report.existingSession.push({ locale, savedCount: 1, completedSave: true, passed: true });
    await context.close();

    const privateContext = await browser.newContext({ locale: locale === "en" ? "vi-VN" : "en-US" });
    const privatePage = await privateContext.newPage();
    await privatePage.goto(`${origin}/hub/applications/${applicationSetId}?lang=${locale}#info`, { waitUntil: "networkidle" });
    await privatePage.locator("[data-cuac-sign-in-trigger]").first().click();
    await privatePage.waitForURL(url => url.pathname === "/auth.html");
    assert.equal(new URL(privatePage.url()).searchParams.get("continue"), "1");
    const loaded = privatePage.waitForResponse(response => response.request().method() === "GET" && new URL(response.url()).pathname === `/api/v1/student/application-sets/${applicationSetId}`);
    await login(privatePage, locale);
    await privatePage.waitForURL(url => url.pathname === "/application.html" && url.searchParams.get("applicationSet") === applicationSetId && url.searchParams.get("lang") === locale && url.hash === "#info");
    assert.equal((await loaded).status(), 200);
    report.applicationReturn.push({ locale, originalApplicationRetained: true, section: "info", authorizedDetailStatus: 200, passed: true });
    await privateContext.close();
    console.log(`Sign-in navigation checked: ${locale}`);
  }
  report.passed = report.saveAfterLogin.length === 18 && report.existingSession.length === 6 && report.applicationReturn.length === 6;
} finally {
  await browser.close();
  await pool.end();
  await fs.writeFile("output/feedback-20261112/signin-navigation-e2e.json", JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ passed: report.passed, saveAfterLogin: report.saveAfterLogin.length, existingSession: report.existingSession.length, applicationReturn: report.applicationReturn.length }));
