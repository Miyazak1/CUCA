export const STAGING_ACCEPTANCE_SCHEMA = "cuac.staging-acceptance.v1" as const;

export const STAGING_ACCEPTANCE_CONTROL_IDS = [
  "edge.https_waf_rate_limit",
  "app.health_and_lifecycle",
  "postgres.tls_and_acl",
  "postgres.migration",
  "postgres.backup_restore",
  "auth.staff_mfa",
  "auth.email_round_trip",
  "notification.delivery_round_trip",
  "payment.signed_round_trip",
  "files.oss_round_trip",
  "submission.signed_round_trip",
  "workers.supervision_and_recovery",
  "observability.alert_delivery",
  "security.secret_rotation",
  "product.core_role_e2e",
  "release.rollback",
] as const;

export type StagingAcceptanceControlId = (typeof STAGING_ACCEPTANCE_CONTROL_IDS)[number];
export type StagingAcceptanceStatus = "pending" | "passed" | "failed";

export type StagingAcceptanceManifest = {
  schema: typeof STAGING_ACCEPTANCE_SCHEMA;
  environment: "staging";
  generatedAt: string;
  release: {
    commitSha: string;
    imageDigest: string;
    migrationManifestSha256: string;
  };
  controls: Array<{
    id: StagingAcceptanceControlId;
    status: StagingAcceptanceStatus;
    observedAt: string | null;
    evidenceRef: string | null;
  }>;
};

export type StagingAcceptanceReport = {
  scope: "staging_evidence_preflight";
  runtimeVerified: false;
  reviewRequired: true;
  readyForReview: boolean;
  release: {
    commitSha: string | null;
    imageDigest: string | null;
    migrationManifestSha256: string | null;
  };
  failures: string[];
  controls: Array<{ id: StagingAcceptanceControlId; status: StagingAcceptanceStatus }>;
};

const evidenceMaxAgeMs = 30 * 24 * 60 * 60 * 1000;
const sha256 = /^[a-f0-9]{64}$/;
const commitSha = /^[a-f0-9]{40}$/;
const imageDigest = /^sha256:[a-f0-9]{64}$/;
const evidenceReference = /^artifact:sha256:[a-f0-9]{64}$/;

export function inspectStagingAcceptance(
  input: unknown,
  now = new Date(),
): StagingAcceptanceReport {
  if (!validDate(now)) throw new Error("A valid verifier time is required.");
  const manifest = parseManifest(input);
  const failures: string[] = [];
  const generatedAt = parseCanonicalTimestamp(manifest.generatedAt, "generatedAt");
  if (generatedAt.getTime() > now.getTime() + 5 * 60 * 1000) {
    failures.push("Staging evidence manifest time is in the future.");
  }
  if (now.getTime() - generatedAt.getTime() > evidenceMaxAgeMs) {
    failures.push("Staging evidence manifest is outside the 30-day release window.");
  }

  const release = {
    commitSha: validDigest(manifest.release.commitSha, commitSha) ? manifest.release.commitSha : null,
    imageDigest: validDigest(manifest.release.imageDigest, imageDigest) ? manifest.release.imageDigest : null,
    migrationManifestSha256: validDigest(manifest.release.migrationManifestSha256, sha256)
      ? manifest.release.migrationManifestSha256 : null,
  };
  if (!release.commitSha) failures.push("A non-placeholder 40-character release commit SHA is required.");
  if (!release.imageDigest) failures.push("A non-placeholder immutable container image digest is required.");
  if (!release.migrationManifestSha256) failures.push("A non-placeholder migration manifest SHA-256 is required.");

  const completedEvidenceReferences = new Set<string>();
  manifest.controls.forEach((control, index) => {
    if (control.id !== STAGING_ACCEPTANCE_CONTROL_IDS[index]) {
      throw new Error("Staging acceptance controls must use the fixed registry order.");
    }
    if (control.status === "pending") {
      if (control.observedAt !== null || control.evidenceRef !== null) {
        throw new Error("Pending staging controls cannot carry evidence.");
      }
      failures.push(`Staging control ${control.id} is pending.`);
      return;
    }
    if (typeof control.observedAt !== "string" || typeof control.evidenceRef !== "string") {
      throw new Error("Completed staging controls require evidence.");
    }
    const observedAt = parseCanonicalTimestamp(control.observedAt, `${control.id}.observedAt`);
    if (observedAt.getTime() > generatedAt.getTime() || generatedAt.getTime() - observedAt.getTime() > evidenceMaxAgeMs) {
      failures.push(`Staging control ${control.id} evidence is outside the 30-day release window.`);
    }
    if (!validDigest(control.evidenceRef, evidenceReference)) {
      failures.push(`Staging control ${control.id} requires a non-placeholder immutable evidence artifact reference.`);
    } else if (completedEvidenceReferences.has(control.evidenceRef)) {
      failures.push(`Staging control ${control.id} must use an evidence artifact distinct from every other control.`);
    } else {
      completedEvidenceReferences.add(control.evidenceRef);
    }
    if (control.status === "failed") failures.push(`Staging control ${control.id} failed.`);
  });

  return {
    scope: "staging_evidence_preflight",
    runtimeVerified: false,
    reviewRequired: true,
    readyForReview: failures.length === 0,
    release,
    failures,
    controls: manifest.controls.map(control => ({ id: control.id, status: control.status })),
  };
}

function parseManifest(input: unknown): StagingAcceptanceManifest {
  const root = exactRecord(input, ["schema", "environment", "generatedAt", "release", "controls"], "manifest");
  if (root.schema !== STAGING_ACCEPTANCE_SCHEMA || root.environment !== "staging"
    || typeof root.generatedAt !== "string" || !Array.isArray(root.controls)
    || root.controls.length !== STAGING_ACCEPTANCE_CONTROL_IDS.length) {
    throw new Error("Invalid staging acceptance manifest.");
  }
  const release = exactRecord(root.release, ["commitSha", "imageDigest", "migrationManifestSha256"], "release");
  if (typeof release.commitSha !== "string" || typeof release.imageDigest !== "string"
    || typeof release.migrationManifestSha256 !== "string") throw new Error("Invalid release identity.");
  const controls = root.controls.map((value, index) => {
    const control = exactRecord(value, ["id", "status", "observedAt", "evidenceRef"], `control ${index}`);
    if (!STAGING_ACCEPTANCE_CONTROL_IDS.includes(control.id as StagingAcceptanceControlId)
      || !["pending", "passed", "failed"].includes(String(control.status))
      || !(control.observedAt === null || typeof control.observedAt === "string")
      || !(control.evidenceRef === null || typeof control.evidenceRef === "string")) {
      throw new Error("Invalid staging acceptance control.");
    }
    return control as StagingAcceptanceManifest["controls"][number];
  });
  return {
    schema: root.schema,
    environment: root.environment,
    generatedAt: root.generatedAt,
    release: release as StagingAcceptanceManifest["release"],
    controls,
  };
}

function exactRecord(value: unknown, keys: string[], name: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${name}.`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`Unexpected ${name} fields.`);
  }
  return value as Record<string, unknown>;
}

function parseCanonicalTimestamp(value: string, name: string): Date {
  const date = new Date(value);
  if (!validDate(date) || date.toISOString() !== value) throw new Error(`${name} must be a canonical UTC timestamp.`);
  return date;
}

function validDigest(value: string, pattern: RegExp): boolean {
  if (!pattern.test(value)) return false;
  const digest = value.slice(value.lastIndexOf(":") + 1);
  return !/^0+$/.test(digest) && !/^f+$/.test(digest);
}

function validDate(value: Date): boolean {
  return Number.isFinite(value.getTime());
}
