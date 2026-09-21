import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
