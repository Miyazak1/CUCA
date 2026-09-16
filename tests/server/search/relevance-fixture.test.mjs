import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { expandSiteSearchQuery, normalizeSiteSearchQuery, SITE_SEARCH_TYPES } from "../../../src/server/index.ts";

const fixtureUrl = new URL("../../fixtures/site-search-relevance.json", import.meta.url);

test("reviewed site-search relevance cases retain their intended canonical terms", async () => {
  const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
  assert.equal(fixture.version, 1);
  assert.match(fixture.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(fixture.cases.length >= 8);
  const keys = new Set();
  for (const item of fixture.cases) {
    assert.ok(SITE_SEARCH_TYPES.includes(item.type), item.query);
    const normalized = normalizeSiteSearchQuery(item.query);
    const interpreted = expandSiteSearchQuery(normalized);
    assert.equal(interpreted, item.interpretedQuery, item.query);
    assert.deepEqual(interpreted.split(/\s+/), item.tokens, item.query);
    const key = `${item.type}:${normalized.toLocaleLowerCase()}`;
    assert.equal(keys.has(key), false, `duplicate relevance case: ${key}`);
    keys.add(key);
  }
});
