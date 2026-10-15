import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRequirementDocument } from "../../../src/server/catalog/requirements.ts";

const draftPath = new URL("../../../seeds/application-requirements-wave-01.draft.json", import.meta.url);

test("application-requirement wave 01 stays source-located and non-publishable", async () => {
  const draft = JSON.parse(await readFile(draftPath, "utf8"));
  assert.equal(draft.handoff.status, "unreviewed_draft");
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
  assert.equal(draft.summary.templateCount, 7);
  assert.equal(draft.summary.readyTemplateCount, 1);
  assert.equal(draft.summary.blockedTemplateCount, 6);
  assert.equal(draft.summary.targetedProgramCount, 186);
  assert.equal(draft.summary.requirementItemCount, 94);

  const keys = new Set();
  for (const template of draft.templates) {
    assert.ok(!keys.has(template.key));
    keys.add(template.key);
    assert.equal(template.reviewStatus, "unreviewed");
    assert.ok(template.unresolvedNotes.length >= 1);
    assert.deepEqual(parseRequirementDocument(template.document), template.document);
    for (const item of template.document.requirements) assert.ok(item.references.length >= 1);
  }

  const serialized = JSON.stringify(draft);
  for (const prohibited of ["account number", "swift code", "开户行", "银行账号"]) {
    assert.equal(serialized.toLowerCase().includes(prohibited.toLowerCase()), false);
  }
});

test("only the explicit 2026 UIBE joint route is ready for intake binding", async () => {
  const draft = JSON.parse(await readFile(draftPath, "utf8"));
  const ready = draft.templates.filter((template) => template.targetBindingStatus === "ready");
  assert.deepEqual(ready.map((template) => template.key), ["uibe-buct-joint-undergraduate-2026"]);
  assert.deepEqual(ready[0].targetProgramSlugs, ["uibe-international-economic-development-cooperation-polymer-materials-bachelor"]);
  assert.deepEqual(ready[0].targetIntake, { term: "Fall", year: 2026 });
  assert.equal(ready[0].document.coverage, "complete");
  assert.equal(ready[0].document.requirements.length, 18);
});
