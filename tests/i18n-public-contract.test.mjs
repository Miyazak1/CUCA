import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const source = path => readFile(new URL(path, root), "utf8");

test("localized home advertises only complete launch locales and loads locale before rendering", async () => {
  const html = await source("public/home-v3.html");
  assert.match(html, /data-i18n-locales="en,vi,th,id,ms,ar"/);
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(match => match[1].split("?")[0]);
  assert.ok(scripts.indexOf("i18n-runtime.js") < scripts.indexOf("home-i18n.js"));
  assert.ok(scripts.indexOf("home-i18n.js") < scripts.indexOf("shared-shell.js"));
  assert.ok(scripts.indexOf("shared-shell.js") < scripts.indexOf("home-v3.js"));
});

test("browser locale runtime uses bounded URL state, native labels and Arabic RTL without durable browser identity", async () => {
  const runtime = await source("public/i18n-runtime.js");
  for (const locale of ["en", "vi", "th", "id", "ms", "ar"]) assert.match(runtime, new RegExp(`(?:^|\\W)${locale}: \\{ name:`));
  assert.match(runtime, /ar: \{ name: "العربية", dir: "rtl" \}/);
  assert.match(runtime, /document\.documentElement\.dir = metadata\[locale\]\.dir/);
  assert.match(runtime, /url\.searchParams\.set\("lang", nextLocale\)/);
  assert.doesNotMatch(runtime, /localStorage|sessionStorage|document\.cookie/);
});

test("non-English home is a complete bounded landing experience and labels English destinations", async () => {
  const [home, shell, css] = await Promise.all([
    source("public/home-i18n.js"), source("public/shared-shell.js"), source("public/shared-shell.css"),
  ]);
  for (const key of ["home.title", "home.catalogTitle", "home.planTitle", "home.boundaryTitle", "home.accountTitle"]) assert.ok(home.includes(key));
  assert.match(home, /hreflang="en"/);
  assert.match(home, /home\.destinationNotice/);
  assert.match(shell, /data-cuac-language/);
  assert.match(shell, /initLanguageSelectors/);
  assert.match(shell, /window\.CUACI18n && window\.CUACI18n\.locale !== "en"/);
  assert.match(css, /\[dir="rtl"\]/);
});

test("multilingual UI does not silently broaden reviewed legal notice locales", async () => {
  const [notice, shell, runtime] = await Promise.all([
    source("src/server/notices/document.ts"),
    source("public/shared-shell.js"),
    source("public/i18n-runtime.js"),
  ]);
  assert.match(notice, /NOTICE_LOCALES = \["en", "zh-CN"\]/);
  assert.doesNotMatch(notice, /NOTICE_LOCALES = \[[^\]]*(?:"vi"|"th"|"id"|"ms"|"ar")/);
  assert.match(shell, /shellText\("englishOnly", "English version"\)/);
  assert.match(runtime, /"shell\.englishOnly"/);
});

test("site search exposes the complete public locale set while labeling English catalog content", async () => {
  const [html, messages, script] = await Promise.all([
    source("public/search.html"), source("public/search-i18n.js"), source("public/search.js"),
  ]);
  assert.match(html, /data-i18n-locales="en,vi,th,id,ms,ar"/);
  assert.match(html, /data-search-copy="contentNotice"/);
  for (const locale of ["en", "vi", "th", "id", "ms", "ar"]) assert.match(messages, new RegExp(`\\b${locale}: \\{`));
  assert.match(script, /CUACI18n/);
  assert.match(script, /params\.set\("lang", locale\)/);
  assert.match(await source("public/shared-shell.js"), /function localizedSearchHref\(\)/);
});

test("public catalog lists share bounded launch locales and preserve language across catalog navigation", async () => {
  const [runtime, universities, programs, scholarships, catalogI18n] = await Promise.all([
    source("public/i18n-runtime.js"),
    source("public/universities.html"),
    source("public/programs.html"),
    source("public/scholarships.html"),
    source("public/catalog-list-i18n.js"),
  ]);
  for (const html of [universities, programs, scholarships]) {
    assert.match(html, /data-i18n-locales="en,vi,th,id,ms,ar"/);
    assert.match(html, /i18n-runtime\.js\?v=20260921-public-locales/);
    assert.match(html, /catalog-list-i18n\.js\?v=20260921-catalog-locales/);
    assert.match(html, /data-catalog-copy="common\.contentNotice"/);
  }
  assert.match(runtime, /document\.documentElement\.dir = metadata\[locale\]\.dir/);
  assert.match(catalogI18n, /window\.CUACI18n\?\.register\(messages\)/);
  assert.match(catalogI18n, /url\.searchParams\.set\("lang", i18n\.locale\)/);
  assert.match(catalogI18n, /MutationObserver/);
  for (const locale of ["vi", "th", "id", "ms", "ar"]) assert.match(catalogI18n, new RegExp(`\\b${locale}: \\{`));
});

test("catalog control translations keep dynamic filters and card status labels aligned", async () => {
  const script = await source("public/catalog-list-i18n.js");
  const expectedSortLabels = {
    vi: "Sắp xếp: Liên quan",
    th: "เรียง: ความเกี่ยวข้อง",
    id: "Urutkan: Relevansi",
    ms: "Susun: Kaitan",
    ar: "الترتيب: الصلة",
  };
  for (const [locale, expected] of Object.entries(expectedSortLabels)) {
    const context = {
      URL,
      Node: { ELEMENT_NODE: 1 },
      MutationObserver: class { observe() {} },
      location: { href: "https://example.test/programs.html", origin: "https://example.test" },
      document: { body: { dataset: { catalogListPage: "programs" } }, title: "Programs", querySelectorAll: () => [] },
      window: { CUACI18n: { locale, register() {}, t: (_key, fallback) => fallback } },
    };
    vm.runInNewContext(script, context);
    assert.equal(context.window.CUACCatalogI18n.ui("Sort: Relevance"), expected);
    assert.notEqual(context.window.CUACCatalogI18n.ui("Filtered by your scholarship route preferences."), "Filtered by your scholarship route preferences.");
    assert.notEqual(context.window.CUACCatalogI18n.ui("Next step"), "Next step");
    assert.notEqual(context.window.CUACCatalogI18n.ui("Ready to compare"), "Ready to compare");
    assert.notEqual(context.window.CUACCatalogI18n.ui("Showing"), "Showing");
  }
});
