import assert from "node:assert/strict";
import test from "node:test";
import { CatalogService, createRequestContext, normalizeListOptions, normalizeProgramListOptions } from "../../../src/server/index.ts";

test("normalizes public catalog pagination without trusting client extremes", () => {
  assert.deepEqual(normalizeListOptions({ limit: 1000, offset: -20, query: "  cs  " }), {
    limit: 100,
    offset: 0,
    query: "cs",
  });

  assert.deepEqual(normalizeListOptions({ limit: 0 }), {
    limit: 1,
    offset: 0,
    query: undefined,
  });
});

test("CatalogService authorizes guest public reads through policy", async () => {
  const calls = [];
  const service = new CatalogService({
    async listPrograms(options) {
      calls.push(options);
      return [{ id: "program_1" }];
    },
    async getProgram() {
      return null;
    },
    async listSchools() {
      return [];
    },
    async getSchool() {
      return null;
    },
    async listScholarships() {
      return [];
    },
    async getScholarship() {
      return null;
    },
    async listCities() {
      return [];
    },
    async getCity() {
      return null;
    },
  });

  const result = await service.listPrograms(createRequestContext(), { limit: 250, offset: -1 });

  assert.deepEqual(result, [{ id: "program_1" }]);
  assert.deepEqual(calls, [{ limit: 100, offset: 0, query: undefined }]);
});

test("program pages preserve normalized server-side filters and totals", async () => {
  const calls = [];
  const service = new CatalogService({
    async listPrograms(options) { calls.push(["list", options]); return [{ id: "program_1" }]; },
    async countPrograms(options) { calls.push(["count", options]); return 321; },
    async getProgram() { return null; },
    async listSchools() { return []; }, async getSchool() { return null; },
    async listScholarships() { return []; }, async getScholarship() { return null; },
    async listCities() { return []; }, async getCity() { return null; },
  });

  const page = await service.listProgramsPage(createRequestContext(), {
    limit: 8, offset: 16, query: "  computer science  ", degree: " master ", language: "english",
    scholarship: true, sort: "tuition",
  });

  assert.deepEqual(page, { items: [{ id: "program_1" }], total: 321, limit: 8, offset: 16 });
  assert.equal(calls.length, 2);
  assert.equal(calls[0][1].query, "computer science");
  assert.equal(calls[0][1].degree, "master");
  assert.equal(calls[0][1].scholarship, true);
  assert.equal(calls[0][1].sort, "tuition");
  assert.deepEqual(calls[0][1], calls[1][1]);
  assert.equal(normalizeProgramListOptions({ limit: 1000, offset: -1 }).limit, 100);
});

test("CatalogService denies when public catalog data class is absent", async () => {
  const service = new CatalogService({
    async listPrograms() {
      throw new Error("repository should not be called");
    },
    async getProgram() {
      return null;
    },
    async listSchools() {
      return [];
    },
    async getSchool() {
      return null;
    },
    async listScholarships() {
      return [];
    },
    async getScholarship() {
      return null;
    },
    async listCities() {
      return [];
    },
    async getCity() {
      return null;
    },
  });

  await assert.rejects(
    () =>
      service.listPrograms(
        createRequestContext({
          dataClassAllowlist: [],
        }),
      ),
    /Data class is not allowed/,
  );
});

test("CatalogService exposes only normalized published guide reads", async () => {
  const calls = [];
  const service = new CatalogService({
    async listGuides(options) { calls.push(["list", options]); return [{ slug: "documents" }]; },
    async getGuide(slug) { calls.push(["detail", slug]); return { slug }; },
  });
  const context = createRequestContext();
  assert.deepEqual(await service.listGuides(context, { query: "  passport  ", limit: 500 }), [{ slug: "documents" }]);
  assert.deepEqual(await service.getGuide(context, "Visa-Arrival"), { slug: "visa-arrival" });
  assert.deepEqual(calls, [
    ["list", { query: "passport", limit: 100, offset: 0 }],
    ["detail", "visa-arrival"],
  ]);
  await assert.rejects(service.getGuide(context, "bad guide"), error => error.status === 400);
});
