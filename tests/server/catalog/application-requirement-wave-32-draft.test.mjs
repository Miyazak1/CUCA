import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRequirementDocument } from "../../../src/server/catalog/requirements.ts";

const path = new URL("../../../seeds/application-requirements-wave-32.draft.json", import.meta.url);
test("Nankai 2026 requirements preserve all degree-language-tuition-CSCA routes without publication", async () => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  assert.equal(draft.summary.templateCount, 21);
  assert.equal(draft.summary.readyTemplateCount, 21);
  assert.equal(draft.summary.blockedTemplateCount, 0);
  assert.equal(draft.summary.targetedProgramCount, 339);
  assert.equal(draft.summary.targetedIntakeCount, 339);
  assert.equal(draft.summary.requirementItemCount, 426);
  const targets = draft.templates.flatMap(template => template.targetProgramSlugs);
  assert.equal(targets.length, 339);
  assert.equal(new Set(targets).size, 339);
  assert.ok(draft.templates.some(template => template.key.includes("undergraduate") && template.document.requirements.some(item => item.key === "csca" && item.ruleText.includes("Physics"))));
  assert.ok(draft.templates.some(template => template.key.includes("master-english") && template.document.requirements.some(item => item.key === "language" && item.ruleText.includes("Duolingo 105"))));
  assert.ok(draft.templates.some(template => template.key.includes("doctoral") && template.document.requirements.some(item => item.key === "supervisor_acceptance" && item.level === "required")));
  assert.ok(draft.templates.some(template => template.document.requirements.some(item => item.key === "tuition" && item.ruleText.includes("164,000"))));
  assert.ok(draft.templates.every(template => template.document.coverage === "complete"));
  assert.ok(draft.templates.every(template => template.targetIntake.term === "Fall" && template.targetIntake.year === 2026));
  for (const template of draft.templates) assert.deepEqual(parseRequirementDocument(template.document), template.document);
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
});
