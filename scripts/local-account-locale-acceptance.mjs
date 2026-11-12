import fs from "node:fs/promises";
import assert from "node:assert/strict";
import pg from "pg";
import { assertLocalDevelopmentState, localDatabaseUrl } from "./lib/local-development.ts";
import { localAcceptanceBrowser } from "./lib/local-browser-acceptance.mjs";
const state = JSON.parse(await fs.readFile(".cuac-local/runtime.json", "utf8"));
assertLocalDevelopmentState(state);
const origin = `http://127.0.0.1:${state.applicationPort}`;
const previous = JSON.parse(await fs.readFile("output/feedback-20261112/application-ui-e2e.json", "utf8"));
const pool = new pg.Pool({ connectionString: localDatabaseUrl(state), ssl: false });
const { rows } = await pool.query("select u.id,u.email from users u join application_sets a on a.user_id = u.id where a.id = $1", [previous.flows[0].applicationSetId]);

assert.match(rows[0].email, /^ui-[a-z]+-[a-f0-9-]+@local\.cuac\.invalid$/);
const { chromium, executablePath } = localAcceptanceBrowser();
const browser = await chromium.launch({ headless: true, executablePath });
const report = { accountLocale: [], disabledLegacy: [], rejection: [], completed: false, passed: false };
const auditCount = async () => Number((await pool.query("select count(*) from audit_logs where actor_user_id=$1 and action='auth.account_locale.updated'", [rows[0].id])).rows[0].count);
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${origin}/auth.html?lang=vi`);
  await page.locator("[data-auth-email]").fill(rows[0].email);
  await page.locator("[data-auth-password]").fill(state.studentPassword);
  await page.locator("[data-auth-submit]").click();
  await page.waitForURL(url => !url.pathname.endsWith("auth.html"));
  await page.goto(`${origin}/preferences-api.html?lang=vi`);
  await page.evaluate(() => window.CUAC.authReady());
  for (const locale of ["th", "id", "ms", "ar", "en", "vi"]) {
    const beforeLocale = (await pool.query("select locale from users where id=$1", [rows[0].id])).rows[0].locale;
    const beforeAudit = await auditCount();
    const responsePromise = page.waitForResponse(response => response.url().endsWith("/api/v1/me") && response.request().method() === "PATCH", { timeout: 10000 }).catch(() => null);
    await page.locator(".language-selector-trigger").click();
    await page.locator(`.language-selector-option[data-locale="${locale}"]`).click();
    const response = await responsePromise;
    const update = response ? { status: response.status() } : null;
    assert.equal(update?.status, 200, JSON.stringify(update));
    const navigated = await page.waitForURL(url => url.searchParams.get("lang") === locale, { timeout: 10000 }).then(() => true).catch(() => false);
    if (!navigated) { report.accountLocale.push({ locale, update, navigated, passed: false, actualLocale: await page.evaluate(() => document.documentElement.lang) }); continue; }
    await page.waitForFunction(locale => document.documentElement.lang === locale, locale);
    const saved = await page.evaluate(async () => (await (await fetch("/api/v1/me")).json()).data.accountLocale);
    await page.reload();
    await page.waitForFunction(locale => document.documentElement.lang === locale, locale);
    const databaseLocale = (await pool.query("select locale from users where id=$1", [rows[0].id])).rows[0].locale;
    const auditDelta = await auditCount() - beforeAudit;
    assert.equal(auditDelta, beforeLocale === locale ? 0 : 1);
    const audit = (await pool.query("select resource_id,metadata_json from audit_logs where actor_user_id=$1 and action='auth.account_locale.updated' order by created_at desc limit 1", [rows[0].id])).rows[0];
    if (beforeLocale !== locale) { assert.equal(audit.resource_id, rows[0].id); assert.equal(audit.metadata_json.locale, locale); }
    report.accountLocale.push({ locale, saved, databaseLocale, auditDelta, afterReload: await page.evaluate(() => document.documentElement.lang), passed: saved === locale && databaseLocale === locale });
  }
  const beforeAudit = await auditCount();
  for (const [locale, expected] of [["vi", 200], ["unsupported", 400]]) {
    const result = await page.evaluate(async locale => {
      const response = await fetch('/api/v1/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale }) });
      return { status: response.status, body: await response.json() };
    }, locale);
    assert.equal(result.status, expected);
    report.rejection.push({ case: locale === "vi" ? "unchanged preference" : "invalid preference", status: result.status, passed: true });
  }
  assert.equal(await auditCount(), beforeAudit, "No-op and invalid requests must not write audit records");
  const anonymous = await browser.newContext();
  const unauthorized = await anonymous.request.patch(`${origin}/api/v1/me`, { data: { locale: "th" }, headers: { Origin: origin } });
  assert.ok([401, 403].includes(unauthorized.status()));
  report.rejection.push({ case: "unauthenticated", status: unauthorized.status(), passed: true });
  await anonymous.close();
  assert.equal((await pool.query("select locale from users where id=$1", [rows[0].id])).rows[0].locale, "vi");
  assert.equal(await auditCount(), beforeAudit);
  await context.close();
  for (const locale of ["vi", "th", "id", "ms", "ar"]) for (const [route, action] of [["universities", "open-choice-modal"], ["cities", "save-program-shortlist"]]) {
    const page = await browser.newPage({ locale: "en-US" });
    await page.goto(`${origin}/${route}.html?lang=${locale}`);
    await page.locator(route === "universities" ? "[data-university-card]" : "[data-city-card]").first().waitFor({ state: "attached" });
    await page.evaluate(action => document.dispatchEvent(new CustomEvent("cuac:agent-action", { cancelable: true, detail: { action } })), action);
    await page.waitForURL(url => url.pathname === (route === "universities" ? "/application.html" : "/programs.html"));
    const target = new URL(page.url());
    report.disabledLegacy.push({ locale, route, action, targetPath: target.pathname, targetLocale: target.searchParams.get("lang"), activeFeature: false, passed: target.searchParams.get("lang") === locale });
    await page.close();
  }
  report.completed = true;
  report.passed = report.accountLocale.length === 6 && report.disabledLegacy.length === 10 && [...report.accountLocale, ...report.disabledLegacy, ...report.rejection].every(check => check.passed);
  assert.equal(report.passed, true);
} finally {
  await browser.close();
  await pool.end();
  await fs.writeFile("output/feedback-20261112/account-legacy-recheck.json", JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report));
