import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = path => readFile(new URL(path, root), "utf8");

test("onboarding candidate initializes only the real student profile", async () => {
  const [html, script] = await Promise.all([
    source("public/onboarding-api.html"),
    source("public/onboarding-runtime.js"),
  ]);

  assert.match(html, /<body data-agent-mode="off">/);
  assert.match(html, /onboarding-workspace\.css\?v=/);
  assert.match(html, /src="shared-shell\.js"/);
  assert.match(html, /src="onboarding-runtime\.js\?v=/);
  assert.doesNotMatch(html, /cuac-data\.js|cuac-actions\.js|onboarding\.js|data-cuac-agent/);
  assert.match(script, /requestJson\("\/api\/v1\/student\/profile"/);
  assert.match(script, /method: "PATCH"/);
  assert.match(script, /requiredRole: "student"/);
  assert.match(script, /window\.location\.assign\("hub-api\.html"\)/);
  assert.doesNotMatch(script, /localStorage|sessionStorage|readiness|passport|transcript|budget|agent|mock/i);
});

test("onboarding fields match and preserve the study preference contract", async () => {
  const script = await source("public/onboarding-runtime.js");

  for (const field of ["degreeLevel", "subjectAreas", "teachingLanguage", "preferredCityIds", "fundingIntent", "intakeYear", "intakeTerm"]) {
    assert.ok(script.includes(field), `missing supported preference field: ${field}`);
  }
  assert.match(script, /subjectAreas\.length > 8/);
  assert.match(script, /displayName:/);
  assert.match(script, /targetDegreeLevel:/);
  assert.match(script, /preferences,/);
  assert.doesNotMatch(script, /currentCountry|stage|tuition|focus|cities:/);
});

test("onboarding workspace is restrained and responsive", async () => {
  const [html, css] = await Promise.all([
    source("public/onboarding-api.html"),
    source("public/onboarding-workspace.css"),
  ]);

  assert.match(html, /aria-live="polite"/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 800px\)/);
  assert.match(css, /@media \(max-width: 540px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient|border-radius:\s*(?:[1-9][0-9]|[1-9][0-9][0-9])px/);
});
