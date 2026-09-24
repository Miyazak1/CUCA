import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("empty city catalog hides data-dependent feature sections", async () => {
  const [html, css, script] = await Promise.all([
    source("public/cities.html"),
    source("public/cities.css"),
    source("public/cities.js"),
  ]);

  assert.ok((html.match(/data-city-dependent/g) || []).length >= 6);
  assert.match(css, /\[data-city-dependent\]\[hidden\]\s*\{[\s\S]*?display:\s*none\s*!important/);
  assert.match(script, /querySelectorAll\("\[data-city-dependent\]"\)[\s\S]*?section\.hidden = cities\.length === 0/);
});

test("local city publication is explicitly local, hash-bound, backed up and transactional", async () => {
  const [script, packageJson] = await Promise.all([
    source("scripts/catalog-city-publish-local.ts"),
    source("package.json"),
  ]);

  assert.match(script, /publish-owner-accepted-city-catalog-to-cuac-local/);
  assert.match(script, /assertLocalDevelopmentState\(runtime\)/);
  assert.match(script, /cityCandidateSha256\(currentPreimage\)[\s\S]*?preimageSha256/);
  assert.match(script, /local-publication-backups/);
  assert.match(script, /begin isolation level serializable/);
  assert.match(script, /status='active', verification_status='verified'/);
  assert.match(script, /await connection\.query\("commit"\)/);
  assert.match(script, /await connection\.query\("rollback"\)/);
  assert.match(packageJson, /"catalog:cities:publish-local"/);
});
