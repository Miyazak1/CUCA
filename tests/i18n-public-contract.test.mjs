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
  assert.doesNotMatch(runtime, /nextLocale === "en"[\s\S]{0,80}delete\("lang"\)/);
  assert.doesNotMatch(runtime, /localStorage|sessionStorage|document\.cookie/);
});

test("shared student account navigation localizes labels and preserves the selected locale", async () => {
  const [runtime, shell, shellCss] = await Promise.all([
    source("public/i18n-runtime.js"),
    source("public/shared-shell.js"),
    source("public/shared-shell.css"),
  ]);
  for (const key of ["accountChecking", "openAccountMenu", "savedList", "signOut", "studentWorkspaceTagline", "privacyData", "getSupport", "workspace.studentInfo", "workspace.notifications", "workspace.preferences"]) {
    assert.match(shell, new RegExp(`shellText\\("${key.replaceAll(".", "\\.")}"`));
  }
  for (const locale of ["vi", "th", "id", "ms", "ar"]) {
    const localeStart = runtime.indexOf(`${locale}: {`);
    assert.notEqual(localeStart, -1);
    const localeCopy = runtime.slice(localeStart, runtime.indexOf("\n    },", localeStart));
    for (const key of ["shell.savedList", "shell.openAccountMenu", "shell.signOut", "shell.workspace.studentInfo"]) {
      assert.ok(localeCopy.includes(`"${key}"`), `${locale} missing ${key}`);
    }
  }
  assert.match(shell, /function localizedPageHref\(rawHref\)/);
  assert.match(shell, /localizedPageHref\("favourites-api\.html"\)/);
  assert.match(shell, /function shouldCarryLocale\(locale\)/);
  assert.match(shell, /runtimeAuthState\.accountLocale/);
  assert.match(shell, /localizedUrl\.searchParams\.set\("lang", runtimeAuthState\.accountLocale\)/);
  assert.match(shell, /accountLinks\.map\(\(\[href, icon, label\]\) => `<a href="\$\{localizedPageHref\(href\)\}"/);
  assert.match(shell, /const headerNavItems = \(localizedNav \? roleNavItems : navItems\)/);
  assert.match(shell, /renderWorkspaceNavigation\(workspace\)/);
  assert.match(shell, /class="workspace-nav-links"/);
  assert.doesNotMatch(shell, /workspace\?\.items \|\|/);
  assert.match(shellCss, /\.workspace-nav-shell/);
  assert.match(shellCss, /\.nav \.nav-links[\s\S]*overflow-x: auto/);
  assert.match(shell, /class="language-selector-icon">\$\{icons\.globe\}/);
  assert.match(shell, /data-cuac-language/);
  assert.match(shell, /role="listbox"/);
  assert.match(shell, /role="option"[\s\S]*aria-selected=/);
  assert.match(shell, /\["ArrowDown", "ArrowUp", "Home", "End"\]/);
  assert.match(shellCss, /\.language-selector-trigger:focus-visible/);
  assert.match(shellCss, /\.language-selector-menu\[hidden\]/);
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

test("student city discovery is multilingual while school and site administration stay Chinese-only", async () => {
  const [cities, cityDetail, cityMessages, schoolPortal, schoolSettings, opsAdmin] = await Promise.all([
    source("public/cities.html"),
    source("public/city-detail.html"),
    source("public/cities-i18n.js"),
    source("public/school-portal.html"),
    source("public/school-settings.html"),
    source("public/ops-admin.html"),
  ]);
  for (const html of [cities, cityDetail]) assert.match(html, /data-i18n-locales="en,vi,th,id,ms,ar"/);
  for (const html of [schoolPortal, schoolSettings, opsAdmin]) assert.doesNotMatch(html, /data-i18n-locales=/);
  const cityScripts = [...cities.matchAll(/<script src="([^"]+)"/g)].map(match => match[1].split("?")[0]);
  assert.ok(cityScripts.indexOf("i18n-runtime.js") < cityScripts.indexOf("cities-i18n.js"));
  assert.ok(cityScripts.indexOf("cities-i18n.js") < cityScripts.indexOf("shared-shell.js"));
  for (const marker of ["Thành phố", "เมือง", "Kota", "Bandar", "المدن"]) assert.match(cityMessages, new RegExp(marker));
  assert.match(cityMessages, /url\.searchParams\.set\("lang", i18n\.locale\)/);
  assert.match(cityMessages, /MutationObserver/);
});

test("student guide discovery is multilingual and renders only governed published records", async () => {
  const [html, messages, script] = await Promise.all([
    source("public/guides.html"),
    source("public/guides-i18n.js"),
    source("public/guides.js"),
  ]);
  assert.match(html, /data-i18n-locales="en,vi,th,id,ms,ar"/);
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(match => match[1].split("?")[0]);
  assert.ok(scripts.indexOf("i18n-runtime.js") < scripts.indexOf("guides-i18n.js"));
  assert.ok(scripts.indexOf("guides-i18n.js") < scripts.indexOf("shared-shell.js"));
  assert.ok(scripts.indexOf("shared-shell.js") < scripts.indexOf("guides.js"));
  assert.doesNotMatch(html, /cuac-data\.js|data-application-timeline|timelineRail/);
  assert.match(script, /\/api\/v1\/catalog\/guides/);
  assert.match(script, /guide\.content\?\.translations\?\.\[locale\]/);
  assert.match(script, /guide-detail\.html\?guide=\$\{encodeURIComponent\(guide\.slug\)\}/);
  assert.match(script, /English content shown — reviewed translation not yet published\./);
  assert.doesNotMatch(script, /localStorage|sessionStorage|CuacDataClient/);
  for (const marker of ["Hướng dẫn nộp hồ sơ", "คู่มือการสมัคร", "Panduan pendaftaran", "Panduan permohonan", "أدلة التقديم"]) {
    assert.match(messages, new RegExp(marker));
  }
  assert.match(messages, /url\.searchParams\.set\("lang", i18n\.locale\)/);
  assert.match(messages, /MutationObserver/);
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
