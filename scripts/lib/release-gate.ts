import { lstat, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { inspectProductionReadiness } from "../../src/server/infra/production-readiness.ts";
import { inspectReleaseGate, type ReleaseGateReport } from "../../src/server/infra/release-gate.ts";
import { inspectStagingAcceptance } from "../../src/server/infra/staging-acceptance.ts";

export async function loadReleaseGateReport(
  manifestPath: string,
  env: Record<string, string | undefined> = process.env,
): Promise<ReleaseGateReport> {
  const path = resolve(manifestPath);
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > 128 * 1024) {
    throw new Error("Staging evidence manifest must be a bounded regular file.");
  }

  const manifest = JSON.parse(await readFile(path, "utf8"));
  return inspectReleaseGate(inspectProductionReadiness(env), inspectStagingAcceptance(manifest), {
    commitSha: env.CUAC_RELEASE_COMMIT_SHA,
    imageDigest: env.CUAC_RELEASE_IMAGE_DIGEST,
    migrationManifestSha256: env.CUAC_MIGRATION_MANIFEST_SHA256,
  });
}
