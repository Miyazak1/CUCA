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
  assert.match(script, /schoolWorkflowFormats = new Set\(\["cuac\.program-application\.v1", "cuac\.program-application\.v2"\]\)/);
  assert.match(script, /\/api\/v1\/catalog\/programs\/\$\{encodeURIComponent\(programId\)\}/);
  assert.doesNotMatch(script, /catalog\/programs\?limit=100/);
  assert.match(script, /pageSize:\s*25/);
  assert.match(script, /limit:\s*String\(schoolState\.pageSize \+ 1\)/);
  assert.match(html, /data-school-page="previous"[\s\S]*data-school-page="next"/);
  assert.match(repository, /limit \$\$\{limitParameter\} offset \$\$\{offsetParameter\}/);
  assert.match(html, /href="school-settings-api\.html"/);
  assert.match(html, /当前版本不接收学生申请材料/);
  assert.match(script, /学生确认发送的基础联系信息；这不是申请材料/);
  assert.match(script, /证明材料由学生按学校官方渠道直接提交/);
  assert.match(script, /cuac\.school-visible-profile\.v1/);
  assert.match(script, /school-education-list/);
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

test("legacy school settings route forwards to the server-backed settings workspace", async () => {
  const [legacy, runtime] = await Promise.all([
    source("public/school-settings.html"),
    source("public/school-settings-runtime.js"),
  ]);

  assert.match(legacy, /http-equiv="refresh" content="0; url=school-settings-api\.html"/);
  assert.match(legacy, /window\.location\.replace\("school-settings-api\.html"\)/);
  assert.doesNotMatch(runtime, /<dt>学校租户 ID<\/dt>|<dt>用户 ID<\/dt>/);
  assert.match(runtime, /date\.getUTCFullYear\(\) < 2000/);
  assert.match(runtime, /return "尚未核验"/);
});
