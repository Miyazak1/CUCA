import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const draft = JSON.parse(await readFile(new URL("../../../seeds/application-requirements-wave-45.draft.json", import.meta.url), "utf8"));
const seed = JSON.parse(await readFile(new URL("../../../seeds/catalog.whu-complete-batch-01.draft.json", import.meta.url), "utf8"));

test("WHU 2026 requirements cover all 599 official routes without authorizing publication", () => {
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
  assert.deepEqual(draft.summary, {
    templateCount: 18,
    readyTemplateCount: 18,
    blockedTemplateCount: 0,
    targetedProgramCount: 599,
    targetedIntakeCount: 599,
    requirementItemCount: 274,
  });
  assert.equal(seed.schools.length, 1);
  assert.equal(seed.programs.length, 599);
  assert.equal(seed.programIntakes.length, 599);
  assert.equal(seed.scholarships.length, 6);
  assert.ok(seed.programs.every((program) => program.tuitionAmount > 0 && program.tuitionText));
  assert.ok(seed.programIntakes.every((intake) => intake.intakeTerm === "Fall" && intake.intakeYear === 2026 && intake.status === "closed"));
  const targets = draft.templates.flatMap((template) => template.targetProgramSlugs);
  assert.equal(new Set(targets).size, 599);
  assert.deepEqual(new Set(targets), new Set(seed.programs.map((program) => program.slug)));
  assert.ok(draft.templates.every((template) => template.schoolSlug === "wuhan-university" && template.targetBindingStatus === "ready" && template.reviewStatus === "unreviewed"));
  assert.ok(draft.templates.every((template) => template.document.coverage === "complete"));
  assert.ok(draft.templates.some((template) => template.document.sources.some((source) => source.key === "csca" && source.contentSha256 === "daf166ef5e9f5dadd73ca46dfec0ddc48708eb7bde9c04dccd16268bd8d10ca4")));
  assert.ok(draft.templates.every((template) => template.document.sources.some((source) => source.key === "fees" && source.contentSha256 === "44f3363bfdf11003a6101c395af2208878c74b71fddeb29e9e51bd9b29b3a338")));
  assert.ok(draft.templates.every((template) => template.document.requirements.some((entry) => entry.key === "tuition")));
});
