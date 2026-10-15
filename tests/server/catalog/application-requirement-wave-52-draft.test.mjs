import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const draft = JSON.parse(await readFile(new URL("../../../seeds/application-requirements-wave-52.draft.json", import.meta.url), "utf8"));

test("wave 52 replaces partial-school counting with three complete official-source school scopes", () => {
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
  assert.equal(draft.summary.schoolCount, 3);
  assert.equal(draft.summary.targetedProgramCount, 139);
  assert.equal(draft.summary.targetedIntakeCount, 139);
  assert.equal(draft.summary.excludedProgramCount, 4);
  assert.ok(draft.templates.every((template) => template.document.coverage === "complete" && template.reviewStatus === "unreviewed"));
  const counts = Object.fromEntries(["china-agricultural-university", "guangdong-university-of-foreign-studies", "shanghai-international-studies-university"].map((slug) => [slug, draft.templates.filter((template) => template.schoolSlug === slug).flatMap((template) => template.targetProgramSlugs).length]));
  assert.deepEqual(counts, { "china-agricultural-university": 127, "guangdong-university-of-foreign-studies": 3, "shanghai-international-studies-university": 9 });
  assert.ok(draft.templates.every((template) => template.document.requirements.some((entry) => entry.key === "deadline")));
  assert.ok(draft.templates.every((template) => template.document.requirements.some((entry) => entry.key === "tuition")));
});
