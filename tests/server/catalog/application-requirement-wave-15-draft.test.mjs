import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRequirementDocument } from "../../../src/server/catalog/requirements.ts";

const path = new URL("../../../seeds/application-requirements-wave-15.draft.json", import.meta.url);
test("Shanghai University Spring 2027 scholarship requirements are complete, exact and non-public", async () => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  assert.deepEqual(draft.summary, { templateCount: 1, readyTemplateCount: 1, blockedTemplateCount: 0,
    targetedProgramCount: 1, targetedIntakeCount: 1, requirementItemCount: 21 });
  assert.deepEqual(draft.templates[0].targetProgramSlugs, ["shanghai-university-iclts-international-chinese-language-education-spring-2027"]);
  assert.deepEqual(draft.templates[0].targetIntake, { term: "Spring", year: 2027 });
  assert.equal(draft.templates[0].document.coverage, "complete");
  assert.ok(draft.templates[0].unresolvedNotes.some((note) => note.includes("passport")));
  assert.deepEqual(parseRequirementDocument(draft.templates[0].document), draft.templates[0].document);
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
});
