import { lstat, readFile, readdir, rm } from "node:fs/promises";
import { basename, resolve } from "node:path";

export type PublicReleaseAssetManifest = {
  version: 1;
  releaseScope: "school-handoff-v1";
  files: string[];
};

const fileNamePattern = /^[a-z0-9][a-z0-9.-]*$/i;
const localReferencePattern = /["'`]\/?([a-z0-9][a-z0-9.-]*\.(?:html|js|css|svg))(?:[?#][^"'`]*)?["'`]/gi;

export async function loadPublicReleaseAssetManifest(
  manifestPath = resolve("config/public-release-assets.json"),
  publicDirectory = resolve("public"),
): Promise<PublicReleaseAssetManifest> {
  const parsed = JSON.parse(await readFile(manifestPath, "utf8")) as Partial<PublicReleaseAssetManifest>;
  if (parsed.version !== 1 || parsed.releaseScope !== "school-handoff-v1" || !Array.isArray(parsed.files)) {
    throw new Error("Public release asset manifest is invalid.");
  }
  if (parsed.files.length < 1 || new Set(parsed.files).size !== parsed.files.length) {
    throw new Error("Public release asset manifest must contain unique files.");
  }
  const sorted = [...parsed.files].sort((left, right) => left.localeCompare(right));
  if (JSON.stringify(sorted) !== JSON.stringify(parsed.files) || parsed.files.some(file => !fileNamePattern.test(file))) {
    throw new Error("Public release assets must be sorted safe top-level file names.");
  }

  const allowlist = new Set(parsed.files);
  for (const file of parsed.files) {
    const path = resolve(publicDirectory, file);
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Public release asset is not a regular file: ${file}`);
    if (!/\.(?:html|js|css)$/.test(file)) continue;
    const source = await readFile(path, "utf8");
    for (const match of source.matchAll(localReferencePattern)) {
      const reference = basename(match[1]);
      if (!allowlist.has(reference)) throw new Error(`Release asset ${file} references non-allowlisted asset ${reference}.`);
    }
  }
  return parsed as PublicReleaseAssetManifest;
}

export async function pruneBuiltPublicAssets(
  outputDirectory = resolve("dist"),
  publicDirectory = resolve("public"),
  manifestPath = resolve("config/public-release-assets.json"),
): Promise<string[]> {
  const manifest = await loadPublicReleaseAssetManifest(manifestPath, publicDirectory);
  const allowlist = new Set(manifest.files);
  const publicFiles = await readdir(publicDirectory, { withFileTypes: true });
  const removed: string[] = [];
  for (const entry of publicFiles) {
    if (!entry.isFile() || allowlist.has(entry.name)) continue;
    const outputPath = resolve(outputDirectory, entry.name);
    try {
      const outputStat = await lstat(outputPath);
      if (!outputStat.isFile() || outputStat.isSymbolicLink()) throw new Error(`Unsafe built public asset: ${entry.name}`);
      await rm(outputPath);
      removed.push(entry.name);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") continue;
      throw error;
    }
  }
  return removed.sort((left, right) => left.localeCompare(right));
}
