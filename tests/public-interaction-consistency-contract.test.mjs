import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("shared public controls expose one keyboard focus and disabled-state contract", async () => {
  const css = await source("public/shared-shell.css");
  assert.match(css, /:where\(a, button, input, select, textarea, \[tabindex\]\):focus-visible\s*\{[^}]*outline:\s*3px solid/s);
  assert.match(css, /:where\(button, input, select, textarea\):disabled,[\s\S]*?cursor:\s*not-allowed;[\s\S]*?opacity:/);
  assert.match(css, /html body select:not\(\[multiple\]\)\s*\{[^}]*appearance:\s*none;/s);
  assert.match(css, /input\[type="file"\]::file-selector-button\s*\{/);
  assert.match(css, /input\[type="checkbox"\], input\[type="radio"\][\s\S]*?accent-color:\s*var\(--accent\)/);
});

test("public typography uses the shared families and supported font weights", async () => {
  const paths = [
    "public/shared-shell.css",
    "public/home-v3.css",
    "public/programs.css",
    "public/universities.css",
    "public/scholarships.css",
    "public/cities.css",
    "public/catalog-detail.css",
    "public/application.css",
    "public/auth.css",
    "app/globals.css",
    "app/guides/guides.module.css",
    "app/insights/insights.module.css",
  ];
  const styles = await Promise.all(paths.map(source));
  for (const [index, css] of styles.entries()) {
    const unsupported = [...css.matchAll(/font-weight:\s*(\d+)/g)]
      .map((match) => Number(match[1]))
      .filter((weight) => ![400, 500, 600, 700, 800].includes(weight));
    assert.deepEqual(unsupported, [], paths[index]);
  }
  assert.doesNotMatch(await source("public/catalog-detail.css"), /Aptos|Segoe UI Variable Display/);
});

test("application workspace keeps one page-level heading", async () => {
  const html = await source("public/application.html");
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
  assert.match(html, /<h2 data-profile-detail-title>/);
});

test("public pages load the synchronized design-system release", async () => {
  const directory = new URL("../public/", import.meta.url);
  const names = (await readdir(directory)).filter((name) => name.endsWith(".html"));
  const pages = await Promise.all(names.map(async (name) => [name, await readFile(new URL(name, directory), "utf8")]));
  for (const [name, html] of pages) {
    if (!html.includes("shared-shell.css?v=")) continue;
    assert.match(html, /shared-shell\.css\?v=20261021-design-system/, name);
  }
});

test("visual toggle controls keep accessible pressed state synchronized", async () => {
  const [homeHtml, homeJs, universityHtml, universityJs, programHtml, programJs, cityHtml, cityJs, searchHtml, searchJs, preferencesHtml, preferencesJs] = await Promise.all([
    source("public/home-v3.html"),
    source("public/home-v3.js"),
    source("public/universities.html"),
    source("public/universities.js"),
    source("public/programs.html"),
    source("public/programs.js"),
    source("public/cities.html"),
    source("public/cities.js"),
    source("public/search.html"),
    source("public/search.js"),
    source("public/preferences.html"),
    source("public/preferences.js"),
  ]);

  for (const html of [homeHtml, universityHtml, programHtml, cityHtml, searchHtml, preferencesHtml]) {
    assert.match(html, /role="group"/);
    assert.match(html, /aria-pressed="(?:true|false)"/);
  }
  for (const js of [homeJs, universityJs, programJs, cityJs, searchJs, preferencesJs]) {
    assert.match(js, /setAttribute\("aria-pressed",/);
  }
});

test("application progress exposes the current step independently of color", async () => {
  const script = await source("public/application.js");
  assert.match(script, /setAttribute\("aria-current", "step"\)/);
  assert.match(script, /removeAttribute\("aria-current"\)/);
});
