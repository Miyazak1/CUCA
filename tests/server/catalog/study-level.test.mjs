import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyStudyLevels,
  normalizeStudyLevel,
  studyLevelSqlPredicate,
} from "../../../src/server/catalog/study-level.ts";

test("study levels normalize legacy route aliases", () => {
  assert.equal(normalizeStudyLevel("Bachelor"), "undergraduate");
  assert.equal(normalizeStudyLevel("PhD"), "doctoral");
  assert.equal(normalizeStudyLevel("Preparatory"), "foundation");
  assert.equal(normalizeStudyLevel("Chinese language"), "language");
  assert.equal(normalizeStudyLevel("Exchange"), "visiting");
  assert.equal(normalizeStudyLevel("Other non-degree"), "other-non-degree");
});

test("study levels preserve multi-level scholarship scope", () => {
  assert.deepEqual(classifyStudyLevels("Master; Doctoral"), ["master", "doctoral"]);
  assert.deepEqual(classifyStudyLevels("Foundation plus Bachelor"), ["undergraduate", "foundation", "non-degree"]);
  assert.deepEqual(classifyStudyLevels("Non-degree Chinese-language study"), ["language", "non-degree"]);
  assert.deepEqual(classifyStudyLevels("Non-degree / Research exchange"), ["visiting", "non-degree"]);
  assert.deepEqual(classifyStudyLevels("Non-degree"), ["non-degree", "other-non-degree"]);
});

test("study level SQL uses only canonical predicates", () => {
  assert.match(studyLevelSqlPredicate("p.degree_level", "PhD"), /p\.degree_level.*doctoral\|doctorate\|ph/);
  assert.match(studyLevelSqlPredicate("p.degree_level", "other-non-degree"), /!~/);
  assert.equal(studyLevelSqlPredicate("p.degree_level", "unknown-level"), undefined);
});
