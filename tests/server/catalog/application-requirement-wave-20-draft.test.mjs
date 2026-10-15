import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRequirementDocument } from "../../../src/server/catalog/requirements.ts";

const path = new URL("../../../seeds/application-requirements-wave-20.draft.json", import.meta.url);
test("CUFE Fall 2026 undergraduate requirements are complete, route-specific and non-public", async () => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  assert.deepEqual(draft.summary, { templateCount: 2, readyTemplateCount: 2, blockedTemplateCount: 0,
    targetedProgramCount: 28, targetedIntakeCount: 28, requirementItemCount: 60 });
  const [chinese, english] = draft.templates;
  assert.equal(chinese.targetProgramSlugs.length, 27);
  assert.deepEqual(english.targetProgramSlugs, ["central-university-of-finance-and-economics-finance-english"]);
  assert.deepEqual(chinese.targetIntake, { term: "Fall", year: 2026 });
  assert.ok(chinese.document.requirements.some((item) => item.key === "hsk" && item.ruleText.includes("180")));
  assert.ok(chinese.document.requirements.some((item) => item.key === "csca" && item.ruleText.includes("Humanities Chinese")));
  assert.ok(english.document.requirements.some((item) => item.key === "english_proficiency" && item.ruleText.includes("does not state a numeric")));
  assert.ok(english.document.requirements.some((item) => item.key === "csca" && item.ruleText.includes("Mathematics")));
  assert.ok(draft.templates.every((template) => template.document.coverage === "complete"));
  assert.ok(draft.templates.every((template) => template.unresolvedNotes.some((note) => note.includes("closed historical"))));
  for (const template of draft.templates) assert.deepEqual(parseRequirementDocument(template.document), template.document);
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
});
