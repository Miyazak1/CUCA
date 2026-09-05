import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { buildMigrationRelease } from "../../../scripts/lib/pg-release.ts";
import { verifyRelease } from "../../../scripts/release/migrate.mjs";

export const releaseProject = fileURLToPath(new URL("../../../", import.meta.url));

export async function withDetachedMigrationRelease(work) {
  let build;
  if (process.env.CUAC_PG_RELEASE_PATH || process.env.CUAC_PG_RELEASE_SHA256) {
    const output = await realpath(process.env.CUAC_PG_RELEASE_PATH);
    const manifestSha256 = process.env.CUAC_PG_RELEASE_SHA256;
    assert.equal(output, join(await realpath(releaseProject), "releases", "postgres", manifestSha256));
    const { manifest } = await verifyRelease(output, manifestSha256);
    build = { output, manifestSha256, dependencies: Object.keys(manifest.dependencies).length };
  } else build = await buildMigrationRelease(releaseProject);
  const parent = await realpath(tmpdir()), temp = await mkdtemp(join(parent, "cuac-release-test-"));
  const verifyOwned = async () => {
    const actual = await realpath(temp);
    assert.equal(dirname(actual), parent);
    assert.ok(actual.startsWith(parent + sep + "cuac-release-test-"));
  };
  try {
    await verifyOwned();
    assert.equal(temp.startsWith(await realpath(releaseProject)), false, "Release must run outside the checkout dependency tree");
    const folder = join(temp, "artifact");
    await cp(build.output, folder, { recursive: true });
    const run = (mode = "--verify-only", env = {}, digest = build.manifestSha256) => promisify(execFile)(process.execPath,
      [join(folder, "run.mjs"), mode, `--manifest-sha256=${digest}`], {
        cwd: temp, windowsHide: true, timeout: 20_000, maxBuffer: 1024 * 1024,
        env: { NODE_ENV: "test", PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, ...env },
      });
    await work({ build, folder, run });
  } finally { await verifyOwned(); await rm(temp, { recursive: true }); }
}
