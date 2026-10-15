import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRequirementDocument } from "../../../src/server/catalog/requirements.ts";

const path = new URL("../../../seeds/application-requirements-wave-31.draft.json", import.meta.url);
test("XMU 2026 requirements cover all 535 degree routes without publication", async () => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  assert.equal(draft.summary.templateCount, 8);
  assert.equal(draft.summary.readyTemplateCount, 8);
  assert.equal(draft.summary.blockedTemplateCount, 0);
  assert.equal(draft.summary.targetedProgramCount, 535);
  assert.equal(draft.summary.targetedIntakeCount, 535);
  assert.equal(draft.summary.requirementItemCount, 184);
  const targets = draft.templates.flatMap((template) => template.targetProgramSlugs);
  assert.equal(targets.length, 535);
  assert.equal(new Set(targets).size, 535);
  assert.ok(draft.templates.some((template) => template.key.includes("english-mbbs") && template.document.requirements.some((item) => item.key === "csca" && item.ruleText.includes("Physics and/or Chemistry"))));
  assert.ok(draft.templates.some((template) => template.key.includes("english-arts") && template.document.requirements.some((item) => item.key === "csca" && item.ruleText.includes("not listed as required"))));
  assert.ok(draft.templates.some((template) => template.key.includes("doctoral") && template.document.requirements.some((item) => item.key === "tuition" && item.ruleText.includes("fourth academic year"))));
  assert.ok(draft.templates.every((template) => template.document.coverage === "complete"));
  assert.ok(draft.templates.every((template) => template.targetIntake.term === "Fall" && template.targetIntake.year === 2026));
  for (const template of draft.templates) assert.deepEqual(parseRequirementDocument(template.document), template.document);
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
});
