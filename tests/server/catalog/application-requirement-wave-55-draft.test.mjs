import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRequirementDocument } from "../../../src/server/catalog/requirements.ts";

const path = new URL("../../../seeds/application-requirements-wave-55.draft.json", import.meta.url);

test("Beihang requirements cover all exact 2026 undergraduate and Chinese/English graduate routes", async () => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  assert.deepEqual(draft.summary, {
    templateCount: 12,
    readyTemplateCount: 12,
    blockedTemplateCount: 0,
    targetedProgramCount: 248,
    targetedIntakeCount: 248,
    excludedProgramCount: 16,
    requirementItemCount: 296,
  });
  assert.equal(draft.exclusions.undergraduate.length, 9);
  assert.equal(draft.exclusions.graduate.length, 7);
  assert.ok(draft.exclusions.undergraduate.some((item) => item.reason.includes("conflict")));
  assert.ok(draft.exclusions.graduate.every((item) => item.reason.includes("does not publish")));
  assert.ok(draft.templates.every((template) => template.document.coverage === "complete"));
  assert.ok(draft.templates.every((template) => template.targetIntake.term === "Fall" && template.targetIntake.year === 2026));
  assert.ok(draft.templates.every((template) => template.unresolvedNotes.some((note) => note.includes("closed historical"))));
  const undergraduate = draft.templates.filter((template) => template.key.includes("undergraduate"));
  const graduate = draft.templates.filter((template) => !template.key.includes("undergraduate"));
  assert.equal(undergraduate.reduce((total, template) => total + template.targetProgramSlugs.length, 0), 67);
  assert.equal(graduate.reduce((total, template) => total + template.targetProgramSlugs.length, 0), 181);
  assert.ok(undergraduate.every((template) => template.document.requirements.some((item) => item.key === "csca_subjects")));
  assert.ok(graduate.every((template) => template.document.requirements.some((item) => item.key === "supervisor_acceptance")));
  for (const template of draft.templates) assert.deepEqual(parseRequirementDocument(template.document), template.document);
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
});
