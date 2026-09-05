import assert from "node:assert/strict";
import test from "node:test";
import { inspectReleaseGate } from "../../../src/server/infra/release-gate.ts";

const identity = {
  commitSha: "1234567890abcdef1234567890abcdef12345678",
  imageDigest: `sha256:${"1a".repeat(32)}`,
  migrationManifestSha256: "2b".repeat(32),
};

function readiness(overrides = {}) {
  return {
    scope: "offline_preflight",
    runtimeVerified: false,
    environment: "staging",
    gateMode: "required",
    ready: true,
    failures: [],
    warnings: [],
    checks: [],
    ...overrides,
  };
}

function staging(overrides = {}) {
  return {
    scope: "staging_evidence_preflight",
    runtimeVerified: false,
    reviewRequired: true,
    readyForReview: true,
    release: { ...identity },
    failures: [],
    controls: [],
    ...overrides,
  };
}

test("release gate binds a required deployment preflight to the exact accepted artifacts", () => {
  const report = inspectReleaseGate(readiness(), staging(), identity);

  assert.equal(report.readyForHumanReview, true);
  assert.equal(report.runtimeVerified, false);
  assert.equal(report.reviewRequired, true);
  assert.equal(report.deploymentAuthorized, false);
  assert.deepEqual(report.release.expected, identity);
  assert.deepEqual(report.release.evidence, identity);
  assert.deepEqual(report.failures, []);
});

test("release gate rejects evidence from another commit image or migration release", () => {
  for (const [field, value, label] of [
    ["commitSha", "876543210fedcba9876543210fedcba987654321", "commit SHA"],
    ["imageDigest", `sha256:${"3c".repeat(32)}`, "container image digest"],
    ["migrationManifestSha256", "4d".repeat(32), "migration manifest SHA-256"],
  ]) {
    const report = inspectReleaseGate(readiness(), staging({ release: { ...identity, [field]: value } }), identity);
    assert.equal(report.readyForHumanReview, false);
    assert.match(report.failures.join("\n"), new RegExp(`${label} does not match`));
  }
});

test("release gate rejects advisory local checks and incomplete staging evidence", () => {
  const report = inspectReleaseGate(
    readiness({ environment: "development", gateMode: "advisory", ready: true }),
    staging({ readyForReview: false }),
    identity,
  );

  assert.equal(report.readyForHumanReview, false);
  assert.match(report.failures.join("\n"), /staging or production environment/);
  assert.match(report.failures.join("\n"), /hard production-readiness gate/);
  assert.match(report.failures.join("\n"), /Staging acceptance evidence is not ready/);
});

test("release gate rejects missing malformed and placeholder expected identities", () => {
  for (const expected of [
    {},
    { commitSha: "not-a-sha", imageDigest: "sha256:no", migrationManifestSha256: "no" },
    { commitSha: "0".repeat(40), imageDigest: `sha256:${"f".repeat(64)}`, migrationManifestSha256: "0".repeat(64) },
  ]) {
    const report = inspectReleaseGate(readiness(), staging(), expected);
    assert.equal(report.readyForHumanReview, false);
    assert.equal(report.release.expected.commitSha, null);
    assert.equal(report.release.expected.imageDigest, null);
    assert.equal(report.release.expected.migrationManifestSha256, null);
    assert.equal(report.failures.filter(message => /Expected/.test(message)).length, 3);
  }
});

test("release gate revalidates inconsistent staging report identities", () => {
  const report = inspectReleaseGate(
    readiness(),
    staging({
      readyForReview: true,
      release: { commitSha: null, imageDigest: "sha256:no", migrationManifestSha256: "0".repeat(64) },
    }),
    identity,
  );

  assert.equal(report.readyForHumanReview, false);
  assert.deepEqual(report.release.evidence, {
    commitSha: null,
    imageDigest: null,
    migrationManifestSha256: null,
  });
  assert.equal(report.failures.filter(message => /^Staging evidence/.test(message)).length, 3);
});
