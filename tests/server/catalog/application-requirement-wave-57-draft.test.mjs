import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRequirementDocument } from "../../../src/server/catalog/requirements.ts";

const path = new URL("../../../seeds/application-requirements-wave-57.draft.json", import.meta.url);

test("BNU Fall 2026 requirements cover every exact undergraduate catalog row", async () => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  assert.deepEqual(draft.summary, {
    templateCount: 6,
    readyTemplateCount: 6,
    blockedTemplateCount: 0,
    targetedProgramCount: 33,
    targetedIntakeCount: 33,
    excludedProgramCount: 0,
    requirementItemCount: 156,
  });
  assert.equal(draft.templates.reduce((total, template) => total + template.targetProgramSlugs.length, 0), 33);
  assert.ok(draft.templates.every((template) => template.document.coverage === "complete"));
  assert.ok(draft.templates.every((template) => template.targetIntake.term === "Fall" && template.targetIntake.year === 2026));
  assert.ok(draft.templates.every((template) => template.document.requirements.some((item) => item.key === "program_csca")));
  assert.ok(draft.templates.every((template) => template.document.requirements.some((item) => item.key === "scholarships")));
  for (const template of draft.templates) assert.deepEqual(parseRequirementDocument(template.document), template.document);
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
});
