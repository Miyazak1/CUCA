import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRequirementDocument } from "../../../src/server/catalog/requirements.ts";

const path = new URL("../../../seeds/application-requirements-wave-28.draft.json", import.meta.url);
test("TJU 2027 requirements cover every published degree-language-tuition-CSCA route without publication", async () => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  assert.equal(draft.summary.templateCount, 29);
  assert.equal(draft.summary.readyTemplateCount, 29);
  assert.equal(draft.summary.blockedTemplateCount, 0);
  assert.equal(draft.summary.targetedProgramCount, 324);
  assert.equal(draft.summary.targetedIntakeCount, 324);
  const targets = draft.templates.flatMap((template) => template.targetProgramSlugs);
  assert.equal(targets.length, 324);
  assert.equal(new Set(targets).size, 324);
  assert.ok(draft.templates.some((template) => template.document.requirements.some((item) => item.key === "csca" && item.ruleText.includes("Physics or Chemistry"))));
  assert.ok(draft.templates.some((template) => template.document.requirements.some((item) => item.key === "tuition" && item.ruleText.includes("RMB 150,000 in Year 1"))));
  assert.ok(draft.templates.some((template) => template.document.requirements.some((item) => item.key === "tuition" && item.ruleText.includes("RMB 276,000 total for 3 years"))));
  assert.ok(draft.templates.some((template) => template.document.requirements.some((item) => item.key === "mba_special")));
  assert.ok(draft.templates.every((template) => template.document.coverage === "complete"));
  assert.ok(draft.templates.every((template) => template.targetIntake.term === "Fall" && template.targetIntake.year === 2027));
  for (const template of draft.templates) assert.deepEqual(parseRequirementDocument(template.document), template.document);
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
});
