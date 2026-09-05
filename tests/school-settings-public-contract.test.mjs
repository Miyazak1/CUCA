import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = path => readFile(new URL(path, root), "utf8");

test("school settings candidate uses current actor and tenant catalog APIs", async () => {
  const [html, script] = await Promise.all([
    source("public/school-settings-api.html"),
    source("public/school-settings-runtime.js"),
  ]);

  assert.match(html, /<body data-agent-mode="off">/);
  assert.match(html, /school-settings-workspace\.css\?v=/);
  assert.match(html, /src="shared-shell\.js"/);
  assert.match(html, /src="school-settings-runtime\.js\?v=/);
  assert.doesNotMatch(html, /completion\.js|completion\.css|cuac-data\.js|cuac-actions\.js|data-cuac-agent/);
  assert.match(script, /requestJson\("\/api\/v1\/me"\)/);
  assert.match(script, /requestJson\("\/api\/v1\/school\/catalog-corrections"/);
  assert.match(script, /\/api\/v1\/catalog\/schools\/\$\{encodeURIComponent\(auth\.tenantSchoolId\)\}/);
  assert.match(script, /actor\.tenantSchoolId !== auth\.tenantSchoolId/);
  assert.match(script, /school\.id !== auth\.tenantSchoolId/);
  assert.match(script, /requiredRole: "school_staff"/);
  assert.doesNotMatch(script, /localStorage|sessionStorage|CuacDataClient|DemoState|member|webhook|integration|apiKey/i);
});

test("school settings page displays only real actor and school detail fields", async () => {
  const script = await source("public/school-settings-runtime.js");

  for (const field of ["activeRole", "authStrength", "tenantSchoolId", "actorUserId"]) assert.ok(script.includes(`actor.${field}`));
  for (const field of ["id", "nameZh", "nameEn", "status", "schoolType", "region", "province", "cityZh", "city", "sourceStatus", "lastVerifiedAt", "websiteUrl", "admissionsUrl", "sourceUrl"]) {
    assert.ok(script.includes(`school.${field}`), `missing school field: ${field}`);
  }
  assert.match(script, /safeHttpsLink/);
  for (const field of ["websiteUrl", "admissionsUrl", "applicationLevel", "languageOfInstruction", "deadlineSummary", "tuitionSummary", "applicationFee"]) {
    assert.match(script, new RegExp(`${field}: \\{ label:`), `missing correction field: ${field}`);
  }
  assert.match(script, /sourceSchoolUpdatedAt: schoolSettingsState\.corrections\.school\.updatedAt/);
  assert.match(script, /changes: \{ \[field\]: clearValue \? null : proposed \}/);
  assert.doesNotMatch(script, /teamCount|applicantCount|acceptanceRate|contactEmail|owner/i);
});

test("school settings workspace is restrained and responsive", async () => {
  const [html, css] = await Promise.all([
    source("public/school-settings-api.html"),
    source("public/school-settings-workspace.css"),
  ]);

  assert.match(html, /aria-live="polite"/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /@media \(max-width: 500px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient|border-radius:\s*(?:[1-9][0-9]|[1-9][0-9][0-9])px/);
});
