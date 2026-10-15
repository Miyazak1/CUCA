import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRequirementDocument } from "../../../src/server/catalog/requirements.ts";

const path = new URL("../../../seeds/application-requirements-wave-23.draft.json", import.meta.url);
test("GMU Fall 2026 requirements preserve official conflicts and remain non-public", async () => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  assert.deepEqual(draft.summary, { templateCount: 2, readyTemplateCount: 2, blockedTemplateCount: 0,
    targetedProgramCount: 2, targetedIntakeCount: 2, requirementItemCount: 56 });
  const [clinical, dental] = draft.templates;
  assert.deepEqual(clinical.targetProgramSlugs, ["guizhou-medical-university-clinical-medicine"]);
  assert.deepEqual(dental.targetProgramSlugs, ["official-2026-gmcu-bachelor-dental-surgery-bds"]);
  assert.ok(clinical.document.requirements.some((item) => item.key === "tuition" && item.ruleText.includes("CNY 15,000")));
  assert.ok(dental.document.requirements.some((item) => item.key === "tuition" && item.ruleText.includes("CNY 20,000")));
  assert.ok(draft.templates.every((template) => template.unresolvedNotes.some((note) => note.includes("does not publish a CSCA"))));
  assert.ok(draft.templates.every((template) => template.unresolvedNotes.some((note) => note.includes("conflicts internally on IELTS"))));
  assert.ok(draft.templates.every((template) => !template.document.requirements.some((item) => item.key === "csca")));
  assert.ok(draft.templates.every((template) => template.document.coverage === "complete"));
  for (const template of draft.templates) assert.deepEqual(parseRequirementDocument(template.document), template.document);
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
});
