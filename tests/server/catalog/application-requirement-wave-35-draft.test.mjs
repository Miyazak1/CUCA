import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRequirementDocument } from "../../../src/server/catalog/requirements.ts";

const path = new URL("../../../seeds/application-requirements-wave-35.draft.json", import.meta.url);
test("SCU 2026 requirements preserve all exact degree-language routes and published category boundaries without publication", async () => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  assert.equal(draft.summary.templateCount, 7);
  assert.equal(draft.summary.readyTemplateCount, 7);
  assert.equal(draft.summary.blockedTemplateCount, 0);
  assert.equal(draft.summary.targetedProgramCount, 639);
  assert.equal(draft.summary.targetedIntakeCount, 639);
  assert.equal(draft.summary.requirementItemCount, 140);
  const targets = draft.templates.flatMap(template => template.targetProgramSlugs);
  assert.equal(targets.length, 639);
  assert.equal(new Set(targets).size, 639);
  assert.ok(draft.templates.some(template => template.key.includes("bachelor-chinese") && template.document.requirements.some(item => item.key === "csca" && item.ruleText.includes("medical English"))));
  assert.ok(draft.templates.some(template => template.key.includes("bachelor-english") && template.document.requirements.some(item => item.key === "language" && item.ruleText.includes("TOEFL 80"))));
  assert.ok(draft.templates.some(template => template.key.includes("master-chinese") && template.document.requirements.some(item => item.key === "tuition" && item.ruleText.includes("CNY 22,000-50,000/year"))));
  assert.ok(draft.templates.some(template => template.key.includes("doctoral-english") && template.document.requirements.some(item => item.key === "education" && item.ruleText === "Hold a master's degree.")));
  assert.ok(draft.templates.every(template => template.document.coverage === "complete"));
  assert.ok(draft.templates.every(template => template.targetIntake.term === "Fall" && template.targetIntake.year === 2026));
  assert.ok(draft.templates.every(template => template.unresolvedNotes.some(note => note.includes("category"))));
  for (const template of draft.templates) assert.deepEqual(parseRequirementDocument(template.document), template.document);
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
});
