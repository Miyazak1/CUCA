import assert from "node:assert/strict";
import test from "node:test";
import { CatalogService, createCatalogHttpHandlers } from "../../../src/server/index.ts";

test("catalog HTTP handler returns public data without audit metadata", async () => {
  const service = new CatalogService({
    async listPrograms(options) {
      return [{ id: "program_1", options }];
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
  const handlers = createCatalogHttpHandlers(service);
  const response = await handlers.listPrograms(new Request("https://cuac.test/api/v1/catalog/programs?limit=500&offset=-5&query= ai "));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
  assert.deepEqual(body, {
    data: [
      {
        id: "program_1",
        options: {
          limit: 100,
          offset: 0,
          query: "ai",
        },
      },
    ],
  });
  assert.equal("audit" in body, false);
});

test("catalog HTTP detail handler passes the route identifier to service", async () => {
  const programId = "11111111-1111-4111-8111-111111111111";
  const service = new CatalogService({
    async listPrograms() {
      return [];
    },
    async getProgram(programId) {
      return { id: programId };
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
  const handlers = createCatalogHttpHandlers(service);
  const response = await handlers.getProgram(new Request(`https://cuac.test/api/v1/catalog/programs/${programId}`), programId);

  assert.deepEqual(await response.json(), {
    data: {
      id: programId,
    },
  });
});

test("catalog HTTP detail handlers reject malformed public identifiers", async () => {
  const service = new CatalogService({
    async listPrograms() { return []; },
    async getProgram() { throw new Error("repository should not be called"); },
    async listSchools() { return []; },
    async getSchool() { return null; },
    async listScholarships() { return []; },
    async getScholarship() { return null; },
    async listCities() { return []; },
    async getCity() { throw new Error("repository should not be called"); },
  });
  const handlers = createCatalogHttpHandlers(service);

  const programResponse = await handlers.getProgram(new Request("https://cuac.test/api/v1/catalog/programs/not-a-uuid"), "not-a-uuid");
  const cityResponse = await handlers.getCity(new Request("https://cuac.test/api/v1/catalog/cities/Bad%20Slug"), "Bad Slug");

  assert.equal(programResponse.status, 400);
  assert.equal((await programResponse.json()).error.code, "BAD_REQUEST");
  assert.equal(cityResponse.status, 400);
  assert.equal((await cityResponse.json()).error.code, "BAD_REQUEST");
});
