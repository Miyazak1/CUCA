import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const privateDatabaseUrl = "postgres://cuac:PRIVATE_STARTUP_SECRET@pgm-example.rds.aliyuncs.com:5432/cuac";
const excludedEnvironment = new Set([
  "DATABASE_URL",
  "DEPLOY_ENV",
  "NODE_OPTIONS",
  "NODE_PATH",
  "NODE_TLS_REJECT_UNAUTHORIZED",
  "PGSSLMODE",
  "POSTGRES_URL",
]);

function entrypointEnvironment(overrides = {}) {
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    !key.startsWith("CUAC_") && !excludedEnvironment.has(key)));
  return { ...inherited, ...overrides };
}

function runEntrypoint(path, args, env) {
  return spawnSync(process.execPath, [path, ...args], {
    cwd: root,
    encoding: "utf8",
    env: entrypointEnvironment(env),
    timeout: 10_000,
    windowsHide: true,
  });
}

function assertClosedFailure(result, expectedMessage) {
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, expectedMessage);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /application\.started|PRIVATE_STARTUP_SECRET|pgm-example/);
}

test("managed entrypoint refuses an unreviewed production process", () => {
  const result = runEntrypoint("scripts/start-app.ts", [], {
    CUAC_ENV: "production",
    DATABASE_URL: privateDatabaseUrl,
    PORT: "65534",
  });
  assertClosedFailure(result, /Managed application startup failed/);
});

test("staging candidate entrypoint refuses unsafe authority before server startup", () => {
  const result = runEntrypoint("scripts/start-staging-candidate.ts", [], {
    CUAC_ENV: "staging",
    CUAC_REQUIRE_PRODUCTION_READY: "true",
    DATABASE_URL: privateDatabaseUrl,
    PGSSLMODE: "verify-full",
    CUAC_AGENT_ENABLED: "true",
    CUAC_AGENT_DIRECT_DB_ACCESS: "false",
    CUAC_RELEASE_COMMIT_SHA: "1a".repeat(20),
    CUAC_RELEASE_IMAGE_DIGEST: `sha256:${"2b".repeat(32)}`,
    CUAC_MIGRATION_MANIFEST_SHA256: "3c".repeat(32),
    PORT: "65534",
  });
  assertClosedFailure(result, /Staging candidate startup failed/);
});

test("reviewed entrypoint requires exactly one protected evidence manifest", () => {
  const result = runEntrypoint("scripts/start-reviewed-release.ts", [], {
    CUAC_ENV: "production",
    DATABASE_URL: privateDatabaseUrl,
    PORT: "65534",
  });
  assertClosedFailure(result, /Reviewed application startup failed/);
});
