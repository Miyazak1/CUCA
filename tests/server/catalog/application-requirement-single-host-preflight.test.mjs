import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { validateRequirementReleaseCandidate } from "../../../scripts/lib/catalog-requirement-candidate-runtime.ts";
import {
  assertSingleHostRequirementPreflightTarget,
  preflightSingleHostRequirementCandidate,
} from "../../../scripts/lib/catalog-requirement-single-host-preflight.ts";

const candidate = validateRequirementReleaseCandidate(JSON.parse(await readFile(
  new URL("../../../seeds/application-requirements-release-candidate.unreviewed.json", import.meta.url), "utf8")));

test("single-host requirement preflight accepts only the explicit loopback trial target", () => {
  const env = {
    CUAC_REQUIREMENT_PREFLIGHT_TARGET: "single_host_read_only",
    CUAC_ENV: "development",
    CUAC_LOCAL_RUNTIME: "1",
    DATABASE_URL: "postgresql://cuac_local:secret@127.0.0.1:55432/cuac_local",
  };
  assert.deepEqual(assertSingleHostRequirementPreflightTarget(env), { hostname: "127.0.0.1", databaseName: "cuac_local" });
  assert.throws(() => assertSingleHostRequirementPreflightTarget({ ...env, CUAC_ENV: "production" }), /owner-controlled/);
  assert.throws(() => assertSingleHostRequirementPreflightTarget({ ...env, DATABASE_URL: "postgresql://cuac_local:secret@db.example.com/cuac_local" }), /loopback/);
  assert.throws(() => assertSingleHostRequirementPreflightTarget({ ...env, DATABASE_URL: "postgresql://cuac_local:secret@127.0.0.1:55432/cuac_prod" }), /cuac_local database/);
});

test("single-host requirement preflight reports resolved bindings without authorizing publication", async () => {
  let calls = 0;
  const client = {
    async query() {
      calls += 1;
      if (calls === 1) return { rows: [{
        requested: candidate.summary.operationCount,
        requested_schools: candidate.summary.schoolCount,
        requested_programs: candidate.summary.programCount,
        school_resolved_operations: candidate.summary.operationCount,
        program_resolved_operations: candidate.summary.operationCount,
        intake_resolved_operations: candidate.summary.operationCount,
        historical_resolved: candidate.summary.historicalOperationCount,
        current_resolved: candidate.summary.currentOperationCount,
        exact_existing_versions: 0,
        conflicting_version_one: 0,
      }] };
      return { rows: [] };
    },
  };
  const result = await preflightSingleHostRequirementCandidate(client, candidate);
  assert.equal(result.status, "ready_for_reviewed_import");
  assert.equal(result.readOnly, true);
  assert.equal(result.publicationAttempted, false);
  assert.equal(result.candidate.humanReviewCompleted, false);
  assert.equal(result.candidate.publicationAuthorized, false);
  assert.equal(result.counts.currentResolved, 347);
});
