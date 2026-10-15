import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRequirementDocument } from "../../../src/server/catalog/requirements.ts";

const path = new URL("../../../seeds/application-requirements-wave-37.draft.json", import.meta.url);

test("SEU 2026 requirements preserve all degree-language-tuition-CSCA routes and special scholarship paths without publication", async () => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  assert.equal(draft.summary.templateCount, 20);
  assert.equal(draft.summary.readyTemplateCount, 20);
  assert.equal(draft.summary.blockedTemplateCount, 0);
  assert.equal(draft.summary.targetedProgramCount, 232);
  assert.equal(draft.summary.targetedIntakeCount, 232);
  assert.equal(draft.summary.requirementItemCount, 331);

  const targets = draft.templates.flatMap((template) => template.targetProgramSlugs);
  assert.equal(targets.length, 232);
  assert.equal(new Set(targets).size, 232);

  const undergraduate = draft.templates.filter((template) => template.key.includes("-undergraduate-"));
  assert.ok(undergraduate.length > 0);
  assert.ok(undergraduate.every((template) => template.document.requirements.some((item) => item.key === "application_window" && item.ruleText.includes("four published batches") && item.ruleText.includes("July 8, 2026"))));
  assert.ok(undergraduate.some((template) => template.document.requirements.some((item) => item.key === "csca" && item.ruleText.includes("Mathematics, Chemistry"))));
  assert.ok(undergraduate.some((template) => template.document.requirements.some((item) => item.key === "tuition" && item.ruleText.includes("RMB 32,000/year"))));

  const doctoral = draft.templates.find((template) => template.key.includes("-doctoral-") && template.document.requirements.some((item) => item.key === "tuition" && item.ruleText.includes("RMB 50,000/year")));
  assert.ok(doctoral);
  assert.ok(doctoral.document.requirements.some((item) => item.key === "education" && item.ruleText.includes("master's degree")));

  const special = draft.templates.filter((template) => template.key.includes("seu-yes-"));
  assert.equal(special.length, 2);
  assert.ok(special.every((template) => template.targetProgramSlugs.length === 1));
  assert.ok(special.every((template) => template.document.requirements.some((item) => item.key === "work_experience" && item.ruleText.includes("three years"))));
  assert.ok(special.every((template) => template.document.requirements.some((item) => item.key === "application_window" && item.ruleText.includes("March 15, 2026") && item.ruleText.includes("March 31, 2026"))));
  assert.ok(special.every((template) => template.document.requirements.some((item) => item.key === "funding" && item.ruleText.includes("does not itemize components"))));

  assert.ok(draft.templates.every((template) => template.document.coverage === "complete"));
  assert.ok(draft.templates.every((template) => template.targetIntake.term === "Fall" && template.targetIntake.year === 2026));
  assert.ok(draft.templates.every((template) => template.unresolvedNotes.some((note) => note.includes("English catalogs"))));
  for (const template of draft.templates) assert.deepEqual(parseRequirementDocument(template.document), template.document);
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
});
