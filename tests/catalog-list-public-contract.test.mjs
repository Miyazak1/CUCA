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
    assert.match(script, new RegExp(`CuacCatalogList\\.${page === "programs" ? "loadPage" : "loadAll"}\\("${resource}"`));
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
  assert.match(universities, /CuacCatalogList\.cover\("school", item\)/);
  assert.match(programs, /CuacCatalogList\.cover\("program", program\)/);
  assert.match(programs, /\$\{renderRequirementCards\(program\)\}/);
  assert.match(universities, /item\.cscaSubjects/);
  assert.match(universities, /item\.hskRequirement \|\| item\.englishRequirement/);
  assert.match(scholarships, /return String\(item\.id \|\| scholarshipKey\(item\)\)/);
  assert.match(scholarships, /\.trim\(\)\.toLowerCase\(\)/);
  assert.match(scholarships, /published\.includes\("full"\) && published\.includes\("partial"\)/);
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
  assert.match(api, /async function loadAll/);
  assert.match(api, /page < 100/);
  assert.match(api, /Promise\.all\(Array\.from/);
  assert.match(api, /offset \+= pageSize \* pageCount/);
  assert.match(api, /Object\.freeze\(\{ load, loadPage, loadAll,/);
  assert.match(api, /function cover\(kind, item = \{\}\)/);
  assert.match(api, /data:image\/svg\+xml/);
  assert.match(css, /catalog-list-state-error/);
  assert.match(css, /data-catalog-list-page/);
});

test("program catalog uses server-side pagination and filters", async () => {
  const script = await source("programs.js");
  assert.match(script, /CuacCatalogList\.loadPage\("programs", \{/);
  assert.match(script, /offset: \(state\.page - 1\) \* state\.pageSize/);
  assert.match(script, /degree: state\.filters\.degree/);
  assert.match(script, /programTotal = page\.total/);
  assert.doesNotMatch(script, /remainingPrograms|loadAll\("programs"/);
  assert.match(script, /catalogLoadingComplete = true/);
});

test("catalog save actions use authenticated student saved-item APIs", async () => {
  const [api, programs, universities, scholarships, savedPage] = await Promise.all([
    source("catalog-list-api.js"),
    source("programs.js"),
    source("universities.js"),
    source("scholarships.js"),
    source("favourites-api.html"),
  ]);

  assert.match(api, /credentials: "same-origin"/);
  assert.match(api, /requestSavedItems\("\/api\/v1\/student\/saved-items"/);
  assert.match(api, /method: "POST"/);
  assert.match(api, /method: "DELETE"/);
  assert.match(programs, /setSaved\("program", id, savedNow\)/);
  assert.match(universities, /setSaved\("school", key, savedNow\)/);
  assert.match(scholarships, /setSaved\("scholarship", key, savedNow\)/);
  assert.doesNotMatch(`${api}\n${programs}\n${universities}\n${scholarships}`, /localStorage|sessionStorage/);
  assert.match(savedPage, /href="hub-api\.html"/);
});

test("scholarship pagination stays compact and exposes the current page", async () => {
  const [html, script, css] = await Promise.all([
    source("scholarships.html"),
    source("scholarships.js"),
    source("scholarships.css"),
  ]);

  assert.match(html, /<nav class="pagination" id="pagination" aria-label="Scholarship pagination">/);
  assert.match(script, /function compactPaginationPages\(currentPage, totalPages\)/);
  assert.match(script, /pagination-ellipsis/);
  assert.match(script, /aria-current="page"/);
  assert.match(script, /aria-label="Previous page"/);
  assert.match(script, /aria-label="Next page"/);
  assert.match(css, /\.pagination\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(css, /\.pagination button:disabled/);
});

test("program university routes send the school slug to the published API and render safely", async () => {
  const [html, script, css] = await Promise.all([
    source("programs.html"),
    source("programs.js"),
    source("programs.css"),
  ]);

  assert.match(html, /programs\.js\?v=20260914-server-pagination-2/);
  assert.match(script, /const focusedUniversity = routeParams\.get\("university"\)/);
  assert.match(script, /loadPage\("programs", \{[\s\S]*school: focusedUniversity,/);
  assert.doesNotMatch(script, /function programMatchesUniversity/);
  assert.doesNotMatch(script, /escapeProgramHtml/);
  assert.match(script, /pagination-ellipsis/);
  assert.match(css, /\.pagination-ellipsis/);
});
