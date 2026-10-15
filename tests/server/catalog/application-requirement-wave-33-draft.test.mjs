import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRequirementDocument } from "../../../src/server/catalog/requirements.ts";

const path = new URL("../../../seeds/application-requirements-wave-33.draft.json", import.meta.url);
test("HIT 2026 requirements cover every degree-language-tuition-CSCA route without publication", async () => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  assert.equal(draft.summary.templateCount, 10);
  assert.equal(draft.summary.readyTemplateCount, 10);
  assert.equal(draft.summary.blockedTemplateCount, 0);
  assert.equal(draft.summary.targetedProgramCount, 182);
  assert.equal(draft.summary.targetedIntakeCount, 182);
  assert.equal(draft.summary.requirementItemCount, 206);
  const targets = draft.templates.flatMap(template => template.targetProgramSlugs);
  assert.equal(targets.length, 182);
  assert.equal(new Set(targets).size, 182);
  assert.ok(draft.templates.some(template => template.key.includes("humanities-chinese") && template.document.requirements.some(item => item.key === "csca" && item.ruleText.includes("Humanities Chinese"))));
  assert.ok(draft.templates.some(template => template.key.includes("undergraduate-english") && template.document.requirements.some(item => item.key === "language" && item.ruleText.includes("no subtest below 5.5"))));
  assert.ok(draft.templates.some(template => template.key.includes("doctoral-chinese-and-english") && template.document.requirements.some(item => item.key === "tuition" && item.ruleText.includes("42,000"))));
  assert.ok(draft.templates.every(template => template.document.coverage === "complete"));
  assert.ok(draft.templates.every(template => template.targetIntake.term === "Fall" && template.targetIntake.year === 2026));
  for (const template of draft.templates) assert.deepEqual(parseRequirementDocument(template.document), template.document);
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
});
