import assert from "node:assert/strict"; import { readFile } from "node:fs/promises"; import test from "node:test";
const draft = JSON.parse(await readFile(new URL("../../../seeds/application-requirements-wave-44.draft.json", import.meta.url), "utf8")); const seed = JSON.parse(await readFile(new URL("../../../seeds/catalog.ecupl-complete-batch-01.draft.json", import.meta.url), "utf8"));
test("ECUPL 2026 requirements cover all 15 routes and preserve language, tuition and CSCA distinctions", () => {
  assert.equal(draft.handoff.databaseWriteAuthorized, false); assert.equal(draft.handoff.publicationAuthorized, false); assert.deepEqual(draft.summary, { templateCount: 3, readyTemplateCount: 3, blockedTemplateCount: 0, targetedProgramCount: 15, targetedIntakeCount: 15, requirementItemCount: 45 });
  const targets = draft.templates.flatMap((template) => template.targetProgramSlugs); assert.deepEqual(new Set(targets), new Set(seed.programs.map((program) => program.slug))); assert.equal(seed.scholarships.length, 0); assert.ok(seed.programIntakes.every((intake) => intake.status === "closed"));
  assert.ok(draft.templates.every((template) => template.schoolSlug === "east-china-university-of-political-science-and-law" && template.targetBindingStatus === "ready" && template.reviewStatus === "unreviewed"));
  assert.ok(draft.templates.every((template) => template.document.coverage === "complete" && template.document.sources.some((source) => source.key === "csca" && source.contentSha256 === "95c79f83c33489afa6f5e49d486eabae5cd634c14cf4694d144ac3a0080a4cf3")));
  assert.ok(draft.templates.some((template) => template.document.requirements.some((entry) => entry.key === "language" && /English telephone interview/.test(entry.ruleText))));
});
