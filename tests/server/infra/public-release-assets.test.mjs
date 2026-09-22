import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { loadPublicReleaseAssetManifest, pruneBuiltPublicAssets } from "../../../scripts/lib/public-release-assets.ts";

test("production public allowlist is closed over local page assets and excludes demo state", async () => {
  const manifest = await loadPublicReleaseAssetManifest();
  for (const excluded of [
    "completion.js", "completion.css", "cuac-data.js", "cuac-actions.js", "index.html", "home-v5.html",
    "hub.html", "favourites.html", "onboarding.html", "preferences.html", "notifications.js", "school-portal.js",
  ]) assert.equal(manifest.files.includes(excluded), false, excluded);
  for (const required of ["home-v3.html", "auth.html", "application.html", "shared-shell.js", "privacy.html"]) {
    assert.equal(manifest.files.includes(required), true, required);
  }
  for (const file of manifest.files.filter(file => file.endsWith(".html"))) {
    const source = await readFile(resolve("public", file), "utf8");
    assert.doesNotMatch(source, /(?:cuac-data|cuac-actions|completion)\.(?:js|css)/, file);
    assert.doesNotMatch(source, /<script(?![^>]*\bsrc=)[^>]*>|<style\b|\sstyle=/i, `${file} must remain compatible with the strict CSP`);
  }
});

test("built asset pruning removes only known public files outside the allowlist", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "cuac-public-assets-"));
  const publicDirectory = resolve(root, "public");
  const outputDirectory = resolve(root, "dist");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(publicDirectory); await mkdir(outputDirectory);
  await writeFile(resolve(publicDirectory, "active.html"), '<script src="active.js"></script>');
  await writeFile(resolve(publicDirectory, "active.js"), "void 0;");
  await writeFile(resolve(publicDirectory, "legacy.js"), "localStorage.clear();");
  await writeFile(resolve(outputDirectory, "active.html"), "built");
  await writeFile(resolve(outputDirectory, "active.js"), "built");
  await writeFile(resolve(outputDirectory, "legacy.js"), "built");
  await writeFile(resolve(outputDirectory, "generated.txt"), "generated");
  const manifestPath = resolve(root, "manifest.json");
  await writeFile(manifestPath, JSON.stringify({ version: 1, releaseScope: "school-handoff-v1", files: ["active.html", "active.js"] }));
  assert.deepEqual(await pruneBuiltPublicAssets(outputDirectory, publicDirectory, manifestPath), ["legacy.js"]);
  assert.equal(await readFile(resolve(outputDirectory, "generated.txt"), "utf8"), "generated");
});
