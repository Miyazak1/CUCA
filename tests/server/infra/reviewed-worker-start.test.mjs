import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { authorizeWorkerStartup } from "../../../scripts/lib/worker-startup.ts";

const root = new URL("../../../", import.meta.url);
const staging = {
  CUAC_ENV: "staging",
  CUAC_REQUIRE_PRODUCTION_READY: "true",
  DATABASE_URL: "postgres://cuac:PRIVATE_SECRET@pgm-example.rds.aliyuncs.com:5432/cuac",
  PGSSLMODE: "verify-full",
  CUAC_AGENT_ENABLED: "false",
  CUAC_AGENT_DIRECT_DB_ACCESS: "false",
  CUAC_RELEASE_COMMIT_SHA: "1a".repeat(20),
  CUAC_RELEASE_IMAGE_DIGEST: `sha256:${"2b".repeat(32)}`,
  CUAC_MIGRATION_MANIFEST_SHA256: "3c".repeat(32),
};

test("worker startup separates development staging evidence and reviewed production", async () => {
  assert.deepEqual(await authorizeWorkerStartup([], { CUAC_ENV: "development" }), { mode: "development" });
  assert.deepEqual(await authorizeWorkerStartup([], staging), { mode: "staging_candidate" });

  let loaded;
  const production = { ...staging, CUAC_ENV: "production" };
  const accepted = async (path, env) => {
    loaded = { path, env };
    return { readyForHumanReview: true };
  };
  assert.deepEqual(await authorizeWorkerStartup(["protected.json"], production, accepted), { mode: "reviewed" });
  assert.equal(loaded.path, "protected.json");
  assert.equal(loaded.env.CUAC_ENV, "production");

  await assert.rejects(authorizeWorkerStartup([], production, accepted), /requires one protected/);
  await assert.rejects(authorizeWorkerStartup(["protected.json"], production,
    async () => ({ readyForHumanReview: false })), /has blockers/);
  await assert.rejects(authorizeWorkerStartup([], {}), /explicit development, staging, or production/);
  await assert.rejects(authorizeWorkerStartup(["unexpected"], staging), /does not accept a completed manifest/);
});

test("every external-effect worker authorizes release state before loading providers or PostgreSQL", async () => {
  const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  const entries = [
    ["auth-email", "scripts/start-auth-email-worker.ts"],
    ["notification", "scripts/start-notification-worker.ts"],
    ["student-file", "scripts/start-student-file-worker.ts"],
    ["official-submission", "scripts/start-official-submission-worker.ts"],
    ["payment-reconciliation", "scripts/start-payment-reconciliation-worker.ts"],
  ];
  for (const [name, path] of entries) {
    const source = await readFile(new URL(path, root), "utf8");
    const authorization = source.indexOf("await authorizeWorkerStartup(process.argv.slice(2))");
    const database = source.indexOf('await import("../src/server/db/postgres-client.ts")');
    assert.ok(authorization >= 0 && database > authorization, `${name} worker must authorize before PostgreSQL`);
    assert.equal(packageJson.scripts[`start:${name}-worker`], `node ${path}`);
  }
});
