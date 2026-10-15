import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const draft = JSON.parse(await readFile(new URL("../../../seeds/application-requirements-wave-48.draft.json", import.meta.url), "utf8"));
const seed = JSON.parse(await readFile(new URL("../../../seeds/catalog.ouc-international-batch-01.draft.json", import.meta.url), "utf8"));

test("OUC requirements cover all ten exact English routes without authorizing publication", () => {
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
  assert.deepEqual(draft.summary, { templateCount: 5, readyTemplateCount: 5, blockedTemplateCount: 0, targetedProgramCount: 10, targetedIntakeCount: 10, scholarshipCount: 3, requirementItemCount: 77 });
  const targets = draft.templates.flatMap((template) => template.targetProgramSlugs);
  assert.equal(new Set(targets).size, 10);
  assert.deepEqual(new Set(targets), new Set(seed.programs.map((program) => program.slug)));
  assert.ok(draft.templates.every((template) => template.document.coverage === "complete" && template.reviewStatus === "unreviewed"));
  assert.ok(draft.templates.every((template) => template.document.sources.some((source) => source.key === "program_guide" && source.contentSha256 === "48adb9bb99468bbd88092ba5cb39c9ec83d33b90f7beb23af6fd456b79b85589")));
  assert.ok(draft.templates.every((template) => template.document.requirements.some((entry) => entry.key === "deadline" && entry.ruleText.includes("June 10, 2026"))));
  assert.ok(draft.templates.every((template) => template.document.requirements.some((entry) => entry.key === "tuition" && /CNY [\d,]+\/year/.test(entry.ruleText))));
});
