import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { localAcceptanceBrowser } from "./lib/local-browser-acceptance.mjs";
import { assertLocalDevelopmentState } from "./lib/local-development.ts";

const state = JSON.parse(await fs.readFile(".cuac-local/runtime.json", "utf8"));
assertLocalDevelopmentState(state);
const origin = `http://127.0.0.1:${state.applicationPort}`;
const output = "output/feedback-20261112";
await fs.mkdir(output, { recursive: true });
const report = { scope: "Current local built version and real local catalog; original BUG-05/06/07/09/17 and TC-19/20/22", search: [], security: [], links: [], scholarship: {}, titles: [], passed: false };
async function json(path) {
  const response = await fetch(origin + path, { signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, path);
  return response.json();
}
const types = ["program", "school", "scholarship", "city", "guide", "insight"];
async function allSearch(query) {
  return Promise.all(types.map(async type => {
    const ids = [];
    let cursor, total, pages = 0;
    do {
      const params = new URLSearchParams({ q: query, types: type, limit: "50", locale: "en" });
      if (cursor) params.set("cursor", cursor);
      const data = (await json(`/api/v1/search?${params}`)).data;
      const group = data.groups.find(group => group.type === type);
      total = group.total;
      ids.push(...group.items.map(item => item.id));
      cursor = group.nextCursor;
      pages++;
      assert.ok(pages < 1000);
    } while (cursor);
    assert.equal(new Set(ids).size, total);
    return { type, total, pages, ids: ids.sort() };
  }));
}
for (const [alias, canonical] of [["Bắc Kinh", "Beijing"], ["Thượng Hải", "Shanghai"], ["hoc bong thac si", "học bổng thạc sĩ"], ["y khoa dạy bằng tiếng Anh", "medicine english"]]) {
  const [left, right] = await Promise.all([allSearch(alias), allSearch(canonical)]);
  assert.deepEqual(left.map(({ type, total, ids }) => ({ type, total, ids })), right.map(({ type, total, ids }) => ({ type, total, ids })), alias);
  assert.ok(right.reduce((sum, group) => sum + group.total, 0) > 0, `${canonical}: positive real catalog result required`);
  report.search.push({ alias, canonical, groups: left.map(({ type, total, pages, ids }) => ({ type, total, pages, idSha256: createHash("sha256").update(JSON.stringify(ids)).digest("hex") })), passed: true });
  console.log(`Search result-set equality: ${alias}`);
}
const { chromium, executablePath } = localAcceptanceBrowser();
const browser = await chromium.launch({ headless: true, executablePath });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  let dialogs = 0;
  page.on("dialog", async dialog => { dialogs++; await dialog.dismiss(); });
  for (const payload of ['<img src=x onerror="window.__feedbackXss=1">', '<svg onload="window.__feedbackXss=2"></svg>']) {
    await page.goto(`${origin}/search.html?lang=vi&q=${encodeURIComponent(payload)}`, { waitUntil: "networkidle" });
    assert.equal(await page.locator("[data-site-search-input]").inputValue(), payload);
    assert.equal(await page.evaluate(() => window.__feedbackXss || 0), 0);
    assert.equal(await page.locator('img[src="x"], svg[onload]').count(), 0);
    assert.equal(dialogs, 0);
    report.security.push({ case: "Search XSS payload remains inert text", payload, passed: true });
  }
  const response = await page.goto(`${origin}/about.html?lang=vi`);
  const headers = await response.allHeaders();
  assert.match(headers["content-security-policy"], /frame-ancestors 'none'/);
  assert.equal(headers["x-frame-options"].toUpperCase(), "DENY");
  const frameErrors = [];
  page.on("console", message => { if (message.type() === "error") frameErrors.push(message.text()); });
  await page.route("**/__feedback-frame-parent.html", route => route.fulfill({ contentType: "text/html", body: `<iframe src="${origin}/programs.html?lang=vi"></iframe>` }));
  const parentResponse = await page.goto(`${origin}/__feedback-frame-parent.html`);
  assert.equal(parentResponse.headers()["content-security-policy"], undefined, "Parent must allow framing so the child protection is tested");
  await page.waitForFunction(() => { const frame = document.querySelector("iframe"); try { return frame.contentWindow.location.href.startsWith("chrome-error:"); } catch { return frame.contentDocument === null; } });
  assert.ok(!page.frames().some(frame => frame.url().includes("/programs.html")));
  assert.ok(frameErrors.some(error => /frame-ancestors|X-Frame-Options/i.test(error)), "Child response must reject framing");
  report.security.push({ case: "Same-origin browser iframe is blocked", csp: headers["content-security-policy"], xFrameOptions: headers["x-frame-options"], browserFrameUrls: page.frames().map(frame => frame.url()), frameErrors, passed: true });
  const nonces = new Set();
  for (const route of ["/guides/documents?lang=ar", "/guides/documents?lang=ar", "/insights/?lang=vi"]) {
    const response = await context.request.get(origin + route);
    const policy = response.headers()["content-security-policy"];
    const nonce = policy.match(/'nonce-([^']+)'/)?.[1];
    assert.ok(nonce && !nonces.has(nonce));
    nonces.add(nonce);
    assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval/);
    assert.match(response.headers()["cache-control"], /no-store/);
    const html = await response.text();
    const scripts = [...html.matchAll(/<script([^>]*)>/g)].map(match => match[1]).filter(attributes => !/src=|application\/ld\+json/.test(attributes));
    assert.ok(scripts.length > 0 && scripts.every(attributes => attributes.includes(`nonce="${nonce}"`)), "SSR inline runtime scripts require the matching nonce");
  }
  report.security.push({ case: "Real SSR scripts use unique per-request CSP nonces and no-store; strict policy retained", requests: nonces.size, passed: true });

  // The source report supplied a count of 54 links, not the link manifest.
  // Rebuild an exhaustive inventory from its ten main page types instead of inventing the missing 54 URLs.
  const resources = await Promise.all(["programs", "schools", "scholarships", "cities"].map(resource => json(`/api/v1/catalog/${resource}?limit=1`)));
  const first = resources.map(resource => resource.data[0]);
  const pages = ["home-v3.html", "programs.html", "universities.html", "scholarships.html", "cities.html", "about.html", "search.html?q=scholarship", `program-detail.html?program=${first[0].id}`, `university-detail.html?university=${first[1].id}`, `scholarship-detail.html?scholarship=${first[2].id}`];
  const links = new Set();
  for (const path of pages) {
    await page.goto(`${origin}/${path}${path.includes("?") ? "&" : "?"}lang=vi`, { waitUntil: "networkidle" });
    for (const href of await page.locator("a[href]").evaluateAll(anchors => anchors.map(anchor => anchor.href))) {
      const url = new URL(href);
      if (url.origin !== origin) continue;
      url.hash = "";
      links.add(url.pathname + url.search);
    }
  }
  assert.ok(links.size >= 54, `Current link inventory must cover at least the original count: ${links.size}`);
  const queue = [...links];
  for (let start = 0; start < queue.length; start += 8) {
    await Promise.all(queue.slice(start, start + 8).map(async path => {
      const response = await context.request.get(origin + path);
      assert.ok(response.ok(), `Dead internal link ${response.status()}: ${path}`);
      report.links.push({ path, status: response.status(), finalPath: new URL(response.url()).pathname });
    }));
  }
  report.linkScope = { sourcePages: pages, originalReportedCount: 54, originalManifestAvailable: false, rebuiltCurrentCount: links.size };

  await page.goto(`${origin}/scholarships.html?lang=vi`, { waitUntil: "networkidle" });
  report.scholarship = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll("[data-catalog-copy], [data-catalog-ui], [data-catalog-placeholder]")];
    const visibleText = node => (node.dataset.catalogPlaceholder ? node.placeholder : node.textContent).trim();
    return { markedNodes: nodes.length, nodes: nodes.map(node => ({ key: node.dataset.catalogCopy || node.dataset.catalogUi || "inline", text: visibleText(node) })), selectedOptions: [...document.querySelectorAll("select option")].map(option => ({ value: option.value, text: option.textContent })) };
  });
  const englishSource = await fs.readFile("public/scholarships.html", "utf8");
  const staticTexts = [...englishSource.replace(/<svg\b[\s\S]*?<\/svg>/g, "").matchAll(/data-catalog-ui[^>]*>([^<>]+)</g)].map(match => match[1].trim());
  const dictionaryCoverage = await page.evaluate(texts => texts.map(original => ({ original, translated: window.CUACCatalogI18n.ui(original) })), [...new Set(staticTexts)]);
  for (const entry of dictionaryCoverage) assert.notEqual(entry.translated, entry.original, `Scholarship untranslated: ${entry.original}`);
  report.scholarship.staticDictionaryCoverage = dictionaryCoverage;
  report.scholarship.originalApproximateCount = 117;
  report.scholarship.note = "Original report did not enumerate 117 strings. Audit enumerates all current marked nodes, filter options, actual catalog states, plus the full dictionary contract test.";
  for (const term of ["Critical Care Medicine", "Emergency Medicine"]) {
    for (const width of [375, 1568]) {
      await page.setViewportSize({ width, height: width === 375 ? 812 : 760 });
      await page.goto(`${origin}/programs.html?lang=vi&q=${encodeURIComponent(term)}`, { waitUntil: "networkidle" });
      const card = page.locator("[data-program-card]").filter({ hasText: term }).first();
      await card.waitFor();
      const title = await card.locator("h2").evaluate(heading => {
        const link = heading.querySelector("a");
        const style = getComputedStyle(heading);
        const wordRects = [];
        const walker = document.createTreeWalker(link, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const text = walker.currentNode;
          for (const word of ["Academic", "Professional"]) {
            const start = text.textContent.indexOf(word);
            if (start < 0) continue;
            const range = document.createRange(); range.setStart(text, start); range.setEnd(text, start + word.length);
            wordRects.push({ word, lines: range.getClientRects().length });
          }
        }
        return { text: heading.textContent, fullTitle: link.title, href: link.href, lineClamp: style.webkitLineClamp, overflow: style.overflow, renderedHeight: heading.getBoundingClientRect().height, lineHeight: parseFloat(style.lineHeight), wordRects };
      });
      assert.equal(title.fullTitle, title.text);
      assert.equal(title.lineClamp, "3");
      assert.equal(title.overflow, "hidden");
      assert.ok(title.renderedHeight <= title.lineHeight * 3 + 1);
      assert.ok(title.wordRects.every(word => word.lines === 1), `Words must not split without hyphens: ${JSON.stringify(title.wordRects)}`);
      await card.scrollIntoViewIfNeeded();
      await page.waitForTimeout(700);
      await card.screenshot({ path: `${output}/title-${term.split(" ")[0].toLowerCase()}-${width}.png` });
      await page.goto(title.href, { waitUntil: "networkidle" });
      await page.locator(".catalog-record-title h1").waitFor();
      const detailWords = await page.locator(".catalog-record-title h1").evaluate(heading => {
        const words = [];
        const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) for (const word of ["Academic", "Professional"]) {
          const node = walker.currentNode, start = node.textContent.indexOf(word);
          if (start < 0) continue;
          const range = document.createRange(); range.setStart(node, start); range.setEnd(node, start + word.length);
          words.push({ word, lines: range.getClientRects().length });
        }
        return words;
      });
      assert.ok(detailWords.every(word => word.lines === 1), `Detail words split: ${JSON.stringify(detailWords)}`);
      await page.locator(".catalog-record-title").screenshot({ path: `${output}/detail-title-${term.split(" ")[0].toLowerCase()}-${width}.png` });
      report.titles.push({ term, width, ...title, detailWords, passed: true });
    }
  }
  report.passed = true;
} finally {
  await browser.close();
  await fs.writeFile(`${output}/feedback-evidence-e2e.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ passed: report.passed, searches: report.search.length, security: report.security.length, links: report.links.length, titles: report.titles.length }));
