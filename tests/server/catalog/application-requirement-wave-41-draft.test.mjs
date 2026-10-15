import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const draft = JSON.parse(await readFile(new URL("../../../seeds/application-requirements-wave-41.draft.json", import.meta.url), "utf8"));
const seed = JSON.parse(await readFile(new URL("../../../seeds/catalog.xjtu-complete-batch-01.draft.json", import.meta.url), "utf8"));

test("XJTU 2026 undergraduate requirements cover all 49 official routes and retain source-level distinctions", () => {
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
  assert.deepEqual(draft.summary, { templateCount: 9, readyTemplateCount: 9, blockedTemplateCount: 0, targetedProgramCount: 49, targetedIntakeCount: 49, requirementItemCount: 126 });
  const targets = draft.templates.flatMap((template) => template.targetProgramSlugs);
  assert.equal(targets.length, 49);
  assert.equal(new Set(targets).size, 49);
  assert.deepEqual(new Set(targets), new Set(seed.programs.map((program) => program.slug)));
  assert.equal(seed.scholarships.length, 6);
  assert.ok(draft.templates.every((template) => template.schoolSlug === "xi-an-jiaotong-university" && template.targetBindingStatus === "ready" && template.reviewStatus === "unreviewed"));
  assert.ok(draft.templates.every((template) => template.targetIntake.term === "Fall" && template.targetIntake.year === 2026 && template.document.coverage === "complete"));
  assert.ok(draft.templates.every((template) => template.document.sources.some((source) => source.key === "csca" && source.contentSha256 === "460683227698ccbe508d70d80e42da876ee9db4adde773764a4fa3b109e82539")));
  const mbbs = draft.templates.find((template) => template.document.sources.some((source) => source.key === "medical"));
  assert.ok(mbbs);
  assert.equal(mbbs.targetProgramSlugs.length, 1);
  assert.ok(mbbs.document.requirements.some((entry) => entry.key === "language" && /does not publish one universal numeric threshold/.test(entry.ruleText)));
  assert.ok(draft.templates.every((template) => template.unresolvedNotes.some((note) => /closed historical/.test(note))));
});
