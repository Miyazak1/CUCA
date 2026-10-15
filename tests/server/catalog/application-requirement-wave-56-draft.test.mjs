import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRequirementDocument } from "../../../src/server/catalog/requirements.ts";

const path = new URL("../../../seeds/application-requirements-wave-56.draft.json", import.meta.url);

test("BLCU requirements include only exact conflict-free Fall 2026 undergraduate routes", async () => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  assert.deepEqual(draft.summary, {
    templateCount: 4,
    readyTemplateCount: 4,
    blockedTemplateCount: 0,
    targetedProgramCount: 14,
    targetedIntakeCount: 14,
    excludedProgramCount: 82,
    requirementItemCount: 80,
  });
  assert.equal(draft.exclusions.undergraduate.length, 22);
  assert.equal(draft.exclusions.graduate.length, 60);
  assert.ok(draft.exclusions.graduate.every((item) => item.reason.includes("conflict")));
  assert.ok(draft.templates.every((template) => template.document.coverage === "complete"));
  assert.ok(draft.templates.every((template) => template.targetIntake.term === "Fall" && template.targetIntake.year === 2026));
  assert.ok(draft.templates.every((template) => template.unresolvedNotes.some((note) => note.includes("closed historical"))));
  assert.equal(draft.templates.reduce((total, template) => total + template.targetProgramSlugs.length, 0), 14);
  assert.ok(draft.templates.every((template) => template.document.requirements.some((item) => item.key === "csca_subjects")));
  assert.ok(draft.templates.every((template) => template.document.requirements.some((item) => item.key === "beijing_government_scholarship")));
  for (const template of draft.templates) assert.deepEqual(parseRequirementDocument(template.document), template.document);
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
});
