import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCatalogMigrationValidationReport } from "../../../src/server/catalog/seed-contract.ts";

const candidatePath = new URL("../../../seeds/catalog.lnutcm-language-spring-2027.draft.json", import.meta.url);
const validationPath = new URL("../../../seeds/catalog.lnutcm-language-spring-2027.validation.json", import.meta.url);
test("LNUTCM self-funded Spring 2027 route stays separate from the scholarship route", async () => {
  const candidate = JSON.parse(await readFile(candidatePath, "utf8"));
  const validation = JSON.parse(await readFile(validationPath, "utf8"));
  const report = createCatalogMigrationValidationReport(candidate);
  assert.equal(report.ok, true);
  assert.deepEqual(report.summary, { cities: 1, schools: 1, programs: 1, programIntakes: 1, scholarships: 0 });
  assert.match(candidate.programs[0].slug, /self-funded-spring-2027$/);
  assert.equal(candidate.programs[0].hasScholarship, false);
  assert.equal(candidate.programIntakes[0].deadlineDate, "2026-12-25T15:59:59.000Z");
  assert.equal(validation.sourceReview.visuallyInspectedImages, 6);
  assert.equal(validation.databaseWriteAuthorized, false);
  assert.equal(validation.publicationAuthorized, false);
});
