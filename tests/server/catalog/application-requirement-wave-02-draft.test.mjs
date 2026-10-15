import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRequirementDocument } from "../../../src/server/catalog/requirements.ts";

const draftPath = new URL("../../../seeds/application-requirements-wave-02.draft.json", import.meta.url);

test("application-requirement wave 02 has verified Fall 2026 target bindings", async () => {
  const draft = JSON.parse(await readFile(draftPath, "utf8"));
  assert.equal(draft.handoff.status, "unreviewed_draft");
  assert.equal(draft.handoff.databaseWriteAuthorized, false);
  assert.equal(draft.handoff.publicationAuthorized, false);
  assert.deepEqual(draft.summary, {
    templateCount: 9,
    readyTemplateCount: 9,
    blockedTemplateCount: 0,
    targetedProgramCount: 44,
    targetedIntakeCount: 44,
    requirementItemCount: 172,
  });

  const templateKeys = new Set();
  const targets = new Set();
  for (const template of draft.templates) {
    assert.equal(template.targetBindingStatus, "ready");
    assert.deepEqual(template.targetIntake, { term: "Fall", year: 2026 });
    assert.equal(template.reviewStatus, "unreviewed");
    assert.ok(!templateKeys.has(template.key));
    templateKeys.add(template.key);
    assert.deepEqual(parseRequirementDocument(template.document), template.document);
    for (const slug of template.targetProgramSlugs) {
      assert.ok(!targets.has(slug), `Program must not be covered by multiple templates: ${slug}`);
      targets.add(slug);
    }
    for (const item of template.document.requirements) assert.ok(item.references.length >= 1);
  }
  assert.equal(targets.size, 44);
  const qduTemplates = draft.templates.filter((template) => template.schoolSlug === "qingdao-university");
  assert.equal(qduTemplates.length, 3);
  assert.ok(qduTemplates.every((template) => template.document.coverage === "complete"));
  assert.deepEqual(qduTemplates.map((template) => template.document.requirements.length), [21, 21, 16]);
  const sisuTemplates = draft.templates.filter((template) => template.schoolSlug === "sichuan-international-studies-university");
  assert.equal(sisuTemplates.length, 2);
  assert.ok(sisuTemplates.every((template) => template.document.coverage === "complete"));
  assert.ok(sisuTemplates.every((template) => template.document.requirements.length === 19));
  const tjfsuTemplates = draft.templates.filter((template) => template.schoolSlug === "tianjin-foreign-studies-university");
  assert.equal(tjfsuTemplates.length, 4);
  assert.ok(tjfsuTemplates.every((template) => template.document.coverage === "complete"));
  assert.ok(tjfsuTemplates.every((template) => template.document.requirements.length === 19));
});

test("application-requirement wave 02 excludes payment-account and applicant data", async () => {
  const serialized = (await readFile(draftPath, "utf8")).toLowerCase();
  for (const prohibited of ["account number", "swift code", "开户行", "银行账号", "passport number", "application number"]) {
    assert.equal(serialized.includes(prohibited.toLowerCase()), false);
  }
});
