import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { assertLocalDevelopmentState, localDatabaseUrl } from "./lib/local-development.ts";
import { localAcceptanceBrowser } from "./lib/local-browser-acceptance.mjs";

const state = JSON.parse(await fs.readFile(".cuac-local/runtime.json", "utf8"));
assertLocalDevelopmentState(state);
const origin = `http://127.0.0.1:${state.applicationPort}`;
const output = "output/feedback-20261112";
await fs.mkdir(output, { recursive: true });
const locales = process.argv.slice(2).length ? process.argv.slice(2) : ["vi", "th", "id", "ms", "ar"];
const report = { scope: "Fresh local synthetic accounts; setup verifies email in owned local DB; application creation, choice, profile, education and submission exclusively through UI", flows: [], passed: false };
const pool = new pg.Pool({ connectionString: localDatabaseUrl(state), ssl: false });
const { chromium, executablePath } = localAcceptanceBrowser();
const browser = await chromium.launch({ headless: true, executablePath });
let activePage;
try {
  for (const locale of locales) {
    const email = `ui-${locale}-${randomUUID()}@local.cuac.invalid`;
    const password = state.studentPassword;
    const setup = await browser.newContext();
    const registration = await setup.request.post(`${origin}/api/v1/auth/register`, {
      headers: { origin }, data: { email, password, displayName: "Local UI Regression", ageBand: "14_or_older", uiLocale: locale },
    });
    assert.equal(registration.status(), 201, `Local fixture registration: ${await registration.text()}`);
    assert.match(email, /^ui-[a-z]+-[a-f0-9-]+@local\.cuac\.invalid$/);
    const verified = await pool.query("update users set email_verified_at = now() where email = $1 returning id", [email]);
    assert.equal(verified.rowCount, 1);
    await setup.close();
    const context = await browser.newContext({ viewport: { width: locale === "ar" ? 375 : 1280, height: 900 } });
    const page = await context.newPage();
    activePage = page;
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const checks = [];
    const clickAndResponse = async (selector, url, method) => {
      const [response] = await Promise.all([
        page.waitForResponse(response => response.url().includes(url) && response.request().method() === method),
        page.locator(selector).filter({ visible: true }).first().click(),
      ]);
      assert.ok(response.ok(), `${locale}: ${url}: ${await response.text()}`);
      return (await response.json()).data;
    };
    await page.goto(`${origin}/auth.html?lang=${locale}`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-auth-email]").fill(email);
    await page.locator("[data-auth-password]").fill(password);
    await clickAndResponse("[data-auth-submit]", "/api/v1/auth/sessions", "POST");
    await page.waitForURL(url => !url.pathname.endsWith("auth.html"));
    checks.push("Login through form");
    await page.goto(`${origin}/application.html?lang=${locale}#choices`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof applicationRuntimeState !== "undefined" && applicationRuntimeState === "ready");
    const setsBefore = await page.evaluate(async () => {
      const response = await fetch("/api/v1/student/application-sets");
      return { status: response.status, body: await response.json() };
    });
    assert.equal(setsBefore.status, 200, JSON.stringify(setsBefore.body));
    assert.deepEqual(setsBefore.body.data, []);
    await page.locator("[data-open-choice-modal]").click();
    await page.waitForFunction(() => document.querySelector("[data-intake-select]")?.options[0]?.value);
    await page.locator("[data-choice-note]").fill("Local UI regression only; synthetic student");
    const choice = await clickAndResponse('[data-choice-form] button[type="submit"]', "/choices", "POST");
    assert.ok(choice.id || choice.applicationSetId);
    await page.locator("[data-choice-id]").first().waitFor();
    const setId = await page.evaluate(() => currentApplicationSet.id);
    checks.push("First draft and choice created by add-choice form (no setup API writes)");
    await clickAndResponse("[data-confirm-choice]", "/choice-order", "PUT");
    checks.push("Choice order saved through UI");
    await page.locator('[data-profile-section-target="applicant"]').filter({ visible: true }).first().click();
    const applicant = page.locator("[data-applicant-profile-form]");
    await applicant.locator('[name="fullName"]').fill("Local UI Regression");
    await applicant.locator('[name="contactEmail"]').fill(email);
    await applicant.locator('[name="citizenshipCountry"]').selectOption("MY");
    await clickAndResponse('[data-save-profile-section]', "/applicant-profile", "PATCH");
    checks.push("Applicant profile filled and saved through UI");
    await page.locator('[data-profile-section-target="education"]').filter({ visible: true }).first().click();
    const education = page.locator("[data-education-record-form]");
    await education.locator('[name="institutionName"]').fill("Local Synthetic Academy");
    await education.locator('[name="institutionCountry"]').fill("MY");
    await education.locator('[name="educationLevel"]').selectOption("bachelor");
    await education.locator('[name="attendanceStatus"]').selectOption("completed");
    await education.locator('[name="startYear"]').fill("2020");
    await education.locator('[name="endYear"]').fill("2024");
    await clickAndResponse("[data-save-education-record]", "/education-records", "POST");
    checks.push("Education record filled and saved through UI");
    await page.locator('[data-profile-overview-back]').filter({ visible: true }).first().click();
    await page.locator("[data-confirm-student-info]").click();
    await page.locator('[data-submission-confirmation-form] input[name="password"]').waitFor({ state: "visible" });
    await page.locator('[data-submission-confirmation-form] input[name="password"]').fill(password);
    const receipt = await clickAndResponse("[data-submit-application]", "/school-handoff", "POST");
    assert.equal(receipt.status, "accepted");
    assert.equal(receipt.materialsShared, false);
    assert.equal(receipt.paymentRequired, false);
    await page.locator("[data-sent-tracker]").waitFor({ state: "visible" });
    checks.push("UI password step-up and school-contact handoff accepted");
    await page.reload();
    await page.locator("[data-sent-tracker]").waitFor({ state: "visible" });
    const persisted = await page.evaluate(async id => (await (await fetch(`/api/v1/student/application-sets/${id}`)).json()).data, setId);
    assert.equal(persisted.status, "submitted");
    assert.equal(persisted.choices.length, 1);
    assert.deepEqual(errors, []);
    checks.push("Reload preserves submitted choice and no page errors");
    await page.screenshot({ path: `${output}/application-ui-${locale}.png` });
    for (const route of ["hub-api.html", "favourites-api.html", "preferences-api.html", "onboarding-api.html", "notifications.html"]) {
      await page.goto(`${origin}/${route}?lang=${locale}`, { waitUntil: "networkidle" });
      assert.equal(new URL(page.url()).pathname, `/${route}`);
      assert.equal(await page.evaluate(() => document.documentElement.lang), locale);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${locale}/${route}: signed-in overflow`);
      assert.deepEqual(errors, []);
      checks.push(`Authenticated ${route} opens in selected language`);
    }
    report.flows.push({ locale, applicationSetId: setId, checks, passed: true });
    console.log(`${locale}: ${checks.length} full UI checks passed`);
    await context.close();
  }
  report.passed = true;
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: `${output}/application-ui-failure.png`, fullPage: true });
    console.log(await activePage.evaluate(() => ({ url: location.href, state: typeof applicationRuntimeState !== "undefined" ? applicationRuntimeState : "unknown", notice: document.querySelector("[data-application-runtime]")?.textContent, selects: [...document.querySelectorAll(".choice-form select")].map(select => ({ name: select.name, value: select.value, options: [...select.options].map(option => ({ value: option.value, text: option.textContent })) })) })));
  }
  throw error;
} finally {
  await pool.end();
  await browser.close();
  await fs.writeFile(`${output}/application-ui-e2e.json`, JSON.stringify(report, null, 2));
}
