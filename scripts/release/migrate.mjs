import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

export async function readReleaseFiles(root) {
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error("Release root must not be a link.");
  const base = await realpath(root);
  const files = new Map();
  let totalBytes = 0;
  async function visit(directory) {
    for (const name of (await readdir(directory)).sort()) {
      const path = join(directory, name), stat = await lstat(path);
      if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) throw new Error("Release contains a link or special file.");
      if (stat.isDirectory()) await visit(path);
      else {
        if (stat.nlink !== 1) throw new Error("Release contains a hard-linked file.");
        const key = relative(base, path).split(sep).join("/");
        if (key === "release-manifest.json") continue;
        totalBytes += stat.size;
        if (stat.size > 16 * 1024 * 1024 || totalBytes > 256 * 1024 * 1024 || files.size >= 20_000) throw new Error("Release exceeds file limits.");
        files.set(key, await readFile(path));
      }
    }
  }
  await visit(base);
  return files;
}

export async function verifyRelease(root, expectedDigest) {
  if (!/^[a-f0-9]{64}$/.test(expectedDigest ?? "")) throw new Error("An externally recorded manifest SHA-256 is required.");
  const manifestPath = join(root, "release-manifest.json");
  const stat = await lstat(manifestPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 8 * 1024 * 1024) throw new Error("Release manifest must be a bounded regular file.");
  const bytes = await readFile(manifestPath);
  if (sha256(bytes) !== expectedDigest) throw new Error("Release manifest digest does not match the expected release.");
  const manifest = JSON.parse(bytes.toString("utf8"));
  if (manifest.format !== "cuac-postgres-release-v1" || !manifest.files || typeof manifest.files !== "object" || Array.isArray(manifest.files)) throw new Error("Invalid release manifest.");
  if (manifest.nodeVersion !== process.version) throw new Error("Node version differs from the validated release runtime.");
  const files = await readReleaseFiles(root);
  if (files.size !== Object.keys(manifest.files).length) throw new Error("Release file inventory changed.");
  for (const [path, bytes] of files) {
    if (manifest.files[path]?.sha256 !== sha256(bytes) || manifest.files[path]?.bytes !== bytes.length) throw new Error("Release file integrity check failed.");
  }
  return { manifest, files };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || !["--verify-only", "--apply"].includes(args[0]) || !/^--manifest-sha256=[a-f0-9]{64}$/.test(args[1])) throw new Error("Use --verify-only or --apply followed by --manifest-sha256=<recorded digest>.");
  if (process.env.PG_MIGRATIONS_FOLDER || process.env.NODE_OPTIONS || process.env.NODE_PATH || process.env.PG_FORCE_NATIVE) throw new Error("Release runtime overrides are not allowed.");
  const root = dirname(fileURLToPath(import.meta.url)), digest = args[1].slice("--manifest-sha256=".length);
  const { manifest, files } = await verifyRelease(root, digest);
  if (args[0] === "--verify-only") {
    console.log(JSON.stringify({ status: "verified", manifestSha256: digest, migrations: manifest.migrations, nodeVersion: manifest.nodeVersion }));
    return;
  }
  if (!["development", "staging", "production"].includes(process.env.CUAC_MIGRATION_TARGET_ENV)) throw new Error("Set an explicit migration target environment.");
  // Only after every packaged byte is checked may database driver/runtime modules execute.
  const { createPostgresMigrationConfig, runPostgresMigrationPlan } = await import("./src/server/db/migration-runtime.js");
  const config = createPostgresMigrationConfig(join(root, "drizzle/pg"));
  const plan = JSON.parse(files.get("migration-plan.json").toString("utf8"));
  const result = await runPostgresMigrationPlan(config, plan);
  console.log(JSON.stringify({ status: "applied", manifestSha256: digest, targetEnvironment: result.targetEnvironment,
    appliedBefore: result.appliedBefore, appliedNow: result.appliedNow, appliedTotal: result.appliedTotal }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    // PostgreSQL errors can contain credentials, hostnames, SQL or row values.
    console.error("Migration release rejected or execution failed. Inspect the protected release record and database ledger before retrying.");
    process.exitCode = 1;
  });
}
