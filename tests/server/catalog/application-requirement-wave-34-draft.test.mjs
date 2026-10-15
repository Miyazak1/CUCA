import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRequirementDocument } from "../../../src/server/catalog/requirements.ts";

const path = new URL("../../../seeds/application-requirements-wave-34.draft.json", import.meta.url);
test("NWPU 2026 requirements preserve all exact degree-language-tuition-CSCA routes without publication", async () => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  assert.equal(draft.summary.templateCount, 14);
  assert.equal(draft.summary.readyTemplateCount, 14);
  assert.equal(draft.summary.blockedTemplateCount, 0);
  assert.equal(draft.summary.targetedProgramCount, 96);
  assert.equal(draft.summary.targetedIntakeCount, 96);
  assert.equal(draft.summary.requirementItemCount, 358);
  const targets = draft.templates.flatMap(template => template.targetProgramSlugs);
  assert.equal(targets.length, 96);
  assert.equal(new Set(targets).size, 96);
  assert.ok(draft.templates.some(template => template.key.includes("liberal-arts-chinese") && template.document.requirements.some(item => item.key === "csca" && item.ruleText.includes("Liberal Arts Chinese"))));
  assert.ok(draft.templates.some(template => template.key.includes("master-english") && template.document.requirements.some(item => item.key === "language" && item.ruleText.includes("PTE Academic 60"))));
  assert.ok(draft.templates.some(template => template.key.includes("doctoral") && template.document.requirements.some(item => item.key === "research_outputs" && item.level === "required")));
  assert.ok(draft.templates.every(template => template.document.coverage === "complete"));
  assert.ok(draft.templates.every(template => template.targetIntake.term === "Fall" && template.targetIntake.year === 2026));
  for (const template of draft.templates) assert.deepEqual(parseRequirementDocument(template.document), template.document);
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
});
