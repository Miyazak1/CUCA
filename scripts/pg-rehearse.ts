import { execFile, spawn } from "node:child_process";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { buildMigrationRelease } from "./lib/pg-release.ts";
import { buildLinuxMigrationImage } from "./lib/pg-linux-rehearsal.ts";

const execFileAsync = promisify(execFile);
const projectDir = fileURLToPath(new URL("../", import.meta.url));
const suffix = randomBytes(12).toString("hex");
const containerName = `cuac-pg-rehearsal-${suffix}`;
const databaseName = `cuac_rehearsal_${suffix}`;
const password = randomBytes(32).toString("hex");
const dockerEndpoint = process.platform === "win32"
  ? "npipe:////./pipe/dockerDesktopLinuxEngine"
  : "unix:///var/run/docker.sock";
let containerCreated = false;
const withHttp = process.argv.includes("--http");
const baselineOption = process.argv.slice(2).find(arg => arg === "--write-schema-baseline" || arg.startsWith("--write-schema-baseline="));
const writeSchemaBaseline = baselineOption !== undefined;
const baselinePendingCount = baselineOption?.includes("=") ? baselineOption.slice(baselineOption.indexOf("=") + 1) : "1";
const withLinux = process.argv.includes("--linux");
const routingReviewOnly = process.argv.includes("--routing-review");
const dataQualityOnly = process.argv.includes("--data-quality");
const linuxNetwork = `cuac-linux-${suffix}`;
const linuxControlNetwork = `${linuxNetwork}-control`;
let linuxNetworkCreated = false;
let linuxControlNetworkCreated = false;
let stage = "arguments";

async function docker(args: string[], env = process.env): Promise<string> {
  const result = await execFileAsync("docker", ["--host", dockerEndpoint, ...args], {
    cwd: projectDir,
    env,
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  });
  return result.stdout.trim();
}

try {
  if (process.argv.slice(2).some(arg => !["--http", "--linux", "--routing-review", "--data-quality"].includes(arg)
      && !/^--write-schema-baseline(?:=[1-9]\d*)?$/.test(arg))
    || withLinux && (withHttp || writeSchemaBaseline || routingReviewOnly || dataQualityOnly)
    || routingReviewOnly && (withHttp || writeSchemaBaseline || dataQualityOnly)
    || dataQualityOnly && (withHttp || writeSchemaBaseline)) throw new Error("Unknown or incompatible rehearsal options.");
  stage = "release-build";
  const release = await buildMigrationRelease(projectDir);
  console.log(`Prepared migration release: ${release.manifestSha256}`);
  stage = "linux-image-build";
  const linuxImage = withLinux ? await buildLinuxMigrationImage(projectDir, release, suffix, docker) : undefined;
  if (linuxImage) {
    console.log(`Prepared Linux runtime: ${JSON.stringify(linuxImage)}`);
    stage = "linux-network-create";
    await docker(["network", "create", "--internal", "--label", `cuac.rehearsal=${suffix}`,
      "--opt", "com.docker.network.bridge.gateway_mode_ipv4=isolated", linuxNetwork]);
    linuxNetworkCreated = true;
    // Internal networks do not publish ports. Only the database joins this host-test control network.
    await docker(["network", "create", "--label", `cuac.rehearsal=${suffix}`,
      "--opt", "com.docker.network.bridge.enable_ip_masquerade=false", linuxControlNetwork]);
    linuxControlNetworkCreated = true;
  }
  if (withHttp) {
    stage = "http-build";
    console.log("Building the current API adapters for local HTTP rehearsal.");
    await execFileAsync(process.execPath, [fileURLToPath(new URL("../node_modules/vinext/dist/cli.js", import.meta.url)), "build"], {
      cwd: projectDir, windowsHide: true, timeout: 120_000, maxBuffer: 2 * 1024 * 1024,
      env: { NODE_ENV: "production", PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP },
    });
  }
  // Pin this run to the cached image ID; never pull or use a remote Docker context.
  stage = "database-create";
  const imageId = await docker(["image", "inspect", "postgres:16-alpine", "--format", "{{.Id}}"]);
  if (!/^sha256:[a-f0-9]{64}$/.test(imageId)) throw new Error("Invalid local PostgreSQL image ID.");
  await docker([
    "run", "--detach", "--rm", "--pull", "never", "--name", containerName,
    "--label", `cuac.rehearsal=${suffix}`,
    ...(withLinux ? ["--network", `name=${linuxNetwork},alias=database`, "--network", linuxControlNetwork] : []),
    "--tmpfs", "/var/lib/postgresql/data:rw",
    "--publish", "127.0.0.1::5432",
    "--env", "POSTGRES_PASSWORD", "--env", "POSTGRES_USER=cuac_rehearsal",
    "--env", `POSTGRES_DB=${databaseName}`, imageId,
  ], { ...process.env, POSTGRES_PASSWORD: password });
  containerCreated = true;
  console.log(`Disposable local PostgreSQL: ${containerName} (${imageId})`);

  stage = "database-ready";
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      await docker(["exec", containerName, "pg_isready", "-U", "cuac_rehearsal", "-d", databaseName]);
      ready = true;
      break;
    } catch {
      await delay(200);
    }
  }
  if (!ready) throw new Error("Local PostgreSQL did not become ready.");
  stage = "database-loopback-binding";
  const binding = await docker(["port", containerName, "5432/tcp"]);
  const match = /^127\.0\.0\.1:(\d+)$/.exec(binding);
  if (!match) throw new Error("Rehearsal database must bind only to IPv4 loopback.");

  stage = "test-worker";
  const exitCode = await new Promise<number>((resolve, reject) => {
    const testFile = withLinux ? "tests/server/db/linux-migration.test.mjs"
      : routingReviewOnly ? "tests/server/db/ops-routing-review-integration.test.mjs"
      : dataQualityOnly ? "tests/server/db/ops-data-quality-integration.test.mjs"
      : "tests/server/db/postgres-integration.test.mjs";
    const child = spawn(process.execPath, ["--test", testFile], {
      cwd: projectDir,
      windowsHide: true,
      stdio: "inherit",
      env: {
        NODE_ENV: "test",
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        TEMP: process.env.TEMP,
        CUAC_PG_REHEARSAL_URL: `postgresql://cuac_rehearsal:${password}@127.0.0.1:${match[1]}/${databaseName}`,
        CUAC_PG_HTTP_REHEARSAL: withHttp ? "1" : "0",
        CUAC_PG_WRITE_SCHEMA_BASELINE: writeSchemaBaseline ? "1" : "0",
        CUAC_PG_SCHEMA_BASELINE_PENDING_COUNT: baselinePendingCount,
        CUAC_PG_RELEASE_PATH: release.output,
        CUAC_PG_RELEASE_SHA256: release.manifestSha256,
        ...(linuxImage ? {
          CUAC_PG_LINUX_IMAGE: linuxImage.imageId,
          CUAC_PG_LINUX_NETWORK: linuxNetwork,
          CUAC_PG_LINUX_OWNER: suffix,
          ProgramFiles: process.env.ProgramFiles,
        } : {}),
      },
    });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  process.exitCode = exitCode;
} catch {
  console.error(`PostgreSQL/release rehearsal failed at ${stage}. Check the offline npm cache, pinned local images and Docker runtime; no external database was selected. Raw diagnostics are withheld because they may contain credentials.`);
  process.exitCode = 1;
} finally {
  if (withLinux) {
    try {
      const ids = (await docker(["ps", "-aq", "--filter", `label=cuac.rehearsal=${suffix}`])).split(/\s+/).filter(Boolean);
      for (const id of ids) {
        assert.equal(await docker(["inspect", "--format", '{{index .Config.Labels "cuac.rehearsal"}}', id]), suffix, "Linux container ownership changed.");
        await docker(["rm", "--force", id]);
      }
      containerCreated = false;
      if (linuxNetworkCreated) {
        assert.equal(await docker(["network", "inspect", "--format", '{{index .Labels "cuac.rehearsal"}}', linuxNetwork]), suffix, "Linux network ownership changed.");
        await docker(["network", "rm", linuxNetwork]);
      }
      if (linuxControlNetworkCreated) {
        assert.equal(await docker(["network", "inspect", "--format", '{{index .Labels "cuac.rehearsal"}}', linuxControlNetwork]), suffix, "Linux control network ownership changed.");
        await docker(["network", "rm", linuxControlNetwork]);
      }
      const images = new Set((await docker(["image", "ls", "-q", "--no-trunc", "--filter", `label=cuac.rehearsal=${suffix}`])).split(/\s+/).filter(Boolean));
      for (const id of images) {
        assert.equal(await docker(["image", "inspect", "--format", '{{index .Config.Labels "cuac.rehearsal"}}', id]), suffix, "Linux image ownership changed.");
        await docker(["image", "rm", id]);
      }
      console.log("Owned Linux containers, networks and runtime images removed.");
    } catch {
      console.error(`Linux cleanup failed for ownership token ${suffix}; inspect labeled resources before removal.`);
      process.exitCode = 1;
    }
  }
  if (containerCreated) {
    try {
      const label = await docker(["inspect", "--format", '{{index .Config.Labels "cuac.rehearsal"}}', containerName]);
      if (label !== suffix) {
        console.error(`Container ownership mismatch; ${containerName} was not removed.`);
        process.exitCode = 1;
      } else {
        await docker(["rm", "--force", containerName]);
        console.log("Disposable PostgreSQL container and memory-only data removed.");
      }
    } catch {
      console.error(`Cleanup failed for ${containerName}; inspect its cuac.rehearsal label before removing it.`);
      process.exitCode = 1;
    }
  }
}
