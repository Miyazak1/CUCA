import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = path => readFile(new URL(path, root), "utf8");

test("saved-items candidate uses authenticated APIs without demo state", async () => {
  const [html, script] = await Promise.all([
    source("public/favourites-api.html"),
    source("public/favourites-runtime.js"),
  ]);

  assert.match(html, /<body data-agent-mode="off" data-i18n-locales="en,vi,th,id,ms,ar">/);
  assert.match(html, /saved-workspace\.css\?v=/);
  assert.match(html, /src="shared-shell\.js(?:\?[^\"]*)?"/);
  assert.match(html, /src="favourites-runtime\.js\?v=/);
  assert.doesNotMatch(html, /cuac-data\.js|cuac-actions\.js|favourites\.js|data-cuac-agent/);
  assert.match(script, /requestJson\("\/api\/v1\/student\/saved-items"\)/);
  assert.match(script, /\/api\/v1\/student\/saved-items\/\$\{encodeURIComponent\(savedItemId\)\}/);
  assert.match(script, /method: "DELETE"/);
  assert.match(script, /requiredRole: "student"/);
  assert.match(script, /credentials: "same-origin"/);
  assert.doesNotMatch(script, /localStorage|sessionStorage|CuacDataClient|DemoState|applicationDemo|mock/i);
});

test("saved-items candidate consumes only the minimal catalog projection", async () => {
  const script = await source("public/favourites-runtime.js");

  for (const field of ["id", "slug", "nameEn", "nameZh", "status", "sourceStatus", "lastVerifiedAt"]) {
    assert.ok(script.includes(`catalog.${field}`) || script.includes(`value.${field}`), `missing catalog summary field: ${field}`);
  }
  for (const type of ["program", "school", "scholarship", "city"]) assert.ok(script.includes(`${type}:`));
  assert.match(script, /program-detail\.html\?program=/);
  assert.match(script, /university-detail\.html\?university=/);
  assert.match(script, /scholarship-detail\.html\?scholarship=/);
  assert.match(script, /city-detail\.html\?city=/);
  assert.match(script, /JSON\.stringify\(\{ entityType: item\.entityType, entityId: item\.entityId, notes \}\)/);
  assert.doesNotMatch(script, /add.*application|compare|rankOrder|applicationSetId/i);
});

test("saved-items workspace stays restrained and responsive", async () => {
  const [html, css] = await Promise.all([
    source("public/favourites-api.html"),
    source("public/saved-workspace.css"),
  ]);

  assert.match(html, /role="tablist"/);
  assert.match(html, /aria-live="polite" data-saved-view/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 520px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient|border-radius:\s*(?:[1-9][0-9]|[1-9][0-9][0-9])px/);
});

test("saved items localize student controls while preserving catalog and private content", async () => {
  const [html, messages, script] = await Promise.all([
    source("public/favourites-api.html"),
    source("public/favourites-i18n.js"),
    source("public/favourites-runtime.js"),
  ]);
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(match => match[1].split("?")[0]);
  assert.ok(scripts.indexOf("i18n-runtime.js") < scripts.indexOf("favourites-i18n.js"));
  assert.ok(scripts.indexOf("favourites-i18n.js") < scripts.indexOf("shared-shell.js"));
  assert.ok(scripts.indexOf("shared-shell.js") < scripts.indexOf("favourites-runtime.js"));
  assert.match(script, /new Intl\.DateTimeFormat\(savedLocale/);
  assert.match(script, /localizedHref\(`program-detail\.html\?program=/);
  assert.match(script, /ui\(savedTypeLabels\[item\.entityType\]\)/);
  assert.match(script, /item\.notes \|\| ""/);
  assert.match(script, /catalog\?\.nameEn/);
  assert.doesNotMatch(script, /translate|machineTranslation|machine_translation/i);
  for (const marker of ["Mục đã lưu", "รายการที่บันทึก", "Item tersimpan", "العناصر المحفوظة"]) {
    assert.match(messages, new RegExp(marker));
  }
  for (const status of ["Verified", "Unverified", "Stale", "Disputed", "Invalid"]) {
    assert.match(messages, new RegExp(`\\[\\"${status}\\"`));
  }
  assert.match(messages, /MutationObserver/);
  assert.match(messages, /url\.searchParams\.set\("lang", i18n\.locale\)/);
  assert.match(messages, /"TEXTAREA"/);
});
