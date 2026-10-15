import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRequirementDocument } from "../../../src/server/catalog/requirements.ts";

const path = new URL("../../../seeds/application-requirements-wave-30.draft.json", import.meta.url);
test("USTB 2026 requirements cover every degree-language-CSCA route without publication", async () => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  assert.equal(draft.summary.templateCount, 8);
  assert.equal(draft.summary.readyTemplateCount, 8);
  assert.equal(draft.summary.blockedTemplateCount, 0);
  assert.equal(draft.summary.targetedProgramCount, 156);
  assert.equal(draft.summary.targetedIntakeCount, 156);
  assert.equal(draft.summary.requirementItemCount, 176);
  const targets = draft.templates.flatMap((template) => template.targetProgramSlugs);
  assert.equal(targets.length, 156);
  assert.equal(new Set(targets).size, 156);
  assert.ok(draft.templates.some((template) => template.key.includes("humanities") && template.document.requirements.some((item) => item.key === "csca" && item.ruleText.includes("Humanities Chinese"))));
  assert.ok(draft.templates.some((template) => template.key.includes("bachelor-english") && template.document.requirements.some((item) => item.key === "csca" && item.ruleText.includes("Mathematics in English"))));
  assert.ok(draft.templates.some((template) => template.key.includes("1-plus-3") && template.document.requirements.some((item) => item.key === "language" && item.ruleText.includes("HSK 5 by graduation"))));
  assert.ok(draft.templates.some((template) => template.document.requirements.some((item) => item.key === "tuition" && item.ruleText.includes("RMB 47,600"))));
  assert.ok(draft.templates.every((template) => template.document.coverage === "complete"));
  assert.ok(draft.templates.every((template) => template.targetIntake.term === "Fall" && template.targetIntake.year === 2026));
  for (const template of draft.templates) assert.deepEqual(parseRequirementDocument(template.document), template.document);
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
});
