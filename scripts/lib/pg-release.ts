import { execFile } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, posix, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import ts from "typescript";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { checkMigrationSnapshots } from "./pg-schema-snapshot.ts";
import { assertMigrationPlan } from "../../src/server/db/migration-guard.ts";
import { readReleaseFiles, sha256, verifyRelease } from "../release/migrate.mjs";

type LockedPackage = {
  version?: string; resolved?: string; integrity?: string; link?: boolean;
  dependencies?: Record<string, string>; optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>; peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  dev?: boolean; devOptional?: boolean; hasInstallScript?: boolean; os?: string[]; cpu?: string[];
  [key: string]: unknown;
};
type PackageLock = { lockfileVersion: number; packages: Record<string, LockedPackage> };
const runtimeSources = ["src/server/db/migration-runtime.ts", "src/server/db/migration-guard.ts", "src/server/db/postgres-client.ts", "src/server/shared/errors.ts", "src/server/shared/application-lifecycle.ts"];
const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
const exec = promisify(execFile);

async function publishReleaseDirectory(source: string, destination: string, digest: string) {
  let renameBlocked = false;
  for (let attempt = 0; ; attempt += 1) {
    try {
      await rename(source, destination);
      return;
    } catch (error) {
      const code = error instanceof Error && "code" in error ? error.code : undefined;
      if (code !== "EPERM" && code !== "EBUSY") throw error;
      if (attempt >= 5) { renameBlocked = true; break; }
      await delay(100 * 2 ** attempt);
    }
  }
  if (!renameBlocked) throw new Error("Release publication did not reach a terminal state.");
  let ownsDestination = false;
  try {
    await mkdir(destination);
    ownsDestination = true;
    const files = await readReleaseFiles(source);
    files.set("release-manifest.json", await readFile(join(source, "release-manifest.json")));
    for (const [path, bytes] of files) {
      const target = join(destination, ...path.split("/"));
      if (!target.startsWith(destination + sep)) throw new Error("Release copy path escaped its digest directory.");
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes, { flag: "wx" });
    }
    await verifyRelease(destination, digest);
  } catch (error) {
    if (ownsDestination) await rm(destination, { recursive: true });
    throw error;
  }
}

export function migrationDependencyLock(source: PackageLock) {
  if (source.lockfileVersion !== 3 || !source.packages) throw new Error("Release requires npm lockfile version 3.");
  const selected = new Map<string, LockedPackage>();
  function resolveDependency(from: string, name: string): string {
    if (!/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(name) || name.split("/").some(part => part === "." || part === "..")) throw new Error("Unsupported dependency name.");
    let parent = from;
    while (true) {
      const path = `${parent ? parent + "/" : ""}node_modules/${name}`;
      if (source.packages[path]) return path;
      if (!parent) throw new Error("A required migration dependency is missing from the lockfile.");
      const split = parent.lastIndexOf("/node_modules/");
      parent = split < 0 ? "" : parent.slice(0, split);
    }
  }
  function visit(path: string) {
    if (selected.has(path)) return;
    const item = source.packages[path];
    if (!item || item.link || item.hasInstallScript || item.os || item.cpu || !/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/.test(item.version ?? "")
      || !/^https:\/\/registry\.npmjs\.org\//.test(item.resolved ?? "") || !/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(item.integrity ?? "")) {
      throw new Error("Migration dependencies require pinned registry integrity and portable script-free packages.");
    }
    const copy = { ...item };
    delete copy.dev;
    delete copy.devOptional;
    selected.set(path, copy);
    const peers = Object.keys(item.peerDependencies ?? {}).filter(name => !item.peerDependenciesMeta?.[name]?.optional);
    for (const name of new Set([...Object.keys(item.dependencies ?? {}), ...Object.keys(item.optionalDependencies ?? {}), ...peers])) {
      visit(resolveDependency(path, name));
    }
  }
  for (const name of ["pg", "drizzle-orm"]) visit(resolveDependency("", name));
  const dependencies = Object.fromEntries(["drizzle-orm", "pg"].map(name => [name, selected.get(`node_modules/${name}`)!.version!]));
  const packageJson = { name: "cuac-postgres-migration-release", version: "1.0.0", private: true, type: "module", engines: { node: process.version.slice(1) }, dependencies };
  const lock = { name: packageJson.name, version: packageJson.version, lockfileVersion: 3, requires: true,
    packages: { "": { name: packageJson.name, version: packageJson.version, dependencies, engines: packageJson.engines }, ...Object.fromEntries([...selected].sort(([a], [b]) => a.localeCompare(b))) } };
  return { packageJson, lock, selected };
}

function compileRuntime(source: string, file: string): string {
  const result = ts.transpileModule(source, { fileName: file, reportDiagnostics: true, compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, rewriteRelativeImportExtensions: true, newLine: ts.NewLineKind.LineFeed,
  } });
  if (result.diagnostics?.some(item => item.category === ts.DiagnosticCategory.Error)) throw new Error("Migration runtime compilation failed.");
  const parsed = ts.createSourceFile(file, result.outputText, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function inspect(node: ts.Node) {
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === "require")) {
      throw new Error("Migration runtime dynamic imports require an explicit packaging review.");
    }
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      if (specifier.startsWith(".")) {
        const resolved = posix.normalize(posix.join(posix.dirname(file), specifier));
        if (!runtimeSources.map(path => path.replace(/\.ts$/, ".js")).includes(resolved)) throw new Error("Migration runtime imports a module outside its release allowlist.");
      } else if (!specifier.startsWith("node:") && !["pg", "drizzle-orm/migrator"].includes(specifier)) throw new Error("Migration runtime imports an unapproved package.");
    }
    ts.forEachChild(node, inspect);
  }
  inspect(parsed);
  return result.outputText;
}

export async function buildMigrationRelease(project: string) {
  const root = await realpath(project);
  const outputParent = join(root, "releases", "postgres");
  await mkdir(outputParent, { recursive: true });
  if (await realpath(outputParent) !== outputParent) throw new Error("Release output parent redirects outside the project.");
  const parent = join(outputParent, ".staging");
  await mkdir(parent, { recursive: true });
  if (await realpath(parent) !== parent) throw new Error("Release staging parent redirects outside the project.");
  const temp = await mkdtemp(join(parent, "migration-release-"));
  const owned = async () => {
    const actual = await realpath(temp);
    if (dirname(actual) !== parent || !actual.startsWith(parent + sep + "migration-release-")) throw new Error("Release staging ownership changed.");
  };
  try {
    await owned();
    const folder = join(root, "drizzle/pg"), checked = await checkMigrationSnapshots(folder);
    const lockBytes = await readFile(join(root, "package-lock.json"));
    const sourceLock = JSON.parse(lockBytes.toString("utf8")) as PackageLock;
    if (sourceLock.packages["node_modules/typescript"]?.version !== ts.version) throw new Error("Installed compiler differs from the project lockfile.");
    const { packageJson, lock, selected } = migrationDependencyLock(sourceLock);
    const release = join(temp, "payload");
    await mkdir(release);
    const sources: Record<string, string> = {};
    async function put(path: string, bytes: string | Buffer) {
      await mkdir(dirname(join(release, path)), { recursive: true });
      await writeFile(join(release, path), bytes, { flag: "wx" });
    }
    // Snapshot source bytes before packaging; reject concurrent changes at the end of the build.
    const journalBytes = await readFile(join(folder, "meta/_journal.json"));
    const journal = JSON.parse(journalBytes.toString("utf8"));
    const artifactPaths = ["drizzle/pg/_schema-baseline.json", "drizzle/pg/meta/_journal.json",
      ...journal.entries.map((entry: { tag: string }) => `drizzle/pg/${entry.tag}.sql`)];
    const snapshots = await readReleaseFiles(folder);
    for (const path of snapshots.keys()) if (/^meta\/\d{4}_snapshot\.json$/.test(path)) artifactPaths.push(`drizzle/pg/${path}`);
    const buildEvidence = ["src/server/db/schema.ts", "scripts/lib/pg-release.ts", "scripts/lib/pg-schema-snapshot.ts"];
    for (const path of [...runtimeSources, ...buildEvidence, "scripts/release/migrate.mjs", ...artifactPaths]) {
      const full = join(root, path), stat = await lstat(full);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Release source must be a regular file.");
      const bytes = await readFile(full);
      sources[path] = sha256(bytes);
      if (runtimeSources.includes(path)) await put(path.replace(/\.ts$/, ".js"), compileRuntime(bytes.toString("utf8"), path));
      else if (path === "scripts/release/migrate.mjs") await put("run.mjs", bytes);
      else if (buildEvidence.includes(path)) await put(`evidence/${path}.txt`, bytes);
      else await put(path, bytes);
    }
    const plan = readMigrationFiles({ migrationsFolder: join(release, "drizzle/pg") });
    assertMigrationPlan(plan);
    await put("migration-plan.json", json(plan));
    await put("package.json", json(packageJson));
    await put("package-lock.json", json(lock));
    const npmCli = process.env.npm_execpath ?? join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
    for (const file of ["npm-user.config", "npm-global.config"]) await writeFile(join(temp, file), "", { flag: "wx" });
    const npmEnv: NodeJS.ProcessEnv = { NODE_ENV: "development", PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP,
      USERPROFILE: process.env.USERPROFILE, LOCALAPPDATA: process.env.LOCALAPPDATA, CI: "true" };
    const npmArgs = ["--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--bin-links=false",
      `--userconfig=${join(temp, "npm-user.config")}`, `--globalconfig=${join(temp, "npm-global.config")}`];
    const npmVersion = (await exec(process.execPath, [npmCli, "--version"], { cwd: release, env: npmEnv, windowsHide: true, timeout: 10_000 })).stdout.trim();
    try {
      await exec(process.execPath, [npmCli, "ci", ...npmArgs], { cwd: release, env: npmEnv, windowsHide: true, timeout: 60_000, maxBuffer: 2 * 1024 * 1024 });
    } catch { throw new Error("Offline release dependency installation failed; verify the approved npm cache and lockfile."); }
    if ((await readFile(join(release, "package-lock.json"), "utf8")) !== json(lock)) throw new Error("npm changed the release lockfile.");
    const installedLock = JSON.parse(await readFile(join(release, "node_modules/.package-lock.json"), "utf8"));
    if (JSON.stringify(Object.keys(installedLock.packages).sort()) !== JSON.stringify([...selected.keys()].sort())) throw new Error("Installed dependency inventory differs from the release lock.");
    for (const [path, item] of selected) {
      if (JSON.parse(await readFile(join(release, path, "package.json"), "utf8")).version !== item.version) throw new Error("Installed dependency version differs from the release lock.");
    }
    for (const [path, hash] of Object.entries(sources)) if (sha256(await readFile(join(root, path))) !== hash) throw new Error("Source changed during release build.");
    if (sha256(await readFile(join(root, "package-lock.json"))) !== sha256(lockBytes)) throw new Error("Project lockfile changed during release build.");
    if (JSON.stringify(await checkMigrationSnapshots(folder)) !== JSON.stringify(checked)) throw new Error("Migration baseline changed during release build.");
    const files = await readReleaseFiles(release);
    const manifest = { format: "cuac-postgres-release-v1", nodeVersion: process.version, compilerVersion: ts.version, npmVersion,
      sourceLockSha256: sha256(lockBytes), sourceFiles: sources, migrations: checked.migrations, snapshots: checked.snapshots, tables: checked.tables,
      dependencies: Object.fromEntries([...selected].map(([path, item]) => [path, { version: item.version, integrity: item.integrity }])),
      files: Object.fromEntries([...files].map(([path, bytes]) => [path, { bytes: bytes.length, sha256: sha256(bytes) }])) };
    const manifestBytes = json(manifest), digest = sha256(manifestBytes);
    await put("release-manifest.json", manifestBytes);
    await verifyRelease(release, digest);
    const output = join(outputParent, digest);
    let exists = true;
    try { await lstat(output); }
    catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
      exists = false;
    }
    if (exists) await verifyRelease(output, digest);
    else await publishReleaseDirectory(release, output, digest);
    return { output, manifestSha256: digest, files: files.size, dependencies: selected.size, ...checked };
  } finally { await owned(); await rm(temp, { recursive: true }); }
}
