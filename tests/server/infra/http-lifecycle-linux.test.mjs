import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, join, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const project = await realpath(fileURLToPath(new URL("../../../", import.meta.url)));
const config = JSON.parse(await readFile(join(project, "config/migration-runtime.linux.json"), "utf8"));
assert.equal(config.platform, "linux/amd64");
assert.match(config.nodeImage, /^node@sha256:[a-f0-9]{64}$/);
const endpoint = process.platform === "win32" ? "npipe:////./pipe/dockerDesktopLinuxEngine" : "unix:///var/run/docker.sock";
const docker = async args => (await promisify(execFile)("docker", ["--host", endpoint, ...args], {
  windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024,
  env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP },
})).stdout.trim();

test("Linux OS signals enforce the actual HTTP process lifecycle", { timeout: 45000 }, async t => {
  const [base] = JSON.parse(await docker(["image", "inspect", config.nodeImage]));
  assert.equal(base.Os, "linux"); assert.equal(base.Architecture, "amd64");
  assert.ok(base.RepoDigests.includes(config.nodeImage));
  const parent = join(project, ".tmp"); await mkdir(parent, { recursive: true });
  assert.equal(await realpath(parent), parent);
  const temp = await mkdtemp(join(parent, "linux-http-")), owner = randomBytes(12).toString("hex");
  const owned = async () => { const path = await realpath(temp); assert.equal(dirname(path), parent); assert.ok(path.startsWith(parent + sep + "linux-http-")); };
  const files = ["src/server/shared/application-lifecycle.ts", "src/server/infra/http-lifecycle.ts", "tests/server/infra/http-lifecycle-process.mjs"];
  try {
    await owned();
    for (const file of files) { await mkdir(dirname(join(temp, file)), { recursive: true }); await copyFile(join(project, file), join(temp, file)); }
    await writeFile(join(temp, "package.json"), '{"type":"module"}\n', { flag: "wx" });
    assert.equal(temp.includes(","), false);
    for (const mode of ["drain", "deadline"]) await t.test(`real SIGTERM ${mode} with a non-root, offline Linux process`, async () => {
      let id;
      try {
        id = await docker(["create", "--pull=never", "--platform=linux/amd64", "--init", "--user=1000:1000", "--read-only", "--network=none",
          "--cap-drop=ALL", "--security-opt=no-new-privileges:true", "--pids-limit=64", "--memory=128m", "--cpus=1",
          "--label", `cuac.http.lifecycle=${owner}`, "--mount", `type=bind,source=${temp},target=/work,readonly`,
          "--env", `CUAC_LIFECYCLE_NODE=${config.nodeVersion}`, "--entrypoint=/usr/local/bin/node", config.nodeImage,
          "/work/tests/server/infra/http-lifecycle-process.mjs", mode]);
        assert.match(id, /^[a-f0-9]{64}$/); await docker(["start", id]);
        let ready = false;
        for (let attempt = 0; attempt < 80; attempt++) {
          const output = await docker(["logs", id]);
          if (output.includes('"event":"fixture.ready"')) { ready = true; break; }
          await delay(50);
        }
        assert.equal(ready, true, "HTTP work must be admitted before sending the OS signal.");
        await docker(["kill", "--signal=SIGTERM", id]);
        const code = Number(await docker(["wait", id]));
        const events = (await docker(["logs", id])).split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
        const draining = events.filter(event => event.event === "application.draining"), stopped = events.filter(event => event.event === "application.stopped");
        assert.equal(draining.length, 1); assert.equal(draining[0].reason, "SIGTERM"); assert.equal(draining[0].activeRequests, 1);
        assert.equal(stopped.length, 1);
        assert.equal(stopped[0].outcome, mode === "drain" ? "drained" : "deadline");
        assert.equal(code, mode === "drain" ? 0 : 1);
        assert.deepEqual(stopped[0].closedResources, mode === "drain" ? ["synthetic-resource"] : []);
        assert.equal(JSON.parse(await docker(["inspect", id]))[0].State.OOMKilled, false);
      } finally {
        if (id) {
          assert.equal(await docker(["inspect", "--format", '{{index .Config.Labels "cuac.http.lifecycle"}}', id]), owner);
          await docker(["rm", "--force", id]);
        }
      }
    });
  } finally { await owned(); await rm(temp, { recursive: true }); }
});
