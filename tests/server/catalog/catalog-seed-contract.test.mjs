import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCatalogSeedImportPlan, validateCatalogSeedBundle } from "../../../src/server/index.ts";

test("catalog seed sample validates as a dry-run contract", async () => {
  const sample = JSON.parse(await readFile(new URL("../../../seeds/catalog.sample.json", import.meta.url), "utf8"));
  const result = validateCatalogSeedBundle(sample);

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.summary, {
    cities: 1,
    schools: 1,
    programs: 1,
    scholarships: 1,
  });
});

test("catalog seed import plan is ordered for idempotent PostgreSQL upserts", async () => {
  const sample = JSON.parse(await readFile(new URL("../../../seeds/catalog.sample.json", import.meta.url), "utf8"));
  const plan = createCatalogSeedImportPlan(sample);

  assert.equal(plan.ok, true);
  assert.deepEqual(
    plan.operations.map((operation) => operation.idempotencyKey),
    [
      "city:beijing",
      "school:sample-university",
      "program:sample-university-computer-science-bachelor",
      "scholarship:sample-scholarship",
    ],
  );
  assert.deepEqual(plan.operations.map((operation) => operation.order), [1, 2, 3, 4]);
  assert.deepEqual(plan.operations[1].dependencyKeys, ["city:beijing"]);
  assert.deepEqual(plan.operations[2].dependencyKeys, ["school:sample-university"]);
  assert.deepEqual(plan.operations[3].dependencyKeys, [
    "school:sample-university",
    "program:sample-university-computer-science-bachelor",
  ]);
  assert.equal(plan.operations[0].sourceEvidence.sourceUrl, "https://example.edu/catalog/beijing");
  assert.deepEqual(plan.operations[0].sourceEvidence.sourceFieldLineage, { nameEn: "source.name" });
});

test("catalog seed import plan does not produce operations for invalid bundles", () => {
  const plan = createCatalogSeedImportPlan({
    version: 1,
    generatedAt: "2026-08-28T00:00:00.000Z",
    programs: [{ slug: "program-a", schoolSlug: "missing-school", nameEn: "Program A", degreeLevel: "bachelor" }],
  });

  assert.equal(plan.ok, false);
  assert.deepEqual(plan.operations, []);
});

test("catalog seed validation rejects missing source evidence and broken references", () => {
  const result = validateCatalogSeedBundle({
    version: 1,
    generatedAt: "2026-08-28T00:00:00.000Z",
    schools: [{ slug: "school-a", nameEn: "School A", sourceUrl: "https://example.edu", sourceLabel: "Example" }],
    programs: [{ slug: "program-a", schoolSlug: "missing-school", nameEn: "Program A", degreeLevel: "bachelor" }],
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /programs\[0\]\.sourceUrl is required/);
  assert.match(result.errors.join("\n"), /programs\[0\]\.schoolSlug references unknown school missing-school/);
});
