import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRequirementDocument } from "../../../src/server/catalog/requirements.ts";

const path = new URL("../../../seeds/application-requirements-wave-11.draft.json", import.meta.url);
test("Jilin Spring 2027 scholarship requirements are complete, exact and non-public", async () => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  assert.deepEqual(draft.summary, { templateCount: 1, readyTemplateCount: 1, blockedTemplateCount: 0,
    targetedProgramCount: 1, targetedIntakeCount: 1, requirementItemCount: 27 });
  assert.deepEqual(draft.templates[0].targetProgramSlugs, ["jilin-university-iclts-one-semester-study-spring-2027"]);
  assert.deepEqual(draft.templates[0].targetIntake, { term: "Spring", year: 2027 });
  assert.equal(draft.templates[0].document.coverage, "complete");
  assert.ok(draft.templates[0].document.sources.some((source) => source.contentSha256 === "0157c7fb5962657cc5f58be63cfc8a0898c4279ea8f87e15c40302fe90f981d7"));
  assert.ok(draft.templates[0].document.requirements.some((entry) => entry.key === "scholarship_coverage"));
  assert.deepEqual(parseRequirementDocument(draft.templates[0].document), draft.templates[0].document);
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
});
