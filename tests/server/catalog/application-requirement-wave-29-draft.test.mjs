import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRequirementDocument } from "../../../src/server/catalog/requirements.ts";

const path = new URL("../../../seeds/application-requirements-wave-29.draft.json", import.meta.url);
test("SDU 2026 requirements cover every degree-language-tuition-CSCA route without publication", async () => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  assert.equal(draft.summary.templateCount, 27);
  assert.equal(draft.summary.readyTemplateCount, 27);
  assert.equal(draft.summary.blockedTemplateCount, 0);
  assert.equal(draft.summary.targetedProgramCount, 143);
  assert.equal(draft.summary.targetedIntakeCount, 143);
  assert.equal(draft.summary.requirementItemCount, 604);
  const targets = draft.templates.flatMap((template) => template.targetProgramSlugs);
  assert.equal(targets.length, 143);
  assert.equal(new Set(targets).size, 143);
  assert.ok(draft.templates.some((template) => template.document.requirements.some((item) => item.key === "csca" && item.ruleText.includes("STEM Chinese, Mathematics, Physics, Chemistry"))));
  assert.ok(draft.templates.some((template) => template.document.requirements.some((item) => item.key === "language" && item.ruleText.includes("HSK Level 4 with at least 210"))));
  assert.ok(draft.templates.some((template) => template.document.requirements.some((item) => item.key === "language" && item.ruleText.includes("HSK Level 5 with at least 180") && item.ruleText.includes("International Chinese Language Education"))));
  assert.ok(draft.templates.some((template) => template.document.requirements.some((item) => item.key === "tuition" && item.ruleText.includes("RMB 45,000"))));
  assert.ok(draft.templates.every((template) => template.document.coverage === "complete"));
  assert.ok(draft.templates.every((template) => template.targetIntake.term === "Fall" && template.targetIntake.year === 2026));
  for (const template of draft.templates) assert.deepEqual(parseRequirementDocument(template.document), template.document);
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
});
