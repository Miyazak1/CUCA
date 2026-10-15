import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRequirementDocument } from "../../../src/server/catalog/requirements.ts";

const path = new URL("../../../seeds/application-requirements-wave-26.draft.json", import.meta.url);
test("NUAA 2026 requirements cover every published degree route without publication", async () => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  assert.equal(draft.summary.templateCount, 8);
  assert.equal(draft.summary.readyTemplateCount, 8);
  assert.equal(draft.summary.blockedTemplateCount, 0);
  assert.equal(draft.summary.targetedProgramCount, 77);
  assert.equal(draft.summary.targetedIntakeCount, 77);
  assert.equal(draft.templates.flatMap((template) => template.targetProgramSlugs).length, 77);
  assert.equal(draft.templates.filter((template) => template.key.includes("undergraduate-")).length, 4);
  assert.equal(draft.templates.filter((template) => template.key.includes("master-")).length, 2);
  assert.equal(draft.templates.filter((template) => template.key.includes("doctoral-")).length, 2);
  assert.ok(draft.templates.some((template) => template.document.requirements.some((item) => item.key === "csca" && item.ruleText.includes("Mathematics and Physics"))));
  assert.ok(draft.templates.some((template) => template.document.requirements.some((item) => item.key === "supervisor_acceptance")));
  assert.ok(draft.templates.every((template) => template.document.coverage === "complete"));
  assert.ok(draft.templates.every((template) => template.targetIntake.term === "Fall" && template.targetIntake.year === 2026));
  for (const template of draft.templates) assert.deepEqual(parseRequirementDocument(template.document), template.document);
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
});
