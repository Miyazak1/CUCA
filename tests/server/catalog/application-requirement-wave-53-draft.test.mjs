import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const draft = JSON.parse(await readFile(new URL("../../../seeds/application-requirements-wave-53.draft.json", import.meta.url), "utf8"));
const seed = JSON.parse(await readFile(new URL("../../../seeds/catalog.tsinghua-complete-batch-01.draft.json", import.meta.url), "utf8"));
const guideSha256 = "8fa2cbe5148d5f22bb2824a088ee26312409cea1ef7c8bca6407a70f53036473";
const documentsSha256 = "eea757838c711069c937b720331fa102eb947c6f57329110901c0a8a2aeb22b5";

test("Tsinghua Zijing Fall 2027 requirements bind all eight current official routes", () => {
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
  assert.deepEqual(draft.summary, {
    templateCount: 1,
    readyTemplateCount: 1,
    blockedTemplateCount: 0,
    targetedProgramCount: 8,
    targetedIntakeCount: 8,
    excludedProgramCount: 0,
    requirementItemCount: 23,
  });
  const template = draft.templates[0];
  const programs = seed.programs.filter((program) => program.sourceSha256 === guideSha256);
  assert.equal(programs.length, 8);
  assert.deepEqual(new Set(template.targetProgramSlugs), new Set(programs.map((program) => program.slug)));
  assert.deepEqual(template.targetIntake, { term: "Fall", year: 2027 });
  assert.equal(template.targetBindingStatus, "ready");
  assert.equal(template.reviewStatus, "unreviewed");
  assert.equal(template.document.coverage, "complete");
  assert.ok(template.document.sources.some((source) => source.contentSha256 === guideSha256));
  assert.ok(template.document.sources.some((source) => source.contentSha256 === documentsSha256));
  assert.ok(programs.every((program) => program.tuitionAmount === 100000 && program.tuitionText === "RMB 100,000/year"));
  assert.ok(programs.every((program) => seed.programIntakes.some((intake) => intake.programSlug === program.slug && intake.intakeTerm === "Fall" && intake.intakeYear === 2027 && intake.status === "open")));
});
