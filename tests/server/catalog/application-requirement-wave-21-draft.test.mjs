import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRequirementDocument } from "../../../src/server/catalog/requirements.ts";

const path = new URL("../../../seeds/application-requirements-wave-21.draft.json", import.meta.url);
test("HITSZ Fall 2026 undergraduate requirements are complete, exam-group-specific and non-public", async () => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  assert.deepEqual(draft.summary, { templateCount: 2, readyTemplateCount: 2, blockedTemplateCount: 0,
    targetedProgramCount: 8, targetedIntakeCount: 8, requirementItemCount: 66 });
  const [engineering, mathematics] = draft.templates;
  assert.equal(engineering.targetProgramSlugs.length, 5);
  assert.equal(mathematics.targetProgramSlugs.length, 3);
  assert.ok(engineering.document.requirements.some((item) => item.key === "csca" && item.ruleText.includes("Physics")));
  assert.ok(mathematics.document.requirements.some((item) => item.key === "csca" && !item.ruleText.includes("Physics")));
  assert.ok(engineering.document.requirements.some((item) => item.key === "financial_capacity" && item.ruleText.includes("20,000")));
  assert.ok(engineering.document.requirements.some((item) => item.key === "english_proficiency" && item.ruleText.includes("Duolingo")));
  assert.ok(draft.templates.every((template) => template.document.coverage === "complete"));
  assert.ok(draft.templates.every((template) => template.unresolvedNotes.some((note) => note.includes("closed historical"))));
  for (const template of draft.templates) assert.deepEqual(parseRequirementDocument(template.document), template.document);
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
});
