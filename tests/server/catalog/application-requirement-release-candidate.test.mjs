import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateRequirementReleaseCandidate } from "../../../scripts/lib/catalog-requirement-candidate-runtime.ts";

const candidatePath = new URL("../../../seeds/application-requirements-release-candidate.unreviewed.json", import.meta.url);

test("requirement release candidate binds every ready template without authorizing publication", async () => {
  const candidate = validateRequirementReleaseCandidate(JSON.parse(await readFile(candidatePath, "utf8")));
  assert.deepEqual(candidate.authorization, {
    candidatePreparationAuthorized: true,
    executionAuthorized: false,
    persistentDatabaseWriteAuthorized: false,
    publicationAuthorized: false,
  });
  assert.deepEqual(candidate.decision, { humanReviewCompleted: false });
  assert.deepEqual(candidate.summary, {
    templateCount: 14,
    operationCount: 147,
    schoolCount: 7,
    programCount: 147,
    intakeBindingCount: 147,
    historicalOperationCount: 144,
    currentOperationCount: 3,
  });
  assert.ok(candidate.operations.every((operation) => operation.reviewStatus === "unreviewed"));
  assert.equal(candidate.operations.filter((operation) => operation.cycleState === "current_2027").length, 3);
});

test("candidate validation rejects an attempted publication authorization", async () => {
  const candidate = JSON.parse(await readFile(candidatePath, "utf8"));
  candidate.authorization.publicationAuthorized = true;
  assert.throws(() => validateRequirementReleaseCandidate(candidate), /cannot authorize/);
});
