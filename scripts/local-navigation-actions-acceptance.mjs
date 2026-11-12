import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { localAcceptanceBrowser } from "./lib/local-browser-acceptance.mjs";
import { assertLocalDevelopmentState, localDatabaseUrl } from "./lib/local-development.ts";
const state = JSON.parse(await fs.readFile(".cuac-local/runtime.json", "utf8"));
assertLocalDevelopmentState(state);
const origin = `http://127.0.0.1:${state.applicationPort}`;
const pool = new pg.Pool({ connectionString: localDatabaseUrl(state), ssl: false });
const program = (await (await fetch(`${origin}/api/v1/catalog/programs?applicationReady=true&limit=1`)).json()).data[0];
const { chromium, executablePath } = localAcceptanceBrowser();
const browser = await chromium.launch({ headless: true, executablePath });
const report = { date: new Date().toISOString(), legacy: [], detailToApplication: [], passed: false, deployed: false };
let activePage;
const rejected = [];
try {
  for (const locale of ["en", "vi", "th", "id", "ms", "ar"]) {
    for (const [route, action, destination, selector] of [["programs", "open-choice-modal", "/application.html", "program"], ["universities", "open-choice-modal", "/application.html", "university"], ["scholarships", "open-choice-modal", "/programs.html", "scholarship"], ["cities", "save-program-shortlist", "/programs.html", "city"]]) {
      const context = await browser.newContext({ locale: locale === "en" ? "vi-VN" : "en-US" });
      const page = await context.newPage();
      await page.goto(`${origin}/${route}.html?lang=${locale}`);
      await page.locator(`[data-${selector}-card]`).first().waitFor({ state: "attached" });
      await page.evaluate(action => document.dispatchEvent(new CustomEvent("cuac:agent-action", { cancelable: true, detail: { action } })), action);
      await page.waitForURL(url => url.pathname === destination && url.searchParams.get("lang") === locale);
      report.legacy.push({ locale, route, action, featureEnabled: false, finalUrl: page.url(), passed: true });
      await context.close();
    }
    const context = await browser.newContext({ locale: locale === "en" ? "vi-VN" : "en-US" });
    const email = `nav-launch-${locale}-${randomUUID()}@local.cuac.invalid`;
    assert.match(email, /^nav-launch-[a-z]+-[a-f0-9-]+@local\.cuac\.invalid$/);
    const setup = await browser.newContext();
    const registration = await setup.request.post(`${origin}/api/v1/auth/register`, { headers: { origin }, data: { email, password: state.studentPassword, displayName: "Local program launch regression", ageBand: "14_or_older", uiLocale: locale } });
    assert.equal(registration.status(), 201);
    assert.equal((await pool.query("update users set email_verified_at=now() where email=$1 returning id", [email])).rowCount, 1);
    await setup.close();
    const page = await context.newPage();
    activePage = page;
    page.on("response", response => { if (response.status() >= 400) rejected.push({ path: new URL(response.url()).pathname, status: response.status() }); });
    await page.goto(`${origin}/program-detail.html?program=${program.id}&lang=${locale}`);
    const link = page.locator('[data-catalog-detail-root] a[href*="application.html?programId="]').first();
    await link.waitFor();
    const expected = new URL(await link.getAttribute("href"), origin);
    await link.click();
    await page.waitForURL(url => url.pathname === "/auth.html");
    assert.equal(new URL(page.url()).searchParams.get("continue"), "1");
    await page.locator("[data-auth-email]").fill(email);
    await page.locator("[data-auth-password]").fill(state.studentPassword);
    await page.locator("[data-auth-submit]").click();
    await page.waitForURL(url => url.pathname === "/application.html" && url.searchParams.get("lang") === locale && url.searchParams.get("programId") === program.id && url.searchParams.get("intakeId") === expected.searchParams.get("intakeId") && ["#add-choice", "#choices"].includes(url.hash));
    await page.locator("[data-choice-form]").waitFor({ state: "visible" });
    await page.waitForFunction(({ programId, intakeId }) => document.querySelector('[data-choice-form] [name="program"]')?.value === programId && document.querySelector('[data-choice-form] [name="intake"]')?.value === intakeId, { programId: program.id, intakeId: expected.searchParams.get("intakeId") });
    report.detailToApplication.push({ locale, programId: program.id, intakeId: expected.searchParams.get("intakeId"), authenticatedReturn: true, selectedProgramAndIntakeMatch: true, passed: true });
    await context.close();
    console.log(`Direct actions and program launch checked: ${locale}`);
  }
  report.passed = report.legacy.length === 24 && report.detailToApplication.length === 6;
} catch (error) {
  report.failure = { message: error.message, path: activePage?.url().split("#")[0], rejected, snapshot: await activePage?.evaluate(() => ({ locale: document.documentElement.lang, signedIn: window.CUAC?.isStudentSignedIn?.(), status: document.querySelector("[data-auth-runtime-status]")?.textContent, links: [...document.querySelectorAll('a[href*="application.html"]')].map(link => link.href) })).catch(() => null) };
  throw error;
} finally {
  await browser.close();
  await pool.end();
  await fs.writeFile("output/feedback-20261112/navigation-actions-e2e.json", JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ passed: report.passed, legacy: report.legacy.length, detailToApplication: report.detailToApplication.length }));
