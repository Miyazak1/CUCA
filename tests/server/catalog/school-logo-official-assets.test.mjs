import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { prepareSchoolLogo } from "../../../src/server/catalog/school-logo.ts";
import { validateOfficialCatalogSourceRegistry } from "../../../src/server/catalog/official-source.ts";

const root = new URL("../../../", import.meta.url);
const read = path => readFile(new URL(path, root));
const registry = JSON.parse(await read("catalog-sources/school-logo-sources.20261121.json"));
const review = JSON.parse(await read("catalog-sources/school-logo-review.20261121.json"));
const seed = JSON.parse(await read("seeds/school-logos.official-20261121.json"));

test("all 100 reviewed school logos are valid PNGs with exact registered official provenance", async () => {
  assert.deepEqual(validateOfficialCatalogSourceRegistry(registry), []);
  assert.equal(seed.schools.length, 100);
  assert.equal(new Set(seed.schools.map(x => x.slug)).size, 100);
  assert.equal(review.schools.length, 100);
  for (const school of seed.schools) {
    const item = review.schools.find(x => x.slug === school.slug);
    assert.deepEqual(item.logo, school.logo);
    const source = registry.sources.find(x => x.id === item.evidence.sourceId);
    assert.equal(source.schoolSlug, school.slug);
    assert.equal(source.url, school.logo.sourceUrl);
    assert.match(new URL(source.url).hostname, /\.(?:edu|ac)\.cn$/);
    assert.equal(item.evidence.source.status, 200);
    const bytes = await read(school.logo.file);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), item.evidence.outputSha256);
    const prepared = prepareSchoolLogo(bytes, school.logo.sourceUrl, school.logo.sourceNote);
    assert.equal(prepared.sha256, item.evidence.normalizedSha256);
    assert.equal(prepared.width, 256);
    assert.equal(prepared.height, 256);
  }
});

test("all 12 legacy assets retain their old provenance and have an official-source replacement", async () => {
  const initial = JSON.parse(await read("seeds/school-logos.initial.json"));
  assert.equal(review.legacy12.length, 12);
  for (const old of initial.schools) {
    const audited = review.legacy12.find(x => x.slug === old.slug);
    assert.equal(audited.originalSourceUrl, old.logo.sourceUrl);
    assert.equal(audited.officialSourceUrl, seed.schools.find(x => x.slug === old.slug).logo.sourceUrl);
    assert.notEqual(audited.originalSourceUrl, audited.officialSourceUrl);
  }
});

test("official migration contains each normalized logo once and protects staff edits and removals", async () => {
  const sql = (await read("drizzle/pg/0082_school_logo_official_assets.sql")).toString();
  assert.equal((sql.match(/INSERT INTO school_logo_versions/g) || []).length, 100);
  assert.match(sql, /ORDER BY id FOR UPDATE/);
  assert.match(sql, /current\.actor_user_id IS NULL/);
  assert.match(sql, /current\.source_note=/);
  assert.match(sql, /current\.version IS NULL/);
  for (const item of review.schools) {
    assert.ok(sql.includes(`s.slug='${item.slug}'`));
    assert.ok(sql.includes(`'${item.evidence.normalizedSha256}'`));
  }
});
