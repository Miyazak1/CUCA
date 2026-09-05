import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const publicRoot = new URL("../public/", import.meta.url);
const pages = [
  ["programs", "programs", "[data-program-card]"],
  ["universities", "schools", "[data-university-card]"],
  ["scholarships", "scholarships", "[data-scholarship-card]"],
  ["cities", "cities", "[data-city-card]"],
];

async function source(file) {
  return readFile(new URL(file, publicRoot), "utf8");
}

test("public catalog lists load the published APIs without demo data clients", async () => {
  for (const [page, resource] of pages) {
    const [html, script] = await Promise.all([
      source(`${page}.html`),
      source(`${page}.js`),
    ]);

    assert.match(html, new RegExp(`data-catalog-list-page="${page}"`));
    assert.match(html, /catalog-list-api\.js/);
    assert.match(html, /catalog-list-api\.css/);
    assert.doesNotMatch(html, /cuac-data\.js/);
    assert.doesNotMatch(script, /CuacDataClient|actual[A-Z]|contactInfo|fitNotes|qualityScore|missingFields/);
    assert.match(script, new RegExp(`CuacCatalogList\\.load\\("${resource}"`));
    assert.match(script, /data-catalog-retry/);
  }
});

test("catalog list detail routes use public record identities", async () => {
  const [programs, universities, scholarships, cities] = await Promise.all([
    source("programs.js"),
    source("universities.js"),
    source("scholarships.js"),
    source("cities.js"),
  ]);

  assert.match(programs, /program-detail\.html\?program=\$\{encodeURIComponent\(id\)\}/);
  assert.match(programs, /university-detail\.html\?university=\$\{encodeURIComponent\(program\.schoolId\)\}/);
  assert.match(universities, /university-detail\.html\?university=\$\{encodeURIComponent\(item\.id\)\}/);
  assert.match(scholarships, /return String\(item\.id \|\| scholarshipKey\(item\)\)/);
  assert.match(cities, /city-detail\.html\?city=\$\{encodeURIComponent\(citySlug\(city\)\)\}/);
});

test("catalog list UI has explicit loading and failure states", async () => {
  const [api, css] = await Promise.all([
    source("catalog-list-api.js"),
    source("catalog-list-api.css"),
  ]);

  assert.match(api, /Loading published/);
  assert.match(api, /Catalog unavailable/);
  assert.match(api, /data-catalog-retry/);
  assert.match(api, /escapeHtml/);
  assert.match(css, /catalog-list-state-error/);
  assert.match(css, /data-catalog-list-page/);
});
