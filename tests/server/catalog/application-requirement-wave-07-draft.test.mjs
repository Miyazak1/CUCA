import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRequirementDocument } from "../../../src/server/catalog/requirements.ts";

const path = new URL("../../../seeds/application-requirements-wave-07.draft.json", import.meta.url);
test("SISU 2027 Chinese-language requirements bind both current intakes and remain non-public", async () => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  assert.deepEqual(draft.summary, { templateCount: 2, readyTemplateCount: 2, blockedTemplateCount: 0,
    targetedProgramCount: 1, targetedIntakeCount: 2, requirementItemCount: 22 });
  assert.deepEqual(draft.templates.map((template) => template.targetIntake), [
    { term: "Spring", year: 2027 },
    { term: "Late Spring", year: 2027 },
  ]);
  assert.ok(draft.templates.every((template) => template.targetBindingStatus === "ready"));
  assert.ok(draft.templates.every((template) => template.document.coverage === "complete"));
  assert.ok(draft.templates.every((template) => parseRequirementDocument(template.document)));
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
});
