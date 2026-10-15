import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRequirementDocument } from "../../../src/server/catalog/requirements.ts";

const path = new URL("../../../seeds/application-requirements-wave-27.draft.json", import.meta.url);
test("USTC 2026 requirements cover every published degree-language route without publication", async () => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  assert.equal(draft.summary.templateCount, 6);
  assert.equal(draft.summary.readyTemplateCount, 6);
  assert.equal(draft.summary.blockedTemplateCount, 0);
  assert.equal(draft.summary.targetedProgramCount, 287);
  assert.equal(draft.summary.targetedIntakeCount, 287);
  assert.equal(draft.templates.flatMap((template) => template.targetProgramSlugs).length, 287);
  assert.equal(draft.templates.filter((template) => template.key.includes("undergraduate-")).length, 1);
  assert.equal(draft.templates.filter((template) => template.key.includes("master-")).length, 3);
  assert.equal(draft.templates.filter((template) => template.key.includes("doctoral-")).length, 2);
  assert.ok(draft.templates.some((template) => template.document.requirements.some((item) => item.key === "csca" && item.ruleText.includes("Physics or Chemistry"))));
  assert.ok(draft.templates.some((template) => template.document.requirements.some((item) => item.key === "tuition" && item.ruleText.includes("150,000"))));
  assert.ok(draft.templates.every((template) => template.document.coverage === "complete"));
  assert.ok(draft.templates.every((template) => template.targetIntake.term === "Fall" && template.targetIntake.year === 2026));
  for (const template of draft.templates) assert.deepEqual(parseRequirementDocument(template.document), template.document);
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
});
