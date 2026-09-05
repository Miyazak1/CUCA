import assert from "node:assert/strict";
import test from "node:test";
import { CatalogService, createRequestContext, normalizeListOptions } from "../../../src/server/index.ts";

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
