import assert from "node:assert/strict";
import test from "node:test";
import {
  PostgresSiteSearchRepository,
  SiteSearchService,
  createSiteSearchHttpHandler,
  normalizeSiteSearchQuery,
} from "../../../src/server/index.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";

test("site search normalizes bilingual queries and preserves requested group order", async () => {
  let received;
  const service = new SiteSearchService({ async search(input) { received = input; return input.types.map(type => ({ type, total: 0, items: [] })); } });
  const result = await service.search(createRequestContext({ requestId: "search-1" }), {
    query: "  ＡＩ\t上海  ", types: ["school", "program", "school"], limit: 12,
  });
  assert.equal(result.query, "AI 上海");
  assert.equal(result.interpretedQuery, "artificial intelligence 上海");
  assert.deepEqual(received, { query: "artificial intelligence 上海", types: ["school", "program"], limit: 12, offset: 0 });
  assert.deepEqual(result.groups.map(group => group.type), ["school", "program"]);
});

test("site search issues query-bound cursors for scoped result pages", async () => {
  let received;
  const service = new SiteSearchService({
    async search(input) {
      received = input;
      return [{ type: "program", total: 3, nextCursor: null, items: [
        { type: "program", id: "1" }, { type: "program", id: "2" },
      ] }];
    },
  });
  const context = createRequestContext({ requestId: "search-cursor" });
  const first = await service.search(context, { query: "cs", types: ["program"], limit: 2 });
  assert.equal(received.query, "computer science");
  assert.equal(typeof first.groups[0].nextCursor, "string");
  await service.search(context, { query: "cs", types: ["program"], limit: 2, cursor: first.groups[0].nextCursor });
  assert.equal(received.offset, 2);
  await assert.rejects(
    service.search(context, { query: "different", types: ["program"], limit: 2, cursor: first.groups[0].nextCursor }),
    error => error.status === 400,
  );
  await assert.rejects(
    service.search(context, { query: "cs", types: ["program"], limit: 2, locale: "zh", cursor: first.groups[0].nextCursor }),
    error => error.status === 400,
  );
});

test("site search projects locale-aware display titles without losing canonical names", async () => {
  const service = new SiteSearchService({ async search() { return [{ type: "school", total: 1, nextCursor: null, items: [{
    type: "school", id: "1", slug: "tsinghua", title: "Tsinghua University", titleZh: "清华大学",
    subtitle: null, summary: null, href: "university-detail.html?university=1", verificationStatus: "verified",
    lastVerifiedAt: null, matchedFields: ["title"],
  }] }]; } });
  const context = createRequestContext({ requestId: "search-locale" });
  const zh = await service.search(context, { query: "清华", types: ["school"], locale: "zh" });
  assert.equal(zh.locale, "zh");
  assert.equal(zh.groups[0].items[0].displayTitle, "清华大学");
  assert.equal(zh.groups[0].items[0].alternateTitle, "Tsinghua University");
  await assert.rejects(service.search(context, { locale: "fr" }), error => error.status === 400);
});

test("site search retries once when the catalog revision changes mid-query", async () => {
  const revisions = ["10", "11", "11", "11"];
  let searches = 0;
  const service = new SiteSearchService({
    async getPublicationRevision() { return revisions.shift(); },
    async search(input) { searches += 1; return input.types.map(type => ({ type, total: 0, nextCursor: null, items: [] })); },
  });
  const result = await service.search(createRequestContext({ requestId: "search-revision" }), { query: "computer" });
  assert.equal(searches, 2);
  assert.equal(result.catalogRevision, "11");
});

test("site search rejects unsupported types and overlong queries before repository access", async () => {
  const service = new SiteSearchService({ async search() { throw new Error("repository should not be called"); } });
  const context = createRequestContext({ requestId: "search-2" });
  await assert.rejects(service.search(context, { query: "ok", types: ["private_record"], limit: 8 }), error => error.status === 400);
  assert.throws(() => normalizeSiteSearchQuery("x".repeat(121)), error => error.status === 400);
});

test("site search HTTP handler returns grouped public results and safe metadata", async () => {
  const handler = createSiteSearchHttpHandler(new SiteSearchService({
    async search(input) { return input.types.map(type => ({ type, total: 0, items: [] })); },
  }));
  const response = await handler(new Request("https://cuac.test/api/v1/search?q=computer%20science&type=program,school&limit=4", {
    headers: { "x-request-id": "request-search" },
  }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.data.query, "computer science");
  assert.deepEqual(body.data.groups.map(group => group.type), ["program", "school"]);
  assert.equal(body.meta.requestId, "request-search");
  assert.equal(Number.isSafeInteger(body.meta.tookMs), true);
  assert.match(response.headers.get("cache-control"), /s-maxage=30/);
  assert.match(response.headers.get("etag"), /^W\//);
  assert.equal(response.headers.get("x-cuac-catalog-revision"), "unversioned");
  assert.match(response.headers.get("surrogate-key"), /cuac-public-catalog/);
});

test("site search uses locale-aware ETags for conditional revalidation", async () => {
  const handler = createSiteSearchHttpHandler(new SiteSearchService({
    async search(input) { return input.types.map(type => ({ type, total: 0, nextCursor: null, items: [] })); },
  }));
  const first = await handler(new Request("https://cuac.test/api/v1/search?q=computer&type=program&locale=zh"));
  const etag = first.headers.get("etag");
  assert.equal(first.headers.get("content-language"), "zh-CN");
  const second = await handler(new Request("https://cuac.test/api/v1/search?q=computer&type=program&locale=zh", {
    headers: { "if-none-match": etag },
  }));
  assert.equal(second.status, 304);
  assert.equal(second.headers.get("etag"), etag);
});

test("site search HTTP errors are not cached", async () => {
  const handler = createSiteSearchHttpHandler(new SiteSearchService({
    async search() { throw new Error("repository should not be called"); },
  }));
  const response = await handler(new Request("https://cuac.test/api/v1/search?q=test&type=private_record"));
  assert.equal(response.status, 400);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("PostgreSQL site search binds every query token and returns safe result cards", async () => {
  const calls = [];
  const repository = new PostgresSiteSearchRepository({
    async query(statement, params) {
      calls.push({ statement, params });
      return [{
        type: "program", id: "11111111-1111-4111-8111-111111111111", slug: "computer-science",
        title: "Computer Science", titleZh: "计算机科学", subtitle: "CUAC University · Hangzhou",
        summary: "Master · English", href: "program-detail.html?program=11111111-1111-4111-8111-111111111111",
        verificationStatus: "verified", lastVerifiedAt: new Date("2026-09-01T00:00:00Z"), total: 1,
      }];
    },
  });
  const [group] = await repository.search({ query: "computer science", types: ["program"], limit: 8, offset: 0 });
  assert.equal(calls.length, 1);
  assert.doesNotMatch(calls[0].statement, /computer science/);
  assert.deepEqual(calls[0].params, ["computer science", "%computer%", "%science%", 8, 0]);
  assert.match(calls[0].statement, /p\.status = 'active'/);
  assert.match(calls[0].statement, /s\.status = 'active'/);
  assert.match(calls[0].statement, /limit \$4 offset \$5/);
  assert.equal(group.total, 1);
  assert.deepEqual(group.items[0].matchedFields, ["title"]);
});
