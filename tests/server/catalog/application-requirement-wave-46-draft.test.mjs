import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const draft = JSON.parse(await readFile(new URL("../../../seeds/application-requirements-wave-46.draft.json", import.meta.url), "utf8"));
const seed = JSON.parse(await readFile(new URL("../../../seeds/catalog.ucas-complete-batch-01.draft.json", import.meta.url), "utf8"));

test("UCAS requirements exactly cover the 174 officially indexed English master's routes", () => {
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
  assert.deepEqual(draft.summary, { templateCount: 1, readyTemplateCount: 1, blockedTemplateCount: 0, targetedProgramCount: 174, targetedIntakeCount: 174, requirementItemCount: 17 });
  assert.equal(seed.scholarships.length, 3);
  assert.ok(seed.programs.every((program) => program.degreeLevel === "Master" && program.teachingLanguage === "English" && program.tuitionText === "RMB 30,000/year"));
  assert.ok(seed.programIntakes.every((intake) => intake.intakeTerm === "Fall" && intake.intakeYear === 2026 && intake.deadlineDate === "2026-04-15T00:00:00.000Z" && intake.status === "closed"));
  const template = draft.templates[0];
  assert.equal(template.document.coverage, "complete");
  assert.deepEqual(new Set(template.targetProgramSlugs), new Set(seed.programs.map((program) => program.slug)));
  assert.match(template.unresolvedNotes[0], /does not claim to cover Chinese-instructed or doctoral routes/);
  assert.ok(template.document.sources.some((source) => source.key === "guide" && source.contentSha256 === "becc112bc169655952fa8a41172e6fdc60162744489a265527a8838521fbb45c"));
  assert.ok(template.document.sources.some((source) => source.key === "catalog" && source.contentSha256 === "f99b9c7944a3ebb77a7d4a849985e442d86d6f1696907871beb63ad5456b2366"));
});
