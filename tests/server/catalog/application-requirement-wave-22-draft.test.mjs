import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRequirementDocument } from "../../../src/server/catalog/requirements.ts";

const path = new URL("../../../seeds/application-requirements-wave-22.draft.json", import.meta.url);
test("HRBUST Fall 2026 undergraduate requirements are complete, route-specific and non-public", async () => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  assert.deepEqual(draft.summary, { templateCount: 2, readyTemplateCount: 2, blockedTemplateCount: 0,
    targetedProgramCount: 6, targetedIntakeCount: 6, requirementItemCount: 56 });
  const [chineseEducation, ordinary] = draft.templates;
  assert.deepEqual(chineseEducation.targetProgramSlugs, ["harbin-university-of-science-and-technology-chinese-language-education"]);
  assert.equal(ordinary.targetProgramSlugs.length, 5);
  assert.ok(chineseEducation.document.requirements.some((item) => item.key === "language_requirement" && item.ruleText.includes("No prior Chinese")));
  assert.ok(chineseEducation.document.requirements.some((item) => item.key === "csca" && item.ruleText.includes("Chinese or English")));
  assert.ok(ordinary.document.requirements.some((item) => item.key === "language_requirement" && item.ruleText.includes("HSK Level 4")));
  assert.ok(ordinary.document.requirements.some((item) => item.key === "csca" && item.ruleText.includes("STEM Chinese")));
  assert.ok(draft.templates.every((template) => template.document.coverage === "complete"));
  for (const template of draft.templates) assert.deepEqual(parseRequirementDocument(template.document), template.document);
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
});
