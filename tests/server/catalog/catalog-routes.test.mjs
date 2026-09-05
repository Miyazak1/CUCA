import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCatalogRouteHandlers, getCatalogRouteHandlers } from "../../../src/server/index.ts";

test("default catalog route handlers fail closed until PostgreSQL is wired", async () => {
  const response = await getCatalogRouteHandlers().listPrograms(new Request("https://cuac.test/api/v1/catalog/programs"));
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.deepEqual(body.error, {
    code: "SERVICE_UNAVAILABLE",
    message: "PostgreSQL catalog repository is not configured.",
    requestId: body.error.requestId,
  });
});

test("catalog route composition can be injected with a real repository", async () => {
  const handlers = createCatalogRouteHandlers({
    async listPrograms(options) {
      return [{ id: "program_1", options }];
    },
    async getProgram(id) {
      return { id };
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

  const response = await handlers.listPrograms(new Request("https://cuac.test/api/v1/catalog/programs?limit=9"));

  assert.deepEqual(await response.json(), {
    data: [
      {
        id: "program_1",
        options: {
          limit: 9,
          offset: 0,
        },
      },
    ],
  });
});

test("catalog app route files stay thin and do not read demo data directly", async () => {
  const routePaths = [
    "../../../app/api/v1/catalog/programs/route.ts",
    "../../../app/api/v1/catalog/programs/[programId]/route.ts",
    "../../../app/api/v1/catalog/programs/[programId]/intakes/route.ts",
    "../../../app/api/v1/catalog/programs/[programId]/intakes/[intakeId]/requirements/route.ts",
    "../../../app/api/v1/catalog/schools/route.ts",
    "../../../app/api/v1/catalog/schools/[schoolId]/route.ts",
    "../../../app/api/v1/catalog/scholarships/route.ts",
    "../../../app/api/v1/catalog/scholarships/[scholarshipId]/route.ts",
    "../../../app/api/v1/catalog/cities/route.ts",
    "../../../app/api/v1/catalog/cities/[citySlug]/route.ts",
  ];

  const contents = await Promise.all(routePaths.map((routePath) => readFile(new URL(routePath, import.meta.url), "utf8")));

  contents.forEach((source) => {
    assert.match(source, /getCatalogRouteHandlers/);
    assert.doesNotMatch(source, /cuac-data|public\/|design-lab|db\/schema|select\s+\*/i);
  });
});
