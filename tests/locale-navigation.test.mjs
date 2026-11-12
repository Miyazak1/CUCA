import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const runtime = await fs.readFile(new URL("../public/i18n-runtime.js", import.meta.url), "utf8");
test("auth language rewriting preserves nested guide paths in every locale", async () => {
  const auth = await fs.readFile(new URL("../public/auth-i18n.js", import.meta.url), "utf8");
  for (const locale of ["en", "vi", "th", "id", "ms", "ar"]) {
    const window = {};
    const location = new URL(`https://ucac.cn/auth.html?lang=${locale}`);
    const document = { title: "UCAC", body: { dataset: { i18nLocales: "en,vi,th,id,ms,ar" } }, documentElement: {}, createTreeWalker: () => ({ nextNode: () => false }), querySelectorAll: () => [] };
    const context = vm.createContext({ window, document, location, URL, URLSearchParams, navigator: { languages: ["vi-VN"] }, NodeFilter: { SHOW_TEXT: 4 }, MutationObserver: class { observe() {} } });
    vm.runInContext(runtime, context);
    vm.runInContext(auth, context);
    const href = window.CUACAuthI18n.href("/guides/documents?section=passport#check");
    const target = new URL(href, location);
    assert.equal(target.pathname, "/guides/documents");
    assert.equal(target.searchParams.get("lang"), locale);
    assert.equal(target.searchParams.get("section"), "passport");
    assert.equal(target.hash, "#check");
  }
});
for (const locale of ["en", "vi", "th", "id", "ms", "ar"]) {
  test(`explicit ${locale} survives conflicting browser preference and internal navigation`, () => {
    const window = {};
    const location = new URL(`https://ucac.cn/programs.html?lang=${locale}`);
    vm.runInNewContext(runtime, { window, location, URL, URLSearchParams,
      navigator: { languages: [locale === "en" ? "vi-VN" : "en-US"] },
      document: { body: { dataset: { i18nLocales: "en,vi,th,id,ms,ar" } }, documentElement: {} },
    });
    const i18n = window.CUACI18n;
    assert.equal(i18n.locale, locale);
    for (const path of ["/", "universities.html?id=123#results", "/guides/documents?section=passport", "/insights/"]) {
      const url = new URL(i18n.href(path), location);
      assert.equal(url.searchParams.get("lang"), locale);
      if (path.includes("id=")) { assert.equal(url.searchParams.get("id"), "123"); assert.equal(url.hash, "#results"); }
    }
    for (const path of ["#results", "mailto:help@ucac.cn", "tel:123", "https://example.org/guide.html", "/api/v1/me"]) assert.equal(i18n.href(path), path);
    const name = 'Official <University> "A"';
    for (const type of ["program", "university", "scholarship", "city"]) {
      const text = i18n.format(`a11y.${type}Card`, { name });
      assert.ok(text.includes(name), "official name preserved for escaping by renderer");
      assert.ok(!text.includes("{name}"));
      if (locale !== "en") assert.ok(!text.startsWith("View "));
    }
    for (const noun of ["programs", "universities", "scholarships", "cities"]) {
      const text = i18n.t(`catalog.noun.${noun}`);
      assert.ok(text && !text.startsWith("catalog."));
      if (locale !== "en") assert.notEqual(text, noun);
    }
  });
}
