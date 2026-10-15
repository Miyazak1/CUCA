import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const draft = JSON.parse(await readFile(new URL("../../../seeds/application-requirements-wave-40.draft.json", import.meta.url), "utf8"));
const seed = JSON.parse(await readFile(new URL("../../../seeds/catalog.bupt-complete-batch-01.draft.json", import.meta.url), "utf8"));

test("BUPT 2026 requirements cover every published degree-language-tuition-CSCA route without inventing scholarship data", () => {
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
  assert.deepEqual(draft.summary, { templateCount: 8, readyTemplateCount: 8, blockedTemplateCount: 0, targetedProgramCount: 58, targetedIntakeCount: 58, requirementItemCount: 88 });
  const targets = draft.templates.flatMap((template) => template.targetProgramSlugs);
  assert.equal(targets.length, 58);
  assert.equal(new Set(targets).size, 58);
  assert.deepEqual(new Set(targets), new Set(seed.programs.map((program) => program.slug)));
  assert.ok(draft.templates.every((template) => template.schoolSlug === "beijing-university-of-posts-and-telecommunications" && template.targetBindingStatus === "ready" && template.reviewStatus === "unreviewed"));
  assert.ok(draft.templates.every((template) => template.targetIntake.term === "Fall" && template.targetIntake.year === 2026 && template.document.coverage === "complete"));
  assert.ok(draft.templates.some((template) => template.document.requirements.some((entry) => entry.key === "csca" && /Mathematics and Physics/.test(entry.ruleText))));
  assert.ok(draft.templates.every((template) => template.unresolvedNotes.some((note) => /no current-cycle scholarship detail/.test(note))));
  assert.ok(draft.templates.every((template) => template.document.sources[0].contentSha256 === "60c223830d1e46ab8625daa3060584544ad699bf3c7925a33ce59cc0d32d56a8"));
});
