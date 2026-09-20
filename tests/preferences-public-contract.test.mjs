import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = path => readFile(new URL(path, root), "utf8");

test("preferences candidate uses server-backed account, student profile and notification state", async () => {
  const [html, script] = await Promise.all([
    source("public/preferences-api.html"),
    source("public/preferences-runtime.js"),
  ]);

  assert.match(html, /<body data-agent-mode="off">/);
  assert.match(html, /preferences-workspace\.css\?v=/);
  assert.match(html, /src="shared-shell\.js\?v=/);
  assert.match(html, /src="preferences-runtime\.js\?v=/);
  assert.doesNotMatch(html, /cuac-data\.js|cuac-actions\.js|preferences\.js|data-cuac-agent/);
  assert.match(script, /requestJson\("\/api\/v1\/student\/profile"/);
  assert.match(script, /requestJson\("\/api\/v1\/notifications\/preferences"/);
  assert.match(script, /window\.CUAC\?\.authReady\?\.\(\)/);
  assert.match(script, /accountEmailVerified/);
  assert.match(html, /data-account-identity/);
  assert.match(html, /Registered email|Loading account identity/);
  assert.match(script, /method: "PATCH"/);
  assert.match(script, /method: "PUT"/);
  assert.match(script, /expectedRevision: current\.revision/);
  assert.match(script, /requiredRole: "student"/);
  assert.doesNotMatch(script, /localStorage|sessionStorage|CuacDataClient|agent|theme|marketing|recommend/i);
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
  assert.match(css, /account-identity-card/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient|border-radius:\s*(?:[1-9][0-9]|[1-9][0-9][0-9])px/);
});

test("privacy requests are account-owned, structured and require step-up for export or deletion", async () => {
  const [html, script] = await Promise.all([source("public/preferences-api.html"), source("public/preferences-runtime.js")]);
  assert.match(html, /id="data-rights"/);
  assert.match(script, /\/api\/v1\/data-rights\/requests/);
  assert.match(script, /identity-confirmation/);
  assert.match(script, /Confirm identity to start review/);
  assert.match(script, /\/api\/v1\/auth\/step-up/);
  assert.match(script, /portable_export/);
  assert.match(script, /account_deletion/);
  assert.doesNotMatch(script, /dataRights.*localStorage|dataRights.*sessionStorage/i);
});
