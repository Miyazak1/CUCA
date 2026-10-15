import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRequirementDocument } from "../../../src/server/catalog/requirements.ts";

const path = new URL("../../../seeds/application-requirements-wave-36.draft.json", import.meta.url);

test("SYSU 2026 requirements preserve every exact route and isolate special admissions rules without publication", async () => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  assert.equal(draft.summary.templateCount, 16);
  assert.equal(draft.summary.readyTemplateCount, 16);
  assert.equal(draft.summary.blockedTemplateCount, 0);
  assert.equal(draft.summary.targetedProgramCount, 729);
  assert.equal(draft.summary.targetedIntakeCount, 729);
  assert.equal(draft.summary.requirementItemCount, 331);

  const targets = draft.templates.flatMap((template) => template.targetProgramSlugs);
  assert.equal(targets.length, 729);
  assert.equal(new Set(targets).size, 729);

  const mtcsol = draft.templates.find((template) => template.key.includes("-mtcsol-"));
  assert.ok(mtcsol);
  assert.ok(mtcsol.document.requirements.some((item) => item.key === "language" && item.ruleText.includes("HSK Level 5") && item.ruleText.includes("210") && item.ruleText.includes("HSKK Intermediate") && item.ruleText.includes("60")));

  const cambodia = draft.templates.find((template) => template.key.includes("-cambodia-targeted-"));
  assert.ok(cambodia);
  assert.deepEqual(cambodia.targetProgramSlugs, ["sun-yat-sen-university-master-cambodia-aerospace-information-engineering"]);
  assert.ok(cambodia.document.requirements.some((item) => item.key === "cadt_nomination" && item.ruleText.includes("Cambodian Academy of Digital Technology")));
  assert.ok(cambodia.document.requirements.some((item) => item.key === "application_window" && item.ruleText.includes("August 10, 2026") && item.ruleText.includes("August 11, 2026")));
  assert.ok(cambodia.document.requirements.some((item) => item.key === "tuition" && item.ruleText.includes("80,000")));

  assert.ok(draft.templates.some((template) => template.document.requirements.some((item) => item.key === "csca" && item.ruleText.includes("program-row subjects"))));
  assert.ok(draft.templates.every((template) => template.document.coverage === "complete"));
  assert.ok(draft.templates.every((template) => template.targetIntake.term === "Fall" && template.targetIntake.year === 2026));
  assert.ok(draft.templates.every((template) => template.unresolvedNotes.some((note) => note.includes("text-correction"))));
  for (const template of draft.templates) assert.deepEqual(parseRequirementDocument(template.document), template.document);
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
});
