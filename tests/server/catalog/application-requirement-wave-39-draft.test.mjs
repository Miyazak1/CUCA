import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const draft = JSON.parse(await readFile(new URL("../../../seeds/application-requirements-wave-39.draft.json", import.meta.url), "utf8"));
const seed = JSON.parse(await readFile(new URL("../../../seeds/catalog.heu-complete-batch-01.draft.json", import.meta.url), "utf8"));

test("HEU 2026 requirements preserve every degree-language-tuition-CSCA route and explicit unresolved tuition without publication", () => {
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
  assert.deepEqual(draft.summary, { templateCount: 10, readyTemplateCount: 10, blockedTemplateCount: 0, targetedProgramCount: 91, targetedIntakeCount: 91, requirementItemCount: 142 });
  const targets = draft.templates.flatMap((template) => template.targetProgramSlugs);
  assert.equal(targets.length, 91);
  assert.equal(new Set(targets).size, 91);
  assert.deepEqual(new Set(targets), new Set(seed.programs.map((program) => program.slug)));
  assert.ok(draft.templates.every((template) => template.schoolSlug === "harbin-engineering-university" && template.targetBindingStatus === "ready" && template.reviewStatus === "unreviewed"));
  assert.ok(draft.templates.every((template) => template.targetIntake.term === "Fall" && template.targetIntake.year === 2026 && template.document.coverage === "complete"));
  assert.ok(draft.templates.some((template) => template.document.requirements.some((entry) => entry.key === "csca" && /Mathematics and Physics/.test(entry.ruleText))));
  assert.ok(draft.templates.some((template) => template.document.requirements.some((entry) => entry.key === "csca" && /Chinese and Mathematics|Professional Chinese.*Mathematics/.test(entry.ruleText))));
  assert.ok(draft.templates.some((template) => template.document.requirements.some((entry) => entry.key === "tuition" && /does not publish a separate tuition amount/.test(entry.ruleText))));
  assert.ok(draft.templates.every((template) => template.document.sources.every((source) => /^[a-f0-9]{64}$/.test(source.contentSha256))));
});
