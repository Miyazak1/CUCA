import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, join, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import test from "node:test";
import pg from "pg";
import { runPostgresMigrationPlan } from "../../../src/server/db/migration-runtime.ts";
import { readPublicSchemaCatalog } from "./pg-schema-catalog.mjs";

const owner = process.env.CUAC_PG_LINUX_OWNER, network = process.env.CUAC_PG_LINUX_NETWORK;
const image = process.env.CUAC_PG_LINUX_IMAGE, digest = process.env.CUAC_PG_RELEASE_SHA256;
assert.match(owner ?? "", /^[a-f0-9]{24}$/);
assert.equal(network, `cuac-linux-${owner}`);
assert.match(image ?? "", /^sha256:[a-f0-9]{64}$/);
assert.match(digest ?? "", /^[a-f0-9]{64}$/);
const target = new URL(process.env.CUAC_PG_REHEARSAL_URL);
assert.equal(target.hostname, "127.0.0.1");
assert.equal(target.username, "cuac_rehearsal");
assert.equal(target.pathname, `/cuac_rehearsal_${owner}`);
const release = await realpath(process.env.CUAC_PG_RELEASE_PATH);
const plan = JSON.parse(await readFile(join(release, "migration-plan.json"), "utf8"));
const manifest = JSON.parse(await readFile(join(release, "release-manifest.json"), "utf8"));
const endpoint = process.platform === "win32" ? "npipe:////./pipe/dockerDesktopLinuxEngine" : "unix:///var/run/docker.sock";
const baseEnv = { NODE_ENV: "test", PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, ProgramFiles: process.env.ProgramFiles };
const rawDocker = (args, env = baseEnv) => promisify(execFile)("docker", ["--host", endpoint, ...args], { env, windowsHide: true, timeout: 30_000, maxBuffer: 1024 * 1024 });
const docker = async (args, env) => (await rawDocker(args, env)).stdout.trim();
const admin = new pg.Pool({ connectionString: target.href, max: 4, connectionTimeoutMillis: 5000, statement_timeout: 10_000 });

async function eventually(check) {
  const until = performance.now() + 8000;
  while (performance.now() < until) { if (await check()) return; await delay(50); }
  assert.fail("Linux migration did not reach the required database state within 8 seconds.");
}

async function job({ databaseUrl, mode = "--apply", expectedDigest = digest, networkMode = network, imageId = image, probe } = {}) {
  const id = await docker(["create", "--pull=never", "--platform=linux/amd64", "--init", "--user=1000:1000", "--read-only",
    "--cap-drop=ALL", "--security-opt=no-new-privileges:true", "--pids-limit=64", "--memory=256m", "--cpus=1", "--restart=no",
    "--network", networkMode, "--label", `cuac.rehearsal=${owner}`,
    "--env", "CUAC_MIGRATION_TARGET_ENV=development", ...(databaseUrl ? ["--env", "DATABASE_URL"] : []),
    ...(probe ? ["--entrypoint=/usr/local/bin/node"] : []), imageId,
    ...(probe ? ["--input-type=module", "-e", probe] : [mode, `--manifest-sha256=${expectedDigest}`])], { ...baseEnv, ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}) });
  assert.match(id, /^[a-f0-9]{64}$/);
  return {
    id,
    start: () => docker(["start", id]),
    async inspect() { return JSON.parse(await docker(["inspect", id]))[0]; },
    async wait() {
      const code = Number(await docker(["wait", id]));
      const { stdout, stderr } = await rawDocker(["logs", id]);
      return { code, stdout, stderr };
    },
    stop: () => docker(["stop", "--time=3", id]),
    async remove() {
      assert.equal(await docker(["inspect", "--format", '{{index .Config.Labels "cuac.rehearsal"}}', id]), owner);
      await docker(["rm", "--force", id]);
    },
  };
}

async function runJob(options) {
  const instance = await job(options);
  try { await instance.start(); return await instance.wait(); }
  finally { await instance.remove(); }
}

async function withDatabase(work) {
  const suffix = randomBytes(12).toString("hex"), name = `cuac_linux_${suffix}`, role = `cuac_migrate_${suffix}`;
  const password = randomBytes(32).toString("hex");
  let pool, roleOid, databaseOid, created = false;
  await admin.query(`create role "${role}" login password '${password}' nosuperuser nocreatedb nocreaterole noreplication nobypassrls`);
  try {
    roleOid = (await admin.query("select oid from pg_roles where rolname = $1", [role])).rows[0].oid;
    await admin.query(`create database "${name}"`); created = true;
    databaseOid = (await admin.query("select oid from pg_database where datname = $1", [name])).rows[0].oid;
    await admin.query(`revoke connect, temporary on database "${name}" from public`);
    await admin.query(`grant connect, create on database "${name}" to "${role}"`);
    const adminUrl = new URL(target); adminUrl.pathname = `/${name}`;
    pool = new pg.Pool({ connectionString: adminUrl.href, max: 3, connectionTimeoutMillis: 5000, statement_timeout: 10_000 });
    await pool.query(`grant usage, create on schema public to "${role}"`);
    const hostUrl = new URL(adminUrl); hostUrl.username = role; hostUrl.password = password;
    const internalUrl = new URL(hostUrl); internalUrl.hostname = "database"; internalUrl.port = "5432";
    const grants = (await admin.query("select rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls from pg_roles where rolname = $1", [role])).rows[0];
    assert.ok(Object.values(grants).every(value => value === false));
    await work({ pool, databaseUrl: internalUrl.href, hostUrl: hostUrl.href, role });
  } finally {
    if (pool) await pool.end();
    if (created) {
      assert.equal((await admin.query("select oid from pg_database where datname = $1", [name])).rows[0]?.oid, databaseOid);
      await admin.query(`drop database "${name}"`);
    }
    assert.equal((await admin.query("select oid from pg_roles where rolname = $1", [role])).rows[0]?.oid, roleOid);
    await admin.query(`drop role "${role}"`);
  }
}

test("Linux migration runtime and isolated release rehearsal", { timeout: 120_000 }, async t => {
  t.after(() => admin.end());
  assert.equal((await admin.query("select current_database() as name")).rows[0].name, target.pathname.slice(1));
  const [networkState] = JSON.parse(await docker(["network", "inspect", network]));
  assert.equal(networkState.Internal, true);
  assert.equal(networkState.Labels["cuac.rehearsal"], owner);
  assert.equal(networkState.EnableIPv6, false);
  assert.equal(networkState.Options["com.docker.network.bridge.gateway_mode_ipv4"], "isolated");
  const [databaseState] = JSON.parse(await docker(["inspect", `cuac-pg-rehearsal-${owner}`]));
  assert.equal(databaseState.Config.Labels["cuac.rehearsal"], owner);
  assert.deepEqual(Object.keys(databaseState.NetworkSettings.Networks).sort(), [network, `${network}-control`].sort());
  assert.deepEqual(databaseState.NetworkSettings.Ports["5432/tcp"], [{ HostIp: "127.0.0.1", HostPort: target.port }]);
  const [controlState] = JSON.parse(await docker(["network", "inspect", `${network}-control`]));
  assert.equal(controlState.Labels["cuac.rehearsal"], owner);
  assert.equal(controlState.Options["com.docker.network.bridge.enable_ip_masquerade"], "false");
  assert.deepEqual(Object.keys(controlState.Containers), [databaseState.Id]);
  const [imageState] = JSON.parse(await docker(["image", "inspect", image]));
  assert.equal(imageState.Config.Labels["cuac.release.manifest"], digest);
  t.diagnostic(`Linux image ${image}; release ${digest}`);

  await t.test("Linux process has no root privileges, write access, Docker socket or default egress route", async () => {
    const instance = await job({ probe: String.raw`import fs from 'node:fs';
      const failures = {};
      for (const path of ['/etc/cuac-write-probe', '/opt/cuac-release/run.mjs', '/opt/cuac-launcher/launch.mjs']) {
        try { fs.appendFileSync(path, 'must-not-write'); failures[path] = 'writable'; } catch (error) { failures[path] = error.code; }
      }
      const status = fs.readFileSync('/proc/self/status','utf8');
      console.log(JSON.stringify({uid:process.getuid(),version:process.version,platform:process.platform,arch:process.arch,failures,
        socket:fs.existsSync('/var/run/docker.sock'), capabilities:status.match(/^CapEff:\s*(.+)$/m)[1],
        noNewPrivileges:status.match(/^NoNewPrivs:\s*(.+)$/m)[1],
        defaultRoute:fs.readFileSync('/proc/net/route','utf8').trim().split('\n').slice(1).some(row=>row.trim().split(/\s+/)[1]==='00000000')}));` });
    try {
      const state = await instance.inspect();
      assert.equal(state.HostConfig.ReadonlyRootfs, true);
      assert.equal(state.HostConfig.Privileged, false);
      assert.deepEqual(state.HostConfig.CapDrop, ["ALL"]);
      assert.ok(state.HostConfig.SecurityOpt.some(value => value.startsWith("no-new-privileges")));
      assert.equal(state.HostConfig.PidsLimit, 64);
      assert.equal(state.HostConfig.Memory, 256 * 1024 * 1024);
      assert.equal(state.HostConfig.NanoCpus, 1_000_000_000);
      assert.deepEqual(state.Mounts, []);
      assert.deepEqual(Object.keys(state.NetworkSettings.Networks), [network]);
      await instance.start();
      const result = await instance.wait();
      assert.equal(result.code, 0, result.stdout + result.stderr);
      const runtime = JSON.parse(result.stdout);
      assert.equal(runtime.uid, 1000);
      assert.equal(runtime.version, manifest.nodeVersion);
      assert.equal(runtime.platform, "linux"); assert.equal(runtime.arch, "x64");
      assert.ok(Object.values(runtime.failures).every(code => ["EACCES", "EROFS"].includes(code)));
      assert.match(runtime.capabilities, /^0+$/); assert.equal(runtime.noNewPrivileges, "1");
      assert.equal(runtime.socket, false); assert.equal(runtime.defaultRoute, false);
    } finally { await instance.remove(); }
  });

  await t.test("trusted launcher verifies the unchanged Windows-built package without any network", async () => {
    const result = await runJob({ mode: "--verify-only", networkMode: "none" });
    assert.equal(result.code, 0, result.stdout + result.stderr);
    assert.equal(JSON.parse(result.stdout).manifestSha256, digest);
  });

  await t.test("Linux release applies and replays under a non-superuser migration principal", () => withDatabase(async ({ pool, databaseUrl, role }) => {
    const first = await runJob({ databaseUrl });
    assert.equal(first.code, 0, first.stdout + first.stderr);
    assert.equal(JSON.parse(first.stdout).appliedNow, plan.length);
    assert.equal(Object.keys((await readPublicSchemaCatalog(pool)).tables).length, manifest.tables);
    const owners = (await pool.query("select distinct tableowner from pg_tables where schemaname in ('public', 'drizzle')")).rows;
    assert.deepEqual(owners, [{ tableowner: role }]);
    await pool.query("insert into users (email, email_normalized) values ('linux@example.invalid', 'linux@example.invalid')");
    const users = (await pool.query("select * from users")).rows;
    const ledger = (await pool.query("select * from drizzle.__drizzle_migrations order by id")).rows;
    const replay = await runJob({ databaseUrl });
    assert.equal(replay.code, 0, replay.stdout + replay.stderr);
    assert.equal(JSON.parse(replay.stdout).appliedNow, 0);
    assert.deepEqual((await pool.query("select * from users")).rows, users);
    assert.deepEqual((await pool.query("select * from drizzle.__drizzle_migrations order by id")).rows, ledger);
  }));

  await t.test("stopping a waiting Linux job leaves no partial upgrade and an explicit retry succeeds", () => withDatabase(async ({ pool, databaseUrl, hostUrl, role }) => {
    const appliedPrefix = 19;
    assert.ok(plan.length >= 21);
    await runPostgresMigrationPlan({ databaseUrl: hostUrl, migrationsFolder: release, targetEnvironment: "development", productionMigrationAllowed: false, runbookAcknowledged: false }, plan.slice(0, appliedPrefix));
    const before = await readPublicSchemaCatalog(pool);
    const blocker = await pool.connect();
    const instance = await job({ databaseUrl });
    try {
      await blocker.query("begin");
      // The notice DDL has run in the same transaction before the target migration reaches this lock.
      await blocker.query("lock table application_choices in access exclusive mode");
      await instance.start();
      await eventually(async () => (await pool.query(`select 1 from pg_stat_activity where datname = current_database() and usename = $1
        and application_name = 'cuac:migration' and wait_event_type = 'Lock' and query ilike '%LOCK TABLE "application_choices"%'`, [role])).rowCount === 1);
      await instance.stop();
      const stopped = await instance.wait();
      assert.equal(stopped.code, 143);
      assert.equal((await instance.inspect()).State.OOMKilled, false);
      await blocker.query("rollback");
      await eventually(async () => (await pool.query("select 1 from pg_stat_activity where datname = current_database() and usename = $1", [role])).rowCount === 0);
      assert.equal((await pool.query("select count(*)::int as count from drizzle.__drizzle_migrations")).rows[0].count, appliedPrefix);
      assert.deepEqual(await readPublicSchemaCatalog(pool), before);
      const retry = await runJob({ databaseUrl });
      assert.equal(retry.code, 0, retry.stdout + retry.stderr);
      assert.equal(JSON.parse(retry.stdout).appliedNow, plan.length - appliedPrefix);
    } finally { await blocker.query("rollback"); blocker.release(); await instance.remove(); }
  }));

  await t.test("wrong expected digest and database failures produce no secret-bearing logs", async () => {
    const wrong = await runJob({ expectedDigest: "0".repeat(64), networkMode: "none" });
    assert.notEqual(wrong.code, 0);
    const failed = await runJob({ databaseUrl: "postgresql://synthetic:PRIVATE_LINUX_PASSWORD@127.0.0.1:1/private_database", networkMode: "none" });
    assert.notEqual(failed.code, 0);
    assert.doesNotMatch(failed.stdout + failed.stderr, /PRIVATE_LINUX_PASSWORD|private_database|postgresql:\/\//);
  });

  await t.test("trusted image verifier rejects a replaced package bootstrap before it can execute", async () => {
    const parent = await realpath(join(release, "../../..", ".tmp"));
    await mkdir(parent, { recursive: true });
    const temp = await mkdtemp(join(parent, "linux-tamper-"));
    const owned = async () => { const path = await realpath(temp); assert.equal(dirname(path), parent); assert.ok(path.startsWith(parent + sep + "linux-tamper-")); };
    const baseTag = `localhost/cuac-migration-rehearsal:${owner}`;
    let changedImage, tagged = false;
    try {
      await owned();
      // Dockerfile FROM treats a raw image ID as a registry name; use a verified, owned local tag.
      await docker(["image", "tag", image, baseTag]); tagged = true;
      assert.equal(await docker(["image", "inspect", "--format", "{{.Id}}", baseTag]), image);
      const context = join(temp, "context"), dockerConfig = join(temp, "docker-config");
      await mkdir(context); await mkdir(dockerConfig);
      await writeFile(join(dockerConfig, "config.json"), "{}\n", { flag: "wx" });
      await writeFile(join(context, "bootstrap.mjs"), "console.log('PRIVATE_BOOTSTRAP_EXECUTED'); process.exit(0);\n", { flag: "wx" });
      await writeFile(join(context, "Dockerfile"), `FROM ${baseTag}\nCOPY --chown=0:0 --chmod=0555 bootstrap.mjs /opt/cuac-release/run.mjs\n`, { flag: "wx" });
      const idFile = join(temp, "image-id");
      await docker(["build", "--pull=false", "--network=none", "--label", `cuac.rehearsal=${owner}`, "--iidfile", idFile, context],
        { ...baseEnv, DOCKER_BUILDKIT: "1", DOCKER_CONFIG: dockerConfig });
      changedImage = (await readFile(idFile, "utf8")).trim();
      const result = await runJob({ imageId: changedImage, mode: "--verify-only", networkMode: "none" });
      assert.notEqual(result.code, 0);
      assert.doesNotMatch(result.stdout + result.stderr, /PRIVATE_BOOTSTRAP_EXECUTED/);
    } finally {
      if (changedImage) {
        assert.equal(await docker(["image", "inspect", "--format", '{{index .Config.Labels "cuac.rehearsal"}}', changedImage]), owner);
        await docker(["image", "rm", changedImage]);
      }
      if (tagged) {
        assert.equal(await docker(["image", "inspect", "--format", "{{.Id}}", baseTag]), image);
        await docker(["image", "rm", baseTag]);
      }
      await owned(); await rm(temp, { recursive: true });
    }
  });
});
