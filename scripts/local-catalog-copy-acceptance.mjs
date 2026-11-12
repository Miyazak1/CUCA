import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { localAcceptanceBrowser } from "./lib/local-browser-acceptance.mjs";
import { assertLocalDevelopmentState } from "./lib/local-development.ts";
import { observeBrowserErrors } from "./lib/browser-error-acceptance.mjs";
const state = JSON.parse(await fs.readFile(".cuac-local/runtime.json", "utf8"));
assertLocalDevelopmentState(state);
const origin = `http://127.0.0.1:${state.applicationPort}`;
const { chromium, executablePath } = localAcceptanceBrowser();
const browser = await chromium.launch({ headless: true, executablePath });
const report = { cards: [], states: [], passed: false };
try {
  for (const locale of ["en", "vi", "th", "id", "ms", "ar"]) for (const [route, type, noun] of [["programs", "program", "programs"], ["universities", "university", "universities"], ["scholarships", "scholarship", "scholarships"], ["cities", "city", "cities"]]) {
    const page = await browser.newPage();
    const monitor = await observeBrowserErrors(page);
    await page.goto(`${origin}/${route}.html?lang=${locale}`, { waitUntil: "networkidle" });
    const card = page.locator(`[data-${type}-card]`).first();
    await card.waitFor({ state: "attached" });
    const label = await card.getAttribute("aria-label");
    assert.ok(label && !label.includes("{name}"));
    if (locale !== "en") assert.ok(!/^View /.test(label));
    if (type === "scholarship" && locale !== "en") assert.ok(!/ cover$/.test(await card.locator("img").first().getAttribute("alt")));
    report.cards.push({ locale, route, label, browserErrors: await monitor.assertClean(), passed: true });
    for (const status of ["loading", "empty", "error"]) {
      const text = await page.evaluate(({ status, noun }) => {
        const target = document.createElement("div");
        window.CuacCatalogList.listState(target, status, { noun });
        return target.textContent;
      }, { status, noun });
      assert.ok(text);
      if (locale !== "en") assert.ok(!/\b(?:programs|universities|scholarships|cities|records)\b/.test(text), text);
      report.states.push({ locale, route, status, text, passed: true });
    }
    await page.close();
  }
  report.passed = true;
} finally {
  await browser.close();
  await fs.writeFile("output/feedback-20261112/catalog-copy-e2e.json", JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ passed: report.passed, cards: report.cards.length, states: report.states.length }));
