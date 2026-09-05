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

  assert.match(html, /<body data-agent-mode="off">/);
  assert.match(html, /saved-workspace\.css\?v=/);
  assert.match(html, /src="shared-shell\.js"/);
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
