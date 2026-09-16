import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("application image is pinned, multi-stage, non-root, read-only compatible and health checked", async () => {
  const [dockerfile, runtime, packageJson, dockerignore] = await Promise.all([
    source("scripts/application/Dockerfile"),
    source("config/application-runtime.linux.json").then(JSON.parse),
    source("package.json").then(JSON.parse),
    source(".dockerignore"),
  ]);

  assert.match(runtime.nodeImage, /^node@sha256:[a-f0-9]{64}$/);
  assert.equal(runtime.nodeVersion, "v22.23.2");
  assert.match(dockerfile, new RegExp(`ARG CUAC_NODE_IMAGE=${runtime.nodeImage}`));
  assert.equal((dockerfile.match(/^FROM /gm) || []).length, 2);
  assert.match(dockerfile, /npm ci --ignore-scripts --no-audit --no-fund/);
  assert.match(dockerfile, /npm prune --omit=dev --ignore-scripts/);
  assert.match(dockerfile, /USER 1000:1000/);
  assert.match(dockerfile, /HEALTHCHECK[\s\S]*\/api\/v1\/health/);
  assert.match(dockerfile, /ENTRYPOINT \["node", "scripts\/application-container-entry\.ts"\]/);
  assert.equal(packageJson.dependencies.vinext, "1.0.0-beta.10");
  assert.equal(packageJson.devDependencies?.vinext, undefined);
  for (const excluded of [".env*", "node_modules", "releases", "tests", "seeds/catalog.*.json"]) {
    assert.match(dockerignore, new RegExp(`^${excluded.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));
  }
});

test("application container entry requires an explicit release mode and protected reviewed manifest", async () => {
  const entry = await source("scripts/application-container-entry.ts");
  assert.match(entry, /mode === "development"/);
  assert.match(entry, /mode === "staging-candidate"/);
  assert.match(entry, /mode === "reviewed"/);
  assert.match(entry, /CUAC_STAGING_EVIDENCE_MANIFEST/);
  assert.match(entry, /manifest\.startsWith\("\/"\)/);
  assert.match(entry, /Application container startup rejected/);
  assert.doesNotMatch(entry, /console\.error\([^)]*error/);
});
