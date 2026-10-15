import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRequirementDocument } from "../../../src/server/catalog/requirements.ts";

const path = new URL("../../../seeds/application-requirements-wave-24.draft.json", import.meta.url);
test("GXMU Fall 2026 requirements are route-specific, complete and non-public", async () => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  assert.deepEqual(draft.summary, { templateCount: 2, readyTemplateCount: 2, blockedTemplateCount: 0,
    targetedProgramCount: 25, targetedIntakeCount: 25, requirementItemCount: 52 });
  const [mbbs, chinese] = draft.templates;
  assert.deepEqual(mbbs.targetProgramSlugs, ["guangxi-medical-university-mbbs"]);
  assert.equal(chinese.targetProgramSlugs.length, 24);
  assert.ok(mbbs.document.requirements.some((item) => item.key === "csca" && item.ruleText.includes("English papers")));
  assert.ok(chinese.document.requirements.some((item) => item.key === "csca" && item.ruleText.includes("STEM Chinese")));
  assert.ok(mbbs.document.requirements.some((item) => item.key === "tuition" && item.ruleText.includes("35,000")));
  assert.ok(chinese.document.requirements.some((item) => item.key === "tuition" && item.ruleText.includes("28,000")));
  assert.ok(draft.templates.every((template) => template.unresolvedNotes.some((note) => note.includes("admission deposit"))));
  assert.ok(draft.templates.every((template) => template.document.coverage === "complete"));
  for (const template of draft.templates) assert.deepEqual(parseRequirementDocument(template.document), template.document);
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
});
