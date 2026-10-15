import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const draft = JSON.parse(await readFile(new URL("../../../seeds/application-requirements-wave-50.draft.json", import.meta.url), "utf8"));
const seed = JSON.parse(await readFile(new URL("../../../seeds/catalog.ecnu-safe-new-batch-01.draft.json", import.meta.url), "utf8"));

test("ECNU requirements cover all 280 routes with normalized English-medium markers", () => {
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
  assert.deepEqual(draft.summary, { templateCount: 40, readyTemplateCount: 40, blockedTemplateCount: 0, targetedProgramCount: 280, targetedIntakeCount: 280, excludedProgramCount: 0, scholarshipCount: 8, requirementItemCount: 725 });
  const targets = draft.templates.flatMap((template) => template.targetProgramSlugs);
  assert.deepEqual(new Set(targets), new Set(seed.programs.map((program) => program.slug)));
  assert.equal(targets.length, 280);
  assert.ok(seed.programs.filter((program) => /English Taught|\(in English\)/i.test(program.nameEn)).every((program) => program.teachingLanguage === "English" && program.hskRequirement.startsWith("No HSK requirement")));
  assert.ok(draft.templates.every((template) => template.document.coverage === "complete" && template.reviewStatus === "unreviewed"));
  assert.ok(draft.templates.every((template) => template.document.requirements.some((entry) => entry.key === "deadline" && entry.ruleText.includes("June 1, 2026"))));
  assert.ok(draft.templates.every((template) => template.document.requirements.some((entry) => entry.key === "tuition" && /\d+ RMB\/year/.test(entry.ruleText))));
  assert.ok(draft.templates.filter((template) => template.targetProgramSlugs.some((slug) => seed.programs.find((program) => program.slug === slug)?.degreeLevel === "Bachelor")).every((template) => template.document.requirements.some((entry) => entry.key === "csca")));
});
