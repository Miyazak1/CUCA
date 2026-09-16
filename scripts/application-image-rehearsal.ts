import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { createPostgresMigrationConfig, runPostgresMigrations } from "../src/server/db/migration-runtime.ts";

const execFileAsync = promisify(execFile);
const project = resolve(new URL("../", import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, value => value.slice(1)));
const config = JSON.parse(await readFile(resolve(project, "config/application-runtime.linux.json"), "utf8"));
if (config.version !== 1 || config.platform !== "linux/amd64" || config.nodeVersion !== process.version
  || !/^node@sha256:[a-f0-9]{64}$/.test(config.nodeImage)) {
  throw new Error("Application Linux runtime configuration is invalid or differs from the build Node.js version.");
}

const owner = randomBytes(12).toString("hex");
const tag = "cuac-application:rehearsal";
const network = `cuac-app-${owner}`;
const database = `cuac-app-pg-${owner}`;
const application = `cuac-app-runtime-${owner}`;
const databaseName = `cuac_app_${owner}`;
const password = randomBytes(32).toString("hex");
const dockerEndpoint = process.platform === "win32" ? "npipe:////./pipe/dockerDesktopLinuxEngine" : "unix:///var/run/docker.sock";
let networkCreated = false;
let databaseCreated = false;
let applicationCreated = false;

async function docker(args: string[], options: { env?: NodeJS.ProcessEnv; timeout?: number } = {}) {
  const result = await execFileAsync("docker", ["--host", dockerEndpoint, ...args], {
    cwd: project,
    env: options.env ?? process.env,
    timeout: options.timeout ?? 30_000,
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  return { stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

async function ownedContainer(name: string) {
  assert.equal((await docker(["inspect", "--format", '{{index .Config.Labels "cuac.application.rehearsal"}}', name])).stdout, owner);
}

try {
  const build = await docker([
    "build", "--pull=false", "--platform", config.platform,
    "--build-arg", `CUAC_NODE_IMAGE=${config.nodeImage}`,
    "--label", `cuac.application.rehearsal=${owner}`,
    "-f", "scripts/application/Dockerfile", "-t", tag, ".",
  ], { timeout: 180_000 });
  if (build.stderr) console.log(build.stderr);

  const [image] = JSON.parse((await docker(["image", "inspect", tag])).stdout);
  assert.equal(image.Os, "linux");
  assert.equal(image.Architecture, "amd64");
  assert.equal(image.Config.User, "1000:1000");
  assert.deepEqual(image.Config.Entrypoint, ["node", "scripts/application-container-entry.ts"]);
  assert.ok(image.Config.Healthcheck?.Test?.includes("CMD"));
  assert.equal(image.Config.Labels?.["cuac.application.rehearsal"], owner);
  assert.match(image.Id, /^sha256:[a-f0-9]{64}$/);

  let rejected = false;
  try {
    await docker(["run", "--rm", "--read-only", "--tmpfs", "/tmp:rw,noexec,nosuid,size=16m", tag]);
  } catch (error) {
    const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr).trim() : "";
    assert.equal(stderr, "Application container startup rejected. Inspect the protected runtime configuration.");
    rejected = true;
  }
  assert.equal(rejected, true, "Container must fail closed without an explicit start mode.");

  await docker(["network", "create", "--label", `cuac.application.rehearsal=${owner}`,
    "--opt", "com.docker.network.bridge.enable_ip_masquerade=false", network]);
  networkCreated = true;
  const postgresImage = (await docker(["image", "inspect", "postgres:16-alpine", "--format", "{{.Id}}"])) .stdout;
  assert.match(postgresImage, /^sha256:[a-f0-9]{64}$/);
  await docker(["run", "--detach", "--name", database, "--pull", "never",
    "--label", `cuac.application.rehearsal=${owner}`, "--network", network, "--network-alias", "database",
    "--tmpfs", "/var/lib/postgresql/data:rw", "--publish", "127.0.0.1::5432",
    "--env", "POSTGRES_PASSWORD", "--env", "POSTGRES_USER=cuac_app", "--env", `POSTGRES_DB=${databaseName}`, postgresImage],
  { env: { ...process.env, POSTGRES_PASSWORD: password } });
  databaseCreated = true;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await docker(["exec", database, "pg_isready", "-U", "cuac_app", "-d", databaseName]);
      ready = true;
      break;
    } catch { await delay(250); }
  }
  assert.equal(ready, true, "Disposable PostgreSQL did not become ready.");
  const databaseBinding = (await docker(["port", database, "5432/tcp"])).stdout;
  const databasePort = /^127\.0\.0\.1:(\d+)$/.exec(databaseBinding)?.[1];
  assert.ok(databasePort);
  const hostDatabaseUrl = `postgresql://cuac_app:${password}@127.0.0.1:${databasePort}/${databaseName}`;
  await runPostgresMigrations(createPostgresMigrationConfig(resolve(project, "drizzle/pg"), {
    DATABASE_URL: hostDatabaseUrl,
    CUAC_MIGRATION_TARGET_ENV: "development",
    PGSSLMODE: "disable",
  }));

  const containerDatabaseUrl = `postgresql://cuac_app:${password}@database:5432/${databaseName}`;
  await docker(["run", "--detach", "--name", application,
    "--label", `cuac.application.rehearsal=${owner}`, "--network", network,
    "--read-only", "--tmpfs", "/tmp:rw,noexec,nosuid,size=32m", "--publish", "127.0.0.1::3000",
    "--env", "CUAC_START_MODE=development", "--env", "CUAC_ENV=development",
    "--env", "DATABASE_URL", "--env", "PGSSLMODE=disable", tag],
  { env: { ...process.env, DATABASE_URL: containerDatabaseUrl } });
  applicationCreated = true;
  const applicationBinding = (await docker(["port", application, "3000/tcp"])).stdout;
  const applicationPort = /^127\.0\.0\.1:(\d+)$/.exec(applicationBinding)?.[1];
  assert.ok(applicationPort);
  let health;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${applicationPort}/api/v1/health`);
      if (response.ok) { health = await response.json(); break; }
    } catch { /* startup is still in progress */ }
    await delay(250);
  }
  assert.equal(health?.status, "ok");
  assert.equal(health?.database?.reachable, true);
  assert.equal((await docker(["exec", application, "node", "-e", "if(process.getuid()!==1000||process.getgid()!==1000)process.exit(1)"])).stdout, "");
  await docker(["stop", "--time", "40", application], { timeout: 50_000 });
  const state = JSON.parse((await docker(["inspect", "--format", "{{json .State}}", application])).stdout);
  assert.equal(state.ExitCode, 0);
  console.log(JSON.stringify({ imageId: image.Id, platform: config.platform, nodeVersion: config.nodeVersion,
    nonRoot: true, readOnly: true, health: "ok", postgres: "reachable", shutdownExitCode: state.ExitCode }));
} finally {
  if (applicationCreated) {
    try { await ownedContainer(application); await docker(["rm", "--force", application]); } catch { /* report through the primary result */ }
  }
  if (databaseCreated) {
    try { await ownedContainer(database); await docker(["rm", "--force", database]); } catch { /* report through the primary result */ }
  }
  if (networkCreated) {
    try {
      assert.equal((await docker(["network", "inspect", "--format", '{{index .Labels "cuac.application.rehearsal"}}', network])).stdout, owner);
      await docker(["network", "rm", network]);
    } catch { /* report through the primary result */ }
  }
}
