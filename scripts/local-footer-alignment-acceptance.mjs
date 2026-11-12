import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { localAcceptanceBrowser } from "./lib/local-browser-acceptance.mjs";
import { assertLocalDevelopmentState } from "./lib/local-development.ts";

const state = JSON.parse(await fs.readFile(".cuac-local/runtime.json", "utf8"));
assertLocalDevelopmentState(state);
const origin = `http://127.0.0.1:${state.applicationPort}`;
const output = "output/feedback-20261112";
await fs.mkdir(output, { recursive: true });
const report = { issue: "Arabic footer logo alignment", before1920: { logoRight: 1582.125, columnRight: 1680, error: 97.875 }, checks: [], passed: false };
const { chromium, executablePath } = localAcceptanceBrowser();
const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const width of [375, 768, 1280, 1920]) {
    for (const locale of ["en", "vi", "ar"]) {
      for (const path of ["/home-v3.html", "/insights/"]) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        const response = await page.goto(`${origin}${path}?lang=${locale}`, { waitUntil: "domcontentloaded" });
        assert.equal(response.status(), 200);
        await page.locator(".footer-grid .brand img").waitFor();
        const result = await page.locator(".footer-grid > div").first().evaluate(column => {
          const bounds = column.getBoundingClientRect();
          const image = column.querySelector(".brand img").getBoundingClientRect();
          const rtl = document.documentElement.dir === "rtl";
          return {
            columnEdge: rtl ? bounds.right : bounds.left,
            logoEdge: rtl ? image.right : image.left,
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
          };
        });
        assert.ok(Math.abs(result.columnEdge - result.logoEdge) <= 1, `${locale}/${width}/${path}: ${JSON.stringify(result)}`);
        const visible = await page.locator(".footer-grid .brand img").evaluate(async image => {
          await image.decode();
          const markup = await (await fetch(image.currentSrc)).text();
          const parsed = new DOMParser().parseFromString(markup, "image/svg+xml").documentElement;
          const svg = document.importNode(parsed, true);
          svg.style.cssText = "position:fixed;visibility:hidden;left:0;top:0";
          document.body.append(svg);
          const bounds = svg.getBBox();
          const view = svg.viewBox.baseVal;
          const imageBounds = image.getBoundingClientRect();
          const paintedRight = imageBounds.left + (bounds.x + bounds.width - view.x) / view.width * imageBounds.width;
          const columnRight = image.closest(".footer-grid > div").getBoundingClientRect().right;
          svg.remove();
          return { asset: new URL(image.currentSrc).pathname, paintedRight, columnRight, visualGap: columnRight - paintedRight };
        });
        if (locale === "ar") assert.ok(Math.abs(visible.visualGap) <= 1, `Visible logo must align with text: ${JSON.stringify(visible)}`);
        assert.equal(result.overflow, false);
        assert.equal(await page.locator(".footer-col a").count(), 12);
        report.checks.push({ width, locale, path, ...result, ...visible });
        if (locale === "ar" && path === "/home-v3.html" && [375, 1920].includes(width)) {
          await page.locator(".footer").screenshot({ path: `${output}/footer-ar-aligned-${width}.png` });
        }
        await page.close();
      }
    }
  }
  report.passed = true;
} finally {
  await browser.close();
  await fs.writeFile(`${output}/footer-alignment-e2e.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, report: `${output}/footer-alignment-e2e.json` }));
