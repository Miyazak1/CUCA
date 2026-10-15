import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const draft = JSON.parse(await readFile(new URL("../../../seeds/application-requirements-wave-47.draft.json", import.meta.url), "utf8"));
const seed = JSON.parse(await readFile(new URL("../../../seeds/catalog.tsinghua-complete-batch-01.draft.json", import.meta.url), "utf8"));

test("Tsinghua historical requirements keep the 83 routes backed by the 2026 fee schedule", () => {
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
  assert.deepEqual(draft.summary, { templateCount: 5, readyTemplateCount: 5, blockedTemplateCount: 0, targetedProgramCount: 83, targetedIntakeCount: 83, excludedProgramCount: 8, requirementItemCount: 95 });
  const targets = draft.templates.flatMap((template) => template.targetProgramSlugs);
  const undergraduate = seed.programs.filter((program) => program.degreeLevel === "Undergraduate");
  const currentZijingEvidenceSha256 = "8fa2cbe5148d5f22bb2824a088ee26312409cea1ef7c8bca6407a70f53036473";
  const exact = undergraduate.filter((program) => program.sourceSha256 !== currentZijingEvidenceSha256);
  const excluded = undergraduate.filter((program) => program.sourceSha256 === currentZijingEvidenceSha256);
  assert.equal(new Set(targets).size, 83);
  assert.deepEqual(new Set(targets), new Set(exact.map((program) => program.slug)));
  assert.equal(excluded.length, 8);
  assert.ok(excluded.every((program) => !targets.includes(program.slug)));
  assert.ok(draft.templates.every((template) => template.document.coverage === "complete" && template.reviewStatus === "unreviewed"));
  assert.ok(draft.templates.every((template) => template.document.sources.some((source) => source.key === "documents" && source.contentSha256 === "6d93ddb8c9edda80d0cff0e4f28b592ae7a22e72786a4e5aa2d05061458809ed")));
  assert.ok(draft.templates.every((template) => template.document.requirements.some((entry) => entry.key === "tuition" && !/See the official/.test(entry.ruleText))));
});
