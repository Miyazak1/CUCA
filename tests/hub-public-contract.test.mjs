import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = path => readFile(new URL(path, root), "utf8");

test("Hub candidate aggregates only authenticated account APIs", async () => {
  const [html, script] = await Promise.all([
    source("public/hub-api.html"),
    source("public/hub-runtime.js"),
  ]);

  assert.match(html, /<body data-agent-mode="off">/);
  assert.match(html, /hub-workspace\.css\?v=/);
  assert.match(html, /src="shared-shell\.js"/);
  assert.match(html, /src="hub-runtime\.js\?v=/);
  assert.doesNotMatch(html, /cuac-data\.js|cuac-actions\.js|hub\.js|data-cuac-agent/);
  for (const endpoint of [
    "/api/v1/student/profile",
    "/api/v1/student/application-sets",
    "/api/v1/student/saved-items",
    "/api/v1/notifications?limit=10",
  ]) assert.ok(script.includes(endpoint), `missing Hub endpoint: ${endpoint}`);
  assert.match(script, /Promise\.allSettled/);
  assert.match(script, /requiredRole: "student"/);
  assert.match(script, /credentials: "same-origin"/);
  assert.doesNotMatch(script, /localStorage|sessionStorage|CuacDataClient|DemoState|mock|recommend|probability/i);
});

test("Hub candidate does not infer unsupported readiness or deadline fields", async () => {
  const script = await source("public/hub-runtime.js");

  for (const field of ["cuacId", "name", "status", "revision", "targetIntake", "choices"]) {
    assert.ok(script.includes(`set.${field}`), `missing application-set field: ${field}`);
  }
  for (const field of ["displayName", "citizenshipCountry", "targetDegreeLevel", "targetIntake"]) {
    assert.ok(script.includes(`profile.${field}`), `missing profile field: ${field}`);
  }
  assert.match(script, /safeActionPath\(item\.actionPath\)/);
  assert.doesNotMatch(script, /deadline|readiness|completePercent|risk|admissionChance|ranking/i);
});

test("Hub workspace is restrained and responsive", async () => {
  const [html, css] = await Promise.all([
    source("public/hub-api.html"),
    source("public/hub-workspace.css"),
  ]);

  assert.match(html, /aria-live="polite"/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 840px\)/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient|border-radius:\s*(?:[1-9][0-9]|[1-9][0-9][0-9])px/);
});
