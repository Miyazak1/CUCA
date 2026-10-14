import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRequirementDocument } from "../../../src/server/catalog/requirements.ts";

const path = new URL("../../../seeds/application-requirements-wave-03.draft.json", import.meta.url);
test("SCUT wave binds only the existing undergraduate intake set", async () => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
  assert.deepEqual(draft.summary, { templateCount: 3, readyTemplateCount: 1, blockedTemplateCount: 2,
    targetedProgramCount: 99, targetedIntakeCount: 99, requirementItemCount: 39 });
  const ready = draft.templates.filter(template => template.targetBindingStatus === "ready");
  assert.deepEqual(ready.map(template => template.key), ["scut-undergraduate-2026"]);
  assert.equal(ready[0].targetProgramSlugs.length, 99);
  assert.deepEqual(ready[0].targetIntake, { term: "Fall", year: 2026 });
  for (const template of draft.templates) assert.deepEqual(parseRequirementDocument(template.document), template.document);
});
