import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const draft = JSON.parse(await readFile(new URL("../../../seeds/application-requirements-wave-42.draft.json", import.meta.url), "utf8"));
const seed = JSON.parse(await readFile(new URL("../../../seeds/catalog.sdnu-complete-batch-01.draft.json", import.meta.url), "utf8"));

test("SDNU 2026 undergraduate requirements cover all exact tuition routes without inventing CSCA subjects", () => {
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
  assert.deepEqual(draft.summary, { templateCount: 3, readyTemplateCount: 3, blockedTemplateCount: 0, targetedProgramCount: 10, targetedIntakeCount: 10, requirementItemCount: 48 });
  const targets = draft.templates.flatMap((template) => template.targetProgramSlugs);
  assert.deepEqual(new Set(targets), new Set(seed.programs.map((program) => program.slug)));
  assert.equal(seed.scholarships.length, 1);
  assert.ok(draft.templates.every((template) => template.schoolSlug === "shandong-normal-university" && template.targetBindingStatus === "ready" && template.reviewStatus === "unreviewed"));
  assert.ok(draft.templates.every((template) => template.targetIntake.term === "Fall" && template.targetIntake.year === 2026 && template.document.coverage === "complete"));
  assert.ok(draft.templates.every((template) => template.document.requirements.some((entry) => entry.key === "csca" && /does not publish a program-specific subject combination/.test(entry.ruleText))));
  assert.ok(draft.templates.every((template) => template.document.sources.some((source) => source.key === "brochure" && source.contentSha256 === "9febf6b225bc994d0d0fa8f00eac106b3e479c97f44334968cd51f5cf812f0e4")));
});
