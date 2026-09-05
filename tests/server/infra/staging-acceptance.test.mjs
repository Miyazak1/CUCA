import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseEnv } from "node:util";
import {
  inspectStagingAcceptance,
  STAGING_ACCEPTANCE_CONTROL_IDS,
  STAGING_ACCEPTANCE_SCHEMA,
} from "../../../src/server/infra/staging-acceptance.ts";

const now = new Date("2026-09-03T12:00:00.000Z");
const digest = character => character.repeat(64);
const evidenceDigest = index => (index + 1).toString(16).padStart(64, "0");

function manifest(status = "passed") {
  return {
    schema: STAGING_ACCEPTANCE_SCHEMA,
    environment: "staging",
    generatedAt: now.toISOString(),
    release: {
      commitSha: "a".repeat(40),
      imageDigest: `sha256:${digest("b")}`,
      migrationManifestSha256: digest("c"),
    },
    controls: STAGING_ACCEPTANCE_CONTROL_IDS.map((id, index) => ({
      id,
      status,
      observedAt: status === "pending" ? null : new Date(now.getTime() - index * 60_000).toISOString(),
      evidenceRef: status === "pending" ? null : `artifact:sha256:${evidenceDigest(index)}`,
    })),
  };
}

test("complete staging evidence is ready only for protected human review", () => {
  const report = inspectStagingAcceptance(manifest(), now);
  assert.equal(report.readyForReview, true);
  assert.equal(report.runtimeVerified, false);
  assert.equal(report.reviewRequired, true);
  assert.equal(report.scope, "staging_evidence_preflight");
  assert.equal(report.controls.length, STAGING_ACCEPTANCE_CONTROL_IDS.length);
  assert.deepEqual(report.failures, []);
  assert.doesNotMatch(JSON.stringify(report), /evidenceRef|artifact:sha256/);
});

test("the checked-in staging template is valid but intentionally blocked", async () => {
  const template = JSON.parse(await readFile(new URL("../../../config/staging-acceptance.example.json", import.meta.url), "utf8"));
  const report = inspectStagingAcceptance(template, now);
  assert.equal(report.readyForReview, false);
  assert.equal(report.controls.every(control => control.status === "pending"), true);
  assert.equal(report.failures.some(message => /container image digest/.test(message)), true);
  assert.equal(report.failures.filter(message => / is pending\./.test(message)).length,
    STAGING_ACCEPTANCE_CONTROL_IDS.length);
});

test("staging evidence registry rejects omitted, reordered, extra, and self-asserted controls", () => {
  const omitted = manifest();
  omitted.controls.pop();
  assert.throws(() => inspectStagingAcceptance(omitted, now), /Invalid staging acceptance manifest/);

  const reordered = manifest();
  [reordered.controls[0], reordered.controls[1]] = [reordered.controls[1], reordered.controls[0]];
  assert.throws(() => inspectStagingAcceptance(reordered, now), /fixed registry order/);

  const extra = manifest();
  extra.controls[0].actorUserId = "forged";
  assert.throws(() => inspectStagingAcceptance(extra, now), /Unexpected control 0 fields/);

  const pendingWithEvidence = manifest();
  pendingWithEvidence.controls[0] = {
    ...pendingWithEvidence.controls[0],
    status: "pending",
  };
  assert.throws(() => inspectStagingAcceptance(pendingWithEvidence, now), /Pending staging controls cannot carry evidence/);
});

test("failed, stale, future, and placeholder evidence cannot reach review", () => {
  const failed = manifest();
  failed.controls[3].status = "failed";
  assert.equal(inspectStagingAcceptance(failed, now).readyForReview, false);

  const stale = manifest();
  stale.controls[4].observedAt = "2026-07-01T00:00:00.000Z";
  assert.match(inspectStagingAcceptance(stale, now).failures.join("\n"), /outside the 30-day release window/);

  const future = manifest();
  future.generatedAt = "2026-09-03T12:06:00.000Z";
  assert.match(inspectStagingAcceptance(future, now).failures.join("\n"), /in the future/);

  const staleManifest = manifest();
  staleManifest.generatedAt = "2026-08-01T12:00:00.000Z";
  staleManifest.controls.forEach(control => {
    control.observedAt = staleManifest.generatedAt;
  });
  assert.match(inspectStagingAcceptance(staleManifest, now).failures.join("\n"),
    /manifest is outside the 30-day release window/);

  const placeholder = manifest();
  placeholder.release.imageDigest = `sha256:${digest("0")}`;
  placeholder.controls[0].evidenceRef = `artifact:sha256:${digest("0")}`;
  const report = inspectStagingAcceptance(placeholder, now);
  assert.equal(report.readyForReview, false);
  assert.match(report.failures.join("\n"), /container image digest/);
  assert.match(report.failures.join("\n"), /immutable evidence artifact reference/);
});

test("each completed staging control requires a distinct evidence artifact", () => {
  const duplicate = manifest();
  duplicate.controls[1].evidenceRef = duplicate.controls[0].evidenceRef;

  const report = inspectStagingAcceptance(duplicate, now);
  assert.equal(report.readyForReview, false);
  assert.match(report.failures.join("\n"), /distinct from every other control/);
});

test("environment templates cannot claim runtime acceptance through self-declared flags alone", async () => {
  const values = parseEnv(await readFile(new URL("../../../config/staging.env.example", import.meta.url), "utf8"));
  assert.equal(values.CUAC_REQUIRE_PRODUCTION_READY, "true");
  assert.equal(values.CUAC_AUTH_EMAIL_STAGING_ACCEPTED, "false");
  assert.equal(values.CUAC_NOTIFICATION_STAGING_ACCEPTED, "false");
  assert.equal(values.CUAC_PAYMENT_STAGING_ACCEPTED, "false");
  assert.equal(values.CUAC_FILE_STAGING_ACCEPTED, "false");
  assert.equal(values.CUAC_SUBMISSION_DELIVERY_STAGING_ACCEPTED, "false");
});
