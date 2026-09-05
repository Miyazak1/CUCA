import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("school workspace uses only tenant-scoped server APIs", async () => {
  const [html, script, service, repository] = await Promise.all([
    source("public/school-portal.html"),
    source("public/school-portal-runtime.js"),
    source("src/server/school-portal/service.ts"),
    source("src/server/school-portal/postgres-repository.ts"),
  ]);

  assert.match(html, /school-workspace\.css\?v=/);
  assert.match(html, /school-portal-runtime\.js\?v=/);
  assert.doesNotMatch(html, /school-portal\.js|cuac-data\.js|cuac-actions\.js/);

  for (const endpoint of [
    "/api/v1/school/applications",
    "/api/v1/school/applications/${encodeURIComponent(id)}",
    "/api/v1/school/applications/${encodeURIComponent(detail.id)}/status",
    "/api/v1/school/applications/${encodeURIComponent(detail.id)}/contact-logs",
  ]) {
    assert.ok(script.includes(endpoint), `missing ${endpoint}`);
  }

  assert.match(script, /credentials:\s*"same-origin"/);
  assert.match(script, /expectedRevision:\s*detail\.schoolRevision/);
  assert.match(script, /"Idempotency-Key":\s*crypto\.randomUUID\(\)/);
  assert.match(script, /item\.schoolId !== schoolState\.tenantSchoolId/);
  assert.match(script, /applicationRecordFormat !== "cuac\.program-application\.v2"/);
  assert.doesNotMatch(script, /localStorage|sessionStorage|CuacDataClient|DemoState|sampleRecords|studentUserId/);

  assert.match(service, /applicationRecordFormat:\s*string/);
  assert.match(repository, /sa\.application_record_format as "applicationRecordFormat"/);
});

test("school workspace removes unsupported demo operations and fabricated student fields", async () => {
  const [html, script, css] = await Promise.all([
    source("public/school-portal.html"),
    source("public/school-portal-runtime.js"),
    source("public/school-workspace.css"),
  ]);

  assert.doesNotMatch(html, /导出 CSV|批量|负责人|优先级|资金意向|匹配摘要|监护人|Maya Chen|浙江大学/);
  assert.doesNotMatch(script, /owner|priority|fundingIntent|guardian|fitScore|applicationProbability/i);
  for (const status of [
    "new", "needs_review", "contact_queued", "contacted", "waiting_for_documents",
    "documents_received_by_school", "not_a_fit", "converted_to_official_application", "archived",
  ]) assert.ok(script.includes(status), `missing workflow status ${status}`);
  assert.match(css, /@media \(max-width: 560px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient/);
});
