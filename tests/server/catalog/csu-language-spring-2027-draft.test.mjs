import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCatalogMigrationValidationReport } from "../../../src/server/catalog/seed-contract.ts";

const candidatePath = new URL("../../../seeds/catalog.csu-language-spring-2027.draft.json", import.meta.url);
const validationPath = new URL("../../../seeds/catalog.csu-language-spring-2027.validation.json", import.meta.url);
test("CSU Spring 2027 language route remains an exact non-public draft", async () => {
  const candidate = JSON.parse(await readFile(candidatePath, "utf8"));
  const validation = JSON.parse(await readFile(validationPath, "utf8"));
  const report = createCatalogMigrationValidationReport(candidate);
  assert.equal(report.ok, true);
  assert.deepEqual(report.summary, { cities: 1, schools: 1, programs: 1, programIntakes: 1, scholarships: 0 });
  assert.equal(candidate.programs[0].slug, "central-south-university-iclts-one-semester-chinese-language-spring-2027");
  assert.equal(candidate.programs[0].degreeLevel, "Non-degree");
  assert.match(candidate.programs[0].scholarshipText, /2,500/);
  assert.equal(candidate.programIntakes[0].intakeTerm, "Spring");
  assert.equal(candidate.programIntakes[0].intakeYear, 2027);
  assert.equal(candidate.programIntakes[0].status, "open");
  assert.equal(validation.sourceReview.status, "unreviewed_draft");
  assert.equal(validation.databaseWriteAuthorized, false);
  assert.equal(validation.publicationAuthorized, false);
});
