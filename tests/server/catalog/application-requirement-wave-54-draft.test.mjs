import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRequirementDocument } from "../../../src/server/catalog/requirements.ts";

const path = new URL("../../../seeds/application-requirements-wave-54.draft.json", import.meta.url);

test("LNUTCM degree requirements cover the complete reviewed Fall 2026 undergraduate and master's scope", async () => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  assert.deepEqual(draft.summary, {
    templateCount: 2,
    readyTemplateCount: 2,
    blockedTemplateCount: 0,
    targetedProgramCount: 35,
    targetedIntakeCount: 35,
    requirementItemCount: 41,
  });
  const [undergraduate, master] = draft.templates;
  assert.equal(undergraduate.targetProgramSlugs.length, 1);
  assert.equal(master.targetProgramSlugs.length, 34);
  assert.ok(undergraduate.document.requirements.some((item) => item.key === "csca" && item.ruleText.includes("Chinese for STEM")));
  assert.ok(undergraduate.document.requirements.some((item) => item.key === "tuition" && item.ruleText.includes("22,000")));
  assert.ok(master.document.requirements.some((item) => item.key === "supervisor_acceptance" && item.level === "required"));
  assert.ok(master.document.requirements.some((item) => item.key === "tuition" && item.ruleText.includes("28,000")));
  assert.ok(draft.templates.every((template) => template.document.coverage === "complete"));
  assert.ok(draft.templates.every((template) => template.unresolvedNotes.some((note) => note.includes("closed historical"))));
  for (const template of draft.templates) assert.deepEqual(parseRequirementDocument(template.document), template.document);
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
});
