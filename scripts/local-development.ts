import { execFile, spawn } from "node:child_process";
import { chmod, mkdir, open, readFile, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  LOCAL_INSTALLATION_LABEL,
  LOCAL_POSTGRES_IMAGE_TAG,
  LOCAL_RUNTIME_LABEL,
  LOCAL_RUNTIME_OWNER,
  LOCAL_STATE_RELATIVE_PATH,
  assertLocalDevelopmentState,
  assertLoopbackPostgresBinding,
  createLocalDevelopmentState,
  localRuntimeEnvironment,
  localSyntheticAccounts,
  isHealthyLocalApplicationStatus,
  parseLocalDevelopmentCommand,
  postgresDockerRunArgs,
  resolveLocalPort,
  type LocalDevelopmentState,
} from "./lib/local-development.ts";

const execFileAsync = promisify(execFile);
const projectDir = fileURLToPath(new URL("../", import.meta.url));
const statePath = resolve(projectDir, LOCAL_STATE_RELATIVE_PATH);
const seedReceiptPath = resolve(projectDir, ".cuac-local/seeded.json");
const dockerEndpoint = process.platform === "win32"
  ? "npipe:////./pipe/dockerDesktopLinuxEngine"
  : "unix:///var/run/docker.sock";

class DockerCommandError extends Error {
  readonly diagnostic: string;
  constructor(diagnostic: string) {
    super("Local Docker command failed.");
    this.diagnostic = diagnostic;
  }
}

type DockerResourceInspect = {
  Labels?: Record<string, string>;
  Config?: { Labels?: Record<string, string>; Image?: string };
  Mounts?: Array<{ Destination?: string; Type?: string; Name?: string }>;
  HostConfig?: { PortBindings?: Record<string, Array<{ HostIp?: string; HostPort?: string }>> };
  State?: { Running?: boolean; Health?: { Status?: string } };
};

async function docker(args: string[], env: NodeJS.ProcessEnv = process.env, timeout = 30_000): Promise<string> {
  try {
    const result = await execFileAsync("docker", ["--host", dockerEndpoint, ...args], {
      cwd: projectDir,
      env,
      timeout,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    });
    return result.stdout.trim();
  } catch (error) {
    const candidate = error as { stderr?: string; stdout?: string; message?: string };
    throw new DockerCommandError(`${candidate.stderr ?? ""}\n${candidate.stdout ?? ""}\n${candidate.message ?? ""}`);
  }
}

async function dockerOptional(args: string[]): Promise<string | null> {
  try {
    return await docker(args);
  } catch (error) {
    if (error instanceof DockerCommandError && /no such (object|container|volume)|not found/i.test(error.diagnostic)) return null;
    throw error;
  }
}

async function readState(): Promise<LocalDevelopmentState | null> {
  try {
    const value = JSON.parse(await readFile(statePath, "utf8")) as unknown;
    assertLocalDevelopmentState(value);
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new Error("Local runtime state cannot be read safely.", { cause: error });
  }
}

async function writeNewState(state: LocalDevelopmentState): Promise<LocalDevelopmentState> {
  await mkdir(dirname(statePath), { recursive: true });
  try {
    const handle = await open(statePath, "wx", 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(state, null, 2)}\n`, "utf8");
    } finally {
      await handle.close();
    }
    try { await chmod(statePath, 0o600); } catch { /* Windows ACLs remain inherited from the user profile. */ }
    return state;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const existing = await readState();
    if (!existing) throw new Error("Local runtime state creation raced without a readable result.");
    return existing;
  }
}

async function replaceState(state: LocalDevelopmentState): Promise<LocalDevelopmentState> {
  assertLocalDevelopmentState(state);
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  try { await chmod(statePath, 0o600); } catch { /* Windows ACLs remain inherited from the user profile. */ }
  return state;
}

async function recordSuccessfulSeed(state: LocalDevelopmentState): Promise<void> {
  await writeFile(seedReceiptPath, `${JSON.stringify({
    version: 1,
    owner: LOCAL_RUNTIME_OWNER,
    installationId: state.installationId,
    seededAt: new Date().toISOString(),
  }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  try { await chmod(seedReceiptPath, 0o600); } catch { /* Windows ACLs remain inherited from the user profile. */ }
}

async function assertSuccessfulSeed(state: LocalDevelopmentState): Promise<void> {
  try {
    const receipt = JSON.parse(await readFile(seedReceiptPath, "utf8")) as Record<string, unknown>;
    const keys = ["installationId", "owner", "seededAt", "version"];
    if (Object.keys(receipt).sort().join("\n") !== keys.join("\n")
      || receipt.version !== 1 || receipt.owner !== LOCAL_RUNTIME_OWNER
      || receipt.installationId !== state.installationId
      || typeof receipt.seededAt !== "string" || !Number.isFinite(Date.parse(receipt.seededAt))) throw new Error();
  } catch {
    throw new Error("Local accounts are not confirmed yet. Run start-cuac-local.bat and wait for provisioning to complete.");
  }
}

async function canBindLoopback(port: number): Promise<boolean> {
  return new Promise(resolveResult => {
    const server = createServer();
    server.unref();
    server.once("error", () => resolveResult(false));
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () => server.close(() => resolveResult(true)));
  });
}

async function allocateLoopbackPort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0, exclusive: true }, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate a loopback port."));
        return;
      }
      server.close(error => error ? reject(error) : resolvePort(address.port));
    });
  });
}

async function readApplicationHealth(url: string): Promise<unknown | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

function isCuacApplicationStatus(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && !Array.isArray(value)
    && (value as Record<string, unknown>).service === "cuac-backend");
}

async function ensureApplicationPort(state: LocalDevelopmentState): Promise<LocalDevelopmentState> {
  const healthUrl = `http://127.0.0.1:${state.applicationPort}/api/v1/health`;
  const current = await readApplicationHealth(healthUrl);
  if (isCuacApplicationStatus(current)) return state;
  if (current === null && await canBindLoopback(state.applicationPort)) return state;
  if (process.env.CUAC_LOCAL_APP_PORT !== undefined) {
    throw new Error(`CUAC_LOCAL_APP_PORT ${state.applicationPort} is already in use by another service.`);
  }
  const updated = await replaceState({ ...state, applicationPort: await allocateLoopbackPort() });
  console.log(`Application port ${state.applicationPort} belongs to another service; CUAC moved to ${updated.applicationPort}.`);
  return updated;
}

async function removeStaleVinextLock(): Promise<void> {
  const lockPath = resolve(projectDir, ".vinext/dev/lock.json");
  try {
    const lock = JSON.parse(await readFile(lockPath, "utf8")) as Record<string, unknown>;
    if (typeof lock.cwd !== "string" || resolve(lock.cwd) !== resolve(projectDir)
      || typeof lock.startedAt !== "number" || Date.now() - lock.startedAt < 30_000
      || typeof lock.appUrl !== "string") return;
    const url = new URL(lock.appUrl);
    if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname)) return;
    if (isCuacApplicationStatus(await readApplicationHealth(`${url.origin}/api/v1/health`))) return;
    await unlink(lockPath);
    console.log("Removed a stale CUAC Vinext development lock; no process was terminated.");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
  }
}

async function selectLoopbackPort(configured: string | undefined, preferred: number, label: string): Promise<number> {
  if (configured !== undefined) {
    const port = resolveLocalPort(configured, preferred, label);
    if (!await canBindLoopback(port)) throw new Error(`${label} is already in use.`);
    return port;
  }
  return await canBindLoopback(preferred) ? preferred : allocateLoopbackPort();
}

async function resolvePinnedPostgresImage(): Promise<string> {
  const imageId = await docker(["image", "inspect", LOCAL_POSTGRES_IMAGE_TAG, "--format", "{{.Id}}"]);
  if (!/^sha256:[a-f0-9]{64}$/.test(imageId)) throw new Error("Cached PostgreSQL image does not have a valid local image ID.");
  return imageId;
}

async function loadOrCreateState(): Promise<LocalDevelopmentState> {
  const existing = await readState();
  if (existing) {
    const configuredPostgresPort = process.env.CUAC_LOCAL_PG_PORT === undefined ? existing.postgresPort
      : resolveLocalPort(process.env.CUAC_LOCAL_PG_PORT, existing.postgresPort, "CUAC_LOCAL_PG_PORT");
    const configuredApplicationPort = process.env.CUAC_LOCAL_APP_PORT === undefined ? existing.applicationPort
      : resolveLocalPort(process.env.CUAC_LOCAL_APP_PORT, existing.applicationPort, "CUAC_LOCAL_APP_PORT");
    if (configuredPostgresPort !== existing.postgresPort || configuredApplicationPort !== existing.applicationPort) {
      throw new Error("Configured local ports do not match the existing owned CUAC runtime state.");
    }
    const inspected = await docker(["image", "inspect", existing.postgresImageId, "--format", "{{.Id}}"]);
    if (inspected !== existing.postgresImageId) throw new Error("Pinned local PostgreSQL image is no longer available.");
    return existing;
  }
  const postgresPort = await selectLoopbackPort(process.env.CUAC_LOCAL_PG_PORT, 55432, "CUAC_LOCAL_PG_PORT");
  const applicationPort = await selectLoopbackPort(process.env.CUAC_LOCAL_APP_PORT, 3000, "CUAC_LOCAL_APP_PORT");
  if (postgresPort === applicationPort) throw new Error("Local PostgreSQL and application ports must differ.");
  return writeNewState(createLocalDevelopmentState({
    postgresImageId: await resolvePinnedPostgresImage(),
    postgresPort,
    applicationPort,
  }));
}

async function verifyOwnedResource(kind: "volume" | "container", name: string, state: LocalDevelopmentState): Promise<boolean> {
  const inspectArgs = kind === "volume" ? ["volume", "inspect", name] : ["container", "inspect", name];
  const raw = await dockerOptional(inspectArgs);
  if (!raw) return false;
  const [resource] = JSON.parse(raw) as DockerResourceInspect[];
  const labels = kind === "volume" ? resource?.Labels : resource?.Config?.Labels;
  if (labels?.[LOCAL_RUNTIME_LABEL] !== LOCAL_RUNTIME_OWNER || labels?.[LOCAL_INSTALLATION_LABEL] !== state.installationId) {
    throw new Error(`Refusing to use ${kind} ${name}: ownership labels do not match this local installation.`);
  }
  if (kind === "container") {
    if (resource?.Config?.Image !== state.postgresImageId) throw new Error("Local PostgreSQL container image differs from pinned state.");
    const mount = resource?.Mounts?.filter(entry => entry.Destination === "/var/lib/postgresql/data");
    if (mount?.length !== 1 || mount[0]?.Type !== "volume" || mount[0]?.Name !== state.postgresVolume) {
      throw new Error("Local PostgreSQL data mount differs from pinned state.");
    }
    const binding = resource?.HostConfig?.PortBindings?.["5432/tcp"];
    if (!Array.isArray(binding) || binding.length !== 1 || binding[0]?.HostIp !== "127.0.0.1"
      || binding[0]?.HostPort !== String(state.postgresPort)) throw new Error("Local PostgreSQL port binding differs from pinned state.");
  }
  return true;
}

async function ensureVolume(state: LocalDevelopmentState): Promise<void> {
  if (await verifyOwnedResource("volume", state.postgresVolume, state)) return;
  await docker([
    "volume", "create",
    "--label", `${LOCAL_RUNTIME_LABEL}=${LOCAL_RUNTIME_OWNER}`,
    "--label", `${LOCAL_INSTALLATION_LABEL}=${state.installationId}`,
    state.postgresVolume,
  ]);
}

async function recreateContainerAfterPortConflict(state: LocalDevelopmentState, stopUnpublished = false): Promise<LocalDevelopmentState> {
  if (process.env.CUAC_LOCAL_PG_PORT !== undefined) {
    throw new Error(`CUAC_LOCAL_PG_PORT ${state.postgresPort} is already in use by another service.`);
  }
  if (!await verifyOwnedResource("container", state.postgresContainer, state)) throw new Error("Port-conflicted local container is no longer owned by this installation.");
  const running = await docker(["container", "inspect", state.postgresContainer, "--format", "{{.State.Running}}"]);
  if (running === "true") {
    if (!stopUnpublished) throw new Error("Refusing to reconfigure a running local PostgreSQL container.");
    await docker(["stop", "--time", "15", state.postgresContainer], process.env, 30_000);
  }
  await docker(["container", "rm", state.postgresContainer]);
  const updated = await replaceState({ ...state, postgresPort: await allocateLoopbackPort() });
  await docker(postgresDockerRunArgs(updated), { ...process.env, POSTGRES_PASSWORD: updated.databasePassword }, 60_000);
  return updated;
}

function isPortConflict(error: unknown): boolean {
  return error instanceof DockerCommandError && /port is already allocated|address already in use|bind for .* failed/i.test(error.diagnostic);
}

async function publishedPostgresBinding(state: LocalDevelopmentState): Promise<string | null> {
  try {
    return await docker(["port", state.postgresContainer, "5432/tcp"]);
  } catch (error) {
    if (error instanceof DockerCommandError && /no public port/i.test(error.diagnostic)) return null;
    throw error;
  }
}

async function waitForPostgres(state: LocalDevelopmentState): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await docker(["exec", state.postgresContainer, "pg_isready", "-U", state.databaseUser, "-d", state.databaseName]);
      return;
    } catch {
      await delay(250);
    }
  }
  throw new Error("Local PostgreSQL did not become ready.");
}

async function ensurePostgres(initialState: LocalDevelopmentState): Promise<LocalDevelopmentState> {
  let state = initialState;
  await ensureVolume(state);
  const exists = await verifyOwnedResource("container", state.postgresContainer, state);
  if (!exists) {
    try {
      await docker(postgresDockerRunArgs(state), { ...process.env, POSTGRES_PASSWORD: state.databasePassword }, 60_000);
    } catch (error) {
      if (!isPortConflict(error)) throw error;
      state = await recreateContainerAfterPortConflict(state);
    }
  } else {
    const running = await docker(["container", "inspect", state.postgresContainer, "--format", "{{.State.Running}}"]);
    if (running !== "true") {
      try {
        await docker(["start", state.postgresContainer]);
      } catch (error) {
        if (!isPortConflict(error)) throw error;
        state = await recreateContainerAfterPortConflict(state);
      }
    }
  }
  await waitForPostgres(state);
  let binding = await publishedPostgresBinding(state);
  if (!binding) {
    state = await recreateContainerAfterPortConflict(state, true);
    await waitForPostgres(state);
    binding = await publishedPostgresBinding(state);
  }
  if (!binding) throw new Error("Local PostgreSQL has no published loopback binding.");
  assertLoopbackPostgresBinding(binding, state);
  return state;
}

async function runNodeScript(script: string, state: LocalDevelopmentState): Promise<void> {
  const result = await execFileAsync(process.execPath, [resolve(projectDir, script)], {
    cwd: projectDir,
    env: localRuntimeEnvironment(state),
    timeout: 180_000,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

async function provision(): Promise<LocalDevelopmentState> {
  let state = await loadOrCreateState();
  state = await ensurePostgres(state);
  console.log(`Local PostgreSQL is ready on 127.0.0.1:${state.postgresPort}; data persists in ${state.postgresVolume}.`);
  await runNodeScript("scripts/pg-migrate.ts", state);
  await runNodeScript("scripts/local-seed.ts", state);
  await recordSuccessfulSeed(state);
  return state;
}

async function startDevelopmentServer(state: LocalDevelopmentState): Promise<number> {
  const cli = resolve(projectDir, "node_modules/vinext/dist/cli.js");
  console.log(`Starting CUAC local API at http://127.0.0.1:${state.applicationPort}`);
  console.log("Synthetic credentials are available through: npm run local:credentials");
  return new Promise<number>((resolveExit, reject) => {
    const child = spawn(process.execPath, [cli, "dev", "--hostname", "127.0.0.1", "--port", String(state.applicationPort)], {
      cwd: projectDir,
      env: localRuntimeEnvironment(state),
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", code => resolveExit(code ?? 1));
  });
}

async function runtimeStatus(): Promise<void> {
  const state = await readState();
  if (!state) {
    console.log(JSON.stringify({ configured: false, database: "absent", application: "not_checked" }, null, 2));
    return;
  }
  const container = await dockerOptional(["container", "inspect", state.postgresContainer]);
  let database: "absent" | "stopped" | "starting" | "healthy" | "unpublished" = "absent";
  if (container) {
    await verifyOwnedResource("container", state.postgresContainer, state);
    const [value] = JSON.parse(container) as DockerResourceInspect[];
    if (!value?.State?.Running) database = "stopped";
    else if (!await publishedPostgresBinding(state)) database = "unpublished";
    else database = value?.State?.Health?.Status === "healthy" ? "healthy" : "starting";
  }
  let application: "unreachable" | "healthy" | "degraded" = "unreachable";
  const body = await readApplicationHealth(`http://127.0.0.1:${state.applicationPort}/api/v1/health`);
  if (body !== null) application = isHealthyLocalApplicationStatus(body) ? "healthy" : "degraded";
  console.log(JSON.stringify({
    configured: true,
    database,
    application,
    databasePort: state.postgresPort,
    applicationUrl: `http://127.0.0.1:${state.applicationPort}`,
    persistentVolume: state.postgresVolume,
  }, null, 2));
}

async function stopDatabase(): Promise<void> {
  const state = await readState();
  if (!state) {
    console.log("Local runtime is not configured.");
    return;
  }
  if (!await verifyOwnedResource("container", state.postgresContainer, state)) {
    console.log("Local PostgreSQL container is absent; persistent state was not changed.");
    return;
  }
  const running = await docker(["container", "inspect", state.postgresContainer, "--format", "{{.State.Running}}"]);
  if (running === "true") await docker(["stop", "--time", "15", state.postgresContainer], process.env, 30_000);
  console.log("Local PostgreSQL stopped; its volume and generated state were retained.");
}

async function printCredentials(): Promise<void> {
  const state = await readState();
  if (!state) throw new Error("Run npm run local:up before requesting synthetic credentials.");
  await assertSuccessfulSeed(state);
  const accounts = localSyntheticAccounts(state);
  console.log([
    "Synthetic local accounts",
    `Student: ${accounts.student.email}`,
    `School staff: ${accounts.school.email}`,
    `CUAC Ops: ${accounts.ops.email}`,
    `CUAC Admin reviewer: ${accounts.admin.email}`,
    `Shared local-only password: ${state.studentPassword}`,
  ].join("\n"));
}

let stage = "arguments";
try {
  const command = parseLocalDevelopmentCommand(process.argv.slice(2));
  if (command === "status") {
    stage = "status";
    await runtimeStatus();
  } else if (command === "credentials") {
    stage = "credentials";
    await printCredentials();
  } else if (command === "stop") {
    stage = "stop";
    await stopDatabase();
  } else {
    stage = "provision";
    let state = await provision();
    if (command === "up") {
      console.log(`Local backend foundation is ready. Start the API with npm run dev:local.`);
    } else {
      stage = "application";
      state = await ensureApplicationPort(state);
      const current = await readApplicationHealth(`http://127.0.0.1:${state.applicationPort}/api/v1/health`);
      if (isHealthyLocalApplicationStatus(current)) {
        console.log(`CUAC local API is already healthy at http://127.0.0.1:${state.applicationPort}`);
        process.exitCode = 0;
      } else {
        await removeStaleVinextLock();
        process.exitCode = await startDevelopmentServer(state);
      }
    }
  }
} catch (error) {
  const reason = error instanceof Error ? error.message : "Unknown local runtime error.";
  console.error(`CUAC local development failed during ${stage}: ${reason} No remote database was selected and no persistent data was deleted.`);
  process.exitCode = 1;
}

export {};
