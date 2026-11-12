import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const source = path => readFile(new URL(path, root), "utf8");

test("Vietnamese catalog UI translates controls without changing official names or enum values", async () => {
  const script = await source("public/catalog-list-i18n.js");
  const window = { CUACI18n: { locale: "vi", register() {}, t: (_key, fallback) => fallback } };
  vm.runInNewContext(script, { window, document: { body: { dataset: {} }, querySelectorAll: () => [] }, MutationObserver: class { observe() {} } });
  const ui = window.CUACCatalogI18n.ui;
  assert.equal(ui("Computer Science"), "Khoa học máy tính");
  assert.equal(ui("What funding can cover"), "Các khoản tài trợ có thể chi trả");
  assert.equal(ui("Language proof"), "Chứng minh ngôn ngữ");
  assert.equal(ui("Chinese"), "Tiếng Trung");
  assert.equal(ui("Public"), "Công lập");
  assert.equal(ui("full"), "full");
  assert.equal(ui("Critical Care Medicine (Academic/Professional Degree)"), "Critical Care Medicine (Academic/Professional Degree)");
  assert.equal(ui("Synthetic University"), "Synthetic University");
});

test("public locale links carry language through root and extensionless content routes", async () => {
  const script = await source("public/shared-shell.js");
  const start = script.indexOf("  function shouldCarryLocale(");
  const end = script.indexOf("  let authNavigationPending", start);
  for (const locale of ["vi", "en"]) {
    const href = vm.runInNewContext(`${script.slice(start, end)}\nlocalizedPageHref`, {
      URL, URLSearchParams,
      window: { CUACI18n: { locale }, location: { origin: "https://ucac.cn", search: `?lang=${locale}` } },
    });
    for (const path of ["/", "/guides/", "/guides/documents?section=passport#checklist", "/insights/", "programs.html"]) {
      const url = new URL(href(path), "https://ucac.cn");
      assert.equal(url.searchParams.get("lang"), locale);
      if (path.includes("section=")) { assert.equal(url.searchParams.get("section"), "passport"); assert.equal(url.hash, "#checklist"); }
    }
    assert.equal(href("https://example.org/guide?lang=en"), "https://example.org/guide?lang=en");
  }
});

test("localized home advertises only complete launch locales and loads locale before rendering", async () => {
  const html = await source("public/home-v3.html");
  assert.match(html, /data-i18n-locales="en,vi,th,id,ms,ar"/);
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(match => match[1].split("?")[0]);
  assert.ok(scripts.indexOf("i18n-runtime.js") < scripts.indexOf("home-i18n.js"));
  assert.ok(scripts.indexOf("home-i18n.js") < scripts.indexOf("shared-shell.js"));
  assert.ok(scripts.indexOf("shared-shell.js") < scripts.indexOf("home-v3.js"));
});

test("public shell uses the UCAC Study in China identity without the parent-brand signature", async () => {
  const [home, homeScript, homeCss, shell, shellCss, about, manifest] = await Promise.all([
    source("public/home-v3.html"),
    source("public/home-v3.js"),
    source("public/home-v3.css"),
    source("public/shared-shell.js"),
    source("public/shared-shell.css"),
    source("public/about.html"),
    source("config/public-release-assets.json"),
  ]);
  assert.match(shell, /const wordmark = footer \? "\/ucac-wordmark-footer\.svg" : "\/ucac-wordmark\.svg"/);
  assert.match(shell, /const compactWordmark = footer \? "\/ucac-wordmark-compact-footer\.svg" : "\/ucac-wordmark-compact\.svg"/);
  assert.match(shell, /brand\(true\)/);
  assert.match(manifest, /"ucac-wordmark-footer\.svg"/);
  assert.match(manifest, /"ucac-wordmark-compact-footer\.svg"/);
  assert.doesNotMatch(shell, /brand-parent|by Holalobe/);
  assert.match(shell, /© 2026 UCAC\./);
  assert.match(manifest, /"ucac-wordmark\.svg"/);
  assert.match(manifest, /"ucac-wordmark-compact\.svg"/);
  assert.match(shellCss, /\.cuac-back-to-top\.visible\s*\{[^}]*opacity:\s*1/s);
  assert.doesNotMatch(shell, /China admissions 2026:/);
  assert.doesNotMatch(home, /by Holalobe/);
  assert.match(home, /catalog-list-api\.js\?v=20261016-current-routes/);
  assert.match(home, /home-v3\.css\?v=20261021-design-system/);
  assert.doesNotMatch(home, /documents=light/);
  assert.match(homeScript, /window\.CuacCatalogList/);
  assert.match(homeScript, /api\.loadPage/);
  assert.match(homeCss, /\.cat \.category-icon\s*\{[^}]*background:\s*linear-gradient/s);
  assert.match(homeCss, /\.category-icon svg,[\s\S]*fill:\s*none;[\s\S]*stroke:\s*currentColor;/);
  assert.match(about, /Holalobe is the parent brand behind UCAC/);
  assert.match(manifest, /"about\.html"/);
  assert.match(manifest, /"about\.css"/);
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
  for (const key of ["accountChecking", "openAccountMenu", "savedList", "signOut", "openMenu", "closeMenu", "nav.explore", "nav.apply", "nav.guides", "studentWorkspaceTagline", "privacyData", "workspace.studentInfo", "workspace.notifications", "workspace.preferences"]) {
    assert.match(shell, new RegExp(`shellText\\("${key.replaceAll(".", "\\.")}"`));
  }
  for (const locale of ["vi", "th", "id", "ms", "ar"]) {
    const localeStart = runtime.indexOf(`${locale}: {`);
    assert.notEqual(localeStart, -1);
    const localeCopy = runtime.slice(localeStart, runtime.indexOf("\n    },", localeStart));
    for (const key of ["shell.savedList", "shell.openAccountMenu", "shell.signOut", "shell.openMenu", "shell.closeMenu", "shell.nav.explore", "shell.nav.apply", "shell.nav.insights", "shell.workspace.studentInfo"]) {
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
  assert.match(shell, /function usesInternalNavigation\(workspace = workspaceNavigation\(\)\)/);
  assert.match(shell, /const localizedNav = usesInternalNavigation\(workspace\)/);
  assert.match(shell, /function initBackToTop\(\)/);
  assert.match(shell, /window\.scrollTo\(\{ top: 0, behavior: reducedMotion \? "auto" : "smooth" \}\)/);
  assert.match(shell, /button\.tabIndex = visible \? 0 : -1/);
  assert.match(shell, /renderWorkspaceNavigation\(workspace\)/);
  assert.doesNotMatch(shell, /\["school-settings-api\.html", icons\.(?:settings|intent),/);
  assert.doesNotMatch(shell, /\["ops-admin-api\.html", icons\.(?:shield|search),/);
  assert.doesNotMatch(shell, /home-v3\.html#cuac-hub/);
  assert.doesNotMatch(shell, /class="socials"/);
  assert.doesNotMatch(shell, /Admissions clarity policy|招生透明政策/);
  assert.match(shell, /class="workspace-nav-links"/);
  assert.doesNotMatch(shell, /workspace\?\.items \|\|/);
  assert.match(shellCss, /\.workspace-nav-shell/);
  assert.match(shell, /data-primary-nav-trigger/);
  assert.match(shell, /data-primary-nav-toggle/);
  assert.match(shell, /function initPrimaryNavigation\(\)/);
  assert.match(shellCss, /\.nav\.menu-open \.nav-links/);
  assert.match(shellCss, /\.nav-dropdown-links/);
  assert.match(shell, /class="language-selector-icon">\$\{icons\.globe\}/);
  assert.match(shell, /data-cuac-language/);
  assert.match(shell, /role="listbox"/);
  assert.match(shell, /role="option"[\s\S]*aria-selected=/);
  assert.match(shell, /\["ArrowDown", "ArrowUp", "Home", "End"\]/);
  assert.match(shellCss, /\.language-selector-trigger:focus-visible/);
  assert.match(shellCss, /\.language-selector-menu\[hidden\]/);
});

test("home translation preserves the shared layout and footer navigation in every language", async () => {
  const [home, summary, shell, css] = await Promise.all([
    source("public/home-i18n.js"), source("public/home-v3.js"), source("public/shared-shell.js"), source("public/shared-shell.css"),
  ]);
  assert.doesNotMatch(home, /innerHTML\s*=/);
  assert.match(home, /apply\(main\)/);
  assert.match(summary, /CUACHomeI18n\?\.apply\(target\)/);
  assert.doesNotMatch(summary, /if\s*\([^\n]*locale[^\n]*\) return/);
  assert.doesNotMatch(shell, /translatedPublicShell \? \[\]/);
  assert.match(shell, /footerGroups\.map/);
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

test("all homepage text and accessible descriptions are covered in five translations", async () => {
  const [html, runtime, home] = await Promise.all([
    source("public/home-v3.html"), source("public/i18n-runtime.js"), source("public/home-i18n.js"),
  ]);
  const main = html.split("<main>")[1].split("</main>")[0].replace(/<svg\b[\s\S]*?<\/svg>/g, "");
  const strings = new Set([
    ...[...main.matchAll(/>([^<>]+)</g)].map(match => match[1].trim()),
    ...[...main.matchAll(/(?:aria-label|alt|placeholder)="([^"]+)"/g)].map(match => match[1]),
  ].filter(value => value && !/^(?:\d+|A|✓|UCAC|IELTS|HSK \/ IELTS)$/.test(value)));
  for (const locale of ["en", "vi", "th", "id", "ms", "ar"]) {
    const location = new URL(`http://127.0.0.1/home-v3.html?lang=${locale}`);
    const window = { location };
    const document = { body: { dataset: { i18nLocales: "en,vi,th,id,ms,ar" } }, documentElement: {}, querySelector: () => null };
    const context = vm.createContext({ window, document, location, navigator: { languages: ["en"] }, URL, URLSearchParams });
    vm.runInContext(runtime, context);
    vm.runInContext(home, context);
    for (const original of strings) {
      const actual = window.CUACHomeI18n.text(original);
      if (locale === "en") assert.equal(actual, original);
      else assert.notEqual(actual, original, `${locale} missing homepage copy: ${original}`);
    }
    const href = window.CUACHomeI18n.href("programs.html?language=english&langReq=no-hsk#results");
    const url = new URL(href, location);
    assert.equal(url.searchParams.get("language"), "english");
    assert.equal(url.searchParams.get("langReq"), "no-hsk");
    assert.equal(url.hash, "#results");
    assert.equal(url.searchParams.get("lang"), locale);
    assert.equal(window.CUACHomeI18n.href("https://example.com/guide.html"), "https://example.com/guide.html");
  }
});

test("feedback catalog controls and detail explanations cover all five launch languages", async () => {
  const [list, detail] = await Promise.all([source("public/catalog-list-i18n.js"), source("public/catalog-detail-i18n.js")]);
  const supplemental = vm.runInNewContext(`(${list.match(/const viUi = (\{[\s\S]*?\n  \});/)[1]})`);
  const unchangedTerms = new Set(["CSCA", "PROGRAM", "program"]);
  for (const locale of ["vi", "th", "id", "ms", "ar"]) {
    const window = { CUACI18n: { locale, register() {}, t: (_key, fallback) => fallback } };
    const context = { window, URL, location: new URL("http://127.0.0.1/programs.html"), document: { body: { dataset: {} }, querySelectorAll: () => [] }, MutationObserver: class { observe() {} } };
    vm.runInNewContext(list, context);
    for (const original of Object.keys(supplemental)) {
      if (!unchangedTerms.has(original)) assert.notEqual(window.CUACCatalogI18n.ui(original), original, `${locale}: ${original}`);
    }
    assert.equal(window.CUACCatalogI18n.localizeHref("/guides/documents#sources"), `/guides/documents?lang=${locale}#sources`);
    vm.runInNewContext(detail, context);
    for (const sentence of ["Only open, non-expired intakes from the public catalog are shown.", "No currently open intake is published for this program.", "These summary fields do not replace the intake-specific approved requirement document.", "No CSCA requirement is published for this graduate route."]) {
      assert.notEqual(window.CUACCatalogDetailI18n.ui(sentence), sentence, `${locale}: detail explanation`);
    }
  }
});

test("about copy is complete in five languages and does not mislabel translated editorial pages", async () => {
  const script = await source("public/about-i18n.js");
  const messages = vm.runInNewContext(`(${script.match(/const messages = (\{[\s\S]*?\n\});/)[1]})`);
  const english = Object.keys(messages.vi);
  for (const locale of ["vi", "th", "id", "ms", "ar"]) {
    assert.deepEqual(Object.keys(messages[locale]), english);
    for (const key of english) assert.notEqual(messages[locale][key], key, `${locale}: ${key}`);
    assert.doesNotMatch(messages[locale]["Read application guides"], /tiếng Anh|English/);
  }
});

test("core locale keys and interpolation variables match English in all five languages", async () => {
  const runtime = (await source("public/i18n-runtime.js")).replace("  window.CUACI18n =", "  window.__copy = copy;\n  window.CUACI18n =");
  const window = {};
  vm.runInNewContext(runtime, {
    window, URLSearchParams, navigator: { languages: ["en"] }, location: { search: "?lang=en" },
    document: { body: { dataset: { i18nLocales: "en,vi,th,id,ms,ar" } }, documentElement: {} },
  });
  const keys = Object.keys(window.__copy.en).sort();
  const variables = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const locale of ["vi", "th", "id", "ms", "ar"]) {
    assert.deepEqual(Object.keys(window.__copy[locale]).sort(), keys, `${locale}: key coverage`);
    for (const key of keys) assert.deepEqual(variables(window.__copy[locale][key]), variables(window.__copy.en[key]), `${locale}:${key}: interpolation variables`);
  }
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
    assert.match(html, /i18n-runtime\.js\?v=20261002-ucac-brand/);
    assert.match(html, /catalog-list-i18n\.js\?v=20261112-catalog-body/);
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

test("student guide discovery server-renders only governed published records", async () => {
  const [indexPage, detailPage, helper] = await Promise.all([
    source("app/guides/page.tsx"),
    source("app/guides/[guideSlug]/page.tsx"),
    source("src/server/catalog/public-guide-pages.ts"),
  ]);
  assert.match(indexPage, /listPublishedGuidePages/);
  assert.match(indexPage, /href=\{editorialHref\(`\/guides\/\$\{encodeURIComponent\(guide\.slug\)\}`, locale\)\}/);
  assert.match(detailPage, /getPublishedGuidePage/);
  assert.match(detailPage, /Official sources/);
  assert.match(helper, /PostgresCatalogRepository/);
  for (const sourceText of [indexPage, detailPage, helper]) assert.doesNotMatch(sourceText, /localStorage|sessionStorage|CuacDataClient|cuac-data\.js/);
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
