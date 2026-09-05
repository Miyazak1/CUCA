import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = path => readFile(new URL(path, root), "utf8");

test("preferences candidate uses only student profile and notification APIs", async () => {
  const [html, script] = await Promise.all([
    source("public/preferences-api.html"),
    source("public/preferences-runtime.js"),
  ]);

  assert.match(html, /<body data-agent-mode="off">/);
  assert.match(html, /preferences-workspace\.css\?v=/);
  assert.match(html, /src="shared-shell\.js"/);
  assert.match(html, /src="preferences-runtime\.js\?v=/);
  assert.doesNotMatch(html, /cuac-data\.js|cuac-actions\.js|preferences\.js|data-cuac-agent/);
  assert.match(script, /requestJson\("\/api\/v1\/student\/profile"/);
  assert.match(script, /requestJson\("\/api\/v1\/notifications\/preferences"/);
  assert.match(script, /method: "PATCH"/);
  assert.match(script, /method: "PUT"/);
  assert.match(script, /expectedRevision: current\.revision/);
  assert.match(script, /requiredRole: "student"/);
  assert.doesNotMatch(script, /localStorage|sessionStorage|CuacDataClient|agent|password|theme|marketing|recommend/i);
});

test("study preference controls match the server parser contract", async () => {
  const script = await source("public/preferences-runtime.js");

  for (const field of ["degreeLevel", "subjectAreas", "teachingLanguage", "preferredCityIds", "fundingIntent", "intakeYear", "intakeTerm"]) {
    assert.ok(script.includes(field), `missing supported study preference: ${field}`);
  }
  for (const field of ["displayName", "targetDegreeLevel", "preferences"]) {
    assert.ok(script.includes(field), `missing profile update field: ${field}`);
  }
  assert.match(script, /subjectAreas\.length > 8/);
  assert.match(script, /input\.preferredCityIds/);
  assert.doesNotMatch(script, /citizenshipCountry\s*:/);
});

test("notification controls preserve channel booleans and revisions", async () => {
  const script = await source("public/preferences-runtime.js");

  for (const field of ["topic", "inAppEnabled", "emailEnabled", "smsEnabled", "revision"]) {
    assert.ok(script.includes(field), `missing notification preference field: ${field}`);
  }
  assert.match(script, /current\?\.topic === "account_security"/);
  assert.match(script, /inAppEnabled: required \? true/);
  assert.match(script, /emailEnabled: required \? true/);
});

test("preferences workspace is restrained and responsive", async () => {
  const [html, css] = await Promise.all([
    source("public/preferences-api.html"),
    source("public/preferences-workspace.css"),
  ]);

  assert.match(html, /aria-live="polite"/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 520px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient|border-radius:\s*(?:[1-9][0-9]|[1-9][0-9][0-9])px/);
});
