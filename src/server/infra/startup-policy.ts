import { assertSafePostgresConnectionString, getDatabaseUrl } from "../db/postgres-client.ts";

const developmentEnvironments = new Set(["development", "dev", "test"]);
const commitShaPattern = /^[a-f0-9]{40}$/;
const imageDigestPattern = /^sha256:[a-f0-9]{64}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;

export type StagingCandidateIdentity = {
  commitSha: string;
  imageDigest: string;
  migrationManifestSha256: string;
};

export function assertSafeApplicationProcessEnvironment(
  env: Record<string, string | undefined> = process.env,
): void {
  if (env.NODE_OPTIONS || env.NODE_PATH || env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    throw new Error("Unsafe Node.js runtime override is not allowed.");
  }
}

export function assertUnreviewedApplicationStartAllowed(
  env: Record<string, string | undefined> = process.env,
): void {
  assertSafeApplicationProcessEnvironment(env);
  const environment = (env.CUAC_ENV ?? env.DEPLOY_ENV ?? "").trim().toLowerCase();
  if (!developmentEnvironments.has(environment)) {
    throw new Error("Unreviewed application startup is limited to an explicit development environment.");
  }
}

export function authorizeStagingCandidateStart(
  env: Record<string, string | undefined> = process.env,
): StagingCandidateIdentity {
  assertSafeApplicationProcessEnvironment(env);
  if ((env.CUAC_ENV ?? "").trim().toLowerCase() !== "staging"
    || (env.CUAC_REQUIRE_PRODUCTION_READY ?? "").trim().toLowerCase() !== "true") {
    throw new Error("Staging candidate startup requires the explicit staging hard-gate environment.");
  }

  const databaseUrl = getDatabaseUrl(env);
  if (!databaseUrl) throw new Error("Staging candidate PostgreSQL is not configured.");
  assertSafePostgresConnectionString(databaseUrl);
  if (/localhost|127\.0\.0\.1/i.test(databaseUrl)
    || (env.PGSSLMODE ?? "").trim().toLowerCase() !== "verify-full") {
    throw new Error("Staging candidate PostgreSQL must use remote verified TLS.");
  }

  const agentEnabled = (env.CUAC_AGENT_ENABLED ?? "").trim().toLowerCase();
  const directDbAccess = (env.CUAC_AGENT_DIRECT_DB_ACCESS ?? "").trim().toLowerCase();
  if (!["false", "disabled"].includes(agentEnabled) || !["false", "disabled"].includes(directDbAccess)) {
    throw new Error("Staging candidate startup requires Agent and Agent direct database access to be disabled.");
  }

  const identity = {
    commitSha: env.CUAC_RELEASE_COMMIT_SHA ?? "",
    imageDigest: env.CUAC_RELEASE_IMAGE_DIGEST ?? "",
    migrationManifestSha256: env.CUAC_MIGRATION_MANIFEST_SHA256 ?? "",
  };
  if (!validReleaseIdentity(identity.commitSha, commitShaPattern)
    || !validReleaseIdentity(identity.imageDigest, imageDigestPattern)
    || !validReleaseIdentity(identity.migrationManifestSha256, sha256Pattern)) {
    throw new Error("Staging candidate startup requires exact non-placeholder release identities.");
  }
  return identity;
}

function validReleaseIdentity(value: string, pattern: RegExp): boolean {
  if (!pattern.test(value)) return false;
  const digest = value.slice(value.lastIndexOf(":") + 1);
  return !/^0+$/.test(digest) && !/^f+$/.test(digest);
}
