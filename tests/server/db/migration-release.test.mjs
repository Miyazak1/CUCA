import assert from "node:assert/strict";
import { link, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createServer } from "node:net";
import test from "node:test";
import { buildMigrationRelease, migrationDependencyLock } from "../../../scripts/lib/pg-release.ts";
import { sha256, verifyRelease } from "../../../scripts/release/migrate.mjs";
import { releaseProject, withDetachedMigrationRelease } from "./migration-release-fixture.mjs";

const lock = JSON.parse(await readFile(join(releaseProject, "package-lock.json"), "utf8"));

test("migration release locks the runtime dependency closure without frontend or build packages", () => {
  const { packageJson, selected } = migrationDependencyLock(lock);
  assert.deepEqual(Object.keys(packageJson.dependencies), ["drizzle-orm", "pg"]);
  for (const [path, item] of selected) {
    assert.equal(item.version, lock.packages[path].version);
    assert.equal(item.integrity, lock.packages[path].integrity);
  }
  for (const name of ["react", "vinext", "drizzle-kit", "typescript", "pg-native"]) assert.equal(selected.has(`node_modules/${name}`), false);
});

test("migration release rejects unpinned nonregistry platform script and incomplete dependency locks", () => {
  for (const mutation of [
    item => { delete item.integrity; }, item => { item.resolved = "file:private"; }, item => { item.version = "^8.0.0"; },
    item => { item.hasInstallScript = true; }, item => { item.link = true; }, item => { item.os = ["win32"]; },
  ]) {
    const modified = structuredClone(lock); mutation(modified.packages["node_modules/pg"]);
    assert.throws(() => migrationDependencyLock(modified), /pinned registry integrity/);
  }
  const missing = structuredClone(lock); delete missing.packages["node_modules/pg-protocol"];
  assert.throws(() => migrationDependencyLock(missing), /missing from the lockfile/);
});

test("detached migration release has reproducible bytes and rejects tampering before connecting", { timeout: 180_000 }, async () => {
  await withDetachedMigrationRelease(async ({ build, folder, run }) => {
    const repeat = await buildMigrationRelease(releaseProject);
    assert.equal(repeat.manifestSha256, build.manifestSha256);
    assert.equal(repeat.output, build.output);
    const { manifest } = await verifyRelease(folder, build.manifestSha256);
    assert.ok(manifest.migrations >= 12);
    assert.equal(Object.keys(manifest.files).some(path => /^(?:public|app|seeds)\/|(?:^|\/)\.env/.test(path)), false);
    let connections = 0;
    const trap = createServer(socket => { connections++; socket.destroy(); });
    try {
      await new Promise((resolve, reject) => { trap.once("error", reject); trap.listen(0, "127.0.0.1", resolve); });
      const env = { DATABASE_URL: `postgresql://synthetic:PRIVATE_RELEASE_PASSWORD@127.0.0.1:${trap.address().port}/never_connect`, CUAC_MIGRATION_TARGET_ENV: "development" };
      assert.equal(JSON.parse((await run("--verify-only", env)).stdout).status, "verified");
      const rejects = (options = env, digest = build.manifestSha256) => assert.rejects(run("--apply", options, digest), error => {
        assert.equal(error.code, 1);
        assert.doesNotMatch(error.stdout + error.stderr, /PRIVATE_RELEASE_PASSWORD|never_connect|postgresql:\/\//);
        return true;
      });
      for (const path of ["migration-plan.json", "drizzle/pg/meta/_journal.json", "src/server/db/migration-runtime.js", "node_modules/pg/lib/index.js", "run.mjs"]) {
        const full = join(folder, path), original = await readFile(full);
        await writeFile(full, path.endsWith(".js") ? "console.log('PRIVATE_RELEASE_PASSWORD'); throw new Error('executed before verification');" : "changed");
        await assert.rejects(verifyRelease(folder, build.manifestSha256), /integrity/);
        // The bootstrap itself must be trusted externally; never execute a modified bootstrap.
        if (path !== "run.mjs") await rejects();
        await writeFile(full, original);
      }
      const extra = join(folder, ".env");
      await writeFile(extra, "PRIVATE_RELEASE_PASSWORD", { flag: "wx" });
      await rejects(); await rm(extra);
      const alias = join(folder, "linked-plan.json");
      await link(join(folder, "migration-plan.json"), alias);
      await assert.rejects(verifyRelease(folder, build.manifestSha256), /hard-linked/);
      await rm(alias);
      const manifestPath = join(folder, "release-manifest.json"), original = await readFile(manifestPath);
      const altered = { ...manifest, nodeVersion: "v0.0.0" };
      const bytes = JSON.stringify(altered);
      await writeFile(manifestPath, bytes);
      await rejects();
      await assert.rejects(verifyRelease(folder, sha256(bytes)), /Node version/);
      await writeFile(manifestPath, original);
      await rejects(env, "0".repeat(64));
      await rejects({ ...env, CUAC_MIGRATION_TARGET_ENV: "" });
      await rejects({ ...env, CUAC_MIGRATION_TARGET_ENV: "production" });
      await rejects({ ...env, PG_MIGRATIONS_FOLDER: releaseProject });
      assert.equal(connections, 0, "All invalid releases and overrides must reject before opening a socket");
      await rejects();
      assert.equal(connections, 1, "A valid apply reaches only the explicitly configured synthetic endpoint and redacts its failure");
      assert.equal(JSON.parse((await run()).stdout).manifestSha256, build.manifestSha256);
    } finally { await new Promise(resolve => trap.close(resolve)); }
  });
});
