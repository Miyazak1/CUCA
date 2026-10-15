import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const draft = JSON.parse(await readFile(new URL("../../../seeds/application-requirements-wave-51.draft.json", import.meta.url), "utf8"));
const seed = JSON.parse(await readFile(new URL("../../../seeds/catalog.dhu-complete-batch-01.draft.json", import.meta.url), "utf8"));

test("DHU requirements cover every undergraduate, master and doctoral route", () => {
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
  assert.deepEqual(draft.summary, { templateCount: 20, readyTemplateCount: 20, blockedTemplateCount: 0, targetedProgramCount: 131, targetedIntakeCount: 131, excludedProgramCount: 0, scholarshipCount: 4, requirementItemCount: 420 });
  const targets = draft.templates.flatMap((template) => template.targetProgramSlugs);
  assert.deepEqual(new Set(targets), new Set(seed.programs.map((program) => program.slug)));
  assert.equal(targets.length, 131);
  assert.ok(seed.programs.filter((program) => program.degreeLevel === "Undergraduate").every((program) => program.cscaRequirement && !program.cscaRequirement.includes("route-specific")));
  assert.ok(seed.programs.every((program) => !program.applicationNote.includes("Additional published requirement: √")));
  assert.equal(seed.programs.filter((program) => program.degreeLevel === "Master" && program.applicationNote.includes("Supervision Intention Letter required")).length, 41);
  assert.ok(draft.templates.every((template) => template.document.coverage === "complete" && template.reviewStatus === "unreviewed"));
  assert.deepEqual(new Set(draft.templates.map((template) => template.document.sources.find((source) => source.key === "guide")?.contentSha256)), new Set([
    "08a3e81d7decbd4420d60b39f49b6785cbad8e066821ddfcd93d93aa4b5fcf61",
    "633f38ddb37a4956d3e9a52c406d8030c35f54ffd84748b7c23cd2eb03ece1e5",
    "07ce403793bf19d1f4fac3c5832642675d4e23b6b9d2b45eecaffd3d2d196bd9",
  ]));
  assert.ok(draft.templates.every((template) => template.document.requirements.some((entry) => entry.key === "deadline" && entry.ruleText.includes("May 31, 2026"))));
  assert.ok(draft.templates.every((template) => template.document.requirements.some((entry) => entry.key === "tuition" && /CNY [\d,]+ per academic year/.test(entry.ruleText))));
  assert.ok(draft.templates.filter((template) => template.key.includes("undergraduate")).every((template) => template.document.requirements.some((entry) => entry.key === "csca" && !entry.ruleText.includes("route-specific"))));
  assert.ok(draft.templates.filter((template) => !template.key.includes("undergraduate")).every((template) => template.document.requirements.some((entry) => entry.key === "supervision_intention")));
});
