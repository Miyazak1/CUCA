import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRequirementDocument } from "../../../src/server/catalog/requirements.ts";

const path = new URL("../../../seeds/application-requirements-wave-04.draft.json", import.meta.url);
test("QDU Spring 2027 requirement draft is current, exactly bound and non-publishable", async () => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  assert.deepEqual(draft.summary, { templateCount: 1, readyTemplateCount: 1, blockedTemplateCount: 0,
    targetedProgramCount: 1, targetedIntakeCount: 1, requirementItemCount: 21 });
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
  assert.deepEqual(draft.templates[0].targetIntake, { term: "Spring", year: 2027 });
  assert.deepEqual(draft.templates[0].targetProgramSlugs, ["qingdao-university-non-degree-chinese-language-spring-2027"]);
  assert.equal(draft.templates[0].document.coverage, "complete");
  assert.deepEqual(new Set(draft.templates[0].document.requirements.map((item) => item.stage)),
    new Set(["preparation", "submission", "enrollment"]));
  assert.deepEqual(parseRequirementDocument(draft.templates[0].document), draft.templates[0].document);
});
