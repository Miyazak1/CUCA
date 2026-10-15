import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const draft = JSON.parse(await readFile(new URL("../../../seeds/application-requirements-wave-49.draft.json", import.meta.url), "utf8"));
const seed = JSON.parse(await readFile(new URL("../../../seeds/catalog.xtu-safe-new-batch-01.draft.json", import.meta.url), "utf8"));

test("XTU requirements include complete graduate routes and exclude unresolved undergraduate CSCA bindings", () => {
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
  assert.deepEqual(draft.summary, { templateCount: 4, readyTemplateCount: 4, blockedTemplateCount: 0, targetedProgramCount: 76, targetedIntakeCount: 76, excludedProgramCount: 20, scholarshipCount: 1, requirementItemCount: 76 });
  const targets = draft.templates.flatMap((template) => template.targetProgramSlugs);
  const graduate = seed.programs.filter((program) => program.degreeLevel === "Master" || program.degreeLevel === "Doctoral");
  const undergraduate = seed.programs.filter((program) => program.degreeLevel === "Undergraduate");
  assert.deepEqual(new Set(targets), new Set(graduate.map((program) => program.slug)));
  assert.ok(undergraduate.every((program) => !targets.includes(program.slug)));
  assert.ok(draft.templates.every((template) => template.document.coverage === "complete" && template.reviewStatus === "unreviewed"));
  assert.ok(draft.templates.every((template) => template.document.sources.some((source) => source.key === "guide" && source.contentSha256 === "677a02dabd412977334a82ad73b59cd90ecf4e271e7b7fcb5266601fa5add7f5")));
  assert.ok(draft.templates.every((template) => template.document.requirements.some((entry) => entry.key === "deadline" && entry.ruleText.includes("April 30, 2026"))));
  assert.ok(draft.templates.every((template) => template.document.requirements.some((entry) => entry.key === "tuition" && /CNY (18,000|23,000)\/year/.test(entry.ruleText))));
});
