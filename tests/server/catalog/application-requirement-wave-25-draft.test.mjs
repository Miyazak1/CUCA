import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRequirementDocument } from "../../../src/server/catalog/requirements.ts";

const path = new URL("../../../seeds/application-requirements-wave-25.draft.json", import.meta.url);
test("Yanshan 2026 requirements cover every published degree and language route without publication", async () => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  assert.equal(draft.summary.templateCount, 13);
  assert.equal(draft.summary.readyTemplateCount, 13);
  assert.equal(draft.summary.blockedTemplateCount, 0);
  assert.equal(draft.summary.targetedProgramCount, 63);
  assert.equal(draft.summary.targetedIntakeCount, 64);
  assert.equal(draft.templates.flatMap((template) => template.targetProgramSlugs).length, 64);
  assert.equal(draft.templates.filter((template) => template.key.includes("undergraduate-group")).length, 5);
  assert.equal(draft.templates.filter((template) => template.key.includes("master-")).length, 3);
  assert.equal(draft.templates.filter((template) => template.key.includes("doctoral-")).length, 3);
  assert.equal(draft.templates.filter((template) => template.key.includes("chinese-language-")).length, 2);
  assert.ok(draft.templates.some((template) => template.document.requirements.some((item) => item.key === "csca" && item.ruleText.includes("Physics, Chemistry"))));
  assert.ok(draft.templates.some((template) => template.document.requirements.some((item) => item.key === "acceptance_letter")));
  assert.ok(draft.templates.every((template) => template.document.coverage === "complete"));
  for (const template of draft.templates) assert.deepEqual(parseRequirementDocument(template.document), template.document);
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
});
