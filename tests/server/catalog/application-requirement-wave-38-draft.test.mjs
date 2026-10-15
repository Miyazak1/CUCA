import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRequirementDocument } from "../../../src/server/catalog/requirements.ts";

const path = new URL("../../../seeds/application-requirements-wave-38.draft.json", import.meta.url);

test("BUCT 2026 requirements preserve every degree-language-CSCA route and explicit unresolved tuition without publication", async () => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  assert.equal(draft.summary.templateCount, 10);
  assert.equal(draft.summary.readyTemplateCount, 10);
  assert.equal(draft.summary.blockedTemplateCount, 0);
  assert.equal(draft.summary.targetedProgramCount, 108);
  assert.equal(draft.summary.targetedIntakeCount, 108);
  assert.equal(draft.summary.requirementItemCount, 170);

  const targets = draft.templates.flatMap((template) => template.targetProgramSlugs);
  assert.equal(targets.length, 108);
  assert.equal(new Set(targets).size, 108);

  const undergraduateChinese = draft.templates.filter((template) => template.key.includes("-undergraduate-chinese-"));
  assert.ok(undergraduateChinese.length > 0);
  assert.ok(undergraduateChinese.every((template) => template.document.requirements.some((item) => item.key === "language" && item.ruleText.includes("HSK Level 4") && item.ruleText.includes("CSCA Professional Chinese"))));
  assert.ok(undergraduateChinese.some((template) => template.document.requirements.some((item) => item.key === "csca" && item.ruleText.includes("Mathematics, Chemistry"))));

  const undergraduateFrench = draft.templates.find((template) => template.key.includes("-undergraduate-french-"));
  assert.ok(undergraduateFrench);
  assert.ok(undergraduateFrench.document.requirements.some((item) => item.key === "language" && item.ruleText.includes("French B1")));

  const masterFrench = draft.templates.find((template) => template.key.includes("-master-french-"));
  assert.ok(masterFrench);
  assert.ok(masterFrench.document.requirements.some((item) => item.key === "language" && item.ruleText.includes("French B2")));
  assert.ok(masterFrench.document.requirements.some((item) => item.key === "tuition" && item.ruleText.includes("does not publish") && item.ruleText.includes("obtain the applicable amount")));

  const doctoral = draft.templates.find((template) => template.key.includes("-doctoral-english-"));
  assert.ok(doctoral);
  assert.ok(doctoral.document.requirements.some((item) => item.key === "language" && item.ruleText.includes("TOEFL 90") && item.ruleText.includes("IELTS 6.5")));
  assert.ok(doctoral.document.requirements.some((item) => item.key === "supervisor_acceptance" && item.level === "required"));

  assert.ok(draft.templates.every((template) => template.document.coverage === "complete"));
  assert.ok(draft.templates.every((template) => template.targetIntake.term === "Fall" && template.targetIntake.year === 2026));
  assert.ok(draft.templates.every((template) => template.unresolvedNotes.some((note) => note.includes("French-medium master's"))));
  for (const template of draft.templates) assert.deepEqual(parseRequirementDocument(template.document), template.document);
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
});
