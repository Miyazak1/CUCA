import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRequirementDocument } from "../../../src/server/catalog/requirements.ts";

const path = new URL("../../../seeds/application-requirements-wave-19.draft.json", import.meta.url);
test("PKUHSC Fall 2026 medical undergraduate requirements are complete, exact and non-public", async () => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  assert.deepEqual(draft.summary, { templateCount: 1, readyTemplateCount: 1, blockedTemplateCount: 0,
    targetedProgramCount: 2, targetedIntakeCount: 2, requirementItemCount: 30 });
  assert.deepEqual(draft.templates[0].targetProgramSlugs, [
    "peking-university-health-science-center-clinical-medicine",
    "peking-university-health-science-center-oral-medicine",
  ]);
  assert.deepEqual(draft.templates[0].targetIntake, { term: "Fall", year: 2026 });
  assert.equal(draft.templates[0].document.coverage, "complete");
  assert.ok(draft.templates[0].document.requirements.some((item) => item.key === "financial_capacity" && item.ruleText.includes("400,000")));
  assert.ok(draft.templates[0].unresolvedNotes.some((note) => note.includes("closed historical")));
  assert.deepEqual(parseRequirementDocument(draft.templates[0].document), draft.templates[0].document);
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
});
