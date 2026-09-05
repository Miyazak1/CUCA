import type { ProductionReadinessReport } from "./production-readiness.ts";
import type { StagingAcceptanceReport } from "./staging-acceptance.ts";

export type ExpectedReleaseIdentity = {
  commitSha: string | undefined;
  imageDigest: string | undefined;
  migrationManifestSha256: string | undefined;
};

export type ReleaseGateReport = {
  scope: "release_gate_preflight";
  runtimeVerified: false;
  reviewRequired: true;
  deploymentAuthorized: false;
  readyForHumanReview: boolean;
  environment: ProductionReadinessReport["environment"];
  release: {
    expected: {
      commitSha: string | null;
      imageDigest: string | null;
      migrationManifestSha256: string | null;
    };
    evidence: StagingAcceptanceReport["release"];
  };
  readiness: {
    gateMode: ProductionReadinessReport["gateMode"];
    ready: boolean;
  };
  stagingEvidence: {
    readyForReview: boolean;
  };
  failures: string[];
};

const commitShaPattern = /^[a-f0-9]{40}$/;
const imageDigestPattern = /^sha256:[a-f0-9]{64}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;

export function inspectReleaseGate(
  readiness: ProductionReadinessReport,
  staging: StagingAcceptanceReport,
  expectedInput: ExpectedReleaseIdentity,
): ReleaseGateReport {
  const failures: string[] = [];
  const expected = {
    commitSha: validDigest(expectedInput.commitSha, commitShaPattern),
    imageDigest: validDigest(expectedInput.imageDigest, imageDigestPattern),
    migrationManifestSha256: validDigest(expectedInput.migrationManifestSha256, sha256Pattern),
  };
  const evidence = {
    commitSha: validDigest(staging.release.commitSha ?? undefined, commitShaPattern),
    imageDigest: validDigest(staging.release.imageDigest ?? undefined, imageDigestPattern),
    migrationManifestSha256: validDigest(staging.release.migrationManifestSha256 ?? undefined, sha256Pattern),
  };

  if (!expected.commitSha) failures.push("Expected release commit SHA is missing, malformed, or a placeholder.");
  if (!expected.imageDigest) failures.push("Expected immutable container image digest is missing, malformed, or a placeholder.");
  if (!expected.migrationManifestSha256) failures.push("Expected migration manifest SHA-256 is missing, malformed, or a placeholder.");
  if (!evidence.commitSha) failures.push("Staging evidence release commit SHA is missing, malformed, or a placeholder.");
  if (!evidence.imageDigest) failures.push("Staging evidence container image digest is missing, malformed, or a placeholder.");
  if (!evidence.migrationManifestSha256) failures.push("Staging evidence migration manifest SHA-256 is missing, malformed, or a placeholder.");

  if (readiness.environment !== "staging" && readiness.environment !== "production") {
    failures.push("Release review requires an explicit staging or production environment.");
  }
  if (readiness.gateMode !== "required") {
    failures.push("Release review requires the hard production-readiness gate.");
  }
  if (!readiness.ready) failures.push("Production-readiness preflight has blocking checks.");
  if (!staging.readyForReview) failures.push("Staging acceptance evidence is not ready for review.");

  compareIdentity(expected.commitSha, evidence.commitSha, "commit SHA", failures);
  compareIdentity(expected.imageDigest, evidence.imageDigest, "container image digest", failures);
  compareIdentity(
    expected.migrationManifestSha256,
    evidence.migrationManifestSha256,
    "migration manifest SHA-256",
    failures,
  );

  return {
    scope: "release_gate_preflight",
    runtimeVerified: false,
    reviewRequired: true,
    deploymentAuthorized: false,
    readyForHumanReview: failures.length === 0,
    environment: readiness.environment,
    release: { expected, evidence },
    readiness: { gateMode: readiness.gateMode, ready: readiness.ready },
    stagingEvidence: { readyForReview: staging.readyForReview },
    failures,
  };
}

function validDigest(value: string | undefined, pattern: RegExp): string | null {
  if (!value || !pattern.test(value)) return null;
  const digest = value.slice(value.lastIndexOf(":") + 1);
  return /^0+$/.test(digest) || /^f+$/.test(digest) ? null : value;
}

function compareIdentity(
  expected: string | null,
  evidence: string | null,
  label: string,
  failures: string[],
): void {
  if (expected && evidence && expected !== evidence) {
    failures.push(`Staging evidence ${label} does not match the release under review.`);
  }
}
