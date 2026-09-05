import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertSafeApplicationProcessEnvironment,
  assertUnreviewedApplicationStartAllowed,
  authorizeStagingCandidateStart,
} from "../../../src/server/infra/startup-policy.ts";

const root = new URL("../../../", import.meta.url);

test("reviewed startup verifies the bound release before loading the managed server", async () => {
  const [source, managedSource, candidateSource, packageJson] = await Promise.all([
    readFile(new URL("scripts/start-reviewed-release.ts", root), "utf8"),
    readFile(new URL("scripts/start-app.ts", root), "utf8"),
    readFile(new URL("scripts/start-staging-candidate.ts", root), "utf8"),
    readFile(new URL("package.json", root), "utf8").then(JSON.parse),
  ]);

  const runtimeDecision = source.indexOf("assertSafeApplicationProcessEnvironment(process.env)");
  const gateLoad = source.indexOf("await loadReleaseGateReport");
  const gateDecision = source.indexOf("if (!report.readyForHumanReview)");
  const serverLoad = source.indexOf('await import("./lib/app-server.ts")');
  const managedPolicy = managedSource.indexOf("assertUnreviewedApplicationStartAllowed(process.env)");
  const managedServerLoad = managedSource.indexOf('await import("./lib/app-server.ts")');
  const candidatePolicy = candidateSource.indexOf("authorizeStagingCandidateStart(process.env)");
  const candidateServerLoad = candidateSource.indexOf('await import("./lib/app-server.ts")');
  assert.ok(runtimeDecision >= 0 && gateLoad > runtimeDecision && gateDecision > gateLoad && serverLoad > gateDecision);
  assert.ok(managedPolicy >= 0 && managedServerLoad > managedPolicy);
  assert.ok(candidatePolicy >= 0 && candidateServerLoad > candidatePolicy);
  assert.match(source, /process\.argv\.length !== 3/);
  assert.doesNotMatch(source, /startProdServer|vinext\/dist/);
  assert.equal(packageJson.scripts.start, "node scripts/start-app.ts");
  assert.equal(packageJson.scripts["start:managed"], "node scripts/start-app.ts");
  assert.equal(packageJson.scripts["start:staging-candidate"], "node scripts/start-staging-candidate.ts");
  assert.equal(packageJson.scripts["start:reviewed"], "node scripts/start-reviewed-release.ts");
});

test("staging candidate startup binds exact release identity before evidence collection", () => {
  const valid = {
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
  assert.deepEqual(authorizeStagingCandidateStart(valid), {
    commitSha: valid.CUAC_RELEASE_COMMIT_SHA,
    imageDigest: valid.CUAC_RELEASE_IMAGE_DIGEST,
    migrationManifestSha256: valid.CUAC_MIGRATION_MANIFEST_SHA256,
  });

  for (const override of [
    { CUAC_ENV: "production" },
    { CUAC_REQUIRE_PRODUCTION_READY: "false" },
    { DATABASE_URL: "postgres://cuac:PRIVATE_SECRET@127.0.0.1:5432/cuac" },
    { DATABASE_URL: `${valid.DATABASE_URL}?sslmode=disable` },
    { PGSSLMODE: "require" },
    { CUAC_AGENT_ENABLED: "true" },
    { CUAC_AGENT_DIRECT_DB_ACCESS: "true" },
    { CUAC_RELEASE_COMMIT_SHA: "0".repeat(40) },
    { CUAC_RELEASE_IMAGE_DIGEST: `sha256:${"f".repeat(64)}` },
    { CUAC_MIGRATION_MANIFEST_SHA256: "bad" },
  ]) {
    assert.throws(() => authorizeStagingCandidateStart({ ...valid, ...override }), error =>
      !error.message.includes("PRIVATE_SECRET") && !error.message.includes("pgm-example"));
  }
});

test("unreviewed startup is development-only and runtime overrides fail closed", () => {
  for (const environment of ["development", "dev", "test", " Development "]) {
    assert.doesNotThrow(() => assertUnreviewedApplicationStartAllowed({ CUAC_ENV: environment }));
  }
  for (const env of [{}, { NODE_ENV: "development" }, { CUAC_ENV: "staging" }, { CUAC_ENV: "production" },
    { CUAC_ENV: "" }, { CUAC_ENV: "prodution" }]) {
    assert.throws(() => assertUnreviewedApplicationStartAllowed(env), /limited to an explicit development/);
  }
  for (const [key, value] of [["NODE_OPTIONS", "--import=PRIVATE_MODULE"], ["NODE_PATH", "PRIVATE_PATH"],
    ["NODE_TLS_REJECT_UNAUTHORIZED", "0"]]) {
    const env = { CUAC_ENV: "development", [key]: value };
    assert.throws(() => assertSafeApplicationProcessEnvironment(env), error =>
      !error.message.includes(value) && !error.message.includes("PRIVATE"));
    assert.throws(() => assertUnreviewedApplicationStartAllowed(env), /runtime override/);
  }
});
