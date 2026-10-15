import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const draft = JSON.parse(await readFile(new URL("../../../seeds/application-requirements-wave-43.draft.json", import.meta.url), "utf8"));
const seed = JSON.parse(await readFile(new URL("../../../seeds/catalog.tjufe-complete-batch-01.draft.json", import.meta.url), "utf8"));
test("TUFE 2026 undergraduate requirements cover all 49 official programs and exact fee groups", () => {
  assert.equal(draft.handoff.databaseWriteAuthorized, false); assert.equal(draft.handoff.publicationAuthorized, false);
  assert.deepEqual(draft.summary, { templateCount: 2, readyTemplateCount: 2, blockedTemplateCount: 0, targetedProgramCount: 49, targetedIntakeCount: 49, requirementItemCount: 28 });
  const targets = draft.templates.flatMap((template) => template.targetProgramSlugs); assert.deepEqual(new Set(targets), new Set(seed.programs.map((program) => program.slug)));
  assert.equal(seed.scholarships.length, 2);
  assert.ok(draft.templates.every((template) => template.schoolSlug === "tianjin-university-of-finance-and-economics" && template.targetBindingStatus === "ready" && template.reviewStatus === "unreviewed"));
  assert.ok(draft.templates.every((template) => template.targetIntake.term === "Fall" && template.targetIntake.year === 2026 && template.document.coverage === "complete"));
  assert.ok(draft.templates.every((template) => template.document.requirements.some((entry) => entry.key === "financial_support" && /CNY 50,000/.test(entry.ruleText))));
  assert.ok(draft.templates.every((template) => template.document.sources.some((source) => source.key === "guide_en" && source.contentSha256 === "2ab3df69480eac0076018e82027a6b82b6269f8911245542ebb79e5deba1a3b2")));
});
